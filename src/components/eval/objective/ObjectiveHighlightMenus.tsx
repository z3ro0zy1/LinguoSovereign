"use client";

import { memo } from "react";
import { Eraser, Highlighter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HighlightMenuPosition } from "./useObjectiveHighlighting";

export const ObjectiveHighlightMenus = memo(function ObjectiveHighlightMenus({
  menuPos,
  clearMenuPos,
  onApplyHighlight,
  onClearSelection,
  onClearMark,
  blueHighlightLabel,
  yellowHighlightLabel,
  cancelLabel,
  clearLabel,
}: {
  menuPos: HighlightMenuPosition;
  clearMenuPos: HighlightMenuPosition;
  onApplyHighlight: (colorClass: string) => void;
  onClearSelection: () => void;
  onClearMark: () => void;
  blueHighlightLabel: string;
  yellowHighlightLabel: string;
  cancelLabel: string;
  clearLabel: string;
}) {
  /**
   * 高亮菜单本身只是纯展示层。
   * 它只接收坐标和事件回调，不再知道任何选区、DOM 包裹、文档点击等内部细节。
   * 这样后续如果想换成别的高亮 UI，不需要再碰主页面逻辑。
   */
  return (
    <>
      {menuPos.show ? (
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
            onClick={() => onApplyHighlight("bg-blue-200/70")}
          >
            <Highlighter className="w-4 h-4" /> <span>{blueHighlightLabel}</span>
          </Button>
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-xl font-semibold"
            onClick={() => onApplyHighlight("bg-yellow-200/70")}
          >
            <Highlighter className="w-4 h-4" /> <span>{yellowHighlightLabel}</span>
          </Button>
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-semibold"
            onClick={onClearSelection}
          >
            <Eraser className="w-4 h-4" /> <span>{cancelLabel}</span>
          </Button>
        </div>
      ) : null}

      {clearMenuPos.show ? (
        <div
          id="clear-highlight-menu"
          className="absolute z-50 transform -translate-x-1/2 -translate-y-full bg-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] rounded-xl border border-gray-200/50 p-1 flex items-center animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: clearMenuPos.x,
            top: clearMenuPos.y + window.scrollY,
            position: "fixed",
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-gray-200/50 rotate-45"></div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-bold"
            onClick={onClearMark}
          >
            <Eraser className="w-4 h-4" /> <span>{clearLabel}</span>
          </Button>
        </div>
      ) : null}
    </>
  );
});
