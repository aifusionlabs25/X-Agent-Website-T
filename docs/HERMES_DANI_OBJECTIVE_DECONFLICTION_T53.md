# Hermes Dani Objective Deconfliction T53

Phase T53 records the Dani Tavus Objective set that was removed manually from the Tavus site after the returning-user memory tests showed repeated live-demo framing, category selection, and stacked intake questions.

This phase is documentation and guard coverage only. It does not patch Tavus, create a Tavus conversation, call Hermes, call OpenAI/Codex, call Ollama, send email, update calendar, mutate Redis, mutate production storage, or change the customer-facing website flow.

## Current Status

The operator removed the Dani Objective set from the Tavus site before this note was added. Keep this document as a rollback reference only. Do not reattach the Objective set while debugging returning-user memory behavior.

## Why The Objective Set Was Removed

The removed Objective set conflicts with the current Dani memory/persona direction:

- `dani_welcome_scope` explicitly tells Dani to confirm the user understands this is a live demo.
- `dani_interest_classification` explicitly pushes Dani toward categories such as lead qualification, support intake, operations automation, and implementation readiness.
- Several downstream paths tell Dani to capture multiple fields in one pass, which encourages stacked questions.
- The graph optimizes for routing/classification, while the current product need is returning-user continuity and direct memory recap.

These Objectives may be useful again later, but not until the memory loop and live persona behavior are stable.

## Hermes Role Clarification

Hermes is the background backend worker/action layer. Hermes should support tasks such as:

- post-session transcript processing
- memory candidate creation and retrieval
- email/action planning
- AgentMail sends when gates and operator rules allow it
- admin/lead-intel/user follow-up packets
- future CRM, calendar, handoff, or workflow tools

Hermes is not currently the real-time voice turn controller. During a live Tavus session, Tavus persona instructions, Tavus Objectives, the custom greeting, and injected `conversational_context` shape what Dani says. If Tavus Objectives conflict with the memory context, Dani may still behave like a rigid demo/intake form even when Hermes/backend memory is working.

## Reattach Criteria

Do not reattach Dani Objectives until all of these are true:

1. A returning visitor can ask for a recap and receive one directly from approved memory.
2. Dani does not repeat live-demo framing after memory is available.
3. Dani asks one question at a time during discovery.
4. Dani does not ask for a category, lane, business snapshot, focus area, or main question before answering a requested memory recap.
5. Multi-session memory aggregation is implemented or explicitly scoped.
6. A new Objective graph is redesigned to be memory-aware and conversational, not classification-first.

## Removed Objective Snapshot

The removed objective names were:

- `dani_welcome_scope`
- `dani_interest_classification`
- `dani_lead_quality_path`
- `dani_support_intake_path`
- `dani_ops_automation_path`
- `dani_platform_explainer_path`
- `dani_objection_handling_path`
- `dani_implementation_readiness_path`
- `dani_lead_capture_path`
- `dani_general_path`
- `dani_next_step_summary`

The high-conflict prompts were:

```text
dani_welcome_scope:
Establish Dani as the AI Fusion Labs X Agent guide. Confirm the user understands this is a live demo and invite them to share what they are curious about.

dani_interest_classification:
Determine the user's main interest: lead qualification, support intake, operations automation, live video agent experience, implementation readiness, objections or concerns, follow-up interest, pricing or business fit, or general curiosity.
```

## Future Objective Direction

If Dani Objectives are reintroduced, the next graph should start from memory continuity:

1. If memory is present and the visitor asks for a recap, complete the recap before any classification.
2. Use one broad discovery objective, not a large menu of category branches.
3. Avoid spoken category labels unless the visitor asks for options.
4. Use Objectives mainly for structured extraction after the visitor's immediate request is satisfied.
5. Keep Hermes/backend as the system of record for memory, email, action status, and future workflow execution.
