import { Router } from 'express';
import mongoose from 'mongoose';
import connectDB, { getLastDbError } from '../config/db.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint for API and database connectivity
 * @access  Public
 */
router.get('/health', async (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  let dbState = mongoose.connection.readyState;
  if (dbState === 0) {
    try {
      await connectDB();
      dbState = mongoose.connection.readyState;
    } catch (_) {
      // Handled safely
    }
  }

  const lastErr = getLastDbError();

  res.status(200).json({
    status: 'ok',
    message: 'VHS — Hashnode Platform API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      connected: dbState === 1,
      ...(dbState !== 1 && lastErr ? { note: lastErr } : {}),
    },
  });
});

export default router;
