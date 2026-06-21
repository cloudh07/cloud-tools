import { useState, type DragEvent, type ReactElement } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'

import { useImageDocumentMergeStore } from '@/features/image-document-merge/application/image-document-merge.store'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function DocumentImageQueue({ busy }: { busy: boolean }): ReactElement {
  const queue = useImageDocumentMergeStore((state) => state.queue)
  const moveImage = useImageDocumentMergeStore((state) => state.moveImage)
  const removeImage = useImageDocumentMergeStore((state) => state.removeImage)
  const clearImages = useImageDocumentMergeStore((state) => state.clearImages)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const totalBytes = queue.reduce((sum, item) => sum + item.sizeBytes, 0)

  const handleDrop = (event: DragEvent<HTMLLIElement>, targetIndex: number): void => {
    event.preventDefault()
    if (draggedIndex == null || busy) return
    moveImage(draggedIndex, targetIndex)
    setDraggedIndex(null)
  }

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Thứ tự ảnh</CardTitle>
            <CardDescription>
              {queue.length} ảnh · {formatBytes(totalBytes)} · mỗi ảnh tạo một trang.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || queue.length === 0}
            onClick={clearImages}
          >
            Xóa tất cả
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[min(360px,44vh)] min-h-40 rounded-md border border-border/80">
          {queue.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Chưa có ảnh. Kéo thả hoặc chọn nhiều ảnh để bắt đầu.
            </div>
          ) : (
            <ol className="space-y-2 p-2 pr-3" aria-label="Danh sách ảnh theo thứ tự xuất">
              {queue.map((item, index) => (
                <li
                  key={item.localId}
                  draggable={!busy}
                  onDragStart={() => setDraggedIndex(index)}
                  onDragEnd={() => setDraggedIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, index)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border/80 bg-card/50 p-2 transition-colors',
                    draggedIndex === index && 'opacity-50'
                  )}
                >
                  <GripVertical
                    className="size-4 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden
                  />
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {item.thumbnailDataUrl ? (
                      <img
                        src={item.thumbnailDataUrl}
                        alt=""
                        className="size-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Preview</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.width}×{item.height} · {item.format.toUpperCase()} ·{' '}
                      {formatBytes(item.sizeBytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0"
                      disabled={busy || index === 0}
                      onClick={() => moveImage(index, index - 1)}
                      aria-label={`Đưa ${item.name} lên trước`}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0"
                      disabled={busy || index === queue.length - 1}
                      onClick={() => moveImage(index, index + 1)}
                      aria-label={`Đưa ${item.name} xuống sau`}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-destructive"
                      disabled={busy}
                      onClick={() => removeImage(item.localId)}
                      aria-label={`Xóa ${item.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
