// /dealer: the house dealer's desk (admins run Bank, decision M1).
//
//   left:  open RFQs (quote by hand or decline) and the bot's settings
//   right: Bank's position, live quotes, and Bank's own claim / PT redeem
//
// The dealer bot (in the API) answers RFQs by itself while auto-quote is on;
// this page is the human override (decision D2).
import { DealerPositionCard } from '@/components/dealer/DealerPositionCard'
import { DealerRequestsCard } from '@/components/dealer/DealerRequestsCard'
import { DealerSettingsCard } from '@/components/dealer/DealerSettingsCard'

export function DealerPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dealer desk</h1>
        <p className="text-sm text-muted-foreground">
          The house dealer (Bank) quotes PT privately to clients. The bot quotes by itself; override it here.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DealerRequestsCard />
          <DealerSettingsCard />
        </div>
        <DealerPositionCard />
      </div>
    </div>
  )
}
