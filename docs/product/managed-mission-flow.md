# RELAIS MANAGED Mission Flow

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/relais-availability-and-matching.md`
- `docs/product/conversation-domain.md`
- `docs/product/mission-domain.md`
- `docs/product/quick-mission-flow.md`

---

## 1. Purpose

This document defines the **MANAGED Mission** flow in RELAIS.

A MANAGED Mission is appropriate when the Customer's request requires more structure before RELAIS can responsibly accept it.

The MANAGED flow exists to provide:

- clarity;
- scope definition;
- pricing transparency;
- operational review;
- Customer agreement;
- historical integrity;
- accountability for longer or more complex work.

The MANAGED workflow must add only the structure that real operational complexity requires.

---

# 2. Core Principle

> **A MANAGED Mission is structured before RELAIS accepts responsibility for it.**

The Customer should not be required to structure the Mission themselves.

The Relais transforms the natural Conversation into a proposal that RELAIS can responsibly stand behind.

---

# 3. Customer Does Not Choose MANAGED

The Customer does not choose between:

- QUICK;
- MANAGED.

The Relais determines that the request requires MANAGED handling after understanding the situation.

The Customer experience remains:

```text
Connect
→ Explain naturally
→ Relais evaluates
→ Receive proposal
→ Accept or reject
```

---

# 4. When MANAGED Is Appropriate

MANAGED may be appropriate when the request involves one or more of:

- multiple steps;
- multiple days;
- unclear requirements;
- external institutions;
- significant Customer funds;
- substantial third-party expenses;
- authorization requirements;
- important documents;
- multiple stakeholders;
- elevated operational risk;
- uncertain completion conditions;
- formal evidence requirements;
- supervisor review;
- ongoing follow-up.

These are examples, not permanent hardcoded rules.

Operations may evolve the exact acceptance criteria.

---

# 5. MANAGED Selection

After Conversation, the Relais may select:

> **MANAGED**

This means:

- the Customer's need is sufficiently understood to begin formal assessment;
- a QUICK Offer would not provide enough structure;
- RELAIS requires a written proposal before accepted responsibility begins.

Selecting MANAGED does not itself create a Mission.

---

# 6. Assessment Before Proposal

The Relais structures the request into a draft assessment.

The assessment exists to answer:

- What does the Customer want RELAIS to achieve?
- What is included?
- What is not included?
- What does RELAIS need from the Customer?
- What external costs may exist?
- How long may the process take?
- What evidence will demonstrate progress or completion?
- What risks or uncertainties exist?
- What should RELAIS charge?

---

# 7. The Assessment Is Internal Work

The Customer does not need to complete an assessment form.

The Relais creates the structure from the Conversation.

The system should reuse known information whenever possible.

The Relais should enter only what is required to make the proposal clear and executable.

---

# 8. Minimum MANAGED Proposal Content

A MANAGED proposal should normally include:

- Mission summary;
- objective;
- scope;
- important exclusions;
- estimated duration;
- RELAIS fee;
- treatment of external expenses;
- major Customer responsibilities;
- assigned Relais;
- any material conditions.

Additional information may be required operationally depending on the Mission.

---

# 9. Proposal Language

The proposal should use plain Customer-facing language.

It should not expose unnecessary internal terminology.

The Customer should be able to understand:

> What will RELAIS do?

> What will it cost?

> What is not included?

> How long might it take?

> What happens next?

---

# 10. Proposal Is Not the Mission

Before Customer acceptance:

```text
Connection
    ↓
Conversation
    ↓
MANAGED assessment
    ↓
