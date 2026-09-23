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

// The oracle's index + demo clock (Exodus.Oracle:RateIndex).
export type RateIndex = Exodus.Oracle.RateIndex;
export const RateIndex = Exodus.Oracle.RateIndex;

// One transfer factory per issuer (Exodus.TransferFactory:HoldingTransferFactory).
export type HoldingTransferFactory = Exodus.TransferFactory.HoldingTransferFactory;
export const HoldingTransferFactory = Exodus.TransferFactory.HoldingTransferFactory;

// The simulated USYC fund: pay USDC, get USYC (Exodus.Fund:UsycFund).
export type UsycFund = Exodus.Fund.UsycFund;
export const UsycFund = Exodus.Fund.UsycFund;

// Canton Token Standard (CIP-56) v1 interfaces. Wallets only know these.
export type HoldingView = SpliceHolding.Api.Token.HoldingV1.HoldingView;
export const HoldingView = SpliceHolding.Api.Token.HoldingV1.HoldingView;
export type HoldingInterface = SpliceHolding.Api.Token.HoldingV1.Holding;
export const HoldingInterface = SpliceHolding.Api.Token.HoldingV1.Holding;
export const TransferFactoryInterface = SpliceTransfer.Api.Token.TransferInstructionV1.TransferFactory;
export type Metadata = SpliceMetadata.Api.Token.MetadataV1.Metadata;

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
