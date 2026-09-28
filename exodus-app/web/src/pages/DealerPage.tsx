// /dealer: the house dealer's desk (admins run Bank, decision M1).
//
//   Bank's cash, USYC, live quotes and open requests at a glance
//   left:  open RFQs (quote by hand or decline) and the live quotes
//   right: Bank's inventory per market with its own claim / PT redeem, and
//          the bot's settings
//
// The dealer bot (in the API) answers RFQs by itself while auto-quote is on;
// this page is the human override (decision D2).
import { BanknoteIcon, InboxIcon, LandmarkIcon, TimerIcon } from 'lucide-react'
import { formatAmount } from '@exodus/ledger'
import { useDealerPosition, useDealerRequests, useDealerSettings } from '@/api/market-hooks'
import { DealerInventoryCard, LiveQuotesCard } from '@/components/dealer/DealerPosition'
import { DealerRequestsCard } from '@/components/dealer/DealerRequestsCard'
import { DealerSettingsCard } from '@/components/dealer/DealerSettingsCard'
import { Amount } from '@/components/finance/Amount'
import { StatCard } from '@/components/finance/StatCard'
import { FormError } from '@/components/FormError'
import { Page, PageHeader } from '@/components/layout/Page'
import { StatusChip } from '@/components/StatusChip'

export function DealerPage() {
  const position = useDealerPosition()
  const requests = useDealerRequests()
  const settings = useDealerSettings()

  return (
    <Page>
      <PageHeader
        title="Dealer desk"
        description="Bank, the house dealer, quotes PT privately to clients."
        actions={
          settings.data === undefined ? undefined : settings.data.autoQuote ? (
            <StatusChip tone="success">Bot quoting</StatusChip>
          ) : (
            <StatusChip tone="warning">Manual quoting</StatusChip>
          )
        }
      />
      {position.isError && <FormError error={position.error} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="USDC"
          icon={BanknoteIcon}
          loading={position.data === undefined}
          value={<Amount value={formatAmount(position.data?.usdc ?? '0')} />}
          sub={`${formatAmount(position.data?.usdcSetAside ?? '0')} set aside for sell quotes`}
        />
        <StatCard
          label="USYC"
          icon={LandmarkIcon}
          loading={position.data === undefined}
          value={<Amount value={formatAmount(position.data?.usyc ?? '0')} />}
          sub="Claimed yield and PT redeems"
        />
        <StatCard
          label="Live quotes"
          icon={TimerIcon}
          loading={position.data === undefined}
          value={String(position.data?.liveQuotes.length ?? 0)}
          sub="Firm, waiting for the client"
        />
        <StatCard
          label="Open requests"
          icon={InboxIcon}
          loading={requests.data === undefined}
          value={String(requests.data?.items.length ?? 0)}
          sub="RFQs not answered yet"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-6">
          <DealerRequestsCard />
          <LiveQuotesCard />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <DealerInventoryCard />
          <DealerSettingsCard />
        </div>
      </div>
    </Page>
  )
}
