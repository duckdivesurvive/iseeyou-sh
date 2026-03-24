-- supabase/migrations/00011_create_updated_at_trigger.sql

-- Auto-update updated_at column on row modification.
-- Applied to project_models and task_states.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_updated_at_project_models
  BEFORE UPDATE ON project_models
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_set_updated_at_task_states
  BEFORE UPDATE ON task_states
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
