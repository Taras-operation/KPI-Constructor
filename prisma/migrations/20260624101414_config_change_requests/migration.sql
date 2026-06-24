-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ConfigChangeRequest" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT true,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfigChangeRequest_configurationId_idx" ON "ConfigChangeRequest"("configurationId");

-- CreateIndex
CREATE INDEX "ConfigChangeRequest_status_idx" ON "ConfigChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "ConfigChangeRequest" ADD CONSTRAINT "ConfigChangeRequest_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigChangeRequest" ADD CONSTRAINT "ConfigChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
