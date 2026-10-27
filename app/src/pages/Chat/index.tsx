import { Route } from "react-router";
import { ChatPage } from "./ChatPage";
import { conversationRoutes } from "./Conversation";
import { RequireAuth } from "./RequireAuth";

// Export route elements directly: Routes expects Route children, not a wrapper component.
export const chatRoutes = (
  <Route element={<RequireAuth />}>
    <Route path="/chat" element={<ChatPage />}>
      {conversationRoutes}
    </Route>
  </Route>
);
