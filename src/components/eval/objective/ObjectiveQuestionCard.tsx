import type { ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ObjectiveOption = {
  value: string;
  label: string;
};

type ObjectiveQuestion = {
  id: string;
  serialNumber?: number;
  options?: ObjectiveOption[];
  answer?: unknown;
};

type ObjectiveSubResult = {
  officialAnswer?: unknown;
};

type ObjectiveResult = {
  subResults?: ObjectiveSubResult[];
  officialAnalysis?: string[];
};

export function ObjectiveQuestionCard({
  question,
  selectedAnswers,
  renderedStem,
  resultData,
  hasResult,
  onToggleCheckbox,
  onUpdateAnswer,
}: {
  question: ObjectiveQuestion;
  selectedAnswers: string[];
  renderedStem: ReactNode;
  resultData?: ObjectiveResult;
  hasResult: boolean;
  onToggleCheckbox: (questionId: string, value: string) => void;
  onUpdateAnswer: (questionId: string, index: number, value: string) => void;
}) {
  return (
    <Card id={`qcard-${question.id}`} className="scroll-m-20 border-gray-200 shadow-sm">
      <CardContent className="relative flex flex-col gap-4 p-5 md:p-6">
        <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 shadow-sm">
          {question.serialNumber}
        </div>

        {renderedStem}

        {question.options && question.options.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-gray-50/50 p-4">
            {question.options.map((option) => {
              const answerSlots = Array.isArray(question.answer) ? question.answer.length : 1;
              const isMultiSelect = answerSlots > 1;
              const maxAllowed = answerSlots;
              const isSelected = isMultiSelect
                ? selectedAnswers.includes(option.value)
                : selectedAnswers[0] === option.value;
              const isLimitReached = isMultiSelect && selectedAnswers.length >= maxAllowed && !isSelected;

              let optBg = "border-gray-200 bg-white hover:bg-gray-100";
              let optText = "text-gray-700";
              const disabledState = hasResult || isLimitReached;
              const limitClasses = isLimitReached && !hasResult
                ? "cursor-not-allowed opacity-60 hover:bg-white"
                : "cursor-pointer";

              if (hasResult && resultData) {
                const officialAnswers = resultData.subResults?.map((item) =>
                  String(item.officialAnswer ?? "").trim().toLowerCase(),
                ) || [];
                const isCorrectAnswer = officialAnswers.includes(option.value.toLowerCase());

                if (isCorrectAnswer) {
                  optBg = "border-green-400 bg-green-100";
                  optText = "font-semibold text-green-900";
                } else if (isSelected) {
                  optBg = "border-red-300 bg-red-100";
                  optText = "text-red-900 line-through opacity-70";
                }
              } else if (isSelected) {
                optBg = "border-blue-400 bg-blue-50 ring-1 ring-blue-400";
              }

              return (
                <label
                  key={`${question.id}-${option.value}`}
                  className={`flex items-center gap-3 rounded border p-3 transition-colors ${optBg} ${limitClasses}`}
                >
                  <input
                    type={isMultiSelect ? "checkbox" : "radio"}
                    name={`q-${question.id}`}
                    value={option.value}
                    disabled={disabledState}
                    checked={isSelected}
                    onChange={(event) =>
                      isMultiSelect
                        ? onToggleCheckbox(question.id, event.target.value)
                        : onUpdateAnswer(question.id, 0, event.target.value)
                    }
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`flex-1 ${optText}`}>
                    <strong className="mr-2 text-gray-900">{option.value}.</strong>
                    <span dangerouslySetInnerHTML={{ __html: option.label }} />
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {resultData?.officialAnalysis && (
          <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
              <CornerDownRight className="h-4 w-4 text-orange-500" />
              Official Analysis
            </div>
            <div className="prose prose-sm max-w-none rounded-md border border-orange-100 bg-orange-50/50 p-4 text-sm text-gray-600">
              <div dangerouslySetInnerHTML={{ __html: resultData.officialAnalysis.join("<br/>") }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
