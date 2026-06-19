# Hermes Tavus Live Memory Room URL Recovery

Phase T18.1 recovered the Tavus room URL for the already-created T18 conversation without creating a new conversation and without joining the room.

## Result

- Provider conversation ID: `cc3bf45a98104499`
- Exactly one Tavus GET/read was attempted.
- Retrieval status: `conversation_url_recovered`
- `conversation_url_present=true`
- `tavus_room_joined=false`

The actual room URL was printed only for manual human use during the run. It is not stored in repo proof artifacts.

## Boundaries

- No new Tavus conversation was created.
- The Tavus room was not joined.
- No webhook was added or registered.
- No Tavus `memory_stores` path was used.
- No Hermes, OpenAI/Codex, Ollama, Resend/email, outbound workflow, production database, or production memory call was made.
- No prompt/context text, memory summary, hashes, namespaces, backend IDs, transcript content, messages, API key, or actual conversation URL is stored in the proof artifact.

## Evidence

- Redacted proof artifact: `docs/proofs/hermes_tavus_live_memory_room_url_recovery_t18.json`
- Source T18 proof: `docs/proofs/hermes_tavus_live_memory_start_t18_safe_capture.json`

## Next Decision

The next decision is manually joining the recovered Tavus room and evaluating whether Dani behaves as if she has remembered prior context. That requires separate approval.
