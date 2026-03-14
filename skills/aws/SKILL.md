---
name: aws
description: AWS cloud operations using Context-managed credentials. Use for EC2 instance spawning, bot swarms, S3, Lambda, and any AWS service interaction. Credentials are stored in Command Center settings -- never use AWS profiles or env vars directly.
triggers:
  - aws
  - ec2
  - s3
  - lambda
  - swarm
  - bot swarm
  - spawn instance
related_skills:
  - deploy
  - security-audit
  - desktop-automation
---

# AWS

All AWS operations use credentials stored in Command Center settings. Never
use `--profile`, `AWS_PROFILE`, or any other credential source.

## Credentials

Credentials are stored in Command Center settings (SQLite DB):

| Setting               | Description          |
|-----------------------|----------------------|
| `aws_access_key_id`     | IAM access key ID    |
| `aws_secret_access_key` | IAM secret key       |
| `aws_region`            | Default region       |

### Setting Credentials

Via Command Center API:
```bash
curl -X PUT http://localhost:19471/api/settings \
  -H 'Content-Type: application/json' \
  -d '{"aws_access_key_id":"AKIA...","aws_secret_access_key":"...","aws_region":"us-east-1"}'
```

### Verifying
```bash
ctx aws whoami
```

## Bot Swarm (EC2 + auto-RDP)

The primary use case: spin up Windows EC2 instances that auto-register as
RDP sessions in Command Center.

### Spawn Instances
```bash
# 1 instance, default t3.medium
ctx aws spawn

# 5 instances, larger type
ctx aws spawn --count 5 --type t3.xlarge

# Spawn without auto-RDP registration
ctx aws spawn --no-rdp
```

### What `ctx aws spawn` Does
1. Resolves the latest Windows Server 2022 AMI for the configured region
2. Creates/reuses a `ctx-swarm` key pair (for password decryption)
3. Creates/reuses a `ctx-swarm-rdp` security group (port 3389 open)
4. Launches the instance(s)
5. Waits for running state + public IP
6. Decrypts the Windows admin password (takes 4-10 min on first boot)
7. Registers each instance as an RDP session via `POST /api/rdp`

### List Swarm Instances
```bash
ctx aws list
```

### Terminate
```bash
ctx aws terminate i-abc123 i-def456
ctx aws terminate i-abc123 --force  # skip confirmation
```

## Direct AWS CLI Usage

For any `aws` CLI command, the agent must inject Context credentials via
the `ctx.aws.credentials.aws_env()` helper. Never pass `--profile`.

```python
from ctx.aws.credentials import aws_env
import subprocess
result = subprocess.run(
    ["aws", "s3", "ls", "--output", "json"],
    env=aws_env(),
    capture_output=True, text=True,
)
```

Or use the wrapper:
```python
from ctx.aws.core import run_aws
buckets = run_aws("s3api", "list-buckets")
```

## Risk Classification

| Operation | Risk | Action |
|-----------|------|--------|
| `describe-*`, `list-*`, `get-*`, `whoami` | read-only | Execute freely |
| `create-*`, `put-*`, `run-instances` | write | Execute, log what changed |
| `delete-*`, `terminate-*` | destructive | Confirm with user first |
