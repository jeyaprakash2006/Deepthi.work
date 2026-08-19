import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface Props<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'md' | 'sm'
  ariaLabel: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: Props<T>) {
  return (
    <div
      className={`segmented${size === 'sm' ? ' segmented--sm' : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          disabled={opt.disabled}
          className={`segmented__btn${value === opt.value ? ' is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
