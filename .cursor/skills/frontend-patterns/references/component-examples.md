# Component Structure Examples

## Functional Component with Hooks (Standard Pattern)

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useGetList } from "react-admin";

function ZoneList({ orgId }) {
  const [filter, setFilter] = useState({ org_id: orgId });
  const { data, isLoading, refetch } = useGetList("zones", {
    filter,
    pagination: { page: 1, perPage: 25 },
  });

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  useEffect(() => {
    setFilter((f) => ({ ...f, org_id: orgId }));
  }, [orgId]);

  if (isLoading) return <Loading />;
  return <List data={data} onRefresh={handleRefresh} />;
}
```

Co-locate state, effects, and handlers. Use `useCallback` for handlers passed to children to avoid unnecessary re-renders.

## AlertNotificationBadge and AppBar Coupling

Both components consume the same UserAlerts API via `userAlertsApi.js`:
- `acknowledgeEvent(eventId)` - persists acknowledgment to UserAlerts table
- `getUserAcknowledgedEvents()` - fetches acknowledged event IDs for the current user

**Shared data**: Acknowledged event IDs, unread alert count, critical alert state.

**Coordination required when**:
- Changing the UserAlerts API contract (endpoint, response shape)
- Adding new acknowledgment states (e.g., dismissed vs acknowledged)
- Modifying the Events list filter that excludes acknowledged events
- Changing the React Query cache key (`user-alerts` in alertQueries.js)

Both seed acknowledged alerts from the UserAlerts DB table on mount. AppBar renders AlertNotificationBadge; changes to badge behavior (poll interval, critical alert types) affect both.

## Modal State Management (Avoid Re-mount Reset)

**Problem**: Modal state resets when parent re-renders because the modal is conditionally rendered (`{showModal && <Modal />}`). Each render creates a new component instance.

**Fix 1 - Stable key**: Give the modal a key that does not change when the parent re-renders. Avoid keys derived from parent state that changes frequently.

**Fix 2 - Lift state**: Keep modal-open state and form state in a parent that does not unmount. Render the modal unconditionally but control visibility with CSS or a portal that persists.

```jsx
// BAD: Modal unmounts when parent re-renders, state is lost
{isOpen && <EditModal onClose={() => setIsOpen(false)} />}

// GOOD: State lives in parent; modal visibility is the only conditional
const [formData, setFormData] = useState(null);
return (
  <>
    <Button onClick={() => { setFormData(initial); setIsOpen(true); }} />
    {isOpen && (
      <EditModal
        initialData={formData}
        onClose={() => { setIsOpen(false); setFormData(null); }}
      />
    )}
  </>
);
```

**Fix 3 - Portal**: Render modal into a stable DOM node (e.g., `document.body`) so it is not a direct child of the re-rendering tree.

## Custom Hook Extraction Pattern

```jsx
// useZones.js - encapsulates data fetching and filter state
function useZones(orgId) {
  const [filter, setFilter] = useState({ org_id: orgId });
  const { data, isLoading, error, refetch } = useGetList("zones", {
    filter,
    pagination: { page: 1, perPage: 25 },
  });

  useEffect(() => {
    setFilter((f) => ({ ...f, org_id: orgId }));
  }, [orgId]);

  return { zones: data, isLoading, error, refetch, setFilter };
}

// ZoneDashboard.js - thin component
function ZoneDashboard({ orgId }) {
  const { zones, isLoading, refetch } = useZones(orgId);
  return <ZoneList zones={zones} loading={isLoading} onRefresh={refetch} />;
}
```

Extract when: (a) logic is reused across components, (b) the component exceeds ~150 lines, or (c) the hook has a clear single responsibility (fetch, filter, form state).
