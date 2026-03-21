<!-- app/components/PermissionsTab.vue -->
<script setup lang="ts">
const props = defineProps<{
  permissions: any[] | null
}>()

const levelColors: Record<string, string> = {
  write: 'bg-success-100 dark:bg-success-900 text-success-600 dark:text-success-400',
  read: 'bg-warning-100 dark:bg-warning-900 text-warning-600 dark:text-warning-400',
  none: 'bg-danger-100 dark:bg-danger-900 text-danger-600 dark:text-danger-400',
}
</script>

<template>
  <div v-if="!permissions || permissions.length === 0" class="text-center py-8 text-muted-400">
    No permissions configured.
  </div>
  <div v-else class="space-y-3">
    <div
      v-for="perm in permissions"
      :key="perm.category"
      class="flex items-center justify-between p-3 rounded-lg bg-muted-50 dark:bg-muted-800"
    >
      <span class="font-medium text-muted-700 dark:text-muted-200">{{ perm.category }}</span>
      <span
        class="text-sm font-medium px-3 py-1 rounded-full"
        :class="levelColors[perm.level] || 'text-muted-400'"
      >
        {{ perm.level }}
      </span>
    </div>
  </div>
</template>
