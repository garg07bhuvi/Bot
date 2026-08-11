import puppeteer from "puppeteer";
import path from "path";
import { mkdir } from "fs/promises";

/**
 * Headless browser utility to crawl a business's website
 * and capture screenshots in both desktop and mobile viewports.
 * Saves files under public/redesigns/ and returns their web-accessible URLs.
 */
export async function captureScreenshots(
  url: string,
  placeId: string
): Promise<{ desktopUrl: string; mobileUrl: string }> {
  const redesignsDir = path.join(process.cwd(), "public", "redesigns");
  await mkdir(redesignsDir, { recursive: true });

  const desktopFile = `${placeId}_desktop.png`;
  const mobileFile = `${placeId}_mobile.png`;

  const desktopPath = path.join(redesignsDir, desktopFile);
  const mobilePath = path.join(redesignsDir, mobileFile);

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
    await page.screenshot({ path: desktopPath });

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
    await page.screenshot({ path: mobilePath });

    console.log("Successfully captured screenshots!");

    return {
      desktopUrl: `/redesigns/${desktopFile}`,
      mobileUrl: `/redesigns/${mobileFile}`,
    };
  } finally {
    await browser.close();
  }
}
