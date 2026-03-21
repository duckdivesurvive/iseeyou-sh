-- supabase/migrations/00004_create_project_permissions.sql

CREATE TABLE project_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category context_category NOT NULL,
  level permission_level NOT NULL DEFAULT 'none',
  UNIQUE(project_id, category)
);

CREATE INDEX idx_project_permissions_project_id ON project_permissions(project_id);
