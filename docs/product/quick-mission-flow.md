# RELAIS QUICK Mission Flow

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/relais-availability-and-matching.md`
- `docs/product/conversation-domain.md`
- `docs/product/mission-domain.md`

---

## 1. Purpose

This document defines the **QUICK Mission** flow in RELAIS.

A QUICK Mission exists to let a Relais move from understanding a simple request to customer agreement with almost no administrative friction.

The QUICK workflow must preserve:

- speed;
- clarity;
- accountability;
- structured customer acceptance;
- historical integrity.

The Relais should not be forced to complete a large form for a request that has already been clearly understood through Conversation.

---

# 2. Core Principle

> **If the Relais already understands a simple request, the system should ask only for the information that is still missing.**

For V1, the missing information may be as little as:

- the price.

Everything else should be inferred from:

- the existing Connection;
- the Conversation;
- the assigned Relais;
- system defaults;
- the QUICK decision itself.

---

# 3. Customer Does Not Choose QUICK

The Customer never chooses:

> QUICK

or

> MANAGED

The Relais chooses the appropriate operational depth after speaking with the Customer.

The Customer experience remains:

```text id="7pk7my"
Connect
→ Explain naturally
→ Receive offer
→ Accept or reject
```

---

# 4. QUICK Selection

After understanding the request, the Relais may select:

> **QUICK**

Selecting QUICK means:

- the request is sufficiently understood;
- the request does not require a MANAGED proposal;
- the request is within the Relais's permitted authority;
- the standard QUICK acceptance flow is appropriate.

The system should not ask the Relais to reconfirm facts already implied by this decision.

---

# 5. Minimum QUICK Input

V1 should require only:

```text id="ghc2yk"
Price
```

when operationally safe.

Example:

```text id="hqu4xp"
QUICK

Prix

[ 2 000 ] FCFA

[ Envoyer au client ]
```

Additional fields should not be required unless a real operational need is demonstrated.

---

# 6. Why Price Is Required

The Customer must know the commercial commitment before agreeing.

The system must preserve:

- offered price;
- currency;
- who created the offer;
- when it was created;
- whether it was accepted or rejected.

This information must not depend on parsing free-form chat.

---

# 7. QUICK Offer

Selecting QUICK and entering a price creates a structured **QUICK Offer**.

The QUICK Offer is not yet a Mission.

It represents:

> **RELAIS is willing to take responsibility for this request at these commercial terms if the Customer agrees.**

Conceptually:

```text id="pjyfq6"
Connection
    ↓
Conversation
    ↓
QUICK selected
    ↓
QUICK Offer
```

---

# 8. Mission Does Not Exist Before Acceptance

For V1, the preferred rule is:

> **A QUICK Mission is created only after the Customer explicitly accepts the QUICK Offer.**

Before acceptance, RELAIS has made an offer.

It has not yet begun an accepted Mission.

This preserves the Mission definition:

> accepted responsibility.

---

# 9. QUICK Offer Customer Message

The system generates the customer-facing offer automatically.

The Relais should not type it manually.

Example:

> **Course acceptée**
> Prix : **2 000 FCFA**

Actions:

> **Accepter**

> **Refuser**

The exact wording may evolve.

The business meaning must remain explicit.

---

# 10. Why the Message Says “Course acceptée”

This wording communicates:

> RELAIS can take care of this.

It does not mean the Customer has accepted the commercial terms yet.

The Customer still performs the structured acceptance action.

Internally, the system must distinguish:

```text id="z1wsba"
RELAIS has accepted feasibility
```

from:

```text id="s08a0h"
Customer has accepted the offer
```

---

# 11. QUICK Offer Is a Structured Business Record

The customer-facing card may appear inside Conversation.

The underlying QUICK Offer remains a proper business record.

It should eventually preserve:

- originating Connection;
- Relais;
- Customer;
- price;
- currency;
- created time;
- status;
- accepted or rejected time;
- superseded time when applicable.

---

# 12. QUICK Offer Status

Conceptually, a QUICK Offer may be:

```text id="30eeck"
PENDING
ACCEPTED
REJECTED
SUPERSEDED
CANCELLED
```

Exact persisted enum names may differ.

The semantics are foundational.

---

# 13. Customer Acceptance

The Customer accepts by tapping the structured:

> **Accepter**

The system must not infer acceptance from chat messages such as:

> “Oui.”

> “D'accord.”

> “Vas-y.”

Conversation may continue.

Formal acceptance remains explicit.

---

# 14. Customer Rejection

The Customer may tap:

> **Refuser**

The QUICK Offer becomes rejected.

No Mission is created.

The Connection may:

- remain open for further discussion;
- receive a revised offer;
- end without a Mission.

Rejection does not automatically terminate the Connection.

---

# 15. Price Revision

The Relais may realize that the price should change before the Customer accepts.

Example:

```text id="99v19d"
Original offer:
2 000 FCFA

