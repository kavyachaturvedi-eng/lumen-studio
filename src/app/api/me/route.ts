import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CLIENT_COOKIE, readClientId } from "@/lib/auth";
import { getClient } from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { DEMO_MODE } from "@/lib/gemini";

export const runtime = "nodejs";

/** What the signed-in client is allowed to do, and how much of their pool is left. */
export async function GET() {
  const jar = await cookies();
  const id = await readClientId(jar.get(CLIENT_COOKIE)?.value);
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    name: client.name,
    plan: client.plan,
    planLabel: PLANS[client.plan].label,
    shotTypes: PLANS[client.plan].shotTypes,
    creditsLeft: client.creditsLeft,
    creditsTotal: client.creditsTotal,
    percentLeft: client.percentLeft,
    active: client.active,
    demo: DEMO_MODE,
  });
}
