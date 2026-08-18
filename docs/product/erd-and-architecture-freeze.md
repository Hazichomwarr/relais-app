# RELAIS ERD & Architecture Freeze

**Status:** Architecture Freeze
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/relais-availability-and-matching.md`
- `docs/product/conversation-domain.md`
- `docs/product/mission-domain.md`
- `docs/product/quick-mission-flow.md`
- `docs/product/managed-mission-flow.md`
- `docs/product/payments-and-mission-funds.md`
- `docs/product/mission-updates-and-completion.md`
- `docs/product/incidents-and-audit-history.md`

---

# 1. Purpose

This document freezes the V1 RELAIS conceptual architecture before implementation begins.

Its goals are to:

- reconcile Tickets 0A–0K;
- identify the V1 domain entities;
- define the relationships between them;
- preserve historical correctness;
- prevent premature implementation complexity;
- distinguish what must exist in V1 from what remains operational or future-only;
- establish the architecture that Prisma, services, APIs, Expo, and the Admin application will later implement.

This document is the final architecture checkpoint before code.

---

# 2. Architecture Principle

> **The software should preserve the truth of the business without attempting to model every detail of the business.**

RELAIS V1 must model:

- who asked for help;
- who was assigned;
- what was discussed;
- what RELAIS offered;
- what the Customer accepted;
- what money changed hands;
- what RELAIS did;
- what happened;
- how the Mission ended;
- what went wrong when something did;
- who made consequential changes.

It does not need to model every physical actor, administrative step, route, or internal office conversation.

---

# 3. Core V1 Flow

The architecture supports this canonical flow:

```text
Customer
    ↓
Connection
    ↓
Matching
    ↓
Relais Assignment
    ↓
Conversation
    ↓
Qualification
    ├── QUICK
    │      ↓
    │   Quick Offer
    │      ↓
    │ Customer Acceptance
    │      ↓
    │    Mission
    │
    └── MANAGED
           ↓
        Proposal
           ↓
     Customer Acceptance
           ↓
         Mission

Mission
    ↓
Financial Prerequisites
    ↓
Execution
    ↓
Mission Updates
    ↓
Completion Attempt
    ↓
Completed / Failed / Cancelled
    ↓
Financial Reconciliation
```

Incidents and audit history may occur across this lifecycle.

---

# 4. V1 Actors

Authenticated V1 actors:

```text
CUSTOMER
RELAIS
ADMIN
```

Operational but not authenticated in V1:

```text
FIELD_EXECUTOR
```

No additional application roles should be introduced unless implementation exposes a proven requirement.

---

# 5. Root Identity

The root authenticated identity is:

```text
User
```

A User represents one human/account identity.

A User may have role-specific profile data.

Conceptually:

```text
User
├── CustomerProfile?
└── RelaisProfile?
```

ADMIN does not require a separate profile model unless real implementation needs one.

---

# 6. User Role

V1 supports:

```text
CUSTOMER
RELAIS
ADMIN
```

The exact technical representation may be:

- one role enum;
- role membership table;
- another simple authorization structure.

V1 should choose the simplest representation that preserves future history.

Do not build arbitrary enterprise RBAC.

---

# 7. Customer Profile

`CustomerProfile` stores Customer-specific information that does not belong directly on global identity.

Potential responsibilities:

- preferred language;
- Customer-facing profile data;
- future communication preferences.

V1 should keep this model small.

---

# 8. Relais Profile

`RelaisProfile` stores operational information specific to a vetted Relais.

Conceptual data includes:

- approval/eligibility state;
- availability;
- supported languages;
- approved Customer-facing phone/contact;
- Customer-facing display information;
- operational metadata.

Do not mix vetting state with availability.

---

# 9. Relais Availability

For V1, availability may be stored directly on `RelaisProfile` if the only requirement is current state plus last change time.

A dedicated `RelaisAvailability` entity is not required unless we need historical availability sessions during implementation.

Architecture freeze:

> **Persist current availability simply. Do not create an availability-history subsystem in V1.**

Audit may record privileged changes where necessary.

---

# 10. Supported Languages

A Relais may support multiple languages.

A Customer may have one preferred language for matching.

Conceptually:

```text
RelaisProfile
    └── supported languages

CustomerProfile
    └── preferred language?
