import { describe, expect, it } from 'vitest'

import { parseStartDocumentMergeRequest } from './image-document-merge.validation'

const baseRequest = {
  jobId: '00000000-0000-4000-8000-000000000000',
  mode: 'create' as const,
  outputFormat: 'pdf' as const,
  basePdfPath: null,
  outputPath: 'C:\\output.pdf',
  imagePaths: ['C:\\image.jpg'],
  blankPageHandling: 'preserve' as const,
  settings: {
    pageSize: 'a4' as const,
    orientation: 'auto' as const,
    margin: 'standard' as const,
    imageFit: 'contain' as const,
    quality: 85
  }
}

describe('image document merge request validation', () => {
  it('allows blank-page handling for append mode', () => {
    expect(
      parseStartDocumentMergeRequest({
        ...baseRequest,
        mode: 'append',
        basePdfPath: 'C:\\source.pdf',
        blankPageHandling: 'fill_and_remove'
      }).blankPageHandling
    ).toBe('fill_and_remove')
  })

  it('rejects blank-page handling for create mode', () => {
    expect(() =>
      parseStartDocumentMergeRequest({ ...baseRequest, blankPageHandling: 'fill_and_remove' })
    ).toThrow('Blank-page handling is available for append mode only.')
  })
})
