// /admin: the operator's review queue for access applications.
// Pill filters by status (Pending first, oldest at the top); Approve / Reject
// open a confirm dialog. New applications appear by themselves (15 s refresh).
import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useAdminApplications } from '@/api/hooks'
import type { ApplicationForReview, ApplicationStatus } from '@/api/types'
import { ApplicationsTable } from '@/components/admin/ApplicationsTable'
import { ApproveDialog, RejectDialog } from '@/components/admin/ReviewDialogs'
import { FormError } from '@/components/FormError'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type StatusFilter = ApplicationStatus | 'ALL'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
]

export function AdminPage() {
  const [filter, setFilter] = useState<StatusFilter>('PENDING')
  const [page, setPage] = useState(1)
  const [toApprove, setToApprove] = useState<ApplicationForReview | null>(null)
  const [toReject, setToReject] = useState<ApplicationForReview | null>(null)
  const applications = useAdminApplications(filter === 'ALL' ? undefined : filter, page)

  function changeFilter(value: string) {
    setFilter(value as StatusFilter)
    // A new filter starts again at page 1 (page 3 of "All" may not exist in "Pending").
    setPage(1)
  }

  return (
    <Page>
      <PageHeader title="Applications" description="Approving creates the client's Canton wallet and access pass." />
      <Card>
        <CardContent className="grid gap-4">
          <Tabs value={filter} onValueChange={changeFilter}>
            <TabsList aria-label="Filter by status">
              {FILTERS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {applications.isPending && <Skeleton className="h-40 w-full" />}
          {applications.isError && <FormError error={applications.error} />}
          {applications.data !== undefined && (
            <>
              {/* A wide table: on a phone it scrolls sideways inside the card. */}
              <div className="-mx-2 overflow-x-auto px-2">
                <ApplicationsTable applications={applications.data.items} onApprove={setToApprove} onReject={setToReject} />
              </div>
              <Pager
                page={applications.data.page}
                totalPages={applications.data.totalPages}
                total={applications.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ApproveDialog application={toApprove} onClose={() => setToApprove(null)} />
      <RejectDialog application={toReject} onClose={() => setToReject(null)} />
    </Page>
  )
}

type PagerProps = {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

// "12 applications · Page 1 of 1   [<] [>]"
function Pager({ page, totalPages, total, onPageChange }: PagerProps) {
  // totalPages is 0 when the list is empty; still show "page 1 of 1".
  const lastPage = Math.max(totalPages, 1)
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span className="num">
        {total} application{total === 1 ? '' : 's'} · Page {page} of {lastPage}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
