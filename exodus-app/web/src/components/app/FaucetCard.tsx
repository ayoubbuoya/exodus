// The test USDC faucet: 100 simulated USDC, once per cooldown (24 h by default).
// While the cooldown runs, it shows a live countdown to the next claim.
//
// FaucetButton is also the first step of the "Get started" checklist, so a
// new client can claim right where the checklist says to.
import { DropletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatAmount } from '@exodus/ledger'
import { useClaimFaucet, useWallet } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCountdown } from '@/lib/format'
import { useNow } from '@/useNow'

// `bright`: the page's main action (a new, empty wallet); otherwise a quiet
// glass button, so it does not compete with Subscribe.
export function FaucetButton({ bright = false }: { bright?: boolean }) {
  const wallet = useWallet()
  const claim = useClaimFaucet()
  const now = useNow(1000)

  const nextClaimAt = wallet.data?.nextFaucetClaimAt ?? null
  const secondsLeft = nextClaimAt === null ? 0 : (Date.parse(nextClaimAt) - now) / 1000
  const canClaim = wallet.data !== undefined && secondsLeft <= 0

  function handleClaim() {
    claim.mutate(undefined, {
      onSuccess: (result) => toast.success(`${formatAmount(result.amount)} test USDC added to your wallet.`),
    })
  }

  return (
    <div className="grid gap-3">
      <FormError error={claim.error} />
      <Button variant={bright ? 'bright' : 'glass'} onClick={handleClaim} disabled={!canClaim || claim.isPending}>
        <DropletIcon data-icon="inline-start" />
        {claim.isPending ? 'Sending…' : 'Claim 100 test USDC'}
      </Button>
      {!canClaim && nextClaimAt !== null && (
        <p className="text-center text-xs text-muted-foreground">
          Next claim in <span className="num text-foreground">{formatCountdown(secondsLeft)}</span>
        </p>
      )}
    </div>
  )
}

export function FaucetCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Test USDC</CardTitle>
        <CardDescription>Free simulated USDC to try the fund. No real value.</CardDescription>
      </CardHeader>
      <CardContent>
        <FaucetButton />
      </CardContent>
    </Card>
  )
}
