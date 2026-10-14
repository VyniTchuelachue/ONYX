import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** First letters of the first and last words: "Garage Akwa Auto" → "GA", "Vulcanisation Ndokoti 24/7" → "VN". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w[0] ?? ''));
  if (!words.length) return '?';
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}
