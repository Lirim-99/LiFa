import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * One-time Jest globalSetup — runs once before the entire e2e run.
 *
 * 1. Connects to the default `postgres` DB as the dev user.
 * 2. Drops + re-creates `lifa_test` so every run starts clean.
 * 3. Runs `prisma migrate deploy` against `lifa_test` to set up the schema.
 *
 * Reference seeding (roles + tax templates) is handled per-test by
 * `resetTestDb()` so it survives our TRUNCATE pass.
 */
export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.E2E_ADMIN_DATABASE_URL ?? "postgresql://lifa:lifa_dev_password@localhost:5432/postgres";
  const testUrl =
    process.env.E2E_TEST_DATABASE_URL ??
    "postgresql://lifa:lifa_dev_password@localhost:5432/lifa_test?schema=public";

  // 1 + 2. Reset the database.
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  // Boot the rest of the world out of lifa_test so DROP doesn't deadlock.
  await admin.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'lifa_test' AND pid <> pg_backend_pid()
  `);
  await admin.query(`DROP DATABASE IF EXISTS lifa_test`);
  await admin.query(`CREATE DATABASE lifa_test`);
  await admin.end();

  // 3. Apply migrations.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  // Stash the URL where the in-process tests will pick it up.
  process.env.DATABASE_URL = testUrl;
}
