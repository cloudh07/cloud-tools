import { describe, expect, it } from 'vitest'

import { calculateContainedSize, calculateDocumentPageLayout } from './image-document-layout'

const baseSettings = {
  pageSize: 'a4' as const,
  orientation: 'auto' as const,
  margin: 'standard' as const,
  imageFit: 'contain' as const,
  quality: 85
}

describe('image document layout', () => {
  it('selects landscape A4 for a wide image in automatic orientation', () => {
    const layout = calculateDocumentPageLayout(1600, 900, baseSettings)
    expect(layout.pageWidthPoints).toBeGreaterThan(layout.pageHeightPoints)
    expect(layout.contentWidthPoints).toBeLessThan(layout.pageWidthPoints)
  })

  it('matches a PDF page to the image ratio', () => {
    const layout = calculateDocumentPageLayout(1000, 2000, {
      ...baseSettings,
      pageSize: 'match_image'
    })
    expect(layout.pageWidthPoints / layout.pageHeightPoints).toBeCloseTo(0.5, 4)
  })

  it('does not upscale actual-size images', () => {
    expect(calculateContainedSize(100, 50, 1000, 1000, false)).toEqual({
      width: 100,
      height: 50
    })
  })
})
