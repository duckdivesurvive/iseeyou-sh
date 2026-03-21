import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'project id required' })

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('projects')
    .select('id, name, slug, parent_id, codebase_path, created_at')
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
