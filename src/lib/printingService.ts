import { Order } from "@prisma/client";

export type PrintableOrder = Order & { items?: unknown[] };

export async function printOrder(_order: PrintableOrder): Promise<{ queued: boolean }> {
  void _order;
  return { queued: false };
}