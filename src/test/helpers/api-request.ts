/** Builds a Web API Request with a JSON body, as Next.js route handlers receive it. */
export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Builds a plain Request with query string params, for GET/DELETE handlers that read searchParams. */
export function urlRequest(path: string, params: Record<string, string> = {}): Request {
  const url = new URL(path, 'http://localhost');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url, { method: 'GET' });
}

/** Wraps a dynamic route's params in the Promise shape Next.js 15+ passes to handlers. */
export function routeParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