Revised offer:
3 000 FCFA
```

The original offer must remain historical.

The revised offer becomes the new active offer.

The old offer becomes superseded.

---

# 16. No Silent Price Editing

A pending QUICK Offer must not be silently overwritten from:

```text id="a1jjxw"
2 000 FCFA
```

to:

```text id="pt0l7f"
3 000 FCFA
```

without preserving the previous commercial fact.

Historical commercial terms matter.

---

# 17. One Active QUICK Offer at a Time

For one Connection, V1 should allow at most one current pending QUICK Offer.

Creating a revised QUICK Offer supersedes the previous pending one.

This prevents the Customer from seeing multiple simultaneously valid prices.

---

# 18. Acceptance Must Target a Specific Offer

Customer acceptance must identify the exact QUICK Offer being accepted.

This protects against a race such as:

```text id="ap9dpm"
Customer sees 2 000
Relais revises to 3 000
Customer taps old Accepter
```

The system must know which offer the Customer attempted to accept.

---

# 19. Superseded Offer Cannot Be Accepted

Once an offer is superseded, it is no longer valid for acceptance.

If the Customer attempts to accept an old offer, the system should respond with the current valid state.

It must not create a Mission using stale terms.

---

# 20. Idempotent Acceptance

Poor connectivity may send the acceptance request multiple times.

One accepted QUICK Offer must create at most one intended Mission.

Conceptually:

```text id="0lhjbx"
Offer accepted once
→ one Mission
```

not:

```text id="btj48v"
network retries
→ Mission A
→ Mission B
→ Mission C
```

---

# 21. QUICK Mission Creation

Once Customer acceptance is validly committed:

```text id="svbfof"
QUICK Offer
    ↓
Customer accepts
    ↓
