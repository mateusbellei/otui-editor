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

