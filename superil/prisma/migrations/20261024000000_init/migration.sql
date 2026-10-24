-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "nameEn" TEXT,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "barcode" TEXT,
    "packageSize" DOUBLE PRECISION NOT NULL,
    "packageUnit" TEXT NOT NULL,
    "multipack" INTEGER,
    "imageUrl" TEXT,
    "imageSource" TEXT,
    "imageLicense" TEXT,
    "manufacturer" TEXT,
    "dietaryTags" TEXT[],
    "productDescription" TEXT,
    "provenance" TEXT NOT NULL,
    "packagingShape" TEXT NOT NULL DEFAULT 'box',
    "packagingColor" TEXT NOT NULL DEFAULT '#e2e8f0',
    "packagingAccent" TEXT NOT NULL DEFAULT '#334155',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "homepageVerified" BOOLEAN NOT NULL DEFAULT false,
    "integration" TEXT NOT NULL,
    "deliveryFee" DOUBLE PRECISION,
    "minimumOrder" DOUBLE PRECISION,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "zipCode" TEXT,
    "source" TEXT NOT NULL,
    "storeId" TEXT,
    "subChainId" TEXT,
    "chainId" TEXT,
    "cityIsCode" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "importId" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadName" TEXT NOT NULL,
    "entryName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "chainId" TEXT,
    "subChainId" TEXT,
    "storeId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "publishedAtSource" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL,
    "importedBy" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "counts" JSONB NOT NULL,
    "applied" JSONB NOT NULL,
    "issues" JSONB NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialPrice" (
    "retailerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "isWeighted" BOOLEAN NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unitOfMeasurePrice" DOUBLE PRECISION,
    "priceChangedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "importId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialPrice_pkey" PRIMARY KEY ("retailerId","storeId","productKey")
);

-- CreateTable
CREATE TABLE "BranchPriceState" (
    "retailerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "chainId" TEXT,
    "subChainId" TEXT,
    "lastFullPublishedAt" TIMESTAMP(3),
    "lastPromoFullAt" TIMESTAMP(3),

    CONSTRAINT "BranchPriceState_pkey" PRIMARY KEY ("retailerId","storeId")
);

-- CreateTable
CREATE TABLE "OfficialPromotion" (
    "retailerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productKeys" TEXT[],
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "OfficialPromotion_pkey" PRIMARY KEY ("retailerId","storeId","promotionId")
);

-- CreateTable
CREATE TABLE "FeedProduct" (
    "productKey" TEXT NOT NULL,
    "barcode" TEXT,
    "internalRetailerId" TEXT,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "isWeighted" BOOLEAN NOT NULL,
    "firstSeenImportId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedProduct_pkey" PRIMARY KEY ("productKey")
);

-- CreateTable
CREATE TABLE "ChainMapping" (
    "chainId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,

    CONSTRAINT "ChainMapping_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "PriceOffer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "branchId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "unitPriceBasis" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "promotionJson" JSONB,
    "availability" TEXT NOT NULL DEFAULT 'unknown',
    "sourceProvider" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "freshness" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "selectedRetailerId" TEXT,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingDecision" (
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "MappingDecision_pkey" PRIMARY KEY ("productId","key")
);

-- CreateTable
CREATE TABLE "ImportFile" (
    "fileHash" TEXT NOT NULL,
    "uploadName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("fileHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_brand_idx" ON "Product"("brand");

-- CreateIndex
CREATE INDEX "Branch_retailerId_city_idx" ON "Branch"("retailerId", "city");

-- CreateIndex
CREATE INDEX "ImportBatch_fileHash_entryName_idx" ON "ImportBatch"("fileHash", "entryName");

-- CreateIndex
CREATE INDEX "OfficialPrice_productKey_idx" ON "OfficialPrice"("productKey");

-- CreateIndex
CREATE INDEX "OfficialPromotion_productKeys_idx" ON "OfficialPromotion" USING GIN ("productKeys");

-- CreateIndex
CREATE INDEX "PriceOffer_productId_idx" ON "PriceOffer"("productId");

-- CreateIndex
CREATE INDEX "PriceOffer_retailerId_branchId_idx" ON "PriceOffer"("retailerId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CartLine_cartId_productId_key" ON "CartLine"("cartId", "productId");

-- CreateIndex
CREATE INDEX "MappingDecision_key_idx" ON "MappingDecision"("key");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOffer" ADD CONSTRAINT "PriceOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOffer" ADD CONSTRAINT "PriceOffer_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOffer" ADD CONSTRAINT "PriceOffer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

