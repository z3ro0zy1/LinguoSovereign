/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
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
} from "lucide-react";
import parse, { HTMLReactParserOptions } from "html-react-parser";
import { saveUnitState, getUnitState, clearUnitState } from "@/lib/testSession";
import { resolveAudioUrl } from "@/lib/utils";
import { QuestionNavigatorPortal } from "./objective/QuestionNavigatorPortal";
import { ObjectiveQuestionCard } from "./objective/ObjectiveQuestionCard";
import { RestoreDraftDialog } from "./objective/RestoreDraftDialog";
import { normalizeQuestionStemHtml, renderPassageBlock } from "./objective/shared";

/**
 * AnswersState captures the user's input per question.
 * The key is the question DB ID.
 * The value is an array of strings representing either:
 * - A single selected radio button value like ["A"]
 * - Multiple checkbox values like ["A", "B"]
 * - Fill-in-the-blank answers corresponding to {{response}} tokens
 */
type AnswersState = Record<string, string[]>;

/**
 * ObjectiveRenderer
 *
 * Responsible for rendering structural Objective tests (Reading and Listening).
 *
 * Features:
 * - Displays a live timer (countdown for reading, count-up for listening).
 * - Implements logic to conceal transcripts during Listening tests unless toggled by the user.
 * - Parses rich text HTML questions dynamically and replaces `{{response}}` tokens with inline text inputs.
 * - Grades multi-select, single-select and structural question sets.
 */
