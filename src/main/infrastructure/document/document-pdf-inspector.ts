import { open, readFile, stat } from 'fs/promises'
import { basename, extname, isAbsolute, normalize } from 'path'

import { PDFDocument } from 'pdf-lib'

import {
  DOCUMENT_MERGE_LIMITS,
  type DocumentPdfDescriptor
} from '@shared/domain/image-document-merge'

async function hasPdfSignature(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(5)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return bytesRead === 5 && header.toString('ascii') === '%PDF-'
  } finally {
    await handle.close()
  }
}

export async function inspectDocumentPdf(filePath: string): Promise<DocumentPdfDescriptor> {
  const normalized = normalize(filePath)
  const name = basename(normalized) || 'Unknown PDF'
  if (!isAbsolute(normalized)) throw new Error('The PDF path must be absolute.')
  if (extname(normalized).toLowerCase() !== '.pdf') throw new Error('The source file must be PDF.')

  const fileStat = await stat(normalized)
  if (!fileStat.isFile()) throw new Error(`${name} is not a file.`)
  if (fileStat.size > DOCUMENT_MERGE_LIMITS.maxPdfBytes) {
    throw new Error(`${name} exceeds the 100 MB source PDF limit.`)
  }
  if (!(await hasPdfSignature(normalized))) {
    throw new Error(`${name} does not contain a valid PDF signature.`)
  }

  try {
    const bytes = await readFile(normalized)
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    const pageCount = pdf.getPageCount()
    if (pageCount > DOCUMENT_MERGE_LIMITS.maxPdfPages) {
      throw new Error(`${name} exceeds the 500-page source PDF limit.`)
    }
    return { path: normalized, name, sizeBytes: fileStat.size, pageCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/encrypted/i.test(message)) {
      throw new Error('Password-protected or encrypted PDF files are not supported.')
    }
    if (/500-page/i.test(message)) throw error
    throw new Error(`Unable to read the source PDF: ${message}`)
  }
}
