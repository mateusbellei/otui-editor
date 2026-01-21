<script setup lang="ts">
import { useEditorStore, type WidgetNode } from '~~/stores/editor'
import { storeToRefs } from 'pinia'

type Rect = { x: number; y: number; w: number; h: number }
type LayoutItem = { path: number[]; rect: Rect; node: WidgetNode }
type GuideLine = { x1: number; y1: number; x2: number; y2: number }

const editor = useEditorStore()
const { result, selectedPath } = storeToRefs(editor)

const gridSize = 10

function numeric(v?: string) {
  const n = parseInt(v || '', 10)
  return Number.isFinite(n) ? n : undefined
}

function defaultSize(node: WidgetNode): { w: number; h: number } {
  const w = numeric(node.properties?.width) ?? 160
  const h = numeric(node.properties?.height) ?? 60
  return { w, h }
}

function layoutTree(nodes: WidgetNode[], startY = 0): Array<{ path: number[]; rect: Rect; node: WidgetNode }> {
  const out: Array<{ path: number[]; rect: Rect; node: WidgetNode }> = []
  let y = startY
  nodes.forEach((n, idx) => {
    const { w, h } = defaultSize(n)
    const x = 20 + (idx % 3) * (w + 40)
    const rect = { x, y, w, h }
    const path = [idx]
    out.push({ path, rect, node: n })
    // children stacked inside parent
    let innerY = rect.y + h + 20
    n.children?.forEach((c, ci) => {
      const { w: cw, h: ch } = defaultSize(c)
      const cx = rect.x + 30
      const crect = { x: cx, y: innerY, w: cw, h: ch }
      out.push({ path: [idx, ci], rect: crect, node: c })
      innerY += ch + 12
    })
    y += Math.max(h + 100, (n.children?.length || 0) * 80 + h + 60)
  })
  return out
}

const layout = computed<LayoutItem[]>(() => {
  if (!result.value?.widgets?.length) return []
  return layoutTree(result.value.widgets)
})

function samePath(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i: number) => v === b[i])
}

function select(path: number[]) {
  editor.selectPath(path)
}

let resizing = false
let startPos = { x: 0, y: 0 }
let startSize = { w: 0, h: 0 }
let resizePath: number[] = []

