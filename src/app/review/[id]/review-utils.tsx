/* eslint-disable @next/next/no-img-element */
import { type HTMLReactParserOptions } from "html-react-parser";
import type { ReactNode } from "react";
import { resolveStaticAssetUrl } from "@/lib/utils";

type ReviewSubResult = {
  isCorrect?: boolean;
  officialAnswer?: unknown;
};

type ParsedDomNode = {
  type?: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
};

export function formatAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return "N/A";
  if (typeof answer === "string") return answer || "N/A";
  if (typeof answer === "number" || typeof answer === "boolean") {
    return String(answer);
  }
  if (Array.isArray(answer)) {
    return answer
      .map((item) =>
        typeof item === "object" && item !== null
          ? String((item as { value?: unknown; label?: unknown }).value ?? (item as { value?: unknown; label?: unknown }).label ?? JSON.stringify(item))
          : String(item),
      )
      .join(", ");
  }
  if (typeof answer === "object") {
    const value = answer as { value?: unknown; label?: unknown };
    if (value.value !== undefined) return String(value.value);
    if (value.label !== undefined) return String(value.label);
    return JSON.stringify(answer);
  }
  return String(answer);
}

export function buildReviewParseOptions(
  userAnswers: string[] | undefined,
  subResults: ReviewSubResult[] | undefined,
  showAnswers: boolean,
  officialAnswer: unknown,
): HTMLReactParserOptions {
  let blankIndex = 0;

  return {
    replace(domNode) {
      const node = domNode as ParsedDomNode;

      if (node.type === "tag" && node.name === "img" && node.attribs?.src) {
        return (
          <img
            {...node.attribs}
            src={resolveStaticAssetUrl(node.attribs.src)}
            className="mx-auto my-4 h-auto max-w-full rounded shadow-sm"
            alt="IELTS Graphic"
          />
        );
      }

      if (node.type === "text" && node.data && node.data.includes("{{response}}")) {
        const parts = node.data.split("{{response}}");

        return (
          <>
            {parts.map((part, idx) => {
              if (idx === parts.length - 1) return <span key={idx}>{part}</span>;

              const currentIdx = blankIndex++;
              const userVal = userAnswers?.[currentIdx] ?? "";
              const subRes = subResults?.[currentIdx];

              let officialStr = "";
              if (subRes?.officialAnswer !== undefined) {
                officialStr = String(subRes.officialAnswer).split(";")[0];
              } else if (Array.isArray(officialAnswer)) {
                officialStr = String(officialAnswer[currentIdx] ?? "");
              } else if (officialAnswer !== undefined) {
                officialStr = String(officialAnswer);
              }

              let inputClass =
                "mx-1 inline-block min-w-[90px] border-b-2 border-gray-300 px-2 text-center text-sm text-gray-500";
              let correctBadge: ReactNode = null;

              if (subRes !== undefined) {
                if (subRes.isCorrect) {
                  inputClass =
                    "mx-1 inline-block min-w-[90px] rounded border-b-2 border-green-500 bg-green-50 px-2 text-center text-sm font-bold text-green-700";
                  correctBadge = (
                    <CheckIcon className="-mt-0.5 ml-0.5 inline h-3.5 w-3.5 text-green-500" />
                  );
                } else {
                  inputClass =
                    "mx-1 inline-block min-w-[90px] rounded border-b-2 border-red-400 bg-red-50 px-2 text-center text-sm text-red-600 line-through";
                  correctBadge = officialStr ? (
                    <span className="ml-1 inline-block rounded border border-green-200 bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                      ✓ {officialStr}
                    </span>
                  ) : null;
                }
              } else if (showAnswers && officialStr) {
                inputClass =
                  "mx-1 inline-block min-w-[90px] rounded border-b-2 border-green-400 bg-green-50 px-2 text-center text-sm font-bold text-green-700";
              }

              const displayVal =
                subRes !== undefined
                  ? userVal || "—"
                  : showAnswers
                    ? officialStr || "—"
                    : "______";

              return (
                <span key={idx} className="inline-flex items-baseline gap-0.5">
                  <span>{part}</span>
                  <span className={inputClass}>{displayVal}</span>
                  {correctBadge}
                </span>
              );
            })}
          </>
        );
      }
    },
  };
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

export function parseRichAnswer(value: string): ReactNode[] {
  const hasStructuredMarkdown = /(^|\n)\s*(#{2,3}\s|[-*]\s)/.test(value);
  const lines = value.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const textValue = paragraphBuffer.join(" ").trim();
    if (!textValue) {
      paragraphBuffer = [];
      return;
    }
    const key = `paragraph-${nodes.length}`;
    nodes.push(
      <p key={key} className="text-[15px] leading-8 text-slate-700">
        {renderInlineMarkdown(textValue, key)}
      </p>,
    );
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const key = `list-${nodes.length}`;
    nodes.push(
      <ul key={key} className="list-disc space-y-2 pl-5 text-[15px] leading-8 text-slate-700 marker:text-slate-400">
        {listBuffer.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInlineMarkdown(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h4 key={`h4-${nodes.length}`} className="text-xl font-black text-slate-900">
          {line.slice(4)}
        </h4>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h3 key={`h3-${nodes.length}`} className="text-2xl font-black tracking-tight text-slate-900">
          {line.slice(3)}
        </h3>,
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      return;
    }

    /**
     * review 页里很多 AI 分析不是严格 Markdown，
     * 而是“多行普通文本 + 少量强调”的混合形式。
     * 如果继续把这些行直接 join(" ")，原始段落感会完全丢掉。
     *
     * 这里的策略是：
     * - 真正有 markdown 结构（## / ### / 列表）时，沿用原有段落合并逻辑
     * - 否则把每一行都当成一个独立段落保留下来
     */
    if (!hasStructuredMarkdown) {
      flushParagraph();
      paragraphBuffer.push(line);
      flushParagraph();
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushList();

  return nodes;
}
