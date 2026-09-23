// Small display helpers for the dashboard. Display only: amounts stay exact
// decimal strings everywhere else.

// "2026-11-15T00:00:00Z" -> "Nov 15, 2026". The demo dates are midnight UTC,
// so we format in UTC (in New York the local time would still be Nov 14).
export function formatDemoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// Short axis label: "Nov 15".
export function formatDemoDay(time: number): string {
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Seconds -> "23:59:12" (for the faucet countdown).
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
}

// "+100 USDC" / "−40 USDC" (a real minus sign, easier to read than "-").
export function formatSignedAmount(amount: string, instrument: string, formatAmount: (value: string) => string): string {
  const isNegative = amount.startsWith('-')
  const magnitude = isNegative ? amount.slice(1) : amount
  return `${isNegative ? '−' : '+'}${formatAmount(magnitude)} ${instrument}`
}
