-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "last_faucet_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "accepted_simulation_terms" BOOLEAN NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "access_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "party_id" VARCHAR(255) NOT NULL,
    "ledger_user_id" VARCHAR(128) NOT NULL,
    "access_contract_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faucet_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(38,10) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faucet_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_points" (
    "id" UUID NOT NULL,
    "instrument" VARCHAR(16) NOT NULL,
    "index" DECIMAL(38,10) NOT NULL,
    "sim_time" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_applications_user_id_key" ON "access_applications"("user_id");

-- CreateIndex
CREATE INDEX "access_applications_status_created_at_idx" ON "access_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "access_applications_reviewed_by_id_idx" ON "access_applications"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_party_id_key" ON "wallets"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_ledger_user_id_key" ON "wallets"("ledger_user_id");

-- CreateIndex
CREATE INDEX "faucet_claims_user_id_created_at_idx" ON "faucet_claims"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "price_points_instrument_sim_time_index_key" ON "price_points"("instrument", "sim_time", "index");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_applications" ADD CONSTRAINT "access_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_applications" ADD CONSTRAINT "access_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faucet_claims" ADD CONSTRAINT "faucet_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
