# RELAIS Mission Domain

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/relais-availability-and-matching.md`
- `docs/product/conversation-domain.md`

---

## 1. Purpose

This document defines the **Mission** domain in RELAIS.

A Mission represents work that RELAIS has formally agreed to take responsibility for.

A Mission is not merely:

- a Customer request;
- a Conversation;
- a proposed task;
- an idea being discussed.

A Mission exists only after RELAIS has reached the point where the requested work is sufficiently understood and accepted according to the applicable workflow.

---

# 2. Core Definition

A Mission is the durable record of a real-world outcome that RELAIS has agreed to coordinate, perform, or manage on behalf of a Customer.

A Mission may be:

- very small;
- very fast;
- multi-step;
- multi-day;
- administrative;
- physical;
- informational;
- coordination-heavy.

What makes it a Mission is not complexity.

What makes it a Mission is **accepted responsibility**.

---

# 3. Mission vs Connection

A Connection records:

> **The Customer asked RELAIS for someone.**

A Mission records:

> **RELAIS accepted responsibility for doing something.**

Therefore:

```text
Connection
    ↓
Conversation
    ↓
Understanding
    ↓
Agreement
    ↓
Mission
```

Not every Connection creates a Mission.

Every Mission must originate from a legitimate operational context.

V1 assumes that context is a Connection.

---

# 4. Foundational Boundary

The Mission is created at the transition from:

```text
Potential work
```

to:

```text
Accepted responsibility
```

This boundary matters because RELAIS must be able to distinguish:

- demand;
- discussion;
- pricing;
- rejected work;
- accepted work.

Mission metrics must never include requests that RELAIS never actually agreed to perform.

---

# 5. Mission Depth

Every Mission has an operational depth.

V1 recognizes:

```text
QUICK
MANAGED
```

This distinction exists because simple errands should not be forced through the same process as complex coordination work.

---

# 6. QUICK Mission

A QUICK Mission is appropriate when the Relais can understand and accept the request with minimal additional structure.

Typical characteristics may include:

- low ambiguity;
- limited duration;
- straightforward execution;
- limited financial exposure;
- limited operational risk;
- no need for a formal multi-field proposal.

The exact characteristics may evolve operationally.

QUICK is not synonymous with:

- cheap;
- physical;
- delivery;
- one hour;
- easy in every circumstance.

It means:

> **The request can safely proceed through RELAIS's minimal acceptance workflow.**

---

# 7. MANAGED Mission

A MANAGED Mission requires additional structure before RELAIS accepts full responsibility.

This may be because of:

- complexity;
- duration;
- uncertainty;
- multiple stakeholders;
- external institutions;
- financial exposure;
- documentation requirements;
- proof requirements;
- elevated risk;
- customer expectations requiring a formal scope.

MANAGED does not mean problematic.

It means the Mission deserves a more explicit operating plan.

---

# 8. Mission Depth Is Chosen Internally

The Customer does not need to decide:

> QUICK or MANAGED?

The Relais determines the appropriate depth after understanding the request.

This preserves customer simplicity.

The Relais is responsible for selecting the workflow that matches operational reality.

---

# 9. Mission Depth Must Not Rewrite History

If a request begins as QUICK but later proves to require more structure, RELAIS must preserve what happened.

The system should support a controlled transition or escalation rather than pretending the Mission was always MANAGED.

Exact transition mechanics are deferred to later workflow documents.

---

# 10. Mission Identity

Every Mission must have a stable unique identity.

A Mission should eventually preserve:

- unique identifier;
- Customer;
- originating Connection;
- current Customer-facing Relais;
- operational depth;
- urgency;
- lifecycle state;
- creation timestamp;
- completion or terminal timestamp when applicable.

Human-readable Mission references may be added if operationally useful.

---

# 11. Mission Belongs to One Customer

Every Mission belongs to exactly one Customer relationship in V1.

A Mission may benefit another person.

Example:

Cheick requests:

> “Aide ma mère à récupérer un document.”

Cheick remains the Customer.

His mother may be the beneficiary.

Customer and beneficiary are therefore distinct concepts.

---

# 12. Beneficiary

A Mission may optionally identify a beneficiary.

The beneficiary is the person, household, business, or third party primarily benefiting from the Mission.

Examples:

- the Customer themselves;
- a parent;
- a child;
- an employee;
- a business;
- another authorized person.

V1 should support this concept without forcing every Mission to have a separate beneficiary record.

Exact modeling is deferred.

---

# 13. Mission Objective

Every Mission must have an understandable operational objective.

For a MANAGED Mission, this objective will usually be explicitly written.

For a QUICK Mission, the originating Conversation may contain most of the detail.

The system must not require unnecessary duplicate entry.

However, RELAIS should still be able to understand what the Mission represented later.

---

# 14. Mission Summary

A Mission may have a concise internal/customer-visible summary.

Examples:

> Livrer un colis à Karpala.

> Vérifier si l'administration est ouverte aujourd'hui.

> Coordonner les démarches SONABEL et ONEA.

For QUICK, the system may generate or permit a minimal summary.

For MANAGED, the summary may come from the proposal.

The exact requirement is workflow-specific.

---

# 15. Mission Category

A Mission may be internally categorized for:

- operations;
- routing;
- analytics;
- pricing knowledge;
- future specialization.

The Customer does not need to choose this category.

Categories are operational configuration, not constitutional product structure.

A Mission must remain valid even if categories evolve later.

---

# 16. Category History

If Mission category changes because RELAIS corrected an operational classification, the system should preserve enough history to explain material changes when necessary.

Category should not become a fragile source of truth for the Mission's actual meaning.

The Mission objective and history remain primary.

---

# 17. Urgency

Urgency and Mission depth are separate.

Conceptually, V1 supports:

```text
NORMAL
URGENT
```

All V1 Customer-created Missions default to `NORMAL` unless internal operations deliberately changes urgency.

Customer-facing urgency selection is deferred.

This allows the domain to support future priority handling without exposing unfinished functionality.

---

# 18. Urgency Does Not Guarantee Feasibility

Marking a Mission urgent must never imply:

- guaranteed immediate execution;
- bypassed safety review;
- bypassed legal review;
- impossible deadlines becoming possible.

Urgency affects prioritization.

It does not override reality.

---

# 19. Mission Ownership

Every active Mission needs clear responsibility.

At minimum:

### Customer-facing Relais

The person responsible for the Customer relationship.

### Operational Owner

The person or authority accountable for the Mission progressing properly.

V1 may commonly use the same Relais for both.

The architecture must not assume they can never differ.

---

# 20. Mission Assignment History

If Mission responsibility changes:

```text
Mamadou
    ↓
