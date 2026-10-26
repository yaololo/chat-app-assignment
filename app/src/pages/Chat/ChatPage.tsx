import { Outlet } from "react-router";
import { useAuthStore } from "../../store/store";
import "./chat.css";

export const ChatPage = () => {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  return (
    <div className="chat-page">
      <div className="eyebrow">YOU’RE IN</div>
      <h1>Hello, {user.username}.</h1>
      <p className="intro">
        You’re signed in. Your account is ready for the chat experience.
      </p>
      <Outlet />
    </div>
  );
};
