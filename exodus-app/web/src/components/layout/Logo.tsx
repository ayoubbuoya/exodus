import { Link } from 'react-router'
import { cn } from 'cn'
import { Mark } from '@/components/brand/Mark'

type LogoProps = {
  /** "lg" for the landing page's top bar and footer, "md" for app screens. */
  size?: 'md' | 'lg'
  className?: string
}

// The Exodus lockup: the seated-wedge mark next to the wordmark set in the display face (Archivo).
// It always links home. The accessible name comes from the visible word "Exodus".
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn('flex items-center text-foreground', size === 'lg' ? 'gap-3' : 'gap-2.5', className)}
    >
      <Mark className={size === 'lg' ? 'h-7 w-auto' : 'h-5 w-auto'} />
      <span className={cn('font-display leading-none', size === 'lg' ? 'text-[26px]' : 'text-xl')}>
        Exodus
      </span>
    </Link>
  )
}
