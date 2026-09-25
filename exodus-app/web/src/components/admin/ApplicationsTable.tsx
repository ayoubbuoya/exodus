// The admin's review table: one row per access application.
// Pending rows get Approve / Reject buttons; approved rows show the client's party id.
import { CheckIcon, XIcon } from 'lucide-react'
import type { ApplicationForReview, ApplicationStatus } from '@/api/types'
import { countryName } from '@/lib/countries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ApplicationsTableProps = {
  applications: ApplicationForReview[]
  onApprove: (application: ApplicationForReview) => void
  onReject: (application: ApplicationForReview) => void
}

export function ApplicationsTable({ applications, onApprove, onReject }: ApplicationsTableProps) {
  if (applications.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No applications here.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Applicant</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action / wallet</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => (
          <TableRow key={application.id}>
            <TableCell>
              <div className="font-medium">{application.fullName}</div>
              <div className="text-xs text-muted-foreground">{application.user.email}</div>
            </TableCell>
            <TableCell>{countryName(application.country)}</TableCell>
            <TableCell className="text-muted-foreground">{new Date(application.createdAt).toLocaleString()}</TableCell>
            <TableCell>
              <StatusBadge status={application.status} />
            </TableCell>
            <TableCell className="text-right">
              <RowAction application={application} onApprove={onApprove} onReject={onReject} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RowAction({ application, onApprove, onReject }: { application: ApplicationForReview } & Omit<ApplicationsTableProps, 'applications'>) {
  if (application.status === 'PENDING') {
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => onReject(application)}>
          <XIcon data-icon="inline-start" />
          Reject
        </Button>
        <Button size="sm" onClick={() => onApprove(application)}>
          <CheckIcon data-icon="inline-start" />
          Approve
        </Button>
      </div>
    )
  }
  if (application.user.wallet !== null) {
    // The full id is long ("client-bea33f0558af::1220<64 hex>"): show the start, full id on hover.
    const partyId = application.user.wallet.partyId
    return (
      <span className="font-mono text-xs text-muted-foreground" title={partyId}>
        {partyId.slice(0, 26)}…
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">{application.rejectionReason ?? '—'}</span>
}

const STATUS_STYLE: Record<ApplicationStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'border-info/40 text-info' },
  APPROVED: { label: 'Approved', className: 'border-success/40 text-success' },
  REJECTED: { label: 'Rejected', className: 'border-destructive/40 text-destructive' },
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLE[status]
  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  )
}
