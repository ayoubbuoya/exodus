// The Daml templates and interfaces we use, re-exported from the Daml codegen
// (`npm run codegen:daml` writes them to exodus-app/generated/daml.js).
//
// Each name is both a TypeScript type (the payload) and a value (template id,
// encoder/decoder, choices). Example:
//   const index: RateIndex = RateIndex.decoder.runWithException(event.createArgument);
//   ledger.exercise(oracle, RateIndex.Publish, cid, { ... });
import { Exodus } from "@daml.js/exodus-contract-main-0.0.1";
import { Splice as SpliceHolding } from "@daml.js/splice-api-token-holding-v1-1.0.0";
import { Splice as SpliceTransfer } from "@daml.js/splice-api-token-transfer-instruction-v1-1.0.0";
import type { Splice as SpliceMetadata } from "@daml.js/splice-api-token-metadata-v1-1.0.0";

// Our simulated USYC / USDC holding (Exodus.Holding:Holding).
export type Holding = Exodus.Holding.Holding;
export const Holding = Exodus.Holding.Holding;

// The oracle's private working state: latest index + demo clock (Exodus.Oracle:RateFeed).
// Only the Oracle party sees it. Its Publish choice creates a new RateIndex snapshot.
export type RateFeed = Exodus.Oracle.RateFeed;
export const RateFeed = Exodus.Oracle.RateFeed;

// A read-only price snapshot, usable until its validUntil (Exodus.Oracle:RateIndex).
export type RateIndex = Exodus.Oracle.RateIndex;
export const RateIndex = Exodus.Oracle.RateIndex;

// One transfer factory per issuer (Exodus.TransferFactory:HoldingTransferFactory).
export type HoldingTransferFactory = Exodus.TransferFactory.HoldingTransferFactory;
export const HoldingTransferFactory = Exodus.TransferFactory.HoldingTransferFactory;

// The simulated USYC fund: pay USDC, get USYC (Exodus.Fund:UsycFund).
export type UsycFund = Exodus.Fund.UsycFund;
export const UsycFund = Exodus.Fund.UsycFund;

// An open USYC redeem: the USYC is burned, the fund still owes USDC (Exodus.Fund:UsycRedeemRequest).
// Only the owner and UsycIssuer see it. UsycIssuer settles it; the owner can cancel it.
export type UsycRedeemRequest = Exodus.Fund.UsycRedeemRequest;
export const UsycRedeemRequest = Exodus.Fund.UsycRedeemRequest;

// One approved client's access pass: the on-ledger whitelist (Exodus.Access:ClientAccess).
export type ClientAccess = Exodus.Access.ClientAccess;
export const ClientAccess = Exodus.Access.ClientAccess;

// ---------------------------------------------------------------------------
// Exodus markets (the Pendle part). The USYC fund above is only the simulated
// on-ramp that gives a client a yield-bearing token; these templates are the
// product built on top of it.
// ---------------------------------------------------------------------------

// One market: one asset (USYC) plus one maturity date, for example PT-USYC-APR2027
// (Exodus.Market:Market). Only the Operator sees it; clients get it disclosed.
export type Market = Exodus.Market.Market;
export const Market = Exodus.Market.Market;

// The market's terms, copied into every PT and YT (no contract keys in Daml 3.x).
export type MarketTerms = Exodus.Tokens.MarketTerms;

// The frozen index of a matured market (Exodus.Tokens:MaturitySnapshot). Only the
// Operator sees it; a PT redeem gets it disclosed.
export type MaturitySnapshot = Exodus.Tokens.MaturitySnapshot;
export const MaturitySnapshot = Exodus.Tokens.MaturitySnapshot;

// Principal Token: pays 1 USD of USYC per PT after maturity (Exodus.Tokens:PrincipalToken).
export type PrincipalToken = Exodus.Tokens.PrincipalToken;
export const PrincipalToken = Exodus.Tokens.PrincipalToken;

// Yield Token: gets the USYC yield until maturity (Exodus.Tokens:YieldToken).
export type YieldToken = Exodus.Tokens.YieldToken;
export const YieldToken = Exodus.Tokens.YieldToken;

// Where a claim reads its index: a live price before maturity, the snapshot after.
export type IndexSource = Exodus.Tokens.IndexSource;

// Open payout requests: the tokens are inside, the Operator's vault still owes USYC.
export type ClaimRequest = Exodus.Tokens.ClaimRequest;
export const ClaimRequest = Exodus.Tokens.ClaimRequest;
export type MergeRequest = Exodus.Tokens.MergeRequest;
export const MergeRequest = Exodus.Tokens.MergeRequest;
// The contract calls it RedeemRequest. We export it as PtRedeemRequest so it is
// never confused with UsycRedeemRequest (the fund's USYC -> USDC redeem).
export type PtRedeemRequest = Exodus.Tokens.RedeemRequest;
export const PtRedeemRequest = Exodus.Tokens.RedeemRequest;

// Private RFQ (Exodus.Rfq): Alice asks a dealer, the dealer answers with a firm Quote.
export type RfqSide = Exodus.Rfq.RfqSide;
export type RfqRequest = Exodus.Rfq.RfqRequest;
export const RfqRequest = Exodus.Rfq.RfqRequest;
export type Quote = Exodus.Rfq.Quote;
export const Quote = Exodus.Rfq.Quote;

// Canton Token Standard (CIP-56) v1 interfaces. Wallets only know these.
export type HoldingView = SpliceHolding.Api.Token.HoldingV1.HoldingView;
export const HoldingView = SpliceHolding.Api.Token.HoldingV1.HoldingView;
export type HoldingInterface = SpliceHolding.Api.Token.HoldingV1.Holding;
export const HoldingInterface = SpliceHolding.Api.Token.HoldingV1.Holding;
export const TransferFactoryInterface = SpliceTransfer.Api.Token.TransferInstructionV1.TransferFactory;
export type Metadata = SpliceMetadata.Api.Token.MetadataV1.Metadata;
export type ChoiceContext = SpliceMetadata.Api.Token.MetadataV1.ChoiceContext;
// The standard's "any contract" type: contract ids inside a ChoiceContext have this type.
export type AnyContract = SpliceMetadata.Api.Token.MetadataV1.AnyContract;

// Empty CIP-56 metadata: { values: {} }.
export const emptyMetadata: Metadata = { values: {} };

// Template ids come in two forms:
//   we send:          "#exodus-contract-main:Exodus.Oracle:RateIndex"   (package name)
//   the ledger sends: "4cd124c8...:Exodus.Oracle:RateIndex"            (package hash)
// So we compare only the "Module:Entity" part.
export function sameTemplateId(a: string, b: string): boolean {
  return moduleAndEntity(a) === moduleAndEntity(b);
}

// "4cd124c8...:Exodus.Oracle:RateIndex" -> "Exodus.Oracle:RateIndex"
export function moduleAndEntity(templateId: string): string {
  const firstColon = templateId.indexOf(":");
  return templateId.slice(firstColon + 1);
}
