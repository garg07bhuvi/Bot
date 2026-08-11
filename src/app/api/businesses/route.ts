import { getBusinesses, saveBusiness } from "@/lib/store";
import { NextRequest } from "next/server";

export async function GET() {
  const businesses = await getBusinesses();
  return Response.json({ businesses });
}

export async function POST(request: NextRequest) {
  try {
    const business = await request.json();
    if (!business.place_id) {
      return Response.json({ error: "Missing place_id" }, { status: 400 });
    }
    await saveBusiness(business);
    return Response.json({ success: true, message: `Saved ${business.name} to database.` });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

