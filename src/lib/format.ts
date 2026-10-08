export function formatINR(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  const amount = Number(value || 0);
  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    ...options,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}

export function formatNumber(value: number | null | undefined): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
