// Access to the Canton ledger for the whole backend, built on @exodus/ledger.
//
// Two kinds of ledger clients:
// - `backendLedger`: the backend's own ledger user. It acts for the platform
//   parties: Operator (creates access passes), UsdcIssuer (faucet mints), and
//   reads contracts as UsycIssuer to disclose them to clients.
// - `clientFor(ledgerUserId)`: one per client wallet. Alice's commands are sent
//   with HER ledger user ("client-7f3a9c21e4b0"), which may act only as her
//   party. That is the custodial model: we hold the keys, but each command is
//   still clearly Alice's.
//
// The local sandbox runs without authentication, so any user id is accepted.
// On a real participant each client would need its own access token.
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createLedgerClient, findDemoParties, type DemoParties, type LedgerClient } from "@exodus/ledger";
import type { EnvironmentVariables } from "../config/environment.ts";

// The ledger user id of the backend itself (shows up as the submitter of its commands).
const BACKEND_LEDGER_USER = "exodus-api";

// Party ids change when the sandbox restarts, so we re-read them after this long.
const DEMO_PARTIES_CACHE_MS = 30_000;

@Injectable()
export class LedgerService {
  readonly backendLedger: LedgerClient;
  private readonly ledgerUrl: string;
  private cachedParties: DemoParties | null = null;
  private cachedAtMs = 0;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.ledgerUrl = config.get("LEDGER_URL", { infer: true });
    this.backendLedger = createLedgerClient({ baseUrl: this.ledgerUrl, userId: BACKEND_LEDGER_USER });
  }

  // A ledger client that submits as the given ledger user (a client's wallet).
  clientFor(ledgerUserId: string): LedgerClient {
    return createLedgerClient({ baseUrl: this.ledgerUrl, userId: ledgerUserId });
  }

  // The platform parties (Operator, UsycIssuer, UsdcIssuer, ...) created by `npm run bootstrap`.
  // Example: { Operator: "Operator::1220ab...", UsdcIssuer: "UsdcIssuer::1220ab...", ... }
  async getDemoParties(): Promise<DemoParties> {
    const isFresh = this.cachedParties !== null && Date.now() - this.cachedAtMs < DEMO_PARTIES_CACHE_MS;
    if (isFresh && this.cachedParties !== null) {
      return this.cachedParties;
    }
    const parties = await findDemoParties(this.backendLedger);
    if (parties === null) {
      throw new ServiceUnavailableException("The ledger is not set up yet. Run `npm run bootstrap`.");
    }
    this.cachedParties = parties;
    this.cachedAtMs = Date.now();
    return parties;
  }

  // Call when the sandbox was restarted: the cached party ids are now wrong.
  forgetDemoParties(): void {
    this.cachedParties = null;
  }
}
