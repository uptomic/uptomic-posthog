# Uptomic project map

Originally verified 2026-09-06 against GitHub repository metadata, local Git origins and
the linked project guides; the Marketing entry was verified 2026-09-24. This map routes
work to its owner. Read the target checkout's current AGENTS.md, applicable guides and
implementation before acting; the map does not replace them or establish current
deployment health. Load only the projects relevant to the task.

## Product and platform owners

Local checkout hints are relative to `~/uptomic-work/`. A checkout may instead be in a
worktree or on another host; confirm its Git origin rather than relying on its folder name.

| Project / aliases | Repository and local checkout hint | Responsibility | Read first |
| --- | --- | --- | --- |
| Career Mentor / Uptomic app | [uptomic/career-mentor](https://github.com/uptomic/career-mentor), `career-mentor/` | Career product: onboarding, profiles, job discovery/import, matching, coaching and application workflows. | [AGENTS.md](https://github.com/uptomic/career-mentor/blob/main/AGENTS.md), then the owning app/package guide and feature contract. |
| Uptomic Job Importer / Chrome extension | [uptomic/career-mentor](https://github.com/uptomic/career-mentor/tree/main/apps/uptomic-job-importer), `career-mentor/apps/uptomic-job-importer/` | Browser job import; part of Career Mentor, with extension packaging and publication guidance. | Career Mentor AGENTS.md and [extension README](https://github.com/uptomic/career-mentor/blob/main/apps/uptomic-job-importer/README.md). |
| Website / Uptomic Web / marketing site | [uptomic/uptomic-web](https://github.com/uptomic/uptomic-web), `uptomic-web/` | Astro public website, landing pages, blog/content, SEO and public report consumption. The guide identifies Cloudflare Pages as its hosting owner. | [AGENTS.md](https://github.com/uptomic/uptomic-web/blob/main/AGENTS.md), its applicable `.claude/skills/` runbook and `docs/knowledge/`. |
| Marketing / social and mailing | [uptomic/marketing](https://github.com/uptomic/marketing), `marketing/` | Social content and media production; Postiz drafts, approved browser posting and measurement; the separate listmonk mailing service and newsletter workflow. | [AGENTS.md](https://github.com/uptomic/marketing/blob/master/AGENTS.md), [README](https://github.com/uptomic/marketing/blob/master/README.md), and `mailing/AGENTS.md` for email work. |
| Feedback Hub / feedback portal | [uptomic/feedback-hub](https://github.com/uptomic/feedback-hub), `feedback-hub/` | Bug reports, feature requests, questions and onboarding feedback; hosted feedback widget, API, portal and agent CLI. | [AGENTS.md](https://github.com/uptomic/feedback-hub/blob/main/AGENTS.md) and [widget integration README](https://github.com/uptomic/feedback-hub/blob/main/README.md). |
| Shepherd / acquisition / growth | [uptomic/shepherd](https://github.com/uptomic/shepherd), `shepherd/` | Evidence-led customer discovery, audience research, campaign design, approved outreach and acquisition attribution. | [AGENTS.md](https://github.com/uptomic/shepherd/blob/main/AGENTS.md), [README](https://github.com/uptomic/shepherd/blob/main/README.md) and its strategy/architecture/operations guides. |
| Chaching / Cha-ching / Career Credits | [uptomic/chaching](https://github.com/uptomic/chaching), `chaching/` | Career Credits referral and rewards service; API, admin, ledger/storage and embeddable widget. | [AGENTS.md](https://github.com/uptomic/chaching/blob/main/AGENTS.md) and `docs/planning/referral-rewards/`. |
| Pulse / reporting / business intelligence | [uptomic/pulse](https://github.com/uptomic/pulse), `pulse/` | Independent business reporting and product health; reporting UI/API, governed metrics, storage and source sync worker. | [AGENTS.md](https://github.com/uptomic/pulse/blob/main/AGENTS.md), [README](https://github.com/uptomic/pulse/blob/main/README.md) and `docs/architecture/uptomic-platform-compatibility.json`. |
| WorkEvolved / WorkEvolved.ai | [uptomic/work-evolved](https://github.com/uptomic/work-evolved), `work-evolved/` | Job/task AI-impact analysis, transformation and upskilling guidance, reports and MCP service. Use WorkEvolved as the product name; AI Job Lens, AI Impact and AI Job Transformation occur in older documents. | [AGENTS.md](https://github.com/uptomic/work-evolved/blob/main/AGENTS.md) and `docs/architecture/current-target-state.md`. |
| Uptomic Automations / operations workflows | [uptomic/uptomic-automations](https://github.com/uptomic/uptomic-automations), `uptomic-automations/` | Operational skills and helpers for email, Monday workflows, expenses and related business operations. | [README](https://github.com/uptomic/uptomic-automations/blob/main/README.md) and the selected `.claude/skills/` workflow. |
| Kvtchr / market-pain research | [uptomic/kvtchr](https://github.com/uptomic/kvtchr), `kvtchr/` | Community evidence collection and market-pain research, adapted from last30days. | [AGENTS.md](https://github.com/uptomic/kvtchr/blob/main/AGENTS.md), [README](https://github.com/uptomic/kvtchr/blob/main/README.md) and its relevant wiki/decision records. |
| Uptomic HQ / shared project context and workflows | [uptomic/uptomic-hq](https://github.com/uptomic/uptomic-hq), `uptomic-hq/` | This project map, repository inventory, selected shared skills, installer and reviewed gstack updates. | [AGENTS.md](https://github.com/uptomic/uptomic-hq/blob/main/AGENTS.md) and [README](https://github.com/uptomic/uptomic-hq/blob/main/README.md). |
| Uptomic Brain / GBrain / company knowledge | [uptomic/uptomic-brain](https://github.com/uptomic/uptomic-brain), `uptomic-brain/` | Shared knowledge service at `brain.uptomic.com`, Railway deployment, PostgreSQL data and original knowledge corpus. HQ owns the usage skill and its distribution. Verified 2026-09-25. | Repository AGENTS.md and the deployment runbook (initial implementation in [PR #1](https://github.com/uptomic/uptomic-brain/pull/1)). |
| Uptomic Worker / Codex Anywhere | [uptomic/codex-anywhere](https://github.com/uptomic/codex-anywhere), `codex-anywhere/` | Worker provisioning, enrolled identities, CLI access, shared worker instructions and worker infrastructure. Verified 2026-09-25. | Repository AGENTS.md and `scripts/install-worker-guide.sh`; application setup still belongs to each application. |

## Website and related repositories

- [uptomic-website-27-oct-13581](https://github.com/uptomic/uptomic-website-27-oct-13581)
  (`uptomic-website/`) is the retired Lovable/Vite site. The user confirmed on 2026-09-06
  that it is no longer used. Retain it for historical lookup; route website work to
  `uptomic-web`. GitHub now marks the retired repository archived.
- [uptomic/uptomic](https://github.com/uptomic/uptomic) is another repository described by
  GitHub as the public website. Its current operational role is unverified; the name alone
  does not make it the implementation owner.
- [uptomic-posthog](https://github.com/uptomic/uptomic-posthog) (`uptomic-posthog/`) owns
  Uptomic's PostHog infrastructure release bundle. Inspect its source/deployment
  configuration for PostHog hosting tasks. Pulse's reporting contracts still belong to Pulse.
  Verify live deployments separately from this project map.
- The DD214, CVR, demo, design and experiment repositories remain discoverable in the
  [repository inventory](repositories.json). Their existence does not establish
  whether they are active, superseded, deployed or integrated with a current product.

## Work that spans projects

- Start from the user's outcome, identify the producing project and affected consumers,
  then read those owners. Include relevant shared contracts in the same plan/review/QA scope.
- Website claims and links should be supported by the owning product's actual behavior.
  WorkEvolved report consumption is documented in the website's source/knowledge; inspect
  both sides for report contract changes.
- Career Mentor owns its host integration with Feedback Hub and Chaching; those services
  own their widget/API behavior and storage. Inspect both producer and consumer for auth,
  identity, request schemas and completion evidence.
- Shepherd owns acquisition workflows; consuming products own their signup and product
  events. Verify attribution at both ends. Reading this map grants no outreach authority.
- Marketing owns social content production, publishing workflows and the listmonk mailing
  service. Uptomic Web owns public site content and Shepherd owns acquisition campaigns;
  Career Mentor owns its product-side subscriber sync. Marketing's Postiz code creates
  drafts only, and its browser posting and real newsletter sends require human approval.
- Pulse's browser/API read Pulse-owned storage. Its sync worker is the sole boundary for
  versioned, allowlisted Career Mentor export views. Do not bypass that boundary by querying
  Career Mentor base tables or coupling the products' deployments.
- HQ owns shared context and workflow distribution. Each application keeps its own task,
  architecture, toolchain, environment and release authority. For example, Kvtchr's guide
  owns its Python/uv toolchain; Career Mentor's Bun rules are not a universal repo template.
- Resolve the requested branch/environment from the current task and target repository.
  A GitHub default branch is a navigation hint, not authorization to deploy or mutate data.

## Find and refresh repositories

The adjacent [repositories.json](repositories.json) is the curated GitHub organization
inventory retained for shared context on its recorded date. Search it when a
project is missing from the table. Empty descriptions and non-archived flags do not prove
an active role. No local checkout is required to discover a repo.

For new or renamed repos, re-query GitHub and verify the relevant README/AGENTS.md and
Git origin. If a repo is inaccessible, report that instead of guessing its contents.
Update `docs/projects.md` for reviewed responsibilities and update the inventory with:

~~~sh
gh repo list uptomic --limit 1000 --json nameWithOwner,description,url,isArchived,isPrivate,defaultBranchRef
~~~

Preserve user-requested removals; repository existence alone is not a reason to restore
an excluded project to shared context. Keep the inventory's `verifiedOn` date and source
accurate. Before replacing it, check the command succeeded and returned the intended
organization. Review the diff, run
`bun run check`, then explicitly reinstall in opted-in projects. Builds copy these two
documents into every shared skill; installed copies are generated and must not be edited.
Upstream gstack updates do not own or overwrite the Uptomic project map.
