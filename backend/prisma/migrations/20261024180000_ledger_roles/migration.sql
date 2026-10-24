-- New account roles. Applied in its own migration so the values can be
-- used by the following migration (PostgreSQL cannot use a new enum value
-- in the same transaction that adds it).

ALTER TYPE "AccountRole" ADD VALUE 'INVENTORY';
ALTER TYPE "AccountRole" ADD VALUE 'COGS';
ALTER TYPE "AccountRole" ADD VALUE 'SALARIES';
ALTER TYPE "AccountRole" ADD VALUE 'WAGES_PAYABLE';
ALTER TYPE "AccountRole" ADD VALUE 'PENSION_PAYABLE';
ALTER TYPE "AccountRole" ADD VALUE 'WAGE_TAX_PAYABLE';
ALTER TYPE "AccountRole" ADD VALUE 'FIXED_ASSET';
ALTER TYPE "AccountRole" ADD VALUE 'ACCUMULATED_DEPRECIATION';
ALTER TYPE "AccountRole" ADD VALUE 'DEPRECIATION_EXPENSE';
ALTER TYPE "AccountRole" ADD VALUE 'DISPOSAL_GAIN';
ALTER TYPE "AccountRole" ADD VALUE 'DISPOSAL_LOSS';
