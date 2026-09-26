import { readFileSync, statSync } from 'node:fs';

const endpoint = 'https://brain.uptomic.com/mcp';
const origin = 'https://brain.uptomic.com';
const operations = new Set([
  'tools',
  'whoami',
  'search',
  'recall',
  'entity',
  'remember',
  'forget',
  'get_page',
  'put_page',
  'list_pages',
  'get_links',
  'get_backlinks',
  'delta',
  'context_pack',
  'get_write_request',
  'list_write_requests',
  'request_tools',
]);
type JsonObject = Record<string, unknown>;
type Request = (url: string, init: RequestInit) => Promise<Response>;
export interface Credentials {
  mcp_url: string;
  access_token?: string;
  expires_at?: number;
  client_id?: string;
  client_secret?: string;
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object');
  }
  return value as JsonObject;
}

export function parseCredentials(text: string): Credentials {
  let value: JsonObject;
  try {
    value = object(JSON.parse(text));
  } catch {
    throw new Error('Invalid private GBrain handoff; credential content withheld');
  }
  if (value.mcp_url !== endpoint || (value.issuer_url && value.issuer_url !== origin)) {
    throw new Error('Credential endpoint does not match the Uptomic brain');
  }
  for (const field of ['access_token', 'client_id', 'client_secret']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error('Invalid credential field; content withheld');
    }
  }
  if (value.expires_at !== undefined && typeof value.expires_at !== 'number') {
    throw new Error('Invalid credential expiry');
  }
  return value as unknown as Credentials;
}

export async function loadCredentials(): Promise<Credentials> {
  const file = process.env.GBRAIN_CREDENTIALS_FILE;
  if (file) {
    const stat = statSync(file);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) {
      throw new Error('Credential file must be owned by this user with mode 600');
    }
    return parseCredentials(readFileSync(file, 'utf8'));
  }
  if (process.env.GBRAIN_WORKER_CREDENTIALS) {
    return parseCredentials(process.env.GBRAIN_WORKER_CREDENTIALS);
  }
  let worker: unknown;
  try {
    worker = JSON.parse(readFileSync('/etc/worker/config.json', 'utf8'));
  } catch {
    throw new Error('No private handoff configured; see references/connection.md');
  }
  if (object(worker).name !== 'worker') {
    throw new Error('This worker needs its own GBrain handoff; do not reuse another identity');
  }
  const command = Bun.spawn(
    [
      'infisical',
      'secrets',
      'get',
      'GBRAIN_WORKER_CREDENTIALS',
      '--plain',
      '--silent',
      '--domain=https://secrets.uptomic.com',
      '--projectId=a6fba9dd-0334-4abf-83ef-19566568fe8f',
      '--env=prod',
      '--path=/uptomic-brain',
      '--expand=false',
      '--secret-overriding=false',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const [text, , code] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  if (code !== 0)
    throw new Error('GBrain handoff unavailable in HQ Infisical; secret output withheld');
  return parseCredentials(text.trim());
}

export async function invoke(
  credentials: Credentials,
  operation: string,
  args: JsonObject,
  request: Request = fetch,
): Promise<unknown> {
  // Validate again for callers using this module directly.
  parseCredentials(JSON.stringify(credentials));
  if (!operations.has(operation))
    throw new Error(`Unsupported operation: ${operation}; use tools to inspect the server`);
  let token = credentials.access_token;
  async function renew(): Promise<void> {
    if (!credentials.client_id || !credentials.client_secret) {
      throw new Error('Token expired/rejected and handoff has no renewable client credentials');
    }
    const response = await request(`${origin}/token`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      }),
    });
    if (!response.ok)
      throw new Error(`GBrain token renewal failed (HTTP ${response.status}); response withheld`);
    const value = object(await response.json());
    if (typeof value.access_token !== 'string' || !value.access_token) {
      throw new Error('GBrain renewal returned no access token');
    }
    token = value.access_token;
  }
  if (
    !token ||
    (credentials.expires_at !== undefined && credentials.expires_at <= Date.now() / 1000 + 30)
  ) {
    await renew();
  }
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: operation === 'tools' ? 'tools/list' : 'tools/call',
    params: operation === 'tools' ? {} : { name: operation, arguments: args },
  });
  const send = () =>
    request(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: payload,
    });
  let response = await send();
  if (response.status === 401) {
    await renew();
    response = await send();
  }
  if (!response.ok)
    throw new Error(`GBrain MCP failed (HTTP ${response.status}); response withheld`);
  const text = await response.text();
  const messages: unknown[] = response.headers.get('content-type')?.includes('text/event-stream')
    ? text.split(/\r?\n\r?\n/).flatMap((event) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        return data ? [JSON.parse(data)] : [];
      })
    : [JSON.parse(text)];
  const message = messages.map(object).find((item) => item.id === JSON.parse(payload).id);
  if (!message) throw new Error('GBrain returned no matching RPC response');
  if (message.error)
    throw new Error('GBrain RPC rejected the request; check the advertised schema/grant');
  const result = object(message.result);
  if (result.isError)
    throw new Error(
      'GBrain tool failed; no successful write claimed. Inspect schema or request status.',
    );
  if (operation === 'tools') return result;
  if (result.structuredContent !== undefined) return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content : [];
  const rendered = content
    .map(object)
    .filter((item) => item.type === 'text')
    .map((item) => String(item.text))
    .join('\n');
  try {
    return JSON.parse(rendered);
  } catch {
    return { text: rendered };
  }
}

if (import.meta.main) {
  try {
    const operation = process.argv[2];
    if (!operation || process.argv.length !== 3 || !operations.has(operation)) {
      throw new Error(
        `Usage: bun --no-env-file brain.ts <${[...operations].join('|')}> < arguments.json`,
      );
    }
    const input = await Bun.stdin.text();
    const args = input.trim() ? object(JSON.parse(input)) : {};
    if (['remember', 'put_page', 'forget'].includes(operation) && !args.request_id) {
      throw new Error(
        'Writes require a caller-generated request_id UUID; reuse it and the payload for uncertain retries',
      );
    }
    console.log(JSON.stringify(await invoke(await loadCredentials(), operation, args), null, 2));
  } catch (error) {
    // Do not render fetch/JSON errors that might contain private response text.
    const message = error instanceof Error ? error.message : '';
    const safe =
      /^(GBrain|Credential|Invalid|No private|This worker|Token|Unsupported|Usage:|Writes require|Expected a JSON)/.test(
        message,
      );
    console.error(
      safe
        ? message
        : 'GBrain request failed; inspect access/network or input JSON. No automatic write replay.',
    );
    process.exitCode = 1;
  }
}
