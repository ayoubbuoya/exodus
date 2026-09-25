import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The client's Canton party id with a Copy button (it is too long to type).
// Other approved clients paste it into their Send form to send tokens here.
// Example: client-29277a005c91::1220b4101ad7dcc9e40a…
export function PartyId({ partyId }: { partyId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(partyId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start gap-2 rounded-2xl bg-foreground/4 p-3 pl-4 ring-1 ring-foreground/8 ring-inset">
      <code className="ident flex-1 py-1.5 text-xs leading-5 break-all text-muted-foreground">{partyId}</code>
      <Button size="icon-sm" variant="ghost" aria-label={copied ? 'Party id copied' : 'Copy party id'} onClick={() => void copy()}>
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </Button>
    </div>
  )
}