```

The implementation may use:

- an enum array;
- join table;
- another normalized structure.

Choose based on database/provider capabilities and expected growth.

Language support must not be hardcoded into UI-only logic.

---

# 11. Connection

`Connection` is a foundational entity.

It represents:

> one Customer asking RELAIS to find someone for one potential need.

It exists before a Mission.

Every V1 Mission originates from exactly one Connection.

---

# 12. Connection Core Data

Conceptually:

```text
Connection
- id
- customerId
- lifecycleState
- terminalOutcome?
- preferredLanguage?
- createdAt
- connectedAt?
- endedAt?
```

Exact fields remain implementation-specific.

---

# 13. Connection Assignment History

Current Relais ownership must not erase history.

Therefore V1 should have an explicit historical entity:

```text
ConnectionAssignment
```

Conceptually:

```text
ConnectionAssignment
- id
- connectionId
- relaisUserId
- assignedAt
- endedAt?
- reason?
- assignedBy?
```

A Connection has at most one active assignment.

Historical assignments remain.

---

# 14. Why Connection Assignment Must Be Its Own Entity

Do not model only:

```text
Connection.relaisId
```

because reassignment would overwrite history.

A denormalized current assignment field may later be added for performance if useful.

The historical assignment record remains authoritative.

---

# 15. Matching Is Primarily a Service, Not a Persistent Entity

V1 does not require a `MatchingSession` database table.

Matching behavior can operate over:

- Connection state;
- Relais eligibility;
- availability;
- capacity;
- language;
- assignment transaction.

Significant outcomes can be preserved through:

- Connection transitions;
- ConnectionAssignment;
- audit/system events where useful.

Architecture freeze:

> **Do not create a generic Matching entity in V1 unless implementation reveals a concrete historical requirement that existing records cannot satisfy.**

---

# 16. Conversation

Every Connection has at most one primary Conversation in V1.

Conceptually:

```text
Connection
    1
    ↓
Conversation
    1
```

The Conversation may exist before and after Mission creation.

---

# 17. Conversation Entity

`Conversation` should remain lightweight.

Conceptually:

```text
Conversation
- id
- connectionId
- createdAt
```

Participants are derived primarily from:

- Connection Customer;
- Connection assignment history/current assignment;
- authorized Admin access.

Avoid unnecessary conversation-membership tables in V1.

---

# 18. Message

`Message` represents durable in-app Customer–Relais communication.

Conceptually:

```text
Message
- id
- conversationId
- senderUserId
- type
- text?
- media reference?
- createdAt
- delivery state where supported
```

Supported V1 types:

```text
TEXT
VOICE
ATTACHMENT
```

Call handoff may be represented separately or as a lightweight event.

---

# 19. Call Action

A normal phone call is external to RELAIS.

If call initiation history is useful, V1 may persist:

```text
CallAction
- conversationId
- initiatedBy
- target
- initiatedAt
```

Do not model:

- answered state;
- duration;
- content;

unless the platform can authoritatively observe them.

---

# 20. Generic Attachment Entity

V1 should avoid separate attachment models for every domain if one explicit polymorphic pattern can remain safe and understandable.

However, relational integrity matters.

Preferred architecture:

Use domain-specific ownership where practical.

Examples:

```text
MessageAttachment
MissionAttachment
IncidentAttachment
```

or explicit foreign keys on a common asset record.

Avoid an unconstrained:

```text
ownerType
ownerId
```

pattern if the database cannot enforce ownership.

Implementation ticket should choose the smallest safe design.

---

# 21. Asset Storage

Binary files do not belong directly in PostgreSQL.

Database records store metadata and object-storage references.

Authorization derives from the owning domain object.

---

# 22. Qualification

`QUICK` and `MANAGED` are not Connection statuses.

They are Mission-depth decisions.

There is no need for a standalone `Qualification` entity in V1 unless implementation needs to persist pre-offer assessment state.

For QUICK, the Quick Offer itself proves the decision.

For MANAGED, the Proposal Draft/Proposal proves the decision.

Architecture freeze:

> **Do not add a generic Qualification entity in V1.**

---

# 23. Quick Offer

QUICK requires a first-class structured entity:

```text
QuickOffer
```

It exists before the Mission.

Conceptually:

```text
QuickOffer
- id
- connectionId
- createdByRelaisId
- price
- currency
- status
- createdAt
- acceptedAt?
- rejectedAt?
- supersededAt?
```

---

# 24. Quick Offer Relationship

V1:

```text
Connection
    1
    ↓
QuickOffer
    0..n
```

Only one Quick Offer may be pending/valid for acceptance at a time.

Historical offers remain.

---

# 25. Proposal

MANAGED requires a structured proposal entity.

Preferred architecture:

```text
ManagedProposal
```

with explicit versioning.

Conceptually:

```text
ManagedProposal
- id
- connectionId
- createdByRelaisId
- versionNumber
- status
- summary
- objective
- scope
- exclusions
- estimatedDuration
- relaisFee
- currency
- externalCostNotes
- customerRequirements
- createdAt
- sentAt?
- acceptedAt?
- rejectedAt?
- supersededAt?
```

Exact decomposition may evolve.

---

# 26. Proposal Versioning

Each version is a separate immutable historical record.

Do not implement:

```text
Proposal
    version = 4
    mutable fields
```

while overwriting prior contents.

Preferred:

```text
Proposal v1
Proposal v2
Proposal v3
```

each preserved.

---

# 27. Mission Creation

A Mission is created only after:

- valid Quick Offer acceptance;
- or valid Managed Proposal acceptance.

Therefore the Mission references exactly one accepted commercial basis.

Conceptually:

```text
Mission
    acceptedQuickOfferId?
    acceptedManagedProposalId?
