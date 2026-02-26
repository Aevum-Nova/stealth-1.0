import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    await registerUser(values.email, values.password, values.name, values.organizationName);
    navigate("/", { replace: true });
  };

  return (
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
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[var(--ink)] px-4 py-2 text-white disabled:opacity-70"
        >
          {isSubmitting ? <LoadingSpinner label="Creating account" /> : "Register"}
        </button>

        <p className="text-sm text-[var(--ink-soft)]">
          Already have an account? <Link to="/login" className="font-semibold text-gray-900 underline underline-offset-2">Login</Link>
        </p>
      </form>
    </div>
  );
}
