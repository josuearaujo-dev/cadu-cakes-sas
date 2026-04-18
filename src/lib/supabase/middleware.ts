import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/auth"]);
const COMPANY_SETUP_ROUTE = "/onboarding";

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
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
      return NextResponse.redirect(url);
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
