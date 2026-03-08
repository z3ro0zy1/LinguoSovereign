"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Headphones,
  PlayCircle,
  PauseCircle,
  SkipBack,
  SkipForward,
  Volume2,
  Eye,
  EyeOff,
  Edit3,
} from "lucide-react";
import parse, { HTMLReactParserOptions } from "html-react-parser";
import { Switch } from "@/components/ui/switch";

/**
 * formatAnswer
 * Converts various Prisma data formats (Json types) into a displayable string.
 * This handles arrays (for multi-choice), strings, and nested objects.
 * Falls back to "N/A" if data is missing.
 */
function formatAnswer(answer: any): string {
  if (answer === null || answer === undefined) return "N/A";
  if (typeof answer === "string") return answer || "N/A";
  if (typeof answer === "number" || typeof answer === "boolean")
    return String(answer);
  if (Array.isArray(answer)) {
    return answer
      .map((item) =>
        typeof item === "object" && item !== null
          ? (item.value ?? item.label ?? JSON.stringify(item))
          : String(item),
      )
      .join(", ");
  }
  if (typeof answer === "object") {
    if (answer.value !== undefined) return String(answer.value);
    if (answer.label !== undefined) return String(answer.label);
    return JSON.stringify(answer);
  }
  return String(answer);
}

/**
 * buildReviewParseOptions
 * A configuration object for 'html-react-parser'. It intercept tags during parsing
 * to inject React components and custom styling.
 *
 * Key features:
 * 1. Image Path Normalization: Ensures local images are served correctly from the public dir.
 * 2. Token Replacement: Replaces '{{response}}' in question stems with interactive spans
 *    that show the user's input alongside the official answer (color-coded).
 *
 * @param userAnswers - Array of strings matching the sequence of blanks.
 * @param subResults - Graded results from the database (contains isCorrect flags).
 * @param showAnswers - UI toggle to force-reveal correct answers.
 * @param officialAnswer - The truth source from the Question model.
 */
function buildReviewParseOptions(
  userAnswers: string[] | undefined,
  subResults: any[] | undefined,
  showAnswers: boolean,
  officialAnswer: any,
): HTMLReactParserOptions {
  let blankIndex = 0;

  return {
    replace(domNode: any) {
      // Logic for <img> tags: adjust src to be absolute and add styling.
      if (
        domNode.type === "tag" &&
        domNode.name === "img" &&
        domNode.attribs?.src
      ) {
        let src = domNode.attribs.src as string;
        if (src.startsWith("images/")) src = "/" + src;
        else if (src.startsWith("../images/"))
          src = src.replace("../images/", "/images/");
        return (
          <img
            {...domNode.attribs}
            src={src}
            className="max-w-full h-auto my-4 rounded shadow-sm mx-auto"
            alt="IELTS Graphic"
          />
        );
      }

      // Logic for text nodes: look for {{response}} and swap for styled blanks.
      if (
        domNode.type === "text" &&
        domNode.data &&
        domNode.data.includes("{{response}}")
      ) {
        const parts: string[] = domNode.data.split("{{response}}");

        return (
          <>
            {parts.map((part: string, idx: number) => {
              if (idx === parts.length - 1)
                return <span key={idx}>{part}</span>;

              const currentIdx = blankIndex++;
              const userVal = userAnswers?.[currentIdx] ?? "";
              const subRes = subResults?.[currentIdx];

              // Clean up official answer strings (remove variants separated by ;)
              let officialStr = "";
              if (subRes?.officialAnswer !== undefined) {
                officialStr = String(subRes.officialAnswer).split(";")[0];
              } else if (Array.isArray(officialAnswer)) {
                officialStr = String(officialAnswer[currentIdx] ?? "");
              } else if (officialAnswer !== undefined) {
                officialStr = String(officialAnswer);
              }

              // Apply Tailwind styles based on whether the user was right/wrong
              let inputClass =
                "inline-block border-b-2 border-gray-300 px-2 text-center text-gray-500 mx-1 min-w-[90px] text-sm";
              let correctBadge: React.ReactNode = null;

              if (subRes !== undefined) {
                if (subRes.isCorrect) {
                  inputClass =
                    "inline-block border-b-2 border-green-500 bg-green-50 text-green-700 px-2 mx-1 text-center font-bold min-w-[90px] text-sm rounded";
                  correctBadge = (
                    <CheckCircle2 className="inline w-3.5 h-3.5 text-green-500 ml-0.5 -mt-0.5" />
                  );
                } else {
                  inputClass =
                    "inline-block border-b-2 border-red-400 bg-red-50 text-red-600 px-2 mx-1 text-center line-through min-w-[90px] text-sm rounded";
                  correctBadge = officialStr ? (
                    <span className="inline-block ml-1 text-xs text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded border border-green-200">
                      ✓ {officialStr}
                    </span>
                  ) : null;
                }
              } else if (showAnswers && officialStr) {
                inputClass =
                  "inline-block border-b-2 border-green-400 bg-green-50 text-green-700 px-2 mx-1 text-center font-bold min-w-[90px] text-sm rounded";
              }

              const displayVal =
                subRes !== undefined
                  ? userVal || "—"
                  : showAnswers
                    ? officialStr || "—"
                    : "______";

              return (
                <span key={idx} className="inline-flex items-baseline gap-0.5">
                  <span>{part}</span>
                  <span className={inputClass}>{displayVal}</span>
                  {correctBadge}
                </span>
              );
            })}
          </>
        );
      }
    },
  };
}

