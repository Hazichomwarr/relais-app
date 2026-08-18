# RELAIS Mission Updates & Completion

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/conversation-domain.md`
- `docs/product/mission-domain.md`
- `docs/product/quick-mission-flow.md`
- `docs/product/managed-mission-flow.md`
- `docs/product/payments-and-mission-funds.md`

---

## 1. Purpose

This document defines how RELAIS records Mission progress, communicates that progress to the Customer, determines when a Mission is complete, handles disagreement around completion, and preserves completion history.

The goal is to support both:

- a QUICK Mission lasting minutes;
- a MANAGED Mission lasting days or weeks.

The tracker must remain simple for the Customer while preserving enough operational truth for RELAIS.

---

# 2. Core Principle

> **Mission status stays broad. Mission Updates explain what is actually happening.**

RELAIS should not attempt to create one giant status enum representing every possible real-world step.

The world is too varied.

A package delivery and a six-week administrative process do not share the same detailed workflow.

---

# 3. Mission Lifecycle vs Mission Progress

Mission lifecycle answers:

> **What broad contractual state is this Mission in?**

Mission Updates answer:

> **What has happened in the real world?**

These must remain distinct.

---

# 4. Broad Mission Lifecycle

A conceptual V1 Mission lifecycle may include:

```text
ACTIVE
COMPLETION_PENDING
COMPLETED
CANCELLED
FAILED
```

Exact persisted names may change later.

The principle is that lifecycle remains intentionally small.

---

# 5. ACTIVE

A Mission is `ACTIVE` when RELAIS has accepted responsibility and execution may proceed according to its prerequisites.

`ACTIVE` does not mean someone is physically moving at every moment.

A Mission may remain active while waiting on:

- Customer action;
- third party;
- administration;
- scheduled date;
- external inspection;
- operational availability.

---

# 6. Mission Updates

A Mission Update is a durable record of meaningful Mission progress.

Examples:

> Le colis a été récupéré.

> Le dossier ONEA a été déposé.

> L'administration confirme être ouverte aujourd'hui jusqu'à 15h30.

> Nous attendons maintenant l'inspection SONABEL.

Mission Updates should communicate facts, not filler.

---

# 7. Meaningful Updates

An update is meaningful when it helps answer one or more of:

- What changed?
- What was completed?
- What is happening now?
- What are we waiting for?
- Does the Customer need to do something?
- Is there a delay?
- Has the expected timeline changed?
- Is additional money or authorization required?

---

# 8. Avoid Update Spam

RELAIS should not generate updates simply to create activity.

Examples of low-value updates:

> Toujours en cours.

> Nous travaillons dessus.

> Rien de nouveau.

Repeatedly sending meaningless updates reduces trust.

---

# 9. Update Author

Every durable Mission Update should preserve who created it.

Possible actors include:

- assigned Relais;
- authorized Admin;
- future execution actor if later introduced.

Author identity must remain historical.

---

# 10. Update Timestamp

Every Mission Update should preserve an authoritative creation time.

Customer device time must not be the sole source of truth.

---

# 11. Customer-Visible vs Internal Updates

Mission Updates must support a visibility boundary.

Conceptually:

```text
CUSTOMER_VISIBLE
INTERNAL
```

or equivalent semantics.

A Customer-visible update appears in the Customer tracker.

An internal update remains available only to authorized RELAIS personnel.

---

# 12. Internal Update Example

Internal:

> Le premier agent contacté n'est plus disponible. Mariam cherche un remplaçant.

Customer-visible:

> Un léger retard est prévu. Votre Relais vous tiendra informé dès que la nouvelle heure est confirmée.

The system must never expose internal wording accidentally.

---

# 13. Updates Are Not Conversation Messages

Mission Updates may be displayed inside the Conversation timeline.

They remain Mission records.

A free-form message from Mamadou:

> Je viens d'arriver.

is not automatically an authoritative Mission Update.

A structured update:

> Le dossier a été déposé.

is part of Mission history.

---

# 14. Conversational Presentation

The Customer app may render Mission Updates alongside Conversation content.

For example:

```text
Mamadou
Je suis sur place.

────────────────

✓ Mise à jour de mission
Le dossier ONEA a été déposé.
Reçu ajouté.

