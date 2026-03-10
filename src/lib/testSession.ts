/**
 * 考试进度管理工具 (Test Session Management)
 * 作用：利用浏览器的本地存储 (localStorage) 功能，防止用户刷新页面导致写的答案丢失。
 */

type StoredAnswerValue = string | string[];

// 定义一个“题目状态”的数据结构
export interface StoredUnitState {
  answers: Record<string, StoredAnswerValue>; // 用户的答案，比如 {"Q1": "A", "Q2": ["B", "C"]}
  reqIds: string[]; // 用于标识题目的 ID 列表
  category: string; // 题目类型，如 Reading, Listening
  timeSpent: number; // 用户在这个单元上花掉的时间（秒）
}

// 默认的空状态
export const EMPTY_UNIT_STATE: StoredUnitState = {
  answers: {},
  reqIds: [],
  category: "",
  timeSpent: 0,
};

/**
 * 安全解析 JSON 字符串
 * 小白理解：就像开盲盒，如果里面是坏的或者是空的，就返回一个默认值，防止程序崩溃。
 */
function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * 保存单元测试进度到浏览器
 * 作用：每当用户填了一个空或点了一个选项，就调用它存到硬盘里。
 */
export const saveUnitState = (
  unitId: string,
  category: string,
  reqIds: string[],
  answers: Record<string, StoredAnswerValue>,
  timeSpent: number,
) => {
  if (typeof window === "undefined") return; // 只有在浏览器里才能运行
  localStorage.setItem(`linguo_ans_${unitId}`, JSON.stringify(answers));
  localStorage.setItem(`linguo_req_${unitId}`, JSON.stringify(reqIds));
  localStorage.setItem(`linguo_cat_${unitId}`, category);
  localStorage.setItem(`linguo_time_${unitId}`, timeSpent.toString());
};

/**
 * 从浏览器读取单元测试进度
 * 作用：当用户重新打开或刷新该页面时，把存好的答案“变”回来。
 */
export const getUnitState = (unitId: string): StoredUnitState => {
  if (typeof window === "undefined") {
    return EMPTY_UNIT_STATE;
  }

  return {
    answers: safeParse<Record<string, StoredAnswerValue>>(
      localStorage.getItem(`linguo_ans_${unitId}`),
      {},
    ),
    reqIds: safeParse<string[]>(
      localStorage.getItem(`linguo_req_${unitId}`),
      [],
    ),
    category: localStorage.getItem(`linguo_cat_${unitId}`) || "",
    timeSpent: parseInt(
      localStorage.getItem(`linguo_time_${unitId}`) || "0",
      10,
    ),
  };
};

/**
 * 清除单元测试进度
 * 作用：当用户正式点击“提交”后，清理这些临时记录，腾出空间。
 */
export const clearUnitState = (unitId: string) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`linguo_ans_${unitId}`);
  localStorage.removeItem(`linguo_req_${unitId}`);
  localStorage.removeItem(`linguo_cat_${unitId}`);
  localStorage.removeItem(`linguo_time_${unitId}`);
};
