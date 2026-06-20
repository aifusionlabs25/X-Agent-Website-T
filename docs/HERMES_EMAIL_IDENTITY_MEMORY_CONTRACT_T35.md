# Hermes Email Identity Memory Contract T35

Phase T35 defines the email identity contract for the real returning-user Dani memory flow in `x-agent-website-t`.

This is a read-only contract/design phase. No customer-facing UI was changed. No Tavus conversation was created. No live Tavus, Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, production memory, or webhook behavior was added or called.

## Product Model

Every Tavus session is new. Returning-user memory is not recovered from an old room URL and is not tied to a prior Tavus conversation URL.

The website should identify a returning user before the Tavus session starts, retrieve only approved memory for that identity, and inject safe remembered context into the new Tavus conversation through `conversational_context`.

Dani should not ask for or process email mid-session for memory lookup. Email identity capture belongs before session start, in the website adapter, not inside the live Tavus conversation.

## Email Identity Rules

Email input is optional for a first visit and supplied before starting Dani for a return visit.

Normalization rules:

1. Accept a string email input from a pre-session website form only.
2. Trim leading and trailing whitespace.
3. Lowercase the trimmed value.
4. Validate a basic email shape before hashing.
5. Reject empty values, whitespace-only values, values without one `@`, values with spaces, and values without a plausible domain suffix.

The initial validation is intentionally basic product validation, not proof of inbox ownership. Verified email ownership, magic links, or account login can be added later as a stronger identity layer.

Identity derivation:

```text
normalized_email = trim(email).toLowerCase()
email_identity_hash = sha256(identity_salt + ":" + tenant_id + ":" + agent_slug + ":" + normalized_email)
```

The hash must be deterministic for the same tenant, agent, salt, and normalized email. The salt or pepper must be server-side configuration, not client-visible, not stored in proof artifacts, and not sent to Tavus.

Safety rules:

- Never use raw email in a Tavus prompt.
- Never store raw email in proof artifacts.
- Never return raw email from public start or preview routes.
- Never include raw email in `conversational_context`.
- Never use raw email in `custom_greeting`.
- Never include raw email in session-completed payloads sent to Hermes proof lanes unless a future consent-gated backend contract explicitly allows it.
- Do not store raw email in this phase.

Raw email storage decision: deferred and consent-gated. A future production identity adapter may store raw or encrypted email only with explicit user consent, retention policy, deletion support, and a clear reason such as account recovery or verified login. Memory lookup does not require raw email after `email_identity_hash` is derived.

## Namespace Shape

Required identity fields:

```text
tenant_id = ai-fusion-labs
agent_slug = dani
email_identity_hash = sha256(...)
visitor_memory_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}
session_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}/{session_id}
```

`email_identity_hash` replaces the random per-session `visitor_id` as the durable returning-user lookup key for this email lane. A website session may still create a `visitor_id` for compatibility, but memory lookup and memory promotion for the email lane should key on `email_identity_hash`.

Multiple sessions map to one email identity:

- One normalized email maps to one `email_identity_hash` for `tenant_id=ai-fusion-labs` and `agent_slug=dani`.
- One `email_identity_hash` maps to one `visitor_memory_namespace`.
- Each new Tavus start creates a new `session_id`.
- Each new `session_id` maps to one `session_namespace`.
- `provider_conversation_id` remains provenance only and must not become the memory namespace.

Return-code memory remains a prior proof lane. Email identity is the recommended real product lane for returning-user lookup once approved memory storage exists.

## First-Visit Flow

1. User may optionally provide email before starting Dani.
2. Website normalizes and validates the email if supplied.
3. Website derives `email_identity_hash` if a valid email is supplied.
4. Website creates app-owned session identity for a new session.
5. Website creates a new Tavus conversation.
6. Website does not inject memory unless approved memory is found before start.
7. Session ends.
8. Transcript is retrieved later through the bounded Tavus transcript adapter.
9. Website creates an app-owned `xagent.session.completed` payload.
10. Hermes processes the transcript after the session.
11. Hermes creates a memory candidate from redacted/minimized transcript content.
12. Human/operator or policy review approves, edits, or rejects the memory candidate.
13. Approved memory is promoted under `visitor_memory_namespace = xagents/{tenant_id}/{agent_slug}/email/{email_identity_hash}`.

If no email was supplied on the first visit, the session can still complete normally. Hermes may produce a session-scoped memory candidate, but it cannot become returning-email memory until a future approved identity-linking flow exists.

## Return-Visit Flow

1. User enters email before starting Dani.
2. Website normalizes and validates the email.
3. Website derives `email_identity_hash`.
4. Website looks up approved memory by `tenant_id`, `agent_slug`, and `email_identity_hash`.
5. Website creates a fresh `session_id`.
6. Website creates a new Tavus conversation.
7. Website injects only safe, approved, redacted memory context through Tavus `conversational_context`.
8. Dani may naturally use relevant prior context while avoiding hidden-persistence claims.

