import { Navigate, Route, Routes } from "react-router";
import { PageLayout } from "./components/PageLayout/PageLayout";
import { SigninPage } from "./pages/Signin/SigninPage";
import { chatRoutes } from "./pages/Chat";
import { useInitializeAuth } from "./lib/auth/hooks/useInitializeAuth";

export const App = () => {
  useInitializeAuth();
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/signin" element={<SigninPage />} />
        {chatRoutes}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  );
};
