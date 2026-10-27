import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { sendMessage, type Message } from "./api";
import { mergeMessage } from "./message-cache";

export const useSendMessage = (id: string) => {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  return useMutation({
    mutationFn: (content: string) => sendMessage(id, content),
    retry: false,
    onSuccess: ({ message }) => {
      // The socket notification owns the refresh. The POST result provides
      // immediate feedback even if that notification is delayed or missed.
      client.setQueryData<{ messages: Message[] }>(
        ["chat", userId, "messages", id],
        (cached) =>
          cached
            ? { messages: mergeMessage(cached.messages, message) }
            : cached,
      );
    },
  });
};
