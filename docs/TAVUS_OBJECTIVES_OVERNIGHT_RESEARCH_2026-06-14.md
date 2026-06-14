# Tavus Objectives Overnight Research - 2026-06-14

Prepared for AI Fusion Labs / X Agents.

## Executive Read

Tavus Objectives are a strong fit for the X Agent system, but they should not replace the existing harness or backend workflow immediately.

The best path is:

1. Use Objectives as a Tavus-native workflow layer for live conversations.
2. Keep the current X-Link/harness tooling as the test, simulation, scoring, and regression layer.
3. Add an X Agent Objectives Registry in the website repo so each agent has its own `persona_id`, `replica_id`, `objectives_id`, knowledge tags, guardrails, and objective graph source.
4. Start with Amy, James, and Dani because they expose the three major patterns:
   - Amy: SDR routing and qualification.
   - James: regulated legal intake.
   - Dani: product/demo discovery and lead-quality consulting.
5. Expand to Morgan, Sarah, Luna, Claire/Concierge, Chris, and future agents using reusable graph templates.

The important mental model:

Objectives are not just saved JSON prompts. They are a graph of measurable outcomes that Tavus uses during the conversation, with an evaluator LLM checking completion and extracting structured variables. That is very close to our existing harness/scenario logic, but Tavus executes it inside the live persona runtime.

## What Tavus Objectives Actually Are

From the current Tavus docs:

- Objectives guide a conversation toward concrete outcomes.
- They work alongside the persona system prompt.
- They are best for purposeful workflows such as lead qualification, intake, interviews, questionnaires, triage, and onboarding.
- They are weaker for open-ended, multi-session, free-flowing advisory experiences.
- Objectives are created via `POST /v2/objectives`.
- An objective set returns an `objectives_id`.
- That `objectives_id` is attached to a persona during create or patch.
- Each objective can define:
  - `objective_name`
  - `objective_prompt`
  - `confirmation_mode`
  - `output_variables`
  - `modality`
  - `next_required_objective`
  - `next_conditional_objectives`
  - `callback_url`

Key design rules from Tavus:

- One objective should usually have one clear goal.
- Objective prompts should describe outcomes, not instructions.
- Output variables should be atomic, not vague blobs.
- Conditional branches should be distinct and include a catch-all path.
- `next_required_objective` and `next_conditional_objectives` are mutually exclusive on a single objective.
- `NOTFOUND` values are expected and should be handled by app logic, not inside the objective prompt.
- Objectives can be verbal or visual.
- Objective callbacks can send completed output variables to our backend.

## Account State Found Tonight

Read-only Tavus API checks showed:

- Objectives saved in Tavus account: `0`
- Guardrails saved in Tavus account: `0`
- Existing X Agent personas mostly have `objectives_id: null`

Relevant persona IDs observed:

| Agent | Tavus persona | Persona ID | Default replica ID | Objectives |
|---|---|---:|---:|---|
| Dani | Dani X Agent SDR | `p54f4fa92ba2` | `r7ed486ceba0` | none |
| Amy | Amy Insight SDR | `pf3a086d0109` | `re3a705cf66a` | none |
| James | James Knowles Law Firm | `pcb7189e1a4c` | `r873e4707689` | none |
| Morgan | Morgan GoDeskless | `p518a2f6eba9` | `rc2146c13e81` | none |
| Luna | Luna Vet triage | `p506036d4c62` | `r53a461095cf` | none |
| Sarah | Sarah Netic | `p334593a8ad2` | `r1af76e94d00` | none |
| Claire | Claire Concierge | `p04e23883f0b` | `re3a705cf66a` | none |
| Chris | Chris ZYRATALK | `pf7c67468736` | `r1a4e22fa0d9` | none |

Website state:

- `x-agent-website-t` currently has one live Tavus conversation route driven by global env vars.
- Dani is live inline on the main site.
- Amy, James, Morgan, and Sarah currently point to external live URLs.
- The website does not yet have a per-agent Tavus runtime registry.

X-Link hub state:

- `tavus-xlink-hub` already has a dry-run objective compiler.
- It contains a specialized Amy graph: `amy_insight_frontdoor_v1`.
- That graph compiles to Tavus-shaped `POST /v2/objectives` JSON and harness expectations.
- It does not make live Tavus calls.

This is useful. We should reuse the graph-compiler idea, but move production-safe objective lifecycle management into the website/backend lane.

## Strategic Recommendation

Do not make Objectives a hard replacement yet.

Adopt them in three layers:

### Layer 1 - Tavus Runtime Objectives

