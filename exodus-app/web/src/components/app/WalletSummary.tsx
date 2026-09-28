// The four headline numbers at the top of the Wallet:
//   Wallet value · USYC · USDC · Fund yield (30-day APY)
// Example at price 1.0125: 400 USYC + 60 USDC -> $465.00 in total.
//
// The demo date and the "Live" feed status are in the sidebar clock, so they
// are not repeated here.
import { BanknoteIcon, LandmarkIcon, SparklesIcon, WalletIcon } from 'lucide-react'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useLatestPrice, useWallet } from '@/api/hooks'
import { Amount } from '@/components/finance/Amount'
import { StatCard } from '@/components/finance/StatCard'
import { formatPercent } from '@/lib/format'

export function WalletSummary() {
  const wallet = useWallet()
  const price = useLatestPrice()

  const usyc = wallet.data?.balances.USYC ?? '0'
  const usdc = wallet.data?.balances.USDC ?? '0'
  const index = price.data?.index ?? null
  // USD value of the USYC: amount × price. Unknown (null) until the price loads,
  // so we show a grey block rather than a wrong $0.
  const usycUsd = index === null ? null : Number(usyc) * Number(index)
  const totalUsd = usycUsd === null ? null : usycUsd + Number(usdc)
  const loadingWallet = wallet.data === undefined

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Wallet value"
        icon={WalletIcon}
        loading={loadingWallet || totalUsd === null}
        value={<Amount value={`$${formatUsd(totalUsd ?? 0)}`} />}
        sub="USYC and USDC, in USD"
      />
      <StatCard
        label="USYC"
        icon={LandmarkIcon}
        loading={loadingWallet}
        value={<Amount value={formatAmount(usyc)} />}
        sub={usycUsd === null ? 'Simulated fund share' : `≈ $${formatUsd(usycUsd)}`}
      />
      <StatCard
        label="USDC"
        icon={BanknoteIcon}
        loading={loadingWallet}
        value={<Amount value={formatAmount(usdc)} />}
        sub="Simulated cash"
      />
      {/* The fund's floating yield: the yield blue. "—" until 7 demo days of history. */}
      <StatCard
        label="Fund yield"
        icon={SparklesIcon}
        tone="yield"
        loading={price.data === undefined}
        value={formatPercent(price.data?.apy30dPercent ?? null)}
        sub="APY over the last 30 demo days"
      />
    </div>
  )
}
