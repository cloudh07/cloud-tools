import { useInstalledFonts } from '@/features/image-watermark/application/hooks/use-installed-fonts'
import { cn } from '@/shared/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/shared/presentation/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/shared/presentation/components/ui/popover'
import { Check, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'

export type FontFamilyComboboxProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
}

function cssFontFamilyValue(name: string): string {
  const safe = (name || '').trim().replace(/['"\\]/g, '')
  if (!safe) return 'inherit'
  return `'${safe}', sans-serif`
}

export function FontFamilyCombobox({
  value,
  onChange,
  disabled,
  placeholder = 'Chọn font...',
  id,
  className
}: FontFamilyComboboxProps): ReactElement {
  const { fonts, status, error, reload } = useInstalledFonts()
  const [open, setOpen] = useState<boolean>(false)
  const [query, setQuery] = useState<string>('')

  const trimmedQuery = query.trim()
  const displayValue = value?.trim() || ''

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return true
    const lower = trimmedQuery.toLowerCase()
    return fonts.some((f) => f.toLowerCase() === lower)
  }, [fonts, trimmedQuery])

  const handleSelect = useCallback(
    (name: string): void => {
      onChange(name)
      setOpen(false)
      setQuery('')
    },
    [onChange]
  )

  const handleReload = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      reload()
    },
    [reload]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
        >
          <span
            className={cn('line-clamp-1 text-left', !displayValue && 'text-muted-foreground')}
            style={displayValue ? { fontFamily: cssFontFamilyValue(displayValue) } : undefined}
          >
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[240px] p-0" align="start">
        <Command shouldFilter={status === 'ready'}>
          <div className="flex items-center">
            <div className="flex-1">
              <CommandInput placeholder="Tìm font..." value={query} onValueChange={setQuery} />
            </div>
            <button
              type="button"
              onClick={handleReload}
              title="Làm mới danh sách font"
              aria-label="Làm mới danh sách font"
              className="mr-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <RefreshCw
                className={cn('size-3.5', status === 'loading' && 'animate-spin')}
                aria-hidden
              />
            </button>
          </div>
          <CommandList>
            {status === 'loading' && fonts.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                Đang tải danh sách font...
              </div>
            ) : status === 'error' ? (
              <div className="flex flex-col items-center gap-2 py-4 text-sm">
                <span className="text-muted-foreground">
                  {error ?? 'Không tải được danh sách font'}
                </span>
                <button
                  type="button"
                  onClick={handleReload}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                <CommandEmpty>Không có font phù hợp.</CommandEmpty>
                <CommandGroup heading={`Đã cài (${fonts.length})`}>
                  {fonts.map((name) => (
                    <CommandItem key={name} value={name} onSelect={() => handleSelect(name)}>
                      <Check
                        className={cn(
                          'size-3.5 shrink-0',
                          value === name ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden
                      />
                      <span
                        className="line-clamp-1 flex-1"
                        style={{ fontFamily: cssFontFamilyValue(name) }}
                      >
                        {name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {trimmedQuery && !hasExactMatch ? (
                  <CommandGroup heading="Tùy chọn">
                    <CommandItem
                      value={`__custom__${trimmedQuery}`}
                      onSelect={() => handleSelect(trimmedQuery)}
                    >
                      <Check className="size-3.5 shrink-0 opacity-0" aria-hidden />
                      <span className="line-clamp-1 flex-1">
                        Dùng &ldquo;<span className="font-medium">{trimmedQuery}</span>&rdquo;
                      </span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