The Tavus request must not receive raw email, transcript text, backend namespaces, hashes other than any opaque internal routing field explicitly required by a future backend adapter, proof IDs, return codes, or raw memory records.

Memory must not be placed in `custom_greeting`, and this lane does not use Tavus `memory_stores`.

## No-Memory Flow

If email is supplied and valid but no approved memory is found:

1. Website derives `email_identity_hash`.
2. Website records safe internal lookup flags only.
3. Website starts Dani normally with no remembered context.
4. Website must not claim that memory exists.
5. Website may capture the email identity hash for future post-session memory association if consent and retention gates allow it.
6. Website must not store raw email in proof artifacts.

Safe no-memory route flags may include:

```text
email_identity_supplied = true
email_identity_valid = true
email_memory_lookup_attempted = true
approved_memory_found = false
memory_context_applied = false
tavus_conversational_context_attached = false
```

Those flags should not expose normalized email, raw email, hash values, namespaces, backend IDs, transcript content, prompt text, or memory summary text in public responses.

## Safety Requirements

Prompt and transcript boundaries:

- No raw transcript in Tavus prompt.
- No raw email in Tavus prompt.
- No raw email in proof artifacts.
- No raw transcript in proof artifacts unless a separate redacted transcript proof explicitly allows it.
- No unreviewed memory candidate in `conversational_context`.
- No prompt/context text in public route responses.
- No backend hashes or namespaces in public route responses.

Outbound and side-effect boundaries:

- No outbound/email action without separate gates.
- No Resend call from the memory identity path.
- No CRM update, admin notification, follow-up email, purchase claim, or external workflow without separate approval and proof.
- No production DB or production memory write in this T35 phase.
- No webhook registration in this T35 phase.

Redaction and review:

- Transcript processing must minimize source content before memory generation.
- Sensitive values such as email addresses, phone numbers, payment details, government identifiers, API keys, tokens, and secrets must be redacted before memory candidate creation.
- Human/operator or explicitly approved policy review is required before memory promotion.
- Memory records should include provenance hashes and review status, not raw transcript text.

Retention and deletion:

- The future store must support deletion by `email_identity_hash`.
- The future store must support retention windows for session records, memory candidates, and approved memory.
- Raw email storage, if ever approved, must have separate retention, consent, and deletion rules.
- A user request to delete memory should remove approved memory records and identity mappings for the relevant `email_identity_hash`.

## Split Of Responsibilities

`x-agent-website-t` owns:

- pre-session identity capture UI when approved in a later phase
- email normalization and basic validation
- deriving `email_identity_hash`
- approved-memory lookup request before Tavus start
- app-owned session identity creation
- Tavus session start
- safe `conversational_context` injection
- no-memory start behavior
- public and private UI surfaces
- bounded Tavus transcript retrieval adapter
- `xagent.session.completed` payload construction

`tavus-xlink-hub` / Hermes lane owns:

- transcript processing after session completion
- transcript minimization and redaction
- memory candidate generation
- operator/policy review packet
- memory promotion decision
- approved-memory storage proof
- backend worker proof
- future recall policy details

Future shared store contract connects them:

- Website sends `tenant_id`, `agent_slug`, `email_identity_hash`, `session_id`, and provider provenance.
- Hermes stores approved memory under the same `visitor_memory_namespace`.
- Website reads only approved, prompt-safe memory summaries before creating the next Tavus conversation.
- Neither side uses old Tavus room URLs as the returning-user memory key.

## Alignment With Existing Phases

T26 established that the real product path is app-owned returning-user identity plus approved Hermes memory, not room URL recovery.

T27 and T28 proved return-code lookup and start integration against local fixtures.

T30 and T31 proved hosted return-code dry-run and controlled live start behavior without exposing return-code values, prompt text, transcript content, hashes, namespaces, or backend IDs.

T32 preserved normal public session diagnostics.

T33 and T34 kept the return-code preview private, disabled by default, and separate from customer-facing UI.

T35 does not replace those proofs. It defines the email identity memory contract that the next website and Hermes phases should align around.

## Recommended Next Phases

Website T36:

- Add a disabled email identity lookup dry-run helper and private preview.
- No live Tavus.
- No customer-facing UI change.
- No Hermes call.
- No production DB or production memory write.
- Prove normalization, hashing, no-memory behavior, safe lookup flags, and no raw email leakage.

Hermes / `tavus-xlink-hub` Phase H-email-1:

- Adapt memory candidate and promotion proof docs to the `email_identity_hash` namespace.
- Keep transcript redaction, operator review, and promotion gates explicit.
- Keep live/outbound/production persistence disabled unless separately approved.

Later:

- Design the production memory store adapter.
- Define consent, deletion, retention, verified-email, and account-linking behavior.
- Replace fixture/proof-store lookup with a gated approved-memory store lookup.
