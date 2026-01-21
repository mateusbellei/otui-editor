import { defineStore } from 'pinia'

export type Diagnostic = { line: number; message: string; level: 'error' | 'warning' }

export type WidgetNode = {
  type: string
  originalTypeName: string
  parentType: string | null
  indentLevel: number
  properties: Record<string, string>
  children: WidgetNode[]
  sizeDefined: boolean
  propertyList: Array<{ key: string; value: string; raw: string; indent: number }>
  originalKeys: Record<string, string>
}

export type ParseResult = {
  widgets: WidgetNode[]
  templates: Array<{ name: string; baseType: string; lines: string[] }>
  templateMap: Record<string, WidgetNode>
  diagnostics: Diagnostic[]
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    code: '' as string,
    parsing: false as boolean,
    result: null as ParseResult | null,
    error: '' as string,
    selectedPath: [] as number[]
  }),
  actions: {
    // Helpers
    getNodeByPath(path: number[]): { node: WidgetNode | null; parent: WidgetNode | null; index: number } {
      const res = this.result
      if (!res) return { node: null, parent: null, index: -1 }
      if (path.length === 0) return { node: null, parent: null, index: -1 }
      let parent: WidgetNode | null = null
      let list: WidgetNode[] = res.widgets
      for (let depth = 0; depth < path.length; depth++) {
        const idxRaw = path[depth]
        const idx = typeof idxRaw === 'number' ? idxRaw : -1
        if (idx < 0 || idx >= list.length) return { node: null, parent: null, index: -1 }
        const current = list[idx]
        if (!current) return { node: null, parent: null, index: -1 }
        if (depth === path.length - 1) {
          return { node: current, parent, index: idx }
        }
        parent = current
        list = current.children
      }
      return { node: null, parent: null, index: -1 }
    },
    updateProperty(key: string, value: string) {
      const target = this.getNodeByPath(this.selectedPath)
      if (!target.node) return
      target.node.properties[key] = value
      // Update propertyList if an entry exists; otherwise append a simple one
      const pl = target.node.propertyList || (target.node.propertyList = [])
      const existing = pl.find(e => e.key === key || e.key === `!${key}`)
      if (existing) {
        existing.value = value
        existing.raw = `${existing.key}: ${value}`
      } else {
        pl.push({ key, value, raw: `${key}: ${value}`, indent: 0 })
      }
    },
    setAnchor(edgeKey: string, value: string) {
      this.updateProperty(edgeKey, value)
    },
    removeAnchor(edgeKey: string) {
      const target = this.getNodeByPath(this.selectedPath)
      if (!target.node) return
      delete target.node.properties[edgeKey]
      const pl = target.node.propertyList || []
      const idx = pl.findIndex(e => e.key === edgeKey)
      if (idx >= 0) pl.splice(idx, 1)
    },
    renameId(newId: string) {
      this.updateProperty('id', newId)
    },
    addChild(type = 'UIPanel', originalTypeName = 'Panel') {
      const target = this.getNodeByPath(this.selectedPath)
      if (!target.node) return
      const child: WidgetNode = {
        type,
        originalTypeName,
        parentType: null,
        indentLevel: (target.node.indentLevel ?? 0) + 1,
        properties: { id: '' },
        children: [],
        sizeDefined: false,
        propertyList: [],
        originalKeys: {}
      }
      target.node.children.push(child)
    },
    deleteSelected() {
      const path = this.selectedPath
      if (path.length === 0 || !this.result) return
      const parentPath = path.slice(0, -1)
      const { node: parentNode } = this.getNodeByPath(parentPath)
      if (!parentNode) return
      const indexRaw = path[path.length - 1]
      const index = typeof indexRaw === 'number' ? indexRaw : -1
      if (index < 0) return
      parentNode.children.splice(index, 1)
      this.selectedPath = []
    },
    duplicateSelected() {
      const path = this.selectedPath
      const { node, parent, index } = this.getNodeByPath(path)
      if (!node) return
      const clone = JSON.parse(JSON.stringify(node)) as WidgetNode
      if (parent && index >= 0) {
        parent.children.splice(index + 1, 0, clone)
        this.selectedPath = [...path.slice(0, -1), index + 1]
      }
    },
    moveSelected(offset: number) {
      const path = this.selectedPath
      if (path.length === 0 || !this.result) return
      const parentPath = path.slice(0, -1)
      const { node: parentNode } = this.getNodeByPath(parentPath)
      if (!parentNode) return
      const iRaw = path[path.length - 1]
      const i = typeof iRaw === 'number' ? iRaw : -1
      if (i < 0) return
      const j = i + offset
      if (j < 0 || j >= parentNode.children.length) return
      const arr = parentNode.children
      const [item] = arr.splice(i, 1)
      if (item) {
        arr.splice(j, 0, item)
      }
      this.selectedPath = [...parentPath, j]
    },
    async parse() {
      this.parsing = true
      this.error = ''
      try {
        const res = await $fetch<ParseResult>('/api/otui/parse', {
          method: 'POST',
          body: { code: this.code }
        })
        this.result = res
        this.selectedPath = []
      } catch (e: any) {
        this.error = e?.data?.error || e?.message || 'Failed to parse'
        this.result = null
      } finally {
        this.parsing = false
      }
    },
    selectPath(path: number[]) {
      this.selectedPath = [...path]
    }
  },
  getters: {
    selectedNode(state): WidgetNode | null {
      if (!state.result) return null
      let nodes = state.result.widgets
      let node: WidgetNode | undefined
      for (const idx of state.selectedPath) {
        node = nodes[idx]
        if (!node) return null
        nodes = node.children
      }
      return node || null
    }
  }
})

