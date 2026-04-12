/**
 * 客观题渲染器 (Objective Renderer)
 * 作用：专门负责“雅思机考”模式的阅读和听力题目。
 * 特点：
 * 1. 左右分栏：左边看文章/听录音，右边做题。支持拖动调整比例。
 * 2. 真实模考：带计时器，阅读倒计时，听力正计时。
 * 3. 划线功能：模拟考场划线高亮。
 * 4. 自动存档：做题进度实时保存，断网或刷新也不怕。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { ReactNode, RefObject } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  CheckCircle2,
  XCircle,
  Headphones,
} from "lucide-react"; // UI 图标
import parse, { HTMLReactParserOptions } from "html-react-parser"; // HTML 字符串转 React 组件的工具
import { saveUnitState, getUnitState, clearUnitState } from "@/lib/testSession"; // 本地存档工具
import { resolveAudioUrl } from "@/lib/utils";
import { useLocale } from "@/components/LocaleProvider";
/* 引入具体的子功能组件 */
import { ObjectiveQuestionCard } from "./objective/ObjectiveQuestionCard"; // 单个题目卡片
import { RestoreDraftDialog } from "./objective/RestoreDraftDialog"; // 恢复进度弹窗
import { ObjectiveHighlightMenus } from "./objective/ObjectiveHighlightMenus";
import { ObjectiveQuestionPanel } from "./objective/ObjectiveQuestionPanel";
import { ObjectiveToolbar } from "./objective/ObjectiveToolbar";
import {
  normalizeQuestionStemHtml,
  renderPassageBlock,
} from "./objective/shared"; // 格式化工具
import { useObjectiveHighlighting } from "./objective/useObjectiveHighlighting";

// --- 类型定义 ---
// Record<题目ID, 用户填入的答案数组>
type AnswersState = Record<string, string[]>;

const ANSWER_PERSIST_DEBOUNCE_MS = 500;
const EMPTY_ANSWERS: string[] = [];
const STEM_CONTAINER_CLASS =
  "prose prose-slate prose-sm max-w-none text-gray-900 font-medium leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_strong]:font-black";

