// Read helpers: "what does this party see on the ledger right now?"
//
// Each function asks the ledger for the active contracts of ONE party. The
// ledger only returns contracts that party is allowed to see, so these
// functions are also how we check privacy. For example, getOwnedHoldings(ledger, operator)
// should return nothing: the Operator must not see Alice's USDC.
//
// Shared contracts (the fund, the transfer factories, the price snapshots)
// and access passes are read with their `createdEventBlob`, so they can be
// attached to a client's command through explicit disclosure. Clients cannot
// see them, so we read them as a party that can (for example UsycIssuer).
import type { CreatedEvent, DisclosedContract, LedgerClient } from "./client.ts";
import {
  ClientAccess,
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

// A contract that can also be attached to another party's command.
// Example: fund.disclosure goes into Alice's Subscribe command.
export type Disclosable<T> = Contract<T> & {
  disclosure: DisclosedContract;
};

// Builds the disclosure of a created event that was read with includeCreatedEventBlob.
function toDisclosedContract(event: CreatedEvent): DisclosedContract {
  if (event.createdEventBlob === undefined || event.createdEventBlob === "") {
    throw new Error(`No createdEventBlob for ${event.contractId}: read it with includeCreatedEventBlob`);
  }
  return {
    templateId: event.templateId,
    contractId: event.contractId,
    createdEventBlob: event.createdEventBlob,
  };
}

// All active contracts of one template that `party` sees, decoded, with their disclosure.
// Example: getDisclosable(ledger, operator, Market) -> every market, ready to disclose.
export async function getDisclosable<T>(
  ledger: LedgerClient,
  party: string,
  template: { templateId: string; decoder: { runWithException: (value: unknown) => T } },
): Promise<Disclosable<T>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: template.templateId, includeCreatedEventBlob: true } },
  });
  return events.map((event) => ({
    contractId: event.contractId,
    payload: template.decoder.runWithException(event.createArgument),
    disclosure: toDisclosedContract(event),
  }));
}

// All RateIndex price snapshots this party can see. Usually a few: every
// Publish adds one, and the oracle bot archives them once they expire.
export async function getRateSnapshots(ledger: LedgerClient, party: string): Promise<Disclosable<RateIndex>[]> {
  return getDisclosable(ledger, party, RateIndex);
}

// The NEWEST price snapshot, or null if this party cannot see any.
// "Newest" = latest demo time; for heartbeats (same demo time), the latest publish.
//
// Example: as UsycIssuer (a reader) this returns
//   { contractId: "00c42e...", payload: { index: "1.0250000000", simTime: "2027-01-01T00:00:00Z",
//                                         validUntil: "2026-09-23T10:00:30Z", ... }, disclosure: { ... } }
// As Alice (a client, not a reader) it returns null: clients get the price
// disclosed to their Subscribe command instead.
// It may be expired (if the oracle bot is stopped). Check with isRateValid.
export async function getRateIndex(ledger: LedgerClient, party: string): Promise<Disclosable<RateIndex> | null> {
  const snapshots = await getRateSnapshots(ledger, party);
  return pickNewestRate(snapshots);
}

// The newest snapshot of a list (same rule as getRateIndex), or null for an empty list.
export function pickNewestRate<T extends Contract<RateIndex>>(snapshots: T[]): T | null {
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
// Only the issuer itself sees its factory (no observers), so normally party === admin.
// Example: getTransferFactory(ledger, usycIssuer, usycIssuer) is the factory
// every client's USYC transfer uses (disclosed to the sender).
export async function getTransferFactory(
  ledger: LedgerClient,
  party: string,
  admin: string,
): Promise<Disclosable<HoldingTransferFactory> | null> {
  const factories = await getDisclosable(ledger, party, HoldingTransferFactory);
  return factories.find((factory) => factory.payload.admin === admin) ?? null;
}

// The USYC fund, as seen by `party`. Only UsycIssuer sees it (no observers).
// Returns null if this party cannot see a fund.
export async function getUsycFund(ledger: LedgerClient, party: string): Promise<Disclosable<UsycFund> | null> {
  const funds = await getDisclosable(ledger, party, UsycFund);
  return funds[0] ?? null;
}

// The access pass of `client`, as seen by `reader`, or null if there is none.
// Who can read a pass: the client itself, the Operator, and the issuers.
// Examples:
//   getClientAccess(ledger, alice, alice)       -> Alice's own pass (for her commands)
//   getClientAccess(ledger, usycIssuer, bob)    -> Bob's pass, to disclose when Alice sends USYC to Bob
//   getClientAccess(ledger, alice, bob)         -> null: clients never see each other's passes
export async function getClientAccess(
  ledger: LedgerClient,
  reader: string,
  client: string,
): Promise<Disclosable<ClientAccess> | null> {
  const passes = await getDisclosable(ledger, reader, ClientAccess);
  return passes.find((pass) => pass.payload.client === client) ?? null;
}

// Every active contract `party` can see, of any template. Used by the
// "What can this party see?" privacy table in the UI.
export async function getVisibleContracts(ledger: LedgerClient, party: string): Promise<CreatedEvent[]> {
  return ledger.getActiveContracts(party, { WildcardFilter: { value: {} } });
}