```

Exactly one should apply in V1.

---

# 28. Mission Core Entity

Conceptually:

```text
Mission
- id
- connectionId
- customerId
- depth
- urgency
- lifecycle
- summary?
- category?
- createdAt
- completionPendingAt?
- completedAt?
- cancelledAt?
- failedAt?
```

`customerId` may technically be derivable from Connection.

Whether to duplicate it for query convenience should be decided during schema implementation.

Historical consistency must be protected if duplicated.

---

# 29. Mission Depth

V1:

```text
QUICK
MANAGED
```

Mission depth is immutable after Mission creation under normal operation.

If reality changes materially later, the history should show an escalation/amendment rather than silently rewriting origin.

---

# 30. Urgency

V1:

```text
NORMAL
URGENT
```

Customer UI exposes only NORMAL in V1.

Mission creation defaults to NORMAL.

Keep the field ready for later rollout.

Do not build urgency pricing or priority UI now.

---

# 31. Mission Category

Mission category is operational metadata.

It should be configurable and not customer-selected.

Architecture choice:

> **Do not create an elaborate category hierarchy in V1.**

A simple Category entity or enum-like configurable table is enough.

If no implementation ticket yet requires categories, it may be deferred until Relais qualification UI.

---

# 32. Mission Assignment History

Mission responsibility can change independently of Connection assignment.

Therefore use:

```text
MissionAssignment
```

Conceptually:

```text
MissionAssignment
- id
- missionId
- relaisUserId
- role/context
- assignedAt
- endedAt?
- reason?
- assignedBy?
```

V1 may initially use one Customer-facing Relais assignment type.

The entity leaves room for operational ownership later.

---

# 33. Why Mission Assignment Is Separate From Connection Assignment

Suppose Mamadou handles intake.

Customer accepts.

Mission starts.

Later Mamadou leaves and Aïcha manages execution.

Connection history should still show Mamadou received the Customer.

Mission history should show Aïcha later owned the Mission.

These are related but not identical histories.

---

# 34. Field Executor

No `FieldExecutorProfile` or authenticated executor role is required for V1.

If Operations needs to record who physically did something, start with a lightweight internal reference or note only if real pilot operations demand it.

Do not prebuild executor marketplace architecture.

---

# 35. Payment Obligation

V1 should model expected payment separately from payment attempts.

Entity:

```text
PaymentObligation
```

Conceptually:

```text
PaymentObligation
- id
- missionId
- purpose
- amount
- currency
- status
- createdAt
- dueAt?
```

Purpose examples:

```text
RELAIS_FEE
MISSION_FUNDS
```

---

# 36. Payment Attempt

Entity:

```text
PaymentAttempt
```

Conceptually:

```text
PaymentAttempt
- id
- obligationId
- provider
- method
- externalReference?
- amount
- currency
- status
- initiatedAt
- confirmedAt?
- failedAt?
```

Provider terminology must not define Mission semantics.

---

# 37. External Expense

Entity:

```text
MissionExpense
```

Conceptually:

```text
MissionExpense
- id
- missionId
- amount
- currency
- purpose
- submittedBy
- occurredAt
- approval context
- evidence?
```

It represents money spent externally for Mission execution.

---

# 38. Refund

Refund should be its own financial record.

Entity:

```text
Refund
```

Conceptually:

```text
Refund
- id
- payment/obligation context
- missionId
- amount
- currency
- reason
- approvedBy
- createdAt
- provider reference?
```

Never erase the original payment.

---

# 39. Mission Fund Balance

Do not create a manually editable:

```text
mission.balance
```

as authoritative truth.

Balance should derive from:

- Mission Funds successfully received;
- approved External Expenses;
- refunds/returns;
- explicit adjustments if later required.

A cached balance may be introduced for performance only after correctness is established.

---

# 40. Mission Update

Entity:

```text
MissionUpdate
```

Conceptually:

```text
MissionUpdate
- id
- missionId
- authorUserId
- visibility
- text
- createdAt
```

Attachments may belong to the Update.

---

# 41. Mission Update Visibility

V1:

```text
CUSTOMER_VISIBLE
INTERNAL
```

This boundary must be server-enforced.

---

# 42. Mission Waiting Context

Do not introduce numerous lifecycle states.

If Operations needs structured waiting context, a small optional field may later represent:

```text
CUSTOMER
THIRD_PARTY
RELAIS
NONE
```

But V1 should only add it when tracker/operations implementation actually uses it.

Avoid speculative fields.

---

# 43. Completion Attempt

Because completion may be disputed and retried, V1 should preserve completion history explicitly.

Entity:

```text
CompletionAttempt
```

Conceptually:

```text
CompletionAttempt
- id
- missionId
- proposedBy
- summary
- proposedAt
- customerResponse
- respondedAt?
- resolution
```

This avoids overwriting the first completion attempt when a second occurs.

---

# 44. Completion Evidence

Completion evidence may be associated with:

- CompletionAttempt;
- MissionUpdate;
- Mission generally.

Prefer the most semantically precise ownership.

---

# 45. Rating

V1 needs a simple:

```text
Rating
```

Conceptually:

```text
Rating
- id
- missionId
- customerId
- relaisUserId
- score
- comment?
- createdAt
```

At most one active Customer rating per Mission in V1.

Do not build reciprocal Relais→Customer ratings.

---

# 46. Incident

Entity:

```text
Incident
```

An Incident may exist without a Mission.

Conceptually:

```text
Incident
- id
- type/category
- severity
- lifecycle
- summary
- reportedBy
- ownerAdminId?
- connectionId?
- missionId?
- payment context?
- user context?
- createdAt
- resolvedAt?
- closedAt?
```

Avoid unconstrained polymorphism if referential integrity can be preserved through explicit nullable references.

---

# 47. Incident Notes

Internal Incident investigation may require:

```text
IncidentNote
```

or equivalent history.

Do not store one mutable giant `notes` field if investigators need chronological history.

V1 may start with Incident actions/notes if implementation scope includes Incident workflow.

---

# 48. Incident Resolution

Resolution should be structured enough to preserve:

- conclusion;
- action;
- resolver;
- timestamp.

Whether that is stored directly on Incident or in an `IncidentResolution` entity can be decided during schema design.

Do not over-normalize before use cases demand it.

---

# 49. Audit Event

V1 should have a centralized:

```text
AuditEvent
```

for consequential privileged/system actions.

Conceptually:

```text
AuditEvent
- id
- actorUserId?
- actorType
- action
- targetType
- targetId
- reason?
- metadata
- createdAt
```

The metadata must never contain secrets.

---

# 50. Audit Event Does Not Replace Domain History

Architecture freeze:

Use explicit domain history for:

- Connection assignments;
- Mission assignments;
- proposal versions;
- Quick Offer versions;
- Payment Attempts;
- refunds;
- Completion Attempts;
- Incidents.

Use AuditEvent to record:

> who or what performed consequential transitions.

---

# 51. Account State

User/account authorization should distinguish role from current ability to operate.

Conceptually:

```text
UserStatus
ACTIVE
SUSPENDED
DEACTIVATED
```

Relais eligibility remains separate.

Do not combine all operational restrictions into one role enum.

---

# 52. Relais Eligibility

Conceptually:

```text
RelaisEligibility
APPROVED
UNDER_REVIEW
REVOKED
```

Exact names may change.

Only approved/eligible Relais enter automatic matching.

---

# 53. Core ERD

Conceptually:

```text
User
├── CustomerProfile
└── RelaisProfile

