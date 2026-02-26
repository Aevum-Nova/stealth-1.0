import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { ToastProvider } from "@/components/shared/Toast";
import { useAuth } from "@/hooks/use-auth";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ConnectorsPage from "@/pages/connectors/ConnectorsPage";
import ConnectorDetailPage from "@/pages/connectors/ConnectorDetailPage";
import ConnectorSetupPage from "@/pages/connectors/ConnectorSetupPage";
import OAuthCallbackPage from "@/pages/connectors/OAuthCallbackPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import FeatureRequestDetailPage from "@/pages/feature-requests/FeatureRequestDetailPage";
import FeatureRequestsPage from "@/pages/feature-requests/FeatureRequestsPage";
import IngestPage from "@/pages/ingest/IngestPage";
import SignalDetailPage from "@/pages/signals/SignalDetailPage";
import SignalsPage from "@/pages/signals/SignalsPage";
import SynthesisPage from "@/pages/synthesis/SynthesisPage";

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/oauth/callback", element: <OAuthCallbackPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/connectors", element: <ConnectorsPage /> },
          { path: "/connectors/new/:type", element: <ConnectorSetupPage /> },
          { path: "/connectors/:id", element: <ConnectorDetailPage /> },
          { path: "/ingest", element: <IngestPage /> },
          { path: "/signals", element: <SignalsPage /> },
          { path: "/signals/:id", element: <SignalDetailPage /> },
          { path: "/feature-requests", element: <FeatureRequestsPage /> },
          { path: "/feature-requests/:id", element: <FeatureRequestDetailPage /> },
          { path: "/synthesis", element: <SynthesisPage /> }
        ]
      }
    ]
  },
  { path: "*", element: <Navigate to="/" replace /> }
]);

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
