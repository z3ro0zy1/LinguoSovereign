/**
 * 做题页面的总壳子 (Evaluation Wrapper Component)
 * 作用：这是所有练习页面的“中转站”。它根据题目的类型（是听读还是听说写），
 * 决定是把题目交给“客观题渲染器”还是“主观题渲染器”。
 * 同时它还管理底部的进度条、切换练习和保存得分。
 */

"use client";

import { useState } from "react";
import ObjectiveRenderer from "./ObjectiveRenderer"; // 引入客观题渲染器 (听力/阅读)
import SubjectiveRenderer from "./SubjectiveRenderer"; // 引入主观题渲染器 (写作/口语)
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { formatIELTSTitle } from "@/lib/utils";

export default function EvalWrapper({
  unit, // 当前这一道题的详细数据
  siblings, // 同一个 Test 里的其他题（比如 Passage 1 对应的 Passage 2, 3）
  flowSequence, // 模考流的顺序编号
  allFlowIds = [], // 模考流中所有要把题目串起来的 ID 列表
  subjectiveMode = "standard", // 主观题模式：标准 或 AI 对话
}: {
  unit: {
    id: string;
    title: string;
    category: string;
    audioUrl?: string | null;
    questions: Array<{ id: string; stem?: string }>;
  };
  siblings?: Array<{ id: string; title: string }>;
  flowSequence?: string;
  allFlowIds?: string[];
  subjectiveMode?: "standard" | "ai";
}) {
  const router = useRouter(); // Next.js 的页面跳转工具

  /**
   * --- 提交结果状态管理 (Submission Result State) ---
   * 作用：记录用户提交后的分数、AI 评价等。
   * 逻辑：如果这个状态有值，页面就会变成“批改模式”，显示正确答案。
   * 习惯：我们会把结果存在浏览器的 localStorage 里，防止刷新页面后分数丢了。
   */
  const [submissionResult, setSubmissionResult] = useState<Record<
    string,
    unknown
  > | null>(() => {
    if (typeof window === "undefined") return null;

    const savedRes = localStorage.getItem(`linguo_result_${unit.id}`);
    if (!savedRes) return null;

    try {
      return JSON.parse(savedRes);
    } catch {
      return null;
    }
  });

  /**
   * 保存并更新结果的回调函数
   * 当用户在子组件 (比如 ObjectiveRenderer) 点击“提交”并拿到分数后，会调用这个函数。
   */
  const handleGlobalResult = (
    res: Record<string, unknown>,
    specificUnitId?: string,
  ) => {
    const targetId = specificUnitId || unit.id;
    if (typeof window !== "undefined") {
      localStorage.setItem(`linguo_result_${targetId}`, JSON.stringify(res));
    }
    if (targetId === unit.id) {
      setSubmissionResult(res); // 更新当前页面的状态，让界面变红/变绿
    }
  };

  // 判定逻辑
  const isObjective = unit.category === "Reading/Listening"; // 是否属于“填空/选择”类
  const isWriting = unit.category === "Writing"; // 是否是写作

  // --- 模考连考逻辑 (Full Test Navigation Logic) ---
  const currentIndex = allFlowIds.indexOf(unit.id); // 看看当前题在模考序列里排第几
  const isLastPart =
    currentIndex === -1 || currentIndex === allFlowIds.length - 1; // 是不是最后一门考试

  // 计算下一项考试的 ID 和链接
  const nextFlowIds =
    currentIndex >= 0
      ? allFlowIds.slice(currentIndex + 1)
      : allFlowIds.slice(1);
  const nextHref =
    nextFlowIds.length > 0
      ? `/eval/${nextFlowIds[0]}?flow=${nextFlowIds.join(",")}`
      : "/dashboard/analytics";

  // 是否需要显示底部常驻工具条 (只要有多个兄弟题目或者在模考流中)
  const hasBottomDock =
    (siblings && siblings.length > 1) ||
    (submissionResult && flowSequence !== undefined);

  return (
    <div
      className={`flex flex-col gap-6 ${hasBottomDock ? "pb-32 md:pb-36" : ""}`}
    >
      {/* 顶部标题栏 */}
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{formatIELTSTitle(unit.title)}</h1>
          <p className="text-sm text-gray-500">分类: {unit.category}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          返回首页
        </Button>
      </header>

      {/**
       * --- 分发渲染 (Routing to Specialized Renderers) ---
       * 如果是阅读/听力：交给 ObjectiveRenderer 处理选择/填空。
       * 如果是写作/口语：交给 SubjectiveRenderer 处理文字编辑器/录音。
       */}
      {isObjective ? (
        <ObjectiveRenderer
          unit={unit}
          onResult={handleGlobalResult}
          result={submissionResult}
          isLastPart={isLastPart}
          allFlowIds={allFlowIds}
        />
      ) : (
        <SubjectiveRenderer
          unit={unit}
          isWriting={isWriting}
          mode={subjectiveMode}
          onResult={handleGlobalResult}
          result={submissionResult}
          isLastPart={isLastPart}
          allFlowIds={allFlowIds}
        />
      )}

      {/**
       * --- 底部导航浮窗 (Bottom Navigation Bar) ---
       * 它会在屏幕底部固定显示，方便用户快速跳到下一篇阅读，或者在考完一门后连着考下一门。
       */}
      {((siblings && siblings.length > 1) ||
        (submissionResult && flowSequence !== undefined)) && (
        <div className="fixed bottom-0 left-0 w-full h-16 bg-[#ebf0f7] border-t border-gray-300 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex items-center justify-center z-50">
          <div className="flex items-center justify-between w-full max-w-[1600px] px-8">
            {/* 这里的 id="footer-left-slot" 是一个“挂载点”，
                子组件 (ObjectiveRenderer) 可以利用传送门把题号列表投影到这里 */}
            <div
              className="flex gap-2 items-center w-full"
              id="footer-left-slot"
            />

            {/* 同一 Test 里的题目切换 (如 Passage 1, 2, 3) */}
            {siblings && siblings.length > 1 && (
              <div className="flex gap-2 items-center">
                {siblings.map((sib, i) => {
                  const isActive = sib.id === unit.id;
                  const formattedTitle = formatIELTSTitle(sib.title);

                  // 自动生成按钮文字（如果是第几篇/第几部分）
                  let label = "Part " + (i + 1);
                  const match = formattedTitle.match(
                    /(Passage \d|Part \d|Task \d)/i,
                  );
                  if (match) label = match[0];

                  return (
                    <Link
                      key={sib.id}
                      href={
                        flowSequence !== undefined
                          ? `/eval/${sib.id}?flow=${flowSequence}${subjectiveMode === "ai" ? "&mode=ai" : ""}`
                          : `/eval/${sib.id}${subjectiveMode === "ai" ? "?mode=ai" : ""}`
                      }
                    >
                      <Button
                        variant={isActive ? "default" : "outline"}
                        className={`min-w-[48px] h-10 ${isActive ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm border-gray-200"} font-black text-sm rounded-lg transition-all`}
                      >
                        {label}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 当整门课考完了 (比如 Reading 提交了)，显示“连考下一项”或是“结束并看总报告” */}
            {submissionResult && (
              <div className="flex items-center ml-auto pl-4 border-l border-gray-300">
                {flowSequence ? (
                  <Link href={nextHref}>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md h-10 px-6">
                      继续进入下一模块 ({nextFlowIds.length} 待考){" "}
                      <ArrowRightIcon className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard/analytics">
                    <Button className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md h-10 px-6">
                      结束模考查看总报告{" "}
                      <ArrowRightIcon className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
