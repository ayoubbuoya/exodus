// The dealer bot's settings (stored in PostgreSQL, DealerSettings table).
//
// Target APY = the underlying's 30-day APY + offset (the fallback until there
// are 7 demo days of history). The bot quotes a buyer at target − spread and a
// seller at target + spread, like Pendle's fee in rate terms. Example on Oct 1:
// fallback 5.2 %, spread 0.10 % -> buy at 0.975503 (5.10 %), sell at 0.974577 (5.30 %).
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { fieldErrorOf } from '@/api/client'
import { useDealerSettings, useSaveDealerSettings } from '@/api/market-hooks'
import type { DealerSettings } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export function DealerSettingsCard() {
  const settings = useDealerSettings()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot settings</CardTitle>
        <CardDescription>How the house dealer prices PT. The Markets page shows these prices as indicative.</CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isPending && <Skeleton className="h-48 w-full" />}
        {settings.isError && <FormError error={settings.error} />}
        {/* `key`: a fresh form when the saved settings change (the form keeps its own copy while editing). */}
        {settings.data !== undefined && <SettingsForm key={JSON.stringify(settings.data)} saved={settings.data} />}
      </CardContent>
    </Card>
  )
}

// The form keeps the numbers as text while typing ("5." is fine mid-edit)
// and turns them into numbers on save.
type FormValues = {
  autoQuote: boolean
  apyOffsetPercent: string
  fallbackApyPercent: string
  spreadPercent: string
  maxPtPerQuote: string
  quoteValidSeconds: string
}

function SettingsForm({ saved }: { saved: DealerSettings }) {
  const [values, setValues] = useState<FormValues>({
    autoQuote: saved.autoQuote,
    apyOffsetPercent: String(saved.apyOffsetPercent),
    fallbackApyPercent: String(saved.fallbackApyPercent),
    spreadPercent: String(saved.spreadPercent),
    maxPtPerQuote: String(Number(saved.maxPtPerQuote)),
    quoteValidSeconds: String(saved.quoteValidSeconds),
  })
  const save = useSaveDealerSettings()

  function update(field: keyof FormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save.mutate(
      {
        autoQuote: values.autoQuote,
        apyOffsetPercent: Number(values.apyOffsetPercent),
        fallbackApyPercent: Number(values.fallbackApyPercent),
        spreadPercent: Number(values.spreadPercent),
        maxPtPerQuote: values.maxPtPerQuote,
        quoteValidSeconds: Number(values.quoteValidSeconds),
      },
      { onSuccess: () => toast.success('Dealer settings saved.') },
    )
  }

  // One number box with its label, help text and API error.
  function numberField(field: Exclude<keyof FormValues, 'autoQuote'>, label: string, help: string) {
    const error = fieldErrorOf(save.error, field)
    return (
      <Field data-invalid={error !== undefined}>
        <FieldLabel htmlFor={`dealer-${field}`}>{label}</FieldLabel>
        <Input
          id={`dealer-${field}`}
          className="num"
          inputMode="decimal"
          value={values[field]}
          onChange={(event) => update(field, event.target.value.trim())}
          aria-invalid={error !== undefined}
        />
        <FieldDescription>{help}</FieldDescription>
        {error !== undefined && <FieldError>{error}</FieldError>}
      </Field>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {/* The one switch that changes who answers clients: in its own quiet box. */}
        <Field orientation="horizontal" className="rounded-2xl bg-foreground/3 p-4 ring-1 ring-foreground/8 ring-inset">
          <Checkbox
            id="dealer-autoQuote"
            checked={values.autoQuote}
            onCheckedChange={(checked) => update('autoQuote', checked === true)}
          />
          <FieldLabel htmlFor="dealer-autoQuote">Answer requests automatically</FieldLabel>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberField('apyOffsetPercent', 'APY offset (% points)', 'Added to the underlying 30-day APY. 0 = follow it.')}
          {numberField('fallbackApyPercent', 'Fallback APY (%)', 'Used in the first 7 demo days (no history yet).')}
          {numberField('spreadPercent', 'Spread (% points)', 'Buyers get target − spread, sellers target + spread.')}
          {numberField('maxPtPerQuote', 'Max PT per quote', 'The bot declines bigger requests.')}
          {numberField('quoteValidSeconds', 'Quote lifetime (seconds)', 'How long a quote is firm (10 to 600).')}
        </div>
        <FormError error={save.error} />
        <Button type="submit" variant="bright" disabled={save.isPending} className="self-start">
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </FieldGroup>
    </form>
  )
}
