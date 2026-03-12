# Endpoint Examples and Response Patterns

## RESTful Route Examples (Application Domain)

| Resource | GET (list) | GET (show) | POST | PUT/PATCH | DELETE |
|----------|------------|------------|------|-----------|--------|
| Organizations | `/api/organizations` | `/api/organizations/:id` | `/api/organizations` | `/api/organizations/:id` | `/api/organizations/:id` |
| Zones | `/api/organizations/:orgId/zones` | `/api/organizations/:orgId/zones/:zoneId` | `/api/organizations/:orgId/zones` | `/api/organizations/:orgId/zones/:zoneId` | `/api/organizations/:orgId/zones/:zoneId` |
| Devices | `/api/zones/:zoneId/devices` (or org-scoped) | `/api/zones/:zoneId/devices/:id` | `/api/zones/:zoneId/devices` | `/api/zones/:zoneId/devices/:id` | `/api/zones/:zoneId/devices/:id` |
| Alerts/Events | `/api/events` (filter by org_id, zone_id) | `/api/events/:id` | N/A (created by system) | `POST /api/events/:id/acknowledge` | N/A |
| Webhooks | `/api/organizations/:orgId/webhooks` | `/api/organizations/:orgId/webhooks/:id` | `/api/organizations/:orgId/webhooks` | `/api/organizations/:orgId/webhooks/:id` | `/api/organizations/:orgId/webhooks/:id` |

All routes are under `checkAuthenticated` middleware. Nested routes imply ownership (e.g., zones belong to organizations).

## Request/Response Body Shapes

**Create organization** (POST `/api/organizations`):
```json
{
  "name": "Acme Corp",
  "title": "Acme Corporation",
  "address_line_1": "123 Main St",
  "address_city": "Austin",
  "address_state": "TX",
  "address_zip": "78701"
}
```

**Update zone** (PATCH `/api/organizations/:orgId/zones/:zoneId`):
```json
{
  "name": "Building A",
  "description": "First floor lobby"
}
```

**List devices with pagination** (GET `/api/zones/:zoneId/devices?limit=25&offset=0`):
- Query params: `limit` (default 25), `offset` (default 0)
- Response: array of device objects, optionally wrapped with metadata

## Response Envelope Pattern

The codebase uses direct JSON responses for most endpoints; there is no universal wrapper. Check sibling endpoints in the same controller:

- **Success**: `res.status(200).json(record)` or `res.status(201).json(createdRecord)`
- **List**: `res.json(records)` or `res.json({ data: records, total: count })`
- **Error**: `res.status(4xx|5xx).json({ error: "message" })` or `res.status(4xx).json({ code: "MACHINE_CODE", message: "Human message", errors: {} })`

When adding a new endpoint, follow the pattern of the controller you are modifying. Do not introduce a new envelope shape without a migration plan for existing consumers.
