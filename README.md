# VHS — Hashnode Platform
> A developer-first blogging and publishing platform built strictly on the Hashnode Platform Product Requirements Document (PRD).

---

## 1. Project Overview

**VHS** is a developer-focused publishing and blogging platform engineered for technical writing, knowledge sharing, and developer community interaction. It features:
- Fast, secure Markdown editing with real-time preview and safe rendering (zero `dangerouslySetInnerHTML`).
- Clean article reading experience with syntax highlighting and author attribution.
- Tag-based content organization, auto-generation of URL slugs, and deduplication.
- Public developer profiles displaying published articles and customizable bios.
- Private author dashboard for managing drafts and published stories.
- Complete authentication lifecycle using bcryptjs password hashing and JWT token authorization.

The platform is built as a single unified application where one Express server powers both the RESTful API and serves the React client application.

---

## 2. Technology Stack

- **Architecture**: Single-Root Unified MERN Application
- **Backend**: Node.js (v20+ / v26+), Express.js 4
- **Frontend**: React 18, React Router 7, Axios
- **Build Tooling**: Vite 6 (middleware mode in development; static production build)
- **Database**: MongoDB Atlas with Mongoose 8
- **Language**: Pure JavaScript & JSX (No TypeScript, No Server-Side Rendering)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`
- **Security**: Strict environment validation on startup, XSS-safe pure React Markdown parser, protocol sanitization

---

## 3. Unified Architecture & Directory Structure

```text
VHS/
├── config/             # Database connection and environment configuration
│   ├── db.js           # Mongoose Atlas connection with error handling
│   └── validateEnv.js  # JWT configuration startup validation
├── models/             # Mongoose database models
│   ├── User.js         # User model (bcrypt hashing, secure projections)
│   ├── Post.js         # Post model (slugs, draft/published, tag refs)
│   └── Tag.js          # Tag model (normalized names, unique slugs)
├── routes/             # Express API routers
│   ├── auth.js         # Register, login, current user session (/api/auth)
│   ├── posts.js        # Post CRUD, draft privacy, search (/api/posts)
│   ├── tags.js         # Tag listing, creation, topic feeds (/api/tags)
│   ├── users.js        # Public profiles and settings (/api/users)
│   └── health.js       # Operational health check (/api/health)
├── middleware/         # Express middleware
│   ├── auth.js         # JWT Bearer token protection middleware
│   └── errorHandler.js # Standardized JSON error response handler
├── utils/              # Backend helper utilities
│   ├── generateToken.js# JWT signing utility
│   └── postHelpers.js  # Slug generator and URL validator
├── src/                # Frontend React application
│   ├── components/     # UI components (Navbar, MarkdownRenderer, PostCard, ProtectedRoute)
│   ├── context/        # React Context (AuthContext)
│   ├── pages/          # Page views (Home, PostDetail, Editor, Dashboard, Profile, Settings, TagPosts, Login, Register, NotFound)
│   ├── services/       # Axios API client (relative base URL `/api`)
│   ├── utils/          # Frontend markdown parser and URL sanitization
│   ├── App.jsx         # Root router component
│   ├── index.css       # Responsive global styling
│   └── main.jsx        # React DOM entry point
├── scripts/            # Comprehensive automated verification suites
├── render.yaml         # Render unified Web Service deployment configuration
├── .env.example        # Environment variable template with placeholders
├── server.js           # Unified Express server entry point
├── vite.config.js      # Vite build configuration
└── package.json        # Unified root package definition
```

### Single-Process Operation
- **Development**: Express integrates Vite in middleware mode (`appType: 'spa'`). Frontend source files are served with instant Hot Module Replacement (HMR) under the same port as the backend API (`http://localhost:5000`).
- **Production**: Vite builds static assets to the `dist/` directory. Express serves the static assets and provides client-side SPA routing fallback, ensuring the entire application deploys as a single Web Service on Render.

---

## 4. Prerequisites

- **Node.js**: `v20+` or `v26+`
- **npm**: `v10+` or `v11+`
- **Git**: `v2.40+`
- **MongoDB**: Active MongoDB Atlas cluster or local MongoDB instance

