# RELAIS Payments & Mission Funds

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

---

## 1. Purpose

This document defines the financial domain for RELAIS Missions.

Its purpose is to preserve a strict distinction between:

- money earned by RELAIS;
- money entrusted to RELAIS for Mission execution;
- money paid to third parties;
- refundable Customer funds;
- reimbursement obligations;
- payment state;
- Mission execution readiness.

This document defines business semantics.

It does not select:

- Orange Money;
- Moov Money;
- card processor;
- bank;
- payment API;
- accounting software.

Those are implementation and provider decisions.

---

# 2. Core Principle

> **Money received by RELAIS is not automatically RELAIS revenue.**

A Customer payment may contain several economically different amounts.

The system must preserve what every amount represents.

---

# 3. Fundamental Financial Categories

At minimum, RELAIS must distinguish:

```text
RELAIS FEE
MISSION FUNDS
EXTERNAL EXPENSE
REFUND
```

These concepts must never be collapsed merely because they pass through the same payment provider.

---

# 4. RELAIS Fee

A RELAIS Fee is compensation earned by RELAIS for providing the service.

Examples include:

- QUICK course fee;
- coordination fee;
- service charge;
- urgency surcharge when introduced;
- approved supplemental service fee.

Conceptually:

```text
Customer pays RELAIS 9 000 FCFA
for coordination.

9 000 FCFA
= RELAIS Fee
```

This is economically different from money provided to purchase something on the Customer's behalf.

---

# 5. Mission Funds

Mission Funds are Customer-provided funds entrusted to RELAIS for approved Mission expenses.

Examples:

- purchase budget;
- government fee budget;
- transport budget where separately handled;
- third-party service budget;
- administrative fees;
- other authorized Mission expenses.

Mission Funds are not automatically RELAIS revenue.

---

# 6. Example

Customer accepts:

```text
RELAIS coordination fee:     9 000 FCFA

Approved external budget:   50 000 FCFA
```

Total Customer funding:

```text
59 000 FCFA
```

RELAIS revenue is not automatically:

```text
59 000 FCFA
```

The system must preserve:

```text
9 000 FCFA
→ RELAIS compensation

50 000 FCFA
→ Customer Mission Funds
```

---

# 7. External Expense

An External Expense is money spent to fulfill a Mission but not retained by RELAIS as compensation.

Examples:

- government fee;
- merchant purchase;
- taxi fare;
- courier expense;
- document fee;
- technician payment;
- other approved third-party cost.

External Expenses reduce available Mission Funds.

They do not reduce the agreed RELAIS Fee unless the commercial agreement explicitly says otherwise.

---

# 8. Customer Approval

RELAIS must not materially spend Customer Mission Funds without authorization.

Authorization may come from:

- accepted proposal;
- accepted QUICK terms;
- later explicit Customer approval;
- pre-approved budget threshold.

The exact mechanism depends on Mission type.

---

# 9. No Accidental Customer Lending

RELAIS should not routinely finance Customer Missions using company operating cash.

Default principle:

> **Required Mission Funds should be received before RELAIS incurs the corresponding external expense.**

Exceptions must be deliberate and authorized.

---

# 10. Protected Mission Float

RELAIS may maintain internal operational float for:

- settlement timing;
- emergency reimbursement;
- small temporary advances;
- provider delay;
- operational continuity.

Internal float does not change Customer financial responsibility.

It must not become an informal lending model.

---

# 11. Payment Obligation

A Payment Obligation represents an amount the Customer is expected to pay.

Examples:

```text
QUICK service fee
2 000 FCFA
```

or:

```text
MANAGED coordination fee
40 000 FCFA
```

or:

```text
Additional approved expense budget
25 000 FCFA
```

Different obligations may exist for one Mission.

---

# 12. Payment Is Not the Mission

A Mission may exist while payment is still outstanding.

Therefore:

```text
Mission
≠
Payment
```

The Mission records accepted responsibility.

Payment records whether financial prerequisites have been satisfied.

---

# 13. Acceptance vs Payment

Customer acceptance and Customer payment are distinct events.

Conceptually:

```text
Offer / Proposal accepted
        ↓
Mission created
        ↓
Payment obligation exists
        ↓
Payment confirmed
        ↓
Execution may begin
```

where prepayment is required.

---

# 14. Payment Does Not Automatically Mean Execution Began

Payment confirmation means:

> the relevant financial condition has been satisfied.

It does not necessarily mean:

- a Relais has departed;
- an office has been visited;
- a purchase has occurred;
- Mission execution has started.