const ObjectiveTimerDisplay = memo(function ObjectiveTimerDisplay({
  initialSeconds,
  isListening,
  isActive,
  frozen,
  onElapsedChange,
  recommendedRemainingLabel,
}: {
  initialSeconds: number;
  isListening: boolean;
  isActive: boolean;
  frozen: boolean;
  onElapsedChange: (seconds: number) => void;
  recommendedRemainingLabel: string;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (!isActive || frozen) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds((previous) => {
        const next = previous + 1;
        onElapsedChange(next);
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [frozen, isActive, onElapsedChange]);

  const displaySeconds = isListening
    ? elapsedSeconds
    : Math.max(1200 - elapsedSeconds, 0);

  const isUrgent = !isListening && displaySeconds < 300;
  const minutes = Math.floor(displaySeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (displaySeconds % 60).toString().padStart(2, "0");

  return (
    <div
      className={`flex items-center gap-2 font-medium ${
        isUrgent ? "text-red-500" : "text-gray-700"
      }`}
    >
      <AlarmClock
        className={`w-5 h-5 ${
          isUrgent ? "text-red-500 animate-pulse" : "text-blue-600"
        }`}
      />
      <span className="text-xl font-mono tracking-wider">
        {minutes}:{seconds}
      </span>
      {!isListening ? (
        <span className="text-sm text-gray-400 ml-2 hidden sm:inline">
          ({recommendedRemainingLabel})
        </span>
      ) : null}
    </div>
  );
});

const ObjectiveQuestionItem = memo(function ObjectiveQuestionItem({
  question,
  selectedAnswers,
  resultData,
  hasResult,
  fontSizeRatio,
  onToggleCheckbox,
  onUpdateAnswer,
  t,
}: {
  question: any;
  selectedAnswers: string[];
  resultData?: any;
  hasResult: boolean;
  fontSizeRatio: number;
  onToggleCheckbox: (qId: string, value: string) => void;
  onUpdateAnswer: (qId: string, index: number, value: string) => void;
  t: any;
}) {
  /**
   * 题干 HTML 解析是客观题页最昂贵的计算之一。
   * 这里把它下沉到单题组件里，并且只依赖当前题自身的答案和结果。
   * 这样修改某一道题时，不会连带让其它题目的 stem 重新 parse。
   */
  const renderedStem = useMemo(() => {
    let blankIndex = 0;

    const parseOptions: HTMLReactParserOptions = {
      replace(domNode: any) {
        if (
          domNode.type === "tag" &&
          domNode.name === "img" &&
          domNode.attribs &&
          domNode.attribs.src
        ) {
          let src = domNode.attribs.src;
          if (src.startsWith("images/")) {
            src = `/${src}`;
          } else if (src.startsWith("../images/")) {
            src = src.replace("../images/", "/images/");
          }

          return (
            <img
              {...domNode.attribs}
              src={src}
              className="max-w-full h-auto my-4 rounded shadow-sm mx-auto"
              alt={t("questionImage") || "Question Illustration"}
            />
          );
        }

        if (
          domNode.type === "text" &&
          domNode.data &&
          domNode.data.includes("{{response}}")
        ) {
          const parts = domNode.data.split("{{response}}");

          return (
            <>
              {parts.map((part: string, idx: number) => {
                if (idx === parts.length - 1) {
                  return <span key={idx}>{part}</span>;
                }

                const currentIdx = blankIndex++;
                const value = selectedAnswers[currentIdx] || "";

                let resultElement = null;
                let inputClass =
                  "mx-1 inline-block min-w-[120px] border-b-2 border-gray-400 bg-transparent px-2 text-center text-blue-900 align-baseline outline-none focus:border-blue-600";

                if (hasResult) {
                  const isSubjective = resultData?.isSubjective;
                  const subResult = resultData?.subResults?.[currentIdx];

                  if (!isSubjective && subResult) {
                    if (subResult.isCorrect) {
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-green-500 bg-green-50 px-2 text-center font-bold text-green-700 align-baseline";
                      resultElement = (
                        <CheckCircle2 className="inline w-4 h-4 text-green-600 ml-1" />
                      );
                    } else {
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-red-500 bg-red-50 px-2 text-center text-red-700 line-through align-baseline";
                      resultElement = (
                        <span className="inline-flex items-center gap-1 ml-1 text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3" />
                          {t("correctAnswer")}:{" "}
                          {String(subResult.officialAnswer).split(";")[0]}
                        </span>
                      );
                    }
                  }
                }

                return (
                  <span
                    key={idx}
                    className="inline-flex flex-wrap items-baseline"
                  >
                    <span>{part}</span>
                    <input
                      type="text"
                      className={inputClass}
                      value={value}
                      disabled={hasResult}
                      onChange={(event) =>
                        onUpdateAnswer(
                          question.id,
                          currentIdx,
                          event.target.value,
                        )
                      }
                    />
                    {resultElement}
                  </span>
                );
              })}
            </>
          );
        }
      },
    };

    return (
      <div
        className={STEM_CONTAINER_CLASS}
        style={{ fontSize: `${0.92 * fontSizeRatio}rem` }}
      >
        {parse(
          normalizeQuestionStemHtml(question.stem, question.serialNumber),
          parseOptions,
        )}
      </div>
    );
  }, [
    fontSizeRatio,
    hasResult,
    onUpdateAnswer,
    question.id,
    question.serialNumber,
    question.stem,
    resultData,
    selectedAnswers,
    t,
  ]);

  return (
    <ObjectiveQuestionCard
      question={question}
      selectedAnswers={selectedAnswers}
      resultData={resultData}
      hasResult={hasResult}
      onToggleCheckbox={onToggleCheckbox}
      onUpdateAnswer={onUpdateAnswer}
      renderedStem={renderedStem}
    />
  );
});

const ObjectivePassagePanel = memo(function ObjectivePassagePanel({
  isListening,
  hasResult,
  showTranscript,
  audioUrl,
  listeningAudioRef,
  contentRef,
  onMouseUpContent,
  menuPos,
  clearMenuPos,
  onApplyHighlight,
  onClearSelection,
  onClearMark,
  onToggleTranscript,
  renderedPassageBlocks,
  fontSizeRatio,
  t,
}: {
  isListening: boolean;
  hasResult: boolean;
  showTranscript: boolean;
  audioUrl?: string | null;
  listeningAudioRef: RefObject<HTMLAudioElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  onMouseUpContent: () => void;
  menuPos: { x: number; y: number; show: boolean };
  clearMenuPos: { x: number; y: number; show: boolean };
  onApplyHighlight: (colorClass: string) => void;
  onClearSelection: () => void;
  onClearMark: () => void;
  onToggleTranscript: () => void;
  renderedPassageBlocks: ReactNode;
  fontSizeRatio: number;
  t: any;
}) {
  /**
   * 左侧材料区是客观题页里另一个高成本区域：
   * - 听力时有音频播放器
   * - 阅读时有整篇 passage/transcript DOM
   * - 还承载划线菜单和相关 DOM 事件
   *
   * 把它抽成 memo 组件的核心目的不是“代码更整洁”，而是让右侧答案变化
   * 不再默认牵连整块材料区参与 render。
   *
   * 只要这些 props 没变：
   * - passage 内容
   * - 听力/阅读模式
   * - transcript 展开状态
   * - 高亮菜单状态
   * - 字号
   *
   * 那么右侧题目输入就不会重新渲染左侧这整块重 UI。
   */
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm uppercase tracking-wider text-gray-400 font-bold">
          {isListening ? t("listeningAudioTranscript") : t("readingMaterial")}
        </h2>
        {isListening && hasResult ? (
          <Button variant="outline" size="sm" onClick={onToggleTranscript}>
            {showTranscript ? t("hideTranscript") : t("showTranscript")}
          </Button>
        ) : null}
      </div>

      {isListening && audioUrl ? (
        <div className="mb-6 rounded-xl border bg-gray-50 p-4 shadow-sm">
          <audio
            ref={listeningAudioRef}
            controls
            preload="auto"
            className="h-10 w-full"
            src={resolveAudioUrl(audioUrl)}
          >
            {t("audioUnsupported")}
          </audio>
        </div>
      ) : null}

      <div
        ref={contentRef}
        onMouseUp={onMouseUpContent}
        className="prose prose-blue relative max-w-none text-gray-800 leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_table]:w-full [&_td]:align-top"
        style={{ fontSize: `${1.05 * fontSizeRatio}rem` }}
      >
        {isListening && !hasResult ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Headphones className="w-12 h-12 mb-4 text-gray-300" />
            <p>{t("transcriptHiddenDuringListening")}</p>
            <p className="text-sm mt-2">{t("focusOnAudio")}</p>
          </div>
        ) : isListening && hasResult && !showTranscript ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p>{t("transcriptCollapsed")}</p>
            <Button variant="ghost" className="mt-4" onClick={onToggleTranscript}>
              {t("clickToExpandTranscript")}
            </Button>
          </div>
        ) : (
          renderedPassageBlocks
        )}

        <ObjectiveHighlightMenus
          menuPos={menuPos}
          clearMenuPos={clearMenuPos}
          onApplyHighlight={onApplyHighlight}
          onClearSelection={onClearSelection}
          onClearMark={onClearMark}
          blueHighlightLabel={t("blueHighlight")}
          yellowHighlightLabel={t("yellowHighlight")}
          cancelLabel={t("cancel")}
          clearLabel="清除高亮 Clear"
        />
      </div>
    </>
  );
});