Proposal
```

No Mission yet exists.

The proposal represents:

> **RELAIS is willing to accept responsibility under these terms if the Customer agrees.**

---

# 11. Proposal Is a Structured Business Record

The proposal must remain separate from ordinary Conversation messages.

It may be displayed conversationally.

The underlying record should eventually preserve:

- originating Connection;
- Customer;
- Relais;
- proposal version;
- scope;
- price;
- currency;
- duration estimate;
- exclusions;
- Customer obligations;
- external-cost semantics;
- created time;
- status;
- acceptance/rejection metadata.

---

# 12. Proposal Versioning

MANAGED proposals must be versioned.

Example:

```text
Proposal v1
40 000 FCFA
2–6 weeks
```

Later:

```text
Proposal v2
50 000 FCFA
3–8 weeks
```

Proposal v2 does not overwrite v1.

Both remain historically preserved.

---

# 13. Why Versioning Is Required

MANAGED Missions are more likely to change during discussion.

Without versioning, RELAIS could not later answer:

- what the Customer first received;
- what changed;
- which version was accepted;
- what price applied;
- what scope applied.

Therefore:

> **Accepted commercial history must never depend on mutable fields.**

---

# 14. One Current Proposal

A Connection may have several historical proposal versions.

V1 should have at most one proposal version currently available for Customer acceptance.

Creating a new proposal version supersedes the previous pending version.

---

# 15. Superseded Proposal

A superseded proposal remains historical.

It cannot later be accepted.

If the Customer attempts to accept an old version, the system must reject that action and display the current proposal state.

---

# 16. Proposal Draft

A proposal may conceptually begin as:

```text
DRAFT
```

while the Relais is preparing it.

A draft is internal.

The Customer should not see an incomplete proposal unless RELAIS explicitly sends it.

---

# 17. Proposal Review

Some MANAGED proposals may require internal review before being sent.

Examples:

- elevated financial exposure;
- unusual request;
- high operational risk;
- unclear legal authority;
- supervisor threshold exceeded.

The Mission Acceptance Policy remains authoritative.

MANAGED does not automatically mean supervisor approval.

---

# 18. Review Status

Conceptually, a proposal may pass through:

```text
DRAFT
→ REVIEW_REQUIRED
→ APPROVED_TO_SEND
→ SENT
```

for Missions that need review.

Simpler MANAGED requests may go directly:

```text
DRAFT
→ SENT
```

Exact persisted status names are deferred.

---

# 19. Review Is Not Customer Acceptance

Internal approval means:

> RELAIS authorizes this proposal to be offered.

Customer acceptance means:

> the Customer agrees to the proposal.

These are distinct events.

---

# 20. Proposal Sent

Once sent, the Customer may see something like:

> **Votre Relais vous a envoyé une proposition.**

Then:

- Mission summary;
- estimated duration;
- RELAIS fee;
- important scope;
- external expenses;
- actions.

Actions:

> **Accepter**

> **Refuser**

The Customer may also continue the Conversation before deciding.

---

# 21. Customer Questions

The Customer may ask questions before acceptance.

Example:

> “Les frais SONABEL sont-ils compris ?”

The proposal remains pending.

Conversation does not automatically modify the proposal.

If the answer materially changes scope or price, a revised proposal version should be created.

---

# 22. Customer Acceptance

The Customer accepts through a structured action.

Casual messages such as:

> “Ça marche.”

> “D'accord.”

> “Commencez.”

do not replace formal acceptance where the product requires structured acceptance.

---

# 23. Acceptance Targets One Version

Customer acceptance must identify the exact proposal version being accepted.

The system must know:

- which scope;
- which price;
- which exclusions;
- which duration estimate;
- which conditions.

Acceptance cannot point vaguely at “the latest proposal” after the fact.

---

# 24. Mission Creation

For V1:

> **A MANAGED Mission is created only after a valid proposal version is explicitly accepted by the Customer.**

Conceptually:

```text
Proposal
    ↓
Customer accepts
    ↓
