-- CreateTable
CREATE TABLE "meals" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "consumedAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weights" (
    "id" SERIAL NOT NULL,
    "weightKg" DECIMAL(5,2) NOT NULL,
    "recordedAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weights_pkey" PRIMARY KEY ("id")
);