Use Tavus Objectives to steer live conversations and extract structured variables during the call.

This is where Objectives shine:

- Lead qualification.
- Legal intake.
- Field-service discovery.
- Support triage.
- Vet triage.
- Routing and next-step decisions.

### Layer 2 - X Agent Backend Workflow

Keep our backend for:

- CRM/email/webhook actions.
- Post-call summaries.
- Follow-up emails.
- Lead scoring.
- Storage.
- Admin dashboards.
- Objective callbacks.
- End-conversation cleanup.
- Billing/runtime controls.

Objectives can feed this layer through callbacks and extracted variables.

### Layer 3 - Harness and Scenario Testing

Keep the harness.

Objectives do not replace:

- Transcript review.
- Scenario simulation.
- Regression scoring.
- Persona quality tuning.
- Conversation realism checks.
- "Does this actually feel good?" evaluation.

In fact, Objectives give the harness more structure to test against. The harness should verify:

- Objective graph path taken.
- Variable completion and `NOTFOUND` rates.
- Whether output values match transcript facts.
- Whether agent tone stayed natural while pursuing goals.
- Whether the live conversation got too rigid.

## High-Value Implementation Pattern

Create this internal object model:

```ts
type XAgentRuntimeConfig = {
  slug: string;
  displayName: string;
  personaId: string;
  replicaId?: string;
  objectivesId?: string;
  objectiveGraphId?: string;
  guardrailIds?: string[];
  guardrailTags?: string[];
  documentTags?: string[];
  documentRetrievalStrategy?: "speed" | "balanced" | "quality";
  maxCallDurationSeconds: number;
  callbackUrlPath: string;
};
```

Then the website conversation route becomes:

```text
POST /api/conversation/start
body: { agentSlug: "dani" }

server:
  load registry[agentSlug]
  create Tavus conversation with persona_id, replica_id, document tags,
  callback_url, max duration, and conversational_context if needed
```

The objective lifecycle should be separate:

```text
POST /api/admin/tavus/objectives/dry-run
POST /api/admin/tavus/objectives/create
PATCH /api/admin/tavus/personas/:id/objectives
GET /api/admin/tavus/objectives
```

For safety, default to dry-run until an explicit admin approval.

## Objective Graph Blueprints

These are implementation-ready V1 graph designs. They are intentionally compact enough to be Tavus-friendly and testable.

### 1. Amy - Insight SDR Routing

Fit: Excellent.

Purpose: Classify business/technical need, capture routing facts, and recommend the correct Insight lane without overpromising scheduling, pricing, or backend actions.

Graph ID: `amy_insight_frontdoor_v1`

Current source: `tavus-xlink-hub` already contains this graph.

Recommended objective payload:

```json
{
  "data": [
    {
      "objective_name": "amy_intro_scope",
      "objective_prompt": "Briefly establish Amy's role as Insight's front-door discovery representative. Confirm the user understands Amy can answer at a high level, understand what they are evaluating, and route toward the right Insight specialist path without promising pricing, scheduling, implementation, or backend action.",
      "confirmation_mode": "auto",
      "output_variables": ["user_understanding_confirmed"],
      "modality": "verbal",
      "next_required_objective": "amy_need_assessment"
    },
    {
      "objective_name": "amy_need_assessment",
      "objective_prompt": "Determine the visitor's practical need. Capture business goal, current environment shape, main pain or risk, and which lane best fits: modernization, security/proof, procurement/buying path, or general routing.",
      "confirmation_mode": "auto",
      "output_variables": ["business_goal", "current_environment", "main_pain_or_risk", "inquiry_lane"],
      "modality": "verbal",
      "next_conditional_objectives": {
        "amy_modernization_path": "if visitor asks about infrastructure, cloud, data center, workplace technology, managed services, modernization, or operational pressure",
        "amy_security_proof_path": "if visitor asks about security, compliance, case studies, proof, monitoring, controls, or credibility",
        "amy_procurement_path": "if visitor asks about first steps, buying path, procurement friction, commercial process, or stakeholder routing",
        "amy_general_routing_path": "for all other real but not yet specific needs"
      }
    },
    {
      "objective_name": "amy_modernization_path",
      "objective_prompt": "Capture the modernization priority, highest-risk workload or decision, and urgency driver. Do not invent architecture, tools, staffing, timing, or migration plans.",
      "confirmation_mode": "auto",
      "output_variables": ["modernization_priority", "highest_risk_workload", "urgency_driver"],
      "modality": "verbal",
      "next_required_objective": "amy_routing_summary"
    },
    {
      "objective_name": "amy_security_proof_path",
      "objective_prompt": "Capture the security or compliance question, requested proof type, and risk concern. Do not claim private case studies, certifications, controls, tooling, or legal/compliance advice unless verified.",
      "confirmation_mode": "auto",
      "output_variables": ["security_or_compliance_need", "requested_material_or_proof_type", "risk_concern"],
      "modality": "verbal",
      "next_required_objective": "amy_routing_summary"
    },
    {
      "objective_name": "amy_procurement_path",
      "objective_prompt": "Capture the buying-path concern, stakeholder context, and what would make a first specialist conversation useful. Do not claim a meeting was booked or assigned.",
      "confirmation_mode": "auto",
      "output_variables": ["buying_path_concern", "stakeholder_or_role_context", "first_specialist_conversation_value"],
      "modality": "verbal",
      "next_required_objective": "amy_routing_summary"
    },
    {
      "objective_name": "amy_general_routing_path",
      "objective_prompt": "Capture one or two routing facts such as business goal, decision criterion, problem owner, urgency, or proof needed. Do not force a long qualification form.",
      "confirmation_mode": "auto",
      "output_variables": ["decision_criterion", "problem_owner", "routing_gap"],
      "modality": "verbal",
      "next_required_objective": "amy_routing_summary"
    },
    {
      "objective_name": "amy_routing_summary",
      "objective_prompt": "Close with a concise routing summary: known need, likely specialist lane, useful proof or review item, unverified items, and safest next step. Do not claim Amy has scheduled, sent, assigned, forwarded, or started anything.",
      "confirmation_mode": "auto",
      "output_variables": ["routable_summary", "recommended_specialist_lane", "unverified_items", "safe_next_step"],
      "modality": "verbal"
    }
  ]
}
```

