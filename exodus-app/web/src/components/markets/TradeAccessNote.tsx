// Anyone logged in may look at the markets, but only approved clients (with a
// wallet) can act. This note tells the others why, and where to go instead:
//   waiting for approval  -> their access request (/onboarding)
//   admin                 -> the dealer desk (admins run the house dealer)
// Approved clients see nothing. The API checks the approval again anyway.
import { Link } from 'react-router'
import { InfoIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function TradeAccessNote() {
  const { data: profile } = useProfile()
  if (profile === undefined || profile === null || profile.wallet !== null) {
    return null
  }
  if (profile.role === 'ADMIN') {
    return (
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>You are viewing as an admin</AlertTitle>
        <AlertDescription>
          Admins run the house dealer: quotes, inventory and settings are on the{' '}
          <Link to="/dealer" className="font-medium text-foreground">
            dealer desk
          </Link>
          .
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant="info">
      <InfoIcon />
      <AlertTitle>Trading opens once you are approved</AlertTitle>
      <AlertDescription>
        Look around meanwhile.{' '}
        <Link to="/onboarding" className="font-medium text-foreground">
          See your access request
        </Link>
        .
      </AlertDescription>
    </Alert>
  )
}
