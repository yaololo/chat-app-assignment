import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { getMessages } from "../api";

export const useMessagesQuery = (id: string) => {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["chat", userId, "messages", id],
    // Share the in-flight read across StrictMode remounts.
    queryFn: () => getMessages(id),
    staleTime: Infinity,
    enabled: !!userId && !!id,
    retry: false,
  });
};
