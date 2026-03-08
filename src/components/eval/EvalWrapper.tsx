"use client";

import { useState, useEffect } from "react";
import ObjectiveRenderer from "./ObjectiveRenderer";
import SubjectiveRenderer from "./SubjectiveRenderer";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListIcon, ArrowRightIcon } from "lucide-react";
import { formatIELTSTitle } from "@/lib/utils";

/**
 * EvalWrapper Component
 *
 * This is the entry point for test evaluation. It receives a `QuestionUnit` (which contains
 * parsed JSON data from the database) and delegates the rendering to either Objective (Reading/Listening)
 * or Subjective (Writing/Speaking) components based on the unit category.
 *
 * It also handles global state like `submissionResult` that dictates whether the test is currently
 * being taken or whether the user is reviewing the AI/graded answers.
 */
export default function EvalWrapper({
  unit,
  siblings,
  flowSequence,
  allFlowIds = [],
}: {
  unit: any;
  siblings?: any[];
  flowSequence?: string;
  allFlowIds?: string[];
}) {
  const router = useRouter();

  /**
   * --- REVIEW MODE STATE ---
   * submissionResult stores the grading response from the server (scores, AI feedback).
   * If this state is populated, the child components (ObjectiveRenderer or SubjectiveRenderer)
   * will switch their UI to show correct answers and explanations instead of input fields.
   */
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Hydrate submissionResult from localStorage on mount.
  // This allows users to refresh the page after submitting without losing their results view.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRes = localStorage.getItem(`linguo_result_${unit.id}`);
      if (savedRes) {
        try {
          setSubmissionResult(JSON.parse(savedRes));
        } catch (e) {}
      } else {
        setSubmissionResult(null);
      }
    }
  }, [unit.id]);

  /**
   * handleGlobalResult
   * Callback fired by child renderers when a test is successfully submitted.
   * Persistence happens in localStorage for current session robustness.
   */
  const handleGlobalResult = (res: any, specificUnitId?: string) => {
    const targetId = specificUnitId || unit.id;
    if (typeof window !== "undefined") {
      localStorage.setItem(`linguo_result_${targetId}`, JSON.stringify(res));
    }
    if (targetId === unit.id) {
      setSubmissionResult(res);
    }
  };

  const isObjective = unit.category === "Reading/Listening";
  const isWriting = unit.category === "Writing";

  // Logic to determine part sequence for "Full Test" navigation
  const currentIndex = allFlowIds.indexOf(unit.id);
  const isLastPart =
    currentIndex === -1 || currentIndex === allFlowIds.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">{formatIELTSTitle(unit.title)}</h1>
          <p className="text-sm text-gray-500">Category: {unit.category}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to Dashboard
        </Button>
      </header>

      {/* Audio Player: Only visible if the unit has an audio URL (Listening tests) */}
      {unit.audioUrl && (
        <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center">
          <audio controls src={`/${unit.audioUrl}`} className="w-full max-w-md">
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/**
       * --- ROUTING TO SPECIALIZED RENDERERS ---
       * ObjectiveRenderer: Handles Multiple Choice, T/F/NG, and Fill-in-the-blanks.
       * SubjectiveRenderer: Handles Text Editor (Writing) or Audio Recording (Speaking).
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
          onResult={handleGlobalResult}
          result={submissionResult}
          isLastPart={isLastPart}
          allFlowIds={allFlowIds}
        />
      )}

      {/**
       * --- BOTTOM NAVIGATION BAR ---
       * Provides quick navigation between siblings (e.g. Passage 1 -> Passage 2).
       * In "Flow Mode" (Simulated Exams), it also shows a button to proceed
       * to the next section only AFTER the current one is submitted.
       */}
      {((siblings && siblings.length > 1) ||
        (submissionResult && flowSequence !== undefined)) && (
        <div className="fixed bottom-0 left-0 w-full h-16 bg-[#ebf0f7] border-t border-gray-300 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex items-center justify-center z-50">
          <div className="flex items-center justify-between w-full max-w-[1600px] px-8">
            {/* Slot for dynamically injected component (like the question dot-nav in Objective Mode) */}
            <div
              className="flex gap-2 items-center w-full"
              id="footer-left-slot"
            />

            {siblings && siblings.length > 1 && (
              <div className="flex gap-2 items-center">
                {siblings.map((sib, i) => {
                  const isActive = sib.id === unit.id;
                  const formattedTitle = formatIELTSTitle(sib.title);

                  // Formatting labels for parts/passages
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
                          ? `/eval/${sib.id}?flow=${flowSequence}`
                          : `/eval/${sib.id}`
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

            {/* If test submitted, show action to go to next module or exit to results */}
            {submissionResult && (
              <div className="flex items-center ml-auto pl-4 border-l border-gray-300">
                {flowSequence ? (
                  <Link
                    href={`/eval/${flowSequence.split(",")[0]}?flow=${flowSequence.split(",").slice(1).join(",")}`}
                  >
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md h-10 px-6">
                      继续进入下一模块 ({flowSequence.split(",").length}{" "}
                      pending) <ArrowRightIcon className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/dashboard/analytics">
                    <Button className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md h-10 px-6">
                      结束模考查看报告{" "}
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
