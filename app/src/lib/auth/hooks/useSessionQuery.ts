import { useQuery } from "@tanstack/react-query";
import { getSession } from "../api";
import { sessionKey } from "../query-keys";

export const useSessionQuery = () =>
  useQuery({
    queryKey: sessionKey,
    // Keep this read-only request alive across StrictMode's temporary unmount.
    // TanStack Query can then share it with the remounted observer.
    // Explicit cancelQueries on login/logout still discards stale query results.
    queryFn: () => getSession(),
    // Restore once per page load; route changes should not trigger another request.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
