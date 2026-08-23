import { Order } from "@prisma/client";

export type OrderEventType = "order-created" | "order-updated" | "device-revoked";

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  order?: Order & { items?: unknown[] };
  deviceId?: string;
  createdAt: string;
};

type Listener = (event: OrderEvent) => void;

const listeners = new Set<Listener>();

export function subscribeToOrderEvents(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishOrderEvent(event: Omit<OrderEvent, "id" | "createdAt">) {
  const payload: OrderEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  for (const listener of listeners) {
    listener(payload);
  }
}