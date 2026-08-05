import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names and resolves Tailwind conflicts, last one winning.
 *
 * This is what lets every component accept a `className` prop that can
 * genuinely override its defaults — `cn('bg-primary', 'bg-danger')` yields
 * `bg-danger` rather than an ambiguous pair.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
