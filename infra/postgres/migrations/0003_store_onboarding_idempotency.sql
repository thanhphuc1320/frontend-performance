ALTER TABLE stores ADD COLUMN onboarding_idempotency_key text;
CREATE UNIQUE INDEX stores_onboarding_idempotency_idx
  ON stores (created_by, onboarding_idempotency_key)
  WHERE onboarding_idempotency_key IS NOT NULL;
