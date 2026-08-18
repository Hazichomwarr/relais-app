# RELAIS Connection Domain

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`

---

## 1. Purpose

This document defines the **Connection** domain in RELAIS.

A Connection represents the period beginning when a Customer asks RELAIS to find a Relais for one potential course.

It exists before RELAIS knows:

- what the Customer needs;
- whether RELAIS can accept it;
- whether the Customer will continue;
- whether a Mission will eventually exist.

The Connection is therefore the boundary between:

> **“I need someone.”**

and

> **“RELAIS has accepted responsibility for a Mission.”**

---

# 2. Definition

A Connection is the durable record that a Customer requested human assistance and RELAIS attempted to connect that Customer with a Relais for one potential course.

A Connection may include:

- matching;
- assignment;
- conversation;
- reassignment;
- qualification;
- rejection;
- abandonment;
- eventual Mission creation.

A Connection is not itself a Mission.

---

# 3. Core Principle

> **Every request for a Relais creates a Connection before it can create a Mission.**

The Customer does not create a Mission directly.

The Customer requests access to a human.

The human conversation determines what happens next.

---

# 4. Why Connection Exists Separately From Mission

A Customer may tap:

> **Connecter à un Relais**

and then:

- change their mind;
- never reply;
- explain a request RELAIS cannot perform;
- ask something prohibited;
- reject the price;
- disconnect before qualification;
- receive guidance without needing a Mission;
- successfully proceed to a Mission.

If Connection and Mission were the same entity, all of these situations would create fake or misleading Missions.

Therefore:

> **Connection records demand. Mission records accepted work.**

---

# 5. Connection Lifecycle

The conceptual lifecycle is:

```text
REQUESTED
    ↓
MATCHING
    ↓
CONNECTED
    ↓
CONVERSING
    ↓
QUALIFIED
    ↓
OUTCOME
```

Possible outcomes include:

```text
MISSION_CREATED

DECLINED_BY_RELAIS

DECLINED_BY_CUSTOMER

ABANDONED

NO_RELAIS_AVAILABLE

CANCELLED
```

Exact persistence enums may differ later.

The lifecycle semantics are foundational.

---

# 6. REQUESTED

A Connection becomes `REQUESTED` when the Customer explicitly asks RELAIS to find them a Relais.

At this point:

- the Customer is known;
- the request exists;
- no Relais is necessarily assigned;
- no Mission exists;
- the requested language or matching preferences may be known.

A Connection must not be created merely because the Customer opened the matching screen.

Creation requires an intentional request.

---

# 7. MATCHING

A Connection enters `MATCHING` while RELAIS searches for an eligible available Relais.

During matching:

- no Relais is yet guaranteed to the Customer;
- eligible candidates may be evaluated;
- matching must prevent conflicting assignments;
- the Customer may cancel;
- the system may determine that nobody is currently available.

The customer-facing experience may display:

> **Recherche d'un Relais disponible...**

Matching is both:

- a domain operation;
- a first-class product experience.

---

# 8. Matching Must Be Truthful

The interface may animate matching.

It must not pretend that meaningful matching is occurring when no matching operation exists.

The product may make genuine waiting feel intentional.

It must not deliberately create false scarcity or false activity.

---

# 9. CONNECTED

A Connection becomes `CONNECTED` once one eligible Relais has been successfully assigned.

At this point:

- the Customer has one assigned Relais;
- the Relais has access to the Connection;
- the Customer may begin communicating;
- the Customer sees who their Relais is.

Example:

> **Mamadou est votre Relais pour cette course.**

Assignment must be authoritative before this message is shown.

---

# 10. One Active Relais Per Connection

At any point in time, one Connection has at most one active Customer-facing Relais.

This guarantees a clear relationship:

```text
Connection
    ↓
Current Relais
```

Multiple internal employees may assist operationally.

The Customer should still know who owns the conversation.

---

# 11. Assignment History

Current assignment and historical assignment are different concepts.

If:

```text
Mamadou
    ↓
