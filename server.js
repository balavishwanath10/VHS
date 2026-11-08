import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import postsRouter from './routes/posts.js';
import tagsRouter from './routes/tags.js';
import usersRouter from './routes/users.js';
import errorHandler, { notFound } from './middleware/errorHandler.js';
import { validateEnvOrExit } from './config/validateEnv.js';

dotenv.config();

// Validate JWT security configuration before opening HTTP listener
validateEnvOrExit();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Core middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/users', usersRouter);

// 404 handler for unmatched API routes
app.all('/api/*', notFound);

// Frontend Integration: Vite middleware in development, static build in production
if (!isProduction) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for client-side routing on non-API routes
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// Centralized error handling middleware
app.use(errorHandler);

// Attempt database connection without crashing application if URI is not yet configured
connectDB().catch((err) => {
  console.warn(`[MongoDB] Initial connection not established: ${err.message}`);
});

// Start unified server
const server = app.listen(PORT, () => {
  console.log(`[VHS] Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});

export default app;
