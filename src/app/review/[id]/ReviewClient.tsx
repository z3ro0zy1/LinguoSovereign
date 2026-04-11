/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Headphones,
  Eye,
  EyeOff,
  Edit3,
} from "lucide-react";
import parse from "html-react-parser";
import { Switch } from "@/components/ui/switch";
import { resolveAudioUrl } from "@/lib/utils";
import { imageFixingOptions } from "@/components/eval/objective/shared";
import { ReviewAudioPlayer } from "./ReviewAudioPlayer";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { ObjectiveReviewQuestionCard } from "./ObjectiveReviewQuestionCard";
import { buildReviewParseOptions, formatAnswer, parseRichAnswer } from "./review-utils";

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
  const { t } = useLocale();
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
  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to play review audio", error);
      setIsPlaying(false);
    }
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
  const aiFeedback = submission?.aiFeedback as string | undefined;
  const hasSubjectiveAiEvaluation = Boolean(
    !isObjective &&
      aiScore &&
      typeof aiScore === "object" &&
      ["TR", "CC", "LR", "GRA", "FC", "P", "totalScore"].some((key) => key in aiScore),
  );
  const rawSubmissionAnswers = submission?.answers as { userAnswers?: Record<string, string>; timeSpent?: number } | null | undefined;
  const userResponseEntries = Object.entries(rawSubmissionAnswers?.userAnswers || {}).filter(([, value]) => typeof value === "string" && value.trim().length > 0);

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
            <ArrowLeft className="w-5 h-5" /> {t("back")}
          </Link>
          <div className="text-lg font-bold text-gray-800 absolute left-1/2 -translate-x-1/2">
            {unit.title}
          </div>
          <div className="ml-auto mr-4"><LanguageToggle /></div>
          <div className="flex items-center gap-4">
            {submission && (
              <div className="px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-bold border border-blue-200">
                {t("overallBand")}: {calculatedScore}
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
                {showAnswers ? t("hideAnswers") : t("showAnswers")}
              </button>
              <Link
                href={`/eval/${unit.id}`}
                className="flex items-center gap-1.5 px-5 py-1.5 text-sm font-medium text-white border border-indigo-600 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {t("answerQuestion")}
              </Link>
            </div>
          </div>
        </header>

        {isListening && unit.audioUrl && (
          <ReviewAudioPlayer
            audioRef={audioRef}
            audioUrl={resolveAudioUrl(unit.audioUrl)}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            onTogglePlay={() => {
              void togglePlay();
            }}
            onVolumeChange={(nextVolume) => {
              setVolume(nextVolume);
              if (audioRef.current) audioRef.current.volume = nextVolume;
            }}
            onSeek={(nextTime) => {
              if (audioRef.current) {
                audioRef.current.currentTime = nextTime;
                setCurrentTime(nextTime);
              }
            }}
            onTimeUpdate={() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                audioRef.current.volume = volume;
                setDuration(audioRef.current.duration || 0);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            formatAudioTime={formatAudioTime}
          />
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
                <span className="text-sm font-bold text-slate-700">{t("originalText")}</span>
                <Switch
                  checked={showTranslate}
                  onCheckedChange={setShowTranslate}
                  className="data-[state=checked]:bg-indigo-600 scale-90"
                />
                <span
                  className={`text-sm font-bold transition-colors ${showTranslate ? "text-indigo-600" : "text-slate-400"}`}
                >
                  {t("translation")}
                </span>
              </div>
              {isListening && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-100 shadow-sm">
                  <Headphones className="w-3.5 h-3.5" />
                  <span>{t("transcript")}</span>
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
                  {t("noPassageOrTranscript")}
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
                  const resData = aiScore?.results?.find(
                    (r: any) => r.questionId === q.id,
                  );
                  const isExpanded = openAnalysis[q.id];
                  const displayNum = questionDisplayNumbers[q.id];
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

                  return (
                    <ObjectiveReviewQuestionCard
                      key={q.id}
                      question={q}
                      questionAnchorId={`question-${q.serialNumber}`}
                      displayNumber={displayNum}
                      resultData={resData}
                      hasSubmission={!!submission}
                      showAnswers={showAnswers}
                      isExpanded={!!isExpanded}
                      onToggleAnalysis={() => toggleAnalysis(q.id)}
                      renderedStem={parse(q.stem, parseOpts)}
                    />
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
          <ArrowLeft className="w-5 h-5" /> {t("backToDashboard")}
        </Link>
        <div className="mx-auto text-lg font-bold text-gray-800">
          {t("reviewLabel")}: {unit.title}
        </div>
        {submission && hasSubjectiveAiEvaluation && (
          <div className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-bold text-gray-700">
            Score: {calculatedScore}
          </div>
        )}
        {submission && !hasSubjectiveAiEvaluation && (
          <div className="px-4 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700">
            {t("savedWithoutAi")}
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto w-full py-10 px-4">
        <div className="space-y-8">
          <h1 className="text-2xl font-bold border-b pb-4">
            {t("subjectiveEvaluationKey")}
          </h1>

          {/* Context Panel: Shows the writing prompt or speaking topic context */}
          {unit.passage &&
            Array.isArray(unit.passage) &&
            unit.passage.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold mb-4">
                  {t("promptContext")}
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
                {t("questionsAndReferences")}
              </h3>
              {unit.questions.map((q: any) => (
                <div
                  key={q.id}
                  className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                >
                  <div className="prose prose-sm max-w-none text-gray-800 mb-3 font-serif">
                    {parse(q.stem, imageFixingOptions)}
                  </div>
                  <div className={`mt-2 rounded border p-3 text-sm ${formatAnswer(q.answer) !== "N/A" ? "border-green-200 bg-green-50 text-green-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    <strong className="mb-1 block">
                      {t("sampleAnswer")}:
                    </strong>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {formatAnswer(q.answer) !== "N/A"
                        ? formatAnswer(q.answer)
                        : t("sampleAnswerPlaceholder")}
                    </div>
                  </div>
                  {q.officialAnalysis && (
                    <div className="mt-3 text-sm text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
                      <strong className="block mb-1">
                        {t("analysisLabel")}:
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
                {t("yourResponse")}
              </h3>
              <div className="mb-6 space-y-3">
                {userResponseEntries.length ? (
                  userResponseEntries.map(([questionId, value], index) => {
                    const matchedQuestion = unit.questions.find((question: any) => question.id === questionId);
                    return (
                      <div key={questionId} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                            {matchedQuestion ? `${t("responseItem")} ${index + 1}` : `${t("answerItem")} ${index + 1}`}
                          </p>
                          {matchedQuestion?.serialNumber ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                              Q{matchedQuestion.serialNumber}
                            </span>
                          ) : null}
                        </div>
                        <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700 font-serif">
                          {value}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    {t("noContentProvided")}
                  </div>
                )}
              </div>

              <h3 className="text-sm uppercase text-blue-500 font-bold mt-8 mb-4">
                {t("aiCriticalAnalysis")}
              </h3>
              {hasSubjectiveAiEvaluation && aiFeedback ? (
                <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                  {parseRichAnswer(aiFeedback)}
                </div>
              ) : hasSubjectiveAiEvaluation ? (
                <div className="prose max-w-none text-gray-800 text-sm">
                  <pre className="text-xs">
                    {JSON.stringify(aiScore, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
                  {t("savedOnlyNoAiNote")}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
