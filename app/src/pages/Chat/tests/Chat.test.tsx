import { beforeEach, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const mockUseRealtime = jest.fn();
const mockSidebar = jest.fn(() => <aside>Mock user sidebar</aside>);
const mockConversationPage = jest.fn(() => <p>Mock conversation page</p>);
const MockConversationPage = () => mockConversationPage();

jest.doMock("../hooks/useRealtime", () => ({
  useRealtime: mockUseRealtime,
}));
jest.doMock("../UserSidebar", () => ({
  UserSidebar: () => mockSidebar(),
}));

const { ChatPage } = require("../ChatPage") as typeof import("../ChatPage");

beforeEach(() => {
  mockUseRealtime.mockReturnValue({ connected: true, ready: true });
  mockSidebar.mockClear();
  mockConversationPage.mockClear();
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route path="/chat" element={<ChatPage />}>
          <Route index element={<MockConversationPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

it("renders child components when realtime is ready", () => {
  show();

  expect(screen.getByText("Mock user sidebar")).toBeVisible();
  expect(screen.getByText("Mock conversation page")).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(mockSidebar).toHaveBeenCalledTimes(1);
  expect(mockConversationPage).toHaveBeenCalledTimes(1);
});

it("waits for the initial socket connection before rendering children", () => {
  mockUseRealtime.mockReturnValue({ connected: false, ready: false });

  show();

  expect(screen.getByRole("status")).toHaveTextContent("Connecting");
  expect(
    screen.getByRole("complementary", { name: "Registered users" }),
  ).toBeEmptyDOMElement();
  expect(screen.queryByText("Mock user sidebar")).not.toBeInTheDocument();
  expect(screen.queryByText("Mock conversation page")).not.toBeInTheDocument();
  expect(mockSidebar).not.toHaveBeenCalled();
  expect(mockConversationPage).not.toHaveBeenCalled();
});

it("keeps ready content visible and shows status during reconnect", () => {
  mockUseRealtime.mockReturnValue({ connected: false, ready: true });

  show();

  expect(screen.getByRole("status")).toHaveTextContent("Connecting");
  expect(screen.getByText("Mock user sidebar")).toBeVisible();
  expect(screen.getByText("Mock conversation page")).toBeVisible();
});

it("renders the sidebar placeholder until the first connection is ready", () => {
  mockUseRealtime.mockReturnValue({ connected: true, ready: false });

  show();

  expect(
    screen.getByRole("complementary", { name: "Registered users" }),
  ).toBeEmptyDOMElement();
  expect(screen.queryByText("Mock user sidebar")).not.toBeInTheDocument();
  expect(screen.queryByText("Mock conversation page")).not.toBeInTheDocument();
});
