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


def emit(msg: dict) -> None:
    line = json.dumps(msg, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


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
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                loop.call_soon_threadsafe(queue.put_nowait, msg)
            except json.JSONDecodeError:
                pass
        loop.call_soon_threadsafe(queue.put_nowait, None)

    loop.run_in_executor(None, reader)
    return queue


async def frame_loop(conn, width: int, height: int) -> None:
    """Periodically capture the desktop buffer and emit as JPEG frames."""
    while True:
        try:
            img = conn.get_desktop_buffer(VIDEO_FORMAT.PIL)
            if img is not None:
                b64 = encode_frame(img)
                emit({"type": "frame", "data": b64, "w": width, "h": height})
        except Exception:
            pass
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
            emit({"type": "error", "message": str(exc)})


async def run_bridge(
    host: str,
    port: int,
    username: str,
    password: str,
    domain: str = "",
    width: int = 1280,
    height: int = 720,
) -> None:
    status("connecting", f"Connecting to {host}:{port}...")

    settings = RDPIOSettings()
    settings.video_width = width
    settings.video_height = height
    settings.video_bpp_min = 15
    settings.video_bpp_max = 24
    settings.video_out_format = VIDEO_FORMAT.PIL

    # Build connection URL: rdp+ntlm-password://domain\user:pass@host:port
    user_part = urlquote(username, safe="")
    pass_part = urlquote(password, safe="")
    domain_part = f"{urlquote(domain, safe='')}%5C" if domain else ""
    url = f"rdp+ntlm-password://{domain_part}{user_part}:{pass_part}@{host}:{port}"

    try:
        factory = RDPConnectionFactory.from_url(url, settings)
        conn = factory.get_connection(settings)
    except Exception as exc:
        emit({"type": "error", "message": f"Failed to create connection: {exc}"})
        return

    try:
        _, err = await conn.connect()
        if err is not None:
            emit({"type": "error", "message": f"Connection failed: {err}"})
            return
    except Exception as exc:
        emit({"type": "error", "message": f"Connection failed: {exc}"})
        return

    status("connected", f"Connected to {host}")

    stdin_queue = await read_stdin_lines()

    frame_task = asyncio.create_task(frame_loop(conn, width, height))
    input_task = asyncio.create_task(input_loop(conn, stdin_queue))

    try:
        await asyncio.gather(frame_task, input_task, return_exceptions=True)
    finally:
        frame_task.cancel()
        input_task.cancel()
        try:
            await conn.send_disconnect()
        except Exception:
            pass
        status("disconnected", "Disconnected")
