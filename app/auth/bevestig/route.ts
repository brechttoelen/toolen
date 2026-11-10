import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { veiligVerder } from "@/lib/verder";

// Link uit een mail van Toolen (nieuw wachtwoord): token controleren, sessie maken, doorsturen.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token_hash = p.get("token_hash");
  const type = (p.get("type") || "recovery") as EmailOtpType;
  const verder = veiligVerder(p.get("verder"), "/wachtwoord");
  if (!token_hash || !["recovery", "invite", "magiclink", "email"].includes(type)) {
    return NextResponse.redirect(new URL("/login?fout=" + encodeURIComponent("Deze link is niet geldig."), req.url));
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return NextResponse.redirect(new URL("/login?fout=" + encodeURIComponent("Deze link is verlopen of al gebruikt. Vraag een nieuwe."), req.url));
  return NextResponse.redirect(verder.startsWith("/") ? new URL(verder, req.url) : verder);
}
