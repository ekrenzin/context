---
name: deploy
description: CI/CD and deployment workflows for your services. Use when modifying GitHub Actions, deploying to staging/production, managing environment configuration, or troubleshooting deployment failures. Covers the full pipeline from branch to production.
triggers:
  - staging-test
related_skills:
  - database-ops
  - cross-repo-check
  - cloudwatch-logs
  - security-audit
  - git-ops
---

# Deploy

Apply this workflow when working with CI/CD pipelines, deployment
configuration, or promoting changes through environments.

## Pipeline Structure

- Each repo has independent CI/CD via GitHub Actions.
- PRs trigger lint, type-check, and test jobs. Merges to main trigger deploy.
- The platform deploys to AWS Elastic Beanstalk. The notifier deploys as
  Lambda functions via Serverless Framework.
- Secrets are managed via GitHub Actions secrets, sourced from AWS Secrets
  Manager.

## Pre-Deployment Checklist

1. `git status` shows a clean staging area -- no untracked files that should
   be committed, no accidentally staged files.
2. All quality gates pass locally: lint, types, tests.
3. Environment variables and secrets required by the change are present in
   the target environment. Use `gh secret list` to verify.
4. If the change adds a new secret, update the GitHub Action workflow to
   reference it and coordinate the secret creation in AWS.

## Common Deployment Patterns

- **Git stash/branch isolation**: When cleanup changes mix with feature work,
  use `git stash` to isolate them into separate branches and PRs.
- **Incremental CI/CD blockers**: Deployment failures often cascade. Fix the
  first failure, re-run, and address the next. Do not try to fix all blockers
  in a single pass without verifying each fix.
- **JSON/YAML validation**: Validate configuration files before deploying.
  A malformed config can take down the service.

## Environment Configuration

- Staging and production share the same codebase but differ in environment
  variables. Changes that depend on new env vars must have those vars set
  in the target environment before deploying.
- AWS credentials use IAM roles with SSO. Credential timing issues (expired
  tokens) are a known failure mode -- refresh SSO before long operations.
- Elastic Beanstalk deployments can take several minutes. Do not cancel and
  retry impatiently -- check the EB console for status.

## Troubleshooting Failures

- Check GitHub Actions logs first. The failing step usually names the issue.
- For EB deployment failures, check the EB health dashboard and recent events.
- For Lambda deployment failures, check CloudFormation stack events.
- IAM permission errors often manifest as vague "access denied" messages.
  Check the role's policy and trust relationship.

## Before Completing Deployment Work

1. Verify the pipeline runs green on a test push.
2. Confirm secrets and env vars are set in the target environment.
3. For workflow changes, validate YAML syntax before committing.
4. Run `/code-review` on any modified workflow files.

## Additional Resources

- For pipeline structure, secrets flow, and failure modes, see [references/pipeline-details.md](references/pipeline-details.md)
