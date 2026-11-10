---
name: uptomic-expedited-release
description: Uptomic's expedited release lane for a small change the owner explicitly marks urgent, with focused tests first, a recorded rollback target, immediate merge and deploy, then the full check, independent review and post-deploy verification. Use when the owner asks to expedite, hotfix or urgently ship a change, and when following up an expedited release.
---

# Uptomic expedited release lane

Company policy (owner decision, 2026-11-10). The lane shortens the time to
production for a small urgent change. **It is not a no-tests path**: it reorders
the project's normal gates, it does not remove any of them.

The lane is an addition to the project's own release rules. The project's
AGENTS.md and release guides still own its branches, PRs, reviewers, deploy
commands, environments and production holds. Where they conflict with this lane,
follow the project and ask the owner.

## Entry conditions

All of these must hold before you use the lane:

- The owner explicitly marked this change urgent and asked for the expedited lane
  (or a hotfix, expedite or equivalent instruction) in the current task. Urgency
  you infer yourself does not qualify. Name the owner as the authorizer.
- The change is small and its scope is stated: the files, behaviour and
  environment it touches.
- It is not a schema migration or data deletion, unless a verified backup exists
  and its restore has been checked; record the backup.
- No production hold applies, or the owner lifted it for this specific change.
- The project's tracker has an issue for the change (Beads where the project uses
  it), claimed under its normal rules.

## Steps

1. **Focused tests.** Run only the tests that own the changed files: the unit,
   contract or integration tests that exercise those files and their callers.
   This should take seconds to minutes. They must pass; a failure ends the lane.
2. **Rollback target.** Before merging, record what you would roll back to: the
   prior deployed image, release or commit, plus any backup taken. Confirm the
   target exists and how to restore it. No rollback target, no expedited release.
3. **Merge and deploy now.** Merge and deploy through the project's normal
   commands and hooks, with the owner named as authorizer in the commit, PR or
   release record. Never bypass hooks or checks (`--no-verify`, disabled gates,
   force pushes) to go faster.
4. **Follow-up gates, immediately.** Right after the deploy, run the project's
   normal full check, its required independent review (for example a fresh
   read-only Codex review and OCR where the project requires them) and its
   post-deploy verification. Do not defer them to a later task.
5. **Failure handling.** Any failure at any step reopens the issue (or keeps it
   open) and is recorded. Before anything has merged, a failure ends the lane and
   the change returns to the project's normal path. Once anything has merged or
   deployed, including a partial or failed merge or deploy, a failed full check,
   review finding or post-deploy verification, a failure triggers the rollback
   decision with the owner: roll back to the recorded target, or fix forward only
   if the owner chooses that. Record the decision and its result.
6. **Log every use.** Record the lane's use on the issue (see below), including
   the follow-up review outcome. The issue closes only after step 4 passes, or
   after the rollback decision is carried out and recorded.

## Never

- Never skip the focused tests, the rollback target or the follow-up gates.
- Never bypass hooks, review gates or publication gates.
- Never print, paste or log secrets, tokens or credentials, including in the log.
- Never use the lane for a schema migration or data deletion without a verified
  backup.
- Never override a project's production hold unless the owner lifts it for this
  change. Never treat one expedited approval as authority for another change.

## The log

Add the label `expedited-release` to the issue and append this block to its
notes (Beads: `bd update ID --add-label expedited-release --append-notes ...`).
Update it as the follow-up gates finish. In a project without Beads, put the same
block in its tracker entry.

```text
Expedited release
- Authorizer: <owner name> (<where and when they authorized it>)
- Scope: <files, behaviour, environment>
- Focused tests: <exact commands> -> <result>
- Rollback target: <prior image/release/commit>; backup: <id or none, and why none is needed>
- Merge/deploy: <commit SHA, PR or release ID, deploy ID>, at <UTC time>
- Full check: <command> -> <result>
- Independent review: <reviewers and outcome>
- Post-deploy verification: <checks> -> <result>
- Outcome: <verified | reopened; rollback decision and result>
```

Use the [work record](../uptomic-work-record/SKILL.md) as usual; the lane does not
change who records the work or where.
