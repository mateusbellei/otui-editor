<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~~/stores/editor'

const editor = useEditorStore()
const { selectedNode } = storeToRefs(editor)

type Row = { k: string; v: string }

const entries = computed<Row[]>(() => {
  const n = selectedNode.value
  if (!n) return []
  const props = Object.entries(n.properties || {}).sort(([a], [b]) => a.localeCompare(b))
  return props.map(([k, v]) => ({ k, v }))
})
</script>

<template>
  <div>
    <div v-if="!selectedNode" class="text-sm text-muted">Selecione um widget na árvore.</div>
    <div v-else class="space-y-3">
      <div class="text-sm">
        <div class="font-medium">Tipo</div>
        <div class="text-muted">{{ selectedNode.originalTypeName || selectedNode.type }}</div>
      </div>
      <div>
        <div class="font-medium mb-1">Propriedades</div>
        <UTable
          :rows="entries"
          :columns="[{ accessorKey: 'k', header: 'Chave' }, { accessorKey: 'v', header: 'Valor' }]"
          :empty-state="{ icon: 'i-lucide-table-2', label: 'Sem propriedades' }"
        />
      </div>
      <div v-if="selectedNode.propertyList?.length">
        <div class="font-medium mb-1">PropertyList (ordem original)</div>
        <pre class="text-xs bg-muted/30 rounded p-2 max-h-64 overflow-auto">{{ JSON.stringify(selectedNode.propertyList, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

