import type { ReactElement } from "react";
import { createPortal } from "react-dom";

export type NavigatorQuestion = {
  id: string;
  serialNumber?: number;
  answer?: unknown;
};

export type NavigatorResult = {
  questionId: string;
  isCorrect?: boolean;
  subResults?: Array<{ isCorrect?: boolean }>;
};

export function QuestionNavigatorPortal({
  questions,
  answers,
  results,
}: {
  questions: NavigatorQuestion[];
  answers: Record<string, string[]>;
  results?: NavigatorResult[];
}) {
  if (typeof document === "undefined") return null;

  const mountNode = document.getElementById("footer-left-slot");
  if (!mountNode) return null;

  const navigationButtons = questions.reduce<ReactElement[]>(
    (buttons, question, questionIndex) => {
      const answerCount = Array.isArray(question.answer) ? question.answer.length : 1;
      const previousCount = questions
        .slice(0, questionIndex)
        .reduce((total, currentQuestion) => total + (Array.isArray(currentQuestion.answer) ? currentQuestion.answer.length : 1), 0);
      const baseNum = question.serialNumber || previousCount + 1;
      const result = results?.find((item) => item.questionId === question.id);

      for (let index = 0; index < answerCount; index += 1) {
        const displayNum = baseNum + index;
        const isAnswered = Boolean(answers[question.id]?.[index]?.trim().length > 0);
        const isCorrect = result
          ? (result.subResults?.[index]?.isCorrect ?? result.isCorrect)
          : false;
        const bgColor = result
          ? isCorrect
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
          : isAnswered
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200";

        buttons.push(
          <button
            key={`${question.id}-${index}`}
            onClick={() => {
              document.getElementById(`qcard-${question.id}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold transition-colors ${bgColor}`}
          >
            {displayNum}
          </button>,
        );
      }

      return buttons;
    },
    [],
  );

  return createPortal(
    <div className="flex w-full items-center gap-4">
      <h3 className="mt-1 hidden text-xs font-bold uppercase tracking-wider text-gray-500 sm:block">
        Question Navigation
      </h3>
      <div className="hidden-scrollbar flex max-h-[50px] flex-1 flex-wrap gap-2 overflow-y-auto pr-4">
        {navigationButtons}
      </div>
    </div>,
    mountNode,
  );
}
