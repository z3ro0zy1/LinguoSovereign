"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import parse from "html-react-parser";
import { imageFixingOptions } from "./ObjectiveRenderer";
import { Mic } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { saveUnitState, getUnitState, clearUnitState } from "@/lib/testSession";

/**
 * SubjectiveRenderer Component
 *
 * Handles rendering for Writing and Speaking tasks where users contribute free-form text or voice.
 * Features:
 * - Supports Pagination (moving between multiple writing Parts or speaking Parts).
 * - Integrates the native `Web Speech API` for live transcription during Speaking tasks.
 * - Submits raw answers directly to the OpenAI-powered `api/eval/subjective` endpoint.
 * - Parses rich Markdown/HTML feedback from the AI Model to display dimensions (TR, CC, LR, GRA).
 */
export default function SubjectiveRenderer({
  unit,
  isWriting,
  onResult,
  result,
  isLastPart,
  allFlowIds,
}: any) {
  // State management for pagination, data inputs, and loader UX.
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [backedUpState, setBackedUpState] = useState<{
    answers: any;
    timeSpent: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const state = getUnitState(unit.id);
      if (Object.keys(state.answers).length > 0) {
        setBackedUpState({
          answers: state.answers,
          timeSpent: state.timeSpent,
        });
        setShowRestorePrompt(true);
      }
    }
  }, [unit.id]);

  const handleRestoreState = () => {
    if (backedUpState) {
      if (Object.keys(backedUpState.answers).length > 0) {
        setAnswers(backedUpState.answers);
      }
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardState = () => {
    clearUnitState(unit.id);
    setAnswers({});
    setShowRestorePrompt(false);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const reqIds = unit.questions?.map((q: any) => q.id) || [];
      saveUnitState(unit.id, unit.category, reqIds, answers, 0);
    }
  }, [answers, unit.id, unit.category, unit.questions]);

  // --- Speech Recognition Setup ---
  // We use standard React refs to maintain the recognition instance across re-renders.
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  /**
   * Initializes the native Web Speech API instance securely upon mount.
   * Uses `webkitSpeechRecognition` (prefix required for many Chromium/Safari versions).
   * Note: This only works in secure (HTTPS) contexts in production.
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = true;
        reco.interimResults = true;
        reco.lang = "en-US";
        recognitionRef.current = reco;
      }
    }
  }, []);

  // Helper selectors for pagination
  const questions = unit.questions || [];
  const currentQ = questions[currentStep];

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * handleSubmitAll:
   * Orchestrates the final submission for subjective tasks.
   * 1. Aggregates responses from all parts of the current flow.
   * 2. Prompts user if any parts are empty.
   * 3. Sends them to the GPT-powered subjective evaluation endpoint.
   */
  const handleSubmitAll = async () => {
    if (!allFlowIds || allFlowIds.length === 0) return;

    let hasEmpty = false;
    const allSubs: any[] = [];

    for (const id of allFlowIds) {
      const state = getUnitState(id);
      const ans = state.answers;
      const reqIds = state.reqIds;

      // Validate all required questions have input
      for (const qId of reqIds) {
        if (!ans[qId] || String(ans[qId]).trim().length === 0) {
          hasEmpty = true;
        }
      }

      allSubs.push({
        unitId: id,
        userAnswers: ans,
        timeSpent: state.timeSpent || 0,
        category: state.category,
      });
    }

    if (hasEmpty) {
      const confirm = window.confirm("您还有未作答的题目，确定要全部提交吗？");
      if (!confirm) return;
    }

    setLoading(true);

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

      // Distribute results back to the wrapper to switch into 'Result/Review' mode
      for (const r of results) {
        if (r.data) {
          onResult(r.data, r.unitId);
        }
      }
    } catch (e) {
      console.error("Batch submission failed:", e);
    }
    setLoading(false);
  };

  if (!currentQ) return <div>No Questions Available</div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Restore State Dialog */}
      <AlertDialog
        open={showRestorePrompt}
        onOpenChange={(val: boolean) => {
          if (!val) return;
          setShowRestorePrompt(val);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center gap-2 text-orange-600 mb-2">
              <span className="bg-orange-100 p-1 rounded-full flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </span>
            </AlertDialogTitle>
            <AlertDialogTitle className="text-center text-lg">
              上次有未完成的答题记录，是否继续作答？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm mt-1">
              继续作答将保留之前的进度。重新作答将清空记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center flex-row gap-4 mt-4 w-full">
            <Button
              variant="outline"
              onClick={handleRestoreState}
              className="flex-1"
            >
              继续作答
            </Button>
            <Button
              variant="default"
              onClick={handleDiscardState}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              重新作答
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Internal Step Controller if multiple questions in one unit */}
      {questions.length > 1 && (
        <div className="flex justify-between items-center text-sm font-medium text-gray-500 bg-gray-100 p-2 rounded">
          <span>
            Part {currentStep + 1} of {questions.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={currentStep === 0}
              onClick={handlePrev}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={currentStep === questions.length - 1}
              onClick={handleNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Main Layout: Split into Left and Right Columns on large screens (Prompt on Right per user request) */}
      <div className="flex flex-col lg:flex-row-reverse gap-8 items-stretch">
        {/* LEFT COLUMN: Prompt Document (Image/Graph/Text) */}
        <div className="w-full lg:w-1/2 flex flex-col min-h-[600px]">
          <Card className="overflow-auto border border-gray-200 p-6 bg-white flex-1 shadow-sm rounded-2xl">
            <div className="prose max-w-none break-words text-[15px] leading-relaxed">
              {parse(currentQ.stem || "", imageFixingOptions)}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: User Response / AI Feedback */}
        <div className="w-full lg:w-1/2 flex flex-col">
          {result ? (
            <Card className="flex-1 shadow-sm rounded-2xl bg-blue-50/50 border-blue-100 border">
              <CardContent className="p-6 flex flex-col gap-4">
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  AI Evaluation Feedback
                </h3>

                {/* AI Dimension Scores: Breakdown by TR, CC, LR, GRA */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {["TR", "CC", "LR", "GRA"].map((dim) => (
                    <div
                      key={dim}
                      className="border border-white/60 p-4 rounded-2xl text-center bg-white/80 shadow-sm backdrop-blur-sm"
                    >
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                        {dim} Score
                      </p>
                      <p className="text-3xl font-black text-blue-600">
                        {result.aiEvaluation?.dimensions?.[dim] ?? "N/A"}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="prose text-[15px] bg-white p-6 rounded-2xl border border-white/60 shadow-sm whitespace-pre-wrap leading-relaxed text-gray-700 flex-1">
                  {result.aiEvaluation?.summary ||
                    "No feedback summary generated."}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex justify-between items-end mb-1">
                <span className="font-bold text-gray-700 text-lg">
                  {isWriting ? "撰写你的答卷:" : "Your response:"}
                </span>

                <div className="flex items-center gap-4">
                  {isWriting && (
                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-bold text-sm shadow-sm border border-blue-100">
                      Words:{" "}
                      {answers[currentQ.id]
                        ? answers[currentQ.id]
                            .trim()
                            .split(/\s+/)
                            .filter((w: string) => w.length > 0).length
                        : 0}
                    </div>
                  )}

                  {!isWriting && (
                    <Button
                      variant={isRecording ? "destructive" : "secondary"}
                      className="rounded-xl shadow-sm"
                      onClick={() => {
                        if (isRecording) {
                          recognitionRef.current?.stop();
                          setIsRecording(false);
                        } else {
                          if (recognitionRef.current) {
                            recognitionRef.current.onresult = (event: any) => {
                              let finalTranscript = "";
                              for (
                                let i = event.resultIndex;
                                i < event.results.length;
                                ++i
                              ) {
                                if (event.results[i].isFinal)
                                  finalTranscript +=
                                    event.results[i][0].transcript;
                              }
                              if (finalTranscript) {
                                setAnswers((prev) => ({
                                  ...prev,
                                  [currentQ.id]:
                                    (prev[currentQ.id] || "") +
                                    " " +
                                    finalTranscript.trim(),
                                }));
                              }
                            };
                            recognitionRef.current.onerror = (e: any) =>
                              console.error("Speech Error", e);
                            recognitionRef.current.start();
                            setIsRecording(true);
                          } else {
                            alert(
                              "Your browser does not support speech recognition. Please use Chrome or Edge.",
                            );
                          }
                        }
                      }}
                    >
                      <Mic
                        className={`w-4 h-4 mr-2 ${isRecording ? "animate-pulse text-white" : ""}`}
                      />
                      {isRecording ? "Stop Recording" : "Start Recording"}
                    </Button>
                  )}
                </div>
              </div>

              <textarea
                className="w-full flex-1 min-h-[500px] border-2 border-gray-200 rounded-2xl p-6 text-base leading-relaxed focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:outline-none resize-none shadow-inner bg-white/80 backdrop-blur-sm transition-all"
                placeholder={
                  isWriting
                    ? "Start typing..."
                    : "Click Start Recording to dictate your answer using Web Speech API, or manually type."
                }
                value={answers[currentQ.id] || ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [currentQ.id]: e.target.value })
                }
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* 提交控制器 */}
      {!result && (
        <div className="flex justify-end pt-4 mt-4">
          {currentStep < questions.length - 1 ? (
            <Button
              size="lg"
              variant="secondary"
              className="rounded-xl font-bold"
              onClick={handleNext}
            >
              继续作答本题型 Part {currentStep + 2}
            </Button>
          ) : isLastPart ? (
            <Button
              size="lg"
              className="rounded-xl px-8 h-12 shadow-md bg-gray-900 hover:bg-gray-800 font-bold"
              onClick={handleSubmitAll}
              disabled={loading}
            >
              {loading ? "提交并评估中..." : "全卷提交并评估"}
            </Button>
          ) : (
            <div className="text-gray-500 font-medium text-sm mt-2 animate-pulse flex items-center justify-end gap-2 pr-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              自动保存中
            </div>
          )}
        </div>
      )}
    </div>
  );
}
