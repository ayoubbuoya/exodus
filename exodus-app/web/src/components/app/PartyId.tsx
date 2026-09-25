import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The client's Canton party id with a Copy button (it is too long to type).
// Other approved clients paste it into their Send form to send tokens here.
export function PartyId({ partyId }: { partyId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(partyId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
      <code className="flex-1 font-mono text-xs break-all">{partyId}</code>
      <Button size="icon" variant="ghost" aria-label="Copy party id" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}
