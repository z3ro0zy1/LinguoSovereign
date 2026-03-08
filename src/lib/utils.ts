import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIELTSTitle(rawTitle: string): string {
  const cttMatch = rawTitle.match(/C(\d+)-T(\d+)-T(\d+)/i);
  if (cttMatch) {
    return `Cambridge ${cttMatch[1]} Test ${cttMatch[2]} Task ${cttMatch[3]}`;
  }

  let title = rawTitle.replace(/【.*?】/g, "").replace(/（.*?）/g, "");
  title = title.replace(/C(\d+)-T(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/剑(\d+)\s*Test\s*(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/答案及解析.*$/, "");
  title = title.replace(/_雅思.*$/, "");
  title = title.replace(/「.*?」/, "");

  return title.trim();
}

function toEncodedPublicPath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  return `/${normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function resolveAudioUrl(audioUrl: string | null | undefined): string {
  if (!audioUrl) return "";
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;

  const normalized = audioUrl.replaceAll("\\", "/");
  const publicMarker = "/public/";
  const publicIndex = normalized.lastIndexOf(publicMarker);

  if (publicIndex >= 0) {
    return toEncodedPublicPath(normalized.slice(publicIndex + publicMarker.length));
  }

  if (normalized.startsWith("public/")) {
    return toEncodedPublicPath(normalized.replace(/^public\//, ""));
  }

  if (normalized.startsWith("/")) {
    return toEncodedPublicPath(normalized);
  }

  if (normalized.includes("/")) {
    return toEncodedPublicPath(normalized);
  }

  return toEncodedPublicPath(`audios/${normalized}`);
}

export function roundIELTS(score: number): number {
  const decimal = score - Math.floor(score);
  if (decimal < 0.25) {
    return Math.floor(score);
  } else if (decimal < 0.75) {
    return Math.floor(score) + 0.5;
  } else {
    return Math.ceil(score);
  }
}
