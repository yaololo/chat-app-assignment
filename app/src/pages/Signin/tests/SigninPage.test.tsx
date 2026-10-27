import { beforeEach, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { useAuthStore } from "@/store/store";
import type { useSignIn } from "@/lib/auth/hooks/useSignIn";

const mutate = jest.fn();
const mockUseSignIn = jest.fn();
jest.doMock("@/lib/auth/hooks/useSignIn", () => ({ useSignIn: mockUseSignIn }));

const { SigninPage } =
  require("../SigninPage") as typeof import("../SigninPage");

const state = (overrides = {}) =>
  mockUseSignIn.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useSignIn>);

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false, restorationError: "" });
  state();
});

const show = (from = "/chat/bob") =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/signin", state: { from } }]}>
      <Routes>
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/chat/bob" element={<p>Bob conversation</p>} />
        <Route path="/chat" element={<p>Chat home</p>} />
      </Routes>
    </MemoryRouter>,
  );

it("validates required fields before submitting credentials", async () => {
  show();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /join chat/i }));

  expect(mutate).not.toHaveBeenCalled();

  await user.type(screen.getByLabelText("Username"), "alice");
  await user.type(screen.getByLabelText("Demo access secret"), "demo-secret");
  await user.click(screen.getByRole("button", { name: /join chat/i }));

  expect(mutate).toHaveBeenCalledWith(
    { username: "alice", secret: "demo-secret" },
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
});
it("disables credentials while signing in", () => {
  state({ isPending: true });
  show();

  expect(screen.getByLabelText("Username")).toBeDisabled();
  expect(screen.getByLabelText("Demo access secret")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: /signing you in/i }),
  ).toBeDisabled();
});
it("shows login and restoration errors", () => {
  state({ error: new Error("Incorrect access secret.") });
  useAuthStore.setState({ restorationError: "Session could not be restored." });
  show();

  expect(screen.getAllByRole("alert")).toHaveLength(2);
  expect(screen.getByText("Incorrect access secret.")).toBeVisible();
});
it("returns authenticated users to their requested chat", () => {
  useAuthStore.setState({ user: { id: "alice", username: "alice" } });
  show();

  expect(screen.getByText("Bob conversation")).toBeVisible();
});
it("rejects external redirect targets", () => {
  useAuthStore.setState({ user: { id: "alice", username: "alice" } });
  show("https://untrusted.example");
  
  expect(screen.getByText("Chat home")).toBeVisible();
});
