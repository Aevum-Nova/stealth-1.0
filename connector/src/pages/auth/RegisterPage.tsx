import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";
import { extractApiErrorMessage } from "@/lib/api-error";
import { loadGoogleIdentityScript } from "@/lib/google-identity";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      cancel: () => void;
      initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      prompt: () => void;
    };
  };
}

export default function RegisterPage() {
  const { register: registerUser, loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleRef = useRef<GoogleIdentityApi | null>(null);
  const googleClientId = useMemo(() => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "", []);
  const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setAuthError("Google did not return a credential.");
        return;
      }

      setIsGoogleSubmitting(true);
      setAuthError(null);
      try {
        await loginWithGoogle(response.credential);
        navigate(target, { replace: true });
      } catch (error) {
        setAuthError(await extractApiErrorMessage(error, "Google sign-up failed."));
      } finally {
        setIsGoogleSubmitting(false);
      }
    },
    [loginWithGoogle, navigate, target]
  );

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    let cancelled = false;

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) {
          return;
        }

        const google = (window as Window & { google?: GoogleIdentityApi }).google;
        if (!google?.accounts?.id) {
          setAuthError("Google sign-up is unavailable right now.");
          return;
        }

        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            void handleGoogleCredential(response);
          }
        });
        googleRef.current = google;
        setIsGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthError("Could not load Google sign-up.");
        }
      });

    return () => {
      cancelled = true;
      const google = (window as Window & { google?: GoogleIdentityApi }).google;
      google?.accounts?.id?.cancel();
    };
  }, [googleClientId, handleGoogleCredential]);

  const onSubmit = async (values: FormValues) => {
    setAuthError(null);
    try {
      await registerUser(values.email, values.password, values.name, values.organizationName);
      navigate("/", { replace: true });
    } catch (error) {
      setAuthError(await extractApiErrorMessage(error, "Register failed."));
    }
  };

  return !isLoading && isAuthenticated ? (
    <Navigate to="/" replace />
  ) : (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="panel elevated w-full space-y-4 p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">Create Workspace</p>
          <h1 className="mt-1 text-3xl">Register</h1>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--ink-soft)]">Name</span>
          <input className="w-full rounded-lg border border-[var(--line)] px-3 py-2" {...register("name")} />
          {errors.name ? <p className="text-sm text-red-700">{errors.name.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--ink-soft)]">Organization Name</span>
          <input className="w-full rounded-lg border border-[var(--line)] px-3 py-2" {...register("organizationName")} />
          {errors.organizationName ? <p className="text-sm text-red-700">{errors.organizationName.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--ink-soft)]">Email</span>
          <input className="w-full rounded-lg border border-[var(--line)] px-3 py-2" {...register("email")} />
          {errors.email ? <p className="text-sm text-red-700">{errors.email.message}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--ink-soft)]">Password</span>
          <input type="password" className="w-full rounded-lg border border-[var(--line)] px-3 py-2" {...register("password")} />
          {errors.password ? <p className="text-sm text-red-700">{errors.password.message}</p> : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting}
          className="w-full rounded-lg bg-[var(--ink)] px-4 py-2 text-white disabled:opacity-70"
        >
          {isSubmitting ? <LoadingSpinner label="Creating account" /> : "Register"}
        </button>

        <div className="relative py-1">
          <div className="border-t border-[var(--line)]" />
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--surface)] px-2 text-xs uppercase text-[var(--ink-soft)]">
            Or
          </span>
        </div>

        {googleClientId ? (
          <button
            type="button"
            disabled={!isGoogleReady || isSubmitting || isGoogleSubmitting}
            onClick={() => googleRef.current?.accounts.id.prompt()}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {isGoogleSubmitting ? (
              <LoadingSpinner label="Signing up with Google" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">Set `VITE_GOOGLE_CLIENT_ID` to enable Google sign-up.</p>
        )}

        {authError ? <p className="text-sm text-red-700">{authError}</p> : null}

        <p className="text-sm text-[var(--ink-soft)]">
          Already have an account? <Link to="/login" className="font-semibold text-gray-900 underline underline-offset-2">Login</Link>
        </p>
      </form>
    </div>
  );
}
