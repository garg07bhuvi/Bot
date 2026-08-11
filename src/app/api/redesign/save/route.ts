import { NextRequest } from "next/server";
import { updateRedesignResult } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      place_id,
      status,
      prompt,
      image_urls,
      stitch_project_id,
    } = body;

    if (!place_id || !status) {
      return Response.json(
        { error: "Missing place_id or status" },
        { status: 400 }
      );
    }

    console.log(`Saving redesign result for: ${place_id} with status: ${status}`);

    await updateRedesignResult(place_id, {
      redesign_status: status,
      redesign_prompt: prompt,
      redesign_image_urls: image_urls || [],
      stitch_project_id: stitch_project_id,
      redesigned_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      message: "Redesign result persisted successfully.",
    });
  } catch (err) {
    console.error("Save redesign result error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
