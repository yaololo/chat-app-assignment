import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useAuthStore } from "@/store/store";
import { sessionKey } from "@/lib/auth/queries";
import { mergeMessage } from "./message-cache";
import type { Message } from "./api";

export const useRealtime = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const socket = io({ transports: ["websocket"], autoConnect: false });
    let firstConnection = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const expire = () => {
      socket.disconnect();
      client.setQueryData(sessionKey, null);
      useAuthStore.getState().setSession(null);
      client.removeQueries({ queryKey: ["chat", userId] });
    };
    socket.on("connect", () => {
      setConnected(true);
      // Initial queries mount only after subscriptions are ready. Reconnects
      // refresh existing observers to recover events missed while disconnected.
      void client.invalidateQueries({
        queryKey: ["chat", userId],
        refetchType: firstConnection ? "none" : "active",
      });
      firstConnection = false;
      setReady(true);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (error) => {
      setConnected(false);
      if (
        (error as Error & { data?: { code?: string } }).data?.code ===
        "UNAUTHORIZED"
      ) {
        expire();
      } else if (!socket.active) {
        // Middleware failures (e.g. a temporary DB outage) are not auto-retried.
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => socket.connect(), 3000);
      }
    });
    socket.on("auth:expired", expire);
    socket.on("users:changed", () => {
      void client.invalidateQueries({ queryKey: ["chat", userId, "users"] });
    });
    socket.on(
      "messages:changed",
      (event: { userId: string; message: Message }) => {
        client.setQueryData<{ messages: Message[] }>(
          ["chat", userId, "messages", event.userId],
          (cached) =>
            cached
              ? { messages: mergeMessage(cached.messages, event.message) }
              : cached,
        );
      },
    );
    // StrictMode immediately cleans up its first development effect. Defer the
    // handshake so that discarded effect cannot open and abort a proxied socket.
    const connectTimer = setTimeout(() => socket.connect(), 0);
    return () => {
      clearTimeout(connectTimer);
      clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [client, userId]);
  return { connected, ready };
};
