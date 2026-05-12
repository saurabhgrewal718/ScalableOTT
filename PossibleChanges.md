# Technical Roadmap: Scaling to 10M+ Users
This document outlines the architectural evolution required to move the background workers from a "Functional Prototype" to a "Global Scale Distribution."

## 1. Move to "Worker-per-Queue" Architecture
Currently, all workers run in a single process. For 10M users, we must decouple them.
*   **The Change**: Modify `src/worker.js` to accept a `TARGET_QUEUE` environment variable.
const queueName = process.env.TARGET_QUEUE; // Passed from the environment
Eg: 
if (!queueName) {
  // Default: Start everything (for local development)
  container.startWorker(); 
} else {
  // Start ONLY the worker we need
  const worker = container.getWorkerByName(queueName);
  worker.start();
}
*   **The Benefit**: Allows us to scale the `EmailWorker` (slow, high volume) to 100 instances while keeping the `RevenueWorker` (critical, low volume) at 2 instances. So in case if i need to scale Email independetly i can do that. 

## 2. Implement Worker-Level Concurrency
*   **The Change**: Update the `QueueManager.createWorker()` to accept a `concurrency` setting.
*   **The Benefit**: Node.js is excellent at handling multiple I/O operations. We can process 50 emails simultaneously on a single worker rather than 1-by-1, increasing throughput by 5000%.
We can change the concurreny for different works at different rates, email can have a concurrency of 50 while revenue can have a concurrency of 10.
createWorker(queueName, processor, options = {}) {
  return new Worker(queueName, processor, { 
    connection: this.connection,
    concurrency: options.concurrency || 1 // <-- This is the magic line
  });
}

## 3. Strict Timeouts & Circuit Breakers
*   **The Change**: Every `process()` function must have a hard timeout (e.g., 10 seconds).
*   **The Benefit**: Prevents "Zombie Workers." If the CRM API hangs, the worker should fail the job after 10s and move to the next one, rather than staying stuck forever.
Currently we are not controlling that, the process can go on a long time.

## 4. Idempotency Keys (The "Financial Guard") to the third party
*   **The Change**: Pass a unique `idempotency-key` (like `purchaseId`) to all external clients.
*   **The Benefit**: Guarantees that even if a worker retries a job 5 times, the user is only charged once and the email is only sent once. This is essential for data correctness.

## 5. Dead Letter Queues (DLQ) & Manual Replay
*   **The Change**: Configure BullMQ to move jobs to a "Dead Letter" queue after 3 failed retries. Currently we are keeping it only in the failed one.
*   **The Benefit**: Instead of losing data, failing jobs are "quarantined." Engineers can fix the bug, update the data, and "Replay" the failed jobs without losing a single transaction.

## 6. External Rate Limiting (Self-Preservation)
*   **The Change**: Implement a "Token Bucket" or "Sliding Window" rate limiter inside the Workers.
*   **The Benefit**: Ensures that our 100 workers don't accidentally DDoS our own Analytics API or get our IP blocked by the Push Notification provider.


## 7. Observability (The "Eyes and Ears")
*   **The Change**: Integrate OpenTelemetry.
*   **The Benefit**: You can trace a single user's "Signup" from the moment they click the API → the database write → the Redis queue → the Worker → the external API call. If it fails at the 2-second mark, you know exactly which line of code caused it.

## 8. Health Checks (Liveness & Readiness)
*   **The Change**: Expose `/health/live` and `/health/ready` endpoints on the worker server.
*   **The Benefit**: Kubernetes/Docker can automatically restart "stale" workers. If a worker has been running for 24 hours but has processed 0 jobs (maybe it got stuck on a bad job), the health check detects this and kills it, allowing a fresh worker to take over.

## 9. Database Connection Pooling (Critical)
*   **The Change**: Ensure your `DatabaseService` uses a connection pool with a `max` setting. Currently we are not using any DB but in case if we are this can be used.
*   **The Benefit**: With 50 concurrent workers hammering the database, you must limit the connections. If you allow 100 workers to open 100 connections each, you will crash your database server. The pool acts as a "gatekeeper."

