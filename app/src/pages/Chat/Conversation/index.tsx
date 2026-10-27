import { Route } from "react-router";
import { ChatIndexPage } from "./ChatIndexPage";
import { ConversationPage } from "./ConversationPage";

export const conversationRoutes = (
  <>
    <Route index element={<ChatIndexPage />} />
    <Route path=":id" element={<ConversationPage />} />
  </>
);