Connection
```

is later reassigned to:

```text
Aïcha
```

the system must not rewrite history as though Mamadou had never been assigned.

The historical record should be capable of answering:

- who was assigned;
- when;
- when the assignment ended;
- why reassignment occurred when required;
- who performed the reassignment when privileged action was involved.

---

# 12. Reassignment

Reassignment may occur because of:

- Relais unavailability;
- language mismatch discovered after matching;
- customer request;
- technical failure;
- operational escalation;
- Relais withdrawal;
- supervisor intervention;
- workload balancing;
- another legitimate operational reason.

Reassignment is not a new Connection by default.

The Customer still came to RELAIS once for one potential course.

---

# 13. When Reassignment Should Create a New Connection

A new Connection should be created when the Customer begins a genuinely separate request.

Example:

```text
Connection A
Deliver keys today.

Connection B
Check administrative office tomorrow.
```

The test is not:

> “Did another Relais become involved?”

The test is:

> **“Is the Customer asking RELAIS to solve a separate need?”**

---

# 14. CONVERSING

A Connection enters the conversation phase once meaningful Customer–Relais communication begins.

Communication may include:

- text;
- voice note;
- call;
- supported attachments.

The conversation belongs to the Connection.

It exists before Mission creation.

---

# 15. Calls May Occur Outside RELAIS

V1 may use the device's normal telephone capability.

Therefore, RELAIS may know:

- that the Customer initiated a call action;
- when the call action was initiated;

without necessarily knowing:

- what was said;
- exact call duration;
- whether the call was answered.

The domain must not fabricate communication records it cannot actually observe.

---

# 16. Conversation Is Context

The conversation may contain the only detailed description of a QUICK request.

Example:

Customer:

> “Récupère les clés chez moi et remets-les à ma nounou.”

Relais:

> “D'accord.”

The Relais may then select `QUICK` and enter only the price.

RELAIS should not require redundant data entry merely to restate the conversation.

---

# 17. Qualification

Qualification is the Relais's operational decision about what should happen after understanding the Customer.

Possible conceptual decisions include:

```text
QUICK

MANAGED

NEEDS_REVIEW

DECLINE

NO_MISSION_NEEDED
```

These are not necessarily Connection statuses.

They represent the result of human judgment.

---

# 18. QUICK Outcome

For a straightforward request, the Relais may choose `QUICK`.

The system should then:

1. recognize that the request is suitable for the QUICK path;
2. require only missing information necessary for agreement;
3. generate the standard customer offer;
4. send the offer to the Customer;
5. await Customer acceptance or rejection.

Example:

```text
Course acceptée

Prix : 2 000 FCFA

[ Accepter ]

[ Refuser ]
```

The Connection remains the pre-Mission context until the required agreement conditions are satisfied.

---

# 19. MANAGED Outcome

For a request requiring more structure, the Relais may choose `MANAGED`.

The Connection may then support:

- assessment;
- scope definition;
- duration estimate;
- operational classification;
- pricing;
- required evidence;
- expense expectations;
- proposal preparation;
- review.

The Customer may remain in the same Connection throughout this process.

---

# 20. Connection Does Not Become a Mission Automatically

A Relais understanding the Customer is not sufficient to create an active Mission.

There must be an explicit transition from:

```text
Potential work
```

to:

```text
Accepted RELAIS responsibility
```

The precise acceptance conditions differ between QUICK and MANAGED flows and will be defined in later domain documents.

---

# 21. Relationship to Mission

A Connection may result in zero or one initial Mission in V1.

Conceptually:

```text
Connection
    │
    └── Mission?