Mission execution state remains separate.

---

# 15. Execution Readiness

A Mission may require several prerequisites.

Examples:

```text
Payment confirmed
Customer documents received
Required authorization received
External funds available
```

Only when necessary prerequisites are satisfied should execution begin.

Payment is one prerequisite, not the universal Mission status.

---

# 16. QUICK Payment Semantics

For a typical QUICK flow:

```text
QUICK Offer
    ↓
Customer accepts
    ↓
Mission created
    ↓
Payment required
    ↓
Payment confirmed
    ↓
Execution begins
```

V1 should prefer prepayment for chargeable QUICK Missions.

---

# 17. Why QUICK Should Prefer Prepayment

QUICK Missions often begin immediately.

Without prepayment, RELAIS could:

- incur transport costs;
- perform work;
- lose time;
- later discover that the Customer will not pay.

Prepayment keeps the flow simple and financially safe.

---

# 18. MANAGED Payment Semantics

MANAGED Missions may support more flexible payment arrangements.

Examples:

### Full Prepayment

```text
Proposal accepted
→ full RELAIS fee paid
→ Mission funded
→ execution begins
```

### Deposit

```text
Proposal accepted
→ deposit paid
→ Mission begins
→ later installment due
```

### Milestone Funding

```text
Proposal accepted
→ first payment
→ stage completed
→ next payment
```

The exact commercial policy may evolve.

The domain should not assume every MANAGED Mission uses one payment.

---

# 19. V1 Simplicity

Although the domain should support multiple obligations conceptually, V1 should prefer simple payment structures.

For example:

- one QUICK fee;
- one MANAGED service fee;
- separate Mission Funds when needed.

Do not build installment plans before real Missions require them.

---

# 20. Service Fee vs Expense Budget

The Customer experience should clearly distinguish:

```text
Honoraires RELAIS
```

from:

```text
Budget de la mission
```

or equivalent wording.

The Customer should understand:

- what RELAIS earns;
- what money may be spent externally.

---

# 21. Known External Costs

If an external cost is known before acceptance, it may be included clearly in the offer or proposal.

Example:

```text
Honoraires RELAIS:        9 000 FCFA
Transport:                3 000 FCFA
Purchase budget:         25 000 FCFA
```

The financial model should preserve what each line means.

---

# 22. Unknown External Costs

Some costs cannot be known in advance.

Example:

> SONABEL or ONEA may determine official fees only after reviewing the file.

The proposal may state:

> External fees will be communicated for approval before payment.

Unknown costs must not be fabricated merely to make the proposal look complete.

---

# 23. Additional Funding Request

During Mission execution, RELAIS may discover that additional Mission Funds are required.

The system should support a structured funding request.

Conceptually:

```text
Additional Mission Funds required

Amount:
15 000 FCFA

Reason:
Official administrative fee

[ Approve and pay ]

[ Decline ]
```

The Customer's response becomes part of Mission financial history.

---

# 24. Additional Funding Is Not a New Mission

A request for additional approved Mission Funds remains attached to the existing Mission.

It does not require a new Connection or Mission unless the underlying scope has materially changed.

---

# 25. Additional RELAIS Fee

If new scope requires additional compensation to RELAIS, that is different from asking for Mission Funds.

Example:

```text
Additional government fee
→ Mission Funds

Additional two days of coordination
→ additional RELAIS Fee
```

The system must preserve this distinction.

---

# 26. Scope Changes and Pricing

Material scope expansion may require:

- revised QUICK commercial terms;
- MANAGED Mission amendment;
- supplemental RELAIS Fee;
- additional Mission Funds;
- explicit Customer agreement.

Financial changes must reflect operational reality rather than arbitrary payment requests.

---

# 27. Currency

Every financial amount must have an explicit currency.

V1 may primarily use:

```text
XOF
```

for FCFA.

The system should not assume all future amounts use FCFA merely because V1 launches in Burkina Faso.

---

# 28. Amount Precision

Money must be represented using appropriate fixed monetary semantics.

The implementation must not use floating-point arithmetic that can introduce financial rounding errors.

Exact implementation is deferred.

---

# 29. Payment Attempt

A Payment Attempt represents one effort to satisfy a Payment Obligation through a payment method or provider.

One obligation may have several attempts.

Example:

```text
Payment obligation:
9 000 FCFA

Attempt 1
Orange Money
FAILED

Attempt 2
Orange Money
SUCCESS
```

The failed attempt remains history.

---

# 30. Payment Status

