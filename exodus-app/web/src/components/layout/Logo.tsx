import { Link } from 'react-router'

// The Exodus word mark. The icon is two stacked bars: one asset split in two
// (PT on top, YT below), which is what Exodus does.
export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary/15">
        <svg viewBox="0 0 16 16" className="size-4 fill-primary">
          <rect x="2" y="3" width="12" height="4" rx="1.5" />
          <rect x="2" y="9" width="8" height="4" rx="1.5" className="fill-gold" />
        </svg>
      </span>
      Exodus
    </Link>
  )
}
