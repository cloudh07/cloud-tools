import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { inspectDocumentImages } from './document-image-inspector'

describe('document image inspection', () => {
  let directory = ''

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cloud-tools-image-inspection-'))
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('accepts valid static images and preserves partial success', async () => {
    const validPath = join(directory, 'valid.png')
    const invalidPath = join(directory, 'invalid.svg')
    await sharp({
      create: { width: 20, height: 10, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } }
    })
      .png()
      .toFile(validPath)
    await writeFile(invalidPath, '<svg></svg>')

    const result = await inspectDocumentImages([validPath, invalidPath])
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0]).toMatchObject({ format: 'png', hasAlpha: true })
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.code).toBe('unsupported_extension')
  })

  it('rejects content that does not match its extension', async () => {
    const fakeJpeg = join(directory, 'fake.jpg')
    await writeFile(fakeJpeg, 'not an image')
    const result = await inspectDocumentImages([fakeJpeg])
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0]?.code).toBe('signature_mismatch')
  })
})
