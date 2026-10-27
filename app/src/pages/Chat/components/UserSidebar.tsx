import { useState } from "react";
import { NavLink } from "react-router";
import { useUsers } from "../hooks/useUsers";
import { useAuthStore } from "../../../store/store";

const UserSidebar = () => {
  const [search, setSearch] = useState("");
  const users = useUsers();
  const me = useAuthStore((state) => state.user);
  const filtered = users.data?.users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside className="chat-sidebar" aria-label="Registered users">
      <div className="sidebar-heading">
        <div className="eyebrow">YOUR PEOPLE</div>
        <h1>Messages</h1>
        <p>
          Signed in as <strong>{me?.username}</strong>
        </p>
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <input
          id="user-search"
          placeholder="Search people…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <nav className="user-list" aria-label="Choose a user">
        {users.isPending && (
          <p className="chat-status" role="status">
            Loading people…
          </p>
        )}
        {users.isError && (
          <div className="chat-status" role="alert">
            <p>{users.error.message}</p>
            <button onClick={() => users.refetch()}>Try again</button>
          </div>
        )}
        {filtered?.map((user) => (
          <NavLink
            className={({ isActive }) =>
              `user-row${isActive ? " selected" : ""}`
            }
            key={user.id}
            to={`/chat/${user.id}`}
          >
            <span className="avatar" aria-hidden="true">
              {user.username.slice(0, 2).toUpperCase()}
            </span>
            <span className="user-details">
              <strong>{user.username}</strong>
              <span>Start a conversation</span>
            </span>
            <span aria-hidden="true">›</span>
          </NavLink>
        ))}
        {!users.isPending && !users.isError && filtered?.length === 0 && (
          <p className="chat-status">
            {search
              ? "No users match your search."
              : "No other users yet. Invite someone to sign in."}
          </p>
        )}
      </nav>
      <div className="sidebar-bottom">A little space to stay connected.</div>
    </aside>
  );
};

export { UserSidebar };
