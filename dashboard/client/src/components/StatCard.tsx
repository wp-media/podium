/**
 * @file StatCard.tsx
 * @description Displays a key metric with label, icon, value, and optional trend.
 */

import type { LucideIcon } from "lucide-react";
import { Tip } from "./Tip";
import { StatValueSkeleton } from "./Skeleton";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  accentColor?: string;
  /** Raw value shown as tooltip on hover */
  raw?: string;
  /** Show loading skeleton instead of value */
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accentColor = "text-accent",
  raw,
  loading = false,
}: StatCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-border/14 dark:hover:border-border/16 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <span className="section-label truncate">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent/12 dark:bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Icon className={`w-[15px] h-[15px] ${accentColor}`} />
        </div>
      </div>
      {/* Value row */}
      <div className="flex items-end gap-2 min-w-0">
        {loading ? (
          <StatValueSkeleton />
        ) : (
          <Tip raw={raw}>
            <span className="stat-value truncate">{value}</span>
          </Tip>
        )}
        {!loading && trend && (
          <span className="text-xs text-fg-dim mb-0.5 flex-shrink-0">{trend}</span>
        )}
      </div>
    </div>
  );
}
