import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint for API and database connectivity
 * @access  Public
 */
router.get('/health', (req, res) => {
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;

  res.status(200).json({
    status: 'ok',
    message: 'VHS — Hashnode Platform API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      connected: dbState === 1,
    },
  });
});

export default router;
