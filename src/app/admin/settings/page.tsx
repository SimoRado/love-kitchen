"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Store,
  Clock,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Building,
  Phone,
  MapPin,
  Coins,
} from "lucide-react";
import LoadingState from "@/components/LoadingState";
import { RestaurantSettings, OpeningHour } from "@/lib/types";
import { useToast } from "@/components/ToastContext";

const ORDERED_DAYS = [
  { dayOfWeek: 1, name: "Monday" },
  { dayOfWeek: 2, name: "Tuesday" },
  { dayOfWeek: 3, name: "Wednesday" },
  { dayOfWeek: 4, name: "Thursday" },
  { dayOfWeek: 5, name: "Friday" },
  { dayOfWeek: 6, name: "Saturday" },
  { dayOfWeek: 0, name: "Sunday" },
];

export default function SettingsPage() {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("MAD");
  const [isOpenOverride, setIsOpenOverride] = useState<boolean | null>(null);
  const [isAutoHours, setIsAutoHours] = useState(true);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success && data.data) {
        const s: RestaurantSettings = data.data;
        setName(s.name || "");
        setPhone(s.phone || "");
        setAddress(s.address || "");
        setCurrency(s.currency || "MAD");
        setIsOpenOverride(s.isOpenOverride);
        setIsAutoHours(s.isAutoHours ?? true);

        // Sort opening hours according to Monday -> Sunday
        const hoursList = s.openingHours || [];
        const sorted = ORDERED_DAYS.map((d) => {
          const match = hoursList.find((h) => h.dayOfWeek === d.dayOfWeek);
          return (
            match || {
              id: "",
              dayOfWeek: d.dayOfWeek,
              dayName: d.name,
              openTime: "09:00",
              closeTime: "23:00",
              isClosed: false,
              settingsId: "default",
            }
          );
        });
        setOpeningHours(sorted);
      } else {
        showToast(data.error || "Failed to load restaurant settings", "error");
      }
    } catch {
      showToast("Network error loading settings", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleHourChange = (
    index: number,
    field: "openTime" | "closeTime" | "isClosed",
    value: string | boolean
  ) => {
    setOpeningHours((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Restaurant name cannot be empty.", "error");
      return;
    }
    if (isSaving) return;

    try {
      setIsSaving(true);
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        currency: currency.trim() || "MAD",
        isOpenOverride,
        isAutoHours,
        openingHours,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Restaurant settings saved successfully.", "success");
      } else {
        showToast(data.error || "Could not update settings.", "error");
      }
    } catch {
      showToast("Network error saving settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading restaurant configuration..." />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-main tracking-tight">
            Restaurant Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Configure business identity, operating status, currency, and opening hours
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save All Settings</span>
            </>
          )}
        </button>
      </div>

      {/* 1. General Restaurant Information */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-xs space-y-5">
        <div className="border-b border-border pb-4">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            General Information
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Basic details shown on tickets, customer receipts, and store headers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Restaurant Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Restaurant Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Le Bistro Gourmet"
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Contact Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+212 522 123456"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Physical Street Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 72 Boulevard Massira Khadra, Casablanca"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1.5">
              Store Currency
            </label>
            <div className="relative">
              <Coins className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="MAD, USD, EUR, etc."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border text-sm bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              Default currency code applied across orders and receipts (e.g. MAD).
            </p>
          </div>
        </div>
      </div>

      {/* 2. Restaurant Operating Mode & Override */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-xs space-y-5">
        <div className="border-b border-border pb-4">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            Store Operational Status
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Control whether customer ordering is active or paused
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Option 1: Automatic Schedule */}
          <button
            type="button"
            onClick={() => setIsOpenOverride(null)}
            className={`p-4 rounded-xl border text-left transition-all ${
              isOpenOverride === null
                ? "border-primary bg-primary-light ring-2 ring-primary/20"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-primary tracking-wider">
                Automatic
              </span>
              {isOpenOverride === null && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </div>
            <h4 className="text-sm font-bold text-text-main">
              Follow Schedule
            </h4>
            <p className="text-xs text-text-muted mt-1">
              Store automatically opens and closes according to daily opening hours.
            </p>
          </button>

          {/* Option 2: Force Open */}
          <button
            type="button"
            onClick={() => setIsOpenOverride(true)}
            className={`p-4 rounded-xl border text-left transition-all ${
              isOpenOverride === true
                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-emerald-700 tracking-wider">
                Manual Override
              </span>
              {isOpenOverride === true && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <h4 className="text-sm font-bold text-text-main">
              Force Open Now
            </h4>
            <p className="text-xs text-text-muted mt-1">
              Accept orders immediately regardless of current scheduled hours.
            </p>
          </button>

          {/* Option 3: Force Closed */}
          <button
            type="button"
            onClick={() => setIsOpenOverride(false)}
            className={`p-4 rounded-xl border text-left transition-all ${
              isOpenOverride === false
                ? "border-red-500 bg-red-50 ring-2 ring-red-500/20"
                : "border-border bg-surface hover:bg-surface-hover"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-red-700 tracking-wider">
                Manual Override
              </span>
              {isOpenOverride === false && (
                <CheckCircle2 className="w-4 h-4 text-red-600" />
              )}
            </div>
            <h4 className="text-sm font-bold text-text-main">
              Force Closed Now
            </h4>
            <p className="text-xs text-text-muted mt-1">
              Temporarily pause all incoming customer orders immediately.
            </p>
          </button>
        </div>
      </div>

      {/* 3. Opening Hours Schedule */}
      <div className="bg-surface rounded-xl border border-border p-6 shadow-xs space-y-5">
        <div className="border-b border-border pb-4">
          <h2 className="text-base font-bold text-text-main flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Weekly Opening Hours
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Set opening and closing times for each day of the week
          </p>
        </div>

        <div className="divide-y divide-border">
          {openingHours.map((hour, idx) => {
            return (
              <div
                key={hour.dayOfWeek}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Day name */}
                <div className="w-36 font-bold text-sm text-text-main flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>{hour.dayName}</span>
                </div>

                {/* Times or Closed */}
                <div className="flex-1 flex flex-wrap items-center gap-3">
                  {!hour.isClosed ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hour.openTime}
                        onChange={(e) =>
                          handleHourChange(idx, "openTime", e.target.value)
                        }
                        className="px-3 py-1.5 rounded-lg border border-border text-xs bg-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <span className="text-xs text-text-muted font-bold">
                        to
                      </span>
                      <input
                        type="time"
                        value={hour.closeTime}
                        onChange={(e) =>
                          handleHourChange(idx, "closeTime", e.target.value)
                        }
                        className="px-3 py-1.5 rounded-lg border border-border text-xs bg-surface font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                      Closed All Day
                    </span>
                  )}
                </div>

                {/* Closed All Day Toggle */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-text-muted cursor-pointer">
                    Closed all day
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleHourChange(idx, "isClosed", !hour.isClosed)
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      hour.isClosed ? "bg-red-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        hour.isClosed ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Button Bar */}
      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Restaurant Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
