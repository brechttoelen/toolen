import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { veiligVerder } from "@/lib/verder";

// Terugkeer na Microsoft, Google of de link in de mail: sessie maken en doorsturen.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const verder = veiligVerder(req.nextUrl.searchParams.get("verder"));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?fout=${encodeURIComponent(error.message)}`, req.url));
  }
  return NextResponse.redirect(verder.startsWith("/") ? new URL(verder, req.url) : verder);
}
