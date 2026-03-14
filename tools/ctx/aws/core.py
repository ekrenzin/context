"""AWS orchestration: spawn-and-register pipeline."""

import json
import urllib.request

from ctx.aws.cli import run_aws
from ctx.aws.credentials import aws_env
from ctx.aws.ec2 import spawn_instances, wait_for_running, get_windows_password
from ctx.config import info, err

CC_BASE = "http://localhost:19471"


def get_caller_identity() -> dict:
    """Return STS caller identity."""
    return run_aws("sts", "get-caller-identity")


def register_rdp_session(host: str, username: str, password: str) -> dict:
    """Register instance as an RDP session in Command Center."""
    config = f"full address:s:{host}:3389\nusername:s:{username}\n"
    payload = json.dumps({
        "config": config,
        "password": password,
        "width": 1280,
        "height": 720,
    }).encode()

    req = urllib.request.Request(
        f"{CC_BASE}/api/rdp",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def spawn_and_register(
    instance_type: str = "t3.medium",
    count: int = 1,
    auto_rdp: bool = True,
) -> list[dict]:
    """Full pipeline: spawn instances, wait, get passwords, register RDP."""
    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")

    info(f"Resolving Windows AMI for {region}...")
    instances = spawn_instances(instance_type, count, region)
    ids = [i["InstanceId"] for i in instances]

    running = wait_for_running(ids, region)

    results = []
    for inst in running:
        iid = inst["InstanceId"]
        public_ip = inst.get("PublicIpAddress", "")
        if not public_ip:
            err(f"{iid} has no public IP -- skipping RDP registration")
            results.append({"instance_id": iid, "status": "no_public_ip"})
            continue

        info(f"{iid} running at {public_ip}")

        if not auto_rdp:
            results.append({
                "instance_id": iid,
                "public_ip": public_ip,
                "status": "running",
            })
            continue

        password = get_windows_password(iid, region)
        info(f"{iid} password decrypted, registering RDP session...")

        try:
            session = register_rdp_session(public_ip, "Administrator", password)
            info(f"{iid} -> RDP session {session.get('id', 'unknown')}")
            results.append({
                "instance_id": iid,
                "public_ip": public_ip,
                "rdp_session_id": session.get("id"),
                "status": "connected",
            })
        except Exception as exc:
            err(f"RDP registration failed for {iid}: {exc}")
            results.append({
                "instance_id": iid,
                "public_ip": public_ip,
                "status": "rdp_failed",
                "password": password,
            })

    return results
