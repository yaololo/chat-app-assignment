import { Navigate, Route, Routes } from "react-router";
import { PageLayout } from "./components/PageLayout/PageLayout";
import { SigninPage } from "./pages/Signin/SigninPage";
import { ChatPage } from "./pages/Chat/ChatPage";
import { ChatIndexPage } from "./pages/Chat/ChatIndexPage";
import { ConversationPage } from "./pages/Chat/Conversation/ConversationPage";
import { RequireAuth } from "./pages/Chat/RequireAuth";
import { useInitializeAuth } from "./lib/auth/useInitializeAuth";

export const App = () => {
  useInitializeAuth();
  return (
    <Routes>
      <Route element={<PageLayout />}>
        <Route path="/signin" element={<SigninPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/chat" element={<ChatPage />}>
            <Route index element={<ChatIndexPage />} />
            <Route path=":id" element={<ConversationPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Route>
    </Routes>
  );
};