```

V1 should prefer this simple relationship.

If future evidence proves that one Connection commonly generates several Missions, the model may evolve deliberately.

We should not model that complexity prematurely.

---

# 22. Connection Without Mission

A Connection may close without a Mission.

This is normal.

Examples:

- Customer changed their mind;
- Customer stopped responding;
- RELAIS declined the request;
- request was impossible;
- request was outside scope;
- no agreement on price;
- Customer only needed information;
- no Relais became available.

These outcomes are valuable business data.

They must not be converted into fake Missions merely to preserve them.

---

# 23. Declined by RELAIS

RELAIS may decline after learning enough about the request.

Reasons may include:

- prohibited request;
- unacceptable risk;
- operational impossibility;
- unsupported scope;
- insufficient authorization;
- unavailable resources;
- another reason allowed by policy.

The Customer should receive an appropriate customer-facing explanation.

Internal reasons may be more detailed than what the Customer sees.

---

# 24. Declined by Customer

The Customer may choose not to continue after:

- hearing the price;
- discussing the request;
- receiving a QUICK offer;
- receiving a MANAGED proposal;
- changing their mind.

This must not be treated as operational failure.

It is a legitimate Connection outcome.

---

# 25. Abandonment

A Connection becomes abandoned when neither party can reasonably continue because the Customer has stopped participating.

Abandonment must not be inferred too aggressively.

A Customer may simply need time.

Operational configuration should determine when an inactive Connection qualifies for abandonment.

The foundational distinction is:

> **Abandoned means participation ceased without an explicit final decision.**

---

# 26. No Relais Available

Matching may fail because no eligible Relais is available.

This is different from:

- RELAIS declining the mission;
- the Customer abandoning;
- a technical error.

The system should preserve that distinction.

Future behavior may include:

- waitlist;
- retry;
- notify when available;
- alternative language;
- schedule later.

V1 may use a simpler response.

---

# 27. Customer Cancellation

The Customer may cancel a Connection before a Mission exists.

Cancellation should be distinct from rejecting an actual offer when meaningful.

The exact UI may remain simple.

The historical event should remain understandable.

---

# 28. Terminal Connection

A Connection becomes terminal when no further pre-Mission interaction is expected.

Terminal outcomes may conceptually include:

```text
MISSION_CREATED

DECLINED_BY_RELAIS

DECLINED_BY_CUSTOMER

ABANDONED

NO_RELAIS_AVAILABLE

