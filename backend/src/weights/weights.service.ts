import { prisma } from "../db.js";

export interface WeightInput {
  weightKg: number;
  recordedAt: string; // YYYY-MM-DD
}

export function listWeights() {
  return prisma.weight.findMany({ orderBy: { recordedAt: "asc" } });
}

export function createWeight(input: WeightInput) {
  return prisma.weight.create({
    data: { weightKg: input.weightKg, recordedAt: new Date(input.recordedAt) },
  });
}

export function updateWeight(id: number, input: WeightInput) {
  return prisma.weight.update({
    where: { id },
    data: { weightKg: input.weightKg, recordedAt: new Date(input.recordedAt) },
  });
}

export function deleteWeight(id: number) {
  return prisma.weight.delete({ where: { id } });
}
