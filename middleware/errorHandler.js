/**
 * 404 Not Found handler for unmatched API routes
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Resource not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized Express error-handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  // 1. Malformed JSON parse errors (from express.json())
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  // 2. Mongoose Validation Errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
  }

  // 3. Mongoose Invalid ObjectId (CastError)
  else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier format for field: ${err.path}`;
  }

  // 4. MongoDB Duplicate Key Error (E11000)
  else if (err.code === 11000) {
    statusCode = 400;
    const fields = Object.keys(err.keyValue || {});
    const field = fields.length > 0 ? fields[0] : 'field';
    message = `Duplicate value entered for ${field}. An entry with this ${field} already exists.`;
  }

  // 5. JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Not authorized, invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Not authorized, token has expired';
  }

  // 6. Security Sanitization in Production for 500s
  if (isProduction && statusCode === 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};

export default errorHandler;
