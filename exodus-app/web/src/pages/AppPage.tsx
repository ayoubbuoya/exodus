// /app: the approved client's dashboard, in the style of the real USYC app.
//
//   price strip (price, APY, demo date, live)
//   chart                          | Subscribe / Redeem
//   holdings                       | faucet
//   activity                       | send
//
// Every card loads and refreshes on its own (React Query), so a slow ledger
// call only greys out its own card. "USYC" and "USDC" are simulated tokens.
import { ActivityCard } from '@/components/app/ActivityCard'
import { FaucetCard } from '@/components/app/FaucetCard'
import { HoldingsCard } from '@/components/app/HoldingsCard'
import { PriceChart } from '@/components/app/PriceChart'
import { PriceStrip } from '@/components/app/PriceStrip'
import { SendCard } from '@/components/app/SendCard'
import { SubscribePanel } from '@/components/app/SubscribePanel'

export function AppPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulated USYC</h1>
        <p className="text-sm text-muted-foreground">
          A tokenized T-bill money market fund on Canton. Test tokens only, not issued by Circle or Hashnote.
        </p>
      </div>

      <PriceStrip />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* On phones the action column (subscribe, faucet, send) comes first, right under the price. */}
        <div className="order-2 flex flex-col gap-6 lg:order-1 lg:col-span-2">
          <PriceChart />
          <HoldingsCard />
          <ActivityCard />
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <SubscribePanel />
          <FaucetCard />
          <SendCard />
        </div>
      </div>
    </div>
  )
}