Mission created
```

The Mission references the accepted proposal version.

---

# 25. Why Mission Creation Happens on Acceptance

Before acceptance:

- RELAIS has proposed work;
- Customer may still reject;
- scope may still change.

After acceptance:

- both parties have reached agreement;
- RELAIS has accepted responsibility subject to any defined execution prerequisites.

This preserves:

> **Mission = accepted responsibility.**

---

# 26. Mission Inherits Accepted Commercial Basis

The new Mission should derive its contractual basis from the accepted proposal version.

This may include:

- Mission objective;
- scope;
- exclusions;
- Relais fee;
- estimated duration;
- external-cost rules;
- Customer obligations;
- evidence expectations.

The accepted proposal remains historical and immutable as the commercial basis.

---

# 27. Accepted Proposal Must Not Become Mutable Mission Fields Only

The Mission may copy selected values for operational convenience.

That copied current state must not replace the accepted proposal as historical truth.

The system must always be able to identify:

> **This is the proposal the Customer accepted.**

---

# 28. Payment Timing

Customer acceptance and payment are separate events.

Conceptually:

```text
Proposal accepted
→ Mission created
→ Payment required
→ Payment confirmed
→ Execution begins
```

where prepayment policy applies.

Ticket 0I will define financial semantics.

---

# 29. No Execution Before Required Payment

If RELAIS requires payment before work begins, the Mission must not enter chargeable execution before the required payment condition is satisfied.

A Mission may exist while waiting for payment.

That does not mean execution has started.

---

# 30. External Mission Budget

Some MANAGED Missions require Customer funds for external expenses.

Example:

```text
RELAIS coordination fee
+
SONABEL fees
+
ONEA fees
+
transport or third-party expenses
```

The proposal should distinguish:

- RELAIS fee;
- known external expenses;
- estimated external expenses;
- expenses requiring later Customer approval.

---

# 31. Unknown External Expenses

MANAGED Missions often begin before all external costs are known.

The proposal may state:

> External costs will be communicated for Customer approval before payment.

This is valid.

RELAIS must not fabricate certainty where third-party pricing is unknown.

---

# 32. Customer Spending Authorization

The Mission must preserve the principle that RELAIS cannot materially spend Customer funds beyond authorized terms.

Future implementation may support:

- expense requests;
- approval thresholds;
- separate Mission budgets;
- milestone funding.

Ticket 0I owns exact mechanics.

---

# 33. Estimated Duration

A MANAGED proposal may include an estimated duration.

Example:

> 2–6 weeks.

This is an estimate.

It is not a guarantee unless RELAIS explicitly says otherwise.

The original estimate must remain historical even if reality later differs.

---

# 34. External Delays

MANAGED Missions often depend on organizations RELAIS does not control.

The proposal should clearly distinguish:

- RELAIS response commitments;
- estimated external timelines;
- delays outside RELAIS control.

This protects clarity without avoiding accountability.

---

# 35. Customer Responsibilities

Some Missions require Customer participation.

Examples:

- provide identification;
- sign authorization;
- send funds;
- approve an expense;
- provide property documents;
- answer clarification questions.

Important Customer dependencies should be included in the proposal.

---

# 36. Waiting on Customer

After Mission creation, execution may pause because RELAIS is waiting for the Customer.

This is not automatically:

- failure;
- cancellation;
- Relais delay.

Mission Updates and later lifecycle design should preserve this distinction.

---

# 37. Waiting on Third Party

A Mission may also pause because RELAIS is waiting for:

- an administration;
- merchant;
- technician;
- beneficiary;
- other external participant.

Again, this should be reflected through operational updates rather than dozens of universal Mission statuses.

---

# 38. Scope

MANAGED scope should be explicit enough that both Customer and RELAIS understand the responsibility.

Example:

> Coordinate SONABEL and ONEA connection procedures.

Scope does not need to predict every individual phone call or visit.

It should define the agreed outcome and important boundaries.

---

# 39. Exclusions

Material exclusions should be clear.

Example:

The RELAIS proposal may exclude:

- official utility fees;
- infrastructure work;
- third-party professional services;
- delays controlled entirely by external institutions.

Exclusions prevent expectation mismatch.

---

# 40. Scope Change After Acceptance

After a MANAGED Mission exists, material changes must not silently modify the accepted proposal.

A material change may require:

- formal change review;
- revised commercial agreement;
- additional Customer acceptance.

The exact future mechanism may be:

- Mission amendment;
- change proposal;
- supplemental proposal.

V1 may implement the smallest safe version.

---

# 41. Do Not Rewrite the Original Proposal

If a Mission changes after acceptance, the original accepted proposal remains untouched.

Historical truth should show:

```text
Original agreement
    ↓
