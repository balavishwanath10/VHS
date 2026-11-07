import jwt from 'jsonwebtoken';

const KNOWN_PLACEHOLDERS = [
  'replace_with_a_secure_random_secret',
  'your_jwt_secret_key_min_32_characters',
  'your_jwt_secret',
  'your_secret_here',
  'changeme',
];

/**
 * Validates JWT environment configuration
 * @param {object} env - Environment variables object (defaults to process.env)
 * @returns {{ secret: string, expiresIn: string|number }} - Validated JWT configuration
 * @throws {Error} - Descriptive error if configuration is invalid (never logs secrets)
 */
export const validateEnv = (env = process.env) => {
  const secret = env.JWT_SECRET;

  // 1. JWT_SECRET exists and is not empty
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('JWT_SECRET is missing or empty. A secure secret of at least 32 bytes is required.');
  }

  const trimmedSecret = secret.trim();

  // 2. Not an example placeholder value
  if (
    KNOWN_PLACEHOLDERS.includes(trimmedSecret) ||
    trimmedSecret.startsWith('replace_with') ||
    trimmedSecret.startsWith('your_')
  ) {
    throw new Error('JWT_SECRET is configured with an insecure placeholder value. A unique, secure secret must be provided.');
  }

  // 3. Contains at least 32 bytes of secret material (256 bits)
  const byteLength = Buffer.byteLength(trimmedSecret, 'utf8');
  if (byteLength < 32) {
    throw new Error(`JWT_SECRET must contain at least 32 bytes (256 bits) of secret material. Current length: ${byteLength} bytes.`);
  }

  // 4. JWT_EXPIRES_IN is present or safely defaults to '7d'
  let expiresIn = env.JWT_EXPIRES_IN;
  if (!expiresIn || (typeof expiresIn === 'string' && expiresIn.trim() === '')) {
    expiresIn = '7d';
    env.JWT_EXPIRES_IN = '7d';
  } else if (typeof expiresIn === 'string') {
    expiresIn = expiresIn.trim();
  }

  // 5. Configured expiry value is valid for jsonwebtoken
  try {
    jwt.sign({ _validate: true }, trimmedSecret, { expiresIn });
  } catch (err) {
    throw new Error(`JWT_EXPIRES_IN value '${expiresIn}' has an invalid format. It must be a valid timespan string (e.g., '7d', '24h', '3600s') or number of seconds.`);
  }

  return {
    secret: trimmedSecret,
    expiresIn,
  };
};

/**
 * Validates JWT environment configuration and terminates startup with exit code 1 if invalid
 * @param {object} env - Environment variables object (defaults to process.env)
 * @returns {{ secret: string, expiresIn: string|number }} - Validated JWT configuration
 */
export const validateEnvOrExit = (env = process.env) => {
  try {
    return validateEnv(env);
  } catch (error) {
    console.error(`[Security Configuration Error] ${error.message}`);
    process.exit(1);
  }
};

export default validateEnv;
