// The big amount box of every money form (subscribe, redeem, send, trade,
// mint): a label and the balance with a "Max" button on top, then the number
// in large type with its unit on the right.
//
//   You pay                         Balance 100 USDC  [Max]
//   50                                              USDC
//
// The whole box lights up while the input has focus, and turns red when the
// API rejects the amount (the message itself goes under the box, in a
// FieldError, like every other form).
import { cn } from 'cn'
import { formatAmount } from '@exodus/ledger'

type AmountInputProps = {
  id: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  // What the user has, for the "Balance … [Max]" line. Leave out to hide it.
  balance?: string
  // The balance's unit when it is not the input's, for example "USDC" while
  // buying PT (you pay in USDC). Defaults to `unit`.
  balanceUnit?: string
  // Fills in the whole balance. Leave out for no Max button.
  onMax?: () => void
  invalid?: boolean
  disabled?: boolean
}

export function AmountInput({
  id,
  label,
  unit,
  value,
  onChange,
  balance,
  balanceUnit = unit,
  onMax,
  invalid = false,
  disabled = false,
}: AmountInputProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-foreground/4 p-4 ring-1 ring-foreground/10 transition-shadow ring-inset focus-within:ring-foreground/35',
        invalid && 'ring-destructive/60 focus-within:ring-destructive',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <label htmlFor={id}>{label}</label>
        {balance !== undefined && (
          <span className="flex items-center gap-2">
            <span>
              Balance{' '}
              <span className="num text-foreground">
                {formatAmount(balance)} {balanceUnit}
              </span>
            </span>
            {onMax !== undefined && (
              <button
                type="button"
                disabled={disabled}
                onClick={onMax}
                className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-foreground/16 disabled:pointer-events-none"
              >
                Max
              </button>
            )}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          // Spaces sneak in when pasting ("1 000"); the API wants plain digits.
          onChange={(event) => onChange(event.target.value.trim())}
          aria-invalid={invalid}
          // w-full + min-w-0: an <input> has a built-in width (about 20
          // characters of this big font), which would push the box wider than
          // a narrow panel. With a percentage width it may shrink to fit.
          className="num w-full min-w-0 flex-1 bg-transparent font-display text-[28px] leading-tight outline-none placeholder:text-foreground/25 disabled:cursor-not-allowed"
        />
        <span className="shrink-0 rounded-full bg-foreground/8 px-3 py-1 text-sm font-medium">{unit}</span>
      </div>
    </div>
  )
}
