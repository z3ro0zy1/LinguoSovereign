import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIELTSTitle(rawTitle: string): string {
  // E.g., C5-T1-T1答案及解析_雅思写作练习「新东方雅思官方网校」
  const cttMatch = rawTitle.match(/C(\d+)-T(\d+)-T(\d+)/i);
  if (cttMatch) {
    return `Cambridge ${cttMatch[1]} Test ${cttMatch[2]} Task ${cttMatch[3]}`;
  }

  // General fallback logic
  let title = rawTitle.replace(/【.*?】/g, "").replace(/（.*?）/g, "");
  title = title.replace(/C(\d+)-T(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/剑(\d+)\s*Test\s*(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/答案及解析.*$/, "");
  title = title.replace(/_雅思.*$/, "");
  title = title.replace(/「.*?」/, "");

  return title.trim();
}

/**
 * Rounds a raw average score to the nearest 0.5 band score
 * logic:
 * < .25 -> .0
 * >= .25 and < .75 -> .5
 * >= .75 -> round up to next integer
 */
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