Priority: first live objective pilot.

Why first: The graph already exists in the hub, and Amy's use case is naturally structured.

### 2. James - Legal Intake

Fit: Excellent, but requires guardrails.

Purpose: Structured personal injury intake with empathy, no legal advice, no case valuation, no promises.

Graph ID: `james_legal_intake_v1`

Recommended objective payload:

```json
{
  "data": [
    {
      "objective_name": "james_open_intake",
      "objective_prompt": "Establish James's intake role, invite the caller to describe what happened, and capture the caller's primary reason for contacting the firm.",
      "confirmation_mode": "auto",
      "output_variables": ["caller_reason", "initial_emotional_state"],
      "modality": "verbal",
      "next_required_objective": "james_incident_basics"
    },
    {
      "objective_name": "james_incident_basics",
      "objective_prompt": "Collect the basic incident facts: incident type, approximate date, location, and a concise description of what happened.",
      "confirmation_mode": "auto",
      "output_variables": ["incident_type", "incident_date", "incident_location", "incident_summary"],
      "modality": "verbal",
      "next_required_objective": "james_injury_and_treatment"
    },
    {
      "objective_name": "james_injury_and_treatment",
      "objective_prompt": "Collect whether anyone was injured, what injuries were mentioned, whether medical treatment happened, and whether more treatment is scheduled.",
      "confirmation_mode": "auto",
      "output_variables": ["injury_summary", "medical_treatment_status", "upcoming_treatment", "severity_signal"],
      "modality": "verbal",
      "next_required_objective": "james_liability_context"
    },
    {
      "objective_name": "james_liability_context",
      "objective_prompt": "Collect basic liability context without giving legal advice: what the caller believes caused the incident, whether police or incident reports exist, witnesses, insurance, and whether the caller already has a lawyer.",
      "confirmation_mode": "auto",
      "output_variables": ["liability_context", "report_status", "witness_status", "insurance_context", "already_represented"],
      "modality": "verbal",
      "next_required_objective": "james_case_route"
    },
    {
      "objective_name": "james_case_route",
      "objective_prompt": "Determine the safest intake route: attorney_review, more_information_needed, outside_scope, or emergency_support. Base this only on conversation facts and do not provide legal advice or case value.",
      "confirmation_mode": "auto",
      "output_variables": ["intake_route", "route_reason", "risk_factors"],
      "modality": "verbal",
      "next_conditional_objectives": {
        "james_consult_next_step": "if facts suggest attorney review may be useful or caller is unsure",
        "james_more_info_next_step": "if key facts are missing but the matter could still be relevant",
        "james_outside_scope_next_step": "if matter appears outside the firm's likely intake scope",
        "james_emergency_next_step": "if caller describes immediate danger, medical emergency, or urgent safety issue"
      }
    },
    {
      "objective_name": "james_consult_next_step",
      "objective_prompt": "Offer a consultation next step without promising representation, outcome, legal advice, or case value. Capture preferred contact method and contact details if the caller is willing.",
      "confirmation_mode": "auto",
      "output_variables": ["preferred_contact_method", "lead_name", "lead_email", "lead_phone", "consult_interest"],
      "modality": "verbal",
      "next_required_objective": "james_safe_close"
    },
    {
      "objective_name": "james_more_info_next_step",
      "objective_prompt": "Summarize what is known and what is still missing. Ask for the single most important missing fact needed for attorney review.",
      "confirmation_mode": "auto",
      "output_variables": ["known_facts", "missing_facts", "priority_missing_fact"],
      "modality": "verbal",
      "next_required_objective": "james_safe_close"
    },
    {
      "objective_name": "james_outside_scope_next_step",
      "objective_prompt": "Respond respectfully if the issue appears outside scope. Do not reject harshly or give legal advice. Capture a safe summary and suggest the caller may need an appropriate attorney or emergency help depending on facts.",
      "confirmation_mode": "auto",
      "output_variables": ["outside_scope_reason", "safe_referral_language"],
      "modality": "verbal",
      "next_required_objective": "james_safe_close"
    },
    {
      "objective_name": "james_emergency_next_step",
      "objective_prompt": "If there is immediate danger or medical emergency, urge the caller to contact emergency services or seek urgent medical care. Do not continue routine intake until safety is addressed.",
      "confirmation_mode": "auto",
      "output_variables": ["emergency_signal", "safety_instruction_acknowledged"],
      "modality": "verbal",
      "next_required_objective": "james_safe_close"
    },
    {
      "objective_name": "james_safe_close",
      "objective_prompt": "Close with a compassionate summary of facts collected, the safe next step, and any unverified items. Do not say the firm accepted the case, do not value the case, and do not provide legal advice.",
      "confirmation_mode": "auto",
      "output_variables": ["case_summary", "safe_next_step", "unverified_items", "james_action"]
    }
  ]
}
```

