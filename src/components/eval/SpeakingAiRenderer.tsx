"use client";

/**
 * SpeakingAiRenderer
 * ------------------
 * 口语“自由对话”模式的前端总控组件。
 *
 * 当前版本已经不再依赖：
 * - 浏览器 SpeechRecognition 做输入转录
 * - 浏览器 speechSynthesis 做文本朗读
 *
 * 而是改成真正的 Gemini Live 原生语音链路：
 * 1. 前端向我方后端请求 ephemeral token
 * 2. 浏览器用 token 直连 Gemini Live
 * 3. 麦克风 PCM 音频实时送入模型
 * 4. 模型返回原生音频块 + 输入/输出转录
 * 5. 页面一边播放模型声音，一边把转录同步到对话记录
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import parse from "html-react-parser";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  ChevronDown,
  LoaderCircle,
  Mic,
  MicOff,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { imageFixingOptions } from "./objective/shared";
import { useLocale } from "@/components/LocaleProvider";

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

type PromptRecord = {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
};

type LiveTokenResponse = {
  token: string;
  model: string;
};

type LiveSession = Awaited<ReturnType<GoogleGenAI["live"]["connect"]>>;

function encodePcm16ToBase64(samples: Int16Array) {
  let binary = "";
  const bytes = new Uint8Array(samples.buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }

  return window.btoa(binary);
}

function decodeBase64ToPcm16(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Live API 语音输入要求是 16kHz PCM16。
 * 浏览器麦克风通常是 44.1kHz / 48kHz，所以这里做一次轻量重采样。
 */
function downsampleTo16k(buffer: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === 16000) {
    return buffer;
  }

  const sampleRateRatio = inputSampleRate / 16000;
  const outputLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(outputLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (
      let i = offsetBuffer;
      i < nextOffsetBuffer && i < buffer.length;
      i += 1
    ) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function float32ToPcm16(float32: Float32Array) {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm16;
}

function pcm16ToFloat32(pcm16: Int16Array) {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i += 1) {
    float32[i] = pcm16[i] / 0x8000;
  }
  return float32;
}

