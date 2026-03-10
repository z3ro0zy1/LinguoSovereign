/**
 * 口语 AI 交互组件 (Speaking AI Renderer)
 * 作用：这是一个前端界面，集成了语音识别 (STT) 和 语音合成 (TTS)。
 * 用户每说一句话，它会把录音转成文字，发给 AI，再把 AI 的文字回复念出来。
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import parse from "html-react-parser"; // 用于把数据库里的 HTML 字符串渲染成 React 元素
import { LoaderCircle, Mic, MicOff, Sparkles, Volume2 } from "lucide-react"; // 图标库
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { imageFixingOptions } from "./objective/shared";

// --- 浏览器语音识别 API 的类型定义 (可以理解为“说明书”) ---
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

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

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

// 让 TypeScript 知道浏览器全局环境下可能有这些语音 API
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeakingQuestion = {
  id: string;
  stem?: string;
};

type SpeakingUnit = {
  id: string;
  title: string;
  questions: SpeakingQuestion[];
};

type ChatTurn = {
  role: "assistant" | "user";
  text: string;
};

export function SpeakingAiRenderer({ unit }: { unit: SpeakingUnit }) {
  // --- 状态管理 (States) ---
  const questions = unit.questions ?? [];
  const [currentStep, setCurrentStep] = useState(0); // 当前处于第几个口语部分 (Part 1/2/3)
  const [conversation, setConversation] = useState<ChatTurn[]>([]); // 对话历史记录
  const [active, setActive] = useState(false); // 对话是否已经开始
  const [listening, setListening] = useState(false); // 麦克风是否正在监听
  const [thinking, setThinking] = useState(false); // AI 是否正在思考回复
  const [error, setError] = useState(""); // 错误信息
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null); // 保存浏览器语音识别对象的引用
  const activeRef = useRef(false); // 用 ref 同步“激活状态”，防止回调里的闭包旧值问题
  const conversationRef = useRef<ChatTurn[]>([]); // 同上

  const currentQuestion = questions[currentStep];

  // 缓存渲染后的题目内容
  const currentPromptText = useMemo(() => {
    return currentQuestion?.stem
      ? parse(currentQuestion.stem, imageFixingOptions)
      : null;
  }, [currentQuestion]);

  // 同步 Refs 和 States
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  /**
   * 启动麦克风监听 (Start Listening)
   * 作用：让浏览器开始录音并识别你的话。
   */
  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("当前浏览器不支持实时语音识别。请使用 Chrome 或 Edge。");
      return;
    }

    setError("");
    recognition.start(); // 开启录音
    setListening(true);
  }, []);

  /**
   * 语音朗读 AI 的回复 (Speak AI Reply)
   * 作用：使用浏览器的文本转语音 (TTS) 功能，把文字念出来。
   */
  const speakReply = useCallback(
    (text: string) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US"; // 设置为美式英语
      utterance.rate = 1; // 语速正常

      // 当念完之后，如果对话还在继续，就自动开启麦克风听用户说
      utterance.onend = () => {
        if (activeRef.current) {
          startListening();
        }
      };

      utterance.onerror = () => {
        if (activeRef.current) {
          startListening();
        }
      };

      window.speechSynthesis.cancel(); // 停止目前正在念的话
      window.speechSynthesis.speak(utterance); // 开始念新话
    },
    [startListening],
  );

  /**
   * 向服务器索要 AI 回复 (Request AI Reply)
   * 作用：把用户说的话发给后端 API，拿到考官（AI）的下个追问。
   */
  const requestAiReply = useCallback(
    async (userMessage: string) => {
      setThinking(true);
      setError("");

      try {
        const response = await fetch("/api/speaking/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId: unit.id,
            history: conversationRef.current, // 把历史记录也带上，AI 就知道之前聊过什么
            userMessage,
          }),
        });

        const json = (await response.json()) as {
          data?: { reply?: string };
          error?: string;
          details?: string;
        };

        const reply = json.data?.reply;
        if (!response.ok || !reply) {
          throw new Error(json.details || json.error || "AI 对话失败");
        }

        // 记录 AI 的回复
        setConversation((previous) => [
          ...previous,
          { role: "assistant", text: reply },
        ]);
        // 让浏览器念出来
        speakReply(reply);
      } catch (requestError) {
        console.error(requestError);
        setError(
          requestError instanceof Error ? requestError.message : "AI 对话失败",
        );
        setActive(false);
        activeRef.current = false;
        setListening(false);
      } finally {
        setThinking(false);
      }
    },
    [speakReply, unit.id],
  );

  /**
   * 初始化语音识别功能 (Initialization)
   * 作用：在组件加载时，准备好浏览器的语音马达。
   */
  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false; // 雅思是一句一回，所以不需要一直录
    recognition.interimResults = false; // 只需要最终结果，不需要中间过程
    recognition.lang = "en-US"; // 识别英语
    recognitionRef.current = recognition;

    // 当浏览器听清楚了你说了什么
    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const resultItem = event.results[i];
        if (resultItem?.isFinal) {
          finalTranscript += resultItem[0].transcript;
        }
      }

      const cleaned = finalTranscript.trim();
      if (!cleaned) return;

      // 1. 把你说的话显示在屏幕上
      setConversation((previous) => [
        ...previous,
        { role: "user", text: cleaned },
      ]);
      // 2. 发给 AI 问考官怎么接
      void requestAiReply(cleaned);
    };

    recognition.onerror = (event) => {
      console.error("Speaking AI speech error", event);
      setListening(false);
      if (activeRef.current) {
        setError("语音识别失败。请检查麦克风权限，或改用 Chrome / Edge。");
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    return () => {
      recognition.stop();
      recognitionRef.current = null;
      window.speechSynthesis.cancel();
    };
  }, [currentStep, requestAiReply]);

  /**
   * 启动对话 (Start)
   */
  const startConversation = async () => {
    setActive(true);
    activeRef.current = true;
    setError("");

    // AI 考官的第一句开场白
    const opening =
      "Hello. I’m your IELTS speaking examiner. Let’s begin. Please answer the first question naturally.";
    setConversation([{ role: "assistant", text: opening }]);
    speakReply(opening);
  };

  /**
   * 停止对话 (Stop)
   */
  const stopConversation = () => {
    activeRef.current = false;
    setActive(false);
    setListening(false);
    setThinking(false);
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部进度条 */}
      {questions.length > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 backdrop-blur-sm">
          <span>
            Part {currentStep + 1} / {questions.length}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => step - 1)}
            >
              上一题
            </Button>
            <Button
              variant="ghost"
              disabled={currentStep === questions.length - 1}
              onClick={() => setCurrentStep((step) => step + 1)}
            >
              下一题
            </Button>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
        {/* 左侧：题目展示区域 */}
        <Card className="min-h-[560px] overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <CardContent className="p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  Prompt Surface
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  AI 对话题卡
                </h2>
              </div>
              <div className="rounded-full border border-fuchsia-100 bg-fuchsia-50 px-4 py-1.5 text-xs font-bold text-fuchsia-700">
                实时模拟模考
              </div>
            </div>
            <div className="prose max-w-none break-words text-[15px] leading-relaxed text-slate-700">
              {currentPromptText}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：AI 考官对话区域 */}
        <Card className="rounded-[2rem] border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 shadow-[0_25px_70px_rgba(168,85,247,0.12)]">
          <CardContent className="flex h-full flex-col gap-5 p-8 lg:p-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/70 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-500">
                  AI Speaking Mode
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">
                  像真人考官一样连续对话
                </h3>
              </div>
              {/* 状态指示器 */}
              <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
                {thinking ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : listening ? (
                  <Mic className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Volume2 className="h-4 w-4 text-fuchsia-600" />
                )}
                {thinking
                  ? "AI 思考中"
                  : listening
                    ? "正在听你说"
                    : active
                      ? "AI 正在陪练"
                      : "待开始"}
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex flex-wrap gap-3">
              {!active ? (
                <Button
                  className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
                  onClick={() => void startConversation()}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> 开启 AI 对话
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-full px-6"
                  onClick={stopConversation}
                >
                  <MicOff className="mr-2 h-4 w-4" /> 结束本轮对话
                </Button>
              )}
              {active && !listening && !thinking && (
                <Button
                  variant="secondary"
                  className="rounded-full px-6"
                  onClick={startListening}
                >
                  <Mic className="mr-2 h-4 w-4" /> 轮到我回答
                </Button>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 text-sm leading-7 text-slate-600 shadow-sm">
              AI 模式会模拟 IELTS 口语考官：你说一句，AI
              会接一句，并通过浏览器语音播放回复。更适合做实时口语陪练，而不是直接判分。
            </div>

            {/* 对话气泡列表 */}
            <div className="flex-1 space-y-3 overflow-y-auto rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
              {conversation.length ? (
                conversation.map((turn, index) => (
                  <div
                    key={`${turn.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 ${turn.role === "assistant" ? "bg-fuchsia-50 text-slate-800" : "bg-slate-100 text-slate-900"}`}
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {turn.role === "assistant" ? "AI Examiner" : "You"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-7">
                      {turn.text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                  点击“开启 AI
                  对话”后，系统会先以考官身份开场，然后你可以直接用麦克风回答。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
