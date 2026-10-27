import { beforeEach, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { useAuthStore } from "@/store/store";
import type { useUsersQuery } from "../hooks/useUsersQuery";

const refetch = jest.fn();
const mockUseUsersQuery = jest.fn();
jest.doMock("../hooks/useUsersQuery", () => ({
  useUsersQuery: mockUseUsersQuery,
}));
const { UserSidebar } =
  require("../UserSidebar") as typeof import("../UserSidebar");

const usersState = (overrides = {}) =>
  mockUseUsersQuery.mockReturnValue({
    data: {
      users: [
        { id: "bob", username: "bob" },
        { id: "carol", username: "carol" },
      ],
    },
    isPending: false,
    isError: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useUsersQuery>);

beforeEach(() => {
  useAuthStore.setState({
    user: { id: "alice", username: "alice" },
    loading: false,
    restorationError: "",
  });
  usersState();
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <UserSidebar />
      <Routes>
        <Route path="/chat/:id" element={<p>Selected conversation</p>} />
        <Route path="/chat" element={<p>Choose a conversation</p>} />
      </Routes>
    </MemoryRouter>,
  );

it("renders the current user and user links", () => {
  show();

  expect(screen.getByText("Signed in as")).toHaveTextContent("alice");
  expect(screen.getByRole("link", { name: /bob/i })).toHaveAttribute(
    "href",
    "/chat/bob",
  );
  expect(screen.getByRole("link", { name: /carol/i })).toHaveAttribute(
    "href",
    "/chat/carol",
  );
});

it("filters users case-insensitively and navigates to a selected user", async () => {
  show();
  const user = userEvent.setup();

  await user.type(screen.getByRole("textbox", { name: "Search users" }), "BO");

  expect(screen.getByRole("link", { name: /bob/i })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /carol/i }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("link", { name: /bob/i }));

  expect(screen.getByText("Selected conversation")).toBeVisible();
  expect(screen.getByRole("link", { name: /bob/i })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

it("shows empty states for no matches and no other registered users", async () => {
  const view = show();
  await userEvent
    .setup()
    .type(screen.getByRole("textbox", { name: "Search users" }), "nobody");
  expect(screen.getByText("No users match your search.")).toBeVisible();

  view.unmount();
  usersState({ data: { users: [] } });
  show();

  expect(screen.getByText(/No other users yet/)).toBeVisible();
});

it("shows loading and error states and retries a failed request", async () => {
  usersState({ data: undefined, isPending: true });
  const view = show();
  expect(screen.getByRole("status")).toHaveTextContent("Loading people");

  view.unmount();
  usersState({
    data: undefined,
    isError: true,
    error: new Error("Cannot load users"),
  });
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("Cannot load users");

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Try again" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
