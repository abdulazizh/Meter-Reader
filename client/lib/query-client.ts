import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { configService } from "./config-service";

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export async function getApiUrl(): Promise<string> {
  try {
    // Get server domain from ConfigService (which uses AsyncStorage)
    const host = await configService.getServerDomain();

    if (!host) {
      return "https://meter-reader-backend.onrender.com/";
    }

    // Clean brackets if user accidentally included them (common mistake with IPv6 vs IPv4)
    const cleanHost = host.replace(/[\[\]]/g, '');

    // Check if host already includes protocol
    if (cleanHost.startsWith('http://') || cleanHost.startsWith('https://')) {
      return cleanHost;
    }

    // Use http for localhost, IP addresses, or .local domains
    const isIpOrLocalhost = cleanHost.includes("localhost") || 
                            /^\d+\.\d+\.\d+\.\d+/.test(cleanHost) ||
                            cleanHost.includes(".local");
    const protocol = isIpOrLocalhost ? "http" : "https";
    
    const url = new URL(`${protocol}://${cleanHost}`);
    return url.href;
  } catch (error) {
    console.warn("Failed to parse API URL, falling back to default:", error);
    return "https://meter-reader-backend.onrender.com/";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok && res.status !== 401 && res.status !== 400 && res.status !== 422) {
    const text = (await res.text()) || res.statusText;
    console.error(`API Error (${res.status}):`, text);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = await getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include cookies for session support
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`[API FETCH ERROR] URL: ${url}, Method: ${method}, Error:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = await getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      headers: {},
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