────────────────

Mamadou
Je vous tiens au courant dès que j'ai la prochaine étape.
```

This should feel natural without collapsing the underlying domains.

---

# 15. Tracker

The Customer tracker is a presentation of:

- broad Mission lifecycle;
- Customer-visible Mission Updates;
- relevant evidence;
- required Customer actions;
- payment or funding requests;
- completion state.

It is not a separate source of truth.

---

# 16. QUICK Tracker

QUICK Missions should have minimal tracking.

A typical QUICK experience may be:

```text
Mission acceptée
    ↓
En cours
    ↓
Terminée
```

with optional real-world update such as:

> Le colis a été récupéré.

Do not make a simple errand look like enterprise project management.

---

# 17. MANAGED Tracker

MANAGED Missions may show a richer timeline.

Example:

```text
Mission acceptée

Dossier préparé

Dossier ONEA déposé

En attente de retour ONEA

Inspection SONABEL prévue

Nouvelle demande de document

Document reçu

Démarches poursuivies
```

These are Mission Updates, not universal statuses.

---

# 18. Waiting

Waiting is a normal part of many Missions.

The system should be able to explain who or what RELAIS is waiting on.

Conceptually:

```text
WAITING_ON_CUSTOMER
WAITING_ON_THIRD_PARTY
WAITING_ON_RELAIS
```

may be useful as operational metadata.

These do not necessarily need to become primary Mission lifecycle states.

---

# 19. Why Waiting Should Not Explode the Status Enum

A Mission could be:

- active and waiting on Customer;
- active and waiting on ONEA;
- active and waiting until tomorrow morning;
- active and waiting for a field person.

These are contextual execution conditions.

The broad Mission remains active.

---

# 20. Customer Action Required

If the Customer must do something, the system should make that explicit.

Examples:

> Document requis.

> Approbation d'une dépense requise.

> Paiement complémentaire requis.

> Votre confirmation est nécessaire.

This is stronger than hiding the requirement inside chat.

---

# 21. Customer Action Request Is Structured

When the Mission depends on a concrete Customer decision, the system should prefer a structured action.

Examples:

```text
Approuver la dépense
```

```text
Téléverser le document
```

```text
Confirmer
```

rather than relying only on free-form Conversation.

---

# 22. Delay

A delay should be communicated when the expected timing materially changes.

A delay update should explain:

- what changed;
- whether RELAIS controls the delay;
- what happens next;
- whether the Customer must act.

---

# 23. Honest Delay Communication

Prefer:

> L'administration n'a pas traité le dossier aujourd'hui. Mamadou y retournera demain matin.

Avoid:

> Presque terminé.

when that is not known.

Trust is more important than optimistic wording.

---

# 24. Estimated Duration Changes

If reality materially changes the expected timeline, the original estimate remains historical.

The current expectation may be updated separately.

Example:

```text
Original estimate:
2–6 weeks

