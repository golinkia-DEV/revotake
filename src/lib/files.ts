/**
 * URLs de archivos servidos por la API bajo /uploads (logos, fotos de servicios).
 */
export function filesBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FILES_ORIGIN) {
    return process.env.NEXT_PUBLIC_FILES_ORIGIN.replace(/\/$/, "");
  }
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";
  const stripped = api.replace(/\/api\/v1\/?$/i, "");
  return stripped || "http://localhost:8001";
}

export function fileUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${filesBaseUrl()}${p}`;
}