Mission created
```

The Mission inherits authoritative context from:

- Customer;
- originating Connection;
- assigned Relais;
- QUICK depth;
- accepted price;
- default urgency;
- accepted Offer identity.

---

# 22. QUICK Mission Defaults

V1 QUICK Mission creation may automatically set:

```text id="im2dh5"
depth = QUICK
urgency = NORMAL
```

unless an authorized internal action already established otherwise.

The Relais should not manually select these defaults again.

---

# 23. Mission Summary

The Conversation may contain the full request context.

V1 should not require the Relais to rewrite a full description.

However, the system should preserve a minimal usable Mission summary when practical.

Possible approaches include:

- Relais optionally enters a short label;
- system uses a neutral generated label;
- Operations adds one later if needed.

The exact UX remains open.

The principle is:

> **Do not turn summary creation into a blocker for QUICK acceptance.**

---

# 24. QUICK and Conversation Context

The accepted QUICK Mission remains linked to the originating Connection and Conversation.

The Conversation explains what the Customer meant.

The QUICK Offer explains the agreed commercial terms.

The Mission records accepted responsibility.

Each layer has a distinct job.

---

# 25. Payment Timing

QUICK acceptance and payment are separate business events.

The Customer may accept the QUICK Offer before payment is confirmed.

The Mission may therefore conceptually exist in a pre-execution state while awaiting payment.

Exact payment state belongs to Ticket 0I.

---

# 26. Mission Must Not Execute Before Required Payment

If the configured payment policy requires payment before execution, then:

```text id="s8tyvx"
Offer accepted
→ Mission created
→ Payment required
→ Payment confirmed
→ Execution may begin
```

The Relais must not begin chargeable execution merely because the Customer tapped **Accepter**.

---

# 27. Why Create Mission Before Payment

Once the Customer accepts:

- RELAIS and the Customer have reached agreement;
- the Mission now represents accepted responsibility subject to the commercial payment condition.

This gives the system a durable object to attach:

- payment;
- updates;
- cancellation;
- execution.

The Mission is not yet necessarily executable.

---

# 28. Customer Acceptance Message

After acceptance, the Customer may see:

> **Course acceptée ✓**

followed by payment action when required.

The wording should clearly distinguish:

- agreement reached;
- payment still required;
- execution started.

Do not collapse these into one ambiguous state.

---

# 29. QUICK Payment Failure

If payment fails:

- the Mission remains historical;
- execution should not begin when prepayment is required;
- the Customer may retry;
- payment failure must not create duplicate Missions.

Payment logic belongs to Ticket 0I.

---

# 30. QUICK Cancellation Before Execution

If the Customer accepted but later cancels before execution begins, the Mission should be cancelled through structured Mission semantics.

It must not be deleted.

Refund consequences depend on payment and cancellation policy.

---

# 31. QUICK Cancellation After Execution Begins

Cancellation after execution begins may have different financial and operational consequences.

Examples:

- transport already incurred;
- item already collected;
- third-party fee already paid.

V1 policy may remain simple.

The domain must preserve that cancellation timing matters.

---

# 32. QUICK Execution

Once all execution prerequisites are satisfied, the Mission becomes active operational work.

Examples:

- Relais personally performs the errand;
- field person performs it;
- Relais makes the required call;
- Relais verifies information.

The Customer does not need to know internal staffing details unless operationally useful.

---

# 33. QUICK Progress

QUICK Missions should avoid heavy tracker bureaucracy.

A small number of meaningful updates is enough.

Examples:

```text id="130lok"
Mission acceptée
```

```text id="jypa06"
En cours
```

```text id="7fukmf"
Terminée
```

Optional meaningful update:

> Le colis a été récupéré.

Detailed universal sub-statuses are unnecessary.

---

# 34. QUICK Completion

A QUICK Mission completes when the agreed outcome has been achieved.

Examples:

- key delivered;
- office opening verified;
- package delivered;
- information obtained.

Completion should be a structured action.

A chat message saying:

> “C'est fait.”

does not alone create authoritative completion.

---

# 35. Completion Evidence

Some QUICK Missions may need evidence.

Examples:

- delivery photo;
- recipient confirmation;
- receipt;
- photo of location.

Other QUICK Missions may not.

Evidence must be proportional to the Mission.

Do not force a proof-upload ritual where it provides no value.

---

# 36. Customer Confirmation

V1 may allow the Customer to confirm completion.

However, the system should not require Customer confirmation for every QUICK Mission if the Customer becomes unavailable after objective completion.

Exact completion semantics belong to Ticket 0J.

---

# 37. Rating

After completion, the Customer may rate the Relais experience.

Rating should not block Mission completion.

It is optional Customer feedback.

---

# 38. QUICK Decline by RELAIS

If, during Conversation, the Relais determines the request cannot be accepted:

- no QUICK Offer is created;
- no Mission is created;
- the Connection records the appropriate non-Mission outcome.

QUICK is only selected when RELAIS can genuinely proceed.

---

# 39. QUICK to MANAGED Escalation Before Offer

If the request initially appears simple but the Relais realizes it requires more structure before sending an offer:

```text id="mm0fbf"
Conversation
→ QUICK considered
→ MANAGED chosen
```

No QUICK history needs to exist unless a QUICK Offer was actually created.

---

# 40. QUICK to MANAGED Escalation After Offer

If a QUICK Offer was already sent and new facts reveal that MANAGED handling is required:

- the pending QUICK Offer must be cancelled or superseded;
- historical QUICK Offer remains;
- the Connection continues;
- MANAGED assessment begins.

Do not silently transform the existing QUICK Offer into a MANAGED proposal.

---

# 41. QUICK to MANAGED After Customer Acceptance

If the Customer has already accepted and a QUICK Mission exists, discovering substantial hidden complexity is a Mission-scope event.

The system must preserve:

- original QUICK Mission;
- original accepted price;
- new operational reality.

Possible future behavior may include:

- Mission change proposal;
- controlled escalation;
- cancellation and replacement.

Exact semantics are deferred.

The system must never pretend the Mission was MANAGED from the beginning.

---

# 42. QUICK Offer Expiration

V1 may eventually support offer expiration.

Example:

> Offre valable pendant 30 minutes.

This is not required initially.

If introduced, expiration must be explicit and structured.

Do not infer expiration merely because time passed unless policy defines it.

---

# 43. Customer Disconnects While Offer Pending

If the Customer stops responding:

- offer may remain pending according to operational policy;
- Connection may eventually become abandoned;
- no Mission exists until acceptance.

Pending commercial interest is not accepted work.

---

# 44. Relais Becomes Unavailable While Offer Pending

A Relais switching availability to unavailable affects future matching.

It does not automatically cancel their current pending QUICK Offer.

If they can no longer handle the request, the offer must be explicitly withdrawn or the Connection reassigned.

---

# 45. Reassignment With Pending QUICK Offer

If the Connection is reassigned before Customer acceptance:

- the old Relais's QUICK Offer should not automatically remain valid unless Operations deliberately preserves it;
- assignment and commercial authority must remain coherent.

Default V1 principle:

> **Pending QUICK Offers belong to the Relais/Connection context in which they were created and should be reviewed on reassignment.**

Exact automatic invalidation is deferred to implementation design.

---

# 46. Reassignment After QUICK Mission Creation

If a QUICK Mission already exists, Mission reassignment follows Mission ownership rules.

The accepted commercial basis remains unchanged unless separately revised through an authorized process.

---

# 47. QUICK Price Currency

V1 may operate primarily in FCFA.

The underlying commercial model should still treat currency as explicit rather than assuming every price in all future markets is FCFA forever.

Exact schema design is deferred.

---

# 48. QUICK External Costs

A QUICK Mission price should not automatically imply that all external expenses are included.

Example:

> Buy medicine and deliver it.

There may be:

- RELAIS service fee;
- medicine purchase cost;
- transport or external expenses.

For very simple cases, RELAIS may present one all-inclusive price if policy permits.

The finance domain must preserve what each amount means.

---

# 49. QUICK Does Not Mean Fixed 9,000 FCFA

QUICK is an operational workflow, not a pricing tier.

A QUICK Mission may cost:

- 2,000 FCFA;
- 5,000 FCFA;
- 9,000 FCFA;
- another amount.

Price depends on operational reality and future policy.

---

# 50. QUICK Does Not Mean Immediate

QUICK means low-friction qualification.

A QUICK Mission could still be scheduled later.

Example:

> Tomorrow morning, deliver these documents.

The workflow can remain QUICK even when execution is not immediate.

---

# 51. QUICK Does Not Mean No Risk

A request may be simple to describe but unsafe or prohibited.

Example:

> Deliver this sealed package without knowing what it contains.

The Relais must still follow Mission Acceptance Policy.

QUICK never bypasses safety.

---

# 52. QUICK Does Not Bypass Verification

Where identity, ownership, authorization, or other verification is required, QUICK does not remove those requirements.

Minimal process means:

> only necessary process.

Not:

> no controls.

---

# 53. Customer UX Principle

The Customer should experience QUICK as:

```text id="p6gsxp"
I explained it.
    ↓
