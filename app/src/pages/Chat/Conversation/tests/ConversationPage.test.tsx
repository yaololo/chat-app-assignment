import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, jest } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router";
import { useAuthStore } from "@/store/store";
import type { useUsersQuery } from "../../hooks/useUsersQuery";
import type { useMessagesQuery } from "../../hooks/useMessagesQuery";
import type { useSendMessage } from "../../hooks/useSendMessage";
const mutate =
  jest.fn<(content: string, options: { onSuccess: () => void }) => void>();
const refetch = jest.fn();
const mockUseUsersQuery = jest.fn();
const mockUseMessagesQuery = jest.fn();
const mockUseSendMessage = jest.fn();
jest.doMock("../../hooks/useUsersQuery", () => ({
  useUsersQuery: mockUseUsersQuery,
}));
jest.doMock("../../hooks/useMessagesQuery", () => ({
  useMessagesQuery: mockUseMessagesQuery,
}));
jest.doMock("../../hooks/useSendMessage", () => ({
  useSendMessage: mockUseSendMessage,
}));
const { ConversationPage } =
  require("../ConversationPage") as typeof import("../ConversationPage");
const messageState = (overrides = {}) =>
  mockUseMessagesQuery.mockReturnValue({
    data: { messages: [] },
    isPending: false,
    isError: false,
    isSuccess: true,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useMessagesQuery>);
const sendState = (overrides = {}) =>
  mockUseSendMessage.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSendMessage>);
  
beforeEach(() => {
  useAuthStore.setState({
    user: { id: "alice", username: "alice" },
    loading: false,
    restorationError: "",
  });
  mockUseUsersQuery.mockReturnValue({
    data: { users: [{ id: "bob", username: "bob" }] },
  } as ReturnType<typeof useUsersQuery>);
  messageState();
  sendState();
  // jsdom has no layout/scrolling implementation.
  Element.prototype.scrollIntoView = jest.fn();
});

const tree = () => (
  <MemoryRouter initialEntries={["/chat/bob"]}>
    <Routes>
      <Route path="/chat/:id" element={<ConversationPage />} />
    </Routes>
  </MemoryRouter>
);

it("prevents empty messages, sends a draft, and clears it only after success", async () => {
  render(tree());
  const user = userEvent.setup();
  const input = screen.getByRole("textbox", { name: "Message" });
  const button = screen.getByRole("button", { name: /Send/ });

  expect(button).toBeDisabled();

  await user.type(input, "   ");

  expect(button).toBeDisabled();

  await user.clear(input);
  await user.type(input, "Hello Bob");
  await user.click(button);

  expect(mutate).toHaveBeenCalledWith("Hello Bob", expect.any(Object));
  expect(input).toHaveValue("Hello Bob");

  act(() => mutate.mock.calls[0][1].onSuccess());

  expect(input).toHaveValue("");
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "false");

  await user.type(input, "Another message");

  expect(button).toBeEnabled();
});
it("shows pending state and prevents duplicate sends", () => {
  sendState({ isPending: true });
  render(tree());
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("textbox")).toBeDisabled();
});
it("keeps a failed draft for retry and displays the error", async () => {
  const view = render(tree());

  await userEvent.setup().type(screen.getByRole("textbox"), "Keep this");

  sendState({ isError: true, error: new Error("Send failed") });
  view.rerender(tree());

  expect(screen.getByRole("alert")).toHaveTextContent("Send failed");
  expect(screen.getByRole("textbox")).toHaveValue("Keep this");
});
it("blocks composition while history loads and offers retry on failure", async () => {
  messageState({ data: undefined, isPending: true, isSuccess: false });
  const view = render(tree());

  expect(screen.getByText("Loading messages…")).toBeVisible();
  expect(screen.getByRole("textbox")).toBeDisabled();
  messageState({
    data: undefined,
    isError: true,
    isSuccess: false,
    error: new Error("History failed"),
  });

  view.rerender(tree());

  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Try again" }));

  expect(refetch).toHaveBeenCalledTimes(1);
});
it("renders message content as text rather than HTML", () => {
  messageState({
    data: {
      messages: [
        {
          id: "1",
          senderId: "bob",
          content: '<script>alert("x")</script>',
          createdAt: "2026-10-27T00:00:00Z",
        },
      ],
    },
  });
  const { container } = render(tree());

  expect(screen.getByRole("log")).toHaveTextContent(
    '<script>alert("x")</script>',
  );
  expect(container.querySelector("script")).toBeNull();
});