Later change
    ↓
Updated agreement
```

not:

```text
Original agreement silently changed
```

---

# 42. MANAGED to QUICK Before Proposal

If deeper assessment shows the request is actually simple:

```text
MANAGED considered
→ QUICK selected
```

before a proposal is sent, the Connection may proceed through QUICK.

No fake MANAGED history is required merely because the Relais briefly considered it.

---

# 43. MANAGED to QUICK After Proposal Sent

Once a MANAGED proposal has been sent, simplification should be treated deliberately.

The pending proposal may be:

- withdrawn;
- superseded;
- replaced with a QUICK Offer if operationally appropriate.

Historical proposal remains.

---

# 44. Customer Rejection

The Customer may reject the MANAGED proposal.

No Mission is created.

The Connection may:

- continue discussion;
- receive a revised proposal;
- end as declined by Customer.

Rejection is a legitimate commercial outcome.

---

# 45. Customer Abandonment

If the Customer stops responding while a proposal remains pending:

- no Mission exists;
- proposal remains historical;
- Connection may eventually become abandoned according to policy.

RELAIS must not count abandoned proposals as accepted Missions.

---

# 46. Proposal Cancellation by RELAIS

RELAIS may withdraw a proposal before Customer acceptance.

Reasons may include:

- new safety concern;
- discovered impossibility;
- mistaken pricing;
- resource loss;
- policy violation;
- administrative correction.

Withdrawal must remain historical.

---

# 47. Race Between Acceptance and Withdrawal

A Customer may accept while RELAIS is attempting to withdraw or supersede the proposal.

The system must choose one authoritative outcome transactionally.

It must never create a Mission from a proposal that had already become invalid before valid acceptance.

---

# 48. Idempotent Acceptance

Repeated Customer acceptance requests must create at most one Mission.

A poor network must not create duplicate MANAGED Missions.

---

# 49. Reassignment During Assessment

If the Connection is reassigned before a proposal is sent:

- assessment may continue;
- new Relais should receive authorized Conversation context;
- draft ownership may transfer;
- assignment history remains preserved.

Exact draft-transfer mechanics are implementation concerns.

---

# 50. Reassignment With Pending Proposal

If a proposal has already been sent and the Customer-facing Relais changes, the proposal should not automatically disappear.

However, Operations must ensure the new Relais can honor the existing proposal.

Default principle:

> **A sent proposal belongs to RELAIS, not merely to the individual employee, but reassignment must trigger operational review where necessary.**

This is an important difference from an informal freelancer marketplace.

---

# 51. Reassignment After Mission Creation

Once the proposal has been accepted and Mission created:

- Mission reassignment follows Mission ownership rules;
- accepted proposal remains unchanged;
- Customer relationship continuity should be preserved.

---

# 52. RELAIS Owns the Commitment

The Customer is contracting with RELAIS.

The assigned Relais is the Customer's human representative.

Therefore, a Relais leaving a Mission does not automatically void RELAIS's commitment.

Operations must:

- reassign;
- communicate;
- preserve continuity;
- escalate if RELAIS can no longer fulfill the Mission.

---

# 53. Mission Proposal Presentation

The digital proposal should feel professional without becoming bureaucratic.

It may eventually display:

```text
Mission
Assigned Relais
Objective
Included
Not included
Estimated duration
RELAIS fee
External costs
Customer requirements
```

Then:

> **Accepter la mission**

> **Refuser**

The product should optimize comprehension over legalistic density.

---

# 54. PDF Is Not Required for Every MANAGED Mission

The digital proposal is the authoritative product interaction.

A PDF may be:

- generated when useful;
- downloaded;
- shared externally;
- required for certain high-value Missions.

The workflow must not depend on manually producing PDFs.

---

# 55. Signature

A digital structured acceptance may serve as the Customer's product acceptance where legally and operationally sufficient.

Some Missions may later require:

- additional signature;
- authorization letter;
- identity document;
- external legal document.

These are Mission-specific requirements.

The product should not require handwritten signature for every MANAGED Mission by default.

---

# 56. Proposal Evidence vs Execution Evidence

Proposal attachments may explain what is being proposed.

Mission evidence demonstrates what was later done.

These are different concepts and should not be conflated.

---

# 57. Mission Activation

Mission creation and Mission execution readiness may differ.

Conceptually:

```text
Mission created
    ↓
