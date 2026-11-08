# Production promotion: 2026-11-08

Chronological evidence log for promoting production from the 2026-08-30 bundle
(upstream `da93d8bbd71e23d49a8372ec43b4a4c7f75c1316`) to the built candidate
`a5f437083ddaf9891e734c1d8fe1419a7ed720a9` (candidate commit `2925a4d`, built 2026-10-09).
Earlier pending states are kept as history.

## Candidate selection

- Every scheduled candidate build from 2026-10-10 to 2026-11-08 failed. The Node overlay guard
  rejects upstream's changed Redis option function (`NODE_REDIS_FUNCTION_DRIFT`), and upstream
  no longer pins ClickHouse `26.6.2.158` (the ClickHouse base check). Fixing either needs a
  reviewed overlay change and a ClickHouse server upgrade, which is a separate data-service gate.
- `2925a4d` is therefore the newest candidate with built and verified Uptomic images. This
  promotion uses that commit's lock and candidate together. `main`'s newer lock has no built
  images and is not mixed in.
- At `2925a4d`: 60 tests / 345 assertions passed, `lock:verify` and `candidate:verify` passed,
  and `railway:plan` rendered.
- Every production image's embedded upstream revision is an ancestor of the candidate commit
  (Web/Worker `da93d8bb`, Cymbal `156c731b`, Feature Flags/Capture/Property Defs `e622e22a`,
  Livestream `1febc735`, Hypercache `17b35cf1`). The candidate is forward-only for every role.
  The Cymbal DNS overlay (2026-09-25) predates the candidate, so the Error Tracking Ingestion
  repair is retained.

## Change scope

Compared with production configuration, the plan changes image digests only. Two plan
environment values differ only in reference syntax and already work in production:
`Cymbal.CYMBAL_REMOTE_RESOLUTION_HOST` and `Recording API.SESSION_RECORDING_API_REDIS_HOST`.
Production keeps its working values. Production ClickHouse keeps its existing start command;
only its image changes, from `a554052a…` to `080bc023…` (same `26.6.2.158` engine, newer
upstream config and UDF assets). Migration Bridges 1 and 2 are not run: the ledger is already
past 0210.

Upstream migrations between the bundles: about 400 Django migrations (7 `DeleteModel`,
5 `RemoveField`, 112 `RunSQL`), 9 persons SQL migrations, and 42 ClickHouse migrations
(0310–0351), eight of which drop objects (0311, 0316, 0321, 0335, 0338, 0340, 0341, 0347).
These are not backward compatible. Rollback is a data restore plus the prior bundle, not an
image redeploy alone.

## Rollback design finding

PostHog's `posthog` (275 MB) and `cyclotron_node` (7 MB) databases share the production
Postgres HA cluster with Career Mentor (`railway`, 13.8 GB), GlitchTip, Langfuse and Temporal.
A volume or PITR restore of that cluster would also roll back Career Mentor. PostHog
PostgreSQL rollback is therefore a database-level `pg_dump`/`pg_restore` of `posthog` and
`cyclotron_node` only, taken after writers are paused. ClickHouse rollback is a native
`BACKUP DATABASE default TO S3` taken after writers are paused, plus a Railway volume backup.

## Credential finding

The `RAILWAY_API_TOKEN` readable by the `posthog-railway-release` identity in Infisical `prod`
returns `Not Authorized` for project and identity queries. This promotion used the worker's
workspace administrator token. Replacing the release identity's token is a follow-up.

## Restored-data rehearsal

Environment `ph-rehearsal-1108` (`f5428fe7-e320-4123-a853-19027c6aa429`) was staged from
production with `skipInitialDeploys`. Only 22 PostHog roles were committed; Career Mentor,
Pulse, Langfuse, GlitchTip and the other non-PostHog services were removed from the staged patch
before commit. Isolation overrides:

