-- Add missing enum values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AMAZON' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Platform')) THEN
    ALTER TYPE "Platform" ADD VALUE 'AMAZON';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEPHORA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Platform')) THEN
    ALTER TYPE "Platform" ADD VALUE 'SEPHORA';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'YOUTUBE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Platform')) THEN
    ALTER TYPE "Platform" ADD VALUE 'YOUTUBE';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EWG' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Platform')) THEN
    ALTER TYPE "Platform" ADD VALUE 'EWG';
  END IF;
END $$;

-- Create HazardLevel enum if missing
DO $$ BEGIN
  CREATE TYPE "HazardLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Product: add missing columns
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variant" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "specs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brandUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "buyUrl" TEXT;

-- Source: add missing columns
ALTER TABLE "Source" ADD COLUMN IF NOT EXISTS "complianceNotes" TEXT;

-- Evidence: add skincare-specific columns
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "efficacy" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "irritation" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "texture" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "value" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "repurchaseIntent" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "skinType" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "adverseEvents" JSONB NOT NULL DEFAULT '[]';

-- Ingredient table
CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inciName" TEXT NOT NULL,
    "ewgScore" INTEGER,
    "hazardLevel" "HazardLevel" NOT NULL DEFAULT 'LOW',
    "concerns" JSONB NOT NULL DEFAULT '[]',
    "dataGaps" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Ingredient_inciName_key" ON "Ingredient"("inciName");
CREATE INDEX IF NOT EXISTS "Ingredient_inciName_idx" ON "Ingredient"("inciName");
CREATE INDEX IF NOT EXISTS "Ingredient_ewgScore_idx" ON "Ingredient"("ewgScore");

-- ProductIngredient table
CREATE TABLE IF NOT EXISTS "ProductIngredient" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "concentration" TEXT,
    CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductIngredient_productId_idx" ON "ProductIngredient"("productId");
CREATE INDEX IF NOT EXISTS "ProductIngredient_ingredientId_idx" ON "ProductIngredient"("ingredientId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductIngredient_productId_ingredientId_key" ON "ProductIngredient"("productId", "ingredientId");

-- Add foreign keys if missing (ignore if already exist)
DO $$ BEGIN
  ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
