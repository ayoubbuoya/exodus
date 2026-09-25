import { cn } from 'cn'

type AmountProps = {
  /** The number as it should read, already formatted. Example: "24.390243" or "$500.00". */
  value: string
  /** An optional unit after the number, set a little smaller. Example: "USYC". */
  unit?: string
  className?: string
}

// A big amount with its decimals dimmed, the way a wallet shows a balance:
//   24.390243 USYC  →  "24" bright, ".390243" and "USYC" dimmed.
// The whole part is what the eye should catch first; the decimals are still
// there (exact to 6 places, like the ledger), just quieter.
// A value without a decimal point (for example "01 Apr 2027") stays bright.
export function Amount({ value, unit, className }: AmountProps) {
  const dot = value.indexOf('.')
  const whole = dot === -1 ? value : value.slice(0, dot)
  const decimals = dot === -1 ? '' : value.slice(dot)
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      {whole}
      {decimals && <span className="opacity-45">{decimals}</span>}
      {unit && <span className="ml-[0.28em] text-[0.62em] font-medium tracking-normal opacity-55">{unit}</span>}
    </span>
  )
}
