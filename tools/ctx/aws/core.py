"""AWS business logic -- EC2 instance spawning and RDP registration."""

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from ctx.aws.credentials import aws_env
from ctx.config import info, err

CC_BASE = "http://localhost:19471"
WINDOWS_AMI_PARAM = "/aws/service/ami-windows-latest/Windows_Server-2022-English-Full-Base"


def run_aws(*args: str, parse_json: bool = True) -> dict | str:
    """Run an aws CLI command with Context-managed credentials."""
    cmd = ["aws", *args, "--output", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True, env=aws_env())
    if result.returncode != 0:
        err(f"aws {' '.join(args[:3])}... failed: {result.stderr.strip()}")
        sys.exit(1)
    if parse_json and result.stdout.strip():
        return json.loads(result.stdout)
    return result.stdout.strip()


def get_caller_identity() -> dict:
    """Return STS caller identity."""
    return run_aws("sts", "get-caller-identity")


def resolve_windows_ami(region: str) -> str:
    """Get the latest Windows Server 2022 AMI ID for the region."""
    result = run_aws(
        "ssm", "get-parameter",
        "--name", WINDOWS_AMI_PARAM,
        "--region", region,
    )
    return result["Parameter"]["Value"]


def find_or_create_key_pair(region: str) -> str:
    """Ensure a ctx-swarm key pair exists, return the name."""
    name = "ctx-swarm"
    result = run_aws(
        "ec2", "describe-key-pairs",
        "--key-names", name,
        "--region", region,
    )
    pairs = result.get("KeyPairs", [])
    if pairs:
        return name

    info(f"Creating key pair '{name}'...")
    key_result = run_aws(
        "ec2", "create-key-pair",
        "--key-name", name,
        "--key-type", "rsa",
        "--region", region,
    )
    # Save private key for password decryption
    pem_path = Path("/tmp/ctx-rdp") / f"{name}.pem"
    pem_path.parent.mkdir(parents=True, exist_ok=True)
    pem_path.write_text(key_result["KeyMaterial"])
    pem_path.chmod(0o600)
    info(f"Private key saved to {pem_path}")
    return name


def find_or_create_security_group(region: str) -> str:
    """Ensure a ctx-swarm-rdp security group exists with RDP access."""
    name = "ctx-swarm-rdp"
    result = run_aws(
        "ec2", "describe-security-groups",
        "--filters", f"Name=group-name,Values={name}",
        "--region", region,
    )
    groups = result.get("SecurityGroups", [])
    if groups:
        return groups[0]["GroupId"]

    info(f"Creating security group '{name}'...")
    sg = run_aws(
        "ec2", "create-security-group",
        "--group-name", name,
        "--description", "RDP access for Context bot swarm",
        "--region", region,
    )
    sg_id = sg["GroupId"]

    run_aws(
        "ec2", "authorize-security-group-ingress",
        "--group-id", sg_id,
        "--protocol", "tcp",
        "--port", "3389",
        "--cidr", "0.0.0.0/0",
        "--region", region,
    )
    info(f"Security group {sg_id} created with RDP ingress.")
    return sg_id


def spawn_instance(
    instance_type: str = "t3.medium",
    count: int = 1,
) -> list[dict]:
    """Launch Windows EC2 instances and return instance info."""
    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")

    info(f"Resolving Windows AMI for {region}...")
    ami_id = resolve_windows_ami(region)
    info(f"AMI: {ami_id}")

    key_name = find_or_create_key_pair(region)
    sg_id = find_or_create_security_group(region)

    info(f"Launching {count} x {instance_type}...")
    result = run_aws(
        "ec2", "run-instances",
        "--image-id", ami_id,
        "--instance-type", instance_type,
        "--key-name", key_name,
        "--security-group-ids", sg_id,
        "--count", str(count),
        "--tag-specifications",
        f"ResourceType=instance,Tags=[{{Key=Name,Value=ctx-swarm}},{{Key=ctx,Value=swarm}}]",
        "--region", region,
    )

    instances = result["Instances"]
    ids = [i["InstanceId"] for i in instances]
    info(f"Launched: {', '.join(ids)}")
    return instances


def wait_for_instances(instance_ids: list[str]) -> list[dict]:
    """Wait for instances to be running and have public IPs."""
    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")

    info("Waiting for instances to enter 'running' state...")
    run_aws(
        "ec2", "wait", "instance-running",
        "--instance-ids", *instance_ids,
        "--region", region,
        parse_json=False,
    )

    result = run_aws(
        "ec2", "describe-instances",
        "--instance-ids", *instance_ids,
        "--region", region,
    )
    instances = []
    for res in result["Reservations"]:
        instances.extend(res["Instances"])
    return instances


def get_windows_password(instance_id: str, region: str) -> str:
    """Wait for and decrypt the Windows admin password."""
    pem_path = Path("/tmp/ctx-rdp/ctx-swarm.pem")
    if not pem_path.exists():
        err(f"Private key not found at {pem_path}. Cannot decrypt password.")
        sys.exit(1)

    info(f"Waiting for password data on {instance_id} (can take 4-10 min)...")
    for attempt in range(40):
        result = run_aws(
            "ec2", "get-password-data",
            "--instance-id", instance_id,
            "--priv-launch-key", str(pem_path),
            "--region", region,
        )
        password = result.get("PasswordData", "")
        if password:
            return password
        time.sleep(15)

    err(f"Timed out waiting for password on {instance_id}")
    sys.exit(1)


def register_rdp_session(host: str, username: str, password: str) -> dict:
    """Register instance as an RDP session in Command Center."""
    # Build a minimal .rdp config string for the RDP manager
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
    instances = spawn_instance(instance_type=instance_type, count=count)
    ids = [i["InstanceId"] for i in instances]

    running = wait_for_instances(ids)
    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")

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
