// A three-step checklist for a brand-new wallet, shown until the client has
// done something beyond receiving tokens:
//   ① Claim 100 test USDC   (the faucet button is right here)
//   ② Subscribe to USYC     (the Subscribe panel next to it)
//   ③ Lock a fixed rate     (the Markets: PT is the product)
// A done step gets a check. Example: Carol claimed the faucet → ① is done and
// ② is the one to do now.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, CheckIcon } from 'lucide-react'
import { cn } from 'cn'
import { useWallet } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FaucetButton } from './FaucetCard.tsx'

// Shown while useIsNewWallet() is true (see AppPage).
export function GetStarted() {
  const wallet = useWallet()
  const hasUsdc = Number(wallet.data?.balances.USDC ?? '0') > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-[22px]">Get started</CardTitle>
        <CardDescription>Three steps from test cash to a fixed rate.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Side by side on wide screens (1 → 2 → 3 reads left to right), stacked on phones. */}
        <ol className="grid gap-3 md:grid-cols-3">
          <Step number={1} done={hasUsdc} current={!hasUsdc} title="Claim 100 test USDC" text="Simulated cash, free, once a day.">
            {!hasUsdc && <FaucetButton bright />}
          </Step>
          <Step
            number={2}
            done={false}
            current={hasUsdc}
            title="Subscribe to USYC"
            text="Pay USDC, get the tokenized T-bill fund share. Its price grows every day: that is the yield."
          />
          <Step number={3} done={false} current={false} title="Lock a fixed rate" text="Split USYC into PT and YT, or buy PT below 1 USD.">
            <Button asChild variant="glass" size="sm" className="justify-self-start">
              <Link to="/markets">
                See the markets
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </Step>
        </ol>
      </CardContent>
    </Card>
  )
}

type StepProps = {
  number: number
  done: boolean
  current: boolean
  title: string
  text: string
  children?: ReactNode
}

function Step({ number, done, current, title, text, children }: StepProps) {
  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={cn(
        'flex gap-4 rounded-2xl p-4 md:flex-col md:gap-3',
        current ? 'bg-foreground/6 ring-1 ring-foreground/10 ring-inset' : 'bg-foreground/2',
      )}
    >
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
          done && 'bg-success/20 text-success',
          current && 'bg-foreground text-background',
          !done && !current && 'text-muted-foreground ring-1 ring-foreground/15 ring-inset',
        )}
      >
        {done ? <CheckIcon className="size-3.5" aria-label="Done" /> : number}
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className={cn('font-medium', done && 'text-muted-foreground line-through decoration-foreground/30')}>{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
        {children !== undefined && <div className="mt-2 grid">{children}</div>}
      </div>
    </li>
  )
}