Aïcha
```

the system must preserve:

- previous assignment;
- new assignment;
- timing;
- reason where required;
- privileged actor responsible for the reassignment where applicable.

Current ownership must never erase historical ownership.

---

# 21. Field Execution

The Customer-facing Relais does not have to personally perform every physical action.

A Mission may be executed by:

- the Relais;
- an internal field person;
- a vetted external operational participant;
- multiple people over time.

V1 does not require Field Executor application accounts.

The Mission domain must nevertheless not equate:

```text
Relais
=
physical executor
```

---

# 22. Mission Lifecycle

The Mission lifecycle should remain general enough to support both:

- a 20-minute errand;
- a six-week administrative process.

A conceptual V1 lifecycle is:

```text
ACTIVE
    ↓
COMPLETION_PENDING
    ↓
COMPLETED
```

with terminal alternatives such as:

```text
CANCELLED
FAILED
```

The exact persisted state model will be finalized after QUICK and MANAGED workflows are defined.

We should avoid prematurely creating dozens of statuses.

---

# 23. Why the Mission Lifecycle Must Stay Small

A package delivery might involve:

```text
picked up
→ en route
→ delivered
```

A SONABEL Mission might involve:

```text
documents collected
→ first visit
→ inspection pending
→ payment requested
→ second visit
→ waiting on administration
```

Those steps cannot share one universal status enum without becoming meaningless.

Therefore:

> **Mission state describes the broad contractual lifecycle. Mission Updates describe real-world progress.**

---

# 24. Mission Updates Carry Operational Detail

The Mission tracker should rely primarily on chronological Mission Updates.

Examples:

> Dossier ONEA déposé.

> Le destinataire a reçu les clés.

> Administration confirmée ouverte jusqu'à 15h30.

> Inspection SONABEL prévue lundi.

This allows different kinds of Mission to share one architecture.

---

# 25. Mission Status Must Not Be Derived From Chat

A message such as:

> “C'est fait.”

does not automatically mark the Mission completed.

Formal Mission state changes require structured operations.

Conversation provides context.

Mission state provides authoritative operational truth.

---

# 26. Customer Agreement

A Mission cannot become accepted responsibility without whatever Customer agreement the applicable workflow requires.

For QUICK, agreement may be:

```text
QUICK offer
→ Customer accepts
```

For MANAGED:

```text
Proposal
→ Customer accepts
```

The exact creation timing will be finalized in Tickets 0G and 0H.

---

# 27. Formal Acceptance Must Be Structured

RELAIS must not infer contractual acceptance from casual chat such as:

> “Okay.”

> “Oui.”

> “D'accord.”

When formal acceptance is required, the Customer uses the structured acceptance action.

This protects both parties.

---

# 28. Mission Price

A Mission may have RELAIS service pricing associated with it.

The Mission domain must distinguish:

- RELAIS compensation;
- external costs;
- Customer-provided execution budget.

These are financially different concepts.

Exact payment modeling belongs to Ticket 0I.

---

# 29. Mission Expenses Are Not Revenue

If a Customer provides money to buy something or pay an external institution, those funds do not automatically become RELAIS revenue.

Example:

```text
RELAIS fee:           9 000 FCFA
Purchase budget:     50 000 FCFA
```

RELAIS revenue is not automatically:

```text
59 000 FCFA
```

The domain must preserve this distinction.

---

# 30. No Unapproved Spending

RELAIS must not materially exceed approved Customer financial authorization without a defined approval process.

This applies especially to MANAGED Missions.

Exact expense authorization rules are deferred.

---

# 31. Scope

Every Mission has an agreed scope, even if lightweight.

For QUICK, scope may largely be preserved in Conversation context plus the structured offer.

For MANAGED, scope should be explicit.

A significant Customer request beyond the agreed scope requires:

- review;
- possible repricing;
- renewed agreement when necessary.

---

# 32. Scope Creep

Mission execution must not silently expand simply because a Customer asks:

> “Pendant que tu y es…”

Small incidental adjustments may be operationally acceptable.

Material changes require structured handling.

Exact rules belong to workflow and operations policy.

---

# 33. Mission Evidence

A Mission may require evidence.

Examples:

- photo;
- receipt;
- document;
- signature;
- confirmation;
- other proof.

Evidence requirements depend on operational reality.

Not every QUICK Mission requires formal proof.

Not every MANAGED Mission requires the same evidence.

---

# 34. Evidence Belongs to Mission History

Evidence attached to a Mission must remain attributable to:

- the Mission;
- uploader;
- time;
- appropriate visibility.

Customer-visible evidence and internal-only evidence may differ.

---

# 35. Customer Visibility

A Customer may view only Mission information intended for them.

This may include:

- summary;
- price;
- status;
- Customer-visible Updates;
- approved evidence;
- payment requirements;
- completion result;
- assigned Relais.

Internal operational notes remain hidden.

---

# 36. Relais Visibility

An authorized assigned Relais may access the Mission details necessary to coordinate work.

Relais access remains assignment-scoped.

Holding the role does not grant access to all Missions.

---

# 37. Admin Visibility

Authorized Admins may access Missions for legitimate operational purposes.

Administrative access does not permit silent historical rewriting.

Privileged changes remain auditable.

---

# 38. Mission Updates

Mission Updates are durable records of meaningful progress.

A Mission Update may contain:

- text;
- time;
- actor;
- attachments;
- visibility;
- operational significance.

Exact update modeling belongs to Ticket 0J.

---

# 39. Internal vs Customer-Visible Updates

Not every operational update belongs in the Customer tracker.

The domain should support a distinction between:

```text
CUSTOMER_VISIBLE
INTERNAL
```

or equivalent semantics.

Internal staff must not accidentally expose sensitive operational notes.

---

# 40. Completion

Completion means RELAIS believes the agreed Mission objective has been fulfilled.

For some Missions, the Customer may explicitly confirm completion.

For others, completion may be objectively demonstrated.

The exact completion flow belongs to Ticket 0J.

---

# 41. Completion Is Not Closure

Mission completion and administrative closure are conceptually different.

A Mission may be operationally complete while:

- financial reconciliation remains;
- refund remains;
- Customer dispute remains;
- incident review remains.

The domain must not assume every completed Mission can instantly disappear from operational attention.

---

# 42. Cancellation

A Mission may be cancelled after creation.

Cancellation may be initiated by:

- Customer;
- Relais through Operations;
- Admin;
- operational impossibility.

Cancellation rules may depend on:

- execution already performed;
- money already spent;
- non-refundable external fees;
- safety issues.

Exact rules are deferred.

Cancellation must remain historical.

---

# 43. Failure

A Mission may end unsuccessfully without being merely cancelled.

Examples:

- objective proved impossible after execution began;
- external institution refused the process;
- required third party never cooperated;
- unavoidable event made completion impossible.

Failure should not automatically imply employee fault.

Operational outcome and accountability review are distinct.

---

# 44. Failed Mission History

A failed Mission remains a Mission.

RELAIS had accepted responsibility and attempted execution.

It should never be retroactively converted into:

> “No Mission existed.”

This distinction is important for:

- analytics;
- refunds;
- quality review;
- Customer trust;
- organizational learning.

---

# 45. Mission Outcome

A Mission should eventually preserve a clear terminal outcome.

Conceptually:

```text
COMPLETED
CANCELLED
FAILED
```

Exact names remain open until workflow design is complete.

The important requirement is that terminal outcomes are explicit and historically durable.

---

# 46. Mission Reopening

V1 should not casually allow completed Missions to be reopened.

If a genuine correction or unresolved issue emerges, the system should preserve:

- original completion;
- later dispute or follow-up;
- subsequent authorized action.

Reopening must not erase the fact that completion was previously recorded.

---

# 47. Separate New Need

If a completed Mission gives rise to an unrelated new request, a new Connection should normally begin.

Do not keep attaching unrelated work to an old Mission for convenience.

This preserves clean history.

---

# 48. Mission and Incidents

Incidents may reference a Mission.

Examples:

- lost property;
- suspected fraud;
- Customer dispute;
- field safety concern;
- financial discrepancy.

Mission completion must not automatically erase or close incidents.

---

# 49. Mission and Conversation

The originating Conversation remains available after Mission creation.

Customer communication should continue through the established human relationship.

Conceptually:

```text
Connection
    ├── Conversation
    └── Mission
