type StoredAnswerValue = string | string[];

export interface StoredUnitState {
  answers: Record<string, StoredAnswerValue>;
  reqIds: string[];
  category: string;
  timeSpent: number;
}

export const EMPTY_UNIT_STATE: StoredUnitState = {
  answers: {},
  reqIds: [],
  category: "",
  timeSpent: 0,
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const saveUnitState = (
  unitId: string,
  category: string,
  reqIds: string[],
  answers: Record<string, StoredAnswerValue>,
  timeSpent: number,
) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`linguo_ans_${unitId}`, JSON.stringify(answers));
  localStorage.setItem(`linguo_req_${unitId}`, JSON.stringify(reqIds));
  localStorage.setItem(`linguo_cat_${unitId}`, category);
  localStorage.setItem(`linguo_time_${unitId}`, timeSpent.toString());
};

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

export const clearUnitState = (unitId: string) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`linguo_ans_${unitId}`);
  localStorage.removeItem(`linguo_req_${unitId}`);
  localStorage.removeItem(`linguo_cat_${unitId}`);
  localStorage.removeItem(`linguo_time_${unitId}`);
};
