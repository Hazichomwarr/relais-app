# RELAIS Product Constitution

**Status:** Foundational
**Version:** 1.0

---

## 1. Product Definition

RELAIS connects a person who needs something handled with a trusted human called a **Relais**.

The customer does not search through workers, service providers, or service categories.

The customer asks RELAIS to find someone for them.

The primary customer interaction begins with:

> **Besoin d'aide avec une course ?**

and one principal action:

> **Connecter à un Relais**

RELAIS then finds an eligible available Relais and establishes a direct human connection.

---

## 2. Core Product Promise

RELAIS exists to make obtaining trusted human assistance feel immediate and simple.

The customer should not have to understand RELAIS's internal organization before asking for help.

The customer should not have to:

- identify the correct service category;
- select a worker from a marketplace;
- understand operational complexity;
- structure the mission;
- determine the execution workflow.

The customer explains the situation naturally to their Relais.

The organization handles the structure behind the scenes.

---

## 3. Core Product Principle

> **The customer explains life. The Relais structures the mission. The system organizes accountability.**

Complexity belongs primarily inside RELAIS operations, not inside the customer experience.

---

## 4. The Connection Is the Front Door

A customer does not begin by creating a Mission.

A customer begins by requesting a **Connection**.

A Connection is the durable record that a Customer was matched with a Relais for the purpose of discussing one potential course.

A Connection exists before RELAIS knows whether a Mission will exist.

A Connection may result in:

- a Mission;
- a request declined by RELAIS;
- a customer declining to continue;
- customer abandonment;
- a conversation that ends without a Mission.

Therefore:

> **Connection and Mission are distinct domain concepts.**

---

## 5. Matching Is a Product Experience

Matching is not merely a backend operation.

The moment immediately after the customer selects **Connecter à un Relais** is one of the defining experiences of RELAIS.

The customer should feel that RELAIS is actively finding someone specifically for them.

The interface should clearly communicate:

> **Recherche d'un Relais disponible...**

followed by a deliberate transition when a Relais is found.

The experience must be truthful.

RELAIS must never introduce artificial waiting solely to simulate work.

The interface may use animation, transitions, haptics, progressive messaging, and thoughtful visual design to make genuine matching feel reassuring and intentional.

---

## 6. Human-First Communication

Once matched, the customer communicates directly with their Relais.

Supported communication may include:

- text;
- voice message;
- telephone call.

The customer is not required to complete a detailed intake form before this conversation.

Whenever reasonably possible, matching should respect the customer's preferred language.

Technology facilitates the relationship.

It does not replace it.

---

## 7. One Customer, One Relais

For each Connection, one Relais is the customer's primary human point of contact.

Other people may participate in execution behind the scenes.

The customer should not be required to coordinate those people.

Internal complexity remains internal.

---

## 8. Variable-Depth Missions

Not every request deserves the same operational process.

RELAIS supports different levels of mission depth.

The initial V1 distinction is:

### QUICK

A low-friction mission that can be understood, priced, accepted, and initiated rapidly.

Examples may include:

- delivering an item;
- handing something to another person;
- checking information;
- making a call on someone's behalf;
- performing another straightforward short-duration action.

QUICK missions should avoid unnecessary administrative work.

### MANAGED

A mission requiring additional assessment, planning, documentation, coordination, review, or ongoing follow-up.

Examples may include:

- administrative processes;
- multi-day coordination;
- multiple stakeholders;
- uncertain requirements;
- missions requiring significant customer funds;
- higher-risk or higher-complexity requests.

The customer does not need to choose between QUICK and MANAGED.

The Relais determines the appropriate operational depth after understanding the request.

---

## 9. Proportional Process

> **Process must be proportional to risk and complexity, never bureaucratic by default.**

A simple course should remain simple.

A complex mission should receive the structure necessary to execute it safely and reliably.

RELAIS must never force a QUICK mission through a MANAGED workflow merely because the software was designed around complex cases.

---

## 10. QUICK Mission Principle

For a QUICK mission, the Relais should perform the minimum structured work necessary.

After understanding the request, the Relais may select **QUICK**.

The system should then require only information that cannot already be inferred.

For V1, this may be as little as the mission price.

The system generates the standard customer acceptance message.

Example:

> **Course acceptée**
> Prix : 2 000 FCFA

The customer receives clear actions:

> **Accepter**

> **Refuser**

The system records the structured operational events automatically.

