# DESIGN.md — High-Scale Media Streaming Backend

> **Author**: Saurabh Grewal
> **Scope**: Architectural deep-dive — why the original code fails, how the refactor fixes it
---

## The Move to Object-Oriented Programming (OOP)
We refactored the entire project from simple objects/functions to **Classes**. 
### Why the shift?
1.  **Encapsulation**: State (like the mock database Maps) is now held inside class instances (`this.db`), preventing global variable pollution.
2.  **Dependency Inversion**: By using classes, we can easily "inject" real database drivers or mock clients during testing.
3.  **Scalability**: Classes provide a clear blueprint. If we need multiple instances of a `PushClient` with different API keys, we can just do `new PushClient(key)`.

---

## 1. Initial code had 6 major issues which i could find: 
### 1 — Synchronous Request Chaining (Blocking I/O on the Hot Path)
Every handler `await`ed each external call in sequence:
```
saveUser()          →  10 ms
pushClient.send()   →  30–300 ms   ← user is blocked here
analyticsClient()   →  20–100 ms   ← and here
crmClient()         →  60–500 ms   ← and here
                    ──────────────
                       120–910 ms  total P99 response time
```
The user's signup HTTP response was held open while three *completely independent* side-effects ran in series. If the CRM timed out at 30 s (the default), the user got a 30-second spinner on signup.
**Fix**: All side-effects are now enqueued as BullMQ jobs (`createQueue().add()`). The HTTP response returns the moment the DB write succeeds (~10 ms). Workers process jobs asynchronously and independently.

---

### 2 — Fate Sharing
The original `handleUserSignup` coupled the success of the response to the success of Push, Analytics, and CRM. A CRM outage during a high-traffic signup event would cascade: every signup hangs on the CRM timeout, Event Loop backs up, memory grows, and the process OOMs.
This is **Fate Sharing** — one failing downstream service takes down the entire user-facing critical path.
**Fix**: Each side-effect is an isolated queue job. If CRM is down, the job fails and BullMQ retries it with exponential backoff. The HTTP response to the user is unaffected. This way our DB operations will not fail even if any event is failing in the queue.

---

### 3 — No Retry / No Durability
The original code wrapped external calls in `try/catch` and swallowed failures with `console.error`. A transient network blip on the Email API meant the purchase confirmation email was silently dropped — forever.
**Fix**: Every client (`pushClient`, `emailClient`, `crmClient`, `revenueClient`, `analyticsClient`) wraps its HTTP call in `retryWithBackoff()` with full-jitter exponential backoff. BullMQ also provides job-level retry with its own backoff config (`attempts: 3, backoff: { type: 'exponential', delay: 200 }`), giving a two-tier retry safety net.
Revenue events get 5 attempts — financial data must not be silently dropped.

---

### 4 — The Heartbeat DDoS (Resource Exhaustion)
```
/watch/event is called every 30 s per active viewer.
2,000 concurrent viewers × 1 HTTP call/heartbeat = 2,000 req / 30 s ≈ 67 req/s
```
At 67 req/s _sustained_, every single one opening a new TCP connection (axios defaults), doing a TLS handshake, and waiting for a response. The Analytics API sees a synchronised wave every 30 seconds — a **thundering herd** of exactly 2,000 simultaneous POSTs.
At 10M users with 1% watching concurrently (100,000 viewers):
```
100,000 req / 30 s ≈ 3,333 req/s to Analytics — from one backend service alone.
```
This is our own backend DDoS-ing our Analytics API the fix: 
To fix the Heartbeat DDoS, we implemented a Write-Behind Heartbeat Buffer (Aggregation Pattern).
Instead of letting every single user request hit our Analytics API and Database, we created a "Middle-man" (the Buffer).

---

### 5 — No Input Validation
The original handlers destructured `req.body` directly and passed raw strings into DB functions. A missing `userId` would cause a DB call with `undefined`, potentially creating corrupt records or triggering unhandled promise rejections that crash the process (pre-Node 15).
**Fix**: Every route is guarded by a Zod schema via the `validate()` middleware factory. Malformed requests are rejected with a structured 400 response before any business logic runs. Parsed data is attached to `req.validated` — controllers never touch `req.body` directly.

---

### 6 — Dead Code & No Error Boundary
`user.js` line 30 contained a stray `handlers / purchase.js` string inside a `try` block — a JavaScript division expression that evaluates to `NaN`, silently doing nothing. This indicates a lack of code review, linting, and no centralised error boundary.
**Fix**: Removed dead code. Added a centralized `errorHandler` Express middleware that classifies errors (400 validation, 409 conflict, 500 unknown), logs structured output, and never leaks stack traces in production.

---

## 2. The Scaling Strategy — How We Handle 10M+ Users