CANCELLED
```

A terminal Connection is not deleted.

It becomes history.

---

# 29. Mission Creation and Connection Closure

Once a Mission is validly created, the Connection's primary purpose has been fulfilled.

The Connection may transition to a terminal outcome such as:

```text
MISSION_CREATED
```

The associated Conversation may remain accessible through the Mission context where authorized.

The Connection does not disappear merely because the Mission now exists.

---

# 30. Connection Identity

Every Connection should eventually have:

- a stable unique identifier;
- creation timestamp;
- Customer identity;
- current lifecycle state;
- assignment information when applicable;
- terminal outcome when applicable;
- immutable or auditable timestamps for important transitions.

Human-readable reference numbers may be added later if operationally useful.

---

# 31. Customer Concurrency

A Customer may theoretically have multiple Connections over time.

V1 must decide carefully whether a Customer may initiate several unresolved Connections simultaneously.

Default principle:

> Prevent accidental duplicates without assuming a Customer can only ever need one thing at a time.

A later implementation ticket should define the exact concurrency rule.

---

# 32. Relais Concurrency

A Relais may:

- manage existing Missions;
- maintain existing Connections;
- potentially receive another Connection if availability and workload policy allow.

Being assigned to one Connection must not automatically make a Relais unavailable forever.

Availability and capacity are separate operational concerns.

---

# 33. Connection Matching vs Mission Capacity

Matching answers:

> **Can this Relais receive and understand another Customer right now?**

It does not necessarily answer:

> **Can this Relais personally execute another Mission?**

These are different questions.

V1 may implement a simple capacity model.

The domain must not collapse them conceptually.

---

# 34. Language

Matching may consider a Customer's preferred language.

Language preference belongs to matching context.

It does not define the Connection itself permanently.

A Customer may:

- prefer Mooré today;
- use French another time;
- change language during a conversation.

Language must assist matching without restricting the human relationship unnecessarily.

---

# 35. Urgency

Urgency is not required to create a Connection in V1.

Future versions may collect urgency before or during matching.

The Connection domain must not depend on urgency being customer-visible.

Urgency will primarily belong to Mission semantics once a request is understood.

---

# 36. Internal Notes

Relais and authorized operations personnel may need internal Connection notes.

Internal notes are distinct from Customer-visible Conversation messages.

They must never accidentally appear to the Customer.

Their exact domain representation is deferred.

---

# 37. Connection Incidents

An incident may occur before a Mission exists.

Examples:

- abusive Customer;
- suspected fraud;
- inappropriate request;
- identity concern;
- safety concern during intake.

Therefore, incidents must not conceptually require a Mission.

Future incident modeling should be able to reference a Connection where appropriate.

---

# 38. Historical Integrity

The following must not be silently rewritten:

- Connection creation;
- original Customer;
- previous Relais assignments;
- important state transitions;
- final outcome;
- linked Mission identity;
- privileged administrative interventions.

Corrections may occur through auditable procedures.

History must remain reconstructable.

---

# 39. Deletion Principle

Operational Connections should not normally be hard-deleted because:

- they may contain communication history;
- they may explain why a Mission exists;
- they may contain safety information;
- they may be relevant to disputes;
- they contribute to operational learning.

Data retention and privacy obligations may require later deletion or anonymization policies.

Those policies must be deliberate rather than ordinary application deletion.

---

# 40. Connection Metrics

The Connection domain should eventually allow RELAIS to understand:

- number of Connection requests;
- matching success rate;
- average matching time;
- percentage reaching conversation;
- percentage resulting in QUICK Missions;
- percentage resulting in MANAGED Missions;
- decline rate;
- abandonment rate;
- no-availability rate;
- reassignment rate.

These metrics should emerge from domain history rather than manually entered analytics fields.

---

# 41. Connection Non-Goals

The Connection domain does not need to model:

- service catalogs;
- customer-selected categories;
- bidding between Relais;
- AI intake;
- automated mission drafting;
- GPS tracking;
- field-agent execution;
- payment accounting;
- detailed Mission lifecycle.

Those belong elsewhere.

---

# 42. Core Invariants

The implementation must eventually preserve at least these invariants:

1. A Connection belongs to exactly one Customer.

2. A Connection exists before any Mission resulting from it.

3. A Connection has at most one current Customer-facing Relais.

4. Historical assignments are not destroyed by reassignment.

5. A Customer cannot access another Customer's Connection.

6. A Relais cannot access an unrelated Connection merely because they hold the RELAIS role.

7. A terminal Connection is preserved.

8. A Connection without a Mission is a valid domain outcome.

9. Matching failure is distinct from request rejection.

10. Connection state cannot imply events that did not occur.

---

# 43. Conceptual Model

Without committing to Prisma:

```text
Connection

identity
customer

lifecycle state

matching context
    preferred language

current assignment
    Relais

assignment history

conversation

qualification outcome

terminal outcome

linked Mission, if any

timestamps

audit-relevant history
```

---

# 44. Foundational Test

For every Connection, RELAIS should eventually be able to answer:

1. Who asked for help?
2. When did they ask?
3. Did RELAIS find someone?
4. Who became their Relais?
5. Did assignment ever change?
6. Did meaningful conversation occur?
7. What was the result of that conversation?
8. Did a Mission result?
9. If not, why did the Connection end?
10. Can we reconstruct the history without guessing?

If any answer depends on overwritten data or employee memory, the domain is incomplete.

---

# 45. Foundational Principle

> **A Connection records the moment a Customer hands RELAIS an unresolved need before RELAIS knows what that need will become.**

It is the doorway into every RELAIS relationship.

The Connection must therefore remain simple enough to begin instantly, but durable enough to explain everything that happened before a Mission existed.
