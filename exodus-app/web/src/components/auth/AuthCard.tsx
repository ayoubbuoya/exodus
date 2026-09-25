import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

type AuthCardProps = {
  title: string
  description: string
  children: ReactNode
  // The "Already have an account? Log in" line under the form.
  footer: ReactNode
}

// The centered card that frames the login and sign-up forms.
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      </Card>
    </div>
  )
}
