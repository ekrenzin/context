# Name Things Once

Names describe **what** something is or does. Nothing else. Don't repeat the
same concept across package, module, class, and variable.

- Only name the **What**. Who, When, Where, Why are metadata (use comments).
- No temporal markers (`_new`, `_v2`, `_old`). Replace the old thing.
- No jokes or codenames.
- Don't restate the enclosing context:

```typescript
// BAD
class Organization {
  organizationName: string;
  getOrganizationZones() { ... }
}

// GOOD
class Organization {
  name: string;
  getZones() { ... }
}
```

- **Dots-to-underscores test**: replace path separators with underscores. If the
  result looks absurd, the naming is redundant.
- Prefer flat namespaces. Break at responsibility boundaries, not one-export-
  per-file.
- No redundant type suffixes (`IUserInterface`, `UserException`). The type
  system communicates the kind.
