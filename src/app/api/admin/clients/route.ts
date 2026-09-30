import { NextResponse } from "next/server";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";
import {
  createClient,
  deleteClient,
  getClient,
  getLog,
  listClients,
  MIN_PASSCODE,
  resetUsage,
  setLogin,
  storageReady,
  topUp,
  updateClient,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const client = await getClient(id);
    if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ client, log: await getLog(id, 100) });
  }
  return NextResponse.json({
    clients: await listClients(),
    persistent: storageReady(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    username?: string;
    passcode?: string;
    plan?: string;
    credits?: number;
    note?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  if (!body.username?.trim()) return NextResponse.json({ error: "Username is required." }, { status: 400 });
  if (!body.passcode?.trim() || body.passcode.trim().length < MIN_PASSCODE) {
    return NextResponse.json({ error: `Passcode must be at least ${MIN_PASSCODE} characters.` }, { status: 400 });
  }
  const plan: PlanId = isPlanId(body.plan) ? body.plan : "basic";
  try {
    const client = await createClient({
      name: body.name,
      username: body.username,
      passcode: body.passcode,
      plan,
      credits: typeof body.credits === "number" && body.credits > 0 ? Math.round(body.credits) : PLANS[plan].credits,
      note: body.note,
    });
    return NextResponse.json({ client });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create client." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    action?: "update" | "topup" | "reset" | "login" | "delete";
    plan?: string;
    credits?: number;
    active?: boolean;
    name?: string;
    note?: string;
    username?: string;
    passcode?: string;
  };
  if (!body.id) return NextResponse.json({ error: "Missing client id." }, { status: 400 });
  const exists = await getClient(body.id);
  if (!exists) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  try {
    switch (body.action) {
      case "topup": {
        const amount = Math.round(body.credits ?? 0);
        if (amount <= 0) return NextResponse.json({ error: "Top-up must be more than zero." }, { status: 400 });
        return NextResponse.json({ client: await topUp(body.id, amount) });
      }
      case "reset":
        return NextResponse.json({ client: await resetUsage(body.id) });
      case "login": {
        if (!body.username?.trim() || !body.passcode?.trim()) {
          return NextResponse.json({ error: "Enter both a username and a passcode." }, { status: 400 });
        }
        return NextResponse.json({ client: await setLogin(body.id, body.username, body.passcode) });
      }
      case "delete":
        await deleteClient(body.id);
        return NextResponse.json({ deleted: true });
      default: {
        const patch: Parameters<typeof updateClient>[1] = {};
        if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
        if (typeof body.active === "boolean") patch.active = body.active;
        if (typeof body.note === "string") patch.note = body.note;
        if (isPlanId(body.plan)) patch.plan = body.plan;
        if (typeof body.credits === "number" && body.credits >= 0) patch.creditsTotal = Math.round(body.credits);
        return NextResponse.json({ client: await updateClient(body.id, patch) });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Update failed." }, { status: 400 });
  }
}
