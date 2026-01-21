import type { WidgetNode } from '../../utils/otui/parse'
import { exportOTUI } from '../../utils/otui/export'

type Body = { widgets?: WidgetNode[] }

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {}
  const widgets = body.widgets
  if (!widgets || !Array.isArray(widgets)) {
    setResponseStatus(event, 400)
    return { error: 'Missing widgets array' }
  }
  try {
    const code = exportOTUI(widgets)
    return { code }
  } catch (e: any) {
    setResponseStatus(event, 500)
    return { error: 'Failed to export OTUI', details: e?.message || String(e) }
  }
})

