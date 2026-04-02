import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return "0";
  }
  return new Intl.NumberFormat().format(value);
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export function timeAgo(value?: string | null): string {
  if (!value) {
    return "unknown";
  }

  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = Math.max(now - then, 0);
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export function formatSourceLabel(source: string): string {
  if (source.toLowerCase() === "api") {
    return "API";
  }
  return source.replaceAll("_", " ");
}
