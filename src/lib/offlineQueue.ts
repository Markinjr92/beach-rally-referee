import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { GameState } from "@/types/volleyball";
import { saveMatchState as persistMatchState } from "./matchStateService";

export type OfflineOperationType =
  | "saveMatchState"
  | "logMatchEvent"
  | "createTimeout"
  | "finalizeTimeout"
  | "updateMatch";

interface OfflineOperation<TType extends OfflineOperationType = OfflineOperationType> {
  id: string;
  type: TType;
  payload: unknown;
  createdAt: number;
}

interface SaveMatchStatePayload {
  state: GameState;
}

interface LogMatchEventPayload {
  event: TablesInsert<"match_events">;
}

interface CreateTimeoutPayload extends TablesInsert<"match_timeouts"> {
  id: string;
  started_at: string;
  duration_seconds: number;
}

interface FinalizeTimeoutPayload {
  id: string;
  ended_at: string;
}

interface UpdateMatchPayload {
  matchId: string;
  values: TablesUpdate<"matches">;
}

const STORAGE_KEY = "beach-rally-offline-queue-v1";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseQueue = (raw: string | null): OfflineOperation[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as OfflineOperation[];
    }
  } catch (error) {
    console.warn("Failed to parse offline queue", error);
  }
  return [];
};

const loadQueue = (): OfflineOperation[] => {
  if (!isBrowser()) return [];
  try {
    return parseQueue(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn("Failed to load offline queue", error);
    return [];
  }
};

const saveQueue = (queue: OfflineOperation[]) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn("Failed to persist offline queue", error);
  }
};

export const isLikelyOfflineError = (error: unknown): boolean => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (!error) return false;

  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return true;
  }

  if (error instanceof Error) {
    return /network|offline|fetch|timeout|failed to fetch|connection/i.test(error.message);
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) {
      return /network|offline|fetch|timeout|failed to fetch|connection/i.test(message);
    }
  }

  return false;
};

const handlers: Record<OfflineOperationType, (payload: unknown) => Promise<void>> = {
  async saveMatchState(payload) {
    const { state } = payload as SaveMatchStatePayload;
    await persistMatchState(state);
  },
  async logMatchEvent(payload) {
    const { event } = payload as LogMatchEventPayload;
    const { error } = await supabase.from("match_events").insert(event);
    if (error) {
      throw error;
    }
  },
  async createTimeout(payload) {
    const timeoutPayload = payload as CreateTimeoutPayload;
    const { error } = await supabase
      .from("match_timeouts")
      .upsert(timeoutPayload, { onConflict: "id", ignoreDuplicates: false });
    if (error) {
      throw error;
    }
  },
  async finalizeTimeout(payload) {
    const { id, ended_at } = payload as FinalizeTimeoutPayload;
    const { error } = await supabase
      .from("match_timeouts")
      .update({ ended_at })
      .eq("id", id);
    if (error) {
      throw error;
    }
  },
  async updateMatch(payload) {
    const { matchId, values } = payload as UpdateMatchPayload;
    const { error } = await supabase.from("matches").update(values).eq("id", matchId);
    if (error) {
      throw error;
    }
  },
};

let processing = false;

export const processOfflineQueue = async (): Promise<void> => {
  if (processing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  processing = true;
  try {
    let queue = loadQueue();
    while (queue.length) {
      const operation = queue[0];
      const handler = handlers[operation.type];
      if (!handler) {
        queue.shift();
        saveQueue(queue);
        continue;
      }

      try {
        await handler(operation.payload);
        queue.shift();
        saveQueue(queue);
      } catch (error) {
        if (isLikelyOfflineError(error)) {
          break;
        }
        console.error("Failed to process offline operation", operation.type, error);
        queue.shift();
        saveQueue(queue);
      }

      queue = loadQueue();
    }
  } finally {
    processing = false;
  }
};

export const enqueueOfflineOperation = <TType extends OfflineOperationType>(
  type: TType,
  payload: TType extends "saveMatchState"
    ? SaveMatchStatePayload
    : TType extends "logMatchEvent"
      ? LogMatchEventPayload
      : TType extends "createTimeout"
        ? CreateTimeoutPayload
        : TType extends "finalizeTimeout"
          ? FinalizeTimeoutPayload
          : UpdateMatchPayload
) => {
  if (!isBrowser()) return;
  const queue = loadQueue();
  queue.push({
    id: generateId(),
    type,
    payload,
    createdAt: Date.now(),
  });
  saveQueue(queue);
  void processOfflineQueue();
};

export const hasPendingOfflineOperation = (type?: OfflineOperationType): boolean => {
  const queue = loadQueue();
  if (!queue.length) return false;
  if (!type) return true;
  return queue.some(operation => operation.type === type);
};

if (isBrowser()) {
  window.addEventListener("online", () => {
    void processOfflineQueue();
  });
  void processOfflineQueue();
}