Current expectation:
approximately 7 weeks
```

Do not overwrite the original estimate as though it never existed.

---

# 25. Evidence

A Mission Update may include evidence.

Examples:

- photo;
- receipt;
- document;
- confirmation;
- screenshot;
- other approved proof.

Evidence should support Mission accountability.

---

# 26. Evidence Visibility

Evidence may be:

- Customer-visible;
- internal only.

A Customer should receive evidence relevant to their Mission.

Sensitive operational evidence may remain internal.

---

# 27. Evidence Authorization

Evidence inherits Mission authorization.

Storage location alone does not make evidence public.

Access must be checked through the owning Mission and visibility rules.

---

# 28. Evidence History

Evidence should eventually preserve:

- Mission;
- uploader;
- upload time;
- file reference;
- visibility;
- optional description;
- owning Update where applicable.

---

# 29. Proof Should Be Proportional

A QUICK information check may require no uploaded evidence.

A package delivery may benefit from a photo.

A government-document Mission may require receipts and copies.

Do not force one proof policy onto every Mission.

---

# 30. Execution Notes

Relais may need internal execution notes that are more detailed than Customer Updates.

These should remain internal.

Mission Updates intended for Customers should communicate what the Customer needs to know.

---

# 31. Completion

Completion begins when RELAIS believes the agreed Mission objective has been fulfilled.

The assigned Relais or authorized Operations actor initiates completion through a structured action.

A free-form message such as:

> C'est fini.

does not alone mark the Mission complete.

---

# 32. Completion Proposal

For V1, RELAIS should support a concept equivalent to:

```text
COMPLETION_PENDING
```

This means:

> RELAIS believes the Mission is complete and is presenting the result to the Customer.

The exact UX may vary by Mission depth.

---

# 33. Why Completion Pending Matters

Without this distinction, the system would jump directly from:

```text
ACTIVE
```

to:

```text
COMPLETED
```

without giving the Customer a clear opportunity to:

- review the result;
- raise a problem;
- confirm satisfaction when appropriate.

---

# 34. Completion Summary

When proposing completion, the Relais should provide enough information to explain the result.

For QUICK, this may be minimal:

> Clés remises à Fatou à 14h12.

For MANAGED:

> Les démarches prévues auprès de SONABEL et ONEA ont été finalisées selon le périmètre accepté. Les reçus et documents sont joints.

---

# 35. Completion Evidence

Required completion evidence should be attached before completion is proposed when possible.

Examples:

- delivery confirmation;
- receipt;
- document;
- photo;
- report.

---

# 36. Customer Completion Experience

The Customer may see:

> **Mission terminée**

with:

- result summary;
- evidence;
- final financial information when relevant;
- Customer actions.

Possible actions:

> **Confirmer**

> **Signaler un problème**

The exact wording may differ.

---

# 37. Customer Confirmation

Customer confirmation means:

> The Customer accepts that RELAIS has fulfilled the Mission as presented.

This is a structured action.

It should be preserved historically.

---

# 38. Customer Confirmation Is Not Always Required

Some Customers may:

- stop responding;
- be unavailable;
- forget to confirm;
- have no reason to reopen the app.

A clearly completed Mission should not remain indefinitely unresolved solely because the Customer never taps Confirm.

Therefore, V1 should support operational completion even without Customer confirmation under defined policy.

---

# 39. Auto-Completion After Review Window

A future or V1-simple policy may allow:

```text
Completion proposed
    ↓
Customer review window
    ↓
No dispute
    ↓
Mission completed
```

The exact review duration should be operational configuration, not hardcoded into the constitution.

---

# 40. Customer Problem Report

Instead of confirming, the Customer may select:

> **Signaler un problème**

This does not automatically mean RELAIS failed.

It means completion is disputed or additional review is needed.

---

# 41. Completion Dispute

A completion dispute may result from:

- missing item;
- incorrect destination;
- incomplete work;
- disagreement about scope;
- missing evidence;
- unexpected expense;
- Customer misunderstanding;
- another concern.

The Mission should remain under review rather than being deleted or rewritten.

---

# 42. Incident Relationship

Some completion disputes may become formal Incidents.

Not every dissatisfaction requires an Incident.

Operations determines escalation according to policy.

Ticket 0K will define incident semantics.

---

# 43. Mission Returns to Active Work

If the Customer raises a legitimate unresolved issue and RELAIS agrees more work is required, the Mission may return to active execution.

Historical completion proposal must remain preserved.

The system should show:

```text
Completion proposed
    ↓
Customer problem raised
    ↓
Additional work required
    ↓
Active execution continues
```

not erase the first completion attempt.

---

# 44. Repeated Completion Attempts

A Mission may have more than one completion proposal over time.

Example:

```text
Completion attempt 1
→ Customer reports missing proof

Additional work

Completion attempt 2
→ Customer confirms
```

Each material completion attempt should remain historically reconstructable.

---

# 45. Completion Is Against Agreed Scope

RELAIS completes the Mission when it fulfills the accepted responsibility.

It does not necessarily guarantee external outcomes that were never promised.

Example:

Mission:

> Coordinate and submit the SONABEL application.

If SONABEL later rejects the application for reasons outside RELAIS control, RELAIS may still have completed the agreed coordination Mission if the proposal did not guarantee connection approval.

---

# 46. External Outcome vs RELAIS Outcome

The system should preserve this distinction.

Possible conceptual information:

```text
Mission execution outcome:
COMPLETED

