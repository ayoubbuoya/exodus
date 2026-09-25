-- CreateTable
CREATE TABLE "dealer_settings" (
    "id" UUID NOT NULL,
    "dealer_name" VARCHAR(64) NOT NULL,
    "auto_quote" BOOLEAN NOT NULL DEFAULT true,
    "apy_offset_percent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "fallback_apy_percent" DECIMAL(9,4) NOT NULL DEFAULT 5.2,
    "spread_percent" DECIMAL(9,4) NOT NULL DEFAULT 0.1,
    "max_pt_per_quote" DECIMAL(38,10) NOT NULL DEFAULT 1000,
    "quote_valid_seconds" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dealer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_settings_dealer_name_key" ON "dealer_settings"("dealer_name");
