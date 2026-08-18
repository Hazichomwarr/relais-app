# RELAIS Actors & Authorization Boundaries

**Status:** Foundational
**Version:** 1.0
**Depends on:** `docs/product/constitution.md`

---

## 1. Purpose

This document defines:

- the principal actors in RELAIS;
- what each actor is responsible for;
- what each actor may access;
- what each actor may change;
- which operational responsibilities remain outside the customer application;
- which boundaries must be enforced by the backend rather than by the interface.

This document defines **authorization principles**, not framework-specific implementation.

The exact authentication provider, database schema, middleware, and route structure are intentionally deferred.

---

# 2. Authorization Principle

RELAIS follows one core rule:

> **Every actor sees only the information and actions necessary to fulfill their responsibility.**

The interface must reflect this rule.

The backend must enforce it.

Hiding a button does not create security.

A prohibited action must remain prohibited even if a user attempts to call the underlying API directly.

---

# 3. Principal Actors

RELAIS V1 has three authenticated application actors:

1. `CUSTOMER`
2. `RELAIS`
3. `ADMIN`

There may also be operational participants who do not receive application accounts in V1.

Most notably:

4. `FIELD_EXECUTOR` — operational concept only in V1

---

# 4. CUSTOMER

## Definition

A Customer is a person who uses RELAIS to obtain trusted assistance.

The Customer initiates the relationship by requesting connection to a Relais.

The Customer does not manage RELAIS operations.

---

## Customer Responsibilities

A Customer may:

- create and manage their own account;
- request a Connection;
- communicate with their assigned Relais;
- send text messages;
- send voice messages;
- send permitted attachments;
- receive mission offers or proposals;
- accept or reject a mission offer;
- pay required amounts;
- view their own mission history;
- view mission updates;
- view completion evidence intended for them;
- raise a problem concerning their own mission;
- rate completed experiences;
- manage their own profile and communication preferences.

---

## Customer Access Boundary

A Customer may access only information belonging to:

- their own account;
- their own Connections;
- their own Conversations;
- their own Missions;
- their own Proposals;
- their own Payments;
- customer-visible Mission Updates;
- customer-visible Attachments;
- their own Ratings;
- customer-visible incident or resolution information when explicitly exposed.

A Customer must never gain access to another Customer's records.

---

## Customer Restrictions

A Customer may not:

- browse available Relais as a marketplace;
- select arbitrary Relais unless the product explicitly introduces that behavior later;
- view another Relais's private operational information;
- view internal Relais performance data unless specifically exposed;
- create internal mission classifications;
- classify mission complexity;
- alter mission audit history;
- mark internal incidents resolved;
- reassign a mission;
- approve operational exceptions;
- edit payment reconciliation data;
- access internal notes;
- access other customers;
- administer RELAIS accounts;
- manipulate Relais availability.

---

# 5. RELAIS

## Definition

A Relais is a vetted human authorized by RELAIS to receive Customer Connections and take responsibility for understanding and coordinating requests.

A Relais is not merely a courier.

A Relais is the Customer's primary point of contact for a Connection and, when a Mission is created, typically remains the Customer-facing owner of that Mission.

---

## Relais Responsibilities

A Relais may:

- manage their own availability state;
- receive eligible assigned Connections;
- communicate with Customers assigned to them;
- evaluate whether a request can proceed;
- determine whether a request should follow QUICK or MANAGED handling;
- create or prepare mission information within permitted policy;
- propose pricing within their authority;
- send QUICK acceptance offers;
- prepare MANAGED proposals;
- add Mission Updates;
- upload execution evidence;
- communicate delays;
- request review;
- escalate concerns;
- propose mission completion;
- view the operational history necessary to manage their assigned work;
- manage their own profile and supported languages.

---

# 6. Relais Ownership Boundary

A Relais does **not** gain unrestricted access to all Customers or Missions merely because they hold the RELAIS role.

Their primary access is assignment-based.

A Relais may access:

- Connections currently assigned to them;
- Missions currently assigned to them;
- historical Connections and Missions where policy explicitly permits continued access;
- Conversations attached to those assigned records;
- operational details necessary to perform those responsibilities.

A Relais must not automatically gain access to unrelated Customers, Connections, Missions, or internal company records.

---

# 7. Relais Availability

Availability is an operational state, not a role.

A Relais may be:

- eligible to work;
- currently available for new Connections;
- unavailable for new Connections;
- managing existing Missions while unavailable for new Connections.

Therefore:

> **Role and availability must remain separate domain concepts.**

Becoming unavailable must not remove access to already assigned work.

---

# 8. Relais Restrictions

A Relais may not:

- approve their own elevated-risk exception where supervisor approval is required;
- modify immutable historical records;
- delete payment history;
- alter another Relais's availability;
- access unrelated Customer data;
- change another Relais's assignments without explicit authority;
- resolve serious incidents requiring ADMIN review;
- modify system-level pricing configuration;
- change global supported categories;
- manage ADMIN accounts;
- change organization-wide security settings;
- bypass mission acceptance policy;
- override protected financial controls.

