# Records and corrections

Use when choosing a record format, importing a bounded source, or correcting knowledge.

| Material | Save here | Keep at its owner |
| --- | --- | --- |
| Company decision | Decision, rationale, alternatives, effective date, owner, evidence | Task execution and approvals |
| Project architecture/contract | Short pointer, implication for consumers, commit/doc link | Full architecture, schemas, commands, acceptance evidence |
| Research | Question, supported findings, sources/dates, limitations and relevance | Raw downloads and source datasets |
| Incident lesson | General failure mode, verified fix, prevention, issue/commit link | Live incident status, logs and user data |
| Marketing/product claims | Supported wording, restrictions, evidence, verification date | Draft assets, campaign execution and publishing approvals |
| Temporary information | Usually omit; use explicit TTL only when useful across tasks | Current task progress, deployments in flight and scratch notes |

Examples: a cross-project identity contract belongs as a pointer to its owning
design; a verified recurring deployment failure merits a short lesson; a list of
today's failing tests belongs in Beads, not in company memory. A generated answer
is not a second source corroborating its input.

## Atomic facts

Inspect the live tool schema first. Example `remember` arguments:

```json
{
  "fact": "Uptomic's shared company brain is hosted on Railway.",
  "entity": "projects/uptomic-brain",
  "provenance": "User deployment decision, 2026-09-25; uptomic-brain/docs/railway-gbrain.md at the verified commit",
  "visibility": "world",
  "request_id": "GENERATE-A-UUID-FOR-THIS-WRITE"
}
```

Use a real source URL/commit and observation date, not the example text. Omit TTL
for durable decisions. `ttl: "7d"` is appropriate only for an intentionally
time-limited shared fact. Entity names should be stable (`projects/<repo>`,
`company/uptomic`); reuse existing entities before inventing aliases. The response
may be inserted, duplicate, or superseded; inspect it and verify the resulting ID.

## Pages

Use stable slugs such as `decisions/<topic>`, `research/<topic>`,
`lessons/<topic>`, or `projects/<repo>/<topic>`. Read the existing page first;
`put_page` replaces the complete page, not one field. Supply canonical content from
`get_page(include_content:true)` plus `expected_revision` for updates. A revision
conflict means re-read and reconcile; do not force away another author's work.

Include frontmatter with `title`, an appropriate type from the active schema,
`status`, `owner`, `sources`, `verified_on` (only if actually verified), and
`confidence` (`verified`, `inferred`, or `unverified`, as appropriate). These
provenance fields are an Uptomic authoring convention, not a claim that GBrain
validates every field. Preserve imported record IDs and source dates.

Write the conclusion and why it matters, evidence links and relevant dates, then
limits/open questions. Separate user decisions, external claims and agent
inferences. A pointer links to an immutable source commit when possible and names
the current owning document. Do not copy large documents or third-party articles.

## Correcting and withdrawing

Read the old record and its source before a correction. For pages, preserve the
previous decision/evidence, mark it superseded, link its replacement, and update
the replacement with the reverse link. Use revision checks on each write; report
any partially completed correction instead of claiming an atomic transaction.

For facts, use an explicit replacement with provenance linking the old ID and
verify it first, then `forget(old_id, reason)` if the original is still active.
Automatic similarity deduplication is not proof of the intended correction. Verify
that the replacement is active and the old fact is withdrawn. If a new claim
conflicts without resolving the evidence, record the disagreement on a page;
do not replace a supported fact merely because another statement is newer.

`forget` withdraws a fact from active recall. It does not guarantee physical
erasure from source documents, audit history or backups. Do not delete pages or
alter source systems as a side effect of an ordinary correction.

Remote pages acquire graph links through the host's periodic deterministic sweep.
A successful page write is not proof that graph edges or embeddings are ready.
The host's automatic LLM extraction is disabled: explicitly written facts and
pages are the reliable write path.

Protocol reference: [memory verbs](https://github.com/garrytan/gbrain/blob/8453d003e01bf3be5c272f6574bd8d858f3ad6ba/docs/protocol/MEMORY_VERBS_v1.md).
