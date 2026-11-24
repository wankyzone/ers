import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server.js";
import { isCustomerRole, isEmailVerified } from "./lib/customer-profile.ts";

function isCustomerRoute(pathname: string) {
  return pathname === "/customer" || pathname.startsWith("/customer/");
}

function isAuthScreen(pathname: string) {
  return ["/login", "/signup", "/forgot-password"].includes(pathname);
}

function copyCookies(source: NextResponse, destination: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie);
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isCustomerRoute(pathname) && !isAuthScreen(pathname)) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isCustomerRoute(pathname)) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "configuration");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data.user;

  if (isCustomerRoute(pathname)) {
    if (!user || !isEmailVerified(user)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      if (user) {
        loginUrl.searchParams.set("error", "verification");
      } else {
        loginUrl.searchParams.set("next", "/customer");
      }
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "client") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "error",
        profileError ? "profile" : "role",
      );
      const redirect = NextResponse.redirect(loginUrl);
      copyCookies(response, redirect);
      return redirect;
    }
  } else if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (isEmailVerified(user) && isCustomerRole(profile?.role)) {
      const customerUrl = request.nextUrl.clone();
      customerUrl.pathname = "/customer";
      customerUrl.search = "";
      const redirect = NextResponse.redirect(customerUrl);
      copyCookies(response, redirect);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ["/customer/:path*", "/login", "/signup", "/forgot-password"],
};
