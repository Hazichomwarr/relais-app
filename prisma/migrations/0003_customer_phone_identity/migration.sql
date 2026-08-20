ALTER TABLE "User"
ADD COLUMN "phoneNumber" VARCHAR(20),
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phoneNumber_key"
ON "User" ("phoneNumber");
