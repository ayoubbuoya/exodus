import { formatAmount, moduleAndEntity, partyName, type CreatedEvent } from '@exodus/ledger'
import { useVisibleContracts } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type VisibleContractsProps = {
  party: string
  partyName: string
}

// Makes one field value short and readable:
//   "Bank::1220ab..."   -> "Bank"
//   "1000.0000000000"   -> "1,000"
//   ["Alice::..", "Bank::.."] -> "[Alice, Bank]"
function formatField(value: unknown): string {
  if (typeof value === 'string') {
    if (value.includes('::')) {
      return partyName(value)
    }
    if (/^\d+\.\d+$/.test(value)) {
      return formatAmount(value)
    }
    return value
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatField).join(', ')}]`
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}

// "issuer: UsycIssuer, owner: Bank, instrument: USYC, amount: 1,000"
function summarizeFields(createArgument: unknown): string {
  if (typeof createArgument !== 'object' || createArgument === null) {
    return String(createArgument)
  }
  return Object.entries(createArgument)
    .map(([key, value]) => `${key}: ${formatField(value)}`)
    .join(', ')
}

function byTemplateName(a: CreatedEvent, b: CreatedEvent): number {
  return moduleAndEntity(a.templateId).localeCompare(moduleAndEntity(b.templateId))
}

// Privacy check: EVERY active contract this party can see, of any template.
// Example: the Operator should see the RateIndex, but no Holding of Alice or Bank.
export function VisibleContracts({ party, partyName: name }: VisibleContractsProps) {
  const contracts = useVisibleContracts(party)

  return (
    <section className="card wide">
      <h2>What can {name} see?</h2>
      {contracts.isPending && <p className="muted">Loading…</p>}
      {contracts.isError && <ErrorMessage error={contracts.error} />}
      {contracts.isSuccess && (
        <>
          <p className="muted">
            {name} can see {contracts.data.length} active contract{contracts.data.length === 1 ? '' : 's'}.
          </p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Signed by</th>
                  <th>Fields</th>
                  <th>Contract id</th>
                </tr>
              </thead>
              <tbody>
                {[...contracts.data].sort(byTemplateName).map((event) => (
                  <tr key={event.contractId}>
                    <td>{moduleAndEntity(event.templateId)}</td>
                    <td>{event.signatories.map(partyName).join(', ')}</td>
                    <td className="fields">{summarizeFields(event.createArgument)}</td>
                    <td>
                      <code>{event.contractId.slice(0, 10)}…</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
