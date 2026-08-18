# RELAIS Relais Availability & Matching

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`

---

## 1. Purpose

This document defines how RELAIS decides whether a Relais may receive a new Connection and how the system assigns one eligible Relais to one Customer.

Its purpose is to preserve:

- trust;
- fairness;
- concurrency safety;
- clear ownership;
- fast customer response;
- simple V1 operations.

The customer experience should feel immediate.

The matching rules behind that experience must remain disciplined.

---

# 2. Core Principle

> **Matching connects one Customer to one eligible Relais who is genuinely able to receive them now.**

Matching is not a directory search.

The Customer does not browse workers.

The system finds a Relais on the Customer's behalf.

---

# 3. Matching Is Not Mission Assignment

Matching answers:

> **Who can receive and understand this Customer right now?**

It does not yet answer:

> **Who will physically execute the eventual Mission?**

A matched Relais may later:

- execute the Mission personally;
- coordinate another person;
- request reassignment;
- escalate the request;
- determine that no Mission should exist.

Therefore:

> **Connection matching and Mission execution assignment are distinct concerns.**

---

# 4. Relais Eligibility

A person must be eligible before they may enter the matching pool.

Eligibility is an internal authorization decision.

Conceptually, a Relais may be:

- approved;
- under review;
- suspended;
- revoked;
- otherwise ineligible.

Exact state names are deferred.

The foundational rule is:

> **Only vetted and currently authorized Relais may receive Customer Connections.**

A role value alone is not sufficient.

---

# 5. Availability

Availability expresses whether an eligible Relais is currently willing and able to receive a new Customer Connection.

Conceptually:

```text
AVAILABLE
UNAVAILABLE
```

V1 should prefer the smallest useful state model.

Availability is distinct from:

- account status;
- vetting status;
- Mission workload;
- existing Connections;
- physical location.

---

# 6. Availability Is Voluntary Operational State

An eligible Relais may choose to become available.

Example customer-side consequence:

```text
Mamadou
APPROVED
AVAILABLE
→ may enter matching pool
```

while:

```text
Aïcha
APPROVED
UNAVAILABLE
→ does not receive new Connections
```

Changing availability must not affect access to already assigned Connections or Missions.

---

# 7. Availability Does Not Mean Idle

A Relais may be:

- available for a new conversation;
- while still managing several active Missions.

This is valid.

A multi-day Mission should not automatically block the Relais from receiving any new Customer.

Therefore:

> **Availability and workload must remain separate concepts.**

---

# 8. Capacity

Availability answers:

> "Do I want to receive a new Connection?"

Capacity answers:

> "Should the system give me another one?"

These are related but distinct.

V1 may use a simple capacity rule.

Examples may eventually consider:

- active Connections;
- unresolved Conversations;
- recent assignments;
- active Mission count;
- manually configured limits.

The exact algorithm is deferred.

---

# 9. V1 Matching Inputs

V1 matching should remain intentionally simple.

A Relais must satisfy all required conditions.

Conceptually:

```text
eligible
AND
available
AND
within capacity
AND
language-compatible when required
```

Other criteria may be introduced only when real operations justify them.

---

# 10. Language Matching

Language may be an important matching dimension.

A Customer may prefer communication in:

- French;
- Mooré;
- Dioula;
- Bissa;
- Fulfuldé;
- another supported language.

The system should match the Customer to a Relais who can communicate in the required language whenever language preference is supplied.

Language is a practical trust feature.

It is not merely profile decoration.

---

# 11. Language Preference May Be Optional in V1

The V1 customer flow does not need to force language selection before every Connection.

Possible behavior:

- use the Customer's saved preference when available;
- otherwise use the app language or default operating language;
- allow language selection later;
- let Operations correct mismatches manually.

The matching architecture should support language filtering without requiring the UI to expose it immediately.

---

# 12. Matching Begins From a Connection

Matching never exists independently of a Connection.

The sequence is:

```text
Customer requests help
        ↓
Connection created
        ↓
Connection enters MATCHING
        ↓
