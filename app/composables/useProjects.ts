// app/composables/useProjects.ts
export function useProjects(workspaceId: Ref<string | undefined>) {
  return useFetch('/api/projects', {
    query: { workspace_id: workspaceId },
    watch: [workspaceId],
    immediate: !!workspaceId.value,
  })
}
