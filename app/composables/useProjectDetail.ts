// app/composables/useProjectDetail.ts
export function useProjectDetail(projectId: Ref<string>) {
  const project = useFetch(() => `/api/projects/${projectId.value}`, {
    watch: [projectId],
  })

  const permissions = useFetch(() => `/api/projects/${projectId.value}/permissions`, {
    watch: [projectId],
  })

  const model = useFetch(() => `/api/projects/${projectId.value}/model`, {
    watch: [projectId],
  })

  const decisions = useFetch(() => `/api/projects/${projectId.value}/decisions`, {
    watch: [projectId],
  })

  const taskState = useFetch(() => `/api/projects/${projectId.value}/task-state`, {
    watch: [projectId],
  })

  return { project, permissions, model, decisions, taskState }
}
