import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
