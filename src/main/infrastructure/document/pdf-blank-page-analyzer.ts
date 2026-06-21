import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  type PDFPage,
  PDFRawStream,
  PDFStream
} from 'pdf-lib'

function containsMeaningfulContent(bytes: Uint8Array): boolean {
  const content = Buffer.from(bytes)
    .toString('latin1')
    .replace(/%[^\r\n]*/g, '')
    .replace(/[\0\t\n\f\r ]+/g, '')
  return content.length > 0
}

function streamContainsMeaningfulContent(stream: PDFStream): boolean {
  try {
    const bytes =
      stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents()
    return containsMeaningfulContent(bytes)
  } catch {
    // Unknown or unsupported stream filters must never cause a page to be deleted.
    return true
  }
}

export function isStructurallyBlankPdfPage(page: PDFPage): boolean {
  const annotations = page.node.Annots()
  if (annotations && annotations.size() > 0) return false

  const contents = page.node.Contents()
  if (!contents) return true
  if (contents instanceof PDFStream) return !streamContainsMeaningfulContent(contents)
  if (!(contents instanceof PDFArray)) return false
  if (contents.size() === 0) return true

  for (let index = 0; index < contents.size(); index++) {
    try {
      const stream = contents.lookup(index, PDFStream)
      if (streamContainsMeaningfulContent(stream)) return false
    } catch {
      return false
    }
  }
  return true
}

export function findStructurallyBlankPdfPageIndices(pdf: PDFDocument): number[] {
  const blankPageIndices: number[] = []
  const pages = pdf.getPages()
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    if (page && isStructurallyBlankPdfPage(page)) blankPageIndices.push(index)
  }
  return blankPageIndices
}