Recommended James guardrails:

- `no_legal_advice`: James is telling caller what they should do legally, how to handle evidence, whether they have a valid claim, or whether to accept/reject an offer.
- `no_case_value`: James is estimating dollar value, settlement amount, damages, or guaranteed compensation.
- `no_representation_promise`: James is saying the firm will represent the caller or has accepted the case.
- `emergency_redirect`: Caller describes immediate danger, medical emergency, or active safety issue.

Priority: second live objective pilot.

Why second: Legal intake has real compliance value and existing post-call extraction can be simplified or cross-checked with objective output variables.

### 3. Dani - X Agent Product/Demo Guide

Fit: Medium to high, but use a lighter graph.

Dani should not become a rigid lead form. Her best objective structure is a flexible product-guide flow that classifies the user's interest and captures enough context for a useful next step.

Graph ID: `dani_xagent_discovery_v1`

Recommended objective payload:

```json
{
  "data": [
    {
      "objective_name": "dani_welcome_scope",
      "objective_prompt": "Establish Dani as the AI Fusion Labs X Agent guide. Confirm the user understands this is a live demo and invite them to share what they are curious about.",
      "confirmation_mode": "auto",
      "output_variables": ["demo_scope_confirmed", "initial_interest"],
      "modality": "verbal",
      "next_required_objective": "dani_interest_classification"
    },
    {
      "objective_name": "dani_interest_classification",
      "objective_prompt": "Determine the user's main interest: lead qualification, support intake, operations automation, Tavus/video experience, backend integration, pricing/business fit, or general curiosity.",
      "confirmation_mode": "auto",
      "output_variables": ["interest_lane", "business_context", "main_question"],
      "modality": "verbal",
      "next_conditional_objectives": {
        "dani_lead_quality_path": "if user asks about sales, lead quality, qualification, conversion, follow-up, CRM, or handoff",
        "dani_support_intake_path": "if user asks about support, repetitive questions, triage, service tickets, or intake routing",
        "dani_ops_automation_path": "if user asks about operations, manual work, forms, scheduling, or backend workflows",
        "dani_platform_explainer_path": "if user asks about Tavus, X Agents, video AI, objectives, or how the platform works",
        "dani_general_path": "for general curiosity or unclear intent"
      }
    },
    {
      "objective_name": "dani_lead_quality_path",
      "objective_prompt": "Capture the user's sales or lead-quality pain, current source page or channel, current handoff problem, and one useful success metric. Avoid repeating the same one-page-test framing more than once.",
      "confirmation_mode": "auto",
      "output_variables": ["lead_quality_pain", "source_page_or_channel", "handoff_problem", "success_metric"],
      "modality": "verbal",
      "next_required_objective": "dani_next_step_summary"
    },
    {
      "objective_name": "dani_support_intake_path",
      "objective_prompt": "Capture the repeated support or intake problem, current triage path, escalation need, and what a successful handoff would include.",
      "confirmation_mode": "auto",
      "output_variables": ["support_problem", "current_triage_path", "escalation_need", "handoff_requirement"],
      "modality": "verbal",
      "next_required_objective": "dani_next_step_summary"
    },
    {
      "objective_name": "dani_ops_automation_path",
      "objective_prompt": "Capture the manual workflow, where work stalls, which system or team receives the handoff, and what backend action might matter later. Do not claim that backend action has been configured.",
      "confirmation_mode": "auto",
      "output_variables": ["manual_workflow", "stall_point", "handoff_system_or_team", "possible_backend_action"],
      "modality": "verbal",
      "next_required_objective": "dani_next_step_summary"
    },
    {
      "objective_name": "dani_platform_explainer_path",
      "objective_prompt": "Answer the user's platform question clearly and capture what they are trying to understand: persona, replica, objectives, guardrails, knowledge base, integrations, or live video experience.",
      "confirmation_mode": "auto",
      "output_variables": ["platform_topic", "understanding_gap", "followup_question"],
      "modality": "verbal",
      "next_required_objective": "dani_next_step_summary"
    },
    {
      "objective_name": "dani_general_path",
      "objective_prompt": "Keep the demo natural and useful. Capture one practical signal about the user's curiosity, business context, or next question without forcing qualification.",
      "confirmation_mode": "auto",
      "output_variables": ["curiosity_signal", "business_context", "next_question"],
      "modality": "verbal",
      "next_required_objective": "dani_next_step_summary"
    },
    {
      "objective_name": "dani_next_step_summary",
      "objective_prompt": "Summarize what was learned, what remains unknown, and the safest suggested next step. Do not say a meeting was booked, email was sent, or backend setup was started unless the app actually did it.",
      "confirmation_mode": "auto",
      "output_variables": ["conversation_summary", "unverified_items", "safe_next_step", "qualified_signal"]
    }
  ]
}
```

