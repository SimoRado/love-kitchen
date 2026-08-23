"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Loader2, Lock, LogIn, RefreshCw, ShieldAlert, TabletSmartphone, X } from "lucide-react";
import { Order } from "@/lib/types";
import { formatCurrency, formatRelativeTime } from "@/lib/formatters";

type DeviceState = {
  device: { id: string; publicId: string; name: string; type: string; status: string } | null;
  staffAuthenticated: boolean;
  role: string | null;
};

const NEXT_ACTION: Record<string, { label: string; status: string; className: string }> = {
  PENDING: { label: "Accept", status: "CONFIRMED", className: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  CONFIRMED: { label: "Preparing", status: "PREPARING", className: "bg-blue-600 hover:bg-blue-700 text-white" },
  PREPARING: { label: "Ready", status: "READY", className: "bg-amber-500 hover:bg-amber-600 text-slate-950" },
  READY: { label: "Completed", status: "COMPLETED", className: "bg-slate-900 hover:bg-black text-white" },
};

function statusTone(status: string) {
  if (status === "PENDING") return "bg-red-600 text-white";
  if (status === "CONFIRMED") return "bg-blue-600 text-white";
  if (status === "PREPARING") return "bg-amber-500 text-slate-950";
  if (status === "READY") return "bg-emerald-600 text-white";
  return "bg-slate-700 text-white";
}

export default function PosPage() {
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [registrationCode, setRegistrationCode] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadDevice = useCallback(async () => {
    const res = await fetch("/api/pos/device", { cache: "no-store" });
    const data = await res.json();
    if (data.success) setDeviceState(data.data);
    setIsLoading(false);
  }, []);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/pos/orders", { cache: "no-store" });
    const data = await res.json();
    if (data.success) setOrders(data.data || []);
  }, []);

  useEffect(() => {
    loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    if (!deviceState?.device || !deviceState.staffAuthenticated) return;
    loadOrders();
    const source = new EventSource("/api/pos/events");
    const refresh = () => loadOrders();
    source.addEventListener("order-created", refresh);
    source.addEventListener("order-updated", refresh);
    source.addEventListener("device-revoked", () => {
      setDeviceState((current) => current ? { ...current, device: null } : current);
      source.close();
    });
    source.onerror = () => {
      source.close();
      setTimeout(loadOrders, 2000);
    };
    return () => source.close();
  }, [deviceState?.device, deviceState?.staffAuthenticated, loadOrders]);

  const grouped = useMemo(() => ({
    PENDING: orders.filter((order) => order.status === "PENDING"),
    ACTIVE: orders.filter((order) => ["CONFIRMED", "PREPARING", "READY"].includes(order.status)),
  }), [orders]);

  const registerDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsRegistering(true);
    setMessage("");
    try {
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: registrationCode }),
      });
      const data = await res.json();
      if (!data.success) setMessage(data.error || "Registration failed.");
      else {
        setRegistrationCode("");
        setMessage("Device registered. Staff sign-in is still required for orders.");
        await loadDevice();
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const updateStatus = async (order: Order, status: string) => {
    setUpdatingId(order.id);
    try {
      const res = await fetch(`/api/pos/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) await loadOrders();
      else setMessage(data.error || "Could not update order.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 text-white grid place-items-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  }

  if (!deviceState?.device) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={registerDevice} className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-7 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-500 flex items-center justify-center"><TabletSmartphone className="w-8 h-8" /></div>
            <div><h1 className="text-2xl font-black">Register this device</h1><p className="text-sm text-slate-400">Enter the temporary code from Devices / POS.</p></div>
          </div>
          <input value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())} placeholder="DK-7F92-AB31" className="w-full text-center text-3xl tracking-widest font-black rounded-xl bg-white text-slate-950 p-5 uppercase" />
          {message && <p className="text-sm text-amber-300">{message}</p>}
          <button disabled={isRegistering} className="w-full h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50">
            {isRegistering ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldAlert className="w-6 h-6" />} Register Device
          </button>
          <Link href="/admin/login?redirect=/admin/pos" className="block text-center text-sm text-slate-300 hover:text-white">Staff sign in</Link>
        </form>
      </div>
    );
  }

  if (!deviceState.staffAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-7 text-center space-y-5">
          <Lock className="w-12 h-12 mx-auto text-orange-400" />
          <div><h1 className="text-2xl font-black">Staff sign-in required</h1><p className="text-sm text-slate-400 mt-2">{deviceState.device.name} is registered, but POS actions require an authorized staff session.</p></div>
          <Link href="/admin/login?redirect=/admin/pos" className="h-14 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black flex items-center justify-center gap-2"><LogIn className="w-5 h-5" /> Sign in</Link>
        </div>
      </div>
    );
  }

  const renderOrder = (order: Order) => {
    const action = NEXT_ACTION[order.status];
    return (
      <article key={order.id} className="bg-white text-slate-950 rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-3xl font-black">#{order.orderNumber.replace(/^ORD-/, "")}</h2><p className="text-sm font-semibold text-slate-500">{formatRelativeTime(order.createdAt)} - {order.orderType}</p></div>
          <span className={`px-4 py-2 rounded-full text-sm font-black ${statusTone(order.status)}`}>{order.status}</span>
        </div>
        <div className="space-y-2 text-lg font-bold">
          {order.items.map((item) => <div key={item.id}><span>{item.quantity} x {item.productName}</span>{item.modifiers?.map((modifier) => <p key={modifier.id} className="ml-6 text-sm text-slate-500">+ {modifier.modifierOptionName}</p>)}</div>)}
        </div>
        {(order.allergies || order.notes) && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm font-bold text-amber-900">{order.allergies && <p>Allergies: {order.allergies}</p>}{order.notes && <p>Note: {order.notes}</p>}</div>}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4"><span className="text-xl font-black">Total: {formatCurrency(order.total, "MAD")}</span></div>
        <div className="grid grid-cols-2 gap-3">
          {action && <button onClick={() => updateStatus(order, action.status)} disabled={updatingId === order.id} className={`h-16 rounded-xl text-lg font-black flex items-center justify-center gap-2 disabled:opacity-50 ${action.className}`}>{updatingId === order.id ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />} {action.label}</button>}
          <button onClick={() => updateStatus(order, "CANCELLED")} disabled={updatingId === order.id} className="h-16 rounded-xl text-lg font-black bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 flex items-center justify-center gap-2"><X className="w-6 h-6" /> Reject</button>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 bg-slate-950 text-white border-b border-slate-800 px-5 py-4 flex items-center justify-between">
        <div><h1 className="text-2xl font-black">POS Register</h1><p className="text-sm text-slate-400">{deviceState.device.name} - {deviceState.device.publicId}</p></div>
        <button onClick={loadOrders} className="h-12 px-5 rounded-xl bg-white/10 hover:bg-white/15 font-bold flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Refresh</button>
      </header>
      {message && <div className="m-5 rounded-xl bg-amber-100 border border-amber-200 p-4 font-bold text-amber-900">{message}</div>}
      <main className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">New Orders</h2><span className="rounded-full bg-red-600 text-white px-4 py-1 font-black">{grouped.PENDING.length}</span></div>{grouped.PENDING.length ? grouped.PENDING.map(renderOrder) : <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500 font-bold"><Clock3 className="w-10 h-10 mx-auto mb-2" />Waiting for new orders</div>}</section>
        <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">In Progress</h2><span className="rounded-full bg-slate-800 text-white px-4 py-1 font-black">{grouped.ACTIVE.length}</span></div>{grouped.ACTIVE.length ? grouped.ACTIVE.map(renderOrder) : <div className="rounded-xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500 font-bold">No active tickets</div>}</section>
      </main>
    </div>
  );
}
