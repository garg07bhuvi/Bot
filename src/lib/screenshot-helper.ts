import puppeteer from "puppeteer";
import { uploadImage } from "@/lib/uploadthing";

/**
 * Headless browser utility to crawl a business's website, capture
 * screenshots in both desktop and mobile viewports, and upload them to
 * UploadThing — WhatsApp/LeapCrew needs a publicly-fetchable URL, which a
 * local dev server can't provide.
 */
export async function captureScreenshots(
  url: string,
  placeId: string
): Promise<{ desktopUrl: string; mobileUrl: string }> {
  const desktopFile = `${placeId}_desktop.png`;
  const mobileFile = `${placeId}_mobile.png`;

  console.log(`Launching Puppeteer to screenshot: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // 1. Capture Desktop Viewport
    console.log("Capturing desktop viewport screenshot...");
    await page.setViewport({ width: 1280, height: 800 });
    // Go to website with 30s timeout
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // Wait briefly for any animations to finish
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const desktopBuffer = await page.screenshot();

    // 2. Capture Mobile Viewport
    console.log("Capturing mobile viewport screenshot...");
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
    });
    // Wait for responsive layouts to adjust
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const mobileBuffer = await page.screenshot();

    console.log("Uploading screenshots to UploadThing...");
    const [desktopUrl, mobileUrl] = await Promise.all([
      uploadImage(Buffer.from(desktopBuffer), desktopFile),
      uploadImage(Buffer.from(mobileBuffer), mobileFile),
    ]);

    console.log("Successfully captured and uploaded screenshots!");

    return { desktopUrl, mobileUrl };
  } finally {
    await browser.close();
  }
}
