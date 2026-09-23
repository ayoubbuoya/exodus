// A small client for the Canton JSON Ledger API v2.
//
// The request and response types come from the official OpenAPI spec
// (openapi/json-ledger-api-v2.yaml, served by Canton 3.5.18 at /docs/openapi).
// Run `npm run codegen:api` to regenerate them when the SDK changes.
//
// Every function does one thing. For example, Bank reading its holdings:
//
//   const ledger = createLedgerClient({ baseUrl: "http://localhost:7575" });
//   const events = await ledger.getActiveContracts(bank, { InterfaceFilter: ... });
//
// Errors from the ledger are thrown as a LedgerError with the Canton error code,
// for example "CONTRACT_NOT_FOUND" when a contract was archived before we used it.
import createClient from "openapi-fetch";
import type { Choice, Template } from "@daml/types";
import type { components, paths } from "./generated/json-ledger-api-v2.ts";

export type CreatedEvent = components["schemas"]["CreatedEvent"];
export type IdentifierFilter = components["schemas"]["IdentifierFilter"];

// A contract we attach to a command so the submitter can use it without
// seeing it on the ledger ("explicit disclosure"). Example: Alice cannot see
// the UsycFund, so the app reads it as UsycIssuer (with its createdEventBlob)
// and attaches it to Alice's Subscribe command. See toDisclosedContract in queries.ts.
export type DisclosedContract = components["schemas"]["DisclosedContract"];

// Extra options for create / exercise.
export type SubmitOptions = {
  // Contracts the submitter cannot see but the command uses (see DisclosedContract).
  disclosedContracts?: DisclosedContract[];
};
type Command = components["schemas"]["Command"];
type CantonError = components["schemas"]["JsCantonError"];

export type LedgerClientOptions = {
  // Where the JSON API lives, for example "http://localhost:7575".
  // In the browser we use the page's own origin, and Vite forwards /v2/* to the ledger.
  baseUrl: string;
  // Bearer token. Not needed on the local sandbox (no auth), needed on LocalNet later.
  token?: string;
  // The ledger user that sends commands. Any name works on the sandbox.
  userId?: string;
};

// An error returned by the ledger, for example:
//   code  = "CONTRACT_NOT_FOUND"
//   cause = "Contract could not be found with id 00c42e..."
export class LedgerError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(`${code}: ${message}`);
    this.name = "LedgerError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// True when a command failed because a contract it used was already archived
// or was being changed by another command at the same time.
//
// Example: the oracle bot publishes a new RateIndex (archiving the old one)
// while Bank's command still points at the old one. Bank's command fails.
//
// Canton reports this with different codes, depending on WHEN it notices:
//   UNKNOWN_CONTRACT_SYNCHRONIZERS   before running: "contracts have been archived"
//   CONTRACT_NOT_FOUND               while running the Daml code
//   LOCAL_VERDICT_LOCKED_CONTRACTS   at commit: another transaction is using it right now
//   LOCAL_VERDICT_INACTIVE_CONTRACTS at commit: it was archived a moment ago
export function isStaleContractError(error: unknown): boolean {
  if (!(error instanceof LedgerError)) {
    return false;
  }
  return (
    error.code === "UNKNOWN_CONTRACT_SYNCHRONIZERS" ||
    error.code === "CONTRACT_NOT_FOUND" ||
    error.code === "LOCAL_VERDICT_LOCKED_CONTRACTS" ||
    error.code === "LOCAL_VERDICT_INACTIVE_CONTRACTS"
  );
}

// Turns an error body from openapi-fetch into a LedgerError.
// The body is usually a JsCantonError, but a 400 can also be plain text.
function toLedgerError(body: unknown, response: Response): LedgerError {
  if (typeof body === "object" && body !== null && "code" in body) {
    const cantonError = body as CantonError;
    return new LedgerError(cantonError.code, cantonError.cause, response.status);
  }
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new LedgerError(`HTTP_${response.status}`, text, response.status);
}

