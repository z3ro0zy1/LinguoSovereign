import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import parse from "html-react-parser";
import { formatAnswer } from "./review-utils";
import { useLocale } from "@/components/LocaleProvider";

type ReviewQuestion = {
  id: string;
  stem?: string;
  answer?: unknown;
  options?: Array<{ value?: unknown; label?: unknown } | string>;
  officialAnalysis?: unknown;
};

function renderInlineEmphasis(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

function renderStructuredText(text: string) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = paragraphBuffer.join(" ").trim();
    if (!paragraph) {
      paragraphBuffer = [];
      return;
    }

    const key = `paragraph-${nodes.length}`;
    nodes.push(
      <p key={key} className="text-[15px] leading-8 text-slate-700">
        {renderInlineEmphasis(paragraph, key)}
      </p>,
    );
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const key = `list-${nodes.length}`;
    nodes.push(
      <ul
        key={key}
        className="space-y-2 pl-5 text-[15px] leading-8 text-slate-700 marker:text-slate-400 list-disc"
      >
        {listBuffer.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInlineEmphasis(item, `${key}-${index}`)}</li>
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
        <h5 key={`h5-${nodes.length}`} className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
          {line.slice(4)}
        </h5>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h4 key={`h4-${nodes.length}`} className="text-lg font-semibold text-slate-900">
          {line.slice(3)}
        </h4>,
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushList();

  return <div className="space-y-4">{nodes}</div>;
}

function renderOfficialAnalysis(officialAnalysis: unknown) {
  if (!officialAnalysis) return null;

  if (
    typeof officialAnalysis === "object" &&
    !Array.isArray(officialAnalysis)
  ) {
    const payload = officialAnalysis as {
      reference?: unknown;
      aiGrammarAnalysis?: unknown;
    };

    return (
      <div className="space-y-5">
        {payload.reference ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Reference
            </p>
            <div className="prose prose-sm max-w-none text-slate-700">
              {Array.isArray(payload.reference)
                ? parse(
                    payload.reference
                      .map((item) => (typeof item === "string" ? item : formatAnswer(item)))
                      .join("<br/>"),
                  )
                : parse(String(payload.reference))}
            </div>
          </div>
        ) : null}

        {payload.aiGrammarAnalysis ? (
          <div className="rounded-2xl border border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.9),rgba(255,255,255,0.95))] p-5 shadow-sm">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-700">
              AI Grammar Analysis
            </p>
            <div className="rounded-xl border border-violet-100 bg-white/70 p-4">
              {renderStructuredText(String(payload.aiGrammarAnalysis))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(officialAnalysis)) {
    return (
      <div className="prose prose-sm max-w-none text-slate-700">
        {parse(
          officialAnalysis
            .map((item) => (typeof item === "string" ? item : formatAnswer(item)))
            .join("<br/>"),
        )}
      </div>
    );
  }

  return renderStructuredText(String(officialAnalysis));
}

type ReviewSubResult = {
  officialAnswer?: unknown;
  isCorrect?: boolean;
};

type ReviewResult = {
  userAnswer?: unknown;
  isCorrect?: boolean;
  subResults?: ReviewSubResult[];
};

export function ObjectiveReviewQuestionCard({
  question,
  questionAnchorId,
  displayNumber,
  renderedStem,
  resultData,
  hasSubmission,
  showAnswers,
  isExpanded,
  onToggleAnalysis,
}: {
  question: ReviewQuestion;
  questionAnchorId: string;
  displayNumber: number;
  renderedStem: ReactNode;
  resultData?: ReviewResult;
  hasSubmission: boolean;
  showAnswers: boolean;
  isExpanded: boolean;
  onToggleAnalysis: () => void;
}) {
  const { t } = useLocale();
  const questionUsesInlineBlanks =
    typeof question.stem === "string" && question.stem.includes("{{response}}");

  return (
    <div
      id={questionAnchorId}
      className="group relative rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm transition-all hover:border-indigo-100 hover:shadow-md"
    >
      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 shadow-sm">
        {displayNumber}
      </div>

      <div className="prose prose-sm mb-5 max-w-none pl-2 font-medium leading-relaxed text-gray-800">
        {renderedStem}
      </div>

      {question.options && question.options.length > 0 && (
        <div className="mb-6 space-y-2">
          {question.options.map((opt, index) => {
            const optVal =
              typeof opt === "object"
                ? String(opt.value ?? opt.label ?? index)
                : String(opt);
            const optLabel =
              typeof opt === "object"
                ? String(opt.label ?? opt.value ?? opt)
                : String(opt);

            const officialAnswers = resultData?.subResults
              ? resultData.subResults.map((item) =>
                  String(item.officialAnswer ?? "").trim().toLowerCase(),
                )
              : Array.isArray(question.answer)
                ? question.answer.map((answer) => String(answer).trim().toLowerCase())
                : question.answer
                  ? [String(question.answer).trim().toLowerCase()]
                  : [];

            const userSelections = resultData?.userAnswer
              ? Array.isArray(resultData.userAnswer)
                ? resultData.userAnswer.map((value) => String(value).trim().toLowerCase())
                : [String(resultData.userAnswer).trim().toLowerCase()]
              : [];

            const isCorrectOpt = officialAnswers.includes(optVal.toLowerCase());
            const isSelected = userSelections.includes(optVal.toLowerCase());

            let optClass = "flex items-center gap-3 rounded-lg border p-3 text-sm";
            if (resultData) {
              if (isCorrectOpt) {
                optClass += " border-green-300 bg-green-50 font-semibold text-green-800";
              } else if (isSelected) {
                optClass += " border-red-300 bg-red-50 text-red-700 line-through opacity-70";
              } else {
                optClass += " border-gray-100 text-gray-500";
              }
            } else if (showAnswers && isCorrectOpt) {
              optClass += " border-green-300 bg-green-50 font-semibold text-green-800";
            } else {
              optClass += " border-gray-100 text-gray-600";
            }

            return (
              <div key={`${question.id}-${optVal}`} className={optClass}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{optLabel}</span>
                {resultData && isCorrectOpt && (
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-green-500" />
                )}
                {resultData && isSelected && !isCorrectOpt && (
                  <XCircle className="ml-auto h-4 w-4 shrink-0 text-red-400" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!questionUsesInlineBlanks && (
        <div className="flex flex-col gap-3 border-t border-gray-50 py-4">
          {hasSubmission ? (
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t("yourAnswer")}:</span>
                  <span
                    className={`font-mono text-sm font-bold ${
                      resultData?.isCorrect
                        ? "text-green-600"
                        : resultData?.userAnswer != null
                          ? "text-red-500"
                          : "text-gray-400"
                    }`}
                  >
                    {formatAnswer(resultData?.userAnswer) || t("noContentProvided")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t("correctAnswer")}:</span>
                  {showAnswers || resultData?.isCorrect !== undefined ? (
                    <span className="font-mono text-sm font-bold text-green-600">
                      {formatAnswer(resultData?.subResults?.[0]?.officialAnswer ?? question.answer)}
                    </span>
                  ) : (
                    <span className="select-none font-mono text-sm text-gray-300 blur-sm">██████</span>
                  )}
                </div>
              </div>
              {resultData?.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-red-400" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{t("correctAnswer")}:</span>
              {showAnswers ? (
                <span className="rounded bg-green-50 px-2 py-0.5 font-mono text-[15px] font-bold text-green-600">
                  {formatAnswer(question.answer)}
                </span>
              ) : (
                <span className="select-none rounded bg-gray-50 px-2 py-0.5 font-mono text-[15px] font-bold text-gray-300 blur-sm">
                  ██████
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {questionUsesInlineBlanks && hasSubmission && resultData && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
          {resultData.isCorrect ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-xs text-gray-400">
            {resultData.isCorrect ? t("allCorrect") : t("containsErrors")}
          </span>
        </div>
      )}

      {Boolean(question.officialAnalysis) && (
        <div className="mt-2 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/30 transition-all">
          <button
            onClick={onToggleAnalysis}
            className="flex w-full items-center justify-between p-3 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50/50"
          >
            <span>{isExpanded ? t("hideAnalysis") : t("showAnalysis")}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {isExpanded && (
            <div className="border-t border-blue-100/50 bg-blue-50/30 p-4 pt-4 text-sm text-gray-700">
              {renderOfficialAnalysis(question.officialAnalysis)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
