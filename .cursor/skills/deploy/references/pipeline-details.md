# Pipeline Details

## your-app GitHub Actions

**Workflows**: `server-build.yml`, `client-build.yml`, `server-tests.yml`, `client-tests.yml`, `staging-tests.yml`, `manual-release.yml`.

**Server build** (`server-build.yml`): lint -> type check (`npx tsc --noEmit`) -> install deps -> build server. Runs on push/PR to main, master, develop. Uses Node 20, npm ci, Canvas system deps.

**Client build**: Similar structure for client bundle. Separate jobs for lint, types, build.

**Deploy**: Merges to main trigger deploy. Platform deploys to AWS Elastic Beanstalk. Check `manual-release.yml` for deployment steps.

## your-service GitHub Actions

**Workflow**: `ci.yml`. Runs on PR and push to main.

**Jobs**: Parallel test jobs - `test-notifier`, `test-camera`, `test-inovonics`, `test-maps`, `test-sirens`, `test-webhooks`, `test-gateway`, `test-pendants`, `test-rapidResponse`. Each: checkout -> npm install -> npm run test:<suite>.

**Secrets**: Injected as env vars: `SENDGRID_API_KEY`, `SIREN_PW`, `SIREN_UN`, `TWILIO_*`, `WEBHOOK_ENCRYPTION_KEY`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `STAGE`, `RR_*`. No serverless deploy in CI; deploy via separate release workflow.

## Secrets Flow

1. **Source**: AWS Secrets Manager holds production secrets.
2. **GitHub**: Secrets are manually or script-synced to GitHub Actions secrets (`gh secret set`).
3. **Runtime**: Workflows reference `${{ secrets.SECRET_NAME }}`. At deploy time, EB/Lambda receive env vars from the deployment configuration (e.g., EB environment variables, Serverless `provider.environment`).

Platform uses `SECRET_NAME` env var to fetch the full secret blob from Secrets Manager at app startup. your-service uses individual env vars (e.g., `WEBHOOK_ENCRYPTION_KEY`) that may be populated from GitHub secrets or from a fetched secret.

## Elastic Beanstalk Deployment Lifecycle

1. Build artifact (e.g., Node app) is created.
2. EB receives the deployment bundle (zip or direct deploy).
3. EB provisions/updates instances, runs health checks.
4. Health check: HTTP request to configured path. Must return 200.
5. If health check fails, deployment can roll back. Check EB console for events and health dashboard.
6. Deployment can take several minutes. Do not cancel and retry prematurely.

## Lambda/Serverless Deployment Lifecycle

1. `serverless deploy` (or equivalent) runs.
2. CloudFormation stack is updated. Resources (Lambda, IAM, etc.) are created/updated.
3. Lambda functions are packaged and uploaded.
4. Check CloudFormation stack events for failures. IAM permission errors often appear as vague "access denied" in logs.

## Common Failure Modes and Log Signatures

- **Lint/type failure**: Step name "Run TypeScript compiler" or "Run lint". Fix locally with `npm run lint`, `npx tsc --noEmit`.
- **Test failure**: Step name "Run ... Tests". Check the failing test output.
- **EB deployment failure**: "Health check failed", "Instance deployment failed". Check EB environment health and recent events.
- **Lambda deploy failure**: CloudFormation "UPDATE_FAILED" or "CREATE_FAILED". Check stack events for resource-specific errors.
- **IAM "access denied"**: Often during deploy when Lambda/EB role lacks permission. Check role policy and trust relationship.
