-- High Growth Value Scout agent output (Guide 6 extension)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS growth_payload JSONB;
