"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  ShieldAlert,
  TabletSmartphone,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  Power,
  ShieldOff,
  RefreshCw,
} from "lucide-react";
import { Order, Category, Product, RestaurantSettings } from "@/lib/types";
import type { PosTab } from "@/components/pos/PosHeader";
import PosRegisterView from "@/components/pos/PosRegisterView";
import PosManualOrderView from "@/components/pos/PosManualOrderView";
import PosHistoryView from "@/components/pos/PosHistoryView";
import OrderDetailsModal from "@/components/OrderDetailsModal";

type DeviceState = {
  device: { id: string; publicId: string; name: string; type: string; status: string } | null;
  isRegistered: boolean;
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
  const [justPairedDeviceName, setJustPairedDeviceName] = useState<string | null>(null);
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
    if (!deviceState?.device || deviceState.device.status !== "ACTIVE") return;
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
    source.addEventListener("order-deleted", handleRefresh);
    source.addEventListener("device-revoked", () => {
      loadDevice();
      setIsConnected(false);
      source.close();
    });

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    source.onerror = () => {
      setIsConnected(false);
      source.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => {
        if (deviceState?.device && deviceState.device.status === "ACTIVE") {
          loadOrders();
        }
      }, 3000);
    };

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      setIsConnected(false);
      source.close();
    };
  }, [deviceState?.device, loadOrders, loadDevice]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOrders(), loadCatalog(), loadDevice()]);
    setIsRefreshing(false);
  };

  const handleRegisterWithCode = async (codeToUse: string) => {
    if (!codeToUse.trim()) return;

    setIsRegistering(true);
    setMessage("");
    try {
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToUse.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.error || "Pairing failed. Please check the code or ask an admin for a new code.");
      } else {
        const pairedName = data.data?.device?.name || "Restaurant iPad";
        setJustPairedDeviceName(pairedName);
        setRegistrationCode("");

        // Pleasant success transition
        setTimeout(async () => {
          await loadDevice();
          setJustPairedDeviceName(null);
        }, 1200);
      }
    } catch {
      setMessage("Connection error during pairing. Please verify network.");
    } finally {
      setIsRegistering(false);
    }
  };

  const registerDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleRegisterWithCode(registrationCode);
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
          <p className="text-sm font-bold text-slate-400">Connecting POS Register...</p>
        </div>
      </div>
    );
  }

  // PAIRING SUCCESS INTERMEDIATE VIEW
  if (justPairedDeviceName) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">✓ POS Registered</h1>
            <p className="text-sm font-bold text-emerald-400 mt-1">
              Terminal: <span className="text-white">{justPairedDeviceName}</span>
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>Opening POS register...</span>
          </div>
        </div>
      </div>
    );
  }

  // DISABLED TERMINAL STATE
  if (deviceState?.device && deviceState.device.status === "DISABLED") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto">
            <Power className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">POS Terminal Disabled</h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              <strong className="text-white">{deviceState.device.name}</strong> ({deviceState.device.publicId}) has been temporarily disabled by an administrator. Please contact your manager to reactivate this device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-400" : ""}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>
    );
  }

  // REVOKED TERMINAL STATE
  if (deviceState?.device && deviceState.device.status === "REVOKED") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldOff className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Registration Revoked</h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              This device registration has been revoked or replaced by an administrator. To pair this iPad again, request a new registration code from the admin dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeviceState(null)}
            className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
          >
            <Keyboard className="w-4 h-4" />
            <span>Enter New Registration Code</span>
          </button>
        </div>
      </div>
    );
  }

  // UNREGISTERED TERMINAL CODE ENTRY SCREEN
  if (!deviceState?.device || deviceState.device.status !== "ACTIVE") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 antialiased">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 sm:p-9 space-y-6 shadow-2xl">
          {/* Header Brand */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-600/30">
              <TabletSmartphone className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-mono">
              Register this POS
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-400">
              Enter the temporary registration code provided by your administrator.
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={registerDevice} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2 text-center">
                Pairing Code:
              </label>
              <input
                type="text"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
                placeholder="AB-CDEF-GHJK"
                autoFocus
                className="w-full text-center text-2xl sm:text-3xl tracking-widest font-mono font-black rounded-2xl bg-white text-slate-950 p-4 uppercase focus:outline-none focus:ring-4 focus:ring-orange-500/30 placeholder:text-slate-300 shadow-inner"
              />
            </div>

            {message && (
              <div className="flex items-start gap-2.5 text-xs text-amber-300 font-bold bg-amber-950/60 p-3.5 rounded-xl border border-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegistering || !registrationCode.trim()}
              className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-40 text-white font-black text-base flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-orange-600/20"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Registering Device...</span>
                </>
              ) : (
                <>
                  <Keyboard className="w-4 h-4" />
                  <span>Register Device</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500">
            Registration codes are temporary (10 min) and single-use.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] h-screen overflow-hidden p-2 sm:p-2.5 bg-slate-100 text-slate-950 flex flex-col antialiased">
      {/* Optional Top Toast Message */}
      {message && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide flex items-center gap-2 shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Full-Height View Container */}
      <main className="flex-1 flex overflow-hidden min-h-0 w-full">
        {activeTab === "register" && (
          <PosRegisterView
            orders={orders}
            currency={currency}
            onUpdateStatus={updateStatus}
            onViewDetails={setSelectedOrderForModal}
            updatingOrderId={updatingId}
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
        )}

        {activeTab === "new-order" && (
          <PosManualOrderView
            categories={categories}
            products={products}
            currency={currency}
            deliveryFee={deliveryFee}
            onOrderCreated={handleOrderCreated}
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
        )}

        {activeTab === "history" && (
          <PosHistoryView
            orders={orders}
            currency={currency}
            onViewDetails={setSelectedOrderForModal}
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
        )}
      </main>

      {/* Order Details Inspection Modal */}
      <OrderDetailsModal
        isOpen={Boolean(selectedOrderForModal)}
        order={selectedOrderForModal}
        currency={currency}
        onClose={() => setSelectedOrderForModal(null)}
        onStatusUpdated={handleModalStatusUpdated}
      />
    </div>
  );
}
