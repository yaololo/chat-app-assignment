import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { getUsers } from "./api";

export const useUsers = () => {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["chat", userId, "users"],
    queryFn: ({ signal }) => getUsers(signal),
    enabled: !!userId,
    refetchInterval: 10000,
    retry: false,
  });
};
