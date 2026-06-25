-- CreateTable
CREATE TABLE "FactRecord" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "factValue" DECIMAL(65,30),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "FactRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactRecord_configurationId_period_idx" ON "FactRecord"("configurationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "FactRecord_configurationId_managerId_metricId_period_key" ON "FactRecord"("configurationId", "managerId", "metricId", "period");

-- AddForeignKey
ALTER TABLE "FactRecord" ADD CONSTRAINT "FactRecord_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactRecord" ADD CONSTRAINT "FactRecord_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "TeamManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactRecord" ADD CONSTRAINT "FactRecord_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: перенос наявного факту з CurrentData на стартовий період конфігурації (W)
INSERT INTO "FactRecord" ("id", "configurationId", "managerId", "metricId", "period", "factValue", "updatedAt", "updatedBy")
SELECT
  gen_random_uuid()::text,
  cd."configurationId",
  cd."managerId",
  cd."metricId",
  cfg."period",
  cd."factValue",
  COALESCE(cd."updatedAt", CURRENT_TIMESTAMP),
  cd."updatedBy"
FROM "CurrentData" cd
JOIN "KPIConfiguration" cfg ON cfg."id" = cd."configurationId"
WHERE cd."factValue" IS NOT NULL;
