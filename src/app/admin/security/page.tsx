"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Mail,
  Globe,
  Laptop,
  Loader2,
  Trash2,
  KeyRound,
  RefreshCw,
  X,
  CheckCircle2,
} from "lucide-react";

import { adminFetch } from "@/lib/adminFetch";

interface AdminProfile {
  id: string;
  email: string;
  adminAccessPath: string;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export default function AdminSecurityPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Email update modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailCurrentPass, setEmailCurrentPass] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passCurrent, setPassCurrent] = useState("");
  const [passNew, setPassNew] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  // Access path state
  const [pathCurrentPass, setPathCurrentPass] = useState("");
  const [newAccessPath, setNewAccessPath] = useState("");
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState("");
  const [pathSuccess, setPathSuccess] = useState("");

  // Session revocation state
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionsMsg, setSessionsMsg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, sessionsRes] = await Promise.all([
        adminFetch("/api/auth/me"),
        adminFetch("/api/admin/account/sessions"),
      ]);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        setProfile(pData.data);
        setNewAccessPath(pData.data.adminAccessPath || "");
      }

      if (sessionsRes.ok) {
        const sData = await sessionsRes.json();
        setSessions(sData.data || []);
      }
    } catch (err) {
      console.error("Failed to load security dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCurrentPass || !newEmail) {
      setEmailError("Please provide your current password and new email address.");
      return;
    }

    try {
      setEmailLoading(true);
      setEmailError("");
      setEmailSuccess("");

      const res = await fetch("/api/admin/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: emailCurrentPass,
          newEmail: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmailSuccess("Administrator email updated successfully!");
        setProfile((prev) => (prev ? { ...prev, email: data.data.email } : prev));
        setTimeout(() => {
          setEmailModalOpen(false);
          setEmailCurrentPass("");
          setNewEmail("");
          setEmailSuccess("");
        }, 1500);
        fetchData();
      } else {
        setEmailError(data.error || "Failed to update email address.");
      }
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCurrent || !passNew || !passConfirm) {
      setPassError("Please fill in all password fields.");
      return;
    }
    if (passNew !== passConfirm) {
      setPassError("New password and confirmation do not match.");
      return;
    }
    if (passNew.length < 8) {
      setPassError("New password must be at least 8 characters long.");
      return;
    }

    try {
      setPassLoading(true);
      setPassError("");
      setPassSuccess("");

      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passCurrent,
          newPassword: passNew,
          confirmPassword: passConfirm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPassSuccess("Password changed successfully! All other computer sessions signed out.");
        setPassCurrent("");
        setPassNew("");
        setPassConfirm("");
        setTimeout(() => {
          setIsChangingPassword(false);
          setPassSuccess("");
        }, 2000);
        fetchData();
      } else {
        setPassError(data.error || "Failed to change password.");
      }
    } catch {
      setPassError("Network error. Please try again.");
    } finally {
      setPassLoading(false);
    }
  };

  const handleAccessPathChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathCurrentPass || !newAccessPath) {
      setPathError("Please enter your current password and desired access path.");
      return;
    }

    try {
      setPathLoading(true);
      setPathError("");
      setPathSuccess("");

      const res = await fetch("/api/admin/account/access-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pathCurrentPass,
          newAccessPath: newAccessPath.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPathSuccess(data.message || "Admin access path updated successfully!");
        setProfile((prev) => (prev ? { ...prev, adminAccessPath: data.data.adminAccessPath } : prev));
        setPathCurrentPass("");
        fetchData();
      } else {
        setPathError(data.error || "Failed to update access path.");
      }
    } catch {
      setPathError("Network error. Please try again.");
    } finally {
      setPathLoading(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm("Are you sure you want to sign out all other connected computers and sessions?")) {
      return;
    }

    try {
      setRevokingSessions(true);
      setSessionsMsg("");

      const res = await fetch("/api/admin/account/sessions", {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setSessionsMsg("All other sessions have been successfully revoked.");
        fetchData();
      } else {
        setSessionsMsg(data.error || "Failed to revoke sessions.");
      }
    } catch {
      setSessionsMsg("Network error revoking sessions.");
    } finally {
      setRevokingSessions(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-orange-600" />
            <span>Account &amp; Security</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            Manage administrator credentials, entry obfuscation paths, and active computers.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : "text-slate-500"}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !profile ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2 text-orange-600" />
          <span>Loading security settings...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
          {/* 1. Administrator Email Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-2xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Administrator Email
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Used for primary sign-in and security dispatch alerts
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Current Registered Email
                </span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {profile?.email || "admin@lovekitchen.ma"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmailError("");
                setEmailSuccess("");
                setEmailCurrentPass("");
                setNewEmail("");
                setEmailModalOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 text-slate-800 hover:text-orange-700 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5 text-orange-600" />
              <span>Update Email Address</span>
            </button>
          </div>

          {/* 2. Admin Entry Path Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-2xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Admin Entry Path
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Custom obfuscated URL path for owner access
                  </p>
                </div>
              </div>

              {pathError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {pathError}
                </div>
              )}
              {pathSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                  {pathSuccess}
                </div>
              )}

              <form onSubmit={handleAccessPathChange} id="access-path-form" className="space-y-3.5 mb-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Custom Access Path
                  </label>
                  <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all shadow-2xs">
                    <span className="text-slate-400 font-mono font-bold select-none mr-1">/</span>
                    <input
                      type="text"
                      value={newAccessPath}
                      onChange={(e) => setNewAccessPath(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="lovekitchen"
                      required
                      className="w-full bg-transparent text-slate-900 font-mono font-bold focus:outline-none text-sm placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm Current Password
                  </label>
                  <input
                    type="password"
                    value={pathCurrentPass}
                    onChange={(e) => setPathCurrentPass(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </form>
            </div>

            <button
              type="submit"
              form="access-path-form"
              disabled={pathLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {pathLoading ? "Saving Changes..." : "Save Custom Access URL"}
            </button>
          </div>

          {/* 3. Change Admin Password Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-2xs">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Change Admin Password
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requires current password and invalidates other open computer sessions
                  </p>
                </div>
              </div>

              {passError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {passError}
                </div>
              )}
              {passSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                  {passSuccess}
                </div>
              )}

              {!isChangingPassword ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 mb-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Password is Active &amp; Secured
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Updated credentials take effect across all terminals immediately
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passCurrent}
                      onChange={(e) => setPassCurrent(e.target.value)}
                      placeholder="Enter current password"
                      required
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      New Password (min. 8 characters)
                    </label>
                    <input
                      type="password"
                      value={passNew}
                      onChange={(e) => setPassNew(e.target.value)}
                      placeholder="New strong password"
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passConfirm}
                      onChange={(e) => setPassConfirm(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPassCurrent("");
                        setPassNew("");
                        setPassConfirm("");
                        setPassError("");
                      }}
                      className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passLoading}
                      className="w-2/3 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {passLoading ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {!isChangingPassword && (
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(true);
                  setPassError("");
                  setPassSuccess("");
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 text-slate-800 hover:text-orange-700 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                <span>Change Password</span>
              </button>
            )}
          </div>

          {/* 4. Connected Sessions Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Connected Sessions
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Computers currently signed in to the administrator dashboard
                  </p>
                </div>
              </div>

              {sessionsMsg && (
                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium">
                  {sessionsMsg}
                </div>
              )}

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 mb-5">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No active sessions detected.</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        s.isCurrent
                          ? "bg-emerald-50/70 border-emerald-200"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <span>{s.userAgent?.slice(0, 38) || "Unknown Browser"}</span>
                          {s.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                              This PC
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px] font-medium block mt-1">
                          IP: {s.ipAddress || "127.0.0.1"} • Active: {new Date(s.lastActiveAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRevokeOtherSessions}
              disabled={revokingSessions}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign Out All Other Computers</span>
            </button>
          </div>
        </div>
      )}

      {/* Email Update Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Change Administrator Email
              </h3>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {emailError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                {emailSuccess}
              </div>
            )}

            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={emailCurrentPass}
                  onChange={(e) => setEmailCurrentPass(e.target.value)}
                  placeholder="Enter current password"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new-admin@lovekitchen.ma"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-white text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs placeholder:text-slate-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {emailLoading ? "Updating..." : "Update Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
