import jwt from 'jsonwebtoken';

/**
 * Generate a signed JWT for an authenticated user
 * @param {string|import('mongoose').Types.ObjectId} userId - User's database ObjectId
 * @returns {string} - Signed JWT token
 */
export const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'replace_with_a_secure_random_secret') {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId.toString() }, secret, {
    expiresIn,
  });
};

export default generateToken;
