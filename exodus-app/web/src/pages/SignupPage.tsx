import { Link, useNavigate } from 'react-router'
import { useSignup } from '@/api/hooks'
import { AuthCard } from '@/components/auth/AuthCard'
import { CredentialsForm } from '@/components/auth/CredentialsForm'

// Step 1 of onboarding: create an account. The API logs the new user in right
// away, so we go straight to the access form.
export function SignupPage() {
  const signup = useSignup()
  const navigate = useNavigate()

  return (
    <AuthCard
      step="account"
      title="Create your account"
      description="Then request access to simulated USYC and the markets."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <CredentialsForm
        submitLabel="Create account"
        pendingLabel="Creating account…"
        passwordAutoComplete="new-password"
        passwordHint="At least 10 characters. A few random words make a strong, easy-to-remember password."
        isSubmitting={signup.isPending}
        error={signup.error}
        onSubmit={(credentials) => signup.mutate(credentials, { onSuccess: () => navigate('/onboarding') })}
      />
    </AuthCard>
  )
}
