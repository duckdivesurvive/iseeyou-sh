<!-- app/pages/projects/[id].vue -->
<script setup lang="ts">
const route = useRoute()
const projectId = computed(() => route.params.id as string)

const { project, permissions, model, decisions, taskState } = useProjectDetail(projectId)

const activeTab = ref('model')
const tabs = [
  { value: 'model', label: 'Model' },
  { value: 'decisions', label: 'Decisions' },
  { value: 'taskState', label: 'Task State' },
  { value: 'permissions', label: 'Permissions' },
]
</script>

<template>
  <div class="min-h-screen bg-muted-50 dark:bg-muted-950">
    <div class="max-w-4xl mx-auto py-8 px-4">
      <!-- Header -->
      <div class="mb-8">
        <NuxtLink to="/" class="text-sm text-primary-500 hover:text-primary-600 mb-2 inline-block">
          &larr; Back to workspace
        </NuxtLink>
        <h1 class="text-2xl font-bold text-muted-800 dark:text-muted-100">
          {{ project.data.value?.name || 'Loading...' }}
        </h1>
        <p class="text-muted-400 text-sm mt-1">{{ project.data.value?.slug }}</p>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 border-b border-muted-200 dark:border-muted-700">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.value
            ? 'border-primary-500 text-primary-500'
            : 'border-transparent text-muted-400 hover:text-muted-600'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab content -->
      <BaseCard class="p-6">
        <ModelTab v-if="activeTab === 'model'" :entries="model.data.value" />
        <DecisionsTab v-if="activeTab === 'decisions'" :decisions="decisions.data.value" />
        <TaskStateTab v-if="activeTab === 'taskState'" :task-state="taskState.data.value" />
        <PermissionsTab v-if="activeTab === 'permissions'" :permissions="permissions.data.value" />
      </BaseCard>
    </div>
  </div>
</template>
