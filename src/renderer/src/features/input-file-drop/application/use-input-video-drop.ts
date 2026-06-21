import { validateDroppedVideoFilePaths } from '@/features/input-file-drop/domain/dropped-video-paths'
import {
  readDroppedLocalFilePath,
  type ReadDroppedPathFailureCode
} from '@/shared/lib/electron-file-path'
import { fromEvent } from 'file-selector'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone, type DropEvent } from 'react-dropzone'
import { toast } from 'sonner'

export type InputVideoDropSurface = 'idle' | 'dragging' | 'accepted' | 'rejected' | 'error'

export type DroppedPathListValidation =
  | { ok: true; paths: string[] }
  | { ok: false; message: string }

export type DroppedPathsValidator = (paths: readonly string[]) => DroppedPathListValidation

type Params = {
  disabled: boolean
  multiple: boolean
  onPathsAccepted: (paths: string[]) => void
  toastOnReject?: boolean
  validatePaths?: DroppedPathsValidator
}

async function getDroppedFilesPreservingOsPath(
  event: DropEvent
): Promise<Array<File | DataTransferItem>> {
  if (
    typeof event === 'object' &&
    event !== null &&
    'dataTransfer' in event &&
    (event as DragEvent).dataTransfer &&
    (event as DragEvent).dataTransfer!.files.length > 0
  ) {
    const files = Array.from((event as DragEvent).dataTransfer!.files)
    if (import.meta.env.DEV) {
      console.debug('[input-video-drop] using DataTransfer.files', { count: files.length })
    }
    return files
  }
  return fromEvent(event as Parameters<typeof fromEvent>[0])
}

function userFacingReadPathMessage(code: ReadDroppedPathFailureCode, rawMessage: string): string {
  switch (code) {
    case 'webutils_empty':
      return 'Tệp thả không gắn đường dẫn trên ổ đĩa (bản sao File không có path). Hãy kéo trực tiếp từ File Explorer / Finder vào vùng nhận, hoặc dùng nút chọn tệp.'
    case 'no_desktop_bridge':
      return 'Thiếu API desktop từ preload (getPathForLocalFile). Kiểm tra console hoặc bản cài/build.'
    case 'not_file':
      return 'Đối tượng thả không phải tệp hợp lệ.'
    case 'webutils_threw':
      return `Không đọc được đường dẫn: ${rawMessage}`
    case 'not_absolute':
    case 'invalid_file_url':
    case 'unknown':
    default:
      return rawMessage
  }
}

export function useInputVideoDrop({
  disabled,
  multiple,
  onPathsAccepted,
  toastOnReject = true,
  validatePaths
}: Params): {
  surface: InputVideoDropSurface
  getRootProps: ReturnType<typeof useDropzone>['getRootProps']
  getInputProps: ReturnType<typeof useDropzone>['getInputProps']
} {
  const onPathsRef = useRef(onPathsAccepted)
  useEffect(() => {
    onPathsRef.current = onPathsAccepted
  }, [onPathsAccepted])

  const [pulse, setPulse] = useState<Extract<
    InputVideoDropSurface,
    'accepted' | 'rejected' | 'error'
  > | null>(null)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPulseTimer = useCallback(() => {
    if (pulseTimer.current) {
      clearTimeout(pulseTimer.current)
      pulseTimer.current = null
    }
  }, [])

  const flashPulse = useCallback(
    (kind: 'accepted' | 'rejected' | 'error', ms: number) => {
      clearPulseTimer()
      setPulse(kind)
      pulseTimer.current = setTimeout(() => {
        setPulse(null)
        pulseTimer.current = null
      }, ms)
    },
    [clearPulseTimer]
  )

  useEffect(() => () => clearPulseTimer(), [clearPulseTimer])

  const validatePathsRef = useRef(validatePaths)
  useEffect(() => {
    validatePathsRef.current = validatePaths
  }, [validatePaths])

  const onDrop = useCallback(
    (files: File[]) => {
      if (disabled || files.length === 0) return
      if (import.meta.env.DEV) {
        console.debug('[input-video-drop] onDrop', { count: files.length })
      }
      const pathResults = files.map((file) => ({ file, r: readDroppedLocalFilePath(file) }))
      const raw: string[] = []
      for (const { r } of pathResults) {
        if (r.ok) raw.push(r.path)
      }
      if (raw.length === 0) {
        const firstFail = pathResults.find((x) => !x.r.ok)
        let msg = 'Không nhận được tệp.'
        if (firstFail && !firstFail.r.ok) {
          msg = userFacingReadPathMessage(firstFail.r.code, firstFail.r.message)
        }
        if (toastOnReject) toast.error(msg)
        flashPulse('error', 3200)
        return
      }
      if (raw.length < files.length) {
        const firstFail = pathResults.find((x) => !x.r.ok)
        const hint =
          firstFail && !firstFail.r.ok
            ? userFacingReadPathMessage(firstFail.r.code, firstFail.r.message)
            : ''
        if (toastOnReject) {
          toast.message(
            `Chỉ thêm ${raw.length}/${files.length} tệp (bỏ qua tệp không đọc được đường dẫn).${hint ? ` ${hint}` : ''}`
          )
        }
      }
      const candidate = multiple ? raw : raw.slice(0, 1)
      const validate = validatePathsRef.current ?? validateDroppedVideoFilePaths
      const v = validate(candidate)
      if (!v.ok) {
        if (toastOnReject) toast.error(v.message)
        flashPulse('rejected', 2400)
        return
      }
      if (!multiple && raw.length > 1) {
        toast.message('Đã thả nhiều tệp - chỉ dùng tệp đầu tiên.')
      }
      onPathsRef.current(v.paths)
      flashPulse('accepted', 900)
    },
    [disabled, flashPulse, multiple, toastOnReject]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    getFilesFromEvent: getDroppedFilesPreservingOsPath,
    disabled,
    noClick: true,
    noKeyboard: true,
    multiple: true,
    preventDropOnDocument: true,
    useFsAccessApi: false
  })

  const surface: InputVideoDropSurface = isDragActive ? 'dragging' : (pulse ?? 'idle')

  return { surface, getRootProps, getInputProps }
}