---

## 5. Local Setup & Installation

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

Create a `.env` file in the root directory by copying `.env.example`:

```powershell
Copy-Item .env.example .env
```

Configure your environment variables:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_secure_random_secret_at_least_32_characters
JWT_EXPIRES_IN=7d
```

### Environment Rules:
- `MONGODB_URI`: Valid MongoDB connection URI (e.g. MongoDB Atlas cluster SRV).
- `JWT_SECRET`: Must contain at least 32 characters of secret material. The application will safely refuse to start with empty or known placeholder secrets.
- `PORT`: Binds to `process.env.PORT` (automatically assigned by Render in production).
- `.env` is ignored by `.gitignore` and must never be committed to source control.

---

## 7. Running the Application

### Development Mode (Unified Express + Vite Middleware)
Starts Express with nodemon and runs Vite in middleware mode on port 5000:

```powershell
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

### Production Build
Compiles the React client into the `dist/` folder:

```powershell
npm run build
```

### Production Startup
Starts the Express server in production mode to serve static assets and the API:

```powershell
$env:NODE_ENV="production"; npm start
```

---

## 8. API Overview

All API endpoints reside under `/api` and return standardized JSON responses:

| Method | Endpoint | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/health` | Public | Operational status and database connection state |
| `POST` | `/api/auth/register` | Public | Register a new user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and return JWT |
| `GET` | `/api/auth/me` | Protected | Retrieve authenticated user session details |
| `GET` | `/api/posts` | Public | Fetch published posts feed (supports `?search=`) |
| `GET` | `/api/posts/mine` | Protected | Fetch current user's drafts and published articles |
| `GET` | `/api/posts/:slug` | Public/Author | Retrieve post by slug (drafts restricted to author) |
| `POST` | `/api/posts` | Protected | Create a new post (`title`, `content`, `tags`, `status`, `coverImage`) |
| `PUT` | `/api/posts/:id` | Protected (Owner) | Update an existing post and its publish status |
| `DELETE` | `/api/posts/:id` | Protected (Owner) | Delete a post from the database |
| `GET` | `/api/tags` | Public | List all tags with published post counts |
| `POST` | `/api/tags` | Protected | Create or retrieve normalized tag (`name`) |
| `GET` | `/api/tags/:slug/posts` | Public | List published stories associated with tag |
| `GET` | `/api/users/:id` | Public | Retrieve public developer profile and published stories |
| `PUT` | `/api/users/me` | Protected | Update authenticated user profile (`name`, `bio`, `avatarUrl`) |

---

## 9. Automated Testing & Verification

The platform includes comprehensive automated test suites covering every layer of the application:

```powershell
# Run backend models and authentication verification
node scripts/verifyAuth.js
node scripts/verifyModels.js
node scripts/verifyJwtConfig.js

# Run post and feed verification
node scripts/verifyPosts.js
node scripts/verifyDay7Posts.js
node scripts/verifyDay8TagsAndSearch.js

# Run frontend and integration verification
node scripts/verifyDay9Frontend.js
node scripts/verifyDay10MarkdownAndFeed.js
node scripts/verifyDay11DashboardAndAuth.js
node scripts/verifyDay12EditorAndPublishing.js
node scripts/verifyDay13PostManagement.js
node scripts/verifyDay14Profiles.js
node scripts/verifyDay15Integration.js

# Run UI quality, responsiveness and markdown safety verification
node scripts/verifyDay17Quality.js

# Run production serving smoke verification
npm run smoke
```

---

## 10. Render Deployment Configuration

VHS is configured for deployment as a single **Render Web Service** via `render.yaml`:

- **Environment**: `node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Port Binding**: Managed via `PORT` environment variable
- **Environment Variables Required on Render**:
  - `NODE_ENV`: `production`
  - `MONGODB_URI`: Configured in Render Dashboard (secret)
  - `JWT_SECRET`: Secure 256-bit random key (or generated by Render)
  - `JWT_EXPIRES_IN`: `7d`