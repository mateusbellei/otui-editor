// @ts-nocheck
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

export type TemplateCapture = {
  name: string
  baseType: string
  lines: string[]
}

export type ParseResult = {
  widgets: WidgetNode[]
  templates: TemplateCapture[]
  templateMap: Record<string, WidgetNode>
  diagnostics: Array<{ line: number; message: string; level: 'error' | 'warning' }>
}

function translateAnchorEdge(anchorEdge: string): string | null {
  const normalized = anchorEdge.toLowerCase().replace(/\s+/g, '')
  if (normalized === 'left') return 'left'
  if (normalized === 'right') return 'right'
  if (normalized === 'top') return 'top'
  if (normalized === 'bottom') return 'bottom'
  if (normalized === 'horizontalcenter' || normalized === 'horizontal-center') return 'horizontalCenter'
  if (normalized === 'verticalcenter' || normalized === 'vertical-center') return 'verticalCenter'
  return null
}

function getWidgetTypeFromOTUI(otuiName: string, widgetDefinitions: Record<string, unknown> = {}): string {
  const explicitMappings: Record<string, string> = {
    VerticalScrollBar: 'UIScrollBar',
    HorizontalScrollBar: 'UIScrollBar',
    ScrollBar: 'UIScrollBar',
    MainWindow: 'UIWindow',
    GameLabel: 'UILabel',
    FlatPanel: 'UIPanel',
    ButtonBox: 'UIButtonBox',
    TextList: 'UITextList',
    ComboBox: 'UIComboBox',
    HorizontalSeparator: 'UIHorizontalSeparator',
    VerticalSeparator: 'UIVerticalSeparator',
    ScrollablePanel: 'UIScrollArea'
  }
  if (explicitMappings[otuiName]) {
    const mappedType = explicitMappings[otuiName]
    if (widgetDefinitions[mappedType]) return mappedType
    return mappedType
  }
  if (widgetDefinitions[otuiName]) return otuiName
  const uiName = otuiName.startsWith('UI') ? otuiName : `UI${otuiName}`
  if (widgetDefinitions[uiName]) return uiName
  return uiName
}

