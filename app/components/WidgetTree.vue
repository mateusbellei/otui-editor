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
      <div class="flex items-center gap-2">
        <div
          class="flex-1 px-2 py-1 rounded cursor-pointer hover:bg-muted/50"
          :class="{'bg-muted': JSON.stringify(editor.selectedPath) === JSON.stringify([...currentPath, i])}"
          @click="editor.selectPath([...currentPath, i])"
        >
          {{ labelOf(n) }}
        </div>
        <div class="flex items-center gap-1">
          <UButton size="xs" variant="ghost" icon="i-lucide-plus" title="Adicionar filho" @click.stop="editor.selectPath([...currentPath, i]); editor.addChild()" />
          <UButton size="xs" variant="ghost" icon="i-lucide-copy" title="Duplicar" @click.stop="editor.selectPath([...currentPath, i]); editor.duplicateSelected()" />
          <UButton size="xs" variant="ghost" icon="i-lucide-arrow-up" title="Mover para cima" @click.stop="editor.selectPath([...currentPath, i]); editor.moveSelected(-1)" />
          <UButton size="xs" variant="ghost" icon="i-lucide-arrow-down" title="Mover para baixo" @click.stop="editor.selectPath([...currentPath, i]); editor.moveSelected(1)" />
          <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash" title="Remover" @click.stop="editor.selectPath([...currentPath, i]); editor.deleteSelected()" />
        </div>
      </div>
      <div v-if="n.children?.length" class="ms-3 border-s border-muted/30 ps-3 my-1">
        <WidgetTree :nodes="n.children" :path="[...(currentPath), i]" />
      </div>
    </li>
  </ul>
</template>

