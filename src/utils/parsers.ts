import type { Game } from "@/types/volleyball";

type GameFormat = Game["format"];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const parseGameModality = (value: unknown): Game["modality"] =>
  value === "quarteto" ? "quarteto" : "dupla";

export const parseNumberArray = (
  value: unknown,
  fallback: number[],
): number[] => {
  const fallbackLast = fallback[fallback.length - 1] ?? 0;
  if (!Array.isArray(value) || value.length === 0) {
    return [...fallback];
  }

  return value.map((item, index) => {
    if (isFiniteNumber(item)) {
      return item;
    }
    if (typeof item === "string") {
      const parsed = Number(item);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    const fallbackValue = fallback[index] ?? fallbackLast;
    return fallbackValue;
  });
};

const arraysAreEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const normalizeBestOf = (bestOf: unknown): number | null => {
  if (typeof bestOf === "number" && Number.isFinite(bestOf) && bestOf > 0) {
    return bestOf;
  }
  if (typeof bestOf === "string") {
    const parsed = Number(bestOf);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

export const inferMatchFormat = (
  bestOf: unknown,
  pointsPerSet: number[],
): GameFormat => {
  const normalizedBestOf = normalizeBestOf(bestOf);
  const setsConfigured = pointsPerSet.length;

  if ((normalizedBestOf ?? setsConfigured) <= 1 || setsConfigured <= 1) {
    return "melhorDe1";
  }

  if (arraysAreEqual(pointsPerSet, [15, 15, 15])) {
    return "melhorDe3_15";
  }

  if (arraysAreEqual(pointsPerSet, [15, 15, 10])) {
    return "melhorDe3_15_10";
  }

  return "melhorDe3";
};
