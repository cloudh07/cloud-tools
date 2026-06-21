import { z } from 'zod'

import { DOCUMENT_MERGE_LIMITS } from '@shared/domain/image-document-merge'
import type { StartDocumentMergeRequest } from '@shared/domain/image-document-merge'

const pageSettingsSchema = z.object({
  pageSize: z.enum(['a4', 'match_image']),
  orientation: z.enum(['auto', 'portrait', 'landscape']),
  margin: z.enum(['none', 'small', 'standard']),
  imageFit: z.enum(['contain', 'cover', 'actual']),
  quality: z.number().int().min(40).max(95)
})

const startRequestSchema = z
  .object({
    jobId: z.string().uuid(),
    mode: z.enum(['create', 'append']),
    outputFormat: z.enum(['pdf', 'docx']),
    basePdfPath: z.union([z.string().min(1).max(8192), z.null()]),
    outputPath: z.string().min(1).max(8192),
    imagePaths: z.array(z.string().min(1).max(8192)).min(1).max(DOCUMENT_MERGE_LIMITS.maxImages),
    settings: pageSettingsSchema
  })
  .superRefine((value, context) => {
    if (value.mode === 'append' && (!value.basePdfPath || value.outputFormat !== 'pdf')) {
      context.addIssue({
        code: 'custom',
        message: 'Append mode requires a source PDF and PDF output.'
      })
    }
    if (value.mode === 'create' && value.basePdfPath !== null) {
      context.addIssue({ code: 'custom', message: 'Create mode cannot include a source PDF.' })
    }
    if (value.outputFormat === 'docx' && value.settings.pageSize === 'match_image') {
      context.addIssue({
        code: 'custom',
        message: 'DOCX output supports A4 page size only.'
      })
    }
    const uniquePaths = new Set(value.imagePaths.map((path) => path.toLowerCase()))
    if (uniquePaths.size !== value.imagePaths.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate image paths are not allowed.' })
    }
  })

export function parseStartDocumentMergeRequest(raw: unknown): StartDocumentMergeRequest {
  return startRequestSchema.parse(raw) as StartDocumentMergeRequest
}

export function parseDocumentMergeJobId(raw: unknown): string {
  return z.string().uuid().parse(raw)
}

export function parseDocumentImagePaths(raw: unknown): string[] {
  return z.array(z.string().min(1).max(8192)).min(1).max(500).parse(raw)
}

export function parseDocumentPath(raw: unknown): string {
  return z.string().min(1).max(8192).parse(raw)
}