Customer User
    │
    └── Connection
          │
          ├── ConnectionAssignment ────── Relais User
          │
          ├── Conversation
          │      ├── Message
          │      └── CallAction
          │
          ├── QuickOffer(s)
          │
          ├── ManagedProposal(s)
          │
          └── Mission?
                 │
                 ├── MissionAssignment(s) ── Relais User
                 │
                 ├── PaymentObligation(s)
                 │      └── PaymentAttempt(s)
                 │
                 ├── MissionExpense(s)
                 │
                 ├── Refund(s)
                 │
                 ├── MissionUpdate(s)
                 │
                 ├── CompletionAttempt(s)
                 │
                 ├── Rating?
                 │
                 └── Incident(s)

Connection ─────────────── Incident(s)

User / financial context ─ Incident(s)

Privileged actions
    └── AuditEvent
```

---

# 54. Cardinality Freeze

V1 conceptual cardinalities:

```text
User
1 → 0..1 CustomerProfile

User
1 → 0..1 RelaisProfile

Customer User
1 → many Connections

Connection
1 → many ConnectionAssignments

Connection
1 → 0..1 Conversation

Conversation
1 → many Messages

Connection
1 → many QuickOffers

Connection
1 → many ManagedProposals

Connection
1 → 0..1 Mission

Mission
1 → many MissionAssignments

Mission
1 → many PaymentObligations

PaymentObligation
1 → many PaymentAttempts

Mission
1 → many MissionExpenses

Mission
1 → many Refunds

Mission
1 → many MissionUpdates

Mission
1 → many CompletionAttempts

Mission
1 → 0..1 Customer Rating

Connection
1 → many possible Incidents

Mission
1 → many possible Incidents
```

---

# 55. Important One-to-One Decision

V1 preserves:

```text
Connection
→ 0..1 Mission
```

Do not relax this merely because future multi-Mission conversations are imaginable.

Real operational evidence must justify that change.

---

# 56. Important Historical Decision

The following are modeled append-first:

```text
ConnectionAssignment
MissionAssignment
QuickOffer
ManagedProposal
PaymentAttempt
Refund
MissionUpdate
CompletionAttempt
Incident history
AuditEvent
```

Avoid “current mutable record only” designs for these domains.

---

# 57. Current State vs Historical State

Some entities still require current state for efficient operation.

Examples:

```text
Connection.lifecycle
Mission.lifecycle
QuickOffer.status
ManagedProposal.status
PaymentObligation.status
Incident.lifecycle
RelaisProfile.availability
```

Current state may mutate through valid transitions.

Historical events supporting important transitions remain preserved.

---

# 58. State Machine Principle

Every lifecycle enum must have explicit allowed transitions in service/domain logic.

Do not allow arbitrary:

```text
status = anything
```

through generic update endpoints.

Examples:

```text
Connection
MATCHING → CONNECTED
```

may be valid.

```text
MISSION_CREATED → MATCHING
```

should not happen casually.

---

# 59. Service Layer Owns Transitions

UI components and route handlers must not directly implement domain transitions.

Preferred architecture:

```text
UI / API action
    ↓
