import { Outlet } from "react-router";
import { UserSidebar } from "./components/UserSidebar";
import "./chat.css";

export const ChatPage = () => (
  <div className="chat-page">
    <UserSidebar />
    <section className="conversation-panel" aria-label="Conversation">
      <Outlet />
    </section>
  </div>
);
