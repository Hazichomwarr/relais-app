# RELAIS Conversation Domain

**Status:** Foundational
**Version:** 1.0
**Depends on:**

- `docs/product/constitution.md`
- `docs/product/actors-and-authorization.md`
- `docs/product/connection-domain.md`
- `docs/product/relais-availability-and-matching.md`

---

## 1. Purpose

This document defines the **Conversation** domain in RELAIS.

Conversation is the human interaction layer between a Customer and their assigned Relais.

It exists to let the Customer explain what they need naturally, without requiring them to first understand RELAIS's internal categories, workflows, or mission structure.

The Conversation belongs to the Connection.

It begins before a Mission exists.

---

# 2. Core Principle

> **The Customer speaks naturally. The Relais listens and understands. The system preserves the exchange without forcing either person into unnecessary structure.**

Conversation is not a form.

Conversation is not a service catalog.

Conversation is the place where ambiguity becomes understanding.

---

# 3. Relationship to Connection

A Conversation cannot exist independently of a valid Connection.

Conceptually:

```text
Connection
    ↓
Conversation
    ↓
Messages / Voice / Attachments / Call actions
```

The Connection establishes:

- who the Customer is;
- who the assigned Relais is;
- who is authorized to participate.

The Conversation carries the communication between them.

---

# 4. Relationship to Mission

A Conversation may exist without a Mission.

This is normal.

Examples:

- the Customer changes their mind;
- RELAIS declines the request;
- the Customer only needs simple information;
- no agreement is reached;
- the request is abandoned.

If a Mission is later created, the originating Conversation remains part of the historical context of that Mission.

Therefore:

> **Conversation precedes Mission and must not be recreated merely because a Mission is created.**

---

# 5. One Primary Conversation Per Connection

V1 should prefer one primary Customer–Relais Conversation per Connection.

Conceptually:

```text
Connection
    └── Conversation
```

This preserves simplicity.

If future evidence shows the need for multiple conversational threads, that complexity may be introduced deliberately later.

---

# 6. Conversation Participants

The primary participants are:

- the Customer;
- the currently assigned Relais.

Authorized Admin access may occur for operational reasons.

Field Executors are not direct Conversation participants in V1.

---

# 7. Customer Experience

After matching succeeds, the Customer should be presented with simple communication options:

> **Mamadou est votre Relais pour cette course.**

Then:

- **Envoyer un message**
- **Envoyer un vocal**
- **Appeler Mamadou**

The Customer should not be required to complete another intake step before communicating.

---

# 8. Supported Communication Modes

V1 supports three conceptual communication modes:

```text
TEXT
VOICE
CALL
```

Attachments may accompany supported message types.

The exact implementation may evolve.

---

# 9. TEXT

A text message is a durable written communication between authorized Conversation participants.

Text messages should preserve:

- sender;
- recipient context;
- content;
- creation time;
- delivery state where supported;
- edit/deletion history if those capabilities are ever introduced.

V1 should avoid unnecessary message editing complexity.

---

# 10. VOICE

A voice message is an audio recording sent within the Conversation.

Voice is a first-class communication mode.

This is especially important because RELAIS may serve Customers who:

- prefer speaking to typing;
- have limited literacy;
- are more comfortable in local languages;
- need to explain nuanced situations verbally.

Voice must not be treated as an optional decorative feature.

---

# 11. Voice Message Requirements

A voice message should eventually preserve:

- sender;
- audio asset reference;
- duration when known;
- creation time;
- delivery context;
- access authorization.

The system does not need to understand or transcribe the content in V1.

The human Relais does.

---

# 12. No AI Dependency

Conversation V1 does not depend on:

- speech recognition;
- automatic transcription;
- AI translation;
- AI summarization;
- AI intent detection.

These may be introduced later if proven reliable and operationally useful.

Human understanding remains authoritative.

---

# 13. CALL

A call action allows the Customer to communicate directly with their assigned Relais using the device's phone capability or another supported calling mechanism.

V1 does not require building in-app VoIP.

The system may launch the device phone application.

---

# 14. Call Observability

When V1 uses the normal phone application, RELAIS may reliably know only that:

- the Customer tapped the call action;
- the target Relais phone number was used;
- the call handoff was initiated.

RELAIS may not reliably know:

