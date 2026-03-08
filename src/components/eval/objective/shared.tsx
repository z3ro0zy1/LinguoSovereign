/* eslint-disable @next/next/no-img-element */
import parse, { type HTMLReactParserOptions } from "html-react-parser";

type ParsedDomNode = {
  type?: string;
  name?: string;
  attribs?: Record<string, string>;
};

function fixAssetPath(src: string) {
  if (src.startsWith("images/")) return `/${src}`;
  if (src.startsWith("../images/")) {
    return src.replace("../images/", "/images/");
  }
  return src;
}

export const imageFixingOptions: HTMLReactParserOptions = {
  replace(domNode) {
    const node = domNode as ParsedDomNode;
    if (node.type === "tag" && node.name === "img" && node.attribs?.src) {
      return (
        <img
          {...node.attribs}
          src={fixAssetPath(node.attribs.src)}
          className="mx-auto my-4 h-auto max-w-full rounded shadow-sm"
          alt="IELTS Graphic"
        />
      );
    }
  },
};

export function normalizeQuestionStemHtml(stem: string, serialNumber?: number) {
  let normalized = stem;

  if (serialNumber) {
    normalized = normalized.replace(
      new RegExp(`^\\s*<p>\\s*${serialNumber}[.)]?\\s*<\\/p>`, "i"),
      "",
    );
    normalized = normalized.replace(
      new RegExp(`^\\s*${serialNumber}[.)]?(?=<|\\s*[A-Za-z])`),
      "",
    );
  }

  normalized = normalized.replace(
    /<p>\s*(\d{1,2})\s*<\/p>\s*<p>/g,
    '<p><span class="question-inline-number">$1.</span> ',
  );
  normalized = normalized.replace(
    /(^|>)(\s*)(\d{1,2})(?=[A-Za-z])/g,
    '$1$2<span class="question-inline-number">$3.</span> ',
  );
  normalized = normalized.replace(
    /(<\/p>\s*<p>)(\d{1,2})([A-Za-z])/g,
    '$1<span class="question-inline-number">$2.</span> $3',
  );
  normalized = normalized.replace(
    /(<br\s*\/?>|\n)\s*(\d{1,2})([A-Za-z])/g,
    '$1<span class="question-inline-number">$2.</span> $3',
  );

  return normalized.trim();
}

export function renderPassageBlock(passageItem: unknown) {
  if (typeof passageItem === "string") {
    return parse(passageItem, imageFixingOptions);
  }

  const block = passageItem as { english?: string; title?: string } | null;
  return parse(String(block?.english || block?.title || ""), imageFixingOptions);
}
