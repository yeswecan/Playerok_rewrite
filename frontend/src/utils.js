/**
 * Conditionally join CSS class names together
 * Utility for conditional className joining
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
} 