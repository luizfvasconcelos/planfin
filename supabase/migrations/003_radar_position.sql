ALTER TABLE radar_items ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Backfill existing rows with sequential positions per tipo
UPDATE radar_items r
SET position = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY tipo ORDER BY created_at) - 1)::integer AS rn
  FROM radar_items
) sub
WHERE r.id = sub.id;
