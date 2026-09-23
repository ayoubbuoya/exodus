// The test USDC faucet: 100 simulated USDC, once per cooldown (24 h by default).
// While the cooldown runs, it shows a live countdown to the next claim.
import { DropletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatAmount } from '@exodus/ledger'
import { useClaimFaucet, useWallet } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCountdown } from '@/lib/format'
import { useNow } from '@/useNow'

export function FaucetCard() {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DropletIcon className="text-primary" aria-hidden />
          Test USDC faucet
        </CardTitle>
        <CardDescription>Free simulated USDC to try the fund. No real value.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FormError error={claim.error} />
        <Button onClick={handleClaim} disabled={!canClaim || claim.isPending}>
          {claim.isPending ? 'Sending…' : 'Claim 100 test USDC'}
        </Button>
        {!canClaim && nextClaimAt !== null && (
          <p className="text-center text-sm text-muted-foreground">
            Next claim in <span className="num text-foreground">{formatCountdown(secondsLeft)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
