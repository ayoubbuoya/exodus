// What /onboarding shows once an application exists: under review, rejected
// (with the reason) and approved. The panel around them is AuthCard.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, ChartColumnIcon, CircleXIcon } from 'lucide-react'
import type { Profile } from '@/api/types'
import { PartyId } from '@/components/app/PartyId'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { countryName } from '@/lib/countries'

type Application = NonNullable<Profile['application']>

// "Under review": what was sent, a live "checking" line, and something to do
// meanwhile (any signed-in user may look at the markets).
export function PendingDetails({ application }: { application: Application }) {
  return (
    <div className="grid gap-6">
      <ApplicationSummary application={application} />
      {/* role="status": screen readers hear it once, not on every re-check. */}
      <p role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-info" />
        </span>
        This page updates by itself as soon as you are approved.
      </p>
      <div className="flex flex-wrap items-center gap-3 border-t border-foreground/8 pt-5">
        <span className="text-sm text-muted-foreground">Meanwhile:</span>
        <Button asChild variant="glass">
          <Link to="/markets">
            <ChartColumnIcon data-icon="inline-start" />
            Browse the markets
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Shown above the form, so the user sees why before applying again.
export function RejectedNotice({ application }: { application: Application }) {
  return (
    <Alert variant="destructive" className="mb-6">
      <CircleXIcon />
      <AlertTitle>Your last request was not approved</AlertTitle>
      <AlertDescription>{application.rejectionReason ?? 'No reason was given.'}</AlertDescription>
    </Alert>
  )
}

// "You're approved": the new Canton party (other clients need it to send
// tokens here) and the way into the wallet.
export function ApprovedDetails({ partyId }: { partyId: string }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">Your Canton party id</p>
        <PartyId partyId={partyId} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="bright" size="lg">
          <Link to="/app">
            Open my wallet
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild variant="glass" size="lg">
          <Link to="/markets">See the markets</Link>
        </Button>
      </div>
    </div>
  )
}

// "Name: Alice Martin · Country: France · Sent: 23 Sep 2026, 13:49"
function ApplicationSummary({ application }: { application: Application }) {
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Name', value: application.fullName },
    { label: 'Country', value: countryName(application.country) },
    { label: 'Sent', value: <span className="num">{new Date(application.createdAt).toLocaleString()}</span> },
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 rounded-2xl bg-foreground/3 p-4 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