Application service
    ↓
Domain rules
    ↓
Transactional persistence
```

Examples of future services:

```text
requestConnection()
matchConnection()
reassignConnection()

sendTextMessage()

createQuickOffer()
acceptQuickOffer()

createManagedProposal()
acceptManagedProposal()

createPaymentObligation()
confirmPayment()

publishMissionUpdate()
proposeCompletion()
respondToCompletion()

openIncident()
resolveIncident()
```

Names may change.

The boundary is foundational.

---

# 60. No Generic CRUD Architecture

RELAIS should not be implemented primarily as:

```text
POST /mission
PATCH /mission/:id
PATCH /payment/:id
```

with unrestricted data mutations.

Business actions should be explicit.

Prefer:

```text
acceptQuickOffer()
```

over:

```text
updateQuickOffer({ status: "ACCEPTED" })
```

This protects domain invariants.

---

# 61. Authorization Belongs in Services

Every business action must verify:

- authenticated actor;
- role;
- account state;
- ownership/assignment;
- record state;
- applicable operational authority.

Do not rely on screen hiding.

---

# 62. Transaction Boundaries

Critical transitions must be atomic.

Examples include:

### Matching

```text
verify candidate
+
create assignment
+
update Connection state
```

### Quick Acceptance

```text
verify offer pending
+
mark accepted
+
create exactly one Mission
+
create financial obligation if policy requires
```

### Managed Acceptance

```text
verify proposal version valid
+
mark accepted
+
create exactly one Mission
+
create required obligations
```

### Reassignment

```text
end old assignment
+
create new assignment
+
update current ownership context
```

These should not be spread across unrelated uncoordinated writes.

---

# 63. Concurrency

The implementation must explicitly handle races around:

- matching;
- Customer cancellation during matching;
- Relais availability changes;
- Quick Offer revision vs acceptance;
- Proposal revision vs acceptance;
- duplicate Customer acceptance;
- duplicate payment callbacks;
- completion response;
- reassignment.

Database transactions and uniqueness constraints should enforce correctness wherever possible.

---

# 64. Idempotency

Idempotency is required for:

- Connection creation/request retry;
- offer acceptance;
- proposal acceptance;
- payment callback processing;
- refunds;
- selected message/upload operations where retries may occur.

Do not solve idempotency only in the client.

---

# 65. Database Constraints

Domain correctness should use database constraints where practical.

Examples:

- one Conversation per Connection;
- one Mission per Connection;
- valid foreign keys;
- unique provider transaction reference where appropriate;
- one rating per Customer/Mission;
- unique proposal version per Connection;
- nonnegative monetary amounts where appropriate.

Service logic complements database constraints.

---

# 66. Soft Deletion

V1 should avoid generic `deletedAt` on every entity.

Deletion semantics differ by domain.

Operational history such as:

- Missions;
- Offers;
- Proposals;
- Payments;
- Updates;
- Incidents;

should normally not be deleted through ordinary product actions.

Profile/account deactivation is different from deleting business history.

---

# 67. Data Retention

V1 preserves operational history by default.

Formal retention/anonymization policy is deferred.

Architecture must not make lawful future anonymization impossible.

---

# 68. Customer Identity Preservation

Historical Mission/Connection records should continue to reference the original Customer identity even if the account is later deactivated.

Account state changes must not orphan business history.

---

# 69. Relais Identity Preservation

Historical assignments, Messages, Updates, Offers, and audit records must preserve who acted even if that Relais later:

- leaves RELAIS;
- becomes suspended;
- changes role;
- changes display name.

Do not cascade-delete historical involvement.

---

# 70. Current Relais Derivation

Prefer deriving the current Relais from the active assignment record.

Do not create multiple competing sources of truth such as:

```text
Connection.relaisId
+
ConnectionAssignment active record
```

unless a later performance optimization deliberately maintains them transactionally.

One source of truth first.

---

# 71. Current Mission Owner Derivation

Same principle:

derive current Mission assignment from active `MissionAssignment`.

Do not prematurely duplicate ownership fields.

---

# 72. Mission Customer Derivation

The Mission Customer can be derived from originating Connection.

During implementation, duplicating `customerId` may improve authorization/query ergonomics.

If duplicated, the service must enforce:

```text
Mission.customerId
=
Connection.customerId
```

The simpler source-of-truth design is preferred unless queries materially suffer.

---

# 73. Proposal Acceptance Link

Mission should reference the accepted commercial basis.

Do not derive accepted proposal solely by searching status history later.

Prefer an explicit reference such as:

```text
acceptedQuickOfferId
```

or:

```text
acceptedManagedProposalId
```

with a constraint that exactly one applies according to Mission depth.

---

# 74. Payment Provider Boundary

Create a provider adapter boundary.

Conceptually:

```text
PaymentProvider
- initiate payment
- verify/confirm payment
- refund when supported
```

Domain services consume provider-independent results.

Do not scatter Orange Money logic throughout Mission services.

---

# 75. Notifications Boundary

Push notifications are side effects, not domain truth.

Preferred flow:

```text
business transaction succeeds
    ↓