---

# 9. ADMIN

## Definition

An Admin is an authorized internal operator responsible for supervision, safety, configuration, support, and operational control.

`ADMIN` is an application authorization role.

Operational job titles may later include:

- Operations Supervisor;
- Dispatcher;
- Finance Controller;
- Customer Support;
- Administrator.

V1 may combine several of those responsibilities under the same technical role.

This does not imply that they should remain permanently combined as the company grows.

---

## Admin Responsibilities

An Admin may:

- view operational Connections;
- view operational Missions;
- view Customers as necessary for support;
- view Relais accounts;
- approve or deactivate Relais access;
- manually assign or reassign Connections;
- manually assign or reassign Missions;
- review escalated requests;
- approve operational exceptions within policy;
- review incidents;
- manage mission categories and operational configuration;
- review payment state;
- perform permitted financial reconciliation;
- support Customers;
- support Relais;
- review audit history;
- inspect operational performance;
- resolve operational failures;
- manage service availability.

---

# 10. Admin Is Not Omnipotence

The ADMIN role does not mean:

> "May silently rewrite anything."

Historical and financial integrity still apply.

Admin actions that materially change operational truth must be:

- authorized;
- auditable;
- attributable to a specific Admin;
- historically preserved where appropriate.

Examples include:

- reassignment;
- refund;
- account deactivation;
- incident resolution;
- proposal cancellation;
- payment adjustment;
- mission cancellation.

An Admin may have broader authority than other actors without having authority to erase history.

---

# 11. FIELD_EXECUTOR

## Definition

A Field Executor is a person who physically or practically performs all or part of a Mission on behalf of RELAIS.

Examples may include someone who:

- delivers an item;
- visits an administration;
- verifies a location;
- collects a document;
- purchases something;
- accompanies a person;
- performs another approved operational action.

---

## V1 Application Boundary

A Field Executor is **not an authenticated mobile application role in V1**.

Field execution may initially be coordinated manually by:

- the assigned Relais;
- Operations;
- phone;
- WhatsApp;
- internal office processes.

This is intentional.

The first version of RELAIS should not build worker software before real operations prove that it is required.

---

## Future Evolution

A future version may introduce a dedicated execution actor.

Potential future capabilities may include:

- receiving assignments;
- accepting execution tasks;
- uploading proof;
- reporting expenses;
- updating execution status;
- submitting availability.

If introduced, this actor must receive its own explicit authorization model rather than inheriting RELAIS privileges.

---

# 12. One Person, Multiple Business Relationships

A human being may interact with RELAIS in different capacities over time.

For example:

- a Customer may later become a vetted Relais;
- a Relais may personally use RELAIS as a Customer.

The domain should not assume that human identity and operational role are permanently identical concepts.

However, V1 does not need sophisticated multi-role switching unless a real requirement emerges.

Role expansion should preserve existing historical identity.

---

# 13. Customer–Relais Assignment

A Customer does not permanently belong to one Relais.

The assignment belongs to the **Connection** and, when applicable, the **Mission**.

Therefore:

```text
Customer
    │
    ├── Connection A → Mamadou
    │
    ├── Connection B → Aïcha
    │
    └── Connection C → Issa
```

This allows RELAIS to match the most appropriate available person for each new request.

---

# 14. Connection Ownership

Every active Connection must identify:

- the Customer;
- the assigned Relais;
- its operational state.

Only authorized actors may alter the assignment.

The system must preserve assignment history when assignment changes materially affect the operational record.

Reassignment must not pretend the original assignment never happened.

---

# 15. Mission Ownership

A Mission must preserve clear responsibility.

At minimum, RELAIS needs to distinguish:

### Customer-facing Relais

The person responsible for the relationship with the Customer.

### Operational responsibility

The person or internal authority responsible for ensuring execution progresses.

V1 may allow one Relais to fulfill both responsibilities.

The domain must not assume they can never diverge.

---

# 16. Conversation Access

Conversation data may contain sensitive personal information.

Access must therefore be scoped.

### Customer

May access Conversations in their own Connections.

### Assigned Relais

May access Conversations necessary for Connections assigned to them.

### Admin

May access Conversations only when operationally necessary, such as:

- support;
- escalation;
- safety review;
- dispute investigation;
- reassignment.

Admin access does not imply unrestricted casual browsing.

---

# 17. Internal Notes vs Customer Communication

RELAIS must preserve a distinction between:

### Customer-visible communication

Content the Customer is intended to see.

### Internal operational notes

Content intended only for authorized RELAIS personnel.

Internal notes must never accidentally appear in the Customer application.

This boundary must be enforced at the data/API level.

---

# 18. Attachments

Attachments inherit the authorization context of the record to which they belong.

Examples:

- Conversation attachment;
- Mission proof;
- Internal incident evidence.

An attachment being stored in object storage does not make it public.

Access must be authorized through the owning domain record.

---

# 19. Payments

Payment access must be tightly restricted.

### Customer

May view payment obligations and transaction history related to their own Missions.

### Relais

