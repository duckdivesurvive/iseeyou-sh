<!-- app/components/DecisionsTab.vue -->
<script setup lang="ts">
const props = defineProps<{
  decisions: any[] | null
}>()

const supersededIds = computed(() => {
  const ids = new Set<string>()
  for (const d of props.decisions || []) {
    if (d.supersedes_id) ids.add(d.supersedes_id)
  }
  return ids
})
</script>

<template>
  <div v-if="!decisions || decisions.length === 0" class="text-center py-8 text-muted-400">
    No decisions recorded yet.
  </div>
  <div v-else class="space-y-4">
    <div
      v-for="decision in decisions"
      :key="decision.id"
      class="p-4 rounded-lg border"
      :class="supersededIds.has(decision.id)
        ? 'border-muted-200 dark:border-muted-700 opacity-50'
        : 'border-muted-200 dark:border-muted-700'"
    >
      <div class="flex items-start justify-between">
        <div class="font-medium text-muted-800 dark:text-muted-100" :class="{ 'line-through': supersededIds.has(decision.id) }">
          {{ decision.decision }}
        </div>
        <div class="flex gap-1.5">
          <span v-if="supersededIds.has(decision.id)" class="text-xs px-1.5 py-0.5 rounded bg-muted-200 dark:bg-muted-700 text-muted-500">
            superseded
          </span>
          <span v-if="decision.propagate" class="text-xs px-1.5 py-0.5 rounded bg-info-100 dark:bg-info-900 text-info-500">
            propagated
          </span>
          <span v-if="decision.git_ref" class="text-xs px-1.5 py-0.5 rounded bg-muted-100 dark:bg-muted-800 text-muted-400 font-mono">
            {{ decision.git_ref }}
          </span>
        </div>
      </div>
      <p class="text-sm text-muted-500 mt-2">{{ decision.rationale }}</p>
      <p v-if="decision.alternatives" class="text-sm text-muted-400 mt-1 italic">
        Alternatives: {{ decision.alternatives }}
      </p>
      <div class="text-xs text-muted-400 mt-2">
        {{ new Date(decision.created_at).toLocaleDateString() }}
      </div>
    </div>
  </div>
</template>