notification requested
```

A failed notification must not roll back a valid Mission acceptance.

Use retryable delivery mechanisms where appropriate.

---

# 76. Object Storage Boundary

Object storage handles:

- voice notes;
- photos;
- documents;
- receipts.

The database stores:

- ownership;
- metadata;
- access context;
- object reference.

Never expose unrestricted public object URLs for sensitive assets.

---

# 77. Expo Mobile Architecture

One Expo application serves:

```text
CUSTOMER
RELAIS
```

with role-specific protected route groups.

Conceptually:

```text
(public)
(customer)
(relais)
```

A role determines the experience after authentication.

The app does not become the authorization authority.

---

# 78. Admin Architecture

Operations/Admin should use a separate web application.

Preferred V1:

```text
Next.js
```

The web Admin consumes the same authoritative backend/domain services as mobile.

Do not duplicate business rules separately in mobile and Admin.

---

# 79. Backend Architecture

V1 needs one authoritative backend serving both:

```text
Expo mobile
Next.js Admin
```

The exact deployment style may be decided during implementation.

The domain/service layer should remain independent of frontend framework concerns.

---

# 80. Repository Structure Decision

The current repository began as:

```text
relais-app
```

Architecture freeze does not require immediate monorepo restructuring.

Preferred implementation sequence:

1. Build mobile/domain/backend foundation cleanly.
2. Add Admin application when its phase begins.
3. Restructure into workspace/monorepo only when shared packages make it materially useful.

Do not spend architecture time moving folders before real code exists.

---

# 81. Prisma Timing

Prisma schema should be introduced only after this architecture freeze is committed.

The first database ticket should translate these conceptual entities into the smallest correct V1 schema.

Do not create every future field in one schema pass.

---

# 82. V1 Must-Have Entities

These are the entities we expect to implement for the pilot unless a later ticket proves a simpler representation is sufficient:

```text
User
CustomerProfile
RelaisProfile

Connection
ConnectionAssignment

Conversation
Message

QuickOffer
ManagedProposal

Mission
MissionAssignment

PaymentObligation
PaymentAttempt
MissionExpense
Refund

MissionUpdate
CompletionAttempt
Rating

Incident

