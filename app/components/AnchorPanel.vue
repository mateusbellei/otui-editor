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

const edgeOptions = [
  { label: 'left', value: 'left' },
  { label: 'right', value: 'right' },
  { label: 'top', value: 'top' },
  { label: 'bottom', value: 'bottom' },
  { label: 'horizontalCenter', value: 'horizontalCenter' },
  { label: 'verticalCenter', value: 'verticalCenter' }
]
const specialOptions = [
  { label: 'centerIn', value: 'centerIn' },
  { label: 'fill', value: 'fill' }
]

const targetOptions = computed(() => {
  // Build options from context: parent/prev/next + sibling ids
  const opts = [{ label: 'parent', value: 'parent' }, { label: 'prev', value: 'prev' }, { label: 'next', value: 'next' }]
  // Collect sibling ids
  const path = editor.selectedPath
  const res = editor.result
  if (!res) return opts
  // parent node
  if (path.length > 0) {
    const parentPath = path.slice(0, -1)
    const { node: parentNode } = editor.getNodeByPath(parentPath)
    if (parentNode) {
      for (const child of parentNode.children) {
        const id = child.properties?.id
        if (id) opts.push({ label: id, value: id })
      }
    }
  }
  return opts
})

function parseAnchorValue(val: string) {
  if (val === 'none') return { target: 'none', edge: '' }
  const [t, e] = val.split('.')
  return { target: t, edge: e }
}
function buildAnchorValue(target: string, edge: string) {
  if (edge === 'centerIn' || edge === 'fill') return target
  return `${target}.${edge}`
}
function onChangeRegular(row: AnchorRow, target: string, edge: string) {
  const key = row.edge.startsWith('anchors.') ? row.edge : `anchors.${row.edge}`
  const value = buildAnchorValue(target, edge)
  editor.setAnchor(key, value)
}
function onChangeSpecial(kind: 'centerIn' | 'fill', target: string) {
  editor.setAnchor(`anchors.${kind}`, target)
}
function removeAnchor(row: AnchorRow) {
  const key = row.edge.startsWith('anchors.') ? row.edge : `anchors.${row.edge}`
  editor.removeAnchor(key)
}
function addAnchor(kind: string) {
  const key = kind === 'centerIn' || kind === 'fill' ? `anchors.${kind}` : `anchors.${kind}`
  const defaultTarget = 'parent'
  const defaultEdge = kind === 'centerIn' || kind === 'fill' ? '' : 'left'
  const value = kind === 'centerIn' || kind === 'fill' ? defaultTarget : buildAnchorValue(defaultTarget, defaultEdge)
  editor.setAnchor(key, value)
}
</script>

<template>
  <div>
    <div v-if="!selectedNode" class="text-sm text-muted">Selecione um widget para ver/editar âncoras.</div>
    <div v-else class="space-y-3">
      <div class="flex items-center gap-2">
        <USelect :options="edgeOptions" placeholder="Adicionar âncora..." @update:model-value="(v:any)=> { if (v) addAnchor(String(v)) }" />
        <USelect :options="specialOptions" placeholder="Adicionar especial..." @update:model-value="(v:any)=> { if (v) addAnchor(String(v)) }" />
      </div>
      <div class="space-y-2">
        <div v-for="row in anchors" :key="row.edge" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <div class="text-xs text-muted break-all">{{ row.edge }}</div>
          <template v-if="row.edge.endsWith('centerIn') || row.edge.endsWith('fill')">
            <USelect :model-value="row.value" :options="targetOptions" option-attribute="label" value-attribute="value" @update:model-value="(t:any)=> onChangeSpecial(row.edge.endsWith('centerIn') ? 'centerIn' : 'fill', String(t || 'parent'))" />
            <div class="text-xs text-muted">—</div>
          </template>
          <template v-else>
            <USelect :model-value="parseAnchorValue(row.value).target" :options="targetOptions" option-attribute="label" value-attribute="value" @update:model-value="(t:any)=> onChangeRegular(row, String(t || 'parent'), parseAnchorValue(row.value).edge || 'left')" />
            <USelect :model-value="parseAnchorValue(row.value).edge" :options="edgeOptions" option-attribute="label" value-attribute="value" @update:model-value="(e:any)=> onChangeRegular(row, parseAnchorValue(row.value).target || 'parent', String(e || 'left'))" />
          </template>
          <div class="flex items-center gap-2">
            <UBadge v-if="!row.ok" color="warning" variant="subtle">inválido</UBadge>
            <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash" @click="removeAnchor(row)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

