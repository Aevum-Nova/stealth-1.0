import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation } from "react-router-dom";
import { z } from "zod";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";
import { extractApiErrorMessage } from "@/lib/api-error";
import { type GoogleCredentialResponse, type GoogleIdentityApi, loadGoogleIdentityScript } from "@/lib/google-identity";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser, loginWithGoogle, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSuccess, setIsAuthSuccess] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleRef = useRef<GoogleIdentityApi | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleClientId = useMemo(() => import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "", []);
  const target = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/chat";

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
        setIsAuthSuccess(true);
      } catch (error) {
        setAuthError(await extractApiErrorMessage(error, "Google sign-up failed."));
        setIsGoogleSubmitting(false);
      }
    },
    [loginWithGoogle]
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
          auto_select: false,
          callback: (response) => {
            void handleGoogleCredential(response);
          }
        });
        googleRef.current = google;
        if (googleButtonRef.current) {
          google.accounts.id.renderButton(googleButtonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "continue_with",
            width: 400,
          });
        }
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
      setIsAuthSuccess(true);
    } catch (error) {
      setAuthError(await extractApiErrorMessage(error, "Register failed."));
    }
  };

  if (isAuthenticated) {
    return <Navigate to={target} replace />;
  }

  if (isLoading || isAuthSuccess) {
    return null;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[var(--canvas)] p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Set up your workspace</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink-soft)]">Name</span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] placeholder:text-[var(--ink-muted)]"
            placeholder="Jane Smith"
            {...register("name")}
          />
          {errors.name ? <p className="text-[12px] text-red-500">{errors.name.message}</p> : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink-soft)]">Organization</span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] placeholder:text-[var(--ink-muted)]"
            placeholder="Acme Inc."
            {...register("organizationName")}
          />
          {errors.organizationName ? <p className="text-[12px] text-red-500">{errors.organizationName.message}</p> : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink-soft)]">Email</span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] placeholder:text-[var(--ink-muted)]"
            placeholder="you@company.com"
            {...register("email")}
          />
          {errors.email ? <p className="text-[12px] text-red-500">{errors.email.message}</p> : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-[var(--ink-soft)]">Password</span>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px]"
            placeholder="••••••••"
            {...register("password")}
          />
          {errors.password ? <p className="text-[12px] text-red-500">{errors.password.message}</p> : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting}
          className="flex w-full items-center justify-center rounded-lg bg-[var(--action-primary)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-50"
        >
          {isSubmitting ? <LoadingSpinner label="Creating account" /> : "Create account"}
        </button>

        <div className="relative py-1">
          <div className="border-t border-[var(--line)]" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--canvas)] px-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
            or
          </span>
        </div>

        {googleClientId ? (
          <div className="relative">
            <div
              className={`flex min-h-[42px] w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--accent-soft)] ${(!isGoogleReady || isSubmitting || isGoogleSubmitting) ? "opacity-50" : ""}`}
            >
              {isGoogleSubmitting ? (
                <LoadingSpinner label="Signing up with Google" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </div>
            <div
              ref={googleButtonRef}
              className={`absolute inset-0 overflow-hidden [&_iframe]:!h-full [&_iframe]:!w-full ${(!isGoogleReady || isSubmitting || isGoogleSubmitting) ? "pointer-events-none" : ""}`}
              style={{ opacity: 0.0001 }}
            />
          </div>
        ) : (
          <p className="text-center text-[12px] text-[var(--ink-muted)]">Google sign-up not configured</p>
        )}

        {authError ? <p className="text-[13px] text-red-500">{authError}</p> : null}

        <p className="text-center text-[13px] text-[var(--ink-soft)]">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-[var(--ink)] underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