Priority: third pilot.

Why third: Dani is already live and useful, but the objective graph must be tested carefully so it improves progression without making her repetitive or stiff.

### 4. Morgan - Field Service Qualification

Fit: Excellent.

Graph ID: `morgan_field_service_discovery_v1`

Core graph:

1. `morgan_open_scope`
   - Output: `initial_pain`, `operation_type`
   - Next: `morgan_operation_profile`
2. `morgan_operation_profile`
   - Prompt: collect service type, team size, office users, technicians, regions.
   - Output: `service_type`, `office_users`, `field_technicians`, `regions`
   - Next: `morgan_workflow_pain`
3. `morgan_workflow_pain`
   - Prompt: determine current dispatch/scheduling/mobile workflow and top bottleneck.
   - Output: `current_workflow`, `top_bottleneck`, `business_impact`
   - Conditional:
     - `morgan_pricing_path` if user asks pricing or user counts are available.
     - `morgan_integration_path` if user asks systems/integrations/data migration.
     - `morgan_demo_path` if fit and interest are clear.
     - `morgan_more_discovery_path` catch-all.
4. `morgan_pricing_path`
   - Output: `pricing_basis`, `estimated_user_count`, `tier_signal`
   - Next: `morgan_next_step`
5. `morgan_integration_path`
   - Output: `current_systems`, `integration_need`, `migration_concern`
   - Next: `morgan_next_step`
6. `morgan_demo_path`
   - Output: `demo_interest`, `demo_focus`, `stakeholders`
   - Next: `morgan_next_step`
7. `morgan_more_discovery_path`
   - Output: `missing_context`, `qualification_gap`
   - Next: `morgan_next_step`
8. `morgan_next_step`
   - Output: `handoff_summary`, `recommended_next_step`, `unverified_items`

Backend replacement potential:

- Good candidate to replace some post-call lead extraction because Objectives can capture many fields directly.
- Keep final lead scoring in backend until variable accuracy is proven.

### 5. Sarah - Netic SDR

Fit: Excellent.

Graph ID: `sarah_netic_frontdesk_sdr_v1`

Core graph:

1. `sarah_mode_detection`
   - Detect external prospect vs internal Netic evaluation.
   - Output: `audience_mode`, `role`, `company_type`
   - Conditional: `sarah_external_discovery`, `sarah_internal_evaluation`
