import { formatAmount, moduleAndEntity, partyName, type CreatedEvent } from '@exodus/ledger'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useVisibleContracts } from '@/ledger'

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
    <Card>
      <CardHeader>
        <CardTitle>What can {name} see?</CardTitle>
        <CardDescription>Every active contract this party can see on the ledger, of any template.</CardDescription>
      </CardHeader>
      <CardContent>
        {contracts.isPending && <Skeleton className="h-32" />}
        {contracts.isError && <ErrorMessage error={contracts.error} />}
        {contracts.isSuccess && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {name} can see <span className="num text-foreground">{contracts.data.length}</span> active contract
              {contracts.data.length === 1 ? '' : 's'}.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Signed by</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Contract id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...contracts.data].sort(byTemplateName).map((event) => (
                  <TableRow key={event.contractId} className="align-top">
                    <TableCell>
                      <Badge variant="secondary">{moduleAndEntity(event.templateId)}</Badge>
                    </TableCell>
                    <TableCell>{event.signatories.map(partyName).join(', ')}</TableCell>
                    {/* Fields can be long: let them wrap instead of widening the table. */}
                    <TableCell className="max-w-md text-xs break-words whitespace-normal text-muted-foreground">
                      {summarizeFields(event.createArgument)}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs">{event.contractId.slice(0, 10)}…</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
