import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('workspaces')
    .select('id, name, slug')
    .order('created_at')

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data || []
})
