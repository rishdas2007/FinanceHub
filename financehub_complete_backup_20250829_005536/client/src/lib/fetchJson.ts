// Enhanced fetch utility to handle 304 Not Modified responses
export async function fetchJsonWith304(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    headers: { 
      Accept: 'application/json', 
      ...(init?.headers || {}) 
    },
    ...init,
  });

  if (res.status === 304) {
    // Signal React Query to keep existing data
    const err = new Error('NOT_MODIFIED');
    (err as any).__notModified = true;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}

// Standard fetch utility for non-cached endpoints
export async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    headers: { 
      Accept: 'application/json', 
      ...(init?.headers || {}) 
    },
    ...init,
  });

  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return res.json();
}