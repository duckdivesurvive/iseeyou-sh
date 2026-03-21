import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'project id required' })

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('project_permissions')
    .select('category, level')
    .eq('project_id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