Conceptually, a Payment Obligation may move through states such as:

```text
PENDING
PAID
PARTIALLY_PAID
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

A Payment Attempt may separately have states such as:

```text
INITIATED
PENDING
SUCCEEDED
FAILED
CANCELLED
```

Exact enum design is deferred.

The distinction between obligation and attempt is important.

---

# 31. Why Payment Obligation and Payment Attempt Differ

A Customer owes:

```text
9 000 FCFA
```

That is one obligation.

They may try:

- Orange Money once;
- retry Orange Money;
- use another provider.

Those attempts should not create multiple debts.

---

# 32. Provider Confirmation Is Authoritative

The system should not mark a digital payment successful merely because the Customer tapped:

> Payer

Payment success must be based on authoritative provider confirmation or an authorized manual reconciliation process.

---

# 33. Client-Side Payment State Is Not Authoritative

The mobile application may display payment progress.

It must not independently decide that money was received.

Server-side payment confirmation is authoritative.

---

# 34. Idempotency

Payment integrations must be idempotent.

Provider retries, callbacks, or network retries must not:

- create duplicate payments;
- credit the same obligation twice;
- create multiple refunds;
- create duplicate Missions.

Financial idempotency is mandatory.

---

# 35. Duplicate Provider Notification

A payment provider may notify RELAIS more than once about the same successful payment.

The system must recognize that it is the same financial event.

Repeated notification must not increase the Customer's paid balance.

---

# 36. Manual Payment Confirmation

V1 may need to support certain manually verified payment methods.

If so, manual confirmation must record:

- who confirmed;
- when;
- payment method;
- reference or supporting evidence where applicable;
- amount;
- reason when required.

Manual confirmation must remain auditable.

---

# 37. Cash

RELAIS may eventually receive cash.

Cash creates additional control requirements.

If cash is supported:

- receipt must be recorded;
- collector must be identified;
- amount must be reconciled;
- transfer into company custody must be traceable.

Cash should not become an invisible side-channel outside the system.

---

# 38. Personal Accounts

Relais employees should not casually instruct Customers to send Mission payments to personal accounts.

Payment destinations must be approved by RELAIS.

This protects:

- Customers;
- staff;
- reconciliation;
- company ownership of revenue;
- fraud prevention.

---

# 39. Relais Financial Authority

A Relais may:

- propose an authorized price;
- see whether required payment has been satisfied;
- request approved additional Mission funding;
- upload expense evidence.

A Relais should not automatically have authority to:

- alter settled financial history;
- issue arbitrary refunds;
- reconcile their own unexplained discrepancies;
- modify company-wide pricing rules.

---

# 40. Admin Financial Authority

Authorized Admins may perform actions such as:

- review payment history;
- reconcile payments;
- approve refunds;
- correct permitted metadata;
- resolve provider discrepancies;
- review expenses.

Financial corrections must remain auditable.

---

# 41. Expense Recording

When Mission Funds are spent, RELAIS should record the External Expense.

An expense should eventually preserve:

- Mission;
- amount;
- currency;
- purpose;
- spender or submitter;
- date;
- evidence when required;
- Customer visibility where appropriate;
- approval context.

---

# 42. Expense Evidence

Depending on Mission type, evidence may include:

- receipt;
- invoice;
- photo;
- payment confirmation;
- official document;
- written explanation.

Evidence requirements should be proportional.

---

# 43. No Receipt Does Not Automatically Mean Invalid Expense

Real-world operations may occasionally involve legitimate expenses without formal receipts.

The system should support:

- documented explanation;
- supervisor review;
- alternative evidence;

rather than forcing employees to fabricate receipts.

---

# 44. Expense Approval

Not every small approved Mission expense requires supervisor approval.

Operational thresholds may determine:

- automatic approval;
- Relais authority;
- Customer approval;
- supervisor approval.

Threshold values belong to operational configuration.

---

# 45. Customer Expense Visibility

Customers should be able to understand how their Mission Funds were used.

For relevant Missions, they may see:

```text
Budget reçu:            50 000 FCFA

Dépenses:
SONABEL                 20 000 FCFA
Transport                3 000 FCFA

Solde restant:          27 000 FCFA
```

Exact presentation may vary.

Transparency is foundational.

---

# 46. Mission Fund Balance

For funded Missions, RELAIS should eventually be able to compute:

```text
Mission Funds received

minus

approved External Expenses

minus

returned amounts

=

