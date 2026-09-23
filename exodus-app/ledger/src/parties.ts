// The demo parties (spec section 5) and how to find their full ids.
//
// A Canton party id looks like "Bank::1220ab34...". The part before "::" is the
// name we chose when we allocated it. The part after is the participant's key,
// which changes every time the sandbox restarts. So we never hard-code full ids:
// we list the parties and match them by name.
import type { LedgerClient } from "./client.ts";

export const DEMO_PARTY_NAMES = ["Operator", "UsycIssuer", "UsdcIssuer", "Oracle", "Alice", "Bank"] as const;

export type DemoPartyName = (typeof DEMO_PARTY_NAMES)[number];

// For example { Bank: "Bank::1220ab...", Alice: "Alice::1220ab...", ... }
export type DemoParties = Record<DemoPartyName, string>;

// "Bank::1220ab..." -> "Bank"
export function partyName(partyId: string): string {
  return partyId.split("::")[0];
}

// Finds all demo parties. Returns null if any is missing (run `npm run bootstrap`).
export async function findDemoParties(ledger: LedgerClient): Promise<DemoParties | null> {
  const allParties = await ledger.listParties();
  const found: Partial<DemoParties> = {};
  for (const partyId of allParties) {
    const name = partyName(partyId);
    if ((DEMO_PARTY_NAMES as readonly string[]).includes(name)) {
      found[name as DemoPartyName] = partyId;
    }
  }

  for (const name of DEMO_PARTY_NAMES) {
    if (found[name] === undefined) {
      return null;
    }
  }
  return found as DemoParties;
}
