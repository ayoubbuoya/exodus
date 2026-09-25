// The cards /onboarding shows once an application exists: under review,
// rejected (with the reason) and approved.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, CircleCheckIcon, CircleXIcon, HourglassIcon } from 'lucide-react'
import type { Profile } from '@/api/types'
import { countryName } from '@/lib/countries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type Application = NonNullable<Profile['application']>

export function PendingCard({ application }: { application: Application }) {
  return (
    <Card>
      <CardHeader>
        <StatusTitle icon={<HourglassIcon className="text-warning" />}>Your application is under review</StatusTitle>
        <CardDescription>
          An Exodus admin checks every request. This page updates by itself as soon as you are approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApplicationSummary application={application} />
      </CardContent>
    </Card>
  )
}

// Shown above the form, so the user sees why before applying again.
export function RejectedNotice({ application }: { application: Application }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <StatusTitle icon={<CircleXIcon className="text-destructive" />}>Your application was not approved</StatusTitle>
        <CardDescription>
          {application.rejectionReason ?? 'No reason was given.'} You can correct your details and apply again below.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

export function ApprovedCard({ partyId }: { partyId: string }) {
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <StatusTitle icon={<CircleCheckIcon className="text-primary" />}>You are approved</StatusTitle>
        <CardDescription>
          Your Canton wallet and access pass are ready. You can now claim test USDC and subscribe to simulated USYC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Your party id</p>
        <p className="font-mono text-xs break-all">{partyId}</p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link to="/app">
            Open my wallet
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function StatusTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2 text-lg">
      {icon}
      {children}
    </CardTitle>
  )
}

// "Name: Alice Martin · Country: France · Sent: 23 Sep 2026, 13:49"
function ApplicationSummary({ application }: { application: Application }) {
  const rows = [
    { label: 'Name', value: application.fullName },
    { label: 'Country', value: countryName(application.country) },
    { label: 'Sent', value: new Date(application.createdAt).toLocaleString() },
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
