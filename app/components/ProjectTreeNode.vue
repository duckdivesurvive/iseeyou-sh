<!-- app/components/ProjectTreeNode.vue -->
<script setup lang="ts">
interface Project {
  id: string
  name: string
  slug: string
  parent_id: string | null
  permissions: Record<string, string>
}

const props = defineProps<{
  project: Project
  allProjects: Project[]
  depth?: number
}>()

const children = computed(() =>
  props.allProjects.filter((p) => p.parent_id === props.project.id)
)

const permissionColors: Record<string, string> = {
  write: 'text-success-500',
  read: 'text-warning-500',
  none: 'text-danger-500',
}
</script>

<template>
  <div :class="{ 'ml-6': depth && depth > 0 }">
    <NuxtLink
      :to="`/projects/${project.id}`"
      class="flex items-center gap-3 p-3 rounded-lg hover:bg-muted-100 dark:hover:bg-muted-800 transition-colors group"
    >
      <div class="flex-1">
        <div class="font-medium text-muted-800 dark:text-muted-100 group-hover:text-primary-500">
          {{ project.name }}
        </div>
        <div class="text-xs text-muted-400">{{ project.slug }}</div>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <span
          v-for="(level, category) in project.permissions"
          :key="category"
          class="text-xs px-1.5 py-0.5 rounded-md bg-muted-100 dark:bg-muted-800"
          :class="permissionColors[level] || 'text-muted-400'"
        >
          {{ category }}:{{ level }}
        </span>
      </div>
    </NuxtLink>
    <ProjectTreeNode
      v-for="child in children"
      :key="child.id"
      :project="child"
      :all-projects="allProjects"
      :depth="(depth || 0) + 1"
    />
  </div>
</template>
