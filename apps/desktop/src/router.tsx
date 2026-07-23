import { createHashRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginScreen } from "./components/screens/LoginScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { ActionScreen } from "./components/screens/ActionScreen";
import { QueueScreen } from "./components/screens/QueueScreen";
import { AuditScreen } from "./components/screens/AuditScreen";
import { AdminScreen } from "./components/screens/AdminScreen";
import { AuthGuard } from "./components/layout/AuthGuard";
import { ErrorBoundary } from "./components/ErrorBoundary";

/** Bereichs-Fehlergrenze: ein Renderfehler betrifft nur diesen Bereich. */
function bounded(section: string, element: React.ReactNode): React.ReactNode {
  return <ErrorBoundary section={section}>{element}</ErrorBoundary>;
}

/** Router-Fabrik – App und Smoke-Tests nutzen dieselbe Routen-Definition. */
export function createAppRouter(): ReturnType<typeof createHashRouter> {
  return createHashRouter([
  {
    path: "/login",
    element: bounded("Anmeldung", <LoginScreen />),
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
      { path: "dashboard", element: bounded("Dashboard", <DashboardScreen />) },
      { path: "action/:actionId", element: bounded("Aktionsformular", <ActionScreen />) },
      { path: "queue", element: bounded("Warteschlange", <QueueScreen />) },
      { path: "audit", element: bounded("Protokoll", <AuditScreen />) },
      { path: "admin", element: bounded("Administration", <AdminScreen />) },
    ],
  },
]);
}

export const router: ReturnType<typeof createHashRouter> = createAppRouter();