AuditEvent
```

---

# 83. Conditional V1 Entities

Implement only when their associated feature requires them:

```text
CallAction
IncidentNote
specific Attachment entities
Category
CustomerActionRequest
```

Do not add them simply because they appear conceptually useful.

---

# 84. Explicitly Deferred Entities

Do not implement in the first architecture phase:

```text
FieldExecutorProfile
ExecutorAssignment
RelaisEarnings
RelaisWallet
CustomerWallet
Subscription
Organization
BusinessAccount
Route
LiveLocation
Task/Subtask
AIAnalysis
Translation
FavoriteRelais
RelaisMarketplaceListing
ServiceCatalog
PromotionEngine
RiskScore
AvailabilityHistory
MatchingSession
```

---

# 85. No Service Catalog in Customer Domain

The customer app has no catalog of services.

Internal Category may exist.

This architectural distinction must be preserved.

The homepage remains centered on:

> **Besoin d'aide avec une course ?**

> **Connecter à un Relais**

---

# 86. No AI Dependency

No V1 domain transition depends on AI.

If AI is unavailable, RELAIS must still function fully.

Humans remain authoritative for:

- understanding;
- qualification;
- scope;
- pricing;
- safety judgment.

---

# 87. No GPS Dependency

Matching does not depend on live GPS.

Mission execution does not require live tracking in V1.

The Relais is a coordination relationship, not necessarily the physical executor.

---

# 88. No In-App Calling Requirement

V1 uses native phone handoff.

Do not delay pilot launch for VoIP.

---

# 89. No Executor App Requirement

Physical execution remains operational/manual where necessary.

Do not delay launch building software for people the Customer does not need to interact with.

---

# 90. Architecture Consistency Audit

Tickets 0A–0K are consistent on these critical principles:

### Connection precedes Mission

No contradiction.

### Customer does not categorize request

No contradiction.

### Relais chooses QUICK or MANAGED

No contradiction.

### QUICK Offer precedes QUICK Mission

No contradiction.

### Managed Proposal precedes MANAGED Mission

No contradiction.

### Mission created on structured Customer acceptance

No contradiction.

### Payment follows acceptance as separate prerequisite

No contradiction.

### Execution may require confirmed payment

No contradiction.

### Conversation survives Mission creation

No contradiction.

### Tracker uses Updates, not giant status enum

No contradiction.

### Assignment history is preserved

No contradiction.

### Commercial history is versioned

No contradiction.

### Financial history is append-oriented

No contradiction.

### Incident and Audit are separate

No contradiction.

---

# 91. One Important Clarification — “Course acceptée”

Customer QUICK copy may say:

> **Course acceptée**

before Customer acceptance.

Internally this must mean:

> **RELAIS confirms feasibility and offers to perform the course at the stated price.**

It must never be interpreted internally as:

> Mission already exists.

The Mission begins only after Customer structured acceptance.

This copy is a UX phrase, not a domain-state name.

---

# 92. One Important Clarification — Mission ACTIVE

A Mission created after Customer acceptance may still be awaiting payment or other prerequisites.

Therefore `ACTIVE` may be too ambiguous as the first persisted lifecycle state.

During implementation, consider a small lifecycle such as:

```text
PENDING_EXECUTION
ACTIVE
COMPLETION_PENDING
COMPLETED
CANCELLED
FAILED
```

where:

`PENDING_EXECUTION`

means:

> Agreement exists, but execution prerequisites remain.

This is not fully frozen yet because payment implementation should test whether it improves clarity.

The architectural requirement is:

> **Mission existence and execution readiness must remain distinct.**

---

# 93. One Important Clarification — QUICK Price

QUICK requires a price for the Customer Offer.

That price must represent clearly defined commercial terms.

When external Mission Funds are also needed, the implementation must not overload one `price` field to mean both:

- RELAIS fee;
- Customer spending budget.

Ticket 0I remains authoritative.

---

# 94. One Important Clarification — Conversation and Structured Events

The Conversation screen may show:

- Quick Offer;
- Proposal;
- Payment request;
- Mission Update;
- Completion request.

Do not store those records as generic Messages.

Instead, the UI composes a chronological timeline from several domains.

---

# 95. Timeline Architecture

The frontend may need a unified timeline.

Do not necessarily create a database `TimelineItem` table.

The backend/application layer can aggregate:

```text
Message
QuickOffer events
ManagedProposal events
Payment events
MissionUpdates
Completion events
```

sorted chronologically.

Only introduce a materialized timeline entity if performance later justifies it.

---

# 96. Security Freeze

The following server-side rules are non-negotiable:

1. Customer can access only own Connection/Mission data.

2. Relais can access only assigned operational scope.

3. Candidate Relais cannot see Customer details before assignment.

4. Admin privileged changes are auditable.

5. Internal Notes/Updates never leak through Customer endpoints.

6. Object-storage access follows domain authorization.

7. Payment state is server-authoritative.

8. Role alone never bypasses ownership checks.

---

# 97. Historical Integrity Freeze

Do not overwrite:

- old assignments;
- old Quick Offers;
- old Proposal versions;
- successful/failed Payment Attempts;
- Refund records;
- Mission Updates;
- Completion Attempts;
- resolved Incidents;
- meaningful Audit events.

Corrections create new historical facts.

---

# 98. Simplicity Freeze

Before adding any entity or field, ask:

1. Does V1 use it?
2. Does historical correctness require it now?
3. Can it be derived?
4. Can Conversation carry this context instead?
5. Is this modeling an observed business fact or a hypothetical future?

If the answer does not justify persistence, do not add it.

---

# 99. First Implementation Phases After Freeze

Architecture phase ends here.

Implementation should proceed approximately:

```text
1A — Repository & App Foundation

1B — Identity, Roles & Authorization Foundation

1C — Core Domain Schema
     User
     Profiles
     Connection
     Assignment
     Conversation

2A — Customer Home & Connection Request

2B — Relais Availability

2C — Matching Service

2D — Matching Experience

3A — Text Conversation

3B — Voice Messages

3C — Native Call Handoff

4A — QUICK Offer Domain

4B — QUICK Customer Acceptance

4C — QUICK Mission Creation

5A — MANAGED Proposal Domain

5B — MANAGED Proposal Acceptance

6A — Payment Foundation

6B — Mission Updates

6C — Completion

7A — Admin Operations

7B — Incidents & Audit

