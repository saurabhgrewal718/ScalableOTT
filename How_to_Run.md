# How to Run — High-Scale Media Streaming Backend

Follow these steps to get the enterprise-grade, event-driven system running on your local machine.

## 📋 Prerequisites
1.  **Node.js**: Version 18.x or higher.
2.  **Redis**: A running Redis instance (Default: `localhost:6379`).
    *   *Tip: You can run Redis via Docker: `docker run -p 6379:6379 redis`*

## 🚀 Step 1: Installation
Clone the repository and install the dependencies:
```bash
npm install
```

## ⚙️ Step 2: Configuration
Ensure you have a `.env` file in the root directory. You can use the provided defaults:
I am keeping the ENV file so that its eay to run this app
```env
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
DASHBOARD_PATH=/admin/queues
```

## 🌐 Step 3: Start the Web API
Open a terminal and run the following command. This starts the HTTP server and the Domain Event Observers.
```bash
npm run start:web
```
*The API will be available at `http://localhost:3000`*

## 🛠️ Step 4: Start the Background Workers
Open a **second terminal** and run the following command. This starts the BullMQ workers that process Analytics, Emails, CRM, and Revenue.
```bash
npm run start:worker
```

## 📊 Step 5: Monitoring the Queues
You can monitor the health, retries, and failures of your queues in real-time via the **BullBoard Dashboard**:
👉 **URL**: [http://localhost:3000/admin/queues/](http://localhost:3000/admin/queues/)

---

## 📮 Testing with Postman
A **Postman Collection** has been shared with the codebase. 
1.  Import the collection into Postman.
2.  Use the `Signup`, `Purchase`, and `Heartbeat` requests to see the system in action.
3.  Watch your terminals to see the decoupled flow between the **Web Process** and the **Worker Process**!

---

### Key Commands Summary:
| Command | Purpose |
| :--- | :--- |
| `npm run start:web` | Starts the API Server + Event Observers |
| `npm run start:worker` | Starts the Background Job Workers |
| `npm run dev` | Development mode (Auto-restart on change) |
