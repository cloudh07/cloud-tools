import { cn } from '@/shared/lib/utils'
import { Pipette } from 'lucide-react'
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  JSX
} from 'react'

const HEX_SHORT_PATTERN = /^#?([0-9a-fA-F]{3})$/u
const HEX_LONG_PATTERN = /^#?([0-9a-fA-F]{6})$/u

export type ColorFieldProps = {
  id?: string
  value: string
  onChange: (hexNormalized: string) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim()
  const short = HEX_SHORT_PATTERN.exec(trimmed)
  if (short) {
    const [r, g, b] = short[1]!.split('') as [string, string, string]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  const long = HEX_LONG_PATTERN.exec(trimmed)
  if (long) return `#${long[1]!.toLowerCase()}`
  return null
}

export function ColorField(props: ColorFieldProps): JSX.Element {
  const { id, value, onChange, disabled = false, ariaLabel, className } = props
  const nativeId = useId()
  const pickerRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commitDraft = (): void => {
    const normalized = normalizeHex(draft)
    if (normalized && normalized !== value) {
      onChange(normalized)
      return
    }
    setDraft(value)
  }

  const handleDraftChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setDraft(e.target.value)
  }

  const handleDraftKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Escape') {
      setDraft(value)
      e.currentTarget.blur()
    }
  }

  const handlePickerChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value.toLowerCase()
    if (next !== value) onChange(next)
  }

  const openPicker = (): void => {
    if (disabled) return
    pickerRef.current?.click()
  }

  const fieldId = id ?? nativeId

  return (
    <div
      className={cn(
        'flex h-9 w-full items-stretch rounded-md border border-input bg-transparent shadow-sm',
        'focus-within:ring-2 focus-within:ring-ring',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label={ariaLabel ?? 'Mở bảng chọn màu'}
        className={cn(
          'group relative flex w-10 shrink-0 items-center justify-center rounded-l-md border-r border-input',
          'transition-[filter] focus-visible:outline-none',
          !disabled && 'cursor-pointer hover:brightness-95'
        )}
        style={{ backgroundColor: value }}
      >
        <Pipette
          className="size-3.5 text-white mix-blend-difference opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
        <input
          ref={pickerRef}
          type="color"
          tabIndex={-1}
          aria-hidden
          value={value}
          disabled={disabled}
          onChange={handlePickerChange}
          className="pointer-events-none absolute size-0 opacity-0"
        />
      </button>
      <input
        id={fieldId}
        type="text"
        inputMode="text"
        spellCheck={false}
        autoComplete="off"
        value={draft}
        disabled={disabled}
        maxLength={7}
        onChange={handleDraftChange}
        onBlur={commitDraft}
        onKeyDown={handleDraftKey}
        className={cn(
          'min-w-0 flex-1 rounded-r-md bg-transparent px-3 text-sm font-mono uppercase tracking-wide',
          'placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed'
        )}
        placeholder="#ffffff"
      />
    </div>
  )
}