### Stateless Horizontal Scaling
The app server is now fully stateless (session state is in Redis/DB, not process memory), by keeping aside the repo as we are using Map there. We can run N identical instances behind a load balancer. BullMQ workers can also be scaled independently on separate machines.

### Event-Driven Architecture (Write Path)
```
HTTP Request → Controller → Service → Queue.add() → 200 OK
                                             ↓
                                       BullMQ (Redis)
                                             ↓
                                        Worker Process
                                             ↓
                                      External Service
```
The HTTP response path now contains only:
- Input validation (~0 ms)
- One DB write (critical path, ~5–10 ms)
- N queue enqueues (~1–2 ms each, non-blocking on Redis)

**Total response time: ~15–25 ms regardless of how many side-effects there are.**


### Write-Behind Caching for Heartbeats
The `heartbeatBuffer` implements a **Write-Behind Cache** pattern:
1. Writes are accepted into memory instantly (O(1)).
2. A background flusher periodically persists accumulated writes to the downstream system in one batched operation.
This is the same pattern used by databases for their WAL (Write-Ahead Log) buffer and by Redis for AOF persistence.

### Load Shedding
The `heartbeatBuffer` has a `MAX_BUFFER_SIZE` cap (default: 200,000 sessions). If the buffer fills (e.g., flusher is stuck due to Analytics being down), the **oldest** session entry is evicted. This is a deliberate trade-off: we lose one stale heartbeat for one session rather than crashing the process with unbounded memory growth.

---

### 3: The Heartbeat Problem — Deep Dive
### The Problem (Quantified)
| Scenario | Viewers | Heartbeat interval | Calls/sec to Analytics |
|---|---|---|---|
| Original @ peak | 2,000 | 30 s | ~67 req/s |
| Original @ 10M users (1% watching) | 100,000 | 30 s | ~3,333 req/s |
| **New @ peak** | **2,000** | **Flush every 10 s** | **~0.1 req/s (1 batch)** |
| **New @ 10M users** | **100,000** | **Flush every 10 s** | **~0.1 req/s (1 batch)** |

The refactored system sends the **same 1 batch call per flush interval** regardless of viewer count, because the Map deduplication means each session only contributes one record.

### Last-Write-Wins Semantics
If a user sends 3 heartbeats before the flusher fires, only the latest `watchedSeconds` value is forwarded. This is correct for analytics: we care about the final progress at flush time, not every intermediate state. This is **eventual consistency** — acceptable here because analytics data is used for dashboards and recommendations, not billing.

### Circuit Breaker
If the Analytics batch POST fails (after retries), the `heartbeatBuffer` opens a circuit breaker flag. Subsequent flush cycles are skipped, and the buffer retains the data in memory. After 60 seconds, the circuit auto-resets and the next flush attempt is made. This prevents a log-jam of failed flush requests from amplifying the outage.

---
## 4. Trade-offs: Async Queue vs. Synchronous Execution
### Why Eventual Consistency Is Acceptable Here
| Operation | Consistency required? | Rationale |
|---|---|---|
| `saveUser` to DB | **Strong** (synchronous) | User must exist before returning 201 |
| Send welcome push | **Eventual** | A 2-second delay is imperceptible |
| Analytics event | **Eventual** | Dashboard data can lag by seconds |
| CRM contact sync | **Eventual** | CRM updates are batch-processed anyway |
| Purchase DB write | **Strong** (synchronous) | Must be durable before confirming payment |
| Purchase email | **Eventual** | Email in 1–5 s is fine |
| Revenue capture | **Eventual** (but high-retry) | Must not be dropped; timing is not critical |
| Watch heartbeat | **Eventual** | Analytics lags are expected and acceptable |

The rule is: **anything that affects what we promise the user in the HTTP response must be on the critical path**. Everything else is a side-effect and belongs in a queue.

### Cost of the Queue
- **Latency added per enqueue**: ~1–2 ms (Redis SET). Negligible.
- **Operational cost**: Requires Redis. This is not an "addition" — Redis is already required by BullMQ and is a standard piece of infrastructure in any production Node.js system.
- **Observability**: BullMQ provides a dashboard (Bull Board) for monitoring job queues, failed job inspection, and manual retries — which the original system had zero visibility into, we are using the same system

---

## 5. Production Readiness — What Is Still Missing
The refactored code is production-grade in architecture but requires the following before a real launch:

### Critical (must-have before launch)
| Gap | Solution |
|---|---|
| **Idempotency keys** | Clients should send an `idempotency-key` header. Services must check a Redis SET before processing to prevent duplicate purchases on retries. |
| **Structured Logging** | Replace `console.log` with Pino (`pino` + `pino-http`). Emit JSON logs with `requestId`, `userId`, `traceId` on every line. |
| **Real Circuit Breakers** | Replace the boolean flag in `heartbeatBuffer` with some real circuit breakers. 
| **Auth / Rate Limiting** | Add JWT verification middleware. Add `express-rate-limit` per `userId` on `/watch/event` to prevent a single client from flooding the buffer. |
| **Real DB** | Replace `Map` repositories with a real ORM (Prisma + PostgreSQL) or a document store (Mongoose + MongoDB). |

