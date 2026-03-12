# RBAC and Auth Patterns

## Route-Level RBAC (Authorizer Middleware)

Each resource has an authorizer module (e.g., `authorizers/Webhook.js`, `authorizers/Zone.js`). Functions: `canShow`, `canCreate`, `canUpdate`, `canDestroy`, `canList`.

**Pattern**: Authorizer returns a value; the controller or middleware interprets it. Common helpers: `restrictToOrg`, `restrictToSuperUser` from `authorizers/utils/orgUser.js`.

**Flow**: Request hits route -> `checkAuthenticated` -> authorizer (e.g., `canUpdate`) -> controller. If authorizer denies, controller returns 403 before doing work.

**Enforcement**: Backend must reject. UI hiding is not sufficient. A user can call the API directly; the authorizer is the gate.

## UI vs Backend Enforcement

- **UI**: Hide buttons, links, and forms for actions the user cannot perform. Improves UX.
- **Backend**: Every mutation endpoint must run the authorizer. Never rely on "the UI does not show this" for security.

Test: As an org-admin, call an endpoint for another org's resource. Expect 403.

## Token Validation Checklist

- **Expiration**: JWT `exp` claim must be checked. Reject expired tokens.
- **Signature**: Verify with the correct secret/key. Do not skip verification in dev.
- **Issuer**: Validate `iss` if your auth provider sets it.
- **Audience**: Validate `aud` if applicable.

Do not trust client-supplied claims (e.g., `org_ids`) without server-side verification against the token and database.

## Multi-Tenant Data Scoping

Always scope queries by organization. Pattern:
```javascript
const orgIds = getUserOrgIds(req); // From authorizer utils
if (!orgIds?.length) return res.status(403).json({ error: "No authorized organizations" });
// ...
where: { org_id: { [Op.in]: orgIds } }
```

Filter parameters from the client (e.g., `filter.org_id`) must be intersected with the user's authorized orgs. Never allow access to orgs outside `getUserOrgIds(req)`.

## Session Invalidation

On logout: Invalidate the session server-side (e.g., remove from session store, revoke token). Client should clear cookies/localStorage.

On password change: Invalidate all sessions for that user. Force re-login. Consider invalidating JWT by version or blacklisting.