```

The Conversation is not moved into or duplicated inside the Mission.

The Mission references its origin.

---

# 50. Mission Does Not Own the Conversation

This distinction matters because the Conversation began before the Mission existed.

Historical structure should remain:

```text
Connection
    ↓
Conversation
    ↓
Mission emerges
```

not:

```text
Mission magically owns prior messages
```

---

# 51. One Mission Per Connection in V1

V1 assumes a Connection results in:

```text
0..1 Mission
```

This is a deliberate simplification.

If real operations repeatedly show that one Customer conversation naturally creates several independent Missions, we may change the model later.

Do not model that possibility without evidence.

---

# 52. Mission Creation Must Be Idempotent

Customer acceptance, poor connectivity, or repeated requests must not accidentally create duplicate Missions.

One valid accepted offer/proposal should produce at most one intended Mission.

Exact implementation is deferred.

---

# 53. Historical Integrity

Mission history must preserve material facts.

At minimum:

- originating Connection;
- Customer;
- creation time;
- depth;
- urgency;
- assignment history;
- accepted price/proposal basis;
- payment history;
- Updates;
- evidence;
- cancellation/failure/completion;
- incidents;
- material administrative interventions.

Current state must not destroy historical truth.

---

# 54. Proposal History

If a MANAGED Mission is based on a proposal, accepted proposal details must remain preserved.

If pricing or scope later changes:

- previous proposal remains;
- revised proposal is separately recorded;
- Customer acceptance is attached to the appropriate version.

Silent overwriting is prohibited.

---

# 55. QUICK Offer History

The same principle applies to QUICK.

If Mamadou offers:

```text
2 000 FCFA
```

and later revises to:

```text
3 000 FCFA
```

the system must preserve what happened.

The accepted offer must be identifiable.

---

# 56. Operational Classification

A Mission may eventually include internal classifications such as:

- category;
- estimated duration;
- complexity;
- priority;
- review level.

These are operational metadata.

They must not replace the actual Mission history.

---

# 57. Complexity

Complexity may be useful for internal operations.

However, the earlier brainstormed labels:

- easy;
- medium;
- difficult;
- complex;

may be subjective.

A later ticket may prefer operational concepts such as:

- standard;
- review required;
- supervisor approval;
- unsupported.

The Mission domain intentionally does not lock that taxonomy yet.

---

# 58. Mission Duration

Estimated duration and actual duration are different.

The system should eventually be able to preserve both.

Estimated duration belongs to planning.

Actual duration can be derived from real Mission history when possible.

Do not overwrite the original estimate simply because reality differed.

---

# 59. Mission Time Is Not Continuous Labor

A Mission lasting three weeks does not imply three weeks of labor.

The domain should not equate:

```text
calendar duration
```

with:

```text
active work hours
```

This matters for pricing and analytics.

---

# 60. Mission Geographic Scope

A Mission may involve:

- one place;
- multiple places;
- no physical travel at all.

Do not require every Mission to have pickup and destination fields.

RELAIS is not fundamentally a delivery platform.

---

# 61. A Mission May Be Informational

Example:

> Confirm whether an administration is open today.

The result may be verified information.

No physical object moves.

The Mission is still valid because RELAIS acted on the Customer's behalf.

---

# 62. A Mission May Be Coordination-Only

Example:

> Arrange for a technician to inspect a property.

The Relais may coordinate rather than personally perform the specialist work.

The Mission remains a RELAIS Mission when RELAIS accepted responsibility for the coordination outcome.

---

# 63. Third Parties

Missions may involve third parties.

Examples:

- administration;
- merchant;
- family member;
- beneficiary;
- technician;
- recipient.

Third-party involvement does not automatically require application accounts.

V1 should avoid turning every person encountered into a User.

---

# 64. External Organizations

A Mission may involve organizations such as:

- SONABEL;
- ONEA;
- hospitals;
- government offices;
- businesses.

These organizations may eventually be represented structurally if useful.

V1 does not require a universal external-organization registry.

---

# 65. Mission Data Minimization

RELAIS should collect enough structured information to:

- execute;
- account;
- protect;
- learn.

It should not collect fields simply because they might theoretically be useful later.

Conversation can carry unstructured context.

Mission structure should capture operational truth.

---

# 66. Mission Search and Analytics

The Mission domain should eventually support:

- Customer Mission history;
- Relais workload;
- active Mission views;
- completion rates;
- cancellation rates;
- failure rates;
- average duration;
- QUICK vs MANAGED mix;
- revenue and cost analysis when joined to finance records.

Analytics should arise from operational truth.

---

# 67. Mission Non-Goals

V1 Mission does not require:

- customer-selected service categories;
- task marketplace bidding;
- route optimization;
- live GPS;
- AI planning;
- automatic pricing;
- field-agent mobile accounts;
- recurring Missions;
- subscription entitlements;
- team/customer organizations;
- multi-country regulatory abstractions;
- complex project-management dependencies;
- nested subtasks visible to Customers.

---

# 68. Core Invariants

The eventual implementation must preserve at least these invariants:

1. Every Mission belongs to exactly one Customer.

2. Every V1 Mission originates from exactly one Connection.

3. A Mission represents accepted responsibility, not merely discussion.

4. A Connection may exist without a Mission.

5. Mission depth is either QUICK or MANAGED in V1.

6. Mission depth and urgency are independent concepts.

7. V1 urgency defaults to normal unless deliberately changed by authorized operations.

8. Mission current assignment does not erase assignment history.

9. Relais and physical executor are not assumed to be the same person.

10. Mission lifecycle must remain broad enough for heterogeneous work.

11. Detailed progress belongs in Mission Updates rather than a giant universal status enum.

12. Formal acceptance is not inferred from casual chat.

13. Customer funds for external expenses are not automatically RELAIS revenue.

14. Failed and cancelled Missions remain historical Missions.

15. Completed Mission history is not silently rewritten.

16. One accepted QUICK offer or MANAGED proposal must not create duplicate Missions through retries.

17. The originating Conversation remains historically attached to its Connection.

18. Customer-visible and internal Mission information remain distinct.

---

# 69. Conceptual Model

Without committing to Prisma:

```text
Mission

