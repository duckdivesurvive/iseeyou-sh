-- tests/supabase/test_schema.sql
-- Run against a database with all migrations applied.
-- Each block tests one migration. Every query should return expected results.
-- If any assertion fails, the query returns a row with 'FAIL' in the result column.

-- =============================================================
-- Test: Enums exist with correct values
-- =============================================================
DO $$
BEGIN
  -- context_category enum
  ASSERT (
    SELECT count(*) = 5
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'context_category'
  ), 'context_category enum should have 5 values';

  -- permission_level enum
  ASSERT (
    SELECT count(*) = 3
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'permission_level'
  ), 'permission_level enum should have 3 values';

  -- model_category enum
  ASSERT (
    SELECT count(*) = 4
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'model_category'
  ), 'model_category enum should have 4 values';

  RAISE NOTICE 'PASS: All enums exist with correct values';
END $$;

-- =============================================================
-- Test: workspaces table structure
-- =============================================================
DO $$
BEGIN
  -- Table exists
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspaces'
    )
  ), 'workspaces table should exist';

  -- Has correct columns
  ASSERT (
    SELECT count(*) = 5
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces'
  ), 'workspaces should have 5 columns (id, name, slug, owner_id, created_at)';

  -- Slug is unique
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'workspaces' AND indexdef ILIKE '%unique%' AND indexdef LIKE '%slug%'
    )
  ), 'workspaces.slug should have a unique constraint';

  RAISE NOTICE 'PASS: workspaces table structure correct';
END $$;

-- =============================================================
-- Test: projects table structure
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'projects'
    )
  ), 'projects table should exist';

  ASSERT (
    SELECT count(*) = 7
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
  ), 'projects should have 7 columns (id, workspace_id, name, slug, parent_id, codebase_path, created_at)';

  -- slug unique within workspace
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'projects' AND indexdef ILIKE '%unique%' AND indexdef LIKE '%workspace_id%' AND indexdef LIKE '%slug%'
    )
  ), 'projects should have unique constraint on (workspace_id, slug)';

  RAISE NOTICE 'PASS: projects table structure correct';
END $$;

-- =============================================================
-- Test: project_permissions table structure
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'project_permissions'
    )
  ), 'project_permissions table should exist';

  -- One row per project per category (unique constraint)
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'project_permissions'
        AND indexdef ILIKE '%unique%'
        AND indexdef LIKE '%project_id%'
        AND indexdef LIKE '%category%'
    )
  ), 'project_permissions should have unique constraint on (project_id, category)';

  RAISE NOTICE 'PASS: project_permissions table structure correct';
END $$;

-- =============================================================
-- Test: project_models table structure
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'project_models'
    )
  ), 'project_models table should exist';

  -- Upsert key: unique on (project_id, category, key)
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'project_models'
        AND indexdef ILIKE '%unique%'
        AND indexdef LIKE '%project_id%'
        AND indexdef LIKE '%category%'
        AND indexdef LIKE '%key%'
    )
  ), 'project_models should have unique constraint on (project_id, category, key)';

  RAISE NOTICE 'PASS: project_models table structure correct';
END $$;

-- =============================================================
-- Test: decisions table structure
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'decisions'
    )
  ), 'decisions table should exist';

  -- Has supersedes_id self-referential FK
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'decisions'
        AND column_name = 'supersedes_id'
    )
  ), 'decisions should have supersedes_id column';

  -- Has propagate boolean
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'decisions'
        AND column_name = 'propagate'
        AND data_type = 'boolean'
    )
  ), 'decisions should have propagate boolean column';

  RAISE NOTICE 'PASS: decisions table structure correct';
END $$;

-- =============================================================
-- Test: task_states table structure
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'task_states'
    )
  ), 'task_states table should exist';

  -- One state per project (unique on project_id)
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'task_states'
        AND indexdef ILIKE '%unique%'
        AND indexdef LIKE '%project_id%'
    )
  ), 'task_states should have unique constraint on project_id';

  -- Uses text[] arrays
  ASSERT (
    SELECT data_type = 'ARRAY'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_states'
      AND column_name = 'in_progress'
  ), 'task_states.in_progress should be an array';

  RAISE NOTICE 'PASS: task_states table structure correct';
END $$;

-- =============================================================
-- Test: nesting depth trigger
-- =============================================================
DO $$
DECLARE
  test_workspace_id uuid;
  level1_id uuid;
  level2_id uuid;
  level3_id uuid;
BEGIN
  -- Create test workspace (need a user first — skip in pure schema test,
  -- this test requires a seeded auth.users row or service_role)
  -- For now, verify the trigger function exists
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'check_project_nesting_depth'
    )
  ), 'check_project_nesting_depth function should exist';

  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trigger_check_nesting_depth'
    )
  ), 'trigger_check_nesting_depth trigger should exist on projects table';

  RAISE NOTICE 'PASS: nesting depth trigger exists';
END $$;

-- =============================================================
-- Test: permission inheritance trigger
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'check_permission_inheritance'
    )
  ), 'check_permission_inheritance function should exist';

  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trigger_check_permission_inheritance'
    )
  ), 'trigger_check_permission_inheritance trigger should exist on project_permissions table';

  RAISE NOTICE 'PASS: permission inheritance trigger exists';
END $$;

-- =============================================================
-- Test: RLS is enabled on all tables
-- =============================================================
DO $$
DECLARE
  tables text[] := ARRAY['workspaces', 'projects', 'project_permissions', 'project_models', 'decisions', 'task_states'];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    ASSERT (
      SELECT rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ), format('RLS should be enabled on %s', tbl);
  END LOOP;

  RAISE NOTICE 'PASS: RLS enabled on all tables';
END $$;

-- =============================================================
-- Test: updated_at trigger exists for relevant tables
-- =============================================================
DO $$
BEGIN
  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'set_updated_at'
    )
  ), 'set_updated_at function should exist';

  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trigger_set_updated_at_project_models'
    )
  ), 'updated_at trigger should exist on project_models';

  ASSERT (
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trigger_set_updated_at_task_states'
    )
  ), 'updated_at trigger should exist on task_states';

  RAISE NOTICE 'PASS: updated_at triggers exist';
END $$;