function buildConversationResumePrompt(conversation: ChatTurn[]) {
  return conversation
    .map((turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.text}`)
    .join("\n");
}

/**
 * Gemini Live 的转录事件在不同阶段可能表现为：
 * 1. 逐步扩展后的完整文本
 * 2. 只包含本次新增的增量片段
 *
 * 这里做一个保守合并：
 * - 如果新文本已经包含旧文本，直接用新文本
 * - 如果旧文本已经包含新文本，保持旧文本
 * - 其他情况按增量拼接
 */
function mergeTranscriptChunk(previous: string, incoming: string) {
  const prev = previous.trim();
  const next = incoming.trim();

  if (!next) return previous;
  if (!prev) return next;
  if (next.startsWith(prev)) return next;
  if (prev.includes(next)) return previous;

  const needsSpace =
    !prev.endsWith(" ") &&
    !next.startsWith(" ") &&
    /[A-Za-z0-9]$/.test(prev) &&
    /^[A-Za-z0-9]/.test(next);

  return `${previous}${needsSpace ? " " : ""}${incoming}`;
}

export function SpeakingAiRenderer({ unit }: { unit: SpeakingUnit }) {
  const { t } = useLocale();
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [promptName, setPromptName] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [defaultPromptContent, setDefaultPromptContent] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const sessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const microphoneProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const playbackCursorRef = useRef(0);
  const pendingPlaybackCountRef = useRef(0);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const conversationRef = useRef<ChatTurn[]>([]);
  const shouldResumeListeningAfterPlaybackRef = useRef(false);
  const initialGreetingPendingRef = useRef(false);
  const currentInputTranscriptRef = useRef("");
  const currentOutputTranscriptRef = useRef("");

  const currentPromptText = useMemo(() => {
    return unit.questions.map((question, index) => (
      <div
        key={question.id}
        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Part {index + 1}
        </p>
        <div className="prose max-w-none break-words text-[15px] leading-relaxed text-slate-700">
          {parse(question.stem || "", imageFixingOptions)}
        </div>
      </div>
    ));
  }, [unit.questions]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  /**
   * 整个 Live 语音链路只维护一个 AudioContext：
   * - 麦克风输入要经过它做采样读取
   * - 模型返回的 PCM 音频也要通过它排队播放
   * 这样不会反复创建/销毁音频图，时延和资源占用都更稳定。
   */
  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") {
      throw new Error(t("audioPlaybackUnsupported"));
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, [t]);

  /**
   * 停掉当前麦克风采集，但不清除页面上的对话记录。
   * 这是“停止对话后保留内容”的关键：只关音频流，不清状态。
   */
  const stopListening = useCallback(() => {
    microphoneProcessorRef.current?.disconnect();
    microphoneSourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());

    microphoneProcessorRef.current = null;
    microphoneSourceRef.current = null;
    microphoneStreamRef.current = null;
    silentGainRef.current = null;
    listeningRef.current = false;
    setListening(false);
  }, []);

  /**
   * Gemini Live 在模型说话结束后，需要重新打开本地麦克风，进入下一轮用户输入。
   * 这里额外做了两个保护：
   * 1. 还有音频片段没播放完时，不要提前开麦，避免回声串进模型。
   * 2. 用户已经主动停止会话时，不要自动恢复录音。
   */
  const tryResumeListeningAfterPlayback = useCallback(async () => {
    if (
      !activeRef.current ||
      listeningRef.current ||
      !shouldResumeListeningAfterPlaybackRef.current ||
      pendingPlaybackCountRef.current > 0
    ) {
      return;
    }

    shouldResumeListeningAfterPlaybackRef.current = false;

    try {
      const context = await ensureAudioContext();
      const session = sessionRef.current;
      if (!session) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (!activeRef.current || !sessionRef.current) return;

        const channel = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(channel, context.sampleRate);
        const pcm16 = float32ToPcm16(downsampled);

        session.sendRealtimeInput({
          audio: {
            data: encodePcm16ToBase64(pcm16),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      microphoneStreamRef.current = stream;
      microphoneSourceRef.current = source;
      microphoneProcessorRef.current = processor;
      silentGainRef.current = silentGain;
      listeningRef.current = true;
      setListening(true);
      setThinking(false);
    } catch (startError) {
      console.error(startError);
      setError(
        startError instanceof Error
          ? startError.message
          : t("speechRecognitionFailed"),
      );
      setListening(false);
    }
  }, [ensureAudioContext, t]);

  /**
   * Live API 返回的是 24kHz PCM16 原始音频块，不是浏览器可直接播放的 mp3/wav。
   * 所以这里要手动把 base64 PCM 转成 AudioBuffer，再按时间轴顺序排队播放。
   */
  const enqueueAudioChunk = useCallback(
    async (base64Audio: string) => {
      const context = await ensureAudioContext();
      const pcm16 = decodeBase64ToPcm16(base64Audio);
      const float32 = pcm16ToFloat32(pcm16);
      const audioBuffer = context.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime, playbackCursorRef.current);
      playbackCursorRef.current = startAt + audioBuffer.duration;
      pendingPlaybackCountRef.current += 1;

      source.onended = () => {
        pendingPlaybackCountRef.current = Math.max(
          0,
          pendingPlaybackCountRef.current - 1,
        );
        void tryResumeListeningAfterPlayback();
      };

      source.start(startAt);
    },
    [ensureAudioContext, tryResumeListeningAfterPlayback],
  );

  /**
   * Live 转录是“逐步刷新”的：
   * - 同一轮里，转录文本会不断变长
   * - 所以不能每来一段就 append 一条新消息
   * 这里用“如果最后一条还是同角色就覆盖，否则新建”的方式稳定更新气泡。
   */
  const upsertConversationTurn = useCallback(
    (role: ChatTurn["role"], text: string) => {
      if (!text.trim()) return;

      setConversation((previous) => {
        const next = [...previous];
        const last = next[next.length - 1];

        if (last?.role === role) {
          next[next.length - 1] = { ...last, text };
          return next;
        }

        return [...next, { role, text }];
      });
    },
    [],
  );

  /**
   * 完整关闭一轮 Live 会话：
   * - 关 SDK session
   * - 关麦克风
   * - 清空播放排队状态
   * 但不清除 conversation，本页内仍然保留历史文本。
   */
  const closeLiveSession = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    stopListening();
    shouldResumeListeningAfterPlaybackRef.current = false;
    initialGreetingPendingRef.current = false;
    currentInputTranscriptRef.current = "";
    currentOutputTranscriptRef.current = "";
    pendingPlaybackCountRef.current = 0;
    playbackCursorRef.current = 0;
  }, [stopListening]);

  useEffect(() => {
    let cancelled = false;

    // 自由对话模式有自己独立的 prompt，用 purpose=free_chat 取默认模板。
    const loadPrompt = async () => {
      setPromptLoading(true);
      try {
        const response = await fetch(
          "/api/prompts?category=Speaking&purpose=free_chat",
        );
        const json = (await response.json()) as { data?: PromptRecord[] };

        if (!response.ok) {
          throw new Error("prompt-load-failed");
        }

        const selected = json.data?.[0];
        if (cancelled) return;
        setPromptId(selected?.id || null);
        setPromptName(selected?.name || t("promptFallbackName"));
        setPromptContent(selected?.content || "");
        setDefaultPromptContent(selected?.content || "");
      } catch (loadError) {
        if (cancelled) return;
        console.error(loadError);
        setPromptId(null);
        setPromptName(t("promptFallbackName"));
        setPromptContent("");
        setDefaultPromptContent("");
        setError(t("promptLoadFailed"));
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
  }, [t]);

  /**
   * 建立 Gemini Live 会话的完整步骤：
   * 1. 请求后端签发 ephemeral token
   * 2. 前端用这个短期 token 直连 Gemini Live
   * 3. 注册消息回调，处理输入转录、输出转录、原生音频块
     * 4. 根据是否已有历史对话，决定是恢复上下文还是请求一段开场白
     *
     * 注意：
     * gemini-3.1-flash-live-preview 对 sendClientContent 的支持更偏“初始历史注入”场景，
     * 如果没有额外 history 配置，直接拿它做首轮开场很容易报 invalid argument。
     * 所以这里统一改成 sendRealtimeInput({ text })，让模型像处理普通实时输入一样开口。
     */
  const connectLiveSession = useCallback(async () => {
    setError("");
    setThinking(true);

    const tokenResponse = await fetch("/api/speaking/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: unit.id,
        promptId,
        promptContent,
      }),
    });

    const tokenJson = (await tokenResponse.json()) as
      | LiveTokenResponse
      | { error?: string; details?: string };

    if (!tokenResponse.ok || !("token" in tokenJson)) {
      throw new Error(
        ("details" in tokenJson && tokenJson.details) ||
          ("error" in tokenJson && tokenJson.error) ||
          t("aiConversationFailed"),
      );
    }

    const ai = new GoogleGenAI({
      apiKey: tokenJson.token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const nextSession = await ai.live.connect({
      model: tokenJson.model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          setActive(true);
          activeRef.current = true;
        },
        onmessage: (message) => {
          // Live 会话里服务端消息是多模态混合的：
          // 既可能带输入转录，也可能带输出转录，还可能带原始音频块。
          const serverContent = message.serverContent;
          if (!serverContent) return;

          if (serverContent.inputTranscription?.text) {
            currentInputTranscriptRef.current = mergeTranscriptChunk(
              currentInputTranscriptRef.current,
              serverContent.inputTranscription.text,
            );
            upsertConversationTurn("user", currentInputTranscriptRef.current);
          }

          if (serverContent.outputTranscription?.text) {
            stopListening();
            setThinking(true);
            currentOutputTranscriptRef.current = mergeTranscriptChunk(
              currentOutputTranscriptRef.current,
              serverContent.outputTranscription.text,
            );
            upsertConversationTurn(
              "assistant",
              currentOutputTranscriptRef.current,
            );
          }

          if (serverContent.modelTurn?.parts) {
            stopListening();
            setThinking(true);
            shouldResumeListeningAfterPlaybackRef.current = true;

            for (const part of serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                void enqueueAudioChunk(part.inlineData.data);
              }
            }
          }

          if (serverContent.turnComplete) {
            setThinking(false);
            currentInputTranscriptRef.current = "";
            currentOutputTranscriptRef.current = "";

            if (initialGreetingPendingRef.current) {
              initialGreetingPendingRef.current = false;
              shouldResumeListeningAfterPlaybackRef.current = true;
            }

            void tryResumeListeningAfterPlayback();
          }
        },
        onerror: (liveError) => {
          console.error("Gemini Live error", liveError);
          setError(liveError.message || t("aiConversationFailed"));
          setThinking(false);
          setActive(false);
          activeRef.current = false;
          closeLiveSession();
        },
        onclose: (closeEvent) => {
          setThinking(false);
          setListening(false);
          setActive(false);
          activeRef.current = false;

          if (
            closeEvent.reason &&
            closeEvent.reason !== "Connection closed." &&
            closeEvent.reason !== "Normal Closure"
          ) {
            setError(closeEvent.reason);
          }
        },
      },
    });

    sessionRef.current = nextSession;

    /**
     * 重新进入当前页面内的同一轮会话时，把已有对话压成一段文本上下文发回模型。
     * 这不是服务端持久化恢复，只是“本页内停止后继续”的轻量恢复。
     */
    if (conversationRef.current.length > 0) {
      nextSession.sendRealtimeInput({
        text:
          `Resume the conversation naturally from this transcript.\n\n${buildConversationResumePrompt(
            conversationRef.current,
          )}\n\nReply with one concise continuation in the user's most recent language.`,
      });
      shouldResumeListeningAfterPlaybackRef.current = true;
      return;
    }

    initialGreetingPendingRef.current = true;
    nextSession.sendRealtimeInput({
      text:
        "Open the session with a brief warm greeting in the user's likely language and invite them to start speaking naturally.",
    });
  }, [
    closeLiveSession,
    enqueueAudioChunk,
    promptContent,
    promptId,
    stopListening,
    t,
    tryResumeListeningAfterPlayback,
    upsertConversationTurn,
    unit.id,
  ]);

  const startConversation = useCallback(async () => {
    try {
      await ensureAudioContext();
      await connectLiveSession();
    } catch (startError) {
      console.error(startError);
      setError(
        startError instanceof Error ? startError.message : t("aiConversationFailed"),
      );
      setThinking(false);
      setActive(false);
      activeRef.current = false;
      closeLiveSession();
    }
  }, [closeLiveSession, connectLiveSession, ensureAudioContext, t]);

  const stopConversation = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    setThinking(false);
    closeLiveSession();
  }, [closeLiveSession]);

  useEffect(() => {
    return () => {
      closeLiveSession();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [closeLiveSession]);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]">
        <Card className="min-h-[560px] overflow-hidden rounded-[2rem] border-white/60 bg-white/80 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <CardContent className="p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  {t("promptSurface")}
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-900">
                  {t("freeConversationTitle")}
                </h2>
              </div>
              <div className="rounded-full border border-fuchsia-100 bg-fuchsia-50 px-4 py-1.5 text-xs font-bold text-fuchsia-700">
                {t("freeConversationBadge")}
              </div>
            </div>
            <div className="space-y-4">{currentPromptText}</div>
          </CardContent>
        </Card>

        <div className="flex h-full flex-col gap-4">
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
                  <p className="mt-3 text-sm leading-7 text-slate-600">
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

          <Card className="rounded-[2rem] border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 shadow-[0_25px_70px_rgba(168,85,247,0.12)]">
            <CardContent className="flex h-full flex-col gap-5 p-8 lg:p-10">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/70 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-500">
                    {t("speakingFreeChatMode")}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">
                    {t("speakingLikeExaminer")}
                  </h3>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
                  {thinking ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : listening ? (
                    <Mic className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-fuchsia-600" />
                  )}
                  {thinking
                    ? t("streamingReply")
                    : listening
                      ? t("listeningToYou")
                      : active
                        ? t("aiCoaching")
                        : t("readyToStart")}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!active ? (
                  <Button
                    className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
                    onClick={() => void startConversation()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> {t("startAiConversation")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={stopConversation}
                  >
                    <MicOff className="mr-2 h-4 w-4" /> {t("endConversation")}
                  </Button>
                )}
                {active && !listening && !thinking ? (
                  <Button
                    variant="secondary"
                    className="rounded-full px-6"
                    onClick={() => void tryResumeListeningAfterPlayback()}
                  >
                    <Mic className="mr-2 h-4 w-4" /> {t("myTurn")}
                  </Button>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 text-sm leading-7 text-slate-600 shadow-sm">
                {t("aiSpeakingHint")}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-sm">
                {conversation.length ? (
                  conversation.map((turn, index) => (
                    <div
                      key={`${turn.role}-${index}`}
                      className={`rounded-2xl px-4 py-3 ${
                        turn.role === "assistant"
                          ? "bg-fuchsia-50 text-slate-800"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        {turn.role === "assistant" ? "AI Examiner" : "You"}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-7">
                        {turn.text || (thinking && turn.role === "assistant" ? "..." : "")}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                    {t("clickToStartAi")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
