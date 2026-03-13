# Pre-flight Checklist

## Environment & Auth

- [ ] AWS profile/region configured in `.env`.
- [ ] JIRA_PROJECTS and API tokens accessible.
- [ ] `ctx workspace check` runs successfully on root.

## Workspace Readiness

- [ ] Run `/memory scan` for the current ticket/topic.
- [ ] Check `git status -sb` for `behind` status.
- [ ] Verify `package.json` for required sub-libraries (e.g., MUI, FFmpeg).

## Discovery

- [ ] Search for "Standard" or "Strategy" docs related to the task.
- [ ] Identify existing components that can be reused or extended.