System searches eligible Relais
```

This ensures every matching attempt belongs to durable business history.

---

# 13. The Matching Pool

The matching pool is the set of Relais currently eligible to receive the Connection.

A Relais must be excluded when they are:

- not approved;
- suspended;
- deactivated;
- unavailable;
- at configured capacity;
- incompatible with a required language;
- otherwise operationally excluded.

The Customer must never be shown an ineligible Relais as successfully assigned.

---

# 14. V1 Selection Strategy

V1 should not attempt sophisticated optimization.

The system may select among eligible Relais using a simple deterministic or fair strategy.

A reasonable conceptual order is:

1. eligible and available;
2. required language compatibility;
3. within capacity;
4. lowest current Connection load;
5. longest time since previous new assignment.

Exact tie-breaking is deferred.

The principle is:

> **Prefer understandable fairness over opaque optimization.**

---

# 15. Do Not Rank by Ratings in V1

Customer ratings should not initially determine whether one Relais receives all Connections while another receives none.

Early rating volume will be small and noisy.

Performance management belongs primarily to Operations.

Matching should not prematurely become a popularity contest.

---

# 16. Atomic Assignment

Assignment must be concurrency-safe.

Two Customers may request a Relais at nearly the same time.

The system must prevent both requests from independently believing they exclusively acquired the same limited slot when capacity would not permit it.

Conceptually:

```text
Customer A → Mamadou
Customer B → Mamadou
```

must only occur when Mamadou still has capacity for both.

Otherwise one request must select another eligible Relais or continue matching.

---

# 17. Assignment Is Authoritative

A Customer must only see:

> **Mamadou est votre Relais**

after the assignment has been successfully committed.

The interface must not reveal an assignment optimistically and then attempt to persist it afterward.

Backend truth comes first.

UI celebration comes second.

---

# 18. Matching Reservation

Implementation may eventually require a short reservation or lock while an assignment is being committed.

That is an implementation concern.

The domain requirement is:

> **A Connection must never end up with conflicting current assignments because of concurrent matching.**

---

# 19. Matching Duration

RELAIS should aim for fast assignment.

However, the domain should not define a fake fixed search duration.

The system may find someone:

- immediately;
- after several seconds;
- after retrying;
- not at all.

The UI may remain visually intentional throughout.

---

# 20. Matching Experience

The matching screen is a foundational customer experience.

It should communicate that RELAIS is actively working on the Customer's behalf.

Example:

> **Recherche d'un Relais disponible...**

The interface may use:

- subtle animation;
- progressive status messaging;
- haptic feedback;
- deliberate reveal when assignment completes.

The matching experience must remain truthful.

---

# 21. No Artificial Ten-Second Delay

The emotional value of matching does not justify deception.

If the system finds an eligible Relais in one second, RELAIS should not intentionally pretend to search for ten seconds merely to create drama.

The design goal is:

> **Make real work feel reassuring, not make fake work feel real.**

---

# 22. Progressive Matching Messaging

If matching takes longer than expected, the system may communicate meaningful states.

Examples:

```text
Recherche d'un Relais disponible...
```

then:

```text
Nous vérifions les Relais disponibles...
```

then:

```text
Nous cherchons toujours quelqu'un pour vous.
```

These messages describe the same truthful matching operation.

They do not imply nonexistent steps.

---

# 23. Successful Matching

When assignment succeeds:

```text
MATCHING
    ↓
CONNECTED
```

The Connection receives one current Relais assignment.

The Customer may then see:

- Relais name;
- approved profile photo if used;
- supported languages;
- limited trust information;
- communication actions.

---

# 24. Customer Does Not Choose Between Three Relais in V1

V1 should prefer direct assignment.

The Customer requests:

> **Connecter à un Relais**

RELAIS responds:

> **Mamadou est votre Relais.**

This avoids:

- decision fatigue;
- popularity contests;
- marketplace behavior;
- customers repeatedly rejecting capable Relais for cosmetic reasons.

A future version may deliberately introduce choice if evidence supports it.

---

# 25. Relais Acceptance of Connections

V1 must choose between two possible models:

### Model A — System assignment

An available Relais is immediately assigned.

### Model B — Relais invitation

The system offers the Connection and waits for the Relais to accept.

For RELAIS V1, the preferred principle is:

> **Going AVAILABLE means consenting to receive eligible Connections within configured capacity.**

Therefore, matching may assign directly without requiring another acceptance tap.

This preserves the customer's sense of immediacy.

---

# 26. Why Availability Should Carry Consent

If every Connection requires:

```text
Customer waits
→ system finds Mamadou
→ Mamadou receives request
→ Mamadou decides whether to accept
→ customer keeps waiting
```

the matching experience becomes fragile.

Instead:

```text
Mamadou turns AVAILABLE
→ Mamadou enters pool
→ eligible Connection is assigned
→ conversation begins
```

The Relais remains free to:

- ask for reassignment;
- escalate;
- become unavailable for future Connections.

But availability should mean real readiness.

---

# 27. Relais Notification

Once assigned, the Relais should be notified promptly.

The notification should communicate:

- that a new Customer Connection exists;
- that the Customer is now assigned to them;
- that they should respond.

The exact push notification mechanism is deferred.

---

# 28. Response Expectation

A matched Relais should respond within an operationally defined expectation.

This expectation may evolve.

Examples may include:

- immediate response;
- response within several minutes;
- escalation after timeout.

The constitutional rule is:

> **Assignment creates responsibility.**

An assigned Connection must not remain unattended indefinitely.

---

# 29. Relais Non-Response

If the assigned Relais fails to engage within the permitted response window, the system or Operations may reassign the Connection.

This does not create a new Connection.

Assignment history must preserve:

- original assignment;
- non-response outcome where applicable;
- replacement assignment.

---

# 30. Automatic vs Manual Reassignment

V1 may begin with a mixture of:

- simple automatic timeout behavior;
- manual Operations intervention.

The domain must support reassignment.

It does not require sophisticated automation immediately.

---

# 31. No Relais Available

Matching may produce:

```text
NO_RELAIS_AVAILABLE
```

This is a legitimate outcome.

It must remain distinct from:

- technical failure;
- customer cancellation;
- RELAIS declining the request.

---

# 32. Customer Experience When Nobody Is Available

V1 should remain honest and simple.

Possible message:

> **Aucun Relais n'est disponible pour le moment.**

The Customer may receive one or more actions such as:

- retry;
- return later;
- request notification when availability returns.

Only functionality actually supported should be shown.

---

# 33. Do Not Fake Assignment

When nobody is available, RELAIS must not:

- show a random Relais;
- assign an unavailable employee;
- promise a near-term response without operational basis.

Trust is more important than preserving a perfect conversion funnel.

---

# 34. Matching Retry

A failed matching attempt may later be retried.

The domain should preserve whether:

- the same Connection continues matching;
- a terminal no-availability outcome has already been recorded.

V1 should avoid creating duplicate Connections from repeated taps.

---

# 35. Customer Cancellation During Matching

A Customer may cancel while RELAIS is searching.

If cancellation occurs before assignment:

```text
MATCHING
    ↓
