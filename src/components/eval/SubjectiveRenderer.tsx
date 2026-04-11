"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import parse from "html-react-parser";
import { ChevronDown, Mic, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { imageFixingOptions } from "./objective/shared";
import { SpeakingAiRenderer } from "./SpeakingAiRenderer";
import { useLocale } from "@/components/LocaleProvider";
import {
  EMPTY_UNIT_STATE,
  clearUnitState,
  getUnitState,
  saveUnitState,
  type StoredUnitState,
} from "@/lib/testSession";

/**
 * SubjectiveRenderer 组件
 * 作用：专门用于处理“主观题”（如：雅思写作 Writing、雅思口语 Speaking）。
 * 与客观题不同，主观题通常需要用户输入大段文字，或者进行语音录入，并由 AI 给出评分建议。
 */

// --- 类型定义 (Type Definitions) ---

// 浏览器原生的语音识别接口定义（用于口语模考）
type SpeechRecognitionAlternativeLike = {
  transcript: string; // 语音转出的文字
};

type SpeechRecognitionResultLike = {
  isFinal: boolean; // 是否已经识别完成（一段话结束）
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type BrowserSpeechRecognition = {
  continuous: boolean; // 是否持续识别
  interimResults: boolean; // 是否返回中间结果
  lang: string; // 识别语言
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

// 题目定义
type SubjectiveQuestion = {
  id: string;
  stem?: string; // 题干（HTML 字符串）
};

type SubjectiveUnit = {
  id: string;
  category: string; // "Writing" | "Speaking"
  questions: SubjectiveQuestion[];
};

// 提交给后端的结构
type BatchSubmission = {
  unitId: string;
  userAnswers: Record<string, string>;
  timeSpent: number;
  category: string;
};

// AI 评估结果结构
type SubjectiveEvaluation = {
  submissionId?: string;
  mode?: "saved" | "ai"; // save 模式仅保存不判分，ai 模式会调用智能评估
  aiEvaluation?: {
    totalScore?: number; // 总分 (0-9)
    dimensions?: Record<string, number | string>; // 维度分 (例如：TR, CC, LR, GRA)
    summary?: string; // 详细建议（Markdown 格式）
  };
};

type SubjectiveRendererProps = {
  unit: SubjectiveUnit & { title?: string };
  isWriting: boolean; // 当前是写作还是口语
  mode?: "standard" | "ai"; // standard 是普通模拟，ai 是带实时助手的模式
  onResult: (result: SubjectiveEvaluation, unitId?: string) => void;
  result?: Record<string, unknown> | null; // 已有的历史分数
  isLastPart: boolean; // 是否是套卷的最后一部分
  allFlowIds: string[]; // 套卷里所有环节的 ID（用于一次性全部提交）
};

type PromptRecord = {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
};

// --- 辅助工具函数 (Helper Functions) ---

/**
 * 格式化雅思分数
 * 雅思一般是整数或 .5，所以如果是整数就直接显示，小数保留一位
 */
function formatBandScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/**
 * 计算总分逻辑
 * 如果 AI 直接给了总分就用 AI 的，否则取各个维度分的平均值并四舍五入到最近的 0.5
 */
function getOverallBand(evaluation: SubjectiveEvaluation | null) {
  const totalScore = evaluation?.aiEvaluation?.totalScore;
  if (typeof totalScore === "number" && !Number.isNaN(totalScore)) {
    return totalScore;
  }

  const dimensionValues = Object.values(
    evaluation?.aiEvaluation?.dimensions || {},
  )
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => !Number.isNaN(value));

  if (!dimensionValues.length) return null;
  const average =
    dimensionValues.reduce((sum, value) => sum + value, 0) /
    dimensionValues.length;
  // 雅思规则：取平均值后，最接近的 0.5 刻度
  return Math.round(average * 2) / 2;
}

function getSubjectiveDimensions(
  evaluation: SubjectiveEvaluation | null,
  isWriting: boolean,
) {
  const preferred = isWriting ? ["TR", "CC", "LR", "GRA"] : ["FC", "LR", "GRA", "P"];
  const available = Object.keys(evaluation?.aiEvaluation?.dimensions || {});
  return preferred.filter((dimension) => available.includes(dimension)).length
    ? preferred
    : available;
}

/**
 * AI 反馈 Markdown 渲染器 (轻量版)
 * 作用：把 AI 返回的带有 **加粗** 的字符串变成 React 的加粗组件
 */
function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong
          key={`${keyPrefix}-${index}`}
          className="font-bold text-slate-900"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
}

/**
 * AI 反馈 Markdown 渲染器 (段落/列表转换)
 * 作用：把 AI 返回的带有段落、三级标题和列表的 Markdown 文字，转换成漂亮的 React 元素树。
 */
function renderMarkdownSummary(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let paragraphBuffer: string[] = []; // 暂存文本
  let listBuffer: string[] = []; // 暂存列表项

  // 把暂存的文本刷新成 <p> 标签
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

  // 把暂存的列表项刷新成 <ul><li> 结构
  const flushList = () => {
    if (!listBuffer.length) return;
    const key = `list-${nodes.length}`;
    nodes.push(
      <ul
        key={key}
        className="list-disc space-y-2 pl-5 text-[15px] leading-8 text-slate-700 marker:text-slate-400"
      >
        {listBuffer.map((item, index) => (
          <li key={`${key}-${index}`}>
            {renderInlineMarkdown(item, `${key}-${index}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    // 空行：先清空之前的段落或列表
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    // 处理标题 ###
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h4
          key={`h4-${nodes.length}`}
          className="text-lg font-black text-slate-900"
        >
          {line.slice(4)}
        </h4>,
      );
      return;
    }

    // 处理标题 ##
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h3
          key={`h3-${nodes.length}`}
          className="text-2xl font-black tracking-tight text-slate-900"
        >
          {line.slice(3)}
        </h3>,
      );
      return;
    }

    // 处理列表 - 或 *
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      return;
    }

    // 普通行，先存进 buffer
    paragraphBuffer.push(line);
  });

  // 最后扫尾工作
  flushParagraph();
  flushList();

  return nodes;
}

export default function SubjectiveRenderer({
  unit,
  isWriting,
  mode = "standard",
  onResult,
  result,
  isLastPart,
  allFlowIds,
}: SubjectiveRendererProps) {
  // --- 状态管理 (State) ---
  const { t } = useLocale();
  const [currentStep, setCurrentStep] = useState(0); // 当前进行到第几小题（Part 1, 2, 3...）
  const [answers, setAnswers] = useState<Record<string, string>>({}); // 用户的答案，键是题目ID，值是输入的文字
  const [loading, setLoading] = useState(false); // 提交时的加载状态
  const [submitError, setSubmitError] = useState(""); // 提交失败后的错误提示
  const [dismissedRestorePrompt, setDismissedRestorePrompt] = useState(false); // 用户是否已经关掉了“恢复进度”提示
  const [isRecording, setIsRecording] = useState(false); // 是否正在录音 (口语题专用)
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [defaultPromptContent, setDefaultPromptContent] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null); // 保存语音识别对象的引用
  const isSpeakingTranscript = !isWriting && mode !== "ai";
  // 同一个 UserPrompt 表里通过 purpose 区分“写作评分”和“口语转录评分”。
  const promptPurpose = isWriting ? "evaluation" : "transcript_eval";

  const storedState = useMemo<StoredUnitState>(() => {
    if (typeof window === "undefined") return EMPTY_UNIT_STATE;
    return getUnitState(unit.id);
  }, [unit.id]);

  const restorePreferenceKey = `linguo_subjective_restore_resolved_${unit.id}`;

  const shouldPromptRestore =
    !dismissedRestorePrompt &&
    Object.keys(answers).length === 0 &&
    (Object.keys(storedState.answers).length > 0 || storedState.timeSpent > 0);

  const hydrateAnswersFromState = (state: StoredUnitState) => {
    return Object.fromEntries(
      Object.entries(state.answers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(" ") : value,
      ]),
    );
  };

  /**
   * 功能：自动恢复进度
   * 作用：如果用户是从同一个考试流程（Eval）跳过来的，直接无感恢复答题。
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSavedProgress =
      Object.keys(storedState.answers).length > 0 || storedState.timeSpent > 0;
    if (!hasSavedProgress) {
      sessionStorage.removeItem(restorePreferenceKey);
      return;
    }

    let shouldAutoRestore =
      sessionStorage.getItem(restorePreferenceKey) === "1";

    // 来源检查：如果是考试流程内的跳转，不需要弹窗询问
    if (!shouldAutoRestore && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        shouldAutoRestore =
          referrer.origin === window.location.origin &&
          referrer.pathname.startsWith("/eval/");
      } catch {
        shouldAutoRestore = false;
      }
    }

    if (shouldAutoRestore) {
      setAnswers(hydrateAnswersFromState(storedState));
      setDismissedRestorePrompt(true);
      sessionStorage.setItem(restorePreferenceKey, "1");
    }
  }, [restorePreferenceKey, storedState, unit.id]);

  useEffect(() => {
    let cancelled = false;

    // 页面加载时拉取当前模式的默认 prompt。
    // 前端只取第一条（默认 prompt 优先），用户随后可以直接在 textarea 中改写。
    const loadPrompt = async () => {
      setPromptLoading(true);
      try {
        const response = await fetch(
          `/api/prompts?category=${encodeURIComponent(unit.category)}&purpose=${encodeURIComponent(promptPurpose)}`,
        );
        const json = (await response.json()) as {
          data?: PromptRecord[];
        };

        if (!response.ok) {
          throw new Error("prompt-load-failed");
        }

        const selected = json.data?.[0];
        if (cancelled) return;

        setPromptId(selected?.id || null);
        setPromptName(selected?.name || t("promptFallbackName"));
        setPromptContent(selected?.content || "");
        setDefaultPromptContent(selected?.content || "");
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setPromptId(null);
        setPromptName(t("promptFallbackName"));
        setPromptContent("");
        setDefaultPromptContent("");
        setSubmitError(t("promptLoadFailed"));
      } finally {
        if (!cancelled) {
          setPromptLoading(false);
        }
      }
    };

    void loadPrompt();

    return () => {
      cancelled = true;
    };
  }, [promptPurpose, t, unit.category]);

  /**
   * 功能：初始化浏览器语音识别
   */
  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US"; // 默认识别英文
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  /**
   * 自动保存：每当答案变化，实时同步到本地 localStorage
   */
  useEffect(() => {
    // 口语转录模式现在按“逐题作答、统一提交”实现，
    // 因此本地草稿仍按每一道题的 question.id 分开保存。
    const reqIds = unit.questions.map((question) => question.id);
    saveUnitState(unit.id, unit.category, reqIds, answers, 0);
  }, [answers, unit.category, unit.id, unit.questions]);

  const questions = unit.questions ?? [];
  const currentQuestion = questions[currentStep];
  const allSpeakingQuestionsAnswered =
    isSpeakingTranscript &&
    questions.every((question) => (answers[question.id] || "").trim().length > 0);

  const handleRestoreState = () => {
    setAnswers(hydrateAnswersFromState(storedState));
    setDismissedRestorePrompt(true);
    sessionStorage.setItem(restorePreferenceKey, "1");
  };

  const handleDiscardState = () => {
    clearUnitState(unit.id);
    setAnswers({});
    setDismissedRestorePrompt(true);
    sessionStorage.setItem(restorePreferenceKey, "1");
  };

  /**
   * 功能：统一提交主观题答案
   * 作用：
   * 1. 收集当前流程里的主观题答案
   * 2. 把前端当前编辑的 prompt 一起带给后端
   * 3. 后端优先使用 promptContent，而不是数据库默认版本
   */
  const handleSubmitAll = async (mode: "save" | "ai") => {
    if (!allFlowIds.length) return;

    /**
     * 口语转录评分现在按“所有 Part 都写完再统一评分”执行。
     * 这里先在前端做一次硬性拦截，避免用户绕过按钮 disabled 状态。
     */
    if (isSpeakingTranscript && !allSpeakingQuestionsAnswered) {
      setSubmitError(t("speakingCompleteAllParts"));
      return;
    }

    let hasEmpty = false; // 检查是否还有没写的题
    const submissions: BatchSubmission[] = [];

    // 1. 遍历当前考试流程中的所有 Unit，提取答案
    for (const id of allFlowIds) {
      const state = getUnitState(id);
      const userAnswers = Object.fromEntries(
        Object.entries(state.answers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(" ") : value,
        ]),
      );

      // 查缺补漏
      for (const questionId of state.reqIds) {
        if (
          !userAnswers[questionId] ||
          userAnswers[questionId].trim().length === 0
        ) {
          hasEmpty = true;
        }
      }

      submissions.push({
        unitId: id,
        userAnswers,
        timeSpent: state.timeSpent,
        category: state.category,
      });
    }

    /**
     * 写作仍允许用户自行确认“带空提交”。
     * 但口语转录模式已经在上方硬性要求全部写完，因此这里仅保留写作旧行为。
     */
    if (!isSpeakingTranscript && hasEmpty && !window.confirm(t("submitWithBlanksConfirm"))) {
      return;
    }

    setLoading(true);
    setSubmitError("");

    try {
      // 同时发起多个请求（每个 Unit 一个批改请求）
      const responses = await Promise.all(
        submissions.map(async (submission) => {
          const endpoint =
            submission.category === "Writing" ||
            submission.category === "Speaking"
              ? "/api/eval/subjective"
              : "/api/eval/objective";

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unitId: submission.unitId,
              userAnswers: submission.userAnswers,
              timeSpent: submission.timeSpent,
              // promptId 用于记录“来源于哪条模板”，promptContent 用于真正执行本次评分。
              promptId,
              promptContent,
              useAi:
                submission.category === "Writing" ||
                submission.category === "Speaking"
                  ? mode === "ai"
                  : true,
            }),
          });

          const json = (await response.json()) as {
            data?: SubjectiveEvaluation;
            error?: string;
            details?: string;
          };

          if (!response.ok) {
            throw new Error(json.details || json.error || t("requestFailed"));
          }

          return { unitId: submission.unitId, data: json.data };
        }),
      );

      responses.forEach((response) => {
        if (response.data) {
          onResult(response.data, response.unitId);
        }
      });
    } catch (error) {
      console.error("Batch submission failed:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("requestFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!currentQuestion) {
    return <div>{t("noQuestionsAvailable")}</div>;
  }

  if (!isWriting && mode === "ai") {
    return (
      <SpeakingAiRenderer
        unit={{ id: unit.id, title: unit.title || "Speaking", questions }}
      />
    );
  }

  const evaluation = (result ?? null) as SubjectiveEvaluation | null;
  const overallBand = getOverallBand(evaluation);
  const dimensionKeys = getSubjectiveDimensions(evaluation, isWriting);

  return (
    <div className="flex flex-col gap-6">
      <AlertDialog
        open={shouldPromptRestore}
        onOpenChange={(open) => {
          if (!open) setDismissedRestorePrompt(true);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-3xl border-white/60 bg-white/90 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg text-gray-900">
              {t("restoreProgressTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm text-gray-500">
              {t("restoreProgressDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full flex-row gap-3 sm:justify-center">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRestoreState}
            >
              {t("resume")}
            </Button>
            <Button
              className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
              onClick={handleDiscardState}
            >
              {t("restart")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {submitError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </div>
      )}

      {questions.length > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 backdrop-blur-sm">
          <span>
            {t("part")} {currentStep + 1} / {questions.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => step - 1)}
            >
              {t("previousQuestion")}
            </Button>
            <Button
              variant="ghost"
              disabled={currentStep === questions.length - 1}
              onClick={() => setCurrentStep((step) => step + 1)}
            >
              {t("nextQuestion")}
            </Button>
          </div>
        </div>
      )}

      {/* --- 主体内容区：双栏布局 --- */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* 左侧：题目面 (Question Stem Card) */}
        <Card className="min-h-[600px] overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <CardContent className="p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  {t("promptSurface")}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {isWriting
                    ? t("writingPrompt")
                    : t("speakingPromptBundle")}
                </h2>
              </div>
              <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700">
                {isWriting ? t("structuredWriting") : t("speakingTranscriptBadge")}
              </div>
            </div>
            {isSpeakingTranscript ? (
              <div className="space-y-5">
                {questions.map((question, index) => {
                  const isActive = index === currentStep;
                  const hasAnswer = Boolean(answers[question.id]?.trim());

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      className={`block w-full rounded-[1.6rem] border px-5 py-5 text-left transition-all ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]"
                          : "border-slate-200 bg-white/60 text-slate-800 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-[0.22em] ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                            {t("part")} {index + 1}
                          </p>
                          <div
                            className={`prose mt-3 max-w-none text-[15px] leading-7 ${isActive ? "prose-invert text-white" : "text-slate-700"}`}
                          >
                            {parse(question.stem || "", imageFixingOptions)}
                          </div>
                        </div>
                        <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          isActive
                            ? "bg-white/10 text-white"
                            : hasAnswer
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                        }`}>
                          {hasAnswer ? t("questionCompleted") : t("questionOpen")}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="prose max-w-none break-words text-[15px] leading-relaxed text-slate-700">
                {parse(currentQuestion.stem || "", imageFixingOptions)}
              </div>
            )}
          </CardContent>
        </Card>

        {evaluation?.mode === "saved" ? (
          <Card className="rounded-[2rem] border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-[0_25px_70px_rgba(16,185,129,0.12)]">
            <CardContent className="flex h-full flex-col gap-6 p-8 lg:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-500">
                  {t("submissionSaved")}
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
{t("submissionSaved")}
                </h3>
              </div>
              <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-6 text-[15px] leading-relaxed text-slate-700 shadow-sm">
{t("saveOnlySavedDesc")}
              </div>
            </CardContent>
          </Card>
        ) : evaluation ? (
          <Card className="rounded-[2rem] border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-[0_25px_70px_rgba(59,130,246,0.12)]">
            <CardContent className="flex h-full flex-col gap-6 p-8 lg:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-500">
                  {t("aiFeedback")}
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  {t("evaluationReady")}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
                <div className="rounded-2xl border border-blue-200 bg-blue-600 p-4 text-center shadow-sm xl:col-span-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                    {t("overallBand")}
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {overallBand !== null
                      ? formatBandScore(overallBand)
                      : "N/A"}
                  </p>
                </div>
                {dimensionKeys.map((dimension) => (
                  <div
                    key={dimension}
                    className="rounded-2xl border border-white/80 bg-white/90 p-4 text-center shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {dimension}
                    </p>
                    <p className="mt-2 text-3xl font-black text-blue-600">
                      {evaluation.aiEvaluation?.dimensions?.[dimension] ??
                        "N/A"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex-1 rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-sm">
                <div className="space-y-5">
                  {evaluation.aiEvaluation?.summary ? (
                    renderMarkdownSummary(evaluation.aiEvaluation.summary)
                  ) : (
                    <p className="text-[15px] leading-8 text-slate-700">
                      No feedback summary generated.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setPromptExpanded((value) => !value)}
              className="flex items-center justify-between rounded-[1.6rem] border border-slate-200 bg-white/75 px-5 py-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all hover:border-slate-300 hover:bg-white"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    {t("promptWorkbench")}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {promptName || t("promptFallbackName")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {promptLoading
                    ? t("promptLoading")
                    : promptExpanded
                      ? t("promptClose")
                      : t("promptOpen")}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform ${
                    promptExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {promptExpanded ? (
              <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="border-b border-black/5 px-6 py-6 lg:border-b-0 lg:border-r">
                    <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                      {t("promptWorkbench")}
                    </p>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                      {promptName || t("promptFallbackName")}
                    </h3>
                    <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">
                      {t("promptWorkbenchHint")}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <div className="rounded-full border border-black/5 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                        {promptLoading ? t("promptLoading") : t("promptName")}
                      </div>
                      <Button
                        variant="ghost"
                        className="rounded-full px-4"
                        onClick={() => setPromptContent(defaultPromptContent)}
                        disabled={promptLoading}
                      >
                        {t("promptRefresh")}
                      </Button>
                    </div>
                  </div>
                  <div className="px-6 py-6">
                    <label className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                      {t("promptEditorLabel")}
                    </label>
                    <textarea
                      className="mt-4 min-h-[210px] w-full resize-none border-0 bg-transparent p-0 font-mono text-[13px] leading-7 text-slate-700 outline-none"
                      placeholder={t("promptEmpty")}
                      value={promptContent}
                      onChange={(event) => setPromptContent(event.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    {t("responseStudio")}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">
                    {isWriting ? t("writingResponse") : t("speakingResponseTitle")}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {isWriting ? (
                    <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700">
                      Words:{" "}
                      {answers[currentQuestion.id]
                        ?.trim()
                        .split(/\s+/)
                        .filter(Boolean).length || 0}
                    </div>
                  ) : (
                    <Button
                      variant={isRecording ? "destructive" : "secondary"}
                      className="rounded-full px-5"
                      onClick={() => {
                        const recognition = recognitionRef.current;
                        if (!recognition) {
                          window.alert(
                            t("browserNoSpeech"),
                          );
                          return;
                        }

                        if (isRecording) {
                          recognition.stop();
                          setIsRecording(false);
                          return;
                        }

                        recognition.onresult = (event) => {
                          let finalTranscript = "";

                          for (
                            let i = event.resultIndex;
                            i < event.results.length;
                            i += 1
                          ) {
                            const resultItem = event.results[i];
                            if (resultItem?.isFinal) {
                              finalTranscript += resultItem[0].transcript;
                            }
                          }

                          if (finalTranscript.trim()) {
                            setAnswers((previous) => ({
                              ...previous,
                              [currentQuestion.id]:
                                `${previous[currentQuestion.id] || ""} ${finalTranscript.trim()}`.trim(),
                            }));
                          }
                        };
                        recognition.onerror = (error) => {
                          console.error("Speech Error", error);
                          setIsRecording(false);
                        };
                        recognition.start();
                        setIsRecording(true);
                      }}
                    >
                      <Mic
                        className={`mr-2 h-4 w-4 ${isRecording ? "animate-pulse text-white" : ""}`}
                      />
                      {isRecording
                        ? t("speakingStopRecording")
                        : t("speakingStartRecording")}
                    </Button>
                  )}
                </div>
              </div>

              {!isWriting ? (
            <div className="mt-5 rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-5 text-sm leading-7 text-slate-700">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
                    {t("speakingTranscriptLabel")}
                  </p>
                  <p className="mt-2">{t("speakingTranscriptHint")}</p>
                  <p className="mt-2 text-blue-700">
                    {t("speakingCompleteAllPartsHint")}
                  </p>
                </div>
              ) : null}

              {/* 大型文本编辑区 */}
              <textarea
                className="mt-5 min-h-[520px] w-full resize-none rounded-[1.5rem] border-2 border-slate-200 bg-slate-50/80 p-6 text-base leading-relaxed text-slate-900 shadow-inner outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                placeholder={
                  isWriting
                    ? "Write your response in English..."
                    : t("speakingTranscriptPlaceholder")
                }
                spellCheck={false}
                value={answers[currentQuestion.id] || ""}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [currentQuestion.id]: event.target.value,
                  }))
                }
              />
            </div>

            {/* 提交动作栏 */}
            <div className="flex justify-end pt-2 pb-24 md:pb-28">
              {currentStep < questions.length - 1 ? (
                // 如果这道题有多个 Part，点击进行到下一部分
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full px-6"
                  onClick={() => setCurrentStep((step) => step + 1)}
                >
                  {`${t("nextQuestion")} Part ${currentStep + 2}`}
                </Button>
              ) : isLastPart ? (
                // 如果是最后一部分，显示最终提交按钮
                <div className="flex flex-wrap justify-end gap-3">
                  {isWriting ? (
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-full px-6"
                      onClick={() => void handleSubmitAll("save")}
                      disabled={loading}
                      title={t("normalSubmit")}
                    >
                      {loading ? t("submitting") : t("normalSubmit")}
                    </Button>
                  ) : null}
                  <Button
                    size="lg"
                    className="rounded-full bg-gray-900 px-8 text-white shadow-lg hover:bg-gray-800"
                    onClick={() => void handleSubmitAll("ai")}
                    disabled={loading || (isSpeakingTranscript && !allSpeakingQuestionsAnswered)}
                    title={
                      isSpeakingTranscript && !allSpeakingQuestionsAnswered
                        ? t("speakingCompleteAllParts")
                        : undefined
                    }
                  >
                    {loading
                      ? t("submitting")
                      : isWriting
                        ? t("aiEvaluate")
                        : t("speakingTranscriptTitle")}
                  </Button>
                </div>
              ) : (
                // 自动保存状态展示
                <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Draft synced automatically
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
