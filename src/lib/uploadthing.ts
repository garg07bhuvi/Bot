import { UTApi } from "uploadthing/server";

let cachedApi: UTApi | null = null;

function getApi(): UTApi {
  if (!cachedApi) cachedApi = new UTApi();
  return cachedApi;
}

/** Uploads a screenshot/redesign image buffer and returns its public URL. */
export async function uploadImage(buffer: Buffer, filename: string): Promise<string> {
  const file = new File([new Uint8Array(buffer)], filename, { type: "image/png" });
  const result = await getApi().uploadFiles(file);
  if (result.error) throw new Error(result.error.message);
  return result.data.ufsUrl;
}
