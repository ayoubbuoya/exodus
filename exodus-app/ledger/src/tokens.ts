// PT and YT positions: "which Principal and Yield Tokens does this party own?"
//
// PT and YT are Exodus market tokens (the Pendle part), not fund holdings. They
// have no CIP-56 Holding view yet (spec gap 7), so we read them by template,
// not through getOwnedHoldings.
//
// Example for Bank after splitting 1000 USYC at index 1.00 and quoting 500 PT to Alice:
//   PT: 500 (free) + 500 (locked for Alice's quote)   YT: 1000 at lastIndex 1.00
import type { ContractId } from "@daml/types";
import { exerciseCommand, type LedgerClient, type LedgerCommand } from "./client.ts";
import { decimalToUnits, unitsToDecimal } from "./decimal.ts";
import { marketSymbols, previewClaim } from "./market-math.ts";
import type { Contract } from "./queries.ts";
import { PrincipalToken, YieldToken, type MarketTerms } from "./templates.ts";

// The PTs OWNED by `owner`, optionally only of one market.
//
// Why the owner filter: Alice also SEES a PT that Bank locked for her in a
// quote (she is its lock holder), but it is still Bank's until she accepts.
export async function getPrincipalTokens(
  ledger: LedgerClient,
  owner: string,
  marketId?: string,
): Promise<Contract<PrincipalToken>[]> {
  const events = await ledger.getActiveContracts(owner, {
    TemplateFilter: { value: { templateId: PrincipalToken.templateId } },
  });
  const tokens: Contract<PrincipalToken>[] = [];
  for (const event of events) {
    const payload = PrincipalToken.decoder.runWithException(event.createArgument);
    if (payload.owner !== owner) {
      continue;
    }
    if (marketId !== undefined && payload.terms.marketId !== marketId) {
      continue;
    }
    tokens.push({ contractId: event.contractId, payload });
  }
  return tokens;
}

// The YTs owned by `owner`, optionally only of one market.
export async function getYieldTokens(
  ledger: LedgerClient,
  owner: string,
  marketId?: string,
): Promise<Contract<YieldToken>[]> {
  const events = await ledger.getActiveContracts(owner, {
    TemplateFilter: { value: { templateId: YieldToken.templateId } },
  });
  const tokens: Contract<YieldToken>[] = [];
  for (const event of events) {
    const payload = YieldToken.decoder.runWithException(event.createArgument);
    if (payload.owner !== owner) {
      continue;
    }
    if (marketId !== undefined && payload.terms.marketId !== marketId) {
      continue;
    }
    tokens.push({ contractId: event.contractId, payload });
  }
  return tokens;
}

// A PT that is free to use: not locked for a quote. Locked PT cannot be
// transferred, sold again, merged or redeemed (the contract refuses).
export function isFreePt(pt: Contract<PrincipalToken>): boolean {
  return pt.payload.lock === null;
}

// One party's position in one market.
//
// Example for Bank (index now 1.025):
//   { terms: {...}, symbols: { pt: "PT-USYC-APR2027", yt: "YT-USYC-APR2027" },
//     ptTotal: "1000", ptLocked: "500", ptFree: "500",
//     ytTotal: "1000", claimableUsyc: "24.390243",
//     ptPieces: [...], ytPieces: [...] }
export type MarketPosition = {
  terms: MarketTerms;
  symbols: { pt: string; yt: string };
  ptTotal: string;
  ptLocked: string;
  ptFree: string;
  ytTotal: string;
  // The yield all YT pieces could claim at `index`, or null when no index was given.
  claimableUsyc: string | null;
  ptPieces: Contract<PrincipalToken>[];
  ytPieces: Contract<YieldToken>[];
};