---

## 10. Bug Fix: Always Emit the Persisted Entity from Domain Events (`userService.js`)

**The Bug:**
```js
const user = await this.userRepo.saveUser(data);
this.domainEvents.emit('user:signup', data); // ❌ raw request input, not the saved record
```

After a DB save, the code was emitting `data` (the raw HTTP request payload) instead of `user` (the actual saved DB record). This is a fundamental mistake — the DB record is the **source of truth**. It can differ from the input (e.g. `createdAt` timestamps, normalised fields, DB-generated IDs). Any observer receiving `data` is working with potentially stale or incomplete information.

**The Fix:**
```js
this.domainEvents.emit('user:signup', user); // ✅ persisted entity
```

**The Rule:** After any DB operation, domain events must carry the **persisted entity**, never the raw input.

---

## 11. Bug Fix: Use `Promise.allSettled` for Side-Effects After a Committed DB Write (`purchaseService.js`)

**The Bug:**
```js
const purchase = await this.purchaseRepo.savePurchase(...); // ✅ DB write succeeds
await Promise.all([                                          // ❌ if Redis blips...
  this.pushQueue.add(...),
  this.emailQueue.add(...),
]);
// → throws → controller returns 500 → customer sees "Purchase Failed"
// → but the purchase IS in the DB and they WERE charged
```

`Promise.all` rejects as soon as **any** promise fails. If Redis has a 1-second blip after the purchase is already committed to the DB, the customer receives a 500 error and may retry — potentially getting double-charged.

**The Fix:**
```js
const sideEffects = await Promise.allSettled([...]); // ✅ never throws
// log each individual queue failure, let BullMQ retries handle recovery
```

**The Rule:** Once a critical DB write has succeeded, side-effect queue operations must use `Promise.allSettled`. A queue failure must never retroactively make a committed transaction appear failed to the end user. This is especially critical for any flow involving money.

---

## 12. Bug Fix: Double-Write Anti-Pattern in Write-Behind Cache (`watchService.js`)

**The Bug:**
```js
// Original watchService.trackProgress() — writing to DB AND Redis on every heartbeat
await this.watchRepo.upsertWatchProgress({ userId, contentId, watchedSeconds, sessionId }); // ❌ Write #1 — direct DB hit
await this.heartbeatBuffer.record({ userId, contentId, watchedSeconds, sessionId });          // Write #2 — Redis buffer
```

The codebase implements a **write-behind (write-back) buffer** specifically to avoid hammering the DB on every heartbeat event. A video player fires a heartbeat every ~5 seconds. At 10M concurrent viewers:

```
10,000,000 viewers × 1 heartbeat / 5s = 2,000,000 DB writes per second
```

That volume would destroy any relational database. The buffer's job is to absorb this into periodic bulk upserts via `HeartbeatWorker` every 10 seconds — dramatically reducing DB pressure.

But by also doing write #1 (the direct `upsertWatchProgress` call), the code was:
- **Still hitting the DB on every heartbeat** — defeating the entire purpose of the buffer
- **Writing every record twice** — write #1 directly in the hot path, write #2 again when the worker flushed
- **Making the buffer pure overhead** — Redis was taking writes with zero throughput benefit

**The Fix:**
```js
// Fixed watchService.trackProgress() — only buffer, never write directly to DB
await this.heartbeatBuffer.record({ userId, contentId, watchedSeconds, sessionId }); // ✅ Redis only
// HeartbeatWorker handles the DB write in bulk on its flush interval
```

**The Trade-off (accepted):** There is a data-loss window of up to `HEARTBEAT_FLUSH_INTERVAL_MS` (10 seconds) if the web server crashes before a flush. This is intentional and acceptable for watch progress — nobody cares if resume position is 10 seconds stale after a crash. It would **not** be acceptable for purchases or user records, which is why those write directly to the DB.

**The Rule:** Pick one write strategy and commit to it. Never mix a write-behind buffer with a direct DB write for the same record — you get double the load with none of the benefit.

---

## 13. Resolved Code Anti-Patterns

