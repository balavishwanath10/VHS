import 'dotenv/config';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEnv, validateEnvOrExit } from '../config/validateEnv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runConfigTests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 3 JWT Configuration Startup Security Verification`);
  console.log(`==================================================\n`);

  const valid32ByteSecret = 'a'.repeat(32);
  const valid64ByteSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // 1. Missing JWT_SECRET is rejected
  try {
    assert.throws(
      () => validateEnv({}),
      /JWT_SECRET is missing or empty/
    );
    recordPass('JWT Config - Missing Secret Rejection', 'Throws descriptive error when JWT_SECRET is absent');
  } catch (err) {
    recordFail('JWT Config - Missing Secret Rejection', err);
  }

  // 2. Empty or whitespace JWT_SECRET is rejected
  try {
    assert.throws(
      () => validateEnv({ JWT_SECRET: '   ' }),
      /JWT_SECRET is missing or empty/
    );
    recordPass('JWT Config - Empty Secret Rejection', 'Throws error when JWT_SECRET is empty whitespace');
  } catch (err) {
    recordFail('JWT Config - Empty Secret Rejection', err);
  }

  // 3. Known placeholder secrets are rejected
  const placeholders = [
    'replace_with_a_secure_random_secret',
    'your_jwt_secret_key_min_32_characters',
    'your_jwt_secret',
    'changeme',
  ];
  for (const placeholder of placeholders) {
    try {
      assert.throws(
        () => validateEnv({ JWT_SECRET: placeholder }),
        /JWT_SECRET is configured with an insecure placeholder value/
      );
    } catch (err) {
      recordFail(`JWT Config - Placeholder Rejection (${placeholder})`, err);
    }
  }
  recordPass('JWT Config - Placeholder Rejection', 'Rejects known example and placeholder secrets');

  // 4. Secret shorter than 32 bytes (256 bits) is rejected
  try {
    const shortSecret = 'a'.repeat(31);
    assert.throws(
      () => validateEnv({ JWT_SECRET: shortSecret }),
      /JWT_SECRET must contain at least 32 bytes/
    );
    recordPass('JWT Config - Short Secret Rejection (< 32 bytes)', 'Rejects secret with 31 bytes of key material');
  } catch (err) {
    recordFail('JWT Config - Short Secret Rejection (< 32 bytes)', err);
  }

  // 5. Valid 256-bit or stronger secret is accepted
  try {
    const res32 = validateEnv({ JWT_SECRET: valid32ByteSecret });
    assert.strictEqual(res32.secret, valid32ByteSecret);
    assert.strictEqual(res32.expiresIn, '7d');

    const res64 = validateEnv({ JWT_SECRET: valid64ByteSecret });
    assert.strictEqual(res64.secret, valid64ByteSecret);
    assert.strictEqual(res64.expiresIn, '7d');
    recordPass('JWT Config - Valid 256-bit Secret Acceptance', 'Accepts valid 32-byte and 64-byte secrets');
  } catch (err) {
    recordFail('JWT Config - Valid 256-bit Secret Acceptance', err);
  }

  // 6. Missing expiry safely defaults to 7d
  try {
    const envObj = { JWT_SECRET: valid32ByteSecret };
    const res = validateEnv(envObj);
    assert.strictEqual(res.expiresIn, '7d');
    assert.strictEqual(envObj.JWT_EXPIRES_IN, '7d');
    recordPass('JWT Config - Expiry Default to 7d', 'Missing JWT_EXPIRES_IN safely defaults to "7d"');
  } catch (err) {
    recordFail('JWT Config - Expiry Default to 7d', err);
  }

  // 7. Invalid expiry format is rejected
  const invalidExpiries = ['invalid_timespan', 'not-valid-time', 'foo_bar_xyz'];
  for (const inv of invalidExpiries) {
    try {
      assert.throws(
        () => validateEnv({ JWT_SECRET: valid32ByteSecret, JWT_EXPIRES_IN: inv }),
        /JWT_EXPIRES_IN value .* has an invalid format/
      );
    } catch (err) {
      recordFail(`JWT Config - Invalid Expiry Rejection (${inv})`, err);
    }
  }
  recordPass('JWT Config - Invalid Expiry Rejection', 'Rejects unparseable timespan formats');

  // 8. Valid expiry values are accepted
  const validExpiries = ['1d', '24h', '3600s', '1h', '60m', 3600];
  for (const exp of validExpiries) {
    try {
      const res = validateEnv({ JWT_SECRET: valid32ByteSecret, JWT_EXPIRES_IN: exp });
      assert.ok(res.expiresIn);
    } catch (err) {
      recordFail(`JWT Config - Valid Expiry Acceptance (${exp})`, err);
    }
  }
  recordPass('JWT Config - Valid Expiry Acceptance', 'Accepts standard valid timespan expressions');

  // 9. Error messages never expose secrets
  try {
    const sensitiveSecretSample = 'sensitive_secret_value_12345678'; // 31 chars
    let caughtMessage = '';
    try {
      validateEnv({ JWT_SECRET: sensitiveSecretSample });
    } catch (e) {
      caughtMessage = e.message;
    }
    assert.ok(caughtMessage.length > 0, 'Should have thrown an error');
    assert.strictEqual(
      caughtMessage.includes(sensitiveSecretSample),
      false,
      'Error message must NOT contain the secret value'
    );
    recordPass('JWT Config - Secret Redaction in Error Messages', 'Error messages state length and format without leaking secret text');
  } catch (err) {
    recordFail('JWT Config - Secret Redaction in Error Messages', err);
  }

  // 10. Startup validation terminates before opening HTTP listener
  await new Promise((resolve) => {
    console.log('[Subprocess Test] Testing server startup with invalid JWT configuration...');
    const child = spawn(
      process.execPath,
      [path.join(rootDir, 'server.js')],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          JWT_SECRET: '', // explicitly invalid
          PORT: '5999',
        },
      }
    );

    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', (code) => {
      try {
        assert.strictEqual(code, 1, 'Child process must exit with code 1 on invalid JWT config');
        assert.ok(
          output.includes('[Security Configuration Error]'),
          'Output must contain [Security Configuration Error]'
        );
        assert.ok(
          !output.includes('Server running in'),
          'HTTP listener must NOT have started'
        );
        recordPass('JWT Config - Startup Termination Before Listen', 'Invalid configuration terminates process with exit code 1 before listening');
      } catch (err) {
        recordFail('JWT Config - Startup Termination Before Listen', err);
      }
      resolve();
    });
  });

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.some((r) => r.status === 'FAIL');
  process.exitCode = hasFailures ? 1 : 0;
}

runConfigTests();
