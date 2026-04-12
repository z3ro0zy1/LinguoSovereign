"use client";

import { memo } from "react";
import type { ReactNode } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ObjectiveToolbar = memo(function ObjectiveToolbar({
  timer,
  fontSizeRatio,
  onDecreaseFont,
  onIncreaseFont,
  result,
  isLastPart,
  loading,
  onSubmitAll,
  scoreLabel,
  submittingLabel,
  fullSubmitLabel,
  answeringInProgressLabel,
}: {
  timer: ReactNode;
  fontSizeRatio: number;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  result?: {
    summary: {
      totalCorrect: number;
      totalObjective: number;
    };
  };
  isLastPart: boolean;
  loading: boolean;
  onSubmitAll: () => void;
  scoreLabel: string;
  submittingLabel: string;
  fullSubmitLabel: string;
  answeringInProgressLabel: string;
}) {
  /**
   * 顶部工具栏虽然视觉上不大，但它聚合了：
   * - 计时显示
   * - 字号调节
   * - 提交状态 / 分数显示
   *
   * 之前这块直接内嵌在 ObjectiveRenderer 主体里，导致主组件既要管页面布局，
   * 又要背工具栏的条件渲染。抽成独立 memo 组件后，ObjectiveRenderer 更像编排层，
   * 工具栏本身也有了独立边界，后续再加按钮不会继续膨胀主文件。
   */
  return (
    <div className="flex items-center justify-between bg-white border rounded-t-lg p-4 shadow-sm z-10 shrink-0">
      {timer}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-gray-900"
            onClick={onDecreaseFont}
          >
            <Type className="w-3 h-3" />
          </Button>
          <span className="text-xs font-bold w-10 text-center text-gray-600">
            {Math.round(fontSizeRatio * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-gray-900"
            onClick={onIncreaseFont}
          >
            <Type className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {result ? (
          <div className="px-4 py-2 bg-green-100 text-green-800 rounded-xl font-bold border border-green-200 shadow-sm">
            {scoreLabel}: {result.summary.totalCorrect} /{" "}
            {result.summary.totalObjective}
          </div>
        ) : isLastPart ? (
          <Button
            onClick={onSubmitAll}
            disabled={loading}
            size="default"
            className="shadow-md rounded-xl bg-gray-900 hover:bg-gray-800 font-bold px-6"
          >
            {loading ? submittingLabel : fullSubmitLabel}
          </Button>
        ) : (
          <div className="text-gray-500 font-medium mr-2 text-sm mt-1 animate-pulse flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {answeringInProgressLabel}
          </div>
        )}
      </div>
    </div>
  );
});
