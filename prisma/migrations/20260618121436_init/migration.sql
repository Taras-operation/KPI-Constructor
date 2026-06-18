-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATIONS', 'TEAM_LEAD', 'MANAGER', 'LEADERSHIP');

-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('NUMBER', 'PERCENT', 'RATING');

-- CreateEnum
CREATE TYPE "MetricDirection" AS ENUM ('MORE_IS_BETTER', 'LESS_IS_BETTER');

-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfigurationStatus" AS ENUM ('DRAFT', 'ON_APPROVAL', 'ACTIVE', 'ON_CORRECTION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BonusModel" AS ENUM ('LINEAR', 'THRESHOLD', 'MATRIX');

-- CreateEnum
CREATE TYPE "ManagerGrade" AS ENUM ('JUNIOR', 'MIDDLE', 'SENIOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "valueType" "MetricValueType" NOT NULL,
    "unit" TEXT,
    "direction" "MetricDirection" NOT NULL,
    "status" "MetricStatus" NOT NULL DEFAULT 'ACTIVE',
    "requiredForDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIConfiguration" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "teamLeadId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "bonusModel" "BonusModel" NOT NULL,
    "bonusParameters" JSONB NOT NULL,
    "teamLeadComment" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "KPIConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationMetric" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamManager" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "grade" "ManagerGrade" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentData" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "planValue" DECIMAL(65,30),
    "factValue" DECIMAL(65,30),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CurrentData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryRecord" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kpiPercentage" DECIMAL(5,2) NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "comment" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryMetric" (
    "id" TEXT NOT NULL,
    "historyRecordId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "planValue" DECIMAL(65,30),
    "factValue" DECIMAL(65,30),
    "metricPercentage" DECIMAL(5,2) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "HistoryMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Metric_name_key" ON "Metric"("name");

-- CreateIndex
CREATE INDEX "Metric_status_idx" ON "Metric"("status");

-- CreateIndex
CREATE INDEX "KPIConfiguration_status_idx" ON "KPIConfiguration"("status");

-- CreateIndex
CREATE INDEX "KPIConfiguration_period_idx" ON "KPIConfiguration"("period");

-- CreateIndex
CREATE UNIQUE INDEX "KPIConfiguration_departmentId_period_key" ON "KPIConfiguration"("departmentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationMetric_configurationId_metricId_key" ON "ConfigurationMetric"("configurationId", "metricId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamManager_configurationId_name_key" ON "TeamManager"("configurationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentData_configurationId_managerId_metricId_key" ON "CurrentData"("configurationId", "managerId", "metricId");

-- CreateIndex
CREATE INDEX "HistoryRecord_period_idx" ON "HistoryRecord"("period");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryRecord_configurationId_managerId_period_key" ON "HistoryRecord"("configurationId", "managerId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryMetric_historyRecordId_metricId_key" ON "HistoryMetric"("historyRecordId", "metricId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIConfiguration" ADD CONSTRAINT "KPIConfiguration_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIConfiguration" ADD CONSTRAINT "KPIConfiguration_teamLeadId_fkey" FOREIGN KEY ("teamLeadId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPIConfiguration" ADD CONSTRAINT "KPIConfiguration_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationMetric" ADD CONSTRAINT "ConfigurationMetric_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationMetric" ADD CONSTRAINT "ConfigurationMetric_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamManager" ADD CONSTRAINT "TeamManager_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamManager" ADD CONSTRAINT "TeamManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentData" ADD CONSTRAINT "CurrentData_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentData" ADD CONSTRAINT "CurrentData_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "TeamManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentData" ADD CONSTRAINT "CurrentData_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryRecord" ADD CONSTRAINT "HistoryRecord_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "KPIConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryRecord" ADD CONSTRAINT "HistoryRecord_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "TeamManager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryMetric" ADD CONSTRAINT "HistoryMetric_historyRecordId_fkey" FOREIGN KEY ("historyRecordId") REFERENCES "HistoryRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryMetric" ADD CONSTRAINT "HistoryMetric_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
