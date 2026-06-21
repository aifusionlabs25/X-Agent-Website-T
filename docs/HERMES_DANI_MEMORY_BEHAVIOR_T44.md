# Hermes Dani Memory Behavior T44

Phase T44 tightens Dani's returning-user behavior after the first successful email-memory two-session test.

This phase updates local website code only. It does not patch the live Tavus persona, create a Tavus conversation, join a room, call Hermes, call OpenAI/Codex, call Ollama, send email, update CRM, book a meeting, mutate production storage, or trigger outbound workflows.

## What The Test Showed

The backend memory store was connected and returned memory for the tested email. Dani partially used the prior note in the second session, but behaved too uncertainly:

- she did not clearly say she had prior approved notes
- she asked for email again even though email memory lookup had already happened before session start
- she could not see the raw email, which is correct, but did not explain that privacy boundary well
- she implied follow-up/email behavior in ways that should only happen after app confirmation
- the stored summary was useful but too transcript-like

## Changes Made

The Tavus `conversational_context` prompt now states:

- returning-user memory is available
- the visitor completed website memory check-in before session start
- approved prior-session notes should be used naturally and confidently
- if the visitor asks whether Dani remembers them, Dani should answer directly from the approved notes
- Dani should not ask for email just to retrieve memory
- Dani should not claim she can see the raw email address
- Dani should ask only one or two questions at a time
- outbound actions are pending unless the app confirms completion
- future app-confirmed outbound actions may be stated truthfully

The deterministic memory summary builder now produces more structured continuity notes:

- visitor/business context
- primary goal
- implementation notes
- success or scale signals
- next-step signals

## Product Direction For Actions

Dani must eventually support real functions such as email recaps, meeting requests, CRM/handoff workflows, and follow-up actions.

The rule is not "Dani can never do these." The rule is:

1. Dani may capture the user's requested action.
2. Dani may say the action is being prepared or captured for the team.
3. Dani may only claim the action was completed after the app/tool/backend confirms it.
4. If no confirmation exists, Dani must not say the email was sent, meeting was booked, CRM was updated, or workflow completed.

This keeps the demo truthful today while preserving the product goal that Dani becomes an action-capable X Agent.

## Expected Next Session Behavior

If the visitor returns with an email that has approved memory, Dani should be able to say something like:

> Yes, I have notes from your last visit. We talked about using an X Agent on your soccer-products website to answer product questions, support shoppers on product and checkout pages, and improve checkout conversion. Is that still the direction you want to focus on?

If the visitor asks for the email address:

> For privacy, I do not see the raw email address here, but I can use the approved notes connected to this session.

If the visitor asks Dani to send a recap:

> I can capture that recap request for the team. Once the app confirms sending is available, I can state when it has been sent.

## Remaining Work

- Apply the T43 persona prompt inside Tavus.
- Run another two-session hosted website test.
- Add confirmation-gated outbound action tools once the memory loop is stable.
- Re-test that Dani does not over-ask for email or over-claim completed actions.

## Follow-Up From Session Pair c191 / c08b

The next live test proved the first memory handoff improved: Dani correctly said she had notes from the prior visit and recalled the soccer-products site, lower-right X Agent, product questions, and checkout conversion goal.

The remaining issue was detail retention and follow-up behavior. A prior turn that included both a meeting time and a spoken email was being dropped entirely by the deterministic memory summarizer because it looked like an email-collection turn. That protected raw email, but it also discarded safe details such as Tuesday at 10 a.m. or 2 p.m.

The summarizer now redacts email-like text inside a turn instead of dropping the whole turn, so safe next-step details can survive while raw email stays out of memory. The Tavus continuity prompt also now says not to ask for email again as a prerequisite for a recap, meeting, or quote when returning-user memory context is present.

Follow-up refinement: safe assistant-side next-step details are now considered for scheduling memory. If Dani proposed or repeated a technical-call time, that safe scheduling context can be included in the next memory summary. Any wording that could sound like a completed outbound action is softened into a pending request before storage, so Dani still cannot claim an email, invite, CRM update, or meeting was completed unless a future app tool confirms it.
