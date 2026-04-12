"use client";

import { memo } from "react";
import {
  QuestionNavigatorPortal,
  type NavigatorQuestion,
  type NavigatorResult,
} from "./QuestionNavigatorPortal";

export const ObjectiveQuestionPanel = memo(function ObjectiveQuestionPanel({
  questions,
  answers,
  results,
  width,
  children,
}: {
  questions: NavigatorQuestion[];
  answers: Record<string, string[]>;
  results?: NavigatorResult[];
  width: string;
  children: React.ReactNode;
}) {
  /**
   * 右侧题目区承担两层职责：
   * - 题号导航的 portal 投影
   * - 真正的题目列表滚动容器
   *
   * 把它抽出来后，ObjectiveRenderer 不再直接持有右侧 DOM 结构，
   * 只需要把“当前题组数据”和“内部题目节点”交给这个容器。
   * 这样后面如果要继续做：
   * - 题号导航优化
   * - 虚拟滚动
   * - 分组折叠
   * 都可以在这个边界内继续演进。
   */
  return (
    <div
      className="flex flex-col h-[50%] lg:h-full relative"
      style={{ width }}
    >
      <QuestionNavigatorPortal
        questions={questions}
        answers={answers}
        results={results}
      />

      <div className="overflow-y-auto p-4 md:p-8 flex-1 space-y-8 pb-12">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 font-bold mb-6 mt-2">
          题目练习 (Questions)
        </h2>
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
});
