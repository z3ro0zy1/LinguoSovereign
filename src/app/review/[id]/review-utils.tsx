/* eslint-disable @next/next/no-img-element */
import parse, { type HTMLReactParserOptions } from "html-react-parser";
import type { ReactNode } from "react";

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

function normalizeReviewImageSrc(src: string) {
  if (src.startsWith("images/")) return `/${src}`;
  if (src.startsWith("../images/")) return src.replace("../images/", "/images/");
  return src;
}

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
            src={normalizeReviewImageSrc(node.attribs.src)}
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

export function parseRichAnswer(value: string) {
  return parse(value.replace(/\n/g, "<br/>"));
}
