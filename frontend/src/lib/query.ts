/** URLSearchParams as a router `query` object: repeated keys become arrays, order kept. */
export function searchParamsToQuery(
  params: URLSearchParams,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of params) {
    const existing = query[key];
    if (existing === undefined) query[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else query[key] = [existing, value];
  }
  return query;
}
