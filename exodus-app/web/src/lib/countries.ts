// The list of countries for the access form, with English names.
//
// The codes are ISO 3166-1 alpha-2 ("FR"), the same codes the API accepts
// (class-validator's IsISO31661Alpha2), from the i18n-iso-countries package.
import countries from 'i18n-iso-countries'
import english from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(english)

export type Country = { code: string; name: string }

// Sorted by name, for example [{ code: "AF", name: "Afghanistan" }, { code: "AX", name: "Åland Islands" }, ...].
// Built once when the module loads (about 250 entries).
export const COUNTRIES: Country[] = Object.entries(countries.getNames('en', { select: 'official' }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

// "FR" -> "France". Falls back to the code for anything unknown.
export function countryName(code: string): string {
  return countries.getName(code, 'en', { select: 'official' }) ?? code
}
