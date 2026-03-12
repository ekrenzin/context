---
name: preflight
description: Pre-work validation checklist. Use before starting implementation on any non-trivial task. Verifies environment, branches, assumptions, docs, and available tooling to avoid the most common agent failure -- starting work on wrong assumptions. Addresses 200+ identified gaps across session history.
triggers:
  - memory
related_skills:
  - action-ticket
  - feature-dev
  - debug
---

# Preflight

Run this checklist before writing any implementation code. The single most
common gap in session history (34% of all gaps) is failing to verify
assumptions before starting work. This skill exists to prevent that.

## 1. Verify the Environment

Before touching code, confirm the working context is correct:

- [ ] Correct repo and branch. Run `git branch --show-current` and confirm
  it matches the expected target. If working on a ticket, check for existing
  branches (`git branch -a | grep <ticket-id>`).
- [ ] Working directory is clean or intentionally dirty. Run `git status`.
  Stash or commit unrelated changes before starting.
- [ ] Required secrets and env vars exist. If the task involves encryption,
  API keys, or AWS services, verify the credentials are available before
  writing code that depends on them.
- [ ] Dependencies are installed and current. If unsure, run the install
  command for the repo.

## 2. Read Before Writing

Consult existing knowledge before making assumptions:

- [ ] Check `memory/` for prior decisions, known issues, and progress on
  this topic. Run `/memory` scan with relevant keywords.
- [ ] Read `docs/repos/<name>.md` for the target repo's conventions and
  architecture.
- [ ] Check `docs/architecture.md` if the task touches cross-service
  boundaries (MQTT, SQS, API contracts).
- [ ] Read the existing code in the area you will modify. Understand the
  current patterns before introducing new ones.
- [ ] Search for prior PRs or branches related to this work. Someone may
  have started this already.

## 3. Validate Assumptions

Challenge your initial understanding:

- [ ] If the task mentions a specific file, endpoint, or component -- verify
  it exists at the expected path before building on that assumption.
- [ ] If the task involves a bug -- reproduce it before theorizing. Run
  `/debug` Step 1.
- [ ] If the task scope seems large -- confirm the boundaries with the user
  before going broad. Scope creep wastes cycles.
- [ ] If working with data (DB, API responses) -- check actual data shape,
  not assumed shape. Timestamps, nullability, and field names are common
  sources of wrong assumptions.

## 4. Inventory Available Tools

Check what already exists before building from scratch:

- [ ] Search `tools/scripts/` for scripts that do what you need.
- [ ] Check `docs/tooling-registry.md` for registered tools.
- [ ] Check available skills with the skill list. A skill may already encode
  the workflow you need.
- [ ] If the task involves AWS, check for existing wrapper scripts before
  writing raw CLI commands.

## 5. Plan the Approach

For non-trivial tasks, state the plan before executing:

- [ ] Identify which files will be modified.
- [ ] Identify which tests will validate the change.
- [ ] Identify cross-repo impact if any.
- [ ] If the plan has more than 5 steps, use `/feature-dev` for structured
  planning.

## When to Skip

This checklist is for non-trivial work. Skip it for:
- Single-file edits with obvious scope
- Questions and read-only exploration
- Quick fixes where the problem and solution are both clear
