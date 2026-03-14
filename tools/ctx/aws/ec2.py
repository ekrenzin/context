"""EC2 instance lifecycle: spawn, wait, password retrieval."""

import time
from pathlib import Path

from ctx.aws.cli import run_aws
from ctx.aws.credentials import aws_env
from ctx.config import info, err

import sys

WINDOWS_AMI_PARAM = "/aws/service/ami-windows-latest/Windows_Server-2022-English-Full-Base"


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
    if result.get("KeyPairs"):
        return name

    info(f"Creating key pair '{name}'...")
    key_result = run_aws(
        "ec2", "create-key-pair",
        "--key-name", name,
        "--key-type", "rsa",
        "--region", region,
    )
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


def spawn_instances(
    instance_type: str,
    count: int,
    region: str,
) -> list[dict]:
    """Launch Windows EC2 instances."""
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
        "ResourceType=instance,Tags=[{Key=Name,Value=ctx-swarm},{Key=ctx,Value=swarm}]",
        "--region", region,
    )

    ids = [i["InstanceId"] for i in result["Instances"]]
    info(f"Launched: {', '.join(ids)}")
    return result["Instances"]


def wait_for_running(instance_ids: list[str], region: str) -> list[dict]:
    """Wait for instances to be running and have public IPs."""
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
    for _ in range(40):
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
