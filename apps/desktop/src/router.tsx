import { createHashRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginScreen } from "./components/screens/LoginScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { ActionScreen } from "./components/screens/ActionScreen";
import { QueueScreen } from "./components/screens/QueueScreen";
import { AuditScreen } from "./components/screens/AuditScreen";
import { AdminScreen } from "./components/screens/AdminScreen";
import { AuthGuard } from "./components/layout/AuthGuard";

export const router = createHashRouter([
  {
    path: "/login",
    element: <LoginScreen />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardScreen /> },
      { path: "action/:actionId", element: <ActionScreen /> },
      { path: "queue", element: <QueueScreen /> },
      { path: "audit", element: <AuditScreen /> },
      { path: "admin", element: <AdminScreen /> },
    ],
  },
]);