The following "basic" industry-standard mistakes were identified and resolved to bring the codebase up to senior/staff-level engineering standards:

### A. Magic Strings (Lack of Centralized Constants)
- **Problem**: Queue names and domain event names were hardcoded string literals (e.g., `'analytics_events'`) scattered across 16+ files.
- **Risk**: A typo in one file would silently break the connection between an enqueuer and a worker.
- **Fix**: Centralized everything into `src/infra/constants.js`. All code now refers to `QUEUES.ANALYTICS` or `EVENTS.USER_SIGNUP`.

### B. Architectural Inconsistency (Side-Effect Patterns)
- **Problem**: `UserService` used clean domain events, but `PurchaseService` was tightly coupled by directly injecting and calling 4 different queues.
- **Risk**: Violation of SRP (Single Responsibility Principle) and OCP (Open-Closed Principle). Adding a 5th side-effect required modifying the core service.
- **Fix**: Refactored `PurchaseService` to emit `PURCHASE_COMPLETED`. Created `PurchaseObserver` to handle the side-effects, making the architecture consistent.

### C. Wrong HTTP Semantics
- **Problem**: `PurchaseController` was returning `200 OK` for resource creation.
- **Fix**: Updated to `201 Created`, following REST best practices.

### D. Misleading `async` Declarations
- **Problem**: Methods like `startWeb()` in the container were marked `async` but contained no asynchronous code.
- **Fix**: Removed the `async` keyword to accurately reflect the synchronous nature of the setup logic, preventing misleading "await" calls by consumers.

### E. Inconsistent Worker Interfaces
- **Problem**: `CrmWorker.start()` was the only worker that didn't return the BullMQ instances it created.
- **Fix**: Standardized the `start()` method to return the worker instances for better observability and control.

---

## 14. Architecture Upgrade: Persistent Domain Event Bus (Fan-out Pattern)

**The Problem:**
Originally, the system used a local `EventEmitter` to hand off domain events (like `user:signup`) from the Services to the Observers. 
- **Scale Risk**: If the web server process crashed or restarted immediately after a database write, any events "in flight" in the server's RAM were lost forever.
- **Reliability**: There was no durability or retry mechanism for the handoff itself.

**The Fix:**
Replaced the in-memory `EventEmitter` with a **Persistent Domain Event Bus** powered by BullMQ.
- **The Change**: Services now add a job to a dedicated `domain_events_bus` queue in Redis.
- **The Worker**: A new `DomainEventWorker` listens to this bus and "fans out" the work to specialized side-effect queues (Analytics, Email, etc.).
- **The Benefit**: 100% durability. Once a signup is committed, the event is safe in Redis. Even if the entire web cluster goes down, the background workers will process the events as soon as they come back online. This is the foundation for a truly resilient, event-driven microservices architecture at 10M+ user scale.

---

## 15. Staff-Level API Design: Context Headers & Idempotency

**The Problem:**
Infrastructure-level metadata (like `platform` and `deviceToken`) was originally mixed into the request body JSON. This cluttered the domain models and made the API rigid. Furthermore, the API was not idempotent — retried requests resulted in duplicate side-effects (e.g., multiple welcome emails).

**The Fix:**
1.  **Context Headers**: Refactored the API to use HTTP Headers for contextual metadata. 
    - `Idempotency-Key`: For request deduplication.
    - `X-Platform`: For client environment tracking (iOS/Android/Web).
    - `X-Device-Token`: For notification targeting.
2.  **Request Deduplication logic**: Updated `UserService` and `PurchaseService` to use a "Check-then-Act" pattern. The system now verifies if a request with a specific `Idempotency-Key` or logical ID has already been processed.
3.  **Idempotent Success**: If a duplicate request is detected, the API returns the existing record (Success) but **skips** enqueuing background events.

**The Benefit:**
- **Cleaner Data Model**: The request body now only contains relevant business data (Email, Name, PlanId).
- **Resilience**: The system is now immune to "Network Retries." If a client spams the Signup button, they only get one email and one account.
- **Observability**: Using standard headers makes it easy to log and trace request context globally via middleware without modifying every individual controller.

