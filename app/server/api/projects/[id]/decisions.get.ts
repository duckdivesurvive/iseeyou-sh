import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'project id required' })

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('decisions')
    .select('id, decision, rationale, alternatives, supersedes_id, propagate, git_ref, created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
