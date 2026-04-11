/**
 * 客观题渲染器 (Objective Renderer)
 * 作用：专门负责“雅思机考”模式的阅读和听力题目。
 * 特点：
 * 1. 左右分栏：左边看文章/听录音，右边做题。支持拖动调整比例。
 * 2. 真实模考：带计时器，阅读倒计时，听力正计时。
 * 3. 划线功能：模拟考场划线高亮。
 * 4. 自动存档：做题进度实时保存，断网或刷新也不怕。
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  AlarmClock,
  CheckCircle2,
  XCircle,
  Headphones,
  Type,
  Highlighter,
  Eraser,
} from "lucide-react"; // UI 图标
import parse, { HTMLReactParserOptions } from "html-react-parser"; // HTML 字符串转 React 组件的工具
import { saveUnitState, getUnitState, clearUnitState } from "@/lib/testSession"; // 本地存档工具
import { resolveAudioUrl } from "@/lib/utils";
import { useLocale } from "@/components/LocaleProvider";
/* 引入具体的子功能组件 */
import { QuestionNavigatorPortal } from "./objective/QuestionNavigatorPortal"; // 底部题号导航（传送门技术）
import { ObjectiveQuestionCard } from "./objective/ObjectiveQuestionCard"; // 单个题目卡片
import { RestoreDraftDialog } from "./objective/RestoreDraftDialog"; // 恢复进度弹窗
import {
  normalizeQuestionStemHtml,
  renderPassageBlock,
} from "./objective/shared"; // 格式化工具