May view the payment state necessary to know whether execution may proceed.

A Relais does not automatically require access to sensitive financial details beyond operational necessity.

### Admin

May access financial records necessary for:

- reconciliation;
- support;
- refunds;
- dispute handling;
- audit.

Financial changes must remain auditable.

---

# 20. Incidents

Incidents may contain highly sensitive operational information.

### Customer

May see only customer-facing information explicitly intended for them.

### Relais

May create or view incident information necessary for their assigned work.

### Admin

May review, manage, escalate, and resolve incidents according to policy.

Incident records must not be silently deleted after resolution.

---

# 21. Matching Authority

Customers request matching.

Customers do not directly grant themselves access to a Relais.

The matching system creates the assignment.

Admins may override assignment where operationally necessary.

A Relais must not be able to arbitrarily attach themselves to unrelated Customers.

---

# 22. Account State vs Role

Authorization must distinguish:

- what role an account has;
- whether that account is currently allowed to operate.

Conceptually, an account may be:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

A Relais may additionally have operational eligibility such as:

```text
APPROVED
UNDER_REVIEW
REVOKED
```

A role alone must not imply that an account is currently permitted to act.

Exact state names are deferred to domain modeling.

---

# 23. Relais Vetting Boundary

Creating a normal account must never be sufficient to become a Relais.

Relais access requires an explicit internal approval process.

Therefore:

> **RELAIS role assignment is privileged.**

A Customer cannot self-promote into operational access.

---

# 24. Authorization Is Server-Side

All protected operations must enforce authorization on the server.

Examples include:

- creating a Connection;
- accepting assignment;
- viewing Conversations;
- creating a Mission;
- changing Mission state;
- sending a Proposal;
- accepting a Proposal;
- recording Payment state;
- reassigning a Mission;
- managing incidents;
- changing Relais availability.

The mobile application is not an authorization boundary.

The web application is not an authorization boundary.

The API/service layer is.

---

# 25. Ownership Checks

Role checks alone are insufficient.

For example:

```text
role === RELAIS
```

does not mean the user may access every Mission.

Authorization must frequently combine:

```text
role
+
account state
+
record ownership / assignment
+
operational state
```

Example principle:

> A Relais may access Mission X only if they are authorized by role and Mission X is within their permitted operational scope.

---

# 26. Least Privilege

When choosing between:

- broader access for convenience;
- narrower access requiring deliberate escalation;

RELAIS defaults to narrower access.

Operational inconvenience can be improved later.

Unauthorized exposure cannot be undone.

---

# 27. Audit Principle

Important privileged actions should be attributable.

RELAIS should eventually be able to answer:

- Who performed the action?
- When?
- On which record?
- What changed?
- Why, when a reason is required?

The exact audit implementation is deferred.

The requirement is foundational.

---

# 28. Authorization Non-Goals for V1

V1 does not need:

- arbitrary custom roles;
- per-field permission builders;
- customer-created teams;
- organization-based customer tenancy;
- enterprise RBAC;
- field-executor application accounts;
- dozens of administrative permission levels.

Start with the smallest model that safely represents reality.

---

# 29. V1 Authorization Matrix

| Capability                         |                    CUSTOMER |                 RELAIS |                                    ADMIN |
| ---------------------------------- | --------------------------: | ---------------------: | ---------------------------------------: |
| Manage own profile                 |                         Yes |                    Yes |                                      Yes |
| Request Connection                 |                         Yes |                     No |                     Operational override |
| Manage own availability            |                          No |                    Yes |                                 Override |
| Communicate in assigned Connection |                    Own only |          Assigned only |                       Support/operations |
| Create QUICK offer                 |                          No |          Assigned only |                     Operational override |
| Prepare MANAGED proposal           |                          No |          Assigned only |                     Operational override |
| Accept/reject customer proposal    |                    Own only |                     No | Support override only when policy allows |
| Create Mission Updates             |                          No |          Assigned only |                                      Yes |
| View own Missions                  |                         Yes |          Assigned only |                                      Yes |
| Reassign Connection/Mission        |                          No |                     No |                                      Yes |
| Manage Relais approval             |                          No |                     No |                                      Yes |
| Manage incidents                   | Own customer-facing portion | Assigned participation |                                      Yes |
| Financial reconciliation           |                          No |                     No |                                      Yes |
| Manage operational configuration   |                          No |                     No |                                      Yes |
| Alter audit history                |                          No |                     No |                                       No |

---

# 30. Foundational Authorization Test

Before granting any capability, ask:

1. Does this actor need this capability to fulfill their responsibility?
2. Do they need access to every record or only assigned/owned records?
3. Could this expose another Customer's information?
4. Could this actor change historical truth?
5. Could this action create financial, safety, or trust risk?
6. Should the action require escalation instead?

When uncertain, grant less access.

---

# 31. Foundational Principle

> **RELAIS centralizes responsibility without centralizing unnecessary access.**

Customers control their own relationship.

Relais control the work assigned to them.

Admins supervise the operation.

No actor receives more authority merely because it is convenient to implement.
