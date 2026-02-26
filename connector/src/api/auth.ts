import api from "@/api/client";
import type { ApiResponse } from "@/types/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  organization_name: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface GoogleLoginPayload {
  id_token: string;
}

export async function register(payload: RegisterPayload) {
  return api.post("auth/register", { json: payload }).json<
    ApiResponse<{ user: AuthUser; organization: { id: string; name: string }; access_token: string; refresh_token: string }>
  >();
}

export async function login(payload: LoginPayload) {
  return api.post("auth/login", { json: payload }).json<
    ApiResponse<{ user: AuthUser; access_token: string; refresh_token: string }>
  >();
}

export async function loginWithGoogle(payload: GoogleLoginPayload) {
  return api.post("auth/google", { json: payload }).json<
    ApiResponse<{ user: AuthUser; access_token: string; refresh_token: string }>
  >();
}

export async function refresh() {
  return api.post("auth/refresh", { json: {} }).json<ApiResponse<{ access_token: string; refresh_token: string }>>();
}

export async function logout() {
  return api.post("auth/logout", { json: {} }).json<ApiResponse<{ logged_out: boolean }>>();
}

export async function me() {
  return api.get("auth/me").json<
    ApiResponse<{
      id: string;
      email: string;
      name: string;
      role: string;
      organization: { id: string; name: string };
      created_at: string;
    }>
  >();
}
