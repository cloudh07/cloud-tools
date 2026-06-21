import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { inspectDocumentPdf } from './document-pdf-inspector'
import { validateDocumentOutputPath } from './document-output-path'

describe('document PDF and output validation', () => {
  let directory = ''

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cloud-tools-pdf-inspection-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('reads a valid PDF page count', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    pdf.addPage()
    const path = join(directory, 'valid.pdf')
    await writeFile(path, await pdf.save())
    await expect(inspectDocumentPdf(path)).resolves.toMatchObject({
      pageCount: 2,
      structurallyBlankPageCount: 2
    })
  })

  it('rejects a corrupt PDF and an output path that overwrites the source', async () => {
    const corruptPath = join(directory, 'corrupt.pdf')
    await writeFile(corruptPath, '%PDF-invalid')
    await expect(inspectDocumentPdf(corruptPath)).rejects.toThrow('Unable to read')
    expect(() => validateDocumentOutputPath(corruptPath, 'pdf', corruptPath)).toThrow(
      'different from the source'
    )
  })
})