External result:
APPLICATION_REJECTED
```

This exact model is deferred.

The principle is important.

---

# 47. Failed Mission

A Mission may be marked failed when RELAIS cannot fulfill the accepted scope.

Failure may occur because of:

- operational impossibility discovered too late;
- lost required resource;
- unrecoverable execution failure;
- another reason preventing fulfillment.

Failure is distinct from cancellation.

---

# 48. Failure Is Structured

A failed Mission should preserve:

- failure time;
- reason;
- responsible decision-maker where applicable;
- Customer communication;
- financial consequences;
- incident relationship where relevant.

---

# 49. Failure Does Not Erase Work

Even if a Mission fails, its:

- Updates;
- expenses;
- payments;
- evidence;
- assignments;
- Conversations;

remain historical.

---

# 50. Cancellation

Cancellation ends Mission responsibility by decision rather than successful completion.

Cancellation may occur before or during execution.

The system should preserve:

- who initiated cancellation;
- when;
- reason where required;
- financial consequences;
- Customer communication.

---

# 51. Cancellation and Updates

A cancelled Mission may still have a rich operational history.

Example:

```text
Mission accepted
→ agent traveled
→ office found closed
→ Customer changes plan
→ Mission cancelled
```

That history must remain visible internally.

---

# 52. Completion and Payment

Operational completion does not necessarily mean financial closure.

There may still be:

- unused Mission Funds;
- refund;
- expense reconciliation;
- payment discrepancy.

The Mission can be operationally completed while financial administration remains open.

---

# 53. Financial Summary at Completion

Where relevant, the Customer should receive a simple financial summary.

Example:

```text
Honoraires RELAIS
9 000 FCFA

Budget Mission reçu
50 000 FCFA

Dépenses externes
35 000 FCFA

