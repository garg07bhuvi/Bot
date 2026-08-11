import { NextRequest } from "next/server";
import { getBusinesses, updateRedesignResult } from "@/lib/store";
import { captureScreenshots } from "@/lib/screenshot-helper";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { place_id } = body;

    if (!place_id) {
      return Response.json({ error: "Missing place_id" }, { status: 400 });
    }

    const businesses = await getBusinesses();
    const business = businesses.find((b) => b.place_id === place_id);

    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.website) {
      return Response.json(
        { error: "Business does not have a website to redesign" },
        { status: 400 }
      );
    }

    // 1. Mark status as in_progress
    console.log(`Starting redesign crawl for: ${business.name} (${place_id})`);
    await updateRedesignResult(place_id, {
      redesign_status: "in_progress",
      redesigned_at: new Date().toISOString(),
    });

    // 2. Capture screenshots in the background or synchronously
    // Capturing screenshots takes ~5-10 seconds. We'll do it synchronously
    // so the UI receives the result.
    try {
      const { desktopUrl, mobileUrl } = await captureScreenshots(
        business.website,
        place_id
      );

      // 3. Mark as pending design generation (ready for Stitch)
      await updateRedesignResult(place_id, {
        redesign_status: "pending",
        // We can temporarily store the screenshots in the prompt or keep them in public folder
      });

      return Response.json({
        success: true,
        message: "Screenshots captured successfully. Ready for Stitch design generation.",
        screenshots: { desktopUrl, mobileUrl },
      });
    } catch (crawlErr) {
      console.error("Redesign crawl failed:", crawlErr);
      await updateRedesignResult(place_id, {
        redesign_status: "failed",
      });
      return Response.json(
        { error: `Crawl/Screenshot failed: ${String(crawlErr)}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Redesign endpoint error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
