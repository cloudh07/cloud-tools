import { net, protocol } from 'electron'
import { normalize } from 'path'
import { pathToFileURL } from 'url'

import { validateLocalMediaPlaybackPath } from '@main/infrastructure/fs/path-validator'

const LOCAL_MEDIA_HOST = '127.0.0.1'
const PATH_PREFIX = '/p/'
const HEADERS_TO_FORWARD = ['range', 'if-range', 'accept'] as const

const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0'

function decodeHexPath(hex: string): string {
  const clean = hex.replace(/\/$/, '').trim()
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('Invalid hex path')
  }
  return Buffer.from(clean, 'hex').toString('utf8')
}

function decodePathFromLocalMediaUrl(requestUrl: string): string {
  const u = new URL(requestUrl)

  if (u.hostname === LOCAL_MEDIA_HOST && u.pathname.startsWith(PATH_PREFIX)) {
    let hex = u.pathname.slice(PATH_PREFIX.length)
    try {
      hex = decodeURIComponent(hex)
    } catch {
      console.warn('Invalid hex path', hex)
    }
    return decodeHexPath(hex)
  }

  const fromQuery = u.searchParams.get('id')
  if (fromQuery) {
    return Buffer.from(fromQuery, 'base64url').toString('utf8')
  }

  const legacy = u.pathname.replace(/^\/+/, '')
  if (legacy && !legacy.includes('/')) {
    return Buffer.from(legacy, 'base64url').toString('utf8')
  }

  throw new Error('Unrecognized local-media URL')
}

function buildFileFetchInit(incoming: Request): RequestInit {
  const headers = new Headers()
  for (const name of HEADERS_TO_FORWARD) {
    const v = incoming.headers.get(name)
    if (v) headers.set(name, v)
  }
  return {
    method: incoming.method,
    headers,
    signal: incoming.signal
  }
}

export function registerLocalMediaProtocolHandler(): void {
  protocol.handle('local-media', async (request) => {
    try {
      const decodedRaw = decodePathFromLocalMediaUrl(request.url)
      const decoded = normalize(decodedRaw.trim())
      const abs = validateLocalMediaPlaybackPath(decoded)
      const fileHref = pathToFileURL(abs).href
      const upstream = await net.fetch(fileHref, buildFileFetchInit(request))
      const headers = new Headers(upstream.headers)
      headers.set('Cache-Control', NO_STORE)
      headers.set('Pragma', 'no-cache')
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}
