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

function isBoolean(value: string) {
  return value === 'true' || value === 'false'
}
function isNumericKey(key: string) {
  return /^(width|height|margin-|padding-|text-offset-|image-)/.test(key)
}
function onChange(row: Row, value: string | boolean) {
  const v = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  editor.updateProperty(row.k, v)
}
function onRenameId(value: string) {
  editor.renameId(value)
}
</script>

<template>
  <div>
    <div v-if="!selectedNode" class="text-sm text-muted">Selecione um widget na árvore.</div>
    <div v-else class="space-y-3">
      <div class="text-sm">
        <div class="font-medium">Tipo</div>
        <div class="text-muted">{{ selectedNode.originalTypeName || selectedNode.type }}</div>
      </div>
      <div class="space-y-2">
        <div class="font-medium">Propriedades</div>
        <div class="grid grid-cols-1 gap-2">
          <div v-for="row in entries" :key="row.k" class="grid grid-cols-2 gap-2 items-center">
            <div class="text-xs text-muted break-all">{{ row.k }}</div>
            <div class="flex items-center">
              <UToggle v-if="isBoolean(row.v)" :model-value="row.v === 'true'" @update:model-value="onChange(row, $event)" />
              <UInput v-else-if="isNumericKey(row.k)" :model-value="row.v" inputmode="numeric" @change="onChange(row, ($event?.target as HTMLInputElement)?.value || '')" />
              <UInput v-else :model-value="row.v" @change="onChange(row, ($event?.target as HTMLInputElement)?.value || '')" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UFormGroup label="Renomear id">
            <UInput :model-value="selectedNode.properties?.id || ''" placeholder="novo-id" @change="onRenameId(($event?.target as HTMLInputElement)?.value || '')" />
          </UFormGroup>
        </div>
      </div>
      <div v-if="selectedNode.propertyList?.length">
        <div class="font-medium mb-1">PropertyList (ordem original)</div>
        <pre class="text-xs bg-muted/30 rounded p-2 max-h-64 overflow-auto">{{ JSON.stringify(selectedNode.propertyList, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

