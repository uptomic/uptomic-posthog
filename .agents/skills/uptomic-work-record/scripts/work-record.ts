#!/usr/bin/env bun
/**
 * Write the Uptomic work record (version 1) into a Beads issue's metadata.
 *
 * The record names who is working on an issue, where and on which code. It is
 * stored as flat string keys under one versioned prefix, so `bd update
 * --set-metadata` merges it without touching any other metadata key and
 * `bd list --metadata-field` can query each field. Values that look like an
 * email address, credential or token are refused and never written.
 *
 *   bun work-record.ts claim   --issue ID [--model M] [--tool T] [--session S]
 *   bun work-record.ts commit|push|handoff [--issue ID] [--hook] [--pull]
 *   bun work-record.ts show    [--issue ID]
 *
 * Without --issue (or BEADS_ISSUE), commit/push/handoff/show refresh the
 * in-progress issues whose record this session already holds: same repository
 * and host, same branch or worktree, and the same agent session. Another
 * holder's issue is never changed implicitly; take it over with an explicit
 * claim. With --hook, finding no held issue is not an error, but a failed write
 * still exits nonzero. --pull runs `bd dolt pull` first so the write lands on
 * the latest shared history.
 */
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';

export const PREFIX = 'uptomic_work_v1_';
export const FIELDS = [
  'agent_tool',
  'agent_model',
  'agent_session',
  'agent_thread',
  'operator',
  'host',
  'repo',
  'worktree',
  'branch',
  'head',
  'event',
  'updated_at',
] as const;
export type Field = (typeof FIELDS)[number];
export type WorkRecord = Partial<Record<Field, string>>;
export const EVENTS = ['claim', 'commit', 'push', 'handoff'] as const;
export type Event = (typeof EVENTS)[number];
const AGENT_FIELDS: readonly Field[] = [
  'agent_tool',
  'agent_model',
  'agent_session',
  'agent_thread',
];

type Environment = Readonly<Record<string, string | undefined>>;
export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}
export type Runner = (args: readonly string[]) => CommandResult;

const EMAIL = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/u;
const SECRET_SHAPES: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}/u,
  /\bAIza[0-9A-Za-z_-]{30,}/u,
  /\bglpat-[A-Za-z0-9_-]{16,}/u,
  /\bnpm_[A-Za-z0-9]{30,}/u,
  /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/iu,
  /[A-Za-z0-9]*(?:token|secret|password|passwd|passphrase|api[_-]?key|credential|private[_-]?key|auth)[A-Za-z0-9_-]*\s*[=:]/iu,
  /\bgithub_pat_[A-Za-z0-9_]{16,}/u,
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/u,
  /\bxox[abeprs]-[A-Za-z0-9-]{8,}/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY/u,
  /:\/\/[^/\s]*:[^/\s]*@/u,
];

/**
 * Each field has a narrow format, so free text cannot ride along in a field.
 * The generic email and credential checks apply on top of it.
 */
const FORMATS: Record<Field, RegExp> = {
  agent_tool: /^[a-z][a-z0-9._-]{0,39}$/u,
  agent_model: /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,99}$/u,
  agent_session: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u,
  agent_thread: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u,
  operator: /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,99}$/u,
  host: /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u,
  repo: /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u,
  worktree: /^\/[^=@\s]{0,255}$/u,
  // Git's ref-name rules (git check-ref-format). bd splits key=value on the first `=`.
  branch: /^(?![/.-])(?!.*(?:\.\.|\/\/|@\{|\/\.|\.lock(?:\/|$)))[^\s~^:?*[\\]{1,200}(?<![/.])$/u,
  head: /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u,
  event: /^(?:claim|commit|push|handoff)$/u,
  updated_at: /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u,
};

/** The value for `field`, or undefined when it is malformed or looks sensitive. */
export function fieldValue(field: Field, value: string | undefined): string | undefined {
  const safe = safeValue(value);
  return safe !== undefined && FORMATS[field].test(safe) ? safe : undefined;
}

/** A value safe to store: short, single-line, and not an email or credential. */
export function safeValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 256) return undefined;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) return undefined;
  if (EMAIL.test(trimmed)) return undefined;
  if (SECRET_SHAPES.some((shape) => shape.test(trimmed))) return undefined;
  return trimmed;
}