export default function ObjectiveRenderer({
  unit,
  onResult,
  result,
  isLastPart,
  allFlowIds,
}: any) {
  const isListening =
    unit.title.includes("Part") || unit.title.includes("听力");

  // State Tracking
  const [answers, setAnswers] = useState<AnswersState>({}); // Tracks all user selections
  const [loading, setLoading] = useState(false); // Manages Submit button locking
  const [timeSpent, setTimeSpent] = useState(0); // seconds elapsed
  const [isActive, setIsActive] = useState(false); // Determines if timer should keep ticking
  const [showTranscript, setShowTranscript] = useState(false); // Controls Audio Transcript visibility
  const [hasResolvedStartup, setHasResolvedStartup] = useState(false);

  // Customization States
  const [fontSizeRatio, setFontSizeRatio] = useState(1); // 1.0 multiplier
  const [leftPanelRatio, setLeftPanelRatio] = useState(50); // Default 50% width
  const [isDragging, setIsDragging] = useState(false);

  // --- Highlighter and Notes Flow ---
  // Users can select text in the passage to highlight, mimicking the real IELTS computer-based test.
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, show: false }); // Position for 'Highlight/Cancel' popup
  const [activeMark, setActiveMark] = useState<HTMLElement | null>(null); // tracks clicked <mark> tag for deletion
  const [clearMenuPos, setClearMenuPos] = useState({ x: 0, y: 0, show: false }); // Position for 'Clear' popup
  const contentRef = useRef<HTMLDivElement>(null);
  const listeningAudioRef = useRef<HTMLAudioElement>(null);

  /**
   * clearSelection: Resets browser text selection and hides the custom highlighter ribbon.
   */
  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setMenuPos({ x: 0, y: 0, show: false });
    setSelectionRange(null);
  };

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [backedUpState, setBackedUpState] = useState<{
    answers: any;
    timeSpent: number;
  } | null>(null);

  // Initialize from LocalStorage
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
      setShowRestorePrompt(true);
      setIsActive(false);
    } else {
      setIsActive(true);
    }

    setHasResolvedStartup(true);
  }, [unit.id]);

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

  const handleDiscardState = () => {
    clearUnitState(unit.id);
    setAnswers({});
    setTimeSpent(0);
    setShowRestorePrompt(false);
    setIsActive(true);
  };

  // Persist to LocalStorage whenever answers or timeSpent changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const reqIds = unit.questions.map((q: any) => q.id);
      saveUnitState(unit.id, unit.category, reqIds, answers, timeSpent);
    }
  }, [answers, timeSpent, unit.id, unit.category, unit.questions]);

  // Handle Dragging to Resize Panels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newRatio = (e.clientX / window.innerWidth) * 100;
      if (newRatio >= 20 && newRatio <= 80) {
        setLeftPanelRatio(newRatio);
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
   * handleMouseUpContent: Triggered when user releases mouse button over the passage.
   * Calculates the bounding rect of the selected text to show the Highland palette ribbon.
   */
  const handleMouseUpContent = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setMenuPos((p) => ({ ...p, show: false }));
      return;
    }

    const range = selection.getRangeAt(0);
    if (
      contentRef.current &&
      contentRef.current.contains(range.commonAncestorContainer)
    ) {
      const rect = range.getBoundingClientRect();
      setMenuPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        show: true,
      });
      setSelectionRange(range);
    } else {
      setMenuPos((p) => ({ ...p, show: false }));
    }
  };

  /**
   * applyHighlight: Wraps the current selection range in a <mark> tag.
   * Note: surroundContents() is sensitive to crossing block boundaries;
   * we catch the error if the user selects across multiple paragraphs.
   */
  const applyHighlight = (colorClass: string) => {
    if (!selectionRange) return;
    const span = document.createElement("mark");
    span.className = `${colorClass} px-1 rounded transition-colors cursor-pointer group relative`;

    try {
      selectionRange.surroundContents(span);
      // Bind click handler to existing mark for future deletion
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
      console.warn("Complex DOM selection wrap failed.");
      alert("Please highlight within single paragraphs only.");
    }
    clearSelection();
  };

  const handleClearMark = () => {
    if (!activeMark) return;
    const parent = activeMark.parentNode;
    while (activeMark.firstChild) {
      if (parent) parent.insertBefore(activeMark.firstChild, activeMark);
    }
    if (parent) parent.removeChild(activeMark);
    setActiveMark(null);
    setClearMenuPos({ x: 0, y: 0, show: false });
  };

  useEffect(() => {
    if (!showRestorePrompt) return;
    listeningAudioRef.current?.pause();
  }, [showRestorePrompt]);

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
        console.warn("Listening autoplay was blocked", error);
      }
    };

    void attemptAutoPlay();
  }, [hasResolvedStartup, isListening, isActive, result, showRestorePrompt, unit.audioUrl, unit.id]);

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

  // Timer Effect: Ticks up timeSpent by 1 every second while isActive and no result is graded.
  useEffect(() => {
    let interval: any = null;
    if (hasResolvedStartup && isActive && !result) {
      interval = setInterval(() => {
        setTimeSpent((time) => time + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [hasResolvedStartup, isActive, result]);

  const displaySeconds = isListening
    ? timeSpent
    : Math.max(1200 - timeSpent, 0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /**
   * toggleCheckbox
   * Appends or removes a selection for Multi-Select questions
   * (when an IELTS question allows 2+ options).
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
   * updateAnswer
   * Updates an explicit text-input or single-radio-button answer value at a specific index.
   * (Helpful for questions with multiple blanks like ______ and ______).
   */
  const updateAnswer = (qId: string, index: number, value: string) => {
    setAnswers((prev) => {
      const current = prev[qId] ? [...prev[qId]] : [];
      current[index] = value;
      return { ...prev, [qId]: current };
    });
  };

  /**
   * handleSubmitAll
   * Fired when the final section completes across the test.
   * Sends batch network requests to evaluate all sibling parts at once.
   */
  const handleSubmitAll = async () => {
    if (!allFlowIds || allFlowIds.length === 0) return;

    let hasEmpty = false;
    const allSubs: any[] = [];

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
      const confirm = window.confirm("您还有未作答的题目，确定要全部提交吗？");
      if (!confirm) return;
    }

    setLoading(true);
    setIsActive(false);

    try {
      const promises = allSubs.map((sub) => {
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

      for (const r of results) {
        if (r.data) {
          onResult(r.data, r.unitId);
        }
      }
    } catch (error) {
      console.error(error);
      setIsActive(true);
    }
    setLoading(false);
  };

  /**
   * getParseOptions
   * A custom DOM interceptor used inside the mapped question loop.
   * It allows us to safely bind React Events (onChange/inputs) directly into the raw HTML string
   * containing the scraped `question.stem`.
   */
  const getParseOptions = (questionId: string): HTMLReactParserOptions => {
    let blankIndex = 0; // Tracks multiple `{{response}}` inputs inside a single paragraph DOM block

    return {
      replace(domNode: any) {
        // 1. Fix relative image paths in question stems
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
              alt="IELTS Graphic"
            />
          );
        }

        // 2. Parse inline {{response}} input boxes
        if (
          domNode.type === "text" &&
          domNode.data &&
          domNode.data.includes("{{response}}")
        ) {
          // --- Dynamic Input Injection ---
          // Splits the scraped text by the {{response}} token and inserts controlled React <input> components.
          const parts = domNode.data.split("{{response}}");
          return (
            <>
              {parts.map((part: string, idx: number) => {
                // If it's the last part, just return the text
                if (idx === parts.length - 1)
                  return <span key={idx}>{part}</span>;

                const currentIdx = blankIndex++; // Local blank counter for multi-fill questions
                const val =
                  (answers[questionId] && answers[questionId][currentIdx]) ||
                  "";

                let resultElem = null;
                let inputClass =
                  "mx-1 inline-block min-w-[120px] border-b-2 border-gray-400 bg-transparent px-2 text-center text-blue-900 align-baseline outline-none focus:border-blue-600";

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
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-green-500 bg-green-50 px-2 text-center font-bold text-green-700 align-baseline";
                      resultElem = (
                        <CheckCircle2 className="inline w-4 h-4 text-green-600 ml-1" />
                      );
                    } else {
                      inputClass =
                        "mx-1 inline-block min-w-[120px] border-b-2 border-red-500 bg-red-50 px-2 text-center text-red-700 line-through align-baseline";
                      resultElem = (
                        <span className="inline-flex items-center gap-1 ml-1 text-xs text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3" />
                          Ans: {String(subRes.officialAnswer).split(";")[0]}
                        </span>
                      );
                    }
                  }
                }

                return (
                  <span key={idx} className="inline-flex flex-wrap items-baseline">
                    <span>{part}</span>
                    <input
                      type="text"
                      className={inputClass}
                      value={val}
                      disabled={!!result}
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
      {/* Test Control Bar */}
      <div className="flex items-center justify-between bg-white border rounded-t-lg p-4 shadow-sm z-10 shrink-0">
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
              (预估)
            </span>
          )}
        </div>

        {/* Customization Toolbar */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60 shadow-inner">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg text-gray-500 hover:text-gray-900"
              onClick={() => setFontSizeRatio((f) => Math.max(0.8, f - 0.1))}
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
              onClick={() => setFontSizeRatio((f) => Math.min(1.5, f + 0.1))}
            >
              <Type className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result ? (
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-xl font-bold border border-green-200 shadow-sm">
              Score: {result.summary.totalCorrect} /{" "}
              {result.summary.totalObjective}
            </div>
          ) : isLastPart ? (
            <Button
              onClick={handleSubmitAll}
              disabled={loading}
              size="default"
              className="shadow-md rounded-xl bg-gray-900 hover:bg-gray-800 font-bold px-6"
            >
              {loading ? "提交中..." : "全卷提交"}
            </Button>
          ) : (
            <div className="text-gray-500 font-medium mr-2 text-sm mt-1 animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>进行中
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
        {/* Left panel: Passage / Transcript */}
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
              {isListening ? "Audio Transcript" : "Reading Material"}
            </h2>
            {isListening && result && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                {showTranscript ? "Hide Transcript" : "Show Transcript"}
              </Button>
            )}
          </div>

          {isListening && unit.audioUrl && (
            <div className="mb-6 rounded-xl border bg-gray-50 p-4 shadow-sm">
              <audio
                ref={listeningAudioRef}
                controls
                preload="auto"
                className="h-10 w-full"
                src={resolveAudioUrl(unit.audioUrl)}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          <div
            ref={contentRef}
            onMouseUp={handleMouseUpContent}
            className="prose prose-blue relative max-w-none text-gray-800 leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_table]:w-full [&_td]:align-top"
            style={{ fontSize: `${1.05 * fontSizeRatio}rem` }}
          >
            {isListening && !result ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Headphones className="w-12 h-12 mb-4 text-gray-300" />
                <p>Transcript is hidden during the listening test.</p>
                <p className="text-sm mt-2">Focus on the audio.</p>
              </div>
            ) : isListening && result && !showTranscript ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p>Transcript is hidden by default.</p>
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => setShowTranscript(true)}
                >
                  Click to Reveal
                </Button>
              </div>
            ) : (
              unit.passage?.map((p: any, idx: number) => (
                <div key={idx} className="text-justify mb-5">
                  {renderPassageBlock(p)}
                </div>
              ))
            )}

            {/* Absolute positioning Context Menu for highlighting */}
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
                  <Highlighter className="w-4 h-4" /> <span>Highlight</span>
                </Button>
                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-xl font-semibold"
                  onClick={() => applyHighlight("bg-yellow-200/70")}
                >
                  <Highlighter className="w-4 h-4" /> <span>Highlight</span>
                </Button>
                <div className="w-px h-5 bg-gray-200 mx-1"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-semibold"
                  onClick={clearSelection}
                >
                  <Eraser className="w-4 h-4" /> <span>Cancel</span>
                </Button>
              </div>
            )}

            {/* Clear highlight menu */}
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

        {/* Draggable Divider for Desktop */}
        <div
          className="hidden lg:flex flex-col items-center justify-center w-2 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/40 relative group z-20"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="h-12 w-1 bg-gray-300 group-hover:bg-blue-400 rounded-full"></div>
        </div>

        {/* Right panel: Questions */}
        <div
          className="flex flex-col h-[50%] lg:h-full relative"
          style={{
            width:
              typeof window !== "undefined" && window.innerWidth >= 1024
                ? `calc(${100 - leftPanelRatio}% - 8px)`
                : "100%",
          }}
        >
          {/* Question Navigator in Footer via Portal */}
          <QuestionNavigatorPortal
            questions={unit.questions}
            answers={answers}
            results={result?.results}
          />

          <div className="overflow-y-auto p-4 md:p-8 flex-1 space-y-8 pb-12">
            <h2 className="text-sm uppercase tracking-wider text-gray-400 font-bold mb-6 mt-2">
              Questions
            </h2>
            <div className="space-y-8">
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
                    renderedStem={(
                      <div
                        className="prose prose-slate prose-sm max-w-none text-gray-900 font-medium leading-8 transition-all duration-300 [&_.question-inline-number]:mr-2 [&_.question-inline-number]:font-black [&_.question-inline-number]:text-slate-900 [&_p]:my-4 [&_p]:leading-[1.95] [&_strong]:font-black"
                        style={{ fontSize: `${0.92 * fontSizeRatio}rem` }}
                      >
                        {parse(normalizeQuestionStemHtml(q.stem, q.serialNumber), getParseOptions(q.id))}
                      </div>
                    )}
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
