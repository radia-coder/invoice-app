"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const sortOptions = [
  { value: "added", label: "Date Added" },
  { value: "created", label: "Date Created" },
  { value: "opened", label: "Date Last Opened" },
  { value: "name", label: "Name" },
] as const;

type SortValue = (typeof sortOptions)[number]["value"];

export default function DashboardSortControl({
  defaultSort = "added",
}: {
  defaultSort?: SortValue;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramSort = searchParams.get("sort") as SortValue | null;
  const currentSort =
    paramSort && sortOptions.some((option) => option.value === paramSort)
      ? paramSort
      : defaultSort;

  const handleChange = (value: SortValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Sort by
      </span>
      <div className="relative">
        <select
          name="sort"
          value={currentSort}
          onChange={(event) => handleChange(event.target.value as SortValue)}
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
