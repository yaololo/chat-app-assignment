import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout } from "../api";
import { sessionKey } from "../query-keys";
import { useAuthStore } from "@/store/store";

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