- whether the call connected;
- who answered;
- call duration;
- what was discussed.

The domain must not pretend otherwise.

---

# 15. Calls Are Conversation Context

A call may contain the full explanation of the Customer's request.

After a call, the Relais may proceed directly to:

- QUICK;
- MANAGED;
- review;
- decline;
- no Mission needed.

The Customer must not be forced to restate the same information in text merely because the system could not observe the call.

---

# 16. Attachments

Conversation may support attachments such as:

- photos;
- documents;
- images;
- other approved file types.

Attachments should support explanation, not create a general-purpose file-sharing platform.

---

# 17. Attachment Authorization

Conversation attachments inherit Conversation authorization.

An attachment is not public simply because it is stored in object storage.

Only authorized participants may access it.

Access must be determined through the owning Conversation and Connection.

---

# 18. Attachment Safety

The system should eventually enforce operational protections such as:

- allowed file types;
- size limits;
- malware protection where appropriate;
- secure URLs or access controls;
- retention rules.

Exact implementation is deferred.

---

# 19. Message Identity

Every durable message should have a stable identity.

The system should eventually preserve:

- unique message identifier;
- Conversation identity;
- sender identity;
- type;
- creation timestamp;
- message content or asset reference.

---

# 20. Message Ordering

Conversation history must preserve a reliable chronological order.

Two messages may arrive close together.

Ordering should not depend only on the mobile device's local clock.

Server-authoritative timestamps or equivalent ordering semantics should be used.

Exact implementation is deferred.

---

# 21. Message Delivery

V1 may conceptually distinguish states such as:

```text
CREATED
SENT
DELIVERED
READ
FAILED
```

However, only states the platform can actually observe should be represented.

The system must not display false certainty.

---

# 22. Read Receipts

Read receipts are not foundational to V1.

They may be introduced later.

If introduced, they should reflect real observable behavior.

---

# 23. Push Notifications

Conversation activity may trigger push notifications.

Examples:

> Mamadou vous a envoyé un message.

> Nouveau vocal de votre Relais.

Notifications are delivery aids.

They are not the source of truth.

The Conversation remains authoritative even if a notification is lost.

---

# 24. Conversation Access — Customer

A Customer may access the Conversation belonging to their own Connection.

A Customer must never access another Customer's Conversation.

This boundary is enforced server-side.

---

# 25. Conversation Access — Relais

A Relais may access the Conversation for Connections currently within their authorized scope.

Holding the RELAIS role alone does not grant access to every Conversation.

Assignment matters.

---

# 26. Conversation Access — Admin

Admin access is exceptional and operational.

Admin may access Conversation content when necessary for:

- customer support;
- reassignment;
- incident investigation;
- dispute handling;
- safety review;
- operational supervision.

Admin access should remain attributable where audit requirements apply.

---

# 27. Reassignment and Conversation Continuity

If a Connection is reassigned from Mamadou to Aïcha, the Conversation remains attached to the same Connection.

The Customer should not have to explain everything again.

The newly assigned Relais may receive access to the existing Conversation when operationally authorized.

History must preserve:

- Mamadou's previous participation;
- Aïcha's later participation;
- assignment transition.

---

# 28. Reassignment Does Not Rewrite Senders

Messages sent by Mamadou remain messages sent by Mamadou.

They must not become attributed to Aïcha merely because the Connection was reassigned.

Historical identity must remain intact.

---

# 29. Internal Notes Are Not Conversation Messages

Internal operational notes must remain distinct from Customer-visible Conversation content.

Conceptually:

```text
Customer Conversation
≠
Internal Operational Notes
```

The Customer should never receive internal notes by accident.

This distinction must exist below the UI layer.

---

# 30. No Hidden Relais Messages Inside Customer Conversation

A Relais should not be able to write a message in the Customer Conversation and mark it "internal."

If content is internal, it belongs to the internal-notes domain.

This protects against accidental disclosure.

---

# 31. Conversation Is Not the Audit Log

Conversation records what participants communicated.

Audit history records privileged system or administrative actions.

These are different concepts.

Examples:

```text
"Mamadou: Je peux m'en occuper."
```

is Conversation.

```text
"Admin A reassigned Connection from Mamadou to Aïcha."
```

is audit/assignment history.