8A — Pilot Hardening
```

Each implementation ticket should remain narrow.

---

# 100. Architecture Freeze Rule

After this document is approved:

> **No foundational entity or lifecycle should change casually during implementation.**

Changes are allowed when:

- implementation exposes a contradiction;
- real Mission operations invalidate an assumption;
- security requires correction;
- historical correctness requires correction.

A change should be documented explicitly rather than silently drifting away from the architecture.

---

# 101. What Is Frozen

Frozen for V1:

- Customer / Relais / Admin actor model;
- Connection-before-Mission;
- one Connection → at most one V1 Mission;
- assignment history;
- human-first Conversation;
- QUICK vs MANAGED;
- Quick Offer before QUICK Mission;
- versioned Proposal before MANAGED Mission;
- structured Customer acceptance;
- Mission created on acceptance;
- acceptance distinct from payment;
- RELAIS Fee distinct from Mission Funds;
- broad Mission lifecycle;
- Mission Update tracker;
- Completion Attempts;
- Incident domain;
- Audit complementing domain history;
- one Expo app for Customer + Relais;
- separate Admin web application;
- no field-executor app in V1;
- no AI dependency;
- no customer service catalog.

---

# 102. What Is Not Frozen

Still implementation-level decisions:

- authentication provider;
- exact database enum names;
- exact Prisma field names;
- backend hosting;
- payment provider;
- object-storage provider;
- notification provider;
- exact Mission lifecycle enum;
- attachment schema;
- Category implementation;
- exact capacity formula;
- exact abandonment timeouts;
- exact payment/refund policies;
- exact Customer completion review window;
- exact UI design.

These decisions must respect the frozen domain.

---

# 103. V1 Architecture Test

Before implementation is considered architecture-compliant, we must be able to represent this scenario without hacks:

### Scenario A — QUICK

Customer requests Connection.

Mamadou is matched.

They talk in Mooré by voice.

Mamadou selects QUICK.

He enters:

```text
2 000 FCFA
```

Customer receives:

> Course acceptée — 2 000 FCFA.

Customer accepts.

Exactly one Mission is created.

Customer pays.

Mamadou posts:

> Clé récupérée.

Then:

> Clé remise à Fatou.

Mamadou proposes completion.

Customer confirms.

Customer rates Mamadou.

All history remains reconstructable.

---

# 104. V1 Architecture Test — MANAGED

Cheick requests Connection.

Mamadou is matched.

They discuss SONABEL and ONEA.

Mamadou selects MANAGED.

Proposal v1 is drafted.

A change produces proposal v2.

Cheick accepts v2.

Exactly one Mission is created referencing v2.

Cheick pays the RELAIS fee.

Later ONEA requires additional official fees.

RELAIS requests Mission Funds.

Cheick pays.

Expense is recorded.

Mission receives updates over several weeks.

Mamadou is later replaced by Aïcha.

Assignment history remains.

Aïcha proposes completion.

Cheick confirms.

Unused Customer funds are refunded.

Mission becomes operationally complete and later financially closed.

Nothing requires historical overwriting.

---

# 105. V1 Architecture Test — Failure

Customer connects to Mamadou.

Request appears suspicious.

No Mission is created.

Connection is declined.

Fraud-related Incident is opened against the Connection.

Operations reviews it.

Incident is resolved.

Connection history remains.

No fake Mission exists.

---

# 106. V1 Architecture Test — Concurrency

Two Customers request help simultaneously.

Only eligible/available Relais are considered.

Assignment occurs transactionally.

No Connection obtains two active Relais.

No Relais exceeds enforced capacity through a race.

A Customer cancellation racing with assignment produces one authoritative result.

---

# 107. V1 Architecture Test — Financial Integrity

Customer pays:

```text
9 000 FCFA RELAIS Fee
50 000 FCFA Mission Funds
```

RELAIS spends:

```text
35 000 FCFA
```

The system must report:

```text
RELAIS Fee:        9 000 FCFA
Mission Funds:    50 000 FCFA
Expenses:         35 000 FCFA
Customer balance: 15 000 FCFA
```

It must never report:

```text
59 000 FCFA revenue
```

---

# 108. Final ERD Summary

```text
                         ┌────────────────┐
                         │      User      │
                         └───────┬────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
          CustomerProfile                RelaisProfile
                                                │
                                        eligibility /
                                         availability

Customer User
      │
      ▼
┌──────────────┐
│  Connection  │
└──────┬───────┘
       │
       ├──── ConnectionAssignment ───── Relais User
       │
       ├──── Conversation
       │        │
       │        └──── Message
       │
       ├──── QuickOffer(s)
       │
       ├──── ManagedProposal(s)
       │
       ├──── Incident(s)
       │
       └──── Mission?
                 │
                 ├──── MissionAssignment(s)
                 │
                 ├──── PaymentObligation(s)
                 │          │
                 │          └──── PaymentAttempt(s)
                 │
                 ├──── MissionExpense(s)
                 │
                 ├──── Refund(s)
                 │
                 ├──── MissionUpdate(s)
                 │
                 ├──── CompletionAttempt(s)
                 │
                 ├──── Rating?
                 │
                 └──── Incident(s)

Privileged / consequential actions
                 │
                 └──── AuditEvent
```

---

# 109. Architecture Freeze Statement

RELAIS V1 is now architecturally defined as:

> **A human-first coordination platform where a Customer first connects to a trusted Relais, explains a need naturally, and only then enters the minimum structured workflow necessary for RELAIS to accept, fund, execute, track, and complete that responsibility.**

The application remains simple because the organization absorbs complexity.

The domain remains rigorous because the system preserves:

- responsibility;
- agreement;
- money;
- history;
- safety;
- accountability.

---

# 110. Final Principle

> **Connect first. Understand second. Structure only what matters. Preserve the truth forever enough to remain accountable.**

Architecture is frozen for V1.

Implementation may now begin.