// Every market where `owner` holds PT or YT, sorted by market id.
//
// `index` (optional) is the current USYC index, used for the claimable yield
// preview. Clients cannot read the price, so the backend reads it (as the
// Operator) and passes it in. Leave it out to skip the preview.
export async function getMarketPositions(ledger: LedgerClient, owner: string, index?: string): Promise<MarketPosition[]> {
  const pts = await getPrincipalTokens(ledger, owner);
  const yts = await getYieldTokens(ledger, owner);

  // Group the pieces by market id.
  const byMarket = new Map<string, { terms: MarketTerms; ptPieces: Contract<PrincipalToken>[]; ytPieces: Contract<YieldToken>[] }>();
  const groupFor = (terms: MarketTerms) => {
    let group = byMarket.get(terms.marketId);
    if (group === undefined) {
      group = { terms, ptPieces: [], ytPieces: [] };
      byMarket.set(terms.marketId, group);
    }
    return group;
  };
  for (const pt of pts) {
    groupFor(pt.payload.terms).ptPieces.push(pt);
  }
  for (const yt of yts) {
    groupFor(yt.payload.terms).ytPieces.push(yt);
  }

  const positions: MarketPosition[] = [];
  for (const group of byMarket.values()) {
    let ptLocked = 0n;
    let ptFree = 0n;
    for (const pt of group.ptPieces) {
      if (isFreePt(pt)) {
        ptFree += decimalToUnits(pt.payload.amount);
      } else {
        ptLocked += decimalToUnits(pt.payload.amount);
      }
    }
    let ytTotal = 0n;
    let claimable = 0n;
    for (const yt of group.ytPieces) {
      ytTotal += decimalToUnits(yt.payload.amount);
      if (index !== undefined) {
        // Each piece is claimed on its own (its own lastIndex), so we add up
        // the per-piece previews, each already rounded down like the contract.
        claimable += decimalToUnits(previewClaim(yt.payload.amount, yt.payload.lastIndex, index));
      }
    }
    positions.push({
      terms: group.terms,
      symbols: marketSymbols(group.terms.marketId),
      ptTotal: unitsToDecimal(ptLocked + ptFree),
      ptLocked: unitsToDecimal(ptLocked),
      ptFree: unitsToDecimal(ptFree),
      ytTotal: unitsToDecimal(ytTotal),
      claimableUsyc: index === undefined ? null : unitsToDecimal(claimable),
      ptPieces: group.ptPieces,
      ytPieces: group.ytPieces,
    });
  }
  positions.sort((a, b) => a.terms.marketId.localeCompare(b.terms.marketId));
  return positions;
}

// ---------------------------------------------------------------------------
// Joining pieces
//
// A merge (PT + YT -> USYC) runs on ONE PT and ONE YT. If Bank holds its PT
// as 600 + 400 and wants to merge 700, it must first join them into 1000.
//
// Why rounds: commands in one submission cannot use each other's results, so
// we cannot chain "a+b, then (a+b)+c" in one go. Instead each round joins
// independent PAIRS in one transaction, and we repeat:
//   round 1: [600, 400, 300]  ->  (600+400), 300  ->  [1000, 300]
//   round 2: [1000, 300]      ->  [1300]
// ---------------------------------------------------------------------------

// Joins all FREE PT pieces of one market into one PT. Locked pieces are left
// alone (they are reserved for a quote).
export async function mergePtPieces(ledger: LedgerClient, owner: string, marketId: string): Promise<void> {
  for (;;) {
    const pieces = (await getPrincipalTokens(ledger, owner, marketId)).filter(isFreePt);
    if (pieces.length <= 1) {
      return;
    }
    const commands: LedgerCommand[] = [];
    for (let i = 0; i + 1 < pieces.length; i += 2) {
      const otherCid = pieces[i + 1].contractId as ContractId<PrincipalToken>;
      commands.push(exerciseCommand(PrincipalToken.PT_MergeWith, pieces[i].contractId, { otherCid }));
    }
    await ledger.submitCommands(owner, commands);
  }
}

// Joins the YT pieces of one market that have the SAME lastIndex (the
// contract refuses to join YTs with different lastIndex: they have earned
// different yield). Example: 300 YT @1.00 + 200 YT @1.00 + 100 YT @1.025
//   -> 500 YT @1.00 and 100 YT @1.025.
export async function mergeYtPieces(ledger: LedgerClient, owner: string, marketId: string): Promise<void> {
  for (;;) {
    const pieces = await getYieldTokens(ledger, owner, marketId);
    const commands: LedgerCommand[] = [];
    for (const group of groupByLastIndex(pieces)) {
      for (let i = 0; i + 1 < group.length; i += 2) {
        const otherCid = group[i + 1].contractId as ContractId<YieldToken>;
        commands.push(exerciseCommand(YieldToken.YT_MergeWith, group[i].contractId, { otherCid }));
      }
    }
    if (commands.length === 0) {
      return;
    }
    await ledger.submitCommands(owner, commands);
  }
}

// Groups YT pieces by lastIndex. "1.0000000000" and "1.0" are the same index,
// so we compare them as units, not as text.
function groupByLastIndex(pieces: Contract<YieldToken>[]): Contract<YieldToken>[][] {
  const groups = new Map<bigint, Contract<YieldToken>[]>();
  for (const piece of pieces) {
    const key = decimalToUnits(piece.payload.lastIndex);
    const group = groups.get(key) ?? [];
    group.push(piece);
    groups.set(key, group);
  }
  return [...groups.values()];
}
