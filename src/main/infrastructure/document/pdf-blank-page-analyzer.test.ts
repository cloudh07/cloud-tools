import { PDFDocument, PDFName } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import {
  findStructurallyBlankPdfPageIndices,
  isStructurallyBlankPdfPage
} from './pdf-blank-page-analyzer'

describe('structural PDF blank-page analysis', () => {
  it('detects missing and whitespace-only content streams', async () => {
    const pdf = await PDFDocument.create()
    const missingContents = pdf.addPage()
    const whitespaceContents = pdf.addPage()
    whitespaceContents.node.set(
      PDFName.of('Contents'),
      pdf.context.register(pdf.context.flateStream(' \n% comment only\n\t'))
    )

    expect(isStructurallyBlankPdfPage(missingContents)).toBe(true)
    expect(isStructurallyBlankPdfPage(whitespaceContents)).toBe(true)
    expect(findStructurallyBlankPdfPageIndices(pdf)).toEqual([0, 1])
  })

  it('preserves pages with visible content, annotations, or undecodable streams', async () => {
    const pdf = await PDFDocument.create()
    const textPage = pdf.addPage()
    textPage.drawText('keep')

    const annotationPage = pdf.addPage()
    annotationPage.node.set(PDFName.of('Annots'), pdf.context.obj([{}]))

    const unknownStreamPage = pdf.addPage()
    unknownStreamPage.node.set(
      PDFName.of('Contents'),
      pdf.context.register(
        pdf.context.stream('untrusted', { Filter: PDFName.of('UnsupportedFilter') })
      )
    )

    expect(findStructurallyBlankPdfPageIndices(pdf)).toEqual([])
  })
})
