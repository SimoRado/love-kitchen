"use client";

/**
 * Shared fetch wrapper for admin pages. If any admin API returns 401,
 * this redirects to the login page instead of letting the page show
 * an inline "unauthorized" error.
 */
export async function adminFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    // Clear stale cookies via logout and redirect to login
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/admin/login");
    // Return a never-resolving promise so the caller's code doesn't
    // continue executing after the redirect is initiated
    return new Promise(() => {});
  }

  return res;
}
