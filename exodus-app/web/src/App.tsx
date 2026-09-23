import { useState } from 'react'
import { DEMO_PARTY_NAMES, type DemoParties, type DemoPartyName } from '@exodus/ledger'
import { useDemoParties } from './ledger.ts'
import { ErrorMessage } from './components/ErrorMessage.tsx'
import { OracleCard } from './components/OracleCard.tsx'
import { OracleControls } from './components/OracleControls.tsx'
import { SendForm } from './components/SendForm.tsx'
import { SubscribeCard } from './components/SubscribeCard.tsx'
import { VisibleContracts } from './components/VisibleContracts.tsx'
import { WalletCard } from './components/WalletCard.tsx'

export default function App() {
  // Which demo party we are "logged in" as. The sandbox has no auth, so we can
  // switch freely. This is how we check what each party can and cannot see.
  const [selected, setSelected] = useState<DemoPartyName>('Bank')
  const parties = useDemoParties()

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>Exodus</h1>
          <span className="tag">walking skeleton</span>
        </div>
        <nav className="party-switcher" aria-label="Act as party">
          {DEMO_PARTY_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={name === selected ? 'party active' : 'party'}
              onClick={() => setSelected(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      <p className="notice">
        Simulation: "USYC" and "USDC" are demo tokens issued by the UsycIssuer and UsdcIssuer demo parties. They are
        not issued by, connected to, or endorsed by Circle.
      </p>

      {parties.isPending && <p className="muted">Connecting to the ledger…</p>}
      {parties.isError && (
        <div className="card">
          <h2>Cannot reach the ledger</h2>
          <p>
            Start it with <code>npm run ledger</code>, then run <code>npm run bootstrap</code>.
          </p>
          <ErrorMessage error={parties.error} />
        </div>
      )}
      {parties.isSuccess && parties.data === null && (
        <div className="card">
          <h2>Demo parties not found</h2>
          <p>
            The sandbox is running but empty. Run <code>npm run bootstrap</code>.
          </p>
        </div>
      )}
      {parties.isSuccess && parties.data !== null && <PartyView name={selected} parties={parties.data} />}
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
  const canSend = name === 'Alice' || name === 'Bank'

  return (
    <main className="grid">
      <OracleCard party={party} partyName={name} />
      <WalletCard party={party} partyName={name} />
      {canSend && <SubscribeCard party={party} />}
      {canSend && <SendForm senderName={name} parties={parties} />}
      {name === 'Oracle' && <OracleControls oracle={party} />}
      <VisibleContracts party={party} partyName={name} />
    </main>
  )
}
