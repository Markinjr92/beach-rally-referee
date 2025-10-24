import type { Game } from "@/types/volleyball";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const parseGameModality = (value: unknown): Game["modality"] =>
  value === "quarteto" ? "quarteto" : "dupla";

export const parseNumberArray = (
  value: unknown,
  fallback: number[],
): number[] => {
  const fallbackLast = fallback[fallback.length - 1] ?? 0;
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const result = value.map((item, index) => {
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

  if (result.length < fallback.length) {
    return [...result, ...fallback.slice(result.length)];
  }

  return result;
};
