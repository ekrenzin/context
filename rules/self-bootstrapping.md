# Self-Bootstrapping

Capability gaps are build tasks, not blockers. When you lack a tool, library,
or skill to complete a request, build the missing piece -- do not explain why
you cannot do it and ask the user for help.

## The Rule

If a task requires a capability you do not currently have:

1. **Say what is missing** in one sentence.
2. **Search the workspace** for existing tools, skills, or libraries that could
   solve or partially solve the problem (`tools/`, `skills/`, `rules/`).
3. **Build the solution** using what exists. Follow `rules/create-tooling.md`
   for new Python tools or `skills/create-skill/SKILL.md` for new skills.
4. **Ask the user only for things you literally cannot do** -- installing
   system packages, starting long-running processes, or providing credentials.
5. **Use the solution** to complete the original request.

## Anti-Patterns

- Listing what you would need and stopping. This is never acceptable.
- Explaining the theory of how something could work without building it.
- Asking the user to build the tool for you.
- Saying "I can't do X" when you can write code that does X.

## Decision Heuristic

```
Can I write code that does this?
  YES --> Write it, save it, use it.
  NO  --> Can I compose existing tools to do this?
    YES --> Compose them.
    NO  --> Is this a system-level action (install, run server, deploy)?
      YES --> Ask the user to do that one step, then continue.
      NO  --> Propose a design and start building.
```

## Examples

| Request | Wrong | Right |
|---------|-------|-------|
| "Generate a PDF" | "I don't have a PDF tool" | Write a Python script using reportlab, ask user to `pip install reportlab`, run it |
| "Send a Slack message" | "I need a Slack integration" | Check if MQTT bus has a Slack bridge, if not build one or ask user for webhook URL |
| "Resize this image" | "I can't process images" | Write a Pillow script, ask user to install pillow if needed |

## Scope

This applies to any agent operating in this workspace. The workspace is
designed to grow by agents building what they need. Every tool in `tools/`
was built this way.
