# VHS — Day 19 to Day 20 Deployment Handoff Document

**Project:** VHS — Developer-First Blogging & Publishing Platform (Hashnode Clone)  
**Handoff Scope:** Bridge between Day 19 (Testing Complete) and Day 20 (Deployment)  

---

## 1. Quick Reference Metadata

- **Repository:** `https://github.com/balavishwanath10/VHS.git`
- **Branch:** `main`
- **Latest Verified Commit:** Check git log on branch `main`
- **Architecture:** Unified Single-Root MERN (One Express Server, One Render Web Service)
- **Language / Stack:** Pure JavaScript & JSX (Node.js 20+, Express 4, React 18, Vite 6, Mongoose 8)

---

## 2. Service Commands & Specifications

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- **Port Binding:** Dynamically binds to `process.env.PORT` (defaults locally to 5000)
- **Static Asset Serving:** Express serves `dist/` with client-side SPA routing fallback to `dist/index.html` on non-API routes.

---

## 3. Required Environment Variables for Render

| Variable | Required | Recommended Production Value | Description |
|---|:---:|---|---|
| `NODE_ENV` | Yes | `production` | Enables production mode and error masking |
| `PORT` | Platform | *(Injected by Render)* | Port for Express listener |
| `MONGODB_URI` | Yes | *(Atlas connection string)* | MongoDB Atlas SRV URI with read/write credentials |
| `JWT_SECRET` | Yes | *(Secure 256-bit key)* | Cryptographic signing secret (min 32 bytes) |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration period |

---

## 4. MongoDB Atlas Prerequisites

1. Active MongoDB Atlas cluster with an application database (e.g. `vhs_db`).
2. Database user credentials with `readWrite` permissions on the database.
3. Network Access IP Whitelist configured to permit outbound connections from Render.
4. Connection string in standard SRV format (`mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority`).

---

## 5. Render Configuration Blueprint

Render blueprint configuration is defined in [`render.yaml`](render.yaml):
- Service type: `web`
- Environment: `node`
- Plan: `free`
- Auto-deploy: `false`

---

## 6. Outstanding User Actions for Day 20

1. Log into [Render Dashboard](https://dashboard.render.com).
2. Connect GitHub account and select repository `balavishwanath10/VHS`.
3. Create Web Service using `render.yaml` blueprint or manual service form.
4. Enter `MONGODB_URI` and `JWT_SECRET` in the Render Environment Variables tab.
5. Verify Atlas Network Access permits connection from Render.
6. Click **Manual Deploy** / **Create Web Service**.
7. Perform live smoke test on `https://<service-name>.onrender.com/api/health`.

---

## 7. Technical Blockers

- **None**: All 16 automated test suites passed (267/267 assertions), zero compilation errors, and zero runtime defects.