identity
originating Connection
Customer
optional beneficiary

depth
    QUICK
    MANAGED

urgency
    NORMAL
    URGENT

objective / summary

operational classification
    category
    estimated duration
    review metadata

current Customer-facing Relais
operational ownership

assignment history

accepted commercial basis
    QUICK offer
    or
    MANAGED proposal

financial references

Mission Updates

evidence

incidents

lifecycle
terminal outcome

timestamps
audit-relevant history
```

---

# 70. Mission Creation Questions Still Open

Ticket 0F intentionally does **not** finalize several workflow-specific questions.

They belong to the next two tickets.

### Ticket 0G — QUICK Mission Flow

Must decide:

- whether the Mission is created before or after Customer QUICK acceptance;
- what minimum QUICK data is required;
- exact QUICK offer lifecycle;
- rejection and revised price behavior;
- whether payment is required before Mission activation.

### Ticket 0H — MANAGED Mission Flow

Must decide:

- relationship between draft scope, proposal, and Mission;
- proposal versioning;
- Customer acceptance;
- review requirements;
- when responsibility formally begins;
- what happens when a proposal is accepted but payment remains outstanding.

This separation is intentional.

---

# 71. Foundational Mission Test

For every Mission, RELAIS should eventually be able to answer:

1. Which Customer asked for it?
2. Which Connection did it come from?
3. What did RELAIS agree to take responsibility for?
4. Was it QUICK or MANAGED?
5. What urgency applied?
6. Who was the Customer's Relais when responsibility began?
7. Did that responsibility later change?
8. What commercial terms did the Customer accept?
9. What happened during execution?
10. What money belonged to RELAIS versus external Mission expenses?
11. What evidence was produced?
12. Did the Mission complete, fail, or get cancelled?
13. Can the full history be reconstructed without relying on employee memory?

If not, the Mission domain is incomplete.

---

# 72. Customer Experience Test

The Customer should not think:

> “I created a task object.”

The Customer should feel:

> **I explained what I needed.**

↓

> **My Relais understood it.**

↓

> **We agreed on what RELAIS will do.**

↓

> **RELAIS is now taking care of it.**

The Mission is the system's durable representation of that last transition.

---

# 73. Foundational Principle

> **A Mission begins when RELAIS stops merely discussing a problem and starts owning an agreed outcome.**

That boundary must remain clear whether the work takes ten minutes or ten weeks.
