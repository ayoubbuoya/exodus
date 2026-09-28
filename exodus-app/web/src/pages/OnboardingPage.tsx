// /onboarding: request access, then follow the review.
//
// What Alice sees depends on her application (from GET /api/auth/me):
//   none      -> the access form                       (journey step 2)
//   PENDING   -> "under review" (the page re-checks every 10 s, see useProfile)
//   REJECTED  -> the reason, and the form pre-filled to apply again
//   approved  -> "You're approved" with her party id and the way to her wallet
import { useProfile } from '@/api/hooks'
import type { Profile } from '@/api/types'
import { AuthCard } from '@/components/auth/AuthCard'
import { ApplicationForm } from '@/components/onboarding/ApplicationForm'
import { ApprovedDetails, PendingDetails, RejectedNotice } from '@/components/onboarding/StatusCards'

export function OnboardingPage() {
  const { data: profile } = useProfile({ pollWhilePending: true })

  // RequireStage("signed-in") only renders this page with a loaded profile.
  if (profile === undefined || profile === null) {
    return null
  }
  return <OnboardingStep profile={profile} />
}

function OnboardingStep({ profile }: { profile: Profile }) {
  const application = profile.application
  if (profile.wallet !== null) {
    return (
      <AuthCard
        step="done"
        width="lg"
        title="You're approved"
        description="Your Canton wallet and access pass are ready. Claim test USDC to start."
      >
        <ApprovedDetails partyId={profile.wallet.partyId} />
      </AuthCard>
    )
  }
  if (application === null) {
    return (
      <AuthCard step="request" width="lg" title="Request access" description="Three quick questions. An admin reviews every request.">
        <ApplicationForm submitLabel="Send request" pendingLabel="Sending…" />
      </AuthCard>
    )
  }
  if (application.status === 'REJECTED') {
    return (
      <AuthCard step="request" width="lg" title="Apply again" description="Check your details and send the request again.">
        <RejectedNotice application={application} />
        <ApplicationForm
          initialValues={{ fullName: application.fullName, country: application.country }}
          submitLabel="Send again"
          pendingLabel="Sending…"
        />
      </AuthCard>
    )
  }
  // PENDING (APPROVED always comes with a wallet, handled above).
  return (
    <AuthCard step="review" width="lg" title="Under review" description="An Exodus admin checks every request.">
      <PendingDetails application={application} />
    </AuthCard>
  )
}
