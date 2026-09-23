// Turns a failed ledger action into an HTTP error the client can understand.
// Used by every service that talks to the ledger (wallet commands, faucet, price).
//
// Examples:
//   Daml assertion "The receiver is not an approved Exodus client"  -> 422 with that text
//   @exodus/ledger check "Not enough USDC: you have 40, need 100"    -> 422 with that text
//   the command used a contract that was just archived              -> 409 "try again"
//   the sandbox is not running (fetch failed)                       -> 503
//   any other ledger error                                          -> 502, details only in the log
import {
  BadGatewayException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  type Logger,
} from "@nestjs/common";
import { isStaleContractError, LedgerError } from "@exodus/ledger";

export function toHttpError(error: unknown, action: string, logger: Logger): HttpException {
  if (error instanceof HttpException) {
    return error;
  }
  if (error instanceof LedgerError) {
    return fromLedgerError(error, action, logger);
  }
  // fetch() throws a TypeError ("fetch failed") when nothing listens on LEDGER_URL.
  if (error instanceof TypeError) {
    logger.error(`${action}: ledger not reachable`, error.stack);
    return new ServiceUnavailableException("The ledger is not reachable right now. Please try again later.");
  }
  // The @exodus/ledger helpers throw a plain Error with a message written for
  // users (for example "Amount must be greater than 0"), so we pass it on.
  if (error instanceof Error && error.constructor === Error) {
    return new UnprocessableEntityException(error.message);
  }
  logger.error(`${action} failed`, error instanceof Error ? error.stack : String(error));
  return new InternalServerErrorException("Something went wrong. Please try again.");
}

function fromLedgerError(error: LedgerError, action: string, logger: Logger): HttpException {
  const damlMessage = readDamlFailureMessage(error.message);
  if (damlMessage !== null) {
    return new UnprocessableEntityException(damlMessage);
  }
  if (isStaleContractError(error)) {
    return new ConflictException("The ledger was busy with another change. Please try again.");
  }
  logger.error(`${action} failed on the ledger: ${error.message}`);
  return new BadGatewayException("The ledger rejected the request. Please try again.");
}

// Our contracts reject bad requests with assertMsg "..." (for example in
// Exodus.Fund: "No valid USYC price"). Canton 3.5 reports it like this
// (checked on the sandbox, 2026-09-23):
//   DAML_FAILURE: Interpretation error: Error: User failure: UNHANDLED_EXCEPTION/
//   DA.Exception.AssertionFailed:AssertionFailed (error category 9): No valid USYC price
// We keep only the text after "(error category N): ". Those texts are ours and safe to show.
function readDamlFailureMessage(text: string): string | null {
  if (!text.startsWith("DAML_FAILURE")) {
    return null;
  }
  const match = /\(error category \d+\): (.+)$/s.exec(text);
  return match === null ? null : match[1].trim();
}
