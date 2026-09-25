// "Mint / Redeem", like Pendle's Mint page:
//   Mint:   USYC in, PT + YT out (a split on the ledger), in one transaction.
//           Example at index 1.025: 1000 USYC -> 1025 PT + 1025 YT.
//   Redeem: PT + YT back into USYC before maturity (a merge on the ledger).
//           The Operator pays amount / lastIndex USYC a few seconds later.
//           Example: 100 PT + 100 YT with lastIndex 1.025 -> 97.560975 USYC.
// After maturity, PT and YT are paid out on their own (the other two tabs).
import { useState, type FormEvent } from 'react'
import { formatAmount, previewMerge, previewSplit } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useWallet } from '@/api/hooks'
import { useMerge, usePortfolio, useSplit } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isTokenAmount, trimZeros } from '@/lib/amount'
import { mergeLastIndex } from '@/lib/markets'

export function MintPanel({ market }: { market: MarketView }) {
  // No new PT/YT, and no merge, once the market has reached maturity.
  const closed = market.matured || market.daysToMaturity === 0
  return (
    <div className="flex flex-col gap-6">
      {closed && (
        <p className="text-sm text-muted-foreground">
          This market has reached maturity: minting and redeeming PT + YT together are closed. Redeem your PT and make
          the final YT claim in the other tabs.
        </p>
      )}
      <Tabs defaultValue="mint">
        <TabsList className="w-full" aria-label="Mint or redeem">
          <TabsTrigger value="mint">Mint PT + YT</TabsTrigger>
          <TabsTrigger value="redeem">Redeem PT + YT</TabsTrigger>
        </TabsList>
        <TabsContent value="mint" className="pt-4">
          <MintForm market={market} closed={closed} />
        </TabsContent>
        <TabsContent value="redeem" className="pt-4">
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
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={amountError !== undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="mint-amount">USYC to split</FieldLabel>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setUsycAmount(trimZeros(usycBalance))}>
              Max: <span className="num">{formatAmount(usycBalance)} USYC</span>
            </button>
          </div>
          <Input
            id="mint-amount"
            className="num text-lg"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={usycAmount}
            onChange={(event) => setUsycAmount(event.target.value.trim())}
            aria-invalid={amountError !== undefined}
          />
          <FieldDescription>
            {preview === null ? (
              'You get USYC amount × index of each token. Get USYC on the Wallet page.'
            ) : (
              <>
                You get <span className="num text-foreground">{formatAmount(preview)} PT</span> +{' '}
                <span className="num text-foreground">{formatAmount(preview)} YT</span> at index{' '}
                <span className="num">{formatAmount(market.currentIndex, 4)}</span> (split on the ledger, rounded down
                to 6 decimals).
              </>
            )}
          </FieldDescription>
          {amountError !== undefined && <FieldError>{amountError}</FieldError>}
        </Field>
        <FormError error={split.error} />
        {!market.priceIsLive && <p className="text-sm text-warning">The price feed is paused. Try again soon.</p>}
        <Button type="submit" size="lg" disabled={closed || !market.priceIsLive || !isTokenAmount(usycAmount) || split.isPending}>
          {split.isPending ? 'Minting…' : 'Mint PT + YT'}
        </Button>
      </FieldGroup>
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
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={amountError !== undefined}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="merge-amount">PT and YT to redeem (each)</FieldLabel>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setAmount(trimZeros(maxAmount))}>
              Max: <span className="num">{formatAmount(maxAmount)}</span>
            </button>
          </div>
          <Input
            id="merge-amount"
            className="num text-lg"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value.trim())}
            aria-invalid={amountError !== undefined}
          />
          <FieldDescription>
            {preview !== null && lastIndex !== null ? (
              <>
                You get <span className="num text-foreground">{formatAmount(preview)} USYC</span> ({formatAmount(amount)}{' '}
                ÷ lastIndex <span className="num">{formatAmount(lastIndex, 4)}</span>), paid by the Operator in a few
                seconds.
              </>
            ) : isTokenAmount(amount) && ytPieces.length > 0 ? (
              'Not enough YT in one piece: claim your yield first, so all your YT share the same lastIndex.'
            ) : (
              'Needs the same amount of PT and YT. You get amount ÷ lastIndex USYC (the PT plus its unclaimed yield).'
            )}
          </FieldDescription>
          {amountError !== undefined && <FieldError>{amountError}</FieldError>}
        </Field>
        <FormError error={merge.error} />
        <Button type="submit" size="lg" disabled={closed || !market.priceIsLive || preview === null || merge.isPending}>
          {merge.isPending ? 'Requesting…' : 'Redeem PT + YT'}
        </Button>
      </FieldGroup>
    </form>
  )
}
