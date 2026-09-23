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
  RateIndex,
  sameTemplateId,
  UsycFund,
} from "./templates.ts";

// A contract id plus its decoded payload.
export type Contract<T> = {
  contractId: string;
  payload: T;
};

// The current RateIndex, or null if this party cannot see one.
//
// Example: as Bank (a reader) this returns
//   { contractId: "00c42e...", payload: { index: "1.0250000000", simTime: "2027-01-01T00:00:00Z", ... } }
// As UsdcIssuer (not a reader) it returns null.
export async function getRateIndex(ledger: LedgerClient, party: string): Promise<Contract<RateIndex> | null> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: RateIndex.templateId } },
  });
  if (events.length === 0) {
    return null;
  }

  // There should be exactly one, because Publish archives the old one.
  // If there are more (for example two were created by mistake), use the newest.
  let newest = events[0];
  for (const event of events) {
    if (event.offset > newest.offset) {
      newest = event;
    }
  }
  return {
    contractId: newest.contractId,
    payload: RateIndex.decoder.runWithException(newest.createArgument),
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