Solde à restituer
15 000 FCFA
```

Exact presentation may vary.

---

# 54. Completion Cannot Absorb Customer Funds

Unused Mission Funds do not become RELAIS revenue when the Mission is marked complete.

Completion must trigger or expose any remaining financial resolution.

---

# 55. Administrative Closure

A Mission may become fully closed only after:

- operational outcome is terminal;
- required Customer communication is complete;
- financial reconciliation is complete;
- incidents requiring closure are handled;
- required documentation exists.

This is conceptually later than operational completion.

---

# 56. CLOSED Need Not Be a Customer-Facing Status

The Customer may simply see:

> Terminée.

Internally, Operations may distinguish:

```text
COMPLETED
```

from:

```text
ADMINISTRATIVELY_CLOSED
```

Exact modeling is deferred.

---

# 57. Rating

After Mission completion, the Customer may rate their experience.

Rating should be optional.

The Mission does not depend on receiving a rating.

---

# 58. What Is Being Rated

V1 should primarily rate the RELAIS experience and/or assigned Relais.

The product should avoid prematurely creating separate ratings for:

- every field executor;
- every external merchant;
- every internal step.

Keep the Customer feedback simple.

---

# 59. Rating Timing

The Customer should normally rate after completion.

A rating must not become possible for a Mission that never reached a valid completion outcome unless a later product requirement justifies broader feedback.

---

# 60. Rating Immutability

Ratings may need correction or moderation later.

The system should not allow silent historical manipulation.

Exact review/moderation semantics are deferred.

---

# 61. Relais Cannot Rate Customer in V1

Although reciprocal ratings were discussed conceptually, V1 does not require Customer ratings by Relais.

If operational trust scoring is needed later, it should be deliberately designed rather than copied from marketplace patterns.

---

# 62. Mission Updates After Completion

Ordinary execution Updates should stop after Mission completion.

Post-completion information may instead belong to:

- Conversation;
- dispute;
- Incident;
- financial reconciliation;
- controlled correction.

Do not casually rewrite completed Mission history.

---

# 63. Completion Correction

If completion was recorded incorrectly, authorized Operations may correct the state.

The correction must remain auditable.

The system should preserve:

- original completion;
- correction;
- reason;
- actor.

---

# 64. Reopening

V1 should not offer casual one-tap reopening of completed Missions.

A legitimate post-completion problem may produce:

- dispute review;
- Incident;
- authorized additional work;
- new Connection for a genuinely new request.

Historical truth must remain intact.

---

# 65. New Request After Completion

If the Customer asks:

> “Pendant que vous y êtes, pouvez-vous aussi…”

after the original Mission is complete, ask whether this is:

- a true correction to the agreed scope;
- a new need.

A genuinely new need should normally start a new Connection.

---

# 66. Notifications

Mission Updates and completion actions may trigger notifications.

Examples:

> Nouvelle mise à jour de votre Mission.

> Mamadou indique que votre Mission est terminée.

> Une action est requise de votre part.

Notifications are delivery aids.

The Mission remains authoritative.

---

# 67. Notification Failure

A failed push notification must not mean the Update itself failed.

The Customer should see the Update when they reopen the app.

---

# 68. Weak Connectivity

Relais may post Updates from unreliable networks.

The system should support:

- visible pending state;
- safe retry;
- upload retry;
- idempotency;
- no false successful posting.

---

# 69. Duplicate Update Submission

Network retries must not accidentally create duplicate identical structured Updates when one intended submission occurred.

Exact idempotency mechanics are implementation concerns.

---

# 70. Update Editing

V1 should strongly prefer immutable Updates.

If a Relais makes a factual mistake, they should add a correction.

This preserves history.

Future edit capability, if introduced, must preserve prior versions.

---

# 71. Update Deletion

V1 should not support ordinary hard deletion of Mission Updates.

Updates may become important in:

- disputes;
- audits;
- incidents;
- financial review;
- Customer complaints.

Controlled privacy policies may later require redaction or deletion procedures.

---

# 72. Customer Update Frequency

RELAIS should establish operational expectations for how often Customers receive updates on long-running Missions.

The exact timing depends on Mission type.

Example policy might later require:

- update after each major event;
- periodic update during extended waiting;
- immediate update for material delay.

These are operational rules, not domain constants.

---

# 73. Customer Silence

Customer silence does not necessarily block Mission progress unless their action is actually required.

Do not pause a Mission simply because the Customer did not reply to a courtesy update.

---

# 74. Relais Silence

An active Mission should not remain without meaningful Customer communication beyond operational expectations.

Operations should be able to detect Missions needing attention.

Exact SLA thresholds are deferred.

---

# 75. Operations Visibility

Admins should be able to identify Missions that are:

- active;
- waiting;
- overdue;
- completion pending;
- disputed;
- financially unresolved;
- lacking recent Updates.

The exact dashboard belongs to later implementation.

The domain should expose enough truth to support it.

---

# 76. Completion and Reassignment

If a Mission is reassigned near completion, the new Relais must be able to see prior Updates and evidence.

Previous authorship remains unchanged.

The current Relais may submit the final completion proposal if authorized.

---

# 77. Internal Quality Review

Certain Missions may require internal review before final completion.

Examples:

- high-value Mission;
- sensitive document;
- significant incident;
- complex MANAGED case.

The domain should support review requirements without forcing all Missions through them.

---

# 78. QUICK Completion Example

Customer:

> Remettre une clé à la nounou.

Timeline:

```text
Mission accepted
Payment confirmed

Update:
Clé récupérée.

Update:
Clé remise à Fatou à 14h12.

Completion proposed.

Customer confirms.

Mission completed.
```

The entire process may take less than an hour.

---

# 79. Information Mission Example

Customer:

> Vérifier si une administration est ouverte aujourd'hui.

Timeline:

```text
Mission accepted.

Update:
Appel effectué à l'administration.

Update:
Ouverture confirmée aujourd'hui jusqu'à 15h30.

Completion proposed:
Information obtenue et confirmée.

Mission completed.
```

No physical delivery is necessary.

---

# 80. MANAGED Completion Example

SONABEL/ONEA:

```text
Mission accepted.

Update:
Documents reçus.

Update:
Dossier ONEA déposé.
Receipt attached.

Update:
Inspection SONABEL programmée.

Update:
Inspection réalisée.

Update:
Frais complémentaires demandés.
Customer approval required.

Update:
Payment received.

Update:
Dernière démarche administrative effectuée.

Completion proposed:
The agreed coordination process is complete.
Documents and receipts attached.

Customer confirms.

Mission completed.

