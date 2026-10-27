import { expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useAuthStore } from "@/store/store";
import { RequireAuth } from "../RequireAuth";

it("redirects guests to sign-in and preserves the requested route", () => {
  useAuthStore.setState({ user: null });
  const SigninDestination = () => <p>Return to {useLocation().state?.from}</p>;
  render(
    <MemoryRouter initialEntries={["/chat/bob"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/chat/:id" element={<p>Private content</p>} />
        </Route>
        <Route path="/signin" element={<SigninDestination />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText("Return to /chat/bob")).toBeVisible();
  expect(screen.queryByText("Private content")).not.toBeInTheDocument();
});

it("allows authenticated users to access protected routes", () => {
  useAuthStore.setState({ user: { id: "alice", username: "alice" } });
  render(
    <MemoryRouter initialEntries={["/chat"]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/chat" element={<p>Private content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText("Private content")).toBeVisible();
});
