export function paginate({ page = 1, limit = 12 } = {}, maxLimit = 50) {
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, Number.parseInt(limit, 10) || 12));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function pageResult(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escape user input before building a RegExp (prevents ReDoS / regex injection). */
export function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
