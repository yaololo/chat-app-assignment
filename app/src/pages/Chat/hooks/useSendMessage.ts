import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { sendMessage } from "./api";

export const useSendMessage = (id: string) => {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  return useMutation({
    mutationFn: (content: string) => sendMessage(id, content),
    retry: false,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["chat", userId, "messages", id] }),
  });
};
