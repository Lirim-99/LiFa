/**
 * Per-spec setup file. Runs in each Jest worker BEFORE the spec imports
 * anything Prisma-related, so the PrismaClient picks up the test DATABASE_URL.
 *
 * `globalSetup` ran in a separate process and can't mutate worker env, so we
 * set the same defaults here.
 */

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("lifa_test")) {
  process.env.DATABASE_URL =
    process.env.E2E_TEST_DATABASE_URL ??
    "postgresql://lifa:lifa_dev_password@localhost:5432/lifa_test?schema=public";
}

// JWT secret must be set before AuthModule loads.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "e2e-test-secret-not-for-production";
}
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "1h";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

// Silence the Nest startup banner — it floods test output.
process.env.LOG_LEVEL = "error";
