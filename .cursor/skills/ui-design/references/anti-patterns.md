# UI Anti-Patterns

Concrete rewrites for the most common agent mistakes when generating UI code.

## 1. Hardcoded Counts and Labels

```jsx
// BAD -- count will desync from actual data
<Badge>3 alerts</Badge>
<Typography>Showing 5 zones</Typography>

// GOOD -- derived from data
<Badge>{alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}</Badge>
<Typography>Showing {zones.length} {zones.length === 1 ? 'zone' : 'zones'}</Typography>
```

## 2. Fixed-Width Containers for Variable Content

```css
/* BAD -- content will overflow or waste space */
.sidebar { width: 280px; }
.card-title { width: 200px; overflow: hidden; }

/* GOOD -- bounded flexibility */
.sidebar { width: clamp(200px, 25vw, 320px); }
.card-title { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

## 3. Hardcoded Options That Should Come from Data

```jsx
// BAD -- new status requires a code change
<Select>
  <MenuItem value="active">Active</MenuItem>
  <MenuItem value="inactive">Inactive</MenuItem>
  <MenuItem value="maintenance">Maintenance</MenuItem>
</Select>

// GOOD -- options driven by data or config
<Select>
  {statusOptions.map((opt) => (
    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
  ))}
</Select>
```

## 4. Missing Empty State

```jsx
// BAD -- renders an empty table with headers and no explanation
return (
  <Table>
    <TableHead>{columns.map(renderHeader)}</TableHead>
    <TableBody>{rows.map(renderRow)}</TableBody>
  </Table>
);

// GOOD -- explicit empty state
if (!rows.length) {
  return <EmptyState icon={<SearchOff />} message="No results match your filters." />;
}
return (
  <Table>
    <TableHead>{columns.map(renderHeader)}</TableHead>
    <TableBody>{rows.map(renderRow)}</TableBody>
  </Table>
);
```

## 5. Color Literals Instead of Role Tokens

```jsx
// BAD -- breaks on theme change, meaning is unclear
<Chip sx={{ backgroundColor: '#d32f2f', color: '#fff' }} />

// GOOD -- semantic role, theme-aware
<Chip color="error" />
// or with custom tokens:
<Chip sx={{ backgroundColor: 'var(--brand-danger)', color: 'var(--brand-on-danger)' }} />
```

## 6. Implicit State Transitions

```jsx
// BAD -- loading shows nothing, error shows nothing
return <Dashboard data={data} />;

// GOOD -- every state is an explicit render branch
if (isLoading) return <DashboardSkeleton />;
if (error) return <ErrorBanner retry={refetch} message={error.message} />;
if (!data) return <EmptyState message="No dashboard data available." />;
return <Dashboard data={data} />;
```

## 7. Layout Coupled to Domain Data

```jsx
// BAD -- page layout knows about alert data shape
function AlertPage({ alerts }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: alerts.length > 5 ? '1fr 1fr' : '1fr' }}>
      {alerts.map((a) => <div key={a.id}>{a.title}</div>)}
    </div>
  );
}

// GOOD -- layout is generic, data component is separate
function ResponsiveGrid({ items, renderItem, minColumnWidth = 300 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))`,
    }}>
      {items.map(renderItem)}
    </div>
  );
}

function AlertPage({ alerts }) {
  return <ResponsiveGrid items={alerts} renderItem={(a) => <AlertCard key={a.id} alert={a} />} />;
}
```

## 8. Magic Pixel Values

```jsx
// BAD -- arbitrary, undocumented, fragile
<Box sx={{ mt: '37px', pl: '13px', width: '847px' }} />

// GOOD -- system-aligned spacing, fluid width
<Box sx={{ mt: 4, pl: 2, width: '100%', maxWidth: 900 }} />
```

MUI's spacing unit is 8px. Use the numeric scale (1 = 8px, 2 = 16px, etc.)
for all spacing. For non-MUI projects, define a spacing scale and reference it.

## 9. Non-Truncated Long Text

```jsx
// BAD -- long org name pushes layout off screen
<Typography>{organization.name}</Typography>

// GOOD -- truncates with tooltip for full value
<Tooltip title={organization.name}>
  <Typography noWrap sx={{ maxWidth: 200 }}>{organization.name}</Typography>
</Tooltip>
```

## 10. Hardcoded Grid/Column Counts

```jsx
// BAD -- assumes exactly 3 cards fit
<Grid container spacing={2}>
  {items.map((item) => (
    <Grid item xs={4} key={item.id}><ItemCard item={item} /></Grid>
  ))}
</Grid>

// GOOD -- responsive, adapts to viewport and item count
<Grid container spacing={2}>
  {items.map((item) => (
    <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}><ItemCard item={item} /></Grid>
  ))}
</Grid>
```