They should not be conflated.

---

# 32. Conversation Is Not Mission Status

A message saying:

> “Je suis en route.”

does not necessarily change the Mission's authoritative status.

Mission status changes should occur through explicit Mission operations.

Conversation may explain progress.

It should not silently mutate structured Mission state unless a deliberate future feature does so.

---

# 33. QUICK Mission Context

For QUICK requests, Conversation may contain most of the mission detail.

Example:

Customer:

> “Peux-tu déposer cette clé chez ma nounou à Karpala ?”

Relais:

> “Oui.”

Then the Relais chooses `QUICK` and enters:

```text
Price: 2 000 FCFA
```

The system generates the Customer offer.

No duplicate mission description is required simply to satisfy software structure.

---

# 34. QUICK Offer Should Be a Structured Event

The generated QUICK acceptance message is not merely free-form chat.

Example:

> **Course acceptée**
> Prix : 2 000 FCFA
> **Accepter** / **Refuser**

This should be represented as a structured business event displayed inside or alongside the Conversation.

It must remain distinguishable from ordinary text.

---

# 35. Why QUICK Offer Must Be Structured

Structured representation enables RELAIS to know:

- exact offered price;
- when offer was created;
- who created it;
- whether Customer accepted;
- whether Customer rejected;
- which version applied.

The system must not parse arbitrary chat text later to determine contractual state.

---

# 36. MANAGED Proposal and Conversation

A MANAGED proposal may also be surfaced within the Conversation.

Example:

> Mamadou vous a envoyé une proposition de mission.

The underlying proposal remains a structured domain object.

The Conversation presents it.

The Conversation does not become the proposal itself.

---

# 37. Business Actions Inside Conversation

The Conversation UI may render structured actions such as:

- QUICK offer;
- MANAGED proposal;
- payment request;
- Mission update;
- completion request.

These are not ordinary messages even if they appear in the message timeline.

They remain authoritative domain records rendered conversationally.

This is a major product principle.

---

# 38. Conversational Interface, Structured Backend

RELAIS may visually feel like a simple human chat.

Behind the interface, important business decisions remain structured.

Therefore:

> **The Conversation may be the presentation layer for business events without becoming their source of truth.**

---

# 39. Customer Acceptance

Customer acceptance of an offer or proposal must be an explicit structured action.

It must not depend on interpreting messages such as:

> “Okay.”

or

> “D'accord.”

The Customer may still write those words conversationally.

They do not replace the formal acceptance action when formal acceptance is required.

---

# 40. Customer Rejection

Similarly, structured rejection should be explicit.

This ensures the system can distinguish:

- formal rejection;
- discussion;
- negotiation;
- hesitation.

---

# 41. Conversation Before Acceptance

A Customer may continue asking questions before accepting.

Example:

> “Le prix comprend-il le transport ?”

The offer or proposal remains pending until explicit action occurs.

Conversation must not automatically cancel or accept it merely because discussion continues.

---

# 42. Message Immutability

V1 should strongly prefer immutable sent messages.

Message editing introduces:

- dispute complexity;
- historical ambiguity;
- audit requirements.

If correction is needed, the sender can send another message.

Future editing may be introduced deliberately.

---

# 43. Message Deletion

V1 should not support ordinary hard deletion of sent Conversation messages.

A sent message may become relevant to:

- customer expectations;
- Mission scope;
- dispute resolution;
- safety incidents.

Privacy and retention requirements may later require deletion or anonymization through controlled procedures.

---

# 44. Failed Messages

A failed outgoing message must not appear as successfully delivered.

The Customer or Relais should be able to understand that transmission failed.

Retries must not accidentally create duplicate durable messages.

Exact retry mechanics are implementation concerns.

---

# 45. Idempotency

Network retries must not duplicate intended messages or structured actions.

Example:

Customer taps **Accepter** once.

A poor network retries the request three times.

The system must still record one acceptance.

This requirement is especially important for structured Conversation actions.

---

# 46. Offline and Weak Connectivity

RELAIS will operate in environments where connectivity may be inconsistent.

Conversation design should therefore favor:

- clear pending states;
- retryable messages;
- small payloads;
- compressed media where appropriate;
- graceful failure;
- resumable or retryable uploads where practical.

