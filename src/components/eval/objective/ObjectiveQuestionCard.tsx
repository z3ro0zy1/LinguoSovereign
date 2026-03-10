/**
 * ObjectiveQuestionCard 组件
 * 作用：专门用于渲染“客观题”的题目卡片（如：单选题、多选题）。
 * 这个组件负责显示题目的序号、题干、选项，并在考试结束后显示正确答案和解析。
 */

import type { ReactNode } from "react";
import { CornerDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// --- 类型定义 ---
type ObjectiveOption = {
  value: string; // 选项的值 (如 "A", "B")
  label: string; // 选项的内容 (HTML 字符串)
};

type ObjectiveQuestion = {
  id: string;
  serialNumber?: number; // 题目序号
  options?: ObjectiveOption[]; // 选项列表
  answer?: unknown; // 正确答案（用于判断是单选还是多选）
};

type ObjectiveSubResult = {
  officialAnswer?: unknown; // 后端返回的官方答案
};

type ObjectiveResult = {
  subResults?: ObjectiveSubResult[];
  officialAnalysis?: string[]; // 官方解析
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
  selectedAnswers: string[]; // 用户选中的答案列表
  renderedStem: ReactNode; // 预处理过的题干组件
  resultData?: ObjectiveResult; // 批改后的结果数据
  hasResult: boolean; // 是否已经出分
  onToggleCheckbox: (questionId: string, value: string) => void; // 多选题切换逻辑
  onUpdateAnswer: (questionId: string, index: number, value: string) => void; // 单选题更新逻辑
}) {
  return (
    <Card
      id={`qcard-${question.id}`}
      className="scroll-m-20 border-gray-200 shadow-sm"
    >
      <CardContent className="relative flex flex-col gap-4 p-5 md:p-6">
        {/* 悬浮序号角标 */}
        <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 shadow-sm">
          {question.serialNumber}
        </div>

        {/* 渲染题干内容 */}
        {renderedStem}

        {/* 选项区：如果有选项列表，则渲染单选/多选框 */}
        {question.options && question.options.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-gray-50/50 p-4">
            {question.options.map((option) => {
              // 判断逻辑：如果正确答案是一个数组且长度 > 1，则视为多选题
              const answerSlots = Array.isArray(question.answer)
                ? question.answer.length
                : 1;
              const isMultiSelect = answerSlots > 1;
              const maxAllowed = answerSlots; // 多选题允许选几个

              const isSelected = isMultiSelect
                ? selectedAnswers.includes(option.value)
                : selectedAnswers[0] === option.value;

              // 是否已达选择上限（多选题专用）
              const isLimitReached =
                isMultiSelect &&
                selectedAnswers.length >= maxAllowed &&
                !isSelected;

              // --- 样式逻辑 ---
              let optBg = "border-gray-200 bg-white hover:bg-gray-100";
              let optText = "text-gray-700";
              const disabledState = hasResult || isLimitReached;
              const limitClasses =
                isLimitReached && !hasResult
                  ? "cursor-not-allowed opacity-60 hover:bg-white"
                  : "cursor-pointer";

              // 如果出了结果，根据对错显示 绿/红 背景
              if (hasResult && resultData) {
                const officialAnswers =
                  resultData.subResults?.map((item) =>
                    String(item.officialAnswer ?? "")
                      .trim()
                      .toLowerCase(),
                  ) || [];
                const isCorrectAnswer = officialAnswers.includes(
                  option.value.toLowerCase(),
                );

                if (isCorrectAnswer) {
                  optBg = "border-green-400 bg-green-100"; // 正确选项显绿色
                  optText = "font-semibold text-green-900";
                } else if (isSelected) {
                  optBg = "border-red-300 bg-red-100"; // 选错了显红色
                  optText = "text-red-900 line-through opacity-70";
                }
              } else if (isSelected) {
                // 考试中：选中的选项变蓝
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
                    <strong className="mr-2 text-gray-900">
                      {option.value}.
                    </strong>
                    {/* 选项文字可能包含 HTML（如数学符号、加粗等） */}
                    <span dangerouslySetInnerHTML={{ __html: option.label }} />
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* 官方解析区：出分后且有解析才显示 */}
        {resultData?.officialAnalysis && (
          <div className="mt-4 border-t border-dashed border-gray-200 pt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">
              <CornerDownRight className="h-4 w-4 text-orange-500" />
              题目解析 (Official Analysis)
            </div>
            <div className="prose prose-sm max-w-none rounded-md border border-orange-100 bg-orange-50/50 p-4 text-sm text-gray-600">
              {/* 解析内容可能包含多行 HTML */}
              <div
                dangerouslySetInnerHTML={{
                  __html: resultData.officialAnalysis.join("<br/>"),
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
