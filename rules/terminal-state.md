# Terminal State Reporting

When running inside a Context terminal session, report your state at the end
of every message by writing a state marker to stdout.

## State Values

| State     | When to report                                              |
|-----------|-------------------------------------------------------------|
| `running` | You are actively working: generating code, calling tools    |
| `waiting` | You asked the user a question or need user input to proceed |
| `idle`    | The task is complete, no pending work                       |

## How to Report

Emit the following escape sequence at the end of your response:

```
\x1b]ctx:state=<STATE>\x07
```

Example: `\x1b]ctx:state=waiting\x07`

This is an OSC (Operating System Command) escape sequence. The terminal host
intercepts it and strips it from visible output.

## Rules

- Report `waiting` when your last message asks a question or presents options.
- Report `idle` when you say the task is done or have nothing left to do.
- Report `running` at the start of any new tool-use or generation sequence.
- Default to `running` if uncertain.
- Emit exactly one state marker per message, at the very end.
