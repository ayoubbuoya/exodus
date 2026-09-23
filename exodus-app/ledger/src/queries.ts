// Read helpers: "what does this party see on the ledger right now?"
//
// Each function asks the ledger for the active contracts of ONE party. The
// ledger only returns contracts that party is allowed to see, so these
// functions are also how we check privacy. For example, getOwnedHoldings(ledger, operator)
// should return nothing: the Operator must not see Alice's USDC.
import type { CreatedEvent, LedgerClient } from "./client.ts";
import {
  HoldingInterface,
  HoldingTransferFactory,
  HoldingView,
  RateFeed,
  RateIndex,
  sameTemplateId,
  UsycFund,
} from "./templates.ts";

// A contract id plus its decoded payload.
export type Contract<T> = {
  contractId: string;
  payload: T;
};

// All RateIndex price snapshots this party can see. Usually a few: every
// Publish adds one, and the oracle bot archives them once they expire.
export async function getRateSnapshots(ledger: LedgerClient, party: string): Promise<Contract<RateIndex>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: RateIndex.templateId } },
  });
  return events.map((event) => ({
    contractId: event.contractId,
    payload: RateIndex.decoder.runWithException(event.createArgument),
  }));
}

// The NEWEST price snapshot, or null if this party cannot see any.
// "Newest" = latest demo time; for heartbeats (same demo time), the latest publish.
//
// Example: as Bank (a reader) this returns
//   { contractId: "00c42e...", payload: { index: "1.0250000000", simTime: "2027-01-01T00:00:00Z",
//                                         validUntil: "2026-09-23T10:00:30Z", ... } }
// As UsdcIssuer (not a reader) it returns null.
// It may be expired (if the oracle bot is stopped). Check with isRateValid.
export async function getRateIndex(ledger: LedgerClient, party: string): Promise<Contract<RateIndex> | null> {
  const snapshots = await getRateSnapshots(ledger, party);
  if (snapshots.length === 0) {
    return null;
  }
  let newest = snapshots[0];
  for (const snapshot of snapshots) {
    if (isNewer(snapshot.payload, newest.payload)) {
      newest = snapshot;
    }
  }
  return newest;
}

function isNewer(a: RateIndex, b: RateIndex): boolean {
  const aSimTime = Date.parse(a.simTime);
  const bSimTime = Date.parse(b.simTime);
  if (aSimTime !== bSimTime) {
    return aSimTime > bSimTime;
  }
  return Date.parse(a.publishedAt) > Date.parse(b.publishedAt);
}

// True while the contract still accepts this snapshot (now < validUntil).
// Uses this machine's clock, so keep a small safety margin: by the time the
// command reaches the ledger, a second or so has passed.
export function isRateValid(rate: RateIndex, marginMs = 2000, nowMs = Date.now()): boolean {
  return nowMs + marginMs < Date.parse(rate.validUntil);
}

// The oracle's private feed. Only the Oracle party can see it.
export async function getRateFeed(ledger: LedgerClient, oracle: string): Promise<Contract<RateFeed> | null> {
  const events = await ledger.getActiveContracts(oracle, {
    TemplateFilter: { value: { templateId: RateFeed.templateId } },
  });
  if (events.length === 0) {
    return null;
  }
  return {
    contractId: events[0].contractId,
    payload: RateFeed.decoder.runWithException(events[0].createArgument),
  };
}

// The holdings OWNED by `party`, read only through the CIP-56 Holding interface,
// the same way any Canton wallet would read them.
//
// Example for Bank: [{ contractId: "00ab...", payload: { owner: Bank, instrumentId: { admin: UsycIssuer, id: "USYC" }, amount: "1000.0000000000", ... } }]
export async function getOwnedHoldings(ledger: LedgerClient, party: string): Promise<Contract<HoldingView>[]> {
  const events = await ledger.getActiveContracts(party, {
    InterfaceFilter: {
      value: { interfaceId: HoldingInterface.templateId, includeInterfaceView: true },
    },
  });

  const holdings: Contract<HoldingView>[] = [];
  for (const event of events) {
    const view = readHoldingView(event);
    // An issuer also sees the holdings it issued to others. A wallet shows
    // only what the party owns.
    if (view.owner === party) {
      holdings.push({ contractId: event.contractId, payload: view });
    }
  }
  return holdings;
}

// Finds the CIP-56 Holding view inside a created event.
function readHoldingView(event: CreatedEvent): HoldingView {
  const views = event.interfaceViews ?? [];
  for (const view of views) {
    if (sameTemplateId(view.interfaceId, HoldingInterface.templateId)) {
      if (view.viewStatus.code !== 0) {
        throw new Error(`Holding view failed for ${event.contractId}: ${view.viewStatus.message}`);
      }
      return HoldingView.decoder.runWithException(view.viewValue);
    }
  }
  throw new Error(`No Holding view for contract ${event.contractId}`);
}

// The transfer factory of `admin` (an issuer), as seen by `party`.
// Example: getTransferFactory(ledger, bank, usycIssuer) is the factory Bank uses to send USYC.
export async function getTransferFactory(
  ledger: LedgerClient,
  party: string,
  admin: string,
): Promise<Contract<HoldingTransferFactory> | null> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: HoldingTransferFactory.templateId } },
  });
  for (const event of events) {
    const payload = HoldingTransferFactory.decoder.runWithException(event.createArgument);
    if (payload.admin === admin) {
      return { contractId: event.contractId, payload };
    }
  }
  return null;
}

// The USYC fund, as seen by `party` (a fund user, or UsycIssuer itself).
// Returns null if this party cannot see a fund.
export async function getUsycFund(ledger: LedgerClient, party: string): Promise<Contract<UsycFund> | null> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: UsycFund.templateId } },
  });
  if (events.length === 0) {
    return null;
  }
  return {
    contractId: events[0].contractId,
    payload: UsycFund.decoder.runWithException(events[0].createArgument),
  };
}

// Every active contract `party` can see, of any template. Used by the
// "What can this party see?" privacy table in the UI.
export async function getVisibleContracts(ledger: LedgerClient, party: string): Promise<CreatedEvent[]> {
  return ledger.getActiveContracts(party, { WildcardFilter: { value: {} } });
}
