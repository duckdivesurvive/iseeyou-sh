import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'project id required' })

  const client = await serverSupabaseClient(event)

  const { data } = await client
    .from('task_states')
    .select('in_progress, completed, blocked, next, updated_at')
    .eq('project_id', id)
    .single()

  return data
})
