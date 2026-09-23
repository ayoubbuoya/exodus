import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import { DEMO_PARTY_NAMES, sendHoldings, type DemoParties, type DemoPartyName } from '@exodus/ledger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorMessage } from '@/components/ErrorMessage'
import { ledger } from '@/ledger'

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
      toast.success(`Sent ${input.amount} ${input.instrument} to ${input.receiverName}.`)
      setAmount('')
      // Refresh every query now instead of waiting for the next poll.
      void queryClient.invalidateQueries()
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send.mutate({ receiverName, instrument, amount })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send</CardTitle>
        <CardDescription>Through the issuer's CIP-56 TransferFactory, like any Canton wallet.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="send-to">To</Label>
              <Select value={receiverName} onValueChange={(value) => setReceiverName(value as DemoPartyName)}>
                <SelectTrigger id="send-to" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receivers.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="send-asset">Asset</Label>
              <Select value={instrument} onValueChange={setInstrument}>
                <SelectTrigger id="send-asset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USYC">USYC</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="send-amount">Amount</Label>
            <Input
              id="send-amount"
              className="num"
              inputMode="decimal"
              placeholder="100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={send.isPending}>
            <SendIcon data-icon="inline-start" />
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </form>
        {send.isError && <ErrorMessage error={send.error} />}
      </CardContent>
    </Card>
  )
}
