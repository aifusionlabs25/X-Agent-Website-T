# Hermes Tavus Hosted Memory Room URL Recovery T22

Phase T22 recovered the Tavus room URL for the already-created T21 hosted memory conversation without creating a new conversation and without joining the room.

## Result

- Provider conversation ID: `c1fd221a0eaa74c0`
- Exactly one Tavus GET/read was attempted.
- Retrieval status: `conversation_url_recovered`
- `conversation_url_present=true`
- `new_conversation_created=false`
- `tavus_room_joined=false`

The actual room URL was printed only for manual human use during the run. It is not stored in repo proof artifacts.

## Boundaries

- No new Tavus conversation was created.
- The hosted memory-start POST was not retried.
- The Tavus room was not joined.
- No webhook was added or registered.
- No Tavus `memory_stores` path was used.
- Memory was not placed in `custom_greeting`.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory call was made.
- No prompt text, memory summary, hashes, namespaces, backend IDs, transcript content, messages, API key, or actual conversation URL is stored in the proof artifact.

## Evidence

- Redacted proof artifact: `docs/proofs/hermes_tavus_hosted_memory_room_url_recovery_t22.json`
- Source T21 proof: `docs/proofs/hermes_tavus_hosted_memory_start_t21_safe_capture.json`

## Next Decision

The next decision is manually joining conversation `c1fd221a0eaa74c0` and evaluating whether Dani behaves as if she remembers the prior context. That requires separate approval.
