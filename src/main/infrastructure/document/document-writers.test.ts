import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'os'
import { join } from 'path'

import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PageSettings } from '@shared/domain/image-document-merge'
import { inspectDocumentImages } from './document-image-inspector'
import { writeDocxDocument } from './docx-document-writer'
import {
  buildBlankPagePlacementPlan,
  buildPdfCompressionProfiles,
  writePdfDocument
} from './pdf-document-writer'
import { findStructurallyBlankPdfPageIndices } from './pdf-blank-page-analyzer'

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
    const result = await writePdfDocument({
      basePdfPath: null,
      outputPath,
      images: inspection.accepted,
      settings,
      blankPageHandling: 'preserve',
      onProgress: () => undefined
    })
    const pdf = await PDFDocument.load(await readFile(outputPath))
    expect(result.pageCount).toBe(2)
    expect(result.outputSizeBytes).toBeLessThan(10 * 1024 * 1024)
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
      blankPageHandling: 'preserve',
      onProgress: () => undefined
    })
    const output = await PDFDocument.load(await readFile(outputPath))
    expect(output.getPageCount()).toBe(2)
  })

  it('replaces blank pages in place, removes unused blanks, and appends remaining images', async () => {
    const [firstPath] = await createInputs()
    const inspection = await inspectDocumentImages([firstPath!])
    const base = await PDFDocument.create()
    base.addPage([200, 200]).drawText('first')
    base.addPage([200, 200])
    base.addPage([200, 200]).drawText('third')
    base.addPage([200, 200])
    const basePath = join(directory, 'base-with-blanks.pdf')
    await writeFile(basePath, await base.save())

    const outputPath = join(directory, 'filled.pdf')
    const result = await writePdfDocument({
      basePdfPath: basePath,
      outputPath,
      images: inspection.accepted,
      settings,
      blankPageHandling: 'fill_and_remove',
      onProgress: () => undefined
    })
    const output = await PDFDocument.load(await readFile(outputPath))

    expect(result).toMatchObject({ pageCount: 3, blankPagesFilled: 1, blankPagesRemoved: 1 })
    expect(findStructurallyBlankPdfPageIndices(output)).toEqual([])
    expect(output.getPages().map((page) => Math.round(page.getWidth()))).toEqual([200, 842, 200])
  })

  it('appends images that remain after all blank-page slots are filled', async () => {
    const inspection = await inspectDocumentImages(await createInputs())
    const base = await PDFDocument.create()
    base.addPage().drawText('first')
    base.addPage()
    base.addPage().drawText('third')
    const basePath = join(directory, 'one-blank.pdf')
    await writeFile(basePath, await base.save())

    const outputPath = join(directory, 'filled-and-appended.pdf')
    const result = await writePdfDocument({
      basePdfPath: basePath,
      outputPath,
      images: inspection.accepted,
      settings,
      blankPageHandling: 'fill_and_remove',
      onProgress: () => undefined
    })

    expect(result).toMatchObject({ pageCount: 4, blankPagesFilled: 1, blankPagesRemoved: 0 })
    expect(
      findStructurallyBlankPdfPageIndices(await PDFDocument.load(await readFile(outputPath)))
    ).toEqual([])
  })

  it('uses deterministic placement and compression profiles', () => {
    expect(buildBlankPagePlacementPlan([1, 3, 4], 2)).toEqual({
      replacementPageIndices: [1, 3],
      appendedImageIndices: [],
      blankPagesFilled: 2,
      blankPagesRemoved: 1
    })
    expect(buildBlankPagePlacementPlan([1], 3).appendedImageIndices).toEqual([1, 2])
    expect(buildPdfCompressionProfiles(85)).toHaveLength(7)
    expect(buildPdfCompressionProfiles(85).at(-1)).toEqual({
      maxEdgePixels: 512,
      quality: 30,
      preserveAlpha: false
    })
  })

  it('retries lower compression profiles until the PDF is below the byte limit', async () => {
    const noisyPath = join(directory, 'noise.jpg')
    await sharp(randomBytes(1200 * 1200 * 3), {
      raw: { width: 1200, height: 1200, channels: 3 }
    })
      .jpeg({ quality: 95 })
      .toFile(noisyPath)
    const inspection = await inspectDocumentImages([noisyPath])
    const phases: string[] = []
    const outputPath = join(directory, 'optimized.pdf')
    const result = await writePdfDocument({
      basePdfPath: null,
      outputPath,
      images: inspection.accepted,
      settings: { ...settings, quality: 95 },
      blankPageHandling: 'preserve',
      maxOutputBytes: 120_000,
      onProgress: (phase) => phases.push(phase)
    })

    expect(result.outputSizeBytes).toBeLessThan(120_000)
    expect((await readFile(outputPath)).length).toBe(result.outputSizeBytes)
    expect(phases).toContain('optimize')
  })

  it('does not write an oversized PDF when the source alone exceeds the limit', async () => {
    const [firstPath] = await createInputs()
    const inspection = await inspectDocumentImages([firstPath!])
    const base = await PDFDocument.create()
    base.addPage()
    const basePath = join(directory, 'too-large-base.pdf')
    await writeFile(basePath, await base.save())
    const outputPath = join(directory, 'must-not-exist.pdf')

    await expect(
      writePdfDocument({
        basePdfPath: basePath,
        outputPath,
        images: inspection.accepted,
        settings,
        blankPageHandling: 'preserve',
        maxOutputBytes: 500,
        onProgress: () => undefined
      })
    ).rejects.toThrow('source PDF cannot fit')
    await expect(readFile(outputPath)).rejects.toThrow()
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
