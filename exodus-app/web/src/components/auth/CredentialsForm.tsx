// The email + password form, shared by sign-up and login (they only differ in
// the button text, the password hint and what happens after).
import { useState, type FormEvent } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import type { Credentials } from '@/api/hooks'
import { fieldErrorOf } from '@/api/client'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type CredentialsFormProps = {
  submitLabel: string
  // Shown on the button while the request runs, for example "Creating account…".
  pendingLabel: string
  // "new-password" on sign-up (the browser offers a strong password),
  // "current-password" on login (the browser fills in the saved one).
  passwordAutoComplete: 'new-password' | 'current-password'
  passwordHint?: string
  isSubmitting: boolean
  error: unknown
  onSubmit: (credentials: Credentials) => void
}

export function CredentialsForm(props: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // A long password is easy to mistype on a phone: let the user check it.
  const [showPassword, setShowPassword] = useState(false)
  const emailError = fieldErrorOf(props.error, 'email')
  const passwordError = fieldErrorOf(props.error, 'password')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's own page reload; we send the request ourselves.
    event.preventDefault()
    props.onSubmit({ email, password })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={emailError !== undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailError !== undefined}
          />
          {emailError !== undefined && <FieldError>{emailError}</FieldError>}
        </Field>

        <Field data-invalid={passwordError !== undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={props.passwordAutoComplete}
              required
              className="pr-12"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={passwordError !== undefined}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          {props.passwordHint !== undefined && <FieldDescription>{props.passwordHint}</FieldDescription>}
          {passwordError !== undefined && <FieldError>{passwordError}</FieldError>}
        </Field>

        <FormError error={props.error} />

        <Button type="submit" variant="bright" size="lg" className="w-full" disabled={props.isSubmitting}>
          {props.isSubmitting ? props.pendingLabel : props.submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}