- its own `posthog-prod-storage` bucket instance (bucket-name variables reference the
  environment's bucket; credentials differ from production by hash);
- `EMAIL_HOST*` removed from Web, Worker and the migrator;
- Worker started without `--with-scheduler`;
- no CDP destination consumer roles (Plugins runs `cdp-api` only);
- a single `postgres:18` service named `Postgres HA` with its own volume in place of the HA
  trio, so existing private URLs resolve inside the rehearsal network;
- generated rehearsal domains for Web and the Capture gateway; `SITE_URL` set to the
  rehearsal Web domain.

Data:

- `posthog` and `cyclotron_node` were dumped (`pg_dump -Fc`) from a production replica and
  restored with zero errors after checksum-verified upload. Restored ledger: 2,615 Django
  migrations, 1 team, 610 persons.
- Production ClickHouse `default` (3.71 GiB, 340 tables) was backed up with native `BACKUP` to
  the rehearsal bucket (`BACKUP_CREATED`) and restored (`RESTORED`). Restored: 340 tables,
  315-entry migration ledger, `sharded_events` 1,632,130 rows (production 1,632,142 a few minutes
  later), `session_replay_events` 414 rows. This also exercises the ClickHouse rollback
  mechanism.

Candidate images applied in rehearsal: ClickHouse (`080bc023…`, same start command), then the
release migrator.

### Rehearsal migration result

- Release migrator deployment `81f87893-3309-4d6f-9149-c22904a34998` (candidate main
  `e7188561…`) emitted `All migrations completed successfully.` about 13 minutes after start,
  image pull included. Django ledger 2,615 → 3,180. Persons: `Applied 9 migration(s), skipped 3,
  already applied 11`. ClickHouse ledger 315 → 357, tables 340 → 381. `sharded_events` row count
  unchanged (1,632,130).
- Cyclotron schema migrator `bf3b22f7-9978-40ed-903f-4468f8be58c9` (sqlx `0db8023f…`) applied
  `20260821000001` and completed successfully.
- Non-fatal Redis authentication warnings during migration came from a rehearsal-only Redis
  password regeneration. The rehearsal Redis was set to the password its clients carry.

### Rehearsal topology findings

- Production Node roles (Plugins, Recording API, Recordings Blob Ingestion V2,
  posthog-ingestion) set `REDIS_URL` and `CDP_REDIS_HOST` to production Redis's literal private
  IPv6 address, not a hostname. A staged fork carries that literal. From the rehearsal network,
  TCP to it fails with code 101 (network unreachable), so the rehearsal could not reach
  production Redis. Those four rehearsal roles crash-looped and were removed. Their
  rehearsal-only values were changed to the rehearsal Redis address. Production values are
  unchanged by this promotion.
- Web (`43390a35`) and Worker (`b408e07f`) on the candidate: `/login` returned 200 HTML
  (18.8 KB, 0.92 s). `/_preflight` reported django, db, clickhouse, kafka, redis and
  object_storage true; plugins and celery were false while the Node roles were down.

### Rehearsal defect: person tombstone default

With the candidate Node image, `posthog-ingestion` crash-looped in `process_persons`/`update_person`
with `there is no unique or exclusion constraint matching the ON CONFLICT specification`. The
rehearsal Postgres log showed the failing statement uses `ON CONFLICT (team_id, uuid)` on
`posthog_person`.

Cause: the candidate changes the upstream default `PERSON_MERGE_TOMBSTONE_TEAM_ALLOWLIST` to
`'*'` (`nodejs/src/ingestion/config.ts`). That routes person creation through the tombstone
path, which needs a unique `(team_id, uuid)` index. Upstream creates that index only on the
partitioned person table (`20251113000001_add_partitioned_person_table.sql`). Production
deliberately skips the persons partition migrations ("skipped 3"). Production and the restored
rehearsal have identical person indexes, and neither has `(team_id, uuid)` unique on
`posthog_person`.

Correction: set `PERSON_MERGE_TOMBSTONE_TEAM_ALLOWLIST=""` on the Node roles. Upstream
documents an empty list as the full rollback to the legacy create/delete path, which is the
behavior production runs today. The Node config loader applies an empty environment value as
an explicit override, and Railway injects it (verified in the container). No schema change.

After the correction (deployments `2ee42c2d` ingestion, `5bc72434` Plugins, `4a908fdd` blob
ingestion, `a7b0a324` Recording API), all three canary events were queryable in ClickHouse
`events`. That includes the two sent while ingestion was crashing: Kafka retained them and they
were processed without loss. All three canary persons were created, and both canary replay
sessions were written to `session_replay_events`.

### Rehearsal acceptance

- Web `/login` 200 HTML (18.8 KB). `/_preflight`: django, db, clickhouse, kafka, redis, plugins
  and object_storage true. celery false because the rehearsal Worker deliberately runs without
  its beat scheduler.
- Capture gateway `/i/v0/e/` 200, then the event is visible in ClickHouse.
- `/flags/?v=2` 200, `errorsWhileComputingFlags=false` (the restored team has no flags).
- `/s/` replay 200, then a row in `session_replay_events`.
- Log scan of 13 roles: no errors beyond a missing GeoLite file in Plugins/ingestion, and one
  template fetch that ran while Plugins was down.
- Not exercised in rehearsal (topology unchanged, verified in production instead): MCP,
  PersonHog-only RPC paths beyond ingestion, Cymbal/error tracking, Livestream, Property Defs,
  Temporal Django Worker, Browserless.

### Rollback drill (rehearsal, over migrated databases)

With every rehearsal application role removed:

- PostgreSQL: `DROP DATABASE … WITH (FORCE)` for `posthog` and `cyclotron_node`, recreate, then
  `pg_restore -j 4` from the pre-migration dumps took 8 s with zero restore errors. The Django
  ledger returned to 2,615 and persons to 610.
- ClickHouse: `DROP DATABASE default SYNC`, `CREATE DATABASE default`, then native `RESTORE`
  from the pre-migration S3 backup took 339 s. The ledger returned to 315 entries and 340
  tables; `sharded_events` 1,632,131.

Both production rollback paths are therefore executed procedures, not plans.

### Production window preparation

- A production-scoped Railway project token (`posthog-promotion-window-20261108`) was created
  for window mutations, giving a rate-limit bucket separate from the administrator token. It is
  stored only in the worker's tmpfs and is deleted after acceptance.
- `PERSON_MERGE_TOMBSTONE_TEAM_ALLOWLIST=""` applies to all six Node overlay roles. In the
  current production bundle (`da93d8bb`), the default for this setting is `''`
  (`nodejs/src/ingestion/config.ts:361`), so the override preserves current production
  behavior. The Python application has no equivalent setting.
- Writers paused in the window: Web, Worker, Temporal Django Worker, Plugins, posthog-ingestion,
  Recordings Blob Ingestion V2, Recording API, Error Tracking Ingestion, Cyclotron V2 Janitor,
  Property Defs RS, PersonHog Replica, PersonHog Router, Cymbal, Cymbal Resolution, PostHog MCP
  and Feature Flags. Kept running so SDK traffic buffers into Kafka: the Capture gateway,
  PostHog-Capture-Backend, Replay Capture, Hypercache and Livestream.

## Production window (2026-11-08)

Baseline before the window (09:51 UTC): `/login` 200, `/_preflight` all true including celery,
capture, flags and replay 200, and the canary event visible in ClickHouse.

| Time (UTC) | Step | Result |
| --- | --- | --- |
| 10:04 | Removed 16 writer deployments (window project token) | none active after 20 s; no client sessions on `posthog`/`cyclotron_node` |
| 10:05 | `pg_dump -Fc` from leader Postgres-3 | `posthog` 60.0 MB, 650 data entries; `cyclotron_node` 10.7 KB (kept off-cluster on the worker) |
| 10:06 | ClickHouse `BACKUP DATABASE default TO S3` (`prod-pre-a5f437083-20261108`) | `BACKUP_CREATED`; ledger 315; `sharded_events` 1,632,313 |
| 10:09 | Railway ClickHouse volume backup | refused: plan limit of 10 backups per volume. The 08-30 anchors were not deleted; the drilled native backup is the rollback |
| 10:06–10:08 | ClickHouse image `080bc023…` (start command unchanged), deployment `0dac325b` | SUCCESS; engine 26.6.2.158; ledger, rows and 340 tables unchanged |
| 10:09–10:11 | `PERSON_MERGE_TOMBSTONE_TEAM_ALLOWLIST=""` on six Node roles; 22 image fields committed with `skipDeploys` | applied |
| 10:11–10:26 | Release migrator `cb1d93dd-9eb2-489a-b354-7d98156c0642` | `All migrations completed successfully.`; ClickHouse ledger 357 |
| 10:27–10:29 | Cyclotron schema migrator `467748aa-cae3-4a17-bd39-53d6f34a8b8e` | applied `20260821000001`; completed |
| 10:29–10:30 | PersonHog Replica `b67e1a4b`, Router `8fedd86c` | SUCCESS |
| 10:30–10:33 | Web `638a0679`, Worker `61a3bca6`, Temporal Django Worker `32ba5702` | SUCCESS |
| 10:33–10:35 | Plugins `c588149e`, ingestion `1b16d576`, blob ingestion `5e6bc6ea`, Recording API `382451c5`, Cyclotron V2 Janitor `fecb6ade` | SUCCESS |
| 10:35–10:37 | Cymbal Resolution `5104763e`, Cymbal `d9113bd6`, Error Tracking Ingestion `1cf1b36e` | SUCCESS |
| 10:37–10:39 | Feature Flags `5f67c273`, Property Defs RS `fcbd7354`, Livestream `73c00d6c`, MCP `f54cff62` | SUCCESS |
| 10:39–10:40 | Capture backend `eb34ba57`, Replay Capture `79543966`, Hypercache `b4895188` | SUCCESS |

The Capture gateway stayed up throughout: `/health` 200, and a capture during the window
returned 200.

## Production acceptance

- `/login` 200 HTML; `/_preflight` django, db, redis, clickhouse, kafka, plugins, celery and
  object_storage all true.
- Capture 200, then the event is queryable. The canary captured during the window at 10:11:52
  was ingested at 10:35:17 (Kafka buffering, no loss). 53 real events timestamped inside the
  window were present afterwards.
- `/flags/?v=2` 200, `errorsWhileComputingFlags=false`.
- `/s/` replay 200, then a row in `session_replay_events`.
- MCP `mcp.posthog.uptomic.com`: `initialize` succeeded, `exec` `project-get` returned the
  project, and a bounded `query-trends` aggregate returned results.
- Log scan of 21 roles: no ingestion `ON CONFLICT` errors and no crash loops. The GeoLite2
  file message predates the window. The MCP skill-catalog warmup timed out and the service
  started without product skills, as it reports.
- ClickHouse Kafka-engine "Can't get assignment" warnings predate the window (22,280 in
  09:00–09:05 vs 14,549 in a 5-minute sample afterwards).
- New after the window: a stuck `GET_PART` replication-queue entry on
  `default.sharded_query_log_archive_old` (PostHog's internal query-log archive, retired by this
  release). It does not affect events, persons, replay or flags.

## Retained anchors and cleanup

- The pre-window ClickHouse native backup is retained in the `ph-rehearsal-1108` environment's
  bucket under `prod-pre-a5f437083-20261108/` (29,228 objects, 3.67 GiB). This is the drilled
  rollback source. That environment's 22 services and their volumes were deleted after
  acceptance; the bucket was kept.
- Pre-window `posthog` and `cyclotron_node` dumps are retained owner-only on the worker
  (`/data/tmp/codex/ph-window/`) until rollback is no longer needed.
- The window project token was deleted after the last production mutation.
- The 2026-08-30 Railway volume backup anchors were not touched.

## Follow-ups

1. Scheduled candidate builds have failed since 2026-10-10 (Node Redis overlay drift, and
   upstream's ClickHouse base moved past `26.6.2.158`). The next promotion needs a reviewed
   overlay update and a separately gated ClickHouse server upgrade.
2. Add `PERSON_MERGE_TOMBSTONE_TEAM_ALLOWLIST=""` for the Node roles to
   `render-railway-plan.ts`, with a test, so future plans carry this correction. Alternatively,
   adopt upstream's partitioned person table and its `(team_id, uuid)` index as a reviewed
   schema change.
3. Replace the `posthog-railway-release` identity's invalid `RAILWAY_API_TOKEN`.
4. Clear the stuck `GET_PART` entry on `sharded_query_log_archive_old`, or accept it until
   upstream drops the table.
5. The ClickHouse volume has reached the 10-backup plan limit; prune expired anchors with
   explicit approval.
6. Production Node roles carry production Redis's literal IPv6 address in `REDIS_URL` and
   `CDP_REDIS_HOST`. It works, but a Redis redeploy that changes its address would break them.
