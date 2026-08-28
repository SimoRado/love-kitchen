import { Order } from "@prisma/client";
import postgres, { Sql } from "postgres";

export type OrderEventType =
  | "order-created"
  | "order-updated"
  | "order-deleted"
  | "device-revoked";

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  order?: Order & { items?: unknown[] };
  deviceId?: string;
  createdAt: string;
};

type Listener = (event: OrderEvent) => void;

const listeners = new Set<Listener>();

// Global singleton pattern to prevent redundant connections across Next.js reloads
const globalForRealtime = globalThis as unknown as {
  __pgRealtimeSql?: Sql;
  __pgRealtimeListening?: boolean;
  __pgRealtimePromise?: Promise<void>;
};

function getConnectionString(): string | null {
  return process.env.DIRECT_URL || process.env.DATABASE_URL || null;
}

function getSqlClient(): Sql | null {
  if (globalForRealtime.__pgRealtimeSql) {
    return globalForRealtime.__pgRealtimeSql;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  try {
    const sql = postgres(connectionString, {
      max: 2,
      idle_timeout: 60,
      connect_timeout: 10,
      ssl: "require",
      onclose() {
        globalForRealtime.__pgRealtimeListening = false;
      },
    });

    globalForRealtime.__pgRealtimeSql = sql;
    return sql;
  } catch (error) {
    console.error("Failed to initialize PostgreSQL realtime client:", error);
    return null;
  }
}

async function ensurePostgresListener() {
  if (globalForRealtime.__pgRealtimeListening) return;
  if (globalForRealtime.__pgRealtimePromise) return globalForRealtime.__pgRealtimePromise;

  const sql = getSqlClient();
  if (!sql) return;

  globalForRealtime.__pgRealtimePromise = (async () => {
    try {
      await sql.listen("order_events", (rawPayload: string) => {
        try {
          const parsed = JSON.parse(rawPayload);
          const type = parsed.type as OrderEventType;
          if (!type) return;

          const event: OrderEvent = {
            id: parsed.id || crypto.randomUUID(),
            type,
            deviceId: parsed.deviceId,
            createdAt: parsed.createdAt || new Date().toISOString(),
            order: parsed.order
              ? parsed.order
              : parsed.id
              ? ({
                  id: parsed.id,
                  orderNumber: parsed.orderNumber || "",
                  status: parsed.status || "",
                  createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
                  updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
                } as unknown as Order)
              : undefined,
          };

          for (const listener of listeners) {
            try {
              listener(event);
            } catch (err) {
              console.error("Error in realtime order event listener:", err);
            }
          }
        } catch (parseError) {
          console.error("Failed to parse PostgreSQL order_events notification:", parseError);
        }
      });

      globalForRealtime.__pgRealtimeListening = true;
    } catch (err) {
      console.warn("Could not establish PostgreSQL listen on order_events:", err);
      globalForRealtime.__pgRealtimeListening = false;
    } finally {
      globalForRealtime.__pgRealtimePromise = undefined;
    }
  })();

  return globalForRealtime.__pgRealtimePromise;
}

// Automatically start listening when module is imported
if (typeof window === "undefined") {
  ensurePostgresListener().catch(() => {});
}

export function subscribeToOrderEvents(listener: Listener): () => void {
  listeners.add(listener);
  ensurePostgresListener().catch(() => {});

  return () => {
    listeners.delete(listener);
  };
}

export async function publishOrderEvent(event: Omit<OrderEvent, "id" | "createdAt">) {
  const payload: OrderEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  // 1. Notify local in-memory listeners
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (err) {
      console.error("Error dispatching local order event:", err);
    }
  }

  // 2. Broadcast via PostgreSQL pg_notify to notify other instances/processes
  try {
    const sql = getSqlClient();
    if (sql) {
      const dbPayload = {
        type: payload.type,
        id: payload.order?.id || payload.id,
        orderNumber: payload.order?.orderNumber,
        status: payload.order?.status,
        deviceId: payload.deviceId,
        order: payload.order,
        createdAt: payload.createdAt,
      };
      await sql`SELECT pg_notify('order_events', ${JSON.stringify(dbPayload)})`;
    }
  } catch (error) {
    // Non-fatal if direct notify fails (PostgreSQL triggers on Order/Device also broadcast)
    console.debug("PostgreSQL pg_notify dispatch note:", error);
  }
}