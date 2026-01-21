<script setup lang="ts">
import type { WidgetNode } from '~~/stores/editor'
import { useEditorStore } from '~~/stores/editor'

const props = defineProps<{
  nodes: WidgetNode[]
  path?: number[]
}>()

const editor = useEditorStore()
const currentPath = computed(() => props.path ?? [])

function labelOf(node: WidgetNode) {
  const id = node.properties?.id
  const type = node.originalTypeName || node.type
  return id ? `${type} #${id}` : type
}
</script>

<template>
  <ul class="space-y-1">
    <li v-for="(n, i) in nodes" :key="i">
      <div
        class="px-2 py-1 rounded cursor-pointer hover:bg-muted/50"
        :class="{'bg-muted': JSON.stringify(editor.selectedPath) === JSON.stringify([...currentPath, i])}"
        @click="editor.selectPath([...currentPath, i])"
      >
        {{ labelOf(n) }}
      </div>
      <div v-if="n.children?.length" class="ms-3 border-s border-muted/30 ps-3 my-1">
        <WidgetTree :nodes="n.children" :path="[...(currentPath), i]" />
      </div>
    </li>
  </ul>
</template>

