import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

function getRedirectUrl(request: NextRequest) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  return new URL(nextPath, request.url);
}

function setAuthCallbackError(redirectUrl: URL, authError: string) {
  redirectUrl.searchParams.set("auth_error", authError);
}

function getSafeAuthError(error: { name?: string; status?: number } | null) {
  if (error?.name) {
    return error.name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 80);
  }

  if (error?.status) {
    return `status_${error.status}`;
  }

  return "auth_failed";
}

function getOtpType(type: string | null): EmailOtpType | null {
  if (type === "email") {
    return "email";
  }

  return null;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = getOtpType(request.nextUrl.searchParams.get("type"));
  const redirectUrl = getRedirectUrl(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!tokenHash || !otpType) {
    setAuthCallbackError(redirectUrl, "invalid_token_type");
    return NextResponse.redirect(redirectUrl);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    setAuthCallbackError(redirectUrl, "not_configured");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,
  });

  if (error) {
    setAuthCallbackError(redirectUrl, getSafeAuthError(error));
    return NextResponse.redirect(redirectUrl);
  }

  response.headers.set("Location", redirectUrl.toString());
  return response;
}
