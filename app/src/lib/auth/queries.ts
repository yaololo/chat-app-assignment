import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession, login, logout } from "./api";
import { useAuthStore } from "../../store/store";

export const sessionKey = ["auth", "session"] as const;

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

export const useSignIn = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ username, secret }: { username: string; secret: string }) =>
      login(username, secret),
    retry: false,
    onMutate: async () => {
      // An older /me response must not overwrite the newly authenticated user.
      await client.cancelQueries({ queryKey: sessionKey });
    },
    onSuccess: (user) => {
      client.setQueryData(sessionKey, user);
      useAuthStore.getState().setSession(user);
    },
  });
};

export const useSignOut = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    retry: false,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: sessionKey });
    },
    onSuccess: async () => {
      // Clear cached private data before another account signs in.
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      client.setQueryData(sessionKey, null);
      useAuthStore.getState().setSession(null);
    },
  });
};
