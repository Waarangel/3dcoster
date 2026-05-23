// Format a quote number as Q-NNNN (D-05)
export function formatQuoteNumber(n: number): string {
  return 'Q-' + String(n).padStart(4, '0');
}

// Generate an ASCII-safe filename slug from a customer name (D-11)
export function customerNameSlug(name?: string): string {
  if (!name) return '';
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug;
}
