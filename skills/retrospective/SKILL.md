---
name: retrospective
description: Analyze past session performance to improve current behavior. Use when starting a session, after completing work, or when the user says "retrospective", "review analyses", "learn from past sessions", "what patterns do you see", or "improve from history".
triggers:
  - memory
related_skills:
  - proactive-suggestions
  - preflight
---

# Retrospective

Read past session analyses to identify recurring strengths, weaknesses, and
patterns. Use those insights to improve the current session's approach.

## When to Use

- At the start of a session, to load behavioral context
- When the user asks to review past performance
- After completing a task, to compare against historical patterns
- When stuck -- past analyses may reveal the same failure mode

## Step 1: Load Recent Analyses

Read the analyses directory and load the most recent files:

```bash
ls -t memory/profile/analyses/*.json | head -20
```

Read each file to extract its content. Focus on:

- `verdict` distribution (how many productive vs struggling vs blocked)
- `errors` and `gaps` that repeat across sessions
- `recommendations` that keep appearing
- `user_stats` and `agent_stats` trends

## Step 2: Extract Patterns

Build a mental model from the analyses. Look for:

### Recurring Errors (fix these first)

Scan `errors` arrays across all analyses. Group similar items. If the same
class of error appears in 3+ sessions, it is a systemic issue.

Common categories:

- **State awareness**: losing track of filesystem, environment, or session state
- **Tool misuse**: using the wrong tool or using tools inefficiently
- **Scope creep**: taking on too much, not finishing before starting new work
- **Communication**: not clarifying requirements, not reporting progress

### Recurring Gaps (skills or knowledge to acquire)

Scan `gaps` arrays. These point to missing capabilities:

- Skills that should have been invoked but were not
- Tools that exist but were not discovered
- Documentation that was not consulted

### Recurring Recommendations (behaviors to adopt)

Scan `recommendations` arrays. Deduplicate and rank by frequency.

### Stat Trends

Compare `user_stats` and `agent_stats` across sessions:

- Is `frustration` consistently high? The agent is underperforming.
- Is `efficiency` consistently low? Too many wasted cycles.
- Is `autonomy` low? The agent is asking too many questions.
- Is `thoroughness` low? Skipping tests, reviews, or edge cases.

## Step 3: Report Findings

Present a concise summary to the user:

```
Retrospective Summary (N sessions analyzed)
--------------------------------------------
Verdict distribution: X productive, Y mixed, Z struggling, W blocked

Top recurring errors:
1. <error pattern> (seen in N sessions)
2. ...

Top recurring gaps:
1. <gap> (seen in N sessions)
2. ...

Top recommendations:
1. <recommendation> (appears N times)
2. ...

Stat averages:
  User:  clarity=X frustration=X engagement=X ambition=X adaptability=X
  Agent: competence=X efficiency=X creativity=X autonomy=X thoroughness=X
```

## Step 4: Apply to Current Session

Based on the findings, adjust behavior for the current session:

1. **Avoid top errors**: Before each action, check if it matches a recurring
   error pattern. If so, take the alternative approach.
2. **Fill gaps**: If a gap indicates a skill should be used, invoke it.
3. **Follow recommendations**: Treat the top 3 recommendations as active rules
   for this session.
4. **Monitor stats**: If frustration trends high, be more proactive about
   confirming direction. If efficiency trends low, minimize exploratory tool
   calls.

## Step 5: Suggest Improvements

If patterns suggest structural improvements, offer to create:

- **Skills**: For recurring recommendation patterns that could be automated
  (use the Command Center UI or create directly in `.cursor/skills/`)
- **Rules**: For behavioral guidelines that should always apply
  (create in `.cursor/rules/`)
- **Memory entries**: For known issues or decisions that should persist
  (use `ctx memory write`)

## Error Handling

- If no analysis files exist, inform the user and suggest running
  `ctx profiler analyze --limit 10` to generate them.
- If analyses are sparse (< 5), note that patterns may not be reliable yet.
- Never fabricate or assume analysis data that does not exist in the files.
