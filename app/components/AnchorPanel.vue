<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '~~/stores/editor'

const editor = useEditorStore()
const { selectedNode } = storeToRefs(editor)

type AnchorRow = { edge: string; value: string; ok: boolean; note?: string }

function normEdge(edge: string) {
  const n = edge.toLowerCase().replace(/-/g, '')
  if (n === 'left' || n === 'right' || n === 'top' || n === 'bottom') return edge
  if (n === 'horizontalcenter') return 'anchors.horizontalCenter'
  if (n === 'verticalcenter') return 'anchors.verticalCenter'
  if (n === 'centerin') return 'anchors.centerIn'
  return `anchors.${edge}`
}

const anchors = computed<AnchorRow[]>(() => {
  const n = selectedNode.value
  if (!n) return []
  const rows: AnchorRow[] = []
  for (const [k, v] of Object.entries(n.properties || {})) {
    if (!k.startsWith('anchors.')) continue
    const val = String(v)
    const okFormat = /^[a-zA-Z0-9_-]+\.[a-zA-Z-]+$/.test(val) || val === 'none'
    const [, edgeRaw] = (k.match(/^anchors\.(.+)$/) || []) as any
    const normalizedKey = edgeRaw ? normEdge(edgeRaw) : k
    rows.push({
      edge: normalizedKey,
      value: val,
      ok: okFormat,
      note: okFormat ? undefined : 'Formato esperado: alvo.borda (ex.: parent.left)'
    })
  }
  return rows.sort((a, b) => a.edge.localeCompare(b.edge))
})
</script>

<template>
  <div>
    <div v-if="!selectedNode" class="text-sm text-muted">Selecione um widget para ver âncoras.</div>
    <div v-else>
      <UTable
        :rows="anchors"
        :columns="[
          { accessorKey: 'edge', header: 'Âncora' },
          { accessorKey: 'value', header: 'Valor' },
          { accessorKey: 'note', header: 'Obs.' }
        ]"
        :empty-state="{ icon: 'i-lucide-anchor', label: 'Sem âncoras' }"
      />
    </div>
  </div>
</template>

