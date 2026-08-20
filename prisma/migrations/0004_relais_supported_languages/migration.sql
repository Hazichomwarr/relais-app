CREATE TABLE "RelaisLanguage" (
    "id" TEXT NOT NULL,
    "relaisProfileId" TEXT NOT NULL,
    "languageCode" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelaisLanguage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelaisLanguage_relaisProfileId_languageCode_key"
ON "RelaisLanguage" ("relaisProfileId", "languageCode");

CREATE INDEX "RelaisLanguage_languageCode_idx"
ON "RelaisLanguage" ("languageCode");

ALTER TABLE "RelaisLanguage"
ADD CONSTRAINT "RelaisLanguage_relaisProfileId_fkey"
FOREIGN KEY ("relaisProfileId") REFERENCES "RelaisProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