My Relais understood.
    ↓
They can do it for 2 000 FCFA.
    ↓
I accepted.
    ↓
It's being handled.
```

No customer-facing workflow should make a 15-minute errand feel like signing a consulting contract.

---

# 54. Relais UX Principle

The Relais should experience QUICK as:

```text id="8wc2ms"
I understand the request.
    ↓
[ QUICK ]
    ↓
Enter price.
    ↓
Send.
```

If routine QUICK qualification regularly takes more than a few seconds after the Conversation, the product is adding unnecessary friction.

---

# 55. System Automation Principle

Selecting QUICK should allow the system to infer:

- depth;
- default urgency;
- assigned Customer;
- assigned Relais;
- originating Connection;
- standard offer wording;
- acceptance actions;
- offer status;
- Mission creation rules.

The Relais should not manually reproduce these facts.

---

# 56. Structured Events in Conversation

The Customer Conversation timeline may render:

```text id="7f7oxl"
QUICK Offer sent
```

then:

```text id="1zn80c"
Offer accepted
```

then:

```text id="pdcjzi"
Payment confirmed
```

then:

```text id="ptyto9"
Mission started
```

These appear conversationally.

They remain authoritative domain events.

---

# 57. QUICK Metrics

The system should eventually be able to derive:

- QUICK Offers created;
- QUICK Offer acceptance rate;
- rejection rate;
- revision rate;
- average offered price;
- time from Connection to QUICK Offer;
- time from offer to acceptance;
- time from acceptance to payment;
- time from payment to completion;
- QUICK cancellation rate;
- QUICK Mission completion rate.

These should arise from real domain history.

---

# 58. QUICK Non-Goals

V1 QUICK does not require:

- automatic pricing;
- route calculation;
- live GPS;
- customer category selection;
- bidding;
- separate executor app;
- AI summarization;
- formal PDF proposals;
- complex approval chains;
- universal proof requirements;
- multi-step customer forms.

---

# 59. Core Invariants

The eventual implementation must preserve at least these invariants:

1. The Relais chooses QUICK, not the Customer.

2. QUICK selection does not itself create a Mission.

3. A structured QUICK Offer is created before Customer acceptance.

4. A QUICK Mission is created only after valid Customer acceptance.

5. Casual chat does not count as formal acceptance.

6. A QUICK Offer preserves exact commercial terms.

7. Price revisions do not overwrite earlier offers.

8. At most one pending QUICK Offer is valid for acceptance per Connection in V1.

9. A superseded offer cannot create a Mission.

10. Repeated acceptance requests cannot create duplicate Missions.

11. QUICK Missions default to `QUICK` depth and normal urgency.

12. Payment and acceptance are distinct events.

13. Required prepayment must be satisfied before execution begins.

14. Conversation remains the originating context.

15. QUICK does not bypass Mission Acceptance Policy.

16. QUICK does not require redundant Mission-description entry when Conversation already contains the necessary context.

17. Rejected QUICK Offers do not create Missions.

18. A QUICK Mission remains historical if later cancelled or failed.

---

# 60. Conceptual Flow

```text id="g7ks87"
Customer
    ↓
