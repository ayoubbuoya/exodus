import { isStaleContractError } from '@exodus/ledger'

type ErrorMessageProps = {
  error: unknown
}

// Shows a ledger error. For the "stale contract" case we add a plain-English hint,
// because that is the race this skeleton is built to surface.
export function ErrorMessage({ error }: ErrorMessageProps) {
  const text = error instanceof Error ? error.message : String(error)
  return (
    <div className="error" role="alert">
      {isStaleContractError(error) && (
        <p>
          <strong>Stale contract:</strong> someone changed or archived this contract after we read it (for example,
          the oracle bot published a new RateIndex). Try again.
        </p>
      )}
      <pre>{text}</pre>
    </div>
  )
}
