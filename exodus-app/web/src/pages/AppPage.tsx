// /app: the approved client's home. For now it only shows the wallet's party id;
// the full dashboard (price, chart, faucet, subscribe, holdings) is step 5 in docs/client-app.md.
import { useState } from 'react'
import { Link } from 'react-router'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function AppPage() {
  const { data: profile } = useProfile()
  // RequireStage("approved") only renders this page for a profile with a wallet.
  if (profile?.wallet == null) {
    return null
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your wallet</CardTitle>
          <CardDescription>
            The dashboard (USYC price, faucet, subscribe, holdings) is coming next. Meanwhile, this is your Canton
            party id: other approved clients use it to send you tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartyId partyId={profile.wallet.partyId} />
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/lab">Explore the lab</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// The party id with a Copy button (it is too long to type).
function PartyId({ partyId }: { partyId: string }) {
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
