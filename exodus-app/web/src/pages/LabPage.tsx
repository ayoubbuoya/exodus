import { useState } from 'react'
import { FlaskConicalIcon } from 'lucide-react'
import { DEMO_PARTY_NAMES, type DemoParties, type DemoPartyName } from '@exodus/ledger'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorMessage } from '@/components/ErrorMessage'
import { OracleCard } from '@/components/lab/OracleCard'
import { OracleControls } from '@/components/lab/OracleControls'
import { SendForm } from '@/components/lab/SendForm'
import { SubscribeCard } from '@/components/lab/SubscribeCard'
import { VisibleContracts } from '@/components/lab/VisibleContracts'
import { WalletCard } from '@/components/lab/WalletCard'
import { useDemoParties } from '@/ledger'

// The developer "lab": the original walking skeleton, kept on purpose.
//
// Here you can act as ANY demo party (the local sandbox has no auth) and check
// what each one can see and do. It is our privacy demo for judges, for example
// "switch to Operator: it sees the price index but no one's holdings".
// Real clients use /app instead (docs/client-app.md).
export function LabPage() {
  // Which demo party we are "logged in" as.
  const [selected, setSelected] = useState<DemoPartyName>('Bank')
  const parties = useDemoParties()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <FlaskConicalIcon className="size-4" aria-hidden />
            Lab
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Act as a demo party</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch party to see exactly what each one can see and do on the ledger.
          </p>
        </div>
        <Tabs value={selected} onValueChange={(value) => setSelected(value as DemoPartyName)}>
          <TabsList aria-label="Act as party" className="flex-wrap">
            {DEMO_PARTY_NAMES.map((name) => (
              <TabsTrigger key={name} value={name}>
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {parties.isPending && <LoadingGrid />}
        {parties.isError && (
          <Alert variant="destructive">
            <AlertTitle>Cannot reach the ledger</AlertTitle>
            <AlertDescription>
              <p>
                Start it with <code>npm run ledger</code>, then run <code>npm run bootstrap</code>.
              </p>
              <ErrorMessage error={parties.error} />
            </AlertDescription>
          </Alert>
        )}
        {parties.isSuccess && parties.data === null && (
          <Alert>
            <AlertTitle>Demo parties not found</AlertTitle>
            <AlertDescription>
              The sandbox is running but empty. Run <code>npm run bootstrap</code>.
            </AlertDescription>
          </Alert>
        )}
        {/* key={selected}: a new party gets fresh cards. Without it the Send form would keep the
            previous party's receiver (for example Alice picked as receiver while acting as Alice). */}
        {parties.isSuccess && parties.data !== null && (
          <PartyView key={selected} name={selected} parties={parties.data} />
        )}
      </div>
    </div>
  )
}

type PartyViewProps = {
  name: DemoPartyName
  parties: DemoParties
}

// Everything the selected party can see and do.
function PartyView({ name, parties }: PartyViewProps) {
  const party = parties[name]
  // Only the two "client" parties have access passes, so only they can subscribe or send.
  const canSend = name === 'Alice' || name === 'Bank'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <OracleCard party={party} partyName={name} />
      <WalletCard party={party} partyName={name} priceReader={parties.UsycIssuer} />
      {canSend && <SubscribeCard party={party} usycIssuer={parties.UsycIssuer} />}
      {canSend && <SendForm senderName={name} parties={parties} />}
      {name === 'Oracle' && <OracleControls oracle={party} />}
      <div className="md:col-span-2">
        <VisibleContracts party={party} partyName={name} />
      </div>
    </div>
  )
}

// Grey placeholder cards while we connect to the ledger.
function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Connecting to the ledger">
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64 md:col-span-2" />
    </div>
  )
}
