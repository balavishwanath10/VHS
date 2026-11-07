import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validateEnv } from '../config/validateEnv.js';

/**
 * Authentication middleware: verifies Bearer JWT and attaches authenticated user
 */
export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authorized, no token provided',
      },
    });
  }

  try {
    const { secret } = validateEnv();
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Not authorized, user not found',
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Not authorized, token has expired',
        },
      });
    }
    return res.status(401).json({
      error: {
        message: 'Not authorized, invalid token',
      },
    });
  }
};

export default protect;
