import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Tag from '../models/Tag.js';

const testRunId = `test_${Date.now()}`;
const createdUserIds = [];
const createdPostIds = [];
const createdTagIds = [];

const results = [];

const recordPass = (testName, details) => {
  results.push({ name: testName, status: 'PASS', details });
  console.log(`[PASS] ${testName}`);
};

const recordFail = (testName, error) => {
  results.push({ name: testName, status: 'FAIL', details: error.message });
  console.error(`[FAIL] ${testName}: ${error.message}`);
};

async function runTests() {
  console.log(`\n==================================================`);
  console.log(`VHS Day 2 Database Models Verification (${testRunId})`);
  console.log(`==================================================\n`);

  try {
    await connectDB();
    console.log('[Setup] Connected to database. Ensuring indexes...');
    await User.syncIndexes();
    await Tag.syncIndexes();
    await Post.syncIndexes();
    console.log('[Setup] Indexes synchronized successfully.\n');

    // ----------------------------------------------------
    // USER MODEL TESTS
    // ----------------------------------------------------
    console.log('--- USER MODEL TESTS ---');

    // Test 1: Valid User Creation
    try {
      const user = await User.create({
        name: '  Test Developer  ',
        email: `  User_${testRunId}@Example.COM  `,
        password: 'InitialPassword123!',
      });
      createdUserIds.push(user._id);

      assert.strictEqual(user.name, 'Test Developer', 'Name should be trimmed');
      assert.strictEqual(user.email, `user_${testRunId.toLowerCase()}@example.com`, 'Email should be lowercased and trimmed');
      assert.strictEqual(user.bio, '', 'Bio should default to empty string');
      assert.strictEqual(user.avatarUrl, '', 'AvatarUrl should default to empty string');
      assert.ok(user.createdAt instanceof Date, 'createdAt timestamp should be set');
      assert.ok(user.updatedAt instanceof Date, 'updatedAt timestamp should be set');
      recordPass('User - Valid Creation and Defaults', 'User created with trimmed name, lowercased email, defaults, and timestamps');
    } catch (err) {
      recordFail('User - Valid Creation and Defaults', err);
    }

    // Test 2: Required Name Validation
    try {
      await User.create({
        email: `missing_name_${testRunId}@example.com`,
        password: 'Password123!',
      });
      recordFail('User - Required Name Validation', new Error('User creation should have failed without name'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.name, 'Should fail with ValidationError on name');
      recordPass('User - Required Name Validation', 'ValidationError thrown when name is missing');
    }

    // Test 3: Required Email Validation
    try {
      await User.create({
        name: 'No Email User',
        password: 'Password123!',
      });
      recordFail('User - Required Email Validation', new Error('User creation should have failed without email'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.email, 'Should fail with ValidationError on email');
      recordPass('User - Required Email Validation', 'ValidationError thrown when email is missing');
    }

    // Test 4: Password Hashing Before Persistence
    let testUserForPassword;
    try {
      testUserForPassword = await User.create({
        name: 'Security Test User',
        email: `sec_${testRunId}@example.com`,
        password: 'PlainTextSecretPassword!',
      });
      createdUserIds.push(testUserForPassword._id);

      // Fetch user with password explicitly selected
      const fetched = await User.findById(testUserForPassword._id).select('+password');
      assert.notStrictEqual(fetched.password, 'PlainTextSecretPassword!', 'Password must not be stored in plain text');
      assert.ok(fetched.password.startsWith('$2'), 'Password hash must be a valid bcrypt hash');
      const isMatch = await bcrypt.compare('PlainTextSecretPassword!', fetched.password);
      assert.strictEqual(isMatch, true, 'bcrypt.compare must verify the raw password against the stored hash');

      // Verify password excluded in normal query without +password
      const normalQuery = await User.findById(testUserForPassword._id);
      assert.strictEqual(normalQuery.password, undefined, 'Password must not be returned in normal queries');
      const jsonOutput = normalQuery.toJSON();
      assert.strictEqual(jsonOutput.password, undefined, 'Password must be omitted from serialized JSON');

      recordPass('User - Password Hashing & Query Exclusion', 'Password hashed with bcrypt and excluded from normal queries and JSON output');
    } catch (err) {
      recordFail('User - Password Hashing & Query Exclusion', err);
    }

    // Test 5: Password NOT Re-hashed on Unchanged Save
    try {
      const initialFetched = await User.findById(testUserForPassword._id).select('+password');
      const initialHash = initialFetched.password;

      initialFetched.bio = 'Updated bio for testing unchanged password hook';
      await initialFetched.save();

      const afterUpdate = await User.findById(testUserForPassword._id).select('+password');
      assert.strictEqual(afterUpdate.password, initialHash, 'Password hash must remain identical when password is not modified');
      recordPass('User - Password Not Re-hashed When Unchanged', 'Password hash unchanged on document update');
    } catch (err) {
      recordFail('User - Password Not Re-hashed When Unchanged', err);
    }

    // Test 6: Password Re-hashed When Explicitly Changed
    try {
      const userToRehash = await User.findById(testUserForPassword._id).select('+password');
      const originalHash = userToRehash.password;

      userToRehash.password = 'BrandNewPassword456!';
      await userToRehash.save();

      const afterRehash = await User.findById(testUserForPassword._id).select('+password');
      assert.notStrictEqual(afterRehash.password, originalHash, 'Password hash must change when password is updated');
      const newMatch = await bcrypt.compare('BrandNewPassword456!', afterRehash.password);
      assert.strictEqual(newMatch, true, 'bcrypt.compare must match the newly updated password');
      recordPass('User - Password Re-hashed When Changed', 'New bcrypt hash generated when password is changed');
    } catch (err) {
      recordFail('User - Password Re-hashed When Changed', err);
    }

    // Test 7: Bio Maximum Length Validation (Max 200 chars)
    try {
      const longBio = 'a'.repeat(201);
      await User.create({
        name: 'Long Bio User',
        email: `longbio_${testRunId}@example.com`,
        password: 'Password123!',
        bio: longBio,
      });
      recordFail('User - Bio Max Length Validation', new Error('Bio longer than 200 chars should have failed'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.bio, 'Should fail with ValidationError on bio');
      recordPass('User - Bio Max Length Validation', 'ValidationError thrown when bio exceeds 200 characters');
    }

    // Test 8: Email Uniqueness
    try {
      const duplicateUser = await User.create({
        name: 'Duplicate User',
        email: `sec_${testRunId}@example.com`, // Same email as testUserForPassword
        password: 'Password123!',
      });
      createdUserIds.push(duplicateUser._id);
      recordFail('User - Email Uniqueness Constraint', new Error('Duplicate email creation should have failed'));
    } catch (err) {
      assert.ok(err.code === 11000, `Expected duplicate key error code 11000, got: ${err.code}`);
      recordPass('User - Email Uniqueness Constraint', 'MongoServerError 11000 triggered on duplicate email insertion');
    }

    // ----------------------------------------------------
    // TAG MODEL TESTS
    // ----------------------------------------------------
    console.log('\n--- TAG MODEL TESTS ---');

    let createdTag1;
    let createdTag2;

    // Test 9: Valid Tag Creation
    try {
      createdTag1 = await Tag.create({
        name: `  JavaScript_${testRunId}  `,
        slug: `  javascript-${testRunId.toLowerCase()}  `,
      });
      createdTagIds.push(createdTag1._id);

      assert.strictEqual(createdTag1.name, `javascript_${testRunId.toLowerCase()}`, 'Name should be trimmed and lowercased');
      assert.strictEqual(createdTag1.slug, `javascript-${testRunId.toLowerCase()}`, 'Slug should be trimmed and lowercased');
      assert.ok(createdTag1.createdAt instanceof Date, 'createdAt should be set');
      recordPass('Tag - Valid Creation and Normalization', 'Tag created with trimmed and lowercased name and slug');
    } catch (err) {
      recordFail('Tag - Valid Creation and Normalization', err);
    }

    // Test 10: Tag Required Fields Validation
    try {
      await Tag.create({});
      recordFail('Tag - Required Name and Slug Validation', new Error('Tag should require name and slug'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.name && err.errors.slug, 'Should fail with validation errors on name and slug');
      recordPass('Tag - Required Name and Slug Validation', 'ValidationError thrown when name and slug are missing');
    }

    // Test 11: Tag Name Uniqueness
    try {
      const dupNameTag = await Tag.create({
        name: `javascript_${testRunId.toLowerCase()}`, // Duplicate of createdTag1
        slug: `another-slug-${testRunId.toLowerCase()}`,
      });
      createdTagIds.push(dupNameTag._id);
      recordFail('Tag - Name Uniqueness Constraint', new Error('Duplicate tag name should have failed'));
    } catch (err) {
      assert.ok(err.code === 11000, `Expected duplicate key error code 11000, got: ${err.code}`);
      recordPass('Tag - Name Uniqueness Constraint', 'Duplicate key error 11000 on tag name uniqueness');
    }

    // Test 12: Tag Slug Uniqueness
    try {
      createdTag2 = await Tag.create({
        name: `webdev_${testRunId.toLowerCase()}`,
        slug: `webdev-${testRunId.toLowerCase()}`,
      });
      createdTagIds.push(createdTag2._id);

      const dupSlugTag = await Tag.create({
        name: `different_name_${testRunId.toLowerCase()}`,
        slug: `webdev-${testRunId.toLowerCase()}`, // Duplicate slug of createdTag2
      });
      createdTagIds.push(dupSlugTag._id);
      recordFail('Tag - Slug Uniqueness Constraint', new Error('Duplicate tag slug should have failed'));
    } catch (err) {
      assert.ok(err.code === 11000, `Expected duplicate key error code 11000, got: ${err.code}`);
      recordPass('Tag - Slug Uniqueness Constraint', 'Duplicate key error 11000 on tag slug uniqueness');
    }

    // ----------------------------------------------------
    // POST MODEL TESTS
    // ----------------------------------------------------
    console.log('\n--- POST MODEL TESTS ---');

    const rawMarkdownContent = `# The Architecture of VHS\n\nThis is a **developer-first** platform.\n\n\`\`\`javascript\nconsole.log("Hello, Hashnode!");\n\`\`\`\n\n| Feature | Status |\n|---|---|\n| MERN | Verified |`;

    // Test 13: Valid Post Creation with Markdown & Defaults
    let createdPost;
    try {
      createdPost = await Post.create({
        title: '  Building Hashnode with Pure MERN  ',
        slug: `  building-hashnode-${testRunId.toLowerCase()}  `,
        content: rawMarkdownContent,
        author: createdUserIds[0],
        tags: [createdTag1._id, createdTag2._id],
      });
      createdPostIds.push(createdPost._id);

      assert.strictEqual(createdPost.title, 'Building Hashnode with Pure MERN', 'Title should be trimmed');
      assert.strictEqual(createdPost.slug, `building-hashnode-${testRunId.toLowerCase()}`, 'Slug should be lowercased and trimmed');
      assert.strictEqual(createdPost.content, rawMarkdownContent, 'Raw Markdown content must be preserved verbatim');
      assert.strictEqual(createdPost.status, 'draft', 'Status should default to draft');
      assert.strictEqual(createdPost.excerpt, '', 'Excerpt should default to empty string');
      assert.strictEqual(createdPost.coverImage, '', 'CoverImage should default to empty string');
      assert.strictEqual(createdPost.tags.length, 2, 'Tags array should contain both referenced tag IDs');
      assert.ok(createdPost.createdAt instanceof Date, 'createdAt timestamp should be set');
      recordPass('Post - Valid Creation and Defaults', 'Post created with draft status, empty defaults, verbatim Markdown, and timestamps');
    } catch (err) {
      recordFail('Post - Valid Creation and Defaults', err);
    }

    // Test 14: Required Fields Validation (title, slug, content, author)
    try {
      await Post.create({});
      recordFail('Post - Required Fields Validation', new Error('Post should fail without title, slug, content, author'));
    } catch (err) {
      assert.ok(
        err.name === 'ValidationError' &&
          err.errors.title &&
          err.errors.slug &&
          err.errors.content &&
          err.errors.author,
        'Should fail on all required fields'
      );
      recordPass('Post - Required Fields Validation', 'ValidationError thrown on missing title, slug, content, and author');
    }

    // Test 15: Accepted Published Status
    try {
      const publishedPost = await Post.create({
        title: 'Published Article Title',
        slug: `published-article-${testRunId.toLowerCase()}`,
        content: '# Live Content',
        status: 'published',
        author: createdUserIds[0],
      });
      createdPostIds.push(publishedPost._id);
      assert.strictEqual(publishedPost.status, 'published', 'Status should be published');
      recordPass('Post - Published Status Accepted', 'Status "published" stored successfully');
    } catch (err) {
      recordFail('Post - Published Status Accepted', err);
    }

    // Test 16: Invalid Status Rejection
    try {
      await Post.create({
        title: 'Invalid Status Post',
        slug: `invalid-status-${testRunId.toLowerCase()}`,
        content: 'Content',
        status: 'archived', // Not in enum ['draft', 'published']
        author: createdUserIds[0],
      });
      recordFail('Post - Invalid Status Rejection', new Error('Status other than draft/published should fail'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.status, 'Should fail with status ValidationError');
      recordPass('Post - Invalid Status Rejection', 'ValidationError thrown when status is not draft or published');
    }

    // Test 17: Excerpt Max Length Validation (Max 250 chars)
    try {
      const longExcerpt = 'x'.repeat(251);
      await Post.create({
        title: 'Long Excerpt Post',
        slug: `long-excerpt-${testRunId.toLowerCase()}`,
        content: 'Content',
        excerpt: longExcerpt,
        author: createdUserIds[0],
      });
      recordFail('Post - Excerpt Max Length Validation', new Error('Excerpt longer than 250 chars should fail'));
    } catch (err) {
      assert.ok(err.name === 'ValidationError' && err.errors.excerpt, 'Should fail with excerpt ValidationError');
      recordPass('Post - Excerpt Max Length Validation', 'ValidationError thrown when excerpt exceeds 250 characters');
    }

    // Test 18: Slug Uniqueness Constraint
    try {
      const dupSlugPost = await Post.create({
        title: 'Another Post With Same Slug',
        slug: `building-hashnode-${testRunId.toLowerCase()}`, // Duplicate slug of createdPost
        content: 'Duplicate slug test content',
        author: createdUserIds[0],
      });
      createdPostIds.push(dupSlugPost._id);
      recordFail('Post - Slug Uniqueness Constraint', new Error('Duplicate slug should have failed'));
    } catch (err) {
      assert.ok(err.code === 11000, `Expected duplicate key error code 11000, got: ${err.code}`);
      recordPass('Post - Slug Uniqueness Constraint', 'Duplicate key error 11000 triggered on duplicate post slug');
    }

    // Test 19: Population of Author User and Tags
    try {
      const populatedPost = await Post.findById(createdPost._id)
        .populate('author')
        .populate('tags');

      assert.strictEqual(populatedPost.author.name, 'Test Developer', 'Author should be populated with User document');
      assert.strictEqual(populatedPost.tags.length, 2, 'Tags should be populated with 2 Tag documents');
      assert.strictEqual(populatedPost.tags[0].name, `javascript_${testRunId.toLowerCase()}`, 'First tag populated properly');
      recordPass('Post - Population of User Author and Tags', 'Mongoose populate resolves referenced User and Tag documents');
    } catch (err) {
      recordFail('Post - Population of User Author and Tags', err);
    }

  } catch (globalErr) {
    console.error('Fatal error during test run:', globalErr);
  } finally {
    // ----------------------------------------------------
    // CLEANUP TEST RECORDS ONLY
    // ----------------------------------------------------
    console.log('\n--- CLEANUP ---');
    try {
      if (createdPostIds.length > 0) {
        const postDel = await Post.deleteMany({ _id: { $in: createdPostIds } });
        console.log(`[Cleanup] Deleted ${postDel.deletedCount} test post(s).`);
      }
      if (createdTagIds.length > 0) {
        const tagDel = await Tag.deleteMany({ _id: { $in: createdTagIds } });
        console.log(`[Cleanup] Deleted ${tagDel.deletedCount} test tag(s).`);
      }
      if (createdUserIds.length > 0) {
        const userDel = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`[Cleanup] Deleted ${userDel.deletedCount} test user(s).`);
      }
    } catch (cleanErr) {
      console.error('[Cleanup Error]', cleanErr.message);
    } finally {
      await mongoose.disconnect();
      console.log('[Cleanup] Disconnected from MongoDB Atlas.');
    }
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log(`\n==================================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.status === 'PASS').length}/${results.length} PASSED`);
  console.log(`==================================================\n`);

  const hasFailures = results.some((r) => r.status === 'FAIL');
  process.exitCode = hasFailures ? 1 : 0;
}

runTests();
