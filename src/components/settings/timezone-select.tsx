"use client";

import { useState, useTransition } from "react";
import { setTimezone } from "@/lib/settings/actions";
import { offsetLabel } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { inputCls } from "./controls";

/** Exchange timezones first, then every zone the runtime knows. */
const common = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Australia/Sydney",
  "UTC",
];

/** `zones` comes from the server so server and browser render the same option list. */
export function TimezoneSelect({ value, zones }: { value: string; zones: string[] }) {
  const [tz, setTz] = useState(value);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = zones.filter((z) => !common.includes(z));

  return (
    <div className="flex flex-col gap-2 px-4 pb-4 pt-1">
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Trading timezone"
          value={tz}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            setTz(next);
            setStatus(null);
            start(async () => {
              const res = await setTimezone(next);
              setStatus(res.ok ? "Saved" : res.error);
            });
          }}
          className={cn(inputCls, "h-8 min-w-72")}
        >
          <optgroup label="Common">
            {common.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")} ({offsetLabel(z)})
              </option>
            ))}
          </optgroup>
          <optgroup label="All timezones">
            {all.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="text-[12px] text-faint" aria-live="polite">
          {pending ? "Saving…" : status}
        </span>
      </div>
      <p className="text-[12px] text-faint">
        Decides which day a trade belongs to, the hours on the dashboard, and how times in imported CSV files are read.
        Use your exchange&apos;s timezone (New York for US stocks and CME futures) so overnight sessions stay on the right day.
      </p>
    </div>
  );
}
