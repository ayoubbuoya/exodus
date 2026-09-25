// A country picker you can type into: "fra" finds France, "fr" (the code) too.
// Built from shadcn's Popover (the floating panel) + Command (the searchable list).
import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from 'cn'
import { COUNTRIES, countryName } from '@/lib/countries'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type CountryComboboxProps = {
  id: string
  value: string // ISO code such as "FR", or "" when nothing is picked yet
  onChange: (code: string) => void
  invalid?: boolean
}

export function CountryCombobox({ id, value, onChange, invalid = false }: CountryComboboxProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          // Shaped like the text inputs around it (not a pill button).
          className="h-10 w-full justify-between rounded-xl border-foreground/12 bg-foreground/3 px-3.5 font-normal"
        >
          {value === '' ? <span className="text-muted-foreground">Select your country</span> : countryName(value)}
          <ChevronsUpDownIcon data-icon="inline-end" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Same width as the button (Radix exposes it as a CSS variable). */}
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search a country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  // The search matches the name, and `keywords` lets "FR" match too.
                  value={country.name}
                  keywords={[country.code]}
                  onSelect={() => {
                    onChange(country.code)
                    setOpen(false)
                  }}
                >
                  {country.name}
                  <CheckIcon className={cn('ml-auto', country.code === value ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