export function parseOTUICode(code: string, widgetDefinitions: Record<string, unknown> = {}): ParseResult {
  const lines = code.replace(/\r\n/g, '\n').split('\n')
  const widgets: WidgetNode[] = []
  const templates: Record<string, WidgetNode> = {}
  const templateDefinitions: TemplateCapture[] = []
  const templateCaptureStack: TemplateCapture[] = []
  const stack: WidgetNode[] = []
  const diagnostics: Array<{ line: number; message: string; level: 'error' | 'warning' }> = []

  let inTemplateDefinition = false
  let templateIndent = -1

  function recordOriginalProperty(targetWidget: WidgetNode | null, key: string, value: string, rawLine: string, relativeIndent = 0) {
    if (!targetWidget || !key) return
    targetWidget.propertyList.push({
      key,
      value,
      raw: rawLine,
      indent: Math.max(0, relativeIndent)
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const originalLine = lines[i]
    const trimmedLine = originalLine.trim()
    let captureHandled = false
    const captureCurrentLine = () => {
      if (!captureHandled && templateCaptureStack.length > 0) {
        const current = templateCaptureStack[templateCaptureStack.length - 1]
        current?.lines.push(originalLine)
        captureHandled = true
      }
    }

    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
      captureCurrentLine()
      continue
    }

    const indentMatch = originalLine.match(/^(\s*)/)
    const indent = indentMatch ? indentMatch[1].length : 0
    const indentLevel = Math.floor(indent / 2)

    // unwind stack for current indent
    while (stack.length > 0 && stack[stack.length - 1].indentLevel >= indentLevel) {
      const popped = stack.pop()
      if (popped && popped.originalTypeName && popped.parentType) {
        // end of template child capture
      }
      if (popped && popped === (templates as any)._currentTemplateNode) {
        inTemplateDefinition = false
        templateIndent = -1
        templateCaptureStack.pop()
      }
    }

    // widget or template header: "Type" or "Type < Parent"
    const widgetMatch = trimmedLine.match(/^([A-Z][a-zA-Z0-9_]*)(?:\s*<\s*([A-Za-z][A-Za-z0-9_]*))?$/)
    if (widgetMatch) {
      const widgetTypeName = widgetMatch[1]
      const parentTypeName = widgetMatch[2]

      if (parentTypeName) {
        // template definition
        while (templateCaptureStack.length > 0) templateCaptureStack.pop()
        inTemplateDefinition = true
        templateIndent = indent

        const baseType = getWidgetTypeFromOTUI(parentTypeName, widgetDefinitions)
        const uiType = widgetTypeName

        const templateCaptureEntry: TemplateCapture = { name: widgetTypeName, baseType: parentTypeName, lines: [] }
        templateDefinitions.push(templateCaptureEntry)
        templateCaptureStack.push(templateCaptureEntry)

        const templateNode: WidgetNode = {
          type: uiType,
          originalTypeName: widgetTypeName,
          parentType: parentTypeName,
          indentLevel,
          properties: {},
          children: [],
          sizeDefined: false,
          propertyList: [],
          originalKeys: {}
        }
        ;(templates as any)._currentTemplateNode = templateNode
        templates[uiType] = templateNode
        stack.push(templateNode)
        captureCurrentLine()
        continue
      } else {
        // widget instance (root or child or template child)
        if (inTemplateDefinition && indent === 0) {
          inTemplateDefinition = false
          templateIndent = -1
          while (templateCaptureStack.length > 0) templateCaptureStack.pop()
        }

        captureCurrentLine()
        const resolved = getWidgetTypeFromOTUI(widgetTypeName, widgetDefinitions)
        const node: WidgetNode = {
          type: resolved,
          originalTypeName: widgetTypeName,
          parentType: null,
          indentLevel,
          properties: {},
          children: [],
          sizeDefined: false,
          propertyList: [],
          originalKeys: {}
        }
        if (indentLevel === 0) {
          widgets.push(node)
        } else if (stack.length > 0) {
          stack[stack.length - 1].children.push(node)
        } else {
          widgets.push(node)
        }
        stack.push(node)
        continue
      }
    }

    captureCurrentLine()

    if (stack.length === 0) {
      diagnostics.push({ line: lineNo, level: 'warning', message: 'Property without a parent widget ignored' })
      continue
    }
    const currentWidget = stack[stack.length - 1]

    // key: value
    const propMatchColon = trimmedLine.match(/^([!$@a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (propMatchColon) {
      const key = propMatchColon[1]
      let value = propMatchColon[2].trim()
      const relativeIndent = Math.max(0, indentLevel - currentWidget.indentLevel - 1)
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key === 'size') {
        const parts = value.split(/\s+/)
        if (parts.length >= 2) {
          currentWidget.properties['width'] = parts[0]
          currentWidget.properties['height'] = parts[1]
          currentWidget.sizeDefined = true
        } else {
          diagnostics.push({ line: lineNo, level: 'warning', message: 'Invalid size format' })
        }
        recordOriginalProperty(currentWidget, 'size', propMatchColon[2].trim(), trimmedLine, relativeIndent)
      } else if (key === 'text-offset') {
        const parts = value.split(/\s+/)
        if (parts.length >= 2) {
          currentWidget.properties['text-offset-x'] = parts[0]
          currentWidget.properties['text-offset-y'] = parts[1]
        }
        recordOriginalProperty(currentWidget, 'text-offset', propMatchColon[2].trim(), trimmedLine, relativeIndent)
      } else if (key.startsWith('anchors.')) {
        if (currentWidget.properties[key] === undefined) {
          currentWidget.properties[key] = value
          // basic validation for anchor format x.y
          if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z-]+$/.test(value)) {
            diagnostics.push({ line: lineNo, level: 'warning', message: `Possibly invalid anchor value "${value}"` })
          } else {
            const [, edge] = value.split('.')
            if (!translateAnchorEdge(edge)) {
              diagnostics.push({ line: lineNo, level: 'warning', message: `Unknown anchor edge "${edge}"` })
            }
          }
          recordOriginalProperty(currentWidget, key, propMatchColon[2].trim(), trimmedLine, relativeIndent)
        }
      } else if (key.startsWith('!')) {
        const actualKey = key.substring(1)
        if (currentWidget.properties[actualKey] === undefined) {
          currentWidget.properties[actualKey] = value
          currentWidget.originalKeys[actualKey] = key
          recordOriginalProperty(currentWidget, key, propMatchColon[2].trim(), trimmedLine, relativeIndent)
        }
      } else if (key.startsWith('@') || key.startsWith('$')) {
        if (currentWidget.properties[key] === undefined) {
          currentWidget.properties[key] = value
          recordOriginalProperty(currentWidget, key, propMatchColon[2].trim(), trimmedLine, relativeIndent)
        }
      } else {
        if (currentWidget.properties[key] === undefined) {
          currentWidget.properties[key] = value
          recordOriginalProperty(currentWidget, key, propMatchColon[2].trim(), trimmedLine, relativeIndent)
        }
      }
      continue
    }

    // key value
    const propMatchSpace = trimmedLine.match(/^([@a-zA-Z0-9_.-]+)\s+(.+)$/)
    if (propMatchSpace) {
      const key = propMatchSpace[1]
      const value = propMatchSpace[2].trim()
      const relativeIndent = Math.max(0, indentLevel - currentWidget.indentLevel - 1)
      if (key === 'size') {
        const parts = value.split(/\s+/)
        if (parts.length >= 2) {
          currentWidget.properties['width'] = parts[0]
          currentWidget.properties['height'] = parts[1]
          currentWidget.sizeDefined = true
        } else {
          diagnostics.push({ line: lineNo, level: 'warning', message: 'Invalid size format' })
        }
        recordOriginalProperty(currentWidget, 'size', value, trimmedLine, relativeIndent)
      } else if (key === 'text-offset') {
        const parts = value.split(/\s+/)
        if (parts.length >= 2) {
          currentWidget.properties['text-offset-x'] = parts[0]
          currentWidget.properties['text-offset-y'] = parts[1]
        }
        recordOriginalProperty(currentWidget, 'text-offset', value, trimmedLine, relativeIndent)
      } else {
        if (currentWidget.properties[key] === undefined) {
          currentWidget.properties[key] = value
          recordOriginalProperty(currentWidget, key, value, trimmedLine, relativeIndent)
        }
      }
      continue
    }

    // boolean flags: "on" or "focusable" etc on their own line (if indented)
    const boolPropMatch = trimmedLine.match(/^([a-z-]+)$/)
    if (boolPropMatch && indent > 0) {
      const key = boolPropMatch[1]
      const relativeIndent = Math.max(0, indentLevel - currentWidget.indentLevel - 1)
      if (currentWidget.properties[key] === undefined) {
        currentWidget.properties[key] = 'true'
        recordOriginalProperty(currentWidget, key, 'true', trimmedLine, relativeIndent)
      }
      continue
    }

    diagnostics.push({ line: lineNo, level: 'warning', message: 'Unrecognized line' })
  }

  // remove parent refs (none created) and return
  return {
    widgets,
    templates: templateDefinitions,
    templateMap: templates,
    diagnostics
  }
}

