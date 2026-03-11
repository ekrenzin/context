---
name: idor-audit
description: Focused IDOR / tenant-boundary audit. Use when changes affect permissions, controller/authorizer logic, list filters, or any endpoint that accepts IDs (org_id, agency_id, contactlist_id, etc.).
triggers:
  - security-audit
related_skills:
  - code-review
  - cross-repo-check
---

# IDOR / Tenant Boundary Audit

Use this when reviewing or shipping changes that might let a user access or mutate something they shouldn't.

## Step 0: Permission / Exposure Delta (Answer explicitly)

- **Permission delta**: Did this change alter *who* can read/write/delete anything?
  - New roles allowed? Existing roles widened?
  - Any "associated via junction table" path now authorizes mutations?
- **Exposure delta**: Did this change add/modify endpoints, filters, modes, joins, or includes that return more data?
  - New list endpoints or new query params that can be used for enumeration?
  - Any "drop the org filter" pattern introduced (e.g., switching to `id IN (...)` without scoping)?
- **Tenant boundary**: Is the request allowed to name tenant IDs (org_id/agency_id/etc.)?
  - If yes, where is the server-side validation that the requested ID is within the actor's authorized set?
  - If no, ensure scope is derived from session/user context and client-supplied scope is rejected.

## Read Paths (List/Show)

- **Org scoping stays explicit**: list endpoints must scope by `org_id` (or equivalent join constraint) for non-super-admins.
- **Search/pagination cannot widen scope**: `_search`, `filter.*`, and `sort` must filter *within* already-authorized rows.
- **Association-based reads are bounded**: if records are multi-tenant via junction tables, confirm associations cannot be abused to read cross-tenant data.

## Write Paths (Create/Update/Delete)

- **Owner vs consumer roles**: for shared resources (e.g., agency-owned objects used by child orgs), decide who can *mutate* vs who can only *read*.
- **Association mutation is scoped**: any `setOrganizations/addOrganizations` must validate target org IDs are allowed for the actor (and within the owning agency when applicable).
- **No ownership field writes**: ownership fields should not be editable unless super-admin and explicitly audited.
- **Secondary effects**: deletes/updates must not trigger cross-tenant cleanup.

## Required Security Tests (Small, High-Value)

At minimum, add or confirm tests that cover:

- **Negative authorization**: unauthorized role gets 403 for cross-tenant Show/List and Update/Delete.
- **Association mutation**: unauthorized org IDs in association updates are rejected.
- **Shared resources**: child-org admins cannot mutate agency-owned/shared assets.

## Cross-Repo Check (your-app vs your-service)

If the change touches platform DB associations that your-service uses for routing, validate your-service assumptions too:

- `OrganizationContactList`, contact list triggers, message profile contact list joins
- Alert type / event type routing changes

Sanity checks:

- your-service queries should not rely on platform-side associations that platform allows untrusted actors to mutate.
- If routing semantics change, update your-service tests that encode routing expectations.
