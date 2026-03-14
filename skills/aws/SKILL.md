---
name: aws
description: AWS cloud operations via the AWS CLI. Use when the user asks about AWS resources, deployments, infrastructure, S3 buckets, Lambda functions, EC2 instances, IAM, CloudFormation, or any AWS service interaction.
triggers:
  - aws
  - s3
  - lambda
  - ec2
  - iam
  - cloudformation
  - dynamodb
  - sqs
  - sns
  - ecs
  - rds
  - cloudwatch
  - route53
related_skills:
  - deploy
  - security-audit
  - database-ops
---

# AWS

Interact with AWS directly via the `aws` CLI. Do not wrap commands in SDK
code or MCP tools -- just run them.

## Credentials

AWS CLI is installed at `/usr/local/bin/aws` (v2).

Available profiles:

| Profile            | Usage                        |
|--------------------|------------------------------|
| `sos-gov`          | GovCloud (default in `.mcp.json`) |
| `default`          | Default account              |
| `sos-legacy-prod`  | Legacy production            |
| `sos-prod`         | Production                   |

### Setting Credentials

To configure a new profile or update keys:

```bash
aws configure --profile <name>
# Prompts for: Access Key ID, Secret Access Key, Region, Output format
```

To set credentials non-interactively (for agents):

```bash
aws configure set aws_access_key_id <KEY> --profile <name>
aws configure set aws_secret_access_key <SECRET> --profile <name>
aws configure set region <REGION> --profile <name>
```

To verify identity:

```bash
aws sts get-caller-identity --profile <name>
```

### Switching Profiles

Always pass `--profile <name>` explicitly. Do not modify `AWS_PROFILE` env
vars globally. If the user specifies an account or environment, map it to the
correct profile.

## CLI Patterns

### Output Formatting

Use `--output json` for structured data, `--output table` for human-readable,
`--query` for JMESPath filtering:

```bash
# List S3 buckets, names only
aws s3api list-buckets --query 'Buckets[].Name' --output json

# EC2 instances: ID, type, state
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,State:State.Name}' \
  --output table

# Lambda functions in a region
aws lambda list-functions --region us-east-1 --query 'Functions[].FunctionName'
```

### Common Operations

**S3**:
```bash
aws s3 ls s3://bucket/prefix/
aws s3 cp local-file s3://bucket/key
aws s3 sync ./dir s3://bucket/prefix/
```

**Lambda**:
```bash
aws lambda list-functions
aws lambda invoke --function-name <name> --payload '{}' /dev/stdout
aws lambda get-function --function-name <name>
```

**EC2**:
```bash
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running"
aws ec2 describe-security-groups
```

**CloudFormation**:
```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
aws cloudformation describe-stack-events --stack-name <name> --max-items 20
```

**IAM**:
```bash
aws iam list-users
aws iam list-roles
aws iam list-attached-user-policies --user-name <name>
```

## Risk Classification

| Operation | Risk | Action |
|-----------|------|--------|
| `describe-*`, `list-*`, `get-*` | read-only | Execute freely |
| `create-*`, `put-*`, `update-*`, `tag-*` | write | Execute, log what changed |
| `delete-*`, `terminate-*`, `deregister-*` | destructive | Confirm with user first |
| `deploy`, `update-stack` | destructive | Confirm with user first |

## Gotchas

- GovCloud (`us-gov-*`) regions use different service endpoints. Always pass
  `--region` when targeting GovCloud.
- SSO tokens expire. If you get `ExpiredTokenException`, tell the user to run
  `aws sso login --profile <name>`.
- Paginated results: use `--no-paginate` for quick reads or `--page-size` to
  control batch size. For full enumeration, let the CLI paginate automatically.
- JSON payloads in `--payload` or `--cli-input-json` must be valid JSON. Use
  single quotes around the payload to avoid shell escaping issues.
- `--query` uses JMESPath, not JSONPath. The syntax is different.
