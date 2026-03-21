<!-- app/components/ModelTab.vue -->
<script setup lang="ts">
const props = defineProps<{
  entries: any[] | null
}>()

const grouped = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const entry of props.entries || []) {
    if (!groups[entry.category]) groups[entry.category] = []
    groups[entry.category].push(entry)
  }
  return groups
})
</script>

<template>
  <div v-if="!entries || entries.length === 0" class="text-center py-8 text-muted-400">
    No model entries yet.
  </div>
  <div v-else class="space-y-6">
    <div v-for="(items, category) in grouped" :key="category">
      <h3 class="text-sm font-semibold text-muted-500 uppercase tracking-wide mb-3">
        {{ category }}
      </h3>
      <div class="space-y-2">
        <div
          v-for="item in items"
          :key="item.key"
          class="p-3 rounded-lg bg-muted-50 dark:bg-muted-800"
        >
          <div class="font-medium text-muted-800 dark:text-muted-100">{{ item.key }}</div>
          <div class="text-sm text-muted-500 mt-1 whitespace-pre-wrap">{{ item.value }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