The Relais should not manually reproduce information the system already knows.

---

## 11. Structure From Decisions

> **Structure should be captured by the system whenever it can be inferred from a human decision.**

If selecting QUICK implies standard operational behavior, the Relais should not be asked to manually configure that behavior.

Internal structure exists to make employees more effective, not to create administrative work.

---

## 12. MANAGED Mission Principle

A MANAGED mission may require:

- structured scope;
- estimated duration;
- operational classification;
- expected evidence;
- pricing;
- external expense estimates;
- review;
- customer proposal;
- explicit customer acceptance.

The additional structure exists because the mission requires it.

It must not leak unnecessarily into simpler customer experiences.

---

## 13. Urgency

Urgency and mission depth are separate concepts.

A mission may conceptually be:

- QUICK and normal;
- QUICK and urgent;
- MANAGED and normal;
- MANAGED and urgent.

The domain should support urgency from the beginning.

V1 customer experience does not expose urgency selection.

V1 missions default to normal urgency.

Future versions may allow customers to request priority handling with clear communication that additional fees may apply.

The presence of a domain concept does not require immediate user-facing functionality.

---

## 14. A Course Is Not Necessarily Physical

RELAIS does not define a course exclusively as transportation or delivery.

A legitimate mission may involve human action such as:

- going somewhere;
- communicating with someone;
- obtaining information;
- verifying something;
- waiting;
- accompanying;
- coordinating;
- delivering;
- collecting;
- following up.

The common element is:

> **A trusted human takes action on the customer's behalf.**

---

## 15. Customer Simplicity

The customer-facing application should remain intentionally small.

The V1 customer journey is approximately:

**Connect → Communicate → Agree → Pay → Follow → Complete**

New customer-facing steps require strong justification.

Operational sophistication alone is not sufficient justification for additional customer complexity.

---

## 16. Operational Complexity

RELAIS accepts that the business behind the application may be operationally complex.

The software should organize that complexity through:

- clear ownership;
- durable records;
- mission classification;
- financial traceability;
- updates;
- escalation;
- audit history.

The goal is not to eliminate human judgment.

The goal is to make human judgment accountable and scalable.

---

## 17. Historical Integrity

Operational history is part of the product.

RELAIS must preserve meaningful historical facts.

At minimum:

- Connections are preserved.
- Conversations are preserved according to applicable retention and privacy rules.
- Mission history is preserved.
- Previous proposals are not silently overwritten.
- Payment history is preserved.
- Mission updates are preserved.
- Assignment history is preserved.
- Incidents are preserved after resolution.
- Material changes must remain traceable.

Current state must not destroy historical truth.

---

## 18. Human Judgment Before Automation

RELAIS V1 does not depend on AI to understand customers or structure missions.

Human Relais perform judgment.

Automation may later assist where demonstrated operational evidence shows that it improves:

- speed;
- consistency;
- safety;
- scalability.

Technology must solve observed problems rather than hypothetical ones.

---

## 19. V1 Scope Discipline

V1 exists to prove one core loop:

> **A customer can request human assistance, RELAIS can connect them with a trusted Relais, the request can become an agreed Mission, and RELAIS can remain accountable until completion.**

Features outside that proof require explicit justification.

V1 does not require:

- AI mission interpretation;
- automatic translation;
- live GPS tracking;
- route optimization;
- automatic pricing;
- a customer service catalog;
- bidding;
- loyalty systems;
- subscriptions;
- a customer wallet;
- an open field-agent marketplace;
- sophisticated analytics;
- separate customer and Relais mobile applications.

---

## 20. RELAIS Product Test

Before adding a customer-facing feature, ask:

1. Does this make it easier to obtain trusted human help?
2. Does the customer genuinely need to make this decision?
3. Could the Relais make this decision instead?
4. Could the system infer it?
5. Does exposing it increase customer confidence or merely expose internal complexity?

If the feature primarily exposes internal complexity, it belongs behind the scenes.

---

## 21. Foundational Experience

The defining RELAIS experience is:

**I need someone.**

↓

**RELAIS is finding someone for me.**

↓

**Mamadou is my Relais.**

↓

**He understands what I need.**

↓

**RELAIS has accepted it.**

↓

**Someone is taking care of it.**

That emotional transition is part of the product and must be protected as RELAIS grows.

---

## 22. Foundational Principle

> **RELAIS should feel simple because the organization takes responsibility for complexity—not because complexity does not exist.**
