import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'replace_with_a_secure_random_secret') {
      return res.status(500).json({
        error: {
          message: 'Server configuration error: JWT_SECRET is not set',
        },
      });
    }

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