V1 does not need perfect offline messaging.

It must not silently lose communication.

---

# 47. Voice Upload Failure

If a voice recording is created but upload fails:

- the user should know it was not sent;
- the system should preserve retry potential when practical;
- no fake delivered message should be created.

The same principle applies to attachments.

---

# 48. Large Attachments

Conversation should not become a storage dump.

Operational configuration may define:

- file-size limits;
- approved formats;
- attachment count limits.

The domain should support constraints without embedding temporary values into foundational policy.

---

# 49. Sensitive Information

Customers may share sensitive information during Conversation.

The system should minimize unnecessary exposure.

Relais should access only assigned Conversations.

Admins should access only for legitimate operational reasons.

Conversation content should not be reused casually for unrelated purposes.

---

# 50. Language

Conversation content may be in any supported human language.

The backend should not assume French text.

Text fields, storage, search, and rendering should support Unicode correctly.

Voice communication naturally supports languages the software itself does not understand.

---

# 51. No Forced Translation

A Mooré Conversation does not need to be translated into French merely for the system to accept it.

Operational structured fields may later be entered by the Relais in the organization's working language.

The original Customer communication remains original.

---

# 52. Conversation Closure

A Conversation does not necessarily need an independent customer-facing "closed" action.

Its practical activity may end because:

- a Mission was created;
- the Connection ended without a Mission;
- the Customer abandoned;
- RELAIS declined;
- the Mission later completed.

The Conversation remains historical even when no longer active.

---

# 53. Conversation After Mission Creation

Creating a Mission does not end communication.

The same Conversation may continue throughout execution.

This preserves the Customer's experience of speaking with one Relais rather than moving into a separate support system.

---

# 54. Conversation After Mission Completion

The Customer may still need limited post-completion communication.

Examples:

- clarification;
- final receipt question;
- minor issue;
- thanks.

Exact closure policy may evolve.

The system should not permanently lock the Conversation the instant Mission completion is recorded unless operational policy requires it.

---

# 55. Multiple Missions From One Conversation

V1 assumes one Connection leads to at most one initial Mission.

Therefore the primary Conversation should not be designed around managing several unrelated Missions simultaneously.

If the Customer starts a separate need, a new Connection should normally be created.

---

# 56. Conversation Search

Full-text search is not required for V1.

Admin or Relais search may be added later if operational volume justifies it.

The foundational requirement is durable, ordered Conversation history.

---

# 57. Typing Indicators

Typing indicators are not required for V1.

They may improve perceived responsiveness later.

They do not justify domain complexity now.

---

# 58. Presence Indicators

The system does not need to expose:

- online now;
- last seen;
- typing;
- read presence

unless real Customer value is demonstrated.

Availability for matching is not the same as chat presence.

---

# 59. Blocking and Abuse

Conversation may expose RELAIS to abusive behavior.

A Relais must have a way to:

- report abuse;
- escalate;
- stop unsafe communication through Operations.

The exact blocking mechanism is deferred to incident and safety design.

The Customer must not be allowed to bypass a valid safety restriction by repeatedly creating new Connections.

---

# 60. Contact Information

The Customer may eventually see approved Relais contact actions.

The system should deliberately decide which personal contact information is exposed.

A Relais's private personal information should not automatically become public simply because they are assigned.

Operational phone numbers or masked communication may later be preferable.

V1 may use approved phone numbers while preserving this distinction conceptually.

---

# 61. Conversation Notifications and Privacy

Push notifications should avoid exposing unnecessarily sensitive message content on lock screens.

Operational configuration may choose generic notifications such as:

> Nouveau message de votre Relais.

rather than including full message text.

---

# 62. Structured Conversation Event Types

The UI may eventually display a unified timeline containing both messages and structured events.

Conceptually:

```text
ConversationTimelineItem

TEXT_MESSAGE
VOICE_MESSAGE
ATTACHMENT_MESSAGE
CALL_INITIATED

QUICK_OFFER_CREATED
QUICK_OFFER_ACCEPTED
QUICK_OFFER_REJECTED

MANAGED_PROPOSAL_SENT
MANAGED_PROPOSAL_ACCEPTED
MANAGED_PROPOSAL_REJECTED

PAYMENT_REQUESTED
PAYMENT_CONFIRMED

MISSION_UPDATE
MISSION_COMPLETION_REQUESTED
MISSION_COMPLETED
```