2. `sarah_external_discovery`
   - Capture business type, inbound lead/call flow, missed-call problem, current tools.
   - Output: `business_type`, `lead_flow`, `missed_call_problem`, `current_tools`
   - Conditional: `sarah_ops_path`, `sarah_roi_path`, `sarah_technical_path`, `sarah_general_path`
3. `sarah_internal_evaluation`
   - Capture what stakeholder is evaluating: behavior, guardrails, metrics, handoff, product positioning.
   - Output: `evaluation_focus`, `stakeholder_role`, `success_criteria`
   - Next: `sarah_summary`
4. `sarah_ops_path`
   - Output: `ops_pain`, `after_hours_need`, `dispatcher_burnout_signal`
   - Next: `sarah_summary`
5. `sarah_roi_path`
   - Output: `roi_metric`, `booking_rate_focus`, `board_or_growth_pressure`
   - Next: `sarah_summary`
6. `sarah_technical_path`
   - Output: `integration_question`, `system_of_record`, `handoff_or_logging_need`
   - Next: `sarah_summary`
7. `sarah_general_path`
   - Output: `interest_signal`, `fit_gap`
   - Next: `sarah_summary`
8. `sarah_summary`
   - Output: `qualified_signal`, `recommended_next_step`, `handoff_summary`

### 6. Luna - Vet Triage

Fit: Excellent, but highest safety sensitivity.

Graph ID: `luna_vet_triage_v1`

Luna should use both Objectives and Guardrails. Objectives structure the triage; Guardrails watch for unsafe advice, diagnosis, dosing, and emergency signals.

Core graph:

1. `luna_ai_scope_disclosure`
   - Prompt: confirm Luna is an AI assistant, not a veterinarian, and can observe/suggest urgency but not diagnose or treat.
   - Output: `ai_disclosure_acknowledged`
   - Next: `luna_pet_basics`
2. `luna_pet_basics`
   - Output: `pet_species`, `pet_age`, `pet_name`, `primary_concern`
   - Next: `luna_visual_observation`
3. `luna_visual_observation`
   - Modality: visual
   - Prompt: observe visible breathing, posture, movement, bleeding, visible injury, eye condition, responsiveness.
   - Output: `visible_condition`, `visual_red_flags`
   - Next: `luna_symptom_history`
4. `luna_symptom_history`
   - Output: `symptom_start`, `prior_history`, `toxin_exposure`, `vomiting_or_diarrhea`, `breathing_concern`
   - Next: `luna_urgency_classification`
5. `luna_urgency_classification`
   - Output: `urgency_level`, `urgency_reason`
   - Conditional:
     - `luna_emergency_path`
     - `luna_high_urgency_path`
     - `luna_monitor_path`
6. `luna_emergency_path`
   - Output: `emergency_reason`, `owner_acknowledged_emergency_instruction`
   - Next: `luna_safe_close`
7. `luna_high_urgency_path`
   - Output: `vet_window`, `symptoms_to_watch`
   - Next: `luna_safe_close`
8. `luna_monitor_path`
   - Output: `monitoring_plan`, `morning_vet_reason`, `red_flags_to_escalate`
   - Next: `luna_safe_close`
9. `luna_safe_close`
   - Output: `triage_summary`, `next_step`, `unverified_items`

Recommended Luna guardrails:

- `no_diagnosis`
- `no_medication_or_dosing`
- `emergency_redirect_required`
- `ai_not_veterinarian_disclosure`
- `no_outcome_guarantee`

### 7. Claire - Concierge / Restaurant

Fit: High.

Graph ID: `claire_concierge_reservation_v1`

Core objectives:

- Detect user intent: reservation, hours/location, private dining, menu/policy, general.
- Collect party size, date, time window, location preference, occasion, contact preference.
- Branch to private dining if large party/event.
- Summarize next step without pretending reservation was made unless backend action exists.

This is a strong future template for hospitality agents.

### 8. Chris - ZyraTalk

Fit: Unknown until prompt reviewed in detail, but likely medium/high if it is sales/support.

Graph direction:

- classify need
- capture business context
- route to product/support/demo path
- summarize next step

### 9. Generic Future X Agent Template

Graph ID pattern: `{slug}_{domain}_frontdoor_v1`

Minimum reusable graph:

