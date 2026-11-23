import { createServerClient } from "@supabase/ssr";
import { t } from "@/lib/localization";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, isDemoMode, supabaseConfig } from "@/lib/env";

export async function proxy(request: NextRequest) {
  if (isDemoMode() && !/^127\.0\.0\.1(?::\d+)?$/.test(request.headers.get("host") ?? "")) {
    return new NextResponse(t("The local demo is available on 127.0.0.1."), { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-client-hub-path", request.nextUrl.pathname + request.nextUrl.search);
  let response = NextResponse.next({ request: { headers } });
  const config = supabaseConfig();

  if (!isDemoMode() && config && request.cookies.getAll().some(({ name }) =>
    name === cookieOptions.name || name.startsWith(cookieOptions.name + ".")
  )) {
    const supabase = createServerClient(config.url, config.key, {
      cookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, responseHeaders) {
          for (const { name, value } of values) request.cookies.set(name, value);
          headers.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers } });
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
          for (const [name, value] of Object.entries(responseHeaders)) response.headers.set(name, value);
        },
      },
    });
    await supabase.auth.getClaims();
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico$|icon.svg$).*)"],
};
