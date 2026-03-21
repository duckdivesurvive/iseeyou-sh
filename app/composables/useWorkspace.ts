// app/composables/useWorkspace.ts
export function useWorkspaces() {
  return useFetch('/api/workspaces')
}
