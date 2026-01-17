"use client";

import type { ChangeEvent } from "react";

const sortOptions = [
  { value: "added", label: "Date Added" },
  { value: "created", label: "Date Created" },
  { value: "opened", label: "Date Last Opened" },
  { value: "invoice", label: "Invoice Date" },
  { value: "name", label: "Name" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

export default function DashboardSortControl({
  defaultSort = "invoice",
}: {
  defaultSort?: SortValue;
}) {
  const currentSort = sortOptions.some((option) => option.value === defaultSort)
    ? defaultSort
    : "invoice";
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const form = event.currentTarget.form;
    if (!form) return;
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.submit();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sort by
      </span>
      <div className="relative min-w-[190px]">
        <select
          name="sort"
          defaultValue={currentSort}
          onChange={handleChange}
          className="appearance-none rounded-xl border border-zinc-700 bg-zinc-800 text-white shadow-sm px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-[#7a67e7] focus:border-transparent"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
