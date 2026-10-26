import { Outlet } from "react-router";
import { useAuthStore } from "../../store/store";
import { useSignOut } from "../../lib/auth/queries";
import "./page-layout.css";

export const PageLayout = () => {
  const loading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const signOut = useSignOut();
  return (
    <div className="page">
      <header className="page-header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              ↗
            </span>
            little chat<span className="badge">DEMO</span>
          </div>
          {!loading && user && (
            <button
              className="logout-button"
              type="button"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              {signOut.isPending ? "Signing out…" : "Log out"}
            </button>
          )}
        </div>
        {signOut.error && (
          <p className="error logout-error" role="alert">
            {signOut.error.message}
          </p>
        )}
      </header>
      <main className="page-content">
        <section className="card">
          {loading ? <p role="status">Restoring your session…</p> : <Outlet />}
        </section>
      </main>
      <footer className="page-footer">
        Simple conversations. A little closer.
      </footer>
    </div>
  );
};
