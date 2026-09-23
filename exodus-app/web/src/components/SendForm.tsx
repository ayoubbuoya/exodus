import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DEMO_PARTY_NAMES, sendHoldings, type DemoParties, type DemoPartyName } from '@exodus/ledger'
import { ledger } from '../ledger.ts'
import { ErrorMessage } from './ErrorMessage.tsx'

type SendFormProps = {
  senderName: DemoPartyName
  parties: DemoParties
}

type SendInput = {
  receiverName: DemoPartyName
  instrument: string
  amount: string
}

// Send USYC or USDC through the issuer's CIP-56 TransferFactory.
// Example: Bank sends 100 USYC to Alice.
export function SendForm({ senderName, parties }: SendFormProps) {
  const receivers = DEMO_PARTY_NAMES.filter((name) => name !== senderName)
  const [receiverName, setReceiverName] = useState<DemoPartyName>(senderName === 'Bank' ? 'Alice' : 'Bank')
  const [instrument, setInstrument] = useState(senderName === 'Bank' ? 'USYC' : 'USDC')
  const [amount, setAmount] = useState('')
  const [lastSent, setLastSent] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const send = useMutation({
    mutationFn: (input: SendInput) =>
      sendHoldings(ledger, {
        sender: parties[senderName],
        receiver: parties[input.receiverName],
        instrument: input.instrument,
        amount: input.amount,
      }),
    onSuccess: (_result, input) => {
      setLastSent(`Sent ${input.amount} ${input.instrument} to ${input.receiverName}.`)
      setAmount('')
      // Refresh every query now instead of waiting for the next poll.
      void queryClient.invalidateQueries()
    },
    onError: () => setLastSent(null),
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send.mutate({ receiverName, instrument, amount })
  }

  return (
    <section className="card">
      <h2>Send (CIP-56 TransferFactory)</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          To
          <select value={receiverName} onChange={(event) => setReceiverName(event.target.value as DemoPartyName)}>
            {receivers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Asset
          <select value={instrument} onChange={(event) => setInstrument(event.target.value)}>
            <option value="USYC">USYC</option>
            <option value="USDC">USDC</option>
          </select>
        </label>
        <label>
          Amount
          <input
            inputMode="decimal"
            placeholder="100"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {lastSent !== null && <p className="ok">{lastSent}</p>}
      {send.isError && <ErrorMessage error={send.error} />}
    </section>
  )
}
