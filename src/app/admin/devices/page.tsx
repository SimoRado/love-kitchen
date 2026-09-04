"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Copy,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  TabletSmartphone,
  Check,
  Clock,
  KeyRound,
  Trash2,
  X,
  AlertTriangle,
  Power,
  ShieldAlert,
} from "lucide-react";
import { Device, DeviceRegistrationCode } from "@/lib/types";
import { formatRelativeTime } from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";
import { adminFetch } from "@/lib/adminFetch";

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-300";
  if (status === "DISABLED" || status === "INACTIVE") return "bg-amber-50 text-amber-700 border-amber-300";
  return "bg-rose-50 text-rose-700 border-rose-300";
}

function statusDot(status: string) {
  if (status === "ACTIVE") return "bg-emerald-500 ring-4 ring-emerald-100";
  if (status === "DISABLED" || status === "INACTIVE") return "bg-amber-500 ring-4 ring-amber-100";
  return "bg-rose-500 ring-4 ring-rose-100";
}

export default function DevicesPage() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [invitations, setInvitations] = useState<DeviceRegistrationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invitation creation modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [replaceTargetDevice, setReplaceTargetDevice] = useState<Device | null>(null);

  // Active generated invitation
  const [activeInvitation, setActiveInvitation] = useState<DeviceRegistrationCode | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Rename modal
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");

  // Countdown timer for active invitation
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [generatingCodeDeviceId, setGeneratingCodeDeviceId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await adminFetch("/api/devices", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setDevices(data.data || []);
        setInvitations(data.invitations || []);
      } else {
        showToast(data.error || "Could not load devices", "error");
      }
    } catch {
      showToast("Failed to connect to device server", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  /* eslint-disable react-hooks/set-state-in-effect -- load initial devices */
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Live countdown timer hook
  /* eslint-disable react-hooks/set-state-in-effect -- synchronize countdown timer */
  useEffect(() => {
    if (!activeInvitation) {
      setTimeLeft(null);
      return;
    }

    const expiry = new Date(activeInvitation.expiresAt).getTime();
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        loadDevices();
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeInvitation, loadDevices]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Formatted countdown string (MM:SS)
  const formattedCountdown = useMemo(() => {
    if (timeLeft === null) return "--:--";
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [timeLeft]);



  const handleOpenAddModal = (replaceDevice?: Device) => {
    if (replaceDevice) {
      setReplaceTargetDevice(replaceDevice);
      setDeviceName(replaceDevice.name);
      setDeviceLocation("");
    } else {
      setReplaceTargetDevice(null);
      setDeviceName("Main Restaurant iPad");
      setDeviceLocation("Main Register");
    }
    setIsAddModalOpen(true);
  };

  const handleGenerateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    setIsCreating(true);
    try {
      const fullLabel = deviceLocation.trim()
        ? `${deviceName.trim()} (${deviceLocation.trim()})`
        : deviceName.trim();

      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullLabel,
          type: "POS",
          replaceDeviceId: replaceTargetDevice ? replaceTargetDevice.id : null,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setActiveInvitation(data.data);
        setIsAddModalOpen(false);
        showToast("Pairing invitation generated! Valid for 10 minutes.", "success");
        loadDevices();
      } else {
        showToast(data.error || "Could not create pairing invitation.", "error");
      }
    } catch {
      showToast("Network error creating invitation.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleGetLoginCode = async (device: Device) => {
    setGeneratingCodeDeviceId(device.id);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replaceDeviceId: device.id,
          isReconnect: true,
          name: device.name,
          type: device.type,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setActiveInvitation(data.data);
        showToast(`Login code for "${device.name}" generated! Valid for 10 minutes.`, "success");
        loadDevices();
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        showToast(data.error || "Could not generate login code.", "error");
      }
    } catch {
      showToast("Network error generating login code.", "error");
    } finally {
      setGeneratingCodeDeviceId(null);
    }
  };

  const handleUpdateStatus = async (device: Device, newStatus: "ACTIVE" | "DISABLED" | "REVOKED") => {
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Device ${device.name} updated to ${newStatus}.`, "success");
        loadDevices();
      } else {
        showToast(data.error || "Failed to update device status.", "error");
      }
    } catch {
      showToast("Network error updating device.", "error");
    }
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !editName.trim()) return;

    try {
      const res = await fetch(`/api/devices/${editingDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Device renamed successfully.", "success");
        setEditingDevice(null);
        loadDevices();
      } else {
        showToast(data.error || "Failed to rename device.", "error");
      }
    } catch {
      showToast("Network error renaming device.", "error");
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!window.confirm(`Permanently delete "${device.name}" (${device.publicId}) from database? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Device ${device.name} deleted.`, "success");
        loadDevices();
      } else {
        showToast(data.error || "Failed to delete device.", "error");
      }
    } catch {
      showToast("Network error deleting device.", "error");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/devices/invitations/${invitationId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("Pairing invitation cancelled.", "success");
        if (activeInvitation?.id === invitationId) {
          setActiveInvitation(null);
        }
        loadDevices();
      } else {
        showToast(data.error || "Failed to cancel invitation.", "error");
      }
    } catch {
      showToast("Network error cancelling invitation.", "error");
    }
  };

  const handleCopyCode = async () => {
    if (!activeInvitation) return;
    await navigator.clipboard.writeText(activeInvitation.code);
    setCopiedCode(true);
    showToast("Pairing code copied to clipboard", "success");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <TabletSmartphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">POS Devices & Registers</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Pair, monitor, replace, or revoke restaurant iPad registers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadDevices}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add POS Device</span>
          </button>
        </div>
      </div>

      {/* ACTIVE GENERATED PAIRING CODE CARD / HERO */}
      {activeInvitation && (
        <section className="rounded-2xl border-2 border-orange-500 bg-linear-to-br from-orange-50/90 via-white to-orange-50/50 p-6 sm:p-7 shadow-lg relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={() => setActiveInvitation(null)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Dismiss view"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-black uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {activeInvitation.isReconnect
                  ? "Temporary POS Login Code"
                  : activeInvitation.replaceDeviceId
                  ? "Device Replacement Code"
                  : "Temporary POS Registration Code"}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {activeInvitation.isReconnect
                  ? "Log In Device: "
                  : activeInvitation.replaceDeviceId
                  ? "Replace Device: "
                  : "Register Device: "}
                <span className="text-orange-600">{activeInvitation.deviceName}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Enter this 10-minute temporary pairing code on the iPad POS screen (<span className="font-mono font-bold text-slate-800">/admin/pos</span>) to connect as this device.
              </p>
            </div>

            {/* Manual Code Badge */}
            <div className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-xs inline-block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Single-Use Registration Code
              </p>
              <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-widest text-slate-950 font-mono mt-1 select-all">
                {activeInvitation.code}
              </p>
            </div>

            {/* Countdown & Status */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {timeLeft !== null && timeLeft > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>Expires in {formattedCountdown}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>INVITATION EXPIRED</span>
                </div>
              )}

              <span className="text-xs font-bold text-slate-500">
                Single-use only • Automatically invalidates after pairing or expiry
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? "Code Copied!" : "Copy Registration Code"}</span>
              </button>

              {activeInvitation.id && (
                <button
                  type="button"
                  onClick={() => handleCancelInvitation(activeInvitation.id!)}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel Invitation</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* PENDING INVITATIONS LIST (if any existing and not active) */}
      {invitations.length > 0 && !activeInvitation && (
        <section className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pending Pairing Invitations ({invitations.length})</span>
            </h3>
            <span className="text-xs font-bold text-amber-700">Expires automatically in 10 min</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl border border-amber-200 bg-white shadow-2xs flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">{inv.deviceName}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Expires {formatRelativeTime(inv.expiresAt)}
                  </p>
                </div>
                {inv.id && (
                  <button
                    type="button"
                    onClick={() => handleCancelInvitation(inv.id!)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    title="Cancel invitation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REGISTERED POS DEVICES LIST */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Registered Devices ({devices.length})
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Multiple POS devices operate concurrently on the same real-time order queue
          </p>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <p className="text-xs font-bold">Loading devices...</p>
          </div>
        ) : devices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => {
              const isActive = device.status === "ACTIVE";
              const isRevoked = device.status === "REVOKED";

              return (
                <article
                  key={device.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all"
                >
                  {/* Card Header: Public ID + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                        <TabletSmartphone className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-950 leading-snug">
                            {device.name}
                          </h3>
                        </div>
                        <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
                          {device.publicId} • {device.type}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${statusDot(device.status)}`} />
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider ${statusClass(
                          device.status
                        )}`}
                      >
                        {device.status}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Last Active
                      </span>
                      <span className="font-bold text-slate-900">
                        {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : "Never"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Registered
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatRelativeTime(device.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    {/* Primary: Get Login Code */}
                    <button
                      type="button"
                      onClick={() => handleGetLoginCode(device)}
                      disabled={generatingCodeDeviceId === device.id}
                      className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                      title="Generate a 10-minute temporary code to log into this iPad register"
                    >
                      {generatingCodeDeviceId === device.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4 stroke-[2.5]" />
                      )}
                      <span>Get Login Code</span>
                    </button>

                    {/* Secondary Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* 1. Rename */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDevice(device);
                          setEditName(device.name);
                        }}
                        className="h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Rename</span>
                      </button>

                    {/* 2. Disable / Activate Toggle */}
                    {!isRevoked ? (
                      isActive ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(device, "DISABLED")}
                          className="h-10 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>Disable</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(device, "ACTIVE")}
                          className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>Activate</span>
                        </button>
                      )
                    ) : (
                      <span className="h-10 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs inline-flex items-center justify-center">
                        Revoked
                      </span>
                    )}

                    {/* 3. Replace Device */}
                    {!isRevoked ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(device)}
                        className="h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Generate pairing invitation to replace this device"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Replace</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteDevice(device)}
                        className="h-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    {/* 4. Revoke */}
                    {!isRevoked ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Revoke permanent credentials for "${device.name}"? This iPad will immediately lose access.`)) {
                            handleUpdateStatus(device, "REVOKED");
                          }
                        }}
                        className="h-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center bg-white space-y-3">
            <TabletSmartphone className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-extrabold text-slate-900">No POS Devices Registered</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click &quot;Add POS Device&quot; to generate a 10-minute temporary registration code and register your restaurant iPad.
            </p>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add First POS Device</span>
            </button>
          </div>
        )}
      </div>

      {/* GENERATE PAIRING INVITATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-black text-slate-950">
                  {replaceTargetDevice ? "Replace POS Device" : "Add New POS Device"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {replaceTargetDevice && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Replacing: {replaceTargetDevice.name} ({replaceTargetDevice.publicId})</span>
                </p>
                <p className="text-amber-700 font-medium">
                  When the new iPad completes pairing, the old device will be automatically revoked.
                </p>
              </div>
            )}

            <form onSubmit={handleGenerateInvitation} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Main Restaurant iPad"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Location / Description (Optional)
                </label>
                <input
                  type="text"
                  value={deviceLocation}
                  onChange={(e) => setDeviceLocation(e.target.value)}
                  placeholder="e.g. Main Register, Bar, Drive-thru"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !deviceName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Generate Registration Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-950">Rename Device</h3>
              <button
                type="button"
                onClick={() => setEditingDevice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Device Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  className="h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
