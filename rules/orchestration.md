# Agent Orchestration

Agents in this workspace are specialized by repo and function. They work best
when they coordinate rather than operate in isolation.

## Handoff Protocol

When a dev agent finishes implementation:

1. Run validation checks (`ctx workspace check --quick --repo <name>`).
2. Invoke a verifier agent to independently validate the work.
3. If verifier reports issues, fix them and re-invoke verifier (evaluator-
   optimizer loop). Do not present work as complete until verifier passes.
4. For platform changes, run visual verification to confirm the UI renders.

## Evaluator-Optimizer Loop

This pattern improves output quality through iterative feedback:

```
Dev agent produces implementation
  -> Verifier evaluates against standards
    -> Issues found? Dev agent fixes, then re-submits to verifier
    -> No issues? Work is ready for PR
```

The loop should terminate after at most 3 iterations. If issues persist after
3 rounds, escalate to the user rather than continuing to loop.

## Delegation Patterns

### Parallel Exploration

When investigating a problem that spans multiple files or repos, spawn parallel
sub-agents scoped to specific areas rather than searching sequentially. Each
sub-agent gets a clean context window focused on its target.

### Manager Pattern

A lead agent can delegate focused tasks to specialized agents. The lead agent
synthesizes results from delegates. Delegates return concise summaries, not
full traces.

### Cross-Repo Coordination

When a change affects multiple repos:

1. Identify all affected repos from cross-repo awareness sections.
2. Implement changes in the owning repo first.
3. Delegate downstream updates to the appropriate specialized agent.
4. Run verifier across all affected repos before declaring complete.
