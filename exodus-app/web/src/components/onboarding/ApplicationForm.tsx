// The access form (kept light on purpose): full name, country, and a checkbox
// "I understand USYC and USDC here are simulated test tokens".
// Used for the first request and, pre-filled, to apply again after a rejection.
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useSubmitApplication } from '@/api/hooks'
import type { ApplicationForm as ApplicationFormValues } from '@/api/types'
import { fieldErrorOf } from '@/api/client'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CountryCombobox } from './CountryCombobox.tsx'

type ApplicationFormProps = {
  initialValues?: { fullName: string; country: string }
  submitLabel: string
}

export function ApplicationForm({ initialValues, submitLabel }: ApplicationFormProps) {
  const [fullName, setFullName] = useState(initialValues?.fullName ?? '')
  const [country, setCountry] = useState(initialValues?.country ?? '')
  // Always unticked, even when applying again: the user confirms it each time.
  const [acceptsSimulatedTokens, setAcceptsSimulatedTokens] = useState(false)
  const submit = useSubmitApplication()

  const fullNameError = fieldErrorOf(submit.error, 'fullName')
  const countryError = fieldErrorOf(submit.error, 'country')
  const termsError = fieldErrorOf(submit.error, 'acceptsSimulatedTokens')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values: ApplicationFormValues = { fullName, country, acceptsSimulatedTokens }
    submit.mutate(values, { onSuccess: () => toast.success('Application sent. We will review it shortly.') })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={fullNameError !== undefined}>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            autoComplete="name"
            required
            maxLength={100}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={fullNameError !== undefined}
          />
          {fullNameError !== undefined && <FieldError>{fullNameError}</FieldError>}
        </Field>

        <Field data-invalid={countryError !== undefined}>
          <FieldLabel htmlFor="country">Country of residence</FieldLabel>
          <CountryCombobox id="country" value={country} onChange={setCountry} invalid={countryError !== undefined} />
          {countryError !== undefined && <FieldError>{countryError}</FieldError>}
        </Field>

        <Field orientation="horizontal" data-invalid={termsError !== undefined}>
          <Checkbox
            id="acceptsSimulatedTokens"
            checked={acceptsSimulatedTokens}
            // Radix gives true, false or "indeterminate"; only true counts.
            onCheckedChange={(checked) => setAcceptsSimulatedTokens(checked === true)}
            aria-invalid={termsError !== undefined}
          />
          <FieldContent>
            <FieldLabel htmlFor="acceptsSimulatedTokens">
              I understand that USYC and USDC here are simulated test tokens
            </FieldLabel>
            <FieldDescription>
              They are issued by Exodus demo parties, have no real value, and are not issued by or connected to
              Circle or Hashnote.
            </FieldDescription>
            {termsError !== undefined && <FieldError>{termsError}</FieldError>}
          </FieldContent>
        </Field>

        <FormError error={submit.error} />

        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}
