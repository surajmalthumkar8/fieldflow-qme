import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, aiServiceEnabled, type AiTurn } from "@/lib/aiService";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Real-estate AI receptionist turn, backed by the FastAPI/Ollama service.
// Same-origin proxy (no CORS) that enriches the call with the business's name +
// service area from the DB so prompts/RAG are tenant-scoped.
interface Body {
  businessId?: string;
  businessName?: string;
  serviceArea?: string;
  history?: AiTurn[];
  message?: string;
  conversationId?: string | null;
}

export async function POST(req: Request) {
  if (!aiServiceEnabled()) {
    return NextResponse.json(
      { error: "AI_SERVICE_URL is not configured. Start the FastAPI service (backend/)." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Identify the signed-in customer from the auth cookie (not the browser body).
  const user = await getCurrentUser();
  let businessName = body.businessName ?? "our team";
  let serviceArea = body.serviceArea ?? "";
  // The user's company is authoritative when signed in.
  const businessId = user?.business_id ?? body.businessId ?? "default";

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (business) {
    businessName = business.name;
    serviceArea = business.serviceArea || serviceArea;
  }

  try {
    const result = await aiChat({
      business_id: businessId,
      business_name: businessName,
      service_area: serviceArea,
      history: Array.isArray(body.history) ? body.history : [],
      message: typeof body.message === "string" ? body.message : "",
      conversation_id: body.conversationId ?? null,
      user_id: user?.id ?? null,
      customer_name: user?.full_name ?? "",
      customer_email: user?.email ?? "",
      customer_profile: user?.profile
        ? Object.entries(user.profile)
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : "",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/ai/chat] error:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }
}
