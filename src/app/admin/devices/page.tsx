"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Copy, Edit3, Loader2, Plus, RefreshCw, RotateCcw, ShieldOff, TabletSmartphone } from "lucide-react";
import { Device, DeviceRegistrationCode } from "@/lib/types";
import { formatRelativeTime } from "@/lib/formatters";
import { useToast } from "@/components/ToastContext";

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "INACTIVE") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export default function DevicesPage() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("Main iPad");
  const [registration, setRegistration] = useState<DeviceRegistrationCode | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setDevices(data.data || []);
      else showToast(data.error || "Could not load devices", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const createCode = async (replaceDeviceId?: string, fallbackName?: string) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fallbackName || newName || "Restaurant iPad", type: "POS", replaceDeviceId }),
      });
      const data = await res.json();
      if (data.success) {
        setRegistration(data.data);
        showToast("Registration code generated", "success");
      } else {
        showToast(data.error || "Could not create registration code", "error");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const updateDevice = async (device: Device, patch: Partial<Device>) => {
    const res = await fetch("/api/devices/" + device.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Device updated", "success");
      loadDevices();
    } else {
      showToast(data.error || "Could not update device", "error");
    }
  };

  const renameDevice = (device: Device) => {
    const name = window.prompt("Device name", device.name)?.trim();
    if (name) updateDevice(device, { name } as Partial<Device>);
  };

  const copyCode = async () => {
    if (!registration) return;
    await navigator.clipboard.writeText(registration.code);
    showToast("Registration code copied", "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">Devices / POS</h1>
          <p className="text-sm text-text-muted mt-1">Manage registered restaurant devices and replace the POS iPad without changing source code.</p>
        </div>
        <button onClick={loadDevices} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-bold">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {registration && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">POS registration code</p>
            <p className="text-4xl font-black tracking-widest text-emerald-950 mt-2">{registration.code}</p>
            <p className="text-sm font-semibold text-emerald-800 mt-2">Valid until {new Date(registration.expiresAt).toLocaleTimeString()}.</p>
          </div>
          <button onClick={copyCode} className="h-12 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" /> Copy Code
          </button>
        </section>
      )}

      <section className="bg-surface rounded-xl border border-border p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end justify-between">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">New POS device name</label>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} className="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <button onClick={() => createCode()} disabled={isCreating} className="h-12 px-5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Register New Device
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {devices.map((device) => (
            <article key={device.id} className="bg-surface rounded-xl border border-border p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center"><TabletSmartphone className="w-6 h-6" /></div>
                  <div>
                    <h2 className="text-lg font-black text-text-main">{device.name}</h2>
                    <p className="text-xs font-semibold text-text-muted">Device ID: {device.publicId}</p>
                    <p className="text-xs text-text-muted mt-1">Last seen: {device.lastSeenAt ? formatRelativeTime(device.lastSeenAt) : "Never"}</p>
                  </div>
                </div>
                <span className={"px-3 py-1 rounded-full border text-xs font-black " + statusClass(device.status)}>{device.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-text-muted">
                <div className="rounded-lg bg-surface-subtle p-3"><span className="block font-bold text-text-main">Type</span>{device.type}</div>
                <div className="rounded-lg bg-surface-subtle p-3"><span className="block font-bold text-text-main">Created</span>{formatRelativeTime(device.createdAt)}</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button onClick={() => renameDevice(device)} className="h-11 rounded-lg border border-border hover:bg-surface-hover font-bold text-sm inline-flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" /> Rename</button>
                <button onClick={() => updateDevice(device, { status: device.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } as Partial<Device>)} className="h-11 rounded-lg border border-border hover:bg-surface-hover font-bold text-sm">{device.status === "ACTIVE" ? "Disable" : "Activate"}</button>
                <button onClick={() => createCode(device.id, device.name)} className="h-11 rounded-lg border border-border hover:bg-surface-hover font-bold text-sm inline-flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Replace</button>
                <button onClick={() => updateDevice(device, { status: "REVOKED" } as Partial<Device>)} className="h-11 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm inline-flex items-center justify-center gap-2"><ShieldOff className="w-4 h-4" /> Revoke</button>
              </div>
            </article>
          ))}
          {devices.length === 0 && <div className="lg:col-span-2 rounded-xl border-2 border-dashed border-border p-12 text-center text-text-muted font-bold">No registered devices yet.</div>}
        </div>
      )}
    </div>
  );
}