```json
{
  "data": [
    {
      "objective_name": "orient_scope",
      "objective_prompt": "Establish the agent's role and confirm what the user is trying to accomplish.",
      "output_variables": ["user_goal", "initial_context"],
      "confirmation_mode": "auto",
      "modality": "verbal",
      "next_required_objective": "classify_need"
    },
    {
      "objective_name": "classify_need",
      "objective_prompt": "Classify the user's request into the most useful workflow path and capture the reason.",
      "output_variables": ["need_category", "classification_reason"],
      "confirmation_mode": "auto",
      "modality": "verbal",
      "next_conditional_objectives": {
        "discovery_path": "if the user is exploring or describing a business problem",
        "support_path": "if the user needs help with an issue or repeated task",
        "buying_path": "if the user is asking about pricing, demo, contract, procurement, or next step",
        "general_path": "for all other requests"
      }
    },
    {
      "objective_name": "discovery_path",
      "objective_prompt": "Capture the problem, current workflow, impact, and success measure.",
      "output_variables": ["problem", "current_workflow", "business_impact", "success_measure"],
      "next_required_objective": "safe_summary"
    },
    {
      "objective_name": "support_path",
      "objective_prompt": "Capture the issue, current state, urgency, and desired outcome.",
      "output_variables": ["issue", "current_state", "urgency", "desired_outcome"],
      "next_required_objective": "safe_summary"
    },
    {
      "objective_name": "buying_path",
      "objective_prompt": "Capture the buying question, stakeholder context, timeline, and useful next step.",
      "output_variables": ["buying_question", "stakeholder_context", "timeline", "next_step_interest"],
      "next_required_objective": "safe_summary"
    },
    {
      "objective_name": "general_path",
      "objective_prompt": "Capture the user's general question and enough context to answer or route safely.",
      "output_variables": ["general_question", "routing_context"],
      "next_required_objective": "safe_summary"
    },
    {
      "objective_name": "safe_summary",
      "objective_prompt": "Summarize what is known, what remains unverified, and the safest next step. Do not claim backend actions occurred unless the app actually performed them.",
      "output_variables": ["summary", "unverified_items", "safe_next_step"]
    }
  ]
}
```

## Objectives vs Current Backend: Both Options

### Option A - Middle Layer First

Objectives steer and extract, backend remains source of truth.

Pros:

- Lowest risk.
- Lets us compare Objective variables against existing transcript extraction.
- Does not break existing workflows.
- Lets us measure `NOTFOUND` rates.
- Allows per-agent A/B testing.

Cons:

- Some duplicated logic remains.
- More plumbing at first.

Recommended for next 1-2 weeks.

### Option B - Selective Backend Replacement

Once objective extraction is reliable, replace parts of custom extraction.

Good replacement candidates:

- Contact info extraction.
- Need classification.
- Triage route.
- Handoff summary.
- Safe next step.
- Qualified/unqualified signal.

Keep custom backend for:

- CRM writes.
- Emails.
- Calendar actions.
- Lead scoring.
- Legal/medical/compliance review.
- Audit logs.
- Cost and session controls.
- Transcript storage.
- Human override.

Recommended only after at least 20-30 test calls per agent pattern.

## Website Implementation Plan

### Phase 1 - Registry and dry-run compiler

Add:

- `lib/xagents/registry.ts`
- `lib/tavus/objectives.ts`
- `app/api/admin/tavus/objectives/dry-run/route.ts`

Registry stores per-agent Tavus runtime metadata.

Dry-run endpoint returns:

- graph id
- Tavus payload
- expected output variables
- graph edges
- persona patch plan
- guardrail recommendations

No live Tavus mutation in Phase 1.

### Phase 2 - Live create behind admin approval

Add:

- `POST /api/admin/tavus/objectives/create`
- `PATCH /api/admin/tavus/personas/:personaId/objectives`

Safety:

- Require explicit `confirmLiveCreate: true`.
- Log objective graph version.
- Save returned `objectives_id` in local registry/manual env record.
- Never auto-patch all personas.

### Phase 3 - Agent-specific live conversations

Update:

- `POST /api/conversation/start`

From:

```text
global TAVUS_PERSONA_ID + TAVUS_REPLICA_ID
```

To:

```text
agentSlug -> registry -> persona_id + replica_id + objectives_id + document tags + callback URL
```

This lets the website host all X Agents instead of sending most agents to external single-agent apps.

### Phase 4 - Objective callbacks

Add:

- `POST /api/tavus/objective-callback`

Store:

- conversation id
- agent slug
- objective name
- output variables
- timestamp
- raw callback payload

Use for:

- lead summaries
- test review
- follow-up emails
- admin analytics
- harness comparison

### Phase 5 - Harness comparison

For each live test:

- Tavus objective path
- callback variables
- transcript extraction
- harness score
- user-perceived quality

This tells us where Objectives can safely replace custom code.

