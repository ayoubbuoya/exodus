// The email + password form, shared by sign-up and login (they only differ in
// the button text, the password hint and what happens after).
import { useState, type FormEvent } from 'react'
import type { Credentials } from '@/api/hooks'
import { fieldErrorOf } from '@/api/client'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type CredentialsFormProps = {
  submitLabel: string
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
          <Input
            id="password"
            type="password"
            autoComplete={props.passwordAutoComplete}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError !== undefined}
          />
          {props.passwordHint !== undefined && <FieldDescription>{props.passwordHint}</FieldDescription>}
          {passwordError !== undefined && <FieldError>{passwordError}</FieldError>}
        </Field>

        <FormError error={props.error} />

        <Button type="submit" disabled={props.isSubmitting}>
          {props.isSubmitting ? 'Please wait…' : props.submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}
