"""ctx aws -- AWS integration with Context-managed credentials."""

import json

import typer

app = typer.Typer(no_args_is_help=True)


@app.command("whoami")
def whoami() -> None:
    """Check AWS identity using Context-managed credentials."""
    from ctx.aws.core import get_caller_identity
    result = get_caller_identity()
    print(json.dumps(result, indent=2))


@app.command("spawn")
def spawn(
    instance_type: str = typer.Option("t3.medium", "--type", "-t", help="EC2 instance type"),
    count: int = typer.Option(1, "--count", "-n", help="Number of instances to launch"),
    no_rdp: bool = typer.Option(False, "--no-rdp", help="Skip automatic RDP registration"),
) -> None:
    """Spawn Windows EC2 instances and auto-register them as RDP sessions."""
    from ctx.aws.core import spawn_and_register
    results = spawn_and_register(
        instance_type=instance_type,
        count=count,
        auto_rdp=not no_rdp,
    )
    print(json.dumps(results, indent=2))


@app.command("list")
def list_instances() -> None:
    """List ctx-swarm EC2 instances."""
    from ctx.aws.core import run_aws
    from ctx.aws.credentials import aws_env

    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")
    result = run_aws(
        "ec2", "describe-instances",
        "--filters", "Name=tag:ctx,Values=swarm",
        "--region", region,
    )
    instances = []
    for res in result.get("Reservations", []):
        for inst in res.get("Instances", []):
            instances.append({
                "id": inst["InstanceId"],
                "type": inst["InstanceType"],
                "state": inst["State"]["Name"],
                "ip": inst.get("PublicIpAddress", "none"),
                "launched": inst.get("LaunchTime", ""),
            })
    if not instances:
        print("No swarm instances found.")
        return
    for inst in instances:
        print(f"{inst['id']}  {inst['type']}  {inst['state']}  ip={inst['ip']}")


@app.command("terminate")
def terminate(
    instance_ids: list[str] = typer.Argument(help="Instance IDs to terminate"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
) -> None:
    """Terminate swarm EC2 instances."""
    from ctx.aws.core import run_aws
    from ctx.aws.credentials import aws_env

    if not force:
        typer.confirm(f"Terminate {len(instance_ids)} instance(s)?", abort=True)

    env = aws_env()
    region = env.get("AWS_DEFAULT_REGION", "us-east-1")
    run_aws(
        "ec2", "terminate-instances",
        "--instance-ids", *instance_ids,
        "--region", region,
    )
    print(f"Terminated: {', '.join(instance_ids)}")
