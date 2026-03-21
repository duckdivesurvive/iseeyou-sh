<!-- app/components/ProjectTree.vue -->
<script setup lang="ts">
const props = defineProps<{
  projects: any[]
}>()

const roots = computed(() =>
  props.projects.filter((p) => !p.parent_id)
)
</script>

<template>
  <div v-if="projects.length === 0" class="text-center py-12 text-muted-400">
    No projects yet. Use <code class="bg-muted-100 dark:bg-muted-800 px-1 rounded">uc init</code> to create one.
  </div>
  <div v-else>
    <ProjectTreeNode
      v-for="root in roots"
      :key="root.id"
      :project="root"
      :all-projects="projects"
      :depth="0"
    />
  </div>
</template>
