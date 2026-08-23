export type PaymentState = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentPreparation = {
  provider: "manual";
  state: PaymentState;
};

export async function prepareOrderPayment(): Promise<PaymentPreparation> {
  return { provider: "manual", state: "UNPAID" };
}