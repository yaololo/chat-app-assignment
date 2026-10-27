import { Outlet } from "react-router";
import { UserSidebar } from "./components/UserSidebar";
import { useRealtime } from "./hooks/useRealtime";
import "./chat.css";

export const ChatPage = () => {
  const { connected, ready } = useRealtime();
  return (
    <div className="chat-page">
      {ready ? (
        <UserSidebar />
      ) : (
        <aside className="chat-sidebar" aria-label="Registered users" />
      )}
      <section className="conversation-panel" aria-label="Conversation">
        {!connected && (
          <p className="connection-status" role="status">
            Connecting to live updates…
          </p>
        )}
        {ready && <Outlet />}
      </section>
    </div>
  );
};
