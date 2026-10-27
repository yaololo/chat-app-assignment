import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/store";
import { getUsers } from "../api";

export const useUsersQuery = () => {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["chat", userId, "users"],
    // Share the in-flight read across StrictMode remounts.
    queryFn: () => getUsers(),
    staleTime: Infinity,
    enabled: !!userId,
    retry: false,
  });
};
