import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/validateEnv.js';

/**
 * Generate a signed JWT for an authenticated user
 * @param {string|import('mongoose').Types.ObjectId} userId - User's database ObjectId
 * @returns {string} - Signed JWT token
 */
export const generateToken = (userId) => {
  const { secret, expiresIn } = validateEnv();

  return jwt.sign({ id: userId.toString() }, secret, {
    expiresIn,
  });
};

export default generateToken;