remaining Customer balance
```

The balance should be derived from financial records rather than manually edited.

---

# 47. Unused Mission Funds

Unused Customer Mission Funds do not become RELAIS revenue merely because the Mission completed.

Default principle:

> **Unused Customer funds remain Customer funds.**

They should be:

- refunded;
- returned;
- carried forward only through explicit Customer authorization and policy.

---

# 48. No Automatic Conversion of Unused Funds Into Fees

If:

```text
Customer provided:       50 000 FCFA
Actual expenses:         35 000 FCFA
```

the remaining:

```text
15 000 FCFA
```

does not silently become RELAIS income.

---

# 49. Refund

A Refund returns previously received funds to the Customer.

Refunds may apply to:

- RELAIS Fees;
- Mission Funds;
- both.

The system must preserve what was refunded and why.

---

# 50. Refund Is a New Financial Event

Refunding money must not delete or rewrite the original successful payment.

History should show:

```text
Payment received
        ↓
Refund issued
```

not:

```text
Payment never happened
```

---

# 51. Full Refund

A full refund returns the relevant refundable amount.

The original payment remains historical.

The obligation may then be financially settled through refund semantics.

---

# 52. Partial Refund

A partial refund may occur when:

- some work was already completed;
- external costs were already incurred;
- only unused Mission Funds remain;
- agreed non-refundable charges apply.

The system should support partial amounts conceptually.

---

# 53. Refund Authorization

A Relais should not unilaterally issue significant refunds.

Refunds should follow authorized operational policy.

The approving actor must remain attributable.

---

# 54. Failed Mission Does Not Automatically Mean Full Refund

A Mission may fail despite legitimate work and external expenses already occurring.

Refund outcome depends on:

- agreed scope;
- work performed;
- cause of failure;
- expenses incurred;
- Customer responsibility;
- RELAIS responsibility;
- policy.

Mission outcome and financial outcome are related but not identical.

---

# 55. Cancellation Does Not Automatically Mean Full Refund

Similarly, cancellation timing matters.

Example:

```text
Customer cancels before execution
```

may differ financially from:

```text
Customer cancels after Relais already traveled
and paid a third-party fee.
```

The system must preserve enough history to make a fair decision.

---

# 56. Chargebacks and Payment Disputes

Card or payment-provider disputes may occur later.

The financial domain should not assume that a successful payment can never be reversed externally.

Exact chargeback handling is provider-specific and deferred.

---

# 57. Reconciliation

Reconciliation answers:

> **Does RELAIS's internal financial record agree with the money that actually moved?**

Reconciliation may compare:

- provider transactions;
- bank/mobile-money records;
- cash records;
- internal Payment records;
- refunds;
- expenses.

This is an Admin responsibility.

---

# 58. Reconciliation Is Not Mission Completion

A Mission may be operationally complete while financial reconciliation remains open.

Therefore:

```text
Mission completed
```

does not necessarily mean:

```text
Financially closed
```

---

# 59. Financial Closure

A Mission may be financially closed when:

- required RELAIS Fees are settled;
- Mission Funds are reconciled;
- expenses are recorded;
- unused Customer funds are resolved;
- refunds are resolved;
- no known financial discrepancy remains.

The exact closure implementation may come later.

---

# 60. Mission Closure Depends on Financial Integrity

A Mission should not be considered fully administratively closed while unexplained Customer funds remain.

Operational completion and administrative closure are separate.

---

# 61. Provider Abstraction

The RELAIS domain should not define Mission payment state using provider-specific concepts such as:

```text
ORANGE_MONEY_PAID
```

Instead:

```text
payment obligation
payment attempt
payment method/provider
payment outcome
```

Provider details belong below domain semantics.

---

# 62. Multiple Payment Providers

A future Customer may pay using:

- Orange Money;
- Moov Money;
- card;
- bank transfer;
- another provider.

The Mission should not care which provider was used beyond financial records.

---

# 63. Diaspora Payments

Future diaspora payment methods may differ from Burkina Faso payment methods.

This is another reason currency and payment provider must remain explicit.

The core financial model should survive new payment rails.

---

# 64. Payment Provider Fees

Payment-provider fees are business expenses.

They should not be confused with Customer Mission expenses unless explicitly passed through under commercial policy.

The accounting layer may later track provider fees separately.

V1 Mission semantics do not need to expose them to Customers by default.

---

# 65. Relais Earnings

V1 does not need a sophisticated Relais earnings or commission system.

Staff compensation may initially be handled outside the Mission transaction model.

Do not assume:

```text
Customer fee
→ automatic Relais percentage
```

until the employment/compensation model is actually established.

---

# 66. Field Executor Compensation

Similarly, executor compensation is an internal RELAIS operational cost.

It should not automatically be modeled as Customer-visible Mission pricing.

A later finance layer may track internal cost allocation.

V1 should avoid premature payroll complexity.

---

# 67. Revenue Recognition

The domain must preserve enough semantics so that later financial reporting can determine what belongs to RELAIS.

A Customer transfer alone is not sufficient evidence of revenue.

The system must know why the money was received.

---

# 68. Internal Financial Notes

Financial records may require internal notes.

Internal notes must remain separate from Customer-visible financial explanations.

Sensitive financial operations must not leak into customer-facing interfaces accidentally.

---

# 69. Audit History

Important financial actions must remain attributable.

Examples:

- manual payment confirmation;
- refund approval;
- refund issuance;
- expense adjustment;
- balance correction;
- obligation cancellation;
- reconciliation decision.

Financial history must never depend solely on employee memory.

---

# 70. Corrections

Financial mistakes may need correction.

Corrections should use:

- compensating records;
- explicit adjustments;
- auditable actions;

rather than silently editing settled historical amounts.

Exact adjustment modeling is deferred.

---

# 71. Financial Data Access

### Customer

May access financial information related to their own Missions and intended for them.

### Relais

May access enough financial state to operate the assigned Mission.

### Admin

May access broader financial information according to operational authority.

No actor gains unrestricted financial access merely because the UI exposes a page.

---

# 72. Sensitive Provider Data

The system should not expose:

- secret payment credentials;
- full sensitive payment tokens;
- private provider configuration;

to Customers or Relais.

Provider secrets remain server-side.

---

# 73. Weak Connectivity

Payment flows must assume unreliable mobile networks.

The system should clearly distinguish:

```text
Payment processing
```

from:

```text
Payment confirmed
```

A Customer should not be asked to pay again merely because the app temporarily lost confirmation while the provider was still processing.

---

# 74. Pending Payment

A pending state is legitimate.

The app should communicate uncertainty honestly.

Example:

> **Paiement en cours de confirmation.**

Do not display:

> **Paiement échoué**

unless failure is actually known.

---

# 75. Customer Retry

A Customer may retry after a confirmed failure.

The system should avoid encouraging duplicate payments while a prior attempt remains pending.

---

# 76. Overpayment

A Customer may accidentally pay more than required.

The system should preserve:

- amount expected;
- amount actually received;
- resulting excess.

Excess funds should be handled explicitly rather than silently absorbed.

---

# 77. Underpayment

If the Customer pays less than the required amount:

- obligation remains partially unsettled;
- execution policy determines whether work may proceed.

Do not mark the obligation fully paid.

---

# 78. Tips

Tips are not required for V1.

If introduced later, tips must be financially distinct from:

- RELAIS Fee;
- Mission Funds;
- required payment.

Do not overload the core payment model with gratuity logic now.

---

# 79. Discounts and Promotions

Discounts may be introduced later.

A discount modifies the amount owed.

It should not rewrite the original pricing basis without history.

V1 does not need a generic promotions engine.

---

# 80. Taxes

The financial architecture must eventually support legal tax obligations.

However, tax rules should be introduced based on actual legal and accounting requirements.

Do not hardcode speculative tax semantics into the Mission domain.

---

# 81. Financial Metrics

The domain should eventually allow RELAIS to derive:

- gross Customer payments;
- RELAIS Fees collected;
- Mission Funds received;
- External Expenses;
- refunds;
- unpaid obligations;
- payment failure rate;
- average payment confirmation time;
- Mission contribution margin when internal costs are later available.

Metrics must distinguish transaction volume from revenue.

---

# 82. Do Not Use Gross Transaction Value as Revenue

If RELAIS processes:

```text
10 000 000 FCFA
```

of Customer money in one month, but:

```text
7 000 000 FCFA
```

was merely purchase budgets and official fees, RELAIS did not generate:

```text
10 000 000 FCFA revenue.
```

Financial reporting must preserve economic truth.

---

# 83. Payment Non-Goals

V1 does not require:

- Customer wallet;
- stored balance;
- peer-to-peer transfers;
- Relais wallet;
- automated payroll;
- cryptocurrency;
- lending;
- credit;
- complex subscriptions;
- split payouts;
- automatic commissions;
- foreign exchange engine;
- loyalty credits;
- advanced invoicing.

---

# 84. Core Invariants

The eventual implementation must preserve at least these invariants:

1. A Customer payment is not automatically RELAIS revenue.

2. RELAIS Fees and Mission Funds are distinct.

3. External Expenses are distinct from RELAIS Fees.

4. Mission creation and payment confirmation are separate events.

5. Required prepayment must be confirmed before execution begins.

6. A Payment Obligation may have multiple Payment Attempts.

7. A successful provider event must not be credited twice.

8. Customer acceptance retries must not create duplicate Missions or duplicate obligations.

9. Failed Payment Attempts remain historical.

10. Refunds do not erase original payments.

11. Unused Mission Funds do not automatically become RELAIS revenue.

12. Material Customer spending requires authorization.

13. Payment success is server-authoritative.

14. Relais cannot silently alter settled financial history.

15. Financial corrections remain auditable.

16. Operational Mission completion and financial closure are distinct.

17. Every monetary amount has an explicit currency.

18. One payment provider's terminology must not define the core domain.

19. Customer financial data remains scoped to their own Missions.

20. Financial history must be reconstructable without relying on employee memory.

---

# 85. Conceptual Model

Without committing to Prisma:

```text
Mission
    │
    ├── Payment Obligation(s)
    │       │
    │       └── Payment Attempt(s)
    │
    ├── Mission Funding
    │       │
    │       ├── funds received
    │       ├── additional funding
    │       └── remaining balance
    │
    ├── External Expense(s)
    │
    ├── Refund(s)
    │
    └── Financial adjustments / audit history
