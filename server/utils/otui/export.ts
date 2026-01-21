import type { WidgetNode } from './parse'

function indent(level: number) {
  return '  '.repeat(Math.max(0, level))
}

function writeWidget(node: WidgetNode, out: string[], baseIndent: number) {
  const type = node.originalTypeName || node.type
  out.push(`${indent(baseIndent)}${type}`)

  // Determine which properties to print and preserve order via propertyList when possible
  const printed = new Set<string>()
  for (const entry of node.propertyList || []) {
    const i = baseIndent + 1 + (entry.indent || 0)
    out.push(`${indent(i)}${entry.key}: ${entry.value}`)
    const k = entry.key.startsWith('!') ? entry.key.substring(1) : entry.key
    printed.add(k)
  }
  // Print any missing properties (best effort)
  for (const [k, v] of Object.entries(node.properties ?? {})) {
    if (printed.has(k)) continue
    // skip synthetic width/height printed via size in propertyList if present
    if ((k === 'width' || k === 'height') && node.sizeDefined) continue
    if (v !== undefined && v !== null) {
      out.push(`${indent(baseIndent + 1)}${k}: ${v}`)
    }
  }

  // Children
  for (const child of node.children ?? []) {
    writeWidget(child, out, baseIndent + 1)
  }
}

export function exportOTUI(widgets: WidgetNode[]): string {
  const out: string[] = []
  for (const w of widgets) {
    writeWidget(w, out, 0)
    out.push('') // blank line between root widgets
  }
  // remove trailing blank
  while (out.length > 0) {
    const last = out[out.length - 1]
    if (typeof last === 'string' && last.trim() === '') out.pop()
    else break
  }
  return out.join('\n')
}

