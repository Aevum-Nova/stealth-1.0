import { Suspense } from "react";
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ToastProvider } from "@/components/shared/Toast";
import { useAuth } from "@/hooks/use-auth";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const LoginPage = lazyWithRetry(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazyWithRetry(() => import("@/pages/auth/RegisterPage"));
const ConnectorsPage = lazyWithRetry(() => import("@/pages/connectors/ConnectorsPage"));
const ConnectorDetailPage = lazyWithRetry(() => import("@/pages/connectors/ConnectorDetailPage"));
const ConnectorSetupPage = lazyWithRetry(() => import("@/pages/connectors/ConnectorSetupPage"));
const OAuthCallbackPage = lazyWithRetry(() => import("@/pages/connectors/OAuthCallbackPage"));
const DashboardPage = lazyWithRetry(() => import("@/pages/dashboard/DashboardPage"));
const FeatureRequestsPage = lazyWithRetry(() => import("@/pages/feature-requests/FeatureRequestsPage"));
const ProductContextPage = lazyWithRetry(() => import("@/pages/feature-requests/ProductContextPage"));
const IngestPage = lazyWithRetry(() => import("@/pages/ingest/IngestPage"));
const SignalDetailPage = lazyWithRetry(() => import("@/pages/signals/SignalDetailPage"));
const SignalsPage = lazyWithRetry(() => import("@/pages/signals/SignalsPage"));
const TriggersPage = lazyWithRetry(() => import("@/pages/triggers/TriggersPage"));
const WorkflowCreatePage = lazyWithRetry(() => import("@/pages/workflows/CreatePage"));

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<LoadingSpinner label="Loading page" />}>{element}</Suspense>;
}

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
  { path: "/login", element: withSuspense(<LoginPage />) },
  { path: "/register", element: withSuspense(<RegisterPage />) },
  { path: "/oauth/callback", element: withSuspense(<OAuthCallbackPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: withSuspense(<DashboardPage />) },
          { path: "/connectors", element: withSuspense(<ConnectorsPage />) },
          { path: "/connectors/new/:type", element: withSuspense(<ConnectorSetupPage />) },
          { path: "/connectors/:id", element: withSuspense(<ConnectorDetailPage />) },
          { path: "/ingest", element: withSuspense(<IngestPage />) },
          { path: "/signals", element: withSuspense(<SignalsPage />) },
          { path: "/signals/:id", element: withSuspense(<SignalDetailPage />) },
          { path: "/feature-requests", element: withSuspense(<FeatureRequestsPage />) },
          { path: "/feature-requests/:id", element: withSuspense(<ProductContextPage />) },
          { path: "/feature-requests/:id/context", element: <Navigate to=".." relative="path" replace /> },
          { path: "/triggers", element: withSuspense(<TriggersPage />) },
          { path: "/synthesis", element: <Navigate to="/triggers" replace /> },
          { path: "/create", element: withSuspense(<WorkflowCreatePage />) }
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
