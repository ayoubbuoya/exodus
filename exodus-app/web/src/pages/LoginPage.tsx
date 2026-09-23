import { Link, useNavigate } from 'react-router'
import { useLogin } from '@/api/hooks'
import { homePathFor } from '@/auth/home-path'
import { AuthCard } from '@/components/auth/AuthCard'
import { CredentialsForm } from '@/components/auth/CredentialsForm'

// Log in, then go where this person belongs: the admin queue, the app, or onboarding.
export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your Exodus account."
      footer={
        <span>
          New here?{' '}
          <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <CredentialsForm
        submitLabel="Log in"
        passwordAutoComplete="current-password"
        isSubmitting={login.isPending}
        error={login.error}
        onSubmit={(credentials) =>
          login.mutate(credentials, {
            onSuccess: (profile) => {
              if (profile !== null) {
                navigate(homePathFor(profile), { replace: true })
              }
            },
          })
        }
      />
    </AuthCard>
  )
}
