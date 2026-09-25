// Where a new client is in the journey, shown above the sign-up, login and
// onboarding panels:
//   ① Account  ─  ② Access request  ─  ③ Review  ─  ④ Wallet
// Done steps get a check, the current one is bright, later ones are dim.
// Example: Dave sent his form and waits for an admin → current = "review".
import { CheckIcon } from 'lucide-react'
import { cn } from 'cn'

export type OnboardingStep = 'account' | 'request' | 'review' | 'wallet' | 'done'

const STEPS: { id: Exclude<OnboardingStep, 'done'>; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'request', label: 'Access request' },
  { id: 'review', label: 'Review' },
  { id: 'wallet', label: 'Wallet' },
]

export function OnboardingSteps({ current }: { current: OnboardingStep }) {
  // "done" = every step finished (the wallet is ready).
  const currentIndex = current === 'done' ? STEPS.length : STEPS.findIndex((step) => step.id === current)

  return (
    <ol aria-label="Your way to a wallet" className="mb-6 flex items-center gap-2 text-xs">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <li key={step.id} className={cn('flex items-center gap-2', index > 0 && 'flex-1')}>
            {/* The line joining this step to the one before it. */}
            {index > 0 && <span aria-hidden className={cn('h-px min-w-3 flex-1', isDone || isCurrent ? 'bg-foreground/30' : 'bg-foreground/10')} />}
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap',
                isCurrent ? 'text-foreground' : isDone ? 'text-muted-foreground' : 'text-faint',
              )}
            >
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
                  isDone && 'bg-foreground/15 text-foreground',
                  isCurrent && 'bg-foreground text-background',
                  !isDone && !isCurrent && 'ring-1 ring-foreground/15 ring-inset',
                )}
              >
                {isDone ? <CheckIcon className="size-3" aria-hidden /> : index + 1}
              </span>
              {/* Phones show only the current step's name, so the line fits.
                  (max-sm:sr-only rather than sr-only + sm:not-sr-only: the
                  latter resets white-space and the names would wrap.) */}
              <span className={cn(!isCurrent && 'max-sm:sr-only')}>
                {step.label}
                {isDone && <span className="sr-only"> (done)</span>}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
