import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PageSettings } from '@shared/domain/image-document-merge'
import { inspectDocumentImages } from './document-image-inspector'
import { writeDocxDocument } from './docx-document-writer'
import { writePdfDocument } from './pdf-document-writer'

const settings: PageSettings = {
  pageSize: 'a4',
  orientation: 'auto',
  margin: 'standard',
  imageFit: 'contain',
  quality: 82
}

describe('document writers', () => {
  let directory = ''

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cloud-tools-document-writer-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  async function createInputs(): Promise<string[]> {
    const jpegPath = join(directory, 'first.jpg')
    const pngPath = join(directory, 'second.png')
    await sharp({ create: { width: 320, height: 180, channels: 3, background: '#cc3300' } })
      .jpeg()
      .toFile(jpegPath)
    await sharp({
      create: {
        width: 180,
        height: 320,
        channels: 4,
        background: { r: 0, g: 90, b: 200, alpha: 0.5 }
      }
    })
      .png()
      .toFile(pngPath)
    return [jpegPath, pngPath]
  }

  it('creates a PDF with one page per image', async () => {
    const inspection = await inspectDocumentImages(await createInputs())
    const outputPath = join(directory, 'created.pdf')
    const pageCount = await writePdfDocument({
      basePdfPath: null,
      outputPath,
      images: inspection.accepted,
      settings,
      onProgress: () => undefined
    })
    const pdf = await PDFDocument.load(await readFile(outputPath))
    expect(pageCount).toBe(2)
    expect(pdf.getPageCount()).toBe(2)
  })

  it('appends image pages after an existing PDF', async () => {
    const [firstPath] = await createInputs()
    const inspection = await inspectDocumentImages([firstPath!])
    const base = await PDFDocument.create()
    base.addPage([200, 200])
    const basePath = join(directory, 'base.pdf')
    await writeFile(basePath, await base.save())
    const outputPath = join(directory, 'appended.pdf')
    await writePdfDocument({
      basePdfPath: basePath,
      outputPath,
      images: inspection.accepted,
      settings,
      onProgress: () => undefined
    })
    const output = await PDFDocument.load(await readFile(outputPath))
    expect(output.getPageCount()).toBe(2)
  })

  it('creates a DOCX package with one embedded image per section', async () => {
    const inspection = await inspectDocumentImages(await createInputs())
    const outputPath = join(directory, 'created.docx')
    const pageCount = await writeDocxDocument({
      outputPath,
      images: inspection.accepted,
      settings,
      onProgress: () => undefined
    })
    const zip = await JSZip.loadAsync(await readFile(outputPath))
    const mediaFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('word/media/') && !name.endsWith('/')
    )
    const documentXml = await zip.file('word/document.xml')!.async('string')
    expect(pageCount).toBe(2)
    expect(mediaFiles).toHaveLength(2)
    expect(documentXml.match(/<w:drawing>/g)).toHaveLength(2)
  })
})
