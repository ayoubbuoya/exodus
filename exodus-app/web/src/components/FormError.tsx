import { CircleAlertIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Alert, AlertDescription } from '@/components/ui/alert'

type FormErrorProps = {
  error: unknown
}

// The error of a whole form, shown above the submit button, for example
// "Wrong email or password." Errors that belong to one field (a bad email)
// are shown under that field instead, so here we skip validation errors that
// have field details.
export function FormError({ error }: FormErrorProps) {
  if (error === null || error === undefined) {
    return null
  }
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
    return null
  }
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
