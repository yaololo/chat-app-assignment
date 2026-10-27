import { useEffect } from "react";
import { useSessionQuery } from "./useSessionQuery";
import { useAuthStore } from "@/store/store";

// Bridges the initial server query into the shared client store; no React context.
export const useInitializeAuth = () => {
  const session = useSessionQuery();
  const setSession = useAuthStore((state) => state.setSession);
  useEffect(() => {
    if (session.isSuccess) setSession(session.data);
    else if (session.isError)
      setSession(
        null,
        "Unable to restore your session. Please try signing in.",
      );
  }, [session.data, session.isSuccess, session.isError, setSession]);
};