## Testing Checklist

Use Tavus' recommended objective testing patterns plus X Agent-specific checks:

- User gives all data in one answer.
- User gives data piece by piece.
- User corrects a previously collected value.
- User refuses a sensitive field.
- User is ambiguous.
- User changes topic.
- User asks something outside scope.
- User requests a backend action the app cannot perform.
- User tries prompt injection.
- User ends early.
- User asks for recap.
- For visual agents: camera off, pet/ID/object not visible, multiple people visible.

Per-agent success thresholds before live rollout:

- Objective path chosen correctly in at least 85 percent of scripted runs.
- Critical variables extracted correctly in at least 85 percent of scripted runs.
- No high-risk guardrail misses in regulated domains.
- Conversation still feels natural in human review.
- `NOTFOUND` values are explainable and not due to avoidable prompt vagueness.

## Where Objectives Will Help Most

Highest immediate value:

1. Amy: clean routing and reusable SDR template.
2. James: legal intake structure and attorney handoff summary.
3. Morgan: field-service qualification and pricing/user-count facts.
4. Sarah: prospect/internal mode detection and Netic routing.
5. Luna: visual triage and urgency route, with strict guardrails.

Moderate value:

1. Dani: useful, but keep flexible.
2. Claire: strong once reservation/private dining flow is ready.
3. Chris: pending prompt/domain review.

Lower value:

- Highly open-ended advisory personas.
- Long relationship/memory-based agents.
- Agents where "good" is mostly emotional support or creative exploration.

## Important Risks

1. Over-rigid conversations

Objectives can make an agent feel like a form if the graph is too granular or too linear.

Mitigation: use fewer, broader objectives; ask one question at a time; keep system prompt natural.

2. False completion

Evaluator may mark an objective complete even if the extracted value is weak.

Mitigation: compare objective variables to transcript extraction during pilot.

3. Branch ambiguity

Overlapping conditional branches can route incorrectly.

Mitigation: 2-5 branches, distinct wording, catch-all path.

4. Backend action hallucination

Agent may imply an email, meeting, CRM entry, or handoff happened when it did not.

Mitigation: guardrails plus objective prompt language: "do not claim action unless app actually performed it."

5. Regulated domain risk

Legal and vet agents need guardrails and conservative fallback logic.

Mitigation: use Objectives for intake and triage, Guardrails for unsafe advice, backend for audit/human review.

## Immediate Next Moves

Recommended order:

1. Implement website objective registry and dry-run endpoint.
2. Port Amy's existing dry-run graph from `tavus-xlink-hub` into website-compatible TypeScript.
3. Generate `amy_insight_frontdoor_v1` live payload and create it in Tavus with explicit approval.
4. Patch Amy persona with returned `objectives_id`.
5. Run 5-10 live Amy test calls.
6. Compare Tavus objective callbacks to existing test scripts.
7. Repeat for James.
8. Repeat for Dani with the lighter flexible graph.
9. Add guardrail creation and attachment for James and Luna.
10. Build future-agent template into X Agent Factory.

## Sources Checked

- Tavus Overview: https://docs.tavus.io/api-reference/overview
- Create Objectives API: https://docs.tavus.io/api-reference/objectives/create-objectives
- Objectives guide: https://docs.tavus.io/sections/conversational-video-interface/persona/objectives
- Objectives Prompting Guide: https://docs.tavus.io/sections/onboarding-guide/objectives
- Create Persona API: https://docs.tavus.io/api-reference/personas/create-persona
- Guardrails guide: https://docs.tavus.io/sections/conversational-video-interface/guardrails
- Tavus FAQ: https://docs.tavus.io/sections/conversational-video-interface/faq
- Tavus docs index: https://docs.tavus.io/llms.txt
- Tavus full docs export: https://docs.tavus.io/llms-full.txt
- Tavus OpenAPI contract: https://docs.tavus.io/openapi.yaml

## Bottom Line

Tavus Objectives are worth adopting.

They are not a magic replacement for everything we built, but they are exactly the right Tavus-native layer for making X Agents easier to define, repeat, test, and launch.

The correct architecture is:

```text
Persona = identity, tone, knowledge, style
Objectives = live workflow path and structured extraction
Guardrails = safety/compliance boundaries
Backend = real actions, storage, CRM/email/calendar, audit
Harness = regression testing, transcript quality, scenario truth
Factory = reusable templates for future X Agents
```

This should reduce future X Agent setup time because we can package each agent as:

```text
system prompt + knowledge pack + objective graph + guardrails + runtime config + test scenarios
```

That is the reusable product shape.