execution prerequisites pending
    ↓
ready for execution
```

Prerequisites may include:

- payment;
- Customer document;
- authorization;
- external budget;
- supervisor condition.

The exact lifecycle representation is deferred until payment and Mission-update tickets are complete.

---

# 58. Do Not Encode Every Prerequisite as Mission Status

A Mission could be waiting on:

- payment;
- Customer;
- government office;
- document;
- internal approval.

Creating a universal enum for every combination will become brittle.

Prefer:

- broad Mission lifecycle;
- explicit prerequisite records or domain state where necessary;
- Mission Updates for operational context.

---

# 59. Completion

MANAGED completion means RELAIS believes the agreed outcome has reached its defined endpoint.

The endpoint may be:

- desired result achieved;
- agreed coordination process completed;
- documented external impossibility reached according to scope.

Completion semantics belong to Ticket 0J.

---

# 60. Outcome Does Not Always Mean External Success

Consider:

> Coordinate a government application process.

RELAIS may successfully fulfill its contractual Mission even if the administration ultimately denies the Customer's request, provided the agreed Mission was coordination rather than guaranteed approval.

Therefore:

> **RELAIS Mission success must be measured against the agreed scope, not an external outcome RELAIS never controlled.**

This distinction should be made clear in proposals.

---

# 61. Example — SONABEL & ONEA

Customer:

> “I want SONABEL and ONEA connected to my home.”

Conversation occurs.

Relais selects:

```text
MANAGED
```

Assessment produces:

```text
Objective:
Coordinate required SONABEL and ONEA procedures.

Estimated duration:
2–6 weeks.

RELAIS fee:
40 000 FCFA.

Official fees:
Separate, Customer-approved.

Important exclusions:
Technical work and third-party administrative delays.
```

Proposal is sent.

Customer accepts.

Mission is created.

Payment and required documents are collected.

Execution begins.

This is the canonical example of a MANAGED flow.

---

# 62. Example — Information Investigation

Customer:

> “I need someone to understand what is happening with my land file.”

This may be MANAGED even if the active work lasts only a day.

Why?

Because the Mission may require:

- investigation;
- multiple contacts;
- unclear scope;
- formal report.

Therefore:

> MANAGED is about required structure, not merely calendar duration.

---

# 63. MANAGED Pricing

MANAGED pricing may reflect:

- coordination effort;
- time responsibility;
- number of expected interactions;
- risk;
- required follow-up;
- expertise;
- operational overhead.

MANAGED does not require hourly billing.

RELAIS sells responsibility for an agreed scope.

---

# 64. MANAGED Is Not “Expensive”

A MANAGED Mission may occasionally have a modest fee.

The classification exists for workflow depth, not prestige or price.

---

# 65. MANAGED Is Not “Slow”

The assessment and proposal flow should still be efficient.

A MANAGED Mission might be qualified and proposed within minutes when requirements are clear.

The purpose is adequate structure, not delay.

---

# 66. Structured Events in Conversation

The Conversation timeline may display events such as:

```text
Mamadou prépare votre mission.
```

```text
Nouvelle proposition reçue.
```

```text
Proposition acceptée.
```

```text
Paiement requis.
```

```text
Mission en cours.
```

These are rendered conversationally but remain authoritative domain records.

---

# 67. MANAGED Metrics

The system should eventually support deriving:

- MANAGED proposals created;
- average time from Connection to proposal;
- proposal approval rate;
- proposal revision rate;
- Customer acceptance rate;
- rejection rate;
- average Relais fee;
- average estimated duration;
- actual completion duration;
- payment delay;
- cancellation rate;
- failure rate;
- Mission outcome rate.

Metrics should come from operational history.

---

# 68. MANAGED Non-Goals

V1 does not require:

- AI-generated proposals;
- automatic Mission planning;
- dynamic legal contracts;
- complex project-management subtasks;
- Gantt charts;
- bidding;
- automated pricing;
- automatic third-party integrations;
- mandatory handwritten signatures;
- dozens of proposal templates.

---

# 69. Core Invariants

The eventual implementation must preserve at least these invariants:

1. The Relais chooses MANAGED, not the Customer.

2. Selecting MANAGED does not create a Mission.

3. A proposal exists before MANAGED Mission creation.

4. A proposal may exist without a Mission.

5. Customer acceptance is explicit and structured.

6. Casual Conversation does not count as formal proposal acceptance.

7. A MANAGED Mission is created only from a valid accepted proposal version.

8. Proposal versions are never silently overwritten.

9. Superseded or withdrawn proposals cannot be accepted.

10. Acceptance must identify the exact proposal version.

11. Repeated acceptance requests cannot create duplicate Missions.

12. Accepted proposal history remains immutable.

13. Mission creation and payment confirmation are separate events.

14. Required execution prerequisites must be satisfied before execution.

15. External Customer funds are distinct from RELAIS fees.

16. Estimated duration is not silently replaced by actual duration.

17. Material post-acceptance scope changes preserve the original agreement.

18. Reassignment does not erase the original Relais history or accepted proposal.

19. A sent proposal represents RELAIS's offer, not merely the individual Relais's personal promise.

20. MANAGED remains subject to Mission Acceptance Policy and operational review.

---

# 70. Conceptual Flow

```text
Customer
    ↓
