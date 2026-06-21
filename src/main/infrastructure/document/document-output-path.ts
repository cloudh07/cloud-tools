import { existsSync, statSync } from 'fs'
import { dirname, extname, isAbsolute, normalize, resolve } from 'path'

import type { DocumentOutputFormat } from '@shared/domain/image-document-merge'

export function validateDocumentOutputPath(
  outputPath: string,
  outputFormat: DocumentOutputFormat,
  sourcePath?: string | null
): string {
  const normalized = normalize(outputPath)
  if (!isAbsolute(normalized)) throw new Error('The output path must be absolute.')
  const expectedExtension = outputFormat === 'pdf' ? '.pdf' : '.docx'
  if (extname(normalized).toLowerCase() !== expectedExtension) {
    throw new Error(`The output path must use the ${expectedExtension} extension.`)
  }
  const parent = dirname(normalized)
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new Error('The output directory does not exist.')
  }
  if (sourcePath && resolve(normalized) === resolve(sourcePath)) {
    throw new Error('The output path must be different from the source document.')
  }
  return normalized
}

export function buildTemporaryDocumentOutputPath(outputPath: string, jobId: string): string {
  return `${outputPath}.cloud-tools-${jobId}.tmp`
}
