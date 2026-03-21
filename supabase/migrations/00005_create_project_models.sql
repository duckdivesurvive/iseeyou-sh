-- supabase/migrations/00005_create_project_models.sql

CREATE TABLE project_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category model_category NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, category, key)
);

CREATE INDEX idx_project_models_project_id ON project_models(project_id);
CREATE INDEX idx_project_models_category ON project_models(project_id, category);
