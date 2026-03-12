# Discovery Sweep Examples

## Searching for Existing UI Patterns
Instead of creating a new log viewer:
`grep -r "LogViewer" repos/your-app/web/src`
`glob "**/*Drawer.tsx"`

## Searching for Standards
When refactoring logging:
`grep -i "logging strategy" docs/`
`grep -i "auth standard" docs/`

## Using Subagents for Mapping
For cross-repo impact:
"I need to map how 'DeviceType' is used across platform, notifier, and firmware."