CANCELLED
```

No Relais should subsequently be presented as assigned.

Concurrency handling must ensure late matching completion cannot override the Customer's valid cancellation.

---

# 36. Race Between Cancellation and Assignment

A Customer may cancel at the same moment matching succeeds.

The implementation must establish one authoritative outcome.

The system must never display contradictory states such as:

```text
Connection cancelled
AND
Mamadou is your active Relais
```

State transitions must be concurrency-safe.

---

# 37. Relais Becomes Unavailable During Matching

A Relais may switch to unavailable while matching is evaluating them.

The final assignment step must revalidate eligibility.

Stale candidate selection must not override current operational truth.

---

# 38. Relais Becomes Unavailable After Assignment

If Mamadou becomes unavailable after being assigned:

- the existing Connection remains his responsibility;
- future Connections stop being assigned to him.

Availability changes do not silently remove current assignments.

If he cannot continue, reassignment must occur explicitly.

---

# 39. Relais Suspension After Assignment

If a Relais becomes suspended or operationally ineligible during an active Connection:

- new Connections must stop immediately;
- Operations must review existing assignments;
- reassignment may be required;
- history must remain intact.

Suspension must not silently erase previous involvement.

---

# 40. Matching and Account Status

A Relais may enter matching only when all relevant authorization conditions remain valid.

Conceptually:

```text
User account active
+
Relais approved
+
Relais available
+
capacity available
+
required matching constraints satisfied
```

Failure of any mandatory condition excludes the Relais.

---

# 41. Capacity Must Not Depend Only on Active Missions

A long-running Mission may require little daily Relais attention.

A new unresolved Connection may require immediate attention.

Therefore, capacity should not be reduced to:

```text
number of active Missions
```

V1 may use a coarse model, but the architecture must preserve the conceptual distinction.

---

# 42. Connection Load

A useful V1 signal may be the number of currently unresolved assigned Connections.

This more directly approximates active customer attention than long-running Mission count.

Exact implementation is deferred.

---

# 43. Operations Override

ADMIN may:

- manually assign;
- manually reassign;
- remove a Relais from the matching pool;
- override availability where authorized;
- respond to operational failures.

Privileged changes must remain auditable.

---

# 44. Manual Assignment

Operations may sometimes know that a specific Relais is appropriate.

Manual assignment must still respect:

- Customer authorization boundary;
- Relais eligibility;
- historical assignment preservation;
- audit requirements.

Manual does not mean unstructured.

---

# 45. Preferred Relais Is Not a V1 Requirement

A Customer may eventually develop trust with a specific Relais.

Future versions may support:

- reconnecting with a previous Relais;
- favorite Relais;
- continuity preference.

V1 does not require this.

The initial system should optimize for dependable availability, not personalized loyalty routing.

---

# 46. Geographic Matching

V1 matching does not require live GPS proximity.

The Relais is initially the Customer's coordination contact, not necessarily the person physically performing the Mission.

Therefore, location-based driver-style matching would be premature.

Geographic constraints may be introduced later when real execution requirements justify them.

---

# 47. Matching Does Not Determine Price

Matching should not calculate mission price.

The system does not yet know the request.

Pricing occurs after human understanding.

This protects the foundational flow:

```text
Find human
→ Talk
→ Understand
→ Price
```

not:

```text
Describe everything to software
→ Calculate price
→ Find human
```

---

# 48. Matching Does Not Determine QUICK vs MANAGED

The matching engine must not attempt to classify the future Mission.

That decision belongs after the Customer and Relais communicate.

Therefore:

```text
Connection matching
```

must remain independent of:

```text
Mission depth classification
```

---

# 49. Matching History

The system should eventually be able to reconstruct meaningful matching events.

Examples:

- matching started;
- candidate pool evaluated;
- assignment completed;
- no Relais available;
- Customer cancelled;
- reassignment occurred.

This does not require logging every internal algorithm step forever.

It requires enough durable history to explain significant business outcomes.

---

# 50. Matching Metrics

The domain should support deriving:

- total matching requests;
- successful matching rate;
- average time to assignment;
- no-availability rate;
- reassignment rate;
- first-response time;
- Connections per Relais;
- language-related match failures;
- Customer cancellation during matching.

Metrics should arise from real domain events.

---

# 51. Privacy During Matching

A Relais should not receive unnecessary Customer information merely because they were considered as a candidate.

Candidate evaluation does not create authorization.

Customer details become accessible only after valid assignment or another explicit authorized operational action.

---

# 52. Customer Privacy Before Assignment

The matching engine may use necessary attributes such as:

- required language;
- account eligibility;
- matching constraints.

It should avoid exposing full Customer profiles to multiple candidate Relais before one is actually assigned.

---

# 53. Matching Failure Due to Technical Error

Technical failure is distinct from no availability.

Example:

```text
Database unavailable
```

is not:

```text
No Relais available
```

The Customer experience and internal monitoring should preserve this distinction.

The system should never misrepresent infrastructure failure as human unavailability.

---

# 54. Idempotency

Repeated Customer taps or network retries must not accidentally create multiple active Connections or multiple assignments for the same intended request.

Exact idempotency mechanisms are implementation concerns.

The domain requirement is:

> **One intentional request should not multiply because the network retried it.**

---

# 55. Matching Non-Goals

V1 matching does not need:

- machine learning;
- predictive routing;
- live geographic proximity;
- bidding;
- customer browsing;
- surge pricing;
- dynamic ratings-based ranking;
- AI request classification;
- Mission category prediction;
- multi-country optimization;
- complex scheduling.

---

# 56. Core Invariants

The eventual implementation must preserve at least these invariants:

1. Only eligible Relais may receive new Connections.

2. Only available Relais may be automatically matched.

3. Availability does not remove existing assignments.

4. One Connection has at most one current Customer-facing Relais.

5. Successful assignment must be committed before the Customer sees the Relais as assigned.

6. Reassignment preserves assignment history.

7. A Relais considered during matching gains no Customer access until assignment.

8. Customer cancellation cannot coexist with an active successful assignment unless a valid later transition explicitly resolves it.

9. `NO_RELAIS_AVAILABLE` is distinct from technical failure.

10. Matching does not create a Mission.

11. Matching does not classify QUICK vs MANAGED.

12. Matching does not determine Mission price.

13. Repeated retries must not create duplicate intended Connections.

---

# 57. Conceptual Model

Without committing to a database schema:

```text
RelaisProfile
    eligibility
    supported languages
    operational metadata

