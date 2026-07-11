// Shared g-code file metadata helpers: slicer metadata lookup and the best embedded
// thumbnail's URL. Used by the file browser's confirm card and the job face.

import { connector, moonrakerHttpBase } from '@/core/session'

export interface Thumb {
  width?: number
  relative_path?: string
}
export interface GcodeMetadata {
  estimated_time?: number
  filament_total?: number
  thumbnails?: Thumb[]
}

/** Slicer metadata for a file path relative to the gcodes root. */
export function fetchMetadata(filename: string): Promise<GcodeMetadata> {
  return connector.call<GcodeMetadata>('server.files.metadata', { filename })
}

/**
 * The largest embedded thumbnail's URL (thumbnail paths are relative to the file's folder).
 * Each segment is percent-encoded: thumbnail paths embed the print's filename, and a '#',
 * '?' or '%' in it would otherwise truncate or corrupt the URL.
 */
export function thumbnailUrl(filename: string, meta: GcodeMetadata | null): string | null {
  const thumbs = meta?.thumbnails ?? []
  if (!thumbs.length) return null
  const best = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  if (!best?.relative_path) return null
  const folder = filename.split('/').slice(0, -1).join('/')
  const rel = folder ? `${folder}/${best.relative_path}` : best.relative_path
  const enc = rel.split('/').map(encodeURIComponent).join('/')
  return `${moonrakerHttpBase()}/server/files/gcodes/${enc}`
}
