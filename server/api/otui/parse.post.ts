import { parseOTUICode, type ParseResult } from '../../utils/otui/parse'

type Body = { code?: string }

export default defineEventHandler(async (event) => {
  const body = (await readBody<Body>(event)) || {}
  const code = (body.code ?? '').toString()

  if (!code || code.trim().length === 0) {
    setResponseStatus(event, 400)
    return { error: 'Missing OTUI code' }
  }

  try {
    const result: ParseResult = parseOTUICode(code)
    return result
  } catch (e: any) {
    setResponseStatus(event, 500)
    return { error: 'Failed to parse OTUI', details: e?.message || String(e) }
  }
})

