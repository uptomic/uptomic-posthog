# TypeSafe through OpenRouter

Verified 2026-10-02 against [OpenRouter's TypeSafe SDK guide](https://openrouter.ai/docs/guides/community/typesafe-sdk.md)
and a live `jev-latest` request with an Uptomic development key. Re-check the live
docs for SDK versions, model IDs and prices before relying on details here.

## Configure the client

The official SDKs are `@typesafe-ai/sdk` (JavaScript/TypeScript) and `typesafe-sdk`
(Python, imported as `typesafe_sdk`). Change only the base URL and the key:

```ts
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api',
});
```

```python
import os
from typesafe_sdk import TypeSafeClient

client = TypeSafeClient(api_key=os.environ["OPENROUTER_API_KEY"], base_url="https://openrouter.ai/api")
```

Both SDKs also read `TYPESAFE_BASE_URL` and `TYPESAFE_API_KEY`. Prefer passing the
project's existing `OPENROUTER_API_KEY` explicitly so one secret serves both uses
and key rotation cannot leave a stale copy behind. Follow the project's env schema
and secret-naming rules when adding configuration.

Without an SDK, `POST https://openrouter.ai/api/v1/systemone` with
`Authorization: Bearer <OpenRouter key>` and a JSON body of `model`, `state` and
`questions`. OpenRouter's own SDKs also expose this as System One/Decisions.
Send the project's usual OpenRouter attribution headers (`X-Title`, `HTTP-Referer`).

## Models

- `jev-latest` maps to `~typesafe/jev-latest`, which tracks the newest Jev release.
- `jev-1.13` maps to `typesafe/jev-1.13`; pin a version when reproducibility or a
  calibrated threshold matters, and re-evaluate before moving the pin.
- The response `model` field reports the exact served model (for example
  `typesafe/jev-1.13-20260917`); record it with results that need audit.
- TypeSafe's direct-API ID `jev-1.13.0` is rejected by OpenRouter (`400 Model
  typesafe/jev-1.13.0 does not exist`, checked 2026-10-02). Use `jev-1.13`.
- Code that requires the response `model` to equal the requested ID, or keys
  tariffs, spend policy or caches on `jev-1.13.0`, must normalize the served
  OpenRouter ID instead. Changing a model ID in a cache key invalidates that cache.
- The SDK's model listing does not work against OpenRouter, because OpenRouter's
  `/api/v1/models` has a different shape. Use OpenRouter's Models API directly.

## Response, cost and errors

Responses keep TypeSafe's `model`, `answers` and `usage` shape and add `id`,
`provider` and `usage.cost` (USD). Output tokens are free; input tokens are billed
at the price on the [Jev model page](https://openrouter.ai/typesafe/jev-1.13). The
2026-10-02 smoke test (one Noul, 282 input tokens) cost about $0.000012.

Use `usage.cost` and the generation `id` where the project records LLM spend, with
OpenRouter as the provider. Handle OpenRouter errors like the project's other
OpenRouter calls, including `402` (credits exhausted) and per-key limit failures.
Do not silently fall back to a direct typesafe.ai key.

## Migrating a direct integration

1. Find every TypeSafe client construction, raw `api.typesafe.ai` call, env
   variable, model ID, test mock and health check in the project.
2. Point the client at `https://openrouter.ai/api` with the environment's
   `OPENROUTER_API_KEY`; keep request shapes unchanged.
3. Change pinned `jev-1.13.0` to `jev-1.13`, and relax exact response-model checks
   to accept the served OpenRouter ID. Update cost attribution (use `usage.cost`
   with OpenRouter as provider instead of a declared TypeSafe tariff), provider
   inventory, health checks (no `models.list()`), hardcoded `api.typesafe.ai` URLs
   in code and tests, and stored endpoint metadata.
4. Compare answers on a representative labeled sample before and after; check
   thresholds that depend on a specific Jev version.
5. Leave the grandfathered `TYPESAFE_API_KEY` in place until the migrated release
   is verified in every environment, then retire it through the project's normal
   secret process.