function onResizeDown(e: PointerEvent, path: number[], node: WidgetNode) {
  e.preventDefault()
  e.stopPropagation()
  resizing = true
  resizePath = path
  startPos = { x: e.clientX, y: e.clientY }
  const { w, h } = defaultSize(node)
  startSize = { w, h }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onResizeMove(e: PointerEvent) {
  if (!resizing) return
  const dx = e.clientX - startPos.x
  const dy = e.clientY - startPos.y
  let w = Math.max(20, startSize.w + dx)
  let h = Math.max(20, startSize.h + dy)
  // snap
  w = Math.round(w / gridSize) * gridSize
  h = Math.round(h / gridSize) * gridSize
  // update width/height properties
  editor.selectPath(resizePath)
  editor.updateProperty('width', String(w))
  editor.updateProperty('height', String(h))
}

function onResizeUp() {
  resizing = false
  resizePath = []
}

// Anchor overlay for selected node
const overlay = computed(() => {
  const sel = selectedPath.value
  if (!sel.length) return null
  const targetItem = layout.value.find((i: LayoutItem) => samePath(i.path, sel))
  if (!targetItem) return null
  const n = targetItem.node
  const anchors = Object.entries(n.properties || {}).filter(([k]) => k.startsWith('anchors.'))

  function findRectById(id: string): Rect | null {
    // search siblings and parent within layout
    if (id === 'parent') {
      // approximate parent as closest ancestor in layout
      const parentPath = sel.slice(0, -1)
      const p = layout.value.find((i: LayoutItem) => samePath(i.path, parentPath))
      return p?.rect || null
    }
    if (id === 'prev' || id === 'next') {
      const parentPath = sel.slice(0, -1)
      const idxRaw = sel[sel.length - 1]
      const idx = typeof idxRaw === 'number' ? idxRaw : 0
      const sibIndex = id === 'prev' ? idx - 1 : idx + 1
      const sibPath = [...parentPath, sibIndex]
      const s = layout.value.find((i: LayoutItem) => samePath(i.path, sibPath))
      return s?.rect || null
    }
    // by id
    const item = layout.value.find((i: LayoutItem) => i.node.properties?.id === id)
    return item?.rect || null
  }

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const center = (r: Rect) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2 })

  const sr = targetItem.rect
  for (const [k, v] of anchors) {
    const val = String(v)
    if (k === 'anchors.centerIn' || k === 'anchors.fill') {
      const tr = findRectById(val)
      if (!tr) continue
      const s = center(sr)
      const t = center(tr)
      lines.push({ x1: s.cx, y1: s.cy, x2: t.cx, y2: t.cy })
      continue
    }
    const [tid, edge] = val.split('.')
    if (!tid || !edge) continue
    const tr = findRectById(tid)
    if (!tr) continue
    let sx = sr.x
    let sy = sr.y
    if (k.endsWith('left')) {
      sx = sr.x
      sy = sr.y + sr.h / 2
    } else if (k.endsWith('right')) {
      sx = sr.x + sr.w
      sy = sr.y + sr.h / 2
    } else if (k.endsWith('top')) {
      sx = sr.x + sr.w / 2
      sy = sr.y
    } else if (k.endsWith('bottom')) {
      sx = sr.x + sr.w / 2
      sy = sr.y + sr.h
    } else if (k.endsWith('horizontalCenter')) {
      sx = sr.x + sr.w / 2
      sy = sr.y + sr.h / 2
    } else if (k.endsWith('verticalCenter')) {
      sx = sr.x + sr.w / 2
      sy = sr.y + sr.h / 2
    }
    let tx = tr.x
    let ty = tr.y
    if (edge === 'left') {
      tx = tr.x
      ty = tr.y + tr.h / 2
    } else if (edge === 'right') {
      tx = tr.x + tr.w
      ty = tr.y + tr.h / 2
    } else if (edge === 'top') {
      tx = tr.x + tr.w / 2
      ty = tr.y
    } else if (edge === 'bottom') {
      tx = tr.x + tr.w / 2
      ty = tr.y + tr.h
    } else if (edge === 'horizontalCenter' || edge === 'verticalCenter') {
      const c = center(tr)
      tx = c.cx
      ty = c.cy
    }
    lines.push({ x1: sx, y1: sy, x2: tx, y2: ty })
  }
  return { lines }
})

// Drag to move with anchor suggestion
let dragging = false
let dragPath: number[] = []
let dragStart = { x: 0, y: 0 }
let dragDelta = { dx: 0, dy: 0 }
let dragStartRect: Rect | null = null
const guides = ref<{ v: GuideLine[]; h: GuideLine[] }>({ v: [], h: [] })
const SNAP_THRESHOLD = 6

