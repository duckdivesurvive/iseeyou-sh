-- supabase/migrations/00010_create_rls_policies.sql

-- All tables are scoped to workspace ownership.
-- The user must own the workspace to access any data within it.

-- =====================
-- workspaces
-- =====================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workspaces"
  ON workspaces FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own workspaces"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own workspaces"
  ON workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- =====================
-- projects
-- =====================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their workspaces"
  ON projects FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their workspaces"
  ON projects FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their workspaces"
  ON projects FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects in their workspaces"
  ON projects FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- =====================
-- project_permissions
-- =====================
ALTER TABLE project_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage permissions for their projects"
  ON project_permissions FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- =====================
-- project_models
-- =====================
ALTER TABLE project_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage models for their projects"
  ON project_models FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- =====================
-- decisions
-- =====================
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage decisions for their projects"
  ON decisions FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- =====================
-- task_states
-- =====================
ALTER TABLE task_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage task states for their projects"
  ON task_states FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );
