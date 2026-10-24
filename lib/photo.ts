/**
 * Client-side photo preparation (design.md §6, REQ-3.5, REQ-14.8).
 *
 * Browser-only. Resizes a captured photo to <= 1280 px on the long edge and
 * re-encodes to JPEG ~0.8. Re-encoding through a canvas drops all EXIF
 * metadata, including GPS location, so the bytes we upload carry no location
 * (REQ-14.8). The server never trusts or reads EXIF either.
 *
 * Not server-only, but it uses `Image`/`canvas` and must run in the browser.
 */

export const MAX_LONG_EDGE = 1280;
export const JPEG_QUALITY = 0.8;

export interface PreparedPhoto {
  /** A fresh JPEG File with no EXIF (safe to upload). */
  file: File;
  /** Object/data URL for a local preview. Caller revokes object URLs. */
  previewUrl: string;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image."));
    img.src = src;
  });
}

/**
 * Prepare a captured photo for upload: downscale + re-encode to EXIF-free JPEG.
 * Throws if the browser can't decode the file or produce a blob.
 */
export async function preparePhoto(input: File): Promise<PreparedPhoto> {
  const srcUrl = URL.createObjectURL(input);
  let img: HTMLImageElement;
  try {
    img = await loadImage(srcUrl);
  } finally {
    URL.revokeObjectURL(srcUrl);
  }

  const { width: sw, height: sh } = img;
  const longEdge = Math.max(sw, sh);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not encode the photo.");

  const file = new File([blob], "stamp.jpg", { type: "image/jpeg" });
  const previewUrl = URL.createObjectURL(blob);
  return { file, previewUrl, width: w, height: h };
}
