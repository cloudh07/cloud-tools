const CACHE_TTL_MS = 10 * 60 * 1000
const LIST_TIMEOUT_MS = 3000

const FALLBACK_FAMILIES: readonly string[] = [
  'Arial',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
]

type FontCacheEntry = {
  at: number
  data: string[]
}

let cache: FontCacheEntry | null = null
let inflight: Promise<string[]> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`font-list timeout after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

function normalizeFamilies(raw: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim().replace(/^"|"$/g, '')
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) seen.set(key, trimmed)
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
}

async function fetchFromOs(): Promise<string[]> {
  const mod = await import('font-list')
  const raw = await mod.getFonts({ disableQuoting: true })
  const normalized = normalizeFamilies(raw)
  return normalized.length > 0 ? normalized : normalizeFamilies(FALLBACK_FAMILIES)
}

export async function listInstalledFontFamilies(refresh = false): Promise<string[]> {
  const now = Date.now()
  if (!refresh && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  if (!refresh && inflight) return inflight

  const task = withTimeout(fetchFromOs(), LIST_TIMEOUT_MS)
    .then((data) => {
      cache = { at: Date.now(), data }
      return data
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[system-fonts-service] fallback list used:', msg)
      const fallback = normalizeFamilies(FALLBACK_FAMILIES)
      cache = { at: Date.now(), data: fallback }
      return fallback
    })
    .finally(() => {
      inflight = null
    })

  inflight = task
  return task
}

export function clearSystemFontsCache(): void {
  cache = null
  inflight = null
}
