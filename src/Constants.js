import { EMBEDDED_GEMINI_KEY } from "./Firebase";


// ==========================================
// 가족 앱 공통 상수 · 기준표 · 초기 시드 데이터
// ==========================================


export const toSafeArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};


// ==========================================
// 2. 실시간 오늘 날짜 & D-Day 정밀 계산 유틸리티
// ==========================================
export const formatDate = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};


export const getTodayStr = () => formatDate(new Date());
export const getCurrentYearMonth = () => getTodayStr().slice(0, 7);


export const getIsoWeekKey = (dateStr = getTodayStr()) => {
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "2026-W47";
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};


export const ROUTINE_TIME_SLOTS = ["아침", "점심", "하원후", "오후", "저녁", "자기전", "상시"];
export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];


export const isHourInRange = (h, start, end) => {
  const s = ((Number(start) || 0) % 24 + 24) % 24;
  const e = ((Number(end) || 0) % 24 + 24) % 24;
  if (s === e) return false;
  if (s < e) return h >= s && h < e;
  return h >= s || h < e;
};


export const toTimeMinutes = (val, fallbackHour = 0) => {
  if (typeof val === "string" && val.includes(":")) {
    const [hh, mm] = val.split(":").map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return Math.max(0, Math.min(1439, hh * 60 + mm));
    }
  }
  const num = Number(val);
  if (Number.isFinite(num)) {
    if (num >= 0 && num <= 23) return num * 60;
    if (num >= 24 && num <= 1439) return num;
  }
  return fallbackHour * 60;
};


export const formatMinutesHHMM = (mins) => {
  const m = ((Number(mins) || 0) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};


export const isMinuteInRange = (curMin, startMin, endMin) => {
  const s = ((Number(startMin) || 0) % 1440 + 1440) % 1440;
  const e = ((Number(endMin) || 0) % 1440 + 1440) % 1440;
  if (s === e) return false;
  if (s < e) return curMin >= s && curMin < e;
  return curMin >= s || curMin < e;
};


export const DEFAULT_ROUTINE_TIME_RANGES = {
  아침: "05:00",
  점심: "11:00",
  하원후: "15:00",
  오후: "12:00",
  저녁: "18:00",
  자기전: "20:30"
};


export const DEFAULT_ROUTINE_SLOT_DEFS = [
  { id: "아침", label: "아침", startTime: "05:00", weekday: true, weekend: true },
  { id: "점심", label: "점심", startTime: "11:00", weekday: true, weekend: false },
  { id: "오후", label: "오후", startTime: "12:00", weekday: false, weekend: true },
  { id: "하원후", label: "하원후", startTime: "15:00", weekday: true, weekend: false },
  { id: "저녁", label: "저녁", startTime: "18:00", weekday: true, weekend: true },
  { id: "자기전", label: "자기전", startTime: "20:30", weekday: true, weekend: true }
];


export const normalizeRoutineSlotDefs = (rawList, fallbackRanges = DEFAULT_ROUTINE_TIME_RANGES) => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return DEFAULT_ROUTINE_SLOT_DEFS.map((s) => ({
      ...s,
      startTime: formatMinutesHHMM(toTimeMinutes(fallbackRanges?.[s.label] ?? s.startTime))
    }));
  }
  const seen = new Set();
  const out = [];
  rawList.forEach((item, idx) => {
    const label = String(item?.label || "").trim();
    if (!label || label === "상시" || seen.has(label)) return;
    seen.add(label);
    out.push({
      id: String(item?.id || label || `slot-${idx}`),
      label,
      startTime: formatMinutesHHMM(toTimeMinutes(item?.startTime ?? fallbackRanges?.[label] ?? "09:00")),
      weekday: item?.weekday !== false,
      weekend: item?.weekend !== false
    });
  });
  return out.length > 0 ? out : DEFAULT_ROUTINE_SLOT_DEFS;
};


export const ROUTINE_WEEKDAY_SLOTS = ["아침", "점심", "하원후", "저녁", "자기전"];
export const ROUTINE_WEEKEND_SLOTS = ["아침", "오후", "저녁", "자기전"];
export const ROUTINE_ORDERED_SLOTS = ["아침", "점심", "하원후", "오후", "저녁", "자기전"];


export const isWeekendNow = () => [0, 6].includes(new Date().getDay());


export const getCurrentRoutineTimeSlot = (ranges = DEFAULT_ROUTINE_TIME_RANGES, minuteOverride = null, slotDefs = null, forceDayOff = null) => {
  const now = new Date();
  const curMin = typeof minuteOverride === "number" ? minuteOverride : now.getHours() * 60 + now.getMinutes();
  const isWknd = typeof forceDayOff === "boolean" ? forceDayOff : [0, 6].includes(now.getDay());
  if (Array.isArray(slotDefs) && slotDefs.length > 0) {
    const active = slotDefs
      .filter((s) => (isWknd ? s.weekend : s.weekday))
      .sort((a, b) => toTimeMinutes(a.startTime) - toTimeMinutes(b.startTime));
    const list = active.length > 0 ? active : [...slotDefs].sort((a, b) => toTimeMinutes(a.startTime) - toTimeMinutes(b.startTime));
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const nxt = list[(i + 1) % list.length];
      if (isMinuteInRange(curMin, toTimeMinutes(s.startTime), toTimeMinutes(nxt.startTime))) return s.label;
    }
    return list[list.length - 1]?.label || "상시";
  }
  const slots = isWknd ? ROUTINE_WEEKEND_SLOTS : ROUTINE_WEEKDAY_SLOTS;
  const r = { ...DEFAULT_ROUTINE_TIME_RANGES, ...(ranges || {}) };
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const nextSlot = slots[(i + 1) % slots.length];
    const sMin = toTimeMinutes(r[slot], toTimeMinutes(DEFAULT_ROUTINE_TIME_RANGES[slot]) / 60);
    const eMin = toTimeMinutes(r[nextSlot], toTimeMinutes(DEFAULT_ROUTINE_TIME_RANGES[nextSlot]) / 60);
    if (isMinuteInRange(curMin, sMin, eMin)) return slot;
  }
  return "자기전";
};


export const matchesRoutineTarget = (rt, filter) => {
  if (!filter || filter === "전체") return true;
  const a = rt?.assignee || "공통";
  if (filter === "공통") return a === "공통";
  if (filter === "시목") return a === "시목" || a === "시목·시율";
  if (filter === "시율") return a === "시율" || a === "시목·시율";
  return a === filter;
};


export const getRoutineAssigneeBadgeCls = (assignee) => {
  const a = assignee || "공통";
  if (a === "시목") return "bg-sky-100 text-sky-800";
  if (a === "시율") return "bg-rose-100 text-rose-800";
  if (a === "시목·시율") return "bg-purple-100 text-purple-800";
  if (a === "공통") return "bg-emerald-100 text-emerald-800";
  return "bg-amber-100 text-amber-800";
};


export const parseRoutineSteps = (title) => {
  const raw = String(title || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s*(?:>|→|,)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : [];
};


export const DEFAULT_HOME_TIME_RANGES = {
  morningStart: 5,
  afternoonStart: 11,
  nightStart: 20
};


export const getAutoHomeTimeMode = (ranges = DEFAULT_HOME_TIME_RANGES, hourOverride = null) => {
  const h = typeof hourOverride === "number" ? hourOverride : new Date().getHours();
  const mS = ranges?.morningStart ?? 5;
  const aS = ranges?.afternoonStart ?? 11;
  const nS = ranges?.nightStart ?? 20;
  if (isHourInRange(h, mS, aS)) return "morning";
  if (isHourInRange(h, aS, nS)) return "afternoon";
  return "night";
};


export const DEFAULT_HOME_MENU_ORDER = [
  "daily",
  "routine_tab",
  "fridge",
  "shopping",
  "monthly_cal",
  "monthly_exp",
  "baby",
  "recipes",
  "notices",
  "pages",
  "bucket",
  "handover",
  "house",
  "ai"
];


export const DEFAULT_HOME_LAYOUT = {
  morning: {
    blocks: ["action_feed", "menu_grid"],
    hiddenBlocks: [],
    hiddenMenus: [],
    blockSizes: {},
    menuSizes: {},
    menuOrder: [...DEFAULT_HOME_MENU_ORDER]
  },
  afternoon: {
    blocks: ["menu_grid", "action_feed"],
    hiddenBlocks: [],
    hiddenMenus: [],
    blockSizes: {},
    menuSizes: {},
    menuOrder: ["daily", "fridge", "shopping", "ai", "routine_tab", "monthly_cal", "monthly_exp", "baby", "recipes", "notices", "pages", "bucket", "handover", "house"]
  },
  night: {
    blocks: ["action_feed", "menu_grid"],
    hiddenBlocks: [],
    hiddenMenus: [],
    blockSizes: {},
    menuSizes: {},
    menuOrder: ["daily", "monthly_exp", "routine_tab", "fridge", "shopping", "monthly_cal", "baby", "recipes", "notices", "pages", "bucket", "handover", "house", "ai"]
  }
};


export const getNthWeekdayDateStr = (year, month1Based, nthWeek, weekDay) => {
  const lastDay = new Date(year, month1Based, 0).getDate();
  if (Number(nthWeek) === -1) {
    for (let d = lastDay; d >= 1; d--) {
      if (new Date(year, month1Based - 1, d).getDay() === Number(weekDay)) {
        return `${year}-${String(month1Based).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(year, month1Based - 1, d).getDay() === Number(weekDay)) {
      count += 1;
      if (count === Number(nthWeek)) {
        return `${year}-${String(month1Based).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
  }
  return `${year}-${String(month1Based).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
};


export const getRoutineNextDateInfo = (rt, dayStr = getTodayStr()) => {
  if (!rt) return null;
  const base = new Date(String(dayStr).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(base.getTime())) return null;
  const fmt = (dObj) => {
    const mm = dObj.getMonth() + 1;
    const dd = dObj.getDate();
    const wk = WEEKDAY_KO[dObj.getDay()];
    return `${mm}/${dd}(${wk})`;
  };
  if (rt.cycle === "weekly" && rt.weekDay !== undefined && rt.weekDay !== null) {
    const targetDow = Number(rt.weekDay);
    const curDow = base.getDay();
    const delta = (targetDow - curDow + 7) % 7;
    const target = new Date(base);
    target.setDate(base.getDate() + delta);
    return { dateLabel: fmt(target), diff: delta };
  }
  if (rt.cycle === "monthly") {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const rawDay = Math.max(1, Number(rt.monthDay) || 1);
    const lastDay = new Date(y, m, 0).getDate();
    let target = new Date(y, m - 1, Math.min(rawDay, lastDay));
    let diff = Math.round((target - base) / 86400000);
    if (diff < 0) {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const nextLastDay = new Date(ny, nm, 0).getDate();
      target = new Date(ny, nm - 1, Math.min(rawDay, nextLastDay));
      diff = Math.round((target - base) / 86400000);
    }
    return { dateLabel: fmt(target), diff };
  }
  if (rt.cycle === "monthly_weekday") {
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const nth = Number(rt.nthWeek) || 1;
    const wd = Number(rt.weekDay ?? 6);
    let targetStr = getNthWeekdayDateStr(y, m, nth, wd);
    let target = new Date(targetStr + "T00:00:00");
    let diff = Math.round((target - base) / 86400000);
    if (diff < 0) {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      targetStr = getNthWeekdayDateStr(ny, nm, nth, wd);
      target = new Date(targetStr + "T00:00:00");
      diff = Math.round((target - base) / 86400000);
    }
    return { dateLabel: fmt(target), diff };
  }
  return null;
};


export const INITIAL_FAMILY_ROUTINES = [
  { id: "rt-1", title: "시목이 어린이집 가방·낮잠이불 챙기기", cycle: "daily", timeSlot: "아침", assignee: "공통", lastDoneKey: "" },
  { id: "rt-2", title: "젖병·유축기 열탕 및 소독", cycle: "daily", timeSlot: "저녁", assignee: "공통", lastDoneKey: "" },
  { id: "rt-3", title: "시목·시율 유산균 & 비타민D", cycle: "daily", timeSlot: "아침", assignee: "공통", lastDoneKey: "" },
  { id: "rt-4", title: "시목이 목욕하기", cycle: "interval", intervalDays: 2, timeSlot: "저녁", assignee: "공통", lastDoneKey: "" },
  { id: "rt-5", title: "재활용·음식물 분리수거", cycle: "weekly", weekDay: 2, timeSlot: "저녁", assignee: "수혁", lastDoneKey: "" }
];


export const getTwiceDailySlotKey = () => {
  const now = new Date();
  const half = now.getHours() < 12 ? "AM(오전)" : "PM(오후)";
  return `${formatDate(now)}_${half}`;
};


export const getDayName = (dateStr) => {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "일";
  return days[d.getDay()];
};


export const getDaysDiff = (expiryStr) => {
  if (!expiryStr) return 999;
  const today = new Date(getTodayStr() + "T00:00:00");
  const exp = new Date(String(expiryStr).slice(0, 10) + "T00:00:00");
  if (isNaN(exp.getTime())) return 999;
  return Math.round((exp - today) / (1000 * 60 * 60 * 24));
};


export const formatBabyAgeLabel = (birthDateStr, targetDateStr = getTodayStr()) => {
  const bStr = String(birthDateStr || "").slice(0, 10);
  const tStr = String(targetDateStr || getTodayStr()).slice(0, 10);
  const b = new Date(bStr + "T00:00:00");
  const t = new Date(tStr + "T00:00:00");
  if (isNaN(b.getTime()) || isNaN(t.getTime())) return "";
  const dPlus = Math.max(1, Math.round((t - b) / 86400000) + 1);
  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  let remDays = t.getDate() - b.getDate();
  if (remDays < 0) {
    months -= 1;
    const prevMonthLast = new Date(t.getFullYear(), t.getMonth(), 0).getDate();
    const prevAnnivDay = Math.min(b.getDate(), prevMonthLast);
    const prevAnniv = new Date(t.getFullYear(), t.getMonth() - 1, prevAnnivDay);
    remDays = Math.max(0, Math.round((t - prevAnniv) / 86400000));
  }
  if (months >= 12) {
    return `${months}개월 ${remDays}일`;
  }
  return `D+${dPlus.toLocaleString()}일`;
};


export const getDaysInMonth = (yearMonth) => {
  const [y, m] = String(yearMonth).split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
};


export const shiftYearMonth = (yearMonth, deltaMonths) => {
  const [y, m] = String(yearMonth).split("-").map(Number);
  const d = new Date(y || 2026, (m || 11) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};


// 특정 기준 날짜가 속한 주간(월~일) 7일 배열 반환
export const getWeekDatesFromBase = (baseDateStr) => {
  const base = new Date(String(baseDateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(base.getTime())) {
    const today = getTodayStr();
    return [today, today, today, today, today, today, today];
  }
  const day = base.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(base);
  mon.setDate(base.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return formatDate(d);
  });
};


export const calculateScheduleDday = (item) => {
  const todayStr = getTodayStr();
  const today = new Date(todayStr + "T00:00:00");
  const currentYear = today.getFullYear();


  const rawDate = String(item.date || todayStr).slice(0, 10);
  const [origYear, origMonth, origDay] = rawDate.split("-").map(Number);
  if (!origMonth || !origDay) {
    return { dDayText: "D-Day", daysUntil: 0, elapsedDays: null, nextDateStr: todayStr };
  }


  let elapsedDays = null;
  let yearsCount = null;
  if (item.hasOriginYear === true && origYear >= 1950 && origYear <= currentYear) {
    const origDateObj = new Date(origYear, origMonth - 1, origDay);
    const diffFromOrigin = Math.floor((today - origDateObj) / (1000 * 60 * 60 * 24));
    if (diffFromOrigin >= 0) {
      elapsedDays = diffFromOrigin + 1;
      yearsCount = currentYear - origYear;
    }
  }


  if (item.isAnnual) {
    let targetDate = new Date(currentYear, origMonth - 1, origDay);
    if (targetDate < today) {
      targetDate = new Date(currentYear + 1, origMonth - 1, origDay);
    }
    const daysUntil = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
    const nextDateStr = formatDate(targetDate);
    const dDayText = daysUntil === 0 ? "🎉 D-Day (오늘!)" : `D-${daysUntil}`;
    return {
      dDayText,
      daysUntil,
      elapsedDays,
      yearsCount: targetDate.getFullYear() - origYear,
      nextDateStr
    };
  } else {
    const targetDate = new Date(origYear, origMonth - 1, origDay);
    const daysUntil = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
    const dDayText =
      daysUntil === 0
        ? "🔥 D-Day (오늘!)"
        : daysUntil > 0
        ? `D-${daysUntil}`
        : `D+${Math.abs(daysUntil)}`;
    return {
      dDayText,
      daysUntil,
      elapsedDays,
      yearsCount: null,
      nextDateStr: rawDate
    };
  }
};


export const extractJsonArray = (rawText) => {
  if (!rawText) return null;
  const cleaned = String(rawText)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();


  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
      if (firstArray) return firstArray;
      return [parsed];
    }
  } catch {}


  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    } catch (e) {
      console.warn("JSON parse error:", e);
    }
  }
  return null;
};


export const extractJsonObject = (rawText) => {
  if (!rawText) return null;
  const cleaned = String(rawText)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return parsed;
    if (Array.isArray(parsed)) return { items: parsed };
  } catch {}
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
    } catch (e) {
      console.warn("JSON object parse error:", e);
    }
  }
  return null;
};


export async function callOpenAiEngine({ openaiKey, promptText, imagePart = null, temperature = 0.5, expectObject = false }) {
  const cleanKey = String(openaiKey || "").trim();
  if (!cleanKey) throw new Error("OpenAI API 키가 비어 있습니다.");


  const userContent = [{ type: "text", text: promptText }];
  if (imagePart) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${imagePart.mimeType};base64,${imagePart.base64}`,
        detail: "high"
      }
    });
  }


  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const modelName = imagePart ? "gpt-4o" : "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        temperature,
        messages: [
          {
            role: "system",
            content: expectObject
              ? "You are an expert Korean OCR & culinary AI. Output ONLY a valid JSON object. No markdown fences."
              : "You are an expert Korean culinary & OCR AI. Output ONLY a valid JSON array. No markdown fences."
          },
          {
            role: "user",
            content: imagePart ? userContent : promptText
          }
        ]
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`[GPT ${res.status}] ${data?.error?.message || "OpenAI 호출 오류"}`);
    }
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = expectObject ? extractJsonObject(text) : extractJsonArray(text);
    if (!parsed) throw new Error("[GPT] 응답을 JSON으로 변환하지 못했습니다.");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}


export async function callReliableAiEngine({
  apiKey,
  openaiApiKey = "",
  aiProvider = "auto",
  promptText,
  imagePart = null,
  temperature = 0.5,
  expectObject = false,
  onProviderUsed = null
}) {
  const effectiveGeminiKey = String(apiKey || EMBEDDED_GEMINI_KEY || "").trim();
  const effectiveOpenaiKey = String(openaiApiKey || "").trim();


  if (!effectiveGeminiKey && !effectiveOpenaiKey) {
    throw new Error(
      "AI API 키가 없습니다. 우측 상단 ⚙️설정에서 Gemini 또는 OpenAI GPT API 키를 입력해 주세요."
    );
  }


  const runGemini = async () => {
    if (!effectiveGeminiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");


    const parts = [{ text: promptText }];
    if (imagePart) {
      parts.push({
        inlineData: {
          mimeType: imagePart.mimeType,
          data: imagePart.base64
        }
      });
    }


    const genConfig = {
      temperature,
      responseMimeType: "application/json"
    };
    if (imagePart) {
      genConfig.mediaResolution = "MEDIA_RESOLUTION_HIGH";
    }


    const geminiBody = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: genConfig
    });


    const trySingleModel = async (modelId) => {
      const cleanModel = String(modelId).replace(/^models\//, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": effectiveGeminiKey
            },
            body: geminiBody,
            signal: controller.signal
          }
        );
        const data = await res.json();
        if (res.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsed = expectObject ? extractJsonObject(text) : extractJsonArray(text);
          if (parsed) return { ok: true, data: parsed };
          return { ok: false, error: `[${cleanModel}] 응답을 JSON으로 파싱하지 못했습니다.` };
        }
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        return { ok: false, error: `[${cleanModel} ${res.status}] ${errMsg}`, rawMsg: errMsg };
      } catch (e) {
        return {
          ok: false,
          error: `[${cleanModel}] ${e.name === "AbortError" ? "응답 시간 초과" : e.message}`
        };
      } finally {
        clearTimeout(timer);
      }
    };


    const primaryRes = await trySingleModel("gemini-3.8-flash");
    if (primaryRes.ok) return primaryRes.data;


    const rawPrimary = primaryRes.rawMsg || "";
    if (
      !rawPrimary.includes("blocked") &&
      !rawPrimary.includes("API_KEY_SERVICE_BLOCKED") &&
      !rawPrimary.includes("API key not valid") &&
      !rawPrimary.includes("expired")
    ) {
      try {
        const listRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: { "x-goog-api-key": effectiveGeminiKey }
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const availableFlash = (listData?.models || [])
            .filter(
              (m) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes("generateContent") &&
                m.name &&
                m.name.includes("flash") &&
                !m.name.includes("3.8-flash") &&
                !m.name.includes("thinking") &&
                !m.name.includes("image")
            )
            .map((m) => m.name)
            .slice(0, 2);


          for (const candidate of availableFlash) {
            const retryRes = await trySingleModel(candidate);
            if (retryRes.ok) return retryRes.data;
          }
        }
      } catch {}
    }
    throw new Error(primaryRes.error || "Gemini 호출 실패");
  };


  const runOpenAi = () =>
    callOpenAiEngine({
      openaiKey: effectiveOpenaiKey,
      promptText,
      imagePart,
      temperature,
      expectObject
    });


  // 엔진 선택 정책에 따른 실행 및 자동 페일오버
  if (aiProvider === "openai") {
    const res = await runOpenAi();
    if (onProviderUsed) onProviderUsed("OpenAI GPT-4o");
    return res;
  }
  if (aiProvider === "gemini") {
    const res = await runGemini();
    if (onProviderUsed) onProviderUsed("Gemini 3.8");
    return res;
  }


  // auto 모드: 이미지 OCR은 한국어 판독이 강한 Gemini 우선 -> 실패 시 GPT-4o / 일반 텍스트는 기존 순서
  const errors = [];
  if (imagePart && effectiveGeminiKey) {
    try {
      const res = await runGemini();
      if (onProviderUsed) onProviderUsed("Gemini 3.8");
      return res;
    } catch (e) {
      errors.push(e.message);
    }
    if (effectiveOpenaiKey) {
      try {
        const res = await runOpenAi();
        if (onProviderUsed) onProviderUsed("OpenAI GPT-4o");
        return res;
      } catch (e) {
        errors.push(e.message);
      }
    }
    throw new Error(`AI 호출 오류: ${errors.join(" / ")} (⚙️설정에서 API 키를 확인해 주세요)`);
  }


  if (effectiveOpenaiKey) {
    try {
      const res = await runOpenAi();
      if (onProviderUsed) onProviderUsed("OpenAI GPT");
      return res;
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (effectiveGeminiKey) {
    try {
      const res = await runGemini();
      if (onProviderUsed) onProviderUsed("Gemini");
      return res;
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`AI 호출 오류: ${errors.join(" / ")} (⚙️설정에서 API 키를 확인해 주세요)`);
}


// 서울 중구 날씨 코드 & 환경부 기준 미세먼지(PM10/PM2.5) 등급 판별 유틸리티
export const parseWeatherCode = (code, temp) => {
  let label = "맑음";
  let emoji = "☀️";
  let tip = "아이들과 산책하기 좋은 날씨예요!";


  if (code === 0 || code === 1) {
    label = "쾌청/맑음";
    emoji = "☀️";
  } else if (code === 2 || code === 3) {
    label = "구름/흐림";
    emoji = "⛅";
  } else if (code >= 45 && code <= 48) {
    label = "안개";
    emoji = "🌫️";
    tip = "시야가 흐리니 등하원길 안전에 유의하세요.";
  } else if (code >= 51 && code <= 67) {
    label = "비/이슬비";
    emoji = "🌧️";
    tip = "외출 시 우산과 레인부츠를 챙겨주세요!";
  } else if (code >= 71 && code <= 77) {
    label = "눈";
    emoji = "❄️";
    tip = "길이 미끄러우니 따뜻하게 입히고 조심하세요!";
  } else if (code >= 80 && code <= 99) {
    label = "소나기/천둥";
    emoji = "⛈️";
    tip = "갑작스러운 비에 대비해 휴대용 우산을 챙기세요.";
  }


  if (temp <= 5) {
    tip = "날씨가 쌀쌀해요! 시목이·시율이 체온 유지에 신경 써주세요 🧣";
  } else if (temp >= 28) {
    tip = "날씨가 더워요! 시원한 물과 수분 보충을 자주 해주세요 💧";
  }


  return { label, emoji, tip };
};


export const getDustGrade = (pm10, pm25) => {
  const getPm10Level = (v) => (v <= 30 ? 0 : v <= 80 ? 1 : v <= 150 ? 2 : 3);
  const getPm25Level = (v) => (v <= 15 ? 0 : v <= 35 ? 1 : v <= 75 ? 2 : 3);
  const maxLevel = Math.max(getPm10Level(pm10), getPm25Level(pm25));


  const levels = [
    {
      label: "좋음",
      emoji: "🟢",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      tip: "공기가 맑아 환기·산책하기 좋아요!"
    },
    {
      label: "보통",
      emoji: "🔵",
      badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
      tip: "무난한 대기질이에요."
    },
    {
      label: "나쁨",
      emoji: "🟠",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      tip: "미세먼지가 나빠요! 아이들 외출 시 마스크 챙기세요 😷"
    },
    {
      label: "매우나쁨",
      emoji: "🔴",
      badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
      tip: "공기가 매우 탁해요! 오늘은 실내 놀이를 추천해요 🏠"
    }
  ];
  return levels[maxLevel];
};


export const fileToBase64 = (file, { maxSide = 720, quality = 0.65, enhanceContrast = false } = {}) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIDE = maxSide;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_SIDE) {
          h = Math.round((h * MAX_SIDE) / w);
          w = MAX_SIDE;
        } else if (h >= w && h > MAX_SIDE) {
          w = Math.round((w * MAX_SIDE) / h);
          h = MAX_SIDE;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const previewDataUrl = canvas.toDataURL("image/jpeg", quality);
        let aiDataUrl = previewDataUrl;
        if (enhanceContrast) {
          try {
            const ocrCanvas = document.createElement("canvas");
            ocrCanvas.width = w;
            ocrCanvas.height = h;
            const ocrCtx = ocrCanvas.getContext("2d");
            if ("filter" in ocrCtx) {
              ocrCtx.filter = "grayscale(1) contrast(1.42) brightness(1.04)";
            }
            ocrCtx.drawImage(img, 0, 0, w, h);
            aiDataUrl = ocrCanvas.toDataURL("image/jpeg", quality);
          } catch {}
        }
        resolve({
          base64: aiDataUrl.split(",")[1],
          mimeType: "image/jpeg",
          previewUrl: previewDataUrl
        });
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });


// ==========================================
// 3. 상수 및 기본 데이터 (패치노트 히스토리 v5.6 포함!)
// ==========================================
export const FAMILY_MEMBERS = [
  { id: "수혁", name: "수혁", role: "아빠", emoji: "👨🏻", avatar: "data:image/jpeg;base64,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", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "아리나", name: "아리", role: "엄마", emoji: "👩🏻", avatar: "data:image/jpeg;base64,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", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { id: "시목", name: "시목", role: "첫째", emoji: "👦🏻", avatar: "data:image/jpeg;base64,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", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "시율", name: "시율", role: "둘째", emoji: "👶🏻", avatar: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCABgAGADASIAAhEBAxEB/8QAHAAAAgMAAwEAAAAAAAAAAAAABQYDBAcAAQII/8QANhAAAgEDAgQEAwYGAwEAAAAAAQIDAAQRBSEGEjFRE0FhcUKBkQcUIjJSsRUjM2Kh0YLB4fD/xAAZAQACAwEAAAAAAAAAAAAAAAACBAEDBQD/xAAiEQACAgICAgIDAAAAAAAAAAAAAQIRAyESMQRBQlEFIiP/2gAMAwEAAhEDEQA/ADvD17qOoWjQWNpJI0MnIsnLhWU7g8x223FGpuDbzU7R49Rvo4OcbiIeIR8zgZok+uxsh8PmYpsFUZCj2FWdN+/6szTOJLK1A2cj8b+wPT3rJbUm2ka6TiqbI9H4Q0XTCxYzzy4wXkk3+gxRtLfTIAGSCFPPmK7/AFNANTh061ZVkeSVx0LzN/1QqWSOVeWBA7nZVJLLj1zUcktBcHLY3XerWVuh5zGzHZVUAlvQUFmhOpP4tyAsfVYl6D37mqGlaaIZWllCmZtiQAMDsPSjsQ5VxVUsl6GceBR2D5rSFEx4Y+lL2r2cZVgAKargNg4xihF5CTnY1XKTQzCCZk2u6HzGRxzhT8KgCknUdG5G5hE6481bcfOtt1S1yrEDYdhSNq9sWdgiswzuOlHiytA5vHjJCxwrxzq3CN0sSO9xpzNmSFzt7rn8p9tj51uttc6fxTw+msaO4eTGJIviVh1UjyP71gur6WoiJRcEH9XnXjgLiK74Y4hidGkFtMRHJF5NvttT8Xy2uzJyY3jdPo+ptXibSrW2i0mIrGZFQhOuO571zi7Vby30g/wuzluLgrnAwFAx1YnoP8mp+JW8O3RwcNG4JoDqWupczR6bzDxJULOAdwgxn27fOlOVWMQg5UxI4etb/XSL3U5phGTkAfh5vb09ad4LQW/K8f5AMFAN/cd6v28EUaDoANgO1duYHHKA23nilpNt2zRjBJaIDMOdWj3FTtIRhtwKqwRxpPjBGTnFSXcgQsAelCEluiXxlIxmoJSGFVmblXnByD19Khe4I3BruX2Go/RU1JRynGDSlqShiQirnuRTFfXGcg9KC3KBycjNdFhNCrqdmZImKICfIEUi6xbqH8QloZgwKKw+IEYOa0/UAIoi2SMbbb/Skq3VNV4p02ycYV7lecEbkA5P7U9hbXRneWlR9H8RXBubWa2ijaWZAFblOAD5b96k0zSbSxdpY4E+8uAJJjuzY8snoPSqt2ZIknt42Vbv7w7sX6Y659sVyHifTHRRPKUmAJ5RnJA8wPMVfCMU2mYmecmlvRa19Vj02a4Q8skS86kenlS7BqyXAF1Zu7kLnkB2PuDQbjDjOzu7b7vaCQwMeV2AzsOtQaSVtrz7mpcQTossan4T5iqvJhceS9D/AOLycXwl7G57uSaa2fkwsy5GRgg9iKiupQkitIPw/E36R3Pp617tLLlaOQs/MowFLZA27Vy5IW5ztjp3rPejd430RXaBFLI+3mBQWS85cqcDG9WNTmW1XKf0TtgfB/5+1ApjzuWHQ+dDpnJ0tklxcBmOD1qq9woUknahd7OYJCCTt0oJdXst1MlvBHLNNI3LHFChZ3PoBV0IWUTypdkuu6t4z/d7dXkkZggCDJYk4CgeZJ8q0b7OPs8/hssWr8QKj6iBlIh+W39B3bufpV77OeAItDVdW14JLqpBaOPIKWwPkO7928ugpuu7hrh2SFgqLu7+Sj/dNJqKpGbkm8jJ9a4fi1E+JFL4U5+Pl5j9M0uXfDN9CxkeQGAH8sLHJGPMUxW1+xkKPKdupAxmrBuRyNuSo7nNFHJQtLEpdiDw/wAGy2iTpHDPOrylw1woAjHYA9aqW3Duu22pPc6jZlj4mRND+JeUdNhuBjvWkW1/HJb/ANRQyfhbJ6Ed6iGsQJKI/HjdicAK2ST2xUZHzVMPB/GXJbFmC4WNCrMc9uh+lULyfmJwafLi3ivkC3Nurr5F9iPY9aFXfBtncbpczweiuGH+RS0sL9M1YedD5KhBvZcg5I3oTd3ccaAlgM7ds1ozcA2nic1xqc7QjflVAGPz/wDKLaVoejaMpa1tlebP9WY+I/sCeg9qGOFrsifmQ+OzILDhTXeI5w1rbi1sm2N1cgquP7V6t+3rWrcNcJ6PwtCDZwh7spiS7kAMr99/hB/SNqMXeoxKn42AHp1PtQa/u3cl5yYYjvj4j/qr1UVSEZzlkdsmvJzdyFInCRJ+aQ9FH/3lQ12NwBFbgi3U7E9ZD+o1XeaS8Ai5fDtV35R5+pohFyquEGw7VC2R0d39lKjs0hPOOrKeo9utVrKPU71vDiiSG1GxnkJxjsF6mmySVWOSASDsaiNzk46n61OgNlWz4f06CTxpIzc3BXlMsxJz/wAelVr/AEnSs72kcJO3PCTGw9iKOKw8Prk0LvyGbl/zU8iEgda22p2c38m9e9tPJJwPET0DjGR6H61O2qKxdUkUSrs0bnlYe4P71KJWjXHXtQXiTSoNZtTHcNJFIu8c8TcrxnuD/wBdDXdkoluNSuC5xJGuP1MKgGob/wA27B9E/wBms9v4uIdKufDuIItVtBstxF/Lkx/cvTNdw3drOwWfmhc9FlGPlnpQuJYmh9/icCgiN1VsYzkFvr/qoxOkpBdww7eVLMenxvggAAjO1AuLXk0axkvY5pI0iQghCQcnp884rlG3RzdKzSPvUYBwRnpVC91qHS7O7urmRVghXnZs+VYvZccXZhGY5ZGA6yOMZoNxHxDqGrxJBdSAQc2RGuy57nvTEcEr2LyzqtH1vzqTUIkBYcnfaqL3YAxncgdKs2JLFpX2A23NKl9UFYwY48yHJ8vShN2xknIBwBUOsaxFaQMXcLgde1LltrBuXZh0PQmuslRb2M3iq4HMRjpiqGoXQj5vxYHXehs+rR20cjyOqqoJLMcADvWeajxVf6xetHo9mz26nHjzHlVvXHXFTdkqDse5bxJFyCD696G3cNs8Ekkqqds0KtLG4mhVp9QmL4/EsKBF/wAgmp/ulqgzKZJm7zMWx8ulDyouWBsVbjWH07XgLa4YWkkXMU6qpBx8s14421+K54YnhhikuJZsKRGp/CM5LHt0o3q/gtCQqICNxtQq4vILK1aV4lJQHGBkt8u/lVsJ7RE/HVO2ZZaSRyYHjyRnswBpo4b0SLVL2CGYu4kPwnfA3P1qLTtD8cePyqJcFkUDY+9aN9mWnQwWFxqEkXLK5ZQMflUbH5k5+lP5JVHXZlQj+2+j/9k=", color: "bg-purple-100 text-purple-800 border-purple-200" }
];


export const HERO_FAMILY_FALLBACK = "data:image/jpeg;base64,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";




export const MEAL_SLOTS = [
  { id: "아침", label: "아침", shortLabel: "아침", icon: "🌅", time: "07:00 - 09:00" },
  { id: "오전간식", label: "오전간식", shortLabel: "오전간식", icon: "🍎", time: "10:00 - 11:00" },
  { id: "점심", label: "점심", shortLabel: "점심", icon: "☀️", time: "12:00 - 13:30" },
  { id: "오후간식", label: "오후간식", shortLabel: "오후간식", icon: "🥨", time: "15:00 - 16:30" },
  { id: "저녁", label: "저녁", shortLabel: "저녁", icon: "🌙", time: "18:00 - 20:00" },
  { id: "야식", label: "야식", shortLabel: "야식", icon: "🦉", time: "21:00 이후" }
];


export const STORAGE_LOCATIONS = ["냉장실", "메인 냉동실", "별도 냉동고", "실온·팬트리"];
export const matchesFridgeLocFilter = (itemLoc, filterLoc) => {
  if (filterLoc === "전체") return true;
  if (filterLoc === "냉동실") return String(itemLoc || "").includes("냉동");
  if (filterLoc === "메인 냉동실") return itemLoc === "메인 냉동실" || itemLoc === "냉동실";
  return itemLoc === filterLoc;
};
export const FRIDGE_CATEGORIES = ["채소/과일", "육류/수산", "유제품/계란", "유아식/이유식 재료", "반찬/김치", "밀키트", "양념/소스", "음료", "기타"];
export const SCHEDULE_CATEGORIES = ["기념일/생일", "할일(To-Do)", "육아/병원", "가족행사/경조사"];
export const RECIPE_CATEGORIES = ["메인반찬", "국·찌개", "한그릇·면·밥", "유아식·이유식", "간식·디저트", "샐러드·가벼운식", "기타"];
export const NOTICE_CATEGORIES = ["육아/아이들", "일정/행사", "집안일", "일반"];
export const BUCKET_CATEGORIES = ["나들이/여행", "키즈카페/체험", "맛집", "우리집 목표"];
export const FRIDGE_SHELF_ZONES = [
  "냉장 1단(상단)",
  "냉장 2단(중단)",
  "냉장 3단(하단)",
  "채소칸",
  "하부냉동 1칸",
  "하부냉동 2칸",
  "하부냉동 3칸",
  "하부냉동 4칸",
  "전용냉동 1칸",
  "전용냉동 2칸",
  "전용냉동 3칸",
  "전용냉동 4칸",
  "팬트리"
];


export const getFridgeCategoryIcon = (cat) => {
  const map = {
    "채소/과일": "🥬",
    "육류/수산": "🥩",
    "유제품/계란": "🥛",
    "유아식/이유식 재료": "🍼",
    "반찬/김치": "🍱",
    "밀키트": "🥟",
    "양념/소스": "🧂",
    "음료": "🥤",
    "기타": "📦"
  };
  return map[cat] || "📦";
};


export const resolveItemShelfZone = (item) => {
  if (item?.shelfZone === "채소칸 좌" || item?.shelfZone === "채소칸 우") {
    return "채소칸";
  }
  if (item?.shelfZone && FRIDGE_SHELF_ZONES.includes(item.shelfZone)) {
    return item.shelfZone;
  }
  const loc = String(item?.location || "");
  const cat = String(item?.category || "");
  if (loc.includes("실온") || loc.includes("팬트리") || loc.includes("상온")) {
    return "팬트리";
  }
  if (loc === "별도 냉동고") {
    if (cat === "밀키트") return "전용냉동 2칸";
    if (cat === "육류/수산") return "전용냉동 1칸";
    return "전용냉동 3칸";
  }
  if (loc.includes("냉동")) {
    if (cat === "밀키트") return "하부냉동 2칸";
    if (cat === "육류/수산") return "하부냉동 1칸";
    return "하부냉동 3칸";
  }
  if (cat === "채소/과일") return "채소칸";
  if (cat === "유제품/계란" || cat === "유아식/이유식 재료" || cat === "음료") return "냉장 1단(상단)";
  if (cat === "반찬/김치") return "냉장 2단(중단)";
  return "냉장 3단(하단)";
};


export const shelfZoneToLocation = (zoneName) => {
  const z = String(zoneName || "");
  if (z === "팬트리") return "실온·팬트리";
  if (z.startsWith("전용냉동")) return "별도 냉동고";
  if (z.startsWith("하부냉동")) return "메인 냉동실";
  return "냉장실";
};


export const getOffsetDateStr = (baseDateStr, offsetDays = 0) =>
  addMonthsToDateStr(baseDateStr || getTodayStr(), 0, offsetDays);


export const EXPORT_MEAL_GOALS = [
  "재고소진",
  "산후조리/영양보충",
  "다이어트",
  "치팅",
  "숙취해소",
  "한가족이 먹을수있는 식사"
];


export const parseRecipeIngredientToken = (rawToken) => {
  const clean = String(rawToken || "").trim();
  if (!clean) return { name: "", qty: 1, unit: "개", qtyText: "1개" };
  const m = clean.match(
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|L|개|팩|봉지|봉|모|캔|단|알|마리|조각|컵|큰술|작은술|스푼|줌|포기|쪽|톨|장|줄|병|통|T|t)?$/i
  );
  if (m) {
    const name = m[1].trim();
    const qty = Number(m[2]) || 1;
    const unit = (m[3] || "개").trim();
    return { name, qty, unit, qtyText: `${qty}${unit}` };
  }
  return { name: clean, qty: 1, unit: "개", qtyText: "1개" };
};


export const buildPersonalizedAiPrompt = ({
  exportScope,
  exportMealMember,
  exportMealGoal,
  exportMealDays,
  simokM,
  siyulM
}) => {
  const daysNum = Number(exportMealDays) || 7;
  const goal = exportMealGoal || "재고소진";
  const scopeDesc =
    exportScope === "all"
      ? `최근 ${daysNum}일 식단과 현재 냉장·냉동·실온 재고`
      : exportScope === "meals_only"
      ? `최근 ${daysNum}일 식단`
      : "현재 냉장·냉동·실온 재고";


  const goalGuideMap = {
    "재고소진": "냉장고 소비기한 임박 재료와 보유 재고를 최대한 소진하면서 추가 장보기를 최소화하는 방향",
    "산후조리/영양보충": "산후 회복·철분·단백질·칼슘·따뜻한 국물과 소화 편한 영양 보충 방향",
    "다이어트": "적정 열량 관리·고단백·저정제탄수·식이섬유 포만감을 살린 식단 방향",
    "치팅": "일상 스트레스를 풀 수 있는 만족감 높은 특식·홈파티·별미 위주 방향",
    "숙취해소": "위장에 부담이 적고 수분·전해질·아미노산(콩나물·북어·조개 등) 보충에 좋은 해장·회복 방향",
    "한가족이 먹을수있는 식사": "어른과 아이(시목)가 같은 베이스로 함께 먹기 좋은 한 냄비/공통 집밥 방향"
  };
  const goalGuide = goalGuideMap[goal] || goalGuideMap["재고소진"];


  let targetIntro = `우리 가족(성인 2인, 첫째 시목 생후 ${simokM}개월, 둘째 시율 생후 ${siyulM}개월)`;
  let evalLine = `1) 영양 균형·메뉴 중복·[${goal}] 목표 부합도 관점에서 평가해 주세요.`;
  let recLine = `2) ${goalGuide}으로 다음 3~7일 추천 식단과 최소 장보기 목록을 제안해 주세요.`;


  if (exportScope !== "fridge_only") {
    if (exportMealMember === "수혁") {
      targetIntro = "수혁(성인 남성)";
      evalLine = `1) 성인 남성 기준 영양 균형·메뉴 중복·[${goal}] 목표 관점에서 평가해 주세요.`;
      recLine = `2) 수혁 개인 맞춤으로 ${goalGuide}에 맞춘 다음 3~7일 추천 식단(냉장고 재고 활용 포함)을 제안해 주세요.`;
    } else if (exportMealMember === "아리나") {
      targetIntro = "아리(성인 여성)";
      evalLine = `1) 성인 여성 기준 영양 균형·철분/단백질·메뉴 중복·[${goal}] 목표 관점에서 평가해 주세요.`;
      recLine = `2) 아리 개인 맞춤으로 ${goalGuide}에 맞춘 다음 3~7일 추천 식단(냉장고 재고 활용 포함)을 제안해 주세요.`;
    } else if (exportMealMember === "시목") {
      targetIntro = `첫째 시목(생후 ${simokM}개월 유아식)`;
      evalLine = `1) 생후 ${simokM}개월 유아식 기준으로 탄수화물·단백질·채소 균형, 씹기 편한 식감/크기, 저염 여부, 메뉴 중복을 평가해 주세요.`;
      recLine = `2) 냉장고 보유 유아식·일반 재료를 우선 활용해 시목이에게 안전하고 영양이 고른 다음 3~7일 유아식·간식 식단(부족 재료만 최소화)을 제안해 주세요.`;
    } else if (exportMealMember === "시율") {
      targetIntro = `둘째 시율(생후 ${siyulM}개월)`;
      evalLine = `1) 생후 ${siyulM}개월 월령 기준으로 현재 수유·돌봄 흐름(또는 만 6개월 이후 초기 이유식 준비 시 철분·알레르기 테스트 식재료)을 점검해 주세요.`;
      recLine = `2) 현재 월령에 맞는 주의사항과 함께, 보유 재고 중 향후 이유식·가족식 연계 가능한 포인트를 안내해 주세요.`;
    }
  }


  return [
    `[AI 요청문] 아래는 ${targetIntro}의 ${scopeDesc}입니다. (선택 목표: ${goal})`,
    evalLine,
    recLine,
    "----------------------------------------",
    ""
  ];
};




export const compressDataUrlForFirestore = (dataUrl, maxSide = 720, quality = 0.65) =>
  new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || dataUrl.includes("undefined")) {
      resolve("");
      return;
    }
    if (dataUrl.length <= 280000 && dataUrl.startsWith("data:image/")) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxSide) {
          h = Math.round((h * maxSide) / w);
          w = maxSide;
        } else if (h >= w && h > maxSide) {
          w = Math.round((w * maxSide) / h);
          h = maxSide;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl.length <= 750000 ? dataUrl : "");
      }
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });


export const APP_CODE_VERSION = "v13.98";


export const formatRoutineTimeLabel = (hhmm) => {
  const m = String(hhmm || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return String(hhmm || "").trim();
  const h = Number(m[1]);
  const min = m[2];
  return min === "00" ? `${h}시` : `${h}시${min}분`;
};


export const isRoutineTimeOverdue = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(String(hhmm || "").trim())) return false;
  const now = new Date();
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return cur > String(hhmm).trim();
};
export const APP_BUILD_DATE = "2026-11-24 23:35";
export const UI_TOKENS = {
  ivoryBg: "bg-[#FAF8F3]",
  beigeSurface: "bg-[#F3EEE4]",
  sageBtn: "bg-[#5E7A65] hover:bg-[#4E6855] text-white",
  sageSoft: "bg-[#EEF3EE] text-[#35503C] border-[#C9D8CC]",
  cardBase: "bg-white rounded-2xl border border-stone-200 shadow-sm",
  btnPrimary: "h-9 px-3.5 rounded-xl text-[13.5px] font-extrabold transition",
  btnCompact: "h-7 px-2.5 rounded-lg text-[11.5px] font-extrabold transition"
};
export const EDITOR_INVITE_CODE = "0402";
export const DEFAULT_HELPER_CODE = "1234";
export const GUEST_ALLOWED_TABS = ["home", "daily", "recipes"];
export const DEFAULT_HELPER_TABS = ["home", "daily", "fridge", "shopping", "notices", "recipes"];
export const HELPER_CONFIGURABLE_TABS = [
  { id: "daily", label: "🍽️ 식단" },
  { id: "fridge", label: "❄️ 냉장고" },
  { id: "shopping", label: "🛒 장보기" },
  { id: "notices", label: "📌 가족공지" },
  { id: "recipes", label: "📖 레시피북" },
  { id: "baby", label: "👶 육아수첩" },
  { id: "schedule", label: "🗓️ 일정" },
  { id: "routines", label: "🔄 루틴" },
  { id: "pages", label: "🗂️ 공유노트" },
  { id: "ai", label: "✨ AI추천" },
  { id: "monthly", label: "💰 월간·식비" },
  { id: "house", label: "🏠 살림수첩" }
];


export const BABY_ACTIVITY_TYPES = [
  { id: "모유", label: "모유", emoji: "🤱", timed: true, isFeed: true, bg: "bg-[#F46A6A]", soft: "bg-rose-50 text-[#E85B5B] border-rose-200", text: "text-[#E85B5B]" },
  { id: "분유", label: "분유", emoji: "🍼", timed: true, isFeed: true, hasMl: true, bg: "bg-[#F4B400]", soft: "bg-amber-50 text-[#E5A000] border-amber-200", text: "text-[#E5A000]" },
  { id: "이유식", label: "이유식", emoji: "🥣", timed: true, hasMl: true, unit: "g", bg: "bg-[#2BBBAD]", soft: "bg-teal-50 text-[#25A99B] border-teal-200", text: "text-[#25A99B]" },
  { id: "기저귀", label: "기저귀", emoji: "🧷", timed: false, bg: "bg-[#B67B48]", soft: "bg-orange-50 text-[#A86D3B] border-orange-200", text: "text-[#A86D3B]" },
  { id: "수면", label: "수면", emoji: "😴", timed: true, bg: "bg-[#6C6CB4]", soft: "bg-indigo-50 text-[#6464AC] border-indigo-200", text: "text-[#6464AC]" },
  { id: "유축", label: "유축", emoji: "🧴", timed: true, hasMl: true, bg: "bg-[#F078B8]", soft: "bg-pink-50 text-[#E065A7] border-pink-200", text: "text-[#E065A7]" },
  { id: "유축수유", label: "유축수유", emoji: "💚", timed: true, isFeed: true, hasMl: true, bg: "bg-[#7CB342]", soft: "bg-lime-50 text-[#689F38] border-lime-200", text: "text-[#689F38]" },
  { id: "목욕", label: "목욕", emoji: "🛁", timed: false, bg: "bg-[#4FC3F7]", soft: "bg-sky-50 text-[#2998D0] border-sky-200", text: "text-[#2998D0]" },
  { id: "터미타임", label: "터미타임", emoji: "🧸", timed: true, bg: "bg-[#4EA1E0]", soft: "bg-sky-50 text-[#4EA1E0] border-sky-200", text: "text-[#4EA1E0]" },
  { id: "투약", label: "투약", emoji: "💊", timed: false, bg: "bg-[#EF5350]", soft: "bg-red-50 text-[#E53935] border-red-200", text: "text-[#E53935]" },
  { id: "기타", label: "기타", emoji: "📝", timed: false, bg: "bg-[#78909C]", soft: "bg-stone-100 text-[#607D8B] border-stone-200", text: "text-[#607D8B]" }
];


export const formatElapsedKo = (msDiff) => {
  if (!Number.isFinite(msDiff) || msDiff < 0) return "방금";
  const totalMin = Math.floor(msDiff / 60000);
  if (totalMin < 1) return "방금 전";
  if (totalMin < 60) return `${totalMin}분 전`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m > 0 ? `${h}시간 ${m}분 전` : `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간 전`;
};


export const formatTime12Ko = (ms) => {
  const d = new Date(ms);
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
};


export const INITIAL_PATCH_NOTES = [
  {
    id: "patch-v13.98",
    version: "v13.98",
    date: "2026-11-24",
    title: "📲 서비스 워커(/sw.js) 활성화 대기 및 상태바 알림 아이콘·진단 개선",
    highlights: [
      "앱 시작 시 /sw.js 사전 등록 및 showStatusBarNotification에서 reg.active 활성화 대기(최대 3.5초) 추가 — 최초 등록 직후 'No active worker' 오류로 상태바 알림이 누락되던 버그 수정",
      "상태바 알림에 app-icon-512.png 아이콘/배지 연결(silent: true 무음 유지)",
      "상태바 알림 실패 시 구체적 원인(sw.js 미배포, 권한 차단 등)을 토스트로 즉시 표시"
    ]
  },
  {
    id: "patch-v13.97",
    version: "v13.97",
    date: "2026-11-24",
    title: "🔔 상태바 알림 권한 요청 무반응 수정(타임아웃·오류 안내·SW 등록 시도)",
    highlights: [
      "[🔔 상태바 켜기] 클릭 시 무반응으로 멈추던 원인 해결: Notification.requestPermission Promise/콜백 양방향 호환 및 3초 타임아웃 방어, 에러 발생 시 브라우저/웹뷰 제한 사유를 토스트로 즉시 안내",
      "ServiceWorker 미등록 환경에서 /sw.js 등록을 자동 시도하고 상태바 알림 발송 실패 시 정확한 원인 안내 제공"
    ]
  },
  {
    id: "patch-v13.96",
    version: "v13.96",
    date: "2026-11-24",
    title: "💬 상단 토스트 알림 말줄임(...) 잘림 해결 (전문 표시)",
    highlights: [
      "toastBannerEl의 line-clamp-2 제한을 제거하고 w-max max-w-[min(92vw,410px)] · break-keep를 적용해 긴 안내 문구도 중간에 '...'로 잘리지 않고 전체 내용이 선명하게 표시되도록 수정"
    ]
  },
  {
    id: "patch-v13.95",
    version: "v13.95",
    date: "2026-11-24",
    title: "🔕 상태표시줄 알림 무음(silent: true) 전용 전달 적용",
    highlights: [
      "ServiceWorker showNotification 및 Notification 호출에 silent: true, renotify: false 옵션을 적용해 모든 앱 상태표시줄 알림이 소리·진동 없이 무음으로만 전달되도록 개선",
      "전체 코드 구문·임포트·미선언 식별자·localStorage 동기화·배포 오류 최종 점검 완료"
    ]
  },
  {
    id: "patch-v13.94",
    version: "v13.94",
    date: "2026-11-24",
    title: "🔔 알림 기능 통합 고도화: 쪽지·가입승인 상태바 알림 + 수정알림 헤더 잘림 방지",
    highlights: [
      "수정 알림 모달 헤더 개선: 버튼 4개(상태바·팝업·비우기·닫기)가 모바일 폭에서 잘리지 않도록 제목·닫기 줄과 제어 버튼 줄을 깔끔하게 분리",
      "실시간 상태표시줄 알림 연계 확장: 관리자에게 새 쪽지(admin_inbox_notes_v1) 또는 새 회원가입 승인 요청(pending)이 도착할 때도 상태표시줄 알림을 띄우고, 수정 알림에서 [쪽지] 항목 클릭 시 쪽지함으로 바로 이동하도록 연계"
    ]
  },
  {
    id: "patch-v13.93",
    version: "v13.93",
    date: "2026-11-24",
    title: "📲 모바일 상태표시줄 알림(ServiceWorker showNotification) 지원 및 테스트 버튼 추가",
    highlights: [
      "모바일 상태표시줄 알림 버그 수정: 안드로이드 Chrome·PWA에서 무시되던 new Notification() 대신 navigator.serviceWorker.ready.showNotification()을 우선 호출하도록 개선",
      "새 수정 알림뿐 아니라 관리자 새 쪽지·회원 승인 요청 도착 시에도 상태표시줄 알림 지원 및 수정 알림 창 내 [🔔 상태바 켜기 / 📲 상태바 테스트] 버튼 추가"
    ]
  },
  {
    id: "patch-v13.92",
    version: "v13.92",
    date: "2026-11-24",
    title: "🛡️ 설정 권한메뉴 고도화: 일괄 승인 메일 자동발송·분류권한 연동·기본값 복원 2탭 안전장치",
    highlights: [
      "일괄 승인 메일 연계: 체크박스로 여러 대기 회원을 한 번에 승인(handleBulkUpdateUserRoles)할 때도 EmailJS 승인 완료 메일이 자동 발송되도록 보완",
      "개별 메뉴 권한 정확도 개선: 개별 권한 표 기본값이 해당 회원의 분류(roleLabel) 권한을 정확히 따르도록 수정하고, [기본값 복원] 버튼에 실수 방지 2탭 확인 적용"
    ]
  },
  {
    id: "patch-v13.91",
    version: "v13.91",
    date: "2026-11-24",
    title: "🗂️ 더보기 시트 및 하위 메뉴(AI·레시피·경조사·공지버튼) 폰트·세이지그린 통일",
    highlights: [
      "더보기 시트(전체 메뉴 바로가기) 제목(15.5px→13.5px) 및 메뉴 타일(12px→11px, py-2)을 컴팩트하게 통일해 한 화면 가독성 개선",
      "더보기 하위 메뉴(AI추천·경조사비·레시피북·장보기·살림수첩)의 큰 제목(15~16px→13.5px)과 이질적 남색(bg-indigo-50) 공지 연계 버튼을 앱 공통 세이지그린(#EEF3EE / #35503C) 톤으로 정리 및 전체 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.90",
    version: "v13.90",
    date: "2026-11-24",
    title: "❄️ 냉장고 메뉴 품목 폰트(13.5px)·하부냉동·버튼 색감 통일",
    highlights: [
      "냉장고 품목 카드의 큰 품목명(15.5px→13.5px) 및 수량(13.5px→12px) 폰트 규격을 다른 메뉴와 동일하게 통일",
      "하부냉동 구역의 이질적 남색(indigo) 테두리·배경을 차분한 슬레이트(slate) 톤으로, 임박 재료 [✨ AI 추천] 버튼을 세이지그린(#3F624D)으로 정리 및 전체 구문·배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.89",
    version: "v13.89",
    date: "2026-11-24",
    title: "🍽️ 식단메뉴 폰트(13.5px) 및 세이지그린(#3F624D) 색감 통일",
    highlights: [
      "식단표 상단 제목(14.5px→13.5px) 및 월간 식단 달력 월 입력(15px→13.5px) 폰트를 앱 공통 규격으로 통일",
      "식단 [오늘] 버튼 및 일자별 [📌 가족공지 공유] 버튼 색상을 이질적 주황/남색에서 앱 공통 세이지그린(#EEF3EE / #35503C) 톤으로 정리 및 전체 구문·배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.88",
    version: "v13.88",
    date: "2026-11-24",
    title: "👶 육아메뉴 폰트·세이지그린 색감 통일 및 진료·체온 헤더 잘림 방지",
    highlights: [
      "육아메뉴 내 이질적 남색·주황 배지/그래프(아이 카드·영유아검진·성장 백분위)를 앱 공통 세이지그린(#3F624D · #EEF3EE) 톤으로 통일하고 아이 이름(14px)·육아일기 제목(13.5px) 폰트 규격 조정",
      "소아과 진료·체온 메모 헤더에 flex-wrap 및 컴팩트 버튼(10.5px)을 적용해 360px 모바일에서도 제목·버튼 잘림 없이 표시되도록 개선"
    ]
  },
  {
    id: "patch-v13.87",
    version: "v13.87",
    date: "2026-11-24",
    title: "🔐 로그인·이름입력·대기화면 토스트 누락 버그 수정 및 디자인·폰트 규격 통일",
    highlights: [
      "버그 수정: 로그인·이름입력·승인대기·탈퇴 화면에서도 토스트 알림(toastBannerEl)이 정상 표시되도록 개선(주소 복사·쪽지 발송·확인 메일 알림 누락 해결)",
      "로그인/이름입력/대기 화면 컴팩트 리뉴얼: 과도한 카드 여백·큰 폰트(18px→15.5px, 입력/버튼 13.5px→12px)를 앱 공통 톤(stone + 세이지그린 #3F624D)으로 통일하고, 로그인 하단에 관리자 연락처(01059147933) 및 이메일 저장 즉시 반영 추가"
    ]
  },
  {
    id: "patch-v13.86",
    version: "v13.86",
    date: "2026-11-24",
    title: "🎨 전 메뉴 모달 제목 폰트(13.5px) 및 세이지그린(#3F624D) 색감 일괄 통일",
    highlights: [
      "모든 메뉴·모달 제목(h3)에서 15~15.5px로 불규칙하게 크게 남아 있던 폰트를 13.5px 규격으로 일괄 통일",
      "루틴·일정·장보기·육아·공지 등에 흩어져 있던 이질적 원색(indigo-600/pink-600) 배지·버튼을 앱 공통 세이지그린(#3F624D · #EEF3EE) 톤으로 정리하고 전체 구문·배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.85",
    version: "v13.85",
    date: "2026-11-24",
    title: "⚙️ [세부 분류 관리] 모달 컴팩트 통일 + 회원 [개별 메뉴 권한] 분류별 권한 연계",
    highlights: [
      "세부 분류 관리 모달 경량화: 전환 탭(10px)·목록 행(11px)·편집 버튼(10px) 규격을 설정창·패치노트·분류권한 팝업과 동일하게 통일하고 하단 불필요 안내 문구 제거",
      "회원 개별 메뉴 권한 연계 고도화: [개별 메뉴 권한]을 켤 때 공통 기본값이 아니라 해당 회원의 분류(roleLabel)에 설정된 권한을 기준으로 불러오도록 개선"
    ]
  },
  {
    id: "patch-v13.84",
    version: "v13.84",
    date: "2026-11-24",
    title: "📝 패치노트·세부분류·식단복사 모달 글자크기·날짜 줄바꿈·색감 일괄 통일",
    highlights: [
      "패치노트 모달 개선: 13.5~15.5px 큰 글씨를 10~11.5px로 축소, 버전 입력칸 잘림(placeholder) 해소, 날짜(2026-11-24) 2줄 줄바꿈 방지(whitespace-nowrap), 이질적인 남색/주황색 배지를 중립 무채색·세이지그린(#3F624D) 톤으로 통일",
      "세부 분류 관리·식단 복사 모달 글자·입력창 높이를 설정창 컴팩트 규격(10.5~13px)으로 일괄 통일 및 배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.83",
    version: "v13.83",
    date: "2026-11-24",
    title: "📅 달력 상단 [오늘] 버튼 겹침·잘림 수정 및 폰트·색감 통일",
    highlights: [
      "달력 상단 월 이동 바에서 [오늘] 버튼이 오른쪽 검색(🔍) 버튼 뒤로 겹쳐 잘리던 현상 수정: flex-wrap 안전 배치, 연·월 및 우측 액션 버튼 폭 컴팩트 조정으로 360px 모바일에서도 1줄에 겹침 없이 표시",
      "[오늘] 버튼 색감을 앱 공통 세이지그린(#35503C / #EEF3EE) 톤으로 통일하고 전체 구문·배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.82",
    version: "v13.82",
    date: "2026-11-24",
    title: "🔐 익명 세션 로그인 화면 차단(이름/이메일 '-' 대기화면 갇힘 버그 수정) + 카톡 인앱 브라우저 외부 열기 안내",
    highlights: [
      "치명 버그 수정: 기존 익명 로그인(isAnonymous) 세션이 남은 기기에서 로그인 화면을 건너뛰고 [이름: - / 이메일: -] 승인 대기 화면에 갇히던 문제를 onAuthStateChanged 자동 로그아웃 및 로그인 게이트(!user || user.isAnonymous)로 완전 해결",
      "카카오톡·네이버·인스타 인앱 브라우저 감지 배너 추가: Google OAuth 차단(disallowed_useragent)을 피할 수 있도록 안드로이드 크롬 즉시 열기(intent://) 및 주소 복사·외부 브라우저 안내 제공"
    ]
  },
  {
    id: "patch-v13.81",
    version: "v13.81",
    date: "2026-11-24",
    title: "🔡 설정창 하부(삭제 로그·AI 오류센터·자가진단·상단 사진설정) 글자·여백 컴팩트 통일",
    highlights: [
      "설정창 내 12.5~13.5px로 크게 남아 있던 삭제 로그, AI 오류센터, 핵심 로직 자가진단 결과, AI 엔진 진단, 홈 대표사진 입력/저장 영역을 10~11px 컴팩트 규격으로 일괄 축소해 가독성과 균형 개선",
      "전체 메뉴(홈·식단·일정·육아·냉장고·더보기) 구문·임포트·미선언 변수·배포 오류 최종 점검 완료"
    ]
  },
  {
    id: "patch-v13.80",
    version: "v13.80",
    date: "2026-11-24",
    title: "💌 쪽지 수신자 [관리자] 단일화 + 연락처 명칭 통일(관리자 : 01059147933) 및 확인상태 표시",
    highlights: [
      "불필요한 수신자 선택 버튼(전체/아빠/엄마) 제거 및 [관리자] 단일 수신으로 간소화해 시각적 피로도 최소화",
      "모든 연락처 표기를 [관리자 : 01059147933]으로 통일하고, 쪽지 창에 직전 보낸 쪽지의 관리자 확인 여부(확인됨/확인 대기) 표시 추가"
    ]
  },
  {
    id: "patch-v13.79",
    version: "v13.79",
    date: "2026-11-24",
    title: "📞 관리자 연락처 노출을 아빠(01059147933) 번호만 표시하도록 정리",
    highlights: [
      "더보기 메뉴·승인 대기 화면·쪽지 모달의 관리자 연락처에서 엄마 번호를 제거하고 아빠 : 01059147933만 깔끔하게 표시"
    ]
  },
  {
    id: "patch-v13.78",
    version: "v13.78",
    date: "2026-11-24",
    title: "🔧 최근 활동 권한 필터 즉시 반영 수정 + 관리자 쪽지함 [모두 읽음·답장·회원관리 연계] 고도화",
    highlights: [
      "버그 수정: visibleRecentActivities 메모이제이션 의존성에 helperRolePermissions·userProfile을 추가해 분류별/개별 메뉴 권한 변경 시 최근 활동 노출 필터가 즉시 반영되도록 개선",
      "관리자 쪽지함 고도화 & 메뉴 연계: [모두 읽음] 일괄 처리, 보낸 사람에게 [✉️ 답장] 메일 쓰기, [👤 회원관리]로 설정창 바로 열기 연계 추가 및 전체 코드 배포 오류 점검 완료"
    ]
  },
  {
    id: "patch-v13.77",
    version: "v13.77",
    date: "2026-11-24",
    title: "📎 [관리자에게 쪽지남기기] 사진·파일 첨부 및 관리자 쪽지함 미리보기·다운로드 지원",
    highlights: [
      "쪽지 작성 시 사진·PDF·문서 등 최대 3개 파일 첨부 지원(이미지 자동 압축 및 용량 초과 안내, 파일만 단독 전송도 가능)",
      "관리자 쪽지함에 첨부 이미지 미리보기(클릭 확대) 및 파일 다운로드 링크 추가"
    ]
  },
  {
    id: "patch-v13.76",
    version: "v13.76",
    date: "2026-11-24",
    title: "💌 비관리자 전용 [관리자에게 쪽지남기기] 메뉴·연락처 + 관리자 쪽지함 신설",
    highlights: [
      "비관리자(육아지원군·승인대기) 전용 [관리자에게 쪽지남기기] 메뉴 추가: 더보기 시트 및 승인 대기 화면에서 아빠·엄마·전체에게 쪽지를 보낼 수 있으며, 하단에 관리자 연락처(아빠 : 01059147933 · 엄마 : 01054984948, 1탭 전화 연결)를 작게 표시",
      "관리자 실시간 쪽지 수신 & 쪽지함: 도착한 쪽지를 홈 상단 배너 및 더보기 메뉴에서 즉시 확인·읽음 처리·삭제·메일 답장할 수 있도록 Firebase(admin_inbox_notes_v1 및 users) 이중 동기화"
    ]
  },
  {
    id: "patch-v13.75",
    version: "v13.75",
    date: "2026-11-24",
    title: "🛡️ [분류·권한 설정] 전용 팝업 신설 + 설정창 하단 지원군 권한표 제거",
    highlights: [
      "설정창 슬림화: 회원명단 아래에 길게 있던 육아지원군 메뉴 권한 표를 제거해 설정창 시각적 피로도를 대폭 낮춤",
      "[🛡️ 분류·권한 설정] 팝업 모달 신설: 분류 추가·삭제·분류명 일괄 변경(해당 회원 자동 반영)과 각 분류별 메뉴 열람·편집 권한 설정을 팝업 한 곳에서 관리하고 Firebase(access_config.helperRolePermissions)에 실시간 동기화"
    ]
  },
  {
    id: "patch-v13.74",
    version: "v13.74",
    date: "2026-11-24",
    title: "👥 회원명단 표 모바일 잘림 수정 + 회원 탈퇴(Firebase Auth 삭제) 및 인라인 2탭 삭제 적용",
    highlights: [
      "회원명단 표 오른쪽 잘림 수정: minmax(0, ...) 유연 그리드와 단일 [▾] 관리 열로 조정해 좁은 모바일 화면에서도 5열이 잘리지 않고 깔끔하게 표시([⚙️ 메뉴권한]은 행 펼침 내부로 통합)",
      "회원 탈퇴 처리 및 재가입/되살아남 차단: 회원 제거 시 role: withdrawn 처리 후 대상 기기에서 Firebase Auth deleteUser() 자동 실행, 인앱 브라우저에서 window.confirm 무반응 버그를 없앤 인라인 [⚠️ 탈퇴확정] 2탭 확인 도입"
    ]
  },
  {
    id: "patch-v13.73",
    version: "v13.73",
    date: "2026-11-24",
    title: "🔔 모달 위 토스트 알림 가림 버그 수정 + EmailJS [내 메일로 테스트] 버튼 추가",
    highlights: [
      "알림 토스트(toastMsg)·진행 배너(z-[9999]/[9998]) 및 활동 팝업(z-[9990]) 최상단 레이어 적용: 설정창 등 모달(z-50~z-[70]) 위에서도 알림이 가려지지 않고 선명하게 표시되며 2줄까지 자연스럽게 노출",
      "EmailJS 설정 카드에 [내 메일로 테스트] 버튼 추가 및 오류 상태코드·사유 토스트 안내 지원, 입력칸 글자 크기(10px) 미세 조정으로 긴 키 가독성 개선"
    ]
  },
  {
    id: "patch-v13.72",
    version: "v13.72",
    date: "2026-11-24",
    title: "📧 회원가입 확인 메일(Firebase Auth) 자동 발송 + 가입·승인 완료 안내 메일(EmailJS 자동 / mailto 1탭) 지원",
    highlights: [
      "이메일 회원가입 즉시 가입 확인 메일 자동 발송: Firebase Auth sendEmailVerification을 연동해 가입 직후 가입자 이메일로 확인 메일을 즉시 발송하며, 승인 대기 화면에서도 재발송 및 인증 상태 확인 지원",
      "가입·승인 완료 안내 메일 지원: 설정에 EmailJS(Service ID · Template ID · Public Key)를 등록하면 회원가입 직후 및 관리자 승인 시 완료 안내 메일이 백그라운드로 자동 발송되며, 미등록 시 회원 상세의 [✉️ 완료메일] 버튼으로 메일 앱(본문·앱주소 자동입력) 즉시 실행"
    ]
  },
  {
    id: "patch-v13.71",
    version: "v13.71",
    date: "2026-11-24",
    title: "👤 구글 로그인 사용자 이름 필수 입력(needsNameSetup) + 익명 계정 '새 사용자' 자동 생성 차단",
    highlights: [
      "익명 로그인 '새 사용자' 생성 차단: 이메일 없는 익명 세션(isAnonymous)이 users 컬렉션에 '새 사용자' 문서를 자동 생성하던 문제를 차단해 실제 이메일·구글 로그인 사용자만 회원 명단에 등록되도록 개선",
      "구글 로그인 사용자 이름 필수 입력: Google로 최초 로그인 시 앱에서 사용할 사용자 이름(호칭)을 직접 입력·확정해야 승인 대기 및 앱 이용이 진행되도록 전용 이름 설정 화면 추가 (대기 화면에서도 본인 이름 수정 가능)"
    ]
  },
  {
    id: "patch-v13.70",
    version: "v13.70",
    date: "2026-11-24",
    title: "🛡️ 회원 삭제·일괄삭제 시 선택/펼침/편집 상태 자동 정리 + 전체 코드·배포 무결성 최종 점검",
    highlights: [
      "회원 관리 상태 정합성 보강: 개별/일괄 회원 삭제 시 selectedUserUids·expandedUserUid·editingUserNameUid에 삭제된 UID가 남지 않도록 자동 초기화 처리",
      "전체 코드 최종 무결성 검증: button type 누락 0건, window.prompt/alert/console.log 0건, CSS 오타 0건, Babel JSX AST·미선언 식별자 0건, 리스너·타이머 누수 0건 확인 완료"
    ]
  },
  {
    id: "patch-v13.69",
    version: "v13.69",
    date: "2026-11-24",
    title: "🎨 설정창 색상 통일(무채색·세이지) · 백업버튼 초슬림화 · 경조사비 제거 + 회원명단 표·체크박스 일괄편집·클릭 전문보기",
    highlights: [
      "회원명단 표(테이블) 개편: 공통 헤더(☑️ | 성명 | 비고 | 권한 | 관리) 기반의 1줄 표로 정리하고, 체크박스 선택 시 다수 회원의 권한 일괄 변경 및 일괄 삭제(writeBatch) 지원",
      "긴 계정/UID 전문 보기: 표 내 긴 이메일·UID는 1줄 말줄임으로 깔끔히 유지하고 행 클릭 시 아래에 전문(이메일·UID)과 이름 수정·삭제·개별 권한 설정이 펼쳐지도록 개선",
      "설정창 시각적 피로도 최소화: 알록달록하던 원색 배너·버튼을 앱 공통 무채색(화이트/스톤) + 세이지그린(#3F624D) 톤으로 통일하고, 백업·복원 버튼 4종을 1줄 초슬림 버튼으로 축소했으며 설정 내 중복 경조사비 메뉴를 제거"
    ]
  },
  {
    id: "patch-v13.68",
    version: "v13.68",
    date: "2026-11-24",
    title: "🗺️ 네이버지도 앱(nmap:// · Android intent) 바로 실행 연결 (버킷리스트·일정·달력 상세 4곳)",
    highlights: [
      "네이버지도 앱 직접 연결(openNaverMapApp): Android(intent:// + com.nhn.android.nmap + 미설치 시 웹 자동 폴백)와 iOS(nmap:// + 웹 폴백), PC(웹 새 창)를 자동 판별해 모바일에서 바로 네이버지도 앱이 열리도록 구현",
      "좌표·검색 지능형 연동: 버킷리스트 등 좌표(lat/lng)가 있는 장소는 nmap://place 핀으로, 일정 장소는 nmap://search 검색으로 즉시 연결 (버킷 지도·버킷 목록·달력 하단 목록·조르테 일자 팝업 4곳 일괄 적용)"
    ]
  },
  {
    id: "patch-v13.67",
    version: "v13.67",
    date: "2026-11-24",
    title: "📍 일정 [자주 가는 장소] 원탭 프리셋 & 자유 관리(schedule_places) 추가 + 전수 무결성·메모리누수 0건 최종 검증",
    highlights: [
      "일정 등록 편의성·자유도 확장: 통합 일정 모달(ScheduleFormModal)의 장소 입력란 아래에 원탭 [빠른장소] 칩(이진소아과·신당동어린이집·친정·시댁·마트 등)과 [⚙️ 편집] 바로가기를 추가하고, 통합 분류 관리(schedule_places)에서 자유 추가·수정·삭제·순서이동·클라우드 동기화 지원",
      "UI 안전성·최종 전수 검증: 장소 입력란 min-w-0 보강, 이벤트 리스너(24:24)·타이머(4:4) 메모리 누수 0건, Babel JSX AST·미선언 식별자(ReferenceError)·CSS 오타 0건 최종 확인"
    ]
  },
  {
    id: "patch-v13.66",
    version: "v13.66",
    date: "2026-11-24",
    title: "🔐 경조사비 메뉴 [관리자 수혁] 전용 완전 격리 (타 계정 메뉴·버튼 비노출 및 Firestore 권한 오류 해결)",
    highlights: [
      "Firestore 구독 오류 근본 해결: 육아지원군 등 타 계정에서 발생하던 '경조사비 동기화 오류: Missing or insufficient permissions.'를 해결하기 위해 경조사비 실시간 구독(condolence_config_v1 · family_condolence_v1)을 isSuhyeokAdmin 전용 useEffect로 분리",
      "메뉴 및 진입점 100% 숨김: 더보기·설정·일정 D-Day·조르테 달력 팝업·가족공지·통합 카테고리 관리·백업/복원에서 경조사비 관련 모든 메뉴와 연계 버튼을 관리자 수혁(isSuhyeokAdmin) 로그인 시에만 노출",
      "비인가 접근 차단: 수혁 외 계정 전환·로그아웃 시 경조사비 잠금·메모리 상태를 즉시 초기화하고 해당 탭 접근 시 홈으로 자동 이동"
    ]
  },
  {
    id: "patch-v13.65",
    version: "v13.65",
    date: "2026-11-24",
    title: "🛡️ JSON 복원 맞춤분류 7종·트리펼침 클라우드 누락 수정 + 🩺 진료·증상 태그 자유관리 + 💌 경조사→🗂️ 공유노트 연계 + 홈 루틴필터 Firebase 이관",
    highlights: [
      "데이터 정합성 버그 수정: JSON 전체 복원(handleImportJson) 시 Firestore custom_categories_v1에 구 5종만 올라가고 경조사·상비약·수유태그·자주담기 등 신규 7종과 공유노트 펼침(expandedPageIds)이 누락되던 문제를 완전 수정",
      "시스템 자유도·편의성 확장: 육아 [🩺 진료·체온] 입력 폼에 원탭 증상·진료 태그(미열·고열·콧물·기침·소아과·해열제 등)와 [⚙️ 태그] 바로가기를 추가하고 통합 분류 관리(baby_health_tags)에서 자유 추가·수정·삭제 지원",
      "메뉴 연계·Firebase 이관: ① 경조사비 장부 상단에 [🗂️ 노트] 버튼을 추가해 현재 필터 기준 입출금 요약·내역을 공유노트 페이지로 1탭 저장 ② 홈 루틴 시간대·대상 필터(kim_home_routine_slot_v1·target_v1)를 Firestore(home_layout) 실시간 동기화로 이관"
    ]
  },
  {
    id: "patch-v13.64",
    version: "v13.64",
    date: "2026-11-24",
    title: "⚙️ 설정 모달 표·가로폭 확대 & 글씨 크기 슬림화 + 회원 리스트 2단 레이아웃(이름·이메일 잘림 완전 해소)",
    highlights: [
      "설정 모달 레이아웃 개편: 모달 가로폭을 max-w-sm→max-w-lg로 넓히고 다중 중첩 패딩(p-5→p-3.5)을 줄여 권한 매트릭스 표와 회원 리스트가 시원하게 표시되도록 개선",
      "회원 승인·권한 리스트 2단 재구성: 1행에 이름(11.5px)·이메일(10px) 전체를 배치하고 2행에 권한 드롭다운·개별권한(⚙️)·이름수정(✏️)·삭제(🗑️) 버튼을 분리해 이름·이메일 잘림 현상 완전 해소",
      "설정 전반 글씨 크기 축소(10~11.5px): 백업·AI 설정·권한 매트릭스 표·자가진단 등 설정 내 모든 텍스트와 행 높이를 컴팩트하게 축소해 한 화면 정보량과 가독성 향상"
    ]
  },
  {
    id: "patch-v13.63",
    version: "v13.63",
    date: "2026-11-24",
    title: "🛡️ 배포 JSX 오류({null})·식비 CSV 미선언(monthlyYm)·PWA prompt() 수정 + 수유메모/장보기 자유관리 + 월간식비 결산연계 + 공유노트 펼침 Firebase 이관",
    highlights: [
      "배포·런타임 버그 3종 수정: ① 홈 화면 JSX 중괄호 구문 오류({accessRole === 'guest' && ({null})}) 제거로 빌드 오류 완전 해소 ② 월간 식비 원장 [📊 CSV] 내보내기의 미선언 변수(monthlyYm→currentMonth) ReferenceError 수정 및 필터명 파일명 반영 ③ 관리자 설정 사용자 이름 수정의 구식 window.prompt()를 모바일 PWA 호환 인라인 입력 UI로 교체",
      "시스템 자유도 확장: 통합 ⚙️ 분류 관리에 [🍼 수유메모 태그](트림 함·유산균 등) 및 [🛒 자주사는 품목](계란|1판|유제품/계란 등) 2종을 추가해 자유 추가·수정·삭제·순서이동·기본복원 및 Firestore 실시간 동기화 지원",
      "메뉴 연계·시각 최적화·Firebase 이관: ① 월간 식비 가계부에 [🗂️ 결산노트]·[📌 공지] 원탭 공유 연계 추가 ② 경조사비 상단 불필요 안내 문구 제거 및 다수 드롭다운 min-w-0 truncate 보강 ③ 공유노트 폴더 펼침 상태(kim_pages_expanded_v1)를 Firestore(home_layout.expandedPageIds) 실시간 동기화로 이관"
    ]
  },
  {
    id: "patch-v13.62",
    version: "v13.62",
    date: "2026-11-24",
    title: "⚡ 경조사비 대용량(100건+) 부분합·목록 스마트 접기/더보기 최적화 + 일정 분류 드롭다운 넘침 방지",
    highlights: [
      "성능·시각적 피로도 최소화: 경조사비 인별 부분합(15건 초과 시 접기/전체보기) 및 입출금 내역 목록(40건 단위 더보기/전체보기)에 스마트 페이지네이션을 적용해 엑셀 대량 가져오기 후에도 모바일 스크롤이 쾌적하게 유지되도록 개선",
      "UI 교정: ScheduleFormModal 카테고리 드롭다운에 min-w-0 truncate를 적용해 긴 맞춤 일정 분류명 선택 시 모달 가로 넘침 방지 및 전체 Babel AST·ReferenceError 0건 검증 완료"
    ]
  },
  {
    id: "patch-v13.61",
    version: "v13.61",
    date: "2026-11-24",
    title: "🔐 [🗓️ 일정] · [🔄 루틴] 권한 완전 분리 (미로그인/지원군 열람·편집 개별 제어 + 홈·달력·서브탭·알림 자동 격리)",
    highlights: [
      "권한 매트릭스 분리: ⚙️ 설정의 [메뉴 | 미로그인 | 지원군열람 | 지원군편집] 표에서 [🗓️ 일정(달력·할일·D-Day)]과 [🔄 루틴(반복 루틴)]을 완전히 분리해 각각 독립적으로 열람·편집 허용 가능",
      "전 화면 자동 연동: 루틴만 허용 시 홈 [행동 피드]에 루틴만 노출되고 3일내 일정·할일은 숨김 처리되며, 하단 [일정/루틴] 탭 클릭 시 자동으로 [🔄 루틴]으로 직행하고 달력·할일·D-Day·수정알림은 잠금 보호"
    ]
  },
  {
    id: "patch-v13.60",
    version: "v13.60",
    date: "2026-11-24",
    title: "🗓️ 가족일정·개인일정 입력 화면 완전 통합 + 개인일정 분류(할일 To-Do·일반일정 등) 선택 & 할일/홈 연동",
    highlights: [
      "가족·개인 일정 입력 화면 통합: 기존 분리되어 있던 개인일정 모달을 통합 ScheduleFormModal로 일원화해 상단 [🏠 가족 일정 | 🔒 내 개인일정] 1탭 전환과 동일한 날짜·기간·시간·장소·분류·메모 UI 제공",
      "개인일정 분류 선택 및 할일(To-Do) 연동: 개인일정도 가족일정과 동일하게 분류(할일(To-Do)·가족행사/경조사·육아/병원·기념일/생일 및 맞춤 분류)를 선택할 수 있으며, 개인 할일은 일정 [✅ 할 일] 탭과 홈 [남은 할 일]에 🔒 배지로 함께 표시·체크 가능",
      "버그·연계 보완: 개인일정→가족일정 이동(handleConvertPrivateToFamily) 시 장소(location)·분류(category) 유실 방지 및 중복 모달(PrivateCalFormModal) 제거로 코드 경량화·AST 무결성 0건 통과"
    ]
  },
  {
    id: "patch-v13.59",
    version: "v13.59",
    date: "2026-11-24",
    title: "🛡️ 냉장고 소비기한 v3 동기화 누락 버그 수정 · 장보기 일괄입고/비우기 200건 배치 분할 · 경조사비 개별 내역 1탭 복사",
    highlights: [
      "버그 수정: ① 냉장고 퀵시트 소비기한 변경(handleQuickUpdateFridgeExpiry)에서 v3 키 오참조(fridgeMap.v3→fridgeMap.src_1)로 구버전 재고 기한이 서버에 반영되지 않던 버그 수정 ② 장보기→냉장고 일괄 입고(fridgeMap.local 단일화 및 150건 분할 배치)·체크 완료 일괄 비우기(200건 분할 배치) 안전화",
      "편의성·백업: ① 경조사비 각 내역 카드에 1탭 [📋] 복사 버튼 추가 ② 김수혁 관리자 전체 JSON 백업·복원에 경조사비 비밀번호(condolencePin) 포함"
    ]
  },
  {
    id: "patch-v13.58",
    version: "v13.58",
    date: "2026-11-24",
    title: "🐛 장보기→냉장고 일괄입고 상태구조/수량단위 버그 수정 + 경조사비 입력 시 기존 인물 주고받은 이력 자동힌트 + 공지→경조사 연계",
    highlights: [
      "핵심 버그 수정: 장보기 [❄️ 냉장고에 바로 넣기](handleMoveCheckedShoppingToFridge) 시 fridgeMap 최상위에 잘못 저장되어 즉시 화면에 반영되지 않던 상태 구조 버그를 prev.v4/prev.local로 수정하고, 품목 수량 문자열('2팩' 등) 자동 분리 및 맞춤 카테고리 반영 보완",
      "사용자 편의성·고도화: 경조사비 내역 추가·수정 시 성명 입력란에 기존 동일 인물(또는 부분 일치)의 주고받은 이력(날짜·입출금·금액·카테고리) 힌트를 자동 표시해 답례 금액 결정 지원",
      "메뉴 연계: 가족공지 카드에 '경조사/축의/조의/결혼/장례' 키워드가 포함된 경우 1탭 [💌 경조사] 바로 기록 버튼 자동 표시 및 Babel AST·ReferenceError 0건 검증 완료"
    ]
  },
  {
    id: "patch-v13.57",
    version: "v13.57",
    date: "2026-11-23",
    title: "🛡️ 살림수첩 맞춤 수납장소·상비약대상 동적 초기값 완결 + 월간 식비 가계부 원장 1탭 엑셀(.csv) 내보내기 추가",
    highlights: [
      "버그 수정: 살림수첩 등록·저장(openHouseModal·handleSaveHouseItem) 시 기본 수납장소('거실')·상비약 대상('공통')이 하드코딩돼 있던 부분을 사용자 맞춤 목록(houseStorageRooms[0]·houseMedTargets[0]) 기반으로 동적화해 기본 분류 삭제·변경 시에도 고아 값이 생기지 않도록 완결",
      "편의성·고도화: 월간 식비 가계부 지출 원장 헤더에 현재 필터 기준(월·카테고리·검색어)으로 엑셀 호환 UTF-8 BOM 파일(합계 행 포함)을 즉시 저장하는 [📊 CSV] 1탭 내보내기 버튼 추가",
      "최종 검증: Babel JSX AST 0오류 · ./Constants 111개 export 1:1 일치 · 전체 파일 미선언 함수 호출(ReferenceError) 0건 통과"
    ]
  },
  {
    id: "patch-v13.56",
    version: "v13.56",
    date: "2026-11-23",
    title: "🛡️ 경조사비 일괄그룹 클릭간섭 수정·대용량 분류변경 200건 배치분할 + 부분합 1탭복사·상비약 대상 바로관리·카테고리 탭 균형정렬",
    highlights: [
      "버그 수정: ① 경조사비 [☑️ 일괄그룹] 모드에서 카드 내 [🗓️ 일정·✏️ 수정·삭제·성명] 클릭 시 체크박스까지 함께 토글되던 이벤트 전파 버그 수정 ② 새 엑셀 파일 선택 시 이전 그룹 입력값 자동 초기화 ③ 카테고리 이름변경 일괄 갱신을 전 컬렉션 200건 분할 배치(Firestore 500건 한도 안전)로 보강",
      "편의성·시각 최적화: ① 경조사비 [📊 부분합 · 총계] 헤더에 현재 집계표(카테고리/그룹/인별/연도별) 1탭 [📋] 복사 버튼 추가 ② 살림수첩 상비약 필터 옆에 [⚙️ 대상] 바로가기 추가 ③ 통합 카테고리 관리 모달 탭을 균형 줄바꿈(flex-wrap)으로 정리해 빈 칸(고아 행) 제거"
    ]
  },
  {
    id: "patch-v13.55",
    version: "v13.55",
    date: "2026-11-23",
    title: "🛡️ 공지 수정 분류보호·엑셀 결제수단 자동등록 + 경조사비 일괄삭제·인별 주고받기 배너 + 달력팝업→경조사비 연계 + 상비약 대상 자유관리",
    highlights: [
      "버그 수정: ① NoticeFormModal(공지 수정)에 삭제된 기존 분류 유지 fallback 옵션을 추가해 예전 공지 수정 시 분류가 임의 변경되던 버그 수정 ② 엑셀 가져오기 시 신규 결제수단(예: 화환)도 커스텀 결제수단 목록에 자동 등록되도록 보완",
      "경조사비 고도화·편의성: ① [☑️ 일괄그룹] 모드에 [🗑️ 선택 N건 삭제](200건 분할 배치 삭제) 추가 ② 인별 필터 선택 시 해당 인물과 주고받은 입금·출금·차액 요약 배너 및 [+ 바로 추가] 버튼 표시",
      "메뉴 연계·자유도 확장: ① 조르테 달력 일자 팝업 상세에서 [가족행사/경조사] 일정일 때 1탭 [💌 경조사비] 바로가기 추가 ② 살림수첩 [💊 상비약 대상](공통·시목·시율·어른 등)을 통합 ⚙️ 분류 관리 모달에 편입해 자유 추가·이름수정(기존 약품 일괄 갱신)·삭제·순서이동·Firebase 실시간 동기화 지원"
    ]
  },
  {
    id: "patch-v13.54",
    version: "v13.54",
    date: "2026-11-23",
    title: "🛠️ .xlsx 업로드 parseZip ReferenceError 즉시 수정(parseZipEntriesInBrowser 연결) + 경조사비 플로팅(+) 가림 해소·안내문구 줄바꿈 정리",
    highlights: [
      "긴급 버그 수정: .xlsx 멀티시트 파서(parseXlsxWorkbookSheets)가 내장 ZIP 파서 함수명(parseZipEntriesInBrowser)을 parseZip으로 잘못 호출해 발생하던 ReferenceError 즉시 수정 및 전체 코드 미선언 식별자 AST 전수 점검 완료",
      "시각 최적화: 경조사비 탭에서 우측 하단 플로팅(+) 버튼이 부분합 표를 가리던 현상을 자동 숨김 처리하고, 엑셀 모달 안내 문구의 어색한 1글자 줄바꿈('니다.')을 1줄로 슬림화"
    ]
  },
  {
    id: "patch-v13.53",
    version: "v13.53",
    date: "2026-11-23",
    title: "🤖 경조사비 네이티브 .xlsx 멀티시트·AI 구조 자동인식 + 일괄기재(결혼식·날짜·구분) + 필터·체크 인원 일괄 그룹핑",
    highlights: [
      "네이티브 .xlsx 멀티시트 파싱 + AI 자동 구조 인식: 추가 라이브러리 없이 .xlsx(멀티시트 선택 지원)/.xls/.csv 파일을 읽고, 내장 AI(Gemini/GPT)가 비정형 헤더·합계행·컬럼(성명·Amount·중분류·소분류·Group·입금방식 등)을 자동 판별 (AI 키 미설정 시 스마트 휴리스틱 자동 폴백)",
      "엑셀 가져오기 일괄 기재 패널: 파일에 없는 결혼식 카테고리·거래일(결혼기념일 1탭)·입출금 구분·당사자·그룹·메모를 일괄 지정해 미리보기 즉시 반영 및 중복 실시간 재계산",
      "필터·체크박스 인원 일괄 그룹핑: 메인 경조사비 장부([☑️ 일괄그룹])와 엑셀 가져오기 미리보기 양쪽 모두에서 검색·필터로 인원을 좁혀 체크한 뒤 기존 그룹 또는 즉석 새 그룹으로 1탭 일괄 배정(Firebase 배치 동기화)",
      "UI·배포 점검: 육아 수유·일기 드롭다운(activityDateFilter·diaryMonthFilter) min-w-0 truncate 보강 및 Babel AST·import/export 1:1 검증 0오류 통과"
    ]
  },
  {
    id: "patch-v13.52",
    version: "v13.52",
    date: "2026-11-23",
    title: "🛡️ 경조사비 일정연계 잠금해제 자동이어쓰기·필터 엑셀출력·결제수단 자유관리 + 공유노트 최근항목 Firebase 이관 + 드롭다운 줄바꿈 교정",
    highlights: [
      "버그 수정: ① 경조사비 잠금 상태에서 일정(가족행사/경조사)→💌 경조사 버튼 클릭 시 비밀번호 해제 직후 해당 날짜·메모가 자동 채워진 등록창이 이어 열리도록 보완 ② 경조사비 삭제 실패 롤백 시 로컬 캐시 동시 복구",
      "기능 고도화·자유도 확장: ① 경조사비 엑셀 모달에 [현재 필터 적용분만 엑셀(.xls)/CSV 내보내기] 추가 ② 경조사비 결제수단(계좌이체·현금·선물 등)을 통합 ⚙️ 분류 관리에 편입해 자유 추가·이름수정(기존 내역 일괄 갱신)·삭제·순서이동 지원",
      "줄바꿈·시각 최적화: 냉장고 다중이동·레시피 난이도/정렬 드롭다운에 min-w-0 truncate를 적용하고 공통 상태 버튼에 whitespace-nowrap을 보강해 모바일 넘침·줄바꿈 제거",
      "로컬→Firebase 추가 이관: 공유노트 최근 열람 목록(kim_pages_recent_v1)을 Firestore(home_layout.recentPageIds) 실시간 동기화로 이관"
    ]
  },
  {
    id: "patch-v13.51",
    version: "v13.51",
    date: "2026-11-23",
    title: "🔒 비밀메뉴 [경조사비 입출금내역] 신설(비번 247233·김수혁 전용 변경·엑셀 클라우드 입출력·부분합/총계) + 전수 버그수정·Firebase 이관",
    highlights: [
      "비밀메뉴 [💌 경조사비 입출금내역] 신설: 홈 화면에는 비노출(더보기 하단·설정 진입), 열람 비밀번호(기본 247233) 잠금 및 김수혁 관리자 전용 비밀번호 변경(Firestore 실시간 동기화)",
      "카테고리·그룹·인별·당사자·결제수단·메모 기록, 다차원 검색·필터, 전체 총계·필터 부분합·카테고리/그룹/인별/연도별 부분합 집계표(행 클릭 즉시 필터) 및 분류·그룹 자유 추가·수정·삭제 지원",
      "클라우드 기반 엑셀(.xls 2시트: 내역+부분합요약 / .csv UTF-8 BOM) 내보내기 및 엑셀/CSV 가져오기(중복 자동 제외·200건 분할 배치 저장) 구현, 일정(가족행사/경조사)↔경조사비 양방향 연계 추가",
      "버그·안정화: 살림수첩 수납장소 이름변경 시 잘못된 Firestore 컬렉션(family_house_v1→family_house_items_v1) 쓰기 치명 버그 수정, 카테고리 순서이동 권한 가드 추가, 달력 헤더 추가 시 endDate/time/location 누락 수정, 버킷/레시피 필터 드롭다운 넘침 방지",
      "로컬→Firebase 추가 이관: 월간 백업 완료월(kim_backup_done_month) 및 루틴 보기모드(kim_routine_view_mode_v1)를 Firestore 실시간 동기화로 이관"
    ]
  },
  {
    id: "patch-v13.50",
    version: "v13.50",
    date: "2026-11-23",
    title: "맞춤 카테고리 삭제·변경 시 폼 초기값/기존항목 보호 완결 + 냉장고 모달 드롭다운 넘침 방지",
    highlights: [
      "장보기·버킷·살림수첩·가족공지 등록 및 메뉴 연계 6곳의 기본 분류·수납장소 초기값을 사용자 맞춤 목록(fridgeCategories·bucketCategories·noticeCategories·houseStorageRooms) 기반으로 동적화해 기본 분류를 삭제·변경해도 고아 값이 생기지 않도록 보완",
      "냉장고·장보기·버킷·레시피 수정 드롭다운에 기존 분류 유지 fallback 옵션을 추가해 삭제된 예전 분류 항목을 수정할 때 분류가 임의로 바뀌지 않도록 보호",
      "냉장고 등록 모달의 카테고리 드롭다운에도 너비 제한(w-full min-w-0 truncate)을 적용해 긴 맞춤 분류명 선택 시 모달 가로 넘침 방지"
    ]
  },
  {
    id: "patch-v13.49",
    version: "v13.49",
    date: "2026-11-23",
    title: "식단·냉장고→레시피 필터 꼬임 버그 수정 + 일별 식단 가족공지 공유 + 식단 인원 바 개선",
    highlights: [
      "식단(handleMealToRecipe)이나 냉장고(handleFridgeToRecipeSearch)에서 레시피북으로 이동할 때 이전 레시피 카테고리 필터가 남아 검색 결과가 비어 보이던 버그를 '전체' 자동 초기화로 수정",
      "할 일→장보기 변환(handleTodoToShopping) 시 맞춤 재료 카테고리에 맞춘 안전한 동적 분류 fallback 적용",
      "오늘 식단 상단 고정 인원 바를 가로 스크롤 대신 줄바꿈(flex-wrap)·세이지 톤(#3F624D)으로 정리하고, 일별 식단 카드에 '📌 가족공지 공유' 원탭 버튼 추가"
    ]
  },
  {
    id: "patch-v13.48",
    version: "v13.48",
    date: "2026-11-23",
    title: "레시피 사진 확대·사진입고·카테고리 모달 ESC/뒤로가기 완전 연동 + 루틴·예방접종 필터 시인성 개선",
    highlights: [
      "레시피 사진 확대 라이트박스(zoomedRecipePhoto)를 모바일 뒤로가기·배경 스크롤 잠금(anyOverlayModalOpen)·ESC 핸들러에 완전 연동",
      "ESC 키 닫기 핸들러 및 의존성 배열에서 빠져 있던 장보기 사진입고(isShoppingPhotoModalOpen)·통합 카테고리 관리(categoryManageKind) 모달을 보완",
      "루틴 시간대 필터('+ 예정' 칩 포함)와 육아수첩 예방접종 유형 필터를 가로 스크롤 대신 줄바꿈(flex-wrap)과 세이지 톤(#3F624D)으로 정리해 한눈에 보이도록 개선"
    ]
  },
  {
    id: "patch-v13.47",
    version: "v13.47",
    date: "2026-11-23",
    title: "가계부 인라인 예산 편집·원장 줄바꿈 개선 + 알림 팝업 Firebase 동기화 이관 + 살림수첩 공지 연계",
    highlights: [
      "월간 식비 가계부 예산 수정 시 구식 브라우저 prompt() 팝업을 제거하고, 카드 내 인라인 숫자 입력창과 빠른 프리셋(80·100·120·150만)으로 개편",
      "지출 원장 헤더의 필터 합계 배지와 복사 버튼 줄바꿈(flex-wrap)을 정리하고, 지출 카테고리 칩을 가로 스크롤 대신 개수 표시 + 줄바꿈으로 개선",
      "새 수정 알림 팝업 ON/OFF(activityPopupEnabled) 설정을 Firebase 실시간 동기화(home_layout) 및 JSON 백업·복원으로 추가 이관",
      "살림수첩 보증·AS 및 상비약 카드에도 '📌 공지' 원탭 공유 버튼을 추가해 수납·보증·상비약 3개 탭 모두 공지 연계 완성"
    ]
  },
  {
    id: "patch-v13.46",
    version: "v13.46",
    date: "2026-11-23",
    title: "로컬 전용 가족 설정 3종 Firebase 실시간 동기화 이관 + 인수인계 맞춤 가이드 동기화 버그 수정",
    highlights: [
      "전체 49개 localStorage 키를 전수 감사해 로컬 기기에만 남던 가족 공유 설정 3종(인수인계 전달 메모, 인수인계 첨부 공유노트, 홈 어제 미완료 루틴 이월 표시 ON/OFF)을 Firebase Firestore 실시간 동기화 및 JSON 백업·복원으로 이관",
      "인수인계 고정 가이드(handover_profile_v1) 실시간 수신 시 사용자 맞춤 항목(customItems)이 누락되던 치명 동기화 버그를 수정해 기기 간 맞춤 가이드가 완벽히 유지되도록 보강"
    ]
  },
  {
    id: "patch-v13.45",
    version: "v13.45",
    date: "2026-11-23",
    title: "레시피 리스트 모바일 제목 잘림 해소 + 🛒 냉장고 대조 부족재료 원탭 담기 연계",
    highlights: [
      "레시피 리스트 뷰에서 사진·제목·버튼 5개가 한 줄에 몰려 요리명이 2~3글자로 잘리던 레이아웃을 상단 정보 + 하단 액션 바 2단 구조로 개편해 시인성 대폭 개선",
      "레시피 재료와 현재 냉장고 보유 재고를 자동 대조해 없는 재료만 골라 장보기에 일괄 입고하는 '🛒 부족재료' 원탭 연계 기능 추가",
      "레시피 수정 버튼의 권한 체크에 탭 키('recipes')를 명시해 도우미·세부 권한 설정 시 정상 동작하도록 수정"
    ]
  },
  {
    id: "patch-v13.44",
    version: "v13.44",
    date: "2026-11-23",
    title: "월 목표 식비 예산 가족 클라우드 실시간 동기화 + 잔여 일정 등록 6개소 위치·시간 초기화 + 성장차트 모바일 넘침 수정",
    highlights: [
      "월 목표 식비 예산(monthlyBudget)을 Firestore 실시간 동기화 및 JSON 전체 백업/복원에 편입해 수혁·아리 기기 간 예산이 자동 일치하도록 개선 (쉼표 포함 입력 '1,200,000'도 정상 인식)",
      "버킷 지도 상세(주소 자동 전달)·공유노트·육아 진료메모·FAB 빠른추가·냉장고 기한알림(칸 위치 전달) 등 잔여 6개 일정 등록 진입점의 시간·기간·장소 필드를 100% 일관화",
      "육아수첩 성장차트에서 백분위 4~5개 선택 시 우측 확대보기 버튼이 화면 밖으로 밀리던 현상을 flex-wrap 및 라벨 최적화로 해소"
    ]
  },
  {
    id: "patch-v13.43",
    version: "v13.43",
    date: "2026-11-23",
    title: "공지 작성자 매핑 버그·영수증 AI 동적 분류 수정 + 살림수첩 보증일정 연계 + 6종 통합 카테고리 관리",
    highlights: [
      "공지 등록 모달 작성자 값이 '수혁/아리' vs '김수혁/최아리나' 불일치로 아리 작성 시 수혁으로 표기되던 버그를 정규화해 7개 공지 공유 진입점 전체 수정",
      "마트 영수증 AI 스캔 프롬프트의 정적 분류 목록을 사용자 맞춤 재료 카테고리(fridgeCategories)로 동적 연동",
      "공지·버킷·레시피 모달의 카테고리 드롭다운에 너비 제한(min-w-0 w-full truncate)을 적용해 긴 맞춤 분류명 선택 시 모달 가로 넘침 방지",
      "살림수첩 보증·AS 카드에 '🗓️ 보증일정' 원탭 등록 버튼을 추가하고, 수납지도 필터를 개수 표시+줄바꿈(flex-wrap)으로 개선하며 통합 카테고리 관리에 6번째 '🏠 수납 장소' 탭(3×2 그리드)을 편입"
    ]
  },
  {
    id: "patch-v13.42",
    version: "v13.42",
    date: "2026-11-23",
    title: "장보기 화면 가로 넘침·중복 버튼 정리 + 카테고리별 필터·⚙️ 관리 추가",
    highlights: [
      "장보기 상단 헤더의 중복 복사(📋) 버튼을 제거하고 줄바꿈 허용(flex-wrap)·금액 표기 축약으로 모바일 우측 튀어나감 완전 해소",
      "품목 등록 폼 및 사진입고 모달의 카테고리 드롭다운 너비를 고정해 긴 분류명 선택 시 메모·급함 버튼이 밀리던 현상 수정",
      "장보기 목록에 카테고리별 개수 필터 칩과 '⚙️ 관리' 바로가기를 추가하고, AI 문장 분석에도 사용자 맞춤 카테고리를 동적 연동",
      "급함 필터 적용 중 마지막 급함 품목을 체크했을 때 필터 버튼이 사라져 빈 목록에 갇히던 상태 버그 수정"
    ]
  },
  {
    id: "patch-v13.41",
    version: "v13.41",
    date: "2026-11-23",
    title: "오늘 일정 실시간 카운트다운('N시간 N분 전') + 📸 손글씨 메모·사진 AI 스캔 장보기 입고",
    highlights: [
      "오늘 일정·할 일에 시간이 등록되어 있으면 현재 시각 기준으로 '4시간 12분 전', '35분 전', '지금 시작', '1시간 지남' 실시간 카운트다운 배지를 홈 3일 내 일정·홈 남은 할 일·달력 팝업·달력 하단 목록에 자동 표시",
      "장보기 탭에 '📸 사진입고' AI 스캔 기능을 추가해 냉장고 손글씨 메모·화이트보드·목록 사진을 올리면 복합 항목(예: '장조림 - 고기, 메추리알')까지 자동 분리·분류해 체크 후 일괄 담기 지원 (이미 담긴 품목 중복 자동 감지)"
    ]
  },
  {
    id: "patch-v13.40",
    version: "v13.40",
    date: "2026-11-23",
    title: "공지 공유 6개소 분류 버그 일괄 수정 + 가족↔개인 일정 변환·빠른등록 고도화 + 달력/할일 지도 연계",
    highlights: [
      "버킷리스트·살림수첩·레시피·루틴·인수인계·공유노트 6개소에서 공지 공유 시 잘못된 분류('가족공지')로 저장되어 필터에 걸리지 않던 버그를 동적 공지 카테고리로 일괄 수정",
      "가족↔개인 일정 복사·변환 시 시간(time)·종료일(endDate)·장소(location)가 유실되거나 메모에 섞이던 문제를 완전 복구",
      "달력 일자 팝업 1줄 빠른등록에서 '16:30', '4시반', '오전 10시' 등 시간 표현을 자동 파싱해 시간 필드에 저장하도록 고도화",
      "버킷리스트→일정(주소 자동 입력), 살림수첩→일정(수납 위치 자동 입력), 달력 하단 목록(⏰시간·📍장소·네이버지도 원탭 링크), 홈 남은 할 일(시간·장소 표시 및 복사) 연계 강화"
    ]
  },
  {
    id: "patch-v13.39",
    version: "v13.39",
    date: "2026-11-23",
    title: "일정 ⏰시간·📍장소 선택 등록 + 네이버지도 연계 + 홈 시간대 바 잘림 수정 + 🗓️ 일정 분류 자유 관리",
    highlights: [
      "일정 등록·수정 모달에 선택 입력 필드(⏰ 시간 + 빠른시간 5종 칩, 📍 장소)를 추가해 제목에 시간·장소를 억지로 적지 않아도 깔끔하게 기록 가능",
      "홈 3일 내 일정(시간순 정렬·복사), 달력 일자 팝업(원탭 🗺️ 네이버지도 길찾기·장소 복사), 할 일 카드, 오늘 브리핑 복사, 육아 인수인계 타임테이블·리스트, 가족공지 전환에 시간·장소 전면 연계",
      "홈 상단 시간대 전환 바의 '🌙 밤' 칩이 '📋 브리핑' 버튼에 가려 잘리던 모바일 폭 이슈를 '자동·오전' 축약 및 간격 최적화로 완전 해소",
      "세부 카테고리 통합 관리(⚙️)에 5번째 '🗓️ 일정 분류'를 추가해 달력 필터·일정 모달 분류를 자유롭게 추가·이름변경(기존 일정 일괄 반영)·삭제·순서변경 가능"
    ]
  },
  {
    id: "patch-v13.38",
    version: "v13.38",
    date: "2026-11-23",
    title: "🛡️ 카테고리 모달 뒤로가기/스크롤잠금 누락 수정 · 잔여 CSS 오타(py-0.2) 0건 완결 · 📌 공지 분류 필터 & 설정 통합 관리 연계",
    category: "버그 수정 · 편의성 · 메뉴 연계",
    changes: [
      "버그·CSS 정합성 수정: ① anyOverlayModalOpen에 통합 카테고리 관리 모달(categoryManageKind)을 추가해 안드로이드 뒤로가기 닫기 및 모달 배경 스크롤 잠금이 정상 작동하도록 수정 ② 월간 식단·반복 루틴에 남아 있던 오타 클래스 py-0.2 3곳을 py-0.5로 교정해 앱 전체 오타 클래스 0건 달성",
      "가족공지 카테고리 필터 신설: 공지 탭에 건수 포함 멀티줄 분류 필터 칩(전체·사용자 커스텀 분류)을 추가하고 이름 수정·삭제 시 필터 자동 동기화 및 필터 초기화 연동",
      "메뉴 연계 및 최종 검증: ⚙️ 설정 모달에 [⚙️ 앱 세부 분류 통합 관리(재료·레시피·공지·버킷)] 1탭 바로가기를 추가하고 esbuild 번들·Babel JSX AST·Node ESM 구문 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.37",
    version: "v13.37",
    date: "2026-11-23",
    title: "🌟 버킷리스트 카테고리 자유 관리 통합(4종 분류 관리) · 인수인계 PNG 카드 아이별 추가가이드 반영 · 카테고리 모달 ESC/뒤로가기 연동",
    category: "버그 수정 · 자유도 확장 · 안정화",
    changes: [
      "통합 세부 카테고리 자유 관리 4종 확장: 기존 재료·레시피·공지에 [🌟 버킷리스트] 분류까지 통합해 추가·이름 수정(기존 항목 자동 일괄 갱신)·삭제·순서 이동·기본복원 및 클라우드/JSON 백업 동기화 지원",
      "인수인계 PNG 카드 정합성 버그 수정: 카톡 텍스트에는 포함되던 아이별(시목·시율) 추가 고정가이드 항목과 공통 추가가이드·출입안내 단독 기재 케이스가 PNG 이미지 카드에도 100% 동일하게 렌더링되도록 보완",
      "모달 닫기 일관화 및 최종 검증: 통합 카테고리 관리 모달을 ESC 키 및 안드로이드 뒤로가기 닫기에 연동하고 esbuild 번들·Babel JSX AST·Node ESM 구문 검사 0건 통과"
    ]
  },
  {
    id: "patch-v13.36",
    version: "v13.36",
    date: "2026-11-23",
    title: "🤝 홈 [가족 기록·소통] 인수인계 카드 추가 · 고정가이드 항목 자유 추가/수정/삭제 · 카톡 미리보기 1탭 원본 수정 & 미기재 바로추가",
    category: "신규 기능 · 자유도 고도화 · 메뉴 연계",
    changes: [
      "홈 [🗂️ 가족 기록 · 소통] 그룹에 [🤝 육아 인수인계] 바로가기 카드 추가 (공유노트·가족공지·버킷리스트·인수인계 2×2 균형 배치 및 기존 레이아웃 자동 편입)",
      "인수인계 고정가이드 자유도 고도화: 시율·시목·집/산모별로 원하는 고정가이드 항목을 자유롭게 [+ 항목 추가]·제목/내용 수정·삭제 가능 (클라우드 family_meta_v4/handover_profile_v1 실시간 동기화 및 카톡 복사·PNG 카드·JSON 백업 자동 반영)",
      "카톡 미리보기 인터랙티브 링크화: 시간표 내 루틴·식단·일정 및 고정가이드·공지·상비약·수납 항목을 누르면 해당 원본 수정 창으로 1탭 직행(수정 후 인수인계로 복귀), 미기재 항목도 프리뷰 하단 바로추가 링크로 즉시 입력 가능하며 실제 카톡 복사·카드저장 시에는 공란/미기재 항목이 자동 제외되어 깔끔하게 출력"
    ]
  },
  {
    id: "patch-v13.35",
    version: "v13.35",
    date: "2026-11-22",
    title: "⚙️ 재료·레시피·가족공지 카테고리 자유 관리(추가·수정·삭제·순서이동·클라우드 동기화) & 레시피 분류 한눈에 보기",
    category: "신규 기능 · 자유도 고도화 · 버그 수정",
    changes: [
      "통합 카테고리 자유 관리(⚙️ 분류) 신설: 냉장고 재료·레시피북·가족공지 세부 카테고리를 자유롭게 추가·이름 수정·삭제·순서 이동(▲▼)·기본복원 가능 (이름 변경 시 기존 냉장고·장보기·레시피·공지 항목의 카테고리명도 자동 일괄 갱신, Firestore family_meta_v4/custom_categories_v1 실시간 동기화 및 JSON 백업/복원 포함)",
      "레시피북 분류 시인성 개선: 가로 스크롤에 잘리던 레시피 카테고리 바를 냉장고와 동일한 건수 포함 멀티줄 그리드로 개편해 모든 분류를 한눈에 확인·선택 가능",
      "버그 수정 및 최종 검증: 일정→가족공지 공유(handleScheduleToNotice) 시 존재하지 않던 카테고리명('가족공지'→'일정/행사')으로 들어가던 오류 수정 및 esbuild 번들·Babel JSX AST·Node ESM 구문 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.34",
    version: "v13.34",
    date: "2026-11-22",
    title: "✅ 할 일(To-Do) 중복 추가버튼 제거·UI 슬림화 · ❄️ 냉장고 분류 필터 한눈에 보기 & 임박/보관구역 시인성 개편",
    category: "UI 리디자인 · 시각 최적화 · 버그 수정",
    changes: [
      "할 일(To-Do) 화면 전면 정돈: 상단과 입력창에 중복되던 [+ 추가] 버튼을 단일 인라인 [+ 추가](+ 상세 모달 연결)로 일원화하고, 불필요한 '표시: 할일만' 행과 중복 '· 할일(To-Do)' 문구를 제거했으며 세이지그린(#3F624D) 톤과 1줄 제목·D-Day 배치로 압축 (오타 CSS py-0.2 2곳 동시 수정)",
      "냉장고 시인성·분류 필터 대폭 개선: 임박·경과 재료 배너와 냉장실/냉동실/실온 3칸 카드의 과도한 글자 크기와 여백을 컴팩트하게 축소('D-0'→'오늘' 교정), 전체/리스트·칸별/복사/추가 바를 1줄로 통합하고, 가로 스크롤에 가려지던 재료 분류별 필터를 건수 포함 멀티줄 그리드로 전환해 모든 분류를 한눈에 확인 가능",
      "버그 수정 및 최종 검증: 냉장고 재고 복사(📋) 시 [⏰ 임박만] 필터가 누락되던 오류 수정 및 esbuild 번들·Babel JSX AST·Node ESM 구문 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.33",
    version: "v13.33",
    date: "2026-11-22",
    title: "🛡️ 일정→공지 다일정·D-Day 반영 · 주간일정 CSS/줄바꿈·모달 헤더 겹침 방지 · D-Day 다음기념일 달력 직행",
    category: "버그 수정 · 메뉴 연계 · UI 안정화",
    changes: [
      "버그·정합성 수정: ① 주간 일정 요약 D-Day 배지의 오타 클래스(py-0.2→py-0.5) 및 whitespace-nowrap 누락 교정 ② 빠른 할 일 등록(handleQuickAddTodo)의 endDate 필드 보강 및 활동로그 제목 정합화 ③ 360px 좁은 화면 모달 헤더(카톡 인수인계·홈 D-Day 설정) 겹침 방지를 위한 min-w-0 truncate 보강",
      "메뉴 연계·편의성 고도화: ① 일정/D-Day → 가족공지 공유(handleScheduleToNotice) 시 기간 범위(~종료일)·매년 반복·D-Day 문구 자동 포함 ② D-Day 상단 [다음 기념일] 요약 카드 클릭 시 해당 날짜 달력으로 바로 이동",
      "최종 검증: esbuild 프로덕션 번들·Babel JSX AST·Node ESM 구문 검사 0건 통과"
    ]
  },
  {
    id: "patch-v13.32",
    version: "v13.32",
    date: "2026-11-22",
    title: "🛠️ D-Day 헤더 겹침·필터 잘림·생후 중복 수정 · 홈 루틴 다른 날짜 오노출 해결(어제 1일 이월 정밀화 & 이월 토글)",
    category: "버그 수정 · UI 교정 · 편의성",
    changes: [
      "⭐ D-Day 화면 UI 교정: 헤더 제목이 우측 버튼([📋][📌 홈][+ 추가])과 겹치던 레이아웃을 truncate + 슬림 버튼으로 완전 해소, 12개월 미만 아이 카드(시율)의 'D+N일' 중복 표기를 출생일 표기로 개선, 필터 4칩을 4열 균등 그리드로 조정해 모바일 우측 잘림 제거",
      "홈 루틴 다른 날짜 노출 버그 수정: 주간·월간 루틴이 최대 6일 전까지 이월되며 다음주 미래 날짜(예: 11/23(월), 11/27(금))가 표시되던 문제를 수정 — 정확히 전날(어제) 1일 미완료 항목만 이월하고 날짜도 실제 미완료된 '어제 MM/DD(요일)'로 표기",
      "홈 루틴 필터에 [어제 미완료 루틴 이월 표시 ON/OFF] 토글을 추가하고 esbuild 번들·Babel JSX AST·Acorn 최종 무결성 0건 통과"
    ]
  },
  {
    id: "patch-v13.31",
    version: "v13.31",
    date: "2026-11-22",
    title: "🛡️ 다일정(endDate)·매년기념일 3곳 누락 수정(홈 3일내 일정·브리핑·인수인계) · 홈 D-Day 탭전환 보완 · 잔여 배지 13곳 줄바꿈 완결",
    category: "버그 수정 · 편의성 · 시각 최적화",
    changes: [
      "다일정·매년 반복 기념일 누락 버그 3종 수정: ① 홈 [3일 내 일정]에서 진행 중인 가족 다일정(endDate)이 누락되던 오류 수정 및 자정 갱신(currentDayKey) 보강 ② 홈 [📋 오늘 브리핑]과 [🤝 육아 인수인계]가 단일 날짜(s.date === today)만 비교해 다일정·매년 반복 기념일을 놓치던 문제를 getSchedulesForDate 기준으로 통합 수정",
      "내비게이션·편의성 보강: 홈 상단 미니 D-Day 칩 클릭 시 달력 서브탭(calendar)으로 정확히 전환되도록 보완, 반복 루틴 헤더에 [📌 이월 N] 요약 배지 표시, 홈 브리핑·루틴 복사 시 [이월]/[지난시간대] 태그 자동 포함",
      "줄바꿈 전수 완결: 홈·월간식단·주간일정·버킷·공유노트·레시피·수유타이머·육아일기·설정·매거진 등 잔여 소형 배지 13곳에 whitespace-nowrap 일괄 적용 및 최종 배포 무결성 0건 통과"
    ]
  },
  {
    id: "patch-v13.30",
    version: "v13.30",
    date: "2026-11-22",
    title: "🛡️ 루틴 이월·건너뛰기 정밀 버그 4종 수정 & 1탭 복원 · D-Day→가족공지 공유 연계 · 배지 15곳 줄바꿈 교정",
    category: "버그 수정 · 편의성 · 메뉴 연계 · 시각 최적화",
    changes: [
      "전수 버그 수정 4종: ① 신규 루틴 생성 시 startDate를 오늘로 자동 기록해 당일 생성 직후 '어제 미완료'가 오표시되던 문제 해결 ② 루틴 수정·클라우드 병합(syncRoutinesToCloud) 시 startDate·skippedKey가 유실되지 않도록 보존하고 완료 토글 시 skippedKey 자동 초기화 ③ 일정 추가 모달 초기화(setScheduleForm) 11곳의 누락된 endDate 필드 일괄 보강",
      "편의성·메뉴 연계 확장: ① 실수로 이월 건너뛰기한 루틴을 반복 루틴 탭 [+ 예정]에서 1탭 [↩️ 복원] 가능 ② ⭐ D-Day 카드마다 [공지] 1탭 버튼을 추가해 다가오는 가족 기념일을 가족공지로 즉시 공유 연계",
      "줄바꿈 교정 및 최종 검증: 홈 타이머·월간식단 끼니·주간일정·루틴·버킷·공유노트·레시피·설정 등 잔여 소형 배지 15곳에 whitespace-nowrap 일괄 적용 및 구문·태그·임포트 정합성 0건 통과"
    ]
  },
  {
    id: "patch-v13.29",
    version: "v13.29",
    date: "2026-11-22",
    title: "🔄 미완료 루틴 이월·지난 시간대 홈 유지 & 리셋 버그 수정 · ⭐ D-Day 별도 서브메뉴 분리 · 담당자/카테고리 오류 일괄 수정",
    category: "버그 수정 · 신규 기능 · UI 통일 · 메뉴 연계",
    changes: [
      "미완료 루틴 처리 고도화: 홈 화면 [자동] 필터에서 지나간 시간대의 미완료 루틴도 [지난 시간대] 배지와 함께 계속 표시하고, 전날·이전 요일/일자에 미완료된 루틴은 [📌 이월] 배지로 자동 이월(1탭 [건너뛰기] 지원, 클라우드 skippedKey 동기화)",
      "핵심 버그 3종 수정: ① getRoutineResetKey에서 평일/주말·공휴일 루틴이 주간 단위로 리셋되던 삼항연산자 오류를 일간 리셋으로 수정 ② 루틴 시간표 및 육아 인수인계에서 r.target 오참조로 담당자(시목/시율 등) 배지·필터가 누락되던 오류를 r.assignee 기준으로 수정 ③ 홈/빠른등록 일정 추가 시 잘못된 카테고리('병원/행사'→'육아/병원') 교정",
      "⭐ 우리 가족 D-Day & 기념일 별도 서브메뉴 분리: 달력 하단의 어두운 보드를 일정 4열 서브탭([📅 달력 · ✅ 할 일 · 🔄 루틴 · ⭐ D-Day])으로 독립시키고 전 탭 공통 화이트·세이지그린 톤으로 통일 (1탭 카톡 복사·필터·홈 D-Day 설정·아이 육아수첩·달력 직행 양방향 연계)"
    ]
  },
  {
    id: "patch-v13.28",
    version: "v13.28",
    date: "2026-11-22",
    title: "📍 살림수첩 수납 장소 추가·수정·삭제(클라우드 동기화) · 가족 다일정 미루기 보완 · 일별 식단 1탭 복사",
    category: "신규 기능 · 버그 수정 · 편의성",
    changes: [
      "살림수첩 수납 장소 자유 관리: [🏠 살림 기록 추가/수정] 모달에 [⚙️ 장소 관리]를 신설해 수납 장소를 자유롭게 추가·이름 수정·삭제·기본복원 가능 (이름 변경 시 기존 수납 항목의 장소명도 자동 일괄 갱신, 클라우드 family_meta_v4/house_rooms_v1 실시간 동기화 및 JSON 백업/복원 포함)",
      "가족 다일정 미루기 버그 수정: 기간 범위(시작일~종료일)가 설정된 가족 일정을 [+1일 미루기]할 때 종료일(endDate)도 함께 1일 이동하도록 보완",
      "일별 식단 1탭 복사(📋): 일일 식단 카드 헤더에 해당 날짜 식단만 카톡 공유용으로 바로 복사하는 버튼 추가 및 Babel AST·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.27",
    version: "v13.27",
    date: "2026-11-22",
    title: "🗓️ 달력 완료 일정 취소선 제거(흐림+✓ 시인성 개선) · 가족 일정 기간 범위(시작일~종료일) 연속 표시 추가",
    category: "시인성 · 기능 추가 · 달력 고도화",
    changes: [
      "달력 완료 일정 가독성 개선: 좁은 달력 칸에서 글씨를 가리던 취소선(line-through)을 제거하고, 부드러운 흐림 처리와 체크 표시(✓)로 완료 여부와 글자 내용을 모두 선명하게 확인 가능",
      "가족 일정 기간 범위(시작일~종료일) 지원: 가족 일정 추가·수정 모달에 종료일 입력 및 원탭 기간 프리셋(하루·2일간·3일간·5일간·1주)을 추가해 산후도우미·여행·연휴 일정을 달력 전 기간에 연속 표시(▸) 지원",
      "기존 일정 수정 시 종료일 보존 및 Babel AST·임포트·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.26",
    version: "v13.26",
    date: "2026-11-22",
    title: "✏️ 홈 루틴 본문 탭 즉시 편집(체크박스와 분리) · 루틴 수정 모달 삭제/공지 공유 추가",
    category: "편의성 · 메뉴 연계 · 권한 정밀화",
    changes: [
      "홈 [오늘 남은 루틴] 편집 진입: 좌측 체크박스를 누르면 완료 처리되고, 체크박스 오른쪽 제목·보조정보 본문을 누르면 즉시 해당 루틴 편집 모달이 열리도록 분리 (첨부파일 보유 시 '첨부 N건' 표시)",
      "루틴 수정 모달 고도화·연계: 편집 모달 내에서 바로 [🗑️ 삭제] 및 [📌 공지 공유]를 실행할 수 있도록 추가해 홈에서 탭 이동 없이 수정·삭제·공유 원스톱 처리 가능",
      "권한 정밀화·검증: handleStartEditRoutine 권한 검사를 schedule 탭 기준으로 정밀화하고 Babel AST·임포트·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.25",
    version: "v13.25",
    date: "2026-11-22",
    title: "🌱 육아 발달 가이드 1탭 복사·가족공지 공유 연계 · 홈 필터바/헤더 버튼 가독성 마무리",
    category: "메뉴 연계 · 가독성 · 시각 최적화",
    changes: [
      "육아수첩 [🌱 발달] 카드 고도화·연계: 각 월령 카드 상단에 1탭 [📋 복사] 및 [📌 가족공지 공유] 버튼을 추가해 현재 시기 핵심 팁·소아과 상담 신호를 가족과 바로 공유 가능",
      "홈 화면 가독성 마무리: 홈 루틴 필터 요약 바(12px)와 액션 피드 헤더 버튼('전체 보기'→'전체', 11.5px 굵게)을 v13.24 타이포그래피 체계에 맞춰 통일해 360px 모바일 폭에서도 여유 공간 확보",
      "Babel AST 전체 파싱·임포트/익스포트 1:1 일치·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.24",
    version: "v13.24",
    date: "2026-11-22",
    title: "👓 홈 화면 가독성 전면 개선 (제목 14px·항목 13.5px·보조 12px·명도 대비 강화 · 카드 크기·1줄 레이아웃 유지)",
    category: "가독성 · UI 최적화",
    changes: [
      "카드 크기·배치·정보 밀도는 유지하면서 텍스트 크기와 명도 대비를 정밀 상향: 섹션 제목(14px), 일정·루틴·할 일·메뉴명(13.5px), 보조 설명·날씨(12px·stone-700), 날짜·D-Day 배지(11px), 하단 네비게이션(11.5px·stone-600) 적용",
      "불필요한 줄바꿈 차단: 모든 제목·항목 행에 flex-1 min-w-0 truncate와 우측 배지 shrink-0 whitespace-nowrap을 정밀 적용해 360px~412px 모바일 폭에서도 카드가 세로로 길어지거나 배지가 밀리지 않도록 안정화",
      "패딩·간격 재배분(px-3 py-2.5 / line-clamp-2)으로 한 화면 노출 정보량을 기존과 동일 수준으로 유지 및 Babel AST·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.23",
    version: "v13.23",
    date: "2026-11-22",
    title: "🛡️ 아기꿈나라 링크 JSON 백업·복원 누락 수정 · 홈 3일 내 일정 요일 표기 통일 · 홈 루틴 1탭 복사",
    category: "버그 수정 · 시인성 · 편의성",
    changes: [
      "데이터 유실 방지: JSON 전체 백업·복원(로컬 및 Firestore family_meta_v4/baby_dream_links)에서 누락돼 있던 [🌙 아기꿈나라 링크] 데이터를 완전 포함하도록 보강",
      "홈 행동 피드 시인성 통일: [3일 내 일정] 배지에도 [남은 할 일]과 동일한 스타일로 날짜·요일(예: D-1 11/23(월), 오늘 11/22(일))을 작게 함께 표시하고, 일정·할 일 복사 문구에도 D-Day·요일 자동 반영",
      "홈 [오늘 남은 루틴] 헤더에도 1탭 [복사] 버튼을 추가해 홈 행동 피드 3대 카드(일정·루틴·할 일) 모두 1탭 카톡 복사 지원 및 Babel AST·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.22",
    version: "v13.22",
    date: "2026-11-22",
    title: "✅ 홈 남은 할 일·To-Do 남은 일수(D-N)/경과일(N일 지남) 및 요일 컴팩트 표기 추가",
    category: "시인성 · 편의성",
    changes: [
      "홈 [남은 할 일] 우측 배지에 남은 일수(D-N)·경과일(N일 지남)·오늘 표기와 함께 날짜·요일(예: 13일 지남 11/09(월), D-2 11/24(화))을 작고 깔끔하게 표시",
      "일정 → [할 일(To-Do)] 탭 날짜에도 미완료 항목의 남은 일수·경과일을 함께 표시해 홈과 일관된 시인성 제공"
    ]
  },
  {
    id: "patch-v13.21",
    version: "v13.21",
    date: "2026-11-22",
    title: "🖼️ 홈 가족사진 좌측 컴팩트(16:9) + 우측 세로 D-Day·설정 스택 & 순서(▲▼) 자유 편집",
    category: "UI 개편 · 편의성 · 시각 최적화",
    changes: [
      "홈 상단 좌우 통합 레이아웃: 좌측에는 미리보기 비율(16:9)을 그대로 유지한 축소 가족사진을, 우측에는 맨 위 [⚙️ D-Day 설정] 버튼 아래 시목·시율·선택 D-Day가 세로로 1개씩 쌓이도록 개편 (가족사진 숨김 시 D-Day 가로 바 자동 전환)",
      "D-Day 순서 및 항목 자유 변경: [📌 홈 D-Day · 순서 설정] 모달 상단에 [0. 홈 우측 표시 순서] 편집기를 신설해 ▲/▼ 1탭으로 시목·시율·기념일 위치를 원하는 대로 재배치하고 클라우드에 실시간 동기화 ([📋 복사] 요약 복사 추가)",
      "시각적 피로도 최소화: 홈 화면에서 중복 공간을 차지하던 '우리 가족 홈 ♡' 타이틀 행을 제거해 첫 화면 노출 밀도를 높이고 Babel AST·임포트·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.20",
    version: "v13.20",
    date: "2026-11-22",
    title: "🛡️ 모바일 입력창 가로 넘침(5곳) 일괄 해소 · 냉장고 퀵시트→기한알림 연계 · 살림수첩 보증/상비약 복사 및 보안 보강",
    category: "안정성 · 메뉴 연계 · 편의성",
    changes: [
      "모바일 가로 넘침·줄바꿈 5곳 일괄 수정: AI 3일 식단 날짜·루틴 수행시각·수유 메모·인수인계·노션 표 제목 입력창에 min-w-0을 보강해 좁은 화면에서 우측 버튼 밀림·꺾임 차단",
      "메뉴 연계·편의성 확장: 냉장고 퀵 액션 시트 하단을 2×2 균형 그리드로 정돈하고 [🗓️ 기한 알림] 일정 등록 연계를 추가했으며, 살림수첩 보증·A/S 및 상비약 개별 카드에 1탭 [📋 복사] 버튼 신설",
      "표기·성능·보안 마무리: 오늘 브리핑 상비약·A/S 당일 만료 표기를 'D-0'→'오늘 만료'로 개선, 인쇄 새 창 noopener/noreferrer 보안 옵션 및 잔여 이미지 3곳 지연 로딩(loading='lazy') 보강 완료"
    ]
  },
  {
    id: "patch-v13.19",
    version: "v13.19",
    date: "2026-11-22",
    title: "📸 홈 가족사진 미리보기 비율 100% 일치(16:9) · 가족사진/브리핑 숨김 토글 · 퀵시트 버그 수정",
    category: "UI 개선 · 버그 수정 · 메뉴 연계",
    changes: [
      "홈 가족사진 잘림 해결: 홈 화면 가족사진 배너와 [홈 가족사진 편집] 미리보기 양쪽 모두 동일한 aspect-[16/9] 비율로 통일해 미리보기 그대로 시목·시율 얼굴까지 잘리지 않고 동일하게 표시",
      "홈 구성 편집 숨김 확장: [🖼️ 가족사진] 표시/숨김 토글을 2×2 격자(가족사진·브리핑·날씨 배너·시율 케어)로 추가하고, [📋 브리핑] 숨김 시 시간대 브리핑 카드와 상단 브리핑 복사 버튼이 함께 숨겨지도록 정리",
      "메뉴 연계·버그 수정: 홈 오후 브리핑 임박 재료 칩 탭 시 홈을 벗어나지 않고 즉시 [냉장고 퀵 액션 시트]가 열리도록 고도화하고, 퀵시트 소비기한 미입력 시 D-999로 뜨던 오류('⏳ 기한 미확인') 및 소수점 수량 반올림 보완"
    ]
  },
  {
    id: "patch-v13.18",
    version: "v13.18",
    date: "2026-11-22",
    title: "🔗 전 메뉴 4대 원탭 연계 확장 (노션표→할일/장보기 · 레시피/버킷→공지 · 폐기→냉장고) · 표/배지 슬림화 및 검색 키보드 통일",
    category: "메뉴 연계 · 시각 최적화 · 편의성",
    changes: [
      "메뉴 간 4대 신규 연계: ① 공유노트 노션 표(Task) 상세 모달에서 1탭 [📋 복사 · ✅ 할 일 등록 · 🛒 장보기 담기] ② 레시피북 → [📌 가족공지 메뉴 제안] ③ 버킷리스트 카드 → [📌 가족공지 공유] ④ 월간·식비 폐기손실 행 → [❄️ 냉장고 임박 재료] 바로 점검 직행",
      "줄바꿈·표·문구 슬림화: 공유노트 마크다운 표 셀 패딩·글씨(12.5px) 압축, 레시피 보유 배지('재료 100% 보유')·노션 표 Priority 칩·월간 식비 예상/권장 금액에 whitespace-nowrap 적용 및 아기꿈나라 모달 부제 축약",
      "전역 검색 키보드 100% 통일: 누락돼 있던 육아일기·패치노트 검색창에 enterKeyHint='search' 보강 및 Babel AST·임포트·TDZ·배포 정합성 최종 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.17",
    version: "v13.17",
    date: "2026-11-22",
    title: "🏠 홈 브리핑 초슬림화 · 홈 구성 편집 잘림/숨김 오류 수정 · 전 시간대 일괄 적용 및 메뉴 연계 강화",
    category: "버그 수정 · 시각 최적화 · 메뉴 연계",
    changes: [
      "홈 브리핑 대폭 슬림화: 오전·오후 브리핑 카드와 시간대 전환 바·날씨·고정 공지 바의 여백과 글씨 크기(10~11.5px)를 압축하고, 임박 재료를 1줄 가로 스크롤로 정리해 세로 점유 최소화 (브리핑 카드 표시/숨김 토글 추가)",
      "홈 구성 편집 모달 잘림 & '오늘의 행동 피드' 숨김 오류 완전 수정: 제목 줄바꿈과 '오늘의 행동 피... / 핵심 메뉴 바로...' 잘림을 전면 해소하고, 오래된 상태 참조·스냅샷 덮어쓰기 경합·모바일 드래그 터치 간섭을 근본 수정해 숨김/표시가 즉시 반영되도록 개선",
      "고도화·메뉴 연계: 홈 편집에 [🌐 전 시간대 적용] 버튼 및 핵심 메뉴 영역/카드 크기(작게·보통·크게) 실동작 반영, 오후 브리핑 임박 재료 탭→냉장고 해당 품목 바로 검색, 오전 브리핑 루틴→반복 루틴 직행, 홈 남은 할 일 1탭 복사 및 공지 +N 건수 표시 추가"
    ]
  },
  {
    id: "patch-v13.16",
    version: "v13.16",
    date: "2026-11-22",
    title: "🛡️ 전수 점검: 뒤로가기/ESC 패널 완전 연동 · 일정 서브탭 히스토리 · 진료요약 복사 · 안전성 보강",
    category: "안정성 · 편의성 · 전역 점검",
    changes: [
      "더보기 드로어·홈 편집·빠른 장보기·백분위 선택·홈 루틴 필터·시간대 편집 패널을 전역 ESC 및 안드로이드 뒤로가기 닫기에 완전 연동",
      "일정·할일·반복 루틴 서브탭(scheduleSubTab) 이동을 뒤로가기 히스토리에 통합하여 서브탭 간 자연스러운 뒤로가기 지원",
      "육아 진료·체온 탭에 최근 5건 원탭 [📋 요약] 복사 추가, 성장기록 아이 전환 시 편집 상태 자동 초기화, 냉장고 품목 버튼 누락 type='button' 보완"
    ]
  },
  {
    id: "patch-v13.15",
    version: "v13.15",
    date: "2026-11-22",
    title: "🩺 육아 성장분석 비만도(BMI) 표준 성장 곡선·백분위 비교 추가",
    category: "기능 추가 · 육아 성장분석",
    changes: [
      "WHO·질병관리청 2017 영유아 성장도표(0~35개월 남아·여아) 기반 비만도(BMI = 체중÷키²) 표준 곡선 및 백분위(3~97%) 비교 그래프 추가",
      "또래 한국 남아/여아 비교 카드, 성장 기록 이력 배지, 성장요약 카톡 복사에도 BMI 수치와 백분위를 자동 반영"
    ]
  },
  {
    id: "patch-v13.14",
    version: "v13.14",
    date: "2026-11-22",
    title: "📈 육아 성장분석 표준 성장 곡선 비교 그래프 (키·몸무게 각각 · 백분위 선택 · 확대/전체보기 · 기록 수정)",
    category: "기능 고도화 · 육아 성장분석",
    changes: [
      "질병관리청 2017 성장도표 기반 [표준 성장 곡선 비교] 그래프 추가: 몸무게/키 전용 탭, 백분위(3~97%) 다중 선택, 확대보기(내 아이 구간)/전체보기(0~35개월) 전환 지원",
      "그래프 측정점 탭 시 해당 날짜의 생후 일수·실측치·표준(50%) 대비 차이·백분위 즉시 표시 및 위쪽 또래 비교 카드 클릭 시 아래 그래프 지표 자동 전환 연계",
      "성장 이력 카드에 [수정] 버튼 추가(기존 기록 불러와 덮어쓰기) 및 [성장요약] 카톡 복사 시 백분위 정보 자동 포함"
    ]
  },
  {
    id: "patch-v13.13",
    version: "v13.13",
    date: "2026-11-22",
    title: "🗓️ 일정·루틴 상단 필터 단일화 (공통가사 추가 · 이모지 제거 · 무스크롤 6열) 및 시간표 줄바꿈 정리",
    category: "UI/UX 정리 · 필터 통합 · 메뉴 연계",
    changes: [
      "일정·할일·루틴 상단 가족 필터에 [공통가사]를 추가하고 이모지·프로필을 제거한 6열 균등 배치로 변경하여 가로 스크롤 없이 한눈에 선택 가능하도록 개선",
      "반복 루틴 카드 내부에 중복되던 대상 필터 줄을 제거하고 상단 필터와 완전 통합, 홈 화면 [지금 루틴]에서 시간표/관리 이동 시 선택된 가족 필터가 자동 연동되도록 구현",
      "루틴 시간표 상단 헤더의 2줄 줄바꿈을 한 줄로 정리하고, 조건 결과가 비었을 때 1탭 [필터 초기화] 버튼 추가"
    ]
  },
  {
    id: "patch-v13.12",
    version: "v13.12",
    date: "2026-11-22",
    title: "🔔 수정 알림 전 메뉴 서브탭·항목 바로가기 고도화 (육아 성장기록·루틴·할일·식단·레시피·노트)",
    category: "버그 수정 · 메뉴 연계 · UI 정리",
    changes: [
      "육아 성장기록 알림 클릭 시 해당 아이(시목·시율) 자동 선택 및 성장기록(growth) 탭으로 즉시 이동하도록 수정 (생활기록·진료/접종·발달기록·육아일기 전 서브탭 지원)",
      "루틴·할일·일정(날짜)·식단(날짜)·레시피(검색 연동)·냉장고(품목 검색)·살림수첩(상비약/보증/수납)·공유노트(해당 페이지 열기)까지 전 메뉴 알림 딥링크 구현",
      "수정 알림 모달 중복 카테고리 맵 제거 및 누락 필터(노트·버킷·살림수첩) 통합, 카테고리별 건수 표시, 불필요한 초 단위 시각 제거 및 목적지 라벨 버튼(성장기록 → 등)으로 간결화"
    ]
  },
  {
    id: "patch-v13.11",
    version: "v13.11",
    date: "2026-11-22",
    title: "🏠 홈 화면 비율 컴팩트 최적화 및 상단 버전·관리자 버튼 분리",
    category: "UI/UX 미세조정 · 시인성",
    changes: [
      "홈 헤더·본문 전반의 글씨 크기와 높이를 위계 비율(섹션 14px · 항목 12.5px · 보조 11px)을 유지한 채 컴팩트하게 축소하여 첫 화면에서 한눈에 보이도록 개선",
      "상단 유틸 바에 버전 버튼(패치노트)과 관리자·사용자 버튼(권한 전환)을 구분된 독립 버튼으로 직접 배치"
    ]
  },
  {
    id: "patch-v13.10",
    version: "v13.10",
    date: "2026-11-22",
    title: "🏠 홈 화면 모바일 시인성·사용성 전면 리디자인 (위계 17/15/13px · 루틴 완료 접기 · 필터 통합 · 44px 터치)",
    category: "UI/UX 리디자인 · 시인성 · 접근성",
    changes: [
      "위계·여백·색상 체계 통일: 섹션 제목(17px)·항목(15px)·보조정보(13px) 기준과 명암비(4.5:1+), 단일 초록 포인트(#3F624D), 좌우 16px·카드 16px·섹션 간 20px 여백을 홈 전체에 적용",
      "🔄 지금 루틴 대폭 정돈: 3줄 필터를 요약 바+[필터 ▾] 패널로 통합하고, 다단계 루틴은 미완료 항목만 단순 목록으로 바로 표시하며 완료 항목은 [완료 N개 보기]로 기본 접기(펼침 시 순서 유지·취소 가능), 컬러 배지를 한 줄 보조 텍스트로 통일",
      "상단 운영정보 정리·하단 메뉴 통일·겹침 해소: 버전/권한을 ⓘ 정보 버튼으로 정리하고, 하단 2열 메뉴 카드의 여백·글자 크기·줄바꿈(잘림 방지)을 통일했으며 44px 터치 영역과 하단 여백(pb-32)을 확보"
    ]
  },
  {
    id: "patch-v13.09",
    version: "v13.09",
    date: "2026-11-22",
    title: "⏱️ 요리 스톱워치 시작/완료 시간 잘림 수정 및 플로팅 버튼 겹침 해소",
    category: "버그 수정 · 시각 최적화",
    changes: [
      "⏱️ 요리 스톱워치 시간 잘림 수정: 고정 너비(w-20)로 인해 '오전 10:0'처럼 분 단위가 잘리던 시작/완료 시간 입력칸을 상하 배치(w-full)로 변경해 전체 시각이 선명하게 표시되도록 개선",
      "겹침 해소: 스톱워치 팝업이 우측 하단(+) 퀵 버튼에 가리지 않도록 레이어 순서(z-[48])를 올리고 하단 버튼 라벨(🏁 완료 찍기 · 📖 레시피)을 슬림화"
    ]
  },
  {
    id: "patch-v13.08",
    version: "v13.08",
    date: "2026-11-22",
    title: "🏠 홈 화면 헤더 아래 전체 글씨 크기·카드 여백 슬림화로 시각적 피로도 완화",
    category: "시각 최적화",
    changes: [
      "🏠 홈 화면 본문 타이포그래피 일괄 조정: 헤더 아래의 3일 내 일정·오늘 남은 루틴·할 일·메뉴 그리드 카드 제목(13.5px→12px), 본문(12.5px→11px), 부제(12px→10.5px), 칩/배지(11.5px→10px)를 균형 있게 축소해 가독성 향상",
      "홈 메뉴 카드 내부 여백을 슬림화(p-2.5→p-2)해 한 화면에 더 정돈되어 보이도록 정리 및 AST·TDZ·배포 정합성 검증 완료"
    ]
  },
  {
    id: "patch-v13.07",
    version: "v13.07",
    date: "2026-11-22",
    title: "🕒 루틴 시간표 글씨 대폭 슬림화(다단계 전체 내용 표시) · 체크박스/상세편집 클릭 분리",
    category: "시각 최적화 · 편의성",
    changes: [
      "🕒 루틴 시간표 전체 내용 표시: 좌측 시간 칼럼(54px)과 폰트 크기(10px/10.5px)·행 여백을 대폭 줄이고 '외 N단계' 생략 및 말줄임(...)을 제거해 모든 단계(1.항목 · 2.항목…)가 한눈에 보이도록 개선",
      "클릭 동작 분리: 완료 처리는 좌측 체크박스(✓)를 눌렀을 때만 실행되고, 글씨 영역을 누르면 바로 루틴 상세·편집 모달이 열리도록 분리(우측 중복 연필 아이콘 제거로 본문 공간 확보)",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.06",
    version: "v13.06",
    date: "2026-11-22",
    title: "🗓️ 홈 [3일 내 일정] 3건 제한 해제(전체 표시) · 1탭 복사 및 배지 줄바꿈 교정",
    category: "편의성 · 시각 최적화 · 안정화",
    changes: [
      "홈 [🗓️ 3일 내 일정] 전체 표시: 기존 3건(.slice) 제한을 해제해 3일 이내 도래하는 일정이 4건 이상이어도 누락 없이 모두 표시되도록 개선",
      "편의성 및 줄바꿈 교정: 3일 내 일정 헤더에 1탭 [📋] 카톡 복사 버튼을 추가하고, 일정 우측 D-Day 배지에 whitespace-nowrap을 적용해 2줄 깨짐 방지",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.05",
    version: "v13.05",
    date: "2026-11-22",
    title: "🍽️ 식단 메뉴 집중 개선 · 헤더 줄바꿈 교정 및 [✨ AI 3일식단] 직행 연계",
    category: "메뉴 연계 · 시각 최적화 · 안정화",
    changes: [
      "🍽️ 일일 식단 헤더 줄바꿈·압박 교정: 주간 날짜 범위와 우측 버튼들이 좁은 화면에서 서로 겹치지 않도록 flex-wrap으로 정리하고 복사 버튼을 [📋]로 슬림화",
      "메뉴 연계(일일 식단 → AI 3일식단): 식단 상단 퀵 바를 [📷 AI 스캔 · ✨ AI 3일식단 · 📤 식단출력] 3열 균형 버튼(whitespace-nowrap)으로 재구성해 빈 식단표에서 바로 AI 3일 식단 추천으로 이동 가능",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.04",
    version: "v13.04",
    date: "2026-11-22",
    title: "🗂️ 기타 메뉴 집중 개선 · AI/레시피/버킷/공유노트 줄바꿈 일괄 교정 및 버킷리스트 1탭 복사",
    category: "시각 최적화 · 편의성 · 안정화",
    changes: [
      "기타 메뉴 줄바꿈 10곳 일괄 교정: AI 추천(조리완료·Gemini 배지·요리완료·식단표 등록·Vision 배지), 레시피북(상세 카드·요약 리스트), 버킷리스트(다녀옴 정리), 공유노트 섹션 헤더에 whitespace-nowrap을 적용하고 장문 라벨을 슬림화",
      "🌟 버킷리스트 1탭 복사(📋): 상단 컨트롤 바에 복사 버튼을 추가해 가고 싶은 미방문 장소 목록을 주말 나들이 공유용으로 카톡에 바로 복사 가능",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v13.03",
    version: "v13.03",
    date: "2026-11-22",
    title: "❄️ 냉장고 메뉴 집중 개선 · 현재 재고 1탭 복사 · 퀵시트→🍽️ 식단등록 연계 및 줄바꿈 교정",
    category: "편의성 · 메뉴 연계 · 시각 최적화",
    changes: [
      "❄️ 냉장고 현재 재고 1탭 복사(📋): 뷰 전환 바에 복사 버튼을 추가해 현재 필터·검색 기준 냉장고 재고(보관위치·수량·소비기한 D-Day)를 카톡 공유용으로 바로 복사 가능",
      "메뉴 연계(냉장고 퀵시트 → 식단등록): 재료를 눌렀을 때 열리는 퀵시트 하단에 [🍽️ 식단등록] 버튼을 추가해 해당 재료가 채워진 오늘 식단 등록 모달을 1탭으로 열기 지원",
      "줄바꿈 및 문구 정리: 임박 재료 칩·카테고리 필터 칩·복원 버튼에 whitespace-nowrap을 적용하고 [식단·재고 내보내기 → 식단·재고 출력], [냉장고 칸별 뷰 → 칸별 뷰]로 슬림화 완료"
    ]
  },
  {
    id: "patch-v13.02",
    version: "v13.02",
    date: "2026-11-22",
    title: "👶 육아 메뉴 집중 개선 · 아이 카드→홈 상단 생후일 1탭 고정 · 진료메모 복사 및 줄바꿈 교정",
    category: "메뉴 연계 · 편의성 · 시각 최적화",
    changes: [
      "메뉴 연계(육아 → 홈 상단): [👶 육아] 상단 시목·시율 프로필 카드에 [📌 홈 / 📌 홈고정] 1탭 토글을 추가해 홈 상단 미니바에 생후 D+N일을 바로 고정·해제 가능",
      "🩺 진료·체온 메모 편의성: 진료 카드마다 [📋] 1탭 복사 버튼을 추가해 발열·소아과 기록을 가족·병원 공유용으로 바로 복사 가능",
      "줄바꿈 일괄 교정: 육아 발달 [현재 시기 이동] 버튼, 진료·체온 [🌡️ °C (발열)] 배지, 레시피 조리시간 배지에 whitespace-nowrap을 적용하고 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v13.01",
    version: "v13.01",
    date: "2026-11-22",
    title: "📅 일정 메뉴 집중 개선 · 이달 일정 1탭 복사 · D-Day→홈 고정 연계 및 루틴 헤더 줄바꿈 교정",
    category: "편의성 · 메뉴 연계 · 시각 최적화",
    changes: [
      "📅 달력·일정 편의성: 캘린더 상단에 현재 보고 있는 달의 가족 일정을 날짜순으로 카톡 복사하는 [📋] 버튼 추가",
      "🔄 반복 루틴·D-Day 줄바꿈 교정: 루틴 헤더가 좁은 화면에서 제목·진행바를 압박하지 않도록 레이아웃을 정리(+ 루틴 추가 → + 추가)하고, D-Day 배지에 whitespace-nowrap을 적용해 2줄 깨짐 방지",
      "메뉴 연계(일정 D-Day → 홈 상단): 일정 하단 D-Day 카드마다 [📌 홈 / 📌 고정중] 1탭 토글을 추가해 홈 상단 미니바에 바로 고정·해제 가능 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v13.00",
    version: "v13.00",
    date: "2026-11-22",
    title: "🏠 홈 화면 메뉴 그룹 균형 정리 · 줄바꿈으로 커진 버튼/표 일괄 교정 및 최종 안정화",
    category: "시각 최적화 · 레이아웃 · 안정화",
    changes: [
      "🏠 홈 화면 레이아웃 정리: 별도 [기타] 그룹으로 밀려나던 살림수첩(house)을 [🍽️ 식단 · 살림] 2열 균형 그룹으로 정식 편입하고, 홈 루틴 헤더 버튼 높이와 가로 스크롤 여유를 슬림화해 줄바꿈 피로도 제거",
      "버튼·표 2줄 줄바꿈 일괄 교정: 일정 3대 서브탭(📅 달력·일정 · ✅ 할 일 · 🔄 반복 루틴), 식단 상단 버튼(식단표 AI 스캔 · 식단·재고 출력), AI 셰프 탭 버튼, 홈 메뉴 카드 우측 배지, 공유노트 표 셀에 whitespace-nowrap 적용",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.99",
    version: "v12.99",
    date: "2026-11-22",
    title: "❄️ 냉장고 임박재료 1탭 복사 · 📌 고정공지→🤝 인수인계 연계 및 최종 검증",
    category: "편의성 · 메뉴 연계 · 안정화",
    changes: [
      "❄️ 냉장고 임박·경과 재료 1탭 복사(📋): 임박 배너에 복사 버튼을 추가해 만료 임박 재료와 남은 일수·보관 위치를 카톡 공유용으로 즉시 복사 가능",
      "메뉴 연계(가족공지 → 인수인계): 상단 고정(핀)된 진행중 공지가 있을 때 공지 헤더에 [🤝 인수인계] 버튼을 표시해 공지 포함 상태로 바로 카톡 인수인계 열기 지원",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.98",
    version: "v12.98",
    date: "2026-11-22",
    title: "🏠 살림수첩(수납·상비약)→🤝 인수인계 1탭 연계 및 미사용 상태 정리",
    category: "메뉴 연계 · 코드 위생 · 안정화",
    changes: [
      "메뉴 연계(살림수첩 → 인수인계): [🏠 살림수첩] 수납지도·상비약 탭 헤더에 [🤝] 버튼을 추가해 물건 위치나 약 복용량을 수정한 직후 해당 섹션이 켜진 카톡 인수인계 창을 1탭으로 열기 지원",
      "코드 위생 및 중복 제거: v12.97에서 상위 대상으로 승격된 미사용 handoverSections.careGuide 상태 키를 정리",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.97",
    version: "v12.97",
    date: "2026-11-22",
    title: "👦👶🏠 인수인계 대상 3종 독립 선택(시목·시율·산모/가사) 및 시목/시율 중복 출력 버그 수정",
    category: "버그 수정 · 기능 고도화 · 시각 최적화",
    changes: [
      "공유 대상 3종 멀티 선택([✓ 👦 시목] · [✓ 👶 시율] · [✓ 🏠 산모·가사(공통)]): 시목·시율 외 공통 루틴·일정과 산모 식사·세탁·가사·비상연락을 별도 대상으로 켜고 끌 수 있으며, 중복되던 하단 [산모·가사·연락] 칩 제거",
      "시목·시율 동일 출력 버그 수정: 수유/수면 기록이 없는 유아(시목)에 빈 수유 간격이 반복 출력되거나 가족 전체 식단이 시목·시율 양쪽에 중복 출력되던 문제를 수정해 아이별 맞춤 정보와 산모·가족 식단을 깔끔하게 분리",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.96",
    version: "v12.96",
    date: "2026-11-22",
    title: "✅ To-Do 1탭 복사·빠른 추가 · 🍽️ 일일 식단→선택일자 🤝 인수인계 직결 연계",
    category: "편의성 · 메뉴 연계 · 안정화",
    changes: [
      "✅ To-Do 헤더 고도화: [📅 일정 > To-Do] 상단에 미완료 할 일을 날짜순으로 정리해 복사하는 [📋] 버튼과 1탭 [+ 추가] 버튼을 배치해 입력 동선 단축",
      "메뉴 연계(일일 식단 → 인수인계): [🍽️ 식단] 상단에 [🤝 인수인계] 버튼을 추가해, 내일·특정일 식단을 짠 직후 해당 날짜가 자동 지정된 카톡 인수인계 창을 바로 열 수 있도록 연계",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.95",
    version: "v12.95",
    date: "2026-11-22",
    title: "🛒 장보기 1탭 카톡 복사 · 🏠 홈 루틴→🕒 시간표 직행 연계 및 공유노트 삭제 정합성 보완",
    category: "편의성 · 메뉴 연계 · 안정화",
    changes: [
      "🛒 장보기 1탭 복사(📋): 상단 헤더에서 미구매 장보기 목록을 급함(🚨) 우선으로 정렬해 카톡 공유용으로 바로 복사 가능",
      "메뉴 연계(홈 → 루틴 시간표): 홈 [오늘 남은 루틴] 카드에 [🕒 시간표] 버튼을 추가해 2열 루틴 시간표 화면으로 1탭 직행 지원",
      "데이터 정합성 보완: 공유노트 페이지 삭제 시 인수인계 첨부 상태(handoverAttachedPageId)에서도 자동 해제되도록 보완 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.94",
    version: "v12.94",
    date: "2026-11-21",
    title: "📌 일정 상세→홈 상단 미니 D-Day 1탭 고정 · 📏 성장요약 복사 및 삭제 정합성 보완",
    category: "메뉴 연계 · 편의성 · 안정화",
    changes: [
      "메뉴 연계(일정 상세 → 홈 상단): 캘린더 일정 상세 팝업에서 D-Day 일정에 [📌 홈 고정 / 홈 고정중] 버튼을 추가해 홈으로 돌아가지 않고 바로 홈 상단 미니바에 고정·해제 가능",
      "육아 성장기록 편의성: [👶 육아 > 📏 성장] 헤더에 최근 키·몸무게·머리둘레와 생후 일수를 카톡 공유용으로 복사하는 [📋 성장요약] 버튼 추가 및 라벨 슬림화",
      "데이터 정합성 보완: 일정을 삭제할 때 홈 상단 미니 D-Day 목록(로컬·Firestore)에서도 해당 ID를 자동 정리하도록 보완 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.93",
    version: "v12.93",
    date: "2026-11-21",
    title: "🕒 반복 루틴 2열 시간표 보기(카드/시간표 전환) 추가 · 시간대 정렬 버그 수정 및 인수인계 연계",
    category: "신규 기능 · 버그 수정 · 메뉴 연계",
    changes: [
      "🕒 루틴 2열 시간표 보기 신설: [📅 일정 > 루틴] 상단에 [🕒 시간표 / 🃏 카드] 전환 버튼을 추가해 시간·구분 칼럼과 루틴·완료체크·대상·수정 칼럼을 깔끔한 표 형태로 한눈에 조회 가능 (시간표 모드에서는 상단 중복 가로 칩 자동 숨김)",
      "메뉴 연계 및 복사 고도화: 루틴 시간표 상단에서 [🤝 인수인계]로 바로 넘겨 카톡 시간표 전송이 가능하며, [📋] 복사 버튼도 ┌/├/└ 시간표 포맷으로 통일",
      "실제 버그 수정: 인수인계 시간표 생성 시 시각 미지정 루틴이 r.slot 대신 r.timeSlot을 읽도록 수정해 아침·오후·자기전 시간대 정렬 정확도 확보 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.92",
    version: "v12.92",
    date: "2026-11-21",
    title: "🕒 카톡 인수인계 시간표형(타임테이블) 텍스트 & 2열 표형 PNG 이미지 카드 지원",
    category: "시각화 · 기능 고도화",
    changes: [
      "🕒 시간표형(타임테이블) 모드 기본 탑재: 식단(아침·점심·간식·저녁), 선택된 루틴(예정시각·슬롯), 일정(제목 내 시간 자동 추출)을 시간순으로 통합 정렬해 카톡에서도 한눈에 들어오는 ┌/├/└ 시간표로 출력 ([🕒 시간표형 / 📋 목록형] 1탭 전환)",
      "🖼️ 2열 표형 시각 시간표 PNG 카드: [🖼️ 카드저장] 시 시간표 섹션을 실제 테두리·교차 배경색이 들어간 2열 표(시간 칼럼 | 내용 칼럼)로 렌더링해 카톡 사진 전송에 최적화",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.91",
    version: "v12.91",
    date: "2026-11-21",
    title: "🌡️ 진료·체온 1탭 프리셋 & 인수인계 즉시 연계 · 홈 미니 D-Day 초기화 및 안정화",
    category: "편의성 · 메뉴 연계 · 안정화",
    changes: [
      "🩺 소아과 진료·체온 메모 고도화: 새벽이나 급발열 시 소수점 입력 없이 1탭으로 고르는 체온 프리셋(36.8° 정상 · 37.5° 미열 · 38.0° 발열 · 38.5° 고열)과 기록 직후 바로 공유하는 [🤝 인수인계] 연계 버튼 추가",
      "홈 상단 미니 D-Day·경과일 선택 모달에 [초기화] 1탭 버튼 추가(클라우드 동기화) 및 ESC 닫기 시 복귀 대기 상태 정리 보완",
      "불필요 버튼 문구 슬림화 및 AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.90",
    version: "v12.90",
    date: "2026-11-21",
    title: "👶 홈 상단 생후 경과일(시목·시율 D+N)·기념일 경과일 선택 지원 · ↩️ 인수인계 원본수정 후 뒤로가기 자동 복귀",
    category: "편의성 · 메뉴 연계 · 고도화",
    changes: [
      "홈 상단 미니바 경과일 확장: 시목·시율 생후 경과일(D+N일)과 기념일·일정의 경과일(D+N)까지 선택해 홈 상단에 초슬림 칩으로 띄울 수 있으며, 아이 칩을 누르면 해당 아이 육아 탭으로 바로 이동",
      "원본 바로수정 → 뒤로가기 자동 복귀: 인수인계 모달에서 [⚡ 원본 바로수정] 또는 [원본 편집 →]으로 이동해 데이터를 수정한 뒤 뒤로가기(또는 하단 [← 🤝 인수인계로 복귀] 칩)를 누르면 기존 인수인계 화면으로 즉시 복귀",
      "AST·TDZ·JSX·미선언 변수·배포 정합성 최종 전수 검증 0건 통과"
    ]
  },
  {
    id: "patch-v12.89",
    version: "v12.89",
    date: "2026-11-21",
    title: "🤝 육아 인수인계 실시간 구성·미리보기 통합 · 사전 안내(내일/미래) 분기 및 개별 항목 선택 공유",
    category: "기능 고도화 · 시각 최적화 · 메뉴 연계",
    changes: [
      "사전 안내(내일/미래) vs 실시간 교대(오늘) 지능형 분기: 오늘 밤에 내일 육아 담당자에게 미리 전달할 때 불필요한 '오늘 다음 수유 예상'을 빼고 평소 평균 수유 간격·1회 평균량·내일 예정 식단·예정 루틴 중심으로 문구와 카드를 자동 최적화",
      "구성 · 실시간 카톡 미리보기 1화면 통합: 기존 3탭을 2탭([🤝 구성·실시간 미리보기] | [📝 고정가이드])으로 줄여 칩·메모·항목 선택 시 노란 카톡 말풍선이 즉각 반영",
      "개별 항목 세부 선택 & 원천 데이터 빠른 편집: 루틴·일정/할일·상비약·공지·수납위치를 항목별 칩으로 1탭 포함/제외할 수 있으며, 하단 [⚡ 원본 바로수정] 바로가기로 원천 데이터를 즉시 수정 가능"
    ]
  },
  {
    id: "patch-v12.88",
    version: "v12.88",
    date: "2026-11-21",
    title: "📌 홈 상단 초슬림 선택형 미니 D-Day 바 추가 · 🤝 육아 인수인계 정식화(BETA 제거)",
    category: "신규 기능 · 시각 최적화 · 안정화",
    changes: [
      "홈 상단 초슬림 미니 D-Day 바 신설: 가족사진 바로 아래에 내가 선택한 D-Day 일정만 아주 작은 1줄 칩으로 표시(클라우드 실시간 동기화 + 백업/복원 포함)하며, 칩을 누르면 해당 일정 상세로 즉시 이동",
      "🤝 육아 인수인계 정식 기능 전환: 모달 헤더·더보기 메뉴·툴팁의 BETA 및 테스트 문구를 모두 제거하고, 모달을 열 때 과거 날짜가 남아있으면 자동으로 오늘 날짜로 보정",
      "홈 D-Day 선택 모달의 ESC·안드로이드 뒤로가기 연동 및 AST·TDZ·JSX·배포 정합성 최종 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.87",
    version: "v12.87",
    date: "2026-11-21",
    title: "👶👦 시목·시율 고정가이드 분리(클라우드) · ✏️ 카톡 미리보기 말풍선 직접 수정 및 원본 빠른 점프",
    category: "기능 고도화 · 편의성 · 메뉴 연계",
    changes: [
      "고정가이드 3단 분리(👶 시율 / 👦 시목 / 🏠 집·산모): 아이별로 다른 식사·분유, 수면 방식, 목욕, 주의사항을 분리해 클라우드 저장하고 대상 선택 시 해당 아이 가이드만 정확히 추출",
      "✏️ 카톡 미리보기 직접 수정: 노란 카톡 말풍선을 탭하거나 [✏️ 직접수정]을 누르면 그 자리에서 바로 문구를 고쳐 [📋 카톡복사]·[🖼️ 카드저장]·[📌 공지고정]에 반영 ([🔄 원본복원] 지원)",
      "빠른 메뉴 연계: 고정가이드 아이별 탭에 [🩺 시목/시율 진료·약 →], 미리보기 하단에 [⚡ 원본수정] 4종 점프 칩 추가 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.86",
    version: "v12.86",
    date: "2026-11-21",
    title: "👶 산후도우미 원클릭 카톡 인수인계 완성 · ☁️ 클라우드 고정가이드(수면/분유/산모식사/가사/비상연락) 동기화",
    category: "기능 고도화 · 클라우드 동기화",
    changes: [
      "☁️ 클라우드 고정 가이드(family_meta_v4/handover_profile_v1) 신설: 분유·소독법, 수면 방식, 목욕·케어, 주의사항, 산모 식사, 세탁·가사, 비상연락처, 출입안내(보안 선택 포함)를 클라우드에 저장·실시간 동기화하고 JSON 백업/복원에도 완전 포함",
      "👶 산후도우미용 / 👨‍👩‍👧‍👦 가족교대용 원클릭 프리셋: 산후도우미용 선택 시 인사말과 필수 케어 항목이 자동 포함되며, 아직 입력하지 않은 필수 항목은 [미기재 N건] 배지로 바로 알려 입력 유도",
      "3탭 슬림화(⚙️ 구성 · 📝 고정가이드 · 👁️ 미리보기)로 중복 입력 제거 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.85",
    version: "v12.85",
    date: "2026-11-21",
    title: "🤝 육아 인수인계 임의 일자(오늘/내일/모레·달력) 추출 및 🗂️ 공유노트 내용 첨부 양방향 연계",
    category: "기능 고도화 · 메뉴 연계",
    changes: [
      "기준 일자 자유 선택: [오늘 / 내일 / 모레] 1탭 버튼과 날짜 선택기(date)로 원하는 날의 루틴·할일·식단을 정확히 추출해 미리 인수인계서 작성 가능",
      "🗂️ 공유노트 내용 첨부: 인수인계 모달에서 공유노트 페이지를 선택하면 본문·체크리스트(☑/☐)가 카톡 복사 텍스트·인포그래픽 PNG 카드·공지 고정에 자동 포함",
      "양방향 메뉴 연계: 공유노트 페이지 옵션 메뉴에 [🤝 육아 인수인계에 첨부하기]를 추가해 노트를 바로 첨부한 상태로 인수인계 모달 열기 지원 및 AST·TDZ·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.84",
    version: "v12.84",
    date: "2026-11-21",
    title: "🤝 카톡 육아 인수인계 실전 고도화 (오늘/내일 전환·식사간격/식단·수면방식·약/진료 자동추출·카드 PNG 저장)",
    category: "기능 고도화 · 시각화 · 메뉴 연계",
    changes: [
      "실전 데이터 자동 추출: 앱 내 기록에서 [오늘/내일 기준] 루틴·할일, 평균 수유 간격 및 다음 예상 시각, 먹은/예정 식단·이유식, 평균 수면시간·수면 방식 가이드, 최근 3일 진료·체온 및 살림수첩 상비약 복용량을 자동 집계",
      "카톡 전달 최적화 (2탭 + 이미지 카드): [⚙️ 항목선택]에서 필요한 정보만 켜고 끄고 [👁️ 카톡미리보기]로 확인한 뒤, [🖼️ 카드저장(인포그래픽 PNG)] 또는 [📋 카톡복사]로 바로 전송 가능",
      "메뉴 연계·UI 슬림화: 인수인계 모달 내 [🍽️ 식단] 빠른 이동 추가, 육아 활동 탭 중복 라벨(📋) 슬림화 및 AST·TDZ·배포 정합성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.83",
    version: "v12.83",
    date: "2026-11-21",
    title: "홈 화면 인수인계 버튼 제거(더보기 BETA 이동) · 인수인계 모달 루틴 즉시 체크 및 공지→장보기 연계",
    category: "시각 최적화 · 고도화 · 메뉴 연계",
    changes: [
      "홈 화면 슬림화: 테스트 기능인 [🤝 인수인계] 버튼을 홈 상단에서 제거하고, 더보기(☰) 메뉴(BETA 배지)와 육아 활동 탭 2곳에서만 깔끔하게 진입하도록 정리",
      "🤝 인수인계 모달 고도화: 모달 안에서 남은 루틴을 1탭으로 바로 완료 체크(☐)할 수 있게 개선하고, 교대자 전달 메모 자동 임시저장(✕ 초기화) 및 [📅 일정·루틴] 빠른 이동 추가",
      "메뉴 연계 및 문구 정리: 가족공지 카드 → [🛒 장보기] 1탭 담기 연계 추가, 육아 활동 버튼 라벨 슬림화(📋 요약) 및 버킷리스트 안내 문구 축약 완료"
    ]
  },
  {
    id: "patch-v12.82",
    version: "v12.82",
    date: "2026-11-21",
    title: "🤝 1탭 육아 인수인계 요약 카드(BETA) 추가 · 홈/육아 멀티 진입 및 카톡 복사·공지 고정 연계",
    category: "신규 기능(BETA) · 메뉴 연계",
    changes: [
      "🤝 육아 인수인계 요약 모달(BETA) 신설: 시목·시율별 마지막 수유/기저귀/수면 경과시간, 오늘 누적량, 당일 진료·체온 메모, 남은 루틴, 고정 공지를 한 화면에 실시간 집계",
      "멀티 진입 및 연계: 홈 상단(📋 브리핑 옆)과 육아 활동 탭(📋 오늘 요약 옆) 양쪽에서 바로 열 수 있으며, 모달 내 [📋 카톡 복사], [📌 공지로 고정], [👶 활동기록·💊 상비약함·🔎 수납지도] 빠른 이동 지원",
      "안드로이드 뒤로가기·ESC 닫기 핸들러 연동 및 AST·TDZ·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.81",
    version: "v12.81",
    date: "2026-11-21",
    title: "진료→상비약 · 지출→보증 · 수납→장보기 연계 확장 및 복원/뒤로가기 사각지대 해소",
    category: "메뉴 연계 · 버그 수정 · 편의성",
    changes: [
      "메뉴 간 연계 3종 확장: 🩺 소아과 진료 메모 → 💊 살림수첩 상비약함 즉시 등록, 🧾 월간 지출 원장 → 🛠️ 살림수첩 보증·A/S 등록, 🔎 수납지도 소모품 → 🛒 장보기 1탭 담기 추가",
      "복원·뒤로가기·활동로그 사각지대 수정: JSON 복원 시 육아 활동로그(babyActivities) 즉시 상태 반영 보완, 육아일기 기록불러오기·사진자르기 모달의 ESC/안드로이드 뒤로가기 닫기 연동, 활동로그 [홈] 카테고리 탭 이동 매핑 추가",
      "버킷리스트 UX 정리: 빈 필터 결과 화면에 [🔄 필터 초기화] 1탭 버튼 통일 적용 및 장문 안내 문구 축약"
    ]
  },
  {
    id: "patch-v12.80",
    version: "v12.80",
    date: "2026-11-21",
    title: "JSON 복원 버킷리스트 클라우드 저장 누락 버그 수정 · 살림수첩 뒤로가기 히스토리 연동 및 1탭 목록 복사",
    category: "버그 수정 · 편의성 · 안정화",
    changes: [
      "데이터 유실 버그 수정: 전체 JSON 복원(handleImportJson) 시 버킷리스트(payload.bucketList)가 로컬에만 반영되고 Firestore(family_bucket_v1)에는 저장되지 않던 누락을 수정해 새로고침 후에도 100% 유지",
      "모바일 뒤로가기 연동: 살림수첩 등록 모달(isHouseModalOpen)과 서브탭 전환(수납·보증·상비약)을 안드로이드/브라우저 뒤로가기 히스토리(History API)에 완전 연동",
      "살림수첩 편의성: 현재 보고 있는 수납지도·보증/A/S·상비약 목록을 카톡 공유용으로 한 번에 복사하는 [📋] 버튼 추가 및 AST·TDZ·배포 정합성 최종 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.79",
    version: "v12.79",
    date: "2026-11-21",
    title: "살림수첩 전역 완전 통합(JSON 복원 · 알림 바로가기 · 빠른실행(+) · 헤더 · 설정현황 · 오늘브리핑)",
    category: "메뉴 연계 · 안정화",
    changes: [
      "JSON 1초 복원 보강: 백업 복원(handleImportJson) 시 살림수첩(houseItems)이 로컬·Firestore(family_house_items_v1) 모두 정상 복원되도록 완결",
      "최근 수정 알림 바로가기 보강: ACTIVITY_CAT_TAB_MAP에 '살림수첩' 및 누락돼 있던 '버킷' 매핑을 추가해 알림 터치 시 해당 탭으로 즉시 이동",
      "전역 UX 통일: 우측 하단 빠른실행(+) [🏠 살림수첩] 추가, 상단 헤더 맞춤 타이틀('든든한 우리집 살림수첩 🏠'), 설정 데이터 건수 표시, 오늘 브리핑 7일 이내 만료 상비약·보증 자동 알림 및 AST·TDZ·배포 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.78",
    version: "v12.78",
    date: "2026-11-21",
    title: "신규 [🏠 살림수첩](수납지도 · 가전/육아템 보증·A/S · 상비약함) 신설 및 6대 기존 메뉴 전면 연계",
    category: "신규 기능 · 메뉴 연계",
    changes: [
      "신규 통합 메뉴 [🏠 살림수첩] 신설 (Firestore family_house_items_v1 실시간 동기화 · JSON 전체 백업 포함): ① 🔎 수납지도(방·세부위치·사진 검색) ② 🛠️ 보증·A/S(구매일·무상 A/S 만료 D-Day·원탭 전화·영수증 사진) ③ 💊 상비약함(대상별 개봉일·유통기한 D-Day·복용량 메모)",
      "기존 메뉴와 6대 양방향 연계: 상비약함→육아수첩 진료·열체크 복용기록 직행 / 상비약함→장보기 1탭 재구매 / 상비약·보증만료→일정 D-Day 등록 / 수납지도→가족공지 공유 / 육아수첩 진료·열체크 상단→상비약함 1탭 바로가기 / 홈 카드·더보기 배지 실시간 임박 알림",
      "만료일 원탭 프리셋(보증 1·2·3년뒤 / 상비약 1·3·6달·1년뒤) 적용 및 전체 AST·TDZ·JSX·배포 정합성 최종 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.77",
    version: "v12.77",
    date: "2026-11-21",
    title: "영수증 AI 스캔 항목별 소비기한 1탭 조절(1일·3일·1주·한달) 및 가족 일정 모달 날짜 빠른선택 추가",
    category: "편의성 · 고도화",
    changes: [
      "영수증 AI 스캔 고도화: 스캔된 각 품목 카드에 [1일 · 3일 · 1주 · 한달] 소비기한 1탭 버튼을 추가해 일괄 입고 전 품목별 소비기한을 손쉽게 조정 가능",
      "가족 일정 등록·수정 모달 편의성: 날짜 입력 아래 [오늘 · 내일 · 주말 · 1주뒤] 4종 빠른 날짜 선택 버튼 추가",
      "전체 AST·TDZ·JSX·미선언 변수·import/export 1:1 정합성 최종 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.76",
    version: "v12.76",
    date: "2026-11-21",
    title: "소비기한 원탭 프리셋(1일뒤·3일뒤·1주뒤·한달뒤) 3곳 전면 적용 및 장보기 입고 소비기한 고도화",
    category: "편의성 · 고도화 · 시각정리",
    changes: [
      "소비기한 원탭 설정(1일뒤 · 3일뒤 · 1주뒤 · 한달뒤) 추가: 냉장고 재료 등록·수정 모달, 장보기→냉장고 입고 모달, 냉장고 퀵 액션 시트 3곳 모두에서 탭 한 번으로 오늘 기준 소비기한을 즉시 설정·수정 가능",
      "장보기 입고 모달 고도화: 입고 시 보관 위치에 맞춰 소비기한을 직접 선택·조절할 수 있도록 날짜 입력 및 프리셋 버튼 추가, 설명 문구 슬림화",
      "냉장고 퀵시트 소비기한 즉시 동기화(handleQuickUpdateFridgeExpiry) 구현 및 전체 AST·TDZ·JSX·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.75",
    version: "v12.75",
    date: "2026-11-21",
    title: "홈·일정배지·루틴탭·브리핑 루틴 건수 100% 통일 · 전역 배지 20곳 줄바꿈 교정 · 조르테 할일→장보기 연계",
    category: "정합화 · 시각정돈 · 메뉴연계",
    changes: [
      "루틴 건수 100% 통일: isRoutineDueTodayOrPast 및 isRoutineDueOnExactDay에 평일/주말·공휴일 허용 시간대 판정을 통합해 주말·공휴일에 평일 전용 시간대(하원후·점심 등) 루틴이 일정 배지·루틴 탭·오늘 브리핑 건수에 섞여 홈과 숫자가 다르던 불일치 완전 해소",
      "전역 배지 줄바꿈 교정: 앱 전체 20개 배지(계획·매년 반복·남은 건·반남음·급함·진행중·지금 시기·키/체중 P·사진 장 등) 및 조르테 [⏭️ 내일로 미루기 (+1일)] 버튼에 whitespace-nowrap을 AST 기반으로 일괄 적용",
      "메뉴 연계 확장: 조르테 상세 팝업에서 가족 [할일(To-Do)] 항목일 때 [🛒 장보기] 1탭 담기 버튼 추가 및 AST·TDZ·배포 정합성 최종 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.74",
    version: "v12.74",
    date: "2026-11-21",
    title: "월요일·금요일 등 다른 요일·일자 루틴이 오늘 화면에 뜨던 오류 수정 및 오늘 브리핑 필터 정합화",
    category: "버그 수정 · 정합화",
    changes: [
      "버그 수정: isRoutineDueTodayOrPast에서 요일 지정 주간 루틴(매주 월/금 등)과 일자·주차요일 지정 월간 루틴이 지난 요일/일자까지 '오늘 남은 루틴'에 계속 노출되던 조건(<=)을 해당 요일·일자 당일 일치(===)로 수정 (요일 미지정 주 1회 루틴은 기존대로 완료 전까지 유지, 다른 요일 루틴은 루틴 탭 [+ 예정]에서 언제든 관리 가능)",
      "오늘 가족 브리핑 복사 정합화: 홈 [📋 브리핑]의 남은 루틴 집계에도 isRoutineDueTodayOrPast(r, today)를 적용해 오늘 해당되지 않는 다른 요일 루틴이 브리핑에 섞이지 않도록 수정",
      "전체 AST·TDZ·JSX·미선언 변수·import/export 1:1 정합성 최종 재검증 완료"
    ]
  },
  {
    id: "patch-v12.73",
    version: "v12.73",
    date: "2026-11-21",
    title: "전역 짧은 한글 버튼 줄바꿈 깨짐(112곳) 일괄 교정 · 불러올 기록 선택(수유·생활 연동 및 버그 2건 수정)",
    category: "시각 정돈 · 메뉴 연계 · 버그수정",
    changes: [
      "전역 줄바꿈 깨짐 일괄 교정: [불러올 기록 선택]의 '전체선택/전체해제' 및 안내 문구 잘림을 포함해 앱 전체 112개 짧은 한글 버튼에 whitespace-nowrap·shrink-0을 AST 기반으로 일괄 적용해 어색한 단어 중간 줄바꿈 완전 해소",
      "불러올 기록 선택 고도화·연계: 해당 날짜의 [🍼 수유·생활 요약(수유·기저귀·수면)] 항목을 일기 불러오기 목록에 자동 연동",
      "잠재 버그 2건 수정: 불러올 기록 선택에서 진료 메모(n.note→n.memo·체온) 및 할 일 완료 표시(t.completed→t.done)가 누락되던 필드명 오류 수정 및 AST·TDZ·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.72",
    version: "v12.72",
    date: "2026-11-21",
    title: "월간 한눈에→식단탭 직행·필터초기화 · 가족공지→공유노트 변환 · 전역 미지정 버튼 0건 달성",
    category: "메뉴 연계 · 편의성 · 안정화",
    changes: [
      "추가 2대 원탭 연계: 월간 식단 [📋 한눈에] 날짜별 행에 [🍽️ 보기] 버튼을 추가해 해당 날짜 식단 탭으로 즉시 이동, 가족공지 카드에 [🗂️ 노트] 버튼을 추가해 공지 본문을 공유노트 체크리스트/페이지로 자동 변환·저장",
      "사용자 편의성: 월간 식단 [📋 한눈에]에서 검색·끼니 필터로 결과가 0건일 때 1탭 [🔄 필터 초기화] 버튼 표시",
      "전역 안정성·배포 검증: 잔여 단일행 미지정 <button onClick> 6곳까지 type='button'을 보강해 앱 전체 미지정 버튼 0건 달성 및 AST·TDZ·JSX·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.71",
    version: "v12.71",
    date: "2026-11-21",
    title: "수유·생활 오늘요약→육아일기 직행 · AI 3일식단 반영 후 식단탭 이동 · 전역 버튼 type='button' 100% 보강",
    category: "메뉴 연계 · 안정화 · 시각정리",
    changes: [
      "추가 2대 원탭 연계: 육아수첩 [수유·생활] 오늘 요약 바에 [📖 일기쓰기] 버튼을 추가해 오늘 수유·기저귀·수면 통계를 육아일기 본문에 자동 채움, AI 3일치 식단표 반영 완료 후 [🍽️ 반영된 식단표 보러가기 →] 1탭 직행 추가",
      "시각적 정합성: 냉장고 칸별 뷰의 구버전 라벨('3단 + 채소칸 2개')을 통합 구조에 맞춰 '3단 + 채소칸'으로 교정",
      "전역 안정성·배포 검증: 앱 전체 일반 <button>에 누락돼 있던 type='button' 속성을 일괄 보강하고 AST·TDZ·JSX·미선언 변수·import/export 1:1 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.70",
    version: "v12.70",
    date: "2026-11-21",
    title: "조르테 일자 팝업↔식단·육아일기 직행 연계 · 남은 루틴 1탭 복사 · 할일 검색 초기화 및 용어 통일",
    category: "메뉴 연계 · 편의성 · 시각정리",
    changes: [
      "달력 중심 허브 연계: 조르테 일자 팝업에서 해당 날짜에 식단 또는 육아일기 기록이 있을 때 상단 1줄 요약 바(🍽️ 식단 N건 · 📖 육아일기 N편)를 자동 표시하고 1탭으로 해당 날짜 화면에 직행",
      "사용자 편의성·고도화: 반복 루틴 상단에 오늘 남은 루틴 목록을 카톡 공유용으로 복사하는 [📋] 버튼 추가 및 할 일(To-Do) 검색 결과 0건 시 [🔄 검색 초기화] 버튼 표시",
      "시각적 정리·안정화: 루틴 시간대 미리보기 '주말:' 라벨을 '주말·공휴일:'로 통일, 하단 더보기·할일 추가 버튼 type='button' 보강 및 AST·TDZ·배포 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.69",
    version: "v12.69",
    date: "2026-11-21",
    title: "이유식 기록→식단 원탭 연계 · 장보기/공지/육아일기 빈 화면 필터 초기화 통일 및 최종 전수 검증",
    category: "메뉴 연계 · 편의성 · 안정화",
    changes: [
      "메뉴 연계 확장: 육아수첩 [🍼 수유·생활] 타임라인의 이유식 기록에 [🍽️ 식단] 버튼을 추가해 날짜·시간대별 끼니·양(g)·메모가 채워진 식단 등록 모달로 즉시 연동",
      "전 탭 빈 화면 UX 일원화: 장보기·가족공지·육아일기에서 검색이나 필터 조건으로 결과가 0건일 때 1탭 [🔄 필터 초기화] 버튼 자동 표시",
      "안정화·배포 검증: 장보기 카드 입고/삭제 버튼 type='button' 보강 및 전체 AST·TDZ·JSX·미선언 변수·import/export 1:1 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.68",
    version: "v12.68",
    date: "2026-11-21",
    title: "추가 3대 메뉴 연계(AI레시피→레시피북·완료접종→진료메모·공유노트→가족공지) 및 원장·레시피 빈 화면 필터 초기화",
    category: "메뉴 연계 · 편의성 · 시각정리",
    changes: [
      "추가 3대 원탭 연계: AI 맞춤 셰프 추천 카드 [📖 레시피북 저장] 즉시 프리필 등록, 완료된 예방접종·검진 카드 [🏥 열·메모] 진료기록 탭 직행, 공유노트 옵션 메뉴 [📌 가족공지로 공유] 추가",
      "사용자 편의성: 월간 식비 지출 원장 및 레시피북에서 필터 조건으로 결과 0건일 때 1탭 [🔄 필터 초기화] 버튼 자동 표시",
      "시각적 정리·안정화: AI 플레이팅 코치 중복 부연 설명 제거, AI 레시피·플레이팅 버튼 type='button' 보강 및 AST·TDZ·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.67",
    version: "v12.67",
    date: "2026-11-21",
    title: "추가 4대 메뉴 연계(식단→장보기·냉장고리스트→레시피·공유노트→할일·레시피→냉장고) 및 계획식단 수정 상태 유실 버그 수정",
    category: "메뉴 연계 · 버그수정 · 안정화",
    changes: [
      "추가 4대 원탭 연계: 재료가 있는 식단 카드에서 부족 재료 [🛒] 바로 장보기 담기, 냉장고 리스트 카드에서 [📖] 레시피 바로 검색, 공유노트 미완료 체크리스트 [🗓️ 할일] 즉시 등록, 레시피북 보유 재료(✓) 칩 탭 시 냉장고 재고·소비기한 바로 확인",
      "실제 버그 수정: 일별 식단에서 계획 식단(planned)을 수정할 때 mealStatus가 누락되어 상태가 초기화되던 오류(및 신규 등록 2곳) 수정",
      "시각적 정리·안정화: 레시피 재료 안내 문구 슬림화, 냉장고 리스트·레시피 카드 버튼 type='button' 보강 및 AST·TDZ·배포 정합성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.66",
    version: "v12.66",
    date: "2026-11-21",
    title: "5대 메뉴 추가 연계(일정→공지·할일→장보기·장보기→식비·성장→일기·지출→식단) · 급함필터/공지검색 · 첨부상태 누락 수정",
    category: "메뉴 연계 · 편의성 · 안정화",
    changes: [
      "추가 5대 원탭 연계: 조르테 가족 일정 상세→공지 올리기, 미완료 할 일→장보기 즉시 보내기, 장보기 헤더→이달 식비 가계부 직행 배지, 육아 성장기록(키·체중·백분위)→육아일기 자동 채움, 식비 지출원장 날짜→해당일 식단탭 직행",
      "사용자 편의성·고도화: 장보기 목록에 급함 품목 전용 [🚨 급함] 필터 칩 추가 및 가족공지 3건 이상 시 실시간 검색창(ESC 초기화) 자동 표시",
      "시각적 정리·오류 수정: 루틴·레시피·식단표스캔·비밀번호·수정자 안내 문구 5곳 슬림화, 일정 등록 모달 초기화(setScheduleForm) 8곳의 attachments 누락 일괄 보강 및 AST·TDZ·배포 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.65",
    version: "v12.65",
    date: "2026-11-21",
    title: "전 메뉴 8대 원탭 연계 구현 · 시각적 문구 슬림화 및 버킷 일정 카테고리·문자 오류 수정",
    category: "메뉴 연계 · 고도화 · 오류수정",
    changes: [
      "메뉴 간 8대 원탭 연계 구현: 가족공지→할일 등록, 냉장고 임박재료·퀵시트→AI추천/레시피북 검색, 식단→레시피북 조회·자동프리필 등록, 월간식단→해당일 식단탭 직행, 공유노트 미완료 체크리스트→장보기 일괄 담기, 버킷리스트→준비노트 자동생성·육아일기 쓰기, 육아 진료기록→재진 일정 등록",
      "시각적 피로도 최소화: AI추천·조르테 CSV·설정 잠금·로그인 모달의 장황·중복 설명 문구 5곳을 1줄 핵심 문구로 압축",
      "잠재 오류 수정: 버킷리스트 일정 잡기 카테고리 불일치('가족행사'→'가족행사/경조사') 2건 수정, 페이지 수정 토스트 깨진 문자 복구, 수정 영역 버튼 type='button' 보강 및 AST·TDZ·배포 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.64",
    version: "v12.64",
    date: "2026-11-21",
    title: "전 메뉴 불필요·장황한 설명 간결화 및 루틴 시간대 용어 통일",
    category: "UX 간결화 · 안정화",
    changes: [
      "게스트 배너·AI 플레이팅·공유노트 안내 문구 6곳을 핵심만 남도록 간결화해 시각적 피로도 최소화",
      "루틴 시간대 설정의 주말 라벨을 공휴일 연동에 맞춰 주말·공휴일로 통일하고, 냉장고·AI·육아 탭 상단 버튼의 type='button' 속성 보강",
      "전체 3만2천여 줄 AST·TDZ(선언 전 참조)·미선언 변수·12개 전체 탭 무결성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.63",
    version: "v12.63",
    date: "2026-11-21",
    title: "평일 공휴일 현재 시간대 자동 전환 · 공휴일 수동 즉시 갱신 및 최종 전수 검증",
    category: "고도화 · 편의성",
    changes: [
      "getCurrentRoutineTimeSlot에 한국 공휴일 판정을 연동해 평일 공휴일(어린이날·대체공휴일 등)에도 홈 화면 지금(시간대)과 루틴 탭 헤더가 자동으로 주말·공휴일 시간대로 전환되도록 고도화",
      "설정 화면에 🇰🇷 공휴일 지금 갱신 버튼을 추가해 임시공휴일 발표 시 7일 주기를 기다리지 않고 즉시 동기화 가능"
    ]
  },
  {
    id: "patch-v12.62",
    version: "v12.62",
    date: "2026-11-21",
    title: "초기화 전 변수 참조(TDZ) 오류 즉시 수정 및 전체 블록 선언순서 전수 검증",
    category: "긴급 오류 수정",
    changes: [
      "공휴일 연도 자동 동기화 useEffect([scheduleMonth])가 scheduleMonth 선언보다 위에 배치되어 발생하던 Cannot access before initialization(TDZ) 오류를 선언 이후로 이동해 즉시 해결",
      "전체 3만2천여 줄 모든 블록 대상 TDZ(선언 전 동기 참조)·미선언 변수·12개 전체 탭 무결성 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.61",
    version: "v12.61",
    date: "2026-11-21",
    title: "한국 공휴일 외부 API 자동 연동 · 루틴 평일/주말·공휴일 분리 · 홈 시간대 오류 수정",
    category: "기능 고도화 · 버그 수정",
    changes: [
      "코드 하드코딩 없이 외부 공휴일 API(holidays.hyunbin.page + date.nager.at 폴백)로 한국 공휴일·대체공휴일을 7일 주기로 자동 동기화해 클라우드/로컬 캐싱하고 통합 달력에 빨간날·공휴일명 표시",
      "루틴 반복 주기에 '평일(공휴일 제외)'과 '주말·공휴일'을 추가하고, 선택한 주기에 맞는 시간대만 자동 필터링·표시해 작성 혼선 제거",
      "주말·공휴일에 홈 화면 루틴 필터와 남은 루틴 목록에 평일 전용 시간대(하원후·점심 등)가 포함되던 오류 수정 및 평일/주말·공휴일 상태 배지 표시",
      "루틴 작성 모달에서 반복 주기를 시간대 위로 배치하고 중복 예시 문구 정리"
    ]
  },
  {
    id: "patch-v12.60",
    version: "v12.60",
    date: "2026-11-21",
    title: "조르테 일자 팝업 1줄 즉시 입력(0ms) 추가 및 6대 런타임 오류 유형 전수 감사 완료",
    category: "편의성 · 무결성",
    changes: [
      "조르테 일자 팝업 목록 하단에 1줄 빠른 입력란(QuickCalDayInput · React.memo 0ms)을 추가해 모달을 또 열지 않고 엔터만으로 개인·가족 일정 즉시 등록 지원",
      "전체 3만2천여 줄 코드 대상 6대 오류 유형(이벤트 객체 오전달, onChange 오용, 상태 배열 직접 변이, useEffect(async), 중복 JSX/객체 키, AST 미선언 변수) 전수 스캔 결과 0건 확인"
    ]
  },
  {
    id: "patch-v12.59",
    version: "v12.59",
    date: "2026-11-21",
    title: "반복 루틴 수정 시 [object Object] 저장 오류 수정 및 이벤트 핸들러 안전화",
    category: "버그 수정 · 안정화",
    changes: [
      "반복 루틴 수정/저장 버튼 클릭 시 마우스 이벤트 객체가 제목 인자로 전달되어 [object Object]로 저장되던 오류 즉시 수정",
      "루틴 편집 시작 시 내부 입력 참조(routineTitleLiveRef) 동기화 및 일정·공지·루틴 모든 저장 핸들러에 이벤트 객체 오인 방지 가드 적용",
      "루틴 제목 입력란에 1탭 지우기(✕) 버튼 추가로 빠른 수정 편의성 개선"
    ]
  },
  {
    id: "patch-v12.58",
    version: "v12.58",
    date: "2026-11-21",
    title: "월간·식비 스와이프 월 이동 통일 · 개별 비밀번호 자동접속 안내 및 최종 전수 검증",
    category: "편의성 · 안정화",
    changes: [
      "월간·식비(가계부) 탭 상단 월 이동 바에도 좌우 스와이프 이전달/다음달 이동을 적용해 달력·식단·가계부 제스처 UX 일관화",
      "설정 화면에서 수혁·아리나 비밀번호가 아직 같을 때만 개별 분리 시 자동 계정 접속을 안내하는 1줄 팁 표시",
      "프로덕션 console.log 0건 · AST 스코프 미선언 변수(ReferenceError) 0건 · 12개 전체 탭 무결성 최종 확인 완료"
    ]
  },
  {
    id: "patch-v12.57",
    version: "v12.57",
    date: "2026-11-21",
    title: "조르테 원본 비율 맞춤 달력 일정 글씨 크기(8px)·말줄임표 제거 최적화",
    category: "UI 개선",
    changes: [
      "달력 날짜 숫자(13px) 대비 일정 글씨를 조르테 원본 비율(8px · 좁은 자간)로 축소하고 말줄임표(...) 대신 깔끔한 셀 끝 클리핑을 적용해 한 칸에 5~6글자·하루 최대 6건까지 한눈에 표시"
    ]
  },
  {
    id: "patch-v12.56",
    version: "v12.56",
    date: "2026-11-21",
    title: "과거 기록 'N년 전 오늘' 1줄 회고 · 리스트 이미지 지연로딩 · 버킷 검색 개선",
    category: "편의성 · 성능",
    changes: [
      "관리자 본인 개인일정(조르테 15년 기록 포함) 중 오늘과 같은 날짜의 과거 기록이 있을 때만 달력 상단에 1줄 회고 배너('🕰️ N년 전 오늘')를 노출하고 터치 시 상세 팝업으로 직행",
      "레시피·육아일기·첨부파일 썸네일 이미지 5건에 loading='lazy' decoding='async'를 추가해 스크롤 성능 개선",
      "버킷리스트 장소 검색 입력창에 모바일 검색 키보드(enterKeyHint='search') 및 ESC 즉시 초기화 지원 추가"
    ]
  },
  {
    id: "patch-v12.55",
    version: "v12.55",
    date: "2026-11-21",
    title: "조르테 상세 팝업 '내일로 미루기(+1일)' · '가족→개인 다이어리 복사' 및 첨부 바로보기",
    category: "편의성 · 고도화",
    changes: [
      "조르테 일자 상세 팝업에 '⏭️ 내일로 미루기(+1일)' 버튼 추가 (가족·개인 일정 및 다일정·연도 경계 버킷 자동 동기화)",
      "가족 일정을 1탭으로 로그인 본인의 개인 일정·다이어리로 복사('🔒 내 다이어리로 복사')해 별도 메모 관리 지원",
      "조르테 상세 팝업에서 가족 일정에 첨부된 사진(확대 보기)·문서 파일을 닫지 않고 바로 열람할 수 있도록 고도화"
    ]
  },
  {
    id: "patch-v12.54",
    version: "v12.54",
    date: "2026-11-21",
    title: "주간 식단 스와이프·원클릭 복사 · 루틴 입력 렉 제거 · PIN 자동완성 방해 차단",
    category: "편의성 · 성능",
    changes: [
      "식단 탭 상단 카드에 좌우 스와이프 이전주/다음주 이동 제스처와 '📋 복사'(주간 식단표 카톡 공유용) 버튼 추가",
      "반복 루틴 추가·수정 모달의 루틴 입력란을 React.memo 독립 컴포넌트(RoutineTitleField)로 분리해 키보드 입력 딜레이 제거",
      "관리자·계정전환 PIN 입력창에 autoComplete='off'를 적용해 모바일 비밀번호 관리자 팝업이 화면을 가리는 현상 방지",
      "식단 상단 버튼 문구 슬림화 및 리스너(24:24)·타이머(4:4)·AST 스코프 미선언 변수 0건 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.53",
    version: "v12.53",
    date: "2026-11-20",
    title: "전 모달 배경 터치 닫기 통일 · 모바일 검색 키보드 최적화 및 전수 검증",
    category: "편의성 · 안정화",
    changes: [
      "마지막으로 남아 있던 반복 루틴·식단 기록 모달에도 배경 터치 닫기를 적용해 앱 전체 모든 모달의 닫기 UX 통일",
      "식단·지출·통합달력·할일·냉장고·장보기·공유노트·레시피 모든 검색 입력창에 모바일 검색 키보드(enterKeyHint='search') 적용",
      "전체 3만여 줄 코드 대상 Babel AST 스코프 미선언 변수(ReferenceError) 0건 · 12개 전체 탭 렌더링 무결성 재검증 완료"
    ]
  },
  {
    id: "patch-v12.52",
    version: "v12.52",
    date: "2026-11-20",
    title: "버킷리스트·통합검색 ReferenceError 완전 수정 및 전체 스코프 무결성 검증",
    category: "안정화 · 오류 수정",
    changes: [
      "버킷리스트 화면 진입 시 발생하던 bucketCatFilter 등 4개 필터 상태 미선언(ReferenceError) 즉시 복구",
      "통합 달력 검색에서 가족 일정 검색 시 발생하던 familySchedules 참조 오류를 schedules로 수정",
      "냉장고 재료 등록·수정 모달에 배경 터치 닫기 적용 및 전체 3만여 줄 AST 스코프 전수 검증(미선언 변수 0건) 완료"
    ]
  },
  {
    id: "patch-v12.51",
    version: "v12.51",
    date: "2026-11-20",
    title: "버킷리스트 화면 복구 · 공지 입력 렉 제거 · 빠른등록 내 일정 바로가기",
    category: "버그 수정 · 성능",
    changes: [
      "통합 달력 개편 과정에서 누락되었던 버킷리스트(지도·목록·갈 곳 복사·장소 추가) 화면을 정상 복구",
      "가족 공지 작성/수정 모달을 React.memo 독립 컴포넌트(NoticeFormModal)로 분리해 키보드 입력 딜레이 제거 및 배경 터치 닫기·작성자 자동매칭·수정 버튼 문구 개선",
      "하단 빠른 등록(+) 메뉴에 관리자 전용 '🔒 내 일정' 1탭 바로가기 추가"
    ]
  },
  {
    id: "patch-v12.50",
    version: "v12.50",
    date: "2026-11-20",
    title: "일정 입력 렉 완전 제거 · 개인→가족 일정 이동 · 홈 예정일정 연동 · 초컴팩트 달력",
    category: "성능 · 편의성",
    changes: [
      "개인·가족 일정 등록/편집 모달을 React.memo 독립 컴포넌트로 분리하고 음력 계산 Map 캐시 및 개인일정 날짜 인덱싱을 적용해 키보드 입력 딜레이 완전 제거",
      "이미 등록된 개인 일정을 편집 창에서 '🏠 가족 일정으로 이동' 버튼 1탭으로 가족 공유 일정으로 전환 지원",
      "홈 화면 '3일 내 일정' 카드에 로그인 본인의 예정 개인일정·다이어리(🔒) 및 진행 중인 다일정까지 통합 표시 (클릭 시 해당 일정 상세로 직행)",
      "달력 셀 일정 글씨를 9px 초컴팩트 스타일로 조정하고 하루 최대 5건까지 한눈에 표시되도록 밀도 개선"
    ]
  },
  {
    id: "patch-v12.49",
    version: "v12.49",
    date: "2026-11-20",
    title: "15년 조르테 기록 연·월 즉시 점프 · 팝업 스와이프 · 검색 직행 및 안정성 고도화",
    category: "편의성 · 안정화",
    changes: [
      "달력 상단 'YYYY년 M월 ▾' 터치 시 연·월 즉시 선택 피커를 열어 과거 기록(2013~2027)으로 2탭 이동 지원",
      "조르테 일자 팝업 창 안에서도 좌우 스와이프로 이전 날·다음 날을 바로 넘길 수 있도록 제스처 확장",
      "통합 달력 검색 결과를 누르면 해당 월 이동과 동시에 상세 팝업으로 직행해 메모·다이어리를 즉시 열람",
      "개인일정 저장·완료·삭제·초기화 모든 동작에 로컬 캐시 동기화를 일관 적용해 재실행 시 즉시 표시",
      "달력 하단 구버전 안내 문구 및 빈 패널 여백을 슬림화해 시각적 피로도 최소화"
    ]
  },
  {
    id: "patch-v12.48",
    version: "v12.48",
    date: "2026-11-20",
    title: "통합 달력 조르테 UX 고도화 (좌우 스와이프·일자 팝업 상세·가독성·상단 추가)",
    category: "UX 고도화",
    changes: [
      "CSV로 불러온 모든 일정을 로그인 본인 개인일정(🔒)으로 확실히 반영하고 UTF-8/EUC-KR 자동 인식 및 로컬 캐시 보강",
      "달력 영역 좌우 스와이프 제스처로 전월·다음월 자연스럽게 이동 지원",
      "달력 일자 터치 시 조르테 스타일 팝업(일자 일정 목록 ↔ 상세 보기 · 삭제/완료/복사/편집 · << 이전날 / 새로운 일정 / 다음날 >>) 구현",
      "모바일 달력을 화면 좌우 풀폭으로 확장하고 셀 패딩·글자 크기(2줄 표시·가족 2px 컬러바)를 최적화해 일정 가독성 대폭 개선",
      "중복 상단 제목·플로팅 '+' 버튼을 정리하고 달력 상단 바에 '+ 추가' 버튼을 바로 배치해 시각적 피로도 최소화"
    ]
  },
  {
    id: "patch-v12.47",
    version: "v12.47",
    date: "2026-11-20",
    title: "통합 조르테 달력(가족+개인/다이어리) 전환 및 수혁·아리나 개별 관리자 비밀번호",
    category: "UX 통합 · 보안",
    changes: [
      "별도 개인일정 메뉴를 없애고 메인 '일정' 탭 달력을 조르테 스타일 통합 6주 달력으로 일원화 (상단 전체/가족/내 일정·다이어리 필터)",
      "수혁·아리나 관리자 비밀번호를 각각 별도로 설정·저장 가능하도록 확장하고, 로그인한 본인에게만 자신의 개인일정·다이어리 노출",
      "관리자 계정 전환(수혁↔아리나) 시 상대방 비밀번호 인증을 거치도록 보안 강화 (서로의 개인 다이어리 완전 분리)",
      "통합 달력에서 가족 일정(🏠)과 내 개인 일정·다이어리(🔒)를 한눈에 구분하고, 날짜 패널에서 1탭으로 선택 등록 및 본인 전용 CSV 클라우드 연동 지원"
    ]
  },
  {
    id: "patch-v12.46",
    version: "v12.46",
    date: "2026-11-20",
    title: "개인 일정 조르테 CSV 클라우드 가져오기·내보내기 및 다일정 지원",
    category: "기능 고도화",
    changes: [
      "조르테(Jorte) CSV 파일(따옴표 줄바꿈·쉼표·다일정·매년 반복 포함)을 브라우저에서 분석해 수혁/아리나 클라우드 DB에 바로 일괄 저장",
      "대용량 일정(수천 건)을 연도별 버킷 문서로 묶어 클라우드 읽기·쓰기 속도 대폭 최적화 및 중복 자동 방지",
      "클라우드에 저장된 개인 일정을 조르테 호환 CSV 파일로 언제든 내보내기(백업) 지원",
      "개인 캘린더 시작일~종료일(다일정) 기간 표시 및 추가·수정 모달 종료일 입력 지원"
    ]
  },
  {
    id: "patch-v12.45",
    version: "v12.45",
    date: "2026-11-20",
    title: "관리자 전용 개인 일정(조르테 6주 풀그리드 · 수혁/아리나 완전 분리 · 5일 간격 음력 · 색상 태그) 신설",
    items: [
      "가족 일정과 100% 분리된 전용 DB 컬렉션(admin_private_schedules_v1) 기반의 관리자 전용 [🔒 개인일정] 화면 신설 (육아지원군·미로그인 화면에서는 메뉴 숨김 및 열람 차단)",
      "수혁·아리나 각자의 개인 일정을 완전히 분리 관리(현재 로그인한 관리자 자동 선택 + 상단 [수혁 | 아리나] 전환 토글 지원)",
      "조르테(Jorte) 스타일 6주 풀그리드 UI 구현: 일/토 파스텔 배경, 오늘 코랄 하이라이트, 5일 간격 음력(10.1·10.5·10.10 등) 표시, 날짜 칸 내 직관 텍스트 표시, 글자/배경 색상 태그 및 매년 반복 지원",
      "홈 화면 카드·하단 [더보기] 시트·기존 [일정] 탭 상단 서브탭 3곳 모두 연결(관리자 로그인 시에만 표시) 및 ESC·뒤로가기·JSON 전체 백업/복원 연동"
    ]
  },
  {
    id: "patch-v12.44",
    version: "v12.44",
    date: "2026-11-20",
    title: "모바일 숫자 전용 키패드 최적화(17곳) · 더보기 메뉴 실시간 카운트 배지 · 클라우드 동기화 스토리지 예외 전면 방어",
    items: [
      "아이 키·몸무게·체온·수량·금액·분유량 등 17개 숫자 입력창에 inputMode('decimal'/'numeric')를 일괄 적용해 모바일에서 숫자 전용 키패드가 바로 열리도록 개선",
      "하단 [더보기] 전체 메뉴 시트의 장보기(남은 품목)·가족공지(진행 중)·버킷리스트(갈 곳) 버튼에 실시간 소형 카운트 배지 추가 및 중복 스크롤 호출 정리",
      "Firestore 실시간 동기화(onSnapshot) 및 설정 저장 핸들러 내 미보호 localStorage 호출 13곳에 try/catch 예외 방어를 전면 적용해 제한 브라우저·저장공간 초과 시에도 동기화가 중단되지 않도록 고도화"
    ]
  },
  {
    id: "patch-v12.43",
    version: "v12.43",
    date: "2026-11-20",
    title: "홈 화면 버킷리스트 메뉴 카드 추가 (갈 곳·다녀옴 실시간 현황 + 홈 편집 모드 연동) · 월간 메뉴 권한 매핑 수정",
    items: [
      "홈 화면 [🗂️ 가족 기록 · 소통] 영역에 [🌟 버킷리스트] 바로가기 카드를 추가하고 갈 곳·다녀옴 실시간 개수를 한눈에 표시",
      "홈 편집 모드(✏️ 편집)에서 버킷리스트 카드의 순서 이동·크기 조절(반폭/전폭/크게)·숨김 설정 모두 지원",
      "홈 메뉴 그리드에서 월간 식단(monthly_cal)·월간 식비(monthly_exp)가 육아지원군 권한 체크 시 monthly 탭 권한과 정확히 일치하도록 매핑 오류 수정"
    ]
  },
  {
    id: "patch-v12.42",
    version: "v12.42",
    date: "2026-11-20",
    title: "알림 토스트 탭 즉시 닫기 · 백업/CSV Blob 메모리 누수 해소 · 이미지 지연 로딩 최적화 · 새 창 보안 보강",
    items: [
      "상단 알림 토스트를 한 번 탭하면 즉시 닫히도록 개선하여 헤더 버튼 가림 시간과 시각적 피로도 축소",
      "JSON 전체 백업·메일 백업·CSV 내보내기 3곳의 URL.createObjectURL 호출 후 누락된 URL.revokeObjectURL 해제를 추가해 모바일 메모리 누수 방지",
      "레시피·육아일기·첨부 이미지 등 콘텐츠 이미지에 loading='lazy' 및 decoding='async'를 일괄 적용해 스크롤·초기 로딩 성능 고도화",
      "네이버 메일 백업 새 창 열기에 noopener,noreferrer 보안 옵션을 추가하고 백업 완료 월 localStorage 저장 예외 방어 보강"
    ]
  },
  {
    id: "patch-v12.41",
    version: "v12.41",
    date: "2026-11-20",
    title: "안드로이드·크롬 뒤로가기 즉시 종료 근본 해결 (사용자 제스처 기반 실제 History 스택 + URL 해시 동기화) · 현재 탭 재클릭 상단 이동",
    items: [
      "안드로이드 Chrome/PWA의 History Manipulation Intervention(비제스처 pushState 스킵 정책)으로 뒤로가기 시 앱이 바로 꺼지던 문제를 근본 해결: 최초 터치 제스처 가드 등록 + 탭·서브탭·공유노트·모달 전환마다 고유 URL 해시(#tab=...)와 함께 실제 history.pushState 적재",
      "하단 내비게이션에서 이미 보고 있는 탭을 한 번 더 누르면 맨 위로 부드럽게 스크롤되도록 모바일 표준 UX 추가",
      "현재 열람 중인 탭 이름에 맞춰 브라우저/PWA 탭 제목(document.title) 자동 동기화"
    ]
  },
  {
    id: "patch-v12.40",
    version: "v12.40",
    date: "2026-11-20",
    title: "뒤로가기 이전 화면 이동 지원(모달 닫기·탭/노트 히스토리·두 번 눌러 종료) · 탭 전환 자동 상단 스크롤 · 모달 배경 스크롤 잠금",
    items: [
      "모바일·브라우저 뒤로가기 버튼 누름 시 앱이 바로 꺼지지 않고 ① 열려 있는 모달/팝업 닫기 → ② 직전에 열람했던 탭·육아 서브탭·공유노트 화면으로 복귀 → ③ 홈 이동 → ④ 홈에서 2.5초 내 두 번 눌러 종료되도록 History API(popstate) 연동",
      "탭 전환 시 이전 탭의 하단 스크롤 위치가 남지 않도록 자동 최상단 이동 적용",
      "주요 모달 오픈 시 뒤쪽 배경 화면이 함께 밀리는 현상을 방지하는 배경 스크롤 잠금 통합 적용",
      "사파리 시크릿 모드·저장공간 제한 환경에서의 localStorage 초기화 및 설정 저장 예외 방어 보강"
    ]
  },
  {
    id: "patch-v12.39",
    version: "v12.39",
    date: "2026-11-20",
    title: "조리 타이머 백그라운드 복귀 버그 수정 · 모달 ESC/배경닫기 확대 · 패치노트 경량화 · 검색창 ESC 초기화 통일",
    items: [
      "조리 타이머의 visibilitychange 이벤트 리스너 대상을 window에서 document로 수정하여 모바일 앱 전환 복귀 시 남은 시간이 즉시 동기화되도록 개선",
      "우측 하단 빠른 실행(+) → [🌟 버킷리스트] 클릭 시 새 위치 검색·확인 모달이 바로 열리도록 연결 보완",
      "일정·식단·냉장고·공지·레시피·어린이집·영수증·내보내기 등 12개 핵심 모달을 전역 ESC 키 닫기에 통합하고, 주요 팝업 6종의 배경 클릭 닫기 지원 추가",
      "식단·지출·할일·냉장고·장보기·공유노트 표·레시피·육아일기 등 앱 전역 8개 검색창에 ESC 키 즉시 초기화 기능 통일 적용",
      "패치노트 모달에 검색 필터와 최근 20건 기본 표시(전체 보기 토글)를 적용해 스크롤 피로도를 줄이고, 버킷리스트 목록에 갈 곳 일괄 복사 기능 추가"
    ]
  },
  {
    id: "patch-v12.38",
    version: "v12.38",
    date: "2026-11-20",
    title: "버킷리스트 위치 검색·지도 확인 후 추가 개편 & 버튼 대폭 단순화 + 전체 코드 오류 수정",
    items: [
      "버킷리스트 상단의 과도한 버튼들을 [🗺️ 지도 | 📋 목록] + [+ 장소 추가] + 1줄 슬림 필터(상태 + 가족/분류 선택)로 대폭 단순화",
      "버킷리스트 [장소 추가/수정] 전용 모달 신설: 장소명 검색(최대 5개 후보 주소 표시) → 모달 내 미니 지도에서 핀 위치 직접 확인·미세조정 → 추가하는 직관적 흐름 적용",
      "기존 버킷리스트 항목 수정 기능 추가 및 삭제 시 선택된 지도 상세 카드 자동 정리",
      "치명적 오류 수정: 공유노트 마크다운 표 [표 수정] 버튼 ReferenceError 복구, 예방접종 D-Day(getDaysDiff) 계산 오류 수정, 서버 연결 배지(syncStatus) 재연결 오동작 수정, 최신 패치노트 본문 미표시(items/changes) 오류 수정",
      "시각적 피로도·중복 제거: 겹쳐 보이던 맨 위로(↑) 버튼 및 이중 스크롤 리스너 통합, 미사용 코드 정리, ESC 키 닫기 지원 모달 확대"
    ]
  },
  {
    id: "patch-v12.37",
    version: "v12.37",
    date: "2026-11-20",
    title: "버킷리스트 지도 'API KEY REQUIRED' 오류 해결 (무료 OSM 한국어 지도 + 위성지도 전환 · 내 위치 이동)",
    items: [
      "Carto 타일 서버의 API 키 요구 정책(API KEY REQUIRED)으로 지도가 하얗게 뜨던 오류를 API 키가 필요 없는 공식 OpenStreetMap 한국어 지도 타일(tile.openstreetmap.org)로 교체해 해결",
      "지도 우측 상단에 [🗺️ 기본 / 🛰️ 위성] 지도 전환 버튼(Esri World Imagery 무료 위성) 및 [📍 내 위치] 원탭 이동 버튼 추가",
      "버킷리스트 지도 화면에서 우측 하단 플로팅(+) 버튼이 지도 모서리를 가리지 않도록 자동 숨김 처리"
    ]
  },
  {
    id: "patch-v12.36",
    version: "v12.36",
    date: "2026-11-20",
    title: "버킷리스트 가족 지도(네이버·구글맵 연동) · 공유노트 상단 툴바(키보드 대응) · 육아일기 1줄 고정/작성창 확대 · 아기꿈나라 스타일 통일",
    items: [
      "버킷리스트에 [🗺️ 지도 | 📋 목록] 전환 및 가족별(수혁·아리·시목·시율)·상태별(📍 갈 곳 / ✅ 다녀옴) 필터 추가 — 실제 지도 위에 다녀온 곳(초록 핀)과 갈 곳(주황 핀)을 한눈에 표시",
      "네이버지도·구글맵 바로 열기, 구글맵 URL 좌표 자동 추출, 장소명 무료 자동 위치검색(Nominatim) 및 지도 탭 좌표 지정 지원",
      "공유노트 통합 서식 툴바를 화면 상단으로 복귀시키되 visualViewport.offsetTop 실시간 추적으로 모바일 키보드가 열려도 상단에 100% 고정 유지",
      "육아일기 날짜·오늘/어제·기분(이모티콘)을 1줄(flex-nowrap)로 고정하고 본문 입력창을 min-h-[260px]로 확대, 빠른실행 [🌙 아기꿈나라] 색상을 다른 메뉴와 동일 양식으로 통일"
    ]
  },
  {
    id: "patch-v12.35",
    version: "v12.35",
    date: "2026-11-20",
    title: "빠른실행 [🌙 아기꿈나라] 유튜브 4종 원탭 실행 & 링크 관리 전용 메뉴 추가",
    items: [
      "우측 하단 빠른실행(+) 팝업에 [🌙 아기꿈나라] 분류(🗣️ 아소리 · 📄 종이소리 · 🎵 자장가 · 🤫 쉬소리) 추가 — 네이티브 링크 실행으로 유튜브 앱 바로 연결",
      "더보기 메뉴 및 빠른실행 [⚙️ 관리]에서 접근 가능한 [🌙 아기꿈나라 링크 관리] 전용 메뉴 신설 (링크·이름·아이콘 수정, 새 소리 추가, 순서 변경, 삭제, 기본값 복원 및 부부 기기 Firestore 실시간 동기화)",
      "빠른실행 팝업 모바일 최대 높이 스크롤 가드(max-h-[75vh]) 보강 및 전체 구문·배포 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.34",
    version: "v12.34",
    date: "2026-11-20",
    title: "공유노트 키보드 상단 밀착 도킹 툴바(visualViewport 연동) · 다른 항목 즉시 커서 전환 · 다중 블록 일괄 서식",
    items: [
      "모바일 키보드가 올라올 때 상단 고정 툴바가 화면 위로 밀려 안 보이던 문제를 근본 해결 — 툴바를 화면 하단(키보드 바로 위, visualViewport 실시간 추적)에 z-50으로 밀착 도킹해 어떤 위치에서 편집해도 100% 항상 노출",
      "항목 편집 중 다른 항목(섹션·체크·메모)을 누르면 기존 수정 내용을 자동 저장하고 즉시 커서를 이동해 끊김 없이 연속 편집 가능",
      "툴바에 [☑️ 다중선택] 모드 추가 — 여러 항목을 한 번에 블록 선택해 글자 크기·굵기·글자색·형광펜·들여쓰기·유형 변경·삭제를 1탭으로 일괄 적용",
      "하단 여백 자동 보강으로 마지막 항목도 키보드·툴바에 가려지지 않도록 개선 및 전체 구문·배포 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.33",
    version: "v12.33",
    date: "2026-11-20",
    title: "공유노트 최근항목 아이콘 잘림 수정 · 중복 홈/새페이지 버튼 정리 · 상단 검색 배치 · 앱 제목 '혁리나목율♡'",
    items: [
      "공유노트 최근 항목 카드 아이콘이 상단 커버 영역에 반쯤 잘려 보이던 쌓임 순서(z-index) 오류를 수정해 선명한 흰색 뱃지로 표시",
      "하단 탭과 중복되던 상단 [🏠 홈] 버튼 및 중복 [+ 새 페이지]/[+ 페이지 추가] 버튼을 통합·제거하고, 통합 검색창을 최상단에 배치해 시각적 피로도 최소화",
      "공유된 페이지 트리의 빈 하위 안내를 바로 누를 수 있는 [+ 하위 페이지 추가] 버튼으로 개선",
      "앱 실행 아이콘 제목(manifest.json 및 document.title)을 '혁리나목율♡'으로 변경"
    ]
  },
  {
    id: "patch-v12.32",
    version: "v12.32",
    date: "2026-11-20",
    title: "공유노트 통합 틀고정(Fixed) 편집 툴바 전면 개편 (시각적 편집 · 서식 · 체크리스트 즉시 추가 통합)",
    items: [
      "서식 툴바가 스크롤 시 풀리던 sticky 한계(부모 overflow-hidden)를 해결해 화면 상단에 완전 고정(fixed)되는 통합 편집 툴바로 개편",
      "비직관적이던 txt 마크다운 일괄편집을 제거하고, [✏️ 편집]을 누르면 실제 체크리스트·섹션 화면 그대로 보면서 상단 고정 툴바에서 [+ 체크 · + 섹션 · + 메모 · + 표 · + 페이지] 즉시 추가와 서식·이동·삭제를 한 번에 처리",
      "항목 선택 상태에서 [+ 체크/섹션/메모] 또는 Enter 키를 누르면 바로 아래 줄에 새 항목이 즉시 생성·포커스되어 위아래로 스크롤할 필요 없이 연속 입력 가능",
      "하단 중복 5종 추가 버튼 및 미사용 텍스트 편집 상태·함수 제거로 시각적 피로도 최소화 및 코드 경량화"
    ]
  },
  {
    id: "patch-v12.31",
    version: "v12.31",
    date: "2026-11-20",
    title: "육아일기 선택 영역 부분 서식 · 공유노트 상단 고정 서식 툴바 · 월간식단 4인(시율 포함) 한눈에 배치",
    items: [
      "육아일기 서식 고도화: 글자를 드래그(블록 선택)한 상태에서 크기·굵기·글자색·형광펜을 누르면 선택한 부분만 서식이 적용되고, 선택 없이 누르면 전체 기본 서식으로 자동 적용(실시간 '선택 영역 적용/전체 기본 서식' 안내 배지 및 안전한 HTML 살균 적용)",
      "공유노트 상단 고정 툴바 전환: 항목 클릭 시 제자리에 큰 편집 팝업이 펼쳐지던 방식을 없애고, 항목은 깔끔한 1줄 인라인 입력으로 유지하면서 상단에 고정 서식·이동 툴바가 뜨도록 개편",
      "월간식단 4인 버튼(수혁·아리·시목·시율)을 4열 균등 그리드로 재배치해 가로 스크롤 없이 시율이 버튼까지 한눈에 보이도록 개선 및 육아일기 날짜 입력창 잘림 해소"
    ]
  },
  {
    id: "patch-v12.30",
    version: "v12.30",
    date: "2026-11-20",
    title: "월간식단 [한눈에] 기본값 전환 · 최신순/날짜순 토글 · 오늘 강조 · 가족사진 폴라로이드 앱 아이콘",
    items: [
      "월간식단 기본 화면을 [📋 한눈에] 리스트로 전환하고, [↓ 최신순 / ↑ 날짜순] 1탭 정렬·오늘 날짜 강조 배지·헤더 [+ 식단] 바로 추가 버튼 추가",
      "월간식단·월간복사 잔여 호칭('아리나'→'아리') 통일 및 월간 식비 헤더 장황한 부연 문구 슬림화, 예산 저장 try/catch 안전 가드 보강",
      "안드로이드 홈 화면용 앱 아이콘을 실제 가족사진 비율 유지 + 세이지그린·아이보리 폴라로이드 프레임(app-icon-512.png)으로 제작"
    ]
  },
  {
    id: "patch-v12.29",
    version: "v12.29",
    date: "2026-11-20",
    title: "공유노트 명칭·줄바꿈 정리 · 육아일기 서식(크기·색상·굵기·형광펜)·작성창 확대 · 성장매거진 사진/성장스냅샷 수정",
    items: [
      "더보기·빠른실행·홈·헤더의 '가족공유노트'를 '공유노트'로 통일해 말줄임 현상 해소 및 작성/미리보기 탭 줄바꿈·중복 문구 제거",
      "육아일기 날짜·기분 선택 바를 1줄 슬림 바로 압축하고 본문 입력창을 대폭 확대(rows=8), 글씨 크기·굵기·7색 글자색·형광펜 서식 편집(카드·매거진·한 장 내보내기 연동) 및 Ctrl/Cmd+S 저장 추가",
      "성장매거진 사진 미노출(p.url 참조 오류) 수정·사진 클릭 라이트박스 확대 추가 및 성장 스냅샷(키·체중·KDCA 백분위)·발달 제목 오류 동시 해결",
      "안드로이드 홈 화면용 1:1 정사각 앱 아이콘(app-icon-512.png) 및 PWA manifest.json·테마컬러 메타 연동 지원"
    ]
  },
  {
    id: "patch-v12.28",
    version: "v12.28",
    date: "2026-11-20",
    title: "월간 식단 전면 개편('N끼' 제거·달력 내 메뉴 직접 표시·[한눈에] 리스트/검색·끼니 필터)",
    items: [
      "월간 달력 셀과 홈 바로가기 카드에서 불필요한 'N끼' 숫자 배지를 제거하고, 달력 각 날짜 칸에 실제 메뉴명(아침·점심·저녁 색상 구분)이 바로 보이도록 개편",
      "[📅 달력 / 📋 한눈에] 전환 탭과 [전체·아침·점심·저녁] 끼니 필터를 신설해 '이번 달 저녁 메뉴만 한눈에 보기', 메뉴 검색 및 월간 식단표 1탭 복사 지원",
      "인별 선택 바를 슬림화해 모바일 첫 화면에 달력이 더 넓게 보이도록 개선하고, 선택한 날짜 카드에 [+ 식단 추가] 바로가기 추가"
    ]
  },
  {
    id: "patch-v12.27",
    version: "v12.27",
    date: "2026-11-20",
    title: "미사용 데드코드 0건 달성 · 식단 [오늘로] 1탭 복귀 · 마크다운 표 1탭 복사 · 검색 ESC 초기화",
    items: [
      "코드 경량화: MainApp 내 잔여 미사용 함수 2건(recordDeletedLog·handleReuseMealsFromOffset) 제거로 미사용 임포트·선언 모두 0건 달성",
      "시각적 정리: 식단 탭 상단 중복 '±3일' 라벨을 정리하고 다른 날짜 조회 시 [오늘] 1탭 복귀 버튼 표시, 냉장고 상단 버튼 화살표 아이콘 통일",
      "편의성·고도화: 가족공유노트 마크다운 표 하단에 [📋 복사] 버튼 추가 및 하단 통합검색창 ESC 키 즉시 초기화 지원"
    ]
  },
  {
    id: "patch-v12.26",
    version: "v12.26",
    date: "2026-11-20",
    title: "가족공유노트 원탭 서식 툴바·실시간 미리보기 에디터 개편 및 플로팅(+) 겹침 완전 해결",
    items: [
      "전체 편집 모드에 [제목·체크·목록·B·I·표·→] 1탭 서식 툴바와 [✍️ 작성 / 👀 미리보기] 실시간 전환 탭을 추가해 기호를 직접 치지 않고도 직관적으로 편집 가능",
      "불필요한 안내 문구 2줄을 제거하고 가독성 높은 기본 글꼴 적용 및 Ctrl/Cmd+S 단축키 저장 지원",
      "편집 중 우측 하단 플로팅(+) 버튼이 [저장] 버튼을 가리던 겹침 현상 해결 및 편집 상단 바 슬림화로 제목 말줄임 방지"
    ]
  },
  {
    id: "patch-v12.25",
    version: "v12.25",
    date: "2026-11-20",
    title: "빠른실행(+) 버튼 크기 3열 균일 통일 · 가족공지 빠른작성 추가 · 최근노트 커버색·진행률 표시",
    items: [
      "빠른실행(+) 팝업의 모든 그룹을 동일한 3열·균일 높이(h-[46px]) 타일로 통일해 들쭉날쭉한 크기 편차 완전 해소",
      "빠른실행(+)에 [📌 가족공지] 바로 작성 버튼 추가(식단·살림 6 / 일정·육아·공지 6 / 노트·버킷·내보내기 3 균형 배치)",
      "가족공유노트 최근 항목 카드 상단에 페이지 파스텔 커버 색상과 체크리스트 진행률 배지(완료/전체) 연동 표시"
    ]
  },
  {
    id: "patch-v12.24",
    version: "v12.24",
    date: "2026-11-20",
    title: "전역 맨위로 버튼 · 가족공지 슬림화/1탭 복사 · 버킷리스트 완료숨김 · 표 복사 · 미사용 연산 제거",
    items: [
      "시각적 정리·성능 개선: 미사용 냉장고 예측 연산(fridgeProjectedMap) 제거, 가족공지 상단 중복 제목 제거 및 한 줄 액션바 슬림화, 버킷리스트 [완료 숨김] 토글 추가",
      "사용자 편의성: 긴 화면(360px 이상 스크롤)에서 자동 노출되는 전역 [⬆️ 맨 위로] 버튼 및 가족공지 [📋 진행중 복사] 추가",
      "기능 고도화: 가족공유노트 노션 표 툴바에 [📋 표 복사] 추가 및 홈 바로가기 카드에 미완료 체크리스트 잔여 건수 실시간 표시"
    ]
  },
  {
    id: "patch-v12.23",
    version: "v12.23",
    date: "2026-11-20",
    title: "가족공유노트 글자크기·굵기·색상·형광펜 서식 편집기 · 빠른실행 한눈에 보기(스크롤·말줄임 제거)",
    items: [
      "가족공유노트 블록 클릭 시 글자 크기(작게/보통/크게/특대), 굵기(B), 글자색(7색), 형광펜 배경, 블록 유형 전환(체크↔섹션↔메모)을 1탭으로 실시간 편집",
      "본문·체크리스트에서도 **굵게**·*기울임* 인라인 마크다운 자동 렌더링 지원",
      "우측 하단 빠른실행(+) 팝업을 스크롤 없이 한 화면에 다 보이도록 컴팩트 타일 그리드로 개편하고 '가족공유노트...' 말줄임 현상 완전 해소"
    ]
  },
  {
    id: "patch-v12.22",
    version: "v12.22",
    date: "2026-11-20",
    title: "전체 코드 정밀 점검·시각적 피로도 최소화·가족공유노트 표 통합검색/페이지 복제·잠재 오류 수정",
    items: [
      "시각적 정리: 더보기 시트 중복 [식단] 제거 및 2그룹 정돈, 빠른작성 중복 타이머 통합, 상단 틀고정 버튼 슬림화, 장보기 AI 문장 입력 접기/펼치기 지원",
      "편의성·고도화: 가족공유노트 통합검색에 노션 표(Task/비고/메모)·마크다운 표 내용 포함 및 1탭 [페이지 복제] 기능 추가",
      "잠재 오류 수정: 매월 N째 주 요일 루틴(getNthWeekdayDateStr) 누락 임포트 복구, 육아활동 [+ 직접 기록] 미정의 변수(currentProfileName -> actorName) 수정, 미사용 임포트 제거"
    ]
  },
  {
    id: "patch-v12.21",
    version: "v12.21",
    date: "2026-11-20",
    title: "가족공유노트 마크다운 표(| 구분 | 내용 |) 붙여넣기 자동 변환 및 인라인 서식(*기울임*·**강조**) 지원",
    items: [
      "마크다운 표(| 구분 | 아기 상태 | 대응 방법 |)를 붙여넣으면 노션 스타일 격자 표로 자동 변환 렌더링",
      "표 바로 위의 '- 제목' 불릿은 노란 하이라이트 소제목(• 제목)으로 자동 강조",
      "표 셀 내부의 *기울임*(괄호 주석), **굵게**, ** 각주 표기까지 사진 양식 그대로 표현 및 양방향 마크다운 편집/복사 호환"
    ]
  },
  {
    id: "patch-v12.20",
    version: "v12.20",
    date: "2026-11-20",
    title: "가족공유노트 표(Task/비고/열추가/상세메모·파일첨부) · 일괄편집 · 홈 바로가기 그룹화 · 빠른작성 확장",
    items: [
      "메뉴명을 [가족공유노트]로 통일하고 우측 하단 빠른작성(+) 메뉴에 가족공유노트·버킷리스트 바로 추가 지원",
      "홈 화면 바로가기 카드를 유사 기능(식단·살림 / 육아·일정 / 가족 기록·소통)으로 묶어 시각적 피로도 최소화",
      "가족공유노트에 노션 스타일 표(Priority·Task name·비고·우측 열 추가·필터/검색) 및 [열기] 상세 모달(메모·사진/파일 첨부) 추가",
      "원탭 [✏️ 일괄편집] 모드, 일반/마크다운 여러 줄 바로 붙여넣기, 들여쓰기 조절, 완료 항목 숨기기 및 파스텔 커버 배너 추가"
    ]
  },
  {
    id: "patch-v12.19",
    version: "v12.19",
    date: "2026-11-20",
    title: "공유 노트 마크다운 통째로 붙여넣기(### 섹션·체크박스·들여쓰기 자동 변환) 지원",
    items: [
      "노션 마크다운(### 제목 -> 위치, - [x] / - [ ] 체크리스트, 4칸 들여쓰기 하위 항목)을 복사해 붙여넣으면 사진 양식 그대로 자동 변환",
      "페이지 상단 [📥 붙여넣기] 모달(강조색 선택·뒤에 추가/덮어쓰기·실시간 인식 건수 미리보기) 및 입력창 다중줄 붙여넣기 자동 감지 추가",
      "하위 들여쓰기 체크리스트 렌더링 및 마크다운 호환 복사 지원"
    ]
  },
  {
    id: "patch-v12.18",
    version: "v12.18",
    date: "2026-11-20",
    title: "노션 스타일 가족 공유 노트(계층형 페이지·최근 항목·체크리스트·하이라이트 섹션·통합검색) 추가",
    items: [
      "더보기·홈 바로가기에 노션(Notion) 스타일의 [🗂️ 공유노트] 메뉴 신설 (Firestore family_pages_v1 실시간 동기화)",
      "최근 항목 가로 카드, 접기/펼치기 가능한 다단계 하위 페이지 트리, 하단 통합 검색 바('무엇이든 검색하기...') 구현",
      "페이지 내부 하이라이트 섹션 제목(예: 세면용품 파우치 -> 캐리어), 파란 체크박스 리스트, 텍스트 메모, 체크 일괄 해제 및 카톡 텍스트 복사 지원"
    ]
  },
  {
    id: "patch-v12.17",
    version: "v12.17",
    date: "2026-11-19",
    title: "일정·할 일 모달 옵션 칩 압축 & 메모 입력란 확장(시인성 개선)",
    items: [
      "장황하던 체크박스형 '기념일/생일 전용 추가 옵션' 3줄을 컴팩트한 칩 토글(🔄 매년 반복 · ⭐ D-Day 고정 · 📅 D+경과일 + 초기화)로 축소해 모달 높이 절약",
      "메모 입력란(`📝 메모`)을 `rows={4}`로 넓히고 `지우기` 버튼 및 선명한 테두리를 적용해 메모 본문이 잘 보이지 않던 문제 해소",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.16",
    version: "v12.16",
    date: "2026-11-19",
    title: "홈 할 일 상세현황 팝업 연결(체크박스만 완료) · 파일 첨부 동작 복구(이미지 자동압축) & 상세 메모 간략화",
    items: [
      "누락되었던 readAttachmentsFromFiles·newRoutineAttachments·scheduleForm.attachments 선언을 복구해 일정·할 일·반복 루틴 파일 첨부가 정상 동작하도록 수정",
      "이미지 파일 첨부 시 자동 리사이징·압축(960px) 적용으로 고화질 스마트폰 사진도 용량 초과 없이 즉시 첨부 가능",
      "홈 화면 남은 할 일 항목 클릭 시 상세현황·수정 모달이 열리고 좌측 체크박스 클릭 시에만 완료되도록 확정 반영, 할 일·일정 목록 메모는 1~2줄 간략 표시로 슬림화"
    ]
  },
  {
    id: "patch-v12.15",
    version: "v12.15",
    date: "2026-11-19",
    title: "홈 할 일 클릭 시 상세/수정 이동(체크박스로만 완료) & 일정·루틴·할 일 파일 첨부 추가",
    items: [
      "홈 화면 남은 할 일 항목 클릭 시 즉시 완료되지 않고 상세·수정 모달로 이동해 메모·첨부파일을 확인하도록 분리(완료는 좌측 체크버튼 클릭 시만 동작)",
      "일정·할 일·반복 루틴 등록/수정 모달에 다중 파일 첨부(최대 5개, 이미지 라이트박스 미리보기 및 파일 다운로드/삭제) 추가",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.14",
    version: "v12.14",
    date: "2026-11-19",
    title: "육아일기 '형제' → '남매' 호칭 정정 · 작성 대상 줄바꿈 교정 & 단일 아이 전환 버튼 추가",
    items: [
      "육아일기 작성란의 '형제 함께 쓰기 / 형제 함께 쓰는 중' 표기를 '남매 함께 쓰기 / 남매 함께 쓰는 중'으로 정정",
      "작성 대상 라벨 줄바꿈 방지(whitespace-nowrap) 및 남매 동시 작성 시 현재 아이만 선택할 수 있는 [시목만/시율만] 빠른 버튼 추가",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.13",
    version: "v12.13",
    date: "2026-11-19",
    title: "홈 가족사진 변경 안 되던 오류 수정(fileToBase64 반환 객체 매핑) & 저장 피드백 고도화",
    items: [
      "홈 가족사진 편집에서 fileToBase64가 반환하는 객체({ previewUrl, base64, mimeType })를 그대로 넘겨 사진이 반영되지 않던 오류 수정",
      "사진 선택 즉시 미리보기 반영 토스트 안내 및 클라우드 저장 실패 시 오류 알림 배너·최근 수정 활동 기록 연동",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.12",
    version: "v12.12",
    date: "2026-11-19",
    title: "레시피 등록 모달 줄바꿈 교정 & 스톱워치 조리시간 즉시 반영 버튼 추가",
    items: [
      "레시피 등록·수정 모달의 재료 헤더·부족 재료 버튼 및 가족별 선호도(수혁·아리·시목·시율) 세로 줄바꿈 현상 수정",
      "조리시간 입력란 옆에 스톱워치 경과시간(1분 이상)을 한 번에 불러오는 [N분↓] 원탭 버튼 추가",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 확인"
    ]
  },
  {
    id: "patch-v12.11",
    version: "v12.11",
    date: "2026-11-19",
    title: "장보기 부족·임박 [+ 모두 담기] · 수량 기준 정밀화 & 장보기·접종 중복 문구 슬림화",
    items: [
      "냉장고 부족·임박 재구매 추천 바에 [+ 모두 담기] 원탭 일괄 추가 버튼 추가 및 quantity/qty 기준 정밀화",
      "장보기 체크 완료 바·접종·검진 헤더의 중복 카운트 문구 슬림화 및 비우기 버튼 type='button' 보강",
      "전체 문법·중괄호·중복 상태·임포트 경로 정적 무결성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.10",
    version: "v12.10",
    date: "2026-11-19",
    title: "스톱워치→레시피북 원탭 조리시간 기록 연동 & 버킷리스트·AI 탭 문구 슬림화",
    items: [
      "요리 스톱워치에서 계산된 조리시간을 레시피북 등록 모달의 조리시간 필드로 즉시 채워 넣는 [📖 레시피 기록] 원탭 버튼 추가",
      "버킷리스트 상단의 중복 달성률 표기 통합·완료정리 안전 확인창 추가 및 AI 식단표 상단 중복 안내 문구 슬림화",
      "전체 문법·중괄호·중복 상태·모듈 경로 정적 무결성 최종 검증 완료"
    ]
  },
  {
    id: "patch-v12.09",
    version: "v12.09",
    date: "2026-11-19",
    title: "요리 스톱워치 시작·완료 시각 자동 경과시간 계산 & 빠른도구(+) 타이머·스톱워치 추가",
    items: [
      "요리 스톱워치에서 [시작] 누른 뒤 나중에 [🏁 지금 완료 찍기] 또는 완료 시각(HH:MM)을 직접 입력하면 총 조리 경과시간이 자동 계산되도록 고도화",
      "계산된 조리 소요시간(분) 및 시작~완료 시각 범위를 원탭 복사([📋 N분 복사])해 레시피북 조리시간에 바로 활용 가능",
      "우측 하단 빠른 도구(+) 메뉴에 [⏲️ 조리 타이머]·[⏱️ 요리 스톱워치] 바로가기 추가 및 맨 위로 버튼 중복 type 속성 정리"
    ]
  },
  {
    id: "patch-v12.08",
    version: "v12.08",
    date: "2026-11-19",
    title: "스톱워치·타이머 백그라운드/페이지 이동 영속 유지 · 미니 배지 접기 & 버킷리스트 헤더 슬림화",
    items: [
      "스톱워치·타이머가 다른 탭 이동, 브라우저 백그라운드 전환, 새로고침 후에도 실제 시각(startedAtMs/targetEndMs + localStorage) 기준으로 끊김 없이 계속 기록되도록 고도화",
      "타이머 상단에 [접기] 버튼 추가 — 화면을 가리지 않는 좌측 하단 미니 알약 배지(⏱️ 00:00)로 축소해 계속 실행 및 원탭 복원 지원",
      "1시간 이상 경과 시 HH:MM:SS 포맷 자동 전환 및 타이머 [시작] 시 0초일 때 기본 3분 자동 세팅 편의성 개선",
      "버킷리스트 카드 상단의 중복 제목·설명 문구 슬림화 및 전체 빌드·문법 무결성 검증"
    ]
  },
  {
    id: "patch-v12.07",
    version: "v12.07",
    date: "2026-11-19",
    title: "홈 루틴 [전체] 버튼 우측 배치 · 공지/장보기 중복 UI 정리 & 레시피 정렬 고도화",
    items: [
      "홈 루틴 시간대 필터에서 [전체(N)] 버튼을 [자동(현재시간대)] 바로 오른쪽에 배치해 1탭 조회 지원",
      "가족공지 중복 복사 버튼 통합 및 장보기 상단 중복 진행률·복사 바 정리로 시각적 피로도 최소화",
      "레시피북 별점순(ratings 합산)·조리시간순(분 단위 파싱) 정렬 정확도 개선 및 To-Do 완료 비우기 확인창 추가"
    ]
  },
  {
    id: "patch-v12.06",
    version: "v12.06",
    date: "2026-11-19",
    title: "홈 가족사진 터치 편집(사진 교체·위치 조절·문구 수정) 추가",
    items: [
      "홈 상단 가족사진을 누르면 사진 교체·상하 프레이밍 위치(0~100%)·하단 문구를 편집할 수 있는 모달 추가",
      "Firestore(family_meta_v4/hero_photo) 실시간 동기화로 수혁·아리 기기에 즉시 반영 및 기본 사진 복원 지원",
      "홈 배너 잔여 '아리나'→'아리' 통일, 버킷리스트 상단 헤더 타이틀 추가 및 전체 TDZ/문법 0건 검증"
    ]
  },
  {
    id: "patch-v12.05",
    version: "v12.05",
    date: "2026-11-19",
    title: "장보기 엔터 즉시등록 · 자주 사는 품목 원탭 칩 & 입력창 넘침 수정",
    items: [
      "장보기 품목명·수량 입력칸에서 Enter 키로 바로 체크리스트에 등록되도록 개선",
      "자주 사는 필수 품목(계란·우유·두부·대파·양파·바나나) 1탭 자동 채움 칩 추가",
      "장보기 메모 입력칸 min-w-0 보강으로 모바일 [🚨 급함] 버튼 넘침 방지 및 전체 TDZ/문법 0건 검증"
    ]
  },
  {
    id: "patch-v12.04",
    version: "v12.04",
    date: "2026-11-19",
    title: "레시피 카드뷰 조리타이머 버튼 연동 & 플로팅 타이머 [+1분] 연장 추가",
    items: [
      "레시피북 카드뷰 하단에도 [⏱️ 타이머] 버튼 추가(3단 1줄 그리드: 식단 재현 · 타이머 · 부족 재료)",
      "조리 타이머 플로팅 바에 [+1분] 즉시 연장 버튼 추가",
      "시율 케어 영역 미수정, 전체 TDZ·문법·미종료 문자열·인터벌 누수 0건 최종 검증"
    ]
  },
  {
    id: "patch-v12.03",
    version: "v12.03",
    date: "2026-11-19",
    title: "미니 스톱워치 & 레시피 조리시간 원탭 타이머 연동 추가",
    items: [
      "레시피북 카드의 [⏱️] 버튼을 누르면 해당 요리의 조리시간(예: 20분)으로 카운트다운 자동 시작",
      "스톱워치 & 카운트다운(3분/5분/10분/15분/레시피 연동) 겸용 미니 플로팅 바 추가(탭 이동해도 유지)",
      "타이머 종료 시 비프 알림음(Web Audio) 및 토스트 안내, 시율 케어 영역 미수정·전체 TDZ/문법 0건 검증"
    ]
  },
  {
    id: "patch-v12.02",
    version: "v12.02",
    date: "2026-11-19",
    title: "ESC useEffect 최하단 이동 & 오류 복구 시 캐시 강제 초기화",
    items: [
      "ESC 키 닫기 useEffect를 MainApp의 모든 훅/상태 선언 최하단(return 직전)으로 이동",
      "화면 자동 복구(ErrorBoundary) [새로고침] 버튼이 구버전 브라우저 캐시를 비운 뒤 재로딩하도록 개선"
    ]
  },
  {
    id: "patch-v12.01",
    version: "v12.01",
    date: "2026-11-19",
    title: "초기 렌더링 TDZ 오류(Cannot access 'vd' before initialization) 수정",
    items: [
      "ESC 키 닫기 useEffect를 모든 모달 상태(isSettingsOpen 등) 선언 이후로 이동해 초기화 전 참조 오류 해결",
      "전체 useEffect·useMemo 의존성 배열의 TDZ(선언 전 참조) 0건 전수 검증 완료"
    ]
  },
  {
    id: "patch-v12.00",
    version: "v12.00",
    date: "2026-11-19",
    title: "설정 모달 슬림화(2×2 백업 그리드) · ESC/배경 닫기 & 버전 표시 추가",
    items: [
      "설정 모달 제목 1줄 정리(⚙️ 설정 · 백업 · 권한 + 버전 배지) 및 백업/복원 버튼 4종을 2×2 컴팩트 그리드로 압축",
      "설정 모달 배경 클릭·ESC 키 닫기 지원 및 backupEmail localStorage 예외 처리 보강",
      "데이터 현황에 버킷리스트 건수 표시 및 전체 버튼 type='button'·whitespace-nowrap 적용"
    ]
  },
  {
    id: "patch-v11.99",
    version: "v11.99",
    date: "2026-11-19",
    title: "접종·검진 소아과 제출용 현황 복사 버튼 추가 & 최종 점검",
    items: [
      "접종·검진 상단에 [📋 복사] 버튼 추가(완료·예정 접종 내역을 병원·가족 공유용으로 1초 복사)",
      "시율 케어 영역 미수정, 전체 문법·미종료 문자열 0건·./Firebase·./Constants 대소문자 일치 최종 확인"
    ]
  },
  {
    id: "patch-v11.98",
    version: "v11.98",
    date: "2026-11-19",
    title: "접종·검진 완료/미완료 구분 필터 및 진행률 인터페이스 최적화",
    items: [
      "접종·검진 탭 상단에 [미완료(N) | 완료(M) | 전체] 구분 탭 및 유형(국가접종·선택접종·영유아검진) 필터 추가",
      "접종 완료율 진행 바 및 미완료 건 권장일 임박/지남(D-Day) 배지 표시",
      "전체 문법, 미종료 문자열 0건, ./Firebase·./Constants 대소문자 일치 및 배포 정합성 최종 확인"
    ]
  },
  {
    id: "patch-v11.97",
    version: "v11.97",
    date: "2026-11-19",
    title: "플로팅 [위로] 버튼 슬림화(시각 가림 최소화) & 최종 점검",
    items: [
      "좌측 하단 [⬆️ 위로] 플로팅 버튼을 반투명 컴팩트 원형 버튼(↑)으로 슬림화해 하단 카드 배지 가림 현상 해소",
      "시율 케어 영역 미수정, 전체 문법·미종료 문자열 0건·./Firebase·./Constants 대소문자 일치 최종 확인"
    ]
  },
  {
    id: "patch-v11.96",
    version: "v11.96",
    date: "2026-11-18",
    title: "홈 [어제·내일] 루틴 체크상태·시간 지남 배지 오류 수정",
    items: [
      "내일 루틴 보기에서 오늘 체크한 하위 단계(약먹기·양치 등)가 완료로 뜨던 오류 수정",
      "내일·어제 루틴 보기에서 현재 시각 기준 [· 지남] 배지가 표시되지 않도록 수정",
      "어제·내일 보기 중 실수로 오늘 루틴이 토글되지 않도록 조회 전용 잠금 및 날짜 기준 계산 일치"
    ]
  },
  {
    id: "patch-v11.95",
    version: "v11.95",
    date: "2026-11-18",
    title: "홈 어제·내일 루틴 달성률 및 빈 상태 문구 정확도 개선",
    items: [
      "홈 루틴 [어제] 보기 시 실제 어제 완료 건수 기준으로 달성률 바 정확히 계산 (내일 보기에서는 불필요한 0% 바 숨김)",
      "[어제/내일] 루틴이 없을 때 상황에 맞는 안내 문구 표시 (시율 케어 영역 미수정)"
    ]
  },
  {
    id: "patch-v11.94",
    version: "v11.94",
    date: "2026-11-18",
    title: "홈 화면 루틴 [어제 · 오늘 · 내일] 간편 전환 추가",
    items: [
      "홈 루틴 상단에 [어제 | 오늘 | 내일] 미니 전환 버튼 추가 (시율 케어 영역 미수정)",
      "어제 루틴 완료/미완료 결과 조회 및 내일 도래 예정 루틴(주말/평일 시간대 자동 반영) 미리보기 지원",
      "전체 문법, 미종료 문자열 0건, ./Firebase·./Constants 대소문자 일치 및 배포 정합성 최종 확인"
    ]
  },
  {
    id: "patch-v11.93",
    version: "v11.93",
    date: "2026-11-18",
    title: "반복 루틴 주기 배지 줄바꿈 방지 & 최종 배포 정합성 점검",
    items: [
      "반복 루틴 카드의 격일·월간·주간·매일 주기 배지 4종에 whitespace-nowrap 적용",
      "시율 케어 영역 미수정, 전체 미종료 문자열·문법·대소문자 경로 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.92",
    version: "v11.92",
    date: "2026-11-18",
    title: "Vercel 빌드 오류(21259행 미종료 문자열) 수정",
    items: [
      "월간 매거진 카톡 공유 복사 구문(lines.join('\n'))의 줄바꿈 이스케이프 오류 수정",
      "전체 파일 내 동일 패턴 미종료 문자열 0건 재검증 완료"
    ]
  },
  {
    id: "patch-v11.91",
    version: "v11.91",
    date: "2026-11-18",
    title: "월간·식비 탭 [이번 달] 복귀 버튼 추가 & 버튼 줄바꿈·type 정리",
    items: [
      "월간·식비 탭에서 다른 달 조회 시 한 번에 돌아오는 [이번 달] 원탭 버튼 추가",
      "월간·식비 서브탭·멤버 선택·월 이동 버튼 type='button' 및 whitespace-nowrap 보강",
      "시율 케어 영역 미수정, 전체 문법·./Firebase·./Constants 대소문자·배포 점검 완료"
    ]
  },
  {
    id: "patch-v11.90",
    version: "v11.90",
    date: "2026-11-18",
    title: "버킷리스트 백업·복원 연동 & 완료 항목 일괄 정리 추가",
    items: [
      "전체 JSON 백업·복원 대상에 가족 버킷리스트(bucketList) 포함",
      "버킷리스트 상단에 [🧹 완료 정리] 버튼 추가 및 냉장고 수량 버튼 type='button' 보강",
      "전체 문법, ./Firebase·./Constants 대소문자 일치 및 중복 상태 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.89",
    version: "v11.89",
    date: "2026-11-18",
    title: "식단 기록 시간대 원탭 버튼 전환 & 입력창 우측 넘침 수정",
    items: [
      "새 식단 기록·수정 모달에서 아침/점심/저녁/간식 드롭다운을 4칸 원탭 버튼으로 교체",
      "날짜 입력 옆 [어제 · 오늘 · 내일] 1초 날짜 선택 버튼 추가",
      "메뉴 입력창 min-w-0 보강으로 모바일 [+ 추가] 버튼 우측 넘침 현상 해결"
    ]
  },
  {
    id: "patch-v11.88",
    version: "v11.88",
    date: "2026-11-18",
    title: "가족 버킷리스트 & 날씨 연동 나들이 추천 추가",
    items: [
      "더보기 메뉴에 [🌟 버킷리스트] 탭 신설 (Firestore family_bucket_v1 실시간 동기화)",
      "카테고리(나들이·키즈카페·맛집·목표) 및 날씨(실내/야외) 필터, 서울 날씨 연동 자동 추천 배너",
      "원클릭 [📅 일정 잡기], [📋 복사], 완료 달성률 바 및 전체 문법·배포 점검 완료"
    ]
  },
  {
    id: "patch-v11.87",
    version: "v11.87",
    date: "2026-11-18",
    title: "레시피북 원탭 복사 · 버튼 줄바꿈 방지 & 최종 점검",
    items: [
      "레시피북 카드에 [📋] 원탭 복사 버튼 추가(재료·조리시간·메모 한 번에 복사)",
      "레시피 카테고리 배지·[재현] 버튼 whitespace-nowrap 적용 및 최종 문법·배포 점검 완료"
    ]
  },
  {
    id: "patch-v11.86",
    version: "v11.86",
    date: "2026-11-18",
    title: "가족 공지 작성자 자동 연동 · 원탭 복사 & 배지 줄바꿈 정리",
    items: [
      "가족 공지 작성 시 현재 접속자(수혁/아리)가 작성자로 자동 설정되도록 개선",
      "가족 공지 배지(상단고정·카테고리) whitespace-nowrap 적용 및 기존 작성자 2글자 통일",
      "공지 카드에 원탭 [📋] 복사 버튼 추가 (시율 케어 영역 미수정, 전체 문법·배포 점검 완료)"
    ]
  },
  {
    id: "patch-v11.85",
    version: "v11.85",
    date: "2026-11-18",
    title: "월간 매거진 미래 월 이동 제한 · 수유/수면 상세 요약 추가 & 최종 점검",
    items: [
      "월간 성장 매거진에서 현재 월 이후 미래 월로 넘어가지 않도록 [▶] 버튼 비활성화",
      "매거진 내 이달의 수유량·모유·수면·기저귀 상세 집계 요약 카드 추가",
      "전체 문법, ./Firebase·./Constants 대소문자 일치, 중복 useState 및 누수 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.84",
    version: "v11.84",
    date: "2026-11-18",
    title: "가족 타임캡슐 & 월간 성장 매거진 자동 생성 기능 추가",
    items: [
      "육아 → 일기 탭에 [📰 월간 매거진] 버튼 추가 (매달 말일 3일간 자동 안내 배너 표시)",
      "선택한 월의 육아일기·사진·성장 백분위(KDCA 2017)·첫 발달·수유 요약을 한 편의 매거진으로 자동 편집",
      "원클릭 [💬 카톡 요약 복사], [🖨️ 인쇄/PDF], [💾 HTML 타임캡슐 저장] 지원"
    ]
  },
  {
    id: "patch-v11.83",
    version: "v11.83",
    date: "2026-11-18",
    title: "수유 오늘 요약 소·대변 분리 표시 & 최종 코드·배포 정합성 점검",
    items: [
      "수유·생활 [📅 오늘 요약] 바에 기저귀 소변/대변 횟수 분리 표시(예: 소3·대1)",
      "전체 모듈 문법, 대소문자 경로(./Firebase, ./Constants), 중복 상태 및 메모리 누수 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.82",
    version: "v11.82",
    date: "2026-11-18",
    title: "오늘 도래 루틴 강조 · 미래 예정 배지 구분 · 홈 버튼 줄바꿈 방지",
    items: [
      "홈 루틴 카드에서 오늘 도래한 루틴(diff===0) 날짜 배지를 에메랄드 강조로 즉시 구분",
      "반복 루틴 탭에서 [예정 포함] 활성화 시 아직 도래 전인 미래 루틴에 [예정] 배지 표시",
      "홈 할 일 [+ 추가]·[전체 >]·진행률 배지 whitespace-nowrap 보강 및 최종 점검 완료"
    ]
  },
  {
    id: "patch-v11.81",
    version: "v11.81",
    date: "2026-11-18",
    title: "미래 예정 루틴 자동 숨김 (과거·오늘 도래분만 표시)",
    items: [
      "아직 날짜가 도래하지 않은 주간·월간·격일 미래 루틴을 홈, 브리핑, 남은 건수 배지에서 자동 제외",
      "일정 → 반복 루틴 탭에서도 기본은 오늘·지난 루틴만 표시하고 [예정 포함] 토글로 미래 루틴 관리 가능",
      "루틴 시간대 필터 칩 whitespace-nowrap 보강 및 최종 문법·배포 점검 완료"
    ]
  },
  {
    id: "patch-v11.80",
    version: "v11.80",
    date: "2026-11-18",
    title: "모유 좌·우 시간 수정 시 총 시간 자동 합산 · 이미지 지연 로딩 적용",
    items: [
      "모유 수정 모달에서 왼쪽/오른쪽 분 입력 시 총 수유 시간(durationMin)과 종료 시각 자동 동기화",
      "육아일기·수유 타임라인 첨부 사진에 loading='lazy' 적용으로 모바일 스크롤 속도 개선",
      "전체 문법·모듈 대소문자·중복 상태 최종 점검 완료"
    ]
  },
  {
    id: "patch-v11.79",
    version: "v11.79",
    date: "2026-11-18",
    title: "시크릿모드 localStorage 크래시 방지 · 수유 타임라인 오늘/어제 표기 · ESC 닫기 확장",
    items: [
      "초기 렌더링 localStorage 접근부 try/catch 보강으로 Safari 시크릿모드·웹뷰 크래시 방지",
      "수유·생활 타임라인 날짜 헤더를 '오늘 · 11월 18일 (수)' / '어제 · 11월 17일 (화)' 형식으로 직관화",
      "전역 ESC 키 닫기 대상에 수유 수정 모달(activityEditModal)과 ZIP 선택 팝업 추가"
    ]
  },
  {
    id: "patch-v11.78",
    version: "v11.78",
    date: "2026-11-18",
    title: "클립보드 100% 통합 · 필터 초기화 버튼 · 모바일 배지 줄바꿈 최종 정리",
    items: [
      "브리핑·육아일기·날씨 모달 잔여 복사 코드 3곳까지 copyTextSafe()로 100% 통합",
      "수유·생활 필터 결과 0건일 때 원탭 [🔄 필터 초기화] 버튼 추가",
      "모바일 소형 배지·칩 10여 곳 whitespace-nowrap 보강 및 최종 문법·배포 점검 완료"
    ]
  },
  {
    id: "patch-v11.77",
    version: "v11.77",
    date: "2026-11-18",
    title: "모바일 복사 폴백 통합 · 수유 직접 기록 추가 · 배지 줄바꿈 최종 정리",
    items: [
      "13곳의 중복 클립보드 복사 코드를 copyTextSafe()로 통합하고 iOS/모바일 폴백(execCommand) 추가",
      "수유·생활 탭 [+ 직접 기록] 버튼 및 모달 내 종류 선택 칩 추가, 오늘 요약에 총 수면 시간 표시",
      "일정·할일·루틴 탭 숫자 배지 whitespace-nowrap 적용 및 잔여 '김수혁' 기본값 2글자 정리"
    ]
  },
  {
    id: "patch-v11.76",
    version: "v11.76",
    date: "2026-11-18",
    title: "알림창 1줄 정리 & 수유·생활 베이비타임 스타일 개편",
    items: [
      "수정 알림 모달 헤더 1줄 고정, 필터 칩 상단 잘림 해소 및 '아리' 이름 통일",
      "수유·생활 탭을 베이비타임 색감·여백·구분선·타임라인 레이아웃으로 개편 (기능 100% 유지)"
    ]
  },
  {
    id: "patch-v11.75",
    version: "v11.75",
    date: "2026-11-18",
    title: "레시피북 헤더·잠금 배너 슬림화 & 전체 모듈(firebase·constants·App) 최종 검증",
    changes: [
      "문구 슬림화: 레시피북 제목·부제목 및 열람 잠금 배너 문구를 1줄 핵심 문구로 정돈",
      "모듈·배포 무결성 검증: 미사용 아이콘/상태 0건, 임포트 누락 0건, JSX 태그 밸런스 100% 확인"
    ]
  },
  {
    id: "patch-v11.74",
    version: "v11.74",
    date: "2026-11-18",
    title: "성장기록 중복 업로드 방지 & 냉장고 수량 차감 시 목록 위치 고정 수정",
    changes: [
      "성장기록 중복 저장 방지: 저장 버튼 연타/더블탭 및 onSnapshot 동시 반영으로 같은 성장기록이 2건씩 올라가던 현상을 inFlight 락 + ID 중복 제거로 차단",
      "냉장고 재고 차감 위치 고정: 수량 - / + / 반만먹음 시 같은 소비기한·최신순 정렬에서 목록 순서가 갑자기 바뀌던 현상을 안정적 정렬(이름·ID 보조기준) 및 수량만 업데이트하도록 수정"
    ]
  },
  {
    id: "patch-v11.73",
    version: "v11.73",
    date: "2026-11-18",
    title: "가족 호칭 통일(수혁·아리·시목·시율) · 멤버 필터/표 슬림화 & 전체 검증",
    changes: [
      "가족 호칭 2글자 통일: 화면 전체에서 김수혁→수혁, 최아리나/아리나→아리, 김시목→시목, 김시율→시율로 통일해 텍스트 길이 축소 (기존 DB ID 호환 100% 유지)",
      "표·필터 슬림화: 식단 멤버 필터(전체·수혁·아리·시목·시율)가 1줄에 깔끔하게 들어가도록 여백 축소 및 월간 4인 카드 높이 슬림화"
    ]
  },
  {
    id: "patch-v11.72",
    version: "v11.72",
    date: "2026-11-18",
    title: "6개월 식비 추이 막대 금액 라벨·클릭 월이동 고도화 & 공지 헤더 슬림화",
    changes: [
      "월간·식비 추이 고도화: 최근 6개월 막대 그래프 위에 만원 단위 금액 라벨을 표시하고, 막대를 누르면 해당 월 가계부로 바로 이동하도록 개선",
      "가족공지 헤더 슬림화: 공지 제목과 부제목을 1줄로 간결하게 정리해 시각적 피로도 감소"
    ]
  },
  {
    id: "patch-v11.71",
    version: "v11.71",
    date: "2026-11-18",
    title: "일정·To-Do·루틴 줄바꿈 교정 및 카드 슬림화 (1줄 정렬)",
    changes: [
      "To-Do 빠른 입력 바: [제목 + 추가 버튼]을 1줄로, [날짜 + 오늘/내일/주말]을 2줄로 깔끔하게 분리해 버튼 꺾임 제거",
      "To-Do 헤더·카드 슬림화: To-Do 제목·표시 안내·날짜/카테고리/담당자 줄이 두 줄로 넘치지 않도록 whitespace-nowrap 및 축약 문구 적용",
      "반복 루틴 헤더 정돈: 루틴 제목과 남은 건수 배지가 1줄에 유지되도록 조정"
    ]
  },
  {
    id: "patch-v11.70",
    version: "v11.70",
    date: "2026-11-18",
    title: "육아 서브메뉴 한눈에 보기(3x2 그리드 · 일기→성장기록 순) & 성장 추이 그래프 X·Y축 눈금 추가",
    changes: [
      "육아 서브메뉴 개편: 가로 스크롤 없이 6개 탭을 한눈에 볼 수 있는 3열 2줄 그리드로 변경하고 [📖 일기] 바로 오른쪽에 [📏 성장기록] 배치",
      "성장 추이 그래프 고도화: 왼쪽 Y축(키 cm), 오른쪽 Y축(몸무게 kg), 하단 X축(측정일 MM/DD), 가로 점선 눈금 및 데이터 포인트 마커 추가"
    ]
  },
  {
    id: "patch-v11.69",
    version: "v11.69",
    date: "2026-11-18",
    title: "전체 문구 슬림화 · 홈 오늘 수면 시간 합산 · 케어 요약 복사 고도화 & 원탭 서버 재연결",
    changes: [
      "시각적 피로도 최소화: 일정·AI추천·육아수첩 빈 화면 및 모달의 장황한 부연 설명을 1줄 핵심 문구로 정돈",
      "홈 케어 요약 고도화: 홈 화면 [오늘 요약]에 수유·기저귀 외에 오늘 총 수면 시간(시간/분)까지 함께 표시",
      "육아 케어 요약 복사 고도화: [📋 오늘 요약] 복사 시 총 수면 시간·소변/대변 횟수를 포함하도록 개선",
      "원탭 서버 재연결: 상단 연결 배지가 오프라인/연결 중/오류일 때 누르면 즉시 서버 재인증을 시도하도록 개선"
    ]
  },
  {
    id: "patch-v11.68",
    version: "v11.68",
    date: "2026-11-18",
    title: "성장분석 또래 한국 남아(시목)·여아(시율) 백분위 비교 & 인증 오류 방어 보강",
    changes: [
      "또래 한국 영유아 성장 비교: 질병관리청 2017 소아청소년 성장도표(0~35개월)를 기준으로 시목(남아)·시율(여아)의 키·몸무게 백분위, 또래 평균(P50) 대비 차이, P3~P97 게이지 바 및 출처 표시 추가",
      "성장 이력 백분위 배지: 과거 성장 측정 카드마다 해당 시점의 백분위(P)를 함께 표시",
      "인증 연결 안정화: Firebase 익명 로그인 실패 시 조용히 빈 화면이 되지 않도록 오류 안내 및 2.5초 후 자동 재시도 추가"
    ]
  },
  {
    id: "patch-v11.67",
    version: "v11.67",
    date: "2026-11-18",
    title: "수면 원탭 버튼 [🌞 낮잠 / 🌙 밤잠] 분리 (홈·육아 탭 동시 적용)",
    changes: [
      "낮잠·밤잠 분리 버튼: 홈 화면 시율 케어 현황(6버튼 1줄)과 육아수첩 원탭 기록에서 [🌞 낮잠]과 [🌙 밤잠]을 각각 독립 버튼으로 분리",
      "줄바꿈 최적화: 홈 6칸 버튼 라벨(유축수유 포함)이 좁은 화면에서도 2줄로 꺾이지 않도록 간격·자간(tracking-tighter) 조정"
    ]
  },
  {
    id: "patch-v11.66",
    version: "v11.66",
    date: "2026-11-18",
    title: "중복 위치 필터 제거 · 긴 안내 문구/버튼 텍스트 슬림화 & 시각화 정돈",
    changes: [
      "냉장고 중복 버튼 정리: 리스트 뷰에서 상단 3칸 구역 카드(냉장실·냉동실·실온)와 겹치던 중복 위치 필터 바를 제거하고 [전체 보기] + [+ 재료 추가] 1줄로 단순화",
      "긴 문구 슬림화: 장보기(빠른 장보기 입력, 자동 분석해서 담기), 냉장고 검색·헤더, 열람 전용 배너, 육아수첩 입력 힌트를 짧고 직관적인 문구로 정돈"
    ]
  },
  {
    id: "patch-v11.65",
    version: "v11.65",
    date: "2026-11-18",
    title: "냉장고 항목 하단 액션 버튼(반만·다먹음·+장보기·폐기) 1줄 슬림 정렬",
    changes: [
      "냉장고 리스트 뷰: [🌗 반만], [다먹음], [+장보기], [🗑️ 폐기] 버튼과 수정·삭제 아이콘이 모바일에서도 2줄로 넘치지 않고 1줄에 깔끔하게 들어가도록 간격·라벨 슬림화"
    ]
  },
  {
    id: "patch-v11.64",
    version: "v11.64",
    date: "2026-11-18",
    title: "시율 케어 현황 테두리 통일·오늘 요약 추가 · 냉장고 냉장실 줄바꿈 교정 & 임박 필터 버그 수정",
    changes: [
      "시율 케어 현황 시각화: 마지막 기저귀·수유·수면 3칸 카드의 제각각이던 상단 색상 테두리를 차분한 통일 테두리(#FAF8F3)로 정돈하고 라벨 옆 작은 색상 점과 오늘 요약(수유·기저귀 횟수) 추가",
      "냉장고 줄바꿈 교정: 상단 3칸 구역 카드의 ❄️ 냉장실 / 🧊 냉동실 / 🧺 실온 라벨과 임박 배지가 좁은 화면에서도 두 줄로 꺾이지 않도록 whitespace-nowrap 적용",
      "냉장고 임박 필터 수정 및 편의성 개선: 리스트 뷰에서 [⏰ 임박만] 필터가 실제로 반영되도록 수정하고, 필터 초기화·결과 건수 표시 바 추가"
    ]
  },
  {
    id: "patch-v11.63",
    version: "v11.63",
    date: "2026-11-18",
    title: "메뉴별 맞춤 헤더 문구 · 냉장고 1줄 슬림화 · 대소변 안내 소형화 & 일기 대상 선택 일원화",
    changes: [
      "메뉴별 귀여운 헤더: '우리 가족 식탁' 대신 각 탭 성격에 맞는 귀여운 문구(오늘 뭐 먹지? 식탁, 쑥쑥 시목·시율 육아수첩 등) 적용",
      "대소변 안내 & 아이카드 정돈: 기저귀 안내 문구를 연한 회색 1줄(10.5px)로 축소하고 상단 아이 카드 '15개월' 줄바꿈 수정",
      "냉장고 1줄 슬림화: 영수증 AI 스캔과 식단·재고 내보내기를 깔끔한 1줄 2칸 버튼으로 축약",
      "일기 직관화: 상단 김시목/김시율 카드 선택에 맞춰 일기 작성·열람 대상이 자동 연동되며 [+ 형제 함께 쓰기]·[전체 보기] 토글만 남도록 단순화"
    ]
  },
  {
    id: "patch-v11.62",
    version: "v11.62",
    date: "2026-11-18",
    title: "홈 시간대 바 줄바꿈 안전화 · 냉장고 [⏰ 임박만(N)] 건수 표시 & 전체 구문·JSX 재검증",
    changes: [
      "시각화·편의성 개선: 냉장고 [⏰ 임박만] 버튼에 임박 재료 건수 실시간 표시, 홈 시간대·브리핑 바 flex-wrap 안전 배치 적용",
      "배포 재검증: V8(node --check) 종료코드 0 · JSX 태그/프래그먼트 불일치 0건 · 중복 선언 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.61",
    version: "v11.61",
    date: "2026-11-18",
    title: "홈 수유시간 줄바꿈 해소 · 홈 가독성 정돈 · 냉장고 버튼 줄바꿈 수정 & [⏰ 임박만] 필터",
    changes: [
      "홈 화면 정돈: 수유·기저귀·수면 경과 시간에 whitespace-nowrap 적용해 '2시간 32분 전' 줄바꿈 완전 해소, 케어 카드 제목 간소화 및 시간대 바 여백 정돈",
      "냉장고 줄바꿈 수정: 상단 위치 탭·[+ 재료 추가]·[칸별 뷰]·하단 4종 액션 버튼(반만먹음·다먹음·+장보기·폐기) 크기·줄바꿈 정돈",
      "편의성 개선: 냉장고 리스트 뷰에 [⏰ 임박만] 1탭 필터 버튼 추가"
    ]
  },
  {
    id: "patch-v11.60",
    version: "v11.60",
    date: "2026-11-17",
    title: "상단 헤더 겹침 해소 · 홈편집 팝업 모달 전환 & 전체 줄바꿈·간격 정상화",
    changes: [
      "헤더 겹침 수정: 상단 상태 배지(연결됨·버전·관리자)와 [✏️ 편집] 버튼 크기·여백을 10px/px-1.5로 정돈해 왼쪽 배지가 가려지지 않도록 개선",
      "홈편집 팝업화: [✏️ 편집] 클릭 시 인라인 밀림 없이 깔끔한 팝업 모달(스크롤·[✅ 편집 완료])로 홈 화면을 편집하도록 개편",
      "줄바꿈·간격 정상화: 하단 탭 바·홈 5종 버튼·육아 서브탭·필터 칩의 폰트/패딩을 균형 있게 조정해 어색한 줄바꿈 해소"
    ]
  },
  {
    id: "patch-v11.59",
    version: "v11.59",
    date: "2026-11-17",
    title: "기저귀 원탭/롱프레스 즉시 기록 (짧게=소변 · 길게 0.5초=대변)",
    changes: [
      "원탭 기저귀 기록: 홈 화면과 [🍼 수유·생활]의 🧷 기저귀 버튼을 짧게 누르면 소변, 0.5초 이상 길게 누르면 대변으로 팝업 없이 즉시 기록되도록 개선"
    ]
  },
  {
    id: "patch-v11.58",
    version: "v11.58",
    date: "2026-11-17",
    title: "전체 가독성 글씨 크기 상향(테두리·표 크기 유지) · 케어 카드 색상 포인트 & [⬆️ 위로] 플로팅 버튼",
    changes: [
      "가독성 개선: 카드 패딩·표 크기·테두리는 유지하면서 전체 텍스트 크기 체계를 한 단계씩(+1.5px) 비례 상향해 제목·본문·라벨 위계를 유지한 채 시인성 강화",
      "시각화 개선: 홈 케어 현황 3칸 타일 상단에 기저귀(앰버)·수유(로즈)·수면(인디고) 컬러 포인트 바 적용",
      "편의성 개선: 스크롤 시 좌측 하단에 [⬆️ 위로] 플로팅 버튼을 표시해 1탭으로 상단 복귀"
    ]
  },
  {
    id: "patch-v11.57",
    version: "v11.57",
    date: "2026-11-17",
    title: "홈 편집 버튼 상단(알림 왼쪽) 이동 & 날씨·시율 케어 현황 표시/숨김 선택 지원",
    changes: [
      "헤더 배치 개선: [✏️ 홈편집] 버튼을 홈 화면 맨 위 알림(🔔) 버튼 왼쪽으로 이동해 즉시 접근 가능",
      "표시/숨김 확장: 홈 편집 패널에서 [🌤️ 날씨 배너]와 [👶 시율 케어현황]의 표시·숨김 여부를 시간대별로 직접 선택 가능"
    ]
  },
  {
    id: "patch-v11.56",
    version: "v11.56",
    date: "2026-11-17",
    title: "마지막 수유 경과 표시를 베이비타임 방식(최근 수유 시작~현재 + 직전 수유 시작~현재)으로 통일",
    changes: [
      "로직 수정: 마지막 수유 카드 1줄은 [가장 최근 수유 시작~현재 경과시간(색상 아이콘)], 2줄은 [그 직전 수유 시작~현재 경과시간(• 색상 점)]으로 홈과 수유·생활 탭 모두 동일하게 반영"
    ]
  },
  {
    id: "patch-v11.55",
    version: "v11.55",
    date: "2026-11-17",
    title: "홈 실시간 타이머 배지 · 수유/기저귀/수면 필터 · [📋 오늘 요약] 복사 & 3일 접기 시각화 개선",
    changes: [
      "시각화 개선: 홈 케어 카드 상단에 진행 중 실시간 타이머(MM:SS) 배지 표시, 일자별 헤더에 총 수면시간 추가 및 기본 최근 3일 표시 + [더 보기/접기]로 긴 타임라인 정돈",
      "편의성 개선: [전체/🍼 수유/🧷 기저귀/😴 수면] 빠른 필터 칩 및 [📋 오늘 요약] 1탭 클립보드 복사 버튼 추가"
    ]
  },
  {
    id: "patch-v11.54",
    version: "v11.54",
    date: "2026-11-17",
    title: "홈 탭 5종 바로 기록 버튼 · 시작시간 기준 수유 체크 & 수유·생활 탭 상단 자동 스크롤",
    changes: [
      "홈 탭 바로 기록: 홈 화면 [👶 시율 실시간 케어 현황] 카드에 [🤱 모유 / 🧷 기저귀 / 😴 수면 / 🧴 유축 / 💚 유축수유] 1탭 바로 기록 버튼 추가",
      "수유 시작시간 기준: 마지막 수유 경과 시간과 이전 수유 텀을 시작 시각(startMs) 기준으로 명확히 표시",
      "자동 스크롤: [🍼 수유·생활] 탭 또는 홈 케어 카드 클릭 시 원탭 기록 영역이 화면 맨 위로 바로 보이도록 자동 이동"
    ]
  },
  {
    id: "patch-v11.53",
    version: "v11.53",
    date: "2026-11-17",
    title: "수유·생활 오늘 요약 배지 · 직접 시각(HH:MM) 선택기 & 배포 구문 전수 재검증",
    changes: [
      "시각화·편의성 개선: [🍼 수유·생활] 상단에 오늘 수유 횟수·ml·모유 시간·기저귀 횟수 요약 배지를 추가하고, 모달에서 직접 시각(HH:MM) 입력 및 타이머 배너 [⏹️ 지금 다 먹었어요!] 연동 강화",
      "배포 검증: V8(node --check) 종료코드 0 · JSX 태그 불일치 0건 · 중복 선언 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.52",
    version: "v11.52",
    date: "2026-11-17",
    title: "수유·활동 상세 입력 모달 개편 ([지금 다 먹었어요!] · 시간 스테퍼 · 모유 위치 · 빠른 메모 태그)",
    changes: [
      "신규 기능: 수유/활동 상세 모달에 [지금 다 먹었어요!] 버튼 추가 — 누르는 즉시 현재 시각을 완료 시간으로 반영하고 시작~현재 소요시간(분)을 자동 계산",
      "편의성 개선: 시작 시간 빠른 조정([-1H/-10분/-1분/+1분/+10분/+1H]), 수유 시간 스테퍼([-5분/-1분/+1분/+5분]), 모유 위치 6종(모름·왼쪽·오른쪽·양쪽·왼→오·오→왼), 빠른 메모 칩(+ 트림 안함·트림 함·유산균 등) 추가"
    ]
  },
  {
    id: "patch-v11.51",
    version: "v11.51",
    date: "2026-11-17",
    title: "외부 일기(.zip) 파일 선택기 multiple 속성 누락 수정 (다중 선택 정상화)",
    changes: [
      "버그 수정: [📥 외부일기(.zip)]의 파일 입력(babytimeZipInputRef)에 빠져 있던 multiple 속성을 추가해 일기·활동 ZIP 모두 여러 파일 동시 선택이 가능하도록 수정"
    ]
  },
  {
    id: "patch-v11.50",
    version: "v11.50",
    date: "2026-11-17",
    title: "외부 일기·활동 ZIP 여러 파일 동시 일괄 업로드 지원",
    changes: [
      "다중 파일 업로드: [📥 외부일기(.zip)] 및 [📥 베이비타임(.zip)] 파일 선택 시 여러 달치 ZIP 파일을 한 번에 여러 개 선택해 연속 파싱·중복 제거 후 클라우드에 일괄 저장하도록 개선"
    ]
  },
  {
    id: "patch-v11.49",
    version: "v11.49",
    date: "2026-11-17",
    title: "외부 일기·활동 ZIP 업로드 시 [김시목 / 김시율] 대상 아이 직접 선택 팝업 추가",
    changes: [
      "오류 해결: 파일명에 아이 이름이 없거나 현재 탭이 다른 아이로 선택돼 있어도 잘못 연결되지 않도록 [📥 외부일기(.zip)]·[📥 베이비타임(.zip)] 클릭 시 [👦 김시목 / 👶 김시율] 선택 팝업을 먼저 띄워 선택한 아이로 정확히 저장"
    ]
  },
  {
    id: "patch-v11.48",
    version: "v11.48",
    date: "2026-11-17",
    title: "시율이 수유·기저귀·수면 원탭 타이머 & 베이비타임 Activity(.zip) 클라우드 업로드 신설",
    changes: [
      "신규 메뉴 [🍼 수유·생활]: 모유(왼/오 방향전환)·분유·유축수유·이유식·기저귀·수면·유축·목욕·터미타임·투약·기타 원탭 즉시 기록 + 종료 시 한 번 더 눌러 완료하는 실시간 타이머 도입",
      "색상 구분 & 홈 현황: 모유(로즈)·분유(앰버)·유축수유(라임) 색상 구분 및 홈 화면 [👶 시율 실시간 케어 현황] 3칸 카드(마지막 기저귀·수유+이전 텀·수면) 추가",
      "외부 데이터 클라우드 업로드: [📥 베이비타임(.zip)]으로 Activity ZIP 업로드 시 HTML/TXT 내 모든 기록과 기저귀 사진까지 자동 압축해 Firebase(family_baby_activities_v1)에 저장"
    ]
  },
  {
    id: "patch-v11.47",
    version: "v11.47",
    date: "2026-11-17",
    title: "외부 육아앱(베이비타임) 일기·사진·성장기록 ZIP 클라우드 직접 업로드 기능 도입",
    changes: [
      "신규 기능: 육아일기 상단에 [📥 외부일기(.zip)] 버튼 추가 — 베이비타임 등에서 내보낸 ZIP을 선택하면 코드 내장 없이 일기 글·사진(자동압축)·몸무게/키 성장기록을 파싱해 Firebase 클라우드에 즉시 업로드",
      "중복 방지: 이미 저장된 날짜·내용의 일기나 성장 수치는 자동으로 중복 건너뛰기 처리"
    ]
  },
  {
    id: "patch-v11.46",
    version: "v11.46",
    date: "2026-11-17",
    title: "레시피북 모바일 검색·필터 2단 정돈, 검색어 지우기 & [🎲 랜덤 추천] 도입",
    changes: [
      "시각화 개선: 레시피북 검색창이 좁아지지 않도록 검색창(1행)과 난이도·정렬(2행)을 깔끔하게 분리",
      "편의성 개선: 레시피 검색창 우측 [✕] 빠른 초기화 버튼 추가",
      "신규 기능: 현재 조건에 맞는 레시피 중 하나를 즉시 골라주는 [🎲 랜덤 추천] 버튼 도입",
      "전수 검증: V8(node --check) 구문 검증 및 JSX·상태·아이콘 오류 0건 재확인"
    ]
  },
  {
    id: "patch-v11.45",
    version: "v11.45",
    date: "2026-11-17",
    title: "장보기·가족공지 버튼 줄바꿈 개선 · 미완료 공지 필터 & 공지 1탭 복사 추가",
    changes: [
      "시각화 개선: 장보기 [❄️ 입고] 버튼과 가족공지 [+ 공지 작성]·[✓ 확인완료] 버튼에 whitespace-nowrap을 적용해 모바일 줄바꿈 방지",
      "편의·신규 기능: 가족공지 탭에 [진행 중/완료] 요약 바, [미완료만 보기] 토글 및 공지별 [📋 복사] 1탭 버튼 추가",
      "전수 검증: 전체 파일 JSX·문자열·상태·아이콘 오류 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.44",
    version: "v11.44",
    date: "2026-11-17",
    title: "1MB 초과 백업 공유 지연 해결을 위한 [사진 제외 경량 백업] 버튼 추가 & 용량 안내",
    changes: [
      "경량 백업 도입: 육아일기 사진(Base64)으로 1MB를 넘어 공유 창/복사가 막히는 경우를 위해 수십 KB 단위의 [📄 사진 제외 경량 백업 보내기] 버튼 추가",
      "용량 표시: 백업 공유·다운로드 시 실제 파일 용량(KB/MB)을 안내 토스트로 함께 표시"
    ]
  },
  {
    id: "patch-v11.43",
    version: "v11.43",
    date: "2026-11-17",
    title: "장보기 진행률 바·남은 목록 1탭 복사 · 체크 품목 냉장고 일괄 입고 & 냉장고 구역 바 정합성 개선",
    changes: [
      "오류·정합성 개선: 냉장고 구역 분포 바가 표준 fridge 배열을 직접 참조하도록 통일해 qty/quantity 불일치 가능성 제거",
      "시각화·편의 개선: 장보기 탭 상단에 [남음/담음(%)/긴급] 진행률 바 및 [📋 남은 목록 복사] 1탭 버튼 추가",
      "신규 기능: 장보기 체크 완료 품목을 영수증 스캔 없이도 즉시 냉장고 재고로 일괄 이동하는 [❄️ 냉장고에 바로 넣기] 기능 도입"
    ]
  },
  {
    id: "patch-v11.42",
    version: "v11.42",
    date: "2026-11-17",
    title: "네이버 메일 백업 전송(파일 다운로드 후 네이버 메일 작성 창 열기)으로 전환",
    changes: [
      "백업 메일 변경: 클립보드 복사 실패를 없애고, 백업 JSON 파일을 즉시 다운로드한 뒤 네이버 메일 작성 창(mail.naver.com/v2/new)을 바로 열어 파일 첨부하도록 개선"
    ]
  },
  {
    id: "patch-v11.41",
    version: "v11.41",
    date: "2026-11-17",
    title: "Gmail·드라이브 파일 첨부 공유 개선(다운로드 창 제거) & 월간 원장 스크롤·접기 시각화 개선",
    changes: [
      "백업 공유 개선: 모바일 브라우저가 .json 공유를 막을 때 text/plain(.txt)으로 자동 전환해 파일이 첨부된 Gmail·드라이브 공유 창이 바로 열리도록 수정(원치 않는 다운로드 창 제거, 미지원 환경은 클립보드 복사 + Gmail 웹 작성 창 연동)",
      "복원 호환성: .json뿐 아니라 .txt로 공유된 백업 파일도 1초 복원에서 그대로 읽히도록 확장",
      "시각화·편의 개선: 월간 식비 원장이 길어질 때 기본 10건 표시 + 스크롤(max-h-96) 및 [더 보기/접기] 버튼 추가"
    ]
  },
  {
    id: "patch-v11.40",
    version: "v11.40",
    date: "2026-11-17",
    title: "기록 불러오기 무응답·냉장고 구역 ReferenceError 수정 & 성장기록 즉시 입력 후 불러오기",
    changes: [
      "치명 오류 수정: [✨ 기록 불러오기] 내 미정의 변수(routines·todos → familyRoutines·schedules) 및 냉장고 구역 분포 바 미정의 변수(fridgeItems → fridgeMap) 완전 해결",
      "성장기록 즉시 입력·불러오기: 기록 불러오기 모달 안에서 키·몸무게·머리둘레를 바로 입력·저장하고 즉시 일기 본문에 삽입하는 기능 추가",
      "전수 검증: 전체 파일 내 미선언 변수 속성 접근 0건·끊긴 문자열 0건·JSX 태그 불일치 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.39",
    version: "v11.39",
    date: "2026-11-17",
    title: "오늘·어제 동시 선택 버그 수정 · 일기 수정취소 · 사진만 보기 필터 & 오늘 기록 완료 배지",
    changes: [
      "버그 수정: 육아일기 작성란의 [어제] 버튼이 getOffsetDateStr(-1) 인자 누락으로 오늘 날짜와 같아져 [오늘][어제]가 동시 선택되던 문제(getOffsetDateStr(getTodayStr(), -1)) 완전 해결",
      "편의성 개선: 기존 육아일기 수정 중 바로 빠져나올 수 있는 [수정 취소] 버튼 추가",
      "시각화·신규기능: 일기 요약 바에 [오늘 기록(완료 ✓/미작성)] 상태 표시 및 [📸 사진만] 모아보기 필터 토글 도입"
    ]
  },
  {
    id: "patch-v11.38",
    version: "v11.38",
    date: "2026-11-17",
    title: "Vercel 배포 빌드 오류(줄바꿈 문자열 리터럴 3건) 완전 수정 및 전체 구문 검증",
    changes: [
      "빌드 수정: 월간 원장 복사(13088행)·월별 일기 모아복사(17858행)·기록 선택 불러오기(21345행) 내 줄바꿈 문자열 리터럴(\"\\n\") 깨짐 3건 완전 복구",
      "전수 검증: 전체 파일 내 끊긴 문자열 리터럴 0건·중복 useState 0건·미사용 상태/아이콘 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.37",
    version: "v11.37",
    date: "2026-11-17",
    title: "전반적 오류 점검 · 홈 날씨 상태 실연동 · 냉장고 구역 요약 · 월간 6개월 추이 & 식비 페이스 예측",
    changes: [
      "오류 점검: 미사용 상태이던 isWeatherLoading·weatherError를 홈 날씨 배너에 실연동(로딩 스피너·오류 재시도 표시) 및 전체 코드 정적 검증 완료",
      "시각화 개선: 월간 식비 탭에 최근 6개월 식비 비교 미니 막대 그래프 추가, 냉장고 탭에 보관 구역별(냉장·냉동·실온) 3칸 현황 바 추가",
      "편의성 개선: 냉장고 구역 카드 1탭 필터 전환 및 월간 식비 원장 헤더에 [📋 원장 복사] 버튼 추가",
      "신규 기능: 월간 식비 가계부에 [월말 예상 지출 & 남은 기간 하루 권장 식비] 페이스 예측 카드 도입"
    ]
  },
  {
    id: "patch-v11.36",
    version: "v11.36",
    date: "2026-11-17",
    title: "육아일기 바로 고화질 자동압축 · 글 우선 배치 · 기록 선택 불러오기 & 월별 모아보기·복사",
    changes: [
      "사진 저장 단순화: Storage 대기 없이 바로 고화질 자동 압축(최대 4장)으로 빠르게 저장되도록 개선하고 미사용 uploadBytes·getDownloadURL 임포트 정리",
      "일기 배치 통일: 일기 카드 화면과 한 장 내보내기 모두 글(제목·본문)이 먼저, 사진이 아래에 보이도록 배치 통일 및 📸 사진 장수 배지 추가",
      "선택형 기록 불러오기: [✨ 기록 불러오기] 클릭 시 식단·성장·진료·완료 루틴·일정·할 일 중 원하는 항목만 체크해 일기에 넣는 선택 모달 도입",
      "시각화·편의·신규기능: 일기 작성 [오늘/어제] 1탭 날짜 버튼, 월간·사진 요약 스트립, 월별 필터 및 [📋 이 달 일기 모아 복사] 기능 추가"
    ]
  },
  {
    id: "patch-v11.35",
    version: "v11.35",
    date: "2026-11-17",
    title: "육아일기 저장 진행률(92% 고정) 버그 수정 & 3초 Storage 원본 시도 후 자동압축",
    changes: [
      "버그 수정: 육아일기 저장 완료 후에도 상단/버튼 진행률(92%)이 사라지지 않던 문제(finally 초기화 누락 및 서버 ACK 대기) 완전 해결",
      "사진 저장 개선: 사진마다 최대 3초간 Firebase Storage 원본 업로드를 먼저 시도하고, 3초 초과·미사용 시 즉시 고화질 자동 압축으로 전환",
      "진행 현황 표시: 원본 업로드 시도(1/N장 · 최대 3초) → 자동 압축 전환 → 서버 저장 → 완료 단계를 실시간 퍼센트와 안내 문구로 표시"
    ]
  },
  {
    id: "patch-v11.34",
    version: "v11.34",
    date: "2026-11-17",
    title: "Vercel 배포 빌드 오류(육아일기 카드 중복 </div> 태그) 즉시 수정",
    changes: [
      "빌드 수정: 육아일기 카드 상단(17616행)의 중복 닫힘 </div> 태그 1건을 제거해 Vite/Vercel 빌드 오류 완전 해결",
      "전수 검증: 전체 JSX 태그·프래그먼트 짝 및 미정의 함수 호출·중복 상태 0건 최종 확인"
    ]
  },
  {
    id: "patch-v11.33",
    version: "v11.33",
    date: "2026-11-17",
    title: "월간 식비 원장 검색·카테고리 필터 · 미사용 Storage 임포트 정리 & 전체 정적 검증",
    changes: [
      "오류 점검: 미사용 firebase/storage 임포트(uploadBytes·getDownloadURL) 제거 및 전체 21,900+행 미정의 함수 호출·중복 상태·TDZ 전수 검증 완료",
      "시각화 개선: 육아일기 사진 첨부 시 첨부 장수(N/4장)·자동 최적화 안내 바 추가",
      "편의성 개선: 월간 식비 가계부 원장 상단에 [🔍 지출 품목 검색...] 입력란 추가",
      "신규 기능: 월간 식비 가계부 원장에 카테고리별 필터 칩 및 필터링된 지출 합계 자동 계산 기능 도입"
    ]
  },
  {
    id: "patch-v11.32",
    version: "v11.32",
    date: "2026-11-17",
    title: "할 일 탭 오류 수정 · 육아일기 압축 전용(최대4장)·내보내기 본문우선/선택저장·버튼 줄바꿈 & AI제거",
    changes: [
      "오류 수정: 일정→할 일 탭에서 발생하던 addDaysToDate 미정의 오류 및 냉장고 칸 추가·일괄이동 미정의 헬퍼(shelfZoneToLocation·getOffsetDateStr) 3건 완전 해결",
      "육아일기 저장 개편: 유료 Storage 대기 없이 즉시 자동 압축(최대 4장 제한) 저장하도록 단순화·고속화",
      "육아일기 내보내기 개선: 글(제목·본문)이 먼저 오고 그 아래 사진이 배치되도록 순서 변경, 자동 다운로드 제거(미리보기에서 공유/다운로드 직접 선택)",
      "UI·편의 개선: 육아일기 카드 [📄 복사]·[🖼️ 한 장 내보내기] 버튼 세로 줄바꿈 수정 및 실용성 낮은 [✨ AI 다듬기] 기능 제거"
    ]
  },
  {
    id: "patch-v11.31",
    version: "v11.31",
    date: "2026-11-17",
    title: "육아일기 Storage 타임아웃 5초 단축 · 사진 업로드 진행률 바 표시",
    changes: [
      "타임아웃 단축: Firebase Storage 응답 대기 시간을 8초에서 5초로 단축해 실패 시 더 빠르게 폴백 전환",
      "진행률 표시: 육아일기 사진 업로드·저장 중 상단 플로팅 진행률 팝업 및 버튼 아래 진행 바(%)를 실시간 표시하고 중복 클릭 방지"
    ]
  },
  {
    id: "patch-v11.30",
    version: "v11.30",
    date: "2026-11-17",
    title: "오류 원인 경고 배너 표시 강화 · 알림에서 육아일기 클릭 시 해당 일기로 바로 이동",
    changes: [
      "오류 경고 강화: 동기화·Storage·저장 오류 발생 시 상단 경고 배너 및 육아일기 폼 내 경고 박스에 정확한 오류 원인이 함께 표시되도록 개선",
      "알림 바로가기: 최근 수정 알림 모달 및 실시간 알림 팝업에서 육아일기 항목을 누르면 해당 아이·일기 카드 위치로 즉시 이동 및 강조 표시"
    ]
  },
  {
    id: "patch-v11.29",
    version: "v11.29",
    date: "2026-11-17",
    title: "Firebase Storage 꺼짐 상태에서도 육아일기 다중 사진(1MB 이하 자동 압축) 100% 저장 수정",
    changes: [
      "버그 수정: Base64 폴백 저장 시 photoUrl과 photoUrls에 사진이 중복(2배 용량) 저장되어 Firestore 1MB 제한을 초과하던 문제 해결",
      "용량 최적화: 첨부 사진 장수에 맞춰 장당 목표 용량(총 720KB 이내)으로 해상도·화질을 자동 조절해 Storage 없이도 여러 장 안정 저장",
      "타임아웃 보완: Storage 업로드에 8초 타임아웃을 적용해 미활성화 환경에서 대기 없이 즉시 압축 폴백 저장되도록 개선"
    ]
  },
  {
    id: "patch-v11.28",
    version: "v11.28",
    date: "2026-11-17",
    title: "To-Do 실시간 검색 · 오늘/내일/주말 원탭 날짜 단축 · 달성률 배지 & 전체 점검",
    changes: [
      "오류 점검: To-Do 검색 필터가 [완료됨 비우기] 일괄 삭제 범위에 간섭하지 않도록 UI 계층에서 안전하게 분리하고 전체 TDZ·중복 상태·미사용 아이콘 검증",
      "시각화 개선: To-Do 진행률 바 상단에 완료율(%) 배지를 함께 표시해 진행 현황을 즉시 파악 가능",
      "편의성 개선: To-Do 빠른 입력 바에 [오늘 / 내일 / 이번주말] 원탭 날짜 단축 버튼을 추가해 날짜 피커 조작 최소화",
      "신규 기능: To-Do 체크리스트 상단에 [🔍 할 일 검색...] 실시간 필터 기능 도입"
    ]
  },
  {
    id: "patch-v11.27",
    version: "v11.27",
    date: "2026-11-17",
    title: "장보기 품목 검색·상태 필터 · 냉장고 부족/임박 재료 1탭 담기 & 전체 점검",
    changes: [
      "오류 점검: 장보기 카톡 복사 실패 시 빈 catch 대신 안내 토스트가 뜨도록 보완하고 중복 상태·TDZ·미사용 아이콘 최종 검증",
      "시각화 개선: 장보기 목록에 [전체 / 남은 품목 / 담은 품목] 상태 필터 칩을 추가해 긴 목록도 한눈에 구분",
      "편의성 개선: 장보기 목록 상단에 [🔍 품목 검색...] 입력창을 추가해 중복 등록 전에 기존 등록 여부를 즉시 확인",
      "신규 기능: 냉장고에서 소비기한 임박·소진 임박(1개 이하) 재료를 자동 감지해 1탭으로 장보기에 담는 [❄️ 냉장고 보충 추천] 바 도입"
    ]
  },
  {
    id: "patch-v11.26",
    version: "v11.26",
    date: "2026-11-17",
    title: "홈 루틴 미니 진행률 바 · 오늘 브리핑 루틴 연동 · 토스트 통일 및 전체 점검",
    changes: [
      "오류 점검: 백업 복원 오류 알림을 브라우저 기본 alert()에서 통합 토스트(showToast)로 교체하고 MainApp TDZ·중복 상태·미사용 아이콘 최종 검증",
      "시각화 개선: 홈 화면 루틴 카드 상단에 '오늘 완료율(N/M · %)' 미니 진행률 배지와 프로그레스 바 추가",
      "편의성 개선: 홈 [📋 브리핑] 복사 시 오늘 남은 시간 지정 루틴(⏰ 17시30분 등)도 함께 포함되도록 개선",
      "신규 기능: 홈 화면에서 탭 이동 없이 오늘 전체 루틴 달성률을 실시간으로 확인 가능"
    ]
  },
  {
    id: "patch-v11.25",
    version: "v11.25",
    date: "2026-11-17",
    title: "루틴 시간표 타임라인 · 지남/예정 시각 강조 · 홈 시간순 정렬 & 원탭 시간 프리셋",
    changes: [
      "오류 점검: 홈 화면 루틴(visibleRoutineList)에도 수행시간(scheduledTime) 오름차순 정렬을 적용하고 미사용 상태(useState) 4건 정리",
      "시각화 개선: 수행 시간이 지난 미완료 루틴 배지를 '⏰ 17시30분 · 지남' 호박색 배지로 강조해 즉시 구분 가능",
      "편의성 개선: 루틴 추가·수정 모달에 원탭 시간 프리셋(07:30·09:00·12:00·17:30·20:00·21:30) 버튼 추가",
      "신규 기능: 수행 시간이 지정된 루틴이 있을 때 루틴 탭 상단에 '⏰ 오늘 시간표' 가로 타임라인 스트립을 자동 표시(원탭 완료 토글 지원)"
    ]
  },
  {
    id: "patch-v11.24",
    version: "v11.24",
    date: "2026-11-17",
    title: "루틴별 수행시간(예: 17시30분) 태그 기능 추가",
    changes: [
      "반복 루틴 추가·수정 모달에 수행 시간(선택) 입력란을 추가해 '17:30' 형태로 시각 지정 가능",
      "루틴 탭 및 홈 화면 루틴 카드에 '⏰ 17시30분' 태그 배지를 표시하고 같은 시간대 내 시간순 정렬 적용"
    ]
  },
  {
    id: "patch-v11.23",
    version: "v11.23",
    date: "2026-11-17",
    title: "루틴 [아침 일괄완료] 버튼 제거 · 식단 메뉴 검색 필터 도입 · 전체 최종 점검",
    changes: [
      "요청에 따라 반복 루틴 상단의 [🌅 아침 일괄완료] 버튼을 제거해 헤더를 깔끔하게 정리 (완료 보존 병합 로직은 유지)",
      "식단 탭 상단에 [🔍 식단 검색] 입력란을 추가해 조회 기간 내 원하는 메뉴·재료를 즉시 찾아볼 수 있도록 개선",
      "전체 21,300+행 TDZ·JS 구문·JSX 태그·중복 상태 최종 검증 완료"
    ]
  },
  {
    id: "patch-v11.22",
    version: "v11.22",
    date: "2026-11-17",
    title: "반복 루틴 오늘 달성률(%) 프로그레스 바 추가 및 전체 코드 최종 검증",
    changes: [
      "반복 루틴 상단에 오늘 전체 루틴 완료율(N/M건 · %) 세이지그린 프로그레스 바 추가",
      "전체 21,300+행 TDZ·JS 구문·JSX 태그·중복 상태 최종 검증 완료"
    ]
  },
  {
    id: "patch-v11.21",
    version: "v11.21",
    date: "2026-11-17",
    title: "반복 루틴 완료 상태 덮어쓰기 방지 · [🌅 아침 루틴 일괄 완료] 1탭 복구 버튼 추가",
    changes: [
      "syncRoutinesToCloud 일괄 동기화 시 서버에 이미 완료된 오늘/이번주/이번달 루틴 기록(lastDoneKey·stepDoneKey)이 실수로 초기화되지 않도록 서버 완료 상태 보존 병합 로직 적용",
      "오전 시간이 지난 뒤 미완료된 아침 루틴이 남아있을 경우 1탭으로 일괄 완료 복구할 수 있는 [🌅 아침 일괄완료] 버튼 추가"
    ]
  },
  {
    id: "patch-v11.20",
    version: "v11.20",
    date: "2026-11-17",
    title: "육아일기 전체 모아보기 필터 · [📄 텍스트 복사] 도입 · 전체 코드 최종 무결성 검증",
    changes: [
      "육아일기 검색창 아래에 [전체 | 시목 | 시율] 필터 칩을 추가해 두 아이 일기를 한 타임라인으로 모아볼 수 있도록 개선",
      "각 육아일기 카드에 [📄 복사] 버튼을 추가해 날짜·월령·제목·내용을 카톡/블로그용 텍스트로 1탭 복사 가능",
      "전체 코드(21,200+행) TDZ·JSX·JS 구문·중복 상태 최종 검증 완료"
    ]
  },
  {
    id: "patch-v11.19",
    version: "v11.19",
    date: "2026-11-17",
    title: "육아일기 버튼 줄바꿈 수정 · 홈 날씨 잘림 해소(2줄 전체표시) · 동시대상 안내 및 글자수 표시",
    changes: [
      "육아일기 작성 하단 버튼(사진첨부·기록불러오기·AI다듬기·일기저장)이 세로로 찌그러지던 줄바꿈을 2단 레이아웃으로 깔끔하게 수정",
      "홈 화면 날씨 바의 말줄임(truncate)을 제거하고 기온·비 예보·미세·초미세먼지 핵심 정보가 잘리지 않고 모두 보이도록 2줄 구성으로 개선",
      "[시목·시율 함께] 선택 시 입력 안내 문구 자동 연동 및 일기 본문 글자 수 카운터 추가"
    ]
  },
  {
    id: "patch-v11.18",
    version: "v11.18",
    date: "2026-11-17",
    title: "날씨 30분 자동 갱신 · 상세 날씨 새로고침/공유 · 오늘 브리핑 비 예보 자동 연동",
    changes: [
      "앱을 오래 켜두거나 백그라운드에서 복귀할 때 마지막 날씨 조회 후 30분이 지났으면 자동으로 최신 비·날씨 예보를 재조회",
      "상세 날씨 모달 상단에 [↻ 새로고침] 및 [📋 날씨 복사] 버튼 추가, 비 예보가 있는 주간 요일 행 강조",
      "홈 [📋 브리핑] 복사 텍스트에 오늘 비 예보 및 우산 안내 문구가 자동으로 포함되도록 고도화"
    ]
  },
  {
    id: "patch-v11.17",
    version: "v11.17",
    date: "2026-11-17",
    title: "홈 날씨 바 오늘 비 예보(강수확률) 표시 및 클릭 시 시간대별·주간 상세 날씨 모달 추가",
    changes: [
      "지금 비가 안 와도 오늘 남은 시간대 비 예정 여부(예: ☔ 17~20시 비 70%)를 홈 날씨 바에 바로 표시",
      "홈 날씨 바를 누르면 오늘 시간대별 강수확률·강수량·7일 주간예보 및 네이버 날씨 바로가기를 볼 수 있는 상세 날씨 모달 추가"
    ]
  },
  {
    id: "patch-v11.16",
    version: "v11.16",
    date: "2026-11-17",
    title: "육아일기 사진 라이트박스 확대 · 사진 순서(◀/▶) 변경 · [✨ AI 문장 다듬기] 도입",
    changes: [
      "육아일기 카드의 사진을 누르면 원본 화질로 전체 화면 확대해 볼 수 있는 라이트박스 모달(ESC 닫기 지원) 추가",
      "여러 장 첨부한 사진의 순서를 [◀ / ▶] 버튼으로 자유롭게 변경하고, 삭제 시 blob 메모리 자동 해제",
      "짧은 메모만 적어도 따뜻한 일기 제목과 문장으로 다듬어 주는 [✨ AI 다듬기] 기능 도입"
    ]
  },
  {
    id: "patch-v11.15",
    version: "v11.15",
    date: "2026-11-17",
    title: "육아일기 [시목·시율 함께] 동시 작성 및 사진 2장 이상 다중 첨부·내보내기 지원",
    changes: [
      "육아일기 대상에 [👦👶 시목·시율 함께] 옵션을 추가해 두 아이 기록을 동시에 남기고 양쪽 탭에서 모두 열람 가능",
      "사진을 2장 이상 다중 선택·추가 첨부할 수 있으며, 한 장 내보내기 시 모든 사진의 원본 비율을 유지해 세로로 예쁘게 합본 생성"
    ]
  },
  {
    id: "patch-v11.14",
    version: "v11.14",
    date: "2026-11-17",
    title: "홈 [📋 오늘 브리핑 복사] · 장보기 진행바·카톡 복사 · JSON 복원 육아일기 연동",
    changes: [
      "홈 화면 상단에 오늘의 날씨·식단·일정·임박 재료를 카톡용 텍스트로 1초 만에 복사하는 [📋 오늘 브리핑] 도입",
      "장보기 탭에 구매 진행률 프로그레스 바와 미구매 품목 [📋 카톡 복사] 버튼 추가",
      "전체 JSON 백업 복원(handleImportJson) 시 관리자 육아일기(family_baby_diary_v8)도 함께 복원되도록 보완"
    ]
  },
  {
    id: "patch-v11.13",
    version: "v11.13",
    date: "2026-11-17",
    title: "육아일기 월별 앨범 헤더 · [✨ 오늘 식단·성장 불러오기] · 1탭 공유 · Storage 삭제 연동",
    changes: [
      "육아일기 작성 시 해당 날짜의 아기 식단·최신 성장·진료 기록을 본문에 1탭으로 자동 첨부하는 [✨ 오늘 기록 불러오기] 도입",
      "육아일기 목록에 [YYYY년 MM월] 앨범형 그룹 헤더를 적용해 월별 추억 탐색 가독성 강화",
      "한 장 내보내기 모달에 모바일 카톡/가족방 바로 전송용 [📤 공유하기] 버튼 추가 및 일기 삭제 시 Storage 원본 파일도 함께 정리"
    ]
  },
  {
    id: "patch-v11.12",
    version: "v11.12",
    date: "2026-11-17",
    title: "육아일기 Firebase Storage 원본 화질 사진 업로드 지원 (미설정 시 자동 압축 폴백)",
    changes: [
      "육아일기 사진 첨부 시 Firebase Storage에 원본 화질 그대로 업로드하고, Storage 미활성화 환경에서는 고화질 압축으로 자동 폴백되도록 구현",
      "한 장 내보내기 캔버스에서 Storage URL 이미지를 CORS 안전하게 불러오도록 개선"
    ]
  },
  {
    id: "patch-v11.11",
    version: "v11.11",
    date: "2026-11-17",
    title: "육아일기 사진 원본 비율 유지·가변 길이 내보내기 · 12개월 이상 개월/일수 표기 · 빠른추가 그룹화",
    changes: [
      "육아일기 한 장 내보내기 시 업로드한 사진의 원본 비율을 100% 유지하고, 글 내용이 길어지면 이미지 높이도 자동으로 길어지도록 개선",
      "육아일기 카드 및 내보내기 이미지에 아기 생년월일과 월령(12개월 미만 D+N일 / 12개월 이상 N개월 N일) 표시",
      "우측 하단 [+] 빠른 추가 메뉴를 3개 그룹(식단·냉장고·장보기 / 일정·루틴 / 육아·레시피)으로 정리하고 [📖 육아일기] 바로 작성 추가"
    ]
  },
  {
    id: "patch-v11.10",
    version: "v11.10",
    date: "2026-11-17",
    title: "화면 복구 오류(Cannot access 'uu' before initialization) 근본 수정",
    changes: [
      "visibleRecentActivities(useMemo)가 canViewTab 함수 선언보다 위에서 먼저 실행되던 선언 순서(TDZ) 오류를 바로잡아 초기화 충돌 해결"
    ]
  },
  {
    id: "patch-v11.09",
    version: "v11.09",
    date: "2026-11-17",
    title: "육아일기 검색·JSON 백업 포함 · 전체 모달 ESC 닫기 · 타이머 메모리 정리",
    changes: [
      "관리자 전용 [📖 육아일기]에 키워드 검색창 추가 및 전체 JSON 백업·복원(관리자)에 육아일기 데이터 포함",
      "ESC 키로 식단 복사 모달, 일기장 미리보기, 실시간 알림 팝업까지 일괄 닫기 지원",
      "실시간 알림 팝업 타이머 언마운트 정리(cleanup) 추가로 메모리 누수 방지"
    ]
  },
  {
    id: "patch-v11.08",
    version: "v11.08",
    date: "2026-11-17",
    title: "육아 메뉴 진입 시 관리자 [📖 일기] / 이외 인원 [🌱 발달] 자동 이동 · 일기 UI 개선",
    changes: [
      "하단 [👶 육아] 탭 및 홈 바로가기 클릭 시 관리자는 [📖 일기]로, 이외 인원은 [🌱 발달]로 자동 이동",
      "관리자 화면에서 [📖 일기] 서브탭을 첫 번째로 배치하고 일기 건수 배지 및 [오늘] 날짜 복귀 버튼 추가"
    ]
  },
  {
    id: "patch-v11.07",
    version: "v11.07",
    date: "2026-11-17",
    title: "다른 기기 수정 시 실시간 알림 팝업 · 알림 팝업 ON/OFF 설정 추가",
    changes: [
      "다른 가족이나 육아지원군이 식단·냉장고·일정 등을 수정하면 화면 상단에 실시간 알림 팝업(변경 전후 포함)이 자동 표시",
      "알림 내역 모달 상단에서 [🔔 팝업 ON/OFF] 전환 및 브라우저 푸시 알림 허용 설정 지원"
    ]
  },
  {
    id: "patch-v11.06",
    version: "v11.06",
    date: "2026-11-17",
    title: "식단 오늘자 전체 바로이동 · 직관적 식단 복사 모달 · 관리자 전용 육아일기(사진·예쁜 1장 이미지 내보내기)",
    changes: [
      "하단 [🍽️ 식단] 탭, 더보기, 홈 바로가기 클릭 시 항상 오늘 날짜·전체 가족 식단 리스트로 바로 이동",
      "식단 상단의 불필요한 7일 요약 배지를 제거하고, 복사할 끼니와 붙여넣을 날짜를 직접 골라 복사하는 [📋 식단 복사] 모달 추가",
      "육아 메뉴 내에 관리자 전용 [📖 육아일기] 추가 (날짜 선택, 사진 첨부, 예쁜 일기장 한 장 PNG 이미지 내보내기 및 미리보기)"
    ]
  },
  {
    id: "patch-v11.05",
    version: "v11.05",
    date: "2026-11-17",
    title: "세이지그린 네비게이션 통일 · 냉장고 카테고리 아이콘·반남음 강조 · 최종 점검",
    changes: [
      "하단 내비게이션 활성 탭을 아이보리·세이지그린(#EEF3EE/#35503C) 팔레트로 통일해 시각적 일관성 강화",
      "냉장고 카테고리 필터 및 등록 모달 칩에 직관적인 카테고리 아이콘(🥬🥩🥛🍼🍱🥟🧂🥤📦) 표시",
      "0.5개 등 1개 미만 소량 잔량 품목에 [🌗 반남음] 배지를 표시해 빠르게 찾아 소진할 수 있도록 개선"
    ]
  },
  {
    id: "patch-v11.04",
    version: "v11.04",
    date: "2026-11-17",
    title: "재료 카테고리에 [🥤 음료] 추가",
    changes: [
      "FRIDGE_CATEGORIES 및 냉장고·장보기·AI 스캔·선반 자동배정에 [🥤 음료] 카테고리 추가"
    ]
  },
  {
    id: "patch-v11.03",
    version: "v11.03",
    date: "2026-11-17",
    title: "반복 루틴 단계 한 줄 세로 리스트 가독성 개선 · 식단 [빈 끼니 숨기기] 기본 적용",
    changes: [
      "긴 루틴 단계(예: 가방싸기(수건&턱받이&물컵&투약의뢰서))가 찌그러지거나 화살표(→)가 줄바꿈되던 문제를 없애고 1줄 1단계 세로 리스트로 깔끔하게 개편",
      "식단 메뉴 진입 시 [빈 끼니 숨기기]를 기본값(ON)으로 설정하고, 식단이 없는 날에는 1줄 안내가 표시되도록 개선"
    ]
  },
  {
    id: "patch-v11.02",
    version: "v11.02",
    date: "2026-11-17",
    title: "냉장고 기한 미확인 배지 정밀화 · 소수점(0.5) [-] 차감 보완 · 루틴 새 시간대 줄바꿈 정리",
    changes: [
      "소비기한 미입력 품목이 (D-999) 대신 [⏳ 기한 미확인] 배지로 깔끔하게 표시되도록 개선",
      "0.5개 등 소수점 잔량 상태에서 [-] 버튼 탭 시 오류 없이 0으로 안전하게 차감되도록 보완",
      "반복 루틴 새 시간대 추가 영역의 [평일] [주말] 버튼도 항상 같은 줄에 나란히 유지되도록 정리"
    ]
  },
  {
    id: "patch-v11.01",
    version: "v11.01",
    date: "2026-11-17",
    title: "냉장고 [🌗 반만먹음] 및 0.5 소수점 수량 지원 · 루틴 평일/주말 한 줄 정렬",
    changes: [
      "냉장고 리스트 카드와 시각적 구성 모달에 [🌗 반만먹음] 버튼을 추가하고 소수점 첫째자리(0.5 등) 수량 차감·입력·표시를 지원",
      "반복 루틴 시간대 설정에서 [평일]과 [주말] 토글 버튼이 모바일에서도 항상 같은 줄에 나란히 보이도록 레이아웃 개선"
    ]
  },
  {
    id: "patch-v11.00",
    version: "v11.00",
    date: "2026-11-17",
    title: "알림 상세 변경전후 Diff · 아이보리/세이지그린 디자인 토큰 · 식단 계획/복사/이동/재사용",
    changes: [
      "최근 수정 알림 모달에 [변경 전 → 변경 후] 상세 비교 카드와 정확한 시·분·초 타임스탬프 표시",
      "따뜻한 아이보리(#FAF8F3)·세이지그린(#5E7A65)·베이지(#F3EEE4) 디자인 토큰 및 공통 로딩·빈·오류 상태 UI 적용",
      "식단 기록과 [계획 식단] 구분, 1탭 [✓ 먹음] 전환, 기존 식단 오늘/내일 복사 및 -1일/+1일 날짜 이동 추가",
      "식단 상단에 [↺ 어제 식단 복사] · [↺ 지난주 식단 복사] 및 이번 7일 기록·계획·식비 요약 바 추가"
    ]
  },
  {
    id: "patch-v10.99",
    version: "v10.99",
    date: "2026-11-17",
    title: "냉장고 소비기한 미확인·로트/FEFO·트랜잭션 중복방지 · 변경전후 수량 이력 · 월간 루틴 날짜 보정",
    changes: [
      "소비기한 미입력 시 오늘 날짜로 자동 저장되던 문제를 수정하고 [소비기한 미확인]과 [확정 만료일]을 명확히 구분",
      "구매일·소비기한·보관위치별 로트(lotKey) 관리 및 요리 차감 시 소비기한이 빠른 로트(FEFO) 우선 제안",
      "장보기 입고·수량 조절·요리 차감을 서버 트랜잭션 및 이중클릭 락으로 보호해 음수 재고 및 중복 입고/식비 등록 원천 차단",
      "변경 이력에 변경 전후 수량(예: 2개 → 1개) 기록 및 월간 루틴 당월 실행일 경과 시 다음 달 예정일(윤년·월말·연도변경 보정) 자동 계산"
    ]
  },
  {
    id: "patch-v10.98",
    version: "v10.98",
    date: "2026-11-17",
    title: "용어 통일 · 종모양 읽지 않음 유지 · 빠른등록 권한별 필터 · ESC 모달 닫기 보완",
    changes: [
      "더보기 시트 메뉴명 [식단·주간] → [식단]으로 전체 앱 내비게이션·권한표와 명칭 통일",
      "상단 종모양(🔔) 알림 점이 확인(클릭) 전까지 유지되고 알림 모달을 열면 읽음 처리되도록 개선",
      "우측 하단 [+] 빠른 등록 메뉴가 현재 계정의 편집 허용 메뉴만 스마트하게 필터링해 표시",
      "ESC 키로 최근 수정 알림 모달 및 로그인/권한 모달도 바로 닫히도록 키보드 접근성 보완"
    ]
  },
  {
    id: "patch-v10.97",
    version: "v10.97",
    date: "2026-11-17",
    title: "상단 설정 왼쪽 종모양 알림 통합 · 관리자 비밀번호 노출 제거 · [육아지원군] 명칭 통일",
    changes: [
      "홈 화면의 넓은 최근 수정 알림 배너를 제거하고 맨 위 설정(⚙️) 왼쪽에 콤팩트한 종모양(🔔) 알림 버튼만 배치",
      "로그인·잠금·설정 안내 문구에서 관리자 비밀번호 숫자 노출을 모두 제거",
      "[육아지원군] 권한 명칭을 [육아지원군]으로 전면 통일"
    ]
  },
  {
    id: "patch-v10.96",
    version: "v10.96",
    date: "2026-11-17",
    title: "최근 수정 알림 수정자 필터·권한 연동 · 커스텀 이름 입력 · 루틴 시간대 건수 배지",
    changes: [
      "홈 상단 최근 수정 알림창에 방금 수정 강조 표시(5분 이내) 및 육아지원군 로그인 시 허용된 메뉴의 수정 이력만 안전하게 필터링",
      "최근 수정 알림 모달에 [수정자별(수혁·아리나·육아지원군 등)] 1탭 필터 칩 추가",
      "로그인/권한 모달에서 수정자 이름 직접 입력 지원 및 열람전용 탭 상단 안내 배너 표시",
      "반복 루틴 [⏰ 시간대] 설정 각 행에 연결된 루틴 건수(N건) 표시 및 엔터키로 새 시간대 즉시 추가"
    ]
  },
  {
    id: "patch-v10.95",
    version: "v10.95",
    date: "2026-11-17",
    title: "Vercel 배포 빌드 오류(JSON 백업 객체 쉼표 누락) 수정 및 전체 JS/JSX 구문 검증 완료",
    changes: [
      "buildFullBackupJsonString 내 routineTimeRanges 뒤 쉼표(,) 누락으로 발생하던 빌드 SyntaxError 수정",
      "전체 JS 구간 node --check 문법 검증 및 JSX 태그/프래그먼트 짝 전수 검사 통과"
    ]
  },
  {
    id: "patch-v10.94",
    version: "v10.94",
    date: "2026-11-17",
    title: "권한 가드 교차 검증 강화 · 홈 편집/빠른추가 권한 연동 · 알림 바로가기 · JSON 백업 확장",
    changes: [
      "홈 화면에서 루틴/할일/빠른추가 실행 시에도 해당 메뉴(일정·식단·냉장고 등)의 실제 편집 권한을 교차 검증하도록 보안 강화",
      "미로그인 상태에서 [+] 빠른 추가 버튼을 숨기고, [✏️ 홈 편집]은 관리자에게만 노출되도록 정리",
      "최근 수정 알림 내역 항목에 [바로가기 →] 버튼을 추가해 수정된 탭으로 1탭 이동 가능",
      "전체 JSON 백업·복원에 사용자 지정 반복 루틴 시간대(routineSlotDefs)까지 포함"
    ]
  },
  {
    id: "patch-v10.93",
    version: "v10.93",
    date: "2026-11-17",
    title: "권한별 비밀번호·열람/편집 세부 매트릭스 관리 · 반복 루틴 시간대 자유 추가/수정/삭제",
    changes: [
      "⚙️설정에서 관리자 비밀번호와 육아지원군 비밀번호를 모두 직접 변경 가능",
      "메뉴별 권한 매트릭스로 [미로그인(열람)], [육아지원군(열람)], [육아지원군(편집)] 여부를 관리자가 자유롭게 선택",
      "일정 → 반복 루틴 [⏰ 시간대]에서 시간대 항목(예: 오후·새벽 등)을 새로 추가·이름 수정·삭제하고 평일/주말 적용 여부까지 자유롭게 변경 가능"
    ]
  },
  {
    id: "patch-v10.92",
    version: "v10.92",
    date: "2026-11-17",
    title: "홈 상단 최근 수정 알림창 · 3단계 권한(미로그인 / 육아지원군 / 관리자) 및 비밀번호 관리",
    changes: [
      "홈 화면 맨 위에 최근 누가·언제·무엇을 수정했는지 실시간으로 확인하는 [최근 수정 알림창] 및 전체 내역 모달 추가",
      "권한을 3단계로 분리: ① 미로그인(가족사진·식단·레시피 일부만 열람, 그 외 열람 불가) ② 육아지원군(허용 메뉴 열람·편집) ③ 관리자(전체 권한)",
      "관리자가 ⚙️설정에서 육아지원군 비밀번호 변경 및 접근 허용 메뉴를 직접 설정하고 실시간 동기화"
    ]
  },
  {
    id: "patch-v10.91",
    version: "v10.91",
    date: "2026-11-17",
    title: "인별 식단에도 ±3일(7일) 표시 유지 · 이름 배지 줄 제거(인라인 미니 아바타)",
    changes: [
      "특정 가족(수혁·아리나·시목·시율)을 선택했을 때도 조회일 기준 전 3일·이후 3일(7일) 식단이 모두 보이도록 개선",
      "인별 선택 시 중복되던 이름 배지 줄을 완전히 숨기고, 전체 보기에서도 메뉴명 앞 인라인 미니 아바타(이름 텍스트 생략)로 압축해 세로 공간 대폭 절약"
    ]
  },
  {
    id: "patch-v10.90",
    version: "v10.90",
    date: "2026-11-17",
    title: "식단 고정 인원 바 틀고정(Header Pin) 겹침 방지 & 인별 하루 보기 [오늘] 버튼 추가",
    changes: [
      "상단 헤더 틀고정(isHeaderPinned) 상태에서도 식단 인원 전환 바가 헤더 아래에 가려지지 않도록 sticky top 위치 자동 조정",
      "인별 하루 집중 보기 바에 [< 이전날 | 오늘 | 다음날 >] 1탭 오늘 복귀 버튼 추가"
    ]
  },
  {
    id: "patch-v10.89",
    version: "v10.89",
    date: "2026-11-17",
    title: "통합 식단: 인별 선택 시 1일 집중 보기 · 상단 고정(Sticky) 빠른 인원 전환 · 끼니수 제거 슬림화",
    changes: [
      "식단 탭의 가족 인원 선택 바를 스크롤 시에도 따라오는 상단 고정(sticky) 1줄 칩 바(전체·수혁·아리나·시목·시율)로 개편하고 불필요한 [N끼] 텍스트를 제거해 공간 확보",
      "특정 구성원(예: 시목·아리나) 선택 시 7일 전체 대신 해당 날짜(오늘/조회일) 하루 6끼가 한눈에 들어오도록 1일 집중 뷰 + [< 이전날 | 오늘 | 다음날 >] 이동 지원",
      "전체 선택 시에는 기존과 동일하게 조회일 ±3일(7일) 주간 식단 피드 유지"
    ]
  },
  {
    id: "patch-v10.88",
    version: "v10.88",
    date: "2026-11-17",
    title: "통합 식단 사용 재료·메모 미리보기 & [빈 끼니 숨기기] 토글 + 전체 무결성 검증",
    changes: [
      "통합 식단 각 항목에 사용 재료(🥬)와 메모(💬)를 1줄 미리보기로 표시해 상세 모달을 열지 않아도 내용 파악 가능",
      "식단 상단에 [빈 끼니 숨기기] 토글을 추가해 기록된 식단만 콤팩트하게 모아보기 지원"
    ]
  },
  {
    id: "patch-v10.87",
    version: "v10.87",
    date: "2026-11-17",
    title: "통합 식단 1열 6줄 레이아웃 & 항목별 가족 아바타·이름 배지 + 개별 수정·삭제 지원",
    changes: [
      "통합 식단 날짜별 끼니 카드를 2열에서 시간순 1열 6줄(아침·오전간식·점심·오후간식·저녁·야식)로 변경하고, 빈 끼니는 슬림 1줄 바로 압축",
      "각 식단 항목마다 누구의 식단인지 아바타·이름 배지(예: 수혁·아리나 / 시목 / 온가족)를 직관적으로 표시",
      "같은 끼니에 여러 식단이 있어도 항목별 개별 탭 수정 및 개별 삭제(×), 끼니별 [+ 추가] 지원"
    ]
  },
  {
    id: "patch-v10.86",
    version: "v10.86",
    date: "2026-11-17",
    title: "홈 식단 카드 [안 1: 현재·다음 끼니 + 미정 알림] 적용 & 통합 식단 비용 표시",
    changes: [
      "홈 [🍽️ 식단 · 주간] 카드에서 불필요한 [N건] 카운트 대신 현재 시각 기준 끼니(아침/점심/저녁) 메뉴와 미기록·저녁 미정 알림을 표시",
      "통합 식단 탭의 각 끼니 칸에 지출 비용(>0원)이 기록된 경우 금액을 함께 표시해 가독성 향상"
    ]
  },
  {
    id: "patch-v10.85",
    version: "v10.85",
    date: "2026-11-17",
    title: "홈 식단 버튼 클릭 시 오늘 식단 카드로 바로 스크롤 이동",
    changes: [
      "홈 상단 브리핑 [식단 (확인)] 및 바로가기 [🍽️ 식단 · 주간] 클릭 시 통합 식단 탭의 오늘 날짜 카드(#weekly-day-today)로 즉시 스크롤 이동"
    ]
  },
  {
    id: "patch-v10.84",
    version: "v10.84",
    date: "2026-11-17",
    title: "행동 피드 내 1탭 [+ 일정]·[+ 할 일] 바로 등록 & 기존 블록 크기 설정 마이그레이션",
    changes: [
      "홈 통합 행동 피드(안 A)의 [3일 내 일정]·[남은 할 일] 우측에 [+ 추가] 버튼을 추가해 탭 이동 없이 즉시 일정·할 일 등록 가능",
      "기존 저장된 routine/schedule_todo 블록 크기 설정도 action_feed로 자동 이관되도록 보완"
    ]
  },
  {
    id: "patch-v10.83",
    version: "v10.83",
    date: "2026-11-17",
    title: "홈 [안 A: 통합 행동 피드(일정·루틴·할일 1카드)] 적용 & 전체 무결성 검증",
    changes: [
      "홈 화면의 [3일 내 일정 · 지금 루틴 · 남은 할 일] 3개 분리 카드를 얇은 구분선(divide-y) 기반의 [오늘의 행동 피드] 1개 통합 카드로 압축해 가독성·스크롤 효율 극대화",
      "기존 저장된 홈 레이아웃(routine/schedule_todo)도 action_feed로 자동 마이그레이션해 오류 없이 순서·크기 편집 가능"
    ]
  },
  {
    id: "patch-v10.82",
    version: "v10.82",
    date: "2026-11-17",
    title: "TDZ(Cannot access 'ye' before initialization) 오류 수정 & JSX IIFE 전수 검증",
    changes: [
      "홈 화면 MENU_DEFS 내 [🔄 반복 루틴] 카드가 activeRoutines 선언(9025행)보다 앞(8927행)에서 참조하던 순서를 바로잡아 초기화 오류 해결",
      "모든 JSX 즉시실행함수(() => {}) 내 선언 순서 전수 검사로 TDZ 위험 0건 확인"
    ]
  },
  {
    id: "patch-v10.81",
    version: "v10.81",
    date: "2026-11-17",
    title: "통합 식단 모바일 툴바 줄바꿈 정리 · 더보기 활성 탭 목록 정리",
    changes: [
      "통합 식단 상단 날짜 이동 바(< 이전주 | 날짜 | 오늘로 | 다음주 >)를 좁은 모바일 화면에서도 겹치지 않도록 2단 균형 배치로 정리",
      "더보기 하단 버튼 활성 판별 목록에서 통합된 [weekly] 키 제거"
    ]
  },
  {
    id: "patch-v10.80",
    version: "v10.80",
    date: "2026-11-17",
    title: "주간요약+식단 통합(🍽️ 식단) & 인별 카드 탭 시 오늘로 자동 이동",
    changes: [
      "가독성이 좋은 주간요약(조회일 ±3일)을 중심으로 기존 식단 탭을 [🍽️ 식단] 하나로 통합하고 각 날짜·끼니에서 바로 추가·수정·삭제 지원",
      "상단 가족 인별 식단 카드(수혁·아리나·시목·시율)를 누르면 해당 구성원 필터링과 동시에 오늘 날짜 카드로 즉시 스크롤 이동",
      "홈 바로가기 및 더보기 시트에서 중복되던 [주간요약] 메뉴를 정리하고 홈 그리드에 [🔄 반복 루틴] 바로가기 연결"
    ]
  },
  {
    id: "patch-v10.79",
    version: "v10.79",
    date: "2026-11-17",
    title: "TDZ(Cannot access 'Ui' before initialization) 런타임 오류 즉시 수정",
    changes: [
      "useEffect([isQuickFabOpen, isRoutineModalOpen])가 isRoutineModalOpen 선언(3219행)보다 먼저 평가되던 위치를 선언 이후로 이동해 런타임 초기화 오류 완전 해결"
    ]
  },
  {
    id: "patch-v10.78",
    version: "v10.78",
    date: "2026-11-17",
    title: "루틴 모달 실시간 단계 미리보기 · 일정 상단 멤버 필터-루틴 연동 · Escape 닫기 보완",
    changes: [
      "루틴 등록·수정 모달에서 쉼표(,)로 입력한 단계를 저장 전 원형 숫자 배지로 실시간 미리보기 지원",
      "일정 탭 최상단 가족 멤버 필터(전체·수혁·아리나·시목·시율) 선택 시 [반복 루틴] 대상 필터도 함께 연동되도록 개선",
      "루틴 모달 열림 상태에서 Escape 키로 즉시 닫기 지원"
    ]
  },
  {
    id: "patch-v10.77",
    version: "v10.77",
    date: "2026-11-17",
    title: "루틴 전용 등록/수정 모달(식단 추가 양식) · 원형 숫자 배지 · 무채색+시그널 디자인 전 탭 확산",
    changes: [
      "복잡했던 반복루틴 인라인 입력 폼을 제거하고 [+ 루틴 추가] 버튼으로 깔끔한 전용 모달(시간대·대상·주기 칩 선택)을 열도록 개편",
      "루틴 단계 배지의 숫자를 [1.] 텍스트 대신 원형 테두리 숫자 배지(완료 시 초록 ✓)로 업그레이드",
      "홈 화면의 [무채색 베이스 + 특이사항만 시그널 컬러] 디자인을 일정·루틴·장보기 등 다른 탭에도 일관되게 확산 적용"
    ]
  },
  {
    id: "patch-v10.76",
    version: "v10.76",
    date: "2026-11-17",
    title: "루틴 시간대 분 단위(HH:MM) 설정 · 1분 정밀 갱신 · 홈 루틴 시간대 우선 정렬",
    changes: [
      "일정 → [🔄 반복 루틴 → ⏰ 시간대 설정]에서 시·분 단위(<input type='time'>)로 각 시간대 시작 시각을 자유롭게 설정 가능",
      "1분 정밀 타이머(liveMinuteTick)로 분 단위 경계(예: 20:30 자기전 전환) 즉시 반영 및 새 루틴 추가 시 현재 시간대 자동 기본 선택",
      "홈 루틴 목록에서 현재 시간대 루틴을 [상시] 루틴보다 위쪽에 우선 정렬해 중요 루틴 시인성 향상"
    ]
  },
  {
    id: "patch-v10.75",
    version: "v10.75",
    date: "2026-11-17",
    title: "홈 화면 [안 1: 무채색 베이스 + 특이사항만 시그널 컬러] 적용",
    changes: [
      "홈의 모든 카드(브리핑·루틴·일정·할일·바로가기 그리드) 배경을 깔끔한 화이트/스톤 무채색으로 통일해 시각적 피로도 대폭 감소",
      "오늘(D-Day) 일정, 기한 지난 할 일, 냉장고 임박/만료 재료, 미세먼지 나쁨 등 특이사항에만 시그널 컬러(로즈·앰버)를 적용해 중요 정보가 즉시 눈에 띄도록 개선"
    ]
  },
  {
    id: "patch-v10.74",
    version: "v10.74",
    date: "2026-11-17",
    title: "홈 상단 1줄 날씨에 미세먼지 등급(좋음/보통/나쁨) 표시 추가",
    changes: [
      "홈 상단 한 줄 날씨 바에 현재 기온(최저/최고), 미세먼지 수치와 상태 등급(예: 좋음), 초미세먼지 수치를 한 줄로 간결하게 표시"
    ]
  },
  {
    id: "patch-v10.73",
    version: "v10.73",
    date: "2026-11-17",
    title: "일정 헤더·서브탭·모달 멤버 버튼 줄바꿈 방지 및 최종 정적 안정성 검증",
    changes: [
      "일정 탭 상단 제목과 [+ 일정 추가] 버튼 사이 여백(gap-2) 확보 및 서브탭 라벨 whitespace-nowrap 적용",
      "일정·식단 모달 내 4열 멤버 선택 버튼에 whitespace-nowrap 적용으로 좁은 화면 줄바꿈 방지"
    ]
  },
  {
    id: "patch-v10.72",
    version: "v10.72",
    date: "2026-11-17",
    title: "홈 [상시] 루틴 항상 표출 · 멤버 필터(최아리나)·달력 [오늘] 배지 줄바꿈 수정",
    changes: [
      "홈 루틴 [자동] 모드에서 현재 시간대 루틴과 함께 [상시] 루틴이 어느 시간대건 항상 함께 표출되도록 개선",
      "식단·일정 탭 멤버 필터를 모바일 한 줄 가로 스크롤(whitespace-nowrap)로 개선해 [최아리나] 이름 줄바꿈 현상 해결",
      "월간 일정 달력 셀의 [오늘] 배지 및 주간요약 [조회일]/[오늘] 배지에 whitespace-nowrap 적용으로 줄바꿈 방지"
    ]
  },
  {
    id: "patch-v10.71",
    version: "v10.71",
    date: "2026-11-17",
    title: "시간대 경계 자동 갱신 타이머(1분 주기·화면 복귀) & 홈 루틴 필터 빠른 복귀",
    changes: [
      "앱을 켜 둔 상태에서도 시각 경계(예: 11시·15시·20시)를 지나면 홈 시간대 UI와 현재 루틴 시간대가 1분 주기로 자동 갱신",
      "홈 루틴 카드에서 특정 시간대나 대상을 고정해 둔 경우 상단에 [자동 복귀] 빠른 초기화 버튼 제공"
    ]
  },
  {
    id: "patch-v10.70",
    version: "v10.70",
    date: "2026-11-17",
    title: "홈 루틴 [자동] 모드에서 현재 시간대 루틴만 엄격히 표출",
    changes: [
      "홈 루틴 카드 기본 [자동(현재시간대)] 필터에서 [상시] 루틴을 섞지 않고 현재 시간대(s === curSlot)에 해당하는 루틴만 표시하도록 변경",
      "상시 루틴은 바로 옆 [상시] 또는 [전체] 칩을 눌러 확인 가능"
    ]
  },
  {
    id: "patch-v10.69",
    version: "v10.69",
    date: "2026-11-17",
    title: "루틴 대상 분리(공통·시목·시율·시목·시율·수혁·아리나) 및 대상별 필터·색상 배지 추가",
    changes: [
      "루틴 등록·수정 시 대상 선택에 [👨‍👩‍👧‍👦 공통], [👦 시목], [👶 시율], [👦👶 시목·시율], [👨 수혁], [👩 아리나] 추가",
      "같은 이름·시간대 루틴이라도 시목/시율/공통 등 대상이 다르면 각각 별도 루틴으로 등록 가능",
      "홈 루틴 카드와 일정→반복 루틴 모두에서 대상별 필터(전체·공통·시목·시율 등) 및 색상 배지 지원"
    ]
  },
  {
    id: "patch-v10.68",
    version: "v10.68",
    date: "2026-11-17",
    title: "루틴 부분 체크 역토글·수정 시 단계 인덱스 정합성 보완",
    changes: [
      "전체 완료된 루틴에서 특정 단계 칩만 눌러 취소할 때 나머지 단계 체크 상태가 유지되도록 보완",
      "루틴 제목(단계 구성) 수정 시 이전 단계 체크 인덱스가 남지 않도록 자동 정합성 초기화"
    ]
  },
  {
    id: "patch-v10.67",
    version: "v10.67",
    date: "2026-11-17",
    title: "루틴 단계 쉼표(,) 자동 배지·개별 체크 · 평일/주말 시간대 분리 · 남은 건수 줄바꿈 수정",
    changes: [
      "루틴 제목을 쉼표(,) 또는 > 로 구분해 입력하면 ①→②→③ 단계 알약 배지로 표시되고 각 단계를 개별 체크(모두 체크 시 자동 완료) 가능",
      "평일(월~금)은 [아침·점심·하원후·저녁·자기전](오후 제외), 주말(토·일)은 [아침·오후(12시 기본)·저녁·자기전](하원후 제외)으로 자동 분리·설정",
      "반복 루틴 상단 [남은 N건] 배지 줄바꿈 현상(whitespace-nowrap) 수정"
    ]
  },
  {
    id: "patch-v10.66",
    version: "v10.66",
    date: "2026-11-17",
    title: "전체 JSON 백업·복원 범위 확장(루틴·홈 구성·시간대) & 루틴 시간대 중복 경고 보완",
    changes: [
      "전체 DB JSON 백업·복원에 familyRoutines(반복 루틴) 및 홈 레이아웃·시간대 기준 시각 설정 포함",
      "루틴 시간대 설정 시 시작 시각이 중복되면 안내 경고 문구가 표시되도록 안전장치 추가"
    ]
  },
  {
    id: "patch-v10.65",
    version: "v10.65",
    date: "2026-11-17",
    title: "일정·반복루틴 시간대 기준 시각 사용자 편집 및 실시간 클라우드 동기화",
    changes: [
      "일정 → [🔄 반복 루틴] 상단에 [⏰ 시간대 기준] 설정을 추가해 아침·점심·하원후·오후·저녁·자기전 시작 시각(0~23시)을 직접 지정 가능",
      "지정한 루틴 시간대 기준은 홈 화면 [자동(현재)] 루틴 표출과 실시간 연동되며 Firestore(family_meta_v4/home_layout)에 부부 기기 간 동기화"
    ]
  },
  {
    id: "patch-v10.64",
    version: "v10.64",
    date: "2026-11-17",
    title: "홈 레이아웃·시간대 설정 부부 클라우드 실시간 동기화 & 모바일 터치 드래그 정밀도 개선",
    changes: [
      "홈 화면 배치·크기·시간대 기준 시각 설정을 Firestore(family_meta_v4/home_layout)에 실시간 동기화해 부부 기기 간 동일 화면 유지",
      "모바일 빠른 터치 드래그 시 Ref 기반 드롭 대상 추적으로 누락 방지 및 touchCancel 상태 정리 보완"
    ]
  },
  {
    id: "patch-v10.63",
    version: "v10.63",
    date: "2026-11-17",
    title: "홈 편집 드래그 앤 드롭(PC·모바일 터치) 순서 변경 & 항목별 크기 조절 지원",
    changes: [
      "홈 편집 모드에서 주요 영역(일정·할일/루틴/바로가기)과 10개 바로가기 카드를 ⋮⋮ 핸들로 드래그(모바일 터치 & PC 마우스)해 순서 재배치 가능",
      "주요 영역별 여백·표시 건수 크기(작게/보통/크게) 및 바로가기 카드별 너비·크기(반폭/전체폭/크게) 개별 조절 지원"
    ]
  },
  {
    id: "patch-v10.62",
    version: "v10.62",
    date: "2026-11-17",
    title: "일정·성장기록 저장 안정성 강화 · 홈 레이아웃 스키마 보정 · 편집 모드 자동 종료",
    changes: [
      "일정 저장(handleSaveSchedule) 시 Firestore 오류를 숨기지 않고 오류 알림 및 동기화 상태 표시로 안정성 개선",
      "성장기록 저장 시 수치 미입력 안내 토스트 추가",
      "저장된 홈 레이아웃(localStorage) 불러오기 시 신규 메뉴·블록 키 누락 자동 보정 및 다른 탭 이동 시 홈 편집 모드 자동 종료"
    ]
  },
  {
    id: "patch-v10.61",
    version: "v10.61",
    date: "2026-11-17",
    title: "밤 중복 UI 제거 · 스마트 등록 [👶 성장기록] 추가 · 시간대 검증 & Escape 닫기 고도화",
    changes: [
      "홈 밤 모드에서 하단 일정·루틴 카드와 중복되던 [🌙 오늘 하루 마감 · 내일 미리보기] 상단 카드 제거",
      "스마트 빠른 등록(+) 메뉴에 [👶 성장기록] 추가(육아수첩 성장기록 서브탭 이동 및 키 입력창 자동 포커스)",
      "스마트 등록 메뉴 Escape 키·탭 전환 시 자동 닫힘 및 홈 시간대 시작 시각 중복 경고 보완"
    ]
  },
  {
    id: "patch-v10.60",
    version: "v10.60",
    date: "2026-11-17",
    title: "스마트 등록 메뉴 확장(장보기·영수증·내보내기) · 시간대별 전용 UI · 시간대 기준 시각 편집",
    changes: [
      "스마트 빠른 등록(+) 메뉴에 [🛒 장보기 추가], [🧾 영수증 AI 스캔], [📤 식단·재료 내보내기] 3종 추가",
      "홈 편집 모드에서 오전·오후·밤 시작 시각(0~23시, 예: 밤 20시~익일 05시)을 직접 설정 가능",
      "시간대별 홈 UI 차별화: 오전(등원·날씨·아침점심 브리핑), 오후(임박 재료 D-day·저녁 준비), 밤(야간 톤 하루 마감·내일 D-1 일정)"
    ]
  },
  {
    id: "patch-v10.59",
    version: "v10.59",
    date: "2026-11-17",
    title: "스마트 빠른 등록(+) 메뉴 · 시간대 적응형 & 사용자 편집 홈 · 주간요약 ±3일 개편",
    changes: [
      "우측 하단 (+) 버튼을 하단 바·콘텐츠와 겹치지 않는 스마트 빠른 등록 메뉴(식단·일정·할일·냉장고·레시피)로 업그레이드",
      "홈 루틴 카드에서 표출할 시간대(자동/아침/점심/하원후/오후/저녁/자기전/상시/전체)를 직접 선택·저장 가능",
      "홈 화면 시간대별(🌅 오전·🌆 오후·🌙 밤) 자동/수동 전환 및 [✏️ 홈 편집]으로 블록·바로가기 순서·표시 여부 커스터마이징 지원",
      "주간요약 조회 범위를 조회일 기준 과거 3일 · 조회일 · 이후 3일(±3일)로 개편하고 조회일·오늘 배지 표시"
    ]
  },
  {
    id: "patch-v10.58",
    version: "v10.58",
    date: "2026-11-16",
    title: "할일·루틴 낙관적 업데이트 롤백 보완 · 루틴 토글 토스트 · 냉장고 0개(소진) 구분 표시",
    changes: [
      "할 일(To-Do) 빠른 추가·완료 토글 시 Firestore 저장 실패하면 로컬 상태를 원복하고 오류 안내 표시",
      "홈·일정 탭에서 루틴 1탭 완료/취소 시 즉시 토스트 알림 제공",
      "시각적 냉장고 칩에서 수량 0개(소진) 품목을 흐린 취소선 스타일로 구분 표시"
    ]
  },
  {
    id: "patch-v10.57",
    version: "v10.57",
    date: "2026-11-16",
    title: "미사용 아이콘 임포트 정리 · 홈 할 일 1탭 완료 토스트 피드백 강화",
    changes: [
      "미사용 lucide-react 아이콘 임포트 9종 제거로 ESLint/Vite 빌드 경고·오류 요인 제거",
      "홈 및 일정 탭에서 할 일(To-Do) 체크 시 즉시 완료/되돌림 토스트 피드백 제공"
    ]
  },
  {
    id: "patch-v10.56",
    version: "v10.56",
    date: "2026-11-16",
    title: "홈 상단 1줄 상태바 압축 · 중복 메뉴(할 일·일정→월간 식단) 제거 · 일정 서브탭 FAB 고도화",
    changes: [
      "홈 맨 위 상태바에서 중복된 월간 지출 배지를 제거하고 [연결됨 · 패치노트 · 편집가능 · 설정]을 한 줄로 압축",
      "홈 2열 바로가기 그리드의 중복 [할 일·일정] 카드를 [📅 월간 식단]으로 교체해 한 화면 내 중복 메뉴 제거",
      "일정 탭 서브탭(달력·할 일·반복 루틴)에 맞춰 우측 하단 (+) 플로팅 버튼이 일정 추가 또는 루틴 입력창 포커스로 지능형 분기",
      "미사용 상태 변수 정리로 빌드 안정성 및 정적 검증 완료"
    ]
  },
  {
    id: "patch-v10.55",
    version: "v10.55",
    date: "2026-11-16",
    title: "P0 데이터 무결성 보완 · 일정 3분할 서브탭 · 홈 한눈에 보드(일정/할일/루틴 동시 표시)",
    changes: [
      "냉장고 재고 수량 0 입력 허용 및 수정 충돌 시 서버 최신값·내 수정값 비교 선택 모달 유지",
      "반복 루틴 동기화를 Firestore 트랜잭션 기반 개별 항목 병합으로 개선해 동시 수정 덮어쓰기 방지",
      "새 식단 추가 시 전체 보기 기본 식사 대상을 어른 2명(수혁·아리나)으로 변경",
      "주간 요약 [이번주] 버튼을 [오늘로]로 개선해 오늘 날짜 카드로 자동 스크롤 이동",
      "일정 탭을 [📅 달력·일정 | ✅ 할 일 | 🔄 반복 루틴] 3개 서브탭(미완료·임박 건수 배지 포함)으로 분리",
      "홈 상단 제목을 [우리 가족 홈 ♡]으로 변경하고 1줄 날씨·3일 내 일정·남은 할 일(1탭 체크)·지금 루틴을 동시에 표시"
    ]
  },
  {
    id: "patch-v10.54",
    version: "v10.54",
    date: "2026-11-16",
    title: "플로팅(+) 버튼 레시피북·현재시간 끼니 자동 선택 & 탭 전환 시 상단 스크롤 초기화",
    changes: [
      "레시피북 탭에서 우측 하단 (+) 플로팅 버튼 클릭 시 새 레시피 등록 창이 열리도록 연결",
      "홈·식단 탭에서 (+) 버튼 클릭 시 현재 시각(아침·점심·오후간식·저녁·야식)에 맞는 끼니가 자동 선택되도록 개선",
      "하단 네비게이션 탭 전환 시 이전 탭의 스크롤 위치가 남지 않고 맨 위로 이동하도록 보완"
    ]
  },
  {
    id: "patch-v10.53",
    version: "v10.53",
    date: "2026-11-16",
    title: "식단 탭 슬림화(빈 끼니 1줄 압축 · 중복 배너 제거 · 1스크린 가독성) & 전체 화면 다듬기",
    changes: [
      "식단 탭에서 비어 있는 끼니(아침·간식·야식 등)는 얇은 1줄 바([아이콘 끼니 · 비어있음 + 추가])로 압축해 스크롤 길이 대폭 축소",
      "식단 탭 중간의 중복 가족일정 배너를 제거하고 상단 날짜·7일 달력·멤버 필터 여백을 슬림화해 한눈에 식단 파악 가능",
      "식단 기록이 있는 카드도 콤팩트 패딩(p-2.5)과 자연스러운 줄바꿈으로 가독성 향상"
    ]
  },
  {
    id: "patch-v10.52",
    version: "v10.52",
    date: "2026-11-16",
    title: "홈 화면 1스크린 압축 · 오늘의 식단 2열 카드화 · 기본 펼침 & 전체 바로가기 통일",
    changes: [
      "홈 상단 바(날씨·일정·공지) 기본 상태를 펼침(kim_header_collapsed_v2)으로 초기화",
      "상단 [🧭 전체 바로가기] 아코디언을 제거하고 홈 하단과 동일한 2열 카드 양식으로 10개 주요 메뉴(오늘의 식단·주간요약·냉장고·장보기·할일·식비·육아수첩·레시피북·가족공지·AI추천) 통일",
      "오늘의 식단 카드를 냉장고/장보기와 동일한 콤팩트 2열 카드로 축소해 스크롤을 최소화하고 한눈에 들어오도록 개선"
    ]
  },
  {
    id: "patch-v10.51",
    version: "v10.51",
    date: "2026-11-16",
    title: "하단 6탭 [🏠 홈] 화면 신설 · 탭별 정보 분리 · 홈에서 각 기능 바로가기 연결",
    changes: [
      "하단 네비게이션을 6개([🏠 홈 | 🍽️ 식단 | 🗓️ 일정 | 👶 육아 | ❄️ 냉장고 | ☰ 더보기])로 확장하고 [🏠 홈]을 기본 첫 화면으로 설정",
      "상단 날씨·일정·공지·루틴 요약을 [🏠 홈]에 모아 보여주고 카드 탭 시 해당 탭/섹션으로 바로 이동하도록 연결",
      "[🍽️ 식단] 탭 등 하위 탭 진입 시 상단 요약 배너를 숨겨 각 탭 본연의 화면이 깔끔하게 보이도록 분리"
    ]
  },
  {
    id: "patch-v10.50",
    version: "v10.50",
    date: "2026-11-16",
    title: "루틴 수정(✏️) 기능 추가 (제목·시간대·반복주기·담당자 바로 수정)",
    changes: [
      "각 루틴 카드 우측에 수정(✏️) 버튼을 추가해 기존 루틴의 제목, 시간대(예: 상시→아침), 반복주기, 담당자를 삭제 없이 바로 수정 가능",
      "수정 시 기존 완료 기록(lastDoneKey)을 유지하며 상단 입력창이 [💾 수정 저장 / 취소] 모드로 전환"
    ]
  },
  {
    id: "patch-v10.49",
    version: "v10.49",
    date: "2026-11-16",
    title: "Vercel 빌드(JSX 닫힘 태그 중복 </button>) 오류 즉시 수정",
    changes: [
      "메인 루틴 카드 접기/펼치기 버튼 영역(8302~8303라인)의 중복 </button> 태그 제거로 Vite/Vercel 빌드 오류 해결"
    ]
  },
  {
    id: "patch-v10.48",
    version: "v10.48",
    date: "2026-11-16",
    title: "임박 재료 구출 [아낀 식비 저금통] & 가계부 원장 최신순 정렬 고도화",
    changes: [
      "소비기한 3일 이하 임박 재료를 버리지 않고 '다 먹음' 처리 시 해당 원가를 [🎉 임박 재료 구출 저금통]으로 자동 누적해 가계부에 표시",
      "가계부 지출 원장 목록을 최신 구매일순으로 정렬해 방금 기록한 장보기 지출을 맨 위에서 바로 확인 가능"
    ]
  },
  {
    id: "patch-v10.47",
    version: "v10.47",
    date: "2026-11-16",
    title: "자동백업(루틴·즐겨찾기) 보완 · To-Do 완료 일괄 비우기 · 모바일 가독성 전면 개선",
    changes: [
      "1일 2회 자동 클라우드 백업(autoBackup)에 familyRoutines 및 mealFavorites 포함",
      "To-Do 체크리스트에 [🧹 완료됨 비우기] 일괄 정리(writeBatch) 버튼 및 메인 루틴 카드 접기/펼치기 토글 추가",
      "To-Do 상단 [전체|진행중|완료됨] 버튼 글자 줄바꿈 방지(whitespace-nowrap) 및 빠른 추가 바 2줄 배치로 우측 '+ 추가' 잘림 해결",
      "주간 일정 요약 내 긴 일정 제목도 말줄임(truncate) 대신 자연스러운 줄바꿈 적용"
    ]
  },
  {
    id: "patch-v10.46",
    version: "v10.46",
    date: "2026-11-16",
    title: "메인 시간대별 루틴 위젯 · N일마다(격일 목욕) · 매월 N주차 요일/날짜 자동계산 · 줄바꿈",
    changes: [
      "첫 화면(식단 탭) 상단에 현재 시간대(아침·점심·하원후·오후·저녁·자기전) 맞춤 [🔄 지금 시간대 루틴] 위젯 추가 및 원터치 체크",
      "루틴 주기에 [N일마다](격일 목욕 등 2~14일) 및 [매월 N주차 요일](예: 매월 2번째 토요일) 추가 + 주간·월간 다음 도래 날짜 자동 계산",
      "루틴 제목 한 줄 말줄임(truncate) 제거 및 자동 줄바꿈 적용으로 긴 루틴 전체 표시"
    ]
  },
  {
    id: "patch-v10.45",
    version: "v10.45",
    date: "2026-11-16",
    title: "루틴 자정 경계 동기화 · 월간 임박/예정 우선 정렬 · 매주 요일 지정 & 동기화 상태 표시",
    changes: [
      "루틴 체크(handleToggleRoutine) 시 currentDayKey와 getTodayStr()을 즉시 동기화해 자정 직후 키 불일치 가능성 원천 차단",
      "월간 루틴 중 예정일이 많이 남은 항목(D-4 이상)은 아래로, 오늘 해야 할 일과 임박(D-3 이내) 루틴은 위로 우선 정렬",
      "매주 루틴 추가 시 요일 선택(전체 또는 월~일) 지원 및 루틴 저장 시 상단 sync 배지(beginWrite/endWrite) 연동"
    ]
  },
  {
    id: "patch-v10.44",
    version: "v10.44",
    date: "2026-11-16",
    title: "루틴 [매월 특정 일자(1~31일)] 반복 옵션 및 월별 자동 리셋·D-Day 표시 추가",
    changes: [
      "데일리·위클리 루틴 추가 시 반복 주기에 [매월] 옵션과 일자 선택(1~31일) 추가",
      "월간 루틴은 매월 1일(YYYY-MM 변경 시) 자동 리셋되며, 당월 마지막 날(28/30일) 보정 및 예정일까지 D-Day/오늘 예정 배지 표시"
    ]
  },
  {
    id: "patch-v10.43",
    version: "v10.43",
    date: "2026-11-16",
    title: "자정 경과 화면 복귀 시 루틴·To-Do 배지 즉시 갱신 & 루틴 중복 방지·백업 연동",
    changes: [
      "스마트폰 화면을 다시 켜거나 탭으로 복귀(visibilitychange/focus)할 때 날짜 변경을 즉시 감지해 자정 리셋 루틴과 To-Do 긴급 배지를 새로고침 없이 자동 갱신",
      "동일한 이름·주기의 루틴 중복 등록 방지 및 JSON 백업·복원 대상에 familyRoutines 포함"
    ]
  },
  {
    id: "patch-v10.42",
    version: "v10.42",
    date: "2026-11-16",
    title: "하단 일정·상단 바로가기 To-Do 남은 개수 배지 & 자정 자동 리셋 데일리·위클리 루틴",
    changes: [
      "하단 네비게이션 [일정] 아이콘 우측 상단과 상단 바로가기 바에 미완료 To-Do 남은 개수 배지(할일 N) 표시 및 클릭 시 To-Do 섹션으로 바로 스크롤",
      "마감일 경과·오늘 마감 To-Do가 있으면 빨간색, 일반 할 일만 남았으면 주황색 배지로 긴급도 구분",
      "자정·주간 자동 리셋 [🔄 데일리·위클리 육아/집안일 루틴] 보드 추가 및 부부 기기 간 Firestore(family_meta_v4/daily_routines) 실시간 동기화"
    ]
  },
  {
    id: "patch-v10.41",
    version: "v10.41",
    date: "2026-11-16",
    title: "초기화 전 변수 참조(Cannot access 'Fs' before initialization) TDZ 오류 즉시 수정",
    changes: [
      "knownIngredientList useMemo가 fridge 선언보다 위에 위치해 발생하던 Temporal Dead Zone(초기화 전 참조) 크래시 해결",
      "fridge useMemo 선언 이후로 knownIngredientList 배치 순서 이동 및 전체 useEffect/useMemo 의존성 선후관계 재검증"
    ]
  },
  {
    id: "patch-v10.40",
    version: "v10.40",
    date: "2026-11-16",
    title: "다중 이동 [전체 선택/해제] 원터치 버튼 & 자가진단 테스트 18종 확장·최종 검증",
    changes: [
      "시각적 냉장고 [☑️ 다중 이동] 모드에 현재 필터 기준 [전체 선택 / 선택 해제] 버튼 추가",
      "자가진단 테스트(runCoreLogicSelfTests)를 18종으로 확장 (배치 청크 분할·전월 대비 증감 계산 검증 추가)"
    ]
  },
  {
    id: "patch-v10.39",
    version: "v10.39",
    date: "2026-11-16",
    title: "다중 이동 중 드래그 간섭 차단 · 전월 식비 동일기준(v3/v4) 보정 · 배치 500건 한도 분할",
    changes: [
      "시각적 냉장고 [☑️ 다중 이동] 모드 활성 시 롱프레스 드래그 타이머를 비활성화해 다중 탭 선택과 간섭이 없도록 개선",
      "리스트 뷰 전환 시 다중 이동 선택 상태 자동 초기화",
      "handleBulkMoveFridgeShelfZone에 200건 단위 청크 분할을 적용해 Firestore writeBatch 500건 제한 안전 준수",
      "전월 대비 식비 계산 시 전월 미등록 냉장고 가격 항목도 동일 기준으로 합산해 비교 정합성 보완"
    ]
  },
  {
    id: "patch-v10.38",
    version: "v10.38",
    date: "2026-11-16",
    title: "가계부 전월대비·카테고리 리포트 · 냉장고 다중 일괄이동 · 레시피 조리순서/부족배지 · 검색 디바운스",
    changes: [
      "가계부 요약 카드에 전월 대비 식비 증감, 예산 사용률 바, 카테고리별 지출 비중 및 폐기율(%) 리포트 추가",
      "시각적 냉장고 뷰에 [☑️ 다중 이동] 모드를 추가해 여러 재료를 체크 후 원하는 칸으로 writeBatch 일괄 이동 지원",
      "레시피북에 [조리 순서] 입력칸을 분리하고 카드에 [✅ 재료 100% 보유 / ⚠️ 부족 N개] 미리보기 배지 표시",
      "냉장고·레시피 검색 입력에 150ms 디바운스를 적용해 모바일 타이핑 반응속도 최적화"
    ]
  },
  {
    id: "patch-v10.37",
    version: "v10.37",
    date: "2026-11-16",
    title: "전체 상태·정규식 무결성 검증 완료 & 설정 자가진단 테스트 16종 확장",
    changes: [
      "전체 174개 React 상태 선언 중복 없음 및 정규식 무결성 정적 검증 완료",
      "설정 내 핵심 로직 자가진단 테스트(runCoreLogicSelfTests)를 16종으로 확장 (장보기 입고 '2팩' 수량·단위 분리, 자동완성 앞글자 우선 랭킹 추가)"
    ]
  },
  {
    id: "patch-v10.36",
    version: "v10.36",
    date: "2026-11-16",
    title: "자동완성 앞글자 우선 랭킹 · 식단 이미 추가된 칩 제외 · 냉장고 칸 자동 매칭 보강",
    changes: [
      "식단·냉장고·장보기·레시피 자동완성 시 검색어로 '시작하는(startsWith)' 항목을 최우선 노출하도록 개선",
      "식단 자동완성에서 현재 식단에 이미 포함된 메뉴는 추천 후보에서 자동 제외",
      "냉장고 재료 자동완성 선택 시 카테고리에 맞는 세부 칸(shelfZone)도 함께 자동 지정"
    ]
  },
  {
    id: "patch-v10.35",
    version: "v10.35",
    date: "2026-11-16",
    title: "식단·냉장고·장보기·레시피 전역 자동완성 & 공지사항 미완료 우선 정렬",
    changes: [
      "식단(mealChipInput)·냉장고(품목명)·장보기(품목명)·레시피(재료입력) 입력 시 기존 기록·즐겨찾기·레시피북 기반 실시간 자동완성 칩 최대 6개 표시",
      "냉장고·장보기 자동완성 칩을 탭하면 품목명뿐 아니라 기존 카테고리·단위도 함께 자동 채움",
      "가족 공지사항 목록에서 미완료·고정(pinned) 공지가 상단에 오고 완료된 공지는 하단으로 정렬되도록 개선"
    ]
  },
  {
    id: "patch-v10.34",
    version: "v10.34",
    date: "2026-11-16",
    title: "장보기 급함·미체크 스마트 정렬 & 냉장고 리스트 뷰 정렬(임박순·최신순·이름순) 고도화",
    changes: [
      "장보기 목록에서 미체크 + 🚨급함 항목이 최상단에 오고, 구매 체크한 항목은 자동으로 아래로 내려가 장볼 때 가독성 향상",
      "냉장고 검색창 옆에 리스트 정렬 드롭다운(임박순 · 최신순 · 이름순) 추가"
    ]
  },
  {
    id: "patch-v10.33",
    version: "v10.33",
    date: "2026-11-16",
    title: "장보기 입고 시 보관위치(냉장·메인냉동·별도냉동·팬트리) 선택 & 육아·일정 동기화 오류 알림 완결",
    changes: [
      "장보기→냉장고 입고 모달에서 보관 위치(냉장실·메인 냉동실·별도 냉동고·실온·팬트리)를 직접 고르고 위치별 기본 소비기한·세부 칸이 자동 적용되도록 고도화",
      "육아(성장/진료) 삭제 및 일정 저장/완료 처리의 무음 catch(e){} 블록을 syncErrorMsg 알림으로 연결"
    ]
  },
  {
    id: "patch-v10.32",
    version: "v10.32",
    date: "2026-11-16",
    title: "장보기→냉장고 입고 시 수량·단위 분리 오류('12팩' 현상) 수정 & 세부 칸 자동 배치",
    changes: [
      "장보기 입고(handleConfirmStockIn) 시 '2팩' 같은 수량 문자열을 숫자(2)와 단위('팩')로 정확히 분리해 '12팩'처럼 붙어 보이던 버그 해결",
      "입고 시 품목 카테고리에 맞춰 세부 칸(shelfZone: 채소칸 등) 자동 지정 및 동기화 오류 알림(syncErrorMsg) 연결"
    ]
  },
  {
    id: "patch-v10.31",
    version: "v10.31",
    date: "2026-11-16",
    title: "냉장고 소진+장보기 중복 방지 & 소진·AI 식단 등록 동기화 오류 알림 보강",
    changes: [
      "냉장고 재료 '다 먹음 + 장보기' 실행 시 이미 장보기 목록에 같은 재료가 있으면 중복 추가하지 않도록 보완",
      "냉장고 소진 처리(가계부·재고삭제·장보기추가) 및 AI 추천 식단 등록 시 무음 catch(e){}를 syncErrorMsg 알림으로 전환"
    ]
  },
  {
    id: "patch-v10.30",
    version: "v10.30",
    date: "2026-11-16",
    title: "예외 미처리 JSON.parse 안전화 & 장보기·공지·레시피 무음 쓰기 오류 알림 보강",
    changes: [
      "일정 스냅샷(family_schedules_v4) 내부의 비보호 JSON.parse(localStorage)에 try-catch 안전 파싱 적용",
      "레시피·장보기·공지·식단복사 등 주요 Firestore 쓰기/삭제 핸들러의 무음 catch(e){}를 syncErrorMsg 오류 표시로 전환"
    ]
  },
  {
    id: "patch-v10.29",
    version: "v10.29",
    date: "2026-11-16",
    title: "미확정 칩 중복 병합 방지 · 모달 닫기 시 임시 입력 자동 초기화 · 레시피 동기화 상태 표시",
    changes: [
      "식단·레시피 저장 시 미확정 입력 텍스트(mealChipInput / recipeIngredientInput)가 이미 포함된 항목과 겹치면 중복 병합하지 않도록 보완",
      "식단·레시피 모달을 닫을 때 남아 있던 임시 입력 텍스트를 자동으로 비워 다음 등록 시 잔여 입력이 섞이지 않도록 개선",
      "레시피 저장·삭제 시 상단 동기화 상태(beginWrite/endWrite) 배지가 함께 표시되도록 연결"
    ]
  },
  {
    id: "patch-v10.28",
    version: "v10.28",
    date: "2026-11-16",
    title: "미확정 칩 입력 자동 병합 저장 · 식단 모달 레시피북 원터치 추가 · 즐겨찾기 백업/복원 연동",
    changes: [
      "식단·레시피 저장 시 '+ 추가'를 누르지 않고 입력칸(mealChipInput / recipeIngredientInput)에 남겨둔 텍스트도 자동으로 '+' 병합해 저장",
      "식단 기록 모달 안에 [📖 레시피북에서 바로 추가] 가로 칩 목록을 추가해 탭 한 번으로 식단에 포함 가능",
      "JSON 백업·복원 시 즐겨찾는 단일 메뉴와 조합(mealFavorites)도 함께 저장·복원되도록 보완"
    ]
  },
  {
    id: "patch-v10.27",
    version: "v10.27",
    date: "2026-11-16",
    title: "식단 모달 [⭐ 즐겨찾는 단일 메뉴] 등록·터치 + 추가 & 부부 기기 클라우드 동기화",
    changes: [
      "식단 기록 모달에서 자주 먹는 단일 메뉴(예: 미역국, 계란찜)를 1탭으로 등록·삭제하고 터치 시 '+'로 바로 이어 붙이는 기능 추가",
      "조합된 메뉴 칩에서도 '⭐' 버튼으로 단일 메뉴를 즉시 즐겨찾기에 저장 가능",
      "즐겨찾는 단일 메뉴와 조합을 Firestore(family_meta_v4/meal_favorites)에도 동기화해 가족 기기 간 자동 공유"
    ]
  },
  {
    id: "patch-v10.26",
    version: "v10.26",
    date: "2026-11-16",
    title: "레시피 한국어 단위 파싱 통합(큰술·줌 등) · 장보기 일괄 추가 중복 방지 · 자가진단 14종 확장",
    changes: [
      "공통 재료 파서(parseRecipeIngredientToken) 도입으로 큰술·작은술·줌·봉지·병 등 한식 단위와 띄어쓰기 수량(250 g) 일관 처리",
      "레시피 일괄 부족 재료 장보기 추가 시 이미 장보기에 담긴 품목은 자동으로 건너뛰도록 중복 방지 적용",
      "핵심 로직 자가진단 테스트(runCoreLogicSelfTests)를 14종으로 확장"
    ]
  },
  {
    id: "patch-v10.25",
    version: "v10.25",
    date: "2026-11-16",
    title: "레시피 재료 '+' 파싱/정규식 무결성 수정 · 카드 원터치 장보기 · 레시피 상단 저장",
    changes: [
      "레시피 재료 분리 정규식(\n 이스케이프) 및 handleSaveRecipe '+' 구분자 파싱 오류 수정",
      "레시피 모달 내 [🛒 부족 재료 일괄 장보기] 버튼이 handleAddMissingRecipeIngredientsToShopping과 정확히 연동되도록 수정",
      "레시피북 카드 화면에서도 각 재료가 냉장고 보유(✓)인지 부족(🛒)인지 표시하고 탭 시 바로 장보기에 추가",
      "레시피 등록/수정 모달 상단에도 고정(sticky) [💾 저장] 버튼 배치"
    ]
  },
  {
    id: "patch-v10.24",
    version: "v10.24",
    date: "2026-11-16",
    title: "드롭 후 스크롤 즉각 복구 · 식단 상단 저장 · 레시피 재료(+/장보기) · 영수증 11개 수량 점검",
    changes: [
      "냉장고 칩 드롭 직후 body overflow 토글 제거 및 동기식 터치 리스너 해제로 스크롤 잠깐 멈춤 현상 해결",
      "식단 기록 모달 상단에 고정(sticky) [💾 저장] 버튼 배치로 스크롤 없이 즉시 저장 가능",
      "레시피북 모달에서 재료를 하나씩 입력하면 '+'로 자동 연결되고 각 재료별 [🛒 장보기 추가] 원터치 지원",
      "영수증 스캔 시 수량(quantity) 11 오인식 방지 프롬프트·수량/단위 직접 수정칸·10개 이상 주의 배지 및 v3/v4 동시 저장 적용"
    ]
  },
  {
    id: "patch-v10.23",
    version: "v10.23",
    date: "2026-11-16",
    title: "레시피북 정렬(최신순·별점순·조리시간순) & 식단 내보내기 레시피북 자동 반영",
    changes: [
      "가족 레시피북에 최신순·가족 별점순·짧은 조리시간순 정렬 드롭다운 추가",
      "식단·재고 내보내기 AI 요청문 생성 시 가족 레시피북의 고평점 인기 메뉴(최대 5종)를 자동 참고 문구로 포함"
    ]
  },
  {
    id: "patch-v10.22",
    version: "v10.22",
    date: "2026-11-16",
    title: "요리 차감 v3/v4 동시 트랜잭션 & 냉장고 실시간 검색·임박 배지 즉시 처리",
    changes: [
      "레시피/식단 요리 완료 시 재고 차감 트랜잭션이 v4·v3 컬렉션을 함께 읽고 원자적 차감하도록 보완",
      "냉장고 탭에 실시간 재료 검색창(fridgeSearch)을 추가해 리스트 뷰·시각적 뷰 모두 즉시 필터링 지원",
      "상단 소비기한 임박/경과 알약을 탭하면 바로 수량 조절·다 먹음·폐기 시트가 열리도록 개선"
    ]
  },
  {
    id: "patch-v10.21",
    version: "v10.21",
    date: "2026-11-16",
    title: "장보기 일괄 비우기·중복 방지 & 냉장고 칸별 빠른 추가·전체 동기화 오류 감지",
    changes: [
      "장보기 목록에 [🧹 체크 완료 N건 비우기] 일괄 삭제(writeBatch) 버튼 추가",
      "카톡·음성 1초 장보기 파싱 시 이미 목록에 있는 품목 중복 추가 방지",
      "시각적 냉장고 각 칸 헤더에 [+] 버튼을 추가해 해당 칸·보관위치가 자동 선택된 상태로 바로 재료 등록 가능",
      "가계부·폐기·육아·일정 실시간 스냅샷 리스너의 빈 오류 콜백을 상단 syncErrorMsg 알림으로 통일"
    ]
  },
  {
    id: "patch-v10.20",
    version: "v10.20",
    date: "2026-11-16",
    title: "장보기·가족공지 목록 비움 시 초기 샘플 자동 부활 버그 수정",
    changes: [
      "장보기(family_shopping_v4) 및 가족공지(family_notices_v4)가 0건이 되었을 때 localStorage 미보유 기기에서 초기 샘플 데이터가 자동 재주입되던 로직 제거",
      "장보기·공지 실시간 스냅샷 오류 시 상단 동기화 알림(syncErrorMsg) 연결"
    ]
  },
  {
    id: "patch-v10.19",
    version: "v10.19",
    date: "2026-11-16",
    title: "모바일 칩 touch-action: none 시작 시점 고정 (브라우저 스크롤 컴포지터 선점 차단)",
    changes: [
      "칩 버튼에 시작 시점(touchstart)부터 touch-action: none 적용하여 모바일 브라우저가 스크롤로 먼저 가로채는 현상 근본 차단",
      "터치 기기에서 HTML5 draggable 속성 비활성화로 안드로이드 크롬 터치 충돌 제거",
      "롱프레스 인식 시간을 0.18초로 단축하여 더 빠르고 부드러운 칸 이동 체감 제공"
    ]
  },
  {
    id: "patch-v10.18",
    version: "v10.18",
    date: "2026-11-16",
    title: "모바일 칩 길게 눌러 이동 시 화면 스크롤 잠금 (Non-Passive Touch Lock)",
    changes: [
      "냉장고 시각적 뷰에서 재료를 0.25초 길게 누르면 진동·들림 효과와 함께 이동 모드로 전환",
      "이동 모드 활성 시 non-passive touchmove 차단 및 body 스크롤 잠금으로 핸드폰 스크롤 동시 발생 완전 해결",
      "길게 누르기 시 브라우저 텍스트 선택/컨텍스트 메뉴 팝업 방지(-webkit-touch-callout: none)"
    ]
  },
  {
    id: "patch-v10.17",
    version: "v10.17",
    date: "2026-11-16",
    title: "안정화 및 고도화 종합 패치 (터치 드래그 정밀도 · v3/v4 동기화 · 레시피 메타 자동백업 · 임박 필터)",
    changes: [
      "시각적 냉장고 뷰에서 빠른 손가락 드래그 시에도 목표 칸이 100% 정확히 인식되도록 Ref 기반 즉시 추적 적용",
      "보관 칸 이동(handleMoveFridgeShelfZone) 시 v4·v3 동시 배치 저장 및 상단 동기화 상태 배지 연동",
      "1일 2회 자동 클라우드 백업에 레시피북 텍스트 메타(recipesMeta) 포함 (사진 용량 제외로 900KB 제한 안전 준수)",
      "Visual Fridge View에 [⚠️ 임박만] 토글 및 숫자 수량 표기 일괄 정규화, 핵심 로직 자가진단 테스트(12종) 확장"
    ]
  },
  {
    id: "patch-v10.16",
    version: "v10.16",
    date: "2026-11-16",
    title: "재고 수량 문자열('01') 및 v3/v4 불일치 차감 오류 수정",
    changes: [
      "냉장고 수량 표시 및 불러오기 시 문자열('01' 등)을 숫자(Number)로 정규화하여 표기 오류 방지",
      "수량 +/- 조절 시 v4·v3 컬렉션 불일치를 방지하고 v3에만 있던 항목도 안전하게 동기화 차감"
    ]
  },
  {
    id: "patch-v10.15",
    version: "v10.15",
    date: "2026-11-16",
    title: "리스트 뷰에서 메인 냉동실·별도 냉동고를 '냉동실'로 통합 묶음 표시",
    changes: [
      "리스트 뷰 상단 보관위치 필터와 카드 배지에서 메인 냉동실·별도 냉동고를 [냉동실] 하나로 묶어 표시",
      "시각적 냉장고 뷰에서는 기존처럼 메인 냉동고(하부 4칸)와 별도 냉동고(4칸)를 분리해 관리 가능"
    ]
  },
  {
    id: "patch-v10.14",
    version: "v10.14",
    date: "2026-11-16",
    title: "메인 냉동실/별도 냉동고 분리 · 채소칸 통합 · 재료 칩 드래그 이동(모바일/PC) 지원",
    changes: [
      "보관 위치에 [메인 냉동실]과 [별도 냉동고]를 분리하여 등록·필터링 지원 (기존 '냉동실' 데이터 호환 유지)",
      "상부 냉장실의 채소칸 좌/우를 하나의 통합 [🥬 채소칸]으로 합쳐 13칸 구조로 단순화",
      "시각적 냉장고 뷰에서 재료 칩을 손가락(터치)이나 마우스로 끌어 원하는 칸에 바로 옮기는 드래그 앤 드롭 추가"
    ]
  },
  {
    id: "patch-v10.13",
    version: "v10.13",
    date: "2026-11-16",
    title: "우리 집 실제 냉장고(4도어 상냉장·하냉동 + 4칸 냉동고 + 팬트리) 도면형 시각화 뷰 적용",
    changes: [
      "냉장고 3단 + 채소칸 2개 / 하부냉동고 4칸 / 별도 4칸 냉동고 / 팬트리 1칸으로 실제 냉장고 구조 그대로 시각화",
      "복잡한 예정 사용량 수치를 제거하고, 카테고리 아이콘 + 재료명 + 수량 + D-Day만 콤팩트한 칩으로 배치",
      "재료 칩 클릭 시 수량 조절 · 보관 칸 이동 · 다 먹음 · 장보기 · 폐기를 바로 처리하는 퀵 액션 시트 추가"
    ]
  },
  {
    id: "patch-v10.12",
    version: "v10.12",
    date: "2026-11-16",
    title: "냉장고 리스트 뷰 기본 우선 표시 · 컴팩트 카드 가독성 개선 및 '다 먹음' 버튼 간소화",
    changes: [
      "냉장고 탭 진입 시 [📋 리스트 뷰]가 기본으로 먼저 보이도록 순서 및 초기값 변경",
      "재료 카드 여백 축소(컴팩트 레이아웃) 및 버튼·보관위치 탭 줄바꿈(whitespace-nowrap) 방지",
      "[다 먹음 (식비유지)] 버튼 문구를 [다 먹음]으로 간결하게 변경"
    ]
  },
  {
    id: "patch-v10.11",
    version: "v10.11",
    date: "2026-11-16",
    title: "내보내기 인별·목표별 AI 요청문 맞춤화 & 레시피북 자유비율 사진 자르기(크롭) 추가",
    changes: [
      "식단 내보내기에 [식단 목표 선택(재고소진 · 산후조리/영양보충 · 다이어트 · 치팅 · 숙취해소 · 한가족이 먹을수있는 식사)] 드롭다운 추가",
      "선택한 대상자(김수혁·최아리나·김시목·김시율·가족 전체)와 목표에 맞춰 AI 평가 요청문이 자동으로 달라지도록 개선",
      "레시피북 사진 업로드 시 한상차림에서 원하는 요리만 자유비율(드래그·모서리 크기조절)로 잘라 올리는 모바일 터치 크롭 에디터 추가"
    ]
  },
  {
    id: "patch-v10.10",
    version: "v10.10",
    date: "2026-11-16",
    title: "레시피북 카테고리·요약 리스트·사진 클릭 확대(라이트박스) 추가 & 카톡 장보기 파싱 버그 수정",
    changes: [
      "가족 레시피북에 카테고리(메인반찬·국/찌개·한그릇·유아식·간식·샐러드·기타) 필터 및 등록 필드 추가",
      "레시피북 상단에 [📋 요약 리스트 | 🖼️ 상세 카드] 전환 뷰 추가 — 전체 레시피를 한눈에 요약 조회",
      "레시피 카드 사진을 컴팩트 썸네일(h-24)로 축소하고, 클릭 시 전체 화면 확대 모달(라이트박스) 지원",
      "장보기 [카톡·음성 1초 파싱]에서 미정의 함수(hasAnyAiKey) 및 promptText 키 누락으로 발생하던 오류 수정"
    ]
  },
  {
    id: "patch-v10.9",
    version: "v10.9",
    date: "2026-11-16",
    title: "레시피북 사진 깨짐(undefined) 수정 · 자동 압축 저장 및 원스크린 브리핑 카드 제거",
    changes: [
      "레시피북 사진 업로드 시 fileToBase64 반환 필드(previewUrl) 매핑 오류로 이미지가 깨지던 현상 수정",
      "플레이팅 코치 연동 사진 및 직접 업로드 사진을 720px·JPEG 65%로 자동 압축해 Firestore 1MB 문서 제한 내에서 무료(Spark) 저장되도록 개선",
      "일별 식단 상단 [모닝·이브닝 원스크린 브리핑 카드] 제거"
    ]
  },
  {
    id: "patch-v10.8",
    version: "v10.8",
    date: "2026-11-16",
    title: "원스크린 브리핑 · 카톡 장보기 1초 파싱 · 가족 레시피북(플레이팅 연동) · 시각적 냉장고 예상 잔량 추가",
    changes: [
      "일별 식단 상단에 [모닝·이브닝 원스크린 브리핑 카드] 추가 (날씨·미세먼지, D-3 임박 재료, 시목이 어린이집 점심, 시율이 예정 접종·검진)",
      "장보기 탭에 [카톡·음성 장보기 문장 1초 파싱] 추가 — '양파 1망, 두부 2모 사와' 입력 시 품목·수량·카테고리 자동 분리 등록",
      "가족 레시피북(family_recipes_v8) 신설 — 완성 사진·실제 재료·조리시간·난이도·가족별 선호도 저장, 플레이팅 코치 결과 원클릭 연동, 과거 레시피 식단 재현 및 열람 잠금 보호",
      "스마트 냉장고 [시각적 보관존 뷰] 및 [예정 식단 사용량 · 예상 잔량] 자동 계산 추가 (보유량 - 향후 7일 식단 예정량 = 예상 잔량)"
    ]
  },
  {
    id: "patch-v10.7",
    version: "v10.7",
    date: "2026-11-16",
    title: "통합 내보내기 기간 선택(3·7·14일) 및 🤖 AI 평가용 요청문 자동 포함 기능 추가",
    changes: [
      "식단 내보내기 기간을 [최근 3일 / 최근 7일(1주일) / 최근 14일(2주일)] 드롭다운으로 자유롭게 선택 가능",
      "🤖 [AI 식단 평가용 요청문 자동 포함] 체크박스 추가 — 복사 후 외부 AI에 바로 붙여넣으면 영양·중복·남은 재고 활용 피드백 즉시 확인"
    ]
  },
  {
    id: "patch-v10.6",
    version: "v10.6",
    date: "2026-11-16",
    title: "최근 1주일 일별·인별 식단 + 냉장·냉동·실온 재고 통합 내보내기(드롭다운 선택) 추가",
    changes: [
      "내보내기 모달에 [내보내기 항목 드롭다운(1주일 식단+전체 재고 통합 / 1주일 식단만 / 전체 재고만)] 추가",
      "식단 대상자 드롭다운(가족 전체 인별 / 김수혁 / 최아리나 / 김시목 / 김시율) 및 보관위치 드롭다운(전체 / 냉장실 / 냉동실 / 실온·팬트리) 지원",
      "주간요약 탭 상단에도 [📤 식단·재고 내보내기] 바로가기 버튼 추가"
    ]
  },
  {
    id: "patch-v10.5",
    version: "v10.5",
    date: "2026-11-16",
    title: "Gemini 유료 API 키 최신 모델(gemini-3.8-flash) 복원 및 자가진단 폴백 보강",
    changes: [
      "Google API 정책 변경(gemini-2.5-flash 신규 종료)에 맞춰 기본 모델 및 자가진단 모델을 gemini-3.8-flash로 복원",
      "gemini-3.8-flash 실패 시 listModels 자동 탐색으로 유료 키에서 사용 가능한 최신 Flash 모델을 즉시 연결"
    ]
  },
  {
    id: "patch-v10.4",
    version: "v10.4",
    date: "2026-11-16",
    title: "안정화 종합 패치 (영수증 트랜잭션/중복방지 · 자가진단 · 식단 동시수정 · 해시 자동백업 · <option> 수정)",
    changes: [
      "영수증 일괄 입고를 operationId 기반 단일 Firestore 트랜잭션으로 전환해 중복 등록·부분 저장 방지 및 합계 불일치/미확인 경고 추가",
      "⚙️설정 [AI 연결 자가진단]의 구형 모델명(gemini-3.8-flash)을 gemini-2.5-flash로 수정",
      "식단 수정(handleSaveMeal)에 updatedAt 다중 기기 충돌 감지 적용, 재고 수량 조정 시 서버 최종 수량을 화면에 정확히 반영",
      "자동 백업이 전체 데이터 내용 해시(FNV-1a)와 1MiB 크기 제한을 감시하도록 개선하고, 다 먹음 처리의 불필요한 v3 식단 삭제 제거",
      "식단표 스캔 모달 <option> 내 JSX 태그를 순수 텍스트로 수정하고 한 그릇 요리 영양 구성 검증 강화"
    ]
  },
  {
    id: "patch-v10.3",
    version: "v10.3",
    date: "2026-11-16",
    title: "패치노트 버전 정렬 오류(v10.x가 v9.9 아래로 내려가던 현상) 수정",
    changes: [
      "패치노트 정렬이 문자열 사전순(v9 > v10)으로 되어 있어 v10.0~v10.2가 맨 아래에 숨겨지던 버그 수정",
      "메이저·마이너 숫자 기준 내림차순 정렬(v10.3 → v10.2 → v10.1 → v10.0 → v9.9) 적용"
    ]
  },
  {
    id: "patch-v10.2",
    version: "v10.2",
    date: "2026-11-16",
    title: "영수증 OCR 환각(감자·브로콜리) 방지 — 2단계 원문 추출 · 고대비 전처리 · 최신 비전 모델 적용",
    changes: [
      "영수증 스캔 시 존재하지 않는 모델명(gemini-3.8-flash) 및 gpt-4o-mini 저정밀 판독을 gemini-2.5-flash(MEDIA_RESOLUTION_HIGH) / gpt-4o로 개선",
      "영수증 AI 전달 이미지에 흑백 고대비(contrast 1.42) 전처리를 적용해 흐린 감열지 글자 판독력 향상",
      "AI가 먼저 영수증 원문 줄(rawLines)을 한 줄씩 받아 적은 뒤 품목을 추출하는 2단계 구조로 변경해 없는 품목(감자·브로콜리 등) 추측 방지",
      "영수증 모달 내 [AI 사용 엔진] 및 [원문 줄 보기] 토글 추가 + 결제금액(receiptTotal) 자동 입력 보강"
    ]
  },
  {
    id: "patch-v10.1",
    version: "v10.1",
    date: "2026-11-16",
    title: "영수증 OCR 정확도 강화(중복·단가밀림 방지) + 영수증 합계 대사(일치/차이) 검증 기능 추가",
    changes: [
      "각 영수증 줄(01~마지막)의 원문(rawLine)과 단가·할인·실결제금액을 1:1 고정 대조해 두부 중복 및 8,990원 오인식 방지",
      "인식된 품목 합계 + 비식품(봉투 등) vs 영수증 결제대상금액을 자동 대사해 ✅일치 / ⚠️차이금액 표시",
      "영수증 모달 내 [결제금액 직접 수정], [+ 품목 추가], [🔄 재스캔] 버튼 추가"
    ]
  },
  {
    id: "patch-v10.0",
    version: "v10.0",
    date: "2026-11-16",
    title: "영수증 OCR 행 밀림·누락 방지(줄번호 1:1 매핑 · 2200px 고화질 · 합계 검증 및 행 삭제/추가)",
    changes: [
      "영수증 스캔 해상도를 2200px(0.92)로 추가 상향하고, 01·02·03... 번호별 1:1 행 매핑으로 금액 밀림 및 하단 품목(대파·부침두부 등) 누락 방지",
      "스캔 결과 팝업에서 합계 금액 실시간 표시 및 개별 행 삭제(×)·수량 수정 지원"
    ]
  },
  {
    id: "patch-v9.9",
    version: "v9.9",
    date: "2026-11-16",
    title: "영수증·식단표 AI 스캔 고해상도(1800px · high detail) 및 에누리 할인 자동 반영 개선",
    changes: [
      "영수증·식단표 스캔 시 이미지 압축 해상도를 720px(저화질)에서 1800px 고화질(0.88)로 상향하고 OpenAI Vision detail: 'high' 적용",
      "에누리·쿠폰 할인(-금액) 차감 반영, 봉투 등 비식품 제외, 실제 수량/단위·보관위치·임시 소비기한 자동 분류"
    ]
  },
  {
    id: "patch-v9.7",
    version: "v9.7",
    date: "2026-11-16",
    title: "재고 동시수정 중복저장 제거 · 복원 전 안전백업/충돌확인 · 장보기 기존수량 차감 · 소비기한 구분",
    changes: [
      "handleSaveFridge()에서 트랜잭션 충돌 검증·저장 후 writeBatch가 중복 실행되던 문제 제거",
      "JSON 복원 전 기존 데이터와 신규/충돌 건수 비교 확인창 + 복원 직전 자동 안전 백업(pre_restore) 생성",
      "자동백업이 데이터 수량·수정시각 지문(signature) 변화를 감지해 동일 슬롯 내 변경도 안전 백업",
      "장보기 기존 예정 수량까지 차감 계산, 한그릇 요리도 재료 수량 검증, AI에 임시 소비기한 명시"
    ]
  },
  {
    id: "patch-v9.6",
    version: "v9.6",
    date: "2026-11-16",
    title: "식단 기록 시 칩(+) 추가 · 최근 자주 먹은 메뉴 원터치 · 즐겨찾기 조합 저장 지원",
    changes: [
      "메뉴 입력창에서 [+] 버튼으로 메뉴를 추가하면 자동으로 ' + '로 연결되고 개별 칩(×)으로 쉽게 수정 가능",
      "최근 먹은 개별 메뉴(Top 8) 원터치 칩 및 자주 먹는 조합(⭐ 즐겨찾기) 저장/불러오기 추가",
      "저장된 식단 카드는 기존처럼 깔끔한 한 줄('스무디 + 감') 형태 유지"
    ]
  },
  {
    id: "patch-v9.5",
    version: "v9.5",
    date: "2026-11-16",
    title: "최근 14일 메뉴 반복방지 · 다끼니 누적 재료합산 · 동시수정 충돌감지 · 자동백업 변경감지 · 로직 자가진단",
    changes: [
      "AI 식단 추천 시 최근 14일 식단 이력을 비교해 유사 메뉴 반복을 최소화하고, 전체 식단 누적 재료량에서 보유량 차감 계산",
      "식단·냉장고 수정 시 updatedAt 기준 다중 기기 동시 수정 충돌 감지 및 조리완료 재고 차감 연계",
      "자동백업 변경 감지(데이터 지문 비교) 및 설정 내 [🧪 핵심 로직 자가진단(단위·날짜·매칭·완성도)] 테스트 버튼 추가"
    ]
  },
  {
    id: "patch-v9.4",
    version: "v9.4",
    date: "2026-11-16",
    title: "AI 식단 수량·단위 비교 · 완성도 검증 · 누락끼니 추가생성 · 기존식단 충돌방지 · 냉장고 배치입고",
    changes: [
      "g/kg·ml/L 단위 변환 및 보유수량-필요수량 합산 비교로 부족분만 장보기에 정확히 반영 (미변환 단위는 확인 표시)",
      "완성형 한 끼 품질 검사(단독 1품목 채소/전 등 미달 시 경고) 및 누락된 끼니만 추가 생성 버튼 제공",
      "스냅샷에 성인 식사 목적(planAdultStyle)까지 고정, 메뉴 직접 수정 시 구 구성요소 결합 방지",
      "식단표 반영 시 기존 날짜·끼니 충돌 건너뛰기/추가 선택 지원, 냉장고 입고를 writeBatch 원자적 저장으로 개선"
    ]
  },
  {
    id: "patch-v9.2",
    version: "v9.2",
    date: "2026-11-15",
    title: "AI 자유 날짜·완성형 식단 추천(성인/유아 완전 분리) + 냉장고 전체 재고 내보내기",
    changes: [
      "날짜별 아침·점심·저녁 개별 체크, 비연속 날짜 추가/삭제, 성인식(일반/다이어트/고단백)·유아식(생년월일 기반 월령 자동계산)·온가족식 프롬프트 완전 분리",
      "완성형 한 끼(주식·메인·반찬/채소, 인분, 조리시간, 재료 소요량) 구조 및 카드 내 메뉴 직접 수정·특정 끼니만 재추천 지원",
      "냉장고 유효 전체 재고(25개 제한 해제, 만료·0개 제외) AI 반영 및 냉장고 탭 상단 [📤 전체 재고 내보내기](복사·TXT·공유) 추가"
    ]
  },
  {
    id: "patch-v9.1",
    version: "v9.1",
    date: "2026-11-15",
    title: "v9.0 JSX 빌드 오류 수정 · AI 3일 식단 검증/중복반영 방지 · 장보기 배치 저장 · 재고삭제 분리",
    changes: [
      "AI 탭 Fragment(</>) 닫힘 위치 및 육아수첩 잉여 태그 제거로 JSX 구문 오류 0건 해결",
      "3일치 AI 식단에 operationId 중복 반영 방지, 생성 당시 대상자 스냅샷 고정, 날짜·끼니·건수 엄격 검증 적용",
      "부족 재료 장보기 추가 시 수량/단위 지원, 기존 장보기·냉장고 중복 대사 및 writeBatch 원자적 저장 적용",
      "냉장고 재고 삭제 시 무관한 family_meals_v3 문서 삭제 코드 제거 (식비·식단 100% 보존)"
    ]
  },
  {
    id: "patch-v9.0",
    version: "v9.0",
    date: "2026-11-15",
    title: "📅 3일치 AI 맞춤 식단표 생성 + 부족 재료 장보기 담기 + 선택 끼니 일괄 반영",
    changes: [
      "AI추천 탭에 [📅 3일치 식단표] 모드 추가 (어른밥 / 시목이 유아식 / 온가족 원팟 선택 및 아침·점심·저녁 끼니 체크)",
      "냉장고 보유 및 소비기한 임박 재료를 최대한 우선 활용하고, 꼭 필요한 부족 재료만 추려 원클릭 장보기 담기 지원",
      "생성된 3일치 식단 중 마음에 드는 끼니만 체크해 기존 식단표에 덮어쓰기 없이 안전하게 일괄 반영"
    ]
  },
  {
    id: "patch-v8.9",
    version: "v8.9",
    date: "2026-11-15",
    title: "데이터 정합성 패치 (식비 원장 보호·원자적 삭제 배치·빈 로그 동기화·쓰기 카운터 누수 수정)",
    changes: [
      "냉장고 재고 삭제 시 연결된 식비 원장(family_expenses_v4)을 보존해 구매비용 누락 방지",
      "식단·일정·냉장고 삭제를 Firestore writeBatch 원자적 처리로 통합하고 실패 시 Undo/화면 상태 변경 차단",
      "family_deleted_logs_v8 빈 스냅샷(0건)도 즉시 반영해 기기 간 삭제 로그 동기화 오류 수정",
      "요리 완료 중복 차감 시 activeWriteCount 카운터 누수 수정, handleSaveMeal/handleAdjustQuantity 서버 성공 후 UI 확정"
    ]
  },
  {
    id: "patch-v8.8",
    version: "v8.8",
    date: "2026-11-15",
    title: "냉장고 재료추가 현재 필터(보관위치·카테고리) 자동 반영 + 소비기한 기본값(냉장 1주/냉동 1달)",
    changes: [
      "냉장고 탭 및 + 플로팅 버튼으로 재료 추가 시 현재 선택된 보관위치(냉동실 등)와 카테고리(유제품/계란 등)를 기본값으로 자동 입력",
      "소비기한 기본값을 냉장실·실온은 1주 뒤(+7일), 냉동실은 1달 뒤(+1개월)로 자동 세팅 (모달 내 보관위치 변경 시에도 자동 연동)"
    ]
  },
  {
    id: "patch-v8.7",
    version: "v8.7",
    date: "2026-11-15",
    title: "To-Do 체크리스트 기본 [할일(To-Do)]만 표시 + 병원·행사 포함 토글 추가",
    changes: [
      "전체 To-Do 체크리스트에서 기본으로 '할일(To-Do)' 분류만 깔끔하게 표시하도록 개선",
      "필요할 때 육아/병원·가족행사 일정도 함께 체크할 수 있는 [🏥 병원·행사 포함] 토글 버튼 추가"
    ]
  },
  {
    id: "patch-v8.6",
    version: "v8.6",
    date: "2026-11-15",
    title: "데이터 안정화 패치 (부부간 삭제 로그 공유·원자적 복구·저장 오류 감지·요리 차감 잠금)",
    changes: [
      "식단·일정·냉장고 삭제 시 공통 5초 Undo 토스트 및 Firestore(family_deleted_logs_v8) 부부 기기 간 삭제 로그 공유",
      "삭제 복구를 Firestore 트랜잭션으로 원자적 처리하고 동일 ID 충돌 방지 및 서버 성공 후 화면 갱신 적용",
      "동시 저장 카운터·hasPendingWrites·오류 감지를 반영한 실시간 동기화 상태 배지 및 catch(e){} 오류 무시 제거",
      "요리 완료 재고 차감 시 미연결 차단·중복 클릭 방지·+/- 버튼 44px 확대"
    ]
  },
  {
    id: "patch-v8.5",
    version: "v8.5",
    date: "2026-11-15",
    title: "영수증 스캔 냉장고 탭 이동 · 식단표 스캔 슬림화 · 헤더 제목 잘림 제거",
    changes: [
      "마트 영수증 AI 스캔 버튼을 냉장고 탭 상단으로 이동",
      "일별식단 탭의 식단표 AI 스캔 버튼을 컴팩트한 1줄 바로 축소해 오늘의 식단 노출 강화",
      "상단 헤더 제목을 '우리 가족 식탁 🍽️'으로 간결화해 모바일 가로 잘림(...) 제거"
    ]
  },
  {
    id: "patch-v8.4",
    version: "v8.4",
    date: "2026-11-15",
    title: "모바일 사용성 완성 (상단 1줄 요약·9메뉴 기본접힘·5초 되돌리기/삭제로그·실시간 동기화·빠른추가 FAB)",
    changes: [
      "상단 요약 바를 진짜 1줄(가로 스크롤/압축)로 고정하고, 상단 3×3 바로가기 9개 메뉴를 기본 접힘 처리",
      "식단·일정·재고 삭제 시 5초간 [↩️ 되돌리기(Undo)] 토스트 + 설정 내 [🗑️ 최근 삭제 로그 및 복구] 추가",
      "실제 네트워크/인증/저장 상태에 연동된 동기화 배지(연결됨/저장 중/오프라인/오류) 적용",
      "더보기 시트 접근성(Escape 닫기·포커스 복원·스크롤 잠금·Safe Area), 44×44px 터치 영역 및 빠른 추가(+) FAB 추가"
    ]
  },
  {
    id: "patch-v8.2",
    version: "v8.2",
    date: "2026-11-15",
    title: "모바일 UI 고도화 (컴팩트 배너·상단 요약 접기/펼치기·5버튼 하단바·터치 영역 확대)",
    changes: [
      "상단 가족사진 배너 높이를 모바일 최적화(h-24)로 축소하고 접기/펼치기 기능 유지",
      "날씨·3일내 일정·가족공지를 기본 1줄 핵심 요약 바 + [상세 ▼] 펼치기로 정리해 오늘의 식단까지 스크롤 거리 대폭 단축",
      "하단 내비게이션을 5개 핵심 메뉴(식단·일정·육아·냉장고·더보기)로 재설계하고 [더보기]에서 주간/월간/장보기/공지/AI 접근 지원",
      "편집·삭제 버튼 터치 영역 확대(32x32px) 및 간격(gap-2) 확보, 아바타 1:1 비율 고정"
    ]
  },
  {
    id: "patch-v8.1",
    version: "v8.1",
    date: "2026-11-15",
    title: "냉장고·장보기·입고 카테고리에 '밀키트' 추가",
    changes: [
      "FRIDGE_CATEGORIES에 '밀키트' 카테고리를 추가해 냉장고 필터, 재료 등록, 장보기 입고 시 바로 분류 가능"
    ]
  },
  {
    id: "patch-v8.0",
    version: "v8.0",
    date: "2026-11-15",
    title: "육아수첩 월령별 발달과정 12단계 세분화 (삐뽀삐뽀 119 소아과·이유식 핵심 반영)",
    changes: [
      "0~24개월 발달과정을 8단계에서 12단계(0·1·2·3~4·5·6·7~8·9~10·11~12·13~15·16~18·19~24개월)로 세분화",
      "하정훈 원장(삐뽀삐뽀 119 소아과/이유식) 기준 만 6개월 이유식·철분(쇠고기)·컵/젖병 떼기·식습관·수면·훈육 포인트 반영",
      "각 시기별 '⚠️ 소아과 상담이 필요한 신호(Red Flags)' 체크 항목 추가"
    ]
  },
  {
    id: "patch-v7.9",
    version: "v7.9",
    date: "2026-11-15",
    title: "상단 가족사진 히어로 배너 내장 이미지 폴백 추가 (파일 경로 무관 100% 표시 보장)",
    changes: [
      "public/og-family.png 파일이 아직 없거나 경로가 달라도 상단 가족사진 히어로 배너가 항상 선명하게 표시되도록 내장 이미지 폴백 적용"
    ]
  },
  {
    id: "patch-v7.8",
    version: "v7.8",
    date: "2026-11-15",
    title: "시안 A 상단 가족사진 히어로 배너 · 2줄 상단 메뉴 · 새 가족 얼굴 아바타 · 카톡 썸네일 지원",
    changes: [
      "상단 상태 배지(동기화 중·패치노트·편집가능·월간식비·설정)를 2줄로 여유 있게 재배치하고 줄바꿈 깨짐 방지",
      "새 가족사진(4인)에서 추출한 원형 얼굴 아바타로 4명 프로필 일괄 교체",
      "시안 A 상단 가족사진 히어로 배너 적용 (접기 시 함께 접힘) 및 카톡/홈화면 아이콘용 og-family.png 연동"
    ]
  },
  {
    id: "patch-v7.7",
    version: "v7.7",
    date: "2026-11-15",
    title: "JSX 빌드 오류 수정 · 영수증/AI 열람전용 차단 보완 · 재고 트랜잭션 정합성 개선",
    changes: [
      "설정 모달 조건부 JSX 닫힘 괄호 위치 오류 수정 (Vercel npm run build 오류 해결)",
      "영수증 일괄 입고 및 AI 호출 핸들러에 열람 전용 모드 차단(requireEditorAccess) 적용",
      "재고 수량 조절 시 삭제된 문서 재생성 방지, 요리 차감 시 동일 재고 ID 수량 합산 및 저장 실패 알림 보완"
    ]
  },
  {
    id: "patch-v7.6",
    version: "v7.6",
    date: "2026-11-15",
    title: "가족 4명 실제 얼굴 동그란 프로필 아바타 적용 + 카카오톡 링크 제목(아리수혁시목시율♡) 지원",
    changes: [
      "식단·주간요약·일정·육아수첩·모달 전체의 가족 이모티콘을 수혁·아리나·시목·시율 실제 얼굴 원형 아바타로 교체",
      "index.html 오픈그래프(og:title) 설정을 통해 카카오톡 링크 공유 시 '아리수혁시목시율♡'으로 표시되도록 지원"
    ]
  },
  {
    id: "patch-v7.5",
    version: "v7.5",
    date: "2026-11-15",
    title: "초대 비밀코드 기반 편집 잠금(열람 전용 / 초대자 편집 분리) 기능 추가",
    changes: [
      "누구나 로그인 없이 식단·일정·육아수첩을 열람할 수 있도록 기본 열람 전용 모드 적용",
      "상단 [🔒 열람전용 / ✏️ 편집가능] 배지 및 관리자 초대 코드 입력 모달·원터치 초대 링크 복사 추가",
      "열람 전용 모드에서는 데이터 추가·수정·삭제, AI 키 설정 및 JSON 복원 동작을 안전하게 차단"
    ]
  },
  {
    id: "patch-v7.4",
    version: "v7.4",
    date: "2026-11-15",
    title: "실행 코드 버전·접속 도메인 실시간 표시 및 원터치 캐시 초기화 새로고침 추가",
    changes: [
      "상단 패치노트 배지에 실제 빌드된 코드 버전(APP_CODE_VERSION)을 직접 고정 표시하여 구버전/캐시 혼선 방지",
      "패치노트 모달 상단에 현재 실행 코드 버전, 접속 도메인(hostname), 빌드 일시 진단 박스 추가",
      "모바일 브라우저 캐시로 구버전이 보일 때 즉시 우회할 수 있는 [캐시 지우고 새로고침] 버튼 추가"
    ]
  },
  {
    id: "patch-v7.3",
    version: "v7.3",
    date: "2026-11-15",
    title: "요리 완료 중복 차감 방지(operationId) · 이미지 25초 타임아웃 · 접종일 저장 롤백 · 미평가 UI 개선",
    changes: [
      "요리 완료 재고 차감 시 operationId를 트랜잭션으로 검증하여 연속 터치/재시도 시 중복 차감 완벽 방지",
      "플레이팅 예시 이미지 생성에 25초 타임아웃 적용 (OpenAI 실패 시 Gemini 자동 전환 유지)",
      "예방접종 완료 체크/날짜 수정 시 서버 저장 실패하면 화면 상태 자동 롤백, 플레이팅 점수 '미평가' 시 /5 숨김 처리"
    ]
  },
  {
    id: "patch-v7.2",
    version: "v7.2",
    date: "2026-11-15",
    title: "플레이팅 예시 이미지 생성(저비용) · 접종일 직접 수정 · AI 설정/진단 가시성 개선 · 전체 트랜잭션 차감",
    changes: [
      "AI 플레이팅 코치에 [🎨 완성 예시 이미지 그려보기] 버튼 추가 (OpenAI 저비용 이미지 모델 우선, 필요 시에만 생성)",
      "요리 완료 재고 차감을 단일 Firestore 트랜잭션으로 통합(부분 차감 오류 방지) & 자동백업에 육아수첩·폐기이력 포함",
      "예방접종·검진 완료 항목의 실제 접종일 날짜 수정 기능 추가 & 설정 내 불필요한 구글 로그인 UI 제거",
      "설정 화면에 AI 키 저장 여부 배지 & 자가진단 결과 즉시 표시 + AI 오류센터에 실제 응답 엔진(GPT/Gemini) 정확히 기록"
    ]
  },
  {
    id: "patch-v7.1",
    version: "v7.1",
    date: "2026-11-15",
    title: "안정화 패치 (육아수첩 백업·Google 로그인·재고차감 확인창·성장그래프·AI 오류센터)",
    changes: [
      "전체 JSON 백업/복원에 육아수첩(성장·접종·진료메모) 및 폐기손실 데이터 포함 + 200건 제한 해제",
      "부부 전용 Google 계정 로그인 지원 추가 & 접종 일정 덮어쓰기 방지·월말 날짜 보정 적용",
      "요리 완료 시 재료 차감 수량 확인 팝업, 재고 부족 시 음수 차감 차단, 저장 실패 시 롤백 적용",
      "성장 기록 내 키·몸무게 추이 SVG 그래프 & 설정 내 GPT/Gemini 통합 진단·AI 오류센터 추가"
    ]
  },
  {
    id: "patch-v7.0",
    version: "v7.0",
    date: "2026-11-15",
    title: "👶 [육아수첩] 탭 신설 (월령별 발달 · 예방접종/영유아검진 · 성장/열 체크 · 일정 원클릭 등록)",
    changes: [
      "시목이(2025.08.03생)·시율이(2026.11.06생) 실시간 생후 일수/개월수 자동 계산 및 맞춤 조회",
      "질병관리청 국가필수예방접종(NIP)·선택접종·영유아 건강검진(1~8차) 체크리스트 및 일정 달력 원클릭 자동 등록",
      "월령별 발달과정(신체·언어·수면·수유/이유식), 키·몸무게·머리둘레 성장 기록, 소아과 진료·열 체크 메모 추가"
    ]
  },
  {
    id: "patch-v6.3",
    version: "v6.3",
    date: "2026-11-15",
    title: "OpenAI GPT + Google Gemini 듀얼 AI 엔진 탑재 (자동 전환 지원)",
    changes: [
      "⚙️설정에 OpenAI GPT API 키 입력 및 엔진 선택(자동 / GPT 우선 / Gemini 우선) 기능 추가",
      "Gemini 서버 혼잡(503) 시 자동으로 OpenAI GPT(gpt-4o-mini 등 Vision 지원)로 전환하여 끊김 없는 AI 추천·사진 분석 지원"
    ]
  },
  {
    id: "patch-v6.2",
    version: "v6.2",
    date: "2026-11-15",
    title: "주방 매니저(재고 차감·장보기 연동) · 한 냄비 가족식 · 폐기손실 분석 · 주간이동 추가",
    changes: [
      "Firestore runTransaction() 적용으로 부부 동시 재고 수량 변경 충돌 완벽 방지",
      "AI 레시피 카드에 [한 냄비 가족별 맞춤 가이드(수혁/아리나/시목/시율)] + [부족 재료 장보기 1초 담기] + [요리 완료 재고 차감] 추가",
      "냉장고 [폐기(손실기록)] 버튼 및 월간 식비 가계부 내 [폐기손실 별도 집계] 카드 추가",
      "주간 식단 요약 탭에 [이전주 / 이번주 / 다음주] 이동 버튼 추가"
    ]
  },
  {
    id: "patch-v6.1",
    version: "v6.1",
    date: "2026-11-15",
    title: "AI 플레이팅 코치(요리 사진 업로드 분석) 기능 추가",
    changes: [
      "AI추천 탭에 완성 요리 사진을 올리면 색감·구도 점수, 그릇·가니쉬, 플레이팅 개선 팁을 알려주는 [AI 플레이팅 코치] 추가",
      "Firebase Storage 유료 전환 없이 기존 Gemini Vision 엔진으로 즉시 분석 및 셰프 노트 기록 지원"
    ]
  },
  {
    id: "patch-v6.0",
    version: "v6.0",
    date: "2026-11-15",
    title: "보안·동기화 무결성 강화 & 월간 달력 요일 정렬 수정",
    changes: [
      "Gemini API 키 코드 내 하드코딩 제거 및 x-goog-api-key 헤더 전송, 제3자 폴백 제거",
      "Firestore 동시 삭제 유실 방지(arrayUnion) 및 v4 최신 데이터 우선 병합 적용",
      "재고 수정 시 과거 식비 원장 보호, JSON 복원 전 확인창 및 실패 건수 알림 추가",
      "월간 식단 달력 1일 앞 요일 공백 정렬 수정 & 백업 날씨 미세먼지 '미측정' 정직 표기"
    ]
  },
  {
    id: "patch-v5.9",
    version: "v5.9",
    date: "2026-11-15",
    title: "AI 엔진(JSON 파싱·자가진단) 개선 & 서울 중구 날씨·미세먼지 위젯 탑재",
    changes: [
      "AI 응답 JSON 객체/배열 자동 파싱 및 정확한 API 오류 안내 + ⚙️설정 내 [AI 연결 자가진단] 버튼 추가",
      "상단 헤더에 실시간 서울 중구 기온·최고/최저·미세먼지(PM10)·초미세먼지(PM2.5) 위젯 추가",
      "기존 파이어베이스 데이터·일정·장보기·공지·자동백업 기능 100% 유지"
    ]
  },
  {
    id: "patch-v5.6",
    version: "v5.6",
    date: "2026-11-15",
    title: "일정 탭 내 [주간 일정 요약 보드] & [전체 To-Do 체크리스트] 추가",
    changes: [
      "일정 탭에 해당 주간(월~일) 중 일정이 있는 날짜만 모아서 보여주는 [주간 일정 요약] 화면 추가",
      "모든 할 일(To-Do)을 한곳에서 체크박스로 완료/미완료 관리하고 바로 추가하는 [전체 To-Do 체크리스트] 추가",
      "기존 패치노트, 상단바 접기/펼치기, 틀고정 해제, 1일 2회 자동백업 기능 100% 유지"
    ]
  },
  {
    id: "patch-v5.5",
    version: "v5.5",
    date: "2026-11-15",
    title: "패치노트 & 상단바 접기/틀고정 해제 복원 + 일정 달력 상단 배치",
    changes: [
      "상단 바 펼치기/접기(▲/▼) 및 상단 틀고정 해제/고정(📌) 토글 버튼 완벽 복원",
      "버전별 업데이트 내역을 확인하고 직접 기록·관리할 수 있는 [패치노트] 모달 복원",
      "일정 탭에서 [월간 달력]을 최상단에, [가족 D-Day 카운트다운 보드]를 최하단에 배치",
      "하루 2회(오전/오후) 클라우드 자동 백업 및 Gmail/구글 드라이브 즉시 전송 기능 탑재"
    ]
  },
  {
    id: "patch-v5.0",
    version: "v5.0",
    date: "2026-11-15",
    title: "가족 일정·기념일·D-Day 탭 신설 & JSON 1초 백업/복원",
    changes: [
      "우리 가족 6대 기념일 및 생일(매년 자동 반복 & 생후 D+일수 계산) 탑재",
      "3일 이내 도래하는 일정(D-3 ~ D-Day) 상단 자동 알림 배너 추가",
      "상단 8개 메뉴 2줄 균일 높이(h-9) 그리드 적용 및 새 일정 D-Day 기본 체크 해제",
      "전체 DB 원본(JSON) 1초 다운로드 및 1초 완벽 복원 기능 추가"
    ]
  },
  {
    id: "patch-v4.0",
    version: "v4.0",
    date: "2026-11-14",
    title: "Gemini 2.5 AI 스캔 고도화 & 식비 원장 분리 & 장보기·공지 탭 추가",
    changes: [
      "냉장고 재료 소진(다 먹음) 시에도 월간 식비 지출 총액이 줄어들지 않도록 가계부 원장(expenses) 분리",
      "화이트보드 손글씨(아/점/저) 및 모든 월(1~12월) 식단표 이미지 AI Vision 스캔 지원",
      "장보기 체크리스트(구매완료 시 냉장고 직행) 및 가족 공지사항 탭 신설",
      "기존 파이어베이스(v3/v4) 데이터 100% 무손실 통합 연동"
    ]
  },
  {
    id: "patch-v1.0",
    version: "v1.0",
    date: "2026-11-01",
    title: "수혁·아리나·시목·시율네 식탁 앱 최초 런칭",
    changes: [
      "일별 6단계 끼니(아침/오전간식/점심/오후간식/저녁/야식) 및 신당동어린이집 식단 연동",
      "스마트 냉장고 재고·소비기한 관리 및 부부 스마트폰 실시간 동기화 구축"
    ]
  }
];


export const INITIAL_SCHEDULES = [
  {
    id: "anniv-family-start",
    title: "💕 우리 가족의 시작",
    date: "2020-08-16",
    category: "기념일/생일",
    members: ["수혁", "아리나"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: true,
    done: false,
    memo: "수혁 & 아리 우리 가족의 시작일 (2020.08.16)"
  },
  {
    id: "anniv-wedding",
    title: "💍 결혼기념일",
    date: "2023-04-02",
    category: "기념일/생일",
    members: ["수혁", "아리나"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: true,
    done: false,
    memo: "수혁 & 아리 결혼기념일 (2023.04.02)"
  },
  {
    id: "bday-simok",
    title: "🎂 시목 생일",
    date: "2025-08-03",
    category: "기념일/생일",
    members: ["시목"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: true,
    done: false,
    memo: "우리 첫째 아들 시목이 태어난 날 (2025.08.03)"
  },
  {
    id: "bday-siyul",
    title: "🍼 시율 생일",
    date: "2026-11-06",
    category: "기념일/생일",
    members: ["시율"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: true,
    done: false,
    memo: "우리 둘째 딸 시율이 태어난 날 (2026.11.06)"
  },
  {
    id: "bday-arina",
    title: "🌷 아리 생일",
    date: "2026-08-31",
    category: "기념일/생일",
    members: ["아리나"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: false,
    done: false,
    memo: "사랑하는 아내/엄마 아리나 생일 (매년 8월 31일)"
  },
  {
    id: "bday-soohyeok",
    title: "👨🏻 수혁 생일",
    date: "2026-03-09",
    category: "기념일/생일",
    members: ["수혁"],
    isAnnual: true,
    showDday: true,
    hasOriginYear: false,
    done: false,
    memo: "든든한 남편/아빠 수혁 생일 (매년 3월 9일)"
  }
];


export const CHILDREN_INFO = [
  { id: "시목", name: "시목", birthDate: "2025-08-03", gender: "남아", emoji: "👦🏻", badge: "첫째" },
  { id: "시율", name: "시율", birthDate: "2026-11-06", gender: "여아", emoji: "👶🏻", badge: "둘째" }
];


// 질병관리청 · 대한소아청소년과학회 「2017 소아청소년 성장도표」 (0~35개월, [월령, P3, P50, P97])
export const KOREA_GROWTH_STD_2017 = {
  남아: {
    height: [
      [0, 46.3, 49.9, 53.4], [1, 51.1, 54.7, 58.4], [2, 54.7, 58.4, 62.2], [3, 57.6, 61.4, 65.3],
      [4, 60.0, 63.9, 67.8], [5, 61.9, 65.9, 69.9], [6, 63.6, 67.6, 71.6], [7, 65.1, 69.2, 73.2],
      [8, 66.5, 70.6, 74.7], [9, 67.7, 72.0, 76.2], [10, 69.0, 73.3, 77.6], [11, 70.2, 74.5, 78.9],
      [12, 71.3, 75.7, 80.2], [15, 74.4, 79.1, 83.9], [18, 77.2, 82.3, 87.3], [21, 79.7, 85.1, 90.5],
      [24, 81.4, 87.1, 92.9], [27, 83.5, 89.6, 95.7], [30, 85.5, 91.9, 98.3], [33, 87.4, 94.1, 100.8],
      [35, 88.5, 95.4, 102.3]
    ],
    weight: [
      [0, 2.5, 3.3, 4.3], [1, 3.4, 4.5, 5.7], [2, 4.4, 5.6, 7.0], [3, 5.1, 6.4, 7.9],
      [4, 5.6, 7.0, 8.6], [5, 6.1, 7.5, 9.2], [6, 6.4, 7.9, 9.7], [7, 6.7, 8.3, 10.2],
      [8, 7.0, 8.6, 10.5], [9, 7.2, 8.9, 10.9], [10, 7.5, 9.2, 11.2], [11, 7.7, 9.4, 11.5],
      [12, 7.8, 9.6, 11.8], [15, 8.4, 10.3, 12.7], [18, 8.9, 10.9, 13.5], [21, 9.3, 11.5, 14.3],
      [24, 9.8, 12.2, 15.1], [27, 10.2, 12.7, 15.9], [30, 10.7, 13.3, 16.6], [33, 11.1, 13.8, 17.3],
      [35, 11.3, 14.2, 17.8]
    ],
    bmi: [
      [0, 11.3, 13.4, 16.1], [1, 12.6, 14.9, 17.6], [2, 13.8, 16.3, 19.2], [3, 14.4, 16.9, 19.8],
      [4, 14.7, 17.2, 20.1], [5, 14.8, 17.3, 20.3], [6, 14.8, 17.3, 20.3], [7, 14.8, 17.3, 20.3],
      [8, 14.8, 17.3, 20.2], [9, 14.7, 17.2, 20.1], [10, 14.6, 17.0, 20.0], [11, 14.5, 16.9, 19.8],
      [12, 14.4, 16.8, 19.6], [15, 14.1, 16.4, 19.2], [18, 13.9, 16.1, 18.8], [21, 13.7, 15.9, 18.5],
      [24, 13.6, 15.7, 18.4], [27, 13.6, 15.7, 18.4], [30, 13.5, 15.7, 18.3], [33, 13.5, 15.6, 18.3],
      [35, 13.5, 15.6, 18.2]
    ]
  },
  여아: {
    height: [
      [0, 45.6, 49.1, 52.7], [1, 50.0, 53.7, 57.4], [2, 53.2, 57.1, 60.9], [3, 55.8, 59.8, 63.8],
      [4, 58.0, 62.1, 66.2], [5, 59.9, 64.0, 68.2], [6, 61.5, 65.7, 70.0], [7, 62.9, 67.3, 71.6],
      [8, 64.3, 68.7, 73.2], [9, 65.6, 70.1, 74.7], [10, 66.8, 71.5, 76.1], [11, 68.0, 72.8, 77.5],
      [12, 69.2, 74.0, 78.9], [15, 72.4, 77.5, 82.7], [18, 75.2, 80.7, 86.2], [21, 77.9, 83.7, 89.4],
      [24, 79.6, 85.7, 91.8], [27, 81.9, 88.3, 94.6], [30, 84.0, 90.7, 97.3], [33, 86.0, 92.9, 99.8],
      [35, 87.3, 94.4, 101.4]
    ],
    weight: [
      [0, 2.4, 3.2, 4.2], [1, 3.2, 4.2, 5.4], [2, 4.0, 5.1, 6.5], [3, 4.6, 5.8, 7.4],
      [4, 5.1, 6.4, 8.1], [5, 5.5, 6.9, 8.7], [6, 5.8, 7.3, 9.2], [7, 6.1, 7.6, 9.6],
      [8, 6.3, 7.9, 10.0], [9, 6.6, 8.2, 10.4], [10, 6.8, 8.5, 10.7], [11, 7.0, 8.7, 11.0],
      [12, 7.1, 8.9, 11.3], [15, 7.7, 9.6, 12.2], [18, 8.2, 10.2, 13.0], [21, 8.7, 10.9, 13.8],
      [24, 9.2, 11.5, 14.6], [27, 9.6, 12.1, 15.4], [30, 10.1, 12.7, 16.2], [33, 10.5, 13.3, 17.0],
      [35, 10.8, 13.7, 17.6]
    ],
    bmi: [
      [0, 11.2, 13.3, 15.9], [1, 12.2, 14.6, 17.3], [2, 13.2, 15.8, 18.8], [3, 13.8, 16.4, 19.5],
      [4, 14.1, 16.7, 19.9], [5, 14.2, 16.8, 20.1], [6, 14.3, 16.9, 20.1], [7, 14.3, 16.9, 20.1],
      [8, 14.2, 16.8, 20.0], [9, 14.1, 16.7, 19.9], [10, 14.0, 16.6, 19.7], [11, 13.9, 16.5, 19.6],
      [12, 13.8, 16.4, 19.4], [15, 13.6, 16.0, 19.0], [18, 13.4, 15.7, 18.6], [21, 13.3, 15.5, 18.4],
      [24, 13.3, 15.4, 18.3], [27, 13.3, 15.4, 18.3], [30, 13.3, 15.4, 18.3], [33, 13.3, 15.4, 18.3],
      [35, 13.3, 15.4, 18.3]
    ]
  }
};


export const normalCdf = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
};


export const interpolateGrowthRef = (table, monthsFloat) => {
  const m = Math.max(0, Math.min(35, monthsFloat));
  for (let i = 0; i < table.length - 1; i++) {
    const [m0, p30, p500, p970] = table[i];
    const [m1, p31, p501, p971] = table[i + 1];
    if (m >= m0 && m <= m1) {
      const r = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
      return {
        p3: p30 + (p31 - p30) * r,
        p50: p500 + (p501 - p500) * r,
        p97: p970 + (p971 - p970) * r
      };
    }
  }
  const last = table[table.length - 1];
  return { p3: last[1], p50: last[2], p97: last[3] };
};


export const GROWTH_PERCENTILE_Z = {
  3: -1.8808,
  5: -1.6449,
  10: -1.2816,
  25: -0.6745,
  50: 0,
  75: 0.6745,
  90: 1.2816,
  95: 1.6449,
  97: 1.8808
};

export const getGrowthPercentileValue = (table, monthsFloat, pct = 50) => {
  const ref = interpolateGrowthRef(table, monthsFloat);
  if (pct === 50) return ref.p50;
  if (pct === 3) return ref.p3;
  if (pct === 97) return ref.p97;
  const z = GROWTH_PERCENTILE_Z[pct] ?? 0;
  const sd = z >= 0 ? (ref.p97 - ref.p50) / 1.8808 : (ref.p50 - ref.p3) / 1.8808;
  return Math.max(0, ref.p50 + z * sd);
};

export const evaluateGrowthMetric = (table, monthsFloat, val) => {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return null;
  const ref = interpolateGrowthRef(table, monthsFloat);
  const z =
    num >= ref.p50
      ? (num - ref.p50) / Math.max(0.01, (ref.p97 - ref.p50) / 1.8808)
      : (num - ref.p50) / Math.max(0.01, (ref.p50 - ref.p3) / 1.8808);
  const rawPct = Math.round(normalCdf(z) * 100);
  const pct = Math.max(1, Math.min(99, rawPct));
  const label = num < ref.p3 ? "3백분위 미만" : num > ref.p97 ? "97백분위 초과" : `${pct}백분위`;
  const status = num < ref.p3 ? "저성장 주의" : num > ref.p97 ? "상위 3% 이내" : "정상 범위";
  return { val: num, ...ref, pct, label, status, diffP50: num - ref.p50 };
};


export const evaluateKoreanGrowthPercentile = (child, measureDateStr, heightVal, weightVal) => {
  if (!child?.birthDate) return null;
  const gender = child.gender || (child.id === "시율" ? "여아" : "남아");
  const std = KOREA_GROWTH_STD_2017[gender];
  if (!std) return null;
  const birthMs = new Date(child.birthDate + "T00:00:00").getTime();
  const measMs = new Date((measureDateStr || getTodayStr()) + "T00:00:00").getTime();
  const diffDays = Math.max(0, (measMs - birthMs) / (1000 * 60 * 60 * 24));
  const monthsFloat = Math.min(35, diffDays / 30.4375);
  const hNum = Number(heightVal);
  const wNum = Number(weightVal);
  const bmiVal =
    Number.isFinite(hNum) && hNum > 20 && Number.isFinite(wNum) && wNum > 0
      ? Number((wNum / ((hNum / 100) * (hNum / 100))).toFixed(2))
      : null;
  return {
    gender,
    monthsFloat,
    height: evaluateGrowthMetric(std.height, monthsFloat, heightVal),
    weight: evaluateGrowthMetric(std.weight, monthsFloat, weightVal),
    bmi: std.bmi && bmiVal ? evaluateGrowthMetric(std.bmi, monthsFloat, bmiVal) : null
  };
};


export const getChildAgeStats = (birthStr) => {
  const today = new Date(getTodayStr() + "T00:00:00");
  const birth = new Date(birthStr + "T00:00:00");
  const diffDays = Math.max(0, Math.floor((today - birth) / (1000 * 60 * 60 * 24)));
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  return { days: diffDays + 1, months };
};


export const addMonthsToDateStr = (birthStr, addMonths, addDays = 0) => {
  const d = new Date(birthStr + "T00:00:00");
  const origDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + addMonths);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(origDay, lastDayOfTargetMonth));
  if (addDays !== 0) d.setDate(d.getDate() + addDays);
  return formatDate(d);
};


export const BABY_MILESTONES = [
  {
    id: "m0",
    minM: 0,
    maxM: 0,
    label: "0개월 (신생아 · 생후 1~4주)",
    motor: "원시반사(모로·빨기·잡기 반사)가 뚜렷하며, 엎드려 놓으면 잠깐 고개를 옆으로 돌립니다. 시력은 20~30cm 앞 흐릿한 명암을 구분합니다.",
    language: "울음으로 배고픔·기저귀·불편함을 표현하고, 익숙한 엄마·아빠 목소리에 반응해 움직임을 멈추거나 귀 기울입니다.",
    feedingSleep: "수유 8~12회(2~3시간 간격, 아기가 원할 때 충분히). 하루 16~18시간 수면하며 아직 낮과 밤 구분이 없습니다.",
    tip: "반드시 똑바로 눕혀 재우기(SIDS 영아돌연사증후군 예방). 배꼽이 완전히 떨어져 마를 때까지 통목욕 대신 부분 목욕, 생후 1~2주 내 소아과 체중 증가 확인 및 4주 내 BCG 접종.",
    redFlags: "38°C 이상 발열 시 즉시 소아과 응급 진료, 하루 소변 기저귀 6개 미만 또는 수유를 심하게 거부할 때"
  },
  {
    id: "m1",
    minM: 1,
    maxM: 1,
    label: "1개월 (생후 4~8주)",
    motor: "엎드려 놓으면 고개를 45도 정도 잠깐 들고, 눈앞에서 움직이는 흑백 모빌이나 얼굴을 따라 시선을 천천히 움직입니다.",
    language: "배냇짓 외에 엄마·아빠를 보고 반응하는 초기 미소가 나오기 시작하며, 목 뒤에서 '아~ 우~' 작은 소리를 냅니다.",
    feedingSleep: "1회 수유량이 80~120ml 안팎으로 늘고, 밤에는 3~4시간씩 조금 더 길게 자는 날이 생깁니다. 낮에는 밝게, 밤에는 어둡고 조용하게 낮밤 구분을 시작하세요.",
    tip: "깨어 있을 때 보호자 관찰 하에 하루 몇 분씩 짧은 터미타임(엎드려 놀기)을 시작하면 목 근육과 예쁜 두상 형성에 좋습니다.",
    redFlags: "큰 소리에 전혀 놀라지 않거나, 눈을 마주치지 못하고 시선 추적이 전혀 없을 때"
  },
  {
    id: "m2",
    minM: 2,
    maxM: 2,
    label: "2개월",
    motor: "엎드려서 가슴과 고개를 45~90도까지 들어 올리고 팔다리를 활발히 뻗습니다. 주먹 쥔 손을 조금씩 펴기 시작합니다.",
    language: "눈을 맞추며 환하게 웃는 '사회적 미소'가 뚜렷해지고, '아~ 우~ 꾸~' 옹알이로 어른 말에 대답하듯 반응합니다.",
    feedingSleep: "수유 간격이 3~4시간으로 잡히기 시작하며 1회 100~150ml 정도 먹습니다. 밤잠이 4~6시간 연속으로 늘어날 수 있습니다.",
    tip: "생후 2개월 DTaP·폴리오·Hib·폐렴구균·로타 1차 집중 접종 시기! 접종 당일 밤 미열이 나면 컨디션을 관찰하고 필요시 소아과 안내대로 대처하세요.",
    redFlags: "생후 2개월이 지나도 사회적 미소가 없거나, 손발 움직임이 한쪽만 비대칭적으로 약할 때"
  },
  {
    id: "m3_4",
    minM: 3,
    maxM: 4,
    label: "3~4개월",
    motor: "목 가누기가 완성 단계에 들어가고, 팔꿈치로 지지해 상체를 듭니다. 손을 입으로 가져가 빨며 장난감을 향해 손을 뻗어 쥡니다. 4개월 전후로 뒤집기를 시도합니다.",
    language: "소리 내어 까르르 웃고, 기분 좋을 때 높은 톤의 다양한 옹알이를 하며 어른 표정을 살핍니다.",
    feedingSleep: "수유 텀 3.5~4시간(하루 5~6회, 총 700~900ml 전후), 밤중 수유 횟수가 줄어듭니다. 총 수면 14~16시간이며 일정한 취침 루틴(목욕-수유-재우기)을 잡기 좋은 시기입니다.",
    tip: "뒤집기 시작 전후 침대·소파 낙상 사고가 가장 많으므로 절대 혼자 두지 마세요. 4개월 2차 예방접종 및 생후 4~6개월 1차 영유아 건강검진 시기입니다.",
    redFlags: "만 4개월에도 머리를 전혀 가누지 못하거나, 물건을 보며 손을 뻗지 못할 때"
  },
  {
    id: "m5",
    minM: 5,
    maxM: 5,
    label: "5개월",
    motor: "배에서 등으로, 등에서 배로 자유롭게 뒤집고(뒤집기·되집기), 발을 손으로 잡아 입으로 가져갑니다. 두 손으로 짚고 잠깐 앉아 있을 수 있습니다.",
    language: "거울 속 자신의 모습을 보고 웃으며, 자음과 모음이 섞인 옹알이('마~ 바~ 다~')를 시작합니다.",
    feedingSleep: "하루 14~15시간 수면(낮잠 2~3회). 이유식 준비 신호(목을 완전히 가누고, 어른 먹는 음식에 입을 오물거리며 관심을 보임)가 나타납니다.",
    tip: "아직은 모유·분유만으로 영양이 충분합니다. 만 6개월 이유식 시작을 위해 아기 식탁 의자에 잠시 앉는 연습과 이유식 숟가락·턱받이 준비를 해두세요.",
    redFlags: "뒤집기 시도가 전혀 없거나, 앉혀주었을 때 몸이 심하게 한쪽으로 쏠릴 때"
  },
  {
    id: "m6",
    minM: 6,
    maxM: 6,
    label: "6개월 (이유식 시작!)",
    motor: "허리를 세워 양손을 짚고 앉거나 잠시 혼자 앉고, 손에 쥔 물건을 반대쪽 손으로 옮깁니다. 배밀이를 시작하는 아기도 있습니다.",
    language: "자기 이름을 부르면 고개를 돌려 반응하고, 엄마·아빠의 말투(기쁨·단호함)를 구별합니다.",
    feedingSleep: "모유수유·분유수유 모두 만 6개월에 이유식을 시작합니다(삐뽀삐뽀 119 기준). 너무 묽은 미음만 고집하지 말고 부드럽게 으깬 질감으로 시작해, 철분 보충을 위해 초기부터 쇠고기를 일찍 포함하세요.",
    tip: "새 식재료는 2~3일 간격으로 오전에 1가지씩 테스트해 알레르기 반응을 살피세요. 6개월 3차 접종 + 생후 첫 독감(인플루엔자 1·2차) 접종 시기입니다.",
    redFlags: "이름이나 큰 소리에 반응이 없고, 눈 맞춤·옹알이가 눈에 띄게 줄었을 때"
  },
  {
    id: "m7_8",
    minM: 7,
    maxM: 8,
    label: "7~8개월 (이유식 중기)",
    motor: "손을 짚지 않고 안정적으로 혼자 앉아 양손으로 장난감을 가지고 놉니다. 배밀이에서 네발기기로 넘어가며, 손가락으로 작은 알갱이를 집으려 합니다.",
    language: "낯가림과 분리불안이 뚜렷해지며 '까꿍놀이'에 크게 반응합니다. '안돼' 같은 짧은 억양을 알아듣습니다.",
    feedingSleep: "이유식 하루 2회(중기, 굵은 입자·부드러운 덩어리감) + 수유 3~4회. 빨대컵이나 오픈컵으로 물 마시는 연습을 시작해 두면 추후 젖병 떼기가 훨씬 수월합니다.",
    tip: "기어 다니기 시작하므로 전선·콘센트 커버·모서리 보호대·서랍 잠금장치를 꼭 설치하세요. 컵으로 물과 우유 마시기를 조금씩 친숙하게 해 주세요.",
    redFlags: "만 8개월이 지나도 도움 없이 혼자 앉지 못하거나 양손으로 물건을 쥐지 못할 때"
  },
  {
    id: "m9_10",
    minM: 9,
    maxM: 10,
    label: "9~10개월 (이유식 후기)",
    motor: "네발기기로 빠르게 이동하고, 가구나 침대 난간을 붙잡고 스스로 일어섭니다. 엄지와 검지를 이용해 작은 과자나 음식 조각을 집습니다(집게 잡기).",
    language: "'엄마', '아빠' 같은 소리를 반복하고, '빠이빠이·짝짝꿍' 같은 손짓을 따라 하며 원하는 것을 손가락으로 가리키려 합니다.",
    feedingSleep: "이유식 하루 3회(후기, 진밥·무른 반찬 형태) + 수유 2~3회. 부드러운 핑거푸드(삶은 당근·두부 등)로 스스로 집어 먹는 연습을 시키고, 밤중 수유는 완전히 떼는 것이 좋습니다.",
    tip: "생후 9~12개월 3차 영유아 건강검진(한국 영유아 발달선별검사 K-DST 시작) 시기입니다. 치아가 나면 거즈·실리콘 칫솔로 하루 2회 양치해 주세요.",
    redFlags: "까꿍·빠이빠이 같은 상호작용 반응이 없거나, 붙잡고 서려는 시도가 전혀 없을 때"
  },
  {
    id: "m11_12",
    minM: 11,
    maxM: 12,
    label: "11~12개월 (돌 · 유아식 전환)",
    motor: "가구를 잡고 옆으로 걸으며(게걸음), 혼자 잠시 서거나 첫 걸음마를 뗍니다. 컵을 두 손으로 잡고 마시려 합니다.",
    language: "의미 있는 첫 단어('엄마', '아빠', '물' 등 1~3개)를 말하고, 원하는 것을 손가락으로 정확히 가리킵니다(포인팅). '주세요', '안녕' 지시에 반응합니다.",
    feedingSleep: "완료기 이유식에서 어른 식사와 비슷한 부드러운 유아식(하루 3끼 + 간식 1~2회)으로 넘어갑니다. 돌이 지나면 분유 대신 생우유(멸균우유 포함)를 컵으로 마시며 젖병을 줄여나가세요.",
    tip: "돌(12개월)은 MMR·수두·A형간염·폐렴구균/Hib 추가 등 접종이 몰리는 시기입니다. 돌아다니며 먹이지 말고 반드시 아기 식탁 의자에서만 먹이는 습관을 들이세요.",
    redFlags: "돌이 지났는데도 옹알이·포인팅(가리키기)이 없거나 이름 불러도 눈을 잘 안 맞출 때"
  },
  {
    id: "m13_15",
    minM: 13,
    maxM: 15,
    label: "13~15개월 (아장아장 걸음마)",
    motor: "혼자 안정적으로 걷고, 낮은 턱이나 계단을 기어오릅니다. 블록 2~3개를 쌓고 크레파스로 선을 끄적입니다. 스스로 숟가락질을 시도합니다.",
    language: "의미 있는 단어 5~15개 정도를 말하며, '신발 가져와', '공 줘' 같은 간단한 한 단계 지시를 이해하고 따릅니다.",
    feedingSleep: "유아식 3끼 + 건강한 간식(과일·치즈·우유). 낮잠은 하루 1~2회, 밤잠 10~11시간. 젖병을 아직 쓰고 있다면 18개월 전 졸업을 목표로 컵 사용으로 서서히 대체하세요(치아·고집 예방).",
    tip: "식사 시간은 20~30분 내외로 정하고, 먹기 싫다고 돌아다닐 때 쫓아가며 떠먹이지 않는 것이 바른 식습관의 핵심입니다(하정훈 원장 강조 포인트). 15개월 DTaP 4차·폐렴·Hib 접종 시기.",
    redFlags: "15개월 이후에도 붙잡고 걷거나 혼자 걷는 시도가 전혀 없을 때"
  },
  {
    id: "m16_18",
    minM: 16,
    maxM: 18,
    label: "16~18개월 (자아·고집 표현)",
    motor: "빠르게 걷거나 뛰기를 시도하고 공을 앞으로 찹니다. 숟가락·컵 사용이 한결 능숙해지고, 옷 벗기를 도와줄 수 있습니다.",
    language: "어휘가 20~50개로 늘고 '엄마 물', '아빠 까까'처럼 두 단어 조합을 시작합니다. '아니야·싫어' 같은 고집과 자기주장이 분명해집니다.",
    feedingSleep: "낮잠이 하루 1회(1.5~2시간)로 완전히 정착합니다. 18개월 전후로 젖병은 완전히 끊고 컵으로만 마시게 하는 것이 충치와 편식·고집 예방에 좋습니다.",
    tip: "18개월 영유아 4차 건강검진 + 생애 첫 무료 구강검진 시기! 떼쓸 때는 감정적으로 혼내기보다 위험한 행동만 짧고 단호하게 '안돼'라고 알려주고, 잘한 행동에 크게 칭찬해 주세요.",
    redFlags: "만 18개월에 혼자 걷지 못하거나, 의미 있는 단어가 6개 미만이면서 포인팅·모방이 없을 때"
  },
  {
    id: "m19_24",
    minM: 19,
    maxM: 24,
    label: "19~24개월 (두 돌 준비)",
    motor: "손잡이나 난간을 잡고 계단을 오르내리고, 두 발을 모아 제자리에서 점프를 시도합니다. 블록 4~6개를 쌓고 책장을 한 장씩 넘깁니다.",
    language: "2~3단어 문장('엄마 밥 줘', '시율이 코 자')을 말하고, 눈·코·입 등 신체 부위를 가리킵니다. 인형에게 밥을 먹여주는 역할놀이를 즐깁니다.",
    feedingSleep: "규칙적인 3끼 유아식과 간식. 두 돌 전후로 대소변 의사를 표현하는 등 배변 훈련 준비 신호가 나타나지만, 조급하게 강요하지 말고 아이가 관심을 보일 때 천천히 시작하세요.",
    tip: "24개월 일본뇌염 2차·A형간염 2차(6개월 간격 확인) 및 영유아 5차 건강검진(24~30개월) 준비! 하루 15분 이상 그림책 읽어주기가 언어·뇌 발달에 최고입니다.",
    redFlags: "두 돌(24개월) 무렵 두 단어 연결 말이 전혀 안 되거나, 또래·가족과 시선·상호작용을 피할 때"
  }
];


export const BABY_VACCINES_AND_CHECKUPS = [
  { id: "vac-hepb1", type: "필수접종", title: "B형간염 1차", addMonths: 0, addDays: 0, note: "출생 직후 접종" },
  { id: "vac-bcg", type: "필수접종", title: "결핵(BCG) 피내용/경피용", addMonths: 0, addDays: 21, note: "생후 4주 이내 접종" },
  { id: "chk-1", type: "영유아검진", title: "1차 영유아 건강검진", addMonths: 0, addDays: 20, note: "생후 14~35일 무료 검진" },
  { id: "vac-hepb2", type: "필수접종", title: "B형간염 2차", addMonths: 1, addDays: 0, note: "생후 1개월" },
  { id: "vac-2m-combo", type: "필수접종", title: "생후 2개월 필수 (DTaP·폴리오·Hib·폐렴구균 1차 + 로타 1차)", addMonths: 2, addDays: 0, note: "로타바이러스는 생후 14주 6일 이전 1차 필수" },
  { id: "vac-4m-combo", type: "필수접종", title: "생후 4개월 필수 (DTaP·폴리오·Hib·폐렴구균·로타 2차)", addMonths: 4, addDays: 0, note: "생후 4개월 집중 접종" },
  { id: "chk-2", type: "영유아검진", title: "2차 영유아 건강검진", addMonths: 4, addDays: 15, note: "생후 4~6개월 무료 검진" },
  { id: "vac-6m-combo", type: "필수접종", title: "생후 6개월 필수 (B형간염 3차 · DTaP·폴리오·Hib·폐렴구균 3차)", addMonths: 6, addDays: 0, note: "인플루엔자(독감) 1·2차 접종 시작 가능" },
  { id: "chk-3", type: "영유아검진", title: "3차 영유아 건강검진 (발달선별 시작)", addMonths: 9, addDays: 15, note: "생후 9~12개월 무료 검진" },
  { id: "vac-12m-mmr", type: "필수접종", title: "12개월 필수 (MMR 1차 · 수두 · 폐렴구균 4차 · Hib 4차)", addMonths: 12, addDays: 0, note: "돌 접종 (2회 나누어 접종 권장)" },
  { id: "vac-12m-hepa1", type: "필수접종", title: "A형간염 1차 · 일본뇌염 1차", addMonths: 12, addDays: 14, note: "12~23개월 사이 접종" },
  { id: "vac-opt-men", type: "선택접종", title: "수막구균 백신 (선택)", addMonths: 12, addDays: 20, note: "어린이집 단체생활 시 소아과 상담 후 선택" },
  { id: "vac-15m-dtap4", type: "필수접종", title: "DTaP 4차 (생후 15~18개월)", addMonths: 15, addDays: 0, note: "15~18개월 필수 접종" },
  { id: "vac-18m-hepa2", type: "필수접종", title: "A형간염 2차", addMonths: 18, addDays: 14, note: "1차 접종 후 6개월 뒤" },
  { id: "chk-4", type: "영유아검진", title: "4차 영유아 건강검진 + 구강검진", addMonths: 18, addDays: 15, note: "생후 18~24개월 (구강검진 18~29개월)" },
  { id: "vac-24m-je2", type: "필수접종", title: "일본뇌염 2차", addMonths: 24, addDays: 14, note: "1차 접종 12개월 후" },
  { id: "chk-5", type: "영유아검진", title: "5차 영유아 건강검진 + 구강검진", addMonths: 30, addDays: 15, note: "생후 30~36개월" }
];


export const SHINDANG_NOV_DATA = [
  { date: "2026-11-02", mSnack: "배, 우유", lunch: "잡곡밥, 유부맑은국, 돼지고기두루치기, 얼갈이나물, 김치, 후식 까망베르치즈케이크", aSnack: "감자튀김, 차", cal: "414kcal / 단백질 17g" },
  { date: "2026-11-03", mSnack: "파프리카죽", lunch: "쌀밥, 청경채된장국, 동태전, 콩나물당근무침, 김치, 후식 단감", aSnack: "단팥빵, 우유", cal: "482kcal / 단백질 20g" },
  { date: "2026-11-04", mSnack: "단호박죽", lunch: "잡곡밥, 설렁탕, 메추리알장조림(두부조림), 참나물무침, 김치, 후식 감귤", aSnack: "핫도그, 우유", cal: "485kcal / 단백질 20g" },
  { date: "2026-11-05", mSnack: "바나나, 우유", lunch: "닭살채소볶음밥, 뭇국, 어묵조림, 고사리나물, 김치, 후식 치즈볼", aSnack: "찐감자, 차", cal: "428kcal / 단백질 17g" },
  { date: "2026-11-06", mSnack: "배추죽", lunch: "잡곡밥, 근대된장국, 비엔나소시지구이, 김구이, 김치, 후식 사과", aSnack: "소금빵, 우유", cal: "471kcal / 단백질 15g" },
  { date: "2026-11-07", mSnack: "시리얼, 우유", lunch: "칼국수, 김치", aSnack: "과일샐러드", cal: "393kcal / 단백질 12g" },
  { date: "2026-11-09", mSnack: "방울토마토, 저염치즈", lunch: "쌀밥, 호박맑은국, 훈제오리구이, 취나물무침, 김치, 후식 배", aSnack: "비빔국수", cal: "496kcal / 단백질 20g" },
  { date: "2026-11-10", mSnack: "녹두죽", lunch: "잡곡밥, 우거지된장국, 명태살조림, 연근들깨무침, 김치", aSnack: "완두앙금빵, 우유", cal: "550kcal / 단백질 28g" },
  { date: "2026-11-11", mSnack: "청경채죽", lunch: "쌀밥, 미역국, 쇠불고기, 유채나물, 김치, 후식 샤인머스켓", aSnack: "배추전, 요구르트", cal: "426kcal / 단백질 15g" },
  { date: "2026-11-12", mSnack: "감귤, 우유", lunch: "돼지고기자장밥, 팽이버섯맑은국, 상추나물, 연두부+양념장, 김치, 후식 미니약과", aSnack: "찐고구마, 차", cal: "447kcal / 단백질 19g" },
  { date: "2026-11-13", mSnack: "브로콜리죽", lunch: "쌀밥, 아욱된장국, 찜닭, 무생채, 김치, 후식 단감", aSnack: "잼샌드위치, 우유", cal: "475kcal / 단백질 17g" },
  { date: "2026-11-14", mSnack: "우유+미숫가루", lunch: "베이컨크림리조또, 맑은장국, 김치", aSnack: "삶은달걀(쌀과자), 차", cal: "374kcal / 단백질 16g" },
  { date: "2026-11-16", mSnack: "사과, 우유", lunch: "잡곡밥, 들깨시래기국, 닭다리살구이, 가지나물, 김치, 후식 맛밤", aSnack: "유부초밥, 차", cal: "474kcal / 단백질 18g" },
  { date: "2026-11-17", mSnack: "당근죽", lunch: "쌀밥, 부추된장국, 생선까스+타르타르소스, 어린잎샐러드+유자청드레싱, 김치, 후식 골드키위", aSnack: "모닝빵, 우유", cal: "509kcal / 단백질 19g" },
  { date: "2026-11-18", mSnack: "양배추죽", lunch: "잡곡밥, 콩비지국, 채소달걀찜(연두부+양념장), 버섯볶음, 김치, 후식 감귤", aSnack: "토마토스파게티", cal: "466kcal / 단백질 15g" },
  { date: "2026-11-19", mSnack: "단감, 우유", lunch: "쇠고기무밥+양념장, 미소장국, 콩나물무침, 세발나물무침, 김치, 후식 베이비슈", aSnack: "찐단호박, 차", cal: "403kcal / 단백질 18g" },
  { date: "2026-11-20", mSnack: "누룽지죽", lunch: "잡곡밥, 북엇국, 돼지고기수육, 시금치나물, 김치, 후식 배", aSnack: "카스테라, 우유", cal: "464kcal / 단백질 20g" },
  { date: "2026-11-21", mSnack: "시리얼, 우유", lunch: "만둣국, 미니밥, 김치", aSnack: "과일샐러드", cal: "321kcal / 단백질 11g" },
  { date: "2026-11-23", mSnack: "방울토마토, 저염치즈", lunch: "쌀밥, 감자양파국, 닭튀김, 열무나물, 김치, 후식 바나나", aSnack: "참치주먹밥", cal: "461kcal / 단백질 15g" },
  { date: "2026-11-24", mSnack: "무죽", lunch: "잡곡밥, 새송이버섯된장국, 가자미구이, 봄동오이무침, 김치", aSnack: "시리얼, 우유", cal: "448kcal / 단백질 19g" },
  { date: "2026-11-25", mSnack: "채소죽", lunch: "쌀밥, 콩나물국, 돼지고기목살볶음, 청경채나물, 김치, 후식 고구마디저트케이크", aSnack: "수제바나나우유, 크래커", cal: "449kcal / 단백질 15g" },
  { date: "2026-11-26", mSnack: "배, 우유", lunch: "닭살카레라이스, 배추된장국, 잔멸치볶음, 파프리카무침, 김치, 후식 7곡딸기롤", aSnack: "고구마맛탕, 차", cal: "480kcal / 단백질 19g" },
  { date: "2026-11-27", mSnack: "근대죽", lunch: "잡곡밥, 숭늉, 돈육피망잡채+꽃빵, 브로콜리호박볶음, 김치, 후식 사과", aSnack: "방식빵, 우유+초록딸기", cal: "525kcal / 단백질 17g" },
  { date: "2026-11-28", mSnack: "우유+미숫가루", lunch: "치즈김밥, 가쓰오장국, 김치", aSnack: "구운달걀(쌀과자), 차", cal: "408kcal / 단백질 17g" },
  { date: "2026-11-30", mSnack: "사과, 우유", lunch: "잡곡밥, 어묵쑥갓국, 두부구이+양념장, 우엉조림, 김치, 후식 쌀과자", aSnack: "치킨너겟, 차", cal: "468kcal / 단백질 18g" }
];


export const buildDaycareMeals = () => {
  const list = [];
  SHINDANG_NOV_DATA.forEach((d) => {
    list.push({
      id: `dc-${d.date}-ms`,
      date: d.date,
      slot: "오전간식",
      menu: `[어린이집 오전간식] ${d.mSnack}`,
      members: ["시목"],
      ingredients: [],
      note: `신당동어린이집 11월 식단표 (${d.cal})`,
      sourceType: "어린이집 급식",
      cost: 0
    });
    list.push({
      id: `dc-${d.date}-lc`,
      date: d.date,
      slot: "점심",
      menu: `[어린이집 점심] ${d.lunch}`,
      members: ["시목"],
      ingredients: [],
      note: `신당동어린이집 11월 식단표 (${d.cal})`,
      sourceType: "어린이집 급식",
      cost: 0
    });
    list.push({
      id: `dc-${d.date}-as`,
      date: d.date,
      slot: "오후간식",
      menu: `[어린이집 오후간식] ${d.aSnack}`,
      members: ["시목"],
      ingredients: [],
      note: `신당동어린이집 11월 식단표 (${d.cal})`,
      sourceType: "어린이집 급식",
      cost: 0
    });
  });
  return list;
};


export const INITIAL_SHOPPING = [
  { id: "sh-1", name: "상하목장 유기농 우유 900ml", quantity: "2팩", category: "유제품/계란", urgent: true, checked: false, memo: "시목이 간식 우유" },
  { id: "sh-2", name: "유기농 애호박 & 당근", quantity: "각 2개", category: "채소/과일", urgent: false, checked: false, memo: "시율이 이유식 큐브용" }
];


export const INITIAL_NOTICES = [
  { id: "nt-1", title: "시목이 어린이집 낮잠이불 세탁해서 보내기", content: "월요일 등원할 때 깨끗한 낮잠이불 챙겨서 보내야 함!", category: "육아/아이들", author: "최아리나", pinned: true, done: false, createdAt: "2026-11-15" },
  { id: "nt-2", title: "시율이 신생아 B형간염 2차 예방접종 확인", content: "소아과 예약 시간 및 아기수첩 챙기기", category: "육아/아이들", author: "김수혁", pinned: true, done: false, createdAt: "2026-11-15" }
];


export const PAGE_EMOJI_PRESETS = [
  "📄", "✈️", "💼", "✅", "👶", "🍼", "😴", "👓",
  "🎒", "🧳", "🏠", "🎁", "🏥", "📝", "💡", "🌟",
  "🧸", "🍽️", "🛒", "📌", "💊", "🎀", "🏖️", "🚗"
];

export const PAGE_HEADING_COLORS = [
  { id: "amber", label: "노랑", badge: "bg-amber-100/90 text-amber-800", dot: "bg-amber-400" },
  { id: "emerald", label: "초록", badge: "bg-emerald-100/90 text-emerald-800", dot: "bg-emerald-500" },
  { id: "sky", label: "파랑", badge: "bg-sky-100/90 text-sky-800", dot: "bg-sky-500" },
  { id: "rose", label: "분홍", badge: "bg-rose-100/90 text-rose-800", dot: "bg-rose-400" },
  { id: "none", label: "기본", badge: "bg-transparent text-stone-900 px-0", dot: "bg-stone-400" }
];


const splitMarkdownTableRow = (line) => {
  let s = String(line || "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
};

const isMarkdownTableSeparator = (line) => {
  const s = String(line || "").trim();
  if (!s.includes("|") || !s.includes("-")) return false;
  const cells = splitMarkdownTableRow(s);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
};

export const parseNotionMarkdownToBlocks = (rawText, defaultHeadingColor = "amber") => {
  const lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const baseMs = Date.now();
  let seq = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    const expanded = rawLine.replace(/\t/g, "    ");
    const leadingSpaces = (expanded.match(/^ */)?.[0] || "").length;
    const indent = Math.min(3, Math.floor(leadingSpaces / 2) >= 2 ? Math.floor(leadingSpaces / 4) || 1 : 0);
    const trimmed = expanded.trim();

    // 0. Markdown Pipe Table: | col1 | col2 | followed by | --- | --- |
    if (trimmed.includes("|") && i + 1 < lines.length && isMarkdownTableSeparator(lines[i + 1])) {
      const headers = splitMarkdownTableRow(trimmed);
      const rows = [];
      i += 2; // skip header & separator
      while (i < lines.length) {
        const rowTrimmed = lines[i].trim();
        if (!rowTrimmed || !rowTrimmed.includes("|")) {
          i -= 1;
          break;
        }
        const cells = splitMarkdownTableRow(rowTrimmed);
        while (cells.length < headers.length) cells.push("");
        rows.push(cells.slice(0, headers.length));
        i++;
      }
      // If the immediately preceding block was a bullet item (- 제목), promote it to a highlighted bullet heading!
      if (blocks.length > 0) {
        const prev = blocks[blocks.length - 1];
        if (prev.type === "text" && prev.text.startsWith("• ")) {
          blocks[blocks.length - 1] = {
            id: prev.id,
            type: "heading",
            isBullet: true,
            text: prev.text.slice(2).trim(),
            color: defaultHeadingColor || "amber"
          };
        }
      }
      blocks.push({
        id: `mdtbl-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
        type: "md_table",
        headers,
        rows
      });
      continue;
    }

    // 1. Heading: # / ## / ###
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        id: `blk-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
        type: "heading",
        text: headingMatch[1].trim(),
        color: defaultHeadingColor || "amber"
      });
      continue;
    }

    // 2. Markdown checkbox: - [x] / - [ ] / * [x] / ☑ / ☐
    const todoMatch = trimmed.match(/^(?:[-*+]\s*)?\[([ xX✓✔])\]\s+(.+)$/);
    if (todoMatch) {
      blocks.push({
        id: `blk-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
        type: "todo",
        text: todoMatch[2].trim(),
        checked: todoMatch[1] !== " ",
        ...(indent > 0 ? { indent } : {})
      });
      continue;
    }

    const symTodoMatch = trimmed.match(/^([☑✅☐⬜])\s+(.+)$/);
    if (symTodoMatch) {
      blocks.push({
        id: `blk-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
        type: "todo",
        text: symTodoMatch[2].trim(),
        checked: symTodoMatch[1] === "☑" || symTodoMatch[1] === "✅",
        ...(indent > 0 ? { indent } : {})
      });
      continue;
    }

    // 3. Bullet item (- text / * text)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        id: `blk-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
        type: "text",
        text: `• ${bulletMatch[1].trim()}`,
        ...(indent > 0 ? { indent } : {})
      });
      continue;
    }

    // 4. Plain text
    blocks.push({
      id: `blk-${baseMs}-${seq++}-${Math.random().toString(36).slice(2, 5)}`,
      type: "text",
      text: trimmed,
      ...(indent > 0 ? { indent } : {})
    });
  }
  return blocks;
};


export const PAGE_COVER_COLORS = [
  { id: "none", label: "없음", bg: "", dot: "bg-stone-200 border border-stone-300" },
  { id: "peach", label: "피치", bg: "bg-[#FCECE0]", dot: "bg-[#F5CBA7]" },
  { id: "sage", label: "세이지", bg: "bg-[#E7F1E8]", dot: "bg-[#A9CCA8]" },
  { id: "sky", label: "스카이", bg: "bg-[#E6F1FB]", dot: "bg-[#93C5FD]" },
  { id: "lavender", label: "라벤더", bg: "bg-[#F1ECFA]", dot: "bg-[#C4B5FD]" }
];

export const PAGE_TABLE_PRIORITIES = [
  { id: "", label: "없음", badge: "text-stone-300 hover:bg-stone-100" },
  { id: "High", label: "High", badge: "bg-[#FBE4E4] text-[#B9382C]" },
  { id: "Medium", label: "Medium", badge: "bg-[#FBF3DB] text-[#9A6700]" },
  { id: "Low", label: "Low", badge: "bg-[#E7F3F8] text-[#236B8E]" }
];

export const blocksToNotionMarkdown = (blocks = []) => {
  const lines = [];
  (Array.isArray(blocks) ? blocks : []).forEach((b) => {
    if (!b || b.type === "table") return;
    const pad = "    ".repeat(Math.min(3, Number(b.indent) || 0));
    if (b.type === "md_table") {
      const headers = Array.isArray(b.headers) ? b.headers : [];
      const rows = Array.isArray(b.rows) ? b.rows : [];
      if (headers.length > 0) {
        if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
        lines.push(`| ${headers.join(" | ")} |`);
        lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
        rows.forEach((r) => {
          const cells = Array.isArray(r) ? r : [];
          lines.push(`| ${headers.map((_, idx) => cells[idx] ?? "").join(" | ")} |`);
        });
        lines.push("");
      }
    } else if (b.type === "heading") {
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      if (b.isBullet) {
        lines.push(`- ${b.text || ""}`);
      } else {
        lines.push(`### ${b.text || ""}`);
      }
      lines.push("");
    } else if (b.type === "todo") {
      lines.push(`${pad}- [${b.checked ? "x" : " "}] ${b.text || ""}`);
    } else {
      const rawTxt = String(b.text || "");
      lines.push(`${pad}${rawTxt.startsWith("• ") ? `- ${rawTxt.slice(2)}` : rawTxt}`);
    }
  });
  return lines.join("\n").trim();
};


export const PAGE_TEXT_SIZES = [
  { id: "sm", label: "작게", cls: "text-[12.5px]" },
  { id: "base", label: "보통", cls: "text-[14.5px]" },
  { id: "lg", label: "크게", cls: "text-[17px]" },
  { id: "xl", label: "특대", cls: "text-[20px]" }
];

export const PAGE_TEXT_COLORS = [
  { id: "default", label: "기본", cls: "text-stone-800", dot: "bg-stone-800" },
  { id: "rose", label: "빨강", cls: "text-rose-600", dot: "bg-rose-500" },
  { id: "sky", label: "파랑", cls: "text-[#2383E2]", dot: "bg-[#2383E2]" },
  { id: "emerald", label: "초록", cls: "text-emerald-700", dot: "bg-emerald-600" },
  { id: "amber", label: "주황", cls: "text-amber-700", dot: "bg-amber-500" },
  { id: "violet", label: "보라", cls: "text-violet-700", dot: "bg-violet-500" },
  { id: "muted", label: "회색", cls: "text-stone-400", dot: "bg-stone-400" }
];

export const PAGE_TEXT_BG_COLORS = [
  { id: "none", label: "없음", cls: "", dot: "bg-white border border-stone-300" },
  { id: "amber", label: "노랑", cls: "bg-amber-100/85 px-1.5 py-0.5 rounded-md", dot: "bg-amber-200" },
  { id: "emerald", label: "초록", cls: "bg-emerald-100/85 px-1.5 py-0.5 rounded-md", dot: "bg-emerald-200" },
  { id: "sky", label: "파랑", cls: "bg-sky-100/85 px-1.5 py-0.5 rounded-md", dot: "bg-sky-200" },
  { id: "rose", label: "분홍", cls: "bg-rose-100/85 px-1.5 py-0.5 rounded-md", dot: "bg-rose-200" }
];

export const INITIAL_BABY_DREAM_LINKS = [
  { id: "dream-1", label: "아소리", icon: "🗣️", url: "https://youtu.be/hdT6CodrB8w?si=T81I1wKCV8L7_iOV" },
  { id: "dream-2", label: "종이소리", icon: "📄", url: "https://youtu.be/itxHiMlWeBU?si=FWrEhrz74zYNGypW" },
  { id: "dream-3", label: "자장가", icon: "🎵", url: "https://youtu.be/OzhsoSo-4dU?feature=shared" },
  { id: "dream-4", label: "쉬소리", icon: "🤫", url: "https://youtu.be/-X_rCJFIx38?feature=shared" }
];

export const BABY_DREAM_ICON_PRESETS = ["🗣️", "📄", "🎵", "🤫", "🌊", "🌧️", "🚗", "🌙", "🧸", "💤"];
export const HOUSE_STORAGE_ROOMS = ["거실", "안방", "아이방", "주방", "현관·베란다", "기타"];
export const HOUSE_MEDICINE_TARGETS = ["공통", "시목", "시율", "어른"];

export const DEFAULT_CONDOLENCE_PIN = "247233";
export const CONDOLENCE_CATEGORIES = [
  "결혼식",
  "장례식/조의",
  "돌잔치",
  "출산/백일",
  "생일/기념일",
  "명절/용돈",
  "승진/개업",
  "기타"
];
export const CONDOLENCE_GROUPS = [
  "가족/친척",
  "처가/친정",
  "직장/동료",
  "친구/지인",
  "이웃/어린이집",
  "기타"
];
export const CONDOLENCE_PAY_METHODS = ["계좌이체", "현금", "선물/기프티콘"];


export const DEFAULT_BABY_MEMO_TAGS = ["트림 안함", "트림 함", "유산균", "잘 먹음", "게워냄"];
export const DEFAULT_SHOPPING_PRESETS = [
  "계란|1판|유제품/계란",
  "우유|1팩|유제품/계란",
  "두부|1모|반찬/김치",
  "대파|1단|채소/과일",
  "양파|1망|채소/과일",
  "바나나|1송이|채소/과일"
];

export const DEFAULT_BABY_HEALTH_TAGS = ["미열", "고열", "콧물", "기침", "소아과", "해열제"];

export const DEFAULT_SCHEDULE_PLACES = ["이진소아과", "신당동어린이집", "친정", "시댁", "마트"];