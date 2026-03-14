"""RDP bridge: connects to an RDP host, streams frames to clients.

Supports two modes:
  1. stdio  -- JSON lines over stdin/stdout (legacy, for testing)
  2. socket -- Unix domain socket server (for persistent sessions)

Protocol (JSON lines):
  out -> {"type":"frame","data":"<base64 jpeg>","w":1280,"h":720}
  out -> {"type":"status","phase":"connected","message":"..."}
  out -> {"type":"error","message":"..."}
  in  <- {"type":"mouse","x":100,"y":200,"button":"left","pressed":true}
  in  <- {"type":"key","scancode":28,"pressed":true,"extended":false}
  in  <- {"type":"disconnect"}
"""

import asyncio
import base64
import io
import json
import os
import sys
import traceback
from urllib.parse import quote as urlquote

from aardwolf.commons.factory import RDPConnectionFactory
from aardwolf.commons.iosettings import RDPIOSettings
from aardwolf.commons.queuedata.constants import MOUSEBUTTON, VIDEO_FORMAT
from PIL import Image


BUTTON_MAP = {
    "left": MOUSEBUTTON.MOUSEBUTTON_LEFT,
    "right": MOUSEBUTTON.MOUSEBUTTON_RIGHT,
    "middle": MOUSEBUTTON.MOUSEBUTTON_MIDDLE,
    "move": MOUSEBUTTON.MOUSEBUTTON_HOVER,
    "wheel_up": MOUSEBUTTON.MOUSEBUTTON_WHEEL_UP,
    "wheel_down": MOUSEBUTTON.MOUSEBUTTON_WHEEL_DOWN,
}

AUTH_SCHEMES = [
    "rdp+ntlm-password",
    "rdp+plain",
]


def log(message: str) -> None:
    print(f"[rdp-bridge] {message}", file=sys.stderr, flush=True)


def encode_frame(img: Image.Image, quality: int = 60) -> str:
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode("ascii")


async def try_connect(host, port, username, password, domain, settings):
    """Try connecting with each auth scheme until one works."""
    user_part = urlquote(username, safe="")
    pass_part = urlquote(password, safe="")
    domain_part = f"{urlquote(domain, safe='')}%5C" if domain else ""
    last_err = None

    for scheme in AUTH_SCHEMES:
        url = f"{scheme}://{domain_part}{user_part}:{pass_part}@{host}:{port}"
        log(f"trying {scheme}...")
        last_err_scheme = scheme.split("+")[1]

        try:
            factory = RDPConnectionFactory.from_url(url, settings)
            conn = factory.get_connection(settings)
            _, err = await conn.connect()
            if err is None:
                log(f"connected via {scheme}")
                return conn
            last_err = str(err)
            log(f"{scheme} failed: {err}")
        except Exception as exc:
            last_err = str(exc)
            log(f"{scheme} failed: {exc}")

    return last_err


# -- Broadcaster: fan-out frames/status to multiple socket clients ----------

class Broadcaster:
    """Manages multiple client connections and fans out messages."""

    def __init__(self):
        self._clients: dict[asyncio.StreamWriter, asyncio.Queue] = {}

    def add(self, writer: asyncio.StreamWriter) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=5)
        self._clients[writer] = q
        return q

    def remove(self, writer: asyncio.StreamWriter) -> None:
        self._clients.pop(writer, None)

    @property
    def count(self) -> int:
        return len(self._clients)

    def broadcast(self, msg: dict) -> None:
        line = json.dumps(msg, separators=(",", ":")) + "\n"
        dead = []
        for writer in self._clients:
            try:
                writer.write(line.encode())
            except Exception:
                dead.append(writer)
        for w in dead:
            self.remove(w)


# -- Frame loop (shared across all clients) ---------------------------------

async def frame_loop(conn, width: int, height: int, bc: Broadcaster) -> None:
    frame_count = 0
    empty_count = 0
    while True:
        try:
            img = conn.get_desktop_buffer(VIDEO_FORMAT.PIL)
            if img is not None:
                if frame_count == 0:
                    log(f"first frame: {img.size[0]}x{img.size[1]}")
                b64 = encode_frame(img)
                bc.broadcast({"type": "frame", "data": b64, "w": width, "h": height})
                frame_count += 1
                empty_count = 0
            else:
                empty_count += 1
                if empty_count == 50:
                    log("no frames received for 5 seconds")
                if empty_count > 300:
                    bc.broadcast({"type": "error", "message": "No frames for 30s"})
                    return
        except Exception as exc:
            log(f"frame error: {exc}")
        await asyncio.sleep(0.1)


# -- Input processing -------------------------------------------------------

async def process_input(conn, msg: dict) -> bool:
    """Process a single input message. Returns False if disconnect requested."""
    try:
        if msg["type"] == "mouse":
            button = BUTTON_MAP.get(msg.get("button", "move"), MOUSEBUTTON.MOUSEBUTTON_HOVER)
            await conn.send_mouse(button, int(msg.get("x", 0)), int(msg.get("y", 0)), msg.get("pressed", False))
        elif msg["type"] == "key":
            await conn.send_key_scancode(int(msg["scancode"]), msg.get("pressed", True), msg.get("extended", False))
        elif msg["type"] == "disconnect":
            return False
    except Exception as exc:
        log(f"input error: {exc}")
    return True


# -- Socket server mode ------------------------------------------------------