This does not require one giant database table.

It describes the Customer experience.

---

# 63. Avoid One Giant Message Model

Important business records should not be forced into a generic message payload merely to simplify UI rendering.

For example:

```text
type = "QUICK_OFFER"
payload = arbitrary JSON
```

should not automatically replace a proper QUICK offer domain model.

The backend should preserve explicit business semantics.

The UI may aggregate them into one timeline.

---

# 64. Conversation History and Reassignment

When reassignment occurs, the new Relais should receive enough prior Conversation context to continue responsibly.

Operations may restrict access to particularly sensitive content where policy requires it.

The default principle is continuity.

The Customer should not pay the price for internal staffing changes.

---

# 65. Conversation Metrics

The domain should eventually support deriving useful metrics such as:

- time from Connection assignment to first Relais response;
- number of messages before qualification;
- voice usage;
- text usage;
- call-action usage;
- response delays;
- Conversations resulting in Missions;
- Conversations ending without Missions.

Metrics should arise from real records rather than manual reporting.

---

# 66. What Conversation Should Not Measure

V1 does not need vanity metrics such as:

- number of emojis;
- typing duration;
- message sentiment;
- AI satisfaction predictions.

Measure behavior only when it helps operations or Customer experience.

---

# 67. Conversation Retention

Conversation history has operational value.

However, retention must eventually account for:

- privacy;
- legal requirements;
- dispute windows;
- security;
- Customer rights.

V1 should preserve Conversation history by default.

Permanent retention is not assumed.

A formal retention policy may be introduced later.

---

# 68. Conversation Non-Goals

V1 does not require:

- group chats;
- Customer-to-field-agent chat;
- video calls;
- in-app VoIP;
- disappearing messages;
- stories;
- message reactions;
- message forwarding;
- AI translation;
- AI transcription;
- AI summaries;
- public profiles;
- social networking features.

---

# 69. Core Invariants

The eventual implementation must preserve at least these invariants:

1. Every Conversation belongs to exactly one Connection.

2. A Conversation can exist before a Mission.

3. A Conversation remains valid when no Mission is ever created.

4. Only authorized participants may access Conversation content.

5. Customer-visible communication and internal operational notes are distinct.

6. Reassignment does not rewrite historical message authorship.

7. Business acceptance actions are structured events, not inferred from free-form text.

8. Failed messages must not be represented as successfully delivered.

9. Attachments inherit Conversation authorization.

10. A call handoff must not fabricate call outcome data.

11. QUICK may rely on Conversation context without redundant mission description entry.

12. Mission creation does not destroy or replace the originating Conversation.

13. Important Conversation history is not silently overwritten.

---

# 70. Conceptual Model

Without committing to Prisma:

```text
Conversation
    Connection
    participants
    activity state
    timestamps

Message
    Conversation
    sender
    type
    text or media reference
    created at
    delivery semantics

Attachment
    owning message
    storage reference
    metadata
    authorization context

CallAction
    Conversation
    initiated by
    target
    initiated at

Structured Business Events
    rendered in Conversation timeline
    authoritative in their own domains
```

---

# 71. Foundational Conversation Test

For every Customer–Relais interaction, RELAIS should eventually be able to answer:

1. Which Connection does this communication belong to?
2. Who sent it?
3. When?
4. Was it text, voice, attachment, or call action?
5. Was it actually transmitted successfully?
6. Who was authorized to see it?
7. Did assignment later change?
8. Can the next authorized Relais understand the prior context?
9. Did any structured business decision result from the Conversation?
10. Can we distinguish what people said from what the system officially recorded?

If not, the Conversation model is incomplete.

---

# 72. Customer Experience Test

The Customer should feel:

> **I found a real person.**

↓

> **I can simply explain what I need.**

↓

> **My Relais understands me.**

↓

> **I don't have to translate my life into software fields.**

The system should feel conversational without sacrificing structured accountability behind the scenes.

---

# 73. Foundational Principle

> **Conversation is where RELAIS remains human. Structure begins only when structure is actually needed.**

The Conversation should make asking for help easier than calling around for someone, while preserving enough history for RELAIS to remain accountable after the conversation ends.