function onDragDown(e: PointerEvent, path: number[], itemRect: Rect) {
  const target = e.target as HTMLElement
  // ignore when grabbing resize handle
  if (target && target.classList.contains('resizer')) return
  e.preventDefault()
  dragging = true
  dragPath = path
  dragStart = { x: e.clientX, y: e.clientY }
  dragDelta = { dx: 0, dy: 0 }
  dragStartRect = { ...itemRect }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onDragMove(e: PointerEvent) {
  if (!dragging) return
  // raw delta
  const rawDx = e.clientX - dragStart.x
  const rawDy = e.clientY - dragStart.y
  let snapDx = 0
  let snapDy = 0
  guides.value = { v: [], h: [] }

  // compute snap vs parent/siblings
  if (dragStartRect) {
    const sel = dragPath
    const parentPath = sel.slice(0, -1)
    const parentItem = layout.value.find((i: LayoutItem) => samePath(i.path, parentPath))
    if (parentItem) {
      // proposed new rect
      const newRect: Rect = {
        x: dragStartRect.x + rawDx,
        y: dragStartRect.y + rawDy,
        w: dragStartRect.w,
        h: dragStartRect.h
      }
      // candidate snap lines (vertical and horizontal)
      const siblings = layout.value.filter((i: LayoutItem) => samePath(i.path.slice(0, -1), parentPath))
      const vCandidates: number[] = []
      const hCandidates: number[] = []
      // parent edges/centers
      vCandidates.push(parentItem.rect.x, parentItem.rect.x + parentItem.rect.w / 2, parentItem.rect.x + parentItem.rect.w)
      hCandidates.push(parentItem.rect.y, parentItem.rect.y + parentItem.rect.h / 2, parentItem.rect.y + parentItem.rect.h)
      // siblings edges/centers
      siblings.forEach((s: LayoutItem) => {
        const r = s.rect
        vCandidates.push(r.x, r.x + r.w / 2, r.x + r.w)
        hCandidates.push(r.y, r.y + r.h / 2, r.y + r.h)
      })
      // current edges/centers
      const left = newRect.x
      const centerX = newRect.x + newRect.w / 2
      const right = newRect.x + newRect.w
      const top = newRect.y
      const centerY = newRect.y + newRect.h / 2
      const bottom = newRect.y + newRect.h

      // vertical snap: choose minimal distance among left, centerX, right
      let bestVDist = SNAP_THRESHOLD + 1
      let bestVX = 0
      let bestVEdge: 'left' | 'center' | 'right' | null = null
      vCandidates.forEach((cx: number) => {
        const dLeft = Math.abs(left - cx)
        if (dLeft < bestVDist) { bestVDist = dLeft; bestVX = cx; bestVEdge = 'left' }
        const dCenter = Math.abs(centerX - cx)
        if (dCenter < bestVDist) { bestVDist = dCenter; bestVX = cx; bestVEdge = 'center' }
        const dRight = Math.abs(right - cx)
        if (dRight < bestVDist) { bestVDist = dRight; bestVX = cx; bestVEdge = 'right' }
      })
      if (bestVDist <= SNAP_THRESHOLD && bestVEdge) {
        if (bestVEdge === 'left') snapDx = bestVX - left
        else if (bestVEdge === 'center') snapDx = bestVX - centerX
        else snapDx = bestVX - right
        // vertical guide line (full height of canvas)
        guides.value.v.push({ x1: bestVX, y1: 0, x2: bestVX, y2: 9999 })
      }

      // horizontal snap: choose minimal distance among top, centerY, bottom
      let bestHDist = SNAP_THRESHOLD + 1
      let bestHY = 0
      let bestHEdge: 'top' | 'center' | 'bottom' | null = null
      hCandidates.forEach((cy: number) => {
        const dTop = Math.abs(top - cy)
        if (dTop < bestHDist) { bestHDist = dTop; bestHY = cy; bestHEdge = 'top' }
        const dCenter = Math.abs(centerY - cy)
        if (dCenter < bestHDist) { bestHDist = dCenter; bestHY = cy; bestHEdge = 'center' }
        const dBottom = Math.abs(bottom - cy)
        if (dBottom < bestHDist) { bestHDist = dBottom; bestHY = cy; bestHEdge = 'bottom' }
      })
      if (bestHDist <= SNAP_THRESHOLD && bestHEdge) {
        if (bestHEdge === 'top') snapDy = bestHY - top
        else if (bestHEdge === 'center') snapDy = bestHY - centerY
        else snapDy = bestHY - bottom
        // horizontal guide line (full width of canvas)
        guides.value.h.push({ x1: 0, y1: bestHY, x2: 9999, y2: bestHY })
      }
    }
  }
  dragDelta.dx = rawDx + snapDx
  dragDelta.dy = rawDy + snapDy
}

function onDragUp() {
  if (!dragging) return
  // Suggest anchors based on new position
  const sel = dragPath
  const item = layout.value.find((i: LayoutItem) => samePath(i.path, sel))
  const parentPath = sel.slice(0, -1)
  const parentItem = layout.value.find((i: LayoutItem) => samePath(i.path, parentPath))
  if (item && dragStartRect) {
    const newRect: Rect = {
      x: dragStartRect.x + dragDelta.dx,
      y: dragStartRect.y + dragDelta.dy,
      w: dragStartRect.w,
      h: dragStartRect.h
    }
    // snap for margins
    newRect.x = Math.round(newRect.x / gridSize) * gridSize
    newRect.y = Math.round(newRect.y / gridSize) * gridSize
    // Horizontal: anchor to parent.left with margin-left
    const marginLeft = parentItem ? Math.max(0, Math.round(newRect.x - parentItem.rect.x)) : Math.max(0, Math.round(newRect.x))
    editor.selectPath(sel)
    editor.setAnchor('anchors.left', 'parent.left')
    editor.updateProperty('margin-left', String(marginLeft))
    // Vertical: if has previous sibling and is closer to its bottom, anchor to prev.bottom; else parent.top
    const idxRaw = sel[sel.length - 1]
    const idx = typeof idxRaw === 'number' ? idxRaw : 0
    const prevPath = [...parentPath, idx - 1]
    const prevItem = layout.value.find((i: LayoutItem) => samePath(i.path, prevPath))
    if (prevItem) {
      const distPrev = Math.abs(newRect.y - (prevItem.rect.y + prevItem.rect.h))
      const distTop = parentItem ? Math.abs(newRect.y - parentItem.rect.y) : Math.abs(newRect.y)
      if (distPrev <= distTop + 20) {
        editor.setAnchor('anchors.top', 'prev.bottom')
        const marginTop = Math.max(0, Math.round(newRect.y - (prevItem.rect.y + prevItem.rect.h)))
        editor.updateProperty('margin-top', String(marginTop))
      } else {
        editor.setAnchor('anchors.top', 'parent.top')
        const marginTop = parentItem ? Math.max(0, Math.round(newRect.y - parentItem.rect.y)) : Math.max(0, Math.round(newRect.y))
        editor.updateProperty('margin-top', String(marginTop))
      }
    } else {
      editor.setAnchor('anchors.top', 'parent.top')
      const marginTop = parentItem ? Math.max(0, Math.round(newRect.y - parentItem.rect.y)) : Math.max(0, Math.round(newRect.y))
      editor.updateProperty('margin-top', String(marginTop))
    }
  }
  dragging = false
  dragPath = []
  dragDelta = { dx: 0, dy: 0 }
  dragStartRect = null
  guides.value = { v: [], h: [] }
}
</script>

<template>
  <div class="relative w-full h-[700px] border rounded bg-[linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(0,0,0,0.05)_1px,transparent_1px)]" :style="{ backgroundSize: `${gridSize * 1}px ${gridSize * 1}px` }" @pointermove="(e)=>{ onResizeMove(e); onDragMove(e) }" @pointerup="()=>{ onResizeUp(); onDragUp() }" @pointercancel="()=>{ onResizeUp(); onDragUp() }" @pointerleave="()=>{ onResizeUp(); onDragUp() }">
    <div v-for="item in layout" :key="item.path.join('-')" class="absolute rounded border border-primary/30 bg-primary/5 hover:bg-primary/10" :style="{ left: `${item.rect.x}px`, top: `${item.rect.y}px`, width: `${item.rect.w}px`, height: `${item.rect.h}px`, transform: samePath(item.path, dragPath) ? `translate(${dragDelta.dx}px, ${dragDelta.dy}px)` : 'none' }" @pointerdown="(e)=> onDragDown(e, item.path, item.rect)" @click.stop="select(item.path)" :class="{ 'ring-2 ring-primary/70': samePath(item.path, selectedPath) }">
      <div class="text-[11px] px-1 py-0.5 text-muted border-b border-primary/20 truncate">
        {{ item.node.originalTypeName || item.node.type }} <span v-if="item.node.properties?.id">#{{ item.node.properties.id }}</span>
      </div>
      <div class="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 w-3 h-3 bg-primary rounded-sm cursor-nwse-resize resizer" @pointerdown="onResizeDown($event, item.path, item.node)" />
    </div>
    <svg v-if="overlay" class="absolute inset-0 pointer-events-none" :width="'100%'" :height="'100%'" xmlns="http://www.w3.org/2000/svg">
      <line v-for="(l, i) in overlay.lines" :key="i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" stroke="rgb(16,185,129)" stroke-width="1.5" stroke-dasharray="4 3" />
    </svg>
    <svg v-if="guides.v.length || guides.h.length" class="absolute inset-0 pointer-events-none" :width="'100%'" :height="'100%'" xmlns="http://www.w3.org/2000/svg">
      <line v-for="(l, i) in guides.v" :key="'v'+i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" stroke="rgb(59,130,246)" stroke-width="1" stroke-dasharray="3 3" />
      <line v-for="(l, i) in guides.h" :key="'h'+i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" stroke="rgb(59,130,246)" stroke-width="1" stroke-dasharray="3 3" />
    </svg>
  </div>
</template>

