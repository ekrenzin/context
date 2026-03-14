---
name: deploy-site
description: Deploy the Context landing site to Cloudflare Pages. Use when the user asks to deploy the site, push the site live, publish the landing page, or update the production website.
related_skills:
  - landing-page
  - deploy
  - terminal-prompt
---

# Deploy Site

Deploy the Context landing site (`site/`) to Cloudflare Pages.

## Prerequisites

- `wrangler` CLI installed globally (`which wrangler` to verify)
- `wrangler` authenticated with Cloudflare
- Node dependencies installed in `site/`

## Auth Check

Before deploying, verify auth:

```bash
wrangler whoami
```

If not logged in, use the terminal-prompt system to let the user authenticate
interactively:

```bash
curl -s -X POST http://localhost:19470/api/terminal/action \
  -H "Content-Type: application/json" \
  -d '{"command":"wrangler","args":["login"],"title":"Cloudflare Login Required","description":"Authenticate with Cloudflare to enable deployments."}'
```

This shows a pulsing FAB in the Command Center. The user clicks it, completes
OAuth in the embedded terminal modal, and clicks Done. See the `terminal-prompt`
skill for full details.

**Important:** Use `wrangler` directly, not `npx wrangler`. The npx cache can
hold broken platform-specific binaries.

## Deploy Commands

All commands run from the `site/` directory.

**Production deploy:**

```bash
cd site && npm run deploy
```

This builds (TypeScript + Vite) and deploys to Cloudflare Pages in one step.
The project name is `context-site`.

**Preview deploy (non-production branch):**

```bash
cd site && npm run deploy:preview
```

Creates a preview deployment on a separate URL for testing before going live.

## What Happens

1. `tsc -b` -- type-checks the project
2. `vite build` -- produces static assets in `site/dist/`
3. `wrangler pages deploy dist/ --project-name=context-site` -- uploads to Cloudflare Pages

The live URL is printed by wrangler after a successful deploy. First deploy
creates the project on Cloudflare; subsequent deploys update it.

## Custom Domain

After the first deploy, add a custom domain in the Cloudflare dashboard:
Pages project > Custom domains > Add. Point `context.dev` (or your domain)
to the Pages project. Cloudflare handles SSL automatically.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `wrangler: command not found` | Install globally: `npm install -g wrangler` |
| Auth error / not logged in | Trigger terminal-prompt with `wrangler login` (see Auth Check above) |
| Build fails | Run `npm run build` in `site/` to see TypeScript or Vite errors |
| Project not found | Run `wrangler pages project create context-site --production-branch main` first |
| npx wrangler fails with workerd error | Use global `wrangler`, not `npx wrangler`. Clear npx cache if needed |

## Files

| File | Purpose |
|------|---------|
| `site/wrangler.toml` | Cloudflare Pages project config |
| `site/package.json` | `deploy` and `deploy:preview` scripts |
| `site/dist/` | Build output (git-ignored) |