Financial reconciliation continues if necessary.
```

---

# 81. Tracker Metrics

The domain should eventually support deriving:

- time from Mission creation to first Update;
- number of Customer-visible Updates;
- average Update frequency;
- time spent waiting on Customer;
- time spent waiting on third parties;
- time to completion proposal;
- completion confirmation rate;
- dispute rate;
- completion retry rate;
- average total Mission duration;
- rating rate.

---

# 82. Avoid Vanity Tracker Metrics

V1 does not need:

- animated percentage completion;
- fake 80% progress;
- arbitrary progress bars;
- AI completion estimates.

If RELAIS does not know a Mission is 63% complete, the app should not pretend it does.

---

# 83. No Universal Percentage Completion

Real-world missions rarely have objectively measurable percentage completion.

Prefer:

- clear Updates;
- current context;
- next expected step.

This is more trustworthy.

---

# 84. Customer Tracker Experience Test

The tracker should answer:

> What has happened?

> What is happening now?

> Is anything needed from me?

> What happens next?

> Who is my Relais?

It should not force the Customer to decode internal operations.

---

# 85. Relais Update Experience Test

Posting a meaningful update should be fast.

Conceptually:

```text
Ajouter une mise à jour

[ message ]

[ ajouter une preuve ]

Visibilité:
Customer
```

Then:

> Publier

Relais should not fill a complex project-management form each time something happens.

---

# 86. Core Invariants

The eventual implementation must preserve at least these invariants:

1. Mission lifecycle remains distinct from Mission Updates.

2. Detailed real-world progress is not encoded entirely in a giant Mission status enum.

3. Every durable Update belongs to exactly one Mission.

4. Update author and timestamp remain historical.

5. Customer-visible and internal Updates are distinct.

6. Mission Updates may be rendered conversationally without becoming generic messages.

7. A Conversation message does not silently change Mission state.

8. Completion is a structured action.

9. Completion may be proposed before it becomes final.

10. Customer disagreement with completion does not erase prior completion attempts.

11. Repeated completion attempts remain reconstructable.

12. Completion is measured against agreed Mission scope.

13. External outcomes outside RELAIS control are not automatically treated as RELAIS failure.

14. Cancellation, failure, and completion are distinct outcomes.

15. Mission completion does not imply financial closure.

16. Unused Mission Funds remain Customer funds after completion.

17. Ratings do not block Mission completion.

18. Reassignment does not rewrite Update authorship.

19. Mission Updates are not ordinarily hard-deleted.

20. Significant corrections remain auditable.

---

# 87. Conceptual Model

Without committing to Prisma:

```text
Mission
    │
    ├── lifecycle
    │
    ├── current execution context
    │
    ├── Mission Update(s)
    │       ├── author
    │       ├── text
    │       ├── visibility
    │       ├── evidence
    │       └── timestamp
    │
    ├── Customer Action Request(s)
    │
    ├── Completion Attempt(s)
    │       ├── proposed by
    │       ├── result summary
    │       ├── evidence
    │       ├── proposed at
    │       ├── Customer response
    │       └── resolution
    │
    ├── Rating
    │
    └── administrative closure context
```

The exact number of database entities remains open.

The historical concepts must survive implementation.

---

# 88. Foundational Mission Progress Test

For every Mission, RELAIS should eventually be able to answer:

1. What has happened since the Mission began?
2. Which Updates were shown to the Customer?
3. Which Updates remained internal?
4. Who created each Update?
5. What evidence supports important actions?
6. Is RELAIS waiting on anyone?
7. Does the Customer currently need to act?
8. Has completion been proposed?
9. Did the Customer confirm or dispute it?
10. Were multiple completion attempts required?
11. What was the final operational outcome?
12. Is financial reconciliation complete?
13. Can the full sequence be reconstructed without interpreting employee memory?

If not, the Mission progress model is incomplete.

---

# 89. Customer Experience Principle

The Customer should feel:

> **I know what's happening without having to chase anyone.**

That is one of RELAIS's most important promises.

The tracker exists to replace:

> “Any news?”

> “Did you go?”

> “What happened?”

> “Can you call them again?”

with calm, visible accountability.

---

# 90. Foundational Principle

> **A Mission Update turns invisible work into visible trust. Completion turns that trust into an accountable outcome.**

RELAIS should never make the Customer manage the Mission, but the Customer should never feel blind to it either.
