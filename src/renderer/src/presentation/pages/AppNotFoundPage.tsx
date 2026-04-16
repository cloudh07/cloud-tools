import { Button } from '@/shared/presentation/components/ui/button'
import { Link } from '@tanstack/react-router'
import { Home } from 'lucide-react'
import type { ReactElement } from 'react'

export function AppNotFoundPage(): ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Không tìm thấy trang</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Đường dẫn không khớp với bất kỳ tính năng nào trong ứng dụng.
        </p>
      </div>
      <Button asChild variant="secondary" className="gap-2">
        <Link to="/tools/chroma-video">
          <Home className="size-4" aria-hidden />
          Về Chroma video
        </Link>
      </Button>
    </div>
  )
}
