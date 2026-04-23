import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/auth"]);
const COMPANY_SETUP_ROUTE = "/onboarding";

function applyCacheHeaders(
  response: NextResponse,
  headers?: Record<string, string | undefined> | null,
) {
  if (!headers) return;
  Object.entries(headers).forEach(([key, value]) => {
    if (value) response.headers.set(key, value);
  });
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.includes("-auth-token"));

  authCookieNames.forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set({
      name,
      value: "",
      maxAge: 0,
      path: "/",
    });
  });
}

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.startsWith("/public")
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (!isPublicRoute(request.nextUrl.pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/auth";
      return NextResponse.redirect(redirect);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        applyCacheHeaders(response, headers);
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    if (!isPublicRoute(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("redirectTo", request.nextUrl.pathname);
      const redirectResponse = NextResponse.redirect(url);
      if (error?.code === "refresh_token_not_found") {
        clearSupabaseAuthCookies(request, redirectResponse);
      }
      return redirectResponse;
    }

    if (error?.code === "refresh_token_not_found") {
      clearSupabaseAuthCookies(request, response);
    }

    return response;
  }

  if (request.nextUrl.pathname === "/auth") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const { data: company } = await supabase
    .from("companies")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company && request.nextUrl.pathname !== COMPANY_SETUP_ROUTE) {
    const url = request.nextUrl.clone();
    url.pathname = COMPANY_SETUP_ROUTE;
    return NextResponse.redirect(url);
  }

  if (company && request.nextUrl.pathname === COMPANY_SETUP_ROUTE) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
