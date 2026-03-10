/**
 * 通用工具函数 (Utility Functions)
 * 作用：存放一些在整个项目中反复使用的零碎逻辑。
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名 (cn)
 * 作用：动态合并类名，解决 Tailwind 类名冲突（比如两个 padding 类冲突时，以最后一个为准）。
 * 小白理解：就像拼积木，把不同的样式名称拼在一起。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化雅思题目名称 (formatIELTSTitle)
 * 作用：把数据库里各种乱七八糟的题目名称统一改成标准的格式。
 * 示例：把 "C10-T1-T2" 转换成 "Cambridge 10 Test 1 Task 2"
 */
export function formatIELTSTitle(rawTitle: string): string {
  // 1. 匹配 CXX-TXX-TXX 这种缩写格式
  const cttMatch = rawTitle.match(/C(\d+)-T(\d+)-T(\d+)/i);
  if (cttMatch) {
    return `Cambridge ${cttMatch[1]} Test ${cttMatch[2]} Task ${cttMatch[3]}`;
  }

  // 2. 清理掉各种中文字符、符号（比如【雅思精选】这种干扰项）
  let title = rawTitle.replace(/【.*?】/g, "").replace(/（.*?）/g, "");
  title = title.replace(/C(\d+)-T(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/剑(\d+)\s*Test\s*(\d+)/i, "Cambridge $1 Test $2");
  title = title.replace(/答案及解析.*$/, "");
  title = title.replace(/_雅思.*$/, "");
  title = title.replace(/「.*?」/, "");

  return title.trim();
}

/**
 * 内部编码工具：把路径转义，防止文件名里有空格或特殊字符导致图片加载失败。
 */
function toEncodedPublicPath(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  return `/${normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

/**
 * 解析静态资源（图片等）URL (resolveStaticAssetUrl)
 * 作用：确保无论数据库里存的是绝对路径还是相对路径，前端都能正确加载出图片。
 */
export function resolveStaticAssetUrl(assetUrl: string | null | undefined): string {
  if (!assetUrl) return "";
  if (/^https?:\/\//i.test(assetUrl)) return assetUrl; // 如果本身就是网络地址，直接用

  const normalized = assetUrl.replaceAll("\\", "/");
  const publicMarker = "/public/";
  const publicIndex = normalized.lastIndexOf(publicMarker);

  // 如果路径包含 /public/，截取后面的部分
  if (publicIndex >= 0) {
    return toEncodedPublicPath(normalized.slice(publicIndex + publicMarker.length));
  }

  // 各种路径格式的兼容性处理
  if (normalized.startsWith("public/")) {
    return toEncodedPublicPath(normalized.replace(/^public\//, ""));
  }

  if (normalized.startsWith("../images/")) {
    return toEncodedPublicPath(normalized.replace(/^\.\.\/images\//, "images/"));
  }

  if (normalized.startsWith("images/")) {
    return toEncodedPublicPath(normalized);
  }

  if (normalized.startsWith("/")) {
    return toEncodedPublicPath(normalized);
  }

  if (normalized.includes("/")) {
    return toEncodedPublicPath(normalized);
  }

  // 默认补充 images/ 前缀
  return toEncodedPublicPath(`images/${normalized}`);
}

/**
 * 解析音频文件地址 (resolveAudioUrl)
 * 作用：跟解析图片类似，专门处理音频文件的路径。
 */
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

  // 默认补充 audios/ 前缀
  return toEncodedPublicPath(`audios/${normalized}`);
}

/**
 * 雅思分值进位规则 (roundIELTS)
 * 作用：雅思总分不是简单的四舍五入。
 * 规则：小数 < 0.25 -> 舍掉；0.25 <= 小数 < 0.75 -> 进位到 0.5；小数 >= 0.75 -> 进位到 整数。
 * 示例：6.125 -> 6.0 | 6.25 -> 6.5 | 6.75 -> 7.0
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
