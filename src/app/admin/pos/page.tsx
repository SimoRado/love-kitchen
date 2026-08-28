"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  LogIn,
  ShieldAlert,
  TabletSmartphone,
  QrCode,
  Camera,
  CheckCircle2,
  X,
  AlertCircle,
  Keyboard,
} from "lucide-react";
import { Order, Category, Product, RestaurantSettings } from "@/lib/types";
import type { PosTab } from "@/components/pos/PosHeader";
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
  const [justPairedDeviceName, setJustPairedDeviceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  // QR Scanner modal state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Check URL parameters for QR scan code auto-fill
  /* eslint-disable react-hooks/set-state-in-effect -- sync registration code from QR URL parameter */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get("code") || params.get("pairingCode");
      if (codeFromUrl && !deviceState?.device) {
        setRegistrationCode(codeFromUrl.toUpperCase());
      }
    }
  }, [deviceState?.device]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    source.addEventListener("order-deleted", handleRefresh);
    source.addEventListener("device-revoked", () => {
      setDeviceState((current) => (current ? { ...current, device: null } : current));
      setIsConnected(false);
      source.close();
    });

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    source.onerror = () => {
      setIsConnected(false);
      source.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => {
        if (deviceState?.device && deviceState.staffAuthenticated) {
          loadOrders();
        }
      }, 3000);
    };

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      setIsConnected(false);
      source.close();
    };
  }, [deviceState?.device, deviceState?.staffAuthenticated, loadOrders]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadOrders(), loadCatalog()]);
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
        setMessage(data.error || "Pairing failed. Please check the code or generate a new invitation.");
      } else {
        const pairedName = data.data?.device?.name || "Restaurant iPad";
        setJustPairedDeviceName(pairedName);
        setRegistrationCode("");
        stopQrScanner();

        // Brief pleasant success transition
        setTimeout(async () => {
          await loadDevice();
          setJustPairedDeviceName(null);
        }, 1500);
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

  // QR Scanner Implementation
  const stopQrScanner = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScanError(null);
  }, []);

  const startQrScanner = async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setScanError("Camera access is not supported on this browser. Please enter the manual pairing code.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if native BarcodeDetector is available
      const BarcodeDetectorClass = typeof window !== "undefined"
        ? (window as unknown as {
            BarcodeDetector?: new (options: { formats: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
            };
          }).BarcodeDetector
        : undefined;

      if (BarcodeDetectorClass) {
        const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });
        const scanInterval = setInterval(async () => {
          if (!videoRef.current || !streamRef.current) {
            clearInterval(scanInterval);
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue || "";
              let extractedCode = rawVal;
              try {
                if (rawVal.includes("code=")) {
                  const urlObj = new URL(rawVal, window.location.origin);
                  extractedCode = urlObj.searchParams.get("code") || rawVal;
                }
              } catch {}

              if (extractedCode) {
                clearInterval(scanInterval);
                stopQrScanner();
                setRegistrationCode(extractedCode.toUpperCase());
                handleRegisterWithCode(extractedCode);
              }
            }
          } catch {}
        }, 400);
      }
    } catch (err) {
      console.warn("Camera scan init failed:", err);
      setScanError("Could not access camera. Please grant camera permission or use the manual code.");
    }
  };

  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, [stopQrScanner]);

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
            <h1 className="text-2xl font-black text-white">✓ POS Successfully Registered</h1>
            <p className="text-sm font-bold text-emerald-400 mt-1">
              Device: <span className="text-white">{justPairedDeviceName}</span>
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>Opening register...</span>
          </div>
        </div>
      </div>
    );
  }

  // UNREGISTERED IPAD DEDICATED EXPERIENCE
  if (!deviceState?.device) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 antialiased">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 sm:p-9 space-y-6 shadow-2xl">
          {/* Header Brand */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-orange-600/30">
              <TabletSmartphone className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase font-mono">
              Dark Kitchen POS
            </h1>
            <p className="text-sm font-bold text-slate-400">
              This device is not registered. Pair this device with the restaurant&apos;s POS system.
            </p>
          </div>

          {/* Option 1: Fast QR Code Scan */}
          <div className="pt-2">
            <button
              type="button"
              onClick={startQrScanner}
              className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-base flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98]"
            >
              <Camera className="w-5 h-5" />
              <span>Scan QR Code</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-slate-600">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">OR</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Option 2: Manual Code Entry */}
          <form onSubmit={registerDevice} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2 text-center">
                Enter pairing code:
              </label>
              <input
                type="text"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())}
                placeholder="DK-7F4K-29XP"
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
              className="w-full h-13 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-40 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-[0.98]"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying Pairing Code...</span>
                </>
              ) : (
                <>
                  <Keyboard className="w-4 h-4" />
                  <span>Register Device</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Admin Shortcut */}
          <div className="pt-2 text-center border-t border-slate-800/80">
            <p className="text-xs text-slate-500">
              Need a code? Generate one from the{" "}
              <Link
                href="/admin/devices"
                className="text-orange-400 hover:text-orange-300 font-bold underline"
              >
                Admin Devices Dashboard
              </Link>
            </p>
          </div>
        </div>

        {/* QR SCANNER CAMERA MODAL OVERLAY */}
        {isScanning && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white">
                  <QrCode className="w-5 h-5 text-orange-500" />
                  <h3 className="font-black text-base">Scan POS Pairing QR Code</h3>
                </div>
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Camera Viewport */}
              <div className="relative aspect-square w-full bg-black rounded-2xl overflow-hidden border-2 border-orange-500/50 flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-8 border-2 border-dashed border-orange-400/80 rounded-xl pointer-events-none animate-pulse" />
              </div>

              {scanError ? (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl">
                  {scanError}
                </div>
              ) : (
                <p className="text-xs text-center text-slate-400 font-medium">
                  Point the camera directly at the QR Code shown on the Admin Dashboard.
                </p>
              )}

              <button
                type="button"
                onClick={stopQrScanner}
                className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Close & Enter Code Manually
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Staff authentication required
  if (!deviceState.staffAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 antialiased">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-orange-950/60 border border-orange-800 text-orange-400 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Staff sign-in required</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              <strong className="text-white">{deviceState.device.name}</strong> ({deviceState.device.publicId}) is registered, but
              accessing register actions requires an authorized staff session.
            </p>
          </div>
          <Link
            href="/admin/login?redirect=/admin/pos"
            className="h-14 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <LogIn className="w-5 h-5" />
            <span>Sign In to POS</span>
          </Link>
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
