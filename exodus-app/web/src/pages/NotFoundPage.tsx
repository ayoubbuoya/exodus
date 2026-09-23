import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

// Shown for any URL we don't know, for example /markets before that page exists.
export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="num text-sm text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This page does not exist, or it is not built yet.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  )
}
