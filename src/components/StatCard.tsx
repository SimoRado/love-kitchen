import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badgeText?: string;
  badgeType?: "success" | "warning" | "neutral";
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary-light",
  badgeText,
  badgeType = "neutral",
}: StatCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-text-main mt-1 tracking-tight">
            {value}
          </h3>
        </div>
        <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || badgeText) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {subtitle && <span className="text-text-muted">{subtitle}</span>}
          {badgeText && (
            <span
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${
                badgeType === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : badgeType === "warning"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
