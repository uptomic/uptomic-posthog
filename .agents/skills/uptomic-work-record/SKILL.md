---
name: uptomic-work-record
description: Record who is working on a Beads issue, where and on which code, in the issue's structured metadata. Use when claiming a Beads issue, after commits and pushes, at handoff, and when asked who or what is working on an issue.
---

# Uptomic work record

Company policy (owner decision, 2026-11-10). Every claimed Beads issue carries a
small, versioned, structured work record naming the agent, the human operator,
the machine, the repository, the worktree, the branch and the head commit. Prose
notes stay useful, but the record is what you query.

This skill adds a record; it does not change the project's tracker, claim rules,
branch, review or release rules. The project's AGENTS.md still owns those.

## The record (version 1)

Flat string keys in the issue's `metadata`, all prefixed `uptomic_work_v1_`:

| Key suffix | Value |
| --- | --- |
| `agent_tool` | `claude-code`, `codex`, or the harness name |
| `agent_model` | the model ID you are running as, such as `claude-opus-5-5` |
| `agent_session` | the harness session or thread ID (`CLAUDE_CODE_SESSION_ID`, `CODEX_THREAD_ID`) |
| `agent_thread` | the orchestrating thread ID when one exists (`T3CODE_THREAD_ID`) |
| `operator` | the human operator's name (Git `user.name`), never an email |
| `host` | the worker or host identity (`UPTOMIC_WORKER`, else the host name) |
| `repo` | `owner/name` from the Git origin; credentials and URLs are never kept |
| `worktree` | absolute path of the checkout or worktree |
| `branch` | current branch; absent when detached |
| `head` | full commit SHA of `HEAD` |
| `event` | `claim`, `commit`, `push` or `handoff` |
| `updated_at` | UTC ISO-8601 time of this write |

Flat keys merge per key, so the record never replaces other metadata (for
example Quant's `quant_readiness_v1`), and each key is queryable. Never write the
record by hand into notes or by replacing the whole metadata object.

## When to write it

1. **Claim.** Immediately after claiming, record it with your model:
   `bun .agents/skills/uptomic-work-record/scripts/work-record.ts claim --issue ID --model MODEL`
   Use the project's Beads wrapper when it has one (it may record the claim for
   you); pass `--model`, because harnesses do not expose the model to commands.
   A claim is refused unless it names the tool, model, session (or thread),
   operator, host, repository, worktree, branch and head; the error says which override
   supplies a missing field. A person working without an agent claims with
   `--tool human`.
2. **Commit and push.** Where the project's Git hooks run the script, the record
   refreshes automatically. Otherwise run `... work-record.ts commit` after each
   commit and `... work-record.ts push --pull` before each push.
3. **Handoff.** Before ending a session or handing work to another agent, run
   `... work-record.ts handoff` and then the project's normal Beads publication.
4. **Taking over.** A new session claiming an existing issue writes its own claim;
   the script replaces the previous agent's identity instead of mixing the two.

Without `--issue` (or `BEADS_ISSUE`), the script refreshes only in-progress
issues this session holds: same repository and host, same branch or worktree,
and the same agent session (or thread). It never changes another holder's issue
implicitly, even when it is named with `--issue` or `BEADS_ISSUE`; it names that
issue and asks for an explicit claim. Every write must leave a complete record
(the agent, operator, host, repository, worktree, head and branch unless HEAD is
detached), and a refused value fails the write instead of being dropped. If this session
holds none, it says so and changes nothing. A failed write exits nonzero even from
a hook: a pre-push hook then still runs the Beads gate and refuses the push. Use
`--dry-run` to see the exact `bd` call.

## Querying

- Who and where: `bd show ID --json` and read the `uptomic_work_v1_*` keys, or
  `... work-record.ts show --issue ID`.
- Work on a branch: `bd list --status in_progress --metadata-field uptomic_work_v1_branch=BRANCH`.
- Work on a machine: `--metadata-field uptomic_work_v1_host=HOST`.
- Stale claims: compare `uptomic_work_v1_updated_at` with lease and heartbeat
  times, then follow the project's reclaim rules. A record is evidence of the last
  write, not proof that the session is still alive.

## Safety rules

- Never record secrets, tokens, credentials, personal email addresses or
  customer data. Each field has a narrow format (for example the operator is a
  name and the repository is `owner/name`), and values that look like an email or
  a common credential are refused. These checks reduce mistakes but cannot
  recognise every secret, so pass only the identities listed above and do not
  work around a refusal.
- Write the record after pulling the latest Beads history. Two clones editing
  the same issue concurrently produce a Dolt merge conflict; the record should be
  written by the agent that holds the claim. On a conflict, stop and report. Never
  force-push Dolt or discard either history.
- Keep the assignee and lease semantics the project already uses. The record adds
  who and where; it does not reassign anyone.
- In a project without Beads, record the same fields in that project's tracker
  entry for the task at claim and handoff, under its own tracker rules.

## Bundled command

`scripts/work-record.ts` runs with Bun and calls `bd` from `PATH` (the cloud relay
wrapper in cloud sessions). A project wrapper can set `UPTOMIC_BD_COMMAND` to a
JSON array (for example `["bun", "run", "beads", "--"]`) or import the module and
pass its own runner. The HQ source is `skills/uptomic-work-record` in
uptomic/uptomic-hq; update it there, not in a project copy.
