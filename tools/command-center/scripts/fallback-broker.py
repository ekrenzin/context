#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["amqtt>=0.11"]
# ///
"""
MQTT broker for the Context Command Center.

Run with: uv run tools/command-center/scripts/fallback-broker.py

Provides MQTT-over-WebSocket on port 9001 (required for browser clients)
and optionally MQTT-over-TCP with TLS on port 8883.
Auto-spawned by the Command Center server on startup.
"""
import argparse
import asyncio
import json
import logging
import os
import socket
import sys

from amqtt.broker import Broker


def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def load_security(config_dir: str | None) -> dict | None:
    if not config_dir:
        return None
    creds_path = os.path.join(config_dir, "credentials.json")
    if not os.path.exists(creds_path):
        return None
    try:
        with open(creds_path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def build_config(config_dir: str | None) -> dict:
    security = load_security(config_dir)

    has_tls = False
    cert_path = key_path = ""
    if security and security.get("brokerCertPath"):
        cert_path = security["brokerCertPath"]
        key_path = os.path.join(os.path.dirname(cert_path), "broker-key.pem")
        has_tls = os.path.exists(cert_path) and os.path.exists(key_path)

    tcp_port = 8883 if has_tls else 1883
    listeners: dict = {}

    if port_available(tcp_port):
        tcp_cfg: dict = {"type": "tcp", "bind": f"127.0.0.1:{tcp_port}"}
        if has_tls:
            tcp_cfg |= {"ssl": True, "certfile": cert_path, "keyfile": key_path}
        listeners["default"] = tcp_cfg
        listeners["ws"] = {"type": "ws", "bind": "127.0.0.1:9001"}
        tls_label = " (TLS)" if has_tls else ""
        print(f"[broker] TCP on {tcp_port}{tls_label}, WebSocket on 9001")
    else:
        listeners["default"] = {"type": "ws", "bind": "127.0.0.1:9001"}
        print(f"[broker] Port {tcp_port} in use -- WebSocket-only on 9001")

    passwd_path = os.path.join(config_dir, "passwd") if config_dir else None
    if passwd_path and os.path.exists(passwd_path):
        auth = {
            "plugins": ["auth_file"],
            "allow-anonymous": False,
            "password-file": passwd_path,
        }
        print("[broker] Authentication enabled")
    else:
        auth = {"allow-anonymous": True}
        print("[broker] WARNING: no credentials -- anonymous access allowed")

    return {
        "listeners": listeners,
        "auth": auth,
        "topic-check": {"enabled": False},
    }


async def main(config_dir: str | None) -> None:
    config = build_config(config_dir)
    broker = Broker(config)
    await broker.start()
    print("[broker] Ready")
    sys.stdout.flush()

    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass
    finally:
        await broker.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config-dir", default=None)
    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING)
    try:
        asyncio.run(main(args.config_dir))
    except KeyboardInterrupt:
        print("\n[broker] Stopped")
        sys.exit(0)
