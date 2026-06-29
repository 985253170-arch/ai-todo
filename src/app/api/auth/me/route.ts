import { NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase-server";
import type { AuthMeResponse } from "@/lib/types";

export async function GET() {
  const supabase = await createSupabaseAuthClient();

  if (!supabase) {
    const response: AuthMeResponse = {
      success: true,
      user: null,
    };

    return NextResponse.json(response);
  }

  const { data, error } = await supabase.auth.getUser();
  const response: AuthMeResponse = {
    success: true,
    user:
      error || !data.user
        ? null
        : {
            id: data.user.id,
            email: data.user.email ?? null,
          },
  };

  return NextResponse.json(response);
}
