import { useAuthStore } from "@/store/store";
import type { User } from "@/lib/auth/api";
export type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export class ChatApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/chat${path}`, {
    ...options,
    credentials: "same-origin",
  });
  if (response.status === 401) useAuthStore.getState().setSession(null);
  const data = await response.json();
  if (!response.ok)
    throw new ChatApiError(
      data.error ?? "Unable to load chat. Please try again.",
      response.status,
    );
  return data;
};

export const getUsers = (signal?: AbortSignal) =>
  request<{ users: User[] }>("/users", { signal });

export const getMessages = (id: string, signal?: AbortSignal) =>
  request<{ messages: Message[] }>(
    `/users/${encodeURIComponent(id)}/messages`,
    { signal },
  );

export const sendMessage = (id: string, content: string) =>
  request<{ message: Message }>(`/users/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
