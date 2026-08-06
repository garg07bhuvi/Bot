import { getBusinesses } from "@/lib/store";

export async function GET() {
  const businesses = await getBusinesses();
  return Response.json({ businesses });
}
