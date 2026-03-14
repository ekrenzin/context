"""RDP bridge: connects to an RDP host, streams frames on stdout, reads input on stdin.

Protocol (JSON lines over stdio):
  stdout -> {"type":"frame","data":"<base64 jpeg>","w":1280,"h":720}
  stdout -> {"type":"status","phase":"connected","message":"..."}
  stdout -> {"type":"error","message":"..."}
  stdin  <- {"type":"mouse","x":100,"y":200,"button":"left","pressed":true}
  stdin  <- {"type":"mouse","x":100,"y":200,"button":"move"}
  stdin  <- {"type":"key","scancode":28,"pressed":true,"extended":false}
  stdin  <- {"type":"disconnect"}
"""

import asyncio
import base64
import io
import json
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

# Auth schemes to try in order (plain first for AWS EC2, then CredSSP/NTLM)
AUTH_SCHEMES = [
    "rdp+ntlm-password",
    "rdp+plain",
]


def emit(msg: dict) -> None:
    line = json.dumps(msg, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def log(message: str) -> None:
    print(f"[rdp-bridge] {message}", file=sys.stderr, flush=True)


def status(phase: str, message: str) -> None:
    emit({"type": "status", "phase": phase, "message": message})


def encode_frame(img: Image.Image, quality: int = 60) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode("ascii")


async def read_stdin_lines() -> asyncio.Queue:
    """Read JSON lines from stdin in a background thread."""
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


async def frame_loop(conn, width: int, height: int) -> None:
    """Periodically capture the desktop buffer and emit as JPEG frames."""
    frame_count = 0
    empty_count = 0
    while True:
        try:
            img = conn.get_desktop_buffer(VIDEO_FORMAT.PIL)
            if img is not None:
                if frame_count == 0:
                    log(f"first frame received ({img.size[0]}x{img.size[1]})")
                b64 = encode_frame(img)
                emit({"type": "frame", "data": b64, "w": width, "h": height})
                frame_count += 1
                empty_count = 0
            else:
                empty_count += 1
                if empty_count == 50:  # ~5 seconds of no frames
                    log("no frames received for 5 seconds")
                if empty_count > 300:  # ~30 seconds
                    emit({"type": "error", "message": "No frames received for 30 seconds"})
                    return
        except Exception as exc:
            log(f"frame error: {exc}")
        await asyncio.sleep(0.1)  # ~10 fps


async def input_loop(conn, queue: asyncio.Queue) -> None:
    """Process input messages from stdin and forward to the RDP connection."""
    while True:
        msg = await queue.get()
        if msg is None:
            break

        try:
            if msg["type"] == "mouse":
                button = BUTTON_MAP.get(msg.get("button", "move"), MOUSEBUTTON.MOUSEBUTTON_HOVER)
                pressed = msg.get("pressed", False)
                x = int(msg.get("x", 0))
                y = int(msg.get("y", 0))
                await conn.send_mouse(button, x, y, pressed)

            elif msg["type"] == "key":
                scancode = int(msg["scancode"])
                pressed = msg.get("pressed", True)
                extended = msg.get("extended", False)
                await conn.send_key_scancode(scancode, pressed, extended)

            elif msg["type"] == "disconnect":
                break
        except Exception as exc:
            log(f"input error: {exc}")


async def try_connect(host, port, username, password, domain, settings):
    """Try connecting with each auth scheme until one works."""
    user_part = urlquote(username, safe="")
    pass_part = urlquote(password, safe="")
    domain_part = f"{urlquote(domain, safe='')}%5C" if domain else ""
    last_err = None

    for scheme in AUTH_SCHEMES:
        url = f"{scheme}://{domain_part}{user_part}:{pass_part}@{host}:{port}"
        log(f"trying {scheme}...")
        status("connecting", f"Trying {scheme.split('+')[1]} auth...")

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

    result = await try_connect(host, port, username, password, domain, settings)

    if isinstance(result, str):
        emit({"type": "error", "message": f"All auth methods failed. Last error: {result}"})
        return

    conn = result
    status("connected", f"Connected to {host}")
    log("connection established, starting frame loop")

    stdin_queue = await read_stdin_lines()

    frame_task = asyncio.create_task(frame_loop(conn, width, height))
    input_task = asyncio.create_task(input_loop(conn, stdin_queue))

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
