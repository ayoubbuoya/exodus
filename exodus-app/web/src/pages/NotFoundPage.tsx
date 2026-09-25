import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// Shown for any URL we don't know, for example a mistyped /market.
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="num label-caps">404</p>
      <h1 className="mt-3 font-display text-[32px] leading-tight">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This page does not exist.</p>
      <Button asChild variant="glass" className="mt-8">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}
