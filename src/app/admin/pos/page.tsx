"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, LogIn, ShieldAlert, TabletSmartphone } from "lucide-react";
import { Order, Category, Product, RestaurantSettings } from "@/lib/types";
import PosHeader, { PosTab } from "@/components/pos/PosHeader";
import PosRegisterView from "@/components/pos/PosRegisterView";
import PosManualOrderView from "@/components/pos/PosManualOrderView";
import PosHistoryView from "@/components/pos/PosHistoryView";
import OrderDetailsModal from "@/components/OrderDetailsModal";

type DeviceState = {
  device: { id: string; publicId: string; name: string; type: string; status: string } | null;
  staffAuthenticated: boolean;
  role: string | null;
};

export default function PosPage() {
  const [deviceState, setDeviceState] = useState<DeviceState | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [activeTab, setActiveTab] = useState<PosTab>("register");
  const [registrationCode, setRegistrationCode] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  const loadDevice = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/device", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setDeviceState(data.data);
    } catch (err) {
      console.error("Failed to load POS device state:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/orders?scope=all", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch (err) {
      console.error("Failed to load POS orders:", err);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [catRes, prodRes, setRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/products"),
        fetch("/api/settings"),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      const setData = await setRes.json();

      if (catData.success && catData.data) setCategories(catData.data);
      if (prodData.success && prodData.data) setProducts(prodData.data);
      if (setData.success && setData.data) setSettings(setData.data);
    } catch (err) {
      console.error("Failed to load POS catalog data:", err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load remote POS data after mount
    loadDevice();
    loadCatalog();
  }, [loadDevice, loadCatalog]);

  // Realtime SSE Event Stream
  useEffect(() => {
    if (!deviceState?.device || !deviceState.staffAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load active orders on authentication
    loadOrders();

    const source = new EventSource("/api/pos/events");

    source.onopen = () => {
      setIsConnected(true);
    };

    const handleRefresh = () => {
      loadOrders();
    };

    source.addEventListener("order-created", handleRefresh);
    source.addEventListener("order-updated", handleRefresh);
    source.addEventListener("device-revoked", () => {
      setDeviceState((current) => (current ? { ...current, device: null } : current));
      setIsConnected(false);
      source.close();
    });

    source.onerror = () => {
      setIsConnected(false);
      source.close();
      // Retry connection after 3s
      setTimeout(() => {
        if (deviceState?.device && deviceState.staffAuthenticated) {
          loadOrders();
        }
      }, 3000);
    };

    return () => {
      setIsConnected(false);
      source.close();
    };
  }, [deviceState?.device, deviceState?.staffAuthenticated, loadOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOrders(), loadCatalog()]);
    setIsRefreshing(false);
  };

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
      if (!data.success) {
        setMessage(data.error || "Registration failed.");
      } else {
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
      if (data.success) {
        await loadOrders();
      } else {
        setMessage(data.error || "Could not update order.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOrderCreated = async (newOrderNumber: string) => {
    setMessage(`Order #${newOrderNumber.replace(/^ORD-/, "")} placed successfully!`);
    await loadOrders();
    setActiveTab("register");
    setTimeout(() => setMessage(""), 5000);
  };

  const handleModalStatusUpdated = (updatedOrder: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setSelectedOrderForModal(updatedOrder);
  };

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === "PENDING").length,
    [orders]
  );
  const activeCount = useMemo(
    () => orders.filter((o) => ["CONFIRMED", "PREPARING", "READY"].includes(o.status)).length,
    [orders]
  );

  const currency = settings?.currency || "MAD";
  const deliveryFee = settings?.deliveryFee ?? 15;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white grid place-items-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-orange-500" />
          <p className="text-sm font-bold text-slate-400">Connecting POS Terminal...</p>
        </div>
      </div>
    );
  }

  // Device registration required
  if (!deviceState?.device) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form
          onSubmit={registerDevice}
          className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-7 sm:p-8 space-y-6 shadow-2xl"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-600 flex items-center justify-center text-white shrink-0">
              <TabletSmartphone className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Register this device</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Enter the temporary code from Admin &gt; Devices / POS.
              </p>
            </div>
          </div>

          <input
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
            placeholder="DK-7F92-AB31"
            className="w-full text-center text-2xl sm:text-3xl tracking-widest font-mono font-black rounded-xl bg-white text-slate-950 p-4 sm:p-5 uppercase focus:outline-none focus:ring-4 focus:ring-orange-500/30"
          />

          {message && (
            <p className="text-xs sm:text-sm text-amber-300 font-bold bg-amber-950/50 p-3 rounded-xl border border-amber-800">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isRegistering || !registrationCode.trim()}
            className="w-full h-14 sm:h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 font-black text-base sm:text-lg flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer shadow-md transition-all"
          >
            {isRegistering ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
            <span>Register POS Terminal</span>
          </button>

          <div className="pt-2 text-center">
            <Link
              href="/admin/login?redirect=/admin/pos"
              className="text-xs sm:text-sm text-slate-400 hover:text-white underline font-medium"
            >
              Staff Sign In
            </Link>
          </div>
        </form>
      </div>
    );
  }

  // Staff authentication required
  if (!deviceState.staffAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-orange-950/60 border border-orange-800 text-orange-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Staff sign-in required</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              <strong className="text-white">{deviceState.device.name}</strong> is registered, but
              taking register actions requires an authorized staff session.
            </p>
          </div>
          <Link
            href="/admin/login?redirect=/admin/pos"
            className="h-14 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <LogIn className="w-5 h-5" />
            <span>Sign In to POS</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 flex flex-col antialiased">
      {/* 1. POS Top Header */}
      <PosHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCount}
        activeCount={activeCount}
        deviceName={deviceState.device.name}
        devicePublicId={deviceState.device.publicId}
        isConnected={isConnected}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 2. Global Feedback Banner */}
      {message && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-emerald-100 border border-emerald-300 p-3.5 font-bold text-xs sm:text-sm text-emerald-900 flex items-center justify-between shadow-xs">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="text-xs text-emerald-800 hover:text-emerald-950 font-black cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Views */}
      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
        {activeTab === "register" && (
          <PosRegisterView
            orders={orders}
            currency={currency}
            updatingOrderId={updatingId}
            onUpdateStatus={updateStatus}
            onViewDetails={(order) => setSelectedOrderForModal(order)}
          />
        )}

        {activeTab === "new-order" && (
          <PosManualOrderView
            categories={categories}
            products={products}
            currency={currency}
            deliveryFee={deliveryFee}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {activeTab === "history" && (
          <PosHistoryView
            orders={orders}
            currency={currency}
            onViewDetails={(order) => setSelectedOrderForModal(order)}
          />
        )}
      </main>

      {/* 4. Full Order Details Modal */}
      {selectedOrderForModal && (
        <OrderDetailsModal
          isOpen={Boolean(selectedOrderForModal)}
          order={selectedOrderForModal}
          currency={currency}
          onClose={() => setSelectedOrderForModal(null)}
          onStatusUpdated={handleModalStatusUpdated}
        />
      )}
    </div>
  );
}
