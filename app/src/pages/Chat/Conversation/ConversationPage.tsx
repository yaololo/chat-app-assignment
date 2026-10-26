import { Link, useParams } from "react-router";

export const ConversationPage = () => {
  const { id } = useParams();
  // Routing is ready; conversation loading and authorization belong to the messaging feature.
  return (
    <div className="notice">
      <p>Conversation {id}</p>
      <p>Messaging is coming next.</p>
      <Link to="/chat">Back to chats</Link>
    </div>
  );
};
