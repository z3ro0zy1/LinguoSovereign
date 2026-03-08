"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import parse from "html-react-parser";
import { Mic } from "lucide-react";
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
import {
  EMPTY_UNIT_STATE,
  clearUnitState,
  getUnitState,
  saveUnitState,
  type StoredUnitState,
} from "@/lib/testSession";

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SubjectiveQuestion = {
  id: string;
  stem?: string;
};

type SubjectiveUnit = {
  id: string;
  category: string;
  questions: SubjectiveQuestion[];
};

type BatchSubmission = {
  unitId: string;
  userAnswers: Record<string, string>;
  timeSpent: number;
  category: string;
};

type SubjectiveEvaluation = {
  submissionId?: string;
  aiEvaluation?: {
    dimensions?: Record<string, number | string>;
    summary?: string;
  };
};

type SubjectiveRendererProps = {
  unit: SubjectiveUnit;
  isWriting: boolean;
  onResult: (result: SubjectiveEvaluation, unitId?: string) => void;
  result?: Record<string, unknown> | null;
  isLastPart: boolean;
  allFlowIds: string[];
};

export default function SubjectiveRenderer({
  unit,
  isWriting,
  onResult,
  result,
  isLastPart,
  allFlowIds,
}: SubjectiveRendererProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dismissedRestorePrompt, setDismissedRestorePrompt] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const storedState = useMemo<StoredUnitState>(() => {
    if (typeof window === "undefined") return EMPTY_UNIT_STATE;
    return getUnitState(unit.id);
  }, [unit.id]);

  const shouldPromptRestore =
    !dismissedRestorePrompt &&
    Object.keys(answers).length === 0 &&
    (Object.keys(storedState.answers).length > 0 || storedState.timeSpent > 0);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reqIds = unit.questions.map((question) => question.id);
    saveUnitState(unit.id, unit.category, reqIds, answers, 0);
  }, [answers, unit.category, unit.id, unit.questions]);

  const questions = unit.questions ?? [];
  const currentQuestion = questions[currentStep];

  const handleRestoreState = () => {
    const restoredAnswers = Object.fromEntries(
      Object.entries(storedState.answers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(" ") : value,
      ]),
    );
    setAnswers(restoredAnswers);
    setDismissedRestorePrompt(true);
  };

  const handleDiscardState = () => {
    clearUnitState(unit.id);
    setAnswers({});
    setDismissedRestorePrompt(true);
  };

  const handleSubmitAll = async () => {
    if (!allFlowIds.length) return;

    let hasEmpty = false;
    const submissions: BatchSubmission[] = [];

    for (const id of allFlowIds) {
      const state = getUnitState(id);
      const userAnswers = Object.fromEntries(
        Object.entries(state.answers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(" ") : value,
        ]),
      );

      for (const questionId of state.reqIds) {
        if (!userAnswers[questionId] || userAnswers[questionId].trim().length === 0) {
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

    if (hasEmpty && !window.confirm("您还有未作答的题目，确定要全部提交吗？")) {
      return;
    }

    setLoading(true);

    try {
      const responses = await Promise.all(
        submissions.map(async (submission) => {
          const endpoint =
            submission.category === "Writing" || submission.category === "Speaking"
              ? "/api/eval/subjective"
              : "/api/eval/objective";

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unitId: submission.unitId,
              userAnswers: submission.userAnswers,
              timeSpent: submission.timeSpent,
            }),
          });

          const json = (await response.json()) as { data?: SubjectiveEvaluation };
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
    } finally {
      setLoading(false);
    }
  };

  if (!currentQuestion) {
    return <div>No Questions Available</div>;
  }

  const evaluation = (result ?? null) as SubjectiveEvaluation | null;

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
              检测到上次未完成的主观题进度
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm text-gray-500">
              你可以继续上次作答，也可以清空缓存重新开始。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex w-full flex-row gap-3 sm:justify-center">
            <Button variant="outline" className="flex-1" onClick={handleRestoreState}>
              继续作答
            </Button>
            <Button className="flex-1 bg-gray-900 text-white hover:bg-gray-800" onClick={handleDiscardState}>
              重新开始
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {questions.length > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 backdrop-blur-sm">
          <span>
            Part {currentStep + 1} / {questions.length}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={currentStep === 0} onClick={() => setCurrentStep((step) => step - 1)}>
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={currentStep === questions.length - 1}
              onClick={() => setCurrentStep((step) => step + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <Card className="min-h-[600px] overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <CardContent className="p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  Prompt Surface
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {isWriting ? "写作题面" : "口语题卡"}
                </h2>
              </div>
              <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700">
                {isWriting ? "Structured Writing" : "Live Speaking"}
              </div>
            </div>
            <div className="prose max-w-none break-words text-[15px] leading-relaxed text-slate-700">
              {parse(currentQuestion.stem || "", imageFixingOptions)}
            </div>
          </CardContent>
        </Card>

        {evaluation ? (
          <Card className="rounded-[2rem] border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-[0_25px_70px_rgba(59,130,246,0.12)]">
            <CardContent className="flex h-full flex-col gap-6 p-8 lg:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-500">
                  AI Feedback
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  已生成本题型评估结果
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {["TR", "CC", "LR", "GRA"].map((dimension) => (
                  <div
                    key={dimension}
                    className="rounded-2xl border border-white/80 bg-white/90 p-4 text-center shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {dimension}
                    </p>
                    <p className="mt-2 text-3xl font-black text-blue-600">
                      {evaluation.aiEvaluation?.dimensions?.[dimension] ?? "N/A"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex-1 rounded-[1.5rem] border border-white/80 bg-white/90 p-6 text-[15px] leading-relaxed text-slate-700 shadow-sm whitespace-pre-wrap">
                {evaluation.aiEvaluation?.summary || "No feedback summary generated."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    Response Studio
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">
                    {isWriting ? "撰写你的答卷" : "记录你的回答"}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  {isWriting ? (
                    <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700">
                      Words: {answers[currentQuestion.id]?.trim().split(/\s+/).filter(Boolean).length || 0}
                    </div>
                  ) : (
                    <Button
                      variant={isRecording ? "destructive" : "secondary"}
                      className="rounded-full px-5"
                      onClick={() => {
                        const recognition = recognitionRef.current;
                        if (!recognition) {
                          window.alert("Your browser does not support speech recognition. Please use Chrome or Edge.");
                          return;
                        }

                        if (isRecording) {
                          recognition.stop();
                          setIsRecording(false);
                          return;
                        }

                        recognition.onresult = (event) => {
                          let finalTranscript = "";

                          for (let i = event.resultIndex; i < event.results.length; i += 1) {
                            const resultItem = event.results[i];
                            if (resultItem?.isFinal) {
                              finalTranscript += resultItem[0].transcript;
                            }
                          }

                          if (finalTranscript.trim()) {
                            setAnswers((previous) => ({
                              ...previous,
                              [currentQuestion.id]: `${previous[currentQuestion.id] || ""} ${finalTranscript.trim()}`.trim(),
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
                      <Mic className={`mr-2 h-4 w-4 ${isRecording ? "animate-pulse text-white" : ""}`} />
                      {isRecording ? "Stop Recording" : "Start Recording"}
                    </Button>
                  )}
                </div>
              </div>

              <textarea
                className="mt-5 min-h-[520px] w-full resize-none rounded-[1.5rem] border-2 border-slate-200 bg-slate-50/80 p-6 text-base leading-relaxed text-slate-900 shadow-inner outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                placeholder={
                  isWriting
                    ? "Start typing your response..."
                    : "Click Start Recording to dictate your answer, or type it manually."
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

            <div className="flex justify-end pt-2">
              {currentStep < questions.length - 1 ? (
                <Button size="lg" variant="secondary" className="rounded-full px-6" onClick={() => setCurrentStep((step) => step + 1)}>
                  继续作答 Part {currentStep + 2}
                </Button>
              ) : isLastPart ? (
                <Button
                  size="lg"
                  className="rounded-full bg-gray-900 px-8 text-white shadow-lg hover:bg-gray-800"
                  onClick={handleSubmitAll}
                  disabled={loading}
                >
                  {loading ? "提交并评估中..." : "全卷提交并评估"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  自动保存中
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