export function createLedgerClient(options: LedgerClientOptions) {
  const userId = options.userId ?? "exodus-app";
  const headers: Record<string, string> = {};
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  const api = createClient<paths>({ baseUrl: options.baseUrl, headers });

  // ---------------------------------------------------------------------
  // Parties
  // ---------------------------------------------------------------------

  // All parties known to the participant, for example
  // ["Bank::1220ab...", "Alice::1220ab...", ...].
  async function listParties(): Promise<string[]> {
    const parties: string[] = [];
    let page = await listPartiesPage(undefined);
    parties.push(...page.parties);
    // An empty token means there are no more pages.
    while (page.nextPageToken) {
      page = await listPartiesPage(page.nextPageToken);
      parties.push(...page.parties);
    }
    return parties;
  }

  async function listPartiesPage(pageToken: string | undefined): Promise<{ parties: string[]; nextPageToken?: string }> {
    const { data, error, response } = await api.GET("/v2/parties", {
      params: { query: { pageToken } },
    });
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }
    return {
      parties: data.partyDetails.map((details) => details.party),
      nextPageToken: data.nextPageToken,
    };
  }

  // Creates a new party. The hint becomes the readable part of the id:
  // allocateParty("Bank") returns "Bank::1220ab...".
  async function allocateParty(hint: string): Promise<string> {
    const { data, error, response } = await api.POST("/v2/parties", {
      body: { partyIdHint: hint, identityProviderId: "" },
    });
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }
    return data.partyDetails.party;
  }

  // ---------------------------------------------------------------------
  // Packages
  // ---------------------------------------------------------------------

  // Uploads a DAR file. Uploading the same DAR twice is fine.
  async function uploadDar(darBytes: Uint8Array): Promise<void> {
    const { error, response } = await api.POST("/v2/packages", {
      // The spec types this body as a string, but it is raw bytes.
      body: darBytes as unknown as string,
      bodySerializer: (body) => body,
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }
  }

  // ---------------------------------------------------------------------
  // Reading contracts
  // ---------------------------------------------------------------------

  // The latest offset of the ledger, for example 42.
  async function getLedgerEnd(): Promise<number> {
    const { data, error, response } = await api.GET("/v2/state/ledger-end");
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }
    return data.offset ?? 0;
  }

  // The active contracts that `party` can see and that match `filter`.
  //
  // Example filters:
  //   { TemplateFilter: { value: { templateId: RateIndex.templateId } } }
  //   { InterfaceFilter: { value: { interfaceId: V1.Holding.templateId, includeInterfaceView: true } } }
  //   { WildcardFilter: { value: {} } }   (every contract the party can see)
  async function getActiveContracts(party: string, filter: IdentifierFilter): Promise<CreatedEvent[]> {
    const offset = await getLedgerEnd();
    const { data, error, response } = await api.POST("/v2/state/active-contracts", {
      body: {
        activeAtOffset: offset,
        eventFormat: {
          filtersByParty: {
            [party]: { cumulative: [{ identifierFilter: filter }] },
          },
          verbose: true,
        },
      },
    });
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }

    const events: CreatedEvent[] = [];
    for (const item of data) {
      const entry = item.contractEntry;
      if (entry !== undefined && "JsActiveContract" in entry) {
        events.push(entry.JsActiveContract.createdEvent);
      }
    }
    return events;
  }

  // ---------------------------------------------------------------------
  // Writing: create a contract or exercise a choice
  // ---------------------------------------------------------------------

  // Sends commands as `actAs` and waits until they are committed.
  async function submit(actAs: string, commands: Command[], options: SubmitOptions = {}): Promise<void> {
    const { error, response } = await api.POST("/v2/commands/submit-and-wait", {
      body: {
        commands,
        commandId: crypto.randomUUID(),
        userId,
        actAs: [actAs],
        disclosedContracts: options.disclosedContracts ?? [],
      },
    });
    if (error !== undefined) {
      throw toLedgerError(error, response);
    }
  }

  // Creates one contract. The template and its payload come from the Daml codegen,
  // so TypeScript checks the fields. Example:
  //   await ledger.create(usycIssuer, Holding, { issuer, owner: bank, instrument: "USYC", amount: "1000.0" });
  async function create<T extends object, K>(actAs: string, template: Template<T, K>, payload: T): Promise<void> {
    await submit(actAs, [
      {
        CreateCommand: {
          templateId: template.templateId,
          createArguments: template.encode(payload),
        },
      },
    ]);
  }

  // Exercises one choice. Works for template choices and interface choices. Example:
  //   await ledger.exercise(oracle, RateFeed.Publish, feedCid, { newIndex: "1.025", newSimTime: "2027-01-01T00:00:00Z" });
  // With disclosure (Alice uses a fund she cannot see):
  //   await ledger.exercise(alice, UsycFund.Subscribe, fund.contractId, { ... }, { disclosedContracts: [fund.disclosure] });
  async function exercise<T extends object, C, R, K>(
    actAs: string,
    choice: Choice<T, C, R, K>,
    contractId: string,
    argument: C,
    options: SubmitOptions = {},
  ): Promise<void> {
    await submit(
      actAs,
      [
        {
          ExerciseCommand: {
            templateId: choice.template().templateId,
            contractId,
            choice: choice.choiceName,
            choiceArgument: choice.argumentEncode(argument),
          },
        },
      ],
      options,
    );
  }

  return {
    listParties,
    allocateParty,
    uploadDar,
    getLedgerEnd,
    getActiveContracts,
    create,
    exercise,
  };
}

export type LedgerClient = ReturnType<typeof createLedgerClient>;
