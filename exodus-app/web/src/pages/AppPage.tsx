// /app: the approved client's Wallet, the simulated USYC fund (the on-ramp).
//
//   Get started (only for a new wallet: faucet → subscribe → markets)
//   Wallet value · USYC · USDC · Fund yield
//   price chart                    | Subscribe / Redeem
//   holdings (with Send)           | test USDC faucet
//   activity                       |
//
// Every panel loads and refreshes on its own (React Query), so a slow ledger
// call only greys out its own panel. "USYC" and "USDC" are simulated tokens.
import { ActivityCard } from '@/components/app/ActivityCard'
import { FaucetCard } from '@/components/app/FaucetCard'
import { GetStarted } from '@/components/app/GetStarted'
import { HoldingsCard } from '@/components/app/HoldingsCard'
import { PriceChart } from '@/components/app/PriceChart'
import { SubscribePanel } from '@/components/app/SubscribePanel'
import { useIsNewWallet } from '@/components/app/useIsNewWallet'
import { WalletSummary } from '@/components/app/WalletSummary'
import { Page, PageHeader } from '@/components/layout/Page'

export function AppPage() {
  // null while loading: show neither the checklist nor the faucet card yet.
  const isNewWallet = useIsNewWallet()

  return (
    <Page>
      <PageHeader title="Wallet" description="Simulated USYC and USDC in your Canton wallet." />
      {isNewWallet === true && <GetStarted />}
      <WalletSummary />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* On phones the actions come first, right under the numbers. */}
        <div className="order-2 grid min-w-0 content-start gap-6 lg:order-1">
          <PriceChart />
          <HoldingsCard />
          <ActivityCard />
        </div>
        <div className="order-1 grid min-w-0 content-start gap-6 lg:order-2">
          <SubscribePanel />
          {/* A new wallet claims from the checklist above instead. */}
          {isNewWallet === false && <FaucetCard />}
        </div>
      </div>
    </Page>
  )
}
