import type { ReactNode } from 'react'
import { OnboardingSteps, type OnboardingStep } from '@/components/onboarding/OnboardingSteps'

type AuthCardProps = {
  title: string
  description: string
  children: ReactNode
  // The "Already have an account? Log in" line under the panel.
  footer?: ReactNode
  // Where this screen sits in the journey to a wallet (see OnboardingSteps).
  // Left out on the login page: a returning client is not "on step 1".
  step?: OnboardingStep
  // "md" for the short forms (sign-up, login), "lg" for onboarding.
  width?: 'md' | 'lg'
}

// The centred glass panel of the sign-up, login and onboarding screens:
// the journey line, then one panel with a title (the page's h1), one short
// line and the form. The footer link sits under the panel, outside the glass.
export function AuthCard({ title, description, children, footer, step, width = 'md' }: AuthCardProps) {
  return (
    <div className={width === 'md' ? 'mx-auto w-full max-w-md' : 'mx-auto w-full max-w-xl'}>
      {step !== undefined && <OnboardingSteps current={step} />}
      <section aria-labelledby="auth-title" className="glass glass-sheen rounded-2xl p-6 sm:p-8">
        <h1 id="auth-title" className="font-display text-[28px] leading-tight sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
      {footer !== undefined && <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>}
    </div>
  )
}
