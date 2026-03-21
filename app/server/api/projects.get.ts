import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspace_id as string

  if (!workspaceId) throw createError({ statusCode: 400, message: 'workspace_id required' })

  const client = await serverSupabaseClient(event)

  const { data: projects, error } = await client
    .from('projects')
    .select('id, name, slug, parent_id, codebase_path, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at')

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Fetch permissions for all projects
  const ids = (projects || []).map((p: any) => p.id)
  if (ids.length === 0) return []

  const { data: perms } = await client
    .from('project_permissions')
    .select('project_id, category, level')
    .in('project_id', ids)

  const permsByProject: Record<string, Record<string, string>> = {}
  for (const perm of perms || []) {
    if (!permsByProject[perm.project_id]) permsByProject[perm.project_id] = {}
    permsByProject[perm.project_id][perm.category] = perm.level
  }

  return (projects || []).map((p: any) => ({
    ...p,
    permissions: permsByProject[p.id] || {},
  }))
})
