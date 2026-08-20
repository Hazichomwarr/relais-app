ALTER TABLE "Connection"
ADD COLUMN "requestKey" VARCHAR(128);

CREATE UNIQUE INDEX "Connection_customerId_requestKey_key"
ON "Connection" ("customerId", "requestKey");