---

## 16. API Versioning Strategy

**The Problem:**
As the platform evolves, we will inevitably need to change the data structures of our APIs. Without versioning, a change to the `User` model would instantly break all older versions of the mobile app currently installed on millions of devices.

**The Proposed Strategy:**
1.  **Major Versions (URI-based)**: Use `/v1`, `/v2` prefixes for structural breaking changes. 
    - `/v1/purchase/complete`
    - `/v2/purchase/complete` (e.g., if we move from a single `amount` to a complex `priceComponents` object).
2.  **Minor Versions (Header-based)**: Use a `X-API-Version` header for behavioral changes that are backwards-compatible but require a different logic branch.
3.  **Transformation Layer (Stripe Model)**: For the ultimate scale, implement a **"Version Gate"** middleware. 
    - Instead of duplicating code for `v1` and `v2`, the middleware "upcasts" a `v1` request into a `v2` format before it hits the controller.
    - This allows the core business logic to always work with the "Latest" version while maintaining support for legacy clients.

**The Benefit:**
- **Zero Downtime**: We can deploy new features without forcing users to update their apps immediately.
- **Developer Experience**: Clear versioning allows third-party developers to build on our platform with confidence that their integration won't break tomorrow.
- **Graceful Deprecation**: We can monitor header usage to see exactly how many users are still on `v1` before we decide to sunset it.

---

## 17. Heartbeat Validation & Semantic Intelligence

**The Problem:**
The `watch` event (heartbeat) currently accepts any `watchedSeconds` value passed by the client. There is no verification that the value is realistic or even within the bounds of the actual video length.

**The Proposal:**
1.  **Bounds Checking**: The `WatchService` should look up the metadata for the `contentId` and reject any heartbeat where `watchedSeconds > totalDuration`.
2.  **Velocity Validation (Anti-Cheat)**: Implement a check to ensure the user isn't "teleporting." If heartbeats are sent every 10 seconds, the delta between `watchedSeconds` should not exceed ~10 seconds (allowing for a small buffer).
3.  **Intelligent Deduplication**: While we must support **rewinds** (where `watchedSeconds` decreases), we should still discard heartbeats where the value hasn't changed at all since the last successful record. This reduces Redis/DB load without losing "resume position" accuracy.
4.  **Session Heartbeat Expiry**: Automatically clean up the `watch:last:sessionId` tracking keys in Redis after a period of inactivity to keep the memory footprint lean.

**The Benefit:**
- **Data Integrity**: Ensures the "Resume Watching" feature is always accurate and never shows impossible values.
- **Security**: Prevents users from "faking" completion of content (useful if the platform has rewards or "marked as watched" features).
- **Storage Efficiency**: Dramatically reduces the volume of redundant data stored in the Write-Behind buffer.

---

## 18. Solving the "Thundering Herd" (Flush Spikes)

**The Problem:**
Currently, every web server instance flushes its `HeartbeatBuffer` to Redis every 10,000ms. In a 10M user environment with 100+ server instances, all instances will likely synchronize their clocks and "Flush" at the exact same millisecond.

**The Risk:**
This creates a massive, periodic spike in Redis CPU and Network I/O. Even if the total load is manageable, the "Micro-Spike" can cause connection timeouts and latency jitter for the Signup and Purchase APIs that share the same Redis cluster.

**The Proposed Fix:**
Implement **Jittered Flush Intervals**. Instead of a fixed 10s timer, we introduce a random variation to the interval on each server:

```js
// Inside HeartbeatBuffer.js
startFlusher(baseIntervalMs = 10000) {
  const jitter = Math.random() * 2000; // ±2 seconds of randomness
  this.flushInterval = setInterval(() => this.flush(), baseIntervalMs + jitter);
}
```

**The Benefit:**
- **Load Smoothing**: The Redis write load is "spread out" over time, resulting in a flat, predictable performance graph instead of a "sawtooth" spike pattern.
- **Improved API Latency**: By eliminating the micro-spikes, we protect the critical path (Payments/Signups) from being delayed by background heartbeat flushes.
