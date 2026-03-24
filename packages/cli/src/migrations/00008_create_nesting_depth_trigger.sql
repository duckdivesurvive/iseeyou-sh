-- supabase/migrations/00008_create_nesting_depth_trigger.sql

-- Rejects project inserts/updates where nesting depth would exceed 3 levels.
-- Level 1 = root project (parent_id IS NULL)
-- Level 2 = child of root
-- Level 3 = grandchild (max allowed)

CREATE OR REPLACE FUNCTION check_project_nesting_depth()
RETURNS TRIGGER AS $$
DECLARE
  depth integer := 0;
  current_parent_id uuid := NEW.parent_id;
BEGIN
  -- Reject self-referential parent
  IF current_parent_id = NEW.id THEN
    RAISE EXCEPTION 'A project cannot be its own parent.';
  END IF;

  -- Root projects are always allowed
  IF current_parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Walk up the parent chain and count ancestors
  -- Max 2 ancestors allowed (root -> child -> grandchild = 3 levels)
  WHILE current_parent_id IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > 2 THEN
      RAISE EXCEPTION 'Maximum nesting depth of 3 levels exceeded. Cannot create project deeper than grandchild level.';
    END IF;

    SELECT parent_id INTO current_parent_id
    FROM projects
    WHERE id = current_parent_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_nesting_depth
  BEFORE INSERT OR UPDATE OF parent_id ON projects
  FOR EACH ROW
  EXECUTE FUNCTION check_project_nesting_depth();
