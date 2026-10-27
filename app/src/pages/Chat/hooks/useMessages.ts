import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { getMessages } from "./api";

export const useMessages = (id: string) => {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["chat", userId, "messages", id],
    queryFn: ({ signal }) => getMessages(id, signal),
    enabled: !!userId && !!id,
    refetchInterval: 3000,
    retry: false,
  });
};
