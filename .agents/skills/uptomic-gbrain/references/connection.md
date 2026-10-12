# Hosted access

Prefer the session's authenticated MCP connection to `https://brain.uptomic.com/mcp`.
Inspect available schemas; a missing tool is not evidence that the brain is empty.
Use `whoami` or the capabilities resource to check grants when available.

## Bundled command

If MCP is not loaded, use Bun and the script shipped beside this skill. Resolve
the installed skill's absolute location; the example assumes the project root:

```sh
bun --no-env-file .agents/skills/uptomic-gbrain/scripts/brain.ts search <<'JSON'
{"query":"company brain hosting decision","limit":5}
JSON
```

Replace `.agents` with `.claude` for its installed copy. From a subdirectory use
the resolved absolute path. The same command supports `tools`, `recall`,
`remember`, `forget`, `get_page`, `put_page`, and other listed retrieval operations;
arguments are a JSON object on stdin (empty stdin means `{}`). It prints the
structured tool result and exits nonzero on transport, auth or tool failure.
For a retried write, supply and preserve the original UUID `request_id`.

The command reads an owner-only private handoff at `GBRAIN_CREDENTIALS_FILE`, or
`GBRAIN_WORKER_CREDENTIALS` injected by the operator. On the enrolled worker named
`worker`, it can retrieve **only** `GBRAIN_WORKER_CREDENTIALS` through the native
Infisical launcher from Uptomic HQ → prod → `/uptomic-brain` (project
`a6fba9dd-0334-4abf-83ef-19566568fe8f`). It never retrieves the owner token, database
password, or OpenRouter key. Other workers need their own provisioned handoff;
they must not silently use this worker's identity.

Credentials remain in memory, outside command arguments and output. Expired
tokens are renewed using the same client's credentials. A 401 allows one renewal
and retry; other failures stop. Network timeouts do not automatically replay
writes. The helper calls the same hosted MCP operations, not a separate store.
Multiple projects using this worker's handoff share one principal; entity labels
are organization, not permission boundaries.

## Another machine or native agent

Provision a separate `memory-writer` client per independent worker/harness with
`--source default --skills memory-only --budget-usd-per-day 0`. Owner access is
needed only for provisioning; never distribute it to projects. Preserve existing
grants and unrelated agent settings. The zero budget constrains delegated paid
work, not ordinary embedding costs. Scoped read-only clients keep read-only access.

Follow the [Brain deployment runbook](https://github.com/uptomic/uptomic-brain/blob/a1bf445/docs/railway-gbrain.md)
and [upstream hosted access](https://github.com/garrytan/gbrain/blob/8453d003e01bf3be5c272f6574bd8d858f3ad6ba/docs/guides/hosted-harness-access.md).
Use the deployed pinned upstream checkout for provisioning, not the unrelated
`gbrain` npm package. Native OAuth clients use their actual PKCE/redirect setup;
machine handoffs use the supported harness installer. Do not run personal-agent
bootstrap, initialize a local database, enable skill following, or capture chats.

Native Codex/Claude machine installers use a token that expires; installing a file
does not prove renewal or current session activation. The bundled command renews
from its private handoff without depending on a static native token.

Validate actual calls from the intended machine: authenticated read; a unique
nonsensitive fact with a short TTL; readback; correction; withdrawal. Record the
returned IDs and whether cleanup succeeded. A fresh native conversation must make
an observed recall call before claiming cross-session MCP activation. Do not
restart a worker over active turns. If access fails, report whether the missing
piece is credentials, permission, transport, or native activation; do not widen
grants, expose private facts or query the database to bypass the problem.
