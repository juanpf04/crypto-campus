-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'PROFESSOR', 'LIBRARIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('OPEN', 'REVIEWING', 'CLOSED');

-- CreateEnum
CREATE TYPE "RewardCategory" AS ENUM ('TIEMPO', 'EXAMEN', 'PRACTICA', 'CONSULTA', 'OTROS');

-- CreateEnum
CREATE TYPE "UseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LibraryItemType" AS ENUM ('BOOK', 'BOARD_GAME', 'VIDEO_GAME', 'OTHER');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('QUEUED', 'RESERVED', 'PICKED_UP', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PAID', 'DELIVERED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShopTokenRewardReason" AS ENUM ('LOAN_RETURNED_ON_TIME', 'LOAN_RETURNED_EARLY', 'ROOM_BOOKED', 'PRINT_JOB', 'BADGE_AWARDED', 'MODULE_FIRST_USE_LIBRARY', 'MODULE_FIRST_USE_ROOMS', 'MODULE_FIRST_USE_PRINTING', 'MODULE_FIRST_USE_BADGES', 'MODULE_FIRST_USE_SHOP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "address" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectOffering" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,

    CONSTRAINT "SubjectOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectOfferingId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectBadge" (
    "id" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "subjectOfferingId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectBadgeId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "autoClose" BOOLEAN NOT NULL DEFAULT false,
    "creatorId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeCategory" (
    "id" TEXT NOT NULL,
    "prizeCategoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "badgeReward" INTEGER NOT NULL,
    "maxWinners" INTEGER NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrizeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prizeCategoryId" TEXT NOT NULL,
    "subjectBadgeId" TEXT NOT NULL,
    "awardedById" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "rewardId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectBadgeId" TEXT NOT NULL,
    "badgeCost" INTEGER NOT NULL,
    "supply" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category" "RewardCategory" NOT NULL DEFAULT 'OTROS',
    "creatorId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UseRequest" (
    "id" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "status" "UseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "type" "LibraryItemType" NOT NULL DEFAULT 'BOOK',
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "category" TEXT,
    "physicalLocation" TEXT,
    "physicalCondition" TEXT NOT NULL DEFAULT 'Bueno',
    "totalCopies" INTEGER NOT NULL,
    "metadata" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanId" INTEGER,
    "libraryItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'QUEUED',
    "requestTxHash" TEXT,
    "pickupTxHash" TEXT,
    "returnTxHash" TEXT,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservationDate" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "historical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "amenities" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBooking" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startHour" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoomBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "pages" INTEGER NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "printerId" TEXT NOT NULL,
    "txHash" TEXT,
    "creditsUsed" INTEGER NOT NULL,
    "creditsAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "color" BOOLEAN NOT NULL DEFAULT false,
    "duplex" BOOLEAN NOT NULL DEFAULT false,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "paperSize" TEXT NOT NULL DEFAULT 'A4',
    "pageRangeFrom" INTEGER,
    "pageRangeTo" INTEGER,
    "pagesPerSheet" INTEGER NOT NULL DEFAULT 1,
    "filePages" INTEGER NOT NULL DEFAULT 1,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,

    CONSTRAINT "PrintLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "baseId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "variantLabel" TEXT,
    "attributes" JSONB,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBase" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderBatch" (
    "id" TEXT NOT NULL,
    "batchId" INTEGER,
    "userId" TEXT NOT NULL,
    "totalPaid" INTEGER NOT NULL,
    "txHash" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pricePaid" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PAID',
    "txHash" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "historical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTopupSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardTopupSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopTokenReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "ShopTokenRewardReason" NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopTokenReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectOffering_subjectId_professorId_group_academicYear_key" ON "SubjectOffering"("subjectId", "professorId", "group", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_subjectOfferingId_key" ON "Enrollment"("userId", "subjectOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectBadge_tokenId_key" ON "SubjectBadge"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectBadge_subjectOfferingId_key" ON "SubjectBadge"("subjectOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_assignmentId_key" ON "Assignment"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeCategory_prizeCategoryId_key" ON "PrizeCategory"("prizeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmission_assignmentId_studentId_key" ON "TaskSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "BadgeAward_awardedAt_idx" ON "BadgeAward"("awardedAt");

-- CreateIndex
CREATE INDEX "BadgeAward_awardedById_idx" ON "BadgeAward"("awardedById");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeAward_userId_prizeCategoryId_key" ON "BadgeAward"("userId", "prizeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_rewardId_key" ON "Reward"("rewardId");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_redeemedAt_idx" ON "RewardRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UseRequest_requestId_key" ON "UseRequest"("requestId");

-- CreateIndex
CREATE INDEX "UseRequest_status_idx" ON "UseRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_tokenId_key" ON "LibraryItem"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanId_key" ON "Loan"("loanId");

-- CreateIndex
CREATE INDEX "Loan_userId_historical_idx" ON "Loan"("userId", "historical");

-- CreateIndex
CREATE INDEX "Loan_status_historical_idx" ON "Loan"("status", "historical");

-- CreateIndex
CREATE INDEX "Loan_libraryItemId_status_idx" ON "Loan"("libraryItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBooking_bookingId_key" ON "RoomBooking"("bookingId");

-- CreateIndex
CREATE INDEX "RoomBooking_roomId_date_idx" ON "RoomBooking"("roomId", "date");

-- CreateIndex
CREATE INDEX "RoomBooking_userId_date_idx" ON "RoomBooking"("userId", "date");

-- CreateIndex
CREATE INDEX "RoomBooking_userId_historical_idx" ON "RoomBooking"("userId", "historical");

-- CreateIndex
CREATE INDEX "RoomBooking_date_cancelled_historical_idx" ON "RoomBooking"("date", "cancelled", "historical");

-- CreateIndex
CREATE INDEX "PrintLog_userId_historical_idx" ON "PrintLog"("userId", "historical");

-- CreateIndex
CREATE INDEX "PrintLog_createdAt_historical_idx" ON "PrintLog"("createdAt", "historical");

-- CreateIndex
CREATE INDEX "PrintLog_printerId_idx" ON "PrintLog"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productId_key" ON "Product"("productId");

-- CreateIndex
CREATE INDEX "Product_baseId_idx" ON "Product"("baseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBase_slug_key" ON "ProductBase"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrderBatch_batchId_key" ON "OrderBatch"("batchId");

-- CreateIndex
CREATE INDEX "OrderBatch_userId_purchaseDate_idx" ON "OrderBatch"("userId", "purchaseDate");

-- CreateIndex
CREATE INDEX "OrderBatch_userId_historical_idx" ON "OrderBatch"("userId", "historical");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- CreateIndex
CREATE INDEX "Order_batchId_idx" ON "Order"("batchId");

-- CreateIndex
CREATE INDEX "Order_userId_historical_idx" ON "Order"("userId", "historical");

-- CreateIndex
CREATE INDEX "Order_status_historical_idx" ON "Order"("status", "historical");

-- CreateIndex
CREATE INDEX "Order_productId_idx" ON "Order"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "CardTopupSimulation_userId_createdAt_idx" ON "CardTopupSimulation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopTokenReward_userId_createdAt_idx" ON "ShopTokenReward"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopTokenReward_userId_reason_idx" ON "ShopTokenReward"("userId", "reason");

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectBadge" ADD CONSTRAINT "SubjectBadge_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_subjectBadgeId_fkey" FOREIGN KEY ("subjectBadgeId") REFERENCES "SubjectBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeCategory" ADD CONSTRAINT "PrizeCategory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_prizeCategoryId_fkey" FOREIGN KEY ("prizeCategoryId") REFERENCES "PrizeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_subjectBadgeId_fkey" FOREIGN KEY ("subjectBadgeId") REFERENCES "SubjectBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeAward" ADD CONSTRAINT "BadgeAward_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_subjectBadgeId_fkey" FOREIGN KEY ("subjectBadgeId") REFERENCES "SubjectBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseRequest" ADD CONSTRAINT "UseRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UseRequest" ADD CONSTRAINT "UseRequest_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintLog" ADD CONSTRAINT "PrintLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintLog" ADD CONSTRAINT "PrintLog_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "ProductBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderBatch" ADD CONSTRAINT "OrderBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTopupSimulation" ADD CONSTRAINT "CardTopupSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopTokenReward" ADD CONSTRAINT "ShopTokenReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
