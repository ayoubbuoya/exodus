// Send USYC or USDC to another approved client, by their party id.
// It is a CIP-56 transfer: the issuer's transfer factory checks that BOTH the
// sender and the receiver hold an access pass, so sending to anyone else fails
// with "The receiver is not an approved Exodus client".
import { useState, type FormEvent } from 'react'
import { formatAmount } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useSendTokens, useWallet } from '@/api/hooks'
import type { Instrument } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isPositiveAmount, trimZeros } from '@/lib/amount'

const INSTRUMENTS: Instrument[] = ['USYC', 'USDC']

export function SendCard() {
  const [receiverPartyId, setReceiverPartyId] = useState('')
  const [instrument, setInstrument] = useState<Instrument>('USYC')
  const [amount, setAmount] = useState('')
  const wallet = useWallet()
  const send = useSendTokens()

  const balance = wallet.data?.balances[instrument] ?? '0'
  const receiverError = fieldErrorOf(send.error, 'receiverPartyId')
  const amountError = fieldErrorOf(send.error, 'amount')
  const canSend = receiverPartyId !== '' && isPositiveAmount(amount) && !send.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send.mutate(
      { receiverPartyId, instrument, amount },
      {
        onSuccess: () => {
          toast.success(`Sent ${formatAmount(amount)} ${instrument}.`)
          setAmount('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send</CardTitle>
        <CardDescription>To another approved client. Ask them for their party id.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={receiverError !== undefined}>
              <FieldLabel htmlFor="send-receiver">Receiver party id</FieldLabel>
              <Input
                id="send-receiver"
                className="font-mono text-xs"
                placeholder="client-…::1220…"
                autoComplete="off"
                spellCheck={false}
                value={receiverPartyId}
                onChange={(event) => setReceiverPartyId(event.target.value.trim())}
                aria-invalid={receiverError !== undefined}
              />
              {receiverError !== undefined && <FieldError>{receiverError}</FieldError>}
            </Field>

            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Field>
                <FieldLabel htmlFor="send-instrument">Token</FieldLabel>
                <Select value={instrument} onValueChange={(value) => setInstrument(value as Instrument)}>
                  <SelectTrigger id="send-instrument">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={amountError !== undefined}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="send-amount">Amount</FieldLabel>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAmount(Number(balance) > 0 ? trimZeros(balance) : '')}
                  >
                    Max: <span className="num">{formatAmount(balance)}</span>
                  </button>
                </div>
                <Input
                  id="send-amount"
                  className="num"
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.trim())}
                  aria-invalid={amountError !== undefined}
                />
                {amountError !== undefined && <FieldError>{amountError}</FieldError>}
              </Field>
            </div>

            <FormError error={send.error} />
            <Button type="submit" variant="outline" disabled={!canSend}>
              {send.isPending ? 'Sending…' : `Send ${instrument}`}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
