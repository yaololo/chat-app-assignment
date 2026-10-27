import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useParams } from "react-router";
import { useAuthStore } from "../../../store/store";
import { useMessages } from "../hooks/useMessages";
import { useSendMessage } from "../hooks/useSendMessage";
import { useUsers } from "../hooks/useUsers";

const Conversation = ({ id }: { id: string }) => {
  const users = useUsers();
  const peer = users.data?.users.find((user) => user.id === id);
  const messages = useMessages(id);
  const send = useSendMessage(id);
  const me = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const latestId = messages.data?.messages.at(-1)?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [latestId]);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || send.isPending) return;
    send.mutate(draft, { onSuccess: () => setDraft("") });
  };
  return (
    <>
      <header className="conversation-heading">
        <span className="avatar" aria-hidden="true">
          {peer?.username.slice(0, 2).toUpperCase() ?? "…"}
        </span>
        <div>
          <h2>{peer?.username ?? "Conversation"}</h2>
          <p>Direct message</p>
        </div>
      </header>
      <div
        className="message-list"
        role="log"
        aria-label="Messages"
        aria-live="polite"
      >
        {messages.isPending && <p className="chat-status">Loading messages…</p>}
        {messages.isError && (
          <div className="chat-status" role="alert">
            <p>{messages.error.message}</p>
            <button onClick={() => messages.refetch()}>Try again</button>
          </div>
        )}
        {messages.isSuccess && messages.data.messages.length === 0 && (
          <div className="chat-empty">
            <h2>Say hello{peer ? ` to ${peer.username}` : ""}.</h2>
            <p>This is the beginning of your conversation.</p>
          </div>
        )}
        {messages.data?.messages.map((message) => (
          <article
            key={message.id}
            className={`message-bubble${message.senderId === me?.id ? " mine" : ""}`}
          >
            <p>{message.content}</p>
            <time
              dateTime={message.createdAt}
              title={new Date(message.createdAt).toLocaleString()}
            >
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </article>
        ))}
        <div ref={end} />
      </div>
      <form className="message-composer" onSubmit={submit}>
        {send.isError && (
          <p className="error" role="alert">
            {send.error.message}
          </p>
        )}
        <label className="sr-only" htmlFor="message-input">
          Message
        </label>
        <div className="composer-row">
          <textarea
            id="message-input"
            placeholder="Write a message…"
            rows={2}
            maxLength={4000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={send.isPending || !messages.isSuccess}
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending || !messages.isSuccess}
          >
            {send.isPending ? "Sending…" : "Send ↗"}
          </button>
        </div>
        <small>Up to 4,000 characters · Messages refresh every 3 seconds</small>
      </form>
    </>
  );
};
export const ConversationPage = () => {
  const { id = "" } = useParams();
  return <Conversation key={id} id={id} />;
};
