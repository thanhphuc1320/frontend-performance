DROP INDEX IF EXISTS stores_onboarding_idempotency_idx;
ALTER TABLE stores DROP COLUMN IF EXISTS onboarding_idempotency_key;