Connection
    ↓
Matched Relais
    ↓
Conversation
    ↓
Relais understands request
    ↓
Relais selects QUICK
    ↓
Relais enters price
    ↓
QUICK Offer created
    ↓
Customer receives:

Course acceptée
Prix : 2 000 FCFA

[ Accepter ] [ Refuser ]

        ┌────────────────────┐
        │                    │
     Refuse              Accept
        │                    │
        ↓                    ↓
No Mission           Mission created
Connection may              ↓
continue or end        Payment if required
                             ↓
                         Execution
                             ↓
                         Completion
                             ↓
                           Rating
```

---

# 61. Foundational QUICK Test

For every QUICK flow, RELAIS should eventually be able to answer:

1. Which Connection did the request come from?
2. Which Relais classified it as QUICK?
3. What price did they offer?
4. Were there earlier prices?
5. Which exact offer did the Customer accept?
6. When did acceptance occur?
7. Was exactly one Mission created?
8. Was payment required?
9. Was payment satisfied before execution where policy required it?
10. What happened during execution?
11. How did the Mission end?
12. Can the history be reconstructed without interpreting casual chat?

If not, the QUICK flow is incomplete.

---

# 62. Customer Experience Test

A good QUICK Mission should feel almost instantaneous after the human conversation.

The Customer should never think:

> “Why am I filling this out again?”

The Relais should never think:

> “Why am I documenting something we just discussed?”

The structured system should appear only at the moment where structure creates value:

> **price, agreement, payment, accountability, completion.**

---

# 63. Foundational Principle

> **QUICK is not a smaller Mission. QUICK is a smaller process around a Mission that is already easy to understand.**

RELAIS should preserve all necessary accountability while making simple work feel genuinely simple.