export default function ObjectiveRenderer({
  unit, // 题目详情数据
  onResult, // 提交结果后的回调
  result, // 如果已经提交过了，这里就是得分结果
  isLastPart, // 是否是模考流的最后一部分
  allFlowIds, // 模考流中的所有题目 ID
}: any) {
  const { t } = useLocale();
  // 判断是听力还是阅读（听力通常标题带 Part，阅读带 Passage）
  const isListening =
    unit.title.includes("Part") || unit.title.includes("听力");

  // --- 核心状态 (State Tracking) ---
  const [answers, setAnswers] = useState<AnswersState>({}); // 存用户写的所有答案
  const [loading, setLoading] = useState(false); // 正在提交吗？
  const [isActive, setIsActive] = useState(false); // 计时器是否在跑
  const [showTranscript, setShowTranscript] = useState(false); // 是否显示听力原文
  const [hasResolvedStartup, setHasResolvedStartup] = useState(false); // 是否完成了开机自检
  const [timerInitialSeconds, setTimerInitialSeconds] = useState(0);

  // --- 个性化设置 ---
  const [fontSizeRatio, setFontSizeRatio] = useState(1); // 字体大小缩放 (1.0 = 100%)
  const [leftPanelRatio, setLeftPanelRatio] = useState(50); // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖动分栏条

  // 引用 (Ref) 指向 DOM 元素
  const contentRef = useRef<HTMLDivElement>(null); // 指向文章内容区
  const listeningAudioRef = useRef<HTMLAudioElement>(null); // 指向音频播放器
  const timeSpentRef = useRef(0);
  const answersRef = useRef<AnswersState>({});
  const reqIds = useMemo(() => unit.questions.map((q: any) => q.id), [unit.questions]);
  const resultMap = useMemo(() => {
    const entries = (result?.results || []).map((item: any) => [item.questionId, item]);
    return new Map(entries);
  }, [result?.results]);
  const renderedPassageBlocks = useMemo(() => {
    return unit.passage?.map((passageBlock: any, index: number) => (
      <div key={index} className="text-justify mb-5">
        {renderPassageBlock(passageBlock)}
      </div>
    ));
  }, [unit.passage]);
  const {
    menuPos,
    clearMenuPos,
    clearSelection,
    handleMouseUpContent,
    applyHighlight,
    handleClearMark,
  } = useObjectiveHighlighting(contentRef);

  // --- 存档恢复逻辑 ---
  const [showRestorePrompt, setShowRestorePrompt] = useState(false); // 是否弹出“由于您之前有未完成的进度，需要恢复吗？”
  const [backedUpState, setBackedUpState] = useState<{
    answers: any;
    timeSpent: number;
  } | null>(null);

  const handleElapsedTimeChange = useCallback((seconds: number) => {
    timeSpentRef.current = seconds;
  }, []);
  const handleToggleTranscript = useCallback(() => {
    setShowTranscript((previous) => !previous);
  }, []);
  const decreaseFontSize = useCallback(() => {
    setFontSizeRatio((currentRatio) => Math.max(0.8, currentRatio - 0.1));
  }, []);
  const increaseFontSize = useCallback(() => {
    setFontSizeRatio((currentRatio) => Math.min(1.5, currentRatio + 0.1));
  }, []);
  const rightPanelWidth = useMemo(() => {
    return typeof window !== "undefined" && window.innerWidth >= 1024
      ? `calc(${100 - leftPanelRatio}% - 8px)`
      : "100%";
  }, [leftPanelRatio]);
  const leftPanelWidth = useMemo(() => {
    return typeof window !== "undefined" && window.innerWidth >= 1024
      ? `${leftPanelRatio}%`
      : "100%";
  }, [leftPanelRatio]);

  /**
   * 页面加载时：去 localStorage 翻翻看有没有以前没做完的档案
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const state = getUnitState(unit.id);
    const hasSavedProgress =
      Object.keys(state.answers).length > 0 || state.timeSpent > 0;

    if (hasSavedProgress) {
      // 启动阶段需要一次性把本地草稿恢复进 React 状态，这里属于初始化同步。
      // 这不是“effect 内反复驱动状态”的性能问题，因此保留这次 setState。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBackedUpState({
        answers: state.answers,
        timeSpent: state.timeSpent,
      });
      timeSpentRef.current = state.timeSpent;
      setTimerInitialSeconds(state.timeSpent);
      setShowRestorePrompt(true); // 弹出询问
      setIsActive(false); // 暂时停走表，等用户决定
    } else {
      timeSpentRef.current = 0;
      setTimerInitialSeconds(0);
      setIsActive(true); // 直接开始跑表
    }

    setHasResolvedStartup(true);
  }, [unit.id]);

  /**
   * 响应：恢复进度
   */
  const handleRestoreState = () => {
    if (backedUpState) {
      if (Object.keys(backedUpState.answers).length > 0) {
        setAnswers(backedUpState.answers);
      }
      if (backedUpState.timeSpent > 0) {
        timeSpentRef.current = backedUpState.timeSpent;
        setTimerInitialSeconds(backedUpState.timeSpent);
      }
    }
    setShowRestorePrompt(false);
    setIsActive(true);
  };

  /**
   * 响应：不要进度了，重新开始
   */
  const handleDiscardState = () => {
    clearUnitState(unit.id);
    setAnswers({});
    timeSpentRef.current = 0;
    setTimerInitialSeconds(0);
    setShowRestorePrompt(false);
    setIsActive(true);
  };

  /**
   * 实时写档：每当答案或时间变化，就往 localStorage 存一份
   */
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasResolvedStartup) return;

    const timeout = window.setTimeout(() => {
      saveUnitState(
        unit.id,
        unit.category,
        reqIds,
        answersRef.current,
        timeSpentRef.current,
      );
    }, ANSWER_PERSIST_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [answers, hasResolvedStartup, reqIds, unit.category, unit.id]);

  /**
   * 功能：拖动手柄调整左右面板宽度 (Resize Panels)
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newRatio = (e.clientX / window.innerWidth) * 100;
      if (newRatio >= 20 && newRatio <= 80) {
        setLeftPanelRatio(newRatio); // 更新左侧面板的百分比宽度
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // 如果出现了“继续上次进度”提示框，先暂停播音
  useEffect(() => {
    if (!showRestorePrompt) return;
    listeningAudioRef.current?.pause();
  }, [showRestorePrompt]);

  /**
   * 功能：听力音频自动播放控制
   */
  useEffect(() => {
    if (
      !hasResolvedStartup ||
      !isListening ||
      !unit.audioUrl ||
      result ||
      showRestorePrompt ||
      !isActive
    ) {
      return;
    }

    const audio = listeningAudioRef.current;
    if (!audio) return;

    const attemptAutoPlay = async () => {
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch (error) {
        console.warn("听力自动播放被浏览器拦截", error);
      }
    };

    void attemptAutoPlay();
  }, [
    hasResolvedStartup,
    isListening,
    isActive,
    result,
    showRestorePrompt,
    unit.audioUrl,
    unit.id,
  ]);

  /**
   * 功能：处理多选题 (Multiple Selection)
   * 逻辑：如果已经选了，再点就取消。如果没选，就加进列表。
   */
  const toggleCheckbox = useCallback((qId: string, value: string) => {
    setAnswers((prev) => {
      const current = prev[qId] ? [...prev[qId]] : [];
      if (current.includes(value)) {
        return { ...prev, [qId]: current.filter((v) => v !== value) };
      }
      return { ...prev, [qId]: [...current, value] };
    });
  }, []);

  /**
   * 功能：处理填空题或单选题 (Text or Single Selection)
   * 逻辑：根据题目的 ID 和空格的索引 (index)，更新特定的文字值。
   */
  const updateAnswer = useCallback((qId: string, index: number, value: string) => {
    setAnswers((prev) => {
      const current = prev[qId] ? [...prev[qId]] : [];
      current[index] = value;
      return { ...prev, [qId]: current };
    });
  }, []);
  const renderedQuestions = useMemo(() => {
    return unit.questions.map((question: any) => (
      <ObjectiveQuestionItem
        key={question.id}
        question={question}
        selectedAnswers={answers[question.id] || EMPTY_ANSWERS}
        resultData={resultMap.get(question.id)}
        hasResult={!!result}
        fontSizeRatio={fontSizeRatio}
        onToggleCheckbox={toggleCheckbox}
        onUpdateAnswer={updateAnswer}
        t={t}
      />
    ));
  }, [
    answers,
    fontSizeRatio,
    result,
    resultMap,
    t,
    toggleCheckbox,
    unit.questions,
    updateAnswer,
  ]);

  /**
   * 功能：整卷提交 (Handle Submit All)
   * 逻辑：
   * 1. 遍历模考流里的所有题目。
   * 2. 检查是否有漏填。如果有，弹窗温馨提示。
   * 3. 根据科目类型（听说读写）决定调用哪个后端批改接口。
   * 4. 批量异步请求并处理结果。
   */
  const handleSubmitAll = async () => {
    if (!allFlowIds || allFlowIds.length === 0) return;

    let hasEmpty = false;
    const allSubs: any[] = [];

    // 汇总所有关联题目的“答题纸”
    for (const id of allFlowIds) {
      const state =
        id === unit.id
          ? {
              answers: answersRef.current,
              reqIds,
              category: unit.category,
              timeSpent: timeSpentRef.current,
            }
          : getUnitState(id);
      const ans = state.answers;
      const requiredIds = state.reqIds;

      for (const qId of requiredIds) {
        if (
          !ans[qId] ||
          ans[qId].length === 0 ||
          (Array.isArray(ans[qId]) && ans[qId].every((v: string) => !v))
        ) {
          hasEmpty = true;
        }
      }

      allSubs.push({
        unitId: id,
        userAnswers: ans,
        timeSpent: state.timeSpent,
        category: state.category,
      });
    }

    if (hasEmpty) {
      const confirm = window.confirm(t("submitWithBlanksConfirm"));
      if (!confirm) return;
    }

    setLoading(true);
    setIsActive(false);

    try {
      // 同时发起多个请求
      const promises = allSubs.map((sub) => {
        // 判断接口路径
        const endpoint =
          sub.category === "Writing" || sub.category === "Speaking"
            ? "/api/eval/subjective"
            : "/api/eval/objective";

        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId: sub.unitId,
            userAnswers: sub.userAnswers,
            timeSpent: sub.timeSpent,
          }),
        })
          .then((r) => r.json())
          .then((data) => ({ unitId: sub.unitId, ...data }));
      });

      const results = await Promise.all(promises);

      // 把所有分数写回父组件和本地缓存
      for (const r of results) {
        if (r.data) {
          onResult(r.data, r.unitId);
        }
      }
    } catch (error) {
      console.error(t("requestFailed"), error);
      setIsActive(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[85vh]">
      <ObjectiveToolbar
        timer={(
          <ObjectiveTimerDisplay
            key={timerInitialSeconds}
            initialSeconds={timerInitialSeconds}
            isListening={isListening}
            isActive={hasResolvedStartup && isActive}
            frozen={!!result}
            onElapsedChange={handleElapsedTimeChange}
            recommendedRemainingLabel={t("recommendedRemaining")}
          />
        )}
        fontSizeRatio={fontSizeRatio}
        onDecreaseFont={decreaseFontSize}
        onIncreaseFont={increaseFontSize}
        result={result}
        isLastPart={!!isLastPart}
        loading={loading}
        onSubmitAll={handleSubmitAll}
        scoreLabel={t("score")}
        submittingLabel={t("submitting")}
        fullSubmitLabel={t("fullSubmit")}
        answeringInProgressLabel={t("answeringInProgress")}
      />

      {/* Restore State Dialog */}
      <RestoreDraftDialog
        open={showRestorePrompt}
        onRestore={handleRestoreState}
        onDiscard={handleDiscardState}
      />

      <div
        className={`flex flex-col lg:flex-row flex-grow overflow-hidden border-x border-b rounded-b-lg bg-gray-50/30 ${isDragging ? "cursor-col-resize select-none" : ""}`}
      >
        {/* 左侧面板：文章材料 / 听力原文 (Left panel) */}
        <div
          className="overflow-y-auto p-6 md:p-8 border-b lg:border-b-0 lg:border-r h-[50%] lg:h-full bg-white relative"
          style={{ width: leftPanelWidth }}
        >
          <ObjectivePassagePanel
            isListening={isListening}
            hasResult={!!result}
            showTranscript={showTranscript}
            audioUrl={unit.audioUrl}
            listeningAudioRef={listeningAudioRef}
            contentRef={contentRef}
            onMouseUpContent={handleMouseUpContent}
            menuPos={menuPos}
            clearMenuPos={clearMenuPos}
            onApplyHighlight={applyHighlight}
            onClearSelection={clearSelection}
            onClearMark={handleClearMark}
            onToggleTranscript={handleToggleTranscript}
            renderedPassageBlocks={renderedPassageBlocks}
            fontSizeRatio={fontSizeRatio}
            t={t}
          />
        </div>

        {/* 可拖动的分栏条 (Draggable Divider) */}
        <div
          className="hidden lg:flex flex-col items-center justify-center w-2 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 relative group z-20"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="h-12 w-1 bg-gray-300 group-hover:bg-blue-400 rounded-full"></div>
        </div>

        <ObjectiveQuestionPanel
          questions={unit.questions}
          answers={answers}
          results={result?.results}
          width={rightPanelWidth}
        >
          {renderedQuestions}
        </ObjectiveQuestionPanel>
      </div>
    </div>
  );
}
