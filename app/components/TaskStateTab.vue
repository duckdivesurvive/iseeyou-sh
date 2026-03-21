<!-- app/components/TaskStateTab.vue -->
<script setup lang="ts">
const props = defineProps<{
  taskState: any | null
}>()
</script>

<template>
  <div v-if="!taskState" class="text-center py-8 text-muted-400">
    No task state recorded yet.
  </div>
  <div v-else class="space-y-6">
    <div v-if="taskState.in_progress?.length">
      <h3 class="text-sm font-semibold text-info-500 uppercase tracking-wide mb-2">In Progress</h3>
      <ul class="space-y-1">
        <li v-for="item in taskState.in_progress" :key="item" class="flex items-center gap-2 text-muted-700 dark:text-muted-200">
          <span class="w-2 h-2 rounded-full bg-info-500 shrink-0"></span>
          {{ item }}
        </li>
      </ul>
    </div>

    <div v-if="taskState.blocked?.length">
      <h3 class="text-sm font-semibold text-danger-500 uppercase tracking-wide mb-2">Blocked</h3>
      <ul class="space-y-1">
        <li v-for="item in taskState.blocked" :key="item" class="flex items-center gap-2 text-muted-700 dark:text-muted-200">
          <span class="w-2 h-2 rounded-full bg-danger-500 shrink-0"></span>
          {{ item }}
        </li>
      </ul>
    </div>

    <div v-if="taskState.completed?.length">
      <h3 class="text-sm font-semibold text-success-500 uppercase tracking-wide mb-2">Completed</h3>
      <ul class="space-y-1">
        <li v-for="item in taskState.completed" :key="item" class="flex items-center gap-2 text-muted-700 dark:text-muted-200">
          <span class="w-2 h-2 rounded-full bg-success-500 shrink-0"></span>
          {{ item }}
        </li>
      </ul>
    </div>

    <div v-if="taskState.next?.length">
      <h3 class="text-sm font-semibold text-muted-400 uppercase tracking-wide mb-2">Next</h3>
      <ul class="space-y-1">
        <li v-for="item in taskState.next" :key="item" class="flex items-center gap-2 text-muted-500">
          <span class="w-2 h-2 rounded-full bg-muted-300 shrink-0"></span>
          {{ item }}
        </li>
      </ul>
    </div>

    <div class="text-xs text-muted-400 pt-4 border-t border-muted-200 dark:border-muted-700">
      Last updated: {{ taskState.updated_at ? new Date(taskState.updated_at).toLocaleString() : 'N/A' }}
    </div>
  </div>
</template>
