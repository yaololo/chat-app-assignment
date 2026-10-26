import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthStore } from "../../store/store";

export const RequireAuth = () => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/signin" replace state={{ from: location.pathname }} />
  );
};