interface ReviewClientProps {
  unit: any;
  submission: any;
  isObjective: boolean;
  calculatedScore: number;
}

/**
 * ReviewClient - The interactive client component for reviewing IELTS test submissions.
 * Supports two main modes:
 * 1. Objective (Reading/Listening): Shows passage/transcript alongside questions with pass/fail markers.
 * 2. Subjective (Writing/Speaking): Shows AI feedback, scores on specific criteria, and overall analysis.
 */
export default function ReviewClient({
  unit,
  submission,
  isObjective,
  calculatedScore,
}: ReviewClientProps) {
  // --- UI State ---
  const [showTranslate, setShowTranslate] = useState(false); // Toggles Chinese translation for passages
  const [showAnswers, setShowAnswers] = useState(false); // Toggles official answer display when no submission exists
  const [openAnalysis, setOpenAnalysis] = useState<Record<string, boolean>>({}); // Controls accordion state for individual question analysis

  // --- Audio Player State (Refs & HTML5 Audio) ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75);

  /**
   * Determine if we should show the audio player.
   * Logic: Category is Listening OR it's a "Reading/Listening" unit with "Part" in the title (IELTS convention).
   */
  const isListening =
    unit.category === "Listening" ||
    (unit.category === "Reading/Listening" && unit.title.includes("Part"));

  // Toggle play/pause for the native audio element
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  /**
   * Formats seconds into MM:SS for the UI.
   */
  const formatAudioTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  // Toggle the expanded/collapsed state of a specific question's detailed analysis
  const toggleAnalysis = (id: string) => {
    setOpenAnalysis((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const aiScore = submission?.aiScore as any;
  const aiFeedback = submission?.aiFeedback;

  /**
   * Map question IDs to their logical "Number" in the test.
   * This handles multi-blank questions where one "question" might represent labels 14, 15, and 16.
   */
  const questionDisplayNumbers: Record<string, number> = {};
  let runningSerial = 0;
  for (const q of unit.questions ?? []) {
    const base =
      typeof q.serialNumber === "number" && q.serialNumber > 0
        ? q.serialNumber
        : runningSerial + 1;
    questionDisplayNumbers[q.id] = base;
    const answerCount = Array.isArray(q.answer) ? q.answer.length : 1;
    runningSerial = base + answerCount - 1;
  }

  // --- RENDERING: Objective Mode (Reading/Listening) ---
  if (isObjective) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col font-sans">
        {/* Header - Contains navigation, global score, and toggle buttons */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> 返回
          </Link>
          <div className="text-lg font-bold text-gray-800 absolute left-1/2 -translate-x-1/2">
            {unit.title}
          </div>
          <div className="flex items-center gap-4">
            {submission && (
              <div className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-200">
                Score: {calculatedScore}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnswers((v) => !v)}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border rounded transition-colors ${
                  showAnswers
                    ? "bg-green-50 text-green-700 border-green-300"
                    : "text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {showAnswers ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showAnswers ? "隐藏答案" : "显示答案"}
              </button>
              <Link
                href={`/eval/${unit.id}`}
                className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-medium text-white border border-indigo-600 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                答题
              </Link>
            </div>
          </div>
        </header>

        {/* --- Audio Player Bar (Listening ONLY) --- */}
        {isListening && (
          <div className="bg-slate-900 border-b border-slate-800 shrink-0 h-16 flex items-center px-8 gap-6 shadow-inner z-0">
            {/* Native HTML5 Audio hidden element. The 'key' ensures it resets when the URL changes. */}
            {unit.audioUrl && (
              <audio
                key={unit.audioUrl}
                ref={audioRef}
                src={`/${unit.audioUrl}`}
                onTimeUpdate={() =>
                  setCurrentTime(audioRef.current?.currentTime || 0)
                }
                onLoadedMetadata={() =>
                  setDuration(audioRef.current?.duration || 0)
                }
                onEnded={() => setIsPlaying(false)}
              />
            )}
            {/* Custom Audio Controls */}
            <div className="flex items-center gap-4 text-slate-300">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(
                      0,
                      currentTime - 10,
                    );
                  }
                }}
                className="hover:text-white transition-colors"
                title="Rewind 10s"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!unit.audioUrl}
                className="hover:text-white transition-colors text-white disabled:opacity-40"
              >
                {isPlaying ? (
                  <PauseCircle className="w-8 h-8" />
                ) : (
                  <PlayCircle className="w-8 h-8" />
                )}
              </button>
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(
                      duration,
                      currentTime + 10,
                    );
                  }
                }}
                className="hover:text-white transition-colors"
                title="Forward 10s"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
            {/* Progress Bar & Timestamps */}
            <div className="flex text-xs font-medium text-slate-400 gap-3 flex-1 items-center">
              <span className="tabular-nums w-10 text-right">
                {formatAudioTime(currentTime)}
              </span>
              <div
                className="h-1.5 bg-slate-700 w-full rounded-full overflow-hidden relative cursor-pointer group"
                onClick={(e) => {
                  if (!audioRef.current || !duration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  audioRef.current.currentTime = ratio * duration;
                }}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full group-hover:bg-indigo-400 transition-colors"
                  style={{
                    width: duration
                      ? `${(currentTime / duration) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="tabular-nums w-10">
                {formatAudioTime(duration)}
              </span>
            </div>
            {/* Volume Control */}
            <div className="flex items-center gap-2 text-slate-400">
              <Volume2 className="w-4 h-4" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="w-20 accent-indigo-400"
              />
            </div>
          </div>
        )}

        {/* --- MAIN BODY: Two-column layout (independent scrolling) --- */}
        <div
          className={`flex-1 flex min-h-0 ${isListening ? "lg:flex-row-reverse" : "lg:flex-row"} flex-col`}
        >
          {/* LEFT PANEL: Passage (Reading) or Transcript (Listening) */}
          <div className="lg:w-1/2 flex flex-col border-r border-gray-200 bg-white min-h-0">
            {/* Panel Header: Translation Toggle */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-700">原文</span>
                <Switch
                  checked={showTranslate}
                  onCheckedChange={setShowTranslate}
                  className="data-[state=checked]:bg-indigo-600 scale-90"
                />
                <span
                  className={`text-sm font-bold transition-colors ${showTranslate ? "text-indigo-600" : "text-slate-400"}`}
                >
                  译文
                </span>
              </div>
              {isListening && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-100 shadow-sm">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Hearing Transcript</span>
                </div>
              )}
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              {unit.passage &&
              Array.isArray(unit.passage) &&
              unit.passage.length > 0 ? (
                <div className="space-y-6 pb-20">
                  {unit.passage.map((p: any, idx: number) => {
                    const text =
                      typeof p === "string" ? p : p.english || p.title;
                    const chinese = typeof p === "object" ? p.chinese : null;
                    return (
                      <div key={idx} className="group">
                        <p
                          className={`text-gray-800 text-[17px] leading-[1.8] font-serif ${showTranslate ? "mb-2" : ""}`}
                        >
                          {text}
                        </p>
                        {showTranslate && chinese && (
                          <p className="text-gray-500 text-sm leading-relaxed border-l-2 border-indigo-200 pl-3">
                            {chinese}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  无阅读文本或听力底稿
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Questions & Analysis */}
          <div className="lg:w-1/2 flex flex-col bg-gray-50/50 min-h-0">
            {/* Scrollable Question Area */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-10">
              <div className="space-y-8 pb-32 max-w-2xl mx-auto">
                {unit.questions.map((q: any) => {
                  // Find the corresponding results for this question in the submission
                  const resData = aiScore?.results?.find(
                    (r: any) => r.questionId === q.id,
                  );
                  const isExpanded = openAnalysis[q.id];
                  const displayNum = questionDisplayNumbers[q.id];

                  /**
                   * Format user answers for the parser options.
                   * If the submission exists, we pull it; otherwise it's undefined.
                   */
                  const userAnswers: string[] | undefined = resData?.userAnswer
                    ? Array.isArray(resData.userAnswer)
                      ? resData.userAnswer.map(String)
                      : [String(resData.userAnswer)]
                    : undefined;

                  const parseOpts = buildReviewParseOptions(
                    userAnswers,
                    resData?.subResults,
                    showAnswers,
                    q.answer,
                  );

                  // Detect if question uses inline blank tokens (e.g. "The {{response}} is blue")
                  const hasInlineBlanks =
                    typeof q.stem === "string" &&
                    q.stem.includes("{{response}}");

                  return (
                    <div
                      key={q.id}
                      id={`question-${q.serialNumber}`}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200/60 relative group transition-all hover:border-indigo-100 hover:shadow-md"
                    >
                      {/* Question Number Badge */}
                      <div className="absolute -left-3 -top-3 w-8 h-8 bg-indigo-100 text-indigo-700 font-bold rounded-full flex items-center justify-center shadow-sm text-xs">
                        {displayNum}
                      </div>

                      {/* Question Stem - Parsed with custom logic to inject user/correct answers */}
                      <div className="prose prose-sm max-w-none text-gray-800 font-medium mb-5 pl-2 leading-relaxed">
                        {parse(q.stem, parseOpts)}
                      </div>

                      {/* Rendering logic for Multiple Choice Options (if present) */}
                      {q.options && q.options.length > 0 && (
                        <div className="space-y-2 mb-6">
                          {q.options.map((opt: any, i: number) => {
                            const optVal =
                              typeof opt === "object"
                                ? String(opt.value ?? opt.label ?? i)
                                : String(opt);
                            const optLabel =
                              typeof opt === "object"
                                ? String(opt.label ?? opt.value ?? opt)
                                : String(opt);

                            // Helper to extract official answers for comparison
                            const officialAnswers: string[] =
                              resData?.subResults
                                ? resData.subResults.map((sr: any) =>
                                    String(sr.officialAnswer ?? "")
                                      .trim()
                                      .toLowerCase(),
                                  )
                                : Array.isArray(q.answer)
                                  ? q.answer.map((a: any) =>
                                      String(a).trim().toLowerCase(),
                                    )
                                  : q.answer
                                    ? [String(q.answer).trim().toLowerCase()]
                                    : [];

                            const isCorrectOpt = officialAnswers.includes(
                              optVal.toLowerCase(),
                            );

                            // Check if user selected this specific option
                            const userSelections: string[] = resData?.userAnswer
                              ? Array.isArray(resData.userAnswer)
                                ? resData.userAnswer.map((v: any) =>
                                    String(v).trim().toLowerCase(),
                                  )
                                : [
                                    String(resData.userAnswer)
                                      .trim()
                                      .toLowerCase(),
                                  ]
                              : [];

                            const isSelected = userSelections.includes(
                              optVal.toLowerCase(),
                            );

                            // Dynamic class switching based on graded state
                            let optClass =
                              "flex items-center gap-3 p-3 rounded-lg border text-sm";
                            if (resData) {
                              if (isCorrectOpt)
                                optClass +=
                                  " bg-green-50 border-green-300 text-green-800 font-semibold";
                              else if (isSelected)
                                optClass +=
                                  " bg-red-50 border-red-300 text-red-700 line-through opacity-70";
                              else optClass += " border-gray-100 text-gray-500";
                            } else if (showAnswers && isCorrectOpt) {
                              optClass +=
                                " bg-green-50 border-green-300 text-green-800 font-semibold";
                            } else {
                              optClass += " border-gray-100 text-gray-600";
                            }

                            return (
                              <div key={i} className={optClass}>
                                <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span>{optLabel}</span>
                                {resData && isCorrectOpt && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto shrink-0" />
                                )}
                                {resData && isSelected && !isCorrectOpt && (
                                  <XCircle className="w-4 h-4 text-red-400 ml-auto shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Footer Row: Only for standard questions (no inline blanks) */}
                      {!hasInlineBlanks && (
                        <div className="flex flex-col gap-3 py-4 border-t border-gray-50">
                          {submission ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-xs">
                                    您的答案：
                                  </span>
                                  <span
                                    className={`font-mono text-sm font-bold ${
                                      resData?.isCorrect
                                        ? "text-green-600"
                                        : resData?.userAnswer != null
                                          ? "text-red-500"
                                          : "text-gray-400"
                                    }`}
                                  >
                                    {formatAnswer(resData?.userAnswer) ||
                                      "未作答"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-xs">
                                    正确答案：
                                  </span>
                                  {showAnswers ||
                                  resData?.isCorrect !== undefined ? (
                                    <span className="font-mono text-sm font-bold text-green-600">
                                      {formatAnswer(
                                        resData?.subResults?.[0]
                                          ?.officialAnswer ?? q.answer,
                                      )}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-sm text-gray-300 select-none blur-sm">
                                      ██████
                                    </span>
                                  )}
                                </div>
                              </div>
                              {resData?.isCorrect ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">
                                正确答案：
                              </span>
                              {showAnswers ? (
                                <span className="font-mono text-[15px] font-bold text-green-600 px-2 py-0.5 bg-green-50 rounded">
                                  {formatAnswer(q.answer)}
                                </span>
                              ) : (
                                <span className="font-mono text-[15px] font-bold text-gray-300 px-2 py-0.5 bg-gray-50 rounded select-none blur-sm">
                                  ██████
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* For inline-blank questions with a submission: show overall correct/wrong icon */}
                      {hasInlineBlanks && submission && resData && (
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50 mt-3">
                          {resData.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="text-xs text-gray-400">
                            {resData.isCorrect ? "全部正确" : "含有错误答案"}
                          </span>
                        </div>
                      )}

                      {/* Official analysis accordion */}
                      {q.officialAnalysis && (
                        <div className="mt-2 border border-blue-100 bg-blue-50/30 rounded-xl overflow-hidden transition-all">
                          <button
                            onClick={() => toggleAnalysis(q.id)}
                            className="w-full flex items-center justify-between p-3 text-sm text-blue-600 font-semibold hover:bg-blue-50/50 transition-colors"
                          >
                            <span>{isExpanded ? "收起解析" : "显示解析"}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="p-4 pt-0 border-t border-blue-100/50 text-sm text-gray-700 leading-relaxed font-serif whitespace-pre-wrap bg-blue-50/30">
                              {Array.isArray(q.officialAnalysis)
                                ? parse(
                                    q.officialAnalysis
                                      .map((item: any) =>
                                        typeof item === "string"
                                          ? item
                                          : formatAnswer(item),
                                      )
                                      .join("<br/>"),
                                  )
                                : parse(String(q.officialAnalysis))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- Bottom Navigation Bar: Quick scroll to specific questions --- */}
            <div className="bg-white border-t border-gray-200 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0 flex flex-wrap gap-2 justify-center">
              {unit.questions.map((q: any) => {
                const resData = aiScore?.results?.find(
                  (r: any) => r.questionId === q.id,
                );
                // Color coding for the nav dots: Blue (ungraded), Green (correct), Red (incorrect)
                const bgColor = !submission
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                  : resData?.isCorrect
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white";

                const displayNum = questionDisplayNumbers[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      const el = document.getElementById(
                        `question-${q.serialNumber}`,
                      );
                      if (el)
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        });
                    }}
                    className={`w-9 h-9 rounded-sm flex items-center justify-center font-bold text-xs shadow-sm transition-all transform hover:scale-105 ${bgColor}`}
                  >
                    {displayNum}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING: Subjective Flow (Writing / Speaking) ---
  // This layout is more vertical and focus on qualitative AI feedback.
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900 font-sans">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 lg:px-12 sticky top-0 z-30">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-semibold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> 返回控制台
        </Link>
        <div className="mx-auto text-lg font-bold text-gray-800">
          Review: {unit.title}
        </div>
        {submission && (
          <div className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-bold text-gray-700">
            Score: {calculatedScore}
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto w-full py-10 px-4">
        <div className="space-y-8">
          <h1 className="text-2xl font-bold border-b pb-4">
            Subjective Evaluation Key
          </h1>

          {/* Context Panel: Shows the writing prompt or speaking topic context */}
          {unit.passage &&
            Array.isArray(unit.passage) &&
            unit.passage.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold mb-4">
                  Prompt Context / 提示文本
                </h3>
                <div className="space-y-4">
                  {unit.passage.map((p: any, idx: number) => {
                    const text =
                      typeof p === "string" ? p : p.english || p.title;
                    const chinese = typeof p === "object" ? p.chinese : null;
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg ${chinese ? "bg-blue-50 border-l-4 border-blue-400" : "bg-gray-50"}`}
                      >
                        <p className="text-gray-800 font-serif leading-relaxed mb-2">
                          {text}
                        </p>
                        {chinese && (
                          <p className="text-gray-600 text-sm">{chinese}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Questions Section: Shows the specific task instruction and reference analysis */}
          {unit.questions && unit.questions.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
              <h3 className="text-lg font-bold mb-4 border-b pb-2">
                Questions & References / 题目与参考解答
              </h3>
              {unit.questions.map((q: any) => (
                <div
                  key={q.id}
                  className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                >
                  <div className="prose prose-sm max-w-none text-gray-800 mb-3 font-serif">
                    {parse(q.stem)}
                  </div>
                  {formatAnswer(q.answer) !== "N/A" && (
                    <div className="mt-2 text-sm text-green-800 bg-green-50 p-3 rounded border border-green-200">
                      <strong className="block mb-1">
                        Sample Answer / 参考答案:
                      </strong>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {formatAnswer(q.answer)}
                      </div>
                    </div>
                  )}
                  {q.officialAnalysis && (
                    <div className="mt-3 text-sm text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
                      <strong className="block mb-1">
                        Analysis / 题目解析:
                      </strong>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {Array.isArray(q.officialAnalysis)
                          ? q.officialAnalysis.join("\n")
                          : q.officialAnalysis}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* AI Feedback Section: Core evaluation results for Writing/Speaking */}
          {submission && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-8">
              <h3 className="text-sm uppercase text-gray-500 font-bold mb-4">
                Your Context / Response
              </h3>
              {/* User's raw text submission */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap text-sm text-gray-700 mb-6 font-serif leading-relaxed">
                {submission?.answers
                  ? JSON.stringify(submission.answers, null, 2).replace(
                      /\\n/g,
                      "\n",
                    )
                  : "No Content Provided / 未作答"}
              </div>

              <h3 className="text-sm uppercase text-blue-500 font-bold mt-8 mb-4">
                AI Critical Analysis
              </h3>
              {/* AI assessment markdown content */}
              {aiFeedback ? (
                <div className="prose max-w-none prose-blue text-sm">
                  {parse(aiFeedback.replace(/\n/g, "<br/>"))}
                </div>
              ) : (
                <div className="prose max-w-none text-gray-800 text-sm">
                  <pre className="text-xs">
                    {JSON.stringify(aiScore, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
