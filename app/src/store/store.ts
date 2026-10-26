import { create } from "zustand";
import type { User } from "../lib/auth/api";

type AuthState = {
  user: User | null;
  loading: boolean;
  restorationError: string;
  setSession: (user: User | null, error?: string) => void;
};

// Profile state is memory-only. The browser manages the HttpOnly auth cookie.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  restorationError: "",
  setSession: (user, error = "") =>
    set({ user, loading: false, restorationError: error }),
}));
