"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

export type HighlightMenuPosition = {
  x: number;
  y: number;
  show: boolean;
};

const HIDDEN_MENU_POSITION: HighlightMenuPosition = {
  x: 0,
  y: 0,
  show: false,
};

export function useObjectiveHighlighting(
  contentRef: RefObject<HTMLDivElement | null>,
) {
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [menuPos, setMenuPos] =
    useState<HighlightMenuPosition>(HIDDEN_MENU_POSITION);
  const [activeMark, setActiveMark] = useState<HTMLElement | null>(null);
  const [clearMenuPos, setClearMenuPos] =
    useState<HighlightMenuPosition>(HIDDEN_MENU_POSITION);

  /**
   * 清除当前浏览器选区，并同步关闭“新划线”菜单。
   * 这类状态以前混在页面主组件里，现在收进 hook 内部，避免 ObjectiveRenderer
   * 被一组纯交互型状态牵着走。
   */
  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setMenuPos(HIDDEN_MENU_POSITION);
    setSelectionRange(null);
  }, []);

  /**
   * 用户在文章区域松开鼠标后，检查当前选区是否合法。
   * 如果合法，就记录选区并计算浮动菜单位置。
   */
  const handleMouseUpContent = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setMenuPos((previous) => ({ ...previous, show: false }));
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
      return;
    }

    setMenuPos((previous) => ({ ...previous, show: false }));
  }, [contentRef]);

  /**
   * 把当前选区包裹成 `<mark>`，实现真正的高亮。
   * DOM 直改仍然保留，但现在被限制在独立 hook 里，主页面不再直接操作这些细节。
   */
  const applyHighlight = useCallback(
    (colorClass: string) => {
      if (!selectionRange) return;

      const span = document.createElement("mark");
      span.className = `${colorClass} px-1 rounded transition-colors cursor-pointer group relative`;

      try {
        selectionRange.surroundContents(span);
        span.onclick = (event) => {
          event.stopPropagation();
          const rect = span.getBoundingClientRect();
          setActiveMark(span);
          setClearMenuPos({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            show: true,
          });
          setMenuPos(HIDDEN_MENU_POSITION);
        };
      } catch {
        console.warn("DOM 结构过于复杂，无法包裹。");
        alert("请在单个段落内进行划词高亮。");
      }

      clearSelection();
    },
    [clearSelection, selectionRange],
  );

  /**
   * 清掉已经存在的 `<mark>`，把文字节点还原回原父级。
   */
  const handleClearMark = useCallback(() => {
    if (!activeMark) return;

    const parent = activeMark.parentNode;
    while (activeMark.firstChild) {
      if (parent) {
        parent.insertBefore(activeMark.firstChild, activeMark);
      }
    }

    if (parent) {
      parent.removeChild(activeMark);
    }

    setActiveMark(null);
    setClearMenuPos(HIDDEN_MENU_POSITION);
  }, [activeMark]);

  /**
   * 文档级点击收口逻辑：
   * - 如果当前浏览器已无选区，关闭“新划线”菜单
   * - 如果点击发生在高亮 mark 和清除菜单之外，关闭“清除高亮”菜单
   *
   * 这类订阅以前直接挂在 ObjectiveRenderer 里，现在由 hook 自己管理生命周期。
   */
  useEffect(() => {
    const handleDocClick = (event: MouseEvent) => {
      const selection = window.getSelection();
      if (menuPos.show && (!selection || selection.isCollapsed)) {
        setMenuPos(HIDDEN_MENU_POSITION);
      }

      const menuDOM = document.getElementById("clear-highlight-menu");
      if (
        clearMenuPos.show &&
        activeMark &&
        !activeMark.contains(event.target as Node) &&
        (!menuDOM || !menuDOM.contains(event.target as Node))
      ) {
        setClearMenuPos(HIDDEN_MENU_POSITION);
        setActiveMark(null);
      }
    };

    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [activeMark, clearMenuPos.show, menuPos.show]);

  return {
    menuPos,
    clearMenuPos,
    clearSelection,
    handleMouseUpContent,
    applyHighlight,
    handleClearMark,
  };
}
