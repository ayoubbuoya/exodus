// "Mint / Redeem", like Pendle's Mint page:
//   Mint:   USYC in, PT + YT out (a split on the ledger), in one transaction.
//           Example at index 1.025: 1000 USYC -> 1025 PT + 1025 YT.
//   Redeem: PT + YT back into USYC before maturity (a merge on the ledger).
//           The Operator pays amount / lastIndex USYC a few seconds later.
//           Example: 100 PT + 100 YT with lastIndex 1.025 -> 97.560975 USYC.
// After maturity, PT and YT are paid out on their own (the other two tabs).
import { useState, type FormEvent } from 'react'
import { InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { formatAmount, previewMerge, previewSplit } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useWallet } from '@/api/hooks'
import { useMerge, usePortfolio, useSplit } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { AmountInput } from '@/components/finance/AmountInput'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { TokenOutput } from '@/components/markets/TokenOutput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isTokenAmount, trimZeros } from '@/lib/amount'
import { mergeLastIndex } from '@/lib/markets'

export function MintPanel({ market }: { market: MarketView }) {
  // No new PT/YT, and no merge, once the market has reached maturity.
  const closed = market.matured || market.daysToMaturity === 0
  return (
    <div className="grid gap-5">
      {closed && (
        <Alert variant="info">
          <InfoIcon />
          <AlertDescription>
            This market has reached maturity: minting and redeeming PT + YT together are closed. Redeem your PT and make
            the final YT claim in the other tabs.
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="mint">
        <TabsList className="w-full" aria-label="Mint or redeem">
          <TabsTrigger value="mint">Mint PT + YT</TabsTrigger>
          <TabsTrigger value="redeem">Redeem PT + YT</TabsTrigger>
        </TabsList>
        <TabsContent value="mint" className="pt-3">
          <MintForm market={market} closed={closed} />
        </TabsContent>
        <TabsContent value="redeem" className="pt-3">
          <MergeForm market={market} closed={closed} />
        </TabsContent>
      </Tabs>
      <OpenRequests marketId={market.marketId} />
    </div>
  )
}

function MintForm({ market, closed }: { market: MarketView; closed: boolean }) {
  const [usycAmount, setUsycAmount] = useState('')
  const wallet = useWallet()
  const split = useSplit(market.marketId)
  const usycBalance = wallet.data?.balances.USYC ?? '0'
  const preview = isTokenAmount(usycAmount) ? previewSplit(usycAmount, market.currentIndex) : null
  const amountError = fieldErrorOf(split.error, 'usycAmount')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    split.mutate(usycAmount, {
      onSuccess: () => {
        toast.success(`Minted ${formatAmount(preview ?? '0')} PT + YT from ${formatAmount(usycAmount)} USYC.`)
        setUsycAmount('')
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <AmountInput
        id="mint-amount"
        label="You split"
        unit="USYC"
        value={usycAmount}
        onChange={setUsycAmount}
        balance={usycBalance}
        onMax={() => setUsycAmount(trimZeros(usycBalance))}
        invalid={amountError !== undefined}
        disabled={closed}
      />
      {amountError !== undefined && <FieldError>{amountError}</FieldError>}
      <TokenOutput
        title="You get"
        lines={[
          { symbol: market.symbols.pt, amount: preview },
          { symbol: market.symbols.yt, amount: preview },
        ]}
        note={`USYC × index ${formatAmount(market.currentIndex, 4)} of each, split on the ledger, rounded down to 6 decimals. Get USYC on the Wallet page.`}
      />
      <FormError error={split.error} />
      {!market.priceIsLive && <PausedNotice />}
      <Button
        type="submit"
        variant="bright"
        size="lg"
        disabled={closed || !market.priceIsLive || !isTokenAmount(usycAmount) || split.isPending}
      >
        {split.isPending ? 'Minting…' : 'Mint PT + YT'}
      </Button>
    </form>
  )
}

function MergeForm({ market, closed }: { market: MarketView; closed: boolean }) {
  const [amount, setAmount] = useState('')
  const portfolio = usePortfolio()
  const merge = useMerge(market.marketId)
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const ptFree = position?.ptFree ?? '0'
  const ytPieces = position?.ytPieces ?? []
  // The exact payout needs the lastIndex of the YT the merge will use.
  const lastIndex = isTokenAmount(amount) ? mergeLastIndex(ytPieces, amount) : null
  const preview = lastIndex === null ? null : previewMerge(amount, lastIndex)
  const amountError = fieldErrorOf(merge.error, 'amount')
  // The most you can merge: your free PT or your YT, whichever is smaller.
  const maxAmount = Number(ptFree) < Number(position?.ytTotal ?? '0') ? ptFree : (position?.ytTotal ?? '0')
  // A valid amount that no single group of YT can cover (different lastIndex).
  const needsClaimFirst = isTokenAmount(amount) && ytPieces.length > 0 && lastIndex === null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    merge.mutate(amount, {
      onSuccess: () => {
        toast.success(`Redeem of ${formatAmount(amount)} PT + YT requested. The USYC arrives in a few seconds.`)
        setAmount('')
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <AmountInput
        id="merge-amount"
        label="PT and YT to redeem (each)"
        unit="PT + YT"
        value={amount}
        onChange={setAmount}
        balance={maxAmount}
        balanceUnit="each"
        onMax={() => setAmount(trimZeros(maxAmount))}
        invalid={amountError !== undefined}
        disabled={closed}
      />
      {amountError !== undefined && <FieldError>{amountError}</FieldError>}
      <TokenOutput
        title="You get about"
        lines={[{ symbol: 'USYC', amount: preview }]}
        note={
          lastIndex === null
            ? 'amount ÷ lastIndex USYC: the PT plus its unclaimed yield. Paid by the Operator in a few seconds.'
            : `${formatAmount(amount)} ÷ lastIndex ${formatAmount(lastIndex, 4)}, paid by the Operator in a few seconds.`
        }
      />
      {needsClaimFirst && (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>
            Not enough YT in one piece: claim your yield first (Yield tab), so all your YT share the same lastIndex.
          </AlertDescription>
        </Alert>
      )}
      <FormError error={merge.error} />
      {!market.priceIsLive && <PausedNotice />}
      <Button type="submit" variant="bright" size="lg" disabled={closed || !market.priceIsLive || preview === null || merge.isPending}>
        {merge.isPending ? 'Requesting…' : 'Redeem PT + YT'}
      </Button>
    </form>
  )
}

function PausedNotice() {
  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertDescription>The price feed is paused (the oracle bot is not running). Try again soon.</AlertDescription>
    </Alert>
  )
}
