import { isStaleContractError } from '@exodus/ledger'

type ErrorMessageProps = {
  error: unknown
}

// Shows a ledger error. For the "stale contract" case we add a plain-English hint,
// because that is the race the walking skeleton was built to surface.
export function ErrorMessage({ error }: ErrorMessageProps) {
  const text = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {isStaleContractError(error) && (
        <p className="mb-1">
          <strong>Stale contract:</strong> someone changed or archived this contract after we read it (for example,
          the oracle bot published a new RateIndex). Try again.
        </p>
      )}
      <pre className="font-mono text-xs break-words whitespace-pre-wrap">{text}</pre>
    </div>
  )
}
