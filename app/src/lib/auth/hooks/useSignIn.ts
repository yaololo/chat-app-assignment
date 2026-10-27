import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "../api";
import { sessionKey } from "../query-keys";
import { useAuthStore } from "@/store/store";

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