```

Potential money purpose:

```text
RELAIS_FEE
MISSION_FUNDS
```

Potential expense:

```text
External Expense
→ consumes Mission Funds
```

The exact schema remains deliberately open.

---

# 86. QUICK Example

Customer asks:

> Deliver my keys to my nanny.

Relais selects QUICK.

Price:

```text
2 000 FCFA
```

Customer accepts.

Mission created.

Payment obligation:

```text
RELAIS Fee
2 000 FCFA
```

Payment confirmed.

Execution begins.

No Mission Funds are necessary.

This is the simplest financial case.

---

# 87. QUICK Purchase Example

Customer asks:

> Buy medicine and bring it to my mother.

Commercial terms:

```text
RELAIS Fee:             3 000 FCFA
Approved purchase fund: 8 000 FCFA
```

Customer funds:

```text
11 000 FCFA
```

Later:

```text
Medicine:               6 500 FCFA
```

Remaining Customer funds:

```text
1 500 FCFA
```

That remaining money stays attributable to the Customer.

It does not become RELAIS revenue.

---

# 88. MANAGED Example

SONABEL and ONEA Mission:

```text
RELAIS coordination fee:
40 000 FCFA
```

Customer accepts proposal.

Mission created.

Customer pays coordination fee.

Later, ONEA requires:

```text
15 000 FCFA official fee
```

RELAIS sends a structured Mission funding request.

Customer approves and pays.

RELAIS records:

```text
15 000 FCFA Mission Funds received
15 000 FCFA External Expense
```

RELAIS revenue remains based on the coordination fee, not the official fee.

---

# 89. Foundational Financial Test

For every Mission involving money, RELAIS should eventually be able to answer:

1. What did the Customer agree to pay RELAIS?
2. What money was intended for external Mission expenses?
3. What payment obligations existed?
4. Which attempts were made?
5. Which payments actually succeeded?
6. Which provider or method handled them?
7. What external expenses occurred?
8. Who authorized those expenses?
9. What Customer funds remain?
10. What was refunded?
11. What amount actually belongs economically to RELAIS?
12. Can every material financial action be reconstructed without guessing?

If not, the financial model is incomplete.

---

# 90. Customer Experience Test

The Customer should never wonder:

> **Where did my money go?**

They should be able to understand:

> **This is what RELAIS charged me.**

> **This is what I gave RELAIS to spend for the Mission.**

> **This is what was actually spent.**

> **This is what remains or was refunded.**

Financial simplicity on the screen requires financial precision behind the scenes.

---

# 91. Relais Experience Test

The Relais should not need to become an accountant.

They should be able to see clearly:

> Payment confirmed.

> Mission funded.

> Additional Customer approval required.

> 15 000 FCFA available for this approved expense.

The system should enforce financial boundaries without making ordinary Mission execution bureaucratic.

---

# 92. Foundational Principle

> **RELAIS may handle Customer money, but it must never lose track of whose money it is or why it was received.**

Trust in RELAIS will depend as much on financial integrity as on successful Mission execution.
