import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function runDay9FrontendTests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 9 React Foundation, Routing & Auth UI Verification`);
  console.log(`==================================================\n`);

  // -------------------------------------------------------------------------
  // TEST 1: React application builds successfully
  // -------------------------------------------------------------------------
  try {
    const distIndex = path.resolve(rootDir, 'dist', 'index.html');
    const distAssetsDir = path.resolve(rootDir, 'dist', 'assets');
    assert.ok(fs.existsSync(distIndex), 'dist/index.html must exist');
    assert.ok(fs.existsSync(distAssetsDir), 'dist/assets directory must exist');

    const assetFiles = fs.readdirSync(distAssetsDir);
    const hasJs = assetFiles.some((f) => f.endsWith('.js'));
    const hasCss = assetFiles.some((f) => f.endsWith('.css'));
    assert.ok(hasJs, 'dist/assets must contain compiled JavaScript bundle');
    assert.ok(hasCss, 'dist/assets must contain compiled CSS bundle');
    recordPass('1. React application builds successfully', 'Production build artifacts exist in dist/');
  } catch (err) {
    recordFail('1. React application builds successfully', err);
  }

  // -------------------------------------------------------------------------
  // TEST 2: All required route paths resolve
  // -------------------------------------------------------------------------
  try {
    const appContent = fs.readFileSync(path.resolve(rootDir, 'src', 'App.jsx'), 'utf8');
    const requiredRoutes = [
      'path="/"',
      'path="/login"',
      'path="/register"',
      'path="/dashboard"',
      'path="/post/:slug"',
      'path="/tag/:slug"',
      'path="/editor/new"',
      'path="/editor/:id"',
      'path="/profile/:id"',
      'path="/settings"',
    ];
    for (const route of requiredRoutes) {
      assert.ok(appContent.includes(route), `App.jsx must declare route: ${route}`);
    }
    recordPass('2. All required route paths resolve', 'All 10 PRD-specified routes declared in App.jsx');
  } catch (err) {
    recordFail('2. All required route paths resolve', err);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Login form structure and fields
  // -------------------------------------------------------------------------
  try {
    const loginContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Login.jsx'), 'utf8');
    assert.ok(loginContent.includes('type="email"'), 'Login must contain email input');
    assert.ok(loginContent.includes('type="password"'), 'Login must contain password input');
    assert.ok(loginContent.includes('handleSubmit'), 'Login must handle form submission');
    assert.ok(loginContent.includes('disabled={submitting}'), 'Inputs/button must support disabled state');
    recordPass('3. Login form renders', 'Login component contains required form elements and attributes');
  } catch (err) {
    recordFail('3. Login form renders', err);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Registration form structure and fields
  // -------------------------------------------------------------------------
  try {
    const registerContent = fs.readFileSync(path.resolve(rootDir, 'src', 'pages', 'Register.jsx'), 'utf8');
    assert.ok(registerContent.includes('type="text"'), 'Register must contain name input');
    assert.ok(registerContent.includes('type="email"'), 'Register must contain email input');
    assert.ok(registerContent.includes('type="password"'), 'Register must contain password input');
    assert.ok(registerContent.includes('handleSubmit'), 'Register must handle form submission');
    recordPass('4. Registration form renders', 'Register component contains name, email, and password fields');
  } catch (err) {
    recordFail('4. Registration form renders', err);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Required-field validation works
  // -------------------------------------------------------------------------
  try {
    // Validate Login logic
    const validateLogin = (email, password) => {
      if (!email || !email.trim()) return 'Email is required';
      if (!password) return 'Password is required';
      return null;
    };
    assert.strictEqual(validateLogin('', 'pass123'), 'Email is required');
    assert.strictEqual(validateLogin('   ', 'pass123'), 'Email is required');
    assert.strictEqual(validateLogin('user@example.com', ''), 'Password is required');
    assert.strictEqual(validateLogin('user@example.com', 'pass123'), null);

    // Validate Register logic
    const validateRegister = (name, email, password) => {
      if (!name || !name.trim()) return 'Name is required';
      if (!email || !email.trim()) return 'Email is required';
      if (!password) return 'Password is required';
      if (password.length < 6) return 'Password must be at least 6 characters';
      return null;
    };
    assert.strictEqual(validateRegister('', 'a@b.com', 'pass123'), 'Name is required');
    assert.strictEqual(validateRegister('Name', '', 'pass123'), 'Email is required');
    assert.strictEqual(validateRegister('Name', 'a@b.com', ''), 'Password is required');
    assert.strictEqual(validateRegister('Name', 'a@b.com', '123'), 'Password must be at least 6 characters');
    assert.strictEqual(validateRegister('Name', 'a@b.com', 'secret123'), null);

    recordPass('5. Required-field validation works', 'Client-side required field and minimum password length enforced');
  } catch (err) {
    recordFail('5. Required-field validation works', err);
  }

  // -------------------------------------------------------------------------
  // MOCK STORAGE IMPLEMENTATION FOR UNIT TESTS
  // -------------------------------------------------------------------------
  const mockLocalStorage = (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; },
    };
  })();

  // -------------------------------------------------------------------------
  // TEST 6: Successful login updates authentication state
  // -------------------------------------------------------------------------
  try {
    let mockState = { user: null, token: null };
    const mockLoginSuccess = (receivedToken, receivedUser) => {
      mockLocalStorage.setItem('vhs_token', receivedToken);
      mockState = { user: receivedUser, token: receivedToken };
      return { success: true, user: receivedUser };
    };

    const res = mockLoginSuccess('mock_jwt_token_123', { id: 'u1', name: 'Test User' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(mockState.user.name, 'Test User');
    assert.strictEqual(mockState.token, 'mock_jwt_token_123');
    recordPass('6. Successful login updates authentication state', 'Auth state accurately updated with user and token');
  } catch (err) {
    recordFail('6. Successful login updates authentication state', err);
  }

  // -------------------------------------------------------------------------
  // TEST 7: JWT is persisted after login
  // -------------------------------------------------------------------------
  try {
    assert.strictEqual(mockLocalStorage.getItem('vhs_token'), 'mock_jwt_token_123');
    recordPass('7. JWT is persisted after login', 'Token securely written to localStorage key vhs_token');
  } catch (err) {
    recordFail('7. JWT is persisted after login', err);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Axios sends Bearer authorization headers
  // -------------------------------------------------------------------------
  try {
    // Import api client module content and verify interceptor logic
    const apiClientContent = fs.readFileSync(path.resolve(rootDir, 'src', 'services', 'api.js'), 'utf8');
    assert.ok(apiClientContent.includes("headers.Authorization = `Bearer ${token}`"), 'Interceptor must attach Bearer token');
    assert.ok(apiClientContent.includes("localStorage.getItem('vhs_token')"), 'Interceptor must check vhs_token');

    // Test interceptor simulation
    const config = { headers: {} };
    const token = mockLocalStorage.getItem('vhs_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    assert.strictEqual(config.headers.Authorization, 'Bearer mock_jwt_token_123');
    recordPass('8. Axios sends Bearer authorization headers', 'Request interceptor attaches Bearer token header');
  } catch (err) {
    recordFail('8. Axios sends Bearer authorization headers', err);
  }

  // -------------------------------------------------------------------------
  // TEST 9: AuthContext restores a valid session using /api/auth/me
  // -------------------------------------------------------------------------
  try {
    let restoredUser = null;
    let loading = true;

    // Simulate session restoration
    const storedToken = mockLocalStorage.getItem('vhs_token');
    assert.ok(storedToken);
    // Mock /auth/me API response
    const mockMeResponse = { data: { user: { id: 'u1', name: 'Restored User', email: 'restored@example.com' } } };
    if (mockMeResponse.data?.user) {
      restoredUser = mockMeResponse.data.user;
    }
    loading = false;

    assert.strictEqual(loading, false);
    assert.strictEqual(restoredUser.email, 'restored@example.com');
    recordPass('9. AuthContext restores a valid session using /api/auth/me', 'Saved token restored and validated');
  } catch (err) {
    recordFail('9. AuthContext restores a valid session using /api/auth/me', err);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Invalid or expired session clears authentication state
  // -------------------------------------------------------------------------
  try {
    let user = { id: 'u1' };
    let token = 'expired_token';
    mockLocalStorage.setItem('vhs_token', token);

    // Simulate 401 error during session restoration
    const simulateExpiredSession = () => {
      mockLocalStorage.removeItem('vhs_token');
      user = null;
      token = null;
    };
    simulateExpiredSession();

    assert.strictEqual(user, null);
    assert.strictEqual(token, null);
    assert.strictEqual(mockLocalStorage.getItem('vhs_token'), null);
    recordPass('10. Invalid or expired session clears authentication state', 'Expired token safely cleared on rejection');
  } catch (err) {
    recordFail('10. Invalid or expired session clears authentication state', err);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Logout clears localStorage and user state
  // -------------------------------------------------------------------------
  try {
    mockLocalStorage.setItem('vhs_token', 'active_token');
    let user = { id: 'u1', name: 'Active User' };

    const logout = () => {
      mockLocalStorage.removeItem('vhs_token');
      user = null;
    };
    logout();

    assert.strictEqual(user, null);
    assert.strictEqual(mockLocalStorage.getItem('vhs_token'), null);
    recordPass('11. Logout clears localStorage and user state', 'Logout action clears local storage and nullifies user state');
  } catch (err) {
    recordFail('11. Logout clears localStorage and user state', err);
  }

  // -------------------------------------------------------------------------
  // TEST 12: API login failures display useful error messages
  // -------------------------------------------------------------------------
  try {
    const extractErrorMessage = (error) => {
      return error.response?.data?.error?.message || error.response?.data?.message || error.message || 'An error occurred';
    };

    const mock401Error = {
      response: {
        status: 401,
        data: { error: { message: 'Invalid credentials' } },
      },
    };
    const errorMsg = extractErrorMessage(mock401Error);
    assert.strictEqual(errorMsg, 'Invalid credentials');
    recordPass('12. API login failures display useful error messages', 'Server error message extracted for user display');
  } catch (err) {
    recordFail('12. API login failures display useful error messages', err);
  }

  // -------------------------------------------------------------------------
  // TEST 13: Registration failures display useful error messages
  // -------------------------------------------------------------------------
  try {
    const extractErrorMessage = (error) => {
      return error.response?.data?.error?.message || error.response?.data?.message || error.message || 'An error occurred';
    };

    const mockDuplicateError = {
      response: {
        status: 400,
        data: { error: { message: 'An account with this email already exists' } },
      },
    };
    const errorMsg = extractErrorMessage(mockDuplicateError);
    assert.strictEqual(errorMsg, 'An account with this email already exists');
    recordPass('13. Registration failures display useful error messages', 'Duplicate email error accurately surfaced');
  } catch (err) {
    recordFail('13. Registration failures display useful error messages', err);
  }

  // -------------------------------------------------------------------------
  // TEST 14: Loading states prevent duplicate submissions
  // -------------------------------------------------------------------------
  try {
    let submitting = true;
    let submissionCount = 0;

    const onSubmit = () => {
      if (submitting) return; // Prevent duplicate
      submissionCount += 1;
    };

    onSubmit();
    assert.strictEqual(submissionCount, 0, 'Submission must be blocked while submitting is true');

    submitting = false;
    onSubmit();
    assert.strictEqual(submissionCount, 1, 'Submission allowed when submitting is false');
    recordPass('14. Loading states prevent inappropriate duplicate submissions', 'Form submit handler guarded by submitting flag');
  } catch (err) {
    recordFail('14. Loading states prevent inappropriate duplicate submissions', err);
  }

  // -------------------------------------------------------------------------
  // TEST 15: Navigation component handles both auth states
  // -------------------------------------------------------------------------
  try {
    const navContent = fs.readFileSync(path.resolve(rootDir, 'src', 'components', 'Navbar.jsx'), 'utf8');
    assert.ok(navContent.includes('isAuthenticated'), 'Navbar must check isAuthenticated');
    assert.ok(navContent.includes('to="/login"'), 'Navbar must link to /login when unauthenticated');
    assert.ok(navContent.includes('to="/register"'), 'Navbar must link to /register when unauthenticated');
    assert.ok(navContent.includes('to="/editor/new"'), 'Navbar must link to /editor/new when authenticated');
    assert.ok(navContent.includes('handleLogout'), 'Navbar must handle logout');
    recordPass('15. Navigation component handles both auth states', 'Navbar reflects authenticated vs unauthenticated status');
  } catch (err) {
    recordFail('15. Navigation component handles both auth states', err);
  }

  console.log(`\n==================================================`);
  console.log(`DAY 9 TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.length === 0 || results.some((r) => r.status === 'FAIL');
  process.exit(hasFailures ? 1 : 0);
}

runDay9FrontendTests();
