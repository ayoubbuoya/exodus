// Send USYC or USDC to another approved client, by their party id.
// Opened from a token's "Send" button in Holdings (that token is preselected).
//
// It is a CIP-56 transfer: the issuer's transfer factory checks that BOTH the
// sender and the receiver hold an access pass, so sending to anyone else fails
// with "The receiver is not an approved Exodus client".
import { useState, type FormEvent } from 'react'
import { formatAmount } from '@exodus/ledger'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useSendTokens, useWallet } from '@/api/hooks'
import type { Instrument } from '@/api/types'
import { AmountInput } from '@/components/finance/AmountInput'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isPositiveAmount, trimZeros } from '@/lib/amount'

const INSTRUMENTS: Instrument[] = ['USYC', 'USDC']

type SendDialogProps = {
  // The token to send; null = the dialog is closed.
  instrument: Instrument | null
  onClose: () => void
}

export function SendDialog({ instrument, onClose }: SendDialogProps) {
  return (
    <Dialog open={instrument !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {/* `key`: a fresh form (empty fields, no old error) each time it opens. */}
        {instrument !== null && <SendForm key={instrument} initialInstrument={instrument} onSent={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function SendForm({ initialInstrument, onSent }: { initialInstrument: Instrument; onSent: () => void }) {
  const [receiverPartyId, setReceiverPartyId] = useState('')
  const [instrument, setInstrument] = useState<Instrument>(initialInstrument)
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
          onSent()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="font-display text-[22px] font-medium">Send {instrument}</DialogTitle>
        <DialogDescription>To another approved client. Ask them for their party id.</DialogDescription>
      </DialogHeader>

      <Tabs value={instrument} onValueChange={(value) => setInstrument(value as Instrument)}>
        <TabsList className="w-full" aria-label="Token">
          {INSTRUMENTS.map((option) => (
            <TabsTrigger key={option} value={option}>
              {option}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Field data-invalid={receiverError !== undefined}>
        <FieldLabel htmlFor="send-receiver">Receiver party id</FieldLabel>
        <Input
          id="send-receiver"
          className="ident"
          placeholder="client-…::1220…"
          autoComplete="off"
          spellCheck={false}
          value={receiverPartyId}
          onChange={(event) => setReceiverPartyId(event.target.value.trim())}
          aria-invalid={receiverError !== undefined}
        />
        <FieldDescription>They find it on their own Wallet page, under Holdings.</FieldDescription>
        {receiverError !== undefined && <FieldError>{receiverError}</FieldError>}
      </Field>

      <div className="grid gap-2">
        <AmountInput
          id="send-amount"
          label="Amount"
          unit={instrument}
          value={amount}
          onChange={setAmount}
          balance={balance}
          onMax={() => setAmount(Number(balance) > 0 ? trimZeros(balance) : '')}
          invalid={amountError !== undefined}
        />
        {amountError !== undefined && <FieldError>{amountError}</FieldError>}
      </div>

      <FormError error={send.error} />
      <Button type="submit" variant="bright" size="lg" disabled={!canSend}>
        {send.isPending ? 'Sending…' : `Send ${instrument}`}
      </Button>
    </form>
  )
}
