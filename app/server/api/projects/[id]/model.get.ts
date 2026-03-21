import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'project id required' })

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('project_models')
    .select('category, key, value, updated_at')
    .eq('project_id', id)
    .order('category')
    .order('key')

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