RelaisAvailability
    current availability
    changed at

Matching
    Connection
    required constraints
    matching started
    matching outcome

ConnectionAssignment
    Connection
    Relais
    assigned at
    ended at
    assignment reason
    assigned by
```

The exact number of persisted entities remains deliberately open.

The important concepts must survive implementation.

---

# 58. Foundational Matching Test

For every matching attempt, RELAIS should eventually be able to answer:

1. Which Connection needed a Relais?
2. Was the Customer still requesting help?
3. Which requirements affected eligibility?
4. Was an eligible Relais available?
5. Who was assigned?
6. When did assignment become authoritative?
7. Was the assignment later changed?
8. Why?
9. If nobody was assigned, was it because of availability, cancellation, or system failure?
10. Can we reconstruct the outcome without guessing?

If not, matching history is incomplete.

---

# 59. Customer Experience Test

The Customer should experience matching as:

> **I asked RELAIS for someone.**

↓

> **RELAIS is finding someone for me.**

↓

> **Someone trusted is now here for me.**

They should not experience:

- a marketplace;
- staffing mechanics;
- candidate ranking;
- operational uncertainty;
- internal capacity calculations.

The complexity belongs behind the screen.

---

# 60. Foundational Principle

> **Availability is a promise from the Relais. Matching is a promise from RELAIS.**

When a Relais says they are available, the organization may trust them with a Customer.

When RELAIS tells a Customer that a Relais has been found, that assignment must already be real.
