# VHS — Hashnode Platform

> A developer-first blogging and publishing platform built strictly on the Hashnode Platform Product Requirement Document (PRD).

---

## 1. Project Overview

**VHS** is a developer-focused publishing platform designed for technical writing, community publishing, and knowledge sharing. It delivers a fast, responsive Markdown editing and reading experience, robust tag-based categorization, and developer profile management.

The project is developed using a unified root-level architecture designed for single-process operation on platforms like Render.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite 6, React Router 7, Axios
- **Backend**: Node.js (v26+), Express.js 4
- **Database**: MongoDB Atlas with Mongoose 8
- **Language**: Pure JavaScript & JSX (No TypeScript, No SSR)
- **Environment Management**: dotenv
- **Development Tooling**: nodemon, Vite middleware mode

---

## 3. Unified Application Architecture

The platform uses a single unified repository and root directory structure:

```text
VHS/
├── config/             # Database connection and environment configuration
│   └── db.js
├── models/             # Mongoose database models (User, Post, Tag)
├── routes/             # Express API routes
│   └── health.js
├── middleware/         # Express middleware (centralized error handling, auth)
│   └── errorHandler.js
├── utils/              # Shared backend utility functions
├── src/                # React application
│   ├── components/     # Reusable UI components
│   ├── pages/          # Application page views
│   ├── context/        # React context (Auth)
│   ├── services/       # API client services
│   ├── hooks/          # Custom React hooks
│   ├── App.jsx         # Root React component
│   ├── index.css       # Global styles
│   └── main.jsx        # React DOM entry point
├── public/             # Static public assets
├── .env                # Local environment variables (excluded from git)
├── .env.example        # Environment variable template
├── .gitignore          # Git exclusion rules
├── index.html          # HTML SPA template
├── package.json        # Single root package configuration
├── vite.config.js      # Vite build configuration
├── server.js           # Express application entry point (Vite integration)
└── README.md           # Project documentation
```

### Single-Process Operation
- **Development**: Express initializes Vite in middleware mode (`appType: 'spa'`). Frontend source files are served with instant Hot Module Replacement (HMR) under the same port as the backend API (`http://localhost:5000`).
- **Production**: Vite builds static assets to the `dist/` directory. Express serves the static assets and provides client-side SPA routing fallback, ensuring the entire application deploys as a single Web Service on Render.

---

## 4. Prerequisites

- **Node.js**: `v20+` or `v26+`
- **npm**: `v10+` or `v11+`
- **Git**: `v2.40+`
- **MongoDB**: Active MongoDB Atlas cluster or local instance

---

## 5. Installation Instructions

Clone the repository and install root dependencies:

```powershell
# Clone repository
git clone https://github.com/balavishwanath10/VHS.git
cd VHS

# Install all dependencies (single root)
npm install
```

---

## 6. Environment Configuration

Create a local `.env` file in the root directory by copying `.env.example`:

```powershell
Copy-Item .env.example .env
```

Configure the environment variables in `.env`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_secure_random_secret
```

### MongoDB Setup Instructions
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Under **Database Access**, create a database user with read/write privileges.
3. Under **Network Access**, add your current IP address (or `0.0.0.0/0` for cloud deployment).
4. Go to **Clusters** > **Connect** > **Drivers** and copy your connection string.
5. Replace `<password>` and set the database name (e.g., `vhs_db`).
6. Paste the connection string into `MONGODB_URI` in `.env`.

> **Note**: Never commit `.env` or credentials to version control. `.env` is explicitly ignored in `.gitignore`.

---

## 7. Running the Application

### Development Mode (Unified Express + Vite Middleware)
Starts Express with nodemon and runs Vite in middleware mode:

```powershell
npm run dev
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

### Production Build
Builds the React client into the `dist/` folder:

```powershell
npm run build
```

### Production Startup
Starts the Express server in production mode to serve static assets and the API:

```powershell
$env:NODE_ENV="production"; npm start
```

---

## 8. Health and Verification Endpoints

The API provides a health check endpoint:

- **Endpoint**: `GET /api/health`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "message": "VHS — Hashnode Platform API is operational",
    "timestamp": "2026-11-06T18:30:00.000Z",
    "environment": "development",
    "database": {
      "status": "connected",
      "connected": true
    }
  }
  ```

---

## 9. Day-by-Day Implementation Roadmap

- **Day 1**: GitHub repository setup, unified MERN architecture, Express & Vite middleware integration, MongoDB connection module, foundation health verification. *(Current)*
- **Day 2**: Mongoose database schemas (User, Post, Tag models), relationships, slug constraints, and validation scripts.
- **Day 3**: Authentication system, bcryptjs password hashing, JWT generation/verification middleware, registration & login endpoints, security tests.
- **Weeks 2–4**: Post CRUD, Markdown publishing, tag filtering, user profiles, feed aggregation, deployment to Render.