### Recommended (for scale)
| Gap | Solution |
|---|---|
| **Horizontal BullMQ Workers** | Run workers in a separate process / container from the HTTP server. Scale worker replicas independently based on queue depth. |
| **Redis Cluster / Sentinel** | A single Redis node is a SPOF. We shuld use clusters for scale.
| **Metrics & Alerting** | Expose a `/metrics` Prometheus endpoint. Alert on queue depth, job failure rate, and heartbeat buffer size. |

---

## Architecture Summary Diagram

```
                        ┌─────────────────────────────────────┐
                        │           Express HTTP Server         │
                        │                                       │
                        │  POST /user/signup                    │
                        │    → validate (Zod)                   │
                        │    → userService                      │
                        │        saveUser() ← critical path     │
                        │        Event Emitter  │
                        │    ← 201 in ~15 ms                    │
                        │                                       │
                        │  POST /purchase/complete              │
                        │    → validate (Zod)                   │
                        │    → purchaseService                  │
                        │        savePurchase() ← critical      │
                        │        enqueue: push,email,rev,crm    │
                        │    ← 200 in ~15 ms                    │
                        │                                       │
                        │  POST /watch/event  ← HOT PATH        │
                        │    → validate (Zod)                   │
                        │    → watchService                     │
                        │        upsertWatchProgress() ~6 ms    │
                        │        heartbeatBuffer.record() ~0 ms │
                        │    ← 200 in ~8 ms                     │
                        └──────────────┬──────────────────┬─────┘
                                       │                  │
                              BullMQ (Redis)     HeartbeatBuffer
                                       │          (in-memory Map)
                         ┌─────────────┼──────┐        │
                         ▼             ▼      ▼    every 10 s
                    PushWorker  EmailWorker  ...  ──────────────►
                         │             │              1 batched POST
                         ▼             ▼              to Analytics
                   pushClient    emailClient
                   (retry x3)    (retry x3)
                         │             │
                   Push Provider    Email SaaS
```

---

## 6. Clean Code & SOLID Principles
To ensure this system can be maintained for years by a large team, applied industry-standard Clean Code practices:
### A. Object-Oriented Refactor (OOP) & Dependency Injection (DI)
We moved away from "Script-like" functions to **Class-based Architecture** with **Constructor Injection**.
*   **Composition Root**: All classes are now instantiated and "wired" together in `app.js`. This is the central brain that puts the machine together, this furthur has a container.js containing all the resposibilities.
*   **Encapsulation**: State (like DB maps or worker configs) is now protected inside class instances.
*   **Dependency Inversion (DI)**: Classes no longer `require` their own dependencies. Instead, they "request" them in the constructor. This is the ultimate key to **Unit Testing**we can swap any real service for a "Mock" one in seconds. 

### B. DRY (Don't Repeat Yourself)
We created a centralized `src/utils` folder. 
*   **Centralized Simulation**: Instead of every file having its own `setTimeout` logic, we use a shared `simulation.js`. This means if we ever want to change how "latency" works globally, we only change it in **one place**.

### D. Professional Benefits of this Architecture
the system gains several massive advantages:

1.  **Infinite Testability**: Since every class receives its dependencies in the constructor, we can perform "Pure Unit Testing." We can test a `UserService` by injecting a "Fake Repository" and a "Fake Analytics Client" without ever needing a real database or network.
2.  **Operational Efficiency**: By sharing a single Redis connection across the `QueueManager` and `HeartbeatBuffer`, we drastically reduce the load on the Redis server, preventing "Connection Exhaustion" at 10M+ user scale.
3.  **Rapid Maintenance**: If the CRM team decides to switch from "CRM-X" to "Salesforce," we only change **one line**. The rest of the system remains completely untouched.

---
### C. Observer Design Pattern (Domain Events) Only implemented in users.
We implemented a **Decoupled Event-Driven Architecture** using the Observer Pattern:
*   **Domain Events Bus**: A centralized `EventEmitter` that allows services to "announce" actions without knowing who is listening.
*   **Observers**: Dedicated classes (like `SignupObserver`) that listen for events and trigger background queues.
*   **Benefits**:
    *   **Extensibility**: We can add new features (like sending a Slack alert) by creating a new Observer without touching the core `UserService`.
    *   **Isolation**: If an observer fails, the core service remains unaffected.
    *   **Clean SRP**: Services only handle business logic; Observers handle the "consequences."
```
Overall by doing this we have achieved the a good scalable system
Though we still might have some code blocks not working peerfectly here and there by this is a solid base at extent this desing to a 10M+ scale. 