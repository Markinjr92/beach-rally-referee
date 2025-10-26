import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveMatchState as persistMatchState } from "@/lib/matchStateService";
import type { GameState } from "@/types/volleyball";

type OfflineOperationType =
  | "saveMatchState"
  | "logMatchEvent"
  | "startTimeout"
  | "endTimeout"
  | "updateMatchStatus";

type OfflineOperation = {
  id: string;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
};

const STORAGE_KEY = "referee-offline-queue";

const generateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
};

const loadQueue = (): OfflineOperation[] => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(item => item && typeof item === "object" && typeof item.type === "string" && typeof item.id === "string");
  } catch (error) {
    console.error("Failed to parse offline queue", error);
    return [];
  }
};

const persistQueue = (queue: OfflineOperation[]) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

const isNavigatorOffline = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return navigator.onLine === false;
};

export const isOfflineError = (error: unknown): boolean => {
  if (isNavigatorOffline()) {
    return true;
  }
  if (!error) {
    return false;
  }
  const extractMessage = () => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
      const value = (error as { message?: unknown }).message;
      if (typeof value === "string") {
        return value;
      }
    }
    return null;
  };
  const messageText = extractMessage();
  if (typeof messageText === "string") {
    const message = messageText.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("fetch")
    );
  }
  return false;
};

let isFlushing = false;

const executeOperation = async (operation: OfflineOperation) => {
  switch (operation.type) {
    case "saveMatchState": {
      const state = operation.payload.state as GameState | undefined;
      if (!state) return;
      await persistMatchState(state);
      break;
    }
    case "logMatchEvent": {
      await supabase.from("match_events").insert(operation.payload);
      break;
    }
    case "startTimeout": {
      await supabase.from("match_timeouts").upsert(operation.payload, { onConflict: "id" });
      break;
    }
    case "endTimeout": {
      const id = operation.payload.id as string | undefined;
      const endedAt = operation.payload.ended_at as string | undefined;
      if (!id || !endedAt) return;
      await supabase.from("match_timeouts").update({ ended_at: endedAt }).eq("id", id);
      break;
    }
    case "updateMatchStatus": {
      const matchId = operation.payload.match_id as string | undefined;
      if (!matchId) return;
      const values = { ...operation.payload };
      delete values.match_id;
      await supabase.from("matches").update(values).eq("id", matchId);
      break;
    }
    default:
      break;
  }
};

export const flushOfflineQueue = async () => {
  if (isFlushing || isNavigatorOffline()) {
    return;
  }

  const queue = loadQueue();
  if (!queue.length) {
    return;
  }

  isFlushing = true;
  try {
    const remaining = [...queue];
    while (remaining.length) {
      const operation = remaining[0];
      try {
        await executeOperation(operation);
        remaining.shift();
        persistQueue(remaining);
      } catch (error) {
        if (isOfflineError(error)) {
          break;
        }
        console.error("Failed to execute offline operation", operation, error);
        remaining.shift();
        persistQueue(remaining);
      }
    }
  } finally {
    isFlushing = false;
  }
};

export const queueOfflineOperation = async (
  operation: Omit<OfflineOperation, "id"> & { id?: string }
): Promise<string> => {
  const queue = loadQueue();
  const operationId = operation.id ?? generateId(operation.type);
  const record: OfflineOperation = { id: operationId, type: operation.type, payload: operation.payload };
  queue.push(record);
  persistQueue(queue);
  void flushOfflineQueue();
  return operationId;
};

export const createOfflineId = (prefix: string) => generateId(prefix);

export const useOfflineQueue = () => {
  useEffect(() => {
    void flushOfflineQueue();
    if (typeof window === "undefined") {
      return;
    }
    const handleOnline = () => {
      void flushOfflineQueue();
    };
    window.addEventListener("online", handleOnline);
    const interval = window.setInterval(() => {
      void flushOfflineQueue();
    }, 5000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
  }, []);
};
