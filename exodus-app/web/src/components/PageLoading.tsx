import { Skeleton } from '@/components/ui/skeleton'

// A quiet placeholder for the moment a page is not ready yet:
// - its code is still downloading (the app pages load lazily, see router.tsx),
// - or the route guard is still asking the API who is logged in (RequireStage).
// Usually a fraction of a second, so it stays calm: a few grey blocks in the
// shape of a page, no spinner, no text that would flash.
export function PageLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-16" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
