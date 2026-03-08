import type { RefObject } from "react";
import { PauseCircle, PlayCircle, SkipBack, SkipForward, Volume2 } from "lucide-react";

export function ReviewAudioPlayer({
  audioRef,
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onVolumeChange,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  formatAudioTime,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onVolumeChange: (value: number) => void;
  onSeek: (nextTime: number) => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  formatAudioTime: (secs: number) => string;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-6 border-b border-slate-800 bg-slate-900 px-8 shadow-inner">
      <audio
        key={audioUrl}
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />
      <div className="flex items-center gap-4 text-slate-300">
        <button
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
          className="transition-colors hover:text-white"
          title="Rewind 10s"
        >
          <SkipBack className="h-5 w-5" />
        </button>
        <button
          onClick={onTogglePlay}
          disabled={!audioUrl}
          className="text-white transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <PauseCircle className="h-8 w-8" /> : <PlayCircle className="h-8 w-8" />}
        </button>
        <button
          onClick={() => onSeek(Math.min(duration, currentTime + 10))}
          className="transition-colors hover:text-white"
          title="Forward 10s"
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center gap-3 text-xs font-medium text-slate-400">
        <span className="w-10 text-right tabular-nums">{formatAudioTime(currentTime)}</span>
        <div
          className="group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-slate-700"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            onSeek(ratio * duration);
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-indigo-500 transition-colors group-hover:bg-indigo-400"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>
        <span className="w-10 tabular-nums">{formatAudioTime(duration)}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-400">
        <Volume2 className="h-4 w-4" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => onVolumeChange(Number.parseFloat(event.target.value))}
          className="w-20 accent-indigo-400"
        />
      </div>
    </div>
  );
}
