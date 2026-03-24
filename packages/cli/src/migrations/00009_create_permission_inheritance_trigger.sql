-- supabase/migrations/00009_create_permission_inheritance_trigger.sql

-- Rejects permission inserts/updates where a child's permission level
-- exceeds its parent's level for the same category.
-- Permission ordering: none(0) < read(1) < write(2)

CREATE OR REPLACE FUNCTION permission_level_to_int(p permission_level)
RETURNS integer AS $$
BEGIN
  CASE p
    WHEN 'none' THEN RETURN 0;
    WHEN 'read' THEN RETURN 1;
    WHEN 'write' THEN RETURN 2;
    ELSE RAISE EXCEPTION 'Unknown permission level: %', p;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_permission_inheritance()
RETURNS TRIGGER AS $$
DECLARE
  project_parent_id uuid;
  parent_level permission_level;
BEGIN
  -- Get the project's parent_id
  SELECT parent_id INTO project_parent_id
  FROM projects
  WHERE id = NEW.project_id;

  -- Root projects (no parent) can have any permission level
  IF project_parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the parent project's permission level for this category
  SELECT level INTO parent_level
  FROM project_permissions
  WHERE project_id = project_parent_id
    AND category = NEW.category;

  -- If parent has no permission row for this category, treat as 'none'
  IF parent_level IS NULL THEN
    parent_level := 'none';
  END IF;

  -- Check: child level cannot exceed parent level
  IF permission_level_to_int(NEW.level) > permission_level_to_int(parent_level) THEN
    RAISE EXCEPTION 'Permission violation: cannot set % to "%" — parent project only has "%"',
      NEW.category, NEW.level, parent_level;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_permission_inheritance
  BEFORE INSERT OR UPDATE OF level ON project_permissions
  FOR EACH ROW
  EXECUTE FUNCTION check_permission_inheritance();
