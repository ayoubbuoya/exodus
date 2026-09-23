// /onboarding: request access, then follow the review.
//
// What Alice sees depends on her application (from GET /api/auth/me):
//   none      -> the access form
//   PENDING   -> "under review" (the page re-checks every 10 s, see useProfile)
//   REJECTED  -> the reason, and the form pre-filled to apply again
//   approved  -> "You are approved" with a button to her wallet
import type { ReactNode } from 'react'
import { useProfile } from '@/api/hooks'
import type { Profile } from '@/api/types'
import { ApplicationForm } from '@/components/onboarding/ApplicationForm'
import { ApprovedCard, PendingCard, RejectedNotice } from '@/components/onboarding/StatusCards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardingPage() {
  const { data: profile } = useProfile({ pollWhilePending: true })

  // RequireStage("signed-in") only renders this page with a loaded profile.
  if (profile === undefined || profile === null) {
    return null
  }
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <OnboardingStep profile={profile} />
    </div>
  )
}

function OnboardingStep({ profile }: { profile: Profile }) {
  const application = profile.application
  if (profile.wallet !== null) {
    return <ApprovedCard partyId={profile.wallet.partyId} />
  }
  if (application === null) {
    return (
      <FormCard title="Request access" description="Three quick questions. An admin reviews every request.">
        <ApplicationForm submitLabel="Send request" />
      </FormCard>
    )
  }
  if (application.status === 'REJECTED') {
    return (
      <>
        <RejectedNotice application={application} />
        <FormCard title="Apply again" description="Check your details and send the request again.">
          <ApplicationForm
            initialValues={{ fullName: application.fullName, country: application.country }}
            submitLabel="Send again"
          />
        </FormCard>
      </>
    )
  }
  // PENDING (APPROVED always comes with a wallet, handled above).
  return <PendingCard application={application} />
}

function FormCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
