<!-- app/pages/index.vue -->
<script setup lang="ts">
const { data: workspaces } = await useWorkspaces()
const activeWorkspaceId = ref(workspaces.value?.[0]?.id || '')

// Update active workspace when data loads
watch(workspaces, (ws) => {
  if (ws && ws.length > 0 && !activeWorkspaceId.value) {
    activeWorkspaceId.value = ws[0].id
  }
})

const workspaceId = computed(() => activeWorkspaceId.value || undefined)
const { data: projects } = await useProjects(workspaceId)

const activeWorkspace = computed(() =>
  workspaces.value?.find((w: any) => w.id === activeWorkspaceId.value)
)
</script>

<template>
  <div class="min-h-screen bg-muted-50 dark:bg-muted-950">
    <div class="max-w-4xl mx-auto py-8 px-4">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-muted-800 dark:text-muted-100">
            {{ activeWorkspace?.name || 'Workspace' }}
          </h1>
          <p class="text-muted-400 text-sm mt-1">Project hierarchy</p>
        </div>
        <div v-if="workspaces && workspaces.length > 1" class="flex gap-2">
          <button
            v-for="ws in workspaces"
            :key="ws.id"
            class="px-3 py-1.5 text-sm rounded-lg transition-colors"
            :class="ws.id === activeWorkspaceId
              ? 'bg-primary-500 text-white'
              : 'bg-muted-100 dark:bg-muted-800 text-muted-600 dark:text-muted-300 hover:bg-muted-200 dark:hover:bg-muted-700'"
            @click="activeWorkspaceId = ws.id"
          >
            {{ ws.name }}
          </button>
        </div>
      </div>

      <BaseCard class="p-4">
        <ProjectTree :projects="projects || []" />
      </BaseCard>
    </div>
  </div>
</template>
