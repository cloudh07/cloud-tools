import { beforeEach, describe, expect, it } from 'vitest'

import { useImageDocumentMergeStore } from './image-document-merge.store'
import type { DocumentImageDescriptor } from '@shared/domain/image-document-merge'

function descriptor(path: string, sizeBytes = 1024): DocumentImageDescriptor {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    sizeBytes,
    width: 100,
    height: 100,
    format: 'png',
    mimeType: 'image/png',
    hasAlpha: true
  }
}

describe('image document merge queue', () => {
  beforeEach(() => {
    useImageDocumentMergeStore.getState().setMode('create')
    useImageDocumentMergeStore.getState().clearImages()
  })

  it('deduplicates paths and preserves explicit reorder operations', () => {
    const state = useImageDocumentMergeStore.getState()
    state.addImages([descriptor('C:\\images\\first.png'), descriptor('C:\\images\\second.png')])
    state.addImages([descriptor('c:\\images\\FIRST.png')])
    expect(useImageDocumentMergeStore.getState().queue).toHaveLength(2)

    state.moveImage(0, 1)
    expect(useImageDocumentMergeStore.getState().queue.map((item) => item.name)).toEqual([
      'second.png',
      'first.png'
    ])
  })

  it('keeps blank-page handling opt-in and resets it with the mode', () => {
    const state = useImageDocumentMergeStore.getState()
    state.setMode('append')
    state.setBlankPageHandling('fill_and_remove')
    expect(useImageDocumentMergeStore.getState().blankPageHandling).toBe('fill_and_remove')

    state.setMode('create')
    expect(useImageDocumentMergeStore.getState().blankPageHandling).toBe('preserve')
  })
})
