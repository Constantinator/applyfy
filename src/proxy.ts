import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/candidatures"];
const SIGNUP_PAGE = "/signup";
const PASSWORD_SET_FLAG = "password_set"; // cf. src/lib/auth.ts

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Rafraîchit la session Supabase et effectue les redirections "optimistes".
// La vérification qui fait foi reste requireUser() + RLS, au plus près des données.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next(); // mode démo

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Ne rien exécuter entre createServerClient et getClaims (rafraîchissement du token).
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const passwordSet = data?.claims?.user_metadata?.[PASSWORD_SET_FLAG] === true;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (destination: URL) => {
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!isLoggedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(loginUrl);
  }

  // Inscription sur invitation uniquement : /signup n'est accessible qu'aux invités
  // arrivés via leur lien (session ouverte) et qui n'ont pas encore de mot de passe.
  if (matches(pathname, [SIGNUP_PAGE])) {
    if (!isLoggedIn) return redirectTo(new URL("/#liste-attente", request.url));
    if (passwordSet) return redirectTo(new URL("/dashboard", request.url));
    return response;
  }

  if (isLoggedIn && !passwordSet && (matches(pathname, PROTECTED_PREFIXES) || pathname === "/login")) {
    return redirectTo(new URL(SIGNUP_PAGE, request.url));
  }

  if (isLoggedIn && pathname === "/login") {
    return redirectTo(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