// --- 类型定义 ---
// Record<题目ID, 用户填入的答案数组>
type AnswersState = Record<string, string[]>;

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
  const [timeSpent, setTimeSpent] = useState(0); // 做了多久了（秒）
  const [isActive, setIsActive] = useState(false); // 计时器是否在跑
  const [showTranscript, setShowTranscript] = useState(false); // 是否显示听力原文
  const [hasResolvedStartup, setHasResolvedStartup] = useState(false); // 是否完成了开机自检

  // --- 个性化设置 ---
  const [fontSizeRatio, setFontSizeRatio] = useState(1); // 字体大小缩放 (1.0 = 100%)
  const [leftPanelRatio, setLeftPanelRatio] = useState(50); // 左侧面板宽度百分比
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖动分栏条

  // --- 划线高亮功能相关 ---
  const [selectionRange, setSelectionRange] = useState<Range | null>(null); // 用户鼠标选中的范围
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, show: false }); // 划线菜单弹出的坐标
  const [activeMark, setActiveMark] = useState<HTMLElement | null>(null); // 指向被点击的 <mark> 标签
  const [clearMenuPos, setClearMenuPos] = useState({ x: 0, y: 0, show: false }); // “清除高亮”菜单的坐标

  // 引用 (Ref) 指向 DOM 元素
  const contentRef = useRef<HTMLDivElement>(null); // 指向文章内容区
  const listeningAudioRef = useRef<HTMLAudioElement>(null); // 指向音频播放器

  /**
   * 清除当前的文字选中状态
   */
  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setMenuPos({ x: 0, y: 0, show: false });
    setSelectionRange(null);
  };

  // --- 存档恢复逻辑 ---
  const [showRestorePrompt, setShowRestorePrompt] = useState(false); // 是否弹出“由于您之前有未完成的进度，需要恢复吗？”
  const [backedUpState, setBackedUpState] = useState<{
    answers: any;
    timeSpent: number;
  } | null>(null);

  /**
   * 页面加载时：去 localStorage 翻翻看有没有以前没做完的档案
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const state = getUnitState(unit.id);
    const hasSavedProgress =
      Object.keys(state.answers).length > 0 || state.timeSpent > 0;

    if (hasSavedProgress) {
      setBackedUpState({
        answers: state.answers,
        timeSpent: state.timeSpent,
      });
      setShowRestorePrompt(true); // 弹出询问
      setIsActive(false); // 暂时停走表，等用户决定
    } else {
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
        setTimeSpent(backedUpState.timeSpent);
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
    setTimeSpent(0);
    setShowRestorePrompt(false);
    setIsActive(true);
  };

  /**
   * 实时写档：每当答案或时间变化，就往 localStorage 存一份
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const reqIds = unit.questions.map((q: any) => q.id);
      saveUnitState(unit.id, unit.category, reqIds, answers, timeSpent);
    }
  }, [answers, timeSpent, unit.id, unit.category, unit.questions]);

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

  /**
   * 功能：文本选中结束的处理程序 (Highlight Trigger)
   * 作用：当用户在文章里划词后，算出气泡菜单的位置。
   */
  const handleMouseUpContent = () => {
    const selection = window.getSelection(); // 获取浏览器原生选区
    if (!selection || selection.isCollapsed) {
      setMenuPos((p) => ({ ...p, show: false }));
      return;
    }

    const range = selection.getRangeAt(0);
    // 检查选中区域是否在我们的内容框内部
    if (
      contentRef.current &&
      contentRef.current.contains(range.commonAncestorContainer)
    ) {
      const rect = range.getBoundingClientRect(); // 获取选区在视口中的坐标
      setMenuPos({
        x: rect.left + rect.width / 2, // 气泡显示在选区正上方中间
        y: rect.top - 10,
        show: true,
      });
      setSelectionRange(range); // 记录选中模型以便后续包裹标签
    } else {
      setMenuPos((p) => ({ ...p, show: false }));
    }
  };

  /**
   * 功能：执行划线操作 (Apply Highlight)
   */
  const applyHighlight = (colorClass: string) => {
    if (!selectionRange) return;
    const span = document.createElement("mark"); // 创建一个 <mark> 标签
    span.className = `${colorClass} px-1 rounded transition-colors cursor-pointer group relative`;

    try {
      selectionRange.surroundContents(span); // 用 mark 标签把选中的文字包起来
      // 给划线添加点击监听，方便后续“清除”
      span.onclick = (e) => {
        e.stopPropagation();
        const rect = span.getBoundingClientRect();
        setActiveMark(span);
        setClearMenuPos({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          show: true,
        });
        setMenuPos({ x: 0, y: 0, show: false });
      };
    } catch {
      // 跨段落、跨复杂标签时，surroundContents 会失败
      console.warn("DOM 结构过于复杂，无法包裹。");
      alert("请在单个段落内进行划词高亮。");
    }
    clearSelection(); // 操作完后取消选区选中态
  };

  /**
   * 功能：清除掉之前的划线
   */
  const handleClearMark = () => {
    if (!activeMark) return;
    const parent = activeMark.parentNode;
    // 把里面的文字内容还原给父节点
    while (activeMark.firstChild) {
      if (parent) parent.insertBefore(activeMark.firstChild, activeMark);
    }
    // 移除这个空的 <mark> 标签
    if (parent) parent.removeChild(activeMark);
    setActiveMark(null);
    setClearMenuPos({ x: 0, y: 0, show: false });
  };

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
   * 功能：当点击页面其他地方时，关闭高亮气泡菜单
   */
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (menuPos.show && (!selection || selection.isCollapsed)) {
        setMenuPos({ x: 0, y: 0, show: false });
      }

      const menuDOM = document.getElementById("clear-highlight-menu");
      if (
        clearMenuPos.show &&
        activeMark &&
        !activeMark.contains(e.target as Node) &&
        (!menuDOM || !menuDOM.contains(e.target as Node))
      ) {
        setClearMenuPos({ x: 0, y: 0, show: false });
        setActiveMark(null);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [menuPos.show, clearMenuPos.show, activeMark]);

  /**
   * 功能：秒表定时器 (Timer)
   * 作用：每一秒更新一次 timeSpent (已用秒数)。
   */
  useEffect(() => {
    let interval: any = null;
    // 只有在完成加载、处于活动态（没开弹窗）、且还没出分（没提交）时才跑秒
    if (hasResolvedStartup && isActive && !result) {
      interval = setInterval(() => {
        setTimeSpent((time) => time + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [hasResolvedStartup, isActive, result]);

  // 计算显示出来的剩余时间或正计时
  const displaySeconds = isListening
    ? timeSpent // 听力是正计时（第几分第几秒）
    : Math.max(1200 - timeSpent, 0); // 阅读是倒计时（20分钟 = 1200秒）

  /**
   * 功能：时间串格式化 (0 -> 00:00)
   */
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /**
   * 功能：处理多选题 (Multiple Selection)
   * 逻辑：如果已经选了，再点就取消。如果没选，就加进列表。
   */
  const toggleCheckbox = (qId: string, value: string) => {
    setAnswers((prev) => {
      const current = prev[qId] ? [...prev[qId]] : [];
      if (current.includes(value)) {
        return { ...prev, [qId]: current.filter((v) => v !== value) };
      }
      return { ...prev, [qId]: [...current, value] };
    });
  };

  /**
   * 功能：处理填空题或单选题 (Text or Single Selection)
   * 逻辑：根据题目的 ID 和空格的索引 (index)，更新特定的文字值。
   */
  const updateAnswer = (qId: string, index: number, value: string) => {
    setAnswers((prev) => {
      const current = prev[qId] ? [...prev[qId]] : [];
      current[index] = value;
      return { ...prev, [qId]: current };
    });
  };

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
      const state = getUnitState(id);
      const ans = state.answers;
      const reqIds = state.reqIds;

      for (const qId of reqIds) {
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

  /**
   * 功能：HTML 渲染转换器 (DOM Interceptor)
   * 作用：把数据库里的 HTML 字符串变成真正的输入框。
   * 它会扫描题目内容，发现 {{response}} 就塞进一个 <input>。
   */
  const getParseOptions = (questionId: string): HTMLReactParserOptions => {
    let blankIndex = 0; // 用于区分同一题里的多个空格

    return {
      replace(domNode: any) {
        // 1. 自动处理相对路径的图片
        if (
          domNode.type === "tag" &&
          domNode.name === "img" &&
          domNode.attribs &&
          domNode.attribs.src
        ) {
          let src = domNode.attribs.src;
          if (src.startsWith("images/")) {
            src = "/" + src;
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

        // 2. 核心：把特殊标记 {{response}} 换成输入框
        if (
          domNode.type === "text" &&
          domNode.data &&
          domNode.data.includes("{{response}}")
        ) {
          // 按标记切分文字
          const parts = domNode.data.split("{{response}}");
          return (
            <>
              {parts.map((part: string, idx: number) => {
                // 最后一部分文字直接渲染
                if (idx === parts.length - 1)
                  return <span key={idx}>{part}</span>;

                const currentIdx = blankIndex++; // 本空格的索引号
                const val =
                  (answers[questionId] && answers[questionId][currentIdx]) ||
                  "";

                let resultElem = null; // 显示正误的图标/文字
                let inputClass =
                  "mx-1 inline-block min-w-[120px] border-b-2 border-gray-400 bg-transparent px-2 text-center text-blue-900 align-baseline outline-none focus:border-blue-600";

                // 如果已经“交卷批改”了 (result 有值)
                if (result) {
                  const qResult = result.results?.find(
                    (r: any) => r.questionId === questionId,
                  );
                  const isSubjective = qResult?.isSubjective;
                  if (
                    !isSubjective &&
                    qResult &&
                    qResult.subResults &&
                    qResult.subResults[currentIdx]
                  ) {
                    const subRes = qResult.subResults[currentIdx];
                    if (subRes.isCorrect) {
                      // 答对了
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-green-500 bg-green-50 px-2 text-center font-bold text-green-700 align-baseline";
                      resultElem = (
                        <CheckCircle2 className="inline w-4 h-4 text-green-600 ml-1" />
                      );
                    } else {
                      // 答错了
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-red-500 bg-red-50 px-2 text-center text-red-700 line-through align-baseline";
                      resultElem = (
                        <span className="inline-flex items-center gap-1 ml-1 text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3" />
                          {t("correctAnswer")}: {" "}
                          {String(subRes.officialAnswer).split(";")[0]}
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
                      value={val}
                      disabled={!!result} // 出分后不可修改
                      onChange={(e) =>
                        updateAnswer(questionId, currentIdx, e.target.value)
                      }
                    />
                    {resultElem}
                  </span>
                );
              })}
            </>
          );
        }
      },
    };
  };

  return (
    <div className="flex flex-col h-[85vh]">
      {/* 顶部控制栏 (Test Control Bar) */}
      <div className="flex items-center justify-between bg-white border rounded-t-lg p-4 shadow-sm z-10 shrink-0">
        {/* 左侧：计时器 */}
        <div
          className={`flex items-center gap-2 font-medium ${!isListening && displaySeconds < 300 ? "text-red-500" : "text-gray-700"}`}
        >
          <AlarmClock
            className={`w-5 h-5 ${!isListening && displaySeconds < 300 ? "text-red-500 animate-pulse" : "text-blue-600"}`}
          />
          <span className="text-xl font-mono tracking-wider">
            {formatTime(displaySeconds)}
          </span>
          {!isListening && (
            <span className="text-sm text-gray-400 ml-2 hidden sm:inline">
              ({t("recommendedRemaining")})
            </span>
          )}
        </div>

        {/* 中间：个性化工具 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-gray-900"
              onClick={() => setFontSizeRatio((f) => Math.max(0.8, f - 0.1))} // 缩小字号
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
              onClick={() => setFontSizeRatio((f) => Math.min(1.5, f + 0.1))} // 放大字号
            >
              <Type className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 右侧：提交按钮或分数显示 */}
        <div className="flex items-center gap-3">
          {result ? (
            // 如果已出分，显示总分
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-xl font-bold border border-green-200 shadow-sm">
              {t("score")}: {result.summary.totalCorrect} /{" "}
              {result.summary.totalObjective}
            </div>
          ) : isLastPart ? (
            // 如果是最后一题，显示“全卷提交”
            <Button
              onClick={handleSubmitAll}
              disabled={loading}
              size="default"
              className="shadow-md rounded-xl bg-gray-900 hover:bg-gray-800 font-bold px-6"
            >
              {loading ? t("submitting") : t("fullSubmit")}
            </Button>
          ) : (
            // 否则显示“进行中”状态
            <div className="text-gray-500 font-medium mr-2 text-sm mt-1 animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>{t("answeringInProgress")}
            </div>
          )}
        </div>
      </div>

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
          style={{
            width:
              typeof window !== "undefined" && window.innerWidth >= 1024
                ? `${leftPanelRatio}%`
                : "100%",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm uppercase tracking-wider text-gray-400 font-bold">
              {isListening
                ? t("listeningAudioTranscript")
                : t("readingMaterial")}
            </h2>
            {/* 听力题出完分后，允许切换显示原文 */}
            {isListening && result && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? t("hideTranscript") : t("showTranscript")}
              </Button>
            )}
          </div>

          {/* 音频播放器（仅限听力） */}
          {isListening && unit.audioUrl && (
            <div className="mb-6 rounded-xl border bg-gray-50 p-4 shadow-sm">
              <audio
                ref={listeningAudioRef}
                controls
                preload="auto"
                className="h-10 w-full"
                src={resolveAudioUrl(unit.audioUrl)}
              >
                {t("audioUnsupported")}
              </audio>
            </div>
          )}

          {/* 文章/文本渲染区 */}
          <div
            ref={contentRef}
            onMouseUp={handleMouseUpContent} // 划词结束触发菜单
            className="prose prose-blue relative max-w-none text-gray-800 leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_table]:w-full [&_td]:align-top"
            style={{ fontSize: `${1.05 * fontSizeRatio}rem` }}
          >
            {isListening && !result ? (
              // 听力过程中：隐藏原文，防止作弊
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Headphones className="w-12 h-12 mb-4 text-gray-300" />
                <p>{t("transcriptHiddenDuringListening")}</p>
                <p className="text-sm mt-2">{t("focusOnAudio")}</p>
              </div>
            ) : isListening && result && !showTranscript ? (
              // 出分后：默认也先隐藏原文，点按钮才看
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p>{t("transcriptCollapsed")}</p>
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => setShowTranscript(true)}
                >
                  {t("clickToExpandTranscript")}
                </Button>
              </div>
            ) : (
              // 渲染具体的段落
              unit.passage?.map((p: any, idx: number) => (
                <div key={idx} className="text-justify mb-5">
                  {renderPassageBlock(p)}
                </div>
              ))
            )}

            {/* --- 浮动划线菜单 (Highlighting Menu) --- */}
            {menuPos.show && (
              <div
                className="absolute z-50 transform -translate-x-1/2 -translate-y-full bg-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] rounded-2xl border border-gray-200/50 p-1 flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200"
                style={{
                  left: menuPos.x,
                  top: menuPos.y + window.scrollY,
                  position: "fixed",
                }}
              >
                <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200/50 rotate-45"></div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl font-semibold"
                  onClick={() => applyHighlight("bg-blue-200/70")}
                >
                  <Highlighter className="w-4 h-4" /> <span>{t("blueHighlight")}</span>
                </Button>
                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-xl font-semibold"
                  onClick={() => applyHighlight("bg-yellow-200/70")}
                >
                  <Highlighter className="w-4 h-4" /> <span>{t("yellowHighlight")}</span>
                </Button>
                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-semibold"
                  onClick={clearSelection}
                >
                  <Eraser className="w-4 h-4" /> <span>{t("cancel")}</span>
                </Button>
              </div>
            )}

            {/* --- “清除已有划线”小菜单 --- */}
            {clearMenuPos.show && (
              <div
                id="clear-highlight-menu"
                className="absolute z-50 transform -translate-x-1/2 -translate-y-full bg-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] rounded-xl border border-gray-200/50 p-1 flex items-center animate-in fade-in zoom-in-95 duration-200"
                style={{
                  left: clearMenuPos.x,
                  top: clearMenuPos.y + window.scrollY,
                  position: "fixed",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200/50 rotate-45"></div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-bold"
                  onClick={handleClearMark}
                >
                  <Eraser className="w-4 h-4" /> <span>清除高亮 Clear</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 可拖动的分栏条 (Draggable Divider) */}
        <div
          className="hidden lg:flex flex-col items-center justify-center w-2 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 relative group z-20"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="h-12 w-1 bg-gray-300 group-hover:bg-blue-400 rounded-full"></div>
        </div>

        {/* 右侧面板：题目区 (Right panel) */}
        <div
          className="flex flex-col h-[50%] lg:h-full relative"
          style={{
            width:
              typeof window !== "undefined" && window.innerWidth >= 1024
                ? `calc(${100 - leftPanelRatio}% - 8px)`
                : "100%",
          }}
        >
          {/* 这里使用了 React Portal (传送门)，
              把“题号导航小点”跨组件投影到了我们在 EvalWrapper 里准备好的底部槽位中 */}
          <QuestionNavigatorPortal
            questions={unit.questions}
            answers={answers}
            results={result?.results}
          />

          <div className="overflow-y-auto p-4 md:p-8 flex-1 space-y-8 pb-12">
            <h2 className="text-sm uppercase tracking-wider text-gray-400 font-bold mb-6 mt-2">
              题目练习 (Questions)
            </h2>
            <div className="space-y-8">
              {/* 循环渲染每一道题 */}
              {unit.questions.map((q: any) => {
                const resData = result?.results?.find(
                  (r: any) => r.questionId === q.id,
                );

                return (
                  <ObjectiveQuestionCard
                    key={q.id}
                    question={q}
                    selectedAnswers={answers[q.id] || []}
                    resultData={resData}
                    hasResult={!!result}
                    onToggleCheckbox={toggleCheckbox}
                    onUpdateAnswer={updateAnswer}
                    // 题干内容：需要经过 HTML 转换器处理
                    renderedStem={
                      <div
                        className="prose prose-slate prose-sm max-w-none text-gray-900 font-medium leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_strong]:font-black"
                        style={{ fontSize: `${0.92 * fontSizeRatio}rem` }}
                      >
                        {parse(
                          normalizeQuestionStemHtml(q.stem, q.serialNumber),
                          getParseOptions(q.id),
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
