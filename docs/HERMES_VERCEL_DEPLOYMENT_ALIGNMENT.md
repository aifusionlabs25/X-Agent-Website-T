# Hermes Vercel Deployment Alignment

Phase T20.1 resolves the hosted deployment/version mismatch before any more hosted Tavus live tests.

## Current Vercel Linkage

- Local project link: `.vercel/project.json`
- Vercel project: `x-agent-website-t`
- Project id: `prj_Z8X0vFx8rVi3tk3N7lftl3bWsm4N`
- Org id: `team_vtMP2TcBz05zYZ5dY1lsSQI6`
- Production alias inspected: `https://x-agent-website-t.vercel.app`
- Latest inspected production deployment: `dpl_2EvByYdEqFiYtoqqX2LMBLsxpwZ5`

The inspected production build log shows Vercel cloned:

- Repository: `github.com/aifusionlabs25/X-Agent-Website-T`
- Branch: `main`
- Commit: `c9ee3e6`

That confirms production is currently built from GitHub `main`, not from the uncommitted local workspace state.

## Local Git State

At the time of this alignment pass:

- Local branch: `main`
- `HEAD`: `c9ee3e6`
- `origin/main`: `c9ee3e6`
- The T-phase implementation is still local and dirty, including the conversation start route, Tavus helpers, xagent helpers, scripts, tests, and docs.

Because Vercel production cloned GitHub `main` at `c9ee3e6`, local T2/T16/T20 code that is not committed and pushed cannot be present in the hosted route.

## T20 Mismatch Explanation

Phase T20 posted a valid memory-context fixture to:

`https://x-agent-website-t.vercel.app/api/conversation/start`

The hosted response created Tavus conversation `c4a71fe80750a436`, but returned:

- `memory_context_requested=false`
- `memory_context_applied=false`
- `tavus_conversational_context_attached=false`
- `tenant_id=null`
- `agent_slug=null`
- `visitor_id=null`
- `session_id=null`
- `provider=null`

Those fields are inconsistent with the local T16+ route, which returns app-owned session identity and safe memory flags. The most likely cause is deployment/version mismatch: production is serving the GitHub commit that predates the local T-phase route code.

## Safe Runtime Readiness Endpoint

T20.1 adds:

`GET /api/xagent/runtime-readiness`

The endpoint returns safe booleans only:

- `xagent_session_identity_supported`
- `memory_context_injection_code_present`
- `tavus_conversational_context_supported`
- `memory_context_env_gates_open`
- no secrets
- no memory summary
- no prompt text
- no hashes, namespaces, backend ids, transcript, content, or messages

It does not call Tavus, Hermes, OpenAI, Ollama, Resend, outbound workflows, databases, or memory stores.

## Deployment Recommendation

Use one of these deployment paths, deliberately:

1. Preferred if Vercel production is GitHub-linked:
   - Review the local T-phase file set.
   - Commit the intended T-phase code.
   - Push to the Git branch Vercel deploys from, currently `main`.
   - Wait for the production deployment to complete.

2. Alternative if direct local CLI deploy is the intended workflow:
   - Run `vercel deploy --prod` from this exact local workspace.
   - Confirm the resulting production deployment includes the T-phase files.

Do not rerun Phase T20 until the hosted diagnostic endpoint proves the deployed route includes T16+ memory code and reports the memory gates as open.

## Required Hosted Check Before Any Next Live POST

Before another hosted memory-start POST, fetch:

`https://x-agent-website-t.vercel.app/api/xagent/runtime-readiness`

Proceed only if the safe readiness response includes:

- `xagent_session_identity_supported=true`
- `memory_context_injection_code_present=true`
- `tavus_conversational_context_supported=true`
- `memory_context_env_gates_open=true`

If the endpoint is missing or returns different values, stop and fix deployment alignment first.