Connection
    ↓
Matched Relais
    ↓
Conversation
    ↓
Relais determines more structure is needed
    ↓
MANAGED
    ↓
Assessment / Draft
    ↓
Internal review if required
    ↓
Proposal v1
    ↓
Customer review
       │
       ├───────────────┐
       │               │
    Refuse          Discuss
       │               │
       ↓               ↓
No Mission      Revised proposal v2
                       │
                       ↓
                    Accept
                       ↓
                  Mission created
                       ↓
              Execution prerequisites
                       ↓
                  Payment / docs /
                 authorization / funds
                       ↓
                    Execution
                       ↓
                     Updates
                       ↓
                   Completion
                       ↓
                     Rating
```

---

# 71. Foundational MANAGED Test

For every MANAGED flow, RELAIS should eventually be able to answer:

1. Which Connection produced the proposal?
2. Which Relais structured the request?
3. Why was MANAGED chosen?
4. What did RELAIS propose to do?
5. What was explicitly excluded?
6. What fee was proposed?
7. What external costs were known or unknown?
8. Were there earlier proposal versions?
9. Which exact version did the Customer accept?
10. Was exactly one Mission created from that acceptance?
11. What execution prerequisites remained?
12. What changed after acceptance, if anything?
13. Can we distinguish RELAIS's agreed responsibility from external outcomes it did not guarantee?
14. Can the complete commercial and operational history be reconstructed without guessing?

If not, the MANAGED flow is incomplete.

---

# 72. Customer Experience Test

The Customer should feel:

> **I explained a complicated situation to one person.**

↓

> **My Relais organized it for me.**

↓

> **Now I can clearly see what RELAIS proposes to handle.**

↓

> **I agreed.**

↓

> **RELAIS took responsibility from there.**

The Customer should not feel like they were asked to become a project manager.

---

# 73. Relais Experience Test

The Relais should feel:

> **I understand the Customer's problem.**

↓

> **This needs more structure than QUICK.**

↓

> **I organize the important facts.**

↓

> **RELAIS sends a clear proposal.**

↓

> **Once accepted, I manage execution.**

The system should help the Relais think clearly without forcing excessive paperwork.

---

# 74. Foundational Principle

> **MANAGED exists because some problems deserve structure before they deserve commitment.**

The structure protects the Customer, the Relais, and RELAIS itself while preserving the human simplicity of the original Connection.
