import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export type SpinnerProps = React.ComponentProps<'svg'>

export function Spinner({ className, ...props }: SpinnerProps): React.ReactElement {
  return (
    <Loader2
      role="status"
      aria-label="Đang tải"
      className={cn('size-4 shrink-0 animate-spin', className)}
      {...props}
    />
  )
}
