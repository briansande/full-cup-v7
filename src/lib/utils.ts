// Utility helpers for Full Cup

export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ');
}

export const isServer = typeof window === "undefined";

export const noop = () => {};

// Example usage:
// import { cn } from '@/src/lib/utils';