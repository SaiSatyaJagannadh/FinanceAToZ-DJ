-- FIRE calculator inputs and risk-profile assessment from the dashboard
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB;