/** owner/name from a Git remote URL; credentials and hosts are never kept. */
export function repositoryName(remote: string | undefined): string | undefined {
  const match =
    /(?:^|[/:@])github\.com[:/]+([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/u.exec(
      remote?.trim() ?? '',
    );
  return match ? `${match[1]}/${match[2]}` : undefined;
}

function cleanEnvironment(env: Environment): Record<string, string> {
  // A hook exports GIT_DIR and friends; never let them redirect our Git reads.
  return Object.fromEntries(
    Object.entries(env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !entry[0].startsWith('GIT_'),
    ),
  );
}

function gitValue(cwd: string, args: string[], env: Environment): string | undefined {
  const result = spawnSync('git', args, { cwd, env: cleanEnvironment(env), encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() || undefined : undefined;
}

export interface AgentOverrides {
  tool?: string;
  model?: string;
  session?: string;
  thread?: string;
  operator?: string;
}

/** Agent identity from explicit overrides, then the harness's own variables. */
export function agentIdentity(env: Environment, overrides: AgentOverrides = {}): WorkRecord {
  const detectedTool = env.CODEX_THREAD_ID
    ? 'codex'
    : env.CLAUDECODE === '1' || env.CLAUDE_CODE_SESSION_ID
      ? 'claude-code'
      : undefined;
  return {
    agent_tool: fieldValue('agent_tool', overrides.tool ?? env.UPTOMIC_AGENT_TOOL ?? detectedTool),
    agent_model: fieldValue(
      'agent_model',
      overrides.model ?? env.UPTOMIC_AGENT_MODEL ?? env.ANTHROPIC_MODEL,
    ),
    agent_session: fieldValue(
      'agent_session',
      overrides.session ??
        env.UPTOMIC_AGENT_SESSION ??
        env.CODEX_THREAD_ID ??
        env.CLAUDE_CODE_SESSION_ID,
    ),
    agent_thread: fieldValue(
      'agent_thread',
      overrides.thread ?? env.UPTOMIC_AGENT_THREAD ?? env.T3CODE_THREAD_ID,
    ),
  };
}

export interface Collected {
  record: WorkRecord;
  /** Fields whose source had a value that was refused (malformed or sensitive). */
  rejected: Field[];
  /** HEAD is detached, so the record legitimately has no branch. */
  detached: boolean;
}

/** The current record for the checkout at `cwd`, with any refused source values. */
export function collect(
  cwd: string,
  event: Event,
  env: Environment = process.env,
  overrides: AgentOverrides = {},
  now: Date = new Date(),
): Collected {
  const branch = gitValue(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], env);
  const remote = gitValue(cwd, ['remote', 'get-url', 'origin'], env);
  const sources: Partial<Record<Field, string | undefined>> = {
    operator:
      overrides.operator ?? env.UPTOMIC_OPERATOR ?? gitValue(cwd, ['config', 'user.name'], env),
    host: env.UPTOMIC_WORKER ?? hostname(),
    repo: remote === undefined ? undefined : (repositoryName(remote) ?? remote),
    worktree: gitValue(cwd, ['rev-parse', '--show-toplevel'], env),
    branch,
    head: gitValue(cwd, ['rev-parse', 'HEAD'], env),
  };
  const identity = agentIdentity(env, overrides);
  const agentSources: Partial<Record<Field, string | undefined>> = {
    agent_tool: overrides.tool ?? env.UPTOMIC_AGENT_TOOL,
    agent_model: overrides.model ?? env.UPTOMIC_AGENT_MODEL ?? env.ANTHROPIC_MODEL,
    agent_session: overrides.session ?? env.UPTOMIC_AGENT_SESSION,
    agent_thread: overrides.thread ?? env.UPTOMIC_AGENT_THREAD,
  };
  const record: WorkRecord = { ...identity, event, updated_at: now.toISOString() };
  const rejected: Field[] = [];
  for (const [field, raw] of Object.entries(sources) as [Field, string | undefined][]) {
    const value = fieldValue(field, raw);
    if (value !== undefined) record[field] = value;
    else if (raw?.trim()) rejected.push(field);
  }
  for (const [field, raw] of Object.entries(agentSources) as [Field, string | undefined][]) {
    if (raw?.trim() && identity[field] === undefined) rejected.push(field);
  }
  return { record, rejected, detached: branch === undefined && sources.head !== undefined };
}

/** The current record for the checkout at `cwd`. */
export function collectRecord(
  cwd: string,
  event: Event,
  env: Environment = process.env,
  overrides: AgentOverrides = {},
  now: Date = new Date(),
): WorkRecord {
  return collect(cwd, event, env, overrides, now).record;
}

/** The record already stored in an issue's metadata. */
export function storedRecord(metadata: unknown): WorkRecord {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const record: WorkRecord = {};
  for (const field of FIELDS) {
    const value = (metadata as Record<string, unknown>)[PREFIX + field];
    if (typeof value === 'string') record[field] = value;
  }
  return record;
}

/** The agent's session identity: its session ID, else its orchestrating thread ID. */
export function sessionIdentity(record: WorkRecord): string | undefined {
  if (record.agent_session) return `session:${record.agent_session}`;
  return record.agent_thread ? `thread:${record.agent_thread}` : undefined;
}

const HINTS: Partial<Record<Field, string>> = {
  agent_tool: '--tool or UPTOMIC_AGENT_TOOL',
  agent_model: '--model or UPTOMIC_AGENT_MODEL',
  agent_session: '--session or UPTOMIC_AGENT_SESSION (or --thread)',
  operator: '--operator or UPTOMIC_OPERATOR (a name, not an email)',
  host: 'UPTOMIC_WORKER',
  repo: 'a github.com origin remote',
  branch: 'a branch checked out (or a detached HEAD)',
  worktree: 'a checkout path without @, = or spaces',
  head: 'at least one commit',
};

/**
 * Fields a complete record lacks. Every write must leave a complete record: the
 * agent (unless `--tool human`), operator, host, repository, worktree, head and,
 * unless HEAD is detached, the branch.
 */
export function missingForClaim(record: WorkRecord, detached = false): string[] {
  const required: Field[] = ['operator', 'host', 'repo', 'worktree', 'head'];
  if (!detached) required.push('branch');
  if (record.agent_tool !== 'human') required.unshift('agent_tool', 'agent_model');
  const missing: string[] = required
    .filter((field) => record[field] === undefined)
    .map((field) => `${field} (${HINTS[field] ?? 'required'})`);
  if (record.agent_tool !== 'human' && sessionIdentity(record) === undefined) {
    missing.push(`agent_session (${HINTS.agent_session})`);
  }
  return missing;
}

/**
 * Keys to set and unset. A new agent session replaces the whole agent identity,
 * so a previous agent's model cannot linger; within the same session, fields the
 * caller cannot see (a Git hook does not know the model) are kept.
 */
export function planUpdate(
  current: WorkRecord,
  previous: WorkRecord,
): { set: Record<string, string>; unset: string[] } {
  const identity = sessionIdentity(current);
  // A person's own refresh (no agent identity) keeps a human claim's `agent_tool=human`.
  const sameHuman =
    identity === undefined &&
    current.agent_tool === undefined &&
    previous.agent_tool === 'human' &&
    sessionIdentity(previous) === undefined;
  const sameSession =
    sameHuman || (identity !== undefined && identity === sessionIdentity(previous));
  const set: Record<string, string> = {};
  const unset: string[] = [];
  for (const field of FIELDS) {
    const value = current[field];
    if (value !== undefined) {
      if (fieldValue(field, value) !== value) throw new Error(`Refusing an unsafe ${field} value`);
      set[PREFIX + field] = value;
    } else if (previous[field] !== undefined && !(sameSession && AGENT_FIELDS.includes(field))) {
      unset.push(PREFIX + field);
    }
  }
  return { set, unset };
}

/** The record an update leaves behind. */
export function mergedRecord(
  previous: WorkRecord,
  plan: ReturnType<typeof planUpdate>,
): WorkRecord {
  const merged: WorkRecord = {};
  for (const field of FIELDS) {
    const value = plan.set[PREFIX + field] ?? previous[field];
    if (value !== undefined && !plan.unset.includes(PREFIX + field)) merged[field] = value;
  }
  return merged;
}

export function updateArguments(issue: string, plan: ReturnType<typeof planUpdate>): string[] {
  return [
    'update',
    issue,
    ...Object.entries(plan.set).flatMap(([key, value]) => ['--set-metadata', `${key}=${value}`]),
    ...plan.unset.flatMap((key) => ['--unset-metadata', key]),
  ];
}

interface Issue {
  id: string;
  status?: string;
  metadata?: unknown;
}

function parseIssues(text: string): Issue[] {
  const value: unknown = JSON.parse(text || '[]');
  const list = Array.isArray(value) ? value : [value];
  return list.filter(
    (item): item is Issue =>
      !!item && typeof item === 'object' && typeof (item as Issue).id === 'string',
  );
}

function run(bd: Runner, args: readonly string[]): string {
  const result = bd(args);
  if (result.status !== 0) {
    const detail = result.stderr.trim().split('\n').slice(-1)[0] ?? '';
    throw new Error(`bd ${args[0] ?? ''} failed${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return result.stdout;
}

export function readIssue(bd: Runner, id: string): Issue {
  const issue = parseIssues(run(bd, ['show', id, '--json']))[0];
  if (!issue) throw new Error(`Beads issue ${id} was not found`);
  return issue;
}

/**
 * Whether this session holds the stored record: same repository and host, same
 * branch or worktree, and the same agent session. Without any agent identity
 * (a person committing by hand) only a record that also has none, in this same
 * worktree, qualifies.
 */
export function holdsRecord(current: WorkRecord, stored: WorkRecord): boolean {
  if (!current.repo || stored.repo !== current.repo || stored.host !== current.host) return false;
  const identity = sessionIdentity(current);
  if (identity === undefined) {
    return sessionIdentity(stored) === undefined && stored.worktree === current.worktree;
  }
  return (
    identity === sessionIdentity(stored) &&
    ((current.branch !== undefined && stored.branch === current.branch) ||
      (current.worktree !== undefined && stored.worktree === current.worktree))
  );
}

/** In-progress issues in this repository, split into ones this session holds and others on its branch. */
export function matchingIssues(
  bd: Runner,
  current: WorkRecord,
): { held: Issue[]; others: Issue[] } {
  if (!current.repo) return { held: [], others: [] };
  const issues = parseIssues(
    run(bd, [
      'list',
      '--status',
      'in_progress',
      '--metadata-field',
      `${PREFIX}repo=${current.repo}`,
      '--limit',
      '0',
      '--json',
    ]),
  );
  const held: Issue[] = [];
  const others: Issue[] = [];
  for (const issue of issues) {
    const stored = storedRecord(issue.metadata);
    if (holdsRecord(current, stored)) held.push(issue);
    else if (
      (current.branch !== undefined && stored.branch === current.branch) ||
      (current.worktree !== undefined && stored.worktree === current.worktree)
    ) {
      others.push(issue);
    }
  }
  return { held, others };
}

export function commandRunner(env: Environment = process.env, cwd = process.cwd()): Runner {
  let command = ['bd'];
  if (env.UPTOMIC_BD_COMMAND) {
    const parsed: unknown = JSON.parse(env.UPTOMIC_BD_COMMAND);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((part) => typeof part === 'string')
    ) {
      throw new Error('UPTOMIC_BD_COMMAND must be a JSON array of strings');
    }
    command = parsed;
  }
  const [executable, ...prefix] = command as [string, ...string[]];
  return (args) => {
    const result = spawnSync(executable, [...prefix, ...args], {
      cwd,
      env: cleanEnvironment(env),
      encoding: 'utf8',
      timeout: 60_000,
    });
    return {
      status: result.error ? 1 : result.status,
      stdout: result.stdout ?? '',
      stderr: result.error ? result.error.message : (result.stderr ?? ''),
    };
  };
}

export interface Options {
  event: Event | 'show';
  issues: string[];
  overrides: AgentOverrides;
  hook: boolean;
  pull: boolean;
  dryRun: boolean;
  /** The issue IDs came from BEADS_ISSUE, not --issue: a hint, not a demand. */
  issuesFromEnv: boolean;
}

export function parseArguments(argv: readonly string[], env: Environment = process.env): Options {
  const [event, ...rest] = argv;
  if (!event || ![...EVENTS, 'show'].includes(event)) {
    throw new Error(`Usage: work-record.ts <${[...EVENTS, 'show'].join('|')}> [--issue ID] ...`);
  }
  const options: Options = {
    event: event as Options['event'],
    issues: [],
    overrides: {},
    hook: false,
    pull: false,
    dryRun: false,
    issuesFromEnv: false,
  };
  const values: Record<string, keyof AgentOverrides> = {
    '--tool': 'tool',
    '--model': 'model',
    '--session': 'session',
    '--thread': 'thread',
    '--operator': 'operator',
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index] ?? '';
    if (flag === '--hook') options.hook = true;
    else if (flag === '--pull') options.pull = true;
    else if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--issue' || flag in values) {
      const value = rest[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      index += 1;
      if (flag === '--issue') options.issues.push(value);
      else options.overrides[values[flag] as keyof AgentOverrides] = value;
    } else throw new Error(`Unknown option ${flag}`);
  }
  if (options.issues.length === 0 && env.BEADS_ISSUE) {
    options.issues = env.BEADS_ISSUE.split(/[\s,]+/u).filter(Boolean);
    options.issuesFromEnv = true;
  }
  if (options.event === 'claim' && options.issues.length === 0) {
    throw new Error('claim needs --issue ID');
  }
  for (const id of options.issues) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id)) throw new Error(`Invalid issue ID ${id}`);
  }
  return options;
}

export function execute(
  options: Options,
  cwd: string,
  bd: Runner,
  env: Environment = process.env,
  log: (line: string) => void = (line) => console.error(line),
  now: Date = new Date(),
): number {
  const event = options.event === 'show' ? 'handoff' : options.event;
  const { record: current, rejected, detached } = collect(cwd, event, env, options.overrides, now);
  // Refused values matter only when a record is actually written.
  const refuseRejected = () => {
    if (rejected.length === 0) return;
    throw new Error(
      `refusing to record malformed or sensitive values for ${rejected
        .map((field) => `${field} (${HINTS[field] ?? 'fix its source'})`)
        .join('; ')}`,
    );
  };
  if (options.event === 'claim') {
    refuseRejected();
    const missing = missingForClaim(current, detached);
    if (missing.length > 0) throw new Error(`claim is missing ${missing.join('; ')}`);
  }
  if (options.pull && !options.dryRun && options.event !== 'show') run(bd, ['dolt', 'pull']);
  const discover = () => {
    const found = matchingIssues(bd, current);
    for (const issue of found.others) {
      log(
        `work-record: ${issue.id} is recorded for another session or host; ` +
          'claim it explicitly with --issue to take it over',
      );
    }
    return found.held;
  };
  let targets: Issue[];
  if (options.issues.length > 0) {
    targets = options.issues.flatMap((id) => {
      if (!options.issuesFromEnv || options.event === 'claim') return [readIssue(bd, id)];
      // An inherited BEADS_ISSUE is only a hint; a stale or foreign ID is ignored.
      try {
        return [readIssue(bd, id)];
      } catch {
        log(`work-record: ignoring inherited BEADS_ISSUE ${id}; it was not found here`);
        return [];
      }
    });
    if (options.event !== 'claim' && options.event !== 'show') {
      // Naming an issue (or inheriting BEADS_ISSUE) is not a takeover; only a claim is.
      const unheld = targets.filter((issue) => !holdsRecord(current, storedRecord(issue.metadata)));
      if (unheld.length > 0 && !options.issuesFromEnv) {
        throw new Error(
          `${unheld.map((issue) => issue.id).join(', ')} not held by this session; ` +
            'run claim --issue to take it over',
        );
      }
      for (const issue of unheld) {
        log(
          `work-record: ignoring inherited BEADS_ISSUE ${issue.id}; this session does not hold it`,
        );
      }
      targets = targets.filter((issue) => !unheld.includes(issue));
      if (options.issuesFromEnv) {
        // An inherited selector is a hint: also refresh every issue this session holds.
        const ids = new Set(targets.map((issue) => issue.id));
        targets.push(...discover().filter((issue) => !ids.has(issue.id)));
      }
    }
  } else {
    targets = discover();
  }
  if (options.event === 'show') {
    console.log(
      JSON.stringify(
        targets.map((issue) => ({ id: issue.id, record: storedRecord(issue.metadata) })),
        null,
        2,
      ),
    );
    return 0;
  }
  if (targets.length === 0) {
    log(
      `work-record: this session holds no in-progress issue for ${current.repo ?? 'this repository'} ` +
        `${current.branch ?? current.worktree ?? ''}; record a claim with --issue ID`,
    );
    return options.hook ? 0 : 1;
  }
  refuseRejected();
  for (const issue of targets) {
    const previous = storedRecord(issue.metadata);
    const plan = planUpdate(current, previous);
    const missing = missingForClaim(mergedRecord(previous, plan), detached);
    if (missing.length > 0) {
      throw new Error(
        `refusing an incomplete record on ${issue.id}: missing ${missing.join('; ')}`,
      );
    }
    const args = updateArguments(issue.id, plan);
    if (options.dryRun) {
      console.log(JSON.stringify(['bd', ...args]));
      continue;
    }
    run(bd, args);
    log(`work-record: ${event} recorded on ${issue.id}`);
  }
  return 0;
}

if (import.meta.main) {
  try {
    const options = parseArguments(process.argv.slice(2));
    process.exitCode = execute(options, process.cwd(), commandRunner());
  } catch (error) {
    // A failed write is reported as a failure even from a hook. The calling hook
    // still runs the repository's Beads gate and then refuses the push, so a stale
    // record is never published silently.
    console.error(`work-record: ${error instanceof Error ? error.message : 'failed'}`);
    process.exitCode = 1;
  }
}