async def handle_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    conn,
    bc: Broadcaster,
) -> None:
    """Handle a single socket client: relay input, receive broadcast frames."""
    q = bc.add(writer)
    log(f"client connected (total: {bc.count})")

    # Send current status
    writer.write(json.dumps({"type": "status", "phase": "connected", "message": "Attached"}).encode() + b"\n")

    async def drain_writer():
        """Periodically drain the writer to flush buffered frames."""
        while True:
            try:
                await writer.drain()
            except Exception:
                return
            await asyncio.sleep(0.05)

    drain_task = asyncio.create_task(drain_writer())
    buf = b""

    try:
        while True:
            data = await reader.read(4096)
            if not data:
                break
            buf += data
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                    if not await process_input(conn, msg):
                        return
                except json.JSONDecodeError:
                    pass
    except (asyncio.CancelledError, ConnectionResetError):
        pass
    finally:
        drain_task.cancel()
        bc.remove(writer)
        writer.close()
        log(f"client disconnected (remaining: {bc.count})")


async def run_socket_bridge(
    host: str,
    port: int,
    username: str,
    password: str,
    domain: str,
    width: int,
    height: int,
    socket_path: str,
) -> None:
    """Run bridge in socket server mode. Multiple clients can attach/detach."""
    log(f"socket mode: {socket_path}")
    bc = Broadcaster()

    # Emit status to stdout for the spawner to read the READY signal
    def emit_stdout(msg: dict) -> None:
        sys.stdout.write(json.dumps(msg, separators=(",", ":")) + "\n")
        sys.stdout.flush()

    emit_stdout({"type": "status", "phase": "connecting", "message": f"Connecting to {host}:{port}..."})

    settings = RDPIOSettings()
    settings.video_width = width
    settings.video_height = height
    settings.video_bpp_min = 15
    settings.video_bpp_max = 24
    settings.video_out_format = VIDEO_FORMAT.PIL
    # Disable clipboard channel -- aardwolf RDPECLIP crashes on Ctrl+V
    settings.channels = [ch for ch in settings.channels if ch.__name__ != "RDPECLIPChannel"]

    result = await try_connect(host, port, username, password, domain, settings)
    if isinstance(result, str):
        emit_stdout({"type": "error", "message": f"All auth methods failed: {result}"})
        return

    conn = result
    emit_stdout({"type": "status", "phase": "connected", "message": f"Connected to {host}"})
    # Signal ready for the Node spawner
    emit_stdout({"type": "ready"})

    # Start the Unix socket server
    server = await asyncio.start_unix_server(
        lambda r, w: handle_client(r, w, conn, bc),
        path=socket_path,
    )
    os.chmod(socket_path, 0o600)
    log(f"listening on {socket_path}")

    # Run frame loop until RDP connection drops
    try:
        await frame_loop(conn, width, height, bc)
    finally:
        server.close()
        await server.wait_closed()
        try:
            await conn.send_disconnect()
        except Exception:
            pass
        try:
            os.unlink(socket_path)
        except OSError:
            pass
        log("bridge exiting")


# -- Stdio mode (legacy) -----------------------------------------------------

async def read_stdin_lines() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def reader():
        try:
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                    loop.call_soon_threadsafe(queue.put_nowait, msg)
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass
        loop.call_soon_threadsafe(queue.put_nowait, None)

    loop.run_in_executor(None, reader)
    return queue


async def stdio_input_loop(conn, queue: asyncio.Queue) -> None:
    while True:
        msg = await queue.get()
        if msg is None:
            break
        if not await process_input(conn, msg):
            break


def emit(msg: dict) -> None:
    line = json.dumps(msg, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def status(phase: str, message: str) -> None:
    emit({"type": "status", "phase": phase, "message": message})


class StdioBroadcaster:
    """Broadcaster that writes to stdout (single-client legacy mode)."""

    def broadcast(self, msg: dict) -> None:
        emit(msg)


async def run_bridge(
    host: str,
    port: int,
    username: str,
    password: str,
    domain: str = "",
    width: int = 1280,
    height: int = 720,
) -> None:
    log(f"starting bridge to {host}:{port} as {username}")
    status("connecting", f"Connecting to {host}:{port}...")

    settings = RDPIOSettings()
    settings.video_width = width
    settings.video_height = height
    settings.video_bpp_min = 15
    settings.video_bpp_max = 24
    settings.video_out_format = VIDEO_FORMAT.PIL
    # Disable clipboard channel -- aardwolf RDPECLIP crashes on Ctrl+V
    settings.channels = [ch for ch in settings.channels if ch.__name__ != "RDPECLIPChannel"]

    result = await try_connect(host, port, username, password, domain, settings)
    if isinstance(result, str):
        emit({"type": "error", "message": f"All auth methods failed. Last error: {result}"})
        return

    conn = result
    status("connected", f"Connected to {host}")
    log("connection established, starting frame loop")

    stdin_queue = await read_stdin_lines()
    bc = StdioBroadcaster()

    frame_task = asyncio.create_task(frame_loop(conn, width, height, bc))
    input_task = asyncio.create_task(stdio_input_loop(conn, stdin_queue))

    try:
        done, pending = await asyncio.wait(
            [frame_task, input_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in done:
            exc = task.exception()
            if exc:
                log(f"task error: {exc}\n{traceback.format_exception(exc)}")
        for task in pending:
            task.cancel()
    finally:
        try:
            await conn.send_disconnect()
        except Exception:
            pass
        status("disconnected", "Disconnected")
        log("bridge exiting")
