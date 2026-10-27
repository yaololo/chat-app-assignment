import { beforeEach, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { useAuthStore } from "@/store/store";
import type { useSignOut } from "@/lib/auth/hooks/useSignOut";

const mutate = jest.fn();
const mockUseSignOut = jest.fn();
jest.doMock("@/lib/auth/hooks/useSignOut", () => ({
  useSignOut: mockUseSignOut,
}));
const { PageLayout } =
  require("../PageLayout") as typeof import("../PageLayout");

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false, restorationError: "" });
  mockUseSignOut.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useSignOut>);
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route element={<PageLayout />}>
          <Route path="/chat" element={<p>Chat content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
it("shows header and footer while holding content during session restoration", () => {
  useAuthStore.setState({ loading: true });
  show();
  expect(screen.getByRole("banner")).toBeVisible();
  expect(screen.getByRole("contentinfo")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Restoring");
  expect(screen.queryByText("Chat content")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Log out" }),
  ).not.toBeInTheDocument();
});
it("shows logout only for signed-in users and invokes the mutation", async () => {
  useAuthStore.setState({ user: { id: "alice", username: "alice" } });
  show();
  expect(screen.getByText("Chat content")).toBeVisible();

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Log out" }));

  expect(mutate).toHaveBeenCalledTimes(1);
});
it("shows logout failures and disables the button while pending", () => {
  useAuthStore.setState({ user: { id: "alice", username: "alice" } });
  mockUseSignOut.mockReturnValue({
    mutate,
    isPending: true,
    error: new Error("Logout failed"),
  } as unknown as ReturnType<typeof useSignOut>);
  show();
  
  expect(screen.getByRole("alert")).toHaveTextContent("Logout failed");
  expect(screen.getByRole("button", { name: /signing out/i })).toBeDisabled();
});
