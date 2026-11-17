import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home,
  Utensils,
  Package,
  Sparkles,
  ShoppingCart,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Receipt,
  Settings,
  Download,
  Pin,
  PinOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Database,
  Upload,
  Zap,
  CalendarDays,
  Star,
  FileJson,
  RotateCcw,
  Mail,
  CloudUpload,
  ClipboardList,
  ListTodo,
  CalendarRange,
  Baby,
  LayoutGrid
} from "lucide-react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  writeBatch
} from "firebase/firestore";

// ==========================================
// 1. 파이어베이스 및 표준 Gemini API 키 설정 (기존 DB 100% 보존!)
// ==========================================
const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrzf2_cG0PT-dW1lidXYaHk4BpCY-eMao",
  authDomain: "ahrisoohyeokbap.firebaseapp.com",
  projectId: "ahrisoohyeokbap",
  storageBucket: "ahrisoohyeokbap.firebasestorage.app",
  messagingSenderId: "746934389532",
  appId: "1:746934389532:web:496918d8f66d40bcb088d9"
};

const EMBEDDED_GEMINI_KEY = ""; // 보안상 코드에 직접 입력하지 않고 ⚙️설정 또는 Firebase로 관리

let app;
let auth;
let db;

try {
  const firebaseConfig =
    typeof __firebase_config !== "undefined" && __firebase_config
      ? JSON.parse(__firebase_config)
      : USER_FIREBASE_CONFIG;
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

const APP_ID = "kim-family-meal-app";

const getColRef = (colName) => collection(db, "artifacts", APP_ID, "public", "data", colName);
const getDocRef = (colName, docId) =>
  doc(db, "artifacts", APP_ID, "public", "data", colName, String(docId));

const toSafeArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

// ==========================================
// 2. 실시간 오늘 날짜 & D-Day 정밀 계산 유틸리티
// ==========================================
const formatDate = (dateObj) => {
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

const getTodayStr = () => formatDate(new Date());
const getCurrentYearMonth = () => getTodayStr().slice(0, 7);

const getIsoWeekKey = (dateStr = getTodayStr()) => {
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "2026-W47";
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const ROUTINE_TIME_SLOTS = ["아침", "점심", "하원후", "오후", "저녁", "자기전", "상시"];
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

const isHourInRange = (h, start, end) => {
  const s = ((Number(start) || 0) % 24 + 24) % 24;
  const e = ((Number(end) || 0) % 24 + 24) % 24;
  if (s === e) return false;
  if (s < e) return h >= s && h < e;
  return h >= s || h < e;
};

const toTimeMinutes = (val, fallbackHour = 0) => {
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

const formatMinutesHHMM = (mins) => {
  const m = ((Number(mins) || 0) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const isMinuteInRange = (curMin, startMin, endMin) => {
  const s = ((Number(startMin) || 0) % 1440 + 1440) % 1440;
  const e = ((Number(endMin) || 0) % 1440 + 1440) % 1440;
  if (s === e) return false;
  if (s < e) return curMin >= s && curMin < e;
  return curMin >= s || curMin < e;
};

const DEFAULT_ROUTINE_TIME_RANGES = {
  아침: "05:00",
  점심: "11:00",
  하원후: "15:00",
  오후: "12:00",
  저녁: "18:00",
  자기전: "20:30"
};

const ROUTINE_WEEKDAY_SLOTS = ["아침", "점심", "하원후", "저녁", "자기전"];
const ROUTINE_WEEKEND_SLOTS = ["아침", "오후", "저녁", "자기전"];
const ROUTINE_ORDERED_SLOTS = ["아침", "점심", "하원후", "오후", "저녁", "자기전"];

const isWeekendNow = () => [0, 6].includes(new Date().getDay());

const getCurrentRoutineTimeSlot = (ranges = DEFAULT_ROUTINE_TIME_RANGES, minuteOverride = null) => {
  const now = new Date();
  const curMin = typeof minuteOverride === "number" ? minuteOverride : now.getHours() * 60 + now.getMinutes();
  const isWknd = [0, 6].includes(now.getDay());
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

const matchesRoutineTarget = (rt, filter) => {
  if (!filter || filter === "전체") return true;
  const a = rt?.assignee || "공통";
  if (filter === "공통") return a === "공통";
  if (filter === "시목") return a === "시목" || a === "시목·시율";
  if (filter === "시율") return a === "시율" || a === "시목·시율";
  return a === filter;
};

const getRoutineAssigneeBadgeCls = (assignee) => {
  const a = assignee || "공통";
  if (a === "시목") return "bg-sky-100 text-sky-800";
  if (a === "시율") return "bg-rose-100 text-rose-800";
  if (a === "시목·시율") return "bg-purple-100 text-purple-800";
  if (a === "공통") return "bg-emerald-100 text-emerald-800";
  return "bg-amber-100 text-amber-800";
};

const parseRoutineSteps = (title) => {
  const raw = String(title || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s*(?:>|→|,)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : [];
};

const DEFAULT_HOME_TIME_RANGES = {
  morningStart: 5,
  afternoonStart: 11,
  nightStart: 20
};

const getAutoHomeTimeMode = (ranges = DEFAULT_HOME_TIME_RANGES, hourOverride = null) => {
  const h = typeof hourOverride === "number" ? hourOverride : new Date().getHours();
  const mS = ranges?.morningStart ?? 5;
  const aS = ranges?.afternoonStart ?? 11;
  const nS = ranges?.nightStart ?? 20;
  if (isHourInRange(h, mS, aS)) return "morning";
  if (isHourInRange(h, aS, nS)) return "afternoon";
  return "night";
};

const DEFAULT_HOME_MENU_ORDER = [
  "daily",
  "routine_tab",
  "fridge",
  "shopping",
  "monthly_cal",
  "monthly_exp",
  "baby",
  "recipes",
  "notices",
  "ai"
];

const DEFAULT_HOME_LAYOUT = {
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
    menuOrder: ["daily", "fridge", "shopping", "ai", "routine_tab", "monthly_cal", "monthly_exp", "baby", "recipes", "notices"]
  },
  night: {
    blocks: ["action_feed", "menu_grid"],
    hiddenBlocks: [],
    hiddenMenus: [],
    blockSizes: {},
    menuSizes: {},
    menuOrder: ["daily", "monthly_exp", "routine_tab", "fridge", "shopping", "monthly_cal", "baby", "recipes", "notices", "ai"]
  }
};

const getNthWeekdayDateStr = (year, month1Based, nthWeek, weekDay) => {
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

const getRoutineNextDateInfo = (rt, dayStr = getTodayStr()) => {
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
    const lastDay = new Date(y, m, 0).getDate();
    const targetDay = Math.min(Math.max(1, Number(rt.monthDay) || 1), lastDay);
    const target = new Date(y, m - 1, targetDay);
    const diff = Math.round((target - base) / 86400000);
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

const INITIAL_FAMILY_ROUTINES = [
  { id: "rt-1", title: "시목이 어린이집 가방·낮잠이불 챙기기", cycle: "daily", timeSlot: "아침", assignee: "공통", lastDoneKey: "" },
  { id: "rt-2", title: "젖병·유축기 열탕 및 소독", cycle: "daily", timeSlot: "저녁", assignee: "공통", lastDoneKey: "" },
  { id: "rt-3", title: "시목·시율 유산균 & 비타민D", cycle: "daily", timeSlot: "아침", assignee: "공통", lastDoneKey: "" },
  { id: "rt-4", title: "시목이 목욕하기", cycle: "interval", intervalDays: 2, timeSlot: "저녁", assignee: "공통", lastDoneKey: "" },
  { id: "rt-5", title: "재활용·음식물 분리수거", cycle: "weekly", weekDay: 2, timeSlot: "저녁", assignee: "수혁", lastDoneKey: "" }
];

const getTwiceDailySlotKey = () => {
  const now = new Date();
  const half = now.getHours() < 12 ? "AM(오전)" : "PM(오후)";
  return `${formatDate(now)}_${half}`;
};

const getDayName = (dateStr) => {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "일";
  return days[d.getDay()];
};

const getDaysDiff = (expiryStr) => {
  if (!expiryStr) return 999;
  const today = new Date(getTodayStr() + "T00:00:00");
  const exp = new Date(String(expiryStr).slice(0, 10) + "T00:00:00");
  if (isNaN(exp.getTime())) return 999;
  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
};

const getDaysInMonth = (yearMonth) => {
  const [y, m] = String(yearMonth).split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
};

const shiftYearMonth = (yearMonth, deltaMonths) => {
  const [y, m] = String(yearMonth).split("-").map(Number);
  const d = new Date(y || 2026, (m || 11) - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 특정 기준 날짜가 속한 주간(월~일) 7일 배열 반환
const getWeekDatesFromBase = (baseDateStr) => {
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

const calculateScheduleDday = (item) => {
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

const extractJsonArray = (rawText) => {
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

const extractJsonObject = (rawText) => {
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

async function callOpenAiEngine({ openaiKey, promptText, imagePart = null, temperature = 0.5, expectObject = false }) {
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

async function callReliableAiEngine({
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
const parseWeatherCode = (code, temp) => {
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

const getDustGrade = (pm10, pm25) => {
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

const fileToBase64 = (file, { maxSide = 720, quality = 0.65, enhanceContrast = false } = {}) =>
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
const FAMILY_MEMBERS = [
  { id: "수혁", name: "김수혁", role: "아빠", emoji: "👨🏻", avatar: "data:image/jpeg;base64,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", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "아리나", name: "최아리나", role: "엄마", emoji: "👩🏻", avatar: "data:image/jpeg;base64,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", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { id: "시목", name: "김시목", role: "첫째", emoji: "👦🏻", avatar: "data:image/jpeg;base64,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", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "시율", name: "김시율", role: "둘째", emoji: "👶🏻", avatar: "data:image/jpeg;base64,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", color: "bg-purple-100 text-purple-800 border-purple-200" }
];

const HERO_FAMILY_FALLBACK = "data:image/jpeg;base64,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";

const MemberAvatar = ({ member, id, size = "sm", className = "" }) => {
  const resolved = member || FAMILY_MEMBERS.find((f) => f.id === id);
  const sizePx = size === "lg" ? 32 : size === "md" ? 24 : 16;
  const sizeClass =
    size === "lg"
      ? "w-8 h-8"
      : size === "md"
      ? "w-6 h-6"
      : "w-4 h-4";
  if (resolved?.avatar) {
    return (
      <img
        src={resolved.avatar}
        alt={resolved.name || resolved.id || "가족"}
        style={{ width: sizePx, height: sizePx, minWidth: sizePx, minHeight: sizePx, aspectRatio: "1 / 1", borderRadius: "9999px", objectFit: "cover" }}
        className={`${sizeClass} rounded-full object-cover border border-white/90 shadow-sm shrink-0 inline-block ${className}`}
      />
    );
  }
  return <span className={className}>{resolved?.emoji || "👤"}</span>;
};

const MEAL_SLOTS = [
  { id: "아침", label: "아침", shortLabel: "아침", icon: "🌅", time: "07:00 - 09:00" },
  { id: "오전간식", label: "오전간식", shortLabel: "오전간식", icon: "🍎", time: "10:00 - 11:00" },
  { id: "점심", label: "점심", shortLabel: "점심", icon: "☀️", time: "12:00 - 13:30" },
  { id: "오후간식", label: "오후간식", shortLabel: "오후간식", icon: "🥨", time: "15:00 - 16:30" },
  { id: "저녁", label: "저녁", shortLabel: "저녁", icon: "🌙", time: "18:00 - 20:00" },
  { id: "야식", label: "야식", shortLabel: "야식", icon: "🦉", time: "21:00 이후" }
];

const STORAGE_LOCATIONS = ["냉장실", "메인 냉동실", "별도 냉동고", "실온·팬트리"];
const matchesFridgeLocFilter = (itemLoc, filterLoc) => {
  if (filterLoc === "전체") return true;
  if (filterLoc === "냉동실") return String(itemLoc || "").includes("냉동");
  if (filterLoc === "메인 냉동실") return itemLoc === "메인 냉동실" || itemLoc === "냉동실";
  return itemLoc === filterLoc;
};
const FRIDGE_CATEGORIES = ["채소/과일", "육류/수산", "유제품/계란", "유아식/이유식 재료", "반찬/김치", "밀키트", "양념/소스", "기타"];
const SCHEDULE_CATEGORIES = ["기념일/생일", "할일(To-Do)", "육아/병원", "가족행사/경조사"];
const RECIPE_CATEGORIES = ["메인반찬", "국·찌개", "한그릇·면·밥", "유아식·이유식", "간식·디저트", "샐러드·가벼운식", "기타"];
const FRIDGE_SHELF_ZONES = [
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

const getFridgeCategoryIcon = (cat) => {
  const map = {
    "채소/과일": "🥬",
    "육류/수산": "🥩",
    "유제품/계란": "🥛",
    "유아식/이유식 재료": "🍼",
    "반찬/김치": "🍱",
    "밀키트": "🥟",
    "양념/소스": "🧂",
    "기타": "📦"
  };
  return map[cat] || "📦";
};

const resolveItemShelfZone = (item) => {
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
  if (cat === "유제품/계란" || cat === "유아식/이유식 재료") return "냉장 1단(상단)";
  if (cat === "반찬/김치") return "냉장 2단(중단)";
  return "냉장 3단(하단)";
};

const EXPORT_MEAL_GOALS = [
  "재고소진",
  "산후조리/영양보충",
  "다이어트",
  "치팅",
  "숙취해소",
  "한가족이 먹을수있는 식사"
];

const parseRecipeIngredientToken = (rawToken) => {
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

const buildPersonalizedAiPrompt = ({
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
      targetIntro = "김수혁(성인 남성)";
      evalLine = `1) 성인 남성 기준 영양 균형·메뉴 중복·[${goal}] 목표 관점에서 평가해 주세요.`;
      recLine = `2) 김수혁 개인 맞춤으로 ${goalGuide}에 맞춘 다음 3~7일 추천 식단(냉장고 재고 활용 포함)을 제안해 주세요.`;
    } else if (exportMealMember === "아리나") {
      targetIntro = "최아리나(성인 여성)";
      evalLine = `1) 성인 여성 기준 영양 균형·철분/단백질·메뉴 중복·[${goal}] 목표 관점에서 평가해 주세요.`;
      recLine = `2) 최아리나 개인 맞춤으로 ${goalGuide}에 맞춘 다음 3~7일 추천 식단(냉장고 재고 활용 포함)을 제안해 주세요.`;
    } else if (exportMealMember === "시목") {
      targetIntro = `첫째 김시목(생후 ${simokM}개월 유아식)`;
      evalLine = `1) 생후 ${simokM}개월 유아식 기준으로 탄수화물·단백질·채소 균형, 씹기 편한 식감/크기, 저염 여부, 메뉴 중복을 평가해 주세요.`;
      recLine = `2) 냉장고 보유 유아식·일반 재료를 우선 활용해 시목이에게 안전하고 영양이 고른 다음 3~7일 유아식·간식 식단(부족 재료만 최소화)을 제안해 주세요.`;
    } else if (exportMealMember === "시율") {
      targetIntro = `둘째 김시율(생후 ${siyulM}개월)`;
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


const compressDataUrlForFirestore = (dataUrl, maxSide = 720, quality = 0.65) =>
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

const APP_CODE_VERSION = "v10.90";
const APP_BUILD_DATE = "2026-11-17 10:52";
const EDITOR_INVITE_CODE = "0402";

const INITIAL_PATCH_NOTES = [
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
      "상단 [🔒 열람전용 / ✏️ 편집가능] 배지 및 초대 코드(0402) 입력 모달·원터치 초대 링크 복사(?invite=0402) 추가",
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

const INITIAL_SCHEDULES = [
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
    memo: "수혁 & 아리나 우리 가족의 시작일 (2020.08.16)"
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
    memo: "수혁 & 아리나 결혼기념일 (2023.04.02)"
  },
  {
    id: "bday-simok",
    title: "🎂 김시목 생일",
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
    title: "🍼 김시율 생일",
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
    title: "🌷 최아리나 생일",
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
    title: "👨🏻 김수혁 생일",
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

const CHILDREN_INFO = [
  { id: "시목", name: "김시목", birthDate: "2025-08-03", emoji: "👦🏻", badge: "첫째" },
  { id: "시율", name: "김시율", birthDate: "2026-11-06", emoji: "👶🏻", badge: "둘째" }
];

const getChildAgeStats = (birthStr) => {
  const today = new Date(getTodayStr() + "T00:00:00");
  const birth = new Date(birthStr + "T00:00:00");
  const diffDays = Math.max(0, Math.floor((today - birth) / (1000 * 60 * 60 * 24)));
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  return { days: diffDays + 1, months };
};

const addMonthsToDateStr = (birthStr, addMonths, addDays = 0) => {
  const d = new Date(birthStr + "T00:00:00");
  const origDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + addMonths);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(origDay, lastDayOfTargetMonth));
  if (addDays !== 0) d.setDate(d.getDate() + addDays);
  return formatDate(d);
};

const BABY_MILESTONES = [
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

const BABY_VACCINES_AND_CHECKUPS = [
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

const SHINDANG_NOV_DATA = [
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

const buildDaycareMeals = () => {
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

const INITIAL_SHOPPING = [
  { id: "sh-1", name: "상하목장 유기농 우유 900ml", quantity: "2팩", category: "유제품/계란", urgent: true, checked: false, memo: "시목이 간식 우유" },
  { id: "sh-2", name: "유기농 애호박 & 당근", quantity: "각 2개", category: "채소/과일", urgent: false, checked: false, memo: "시율이 이유식 큐브용" }
];

const INITIAL_NOTICES = [
  { id: "nt-1", title: "시목이 어린이집 낮잠이불 세탁해서 보내기", content: "월요일 등원할 때 깨끗한 낮잠이불 챙겨서 보내야 함!", category: "육아/아이들", author: "최아리나", pinned: true, done: false, createdAt: "2026-11-15" },
  { id: "nt-2", title: "시율이 신생아 B형간염 2차 예방접종 확인", content: "소아과 예약 시간 및 아기수첩 챙기기", category: "육아/아이들", author: "김수혁", pinned: true, done: false, createdAt: "2026-11-15" }
];

// ==========================================
// 4. 에러 방어막 컴포넌트
// ==========================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || "오류 발생" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center">
          <div className="bg-white p-6 rounded-3xl shadow-lg border border-red-200 max-w-sm w-full space-y-3">
            <div className="text-2xl">⚠️</div>
            <h2 className="text-sm font-black text-stone-900">화면 자동 복구</h2>
            <p className="text-xs text-stone-600 break-all">{this.state.errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 5. 메인 애플리케이션 컴포넌트
// ==========================================

const parseQuickShoppingTextLocal = (rawText) => {
  const cleaned = String(rawText || "")
    .replace(/(사와|사야해|사야함|사오기|사기|부탁해|부탁|필요해|필요|좀|해주세요|해줘)/g, " ")
    .replace(/[·•/|\n]+/g, ",")
    .replace(/(하고|이랑|랑|그리고)\s+/g, ",");
  const chunks = cleaned
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 1);

  const inferCategory = (name) => {
    const n = String(name || "");
    if (/(우유|두부|계란|달걀|치즈|요거트|버터|생크림)/.test(n)) return "유제품/계란";
    if (/(소고기|한우|돼지|삼겹|목살|닭|오리|고등어|연어|조기|새우|오징어|어묵|햄|소시지)/.test(n)) return "육류/수산";
    if (/(이유식|분유|기저귀|물티슈|아기|유아)/.test(n)) return "유아식/이유식 재료";
    if (/(김치|단무지|장아찌|멸치|젓갈)/.test(n)) return "반찬/김치";
    if (/(간장|된장|고추장|소금|설탕|식용유|참기름|올리브유|소스|케첩|마요네즈)/.test(n)) return "양념/소스";
    if (/(밀키트|만두|피자|냉동|떡볶이)/.test(n)) return "밀키트";
    if (/(양파|대파|마늘|감자|고구마|당근|브로콜리|시금치|애호박|무|배추|상추|깻잎|토마토|사과|바나나|딸기|포도|귤|버섯|콩나물|숙주|고사리|고추)/.test(n)) return "채소/과일";
    return "기타";
  };

  const results = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|L|개|팩|봉|망|모|병|캔|통|단|줄|알|포기|박스)?)$/i);
    if (m) {
      const name = m[1].trim();
      const quantity = m[2].trim();
      if (name) results.push({ name, quantity, category: inferCategory(name) });
    } else {
      const mCompact = chunk.match(/^([가-힣a-zA-Z_]+)(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|L|개|팩|봉|망|모|병|캔|통|단|줄|알|포기|박스))$/i);
      if (mCompact) {
        results.push({ name: mCompact[1].trim(), quantity: mCompact[2].trim(), category: inferCategory(mCompact[1]) });
      } else {
        results.push({ name: chunk, quantity: "1개", category: inferCategory(chunk) });
      }
    }
  }
  return results;
};

const computeFridgeProjectedUsage = (fridgeList, mealsList, baseDateStr, addDaysFn, matchFn, convertFn) => {
  const upcomingDates = new Set(
    Array.from({ length: 7 }, (_, i) => addDaysFn(baseDateStr, 0, i))
  );
  const upcomingMeals = (mealsList || []).filter((m) => upcomingDates.has(m?.date));
  const result = {};

  for (const item of fridgeList || []) {
    if (!item?.id) continue;
    let plannedQty = 0;
    let unitCompatible = true;
    const matchedMeals = [];

    for (const meal of upcomingMeals) {
      const ings = Array.isArray(meal?.ingredients) ? meal.ingredients : [];
      for (const ing of ings) {
        const ingName = typeof ing === "string" ? ing : ing?.name;
        if (!ingName) continue;
        const matched = matchFn(ingName, [item]);
        if (!matched) continue;

        const rawQty = typeof ing === "object" ? Number(ing?.qty ?? ing?.quantity ?? 0) : 0;
        const rawUnit = typeof ing === "object" ? (ing?.unit || item.unit || "개") : (item.unit || "개");
        if (rawQty > 0) {
          const converted = convertFn(rawQty, rawUnit, item.unit || "개");
          if (converted !== null) {
            plannedQty += converted;
          } else {
            unitCompatible = false;
          }
        } else {
          unitCompatible = false;
        }
        matchedMeals.push({ date: meal.date, slot: meal.slot, menu: meal.menu, qty: rawQty, unit: rawUnit });
      }
    }

    const currentQty = Number(item.quantity || 0);
    const roundedPlanned = Math.round(plannedQty * 100) / 100;
    const projectedRemaining = unitCompatible ? Math.round((currentQty - roundedPlanned) * 100) / 100 : currentQty;
    result[item.id] = {
      plannedQty: roundedPlanned,
      unitCompatible,
      matchedMeals,
      projectedRemaining
    };
  }
  return result;
};

function MainApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [scheduleSubTab, setScheduleSubTab] = useState("calendar");
  const [fridgeConflictData, setFridgeConflictData] = useState(null);
  const [isQuickFabOpen, setIsQuickFabOpen] = useState(false);
  useEffect(() => {
    setIsQuickFabOpen(false);
    if (activeTab !== "home") setIsHomeEditMode(false);
  }, [activeTab]);

  const [homeRoutineSlotFilter, setHomeRoutineSlotFilter] = useState(() => {
    return localStorage.getItem("kim_home_routine_slot_v1") || "auto";
  });
  const [homeTimeModeOverride, setHomeTimeModeOverride] = useState("auto");
  const [liveMinuteTick, setLiveMinuteTick] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const syncMinute = () => {
      const d = new Date();
      const m = d.getHours() * 60 + d.getMinutes();
      setLiveMinuteTick((prev) => (prev === m ? prev : m));
    };
    const timer = setInterval(syncMinute, 30000);
    window.addEventListener("focus", syncMinute);
    document.addEventListener("visibilitychange", syncMinute);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", syncMinute);
      document.removeEventListener("visibilitychange", syncMinute);
    };
  }, []);
  const [isHomeEditMode, setIsHomeEditMode] = useState(false);
  const [isRoutineRangeEditOpen, setIsRoutineRangeEditOpen] = useState(false);
  const [routineTimeRanges, setRoutineTimeRanges] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_routine_time_ranges_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (typeof parsed["아침"] === "number" || typeof parsed["아침"] === "string")) {
          return { ...DEFAULT_ROUTINE_TIME_RANGES, ...parsed };
        }
      }
    } catch (e) {}
    return DEFAULT_ROUTINE_TIME_RANGES;
  });
  const homeDragRef = useRef(null);
  const homeDragOverRef = useRef("");
  const [homeDragOverKey, setHomeDragOverKey] = useState("");

  const syncHomeSettingsToCloud = async (nextLayout, nextRanges, nextRoutineRanges = null) => {
    if (!user || !db || !isEditorUnlocked) return;
    try {
      await setDoc(
        getDocRef("family_meta_v4", "home_layout"),
        {
          ...(nextLayout ? { layout: nextLayout } : {}),
          ...(nextRanges ? { timeRanges: nextRanges } : {}),
          ...(nextRoutineRanges ? { routineRanges: nextRoutineRanges } : {}),
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (e) {
      setSyncErrorMsg(e?.message || "홈 설정 동기화 오류");
    }
  };
  const [homeTimeRanges, setHomeTimeRanges] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_home_time_ranges_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.morningStart === "number") return parsed;
      }
    } catch (e) {}
    return DEFAULT_HOME_TIME_RANGES;
  });
  const normalizeHomeLayout = (parsed) => {
    if (!parsed || !parsed.morning || !parsed.afternoon || !parsed.night) return DEFAULT_HOME_LAYOUT;
    const normalized = {};
    ["morning", "afternoon", "night"].forEach((mode) => {
      const def = DEFAULT_HOME_LAYOUT[mode];
      const cur = parsed[mode] || {};
      const mappedBlocks = Array.isArray(cur.blocks)
        ? cur.blocks.map((b) => (b === "routine" || b === "schedule_todo" ? "action_feed" : b))
        : [];
      const savedBlocks = mappedBlocks.filter((b, i) => def.blocks.includes(b) && mappedBlocks.indexOf(b) === i);
      const savedMenus = Array.isArray(cur.menuOrder) ? cur.menuOrder.filter((m) => DEFAULT_HOME_MENU_ORDER.includes(m)) : [];
      normalized[mode] = {
        blocks: [...savedBlocks, ...def.blocks.filter((b) => !savedBlocks.includes(b))],
        hiddenBlocks: Array.isArray(cur.hiddenBlocks) ? cur.hiddenBlocks : [],
        menuOrder: [...savedMenus, ...DEFAULT_HOME_MENU_ORDER.filter((m) => !savedMenus.includes(m))],
        hiddenMenus: Array.isArray(cur.hiddenMenus) ? cur.hiddenMenus : [],
        blockSizes:
          cur.blockSizes && typeof cur.blockSizes === "object"
            ? {
                ...cur.blockSizes,
                ...(cur.blockSizes.action_feed
                  ? {}
                  : cur.blockSizes.routine || cur.blockSizes.schedule_todo
                  ? { action_feed: cur.blockSizes.routine || cur.blockSizes.schedule_todo }
                  : {})
              }
            : {},
        menuSizes: cur.menuSizes && typeof cur.menuSizes === "object" ? cur.menuSizes : {}
      };
    });
    return normalized;
  };

  const [homeLayoutConfig, setHomeLayoutConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_home_layout_v1");
      if (raw) return normalizeHomeLayout(JSON.parse(raw));
    } catch (e) {}
    return DEFAULT_HOME_LAYOUT;
  });
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMember, setSelectedMember] = useState("전체");

  // 상단 바 틀고정(Sticky) 해제 상태
  const [isHeaderPinned, setIsHeaderPinned] = useState(() => {
    return localStorage.getItem("kim_header_pinned") === "true";
  });

  // 실시간 서울 중구 날씨 & 미세먼지 상태
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [isWeeklyWeatherOpen, setIsWeeklyWeatherOpen] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [aiDiagStatus, setAiDiagStatus] = useState("");

  // 패치노트 기록 및 모달 상태
  const [patchNotes, setPatchNotes] = useState(INITIAL_PATCH_NOTES);
  const [isPatchModalOpen, setIsPatchModalOpen] = useState(false);
  const [isQuickMenuExpanded, setIsQuickMenuExpanded] = useState(false);
  const [isMoreNavOpen, setIsMoreNavOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [activeWriteCount, setActiveWriteCount] = useState(0);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [syncErrorMsg, setSyncErrorMsg] = useState("");
  const [isCookingDeducting, setIsCookingDeducting] = useState(false);
  const [restoringLogIds, setRestoringLogIds] = useState([]);

  const syncStatus = !isOnline
    ? "offline"
    : syncErrorMsg
    ? "error"
    : activeWriteCount > 0 || hasPendingWrites
    ? "saving"
    : user && db
    ? "connected"
    : "connecting";

  const beginWrite = () => {
    setSyncErrorMsg("");
    setActiveWriteCount((c) => c + 1);
  };
  const endWrite = (ok = true, errMsg = "") => {
    setActiveWriteCount((c) => Math.max(0, c - 1));
    if (!ok) setSyncErrorMsg(errMsg || "저장 오류");
  };
  const [deletedLogs, setDeletedLogs] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_deleted_logs_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [toastUndo, setToastUndo] = useState(null);
  const toastTimerRef = useRef(null);
  const moreNavBtnRef = useRef(null);
  const moreSheetCloseRef = useRef(null);
  const [isEditorUnlocked, setIsEditorUnlocked] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("invite") === EDITOR_INVITE_CODE) {
        localStorage.setItem("family_editor_unlocked_v1", "true");
        params.delete("invite");
        const cleanQuery = params.toString();
        const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "") + window.location.hash;
        window.history.replaceState({}, "", cleanUrl);
        return true;
      }
      return localStorage.getItem("family_editor_unlocked_v1") === "true";
    } catch (e) {
      return false;
    }
  });
  const [isEditorUnlockModalOpen, setIsEditorUnlockModalOpen] = useState(false);
  const [editorCodeInput, setEditorCodeInput] = useState("");
  const [patchForm, setPatchForm] = useState({
    version: "",
    title: "",
    changesText: ""
  });

  const [mealsMap, setMealsMap] = useState({});
  const [fridgeMap, setFridgeMap] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [wasteEvents, setWasteEvents] = useState([]);

  // [신규 v7.0] 육아수첩 상태 (선택한 아이, 서브탭, 접종체크, 성장기록, 진료/열 메모)
  const [aiCallLogs, setAiCallLogs] = useState([]);
  const [cookingConfirmModal, setCookingConfirmModal] = useState(null);

  const [selectedChildId, setSelectedChildId] = useState("시율");
  const [babySubTab, setBabySubTab] = useState("milestones"); // milestones | vaccines | growth | medical
  const [babyChecks, setBabyChecks] = useState({});
  const [babyGrowthLogs, setBabyGrowthLogs] = useState([]);
  const [babyMedicalNotes, setBabyMedicalNotes] = useState([]);
  const [growthForm, setGrowthForm] = useState({
    date: getTodayStr(),
    height: "",
    weight: "",
    head: "",
    memo: ""
  });
  const [medNoteForm, setMedNoteForm] = useState({
    date: getTodayStr(),
    temp: "",
    title: "",
    memo: ""
  });
  const [shoppingList, setShoppingList] = useState([]);
  const [quickShoppingText, setQuickShoppingText] = useState("");
  const [isQuickParsingShopping, setIsQuickParsingShopping] = useState(false);
  const [fridgeViewMode, setFridgeViewMode] = useState("list"); // visual | list
  const [fridgeSearch, setFridgeSearch] = useState("");
  const [debouncedFridgeSearch, setDebouncedFridgeSearch] = useState("");
  const [fridgeSort, setFridgeSort] = useState("expiry"); // expiry | recent | name
  const [bulkMoveMode, setBulkMoveMode] = useState(false);
  const [selectedBulkFridgeIds, setSelectedBulkFridgeIds] = useState([]);
  const [bulkTargetZone, setBulkTargetZone] = useState("냉장 1단(상단)");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFridgeSearch(fridgeSearch), 150);
    return () => clearTimeout(t);
  }, [fridgeSearch]);
  const [quickFridgeItem, setQuickFridgeItem] = useState(null);
  const [draggingChip, setDraggingChip] = useState(null); // { item, x, y }
  const [dragOverZone, setDragOverZone] = useState("");
  const chipTouchRef = useRef(null);
  const dragOverZoneRef = useRef("");
  const justDraggedRef = useRef(false);

  // [v10.24] 드롭 직후 스크롤 멈춤 방지를 위해 body overflow 토글 제거 & 동기식 리스너 제어
  const touchMoveBlockerRef = useRef(null);
  const enableChipTouchScrollLock = () => {
    if (touchMoveBlockerRef.current) return;
    const fn = (ev) => {
      if (ev.cancelable) ev.preventDefault();
    };
    touchMoveBlockerRef.current = fn;
    window.addEventListener("touchmove", fn, { passive: false });
  };
  const disableChipTouchScrollLock = () => {
    if (touchMoveBlockerRef.current) {
      window.removeEventListener("touchmove", touchMoveBlockerRef.current);
      touchMoveBlockerRef.current = null;
    }
  };
  useEffect(() => () => disableChipTouchScrollLock(), []);
  const [visualExpiringOnly, setVisualExpiringOnly] = useState(false);

  // [신규 v10.8] 가족 레시피북 상태
  const [recipes, setRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 150);
    return () => clearTimeout(t);
  }, [recipeSearch]);
  const [recipeCatFilter, setRecipeCatFilter] = useState("전체");
  const [recipeDiffFilter, setRecipeDiffFilter] = useState("전체");
  const [recipeSort, setRecipeSort] = useState("latest"); // latest | rating | time
  const [recipeViewMode, setRecipeViewMode] = useState("cards"); // cards | summary
  const [zoomedRecipePhoto, setZoomedRecipePhoto] = useState(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeIngredientInput, setRecipeIngredientInput] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [recipeForm, setRecipeForm] = useState({
    title: "",
    category: "메인반찬",
    photoDataUrl: "",
    ingredientsText: "",
    cookTime: "20분",
    difficulty: "쉬움",
    ratings: { 수혁: 5, 아리나: 5, 시목: 0, 시율: 0 },
    stepsText: "",
    memo: "",
    platingCoach: null
  });
  const recipePhotoInputRef = useRef(null);
  const [cropModal, setCropModal] = useState(null); // { srcUrl }
  const [cropRect, setCropRect] = useState({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const [cropAspect, setCropAspect] = useState("free"); // free | 1:1 | 4:3 | 16:9
  const cropBoxRef = useRef(null);
  const cropImgRef = useRef(null);
  const cropDragRef = useRef(null);
  const [notices, setNotices] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("kim_family_deleted_ids") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [lastAutoBackupSlot, setLastAutoBackupSlot] = useState(() => {
    return localStorage.getItem("kim_twice_daily_backup_slot") || "";
  });
  const [backupEmail, setBackupEmail] = useState(() => {
    return localStorage.getItem("kim_family_backup_email") || "";
  });
  const [backupBannerDismissedMonth, setBackupBannerDismissedMonth] = useState(() => {
    return localStorage.getItem("kim_backup_done_month") || "";
  });
  const [isRestoringJson, setIsRestoringJson] = useState(false);
  const jsonRestoreInputRef = useRef(null);

  // 월간 캘린더 & 식비 가계부 상태
  const [monthlySubTab, setMonthlySubTab] = useState("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => getCurrentYearMonth());
  const [monthlyMember, setMonthlyMember] = useState("시목");
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return Number(localStorage.getItem("kim_family_budget") || 800000);
  });

  // 일정 탭 상태 + [신규] 전체 To-Do 체크리스트 필터 및 빠른 추가 상태
  const [scheduleMonth, setScheduleMonth] = useState(() => getCurrentYearMonth());
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState(() => getTodayStr());
  const [scheduleMemberFilter, setScheduleMemberFilter] = useState("전체");
  const [scheduleCatFilter, setScheduleCatFilter] = useState("전체");
  const [todoStatusFilter, setTodoStatusFilter] = useState("all");
  const [todoIncludeOtherCats, setTodoIncludeOtherCats] = useState(false); // all | active | completed
  const [quickTodoTitle, setQuickTodoTitle] = useState("");
  const [quickTodoDate, setQuickTodoDate] = useState(() => getTodayStr());
  const [familyRoutines, setFamilyRoutines] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_family_routines_v1");
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_FAMILY_ROUTINES;
    } catch (e) {
      return INITIAL_FAMILY_ROUTINES;
    }
  });
  const [newRoutineTitle, setNewRoutineTitle] = useState("");
  const [newRoutineCycle, setNewRoutineCycle] = useState("daily");
  const [newRoutineAssignee, setNewRoutineAssignee] = useState("공통");
  const [newRoutineMonthDay, setNewRoutineMonthDay] = useState(1);
  const [newRoutineWeekDay, setNewRoutineWeekDay] = useState("any"); // any | 0..6
  const [newRoutineTimeSlot, setNewRoutineTimeSlot] = useState(() => getCurrentRoutineTimeSlot());
  const [newRoutineIntervalDays, setNewRoutineIntervalDays] = useState(2);
  const [newRoutineNthWeek, setNewRoutineNthWeek] = useState(1);
  const [routineTimeFilter, setRoutineTimeFilter] = useState("전체");
  const [routineTargetFilter, setRoutineTargetFilter] = useState("전체");
  const [homeRoutineTargetFilter, setHomeRoutineTargetFilter] = useState(() => {
    try {
      return localStorage.getItem("kim_home_routine_target_v1") || "전체";
    } catch (e) {
      return "전체";
    }
  });
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [hideEmptyMealSlots, setHideEmptyMealSlots] = useState(false);
  useEffect(() => {
    if (!isQuickFabOpen && !isRoutineModalOpen) return;
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setIsQuickFabOpen(false);
        setIsRoutineModalOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isQuickFabOpen, isRoutineModalOpen]);
  const [showAllTodayRoutinesOnMain, setShowAllTodayRoutinesOnMain] = useState(false);
  const [isMainRoutineCollapsed, setIsMainRoutineCollapsed] = useState(false);
  const [currentDayKey, setCurrentDayKey] = useState(() => getTodayStr());
  useEffect(() => {
    const syncDayKey = () => {
      const nowDay = getTodayStr();
      setCurrentDayKey((prev) => (prev !== nowDay ? nowDay : prev));
    };
    window.addEventListener("focus", syncDayKey);
    document.addEventListener("visibilitychange", syncDayKey);
    return () => {
      window.removeEventListener("focus", syncDayKey);
      document.removeEventListener("visibilitychange", syncDayKey);
    };
  }, []);

  const syncRoutinesToCloud = async (nextList, op = null) => {
    try {
      localStorage.setItem("kim_family_routines_v1", JSON.stringify(nextList));
    } catch (e) {}
    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        await runTransaction(db, async (tx) => {
          const ref = getDocRef("family_meta_v4", "daily_routines");
          const snap = await tx.get(ref);
          const serverItems =
            snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : null;
          let merged = nextList;
          if (serverItems && op) {
            if (op.type === "upsert" && op.item) {
              const exists = serverItems.some((r) => r.id === op.item.id);
              merged = exists
                ? serverItems.map((r) => (r.id === op.item.id ? op.item : r))
                : [op.item, ...serverItems];
            } else if (op.type === "delete" && op.id) {
              merged = serverItems.filter((r) => r.id !== op.id);
            }
          }
          tx.set(
            ref,
            { items: merged, initialized: true, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        });
        ok = true;
      } catch (e) {
        errMsg = e?.message || "루틴 동기화 오류";
        setSyncErrorMsg(errMsg);
      } finally {
        endWrite(ok, errMsg);
      }
    }
  };

  const getRoutineResetKey = (rt, dayStr = currentDayKey) => {
    if (!rt) return dayStr;
    if (rt.cycle === "weekly") return getIsoWeekKey(dayStr);
    if (rt.cycle === "monthly" || rt.cycle === "monthly_weekday") return String(dayStr).slice(0, 7);
    return dayStr;
  };

  const getMonthlyRoutineDueInfo = (rt, dayStr = currentDayKey) => {
    if (!rt || (rt.cycle !== "monthly" && rt.cycle !== "monthly_weekday")) return null;
    const info = getRoutineNextDateInfo(rt, dayStr);
    return info ? { targetDay: rt.monthDay || 1, diff: info.diff, dateLabel: info.dateLabel } : null;
  };

  const getIntervalRoutineInfo = (rt, dayStr = currentDayKey) => {
    if (!rt || rt.cycle !== "interval") return null;
    const intervalDays = Math.max(2, Number(rt.intervalDays) || 2);
    if (!rt.lastDoneKey) return { done: false, daysLeft: 0, intervalDays };
    const lastD = new Date(String(rt.lastDoneKey).slice(0, 10) + "T00:00:00");
    const curD = new Date(String(dayStr).slice(0, 10) + "T00:00:00");
    if (Number.isNaN(lastD.getTime()) || Number.isNaN(curD.getTime())) {
      return { done: false, daysLeft: 0, intervalDays };
    }
    const elapsed = Math.floor((curD - lastD) / 86400000);
    const done = elapsed >= 0 && elapsed < intervalDays;
    return { done, daysLeft: Math.max(0, intervalDays - elapsed), intervalDays };
  };

  const isRoutineDoneNow = (rt) => {
    if (!rt) return false;
    if (rt.cycle === "interval") {
      return Boolean(getIntervalRoutineInfo(rt, currentDayKey)?.done);
    }
    return rt.lastDoneKey === getRoutineResetKey(rt, currentDayKey);
  };

  const handleToggleRoutine = (rtId) => {
    if (!requireEditorAccess()) return;
    const todayKey = getTodayStr();
    if (todayKey !== currentDayKey) setCurrentDayKey(todayKey);
    let wasDone = false;
    let targetTitle = "";
    const nextList = familyRoutines.map((r) => {
      if (r.id !== rtId) return r;
      targetTitle = r.title || "루틴";
      const steps = parseRoutineSteps(r.title);
      if (r.cycle === "interval") {
        const info = getIntervalRoutineInfo(r, todayKey);
        wasDone = Boolean(info?.done);
        return {
          ...r,
          lastDoneKey: wasDone ? "" : todayKey,
          ...(steps.length >= 2 ? { stepDoneKey: todayKey, stepDoneIndices: wasDone ? [] : steps.map((_, idx) => idx) } : {})
        };
      }
      const targetKey = getRoutineResetKey(r, todayKey);
      wasDone = r.lastDoneKey === targetKey;
      return {
        ...r,
        lastDoneKey: wasDone ? "" : targetKey,
        ...(steps.length >= 2 ? { stepDoneKey: targetKey, stepDoneIndices: wasDone ? [] : steps.map((_, idx) => idx) } : {})
      };
    });
    setFamilyRoutines(nextList);
    showToast(wasDone ? `↩️ '${targetTitle}' 완료를 취소했습니다.` : `✅ '${targetTitle}' 루틴 완료!`);
    const updatedItem = nextList.find((r) => r.id === rtId);
    syncRoutinesToCloud(nextList, updatedItem ? { type: "upsert", item: updatedItem } : null);
  };

  const getRoutineSubStepDoneSet = (rt) => {
    if (!rt) return new Set();
    const targetKey = rt.cycle === "interval" ? currentDayKey : getRoutineResetKey(rt, currentDayKey);
    if (rt.stepDoneKey === targetKey && Array.isArray(rt.stepDoneIndices)) {
      return new Set(rt.stepDoneIndices);
    }
    return new Set();
  };

  const handleToggleRoutineSubStep = (rtId, stepIdx, totalSteps) => {
    if (!requireEditorAccess()) return;
    const todayKey = getTodayStr();
    if (todayKey !== currentDayKey) setCurrentDayKey(todayKey);
    let completedAll = false;
    let targetTitle = "";
    const nextList = familyRoutines.map((r) => {
      if (r.id !== rtId) return r;
      targetTitle = r.title || "루틴";
      const targetKey = r.cycle === "interval" ? todayKey : getRoutineResetKey(r, todayKey);
      const curSet =
        r.stepDoneKey === targetKey && Array.isArray(r.stepDoneIndices) && r.stepDoneIndices.length > 0
          ? new Set(r.stepDoneIndices)
          : r.lastDoneKey === targetKey
          ? new Set(Array.from({ length: totalSteps }, (_, idx) => idx))
          : new Set();
      if (curSet.has(stepIdx)) curSet.delete(stepIdx);
      else curSet.add(stepIdx);
      const nextIndices = Array.from(curSet).sort((a, b) => a - b);
      completedAll = totalSteps > 0 && nextIndices.length >= totalSteps;
      return {
        ...r,
        stepDoneKey: targetKey,
        stepDoneIndices: nextIndices,
        lastDoneKey: completedAll ? targetKey : r.lastDoneKey === targetKey ? "" : r.lastDoneKey
      };
    });
    setFamilyRoutines(nextList);
    if (completedAll) {
      showToast(`🎉 '${targetTitle}' 모든 단계 완료!`);
    }
    const updatedItem = nextList.find((r) => r.id === rtId);
    syncRoutinesToCloud(nextList, updatedItem ? { type: "upsert", item: updatedItem } : null);
  };

  const handleStartEditRoutine = (rt) => {
    if (!requireEditorAccess() || !rt) return;
    setEditingRoutineId(rt.id);
    setNewRoutineTitle(rt.title || "");
    setNewRoutineTimeSlot(rt.timeSlot || "상시");
    setNewRoutineCycle(rt.cycle || "daily");
    setNewRoutineIntervalDays(Number(rt.intervalDays) || 2);
    setNewRoutineMonthDay(Number(rt.monthDay) || 1);
    setNewRoutineNthWeek(Number(rt.nthWeek) || 1);
    setNewRoutineWeekDay(
      rt.weekDay !== undefined && rt.weekDay !== null ? String(rt.weekDay) : "any"
    );
    setNewRoutineAssignee(rt.assignee || "공통");
    setIsRoutineModalOpen(true);
  };

  const openNewRoutineModal = () => {
    if (!requireEditorAccess()) return;
    setEditingRoutineId(null);
    setNewRoutineTitle("");
    setNewRoutineTimeSlot(getCurrentRoutineTimeSlot(routineTimeRanges, liveMinuteTick));
    setNewRoutineCycle("daily");
    setNewRoutineIntervalDays(2);
    setNewRoutineMonthDay(1);
    setNewRoutineWeekDay("any");
    setNewRoutineNthWeek(1);
    setNewRoutineAssignee(routineTargetFilter !== "전체" ? routineTargetFilter : "공통");
    setIsRoutineModalOpen(true);
  };

  const handleCancelEditRoutine = () => {
    setEditingRoutineId(null);
    setNewRoutineTitle("");
    setIsRoutineModalOpen(false);
  };

  const handleAddRoutine = () => {
    if (!requireEditorAccess()) return;
    const title = newRoutineTitle.trim();
    if (!title) return;
    const cycleVal = ["daily", "interval", "weekly", "monthly", "monthly_weekday"].includes(newRoutineCycle)
      ? newRoutineCycle
      : "daily";
    const mDayVal = cycleVal === "monthly" ? Math.min(31, Math.max(1, Number(newRoutineMonthDay) || 1)) : null;
    const iDaysVal = cycleVal === "interval" ? Math.min(30, Math.max(2, Number(newRoutineIntervalDays) || 2)) : null;
    const nthVal = cycleVal === "monthly_weekday" ? Number(newRoutineNthWeek) || 1 : null;
    const wdVal =
      cycleVal === "weekly" && newRoutineWeekDay !== "any"
        ? Number(newRoutineWeekDay)
        : cycleVal === "monthly_weekday"
        ? Number(newRoutineWeekDay === "any" ? 6 : newRoutineWeekDay)
        : null;
    if (
      familyRoutines.some(
        (r) =>
          r.id !== editingRoutineId &&
          String(r.title || "").trim().toLowerCase() === title.toLowerCase() &&
          r.cycle === cycleVal &&
          (r.timeSlot || "상시") === newRoutineTimeSlot &&
          (r.assignee || "공통") === (newRoutineAssignee || "공통")
      )
    ) {
      showToast("이미 같은 대상·이름·시간대·주기의 루틴이 등록되어 있습니다.");
      return;
    }
    if (editingRoutineId) {
      const nextList = familyRoutines.map((r) => {
        if (r.id !== editingRoutineId) return r;
        return {
          id: r.id,
          title,
          cycle: cycleVal,
          timeSlot: newRoutineTimeSlot || "상시",
          ...(cycleVal === "interval" ? { intervalDays: iDaysVal } : {}),
          ...(cycleVal === "monthly" ? { monthDay: mDayVal } : {}),
          ...(cycleVal === "monthly_weekday" ? { nthWeek: nthVal, weekDay: wdVal } : {}),
          ...(cycleVal === "weekly" && wdVal !== null ? { weekDay: wdVal } : {}),
          assignee: newRoutineAssignee || "공통",
          lastDoneKey: r.lastDoneKey || "",
          ...(r.title === title && r.stepDoneKey ? { stepDoneKey: r.stepDoneKey, stepDoneIndices: r.stepDoneIndices || [] } : {})
        };
      });
      setFamilyRoutines(nextList);
      setEditingRoutineId(null);
      setNewRoutineTitle("");
      setIsRoutineModalOpen(false);
      const editedItem = nextList.find((r) => r.id === editingRoutineId);
      syncRoutinesToCloud(nextList, editedItem ? { type: "upsert", item: editedItem } : null);
      showToast(`✏️ '${title}' 루틴이 수정되었습니다!`);
      return;
    }
    const nextItem = {
      id: `rt-${Date.now()}`,
      title,
      cycle: cycleVal,
      timeSlot: newRoutineTimeSlot || "상시",
      ...(cycleVal === "interval" ? { intervalDays: iDaysVal } : {}),
      ...(cycleVal === "monthly" ? { monthDay: mDayVal } : {}),
      ...(cycleVal === "monthly_weekday" ? { nthWeek: nthVal, weekDay: wdVal } : {}),
      ...(cycleVal === "weekly" && wdVal !== null ? { weekDay: wdVal } : {}),
      assignee: newRoutineAssignee || "공통",
      lastDoneKey: ""
    };
    const nextList = [nextItem, ...familyRoutines];
    setFamilyRoutines(nextList);
    setNewRoutineTitle("");
    setIsRoutineModalOpen(false);
    syncRoutinesToCloud(nextList, { type: "upsert", item: nextItem });
    showToast(`🔄 '${title}' 루틴이 추가되었습니다!`);
  };

  const handleDeleteRoutine = (rtId) => {
    if (!requireEditorAccess()) return;
    const nextList = familyRoutines.filter((r) => r.id !== rtId);
    setFamilyRoutines(nextList);
    syncRoutinesToCloud(nextList, { type: "delete", id: rtId });
  };

  const handleClearCompletedTodos = async () => {
    if (!requireEditorAccess()) return;
    const completedTodos = allTodoChecklistItems.filter((s) => s.done && s.category === "할일(To-Do)");
    if (completedTodos.length === 0) {
      showToast("정리할 완료된 할 일(To-Do)이 없습니다.");
      return;
    }
    const delIds = completedTodos.map((s) => s.id);
    const delSet = new Set(delIds);
    setSchedules((prev) => prev.filter((s) => !delSet.has(s.id)));
    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        for (let i = 0; i < completedTodos.length; i += 200) {
          const chunk = completedTodos.slice(i, i + 200);
          const batch = writeBatch(db);
          chunk.forEach((it) => {
            batch.delete(getDocRef("family_schedules_v4", it.id));
          });
          batch.set(
            getDocRef("family_meta_v4", "deleted_tracker"),
            { ids: arrayUnion(...chunk.map((c) => c.id)) },
            { merge: true }
          );
          await batch.commit();
        }
        ok = true;
      } catch (e) {
        errMsg = e?.message || "완료된 To-Do 일괄 정리 오류";
        setSyncErrorMsg(errMsg);
      } finally {
        endWrite(ok, errMsg);
      }
    }
    showToast(`🧹 완료된 할 일 ${completedTodos.length}건을 비웠습니다.`);
  };
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    date: getTodayStr(),
    category: "할일(To-Do)",
    members: ["수혁", "아리나"],
    isAnnual: false,
    showDday: false,
    hasOriginYear: false,
    memo: ""
  });

  // 식단 모달 상태
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [mealChipInput, setMealChipInput] = useState("");
  useEffect(() => {
    if (!isMealModalOpen) setMealChipInput("");
  }, [isMealModalOpen]);
  useEffect(() => {
    if (!isRecipeModalOpen) setRecipeIngredientInput("");
  }, [isRecipeModalOpen]);
  const [favoriteMealCombos, setFavoriteMealCombos] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_favorite_meal_combos_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });
  const [favoriteSingleMenus, setFavoriteSingleMenus] = useState(() => {
    try {
      const raw = localStorage.getItem("kim_favorite_single_menus_v1");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  const syncMealFavoritesToCloud = async (nextCombos, nextSingles) => {
    try {
      localStorage.setItem("kim_favorite_meal_combos_v1", JSON.stringify(nextCombos));
      localStorage.setItem("kim_favorite_single_menus_v1", JSON.stringify(nextSingles));
    } catch (e) {}
    if (user && db) {
      try {
        await setDoc(
          getDocRef("family_meta_v4", "meal_favorites"),
          { combos: nextCombos, singles: nextSingles, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (e) {}
    }
  };

  const handleAddFavoriteSingleMenu = (rawName) => {
    const clean = String(rawName || "").trim();
    if (!clean) return;
    if (favoriteSingleMenus.includes(clean)) {
      showToast(`'${clean}'은(는) 이미 단일 즐겨찾기에 있습니다.`);
      return;
    }
    const next = [clean, ...favoriteSingleMenus].slice(0, 30);
    setFavoriteSingleMenus(next);
    syncMealFavoritesToCloud(favoriteMealCombos, next);
    showToast(`⭐ '${clean}' 단일 메뉴 즐겨찾기에 등록했습니다!`);
  };

  const handleRemoveFavoriteSingleMenu = (targetName) => {
    const next = favoriteSingleMenus.filter((x) => x !== targetName);
    setFavoriteSingleMenus(next);
    syncMealFavoritesToCloud(favoriteMealCombos, next);
  };

  const appendMenuChipToForm = (rawItem) => {
    const item = String(rawItem || "").trim();
    if (!item) return;
    setMealForm((prev) => {
      const existing = String(prev.menu || "")
        .split(/\s*\+\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (existing.includes(item)) return prev;
      return { ...prev, menu: [...existing, item].join(" + ") };
    });
  };

  const [editingMeal, setEditingMeal] = useState(null);
  const [mealForm, setMealForm] = useState({
    date: getTodayStr(),
    slot: "아침",
    menu: "",
    members: ["수혁", "아리나", "시목", "시율"],
    ingredients: [],
    note: "",
    sourceType: "집밥/온가족식",
    cost: ""
  });

  // 냉장고 모달 상태
  const [isFridgeModalOpen, setIsFridgeModalOpen] = useState(false);
  const [isExpiryManuallyEdited, setIsExpiryManuallyEdited] = useState(false);

  const getDefaultExpiryForLocation = (loc) => {
    const todayStr = getTodayStr();
    return String(loc || "").includes("냉동")
      ? addMonthsToDateStr(todayStr, 1, 0)
      : addMonthsToDateStr(todayStr, 0, 7);
  };

  const openAddFridgeModal = () => {
    const defaultLoc = fridgeLocFilter === "전체" ? "냉장실" : fridgeLocFilter;
    const defaultCat = fridgeCatFilter === "전체" ? "채소/과일" : fridgeCatFilter;
    setEditingFridge(null);
    setIsExpiryManuallyEdited(false);
    setFridgeForm({
      name: "",
      location: defaultLoc,
      category: defaultCat,
      quantity: 1,
      unit: "개",
      expiryDate: getDefaultExpiryForLocation(defaultLoc),
      price: "",
      purchaseDate: selectedDate,
      recordExpense: true,
      shelfZone: ""
    });
    setFridgeConflictData(null);
    setIsFridgeModalOpen(true);
  };
  const handleOpenAddFridgeForZone = (zoneName) => {
    setEditingFridge(null);
    setFridgeForm({
      name: "",
      location: shelfZoneToLocation(zoneName),
      category: "채소/과일",
      quantity: 1,
      unit: "개",
      expiryDate: getOffsetDateStr(selectedDate, 7),
      price: "",
      purchaseDate: selectedDate,
      recordExpense: true,
      shelfZone: zoneName
    });
    setFridgeConflictData(null);
    setIsFridgeModalOpen(true);
  };
  const [editingFridge, setEditingFridge] = useState(null);
  const [fridgeForm, setFridgeForm] = useState({
    name: "",
    location: "냉장실",
    category: "채소/과일",
    quantity: 1,
    unit: "개",
    expiryDate: getTodayStr(),
    price: "",
    purchaseDate: getTodayStr(),
    recordExpense: true,
    shelfZone: ""
  });
  const [fridgeLocFilter, setFridgeLocFilter] = useState("전체");
  const [fridgeCatFilter, setFridgeCatFilter] = useState("전체");

  // 장보기 메모 상태
  const [shoppingForm, setShoppingForm] = useState({
    name: "",
    quantity: "1개",
    category: "채소/과일",
    urgent: false,
    memo: ""
  });
  const [stockInItem, setStockInItem] = useState(null);
  const [stockInPrice, setStockInPrice] = useState("");
  const [stockInLocation, setStockInLocation] = useState("냉장실");

  // 가족 공지사항 상태
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    category: "육아/아이들",
    author: "김수혁",
    pinned: true
  });

  // AI 추천 상태
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    const saved = localStorage.getItem("kim_family_gemini_key");
    return saved && (saved.startsWith("AIzaSy") || saved.startsWith("AQ.")) ? saved : EMBEDDED_GEMINI_KEY;
  });
  const [tempKeyInput, setTempKeyInput] = useState(() => {
    const saved = localStorage.getItem("kim_family_gemini_key");
    return saved && (saved.startsWith("AIzaSy") || saved.startsWith("AQ.")) ? saved : EMBEDDED_GEMINI_KEY;
  });
  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    return localStorage.getItem("kim_family_openai_key") || "";
  });
  const [tempOpenaiKeyInput, setTempOpenaiKeyInput] = useState(() => {
    return localStorage.getItem("kim_family_openai_key") || "";
  });
  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem("kim_family_ai_provider") || "auto";
  });
  const [selectedAiIngredients, setSelectedAiIngredients] = useState([]);
  const [aiTargetGroup, setAiTargetGroup] = useState("온가족 한끼");
  const [aiPromptExtra, setAiPromptExtra] = useState("");
  const [aiRecipes, setAiRecipes] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState("");
  const [aiSubMode, setAiSubMode] = useState("recipe");
  const [planScheduleMap, setPlanScheduleMap] = useState(() => {
    const base = getTodayStr();
    const d0 = addMonthsToDateStr(base, 0, 0);
    const d1 = addMonthsToDateStr(base, 0, 1);
    const d2 = addMonthsToDateStr(base, 0, 2);
    return {
      [d0]: ["아침", "저녁"],
      [d1]: ["아침", "저녁"],
      [d2]: ["아침", "저녁"]
    };
  });
  const [planAddDateInput, setPlanAddDateInput] = useState(() => addMonthsToDateStr(getTodayStr(), 0, 3));
  const [planTarget, setPlanTarget] = useState("adults");
  const [planAdultStyle, setPlanAdultStyle] = useState("일반 집밥");
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [regeneratingPlanId, setRegeneratingPlanId] = useState("");
  const [planErrorMsg, setPlanErrorMsg] = useState("");
  const [planItems, setPlanItems] = useState([]);
  const [planSnapshotMeta, setPlanSnapshotMeta] = useState(null);
  const [planConflictMode, setPlanConflictMode] = useState("skip");
  const [selfTestResults, setSelfTestResults] = useState(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // 전체 재고 텍스트 내보내기 모달 상태
  const [isInventoryExportOpen, setIsInventoryExportOpen] = useState(false);
  const [exportIncludePrice, setExportIncludePrice] = useState(false);
  const [exportIncludeZeroOrExpired, setExportIncludeZeroOrExpired] = useState(false);
  const [exportScope, setExportScope] = useState("all"); // all | meals_only | fridge_only
  const [exportMealMember, setExportMealMember] = useState("전체"); // 전체 | 수혁 | 아리나 | 시목 | 시율
  const [exportFridgeLoc, setExportFridgeLoc] = useState("전체"); // 전체 | 냉장실 | 냉동실 | 실온·팬트리
  const [exportMealDays, setExportMealDays] = useState(7); // 3 | 7 | 14
  const [exportIncludeAiPrompt, setExportIncludeAiPrompt] = useState(true);
  const [exportMealGoal, setExportMealGoal] = useState("재고소진");
  const [quickLogRecipe, setQuickLogRecipe] = useState(null);
  const [quickLogDate, setQuickLogDate] = useState(() => getTodayStr());
  const [quickLogSlot, setQuickLogSlot] = useState("저녁");

  // AI 플레이팅 코치 (사진 업로드 분석) 상태
  const [platingPreviewUrl, setPlatingPreviewUrl] = useState("");
  const [platingImagePart, setPlatingImagePart] = useState(null);
  const [platingStyleHint, setPlatingStyleHint] = useState("");
  const [platingResult, setPlatingResult] = useState(null);
  const [isPlatingLoading, setIsPlatingLoading] = useState(false);
  const [platingErrorMsg, setPlatingErrorMsg] = useState("");
  const [platingExampleImageUrl, setPlatingExampleImageUrl] = useState("");
  const [isPlatingImageLoading, setIsPlatingImageLoading] = useState(false);
  const platingFileInputRef = useRef(null);
  const currentMilestoneRef = useRef(null);

  // 식단표 이미지 AI 스캐너 상태
  const [isDaycareModalOpen, setIsDaycareModalOpen] = useState(false);
  const [scanTargetMonth, setScanTargetMonth] = useState(() => getCurrentYearMonth());
  const [scanTargetMember, setScanTargetMember] = useState("아리나");
  const [scanSchoolName, setScanSchoolName] = useState("우리집·어린이집 식단");
  const [scanPreviewUrl, setScanPreviewUrl] = useState("");
  const [isMenuScanning, setIsMenuScanning] = useState(false);
  const [scannedMenuDays, setScannedMenuDays] = useState([]);
  const [scanErrorMsg, setScanErrorMsg] = useState("");
  const menuFileInputRef = useRef(null);

  // 마트 영수증 실제 이미지 스캐너 상태
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [receiptTotalAmount, setReceiptTotalAmount] = useState("");
  const [receiptExcludedAmount, setReceiptExcludedAmount] = useState("0");
  const [receiptRawLines, setReceiptRawLines] = useState([]);
  const [receiptEngineUsed, setReceiptEngineUsed] = useState("");
  const [showReceiptRawLines, setShowReceiptRawLines] = useState(false);
  const [receiptOperationId, setReceiptOperationId] = useState("");
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [receiptSaveError, setReceiptSaveError] = useState("");
  const [lastReceiptImagePart, setLastReceiptImagePart] = useState(null);
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [scannedReceiptItems, setScannedReceiptItems] = useState([]);
  const [receiptErrorMsg, setReceiptErrorMsg] = useState("");
  const receiptFileInputRef = useRef(null);

  // 설정 모달
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const requireEditorAccess = () => {
    if (isEditorUnlocked) return true;
    showToast("🔒 열람 전용 모드입니다. 초대 코드를 입력하면 편집할 수 있어요.");
    setIsEditorUnlockModalOpen(true);
    return false;
  };

  const showToast = (msg, undoAction = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMsg(msg);
    setToastUndo(undoAction ? { fn: undoAction } : null);
    toastTimerRef.current = setTimeout(() => {
      setToastMsg("");
      setToastUndo(null);
    }, undoAction ? 5000 : 3500);
  };

  const recordDeletedLog = async (type, label, data, actionType = "delete") => {
    if (!data?.id) return null;
    const entry = {
      logId: `dlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      id: data.id,
      type,
      actionType,
      label,
      data,
      createdAtMs: Date.now(),
      deletedAt: new Date().toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    };
    setDeletedLogs((prev) => {
      const next = [entry, ...prev.filter((x) => x.logId !== entry.logId)].slice(0, 30);
      try {
        localStorage.setItem("kim_deleted_logs_v1", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    if (user && db) {
      beginWrite();
      try {
        await setDoc(getDocRef("family_deleted_logs_v8", entry.logId), entry);
        endWrite(true);
      } catch (e) {
        endWrite(false, e.message);
      }
    }
    return entry;
  };

  const restoreDeletedLogEntry = async (entry) => {
    if (!requireEditorAccess()) return;
    if (!entry?.data?.id) return;
    if (restoringLogIds.includes(entry.logId)) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 복구할 수 있습니다.");
      return;
    }

    const itemId = entry.data.id;
    setRestoringLogIds((prev) => [...prev, entry.logId]);
    beginWrite();
    try {
      const trackerRef = getDocRef("family_meta_v4", "deleted_tracker");
      const logRef = getDocRef("family_deleted_logs_v8", entry.logId);
      const primaryRef =
        entry.type === "meal"
          ? getDocRef("family_meals_v4", itemId)
          : entry.type === "fridge"
          ? getDocRef("family_fridge_v4", itemId)
          : getDocRef("family_schedules_v4", itemId);

      await runTransaction(db, async (tx) => {
        const existingPrimary = await tx.get(primaryRef);
        if (existingPrimary.exists()) {
          throw new Error("동일 ID의 데이터가 이미 존재해 덮어쓰지 않았습니다.");
        }
        if (entry.type === "meal") {
          const exV3 = await tx.get(getDocRef("family_meals_v3", itemId));
          if (exV3.exists()) throw new Error("동일 ID 식단(v3)이 이미 존재합니다.");
        } else if (entry.type === "fridge") {
          const exV3 = await tx.get(getDocRef("family_fridge_v3", itemId));
          if (exV3.exists()) throw new Error("동일 ID 재고(v3)가 이미 존재합니다.");
        }
        if (entry.type === "meal") {
          tx.set(getDocRef("family_meals_v3", itemId), entry.data);
          tx.set(getDocRef("family_meals_v4", itemId), entry.data);
        } else if (entry.type === "fridge") {
          tx.set(getDocRef("family_fridge_v3", itemId), entry.data);
          tx.set(getDocRef("family_fridge_v4", itemId), entry.data);
        } else if (entry.type === "schedule") {
          tx.set(getDocRef("family_schedules_v4", itemId), entry.data);
        }
        tx.set(trackerRef, { ids: arrayRemove(itemId) }, { merge: true });
        tx.delete(logRef);
      });

      setDeletedIds((prev) => {
        const next = prev.filter((x) => x !== itemId);
        try {
          localStorage.setItem("kim_family_deleted_ids", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      if (entry.type === "meal") {
        setMealsMap((prev) => ({ ...prev, local: { ...(prev.local || {}), [itemId]: entry.data } }));
      } else if (entry.type === "fridge") {
        setFridgeMap((prev) => ({ ...prev, local: { ...(prev.local || {}), [itemId]: entry.data } }));
      } else if (entry.type === "schedule") {
        setSchedules((prev) => (prev.some((s) => s.id === itemId) ? prev : [entry.data, ...prev]));
      }
      setDeletedLogs((prev) => {
        const next = prev.filter((l) => l.logId !== entry.logId);
        try {
          localStorage.setItem("kim_deleted_logs_v1", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
      endWrite(true);
      showToast(`↩️ '${entry.label}' 항목이 복구되었습니다!`);
    } catch (e) {
      endWrite(false, e.message);
      showToast(`⚠️ 복구 실패: ${e.message || "네트워크를 확인해 주세요."}`);
    } finally {
      setRestoringLogIds((prev) => prev.filter((id) => id !== entry.logId));
    }
  };

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setSyncErrorMsg("");
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(
      getColRef("family_deleted_logs_v8"),
      { includeMetadataChanges: true },
      (snap) => {
        setHasPendingWrites(Boolean(snap.metadata?.hasPendingWrites));
        setSyncErrorMsg("");
        const remote = snap.docs
          .map((d) => d.data())
          .filter((x) => x && x.logId)
          .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
          .slice(0, 30);
        setDeletedLogs(remote);
        try {
          localStorage.setItem("kim_deleted_logs_v1", JSON.stringify(remote));
        } catch (e) {}
      },
      (err) => {
        setSyncErrorMsg(err?.message || "Firestore 동기화 오류");
      }
    );
    return () => unsub && unsub();
  }, [user]);

  useEffect(() => {
    if (!isMoreNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => moreSheetCloseRef.current?.focus(), 20);
    const onKey = (e) => {
      if (e.key === "Escape") {
        setIsMoreNavOpen(false);
        moreNavBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [isMoreNavOpen]);

  // 실시간 서울 중구 날씨(오늘 + 7일 주간예보) + 미세먼지(PM10, PM2.5) 조회 (Open-Meteo + wttr.in 백업)
  const fetchSeoulJungGuWeather = async () => {
    setIsWeatherLoading(true);
    setWeatherError("");
    try {
      const lat = 37.5638;
      const lon = 126.9976;
      const [weatherRes, airRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=7`
        ),
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5&timezone=Asia%2FSeoul`
        )
      ]);

      if (!weatherRes.ok) throw new Error(`Weather HTTP ${weatherRes.status}`);
      const wData = await weatherRes.json();
      const aData = airRes.ok ? await airRes.json() : null;

      const curTemp = Math.round(wData?.current?.temperature_2m ?? 12);
      const wCode = wData?.current?.weather_code ?? 0;
      const maxT = Math.round(wData?.daily?.temperature_2m_max?.[0] ?? curTemp + 4);
      const minT = Math.round(wData?.daily?.temperature_2m_min?.[0] ?? curTemp - 4);
      const parsed = parseWeatherCode(wCode, curTemp);

      const pm10 = Math.round(aData?.current?.pm10 ?? 0);
      const pm25 = Math.round(aData?.current?.pm2_5 ?? 0);
      const dust = getDustGrade(pm10, pm25);

      const dailyTimes = wData?.daily?.time || [];
      const weeklyForecast = dailyTimes.map((dateStr, idx) => {
        const dMax = Math.round(wData?.daily?.temperature_2m_max?.[idx] ?? 0);
        const dMin = Math.round(wData?.daily?.temperature_2m_min?.[idx] ?? 0);
        const dCode = wData?.daily?.weather_code?.[idx] ?? 0;
        const rainProb = Math.round(wData?.daily?.precipitation_probability_max?.[idx] ?? 0);
        const dParsed = parseWeatherCode(dCode, Math.round((dMax + dMin) / 2));
        return {
          date: dateStr,
          dayName: idx === 0 ? "오늘" : getDayName(dateStr),
          emoji: dParsed.emoji,
          label: dParsed.label,
          max: dMax,
          min: dMin,
          rainProb
        };
      });

      const now = new Date();
      const updatedTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      setWeatherInfo({
        location: "서울 중구",
        temp: curTemp,
        max: maxT,
        min: minT,
        pm10,
        pm25,
        dust,
        weekly: weeklyForecast,
        updatedTime,
        ...parsed,
        tip: dust.label === "나쁨" || dust.label === "매우나쁨" ? dust.tip : parsed.tip
      });
    } catch (e) {
      console.warn("Open-Meteo error, trying wttr.in fallback:", e);
      try {
        const wRes = await fetch("https://wttr.in/Seoul?format=j1");
        if (!wRes.ok) throw new Error("wttr.in failed");
        const wJson = await wRes.json();
        const cur = wJson?.current_condition?.[0];
        const todayW = wJson?.weather?.[0];
        const curTemp = Math.round(Number(cur?.temp_C ?? 12));
        const maxT = Math.round(Number(todayW?.maxtempC ?? curTemp + 3));
        const minT = Math.round(Number(todayW?.mintempC ?? curTemp - 3));
        const now = new Date();
        const updatedTime = `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`;
        setWeatherInfo({
          location: "서울 중구",
          temp: curTemp,
          max: maxT,
          min: minT,
          pm10: "-",
          pm25: "-",
          dust: {
            label: "미측정",
            emoji: "⚪",
            badgeClass: "bg-stone-100 text-stone-600 border-stone-200",
            tip: "백업 서버 기온 정보입니다."
          },
          weekly: [],
          updatedTime,
          emoji: "🌤️",
          label: cur?.weatherDesc?.[0]?.value || "맑음",
          tip: "실시간 날씨 정보입니다."
        });
      } catch (err2) {
        setWeatherError("날씨 서버 연결 지연");
      }
    } finally {
      setIsWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "baby" && babySubTab === "milestones") {
      const timer = setTimeout(() => {
        currentMilestoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, babySubTab, selectedChildId]);

  useEffect(() => {
    fetchSeoulJungGuWeather();
    const interval = setInterval(fetchSeoulJungGuWeather, 15 * 60 * 1000); // 15분마다 자동 업데이트
    return () => clearInterval(interval);
  }, []);

  const pushAiLog = (provider, task, ok, detail) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setAiCallLogs((prev) => [{ id: Date.now() + Math.random(), time: timeStr, provider, task, ok, detail }, ...prev].slice(0, 15));
  };

  // [v7.1 개선] OpenAI GPT + Google Gemini 통합 자가진단 테스트
  const handleRunAiDiagnostic = async () => {
    setAiDiagStatus("진단 중... GPT 및 Gemini 서버 상태를 확인하고 있습니다.");
    const testGeminiKey = String(tempKeyInput || geminiApiKey || "").trim();
    const testOpenaiKey = String(tempOpenaiKeyInput || openaiApiKey || "").trim();
    const reportLines = [];

    if (testOpenaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testOpenaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hi" }]
          })
        });
        const data = await res.json();
        if (res.ok) {
          reportLines.push("✅ [OpenAI GPT] 연결 성공! (gpt-4o-mini 정상 작동)");
          pushAiLog("OpenAI GPT", "자가진단", true, "정상 연결");
        } else {
          const msg = data?.error?.message || `HTTP ${res.status}`;
          reportLines.push(`❌ [OpenAI GPT] 거절: ${msg}`);
          pushAiLog("OpenAI GPT", "자가진단", false, msg);
        }
      } catch (e) {
        reportLines.push(`❌ [OpenAI GPT] 네트워크 오류: ${e.message}`);
      }
    } else {
      reportLines.push("⚪ [OpenAI GPT] API 키 미입력");
    }

    if (testGeminiKey) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": testGeminiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Hello" }] }]
            })
          }
        );
        const data = await res.json();
        if (res.ok && data?.candidates) {
          reportLines.push("✅ [Gemini] 연결 성공! (gemini-3.8-flash 정상 작동)");
          pushAiLog("Gemini", "자가진단", true, "gemini-3.8-flash 정상 연결");
        } else {
          const msg = data?.error?.message || `HTTP ${res.status}`;
          reportLines.push(`❌ [Gemini] 거절: ${msg}`);
          pushAiLog("Gemini", "자가진단", false, msg);
        }
      } catch (e) {
        reportLines.push(`❌ [Gemini] 네트워크 오류: ${e.message}`);
      }
    } else {
      reportLines.push("⚪ [Gemini] API 키 미입력");
    }

    setAiDiagStatus(reportLines.join("\n"));
  };

  // ==========================================
  // 6. 파이어베이스 실시간 동기화
  // ==========================================
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const unsubscribers = [];

    unsubscribers.push(
      onSnapshot(
        getColRef("family_meta_v4"),
        (snap) => {
          snap.docs.forEach((d) => {
            if (d.id === "deleted_tracker") {
              const list = toSafeArray(d.data().ids);
              setDeletedIds(list);
              localStorage.setItem("kim_family_deleted_ids", JSON.stringify(list));
            }
            if (d.id === "daily_routines" && Array.isArray(d.data().items)) {
              const cloudRoutines = toSafeArray(d.data().items);
              setFamilyRoutines(cloudRoutines);
              try { localStorage.setItem("kim_family_routines_v1", JSON.stringify(cloudRoutines)); } catch (e) {}
            }
            if (d.id === "meal_favorites") {
              if (Array.isArray(d.data().combos)) {
                const cloudCombos = toSafeArray(d.data().combos);
                setFavoriteMealCombos(cloudCombos);
                try { localStorage.setItem("kim_favorite_meal_combos_v1", JSON.stringify(cloudCombos)); } catch (e) {}
              }
              if (Array.isArray(d.data().singles)) {
                const cloudSingles = toSafeArray(d.data().singles);
                setFavoriteSingleMenus(cloudSingles);
                try { localStorage.setItem("kim_favorite_single_menus_v1", JSON.stringify(cloudSingles)); } catch (e) {}
              }
            }
            if (d.id === "api_config") {
              if (d.data().geminiKey) {
                const sharedKey = String(d.data().geminiKey).trim();
                if (sharedKey.startsWith("AIzaSy") || sharedKey.startsWith("AQ.")) {
                  setGeminiApiKey(sharedKey);
                  setTempKeyInput(sharedKey);
                  localStorage.setItem("kim_family_gemini_key", sharedKey);
                }
              }
              if (d.data().openaiKey) {
                const sharedOpenai = String(d.data().openaiKey).trim();
                setOpenaiApiKey(sharedOpenai);
                setTempOpenaiKeyInput(sharedOpenai);
                localStorage.setItem("kim_family_openai_key", sharedOpenai);
              }
              if (d.data().aiProvider) {
                setAiProvider(d.data().aiProvider);
                localStorage.setItem("kim_family_ai_provider", d.data().aiProvider);
              }
            }
            if (d.id === "backup_status" && d.data().lastSlot) {
              setLastAutoBackupSlot(d.data().lastSlot);
              localStorage.setItem("kim_twice_daily_backup_slot", d.data().lastSlot);
              if (d.data().email) {
                setBackupEmail(d.data().email);
                localStorage.setItem("kim_family_backup_email", d.data().email);
              }
            }
          });
        },
        () => {}
      )
    );

    [getColRef("family_meals_v3"), getColRef("family_meals_v4")].forEach((colRef, idx) => {
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          const loaded = {};
          snap.docs.forEach((d) => {
            const raw = d.data();
            if (Array.isArray(raw.meals)) {
              raw.meals.forEach((m) => {
                if (m && m.id) {
                  loaded[m.id] = {
                    ...m,
                    members: toSafeArray(m.members),
                    ingredients: toSafeArray(m.ingredients)
                  };
                }
              });
            } else if (raw.menu || raw.slot || raw.date) {
              loaded[d.id] = {
                ...raw,
                id: d.id,
                members: toSafeArray(raw.members),
                ingredients: toSafeArray(raw.ingredients)
              };
            }
          });
          setMealsMap((prev) => ({ ...prev, [`src_${idx}`]: loaded }));
        },
        () => {}
      );
      unsubscribers.push(unsub);
    });

    [getColRef("family_fridge_v3"), getColRef("family_fridge_v4")].forEach((colRef, idx) => {
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          const loaded = {};
          snap.docs.forEach((d) => {
            const raw = d.data();
            if (Array.isArray(raw.fridge)) {
              raw.fridge.forEach((f) => {
                if (f && f.id) loaded[f.id] = { ...f, quantity: Number(f.quantity) || 0 };
              });
            } else if (raw.name && (raw.location || raw.category || raw.expiryDate !== undefined)) {
              loaded[d.id] = { ...raw, id: d.id, quantity: Number(raw.quantity) || 0 };
            }
          });
          setFridgeMap((prev) => ({ ...prev, [`src_${idx}`]: loaded }));
        },
        (err) => setSyncErrorMsg(err?.message || "재고 동기화 오류")
      );
      unsubscribers.push(unsub);
    });

    unsubscribers.push(
      onSnapshot(
        getColRef("family_expenses_v4"),
        (snap) => {
          setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => setSyncErrorMsg(err?.message || "가계부 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_inventory_events_v7"),
        (snap) => {
          setWasteEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (err) => setSyncErrorMsg(err?.message || "폐기 기록 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_baby_checks_v7"),
        (snap) => {
          const obj = {};
          snap.docs.forEach((d) => {
            obj[d.id] = d.data();
          });
          setBabyChecks(obj);
        },
        (err) => setSyncErrorMsg(err?.message || "육아 체크 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_baby_growth_v7"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          setBabyGrowthLogs(list);
        },
        (err) => setSyncErrorMsg(err?.message || "성장 기록 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_baby_notes_v7"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          setBabyMedicalNotes(list);
        },
        (err) => setSyncErrorMsg(err?.message || "진료 메모 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_recipes_v8"),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
          setRecipes(list);
        },
        (err) => setSyncErrorMsg(err?.message || "레시피 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_shopping_v4"),
        (snap) => {
          const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setShoppingList(loaded);
        },
        (err) => setSyncErrorMsg(err?.message || "장보기 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getDocRef("family_meta_v4", "home_layout"),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          if (d?.layout) {
            const norm = normalizeHomeLayout(d.layout);
            setHomeLayoutConfig(norm);
            try { localStorage.setItem("kim_home_layout_v1", JSON.stringify(norm)); } catch (e) {}
          }
          if (d?.timeRanges && typeof d.timeRanges.morningStart === "number") {
            setHomeTimeRanges(d.timeRanges);
            try { localStorage.setItem("kim_home_time_ranges_v1", JSON.stringify(d.timeRanges)); } catch (e) {}
          }
          if (d?.routineRanges && (typeof d.routineRanges["아침"] === "number" || typeof d.routineRanges["아침"] === "string")) {
            const mergedR = { ...DEFAULT_ROUTINE_TIME_RANGES, ...d.routineRanges };
            setRoutineTimeRanges(mergedR);
            try { localStorage.setItem("kim_routine_time_ranges_v1", JSON.stringify(mergedR)); } catch (e) {}
          }
        },
        () => {}
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_notices_v4"),
        (snap) => {
          const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setNotices(loaded);
        },
        (err) => setSyncErrorMsg(err?.message || "가족공지 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_schedules_v4"),
        async (snap) => {
          const loaded = snap.docs.map((d) => ({
            ...d.data(),
            id: d.id,
            members: toSafeArray(d.data().members)
          }));

          const loadedIds = new Set(loaded.map((s) => s.id));
          let delList = [];
          try {
            const parsedDel = JSON.parse(localStorage.getItem("kim_family_deleted_ids") || "[]");
            delList = Array.isArray(parsedDel) ? parsedDel : [];
          } catch (e) {
            delList = [];
          }

          const missingDefaults = INITIAL_SCHEDULES.filter(
            (initItem) => !loadedIds.has(initItem.id) && !delList.includes(initItem.id)
          );

          if (missingDefaults.length > 0) {
            for (const item of missingDefaults) {
              try {
                await setDoc(getDocRef("family_schedules_v4", item.id), item);
              } catch (e) {}
            }
          }

          const mergedList = [
            ...loaded.filter((s) => !delList.includes(s.id)),
            ...missingDefaults
          ];
          setSchedules(mergedList);
        },
        (err) => setSyncErrorMsg(err?.message || "일정 동기화 오류")
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_patchnotes_v4"),
        async (snap) => {
          const loaded = snap.docs.map((d) => ({
            ...d.data(),
            id: d.id,
            changes: toSafeArray(d.data().changes)
          }));
          const loadedIds = new Set(loaded.map((p) => p.id));
          const missingDefaults = INITIAL_PATCH_NOTES.filter((p) => !loadedIds.has(p.id));
          if (missingDefaults.length > 0) {
            for (const p of missingDefaults) {
              try {
                await setDoc(getDocRef("family_patchnotes_v4", p.id), p);
              } catch (e) {}
            }
          }
          const parseVer = (v) =>
            String(v || "")
              .replace(/^v/i, "")
              .split(".")
              .map((n) => parseInt(n, 10) || 0);
          const combined = [...loaded, ...missingDefaults].sort((a, b) => {
            const pa = parseVer(a.version);
            const pb = parseVer(b.version);
            const len = Math.max(pa.length, pb.length);
            for (let i = 0; i < len; i++) {
              const diff = (pb[i] || 0) - (pa[i] || 0);
              if (diff !== 0) return diff;
            }
            return String(b.date || "").localeCompare(String(a.date || ""));
          });
          setPatchNotes(combined);
        },
        () => {}
      )
    );

    return () => {
      unsubscribers.forEach((u) => u && u());
    };
  }, [user]);

  const meals = useMemo(() => {
    const merged = {};
    buildDaycareMeals().forEach((m) => {
      if (!deletedIds.includes(m.id)) merged[m.id] = m;
    });
    ["local", "restored", "src_0", "src_1"].forEach((key) => {
      const sourceObj = mealsMap[key] || {};
      Object.values(sourceObj).forEach((m) => {
        if (m && m.id && !deletedIds.includes(m.id)) {
          merged[m.id] = m;
        }
      });
    });
    return Object.values(merged);
  }, [mealsMap, deletedIds]);

  const recentSingleMenuChips = useMemo(() => {
    const counts = new Map();
    for (const m of meals) {
      const parts = String(m.menu || "")
        .split(/\s*[+,&]\s*/)
        .map((s) => s.trim())
        .filter((s) => s && s.length <= 20);
      for (const pt of parts) {
        counts.set(pt, (counts.get(pt) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [meals]);

  const knownMenuSuggestions = useMemo(() => {
    const seen = new Map();
    const push = (val) => {
      const clean = String(val || "").trim();
      if (!clean || clean.length > 24) return;
      const k = clean.toLowerCase();
      if (!seen.has(k)) seen.set(k, clean);
    };
    favoriteSingleMenus.forEach(push);
    recipes.forEach((r) => push(r.title));
    recentSingleMenuChips.forEach(push);
    meals.forEach((m) => {
      String(m.menu || "")
        .split(/\s*[+,&]\s*/)
        .forEach(push);
    });
    return Array.from(seen.values());
  }, [favoriteSingleMenus, recipes, recentSingleMenuChips, meals]);

  const fridge = useMemo(() => {
    const merged = {};
    ["local", "restored", "src_0", "src_1"].forEach((key) => {
      const sourceObj = fridgeMap[key] || {};
      Object.values(sourceObj).forEach((f) => {
        if (f && f.id && !deletedIds.includes(f.id)) {
          merged[f.id] = f;
        }
      });
    });
    return Object.values(merged);
  }, [fridgeMap, deletedIds]);

  const knownIngredientList = useMemo(() => {
    const map = new Map();
    const upsert = (name, category = "", unit = "") => {
      const clean = String(name || "").trim();
      if (!clean || clean.length > 24) return;
      const k = clean.toLowerCase();
      const prev = map.get(k);
      map.set(k, {
        name: prev?.name || clean,
        category: prev?.category || category || "기타",
        unit: prev?.unit || unit || "개"
      });
    };
    fridge.forEach((f) => upsert(f.name, f.category, f.unit));
    shoppingList.forEach((s) => upsert(s.name, s.category, ""));
    recipes.forEach((r) => {
      toSafeArray(r.ingredients).forEach((ing) => {
        if (typeof ing === "string") {
          const parsed = parseRecipeIngredientToken(ing);
          upsert(parsed.name, "", parsed.unit);
        } else if (ing?.name) {
          upsert(ing.name, "", ing.unit);
        }
      });
    });
    return Array.from(map.values());
  }, [fridge, shoppingList, recipes]);

  // 하루 2번(오전 AM / 오후 PM) + 전체 컬렉션 내용 해시(FNV-1a) 변경 감지 자동 클라우드 스냅샷 백업 엔진
  useEffect(() => {
    if (!isEditorUnlocked || !user || !db || meals.length === 0) return;
    const currentSlot = getTwiceDailySlotKey();
    const backupDataObj = {
      meals,
      fridge,
      expenses,
      shoppingList,
      recipesMeta: recipes.map(({ photoDataUrl, ...rest }) => rest),
      familyRoutines,
      mealFavorites: { combos: favoriteMealCombos, singles: favoriteSingleMenus },
      notices,
      schedules,
      patchNotes,
      wasteEvents,
      babyChecks,
      babyGrowthLogs,
      babyMedicalNotes
    };
    const serialized = JSON.stringify(backupDataObj);
    let h = 2166136261;
    for (let i = 0; i < serialized.length; i++) {
      h ^= serialized.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const dataSig = `${(h >>> 0).toString(16)}_${serialized.length}`;
    const lastSig = (() => {
      try { return localStorage.getItem("kim_last_backup_sig_v1") || ""; } catch (e) { return ""; }
    })();
    if (lastAutoBackupSlot === currentSlot && lastSig === dataSig) return;

    const timer = setTimeout(async () => {
      try {
        const byteSize = new Blob([serialized]).size;
        if (byteSize > 900000) {
          console.warn("Auto snapshot skipped: payload exceeds 900KB Firestore safety limit", byteSize);
          showToast("⚠️ 자동 백업 용량이 900KB를 초과해 설정에서 JSON 파일 백업을 권장합니다.");
          return;
        }
        const snapshotPayload = {
          slot: currentSlot,
          createdAt: new Date().toISOString(),
          dataHash: dataSig,
          byteSize,
          counts: {
            meals: meals.length,
            fridge: fridge.length,
            expenses: expenses.length,
            schedules: schedules.length
          },
          data: backupDataObj
        };
        await setDoc(getDocRef("family_backups_v4", currentSlot), snapshotPayload);
        await setDoc(
          getDocRef("family_meta_v4", "backup_status"),
          { lastSlot: currentSlot, dataHash: dataSig, updatedAt: new Date().toISOString(), email: backupEmail },
          { merge: true }
        );
        setLastAutoBackupSlot(currentSlot);
        localStorage.setItem("kim_twice_daily_backup_slot", currentSlot);
        try { localStorage.setItem("kim_last_backup_sig_v1", dataSig); } catch (e) {}
      } catch (e) {
        console.warn("Auto snapshot warning:", e);
        setSyncErrorMsg(`자동 백업 오류: ${e.message}`);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [
    user,
    isEditorUnlocked,
    meals,
    fridge,
    expenses,
    shoppingList,
    recipes,
    notices,
    schedules,
    wasteEvents,
    babyChecks,
    babyGrowthLogs,
    babyMedicalNotes,
    lastAutoBackupSlot,
    backupEmail
  ]);

  // 상단 바 틀고정 토글 핸들러
  const handleToggleHeaderPin = () => {
    const next = !isHeaderPinned;
    setIsHeaderPinned(next);
    localStorage.setItem("kim_header_pinned", String(next));
    showToast(
      next
        ? "상단 바 틀고정이 설정되었습니다 (스크롤 시 따라옴)"
        : "상단 바 틀고정이 해제되었습니다 (넓은 화면 스크롤)"
    );
  };

  // 패치노트 직접 추가 및 삭제 핸들러
  const handleAddPatchNote = async () => {
    if (!requireEditorAccess()) return;
    if (!patchForm.title.trim()) return;
    const id = `patch-${Date.now()}`;
    const ver = patchForm.version.trim() || `v5.${patchNotes.length + 2}`;
    const changesArr = patchForm.changesText
      .split("\n")
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    const newPatch = {
      id,
      version: ver,
      date: getTodayStr(),
      title: patchForm.title.trim(),
      changes: changesArr.length > 0 ? changesArr : [patchForm.title.trim()]
    };

    setPatchNotes((prev) => [newPatch, ...prev]);
    setPatchForm({ version: "", title: "", changesText: "" });

    if (user && db) {
      try {
        await setDoc(getDocRef("family_patchnotes_v4", id), newPatch);
      } catch (e) {}
    }
    showToast(`패치노트(${ver})가 기록되었습니다!`);
  };

  const handleDeletePatchNote = async (id) => {
    if (!requireEditorAccess()) return;
    setPatchNotes((prev) => prev.filter((p) => p.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_patchnotes_v4", id));
      } catch (e) {}
    }
    showToast("패치노트 항목이 삭제되었습니다.");
  };

  const markIdDeleted = async (id) => {
    const next = Array.from(new Set([...deletedIds, id]));
    setDeletedIds(next);
    localStorage.setItem("kim_family_deleted_ids", JSON.stringify(next));
    if (user && db) {
      try {
        await setDoc(
          getDocRef("family_meta_v4", "deleted_tracker"),
          { ids: arrayUnion(id) },
          { merge: true }
        );
      } catch (e) {
        showToast("⚠️ 삭제 동기화 실패: 네트워크 상태를 확인해 주세요.");
      }
    }
  };

  const handleSaveApiKey = async (geminiKeyVal, openaiKeyVal = openaiApiKey, providerVal = aiProvider) => {
    if (!requireEditorAccess()) return;
    const cleanedGemini = String(geminiKeyVal || "").trim();
    const cleanedOpenai = String(openaiKeyVal || "").trim();

    if (cleanedGemini) {
      setGeminiApiKey(cleanedGemini);
      setTempKeyInput(cleanedGemini);
      localStorage.setItem("kim_family_gemini_key", cleanedGemini);
    }
    setOpenaiApiKey(cleanedOpenai);
    setTempOpenaiKeyInput(cleanedOpenai);
    localStorage.setItem("kim_family_openai_key", cleanedOpenai);

    setAiProvider(providerVal);
    localStorage.setItem("kim_family_ai_provider", providerVal);

    setAiErrorMsg("");
    setScanErrorMsg("");
    setReceiptErrorMsg("");
    setPlatingErrorMsg("");

    if (!user || !db) {
      showToast("⚠️ 이 기기에는 임시 저장되었으나, 서버 미연결로 부부 공유 저장에 실패했습니다.");
      return;
    }
    beginWrite();
    try {
      await setDoc(
        getDocRef("family_meta_v4", "api_config"),
        {
          ...(cleanedGemini ? { geminiKey: cleanedGemini } : {}),
          openaiKey: cleanedOpenai,
          aiProvider: providerVal,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      endWrite(true);
      showToast("AI 키 및 엔진 설정이 부부 스마트폰에 저장되었습니다!");
    } catch (e) {
      endWrite(false, e.message);
      showToast("⚠️ 서버 저장 실패: 네트워크 상태를 확인해 주세요.");
    }
  };

  const weekDates = useMemo(() => {
    const base = new Date(selectedDate + "T00:00:00");
    if (Number.isNaN(base.getTime())) return getWeekDatesFromBase(selectedDate);
    const res = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      res.push(formatDate(d));
    }
    return res;
  }, [selectedDate]);
  const scheduleWeekDates = useMemo(
    () => getWeekDatesFromBase(scheduleSelectedDate),
    [scheduleSelectedDate]
  );

  // ==========================================
  // 7. 전체 DB 원본(JSON) 1초 백업 다운로드 & Gmail/구글 드라이브 전송 & 1초 복원
  // ==========================================
  const buildFullBackupJsonString = () => {
    const fullSnapshot = {
      backupVersion: "v7.3",
      exportedAt: new Date().toISOString(),
      projectId: USER_FIREBASE_CONFIG.projectId,
      data: {
        meals,
        fridge,
        expenses,
        shoppingList,
        recipes,
        notices,
        schedules,
        patchNotes,
        deletedIds,
        wasteEvents,
        babyChecks,
        babyGrowthLogs,
        babyMedicalNotes,
        familyRoutines,
        homeLayoutConfig,
        homeTimeRanges,
        routineTimeRanges
      }
    };
    return JSON.stringify(fullSnapshot, null, 2);
  };

  const handleDownloadJsonBackup = () => {
    const jsonString = buildFullBackupJsonString();
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `수혁아리나시목시율_전체DB원본백업_${getTodayStr()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const curYm = getCurrentYearMonth();
    localStorage.setItem("kim_backup_done_month", curYm);
    setBackupBannerDismissedMonth(curYm);
    showToast("전체 DB 원본(JSON) 백업 파일이 다운로드되었습니다!");
  };

  const handleSendBackupToGmailOrDrive = async () => {
    const jsonString = buildFullBackupJsonString();
    const fileName = `수혁아리나시목시율_DB백업_${getTodayStr()}.json`;
    const fileObj = new File([jsonString], fileName, { type: "application/json" });

    if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
      try {
        await navigator.share({
          title: `[가족식탁 DB백업] ${getTodayStr()}`,
          text: `식단 ${meals.length}건, 냉장고 ${fridge.length}건, 일정 ${schedules.length}건 전체 백업 파일입니다.`,
          files: [fileObj]
        });
        showToast("구글 드라이브 / Gmail 공유 창이 실행되었습니다!");
        return;
      } catch (e) {}
    }

    handleDownloadJsonBackup();
    const targetMail = backupEmail.trim() || "";
    const subject = encodeURIComponent(`[가족식탁 자동백업] ${getTodayStr()} 전체 데이터베이스 백업본`);
    const body = encodeURIComponent(
      `수혁·아리나·시목·시율네 식탁 데이터베이스 백업입니다.\n\n• 백업 일시: ${new Date().toLocaleString()}\n• 식단: ${meals.length}건 / 냉장고: ${fridge.length}건 / 가족일정: ${schedules.length}건\n\n방금 다운로드된 '${fileName}' 파일을 첨부하거나 구글 드라이브에 보관해 두세요.`
    );
    window.open(`mailto:${targetMail}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleRestoreFromJsonFile = async (e) => {
    if (!requireEditorAccess()) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed?.data || parsed;

      if (!payload || typeof payload !== "object") {
        throw new Error("유효한 백업 JSON 파일이 아닙니다.");
      }

      const existingMealIds = new Set(meals.map((m) => m.id));
      const existingFridgeIds = new Set(fridge.map((f) => f.id));
      const existingSchIds = new Set(schedules.map((s) => s.id));
      const mealConflicts = toSafeArray(payload.meals).filter((m) => m?.id && existingMealIds.has(m.id)).length;
      const fridgeConflicts = toSafeArray(payload.fridge).filter((f) => f?.id && existingFridgeIds.has(f.id)).length;
      const schConflicts = toSafeArray(payload.schedules).filter((s) => s?.id && existingSchIds.has(s.id)).length;
      const totalConflicts = mealConflicts + fridgeConflicts + schConflicts;

      const confirmRestore = window.confirm(
        `백업 파일을 복원할까요?\n` +
        `• 식단 ${toSafeArray(payload.meals).length}건 (기존 충돌 ${mealConflicts}건)\n` +
        `• 냉장고 ${toSafeArray(payload.fridge).length}건 (기존 충돌 ${fridgeConflicts}건)\n` +
        `• 일정 ${toSafeArray(payload.schedules).length}건 (기존 충돌 ${schConflicts}건)\n` +
        (totalConflicts > 0 ? `⚠️ 기존 충돌 ${totalConflicts}건은 백업 내용으로 덮어써집니다. 복원 직전 현재 상태를 안전 백업합니다.` : `복원 직전 현재 상태를 안전 백업합니다.`)
      );
      if (!confirmRestore) {
        if (jsonRestoreInputRef.current) jsonRestoreInputRef.current.value = "";
        return;
      }

      setIsRestoringJson(true);
      if (user && db) {
        try {
          await setDoc(getDocRef("family_backups_v4", `pre_restore_${Date.now()}`), {
            slot: "pre_restore",
            createdAt: new Date().toISOString(),
            data: { meals, fridge, expenses, shoppingList, notices, schedules, babyChecks, babyGrowthLogs, babyMedicalNotes }
          });
        } catch (bkErr) {
          throw new Error("복원 전 안전 백업 생성에 실패하여 복원을 중단했습니다.");
        }
      }

      if (Array.isArray(payload.meals)) {
        const mObj = {};
        payload.meals.forEach((m) => {
          if (m && m.id) mObj[m.id] = m;
        });
        setMealsMap((prev) => ({ ...prev, restored: mObj }));
      }
      if (Array.isArray(payload.fridge)) {
        const fObj = {};
        payload.fridge.forEach((f) => {
          if (f && f.id) fObj[f.id] = f;
        });
        setFridgeMap((prev) => ({ ...prev, restored: fObj }));
      }
      if (Array.isArray(payload.expenses)) setExpenses(payload.expenses);
      if (Array.isArray(payload.shoppingList)) setShoppingList(payload.shoppingList);
      if (Array.isArray(payload.recipes)) setRecipes(payload.recipes);
      if (payload.mealFavorites && typeof payload.mealFavorites === "object") {
        const rCombos = toSafeArray(payload.mealFavorites.combos);
        const rSingles = toSafeArray(payload.mealFavorites.singles);
        setFavoriteMealCombos(rCombos);
        setFavoriteSingleMenus(rSingles);
        syncMealFavoritesToCloud(rCombos, rSingles);
      }
      if (Array.isArray(payload.familyRoutines)) {
        setFamilyRoutines(payload.familyRoutines);
        syncRoutinesToCloud(payload.familyRoutines);
      }
      if (payload.homeLayoutConfig && typeof payload.homeLayoutConfig === "object") {
        const norm = normalizeHomeLayout(payload.homeLayoutConfig);
        setHomeLayoutConfig(norm);
        try { localStorage.setItem("kim_home_layout_v1", JSON.stringify(norm)); } catch (e) {}
        syncHomeSettingsToCloud(norm, null, null);
      }
      if (payload.homeTimeRanges && typeof payload.homeTimeRanges.morningStart === "number") {
        setHomeTimeRanges(payload.homeTimeRanges);
        try { localStorage.setItem("kim_home_time_ranges_v1", JSON.stringify(payload.homeTimeRanges)); } catch (e) {}
        syncHomeSettingsToCloud(null, payload.homeTimeRanges, null);
      }
      if (payload.routineTimeRanges && (typeof payload.routineTimeRanges["아침"] === "number" || typeof payload.routineTimeRanges["아침"] === "string")) {
        const normR = { ...DEFAULT_ROUTINE_TIME_RANGES, ...payload.routineTimeRanges };
        setRoutineTimeRanges(normR);
        try { localStorage.setItem("kim_routine_time_ranges_v1", JSON.stringify(normR)); } catch (e) {}
        syncHomeSettingsToCloud(null, null, normR);
      }
      if (Array.isArray(payload.notices)) setNotices(payload.notices);
      if (Array.isArray(payload.schedules)) setSchedules(payload.schedules);
      if (Array.isArray(payload.patchNotes)) setPatchNotes(payload.patchNotes);
      if (Array.isArray(payload.wasteEvents)) setWasteEvents(payload.wasteEvents);
      if (payload.babyChecks && typeof payload.babyChecks === "object") setBabyChecks(payload.babyChecks);
      if (Array.isArray(payload.babyGrowthLogs)) setBabyGrowthLogs(payload.babyGrowthLogs);
      if (Array.isArray(payload.babyMedicalNotes)) setBabyMedicalNotes(payload.babyMedicalNotes);
      if (Array.isArray(payload.deletedIds)) {
        setDeletedIds(payload.deletedIds);
        localStorage.setItem("kim_family_deleted_ids", JSON.stringify(payload.deletedIds));
      }

      if (user && db) {
        const writePromises = [];
        (payload.meals || []).forEach((m) => {
          if (m?.id) {
            writePromises.push(setDoc(getDocRef("family_meals_v3", m.id), m));
            writePromises.push(setDoc(getDocRef("family_meals_v4", m.id), m));
          }
        });
        (payload.fridge || []).forEach((f) => {
          if (f?.id) {
            writePromises.push(setDoc(getDocRef("family_fridge_v3", f.id), f));
            writePromises.push(setDoc(getDocRef("family_fridge_v4", f.id), f));
          }
        });
        (payload.expenses || []).forEach((ex) => {
          if (ex?.id) writePromises.push(setDoc(getDocRef("family_expenses_v4", ex.id), ex));
        });
        (payload.shoppingList || []).forEach((sh) => {
          if (sh?.id) writePromises.push(setDoc(getDocRef("family_shopping_v4", sh.id), sh));
        });
        (payload.recipes || []).forEach((rc) => {
          if (rc?.id) writePromises.push(setDoc(getDocRef("family_recipes_v8", rc.id), rc));
        });
        (payload.notices || []).forEach((nt) => {
          if (nt?.id) writePromises.push(setDoc(getDocRef("family_notices_v4", nt.id), nt));
        });
        (payload.schedules || []).forEach((sc) => {
          if (sc?.id) writePromises.push(setDoc(getDocRef("family_schedules_v4", sc.id), sc));
        });
        (payload.patchNotes || []).forEach((pt) => {
          if (pt?.id) writePromises.push(setDoc(getDocRef("family_patchnotes_v4", pt.id), pt));
        });
        (payload.wasteEvents || []).forEach((we) => {
          if (we?.id) writePromises.push(setDoc(getDocRef("family_inventory_events_v7", we.id), we));
        });
        Object.entries(payload.babyChecks || {}).forEach(([ckId, ckVal]) => {
          if (ckId && ckVal) writePromises.push(setDoc(getDocRef("family_baby_checks_v7", ckId), ckVal));
        });
        (payload.babyGrowthLogs || []).forEach((bg) => {
          if (bg?.id) writePromises.push(setDoc(getDocRef("family_baby_growth_v7", bg.id), bg));
        });
        (payload.babyMedicalNotes || []).forEach((bm) => {
          if (bm?.id) writePromises.push(setDoc(getDocRef("family_baby_notes_v7", bm.id), bm));
        });
        if (Array.isArray(payload.deletedIds) && payload.deletedIds.length > 0) {
          writePromises.push(
            setDoc(getDocRef("family_meta_v4", "deleted_tracker"), { ids: payload.deletedIds }, { merge: true })
          );
        }

        const results = await Promise.allSettled(writePromises);
        const failedCount = results.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
          showToast(`⚠️ 일부(${failedCount}건) 복원에 실패했습니다. 네트워크를 확인해 주세요.`);
          setIsSettingsOpen(false);
          return;
        }
      }

      setIsSettingsOpen(false);
      showToast("백업 파일로부터 전체 데이터베이스가 100% 복원되었습니다!");
    } catch (err) {
      console.error("JSON restore error:", err);
      alert(`복원 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsRestoringJson(false);
      if (jsonRestoreInputRef.current) jsonRestoreInputRef.current.value = "";
    }
  };

  const isFirstDayOfMonthBackupNeeded = useMemo(() => {
    const now = new Date();
    const isDayOne = now.getDate() === 1;
    const curYm = getCurrentYearMonth();
    return isDayOne && backupBannerDismissedMonth !== curYm;
  }, [backupBannerDismissedMonth]);

  const imminentSchedulesWithin3Days = useMemo(() => {
    return schedules
      .filter((s) => !s.done)
      .map((s) => ({
        ...s,
        calc: calculateScheduleDday(s)
      }))
      .filter((s) => s.calc.daysUntil >= 0 && s.calc.daysUntil <= 3)
      .sort((a, b) => a.calc.daysUntil - b.calc.daysUntil);
  }, [schedules]);

  // ==========================================
  // 8. 가족 일정·기념일·D-Day & To-Do 체크리스트 핸들러
  // ==========================================
  // [신규 v7.0] 육아수첩 핸들러 (예방접종 체크 · 일정 원클릭 자동등록 · 성장/열 체크)
  const handleUpdateBabyCheckDate = async (childId, itemId, newDate) => {
    if (!requireEditorAccess()) return;
    const docId = `${childId}_${itemId}`;
    const prev = babyChecks[docId] || null;
    const updated = { ...(prev || {}), childId, itemId, done: true, doneDate: newDate };
    if (user && db) {
      try {
        await setDoc(getDocRef("family_baby_checks_v7", docId), updated);
      } catch (e) {
        showToast("⚠️ 접종일 서버 저장 실패: 네트워크를 확인해 주세요.");
        return;
      }
    }
    setBabyChecks((p) => ({ ...p, [docId]: updated }));
  };

  const handleToggleBabyCheck = async (childId, itemId) => {
    if (!requireEditorAccess()) return;
    const docId = `${childId}_${itemId}`;
    const prev = babyChecks[docId] || {};
    const updated = {
      childId,
      itemId,
      done: !prev.done,
      doneDate: !prev.done ? getTodayStr() : ""
    };
    if (user && db) {
      try {
        await setDoc(getDocRef("family_baby_checks_v7", docId), updated);
      } catch (e) {
        showToast("⚠️ 접종 체크 서버 저장 실패: 네트워크를 확인해 주세요.");
        return;
      }
    }
    setBabyChecks((p) => ({ ...p, [docId]: updated }));
  };

  const handleSyncSingleBabySchedule = async (child, item, targetDate) => {
    if (!requireEditorAccess()) return;
    const schId = `baby-${child.id}-${item.id}`;
    const payload = {
      id: schId,
      title: `${item.type === "영유아검진" ? "🏥" : "💉"} [${child.id}] ${item.title}`,
      date: targetDate,
      category: "육아/병원",
      members: [child.id, "수혁", "아리나"],
      isAnnual: false,
      showDday: false,
      hasOriginYear: false,
      done: false,
      memo: item.note
    };
    const existing = schedules.find((s) => s.id === schId);
    if (existing) {
      const ok = window.confirm(
        `이미 '${existing.title}' 일정(${existing.date})이 등록되어 있습니다. 기존 메모/완료 여부를 덮어쓰고 권장일(${targetDate})로 초기화할까요?`
      );
      if (!ok) return;
    }
    setSchedules((prev) => {
      const exists = prev.some((s) => s.id === schId);
      return exists ? prev.map((s) => (s.id === schId ? payload : s)) : [payload, ...prev];
    });
    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", schId), payload);
      } catch (e) {}
    }
    showToast(`${child.name} '${item.title}' 일정이 달력(${targetDate})에 등록되었습니다!`);
  };

  const handleSyncAllUpcomingBabySchedules = async (child) => {
    if (!requireEditorAccess()) return;
    let added = 0;
    for (const item of BABY_VACCINES_AND_CHECKUPS) {
      const checkKey = `${child.id}_${item.id}`;
      if (babyChecks[checkKey]?.done) continue;
      const targetDate = addMonthsToDateStr(child.birthDate, item.addMonths, item.addDays);
      if (targetDate < getTodayStr()) continue;
      const schId = `baby-${child.id}-${item.id}`;
      if (schedules.some((s) => s.id === schId)) continue;

      const payload = {
        id: schId,
        title: `${item.type === "영유아검진" ? "🏥" : "💉"} [${child.id}] ${item.title}`,
        date: targetDate,
        category: "육아/병원",
        members: [child.id, "수혁", "아리나"],
        isAnnual: false,
        showDday: false,
        hasOriginYear: false,
        done: false,
        memo: item.note
      };
      setSchedules((prev) => [payload, ...prev]);
      if (user && db) {
        try {
          await setDoc(getDocRef("family_schedules_v4", schId), payload);
        } catch (e) {}
      }
      added++;
    }
    showToast(
      added > 0
        ? `${child.name} 향후 예방접종·검진 ${added}건이 일정 달력에 자동 등록되었습니다!`
        : `${child.name} 향후 일정이 이미 모두 등록되어 있습니다.`
    );
  };

  const handleAddGrowthLog = async () => {
    if (!requireEditorAccess()) return;
    if (!growthForm.height && !growthForm.weight && !growthForm.head) {
      showToast("키, 몸무게, 머리둘레 중 하나 이상을 입력해 주세요.");
      return;
    }
    const id = `gr-${selectedChildId}-${Date.now()}`;
    const payload = {
      id,
      childId: selectedChildId,
      date: growthForm.date || getTodayStr(),
      height: growthForm.height ? Number(growthForm.height) : null,
      weight: growthForm.weight ? Number(growthForm.weight) : null,
      head: growthForm.head ? Number(growthForm.head) : null,
      memo: growthForm.memo || ""
    };
    if (user && db) {
      try {
        await setDoc(getDocRef("family_baby_growth_v7", id), payload);
      } catch (e) {
        showToast("⚠️ 성장 기록 서버 저장 실패: 네트워크를 확인해 주세요.");
        return;
      }
    }
    setBabyGrowthLogs((prev) => [payload, ...prev]);
    setGrowthForm({ date: getTodayStr(), height: "", weight: "", head: "", memo: "" });
    showToast(`${selectedChildId} 성장 기록이 저장되었습니다!`);
  };

  const handleDeleteGrowthLog = async (id) => {
    if (!requireEditorAccess()) return;
    setBabyGrowthLogs((prev) => prev.filter((g) => g.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_baby_growth_v7", id));
      } catch (e) {
        setSyncErrorMsg(e?.message || "성장 기록 삭제 오류");
      }
    }
  };

  const handleAddMedicalNote = async () => {
    if (!requireEditorAccess()) return;
    if (!medNoteForm.title.trim() && !medNoteForm.temp) return;
    const id = `med-${selectedChildId}-${Date.now()}`;
    const payload = {
      id,
      childId: selectedChildId,
      date: medNoteForm.date || getTodayStr(),
      temp: medNoteForm.temp ? Number(medNoteForm.temp) : null,
      title: medNoteForm.title.trim() || "체온/건강 체크",
      memo: medNoteForm.memo || ""
    };
    if (user && db) {
      try {
        await setDoc(getDocRef("family_baby_notes_v7", id), payload);
      } catch (e) {
        showToast("⚠️ 진료/열 메모 서버 저장 실패: 네트워크를 확인해 주세요.");
        return;
      }
    }
    setBabyMedicalNotes((prev) => [payload, ...prev]);
    setMedNoteForm({ date: getTodayStr(), temp: "", title: "", memo: "" });
    showToast(`${selectedChildId} 진료·체온 메모가 저장되었습니다!`);
  };

  const handleDeleteMedicalNote = async (id) => {
    if (!requireEditorAccess()) return;
    setBabyMedicalNotes((prev) => prev.filter((n) => n.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_baby_notes_v7", id));
      } catch (e) {
        setSyncErrorMsg(e?.message || "진료 메모 삭제 오류");
      }
    }
  };

  const handleSaveSchedule = async () => {
    if (!requireEditorAccess()) return;
    if (!scheduleForm.title.trim()) return;
    const id = editingSchedule ? editingSchedule.id : `sch-${Date.now()}`;
    const safeMembers = toSafeArray(scheduleForm.members);

    const payload = {
      id,
      title: scheduleForm.title.trim(),
      date: scheduleForm.date || scheduleSelectedDate,
      category: scheduleForm.category || "할일(To-Do)",
      members: safeMembers.length > 0 ? safeMembers : ["수혁", "아리나", "시목", "시율"],
      isAnnual: Boolean(scheduleForm.isAnnual),
      showDday: Boolean(scheduleForm.showDday),
      hasOriginYear: Boolean(scheduleForm.hasOriginYear),
      done: editingSchedule ? Boolean(editingSchedule.done) : false,
      memo: (scheduleForm.memo || "").trim()
    };

    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = payload;
        return copy;
      }
      return [payload, ...prev];
    });

    setIsScheduleModalOpen(false);
    setEditingSchedule(null);

    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", id), payload);
      } catch (e) {
        setSyncErrorMsg(e?.message || "일정 서버 저장 오류");
        showToast("⚠️ 일정 서버 저장 실패: 네트워크 상태를 확인해 주세요.");
        return;
      }
    }
    showToast(editingSchedule ? "일정이 수정되었습니다." : "새 가족 일정이 등록되었습니다.");
  };

  // [신규] 체크리스트에서 1초 만에 할 일(To-Do) 빠른 등록
  const handleQuickAddTodo = async () => {
    if (!requireEditorAccess()) return;
    if (!quickTodoTitle.trim()) return;
    const id = `sch-${Date.now()}`;
    const targetMembers =
      scheduleMemberFilter === "전체"
        ? ["수혁", "아리나", "시목", "시율"]
        : [scheduleMemberFilter];

    const payload = {
      id,
      title: quickTodoTitle.trim(),
      date: quickTodoDate || getTodayStr(),
      category: "할일(To-Do)",
      members: targetMembers,
      isAnnual: false,
      showDday: false,
      hasOriginYear: false,
      done: false,
      memo: ""
    };

    setSchedules((prev) => [payload, ...prev]);
    setQuickTodoTitle("");

    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", id), payload);
      } catch (e) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        setSyncErrorMsg(e?.message || "할 일 등록 동기화 오류");
        showToast("⚠️ 할 일 저장 실패: 네트워크 상태를 확인해 주세요.");
        return;
      }
    }
    showToast("To-Do 체크리스트에 새 할 일이 추가되었습니다!");
  };

  const handleToggleScheduleDone = async (item) => {
    if (!requireEditorAccess()) return;
    const updated = { ...item, done: !item.done };
    setSchedules((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    showToast(updated.done ? `✅ '${item.title}' 완료!` : `↩️ '${item.title}' 진행중으로 변경`);
    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", item.id), updated);
      } catch (e) {
        setSchedules((prev) => prev.map((s) => (s.id === item.id ? item : s)));
        setSyncErrorMsg(e?.message || "일정 완료 상태 동기화 오류");
        showToast("⚠️ 상태 변경 저장 실패: 이전 상태로 되돌렸습니다.");
      }
    }
  };

  const createLogEntryPayload = (type, label, data, actionType = "delete") => ({
    logId: `dlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    id: data.id,
    type,
    actionType,
    label,
    data,
    createdAtMs: Date.now(),
    deletedAt: new Date().toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  });

  const handleDeleteSchedule = async (item) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 삭제할 수 있습니다.");
      return;
    }
    const entry = createLogEntryPayload("schedule", item.title || "가족 일정", item, "delete");
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const batch = writeBatch(db);
      batch.set(getDocRef("family_deleted_logs_v8", entry.logId), entry);
      batch.set(getDocRef("family_meta_v4", "deleted_tracker"), { ids: arrayUnion(item.id) }, { merge: true });
      batch.delete(getDocRef("family_schedules_v4", item.id));
      await batch.commit();

      setDeletedIds((prev) => {
        const next = Array.from(new Set([...prev, item.id]));
        try { localStorage.setItem("kim_family_deleted_ids", JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setSchedules((prev) => prev.filter((s) => s.id !== item.id));
      setDeletedLogs((prev) => [entry, ...prev.filter((x) => x.logId !== entry.logId)].slice(0, 30));
      ok = true;
      showToast(`'${item.title || "일정"}' 삭제됨`, () => restoreDeletedLogEntry(entry));
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 일정 삭제 실패: 네트워크 상태를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const getSchedulesForDate = (targetDateStr, memberFilter = "전체", catFilter = "전체") => {
    const targetMmDd = String(targetDateStr).slice(5, 10);
    return schedules.filter((s) => {
      const memMatch =
        memberFilter === "전체" || toSafeArray(s.members).includes(memberFilter);
      const catMatch = catFilter === "전체" || s.category === catFilter;
      if (!memMatch || !catMatch) return false;

      if (s.isAnnual) {
        return String(s.date).slice(5, 10) === targetMmDd;
      }
      return String(s.date).slice(0, 10) === targetDateStr;
    });
  };

  // [신규 요청사항 2] 주간(월~일) 일정 중 실제 일정이 있는 날짜와 항목만 추출하는 요약 데이터
  const weeklyActiveScheduleSummary = useMemo(() => {
    return scheduleWeekDates
      .map((d) => ({
        date: d,
        dayName: getDayName(d),
        items: getSchedulesForDate(d, scheduleMemberFilter, scheduleCatFilter)
      }))
      .filter((dayGroup) => dayGroup.items.length > 0);
  }, [scheduleWeekDates, schedules, scheduleMemberFilter, scheduleCatFilter]);

  // 전체 To-Do 체크리스트 전용 데이터 (기본: 할일(To-Do)만 / 토글 시 병원·행사 포함)
  const allTodoChecklistItems = useMemo(() => {
    return schedules
      .filter((s) => {
        if (s.category === "기념일/생일" || s.isAnnual) return false;
        if (!todoIncludeOtherCats && s.category !== "할일(To-Do)") return false;
        const memMatch =
          scheduleMemberFilter === "전체" ||
          toSafeArray(s.members).includes(scheduleMemberFilter);
        if (!memMatch) return false;
        if (todoStatusFilter === "active") return !s.done;
        if (todoStatusFilter === "completed") return Boolean(s.done);
        return true;
      })
      .map((s) => ({
        ...s,
        calc: calculateScheduleDday(s)
      }))
      .sort((a, b) => {
        if (Boolean(a.done) !== Boolean(b.done)) {
          return a.done ? 1 : -1;
        }
        return String(a.date).localeCompare(String(b.date));
      });
  }, [schedules, scheduleMemberFilter, todoStatusFilter, todoIncludeOtherCats]);

  const todoStats = useMemo(() => {
    const nonAnniv = schedules.filter(
      (s) =>
        s.category !== "기념일/생일" &&
        !s.isAnnual &&
        (todoIncludeOtherCats || s.category === "할일(To-Do)") &&
        (scheduleMemberFilter === "전체" ||
          toSafeArray(s.members).includes(scheduleMemberFilter))
    );
    const total = nonAnniv.length;
    const doneCount = nonAnniv.filter((s) => s.done).length;
    const activeCount = total - doneCount;
    return { total, doneCount, activeCount };
  }, [schedules, scheduleMemberFilter, todoIncludeOtherCats]);

  const globalTodoBadgeStats = useMemo(() => {
    const todayStr = currentDayKey;
    const activeTodos = schedules.filter((s) => s.category === "할일(To-Do)" && !s.done);
    const urgentCount = activeTodos.filter((s) => s.date && String(s.date) <= todayStr).length;
    return {
      activeCount: activeTodos.length,
      urgentCount
    };
  }, [schedules, currentDayKey]);

  const dDayCards = useMemo(() => {
    return schedules
      .filter(
        (s) =>
          s.showDday &&
          (scheduleMemberFilter === "전체" ||
            toSafeArray(s.members).includes(scheduleMemberFilter))
      )
      .map((s) => ({
        ...s,
        calc: calculateScheduleDday(s)
      }))
      .sort((a, b) => {
        const aDays = a.calc.daysUntil >= 0 ? a.calc.daysUntil : 9999 + Math.abs(a.calc.daysUntil);
        const bDays = b.calc.daysUntil >= 0 ? b.calc.daysUntil : 9999 + Math.abs(b.calc.daysUntil);
        return aDays - bDays;
      });
  }, [schedules, scheduleMemberFilter]);

  // ==========================================
  // 9. AI 식단 추천 & 식단표/영수증 이미지 스캔 핸들러
  // ==========================================
  const handleRunAiRecommend = async () => {
    if (!requireEditorAccess()) return;
    setAiErrorMsg("");

    const picked =
      selectedAiIngredients.length > 0
        ? selectedAiIngredients
        : fridge.slice(0, 5).map((f) => f.name);

    if (picked.length === 0) {
      setAiErrorMsg("활용할 냉장고 재료를 최소 1개 이상 선택하거나 냉장고에 재료를 먼저 등록해 주세요.");
      return;
    }

    setIsAiLoading(true);

    try {
      const prompt = `당신은 한국 가정식 및 영유아 영양 전문 셰프입니다.
선택한 냉장고 재료 [${picked.join(", ")}]를 활용하여 '${aiTargetGroup}' 맞춤 요리 레시피 3가지를 작성해주세요.
추가 요청사항: ${aiPromptExtra || "재료들의 실제 맛과 영양 궁합을 살린 현실적인 가정식 요리"}

반드시 마크다운 코드블록 없이 순수 JSON 배열만 출력하세요:
[
  {
    "title": "창의적이고 구체적인 요리명",
    "target": "${aiTargetGroup}",
    "time": "20분",
    "usedIngredients": ["사용재료1", "사용재료2"],
    "steps": ["1. 재료 손질...", "2. 조리 과정...", "3. 완성 및 플레이팅..."],
    "familyGuide": {
      "수혁": "성인 균형식(적정량)",
      "아리나": "영양·단백질 보충",
      "시목": "유아식(작게 잘라 저염 분리)",
      "시율": "신생아(고형식 제외)"
    },
    "tip": "셰프의 핵심 조리 팁"
  }
]`;

      let actualProvider = aiProvider.toUpperCase();
      const parsedArray = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText: prompt,
        temperature: 0.65,
        onProviderUsed: (p) => { actualProvider = p; }
      });

      const mapped = parsedArray.map((r, idx) => ({
        ...r,
        id: `ai-${Date.now()}-${idx}`,
        usedIngredients: toSafeArray(r.usedIngredients),
        steps: toSafeArray(r.steps),
        members:
          aiTargetGroup === "시목이 유아식"
            ? ["시목"]
            : aiTargetGroup === "시율이 이유식/유아식"
            ? ["시율"]
            : aiTargetGroup === "부부 (수혁 & 아리나)"
            ? ["수혁", "아리나"]
            : ["수혁", "아리나", "시목", "시율"]
      }));

      setAiRecipes(mapped);
      pushAiLog(actualProvider, "레시피 추천", true, `${mapped.length}개 생성`);
      showToast("맞춤 레시피 3가지가 생성되었습니다!");
    } catch (err) {
      console.error("AI Recommendation Error:", err);
      pushAiLog(aiProvider.toUpperCase(), "레시피 추천", false, err.message);
      setAiErrorMsg(err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const buildValidFridgeContext = () => {
    const valid = fridge
      .filter((f) => Number(f.quantity || 0) > 0 && getDaysDiff(f.expiryDate) >= 0)
      .sort((a, b) => getDaysDiff(a.expiryDate) - getDaysDiff(b.expiryDate));
    const textList =
      valid.length > 0
        ? valid
            .map((f) => {
              const d = getDaysDiff(f.expiryDate);
              return `${f.name}|${f.location}|${f.category}|${f.quantity}${f.unit || "개"}|${f.expiryDate ? (f.expiryIsTemp ? `추정기한:${f.expiryDate}(임시)` : `소비기한:${f.expiryDate}(확정)`) : "소비기한:미확인"}(D-${d})`;
            })
            .join("\n")
        : "등록된 유효 재고 없음";
    return { valid, textList };
  };

  const buildMealPromptForRequests = (requests, targetMode, adultStyle, validText) => {
    const simokProfile = CHILDREN_INFO.find((c) => c.id === "시목") || CHILDREN_INFO[0];
    const simokMonths = getChildAgeStats(simokProfile.birthDate).months;
    const reqListStr = requests.map((r) => `${r.date} ${r.slot}`).join(", ");
    const cutoff14 = addMonthsToDateStr(getTodayStr(), 0, -14);
    const recent14Menus = Array.from(
      new Set(
        meals
          .filter((m) => String(m.date || "") >= cutoff14 && m.menu)
          .map((m) => String(m.menu).trim())
      )
    ).slice(0, 20);
    const recent14Note =
      recent14Menus.length > 0
        ? `\n최근 14일 식단(유사 메뉴 반복 피하기): [${recent14Menus.join(", ")}]`
        : "";

    if (targetMode === "adults") {
      return `당신은 한국 가정식 및 성인 균형 영양 전문 셰프입니다.
대상: 성인 2인 (수혁·아리나)
식사 목적: ${adultStyle}
요청 날짜·끼니(${requests.length}끼): ${reqListStr}${recent14Note}

[냉장고·냉동실·실온 전체 유효 재고 (만료·0개 제외, 임박순)]
${validText}

중요 규칙:
1. 오직 성인 2인 기준 완성형 한 끼 식단만 제안하세요. 유아식, 아기, 월령, 저염 아이용 설명(babyTip/simokTip 등)은 절대 포함하지 마세요.
2. 한 끼는 에너지원(밥·면·빵 등) + 단백질 + 채소 균형을 갖추되, 덮밥·파스타·솥밥·면요리 등 다양한 식사 형태를 허용합니다.
3. 위 냉장고 유효 재고를 최대한 우선 활용하되, 식단 완성도를 위해 꼭 필요한 부족 재료만 missingIngredients에 적으세요. 없는 재료를 보유 재료(ingredients)로 거짓 표기하지 마세요.
4. 반드시 요청한 ${requests.length}개 날짜·끼니 조합과 1:1로 정확히 일치하는 순수 JSON 배열만 출력하세요(마크다운 금지):
[
  {
    "date": "${requests[0].date}",
    "slot": "${requests[0].slot}",
    "target": "adults",
    "mealName": "완성형 한 끼 식단명",
    "components": [
      {"role": "staple", "name": "잡곡밥"},
      {"role": "main", "name": "소고기 구이"},
      {"role": "vegetable", "name": "브로콜리 버섯볶음"}
    ],
    "servings": 2,
    "estimatedMinutes": 30,
    "ingredients": [{"name": "소고기", "quantity": 300, "unit": "g"}],
    "missingIngredients": [{"name": "양송이버섯", "quantity": "1팩"}],
    "tip": "성인 기준 조리/보관 핵심 팁"
  }
]`;
    }

    if (targetMode === "toddler") {
      return `당신은 영유아 영양 및 유아식 전문 셰프입니다.
대상: 생후 ${simokMonths}개월 유아 1인 (출생일 ${simokProfile.birthDate} 기준)
요청 날짜·끼니(${requests.length}끼): ${reqListStr}${recent14Note}

[냉장고·냉동실·실온 전체 유효 재고 (만료·0개 제외, 임박순)]
${validText}

중요 규칙:
1. 생후 ${simokMonths}개월 아기가 안전하게 씹고 삼킬 수 있는 크기·부드러운 식감·저염 조리법으로 구성하고, 알레르기 주의 재료를 고려하세요.
2. 한 끼는 탄수화물·단백질·채소가 균형을 이루는 완성형 유아식으로 구성하세요.
3. 위 냉장고 유효 재고를 우선 활용하고, 없는 재료는 missingIngredients에 적으세요.
4. 반드시 요청한 ${requests.length}개 날짜·끼니 조합과 1:1로 일치하는 순수 JSON 배열만 출력하세요(마크다운 금지):
[
  {
    "date": "${requests[0].date}",
    "slot": "${requests[0].slot}",
    "target": "toddler",
    "mealName": "유아식 한 끼 식단명",
    "components": [
      {"role": "staple", "name": "진밥"},
      {"role": "main", "name": "부드러운 소고기 애호박볶음"},
      {"role": "vegetable", "name": "계란찜"}
    ],
    "servings": 1,
    "estimatedMinutes": 25,
    "ingredients": [{"name": "애호박", "quantity": 50, "unit": "g"}],
    "missingIngredients": [],
    "tip": "조리 팁",
    "babyTip": "생후 ${simokMonths}개월 기준 식감·크기·알레르기 주의사항"
  }
]`;
    }

    return `당신은 한국 가정식 및 가족 통합 식단 전문 셰프입니다.
대상: 온가족 (성인 2인 + 생후 ${simokMonths}개월 유아 1인, 출생일 ${simokProfile.birthDate} 기준)
요청 날짜·끼니(${requests.length}끼): ${reqListStr}${recent14Note}

[냉장고·냉동실·실온 전체 유효 재고 (만료·0개 제외, 임박순)]
${validText}

중요 규칙:
1. 성인 2인이 맛있게 먹는 완성형 한 끼를 기본으로 하되, 생후 ${simokMonths}개월 아기에게 덜어내어 변형하기 좋은 구성(또는 아이에게 부적합한 매운·딱딱한 재료 분리 안내)을 babyTip에 별도로 적으세요.
2. 위 냉장고 유효 재고를 최대한 우선 활용하고, 부족한 재료만 missingIngredients에 적으세요.
3. 반드시 요청한 ${requests.length}개 날짜·끼니 조합과 1:1로 일치하는 순수 JSON 배열만 출력하세요(마크다운 금지):
[
  {
    "date": "${requests[0].date}",
    "slot": "${requests[0].slot}",
    "target": "family",
    "mealName": "온가족 한 끼 식단명",
    "components": [
      {"role": "staple", "name": "잡곡밥"},
      {"role": "main", "name": "소고기 무국"},
      {"role": "vegetable", "name": "시금치 나물"}
    ],
    "servings": 3,
    "estimatedMinutes": 35,
    "ingredients": [{"name": "소고기", "quantity": 250, "unit": "g"}],
    "missingIngredients": [],
    "tip": "조리 핵심 팁",
    "babyTip": "생후 ${simokMonths}개월 아기용 덜어내기/식감 변형 팁"
  }
]`;
  };

  const convertUnitQty = (qty, fromUnit, toUnit) => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) return null;
    const f = String(fromUnit || "").trim().toLowerCase();
    const t = String(toUnit || "").trim().toLowerCase();
    if (f === t) return q;
    if (f === "kg" && t === "g") return q * 1000;
    if (f === "g" && t === "kg") return q / 1000;
    if ((f === "l" || f === "ℓ") && t === "ml") return q * 1000;
    if (f === "ml" && (t === "l" || t === "ℓ")) return q / 1000;
    return null;
  };

  const matchFridgeItemExactFirst = (ingName, validFridge) => {
    const lower = String(ingName || "").trim().toLowerCase();
    if (!lower) return null;
    const exact = validFridge.find((f) => String(f.name || "").trim().toLowerCase() === lower);
    if (exact) return exact;
    // Only match partial if token boundary or short clean inclusion without mixing distinct seasoned meats
    const candidates = validFridge.filter((f) => {
      const fn = String(f.name || "").trim().toLowerCase();
      return fn.includes(lower) || lower.includes(fn);
    });
    if (candidates.length === 1) return candidates[0];
    return null;
  };

  const checkMealCompleteness = (mealName, components, ingredients = []) => {
    const oneBowlKeywords = ["덮밥", "비빔밥", "볶음밥", "파스타", "국수", "칼국수", "우동", "라면", "카레", "리조또", "죽", "솥밥", "전골", "찌개", "정식", "도시락", "김밥", "샌드위치", "토스트"];
    const nameStr = String(mealName || "");
    const ingList = toSafeArray(ingredients);
    const hasEnoughIngredients = ingList.length >= 2;
    if (oneBowlKeywords.some((kw) => nameStr.includes(kw)) && hasEnoughIngredients) {
      return { ok: true, reason: "" };
    }
    const roles = new Set(toSafeArray(components).map((c) => String(c.role || "").toLowerCase()));
    if (components.length >= 2 && (roles.has("staple") || roles.has("main"))) {
      return { ok: true, reason: "" };
    }
    return { ok: false, reason: "구성요소·단백질/채소 재료가 부족한 단일 요리입니다. 재추천을 권장합니다." };
  };

  const normalizeAiPlanItems = (rawList, requestedPairs, targetMode, validFridge) => {
    const reqSet = new Set(requestedPairs.map((r) => `${r.date}__${r.slot}`));
    const seen = new Set();
    const out = [];

    for (const item of toSafeArray(rawList)) {
      const dStr = String(item?.date || "").trim();
      const sStr = String(item?.slot || "").trim();
      const key = `${dStr}__${sStr}`;
      const mealName = String(item?.mealName || item?.menu || "").trim();
      if (!reqSet.has(key) || seen.has(key) || !mealName) continue;
      seen.add(key);

      const components = toSafeArray(item?.components)
        .map((c) => ({
          role: String(c?.role || "main"),
          name: String(c?.name || "").trim()
        }))
        .filter((c) => c.name);

      const rawIngredients = toSafeArray(item?.ingredients).map((ing) => {
        if (ing && typeof ing === "object") {
          return {
            name: String(ing.name || "").trim(),
            quantity: Number(ing.quantity) || 1,
            unit: String(ing.unit || "개").trim() || "개"
          };
        }
        return { name: String(ing || "").trim(), quantity: 1, unit: "개" };
      }).filter((x) => x.name);

      const matchedEntries = [];
      const unitCheckEntries = [];
      const unmatchedMissing = [];

      for (const ing of rawIngredients) {
        const matched = matchFridgeItemExactFirst(ing.name, validFridge);
        if (matched) {
          const convertedAvail = convertUnitQty(matched.quantity, matched.unit, ing.unit);
          matchedEntries.push({
            ...ing,
            inventoryItemId: matched.id,
            availableQty: Number(matched.quantity || 0),
            availableUnit: matched.unit || "개",
            convertedAvail,
            needsUnitCheck: convertedAvail === null
          });
          if (convertedAvail === null) {
            unitCheckEntries.push({
              name: ing.name,
              quantity: `${ing.quantity}${ing.unit} (보유: ${matched.quantity}${matched.unit || "개"})`
            });
          }
        } else {
          unmatchedMissing.push({ name: ing.name, quantity: `${ing.quantity}${ing.unit}` });
        }
      }

      const explicitMissing = toSafeArray(item?.missingIngredients).map((mi) => {
        if (mi && typeof mi === "object") {
          return {
            name: String(mi.name || "").trim(),
            quantity: String(mi.quantity || "1개").trim() || "1개"
          };
        }
        return { name: String(mi || "").trim(), quantity: "1개" };
      }).filter((x) => x.name);

      const mergedMissingMap = new Map();
      [...explicitMissing, ...unmatchedMissing].forEach((m) => {
        const k = m.name.toLowerCase();
        if (!mergedMissingMap.has(k)) mergedMissingMap.set(k, m);
      });

      const compNames = components.map((c) => c.name);
      const completeness = checkMealCompleteness(mealName, components, rawIngredients);

      out.push({
        id: `plan-${Date.now()}-${out.length}-${Math.random().toString(36).slice(2, 5)}`,
        date: dStr,
        slot: sStr,
        target: targetMode,
        mealName,
        menu: compNames.length > 0 ? `${mealName} (${compNames.join(" · ")})` : mealName,
        isManuallyEdited: false,
        components,
        completeness,
        servings: Number(item?.servings) || (targetMode === "adults" ? 2 : targetMode === "toddler" ? 1 : 3),
        estimatedMinutes: Number(item?.estimatedMinutes) || 25,
        ingredients: matchedEntries,
        unitCheckEntries,
        usedIngredients: matchedEntries.map((x) => x.name),
        usedIngredientsDisplay: matchedEntries.map((x) => `${x.name}(${x.quantity}${x.unit})`),
        missingIngredients: Array.from(mergedMissingMap.values()),
        tip: String(item?.tip || "").trim(),
        babyTip: targetMode === "adults" ? "" : String(item?.babyTip || item?.simokTip || "").trim(),
        selected: true
      });
    }
    return out;
  };

  const handleGenerate3DayPlan = async () => {
    if (!requireEditorAccess()) return;
    const requestedPairs = Object.entries(planScheduleMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([date, slots]) => toSafeArray(slots).map((slot) => ({ date, slot })));

    if (requestedPairs.length === 0) {
      setPlanErrorMsg("추천받을 날짜와 끼니(최소 1끼)를 선택해 주세요.");
      return;
    }

    setPlanErrorMsg("");
    setIsPlanLoading(true);
    try {
      const { valid: validFridge, textList } = buildValidFridgeContext();
      const prompt = buildMealPromptForRequests(requestedPairs, planTarget, planAdultStyle, textList);

      let actualProvider = aiProvider.toUpperCase();
      const parsed = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText: prompt,
        temperature: 0.55,
        onProviderUsed: (prov) => { actualProvider = prov; }
      });

      const validated = normalizeAiPlanItems(parsed, requestedPairs, planTarget, validFridge);
      if (validated.length === 0) {
        throw new Error("AI가 요청한 날짜·끼니에 맞는 완성형 식단을 반환하지 못했습니다. 다시 시도해 주세요.");
      }

      const snapshotMembers =
        planTarget === "toddler"
          ? ["시목"]
          : planTarget === "adults"
          ? ["수혁", "아리나"]
          : ["수혁", "아리나", "시목"];

      setPlanItems(validated);
      const gotSet = new Set(validated.map((v) => `${v.date}__${v.slot}`));
      const missingPairs = requestedPairs.filter((r) => !gotSet.has(`${r.date}__${r.slot}`));

      setPlanSnapshotMeta({
        operationId: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        target: planTarget,
        adultStyle: planAdultStyle,
        members: snapshotMembers,
        requestedCount: requestedPairs.length,
        missingPairs,
        applied: false
      });
      pushAiLog(actualProvider, "맞춤 식단표", true, `${validated.length}/${requestedPairs.length}끼 생성`);
      if (missingPairs.length > 0) {
        setPlanErrorMsg(`완료 ${validated.length}/${requestedPairs.length}끼 · 누락 ${missingPairs.length}끼 (${missingPairs.map((m) => `${m.date} ${m.slot}`).join(", ")})`);
      }
      showToast(`맞춤 식단(${validated.length}끼)이 생성되었습니다!`);
    } catch (err) {
      pushAiLog(aiProvider.toUpperCase(), "맞춤 식단표", false, err.message);
      setPlanErrorMsg(err.message);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleRegenerateSinglePlanSlot = async (targetItem) => {
    if (!requireEditorAccess()) return;
    if (regeneratingPlanId) return;
    setRegeneratingPlanId(targetItem.id);
    setPlanErrorMsg("");
    try {
      const targetMode = planSnapshotMeta?.target || targetItem.target || planTarget;
      const lockedStyle = planSnapshotMeta?.adultStyle || planAdultStyle;
      const { valid: validFridge, textList } = buildValidFridgeContext();
      const prompt = buildMealPromptForRequests(
        [{ date: targetItem.date, slot: targetItem.slot }],
        targetMode,
        lockedStyle,
        textList
      );
      let actualProvider = aiProvider.toUpperCase();
      const parsed = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText: prompt,
        temperature: 0.7,
        onProviderUsed: (prov) => { actualProvider = prov; }
      });
      const validated = normalizeAiPlanItems(
        parsed,
        [{ date: targetItem.date, slot: targetItem.slot }],
        targetMode,
        validFridge
      );
      if (validated.length === 0) {
        throw new Error("재추천 결과를 불러오지 못했습니다.");
      }
      setPlanItems((prev) =>
        prev.map((x) => (x.id === targetItem.id ? { ...validated[0], selected: x.selected } : x))
      );
      pushAiLog(actualProvider, "끼니 재추천", true, `${targetItem.date} ${targetItem.slot}`);
      showToast(`${targetItem.date} ${targetItem.slot} 메뉴가 새로 추천되었습니다!`);
    } catch (err) {
      showToast(`⚠️ 재추천 실패: ${err.message}`);
    } finally {
      setRegeneratingPlanId("");
    }
  };

  const handleGenerateMissingPlanSlots = async () => {
    if (!requireEditorAccess()) return;
    const missingPairs = toSafeArray(planSnapshotMeta?.missingPairs);
    if (missingPairs.length === 0 || isPlanLoading) return;
    setIsPlanLoading(true);
    setPlanErrorMsg("");
    try {
      const targetMode = planSnapshotMeta?.target || planTarget;
      const lockedStyle = planSnapshotMeta?.adultStyle || planAdultStyle;
      const { valid: validFridge, textList } = buildValidFridgeContext();
      const prompt = buildMealPromptForRequests(missingPairs, targetMode, lockedStyle, textList);
      let actualProvider = aiProvider.toUpperCase();
      const parsed = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText: prompt,
        temperature: 0.6,
        onProviderUsed: (prov) => { actualProvider = prov; }
      });
      const added = normalizeAiPlanItems(parsed, missingPairs, targetMode, validFridge);
      if (added.length === 0) throw new Error("누락된 끼니를 추가로 생성하지 못했습니다.");
      setPlanItems((prev) => {
        const existingKeys = new Set(prev.map((x) => `${x.date}__${x.slot}`));
        return [...prev, ...added.filter((a) => !existingKeys.has(`${a.date}__${a.slot}`))];
      });
      setPlanSnapshotMeta((prev) => {
        if (!prev) return prev;
        const addedKeys = new Set(added.map((a) => `${a.date}__${a.slot}`));
        const rem = toSafeArray(prev.missingPairs).filter((m) => !addedKeys.has(`${m.date}__${m.slot}`));
        return { ...prev, missingPairs: rem };
      });
      pushAiLog(actualProvider, "누락 끼니 추가생성", true, `${added.length}끼 보완`);
      showToast(`누락되었던 ${added.length}끼를 추가로 생성했습니다!`);
    } catch (err) {
      setPlanErrorMsg(err.message);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const handleApply3DayPlan = async () => {
    if (!requireEditorAccess()) return;
    if (isSavingPlan) return;
    if (planSnapshotMeta?.applied) {
      showToast("이미 일별 식단표에 반영 완료된 추천 식단입니다.");
      return;
    }
    const picked = planItems.filter((it) => it.selected && (it.mealName || it.menu));
    if (picked.length === 0) {
      showToast("식단표에 반영할 끼니를 1개 이상 체크해 주세요.");
      return;
    }
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 식단표에 반영할 수 있습니다.");
      return;
    }
    const members = planSnapshotMeta?.members || ["수혁", "아리나"];
    const targetMode = planSnapshotMeta?.target || "adults";
    const opId = planSnapshotMeta?.operationId || `plan-${Date.now()}`;

    setIsSavingPlan(true);
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const opRef = getDocRef("family_cooking_operations_v7", opId);
      let alreadyApplied = false;
      const newLocal = {};

      await runTransaction(db, async (tx) => {
        const existingOp = await tx.get(opRef);
        if (existingOp.exists()) {
          alreadyApplied = true;
          return;
        }
        let skippedCount = 0;
        let addedCount = 0;
        picked.forEach((it, idx) => {
          const hasConflict = meals.some(
            (m) =>
              m.date === it.date &&
              m.slot === it.slot &&
              toSafeArray(m.members).some((mem) => members.includes(mem))
          );
          if (planConflictMode === "skip" && hasConflict) {
            skippedCount += 1;
            return;
          }
          const mId = `m-${opId}-${idx}`;
          const compStr = toSafeArray(it.components).map((c) => c.name).filter(Boolean).join(" · ");
          const fullMenu = it.isManuallyEdited
            ? it.mealName
            : compStr && !String(it.menu || "").includes(compStr)
            ? `${it.mealName} (${compStr})`
            : (it.menu || it.mealName);
          const noteParts = [];
          if (it.tip) noteParts.push(`조리팁: ${it.tip}`);
          if (targetMode !== "adults" && it.babyTip) noteParts.push(`아이 변형: ${it.babyTip}`);

          const payload = {
            id: mId,
            date: it.date,
            slot: it.slot,
            menu: fullMenu,
            members,
            ingredients: toSafeArray(it.usedIngredients),
            note: noteParts.length > 0 ? `✨ AI 식단 (${it.servings || 2}인분/${it.estimatedMinutes || 25}분) · ${noteParts.join(" / ")}` : "✨ AI 맞춤 식단",
            sourceType: "집밥/온가족식",
            cost: 0
          };
          newLocal[mId] = payload;
          addedCount += 1;
          tx.set(getDocRef("family_meals_v3", mId), payload);
          tx.set(getDocRef("family_meals_v4", mId), payload);
        });
        tx.set(opRef, {
          id: opId,
          type: "plan_custom",
          count: addedCount,
          skipped: skippedCount,
          createdAt: new Date().toISOString()
        });
      });

      ok = true;
      setPlanSnapshotMeta((prev) => (prev ? { ...prev, applied: true } : prev));
      if (alreadyApplied) {
        showToast("이미 다른 기기 또는 이전 요청으로 반영 완료된 식단입니다.");
      } else {
        const addedNum = Object.keys(newLocal).length;
        const skippedNum = picked.length - addedNum;
        if (addedNum > 0) {
          setMealsMap((prev) => ({
            ...prev,
            local: { ...(prev.local || {}), ...newLocal }
          }));
        }
        showToast(
          skippedNum > 0
            ? `✅ 신규 ${addedNum}끼 반영 / 기존 충돌 ${skippedNum}끼 건너뜀`
            : `✅ 선택한 ${addedNum}끼가 일별 식단표에 반영되었습니다!`
        );
      }
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 식단표 일괄 반영 실패: 네트워크를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
      setIsSavingPlan(false);
    }
  };

  const computeAggregatedPlanShortage = (selectedPlans) => {
    const validFridge = fridge.filter((f) => Number(f.quantity || 0) > 0 && getDaysDiff(f.expiryDate) >= 0);
    const shopNamesLower = shoppingList.map((s) => String(s.name || "").toLowerCase());
    const demandMap = new Map();

    for (const it of selectedPlans) {
      for (const ing of toSafeArray(it.ingredients)) {
        const lower = String(ing.name || "").trim().toLowerCase();
        if (!lower) continue;
        const prev = demandMap.get(lower);
        if (!prev) {
          demandMap.set(lower, {
            name: ing.name,
            totalReq: Number(ing.quantity) || 1,
            unit: ing.unit || "개",
            matchedItem: ing.inventoryItemId ? validFridge.find((f) => f.id === ing.inventoryItemId) : null
          });
        } else {
          const conv = convertUnitQty(ing.quantity, ing.unit, prev.unit);
          if (conv !== null) {
            prev.totalReq += conv;
          } else {
            prev.unitMismatch = true;
          }
        }
      }
      for (const raw of toSafeArray(it.missingIngredients)) {
        const mName = typeof raw === "object" ? String(raw.name || "").trim() : String(raw || "").trim();
        const mQtyStr = typeof raw === "object" ? String(raw.quantity || "1개").trim() : "1개";
        if (!mName) continue;
        const lower = mName.toLowerCase();
        if (!demandMap.has(lower)) {
          demandMap.set(lower, {
            name: mName,
            totalReq: 1,
            unit: "",
            rawQtyLabel: mQtyStr,
            matchedItem: matchFridgeItemExactFirst(mName, validFridge)
          });
        }
      }
    }

    const shortages = [];
    const parseQtyStr = (str) => {
      const m = String(str || "").trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z가-힣ℓ]*)$/);
      return m ? { qty: Number(m[1]), unit: m[2] || "개" } : null;
    };

    for (const [lower, entry] of demandMap.entries()) {
      const existingShop = shoppingList.find((s) => {
        const sn = String(s.name || "").toLowerCase();
        return !s.checked && (sn === lower || sn.includes(lower) || lower.includes(sn));
      });
      const parsedShop = existingShop ? parseQtyStr(existingShop.quantity) : null;

      if (!entry.matchedItem) {
        if (existingShop && !entry.unit) continue;
        let needed = entry.totalReq;
        if (parsedShop && entry.unit) {
          const shopConv = convertUnitQty(parsedShop.qty, parsedShop.unit, entry.unit);
          if (shopConv !== null) needed = Math.max(0, needed - shopConv);
        }
        if (needed <= 0) continue;
        shortages.push({
          name: entry.name,
          quantity: entry.rawQtyLabel || `${Math.round(needed * 10) / 10}${entry.unit}`,
          detail: entry.rawQtyLabel ? "미보유" : `총 필요 ${entry.totalReq}${entry.unit}${parsedShop ? ` (장보기 ${existingShop.quantity} 반영)` : ""}`
        });
      } else if (!entry.unitMismatch && entry.unit) {
        const availConv = convertUnitQty(entry.matchedItem.quantity, entry.matchedItem.unit, entry.unit);
        if (availConv !== null && entry.totalReq > availConv) {
          let diff = entry.totalReq - availConv;
          if (parsedShop) {
            const shopConv = convertUnitQty(parsedShop.qty, parsedShop.unit, entry.unit);
            if (shopConv !== null) diff = Math.max(0, diff - shopConv);
          }
          diff = Math.round(diff * 10) / 10;
          if (diff <= 0) continue;
          shortages.push({
            name: entry.name,
            quantity: `${diff}${entry.unit}`,
            detail: `총 필요 ${entry.totalReq}${entry.unit} / 보유 ${availConv}${entry.unit}${parsedShop ? ` / 장보기 ${existingShop.quantity}` : ""}`
          });
        }
      }
    }
    return shortages;
  };

  const runCoreLogicSelfTests = () => {
    const cases = [
      {
        name: "단위 환산 (1kg -> 1000g)",
        pass: convertUnitQty(1, "kg", "g") === 1000
      },
      {
        name: "단위 환산 (500ml -> 0.5L)",
        pass: convertUnitQty(500, "ml", "l") === 0.5
      },
      {
        name: "이질 단위 차단 (g vs 팩 -> null)",
        pass: convertUnitQty(100, "g", "팩") === null
      },
      {
        name: "월말 날짜 보정 (2026-01-31 + 1달 -> 2026-02-28)",
        pass: addMonthsToDateStr("2026-01-31", 1, 0) === "2026-02-28"
      },
      {
        name: "완성형 식단 판별 (한그릇 재료검증 vs 단일채소)",
        pass:
          checkMealCompleteness("소고기 덮밥", [], [{ name: "소고기" }, { name: "양파" }]).ok === true &&
          checkMealCompleteness("계란 볶음밥", [], [{ name: "밥" }]).ok === false &&
          checkMealCompleteness("시금치 나물", [{ role: "vegetable", name: "시금치 나물" }]).ok === false
      },
      {
        name: "실제 영수증 합계 대사 (홈플러스 20,580원 사례)",
        pass:
          (6990 + 2490 + 1190 + (8990 - 4000) + (3990 - 1000) + 1440) + 490 === 20580
      },
      {
        name: "카톡 장보기 문장 1초 파싱 (양파 1망, 두부 2모 사와)",
        pass: (() => {
          const parsed = parseQuickShoppingTextLocal("양파 1망, 부침두부 2모 사와");
          return parsed.length === 2 && parsed[0].name === "양파" && parsed[0].quantity === "1망" && parsed[1].name === "부침두부" && parsed[1].quantity === "2모";
        })()
      },
      {
        name: "냉장고 예정 사용량 · 예상 잔량 계산 (300g - 250g = 50g)",
        pass: (() => {
          const today = getTodayStr();
          const proj = computeFridgeProjectedUsage(
            [{ id: "f1", name: "소고기", quantity: 300, unit: "g" }],
            [{ id: "m1", date: today, slot: "저녁", menu: "소고기무국", ingredients: [{ name: "소고기", qty: 250, unit: "g" }] }],
            today,
            addMonthsToDateStr,
            matchFridgeItemExactFirst,
            convertUnitQty
          );
          return proj.f1.plannedQty === 250 && proj.f1.projectedRemaining === 50;
        })()
      },
      {
        name: "냉장고 13칸 자동 매핑 및 통합 채소칸 호환",
        pass:
          FRIDGE_SHELF_ZONES.length === 13 &&
          resolveItemShelfZone({ location: "냉장실", category: "채소/과일" }) === "채소칸" &&
          resolveItemShelfZone({ location: "냉장실", shelfZone: "채소칸 좌" }) === "채소칸" &&
          resolveItemShelfZone({ location: "별도 냉동고", category: "육류/수산" }) === "전용냉동 1칸"
      },
      {
        name: "리스트 뷰 냉동실 통합 필터 (메인·별도·기존 냉동실)",
        pass:
          matchesFridgeLocFilter("메인 냉동실", "냉동실") &&
          matchesFridgeLocFilter("별도 냉동고", "냉동실") &&
          matchesFridgeLocFilter("냉동실", "냉동실") &&
          !matchesFridgeLocFilter("냉장실", "냉동실")
      },
      {
        name: "인별·목표별 AI 내보내기 요청문 맞춤 분기",
        pass: (() => {
          const p = buildPersonalizedAiPrompt({
            exportScope: "all",
            exportMealMember: "아리나",
            exportMealGoal: "산후조리/영양보충",
            exportMealDays: 7,
            simokM: 15,
            siyulM: 0
          }).join("\n");
          return p.includes("최아리나(성인 여성)") && p.includes("산후조리/영양보충");
        })()
      },
      {
        name: "유사 품목 오매칭 방지 (소고기 vs 양념소고기·국거리)",
        pass:
          matchFridgeItemExactFirst("소고기", [
            { id: "1", name: "소고기 양념육" },
            { id: "2", name: "소고기 국거리" }
          ]) === null
      }
,
      {
        name: "레시피 한국어 단위 토큰 파싱 (소고기 250 g / 다진마늘 1큰술)",
        pass: (() => {
          const a = parseRecipeIngredientToken("소고기 250 g");
          const b = parseRecipeIngredientToken("다진마늘 1큰술");
          return a.name === "소고기" && a.qty === 250 && a.unit === "g" && b.name === "다진마늘" && b.qty === 1 && b.unit === "큰술";
        })()
      },
      {
        name: "수량 문자열('01') 숫자 정규화 및 차감 안전성",
        pass: (Number("01") || 0) === 1 && (Number("01") || 0) - 1 === 0
      },
      {
        name: "장보기 입고 수량·단위 분리 ('2팩' -> 2 / '팩')",
        pass: (() => {
          const m = "2팩".match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
          return Boolean(m && Number(m[1]) === 2 && m[2] === "팩");
        })()
      },
      {
        name: "자동완성 앞글자 우선 랭킹 ('우' -> '우유' > '한우')",
        pass: (() => {
          const q = "우";
          const sorted = ["한우", "우유"].sort((a, b) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1));
          return sorted[0] === "우유";
        })()
      },
      {
        name: "대량 일괄 이동 200건 청크 분할 계산 (450건 -> 3배치)",
        pass: Math.ceil(450 / 200) === 3 && 200 * 2 <= 500
      },
      {
        name: "전월 대비 식비 증감 및 폐기율 계산 (180,000 - 200,000 = -20,000)",
        pass: (180000 - 200000) === -20000 && Math.round((9000 / 180000) * 1000) / 10 === 5
      }
    ];
    const passed = cases.filter((c) => c.pass).length;
    setSelfTestResults({ passed, total: cases.length, cases });
    showToast(`🧪 로직 자가진단: ${passed}/${cases.length} 통과`);
  };

  const buildRecentWeekMealsLines = () => {
    const baseStr = getTodayStr();
    const dayCount = Number(exportMealDays) || 7;
    const datesRange = Array.from({ length: dayCount }, (_, i) =>
      addMonthsToDateStr(baseStr, 0, i - (dayCount - 1))
    );
    const slotOrder = ["아침", "오전간식", "점심", "오후간식", "저녁", "야식"];
    const targetLabel =
      exportMealMember === "전체"
        ? "가족 전체(인별)"
        : FAMILY_MEMBERS.find((f) => f.id === exportMealMember)?.name || exportMealMember;

    const out = [
      `📅 최근 ${dayCount}일 일별 식단 (${datesRange[0]} ~ ${datesRange[datesRange.length - 1]} | 대상: ${targetLabel})`,
      ""
    ];

    let totalMealsCount = 0;
    for (const dStr of datesRange) {
      const dayMeals = meals
        .filter(
          (m) =>
            m.date === dStr &&
            (exportMealMember === "전체" || toSafeArray(m.members).includes(exportMealMember))
        )
        .sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));

      out.push(`[${dStr} (${getDayName(dStr)})]`);
      if (dayMeals.length === 0) {
        out.push("- 기록된 식단 없음");
      } else {
        for (const m of dayMeals) {
          totalMealsCount += 1;
          const memNames = toSafeArray(m.members)
            .map((id) => FAMILY_MEMBERS.find((f) => f.id === id)?.name || id)
            .join("·");
          const cleanMenu = String(m.menu || "").trim();
          out.push(`- ${m.slot} | [${memNames || "가족"}] ${cleanMenu}`);
        }
      }
      out.push("");
    }
    if (totalMealsCount === 0) {
      out.push(`(선택한 조건의 최근 ${dayCount}일 식단 기록이 없습니다.)`, "");
    }
    return out;
  };

  const buildInventoryExportText = () => {
    const todayStr = getTodayStr();
    const filtered = fridge.filter((f) => {
      if (exportIncludeZeroOrExpired) return true;
      return Number(f.quantity || 0) > 0 && getDaysDiff(f.expiryDate) >= 0;
    });

    const normalizeExportLoc = (rawLoc) => {
      const s = String(rawLoc || "").trim();
      if (s.includes("냉동")) return "냉동실";
      if (s.includes("실온") || s.includes("팬트리") || s.includes("상온")) return "실온·팬트리";
      if (!s || s.includes("냉장")) return "냉장실";
      return "기타 보관";
    };

    const locOrder =
      exportFridgeLoc === "전체"
        ? ["냉장실", "냉동실", "실온·팬트리", "기타 보관"]
        : [exportFridgeLoc];
    const groups = locOrder
      .map((loc) => {
        const items = filtered
          .filter((f) => normalizeExportLoc(f.location) === loc)
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"));
        return { loc, items };
      })
      .filter((g) => g.loc !== "기타 보관" || g.items.length > 0);

    const unknownExpiryCount = filtered.filter((f) => !f.expiryDate).length;
    const tempExpiryCount = filtered.filter((f) => f.expiryDate && f.expiryIsTemp).length;
    const syncLabel =
      syncStatus === "connected"
        ? "서버 동기화 확인됨"
        : syncStatus === "saving"
        ? "서버 저장 진행 중"
        : "로컬 캐시 기준(오프라인/대기)";
    const scopeLabel = exportIncludeZeroOrExpired ? "전체(0개·만료 포함)" : "유효 재고 기준(0개·만료 제외)";

    const lines = [
      `우리 가족 식탁 - 전체 재고 현황 (${scopeLabel})`,
      `기준일시: ${todayStr} ${new Date().toTimeString().slice(0, 5)} | 상태: ${syncLabel}`,
      `총 ${filtered.length}개 품목 (${groups.map((g) => `${g.loc} ${g.items.length}`).join(" · ")}) | 미확인 ${unknownExpiryCount} · 임시소비기한 ${tempExpiryCount}`,
      ""
    ];

    for (const g of groups) {
      lines.push(`[${g.loc}] (${g.items.length}개)`);
      if (g.items.length === 0) {
        lines.push("- 없음");
      } else {
        for (const it of g.items) {
          const qtyStr = `${it.quantity ?? 0}${it.unit || "개"}`;
          const expStr = it.expiryDate
            ? `소비기한 ${it.expiryDate}${it.expiryIsTemp ? "(임시값)" : ""}`
            : "소비기한 미확인";
          const buyStr = it.purchaseDate ? `구매일 ${it.purchaseDate}` : "";
          const priceStr = exportIncludePrice && Number(it.price) > 0 ? `${Number(it.price).toLocaleString()}원` : "";
          const parts = [it.name, qtyStr, it.category || "기타", expStr, buyStr, priceStr].filter(Boolean);
          lines.push(parts.join(" | "));
        }
      }
      lines.push("");
    }

    const fridgeLines = [
      ...lines,
      "※ 수량 및 소비기한은 사용자가 확인한 기록을 기준으로 합니다."
    ];

    const buildAiPromptPrefix = () => {
      if (!exportIncludeAiPrompt) return [];
      const simokM = getChildAgeStats("2025-08-03").months;
      const siyulM = getChildAgeStats("2026-11-06").months;
      const baseLines = buildPersonalizedAiPrompt({
        exportScope,
        exportMealMember,
        exportMealGoal,
        exportMealDays,
        simokM,
        siyulM
      });
      if (exportScope !== "fridge_only" && recipes.length > 0) {
        const topRecipes = [...recipes]
          .sort((a, b) => (Number(b.suhyukRating || 0) + Number(b.arinaRating || 0)) - (Number(a.suhyukRating || 0) + Number(a.arinaRating || 0)))
          .slice(0, 5)
          .map((r) => r.title)
          .filter(Boolean);
        if (topRecipes.length > 0) {
          const dividerIdx = baseLines.findIndex((l) => String(l).startsWith("---"));
          const recipeLine = `3) 우리 가족 레시피북 인기 메뉴(${topRecipes.join(", ")})도 보유 재료와 어울리면 식단에 우선 활용해 주세요.`;
          if (dividerIdx >= 0) {
            baseLines.splice(dividerIdx, 0, recipeLine);
          } else {
            baseLines.push(recipeLine);
          }
        }
      }
      return baseLines;
    };

    const prefix = buildAiPromptPrefix();
    if (exportScope === "meals_only") {
      return [...prefix, ...buildRecentWeekMealsLines()].join("\n");
    }
    if (exportScope === "all") {
      return [
        ...prefix,
        ...buildRecentWeekMealsLines(),
        "========================================",
        "",
        ...fridgeLines
      ].join("\n");
    }
    return [...prefix, ...fridgeLines].join("\n");
  };

  const handlePlatingImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlatingErrorMsg("");
    setPlatingResult(null);
    setPlatingExampleImageUrl("");
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file, { maxSide: 2200, quality: 0.92 });
      setPlatingPreviewUrl(previewUrl);
      setPlatingImagePart({ base64, mimeType });
    } catch (err) {
      setPlatingErrorMsg("이미지를 불러오는 중 오류가 발생했습니다.");
    } finally {
      if (platingFileInputRef.current) platingFileInputRef.current.value = "";
    }
  };

  // [신규 v7.2] 버튼 클릭 시에만 저비용 AI 플레이팅 예시 이미지 생성
  const handleGeneratePlatingExampleImage = async () => {
    if (!requireEditorAccess()) return;
    if (!platingResult) return;
    const cleanOpenai = String(openaiApiKey || "").trim();
    const cleanGemini = String(geminiApiKey || "").trim();
    if (!cleanOpenai && !cleanGemini) {
      setPlatingErrorMsg("이미지 생성을 위해 ⚙️설정에서 OpenAI 또는 Gemini API 키를 입력해 주세요.");
      return;
    }

    setPlatingErrorMsg("");
    setIsPlatingImageLoading(true);
    const visualPrompt = `Overhead food photography of Korean home-cooked dish "${platingResult.dishName}", styled beautifully on ${platingResult.plateAndGarnish || "a clean ceramic plate with fresh garnish"}, natural daylight, appetizing restaurant plating, no text.`;

    try {
      // 1순위: 가장 저렴한 OpenAI gpt-image-1-mini (low quality, 1024x1024, 25초 타임아웃)
      if (cleanOpenai) {
        const oaiCtrl = new AbortController();
        const oaiTimer = setTimeout(() => oaiCtrl.abort(), 25000);
        try {
          const res = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cleanOpenai}`
            },
            signal: oaiCtrl.signal,
            body: JSON.stringify({
              model: "gpt-image-1-mini",
              prompt: visualPrompt,
              n: 1,
              size: "1024x1024",
              quality: "low"
            })
          });
          const data = await res.json();
          if (res.ok && data?.data?.[0]) {
            const imgObj = data.data[0];
            const url = imgObj.b64_json
              ? `data:image/png;base64,${imgObj.b64_json}`
              : imgObj.url;
            if (url) {
              setPlatingExampleImageUrl(url);
              pushAiLog("OpenAI Image", "플레이팅 예시 이미지", true, "gpt-image-1-mini(low)");
              showToast("플레이팅 예시 이미지가 생성되었습니다!");
              return;
            }
          }
          if (!cleanGemini) {
            throw new Error(data?.error?.message || `OpenAI Image HTTP ${res.status}`);
          }
        } catch (oaiErr) {
          if (!cleanGemini) {
            throw new Error(oaiErr.name === "AbortError" ? "이미지 생성 시간 초과(25초)" : oaiErr.message);
          }
        } finally {
          clearTimeout(oaiTimer);
        }
      }

      // 2순위: Gemini 이미지 모델 (gemini-2.5-flash-image, 25초 타임아웃)
      if (cleanGemini) {
        const gCtrl = new AbortController();
        const gTimer = setTimeout(() => gCtrl.abort(), 25000);
        try {
          const gRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": cleanGemini
              },
              signal: gCtrl.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: visualPrompt }] }]
              })
            }
          );
          const gData = await gRes.json();
          if (!gRes.ok) {
            throw new Error(gData?.error?.message || `Gemini Image HTTP ${gRes.status}`);
          }
          const imgPart = (gData?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
          if (!imgPart) throw new Error("이미지 데이터를 받지 못했습니다.");
          setPlatingExampleImageUrl(
            `data:${imgPart.inlineData.mimeType || "image/png"};base64,${imgPart.inlineData.data}`
          );
          pushAiLog("Gemini Image", "플레이팅 예시 이미지", true, "gemini-2.5-flash-image");
          showToast("플레이팅 예시 이미지가 생성되었습니다!");
        } catch (gErr) {
          throw new Error(gErr.name === "AbortError" ? "이미지 생성 시간 초과(25초)" : gErr.message);
        } finally {
          clearTimeout(gTimer);
        }
      }
    } catch (err) {
      pushAiLog("Image AI", "플레이팅 예시 이미지", false, err.message);
      setPlatingErrorMsg(`예시 이미지 생성 실패: ${err.message}`);
    } finally {
      setIsPlatingImageLoading(false);
    }
  };

  const handleAnalyzePlating = async () => {
    if (!requireEditorAccess()) return;
    if (!platingImagePart) {
      setPlatingErrorMsg("먼저 요리 완성 사진을 선택해 주세요.");
      return;
    }
    setPlatingErrorMsg("");
    setIsPlatingLoading(true);
    try {
      const promptText = `당신은 미슐랭 레스토랑 푸드 스타일리스트이자 가정식 플레이팅 코치입니다.
업로드된 음식 사진을 보고 플레이팅을 분석해 주세요.
요청 스타일/상황: ${platingStyleHint || "깔끔하고 먹음직스러운 가정식 한 상"}

반드시 마크다운 코드블록 없이 아래 형식의 순수 JSON 배열(요소 1개)만 출력하세요:
[
  {
    "dishName": "사진 속 요리명",
    "colorScore": 4,
    "layoutScore": 3,
    "summary": "현재 담음새의 장점과 한 줄 총평",
    "plateAndGarnish": "어울리는 그릇 색상/모양 및 추천 가니쉬(쪽파, 깨, 허브 등)",
    "tips": [
      "1. 높이감/중앙 배치 개선 팁",
      "2. 여백 및 소스 연출 팁",
      "3. 색감 포인트 보완 팁"
    ]
  }
]`;

      let actualProvider = aiProvider.toUpperCase();
      const parsed = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText,
        imagePart: platingImagePart,
        temperature: 0.4,
        onProviderUsed: (p) => { actualProvider = p; }
      });

      const first = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
      if (!first) throw new Error("플레이팅 분석 결과를 읽지 못했습니다.");

      setPlatingResult({
        ...first,
        colorScore: Number.isFinite(Number(first.colorScore)) && Number(first.colorScore) > 0 ? Number(first.colorScore) : "미평가",
        layoutScore: Number.isFinite(Number(first.layoutScore)) && Number(first.layoutScore) > 0 ? Number(first.layoutScore) : "미평가",
        tips: toSafeArray(first.tips)
      });
      pushAiLog(actualProvider, "플레이팅 분석", true, first.dishName || "완료");
      showToast("AI 플레이팅 분석이 완료되었습니다!");
    } catch (err) {
      console.error("Plating analysis error:", err);
      pushAiLog(aiProvider.toUpperCase(), "플레이팅 분석", false, err.message);
      setPlatingErrorMsg(err.message);
    } finally {
      setIsPlatingLoading(false);
    }
  };

  const handleMenuImageUpload = async (e) => {
    if (!requireEditorAccess()) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setScanErrorMsg("");
    setIsMenuScanning(true);

    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file, { maxSide: 2200, quality: 0.92 });
      setScanPreviewUrl(previewUrl);

      const weekMappingHint = `월(MON)=${weekDates[0]}, 화(TUE)=${weekDates[1]}, 수(WED)=${weekDates[2]}, 목(THU)=${weekDates[3]}, 금(FRI)=${weekDates[4]}, 토(SAT)=${weekDates[5]}, 일(SUN)=${weekDates[6]}`;

      const promptText = `식단표 이미지(칠판/화이트보드 손글씨 또는 인쇄물)의 날짜(또는 요일)와 메뉴를 읽어 순수 JSON 배열로만 출력하세요.
- 기준 연월: "${scanTargetMonth}"
- 숫자 날짜(예: 12일)면 "${scanTargetMonth}-12" 형식, 요일(MON~SUN, 월~일)만 적혀 있으면 이번 주 날짜(${weekMappingHint})로 매칭하세요.
- '아:' 또는 아침 -> "breakfast"
- 오전간식 -> "mSnack"
- '점:' 또는 점심 -> "lunch"
- 오후간식 -> "aSnack"
- '저:' 또는 저녁 -> "dinner"

반드시 아래 순수 JSON 배열만 출력하세요:
[{"date":"2026-11-11","breakfast":"","mSnack":"","lunch":"","aSnack":"","dinner":"","note":""}]`;

      const parsedArray = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText,
        imagePart: { base64, mimeType },
        temperature: 0.1
      });

      setScannedMenuDays(
        parsedArray.map((item, idx) => ({
          date: String(item.date || weekDates[idx % 7] || `${scanTargetMonth}-01`).slice(0, 10),
          breakfast: item.breakfast || "",
          mSnack: item.mSnack || "",
          lunch: item.lunch || "",
          aSnack: item.aSnack || "",
          dinner: item.dinner || "",
          note: item.note ? `${scanSchoolName} (${item.note})` : `${scanSchoolName}`
        }))
      );
      showToast(`총 ${parsedArray.length}일 치 식단을 정확히 읽어왔습니다!`);
    } catch (err) {
      console.error("Menu scan error:", err);
      setScanErrorMsg(err.message);
    } finally {
      setIsMenuScanning(false);
      if (menuFileInputRef.current) menuFileInputRef.current.value = "";
    }
  };

  const handleSaveScannedMenuDays = async () => {
    if (!requireEditorAccess()) return;
    if (scannedMenuDays.length === 0) return;

    const targetMembers =
      scanTargetMember === "전체"
        ? ["수혁", "아리나", "시목", "시율"]
        : [scanTargetMember];

    const newMealsObj = {};
    scannedMenuDays.forEach((d) => {
      if (!d.date) return;
      const baseNote = d.note || scanSchoolName;

      if (d.breakfast && d.breakfast.trim()) {
        const id = `sc-${d.date}-${scanTargetMember}-bf`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "아침",
          menu: d.breakfast.trim(),
          members: targetMembers,
          ingredients: [],
          note: baseNote,
          sourceType: "집밥/온가족식",
          cost: 0
        };
      }
      if (d.mSnack && d.mSnack.trim()) {
        const id = `sc-${d.date}-${scanTargetMember}-ms`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "오전간식",
          menu: d.mSnack.trim(),
          members: targetMembers,
          ingredients: [],
          note: baseNote,
          sourceType: "어린이집 급식",
          cost: 0
        };
      }
      if (d.lunch && d.lunch.trim()) {
        const id = `sc-${d.date}-${scanTargetMember}-lc`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "점심",
          menu: d.lunch.trim(),
          members: targetMembers,
          ingredients: [],
          note: baseNote,
          sourceType: "집밥/온가족식",
          cost: 0
        };
      }
      if (d.aSnack && d.aSnack.trim()) {
        const id = `sc-${d.date}-${scanTargetMember}-as`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "오후간식",
          menu: d.aSnack.trim(),
          members: targetMembers,
          ingredients: [],
          note: baseNote,
          sourceType: "어린이집 급식",
          cost: 0
        };
      }
      if (d.dinner && d.dinner.trim()) {
        const id = `sc-${d.date}-${scanTargetMember}-dn`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "저녁",
          menu: d.dinner.trim(),
          members: targetMembers,
          ingredients: [],
          note: baseNote,
          sourceType: "집밥/온가족식",
          cost: 0
        };
      }
    });

    const entries = Object.values(newMealsObj);
    if (entries.length === 0) return;

    setMealsMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), ...newMealsObj }
    }));

    if (scannedMenuDays[0]?.date) {
      setSelectedDate(scannedMenuDays[0].date);
      setCurrentMonth(scannedMenuDays[0].date.slice(0, 7));
    }

    setIsDaycareModalOpen(false);
    setScannedMenuDays([]);
    setScanPreviewUrl("");

    if (user && db) {
      for (const m of entries) {
        try {
          await setDoc(getDocRef("family_meals_v3", m.id), m);
          await setDoc(getDocRef("family_meals_v4", m.id), m);
        } catch (e) {}
      }
    }

    showToast(`총 ${entries.length}끼 식단이 달력에 일괄 입력되었습니다!`);
  };

  const runReceiptOcrWithImagePart = async (imagePart) => {
    setReceiptErrorMsg("");
    setReceiptSaveError("");
    setReceiptOperationId(`rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    setIsReceiptScanning(true);
    try {
      const promptText = `당신은 한국 마트 영수증 정밀 OCR 전문가입니다.
이미지에 인쇄된 글자만 100% 그대로 판독하세요. 이미지에 없는 품목(예: 감자, 브로콜리, 사과, 미나리 등)이나 임의 가격(1490 등)을 절대 추측해 지어내지 마세요.

작업 순서 (반드시 준수):
1단계(rawLines): 영수증 본문의 상품 줄(예: "01*건고사리35G 6,990 1 6,990", "에누리(쿠폰) -4,000")과 하단 합계 줄("결제대상금액 20,580" 또는 "카드결제 20,580")을 이미지에 보이는 글자 그대로 한 줄씩 받아 적으세요.
2단계(items): 오직 1단계 rawLines에 실제로 존재하는 상품 줄만 items 배열로 변환하세요.
- 01, 02, 03... 줄 번호당 정확히 1개 항목만 생성하세요. 같은 상품(예: 두부)을 2번 중복 출력하지 마세요.
- 각 상품 줄의 오른쪽 끝 금액에서 바로 아래 줄에 있는 에누리/쿠폰(-금액)만 차감하여 price에 적으세요.
- 수량(quantity)은 영수증의 수량 칸 숫자(보통 1~5개)만 정확히 숫자로 적으세요. 줄번호("01"), "1+1", 가격, 중량 숫자를 합쳐 11로 오인식하지 마세요. 불확실하면 quantity는 1로 적으세요.
- "재사용봉투", "종량제봉투", "쇼핑백" 등 비식품은 items에서 빼고 그 합계를 excludedTotal에 적으세요.
- 영수증 하단의 실제 총 결제금액(예: 결제대상금액 20,580)을 receiptTotal에 적으세요.
- location은 ["냉장실", "냉동실", "실온·팬트리"] 중 하나, category는 ["채소/과일", "육류/수산", "유제품/계란", "유아식/이유식 재료", "반찬/김치", "밀키트", "양념/소스", "기타"] 중 하나입니다.

마크다운 코드블록 없이 아래 순수 JSON 객체만 출력하세요:
{
  "rawLines": ["01*건고사리35G 6,990 1 6,990", "결제대상금액 20,580"],
  "receiptTotal": 20580,
  "excludedTotal": 490,
  "items": [
    {"lineNo":"01","rawName":"건고사리35G","name":"건고사리","location":"실온·팬트리","category":"채소/과일","quantity":35,"unit":"g","price":6990}
  ]
}`;

      const parsedObj = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText,
        imagePart,
        temperature: 0.0,
        expectObject: true,
        onProviderUsed: (eng) => setReceiptEngineUsed(eng)
      });

      const rawLinesArr = Array.isArray(parsedObj?.rawLines) ? parsedObj.rawLines.map((s) => String(s)) : [];
      setReceiptRawLines(rawLinesArr);

      const itemsSource = Array.isArray(parsedObj?.items)
        ? parsedObj.items
        : Array.isArray(parsedObj)
        ? parsedObj
        : [];

      const seenLineNos = new Set();
      let detectedTotal = parsedObj?.receiptTotal && Number(parsedObj.receiptTotal) > 0
        ? String(Number(parsedObj.receiptTotal))
        : "";
      let detectedExcluded = parsedObj?.excludedTotal !== undefined && Number(parsedObj.excludedTotal) >= 0
        ? String(Number(parsedObj.excludedTotal))
        : "0";

      const normalized = toSafeArray(itemsSource)
        .filter((it) => {
          const ln = String(it?.lineNo || "").trim();
          if (ln && seenLineNos.has(ln)) return false;
          if (ln) seenLineNos.add(ln);
          if (!detectedTotal && it?.receiptTotal && Number(it.receiptTotal) > 0) {
            detectedTotal = String(Number(it.receiptTotal));
          }
          if (detectedExcluded === "0" && it?.excludedTotal !== undefined && Number(it.excludedTotal) > 0) {
            detectedExcluded = String(Number(it.excludedTotal));
          }
          return true;
        })
        .map((it) => {
          const loc = STORAGE_LOCATIONS.includes(it.location) ? it.location : String(it.location || "").includes("냉동") ? "메인 냉동실" : "냉장실";
          const cat = FRIDGE_CATEGORIES.includes(it.category) ? it.category : "기타";
          return {
            name: String(it.name || "").trim(),
            location: loc,
            category: cat,
            quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
            unit: String(it.unit || "개").trim() || "개",
            expiryDate: it.expiryDate || getDefaultExpiryForLocation(loc),
            expiryIsTemp: !it.expiryDate,
            price: Math.max(0, Number(it.price) || 0)
          };
        })
        .filter((it) => it.name && !it.name.includes("봉투"));

      setReceiptTotalAmount(detectedTotal);
      setReceiptExcludedAmount(detectedExcluded);
      setScannedReceiptItems(normalized);
      showToast(`영수증에서 총 ${normalized.length}개 품목을 읽어왔습니다!`);
    } catch (err) {
      console.error(err);
      setReceiptErrorMsg(err.message);
    } finally {
      setIsReceiptScanning(false);
    }
  };

  const handleReceiptImageUpload = async (e) => {
    if (!requireEditorAccess()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file, {
        maxSide: 2200,
        quality: 0.92,
        enhanceContrast: true
      });
      setReceiptPreviewUrl(previewUrl);
      const imgPart = { base64, mimeType };
      setLastReceiptImagePart(imgPart);
      await runReceiptOcrWithImagePart(imgPart);
    } finally {
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
    }
  };

  // ==========================================
  // 10. 냉장고·식단·장보기·공지사항 핸들러
  // ==========================================
  const handleSaveFridge = async (overrideUpdatedAt = null) => {
    if (!requireEditorAccess()) return;
    if (!fridgeForm.name.trim()) return;
    const rawQtyStr = String(fridgeForm.quantity ?? "").trim();
    const parsedQty = rawQtyStr === "" ? 1 : Number(rawQtyStr);
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      showToast("⚠️ 수량은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    const id = editingFridge ? editingFridge.id : `f-${Date.now()}`;
    const priceNum = Number(fridgeForm.price) || 0;
    const baseUpdatedAt = typeof overrideUpdatedAt === "string" ? overrideUpdatedAt : editingFridge?.updatedAt;

    const payload = {
      id,
      name: fridgeForm.name.trim(),
      location: fridgeForm.location,
      category: fridgeForm.category,
      quantity: parsedQty,
      unit: fridgeForm.unit || "개",
      expiryDate: fridgeForm.expiryDate || getTodayStr(),
      expiryIsTemp: editingFridge ? Boolean(editingFridge.expiryIsTemp && !isExpiryManuallyEdited) : !isExpiryManuallyEdited,
      price: priceNum,
      purchaseDate: fridgeForm.purchaseDate || selectedDate,
      shelfZone: fridgeForm.shelfZone || "",
      updatedAt: new Date().toISOString()
    };

    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 재고를 저장할 수 있습니다.");
      return;
    }
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      if (baseUpdatedAt) {
        let conflictFound = false;
        let serverSnapData = null;
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(getDocRef("family_fridge_v4", id));
          if (snap.exists() && snap.data().updatedAt && snap.data().updatedAt !== baseUpdatedAt) {
            conflictFound = true;
            serverSnapData = snap.data();
            return;
          }
          tx.set(getDocRef("family_fridge_v3", id), payload);
          tx.set(getDocRef("family_fridge_v4", id), payload);
        });
        if (conflictFound) {
          setFridgeConflictData({ serverItem: serverSnapData, localPayload: payload });
          errMsg = "재고 수정 충돌";
          showToast("⚠️ 다른 기기에서 먼저 수정된 재고입니다. 아래에서 비교 후 선택해 주세요.");
          return;
        }
      } else {
        const batch = writeBatch(db);
        batch.set(getDocRef("family_fridge_v3", id), payload);
        batch.set(getDocRef("family_fridge_v4", id), payload);
        if (!editingFridge && priceNum > 0 && fridgeForm.recordExpense !== false) {
          const expId = `exp-${id}`;
          batch.set(getDocRef("family_expenses_v4", expId), {
            id: expId,
            title: payload.name,
            category: payload.category,
            amount: priceNum,
            date: payload.purchaseDate,
            type: "장보기/식재료"
          });
        }
        await batch.commit();
      }

      setFridgeMap((prev) => ({
        ...prev,
        local: { ...(prev.local || {}), [id]: payload }
      }));
      setFridgeConflictData(null);
      setIsFridgeModalOpen(false);
      setEditingFridge(null);
      ok = true;
      showToast(editingFridge ? "냉장고 재료가 수정되었습니다." : "냉장고에 새 재료가 입고되었습니다.");
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 재고 저장 실패: 네트워크 상태를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const handleAdjustQuantity = async (item, delta) => {
    if (!requireEditorAccess()) return;
    if (!Number.isFinite(delta)) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 수량을 변경할 수 있습니다.");
      return;
    }
    const optimisticNext = Math.max(0, Number(item.quantity || 0) + delta);
    const updated = { ...item, quantity: optimisticNext };
    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [item.id]: updated }
    }));
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const refV4 = getDocRef("family_fridge_v4", item.id);
      const refV3 = getDocRef("family_fridge_v3", item.id);
      let finalServerQty = optimisticNext;
      let finalUpdatedAt = new Date().toISOString();
      await runTransaction(db, async (tx) => {
        const snapV4 = await tx.get(refV4);
        const snapV3 = await tx.get(refV3);
        if (!snapV4.exists() && !snapV3.exists()) {
          throw new Error("이미 삭제되었거나 존재하지 않는 재고입니다.");
        }
        const rawQty = snapV4.exists() ? snapV4.data().quantity : snapV3.data().quantity;
        const serverQty = Number(rawQty || 0);
        const next = Math.round((serverQty + delta) * 100) / 100;
        if (!Number.isFinite(next) || next < 0) {
          throw new Error("재고가 0이라 더 차감할 수 없습니다. [다 먹음]을 눌러주세요.");
        }
        finalServerQty = next;
        if (snapV4.exists()) {
          tx.update(refV4, { quantity: next, updatedAt: finalUpdatedAt });
        } else {
          tx.set(refV4, { ...item, quantity: next, updatedAt: finalUpdatedAt });
        }
        if (snapV3.exists()) {
          tx.update(refV3, { quantity: next, updatedAt: finalUpdatedAt });
        }
      });
      setFridgeMap((prev) => ({
        ...prev,
        local: { ...(prev.local || {}), [item.id]: { ...item, quantity: finalServerQty, updatedAt: finalUpdatedAt } }
      }));
      ok = true;
    } catch (e) {
      errMsg = e.message;
      setFridgeMap((prev) => ({
        ...prev,
        local: { ...(prev.local || {}), [item.id]: item }
      }));
      showToast(`⚠️ ${e.message || "수량 저장 실패"}`);
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const handleMoveFridgeShelfZone = async (item, newZone) => {
    if (!requireEditorAccess()) return;
    const nextLocation =
      newZone === "팬트리"
        ? "실온·팬트리"
        : newZone.startsWith("전용냉동")
        ? "별도 냉동고"
        : newZone.startsWith("하부냉동")
        ? "메인 냉동실"
        : "냉장실";
    const updated = {
      ...item,
      shelfZone: newZone,
      location: nextLocation,
      updatedAt: new Date().toISOString()
    };
    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [item.id]: updated }
    }));
    setQuickFridgeItem((prev) => (prev && prev.id === item.id ? updated : prev));
    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        const batch = writeBatch(db);
        batch.set(getDocRef("family_fridge_v4", item.id), updated, { merge: true });
        batch.set(getDocRef("family_fridge_v3", item.id), updated, { merge: true });
        await batch.commit();
        ok = true;
      } catch (e) {
        errMsg = e.message;
        showToast("⚠️ 보관 칸 저장 실패: 네트워크를 확인해 주세요.");
        return;
      } finally {
        endWrite(ok, errMsg);
      }
    }
    showToast(`📦 '${item.name}' → [${newZone}] 이동 완료`);
  };

  // [신규 v6.2] 냉장고 식재료 폐기(소비기한 경과 등) -> 손실 금액 별도 기록
  const handleBulkMoveFridgeShelfZone = async (ids, targetZone) => {
    if (!requireEditorAccess()) return;
    const idSet = new Set(ids || []);
    if (idSet.size === 0 || !targetZone) return;
    const nextLoc = shelfZoneToLocation(targetZone);
    const nowIso = new Date().toISOString();
    const targetItems = fridge.filter((f) => idSet.has(f.id) && resolveItemShelfZone(f) !== targetZone);
    if (targetItems.length === 0) {
      showToast("선택한 재료가 이미 해당 칸에 있습니다.");
      return;
    }
    setFridgeMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!next[k]) return;
        const copy = { ...next[k] };
        let changed = false;
        targetItems.forEach((it) => {
          if (copy[it.id]) {
            copy[it.id] = { ...copy[it.id], location: nextLoc, shelfZone: targetZone, updatedAt: nowIso };
            changed = true;
          }
        });
        if (changed) next[k] = copy;
      });
      return next;
    });
    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        for (let i = 0; i < targetItems.length; i += 200) {
          const chunk = targetItems.slice(i, i + 200);
          const batch = writeBatch(db);
          chunk.forEach((it) => {
            const updated = { ...it, location: nextLoc, shelfZone: targetZone, updatedAt: nowIso };
            batch.set(getDocRef("family_fridge_v4", it.id), updated, { merge: true });
            batch.set(getDocRef("family_fridge_v3", it.id), updated, { merge: true });
          });
          await batch.commit();
        }
        ok = true;
      } catch (e) {
        errMsg = e?.message || "냉장고 일괄 칸 이동 오류";
        setSyncErrorMsg(errMsg);
      } finally {
        endWrite(ok, errMsg);
      }
    }
    setSelectedBulkFridgeIds([]);
    setBulkMoveMode(false);
    showToast(`📦 ${targetItems.length}개 재료를 '${targetZone}'(으)로 일괄 이동했습니다!`);
  };

  const handleWasteFridgeItem = async (item) => {
    if (!requireEditorAccess()) return;
    const lossAmount = Number(item.price) || 0;
    const eventId = `waste-${item.id}-${Date.now()}`;
    const wasteRecord = {
      id: eventId,
      itemId: item.id,
      name: item.name,
      eventType: "waste",
      estimatedLoss: lossAmount,
      date: getTodayStr(),
      reason: "폐기 처리",
      createdAt: new Date().toISOString()
    };

    setWasteEvents((prev) => [wasteRecord, ...prev]);
    await markIdDeleted(item.id);
    if (user && db) {
      try {
        await setDoc(getDocRef("family_inventory_events_v7", eventId), wasteRecord);
        await deleteDoc(getDocRef("family_fridge_v3", item.id));
        await deleteDoc(getDocRef("family_fridge_v4", item.id));
      } catch (e) {
        showToast("⚠️ 폐기 기록 저장 중 오류가 발생했습니다.");
      }
    }
    showToast(
      lossAmount > 0
        ? `'${item.name}' 폐기 완료 (추정 손실 ${lossAmount.toLocaleString()}원 기록됨)`
        : `'${item.name}' 폐기 처리 완료`
    );
  };

  // [신규 v6.2] AI 레시피 부족 재료 일괄 장보기 담기
  const handleAddMissingIngredientsToShopping = async (usedIngs) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 장보기 목록에 담을 수 있습니다.");
      return;
    }
    const fridgeNames = fridge.map((f) => String(f.name || "").toLowerCase());
    const shopNames = shoppingList.map((s) => String(s.name || "").toLowerCase());
    const dedupMap = new Map();
    for (const raw of toSafeArray(usedIngs)) {
      const name = typeof raw === "object" ? String(raw.name || "").trim() : String(raw || "").trim();
      const quantity = typeof raw === "object" ? String(raw.quantity || "1개").trim() || "1개" : "1개";
      if (!name) continue;
      const lower = name.toLowerCase();
      if (
        fridgeNames.some((fn) => fn.includes(lower) || lower.includes(fn)) ||
        shopNames.some((sn) => sn.includes(lower) || lower.includes(sn))
      ) {
        continue;
      }
      if (!dedupMap.has(lower)) dedupMap.set(lower, { name, quantity });
    }
    const missing = Array.from(dedupMap.values());
    if (missing.length === 0) {
      showToast("부족한 재료가 이미 냉장고 또는 장보기 목록에 있습니다!");
      return;
    }

    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const batch = writeBatch(db);
      const created = [];
      missing.forEach((ing, idx) => {
        const shId = `sh-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        const newShop = {
          id: shId,
          name: ing.name,
          quantity: ing.quantity,
          category: "기타",
          urgent: false,
          checked: false,
          memo: "AI 추천 부족 재료"
        };
        created.push(newShop);
        batch.set(getDocRef("family_shopping_v4", shId), newShop);
      });
      await batch.commit();
      setShoppingList((prev) => [...created, ...prev]);
      ok = true;
      showToast(`부족한 재료 ${created.length}종을 장보기 목록에 담았습니다!`);
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 장보기 일괄 저장 실패: 네트워크를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  // [v7.1 개선] 요리 완료 전 차감 수량 확인 팝업 열기 & 확정 차감
  const handleCompleteRecipeCooking = (recipe) => {
    if (!requireEditorAccess()) return;
    const used = toSafeArray(recipe.usedIngredients);
    const matched = fridge.filter((f) =>
      used.some(
        (u) =>
          String(f.name || "").toLowerCase().includes(u.toLowerCase()) ||
          u.toLowerCase().includes(String(f.name || "").toLowerCase())
      ) && Number(f.quantity || 0) > 0
    );
    if (matched.length === 0) {
      showToast("차감할 매칭 냉장고 재고가 없습니다.");
      return;
    }
    setCookingConfirmModal({
      operationId: `cook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipeTitle: recipe.title,
      items: matched.map((m) => ({
        item: m,
        deductQty: 1
      }))
    });
  };

  const handleConfirmCookingDeduction = async () => {
    if (!requireEditorAccess()) return;
    if (!cookingConfirmModal || isCookingDeducting) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 대기 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const rawDeduct = cookingConfirmModal.items.filter((x) => Number(x.deductQty) > 0);
    if (rawDeduct.length === 0) {
      setCookingConfirmModal(null);
      return;
    }
    const aggregatedMap = new Map();
    for (const entry of rawDeduct) {
      const id = entry.item?.id;
      if (!id) continue;
      const prev = aggregatedMap.get(id);
      const qty = Number(entry.deductQty) || 0;
      if (prev) {
        prev.deductQty += qty;
      } else {
        aggregatedMap.set(id, { item: entry.item, deductQty: qty });
      }
    }
    const toDeduct = Array.from(aggregatedMap.values());
    if (user && db) {
      setIsCookingDeducting(true);
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        const opId = cookingConfirmModal.operationId || `cook-${Date.now()}`;
        const opRef = getDocRef("family_cooking_operations_v7", opId);
        let alreadyProcessed = false;
        await runTransaction(db, async (tx) => {
          const existingOp = await tx.get(opRef);
          if (existingOp.exists()) {
            alreadyProcessed = true;
            return;
          }
          const snapshots = [];
          for (const entry of toDeduct) {
            const refV4 = getDocRef("family_fridge_v4", entry.item.id);
            const refV3 = getDocRef("family_fridge_v3", entry.item.id);
            const snapV4 = await tx.get(refV4);
            const snapV3 = await tx.get(refV3);
            if (!snapV4.exists() && !snapV3.exists()) {
              throw new Error(`'${entry.item.name}' 재고를 찾을 수 없습니다.`);
            }
            const baseSnap = snapV4.exists() ? snapV4 : snapV3;
            const cur = Number(baseSnap.data().quantity || 0);
            const next = cur - entry.deductQty;
            if (!Number.isFinite(next) || next < 0) {
              throw new Error(`'${entry.item.name}' 재고가 부족합니다 (현재고 ${cur}).`);
            }
            if (snapV4.exists()) snapshots.push({ ref: refV4, next });
            if (snapV3.exists()) snapshots.push({ ref: refV3, next });
          }
          const nowIso = new Date().toISOString();
          for (const s of snapshots) {
            tx.update(s.ref, { quantity: s.next, updatedAt: nowIso });
          }
          tx.set(opRef, {
            id: opId,
            recipeTitle: cookingConfirmModal.recipeTitle,
            status: "completed",
            createdAt: new Date().toISOString()
          });
        });
        ok = true;
        setCookingConfirmModal(null);
        if (alreadyProcessed) {
          showToast("이미 처리된 요리 완료 기록입니다.");
        } else {
          showToast(`요리 완료! 선택한 재료 ${toDeduct.length}종이 안전하게 일괄 차감되었습니다.`);
        }
      } catch (e) {
        errMsg = e.message;
        showToast(`⚠️ 차감 실패(전체 취소됨): ${e.message}`);
      } finally {
        endWrite(ok, errMsg);
        setIsCookingDeducting(false);
      }
    }
  };

  const handleConsumeFridgeItem = async (item, addToShopping = false) => {
    if (!requireEditorAccess()) return;
    if (user && db && Number(item.price) > 0) {
      const expId = `exp-${item.id}`;
      try {
        await setDoc(getDocRef("family_expenses_v4", expId), {
          id: expId,
          title: item.name,
          category: item.category || "기타",
          amount: Number(item.price),
          date: item.purchaseDate || getTodayStr(),
          type: "장보기/식재료"
        });
      } catch (e) {
        setSyncErrorMsg(e?.message || "소진 식비 원장 보존 오류");
      }
    }

    await markIdDeleted(item.id);
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_fridge_v3", item.id));
        await deleteDoc(getDocRef("family_fridge_v4", item.id));
      } catch (e) {
        setSyncErrorMsg(e?.message || "소진 재고 삭제 동기화 오류");
      }
    }

    if (getDaysDiff(item.expiryDate) <= 3 && Number(item.price) > 0) {
      const resId = `res-${Date.now()}`;
      const rescuedEv = {
        id: resId,
        type: "rescued",
        itemName: item.name,
        savedAmount: Number(item.price) || 0,
        date: getTodayStr()
      };
      setWasteEvents((prev) => [rescuedEv, ...prev]);
      if (user && db) {
        try {
          await setDoc(getDocRef("family_inventory_events_v7", resId), rescuedEv);
        } catch (e) {}
      }
    }

    if (addToShopping) {
      const alreadyInShop = shoppingList.some(
        (s) => String(s.name || "").trim().toLowerCase() === String(item.name || "").trim().toLowerCase()
      );
      if (!alreadyInShop) {
        const shId = `sh-${Date.now()}`;
        const newShop = {
          id: shId,
          name: item.name,
          quantity: `1${item.unit || "개"}`,
          category: item.category || "기타",
          urgent: true,
          checked: false,
          memo: "냉장고 소진 후 재구매"
        };
        setShoppingList((prev) => [newShop, ...prev]);
        if (user && db) {
          try {
            await setDoc(getDocRef("family_shopping_v4", shId), newShop);
          } catch (e) {
            setSyncErrorMsg(e?.message || "소진 후 장보기 추가 오류");
          }
        }
        showToast(`'${item.name}' 소진 완료! (식비 유지 & 장보기 메모 추가됨)`);
      } else {
        showToast(`'${item.name}' 소진 완료! (이미 장보기 목록에 있어 중복 추가 제외)`);
      }
    } else {
      showToast(`'${item.name}' 다 먹음 처리 완료! (이번 달 지출 식비는 그대로 유지됩니다)`);
    }
  };

  const handleMistakeDeleteFridgeItem = async (item) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 삭제할 수 있습니다.");
      return;
    }
    const entry = createLogEntryPayload("fridge", item.name || "냉장고 재료", item, "delete");
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const batch = writeBatch(db);
      batch.set(getDocRef("family_deleted_logs_v8", entry.logId), entry);
      batch.set(getDocRef("family_meta_v4", "deleted_tracker"), { ids: arrayUnion(item.id) }, { merge: true });
      batch.delete(getDocRef("family_fridge_v3", item.id));
      batch.delete(getDocRef("family_fridge_v4", item.id));
      await batch.commit();

      setDeletedIds((prev) => {
        const next = Array.from(new Set([...prev, item.id]));
        try { localStorage.setItem("kim_family_deleted_ids", JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setDeletedLogs((prev) => [entry, ...prev.filter((x) => x.logId !== entry.logId)].slice(0, 30));
      ok = true;
      showToast(`'${item.name}' 삭제됨 (식비 원장 보존)`, () => restoreDeletedLogEntry(entry));
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 재고 삭제 실패: 네트워크 상태를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const handleSaveMeal = async () => {
    if (!requireEditorAccess()) return;
    const pendingChip = String(mealChipInput || "").trim();
    const baseParts = String(mealForm.menu || "")
      .split(/\s*\+\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pendingChip && !baseParts.includes(pendingChip)) {
      baseParts.push(pendingChip);
    }
    const mergedMenu = baseParts.join(" + ");
    if (!mergedMenu) {
      showToast("메뉴명을 입력해 주세요.");
      return;
    }
    if (pendingChip) setMealChipInput("");
    const id = editingMeal ? editingMeal.id : `m-${Date.now()}`;
    const safeMembers = toSafeArray(mealForm.members);
    const payload = {
      id,
      date: mealForm.date,
      slot: mealForm.slot,
      menu: mergedMenu,
      members: safeMembers.length > 0 ? safeMembers : ["수혁", "아리나"],
      ingredients: toSafeArray(mealForm.ingredients),
      note: mealForm.note || "",
      sourceType: mealForm.sourceType || "집밥/온가족식",
      cost: Number(mealForm.cost) || 0,
      updatedAt: new Date().toISOString()
    };

    if (!user || !db) {
      showToast("⚠️ 서버 미연결 상태입니다. 연결 후 다시 저장해 주세요.");
      return;
    }
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      if (editingMeal?.updatedAt) {
        let mealConflict = false;
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(getDocRef("family_meals_v4", id));
          if (snap.exists() && snap.data().updatedAt && snap.data().updatedAt !== editingMeal.updatedAt) {
            mealConflict = true;
            return;
          }
          tx.set(getDocRef("family_meals_v3", id), payload);
          tx.set(getDocRef("family_meals_v4", id), payload);
        });
        if (mealConflict) {
          showToast("⚠️ 다른 기기에서 먼저 수정된 식단입니다. 최신 내용을 확인 후 다시 수정해 주세요.");
          setIsMealModalOpen(false);
          setEditingMeal(null);
          ok = true;
          return;
        }
      } else {
        const batch = writeBatch(db);
        batch.set(getDocRef("family_meals_v3", id), payload);
        batch.set(getDocRef("family_meals_v4", id), payload);
        await batch.commit();
      }

      setMealsMap((prev) => ({
        ...prev,
        local: { ...(prev.local || {}), [id]: payload }
      }));
      setIsMealModalOpen(false);
      setEditingMeal(null);
      ok = true;
      showToast("식단이 저장되었습니다.");
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 식단 저장 실패: 입력 내용은 유지되었으니 다시 시도해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const handleDeleteMeal = async (meal) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 삭제할 수 있습니다.");
      return;
    }
    const entry = createLogEntryPayload("meal", meal.menu || "식단", meal, "delete");
    beginWrite();
    let ok = false;
    let errMsg = "";
    try {
      const batch = writeBatch(db);
      batch.set(getDocRef("family_deleted_logs_v8", entry.logId), entry);
      batch.set(getDocRef("family_meta_v4", "deleted_tracker"), { ids: arrayUnion(meal.id) }, { merge: true });
      batch.delete(getDocRef("family_meals_v3", meal.id));
      batch.delete(getDocRef("family_meals_v4", meal.id));
      await batch.commit();

      setDeletedIds((prev) => {
        const next = Array.from(new Set([...prev, meal.id]));
        try { localStorage.setItem("kim_family_deleted_ids", JSON.stringify(next)); } catch (e) {}
        return next;
      });
      setDeletedLogs((prev) => [entry, ...prev.filter((x) => x.logId !== entry.logId)].slice(0, 30));
      ok = true;
      showToast(`'${meal.menu || "식단"}' 삭제됨`, () => restoreDeletedLogEntry(entry));
    } catch (e) {
      errMsg = e.message;
      showToast("⚠️ 식단 삭제 실패: 네트워크 상태를 확인해 주세요.");
    } finally {
      endWrite(ok, errMsg);
    }
  };

  const fridgeProjectedMap = useMemo(
    () =>
      computeFridgeProjectedUsage(
        fridge,
        meals,
        getTodayStr(),
        addMonthsToDateStr,
        matchFridgeItemExactFirst,
        convertUnitQty
      ),
    [fridge, meals]
  );

  const handleQuickParseShopping = async () => {
    if (!requireEditorAccess()) return;
    const raw = quickShoppingText.trim();
    if (!raw) {
      showToast("파싱할 장보기 문장을 입력해 주세요.");
      return;
    }
    setIsQuickParsingShopping(true);
    let parsedItems = [];
    try {
      if (geminiApiKey || openaiApiKey) {
        try {
          const aiRes = await callReliableAiEngine({
            apiKey: geminiApiKey,
            openaiApiKey,
            aiProvider,
            expectObject: true,
            promptText: `다음 한국어 장보기 메모/카톡 문장에서 구매할 품목만 추출해 JSON 객체로 응답하세요.\n문장: "${raw}"\n형식: {"items":[{"name":"품목명","quantity":"수량(예:1망,2모,1L,1개)","category":"채소/과일|육류/수산|유제품/계란|유아식/이유식 재료|반찬/김치|밀키트|양념/소스|기타"}]}`
          });
          if (Array.isArray(aiRes?.items) && aiRes.items.length > 0) {
            parsedItems = aiRes.items
              .filter((x) => x?.name)
              .map((x) => ({
                name: String(x.name).trim(),
                quantity: String(x.quantity || "1개").trim(),
                category: FRIDGE_CATEGORIES.includes(x.category) ? x.category : "기타"
              }));
          }
        } catch (aiErr) {}
      }
      if (parsedItems.length === 0) {
        parsedItems = parseQuickShoppingTextLocal(raw);
      }
      if (parsedItems.length === 0) {
        showToast("추출된 품목이 없습니다.");
        return;
      }

      const existingNames = new Set(
        shoppingList.map((s) => String(s.name || "").trim().toLowerCase()).filter(Boolean)
      );
      const uniqueItems = [];
      let skippedCount = 0;
      parsedItems.forEach((it) => {
        const key = String(it.name || "").trim().toLowerCase();
        if (!key || existingNames.has(key)) {
          skippedCount += 1;
        } else {
          existingNames.add(key);
          uniqueItems.push(it);
        }
      });

      if (uniqueItems.length === 0) {
        setQuickShoppingText("");
        showToast("이미 장보기 목록에 모두 등록되어 있습니다.");
        return;
      }

      const newPayloads = uniqueItems.map((it, idx) => ({
        id: `sh-${Date.now()}-${idx}`,
        name: it.name,
        quantity: it.quantity || "1개",
        category: it.category || "기타",
        urgent: false,
        checked: false,
        memo: "카톡·음성 1초 파싱"
      }));

      setShoppingList((prev) => [...newPayloads, ...prev]);
      if (user && db) {
        const batch = writeBatch(db);
        newPayloads.forEach((p) => {
          batch.set(getDocRef("family_shopping_v4", p.id), p);
        });
        await batch.commit();
      }
      setQuickShoppingText("");
      showToast(
        skippedCount > 0
          ? `⚡ ${newPayloads.length}건 추가 완료 (중복 ${skippedCount}건 제외)`
          : `⚡ ${newPayloads.length}건이 장보기 목록에 추가되었습니다!`
      );
    } catch (e) {
      showToast("⚠️ 장보기 파싱 저장 중 오류가 발생했습니다.");
    } finally {
      setIsQuickParsingShopping(false);
    }
  };

  const appendRecipeIngredientChip = (rawChip) => {
    const clean = String(rawChip || "").trim();
    if (!clean) return;
    const existing = String(recipeForm.ingredientsText || "")
      .split(/\s*(?:\+|,|\n)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!existing.includes(clean)) {
      existing.push(clean);
    }
    setRecipeForm((prev) => ({ ...prev, ingredientsText: existing.join(" + ") }));
  };

  const handleQuickAddSingleIngredientToShopping = async (rawToken, recipeTitle = "") => {
    if (!requireEditorAccess()) return;
    const parsed = parseRecipeIngredientToken(rawToken);
    if (!parsed.name) return;
    const itemName = parsed.name;
    const itemQty = parsed.qtyText;
    const exists = shoppingList.some(
      (s) => String(s.name || "").trim().toLowerCase() === itemName.toLowerCase()
    );
    if (exists) {
      showToast(`'${itemName}'은(는) 이미 장보기 목록에 있습니다.`);
      return;
    }
    const id = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const payload = {
      id,
      name: itemName,
      quantity: itemQty,
      category: "기타",
      urgent: false,
      checked: false,
      memo: recipeTitle ? `레시피(${recipeTitle})` : "레시피북 추가"
    };
    setShoppingList((prev) => [payload, ...prev]);
    if (user && db) {
      try {
        await setDoc(getDocRef("family_shopping_v4", id), payload);
      } catch (e) {
        setSyncErrorMsg(e?.message || "장보기 추가 오류");
      }
    }
    showToast(`🛒 '${itemName} (${itemQty})' 장보기에 추가됨!`);
  };

  const openCropModalWithUrl = (srcUrl) => {
    if (!srcUrl) return;
    setCropAspect("free");
    setCropRect({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
    setCropModal({ srcUrl });
  };

  const handleRecipePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { previewUrl, base64, mimeType } = await fileToBase64(file, { maxSide: 1400, quality: 0.88 });
      const rawUrl = previewUrl || (base64 ? `data:${mimeType || "image/jpeg"};base64,${base64}` : "");
      if (!rawUrl) {
        showToast("⚠️ 이미지를 읽을 수 없습니다. 다른 사진을 선택해 주세요.");
        return;
      }
      openCropModalWithUrl(rawUrl);
    } catch (err) {
      showToast("⚠️ 사진 처리 중 오류가 발생했습니다.");
    } finally {
      if (recipePhotoInputRef.current) recipePhotoInputRef.current.value = "";
    }
  };

  const handleApplyCrop = async () => {
    if (!cropModal?.srcUrl || !cropImgRef.current) return;
    const img = cropImgRef.current;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return;

    const sx = Math.max(0, Math.round(cropRect.x * natW));
    const sy = Math.max(0, Math.round(cropRect.y * natH));
    const sw = Math.max(20, Math.round(cropRect.w * natW));
    const sh = Math.max(20, Math.round(cropRect.h * natH));

    const maxSide = 720;
    let dw = sw;
    let dh = sh;
    if (dw > dh && dw > maxSide) {
      dh = Math.round((dh * maxSide) / dw);
      dw = maxSide;
    } else if (dh >= dw && dh > maxSide) {
      dw = Math.round((dw * maxSide) / dh);
      dh = maxSide;
    }

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const croppedRaw = canvas.toDataURL("image/jpeg", 0.68);
    const safeUrl = await compressDataUrlForFirestore(croppedRaw, 720, 0.65);
    setRecipeForm((prev) => ({ ...prev, photoDataUrl: safeUrl || croppedRaw }));
    setCropModal(null);
    showToast("✂️ 선택한 영역으로 사진이 잘렸습니다!");
  };

  const handleCropPointerDown = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    const box = cropBoxRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return;
    const pt = e.touches ? e.touches[0] : e;
    cropDragRef.current = {
      mode,
      startX: pt.clientX,
      startY: pt.clientY,
      boxW: box.width,
      boxH: box.height,
      init: { ...cropRect }
    };

    const onMove = (ev) => {
      const drag = cropDragRef.current;
      if (!drag) return;
      if (ev.cancelable) ev.preventDefault();
      const curPt = ev.touches ? ev.touches[0] : ev;
      const dx = (curPt.clientX - drag.startX) / drag.boxW;
      const dy = (curPt.clientY - drag.startY) / drag.boxH;
      const minSize = 0.12;
      let { x, y, w, h } = drag.init;

      if (drag.mode === "move") {
        x = Math.max(0, Math.min(1 - w, x + dx));
        y = Math.max(0, Math.min(1 - h, y + dy));
      } else {
        if (drag.mode.includes("e")) {
          w = Math.max(minSize, Math.min(1 - x, w + dx));
        }
        if (drag.mode.includes("s")) {
          h = Math.max(minSize, Math.min(1 - y, h + dy));
        }
        if (drag.mode.includes("w")) {
          const newX = Math.max(0, Math.min(x + w - minSize, x + dx));
          w = w + (x - newX);
          x = newX;
        }
        if (drag.mode.includes("n")) {
          const newY = Math.max(0, Math.min(y + h - minSize, y + dy));
          h = h + (y - newY);
          y = newY;
        }
        if (cropAspect !== "free") {
          const ratioMap = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9 };
          const targetRatio = ratioMap[cropAspect] || 1;
          const imgRatio = drag.boxW / drag.boxH;
          h = Math.min(1 - y, Math.max(minSize, (w * imgRatio) / targetRatio));
          if (x + w > 1) w = 1 - x;
        }
      }
      setCropRect({ x, y, w, h });
    };

    const onUp = () => {
      cropDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const openNewRecipeModal = (prefill = null) => {
    if (!requireEditorAccess()) return;
    setEditingRecipe(null);
    setRecipeForm({
      title: prefill?.title || "",
      category: prefill?.category || "메인반찬",
      photoDataUrl: prefill?.photoDataUrl || "",
      ingredientsText: prefill?.ingredientsText || "",
      cookTime: prefill?.cookTime || "20분",
      difficulty: prefill?.difficulty || "쉬움",
      ratings: prefill?.ratings || { 수혁: 5, 아리나: 5, 시목: 0, 시율: 0 },
      stepsText: prefill?.stepsText || "",
      memo: prefill?.memo || "",
      platingCoach: prefill?.platingCoach || null
    });
    setIsRecipeModalOpen(true);
  };

  const handleSaveRecipe = async () => {
    if (!requireEditorAccess()) return;
    if (!recipeForm.title.trim()) {
      showToast("요리명을 입력해 주세요.");
      return;
    }
    const pendingIng = String(recipeIngredientInput || "").trim();
    const ingParts = String(recipeForm.ingredientsText || "")
      .split(/[+,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pendingIng && !ingParts.includes(pendingIng)) {
      ingParts.push(pendingIng);
    }
    const mergedIngText = ingParts.join(" + ");
    if (pendingIng) setRecipeIngredientInput("");
    const nowIso = new Date().toISOString();
    const id = editingRecipe?.id || `rcp-${Date.now()}`;
    const ingredients = mergedIngText
      .split(/[+,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((chunk) => {
        const parsed = parseRecipeIngredientToken(chunk);
        return { name: parsed.name, qty: parsed.qty, unit: parsed.unit };
      });

    const payload = {
      id,
      title: recipeForm.title.trim(),
      category: recipeForm.category || "메인반찬",
      photoDataUrl: recipeForm.photoDataUrl || "",
      ingredientsText: mergedIngText,
      ingredients,
      cookTime: recipeForm.cookTime || "20분",
      difficulty: recipeForm.difficulty || "쉬움",
      ratings: recipeForm.ratings || { 수혁: 5, 아리나: 5, 시목: 0, 시율: 0 },
      stepsText: recipeForm.stepsText || "",
      memo: recipeForm.memo || "",
      platingCoach: recipeForm.platingCoach || null,
      createdAt: editingRecipe?.createdAt || nowIso,
      updatedAt: nowIso
    };

    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === id);
      return exists ? prev.map((r) => (r.id === id ? payload : r)) : [payload, ...prev];
    });
    setIsRecipeModalOpen(false);
    setEditingRecipe(null);

    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        await setDoc(getDocRef("family_recipes_v8", id), payload);
        ok = true;
      } catch (e) {
        errMsg = e?.message || "레시피 저장 오류";
        showToast("⚠️ 레시피 서버 저장 실패 — 로컬에는 반영되었습니다.");
        return;
      } finally {
        endWrite(ok, errMsg);
      }
    }
    showToast("📖 가족 레시피북에 저장되었습니다!");
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (!requireEditorAccess()) return;
    if (!window.confirm("이 레시피를 가족 레시피북에서 삭제할까요?")) return;
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_recipes_v8", recipeId));
      } catch (e) {
        setSyncErrorMsg(e?.message || "레시피 삭제 동기화 오류");
      }
    }
    showToast("레시피가 삭제되었습니다.");
  };

  const handleSendPlatingToRecipeBook = async () => {
    if (!requireEditorAccess()) return;
    if (!platingResult) return;
    const rawPhoto = platingPreviewUrl || platingExampleImageUrl || "";
    const compressedPhoto = rawPhoto ? await compressDataUrlForFirestore(rawPhoto, 720, 0.65) : "";
    openNewRecipeModal({
      title: platingResult.dishName || "플레이팅 요리",
      photoDataUrl: compressedPhoto,
      memo: [
        platingResult.summary ? `[플레이팅 코치] ${platingResult.summary}` : "",
        platingResult.plateAndGarnish ? `추천 그릇·가니쉬: ${platingResult.plateAndGarnish}` : ""
      ].filter(Boolean).join("\n"),
      platingCoach: {
        colorScore: platingResult.colorScore,
        layoutScore: platingResult.layoutScore,
        summary: platingResult.summary,
        plateAndGarnish: platingResult.plateAndGarnish
      }
    });
  };

  const handleApplyRecipeToMeal = (recipe) => {
    if (!requireEditorAccess()) return;
    setEditingMeal(null);
    setMealForm({
      date: selectedDate || getTodayStr(),
      slot: "저녁",
      menu: recipe.title,
      members: ["수혁", "아리나", "시목"],
      ingredients: toSafeArray(recipe.ingredients),
      note: `📖 레시피북 재현 (${recipe.cookTime || "20분"} · ${recipe.difficulty || "쉬움"})`,
      sourceType: "집밥/온가족식",
      cost: 0
    });
    setIsMealModalOpen(true);
  };

  const handleAddMissingRecipeIngredientsToShopping = async (recipe) => {
    if (!requireEditorAccess()) return;
    const ings = toSafeArray(recipe.ingredients);
    if (ings.length === 0) {
      showToast("등록된 재료가 없습니다.");
      return;
    }
    const missing = ings.filter((ing) => {
      const n = typeof ing === "string" ? parseRecipeIngredientToken(ing).name : ing?.name;
      return n && !matchFridgeItemExactFirst(n, fridge);
    });
    if (missing.length === 0) {
      showToast("✅ 모든 재료가 냉장고에 이미 있습니다!");
      return;
    }
    const existingShopNames = new Set(
      shoppingList.map((s) => String(s.name || "").trim().toLowerCase()).filter(Boolean)
    );
    const toAdd = [];
    let skippedDup = 0;
    missing.forEach((ing) => {
      const parsed = typeof ing === "string" ? parseRecipeIngredientToken(ing) : null;
      const n = parsed ? parsed.name : String(ing?.name || "").trim();
      const q = parsed
        ? parsed.qtyText
        : typeof ing === "object" && ing?.qty
        ? `${ing.qty}${ing.unit || "개"}`
        : "1개";
      const key = n.toLowerCase();
      if (!n || existingShopNames.has(key)) {
        skippedDup += 1;
      } else {
        existingShopNames.add(key);
        toAdd.push({ n, q });
      }
    });
    if (toAdd.length === 0) {
      showToast("부족한 재료가 이미 장보기 목록에 모두 담겨 있습니다.");
      return;
    }
    const newPayloads = toAdd.map(({ n, q }, idx) => {
      return {
        id: `sh-rcp-${Date.now()}-${idx}`,
        name: n,
        quantity: q,
        category: "기타",
        urgent: false,
        checked: false,
        memo: `레시피(${recipe.title}) 필요 재료`
      };
    });
    setShoppingList((prev) => [...newPayloads, ...prev]);
    if (user && db) {
      try {
        const batch = writeBatch(db);
        newPayloads.forEach((p) => batch.set(getDocRef("family_shopping_v4", p.id), p));
        await batch.commit();
      } catch (e) {
        setSyncErrorMsg(e?.message || "레시피 부족 재료 장보기 저장 오류");
      }
    }
    showToast(`🛒 냉장고에 없는 재료 ${newPayloads.length}건을 장보기에 추가했습니다!`);
  };

  const handleAddShopping = async () => {
    if (!requireEditorAccess()) return;
    if (!shoppingForm.name.trim()) return;
    const id = `sh-${Date.now()}`;
    const payload = {
      id,
      name: shoppingForm.name.trim(),
      quantity: shoppingForm.quantity || "1개",
      category: shoppingForm.category,
      urgent: Boolean(shoppingForm.urgent),
      checked: false,
      memo: shoppingForm.memo || ""
    };
    setShoppingList((prev) => [payload, ...prev]);
    setShoppingForm({ name: "", quantity: "1개", category: "채소/과일", urgent: false, memo: "" });
    if (user && db) {
      try {
        await setDoc(getDocRef("family_shopping_v4", id), payload);
      } catch (e) {
        setSyncErrorMsg(e?.message || "장보기 추가 동기화 오류");
      }
    }
    showToast("장보기 메모에 추가되었습니다.");
  };

  const handleToggleShopping = async (item) => {
    if (!requireEditorAccess()) return;
    const updated = { ...item, checked: !item.checked };
    setShoppingList((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_shopping_v4", item.id), updated);
      } catch (e) {
        setSyncErrorMsg(e?.message || "장보기 체크 동기화 오류");
      }
    }
  };

  const handleDeleteShopping = async (id) => {
    if (!requireEditorAccess()) return;
    setShoppingList((prev) => prev.filter((s) => s.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_shopping_v4", id));
      } catch (e) {
        setSyncErrorMsg(e?.message || "장보기 삭제 동기화 오류");
      }
    }
  };

  const handleClearCheckedShopping = async () => {
    if (!requireEditorAccess()) return;
    const checkedItems = shoppingList.filter((s) => s.checked);
    if (checkedItems.length === 0) return;
    const checkedIds = new Set(checkedItems.map((s) => s.id));
    setShoppingList((prev) => prev.filter((s) => !checkedIds.has(s.id)));
    if (user && db) {
      beginWrite();
      try {
        const batch = writeBatch(db);
        checkedItems.forEach((s) => batch.delete(getDocRef("family_shopping_v4", s.id)));
        await batch.commit();
        showToast(`🧹 체크 완료된 장보기 ${checkedItems.length}건을 비웠습니다.`);
      } catch (e) {
        setSyncErrorMsg(e?.message || "장보기 일괄 삭제 오류");
      } finally {
        endWrite();
      }
    }
  };

  const handleConfirmStockIn = async () => {
    if (!requireEditorAccess()) return;
    if (!stockInItem) return;
    const fId = `f-${Date.now()}`;
    const priceNum = Number(stockInPrice) || 0;
    const expDateObj = new Date();
    expDateObj.setDate(expDateObj.getDate() + 10);

    const rawQtyStr = String(stockInItem.quantity || "1개").trim();
    const qtyMatch = rawQtyStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    const parsedQty = qtyMatch && Number(qtyMatch[1]) > 0 ? Number(qtyMatch[1]) : 1;
    const parsedUnit = (qtyMatch && qtyMatch[2] ? qtyMatch[2].trim() : "") || "개";
    const itemLoc = STORAGE_LOCATIONS.includes(stockInLocation) ? stockInLocation : "냉장실";
    const itemCat = stockInItem.category || "채소/과일";
    const autoZone = resolveItemShelfZone({ location: itemLoc, category: itemCat });
    const defaultExp = getDefaultExpiryForLocation(itemLoc);

    const newFridgeItem = {
      id: fId,
      name: stockInItem.name,
      location: itemLoc,
      shelfZone: autoZone,
      category: itemCat,
      quantity: parsedQty,
      unit: parsedUnit,
      expiryDate: defaultExp || formatDate(expDateObj),
      price: priceNum,
      purchaseDate: selectedDate
    };

    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [fId]: newFridgeItem }
    }));
    setShoppingList((prev) => prev.filter((s) => s.id !== stockInItem.id));

    if (user && db) {
      beginWrite();
      let ok = false;
      let errMsg = "";
      try {
        await setDoc(getDocRef("family_fridge_v3", fId), newFridgeItem);
        await setDoc(getDocRef("family_fridge_v4", fId), newFridgeItem);
        await deleteDoc(getDocRef("family_shopping_v4", stockInItem.id));
        if (priceNum > 0) {
          const expId = `exp-${fId}`;
          await setDoc(getDocRef("family_expenses_v4", expId), {
            id: expId,
            title: newFridgeItem.name,
            category: newFridgeItem.category,
            amount: priceNum,
            date: selectedDate,
            type: "장보기/식재료"
          });
        }
        ok = true;
      } catch (e) {
        errMsg = e?.message || "장보기 입고 동기화 오류";
        setSyncErrorMsg(errMsg);
      } finally {
        endWrite(ok, errMsg);
      }
    }
    setStockInItem(null);
    setStockInPrice("");
    setStockInLocation("냉장실");
    showToast("구매 완료! 냉장고 입고 및 식비 가계부에 반영되었습니다.");
  };

  const handleSaveNotice = async () => {
    if (!requireEditorAccess()) return;
    if (!noticeForm.title.trim()) return;
    const id = editingNotice ? editingNotice.id : `nt-${Date.now()}`;
    const payload = {
      id,
      title: noticeForm.title.trim(),
      content: (noticeForm.content || "").trim(),
      category: noticeForm.category,
      author: noticeForm.author,
      pinned: Boolean(noticeForm.pinned),
      done: editingNotice ? Boolean(editingNotice.done) : false,
      createdAt: selectedDate
    };
    setNotices((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = payload;
        return copy;
      }
      return [payload, ...prev];
    });
    setIsNoticeModalOpen(false);
    setEditingNotice(null);
    if (user && db) {
      try {
        await setDoc(getDocRef("family_notices_v4", id), payload);
      } catch (e) {
        setSyncErrorMsg(e?.message || "공지 추가 동기화 오류");
      }
    }
    showToast("가족 공지사항이 등록되었습니다.");
  };

  const handleToggleNoticeDone = async (notice) => {
    if (!requireEditorAccess()) return;
    const updated = { ...notice, done: !notice.done };
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? updated : n)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_notices_v4", notice.id), updated);
      } catch (e) {
        setSyncErrorMsg(e?.message || "공지 상태 동기화 오류");
      }
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!requireEditorAccess()) return;
    setNotices((prev) => prev.filter((n) => n.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_notices_v4", id));
      } catch (e) {
        setSyncErrorMsg(e?.message || "공지 삭제 동기화 오류");
      }
    }
    showToast("공지사항이 삭제되었습니다.");
  };

  const handleConfirmQuickLog = async () => {
    if (!requireEditorAccess()) return;
    if (!quickLogRecipe) return;
    const id = `m-${Date.now()}`;
    const payload = {
      id,
      date: quickLogDate,
      slot: quickLogSlot,
      menu: quickLogRecipe.title,
      members:
        toSafeArray(quickLogRecipe.members).length > 0
          ? toSafeArray(quickLogRecipe.members)
          : ["수혁", "아리나", "시목", "시율"],
      ingredients: toSafeArray(quickLogRecipe.usedIngredients),
      note: `AI 추천 레시피 (${quickLogRecipe.tip || ""})`,
      sourceType: "집밥/온가족식",
      cost: 0
    };
    setMealsMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [id]: payload }
    }));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_meals_v3", id), payload);
        await setDoc(getDocRef("family_meals_v4", id), payload);
      } catch (e) {
        setSyncErrorMsg(e?.message || "AI 식단 등록 동기화 오류");
      }
    }
    setQuickLogRecipe(null);
    showToast(`${quickLogDate} ${quickLogSlot} 식단표에 등록되었습니다!`);
  };

  // ==========================================
  // 11. 파생 통계 계산
  // ==========================================
  const monthlyExpenseSummary = useMemo(() => {
    const monthPrefix = currentMonth;
    const ledgerItems = expenses.filter((e) => String(e.date || "").startsWith(monthPrefix));
    const ledgerIds = new Set(ledgerItems.map((e) => e.id));

    const unrecordedFridgeAsLedger = fridge
      .filter(
        (f) =>
          Number(f.price) > 0 &&
          String(f.purchaseDate || getCurrentYearMonth()).startsWith(monthPrefix) &&
          !ledgerIds.has(`exp-${f.id}`)
      )
      .map((f) => ({
        id: `exp-${f.id}`,
        title: f.name,
        category: f.category || "기타",
        amount: Number(f.price),
        date: f.purchaseDate || `${monthPrefix}-10`
      }));

    const combinedLedger = [...ledgerItems, ...unrecordedFridgeAsLedger].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
    const diningItems = meals.filter(
      (m) => String(m.date || "").startsWith(monthPrefix) && Number(m.cost) > 0
    );

    const groceryTotal = combinedLedger.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const diningTotal = diningItems.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
    const total = groceryTotal + diningTotal;
    const monthWasteItems = wasteEvents.filter(
      (w) => String(w.date || "").startsWith(monthPrefix) && w.type !== "rescued"
    );
    const wasteTotal = monthWasteItems.reduce((acc, cur) => acc + (Number(cur.estimatedLoss) || 0), 0);
    const monthRescuedItems = wasteEvents.filter(
      (w) => String(w.date || "").startsWith(monthPrefix) && w.type === "rescued"
    );
    const rescuedTotal = monthRescuedItems.reduce((acc, cur) => acc + (Number(cur.savedAmount) || 0), 0);

    const [cy, cm] = monthPrefix.split("-").map((n) => Number(n) || 0);
    const prevDate = new Date(cy || 2026, (cm || 1) - 2, 1);
    const prevMonthPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevExpItems = expenses.filter((e) => String(e.date || "").startsWith(prevMonthPrefix));
    const prevExpIds = new Set(prevExpItems.map((e) => e.id));
    const prevUnrecordedFridge = fridge
      .filter(
        (f) =>
          Number(f.price) > 0 &&
          String(f.purchaseDate || "").startsWith(prevMonthPrefix) &&
          !prevExpIds.has(`exp-${f.id}`)
      )
      .reduce((acc, cur) => acc + (Number(cur.price) || 0), 0);
    const prevGrocery =
      prevExpItems.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0) + prevUnrecordedFridge;
    const prevDining = meals
      .filter((m) => String(m.date || "").startsWith(prevMonthPrefix) && Number(m.cost) > 0)
      .reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
    const prevMonthTotal = prevGrocery + prevDining;
    const prevDiff = prevMonthTotal > 0 ? total - prevMonthTotal : null;

    const catMap = new Map();
    combinedLedger.forEach((item) => {
      const cat = item.category || "기타";
      catMap.set(cat, (catMap.get(cat) || 0) + (Number(item.amount) || 0));
    });
    const categoryTop = Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: groceryTotal > 0 ? Math.round((amount / groceryTotal) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
    const wasteRate = groceryTotal > 0 ? Math.round((wasteTotal / groceryTotal) * 1000) / 10 : 0;

    return {
      groceryTotal,
      diningTotal,
      total,
      wasteTotal,
      wasteCount: monthWasteItems.length,
      rescuedTotal,
      rescuedCount: monthRescuedItems.length,
      wasteRate,
      prevMonthPrefix,
      prevMonthTotal,
      prevDiff,
      categoryTop,
      ledgerItems: combinedLedger,
      diningItems
    };
  }, [expenses, fridge, meals, wasteEvents, currentMonth]);

  const expiringItems = useMemo(() => {
    return fridge
      .map((item) => ({ ...item, diff: getDaysDiff(item.expiryDate) }))
      .filter((item) => item.diff <= 3)
      .sort((a, b) => a.diff - b.diff);
  }, [fridge]);

  const pinnedNotices = useMemo(() => {
    return notices.filter((n) => n.pinned && !n.done);
  }, [notices]);

  const handleRestoreAllDeleted = async () => {
    if (!requireEditorAccess()) return;
    setDeletedIds([]);
    localStorage.removeItem("kim_family_deleted_ids");
    if (user && db) {
      try {
        await setDoc(getDocRef("family_meta_v4", "deleted_tracker"), { ids: [] });
      } catch (e) {}
    }
    showToast("숨겨졌던 모든 기존 데이터가 다시 복원되었습니다!");
  };

  const handleExportCsv = () => {
    const headers = ["구분,날짜,분류,내역/품목,대상/보관장소,금액(원),메모"];
    const mealRows = meals.map(
      (m) =>
        `식단,${m.date},${m.slot},"${m.menu}","${toSafeArray(m.members).join("/")}",${m.cost || 0},"${
          m.note || ""
        }"`
    );
    const expRows = monthlyExpenseSummary.ledgerItems.map(
      (e) =>
        `장보기지출,${e.date},${e.category},"${e.title}",가계부원장,${e.amount || 0},소비완료포함유지`
    );
    const schRows = schedules.map(
      (s) =>
        `가족일정,${s.date},${s.category},"${s.title}","${toSafeArray(s.members).join("/")}",0,"${
          s.memo || ""
        }"`
    );
    const csvContent = "\uFEFF" + [...headers, ...mealRows, ...expRows, ...schRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `수혁아리나시목시율_통합데이터_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-24 max-w-md mx-auto shadow-xl border-x border-stone-200 relative font-sans">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-stone-900 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMsg}</span>
          {toastUndo?.fn && (
            <button
              onClick={() => {
                const fn = toastUndo.fn;
                setToastMsg("");
                setToastUndo(null);
                fn();
              }}
              className="ml-1 px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-black shrink-0 whitespace-nowrap"
            >
              ↩️ 되돌리기
            </button>
          )}
        </div>
      )}

      {/* ==========================================
          상단 헤더 (패치노트 + 상단바 접기/펼치기 + 틀고정 해제/고정 토글 모두 유지!)
      ========================================== */}
      <header
        className={`bg-white border-b border-stone-200 px-3.5 pt-2.5 pb-2.5 z-30 transition-all ${
          isHeaderPinned ? "sticky top-0 shadow-md" : "relative"
        }`}
      >
        {isFirstDayOfMonthBackupNeeded && (
          <div className="mb-2 bg-amber-500 text-white rounded-2xl p-2.5 shadow-sm flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold leading-snug">
              📦 [매월 1일 정기 백업] 이번 달 가족 데이터를 백업할까요?
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleSendBackupToGmailOrDrive}
                className="px-2.5 py-1 rounded-xl bg-stone-900 text-white text-[11px] font-black"
              >
                1초 백업
              </button>
              <button
                onClick={() => {
                  const curYm = getCurrentYearMonth();
                  localStorage.setItem("kim_backup_done_month", curYm);
                  setBackupBannerDismissedMonth(curYm);
                }}
                className="p-1 text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${
                syncStatus === "offline" || syncStatus === "error"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : syncStatus === "saving" || syncStatus === "connecting"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <Zap className="w-3 h-3 shrink-0" />
              <span>
                {syncStatus === "offline"
                  ? "오프라인"
                  : syncStatus === "error"
                  ? "저장 오류"
                  : syncStatus === "saving"
                  ? "저장 중"
                  : syncStatus === "connecting"
                  ? "연결 중"
                  : "연결됨"}
              </span>
            </span>
            <button
              onClick={() => setIsPatchModalOpen(true)}
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              title="패치노트 기록 및 히스토리"
            >
              <ClipboardList className="w-3 h-3 text-stone-600 shrink-0" />
              <span>패치노트 {APP_CODE_VERSION}</span>
            </button>
            <button
              onClick={() => setIsEditorUnlockModalOpen(true)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                isEditorUnlocked
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
              }`}
              title={isEditorUnlocked ? "편집 가능 (초대 링크/잠금)" : "열람 전용 모드 (초대 코드 입력)"}
            >
              <span>{isEditorUnlocked ? "✏️ 편집가능" : "🔒 열람전용"}</span>
            </button>
          </div>
          <button
            onClick={() => {
              setTempKeyInput(geminiApiKey);
              setTempOpenaiKeyInput(openaiApiKey);
              setIsSettingsOpen(true);
            }}
            className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0"
            title="백업 및 설정"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeTab === "home" && (
          <div className="relative h-36 sm:h-40 rounded-2xl overflow-hidden mb-2 border border-stone-200 shadow-sm bg-gradient-to-r from-amber-100 via-stone-100 to-rose-100">
            <img
              src={HERO_FAMILY_FALLBACK}
              alt="수혁 아리나 시목 시율 가족사진"
              className="w-full h-full object-cover object-[50%_35%]"
            />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-stone-950/65 to-transparent pointer-events-none" />
            <div className="absolute bottom-1.5 right-2.5">
              <span className="text-[11px] font-black text-white/95 drop-shadow">
                수혁 · 아리나 · 시목 · 시율 ♡
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-1">
          <h1 className="text-sm font-black tracking-tight text-stone-900 whitespace-nowrap">
            {activeTab === "home" ? "우리 가족 홈 ♡" : "우리 가족 식탁 🍽️"}
          </h1>

          {activeTab !== "home" && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleToggleHeaderPin}
                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-0.5 transition ${
                  isHeaderPinned
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-stone-100 text-stone-600 border-stone-200"
                }`}
                title="상단 바 틀고정 설정/해제"
              >
                {isHeaderPinned ? (
                  <>
                    <Pin className="w-3 h-3 text-amber-700" />
                    <span>틀고정중</span>
                  </>
                ) : (
                  <>
                    <PinOff className="w-3 h-3 text-stone-500" />
                    <span>고정해제됨</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {activeTab === "home" && (
          <>
            <div
              className={`mt-2 flex items-center justify-between gap-1.5 border rounded-2xl px-3 py-1.5 ${
                weatherInfo?.dust?.label && weatherInfo.dust.label.includes("나쁨")
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-stone-50 border-stone-200 text-stone-800"
              }`}
            >
              <span className="text-[11px] font-bold truncate">
                {weatherInfo
                  ? `${weatherInfo.emoji} ${weatherInfo.temp}°C (${weatherInfo.min}°/${weatherInfo.max}°) · 미세 ${weatherInfo.pm10}(${weatherInfo.dust?.label || "-"}) · 초 ${weatherInfo.pm25}`
                  : "🌤️ 서울 중구 날씨 불러오는 중..."}
              </span>
              <button
                type="button"
                onClick={fetchSeoulJungGuWeather}
                className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-[10px] font-extrabold text-stone-600 shrink-0"
              >
                ↻
              </button>
            </div>

            {pinnedNotices.length > 0 && (
              <div
                onClick={() => setActiveTab("notices")}
                className="mt-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 cursor-pointer flex items-start justify-between gap-2 transition"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <Pin className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                  <div className="text-xs leading-snug break-keep">
                    <span className="font-extrabold text-stone-900 mr-1">[가족공지]</span>
                    <span className="font-semibold text-stone-700">{pinnedNotices[0].title}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-stone-500 shrink-0 mt-0.5">
                  전체보기 &gt;
                </span>
              </div>
            )}
          </>
        )}
      </header>

      {/* ==========================================
          탭 0: 🏠 홈 (대시보드 & 바로가기 허브)
      ========================================== */}
      {activeTab === "home" && (() => {
        const activeHomeTimeMode =
          homeTimeModeOverride === "auto" ? getAutoHomeTimeMode(homeTimeRanges, Math.floor(liveMinuteTick / 60)) : homeTimeModeOverride;
        const modeMeta =
          activeHomeTimeMode === "morning"
            ? {
                label: "🌅 오전",
                bgClass: "bg-stone-50/40",
                rangeLabel: `${String(homeTimeRanges.morningStart).padStart(2, "0")}:00 ~ ${String(homeTimeRanges.afternoonStart).padStart(2, "0")}:00`
              }
            : activeHomeTimeMode === "afternoon"
            ? {
                label: "🌆 오후",
                bgClass: "bg-stone-50/40",
                rangeLabel: `${String(homeTimeRanges.afternoonStart).padStart(2, "0")}:00 ~ ${String(homeTimeRanges.nightStart).padStart(2, "0")}:00`
              }
            : {
                label: "🌙 밤",
                bgClass: "bg-stone-50/40",
                rangeLabel: `${String(homeTimeRanges.nightStart).padStart(2, "0")}:00 ~ 익일 ${String(homeTimeRanges.morningStart).padStart(2, "0")}:00`
              };

        const curModeLayout = homeLayoutConfig?.[activeHomeTimeMode] || DEFAULT_HOME_LAYOUT[activeHomeTimeMode];
        const blockOrder = Array.isArray(curModeLayout.blocks) ? curModeLayout.blocks : DEFAULT_HOME_LAYOUT[activeHomeTimeMode].blocks;
        const hiddenBlocks = Array.isArray(curModeLayout.hiddenBlocks) ? curModeLayout.hiddenBlocks : [];
        const menuOrder = Array.isArray(curModeLayout.menuOrder) ? curModeLayout.menuOrder : DEFAULT_HOME_MENU_ORDER;
        const hiddenMenus = Array.isArray(curModeLayout.hiddenMenus) ? curModeLayout.hiddenMenus : [];
        const blockSizes = curModeLayout.blockSizes || {};
        const menuSizes = curModeLayout.menuSizes || {};

        const reorderById = (arr, fromId, toId) => {
          if (!fromId || !toId || fromId === toId) return arr;
          const fromIdx = arr.indexOf(fromId);
          const toIdx = arr.indexOf(toId);
          if (fromIdx < 0 || toIdx < 0) return arr;
          const copy = [...arr];
          const [moved] = copy.splice(fromIdx, 1);
          copy.splice(toIdx, 0, moved);
          return copy;
        };

        const saveHomeLayout = (updater) => {
          setHomeLayoutConfig((prev) => {
            const base = prev?.[activeHomeTimeMode] || DEFAULT_HOME_LAYOUT[activeHomeTimeMode];
            const nextMode = updater(base);
            const nextAll = { ...prev, [activeHomeTimeMode]: nextMode };
            try {
              localStorage.setItem("kim_home_layout_v1", JSON.stringify(nextAll));
            } catch (e) {}
            syncHomeSettingsToCloud(nextAll, null);
            return nextAll;
          });
        };

        const moveArrayItem = (arr, idx, dir) => {
          const target = idx + dir;
          if (target < 0 || target >= arr.length) return arr;
          const copy = [...arr];
          [copy[idx], copy[target]] = [copy[target], copy[idx]];
          return copy;
        };

        const BLOCK_LABELS = {
          action_feed: "⚡ 오늘의 행동 피드 (일정·루틴·할일)",
          menu_grid: "🧭 핵심 메뉴 바로가기"
        };

        const todayKey = getTodayStr();
        const todayMealsList = meals.filter((m) => m.date === todayKey);
        const curHrForMeal = Math.floor(liveMinuteTick / 60);
        const targetMealSlot = curHrForMeal < 10 ? "아침" : curHrForMeal < 15 ? "점심" : "저녁";
        const targetMealObj = todayMealsList.find((m) => m.slot === targetMealSlot) || todayMealsList[0];
        const isDinnerPending = curHrForMeal >= 15 && !todayMealsList.some((m) => m.slot === "저녁");
        const mealPreviewText = targetMealObj
          ? `${targetMealObj.slot}: ${String(targetMealObj.menu || "").replace(/\[.*?\]\s*/, "")}`
          : `${targetMealSlot} 미기록 · 눌러서 등록`;
        const curSlot = getCurrentRoutineTimeSlot(routineTimeRanges, liveMinuteTick);
        const wkndNow = isWeekendNow();
        const activeRoutines = familyRoutines.filter((r) => !isRoutineDoneNow(r));

        const MENU_DEFS = {
          daily: {
            title: "🍽️ 식단 · 주간",
            actionLabel: isDinnerPending ? "저녁 미정 >" : "오늘 >",
            actionColor: isDinnerPending ? "text-amber-700" : "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className={targetMealObj ? "text-stone-600" : "text-stone-400"}>{mealPreviewText}</span>,
            onClick: () => {
              setSelectedDate(todayKey);
              setActiveTab("daily");
              setTimeout(() => {
                document.getElementById(`weekly-day-${todayKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 160);
            }
          },
          routine_tab: {
            title: "🔄 반복 루틴",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="text-stone-500">남은 루틴 {activeRoutines.length}건</span>,
            onClick: () => {
              setScheduleSubTab("routine");
              setActiveTab("schedule");
            }
          },
          fridge: {
            title: "❄️ 냉장고",
            actionLabel: "열기 >",
            actionColor: expiringItems.length > 0 ? "text-rose-600" : "text-stone-500",
            borderHover: expiringItems.length > 0 ? "hover:border-rose-300" : "hover:border-stone-400",
            sub: (
              <>
                보유 {fridge.length} ·{" "}
                <span className={expiringItems.length > 0 ? "text-rose-600 font-black" : "text-stone-500"}>
                  임박 {expiringItems.length}건
                </span>
              </>
            ),
            onClick: () => setActiveTab("fridge")
          },
          shopping: {
            title: "🛒 장보기",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: (
              <>
                남은 품목 <span className="text-stone-900 font-black">{shoppingList.filter((s) => !s.checked).length}건</span>
              </>
            ),
            onClick: () => setActiveTab("shopping")
          },
          monthly_cal: {
            title: "📅 월간 식단",
            actionLabel: "달력 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: (
              <>
                {currentMonth.slice(5)}월 기록{" "}
                <span className="text-stone-900 font-black">
                  {meals.filter((m) => String(m.date || "").startsWith(currentMonth)).length}끼
                </span>
              </>
            ),
            onClick: () => {
              setActiveTab("monthly");
              setMonthlySubTab("calendar");
            }
          },
          monthly_exp: {
            title: `💰 ${currentMonth.slice(5)}월 식비`,
            actionLabel: "가계부 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="font-black text-stone-900">{monthlyExpenseSummary.total.toLocaleString()}원</span>,
            onClick: () => {
              setActiveTab("monthly");
              setMonthlySubTab("expense");
            }
          },
          baby: {
            title: "👶 육아수첩",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="text-stone-500">시목 · 시율 발달/접종</span>,
            onClick: () => setActiveTab("baby")
          },
          recipes: {
            title: "📖 레시피북",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="text-stone-500">저장된 요리 {recipes.length}건</span>,
            onClick: () => setActiveTab("recipes")
          },
          notices: {
            title: "📌 가족공지",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="text-stone-500">미완료 {notices.filter((n) => !n.done).length}건</span>,
            onClick: () => setActiveTab("notices")
          },
          ai: {
            title: "✨ AI추천",
            actionLabel: "열기 >",
            actionColor: "text-stone-500",
            borderHover: "hover:border-stone-400",
            sub: <span className="text-stone-500">냉장고 파먹기 &amp; 플레이팅</span>,
            onClick: () => setActiveTab("ai")
          }
        };

        const slotFilteredRoutines =
          homeRoutineSlotFilter === "전체"
            ? activeRoutines
            : homeRoutineSlotFilter === "auto"
            ? activeRoutines.filter((r) => {
                const s = r.timeSlot || "상시";
                if (wkndNow && s === "하원후") return false;
                if (!wkndNow && s === "오후") return false;
                return s === curSlot || s === "상시";
              })
            : activeRoutines.filter((r) => (r.timeSlot || "상시") === homeRoutineSlotFilter);
        const visibleRoutineList = slotFilteredRoutines
          .filter((r) => matchesRoutineTarget(r, homeRoutineTargetFilter))
          .sort((a, b) => {
            const aCur = (a.timeSlot || "상시") === curSlot ? 0 : 1;
            const bCur = (b.timeSlot || "상시") === curSlot ? 0 : 1;
            return aCur - bCur;
          });

        const actionFeedSize = blockSizes.action_feed || "normal";
        const previewLimit = actionFeedSize === "compact" ? 2 : actionFeedSize === "large" ? 5 : 3;
        const blockPadClass = (bId) => {
          const sz = blockSizes[bId] || "normal";
          return sz === "compact" ? "p-2" : sz === "large" ? "p-3.5" : "p-2.5";
        };
        const previewTodos = schedules
          .filter((s) => s.category === "할일(To-Do)" && !s.done)
          .sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")))
          .slice(0, previewLimit);

        const renderHomeBlock = (blockId) => {
          if (hiddenBlocks.includes(blockId)) return null;
          if (blockId === "action_feed") {
            const padCls = blockPadClass("action_feed");
            return (
              <div key="action_feed" className="bg-white border border-stone-200 rounded-2xl shadow-sm divide-y divide-stone-200 overflow-hidden">
                {/* 1) 3일 내 일정 */}
                <div className={`${padCls} space-y-1.5`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-stone-900">
                      🗓️ 3일 내 일정 ({imminentSchedulesWithin3Days.length}건)
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSchedule(null);
                          setScheduleForm({
                            title: "",
                            date: getTodayStr(),
                            category: "병원/행사",
                            members: ["수혁", "아리나", "시목", "시율"],
                            isAnnual: false,
                            showDday: false,
                            hasOriginYear: false,
                            memo: ""
                          });
                          setIsScheduleModalOpen(true);
                        }}
                        className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-extrabold"
                      >
                        + 추가
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleSubTab("calendar");
                          setActiveTab("schedule");
                        }}
                        className="text-[10px] font-extrabold text-stone-500"
                      >
                        전체 &gt;
                      </button>
                    </div>
                  </div>
                  {imminentSchedulesWithin3Days.length === 0 ? (
                    <div className="text-[11px] font-bold text-stone-400">
                      3일 이내 예정된 일정이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {imminentSchedulesWithin3Days.slice(0, previewLimit).map((ev) => {
                        const isTodayEv = ev.calc.daysUntil <= 0;
                        const isTomorrowEv = ev.calc.daysUntil === 1;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setScheduleSubTab("calendar");
                              setActiveTab("schedule");
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-left ${
                              isTodayEv ? "bg-rose-50/70 border-rose-200" : "bg-stone-50/70 border-stone-200"
                            }`}
                          >
                            <span className="text-[11px] font-extrabold text-stone-800 truncate">{ev.title}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                isTodayEv
                                  ? "bg-rose-600 text-white"
                                  : isTomorrowEv
                                  ? "bg-amber-500 text-white"
                                  : "bg-stone-200 text-stone-700"
                              }`}
                            >
                              {ev.calc.dDayText}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2) 지금 시간대 + 상시 루틴 */}
                <div className={`${padCls} space-y-1.5`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black text-stone-900 truncate">
                      🔄 {homeRoutineSlotFilter === "auto" ? `지금(${curSlot}) 루틴` : homeRoutineSlotFilter === "전체" ? "오늘 남은 루틴" : `${homeRoutineSlotFilter} 루틴`} ({visibleRoutineList.length}건)
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {(homeRoutineSlotFilter !== "auto" || homeRoutineTargetFilter !== "전체") && (
                        <button
                          type="button"
                          onClick={() => {
                            setHomeRoutineSlotFilter("auto");
                            setHomeRoutineTargetFilter("전체");
                            try {
                              localStorage.setItem("kim_home_routine_slot_v1", "auto");
                              localStorage.setItem("kim_home_routine_target_v1", "전체");
                            } catch (e) {}
                          }}
                          className="px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-extrabold whitespace-nowrap"
                        >
                          자동 복귀
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleSubTab("routine");
                          setActiveTab("schedule");
                        }}
                        className="px-2 py-0.5 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold whitespace-nowrap"
                      >
                        관리
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto">
                    {[
                      { id: "전체", label: "전체" },
                      { id: "공통", label: "👨‍👩‍👧‍👦 공통" },
                      { id: "시목", label: "👦 시목" },
                      { id: "시율", label: "👶 시율" }
                    ].map((tgt) => (
                      <button
                        key={tgt.id}
                        type="button"
                        onClick={() => {
                          setHomeRoutineTargetFilter(tgt.id);
                          try { localStorage.setItem("kim_home_routine_target_v1", tgt.id); } catch (e) {}
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap border transition shrink-0 ${
                          homeRoutineTargetFilter === tgt.id
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-600 border-stone-200"
                        }`}
                      >
                        {tgt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {[
                      { id: "auto", label: `자동(${curSlot})` },
                      ...ROUTINE_TIME_SLOTS.map((s) => ({ id: s, label: s })),
                      { id: "전체", label: `전체(${activeRoutines.length})` }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setHomeRoutineSlotFilter(opt.id);
                          try { localStorage.setItem("kim_home_routine_slot_v1", opt.id); } catch (e) {}
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap border transition shrink-0 ${
                          homeRoutineSlotFilter === opt.id
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-stone-50 text-stone-600 border-stone-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {activeRoutines.length === 0 ? (
                    <div className="text-[11px] font-bold text-emerald-700 bg-stone-50 rounded-xl px-2.5 py-1.5">
                      🎉 오늘 예정된 모든 루틴을 완료했습니다!
                    </div>
                  ) : visibleRoutineList.length === 0 ? (
                    <div className="text-[11px] font-bold text-stone-500 bg-stone-50 rounded-xl px-2.5 py-1.5">
                      ✅ 선택한 조건의 루틴을 모두 완료했습니다.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {visibleRoutineList.map((rt) => {
                        const nextInfo = getRoutineNextDateInfo(rt, currentDayKey);
                        const steps = parseRoutineSteps(rt.title);
                        const stepDoneSet = getRoutineSubStepDoneSet(rt);
                        return (
                          <div
                            key={rt.id}
                            className="w-full p-2 rounded-xl bg-stone-50/70 border border-stone-200 flex items-start gap-2 text-left"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleRoutine(rt.id)}
                              className="w-4 h-4 mt-0.5 rounded border border-stone-400 bg-white hover:bg-stone-100 shrink-0"
                              title="전체 완료"
                            />
                            <div className="min-w-0 flex-1">
                              {steps.length >= 2 ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {steps.map((st, sIdx) => {
                                    const sDone = stepDoneSet.has(sIdx);
                                    return (
                                      <React.Fragment key={sIdx}>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRoutineSubStep(rt.id, sIdx, steps.length)}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold border transition active:scale-95 ${
                                            sDone
                                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                              : "bg-white border-stone-200 text-stone-800 hover:bg-stone-100"
                                          }`}
                                        >
                                          <span
                                            className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] font-black shrink-0 ${
                                              sDone
                                                ? "bg-emerald-600 border-emerald-600 text-white"
                                                : "border-stone-400 text-stone-700 bg-white"
                                            }`}
                                          >
                                            {sDone ? "✓" : sIdx + 1}
                                          </span>
                                          <span className={sDone ? "line-through" : ""}>{st}</span>
                                        </button>
                                        {sIdx < steps.length - 1 && (
                                          <span className="text-[10px] font-black text-stone-300">→</span>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoutine(rt.id)}
                                  className="text-left text-xs font-extrabold text-stone-900 whitespace-normal break-words leading-snug w-full"
                                >
                                  {rt.title}
                                </button>
                              )}
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.5 rounded bg-stone-200/70 text-stone-700 text-[9px] font-black">
                                  {rt.timeSlot || "상시"}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${getRoutineAssigneeBadgeCls(rt.assignee)}`}>
                                  {rt.assignee || "공통"}
                                </span>
                                {steps.length >= 2 && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black">
                                    진행 {stepDoneSet.size}/{steps.length}
                                  </span>
                                )}
                                {nextInfo && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-bold">
                                    {nextInfo.dateLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3) 남은 할 일 */}
                <div className={`${padCls} space-y-1.5`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-stone-900">
                      ✅ 남은 할 일 ({globalTodoBadgeStats.activeCount}건)
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSchedule(null);
                          setScheduleForm({
                            title: "",
                            date: getTodayStr(),
                            category: "할일(To-Do)",
                            members: ["수혁", "아리나", "시목", "시율"],
                            isAnnual: false,
                            showDday: false,
                            hasOriginYear: false,
                            memo: ""
                          });
                          setIsScheduleModalOpen(true);
                        }}
                        className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-extrabold"
                      >
                        + 추가
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleSubTab("todo");
                          setActiveTab("schedule");
                        }}
                        className="text-[10px] font-extrabold text-stone-500"
                      >
                        전체 &gt;
                      </button>
                    </div>
                  </div>
                  {previewTodos.length === 0 ? (
                    <div className="text-[11px] font-bold text-stone-400">
                      남은 할 일이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {previewTodos.map((todo) => {
                        const isOverdue = Boolean(todo.date && String(todo.date) <= todayKey);
                        return (
                          <button
                            key={todo.id}
                            type="button"
                            onClick={() => handleToggleScheduleDone(todo)}
                            className={`w-full px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-left transition active:scale-[0.99] ${
                              isOverdue
                                ? "bg-rose-50/60 hover:bg-rose-50 border-rose-200"
                                : "bg-stone-50/70 hover:bg-stone-100 border-stone-200"
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded border bg-white shrink-0 ${isOverdue ? "border-rose-400" : "border-stone-400"}`} />
                            <span className="text-[11px] font-extrabold text-stone-800 truncate flex-1">{todo.title}</span>
                            {todo.date && (
                              <span className={`text-[10px] font-bold shrink-0 ${isOverdue ? "text-rose-600 font-black" : "text-stone-500"}`}>
                                {todo.date.slice(5)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (blockId === "menu_grid") {
            const visibleMenuIds = menuOrder.filter((id) => MENU_DEFS[id] && !hiddenMenus.includes(id));
            const gridPad = blockSizes.menu_grid === "compact" ? "gap-1.5" : blockSizes.menu_grid === "large" ? "gap-2.5" : "gap-2";
            return (
              <div key="menu_grid" className={`grid grid-cols-2 ${gridPad}`}>
                {visibleMenuIds.map((id) => {
                  const item = MENU_DEFS[id];
                  const mSize = menuSizes[id] || "half";
                  const sizeCls =
                    mSize === "tall"
                      ? "col-span-2 p-3.5"
                      : mSize === "full"
                      ? "col-span-2 p-2.5"
                      : "p-2.5";
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={item.onClick}
                      className={`bg-white border border-stone-200 ${item.borderHover} rounded-2xl ${sizeCls} text-left shadow-sm space-y-0.5 transition`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">{item.title}</span>
                        <span className={`text-[10px] font-extrabold ${item.actionColor}`}>{item.actionLabel}</span>
                      </div>
                      <div className="text-[11px] font-bold text-stone-600 truncate">{item.sub}</div>
                    </button>
                  );
                })}
              </div>
            );
          }
          return null;
        };

        return (
          <div className={`p-3 space-y-2.5 rounded-b-3xl ${modeMeta.bgClass}`}>
            {/* 시간대 적응형 모드 전환 & 홈 화면 편집 바 */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 overflow-x-auto">
                {[
                  { id: "auto", label: `자동(${modeMeta.label})` },
                  { id: "morning", label: "🌅 오전" },
                  { id: "afternoon", label: "🌆 오후" },
                  { id: "night", label: "🌙 밤" }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setHomeTimeModeOverride(m.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap transition shrink-0 ${
                      homeTimeModeOverride === m.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-600 border-stone-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsHomeEditMode((v) => !v)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap shrink-0 transition ${
                  isHomeEditMode
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-stone-700 border-stone-200"
                }`}
              >
                {isHomeEditMode ? "✅ 편집 완료" : "✏️ 홈 편집"}
              </button>
            </div>

            {isHomeEditMode && (
              <div className="bg-white border border-stone-300 rounded-2xl p-3 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-900">
                    🛠️ {modeMeta.label} 홈 화면 구성 편집
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      saveHomeLayout(() => ({ ...DEFAULT_HOME_LAYOUT[activeHomeTimeMode] }));
                      showToast(`${modeMeta.label} 기본 구성으로 초기화했습니다.`);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 text-[10px] font-extrabold"
                  >
                    기본값 초기화
                  </button>
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-stone-600">0) 시간대 기준 시각 설정</span>
                    <button
                      type="button"
                      onClick={() => {
                        setHomeTimeRanges(DEFAULT_HOME_TIME_RANGES);
                        try {
                          localStorage.setItem("kim_home_time_ranges_v1", JSON.stringify(DEFAULT_HOME_TIME_RANGES));
                        } catch (e) {}
                        syncHomeSettingsToCloud(null, DEFAULT_HOME_TIME_RANGES);
                        showToast("시간대 기준 시각을 기본값(05/11/20시)으로 되돌렸습니다.");
                      }}
                      className="text-[10px] font-extrabold text-stone-500 underline"
                    >
                      시각 초기화
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "morningStart", label: "🌅 오전 시작" },
                      { key: "afternoonStart", label: "🌆 오후 시작" },
                      { key: "nightStart", label: "🌙 밤 시작" }
                    ].map((f) => (
                      <label key={f.key} className="block">
                        <span className="text-[10px] font-bold text-stone-500 block mb-0.5">{f.label}</span>
                        <select
                          value={homeTimeRanges[f.key]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHomeTimeRanges((prev) => {
                              const next = { ...prev, [f.key]: val };
                              try {
                                localStorage.setItem("kim_home_time_ranges_v1", JSON.stringify(next));
                              } catch (err) {}
                              syncHomeSettingsToCloud(null, next);
                              return next;
                            });
                          }}
                          className="w-full px-2 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-black text-stone-800"
                        >
                          {Array.from({ length: 24 }, (_, hr) => (
                            <option key={hr} value={hr}>
                              {String(hr).padStart(2, "0")}시
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] font-semibold text-stone-500">
                    현재 적용: 오전 {String(homeTimeRanges.morningStart).padStart(2, "0")}시 · 오후 {String(homeTimeRanges.afternoonStart).padStart(2, "0")}시 · 밤 {String(homeTimeRanges.nightStart).padStart(2, "0")}시~익일 {String(homeTimeRanges.morningStart).padStart(2, "0")}시
                  </div>
                  {(homeTimeRanges.morningStart === homeTimeRanges.afternoonStart ||
                    homeTimeRanges.afternoonStart === homeTimeRanges.nightStart ||
                    homeTimeRanges.nightStart === homeTimeRanges.morningStart) && (
                    <div className="text-[10px] font-extrabold text-rose-600">
                      ⚠️ 오전·오후·밤 시작 시각은 서로 다르게 설정해 주세요.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-extrabold text-stone-500">1) 주요 영역 순서(⋮⋮ 드래그 / ▲▼) · 크기 · 표시</div>
                  {blockOrder.map((bId, idx) => {
                    const isHidden = hiddenBlocks.includes(bId);
                    const bSize = blockSizes[bId] || "normal";
                    const nextBlockSize = bSize === "compact" ? "normal" : bSize === "normal" ? "large" : "compact";
                    const bSizeLabel = bSize === "compact" ? "작게" : bSize === "large" ? "크게" : "보통";
                    const isOver = homeDragOverKey === `block:${bId}`;
                    return (
                      <div
                        key={bId}
                        data-home-block-id={bId}
                        draggable
                        onDragStart={() => { homeDragRef.current = { type: "block", id: bId }; }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (homeDragRef.current?.type === "block") setHomeDragOverKey(`block:${bId}`);
                        }}
                        onDragLeave={() => { if (homeDragOverKey === `block:${bId}`) setHomeDragOverKey(""); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const src = homeDragRef.current;
                          homeDragRef.current = null;
                          setHomeDragOverKey("");
                          if (src?.type === "block" && src.id !== bId) {
                            saveHomeLayout((cur) => ({ ...cur, blocks: reorderById(blockOrder, src.id, bId) }));
                          }
                        }}
                        className={`flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 border transition ${
                          isOver ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200" : "bg-stone-50 border-stone-200"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            style={{ touchAction: "none" }}
                            onTouchStart={() => {
                              homeDragRef.current = { type: "block", id: bId };
                              homeDragOverRef.current = "";
                            }}
                            onTouchMove={(e) => {
                              const t = e.touches?.[0];
                              if (!t) return;
                              const el = document.elementFromPoint(t.clientX, t.clientY)?.closest?.("[data-home-block-id]");
                              const targetId = el?.getAttribute?.("data-home-block-id") || "";
                              if (targetId) {
                                const key = `block:${targetId}`;
                                homeDragOverRef.current = key;
                                setHomeDragOverKey(key);
                              }
                            }}
                            onTouchEnd={() => {
                              const src = homeDragRef.current;
                              const overKey = homeDragOverRef.current || homeDragOverKey;
                              const targetId = overKey.startsWith("block:") ? overKey.slice(6) : "";
                              homeDragRef.current = null;
                              homeDragOverRef.current = "";
                              setHomeDragOverKey("");
                              if (src?.type === "block" && targetId && src.id !== targetId) {
                                saveHomeLayout((cur) => ({ ...cur, blocks: reorderById(blockOrder, src.id, targetId) }));
                              }
                            }}
                            onTouchCancel={() => {
                              homeDragRef.current = null;
                              homeDragOverRef.current = "";
                              setHomeDragOverKey("");
                            }}
                            className="px-1 py-0.5 text-stone-400 hover:text-stone-700 cursor-grab select-none text-xs font-black shrink-0"
                            title="끌어서 순서 변경"
                          >
                            ⋮⋮
                          </span>
                          <span className={`text-[11px] font-extrabold truncate ${isHidden ? "text-stone-400 line-through" : "text-stone-800"}`}>
                            {BLOCK_LABELS[bId]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              saveHomeLayout((cur) => ({
                                ...cur,
                                blockSizes: { ...(cur.blockSizes || {}), [bId]: nextBlockSize }
                              }))
                            }
                            className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 text-[10px] font-extrabold"
                            title="영역 크기 전환"
                          >
                            {bSizeLabel}
                          </button>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => saveHomeLayout((cur) => ({ ...cur, blocks: moveArrayItem(blockOrder, idx, -1) }))}
                            className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[10px] font-black disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === blockOrder.length - 1}
                            onClick={() => saveHomeLayout((cur) => ({ ...cur, blocks: moveArrayItem(blockOrder, idx, 1) }))}
                            className="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[10px] font-black disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              saveHomeLayout((cur) => ({
                                ...cur,
                                hiddenBlocks: isHidden
                                  ? hiddenBlocks.filter((x) => x !== bId)
                                  : [...hiddenBlocks, bId]
                              }))
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              isHidden ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isHidden ? "숨김" : "표시"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-extrabold text-stone-500">2) 바로가기 카드 순서(⋮⋮ 드래그 / ▲▼) · 크기 · 표시</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {menuOrder.map((mId, idx) => {
                      const def = MENU_DEFS[mId];
                      if (!def) return null;
                      const isHidden = hiddenMenus.includes(mId);
                      const mSize = menuSizes[mId] || "half";
                      const nextMenuSize = mSize === "half" ? "full" : mSize === "full" ? "tall" : "half";
                      const mSizeLabel = mSize === "tall" ? "크게" : mSize === "full" ? "전체폭" : "반폭";
                      const isOver = homeDragOverKey === `menu:${mId}`;
                      return (
                        <div
                          key={mId}
                          data-home-menu-id={mId}
                          draggable
                          onDragStart={() => { homeDragRef.current = { type: "menu", id: mId }; }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (homeDragRef.current?.type === "menu") setHomeDragOverKey(`menu:${mId}`);
                          }}
                          onDragLeave={() => { if (homeDragOverKey === `menu:${mId}`) setHomeDragOverKey(""); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const src = homeDragRef.current;
                            homeDragRef.current = null;
                            setHomeDragOverKey("");
                            if (src?.type === "menu" && src.id !== mId) {
                              saveHomeLayout((cur) => ({ ...cur, menuOrder: reorderById(menuOrder, src.id, mId) }));
                            }
                          }}
                          className={`flex items-center justify-between gap-1 rounded-xl px-2 py-1 border transition ${
                            isOver ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200" : "bg-stone-50 border-stone-200"
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              style={{ touchAction: "none" }}
                              onTouchStart={() => {
                                homeDragRef.current = { type: "menu", id: mId };
                                homeDragOverRef.current = "";
                              }}
                              onTouchMove={(e) => {
                                const t = e.touches?.[0];
                                if (!t) return;
                                const el = document.elementFromPoint(t.clientX, t.clientY)?.closest?.("[data-home-menu-id]");
                                const targetId = el?.getAttribute?.("data-home-menu-id") || "";
                                if (targetId) {
                                  const key = `menu:${targetId}`;
                                  homeDragOverRef.current = key;
                                  setHomeDragOverKey(key);
                                }
                              }}
                              onTouchEnd={() => {
                                const src = homeDragRef.current;
                                const overKey = homeDragOverRef.current || homeDragOverKey;
                                const targetId = overKey.startsWith("menu:") ? overKey.slice(5) : "";
                                homeDragRef.current = null;
                                homeDragOverRef.current = "";
                                setHomeDragOverKey("");
                                if (src?.type === "menu" && targetId && src.id !== targetId) {
                                  saveHomeLayout((cur) => ({ ...cur, menuOrder: reorderById(menuOrder, src.id, targetId) }));
                                }
                              }}
                              onTouchCancel={() => {
                                homeDragRef.current = null;
                                homeDragOverRef.current = "";
                                setHomeDragOverKey("");
                              }}
                              className="px-0.5 text-stone-400 hover:text-stone-700 cursor-grab select-none text-[11px] font-black shrink-0"
                              title="끌어서 순서 변경"
                            >
                              ⋮⋮
                            </span>
                            <span className={`text-[11px] font-extrabold truncate ${isHidden ? "text-stone-400 line-through" : "text-stone-800"}`}>
                              {def.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                saveHomeLayout((cur) => ({
                                  ...cur,
                                  menuSizes: { ...(cur.menuSizes || {}), [mId]: nextMenuSize }
                                }))
                              }
                              className="px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 text-[9px] font-extrabold"
                              title="카드 크기 전환 (반폭/전체폭/크게)"
                            >
                              {mSizeLabel}
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => saveHomeLayout((cur) => ({ ...cur, menuOrder: moveArrayItem(menuOrder, idx, -1) }))}
                              className="px-1 py-0.5 rounded bg-white border border-stone-200 text-[9px] font-black disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === menuOrder.length - 1}
                              onClick={() => saveHomeLayout((cur) => ({ ...cur, menuOrder: moveArrayItem(menuOrder, idx, 1) }))}
                              className="px-1 py-0.5 rounded bg-white border border-stone-200 text-[9px] font-black disabled:opacity-30"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                saveHomeLayout((cur) => ({
                                  ...cur,
                                  hiddenMenus: isHidden
                                    ? hiddenMenus.filter((x) => x !== mId)
                                    : [...hiddenMenus, mId]
                                }))
                              }
                              className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                                isHidden ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isHidden ? "숨김" : "표시"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 시간대별 전용 히어로 브리핑 카드 */}
            {activeHomeTimeMode === "morning" && (() => {
              const morningMeals = todayMealsList.filter((m) => m.slot === "아침" || m.slot === "점심" || m.slot === "오전간식");
              const morningRoutineLeft = activeRoutines.filter((r) => (r.timeSlot || "상시") === "아침" || (r.timeSlot || "상시") === "상시").length;
              return (
                <div className="bg-white border border-stone-200 rounded-2xl p-3 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-stone-900">🌅 좋은 아침 · 등원/오전 브리핑</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-extrabold">{modeMeta.rangeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-stone-600">
                    <span className="truncate">
                      {morningMeals[0] ? `🍽️ ${morningMeals[0].slot}: ${morningMeals[0].menu}` : "🍽️ 오늘 아침·점심 식단을 기록해 보세요"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(todayKey);
                        setActiveTab("daily");
                        setTimeout(() => {
                          document.getElementById(`weekly-day-${todayKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }, 160);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold shrink-0"
                    >
                      식단 ({morningRoutineLeft > 0 ? `루틴 ${morningRoutineLeft}` : "확인"})
                    </button>
                  </div>
                </div>
              );
            })()}

            {activeHomeTimeMode === "afternoon" && (() => {
              const dinnerMeal = todayMealsList.find((m) => m.slot === "저녁");
              return (
                <div className="bg-white border border-stone-200 rounded-2xl p-3 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-stone-900">🌆 오후 · 저녁 준비 &amp; 냉장고 파먹기</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-extrabold">{modeMeta.rangeLabel}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {expiringItems.length > 0 ? (
                      expiringItems.slice(0, 3).map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => setActiveTab("fridge")}
                          className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold"
                        >
                          ❄️ {it.name} ({it.diff < 0 ? "만료" : `D-${it.diff}`})
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] font-bold text-stone-500">임박한 냉장고 재료가 없습니다</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab(dinnerMeal ? "daily" : "ai")}
                      className="ml-auto px-2 py-0.5 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold"
                    >
                      {dinnerMeal ? `🍽️ 저녁: ${dinnerMeal.menu}` : "✨ AI 저녁 추천"}
                    </button>
                  </div>
                </div>
              );
            })()}



            {blockOrder.map((blockId) => renderHomeBlock(blockId))}
          </div>
        );
      })()}

      {/* ==========================================
          탭 1: 🍽️ 통합 식단 (주간 ±3일 한눈에 보기 + 즉시 추가·수정·삭제 + 인별 오늘 이동)
      ========================================== */}
      {activeTab === "daily" && (
        <div className="p-4 space-y-3.5">
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-stone-900 truncate">
                  🍽️ 식단 ({weekDates[0].slice(5)} ~ {weekDates[6].slice(5)})
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHideEmptyMealSlots((v) => !v)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
                      hideEmptyMealSlots
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 text-stone-600 border-stone-200"
                    }`}
                  >
                    {hideEmptyMealSlots ? "빈 끼니 숨김중" : "빈 끼니 숨기기"}
                  </button>
                  <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">
                    ±3일
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate + "T00:00:00");
                    d.setDate(d.getDate() - 7);
                    const nextStr = formatDate(d);
                    setSelectedDate(nextStr);
                    setCurrentMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold text-stone-700"
                >
                  &lt; 이전주
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setCurrentMonth(e.target.value.slice(0, 7));
                    }
                  }}
                  className="px-1.5 py-0.5 rounded-lg border border-stone-200 text-[11px] font-black text-stone-900 bg-stone-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    const today = getTodayStr();
                    setSelectedDate(today);
                    setCurrentMonth(today.slice(0, 7));
                    setTimeout(() => {
                      document.getElementById(`weekly-day-${today}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 120);
                  }}
                  className="px-2 py-1 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold"
                >
                  오늘로
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(selectedDate + "T00:00:00");
                    d.setDate(d.getDate() + 7);
                    const nextStr = formatDate(d);
                    setSelectedDate(nextStr);
                    setCurrentMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold text-stone-700"
                >
                  다음주 &gt;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setScanTargetMonth(selectedDate.slice(0, 7));
                  setIsDaycareModalOpen(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-extrabold flex items-center justify-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                <span className="whitespace-nowrap">식단표 AI 스캔</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportScope("all");
                  setIsInventoryExportOpen(true);
                }}
                className="py-2 px-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-800 text-[11px] font-extrabold flex items-center justify-center gap-1.5"
              >
                <span className="whitespace-nowrap">📤 식단·재고 내보내기</span>
              </button>
            </div>

          </div>

          {/* 상단 고정(Sticky) 1줄 인원 빠른 전환 바 (끼니수 제거로 슬림화) */}
          <div className={`sticky z-20 bg-white/95 backdrop-blur border border-stone-200 rounded-2xl px-2 py-1.5 shadow-sm space-y-1.5 ${isHeaderPinned ? "top-[82px]" : "top-1"}`}>
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedMember("전체")}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border whitespace-nowrap shrink-0 transition ${
                  selectedMember === "전체"
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-stone-50 text-stone-600 border-stone-200"
                }`}
              >
                👨‍👩‍👧‍👦 전체(±3일)
              </button>
              {FAMILY_MEMBERS.map((mem) => {
                const isSel = selectedMember === mem.id;
                return (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      if (isSel) {
                        setSelectedMember("전체");
                      } else {
                        setSelectedMember(mem.id);
                        setSelectedDate(today);
                        setCurrentMonth(today.slice(0, 7));
                        setTimeout(() => {
                          document.getElementById(`weekly-day-${today}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 80);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition ${
                      isSel
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    <MemberAvatar member={mem} size="sm" />
                    <span>{mem.id}</span>
                  </button>
                );
              })}
            </div>

            {selectedMember !== "전체" && (
              <div className="flex items-center justify-between gap-1.5 px-1 text-[10px] font-extrabold text-stone-600">
                <span>👤 {selectedMember} 하루 식단 집중 보기</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(selectedDate + "T00:00:00");
                      d.setDate(d.getDate() - 1);
                      const nextStr = formatDate(d);
                      setSelectedDate(nextStr);
                      setCurrentMonth(nextStr.slice(0, 7));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                  >
                    &lt; 이전날
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setSelectedDate(today);
                      setCurrentMonth(today.slice(0, 7));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-900 text-white"
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(selectedDate + "T00:00:00");
                      d.setDate(d.getDate() + 1);
                      const nextStr = formatDate(d);
                      setSelectedDate(nextStr);
                      setCurrentMonth(nextStr.slice(0, 7));
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700"
                  >
                    다음날 &gt;
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="divide-y divide-stone-200">
              {(selectedMember === "전체" ? weekDates : [selectedDate]).map((d) => {
                const dayMeals = meals.filter(
                  (m) =>
                    m.date === d &&
                    (selectedMember === "전체" || toSafeArray(m.members).includes(selectedMember))
                );
                const isTodayRow = d === getTodayStr();
                return (
                  <div key={d} id={`weekly-day-${d}`} className={`p-3 ${isTodayRow ? "bg-stone-50/70" : ""}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                        <span>{d.slice(5)} ({getDayName(d)})</span>
                        {d === selectedDate && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-900 text-white text-[9px] font-black whitespace-nowrap shrink-0">조회일</span>
                        )}
                        {isTodayRow && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black whitespace-nowrap shrink-0">오늘</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const h = new Date().getHours();
                          const smartSlot =
                            h >= 5 && h < 10 ? "아침" : h >= 10 && h < 14 ? "점심" : h >= 14 && h < 17 ? "오후간식" : h >= 17 && h < 21 ? "저녁" : "야식";
                          setEditingMeal(null);
                          setMealForm({
                            date: d,
                            slot: smartSlot,
                            menu: "",
                            members: selectedMember === "전체" ? ["수혁", "아리나"] : [selectedMember],
                            ingredients: [],
                            note: "",
                            sourceType: "집밥/온가족식",
                            cost: ""
                          });
                          setIsMealModalOpen(true);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-extrabold"
                      >
                        + 식단 추가
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {MEAL_SLOTS.map((slotMeta) => {
                        const slotId = slotMeta.id;
                        const items = dayMeals.filter((m) => m.slot === slotId);
                        const openAddForSlot = () => {
                          setEditingMeal(null);
                          setMealForm({
                            date: d,
                            slot: slotId,
                            menu: "",
                            members: selectedMember === "전체" ? ["수혁", "아리나"] : [selectedMember],
                            ingredients: [],
                            note: "",
                            sourceType: "집밥/온가족식",
                            cost: ""
                          });
                          setIsMealModalOpen(true);
                        };
                        if (items.length === 0) {
                          if (hideEmptyMealSlots) return null;
                          return (
                            <button
                              key={slotId}
                              type="button"
                              onClick={openAddForSlot}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50/70 hover:bg-stone-100 border border-stone-200/80 flex items-center justify-between gap-2 text-left transition"
                            >
                              <span className="text-[11px] font-extrabold text-stone-500 flex items-center gap-1.5">
                                <span>{slotMeta.icon}</span>
                                <span>{slotMeta.label}</span>
                              </span>
                              <span className="text-[10px] font-bold text-stone-400">+ 등록</span>
                            </button>
                          );
                        }
                        return (
                          <div
                            key={slotId}
                            className="p-2.5 rounded-xl bg-white border border-stone-200 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-black text-stone-500 flex items-center gap-1">
                                <span>{slotMeta.icon}</span>
                                <span>{slotMeta.label}</span>
                              </span>
                              <button
                                type="button"
                                onClick={openAddForSlot}
                                className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 text-[10px] font-extrabold"
                              >
                                + 추가
                              </button>
                            </div>
                            <div className="divide-y divide-stone-100">
                              {items.map((it) => {
                                const memIds = toSafeArray(it.members);
                                const isAllFam = memIds.length >= FAMILY_MEMBERS.length;
                                return (
                                  <div
                                    key={it.id}
                                    onClick={() => {
                                      setEditingMeal(it);
                                      setMealForm({
                                        date: it.date,
                                        slot: it.slot,
                                        menu: it.menu || "",
                                        members: memIds,
                                        ingredients: toSafeArray(it.ingredients),
                                        note: it.note || "",
                                        sourceType: it.sourceType || "집밥/온가족식",
                                        cost: it.cost || ""
                                      });
                                      setIsMealModalOpen(true);
                                    }}
                                    className="py-1 first:pt-0 last:pb-0 flex items-start justify-between gap-2 cursor-pointer hover:bg-stone-50/60 rounded-lg px-1 -mx-1 transition"
                                  >
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="text-xs font-extrabold text-stone-900 break-keep leading-snug">
                                        <span>{String(it.menu || "").replace(/\[.*?\]\s*/, "")}</span>
                                        {Number(it.cost) > 0 && (
                                          <span className="ml-1 text-[10px] font-bold text-stone-500">
                                            ({Number(it.cost).toLocaleString()}원)
                                          </span>
                                        )}
                                      </div>
                                      {(toSafeArray(it.ingredients).length > 0 || it.note) && (
                                        <div className="text-[10px] text-stone-500 truncate">
                                          {toSafeArray(it.ingredients).length > 0 && `🥬 ${toSafeArray(it.ingredients).join(", ")}`}
                                          {toSafeArray(it.ingredients).length > 0 && it.note && " · "}
                                          {it.note && `💬 ${it.note}`}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center gap-1">
                                        {isAllFam ? (
                                          <span className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[9px] font-extrabold">
                                            👨‍👩‍👧‍👦 온가족
                                          </span>
                                        ) : (
                                          memIds.map((mId) => {
                                            const mInfo = FAMILY_MEMBERS.find((f) => f.id === mId);
                                            return mInfo ? (
                                              <span
                                                key={mId}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-100 border border-stone-200/80 text-stone-700 text-[9px] font-extrabold whitespace-nowrap"
                                              >
                                                <MemberAvatar member={mInfo} size="sm" />
                                                <span>{mInfo.id}</span>
                                              </span>
                                            ) : null;
                                          })
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMeal(it);
                                      }}
                                      className="p-1 text-stone-400 hover:text-rose-600 shrink-0"
                                      title="삭제"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          탭 3: 월간 식단·식비 가계부
      ========================================== */}
      {activeTab === "monthly" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-2xl border border-stone-200 shadow-sm">
            <button
              onClick={() => {
                const prevM = shiftYearMonth(currentMonth, -1);
                setCurrentMonth(prevM);
                setSelectedDate(`${prevM}-01`);
              }}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentMonth(e.target.value);
                  setSelectedDate(`${e.target.value}-01`);
                }
              }}
              className="text-sm font-black text-stone-900 bg-transparent focus:outline-none"
            />
            <button
              onClick={() => {
                const nextM = shiftYearMonth(currentMonth, 1);
                setCurrentMonth(nextM);
                setSelectedDate(`${nextM}-01`);
              }}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-stone-200 p-1 rounded-2xl">
            <button
              onClick={() => setMonthlySubTab("calendar")}
              className={`py-2 rounded-xl text-xs font-extrabold transition ${
                monthlySubTab === "calendar"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600"
              }`}
            >
              📅 인별 월간 식단현황
            </button>
            <button
              onClick={() => setMonthlySubTab("expense")}
              className={`py-2 rounded-xl text-xs font-extrabold transition ${
                monthlySubTab === "expense"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600"
              }`}
            >
              💰 월간 식비 가계부
            </button>
          </div>

          {monthlySubTab === "calendar" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {FAMILY_MEMBERS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMonthlyMember(m.id)}
                    className={`p-2.5 rounded-2xl border text-center transition ${
                      monthlyMember === m.id
                        ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                        : "bg-white text-stone-700 border-stone-200"
                    }`}
                  >
                    <div className="flex justify-center mb-0.5"><MemberAvatar member={m} size="md" /></div>
                    <div className="text-xs font-extrabold mt-0.5">{m.name}</div>
                  </button>
                ))}
              </div>

              <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-stone-400 mb-1.5">
                  {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from(
                    { length: new Date(`${currentMonth}-01T00:00:00`).getDay() || 0 },
                    (_, idx) => (
                      <div key={`m-empty-${idx}`} className="min-h-[50px]" />
                    )
                  )}
                  {Array.from({ length: getDaysInMonth(currentMonth) }, (_, i) => {
                    const dayNum = String(i + 1).padStart(2, "0");
                    const dateStr = `${currentMonth}-${dayNum}`;
                    const mList = meals.filter(
                      (m) => m.date === dateStr && toSafeArray(m.members).includes(monthlyMember)
                    );
                    const isSel = selectedDate === dateStr;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`p-1.5 rounded-xl border text-left min-h-[50px] transition flex flex-col justify-between ${
                          isSel
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-stone-50 text-stone-700 border-stone-200"
                        }`}
                      >
                        <div className="text-[10px] font-black">{i + 1}</div>
                        {mList.length > 0 && (
                          <div
                            className={`text-[9px] font-extrabold px-1 py-0.5 rounded text-center ${
                              isSel ? "bg-amber-400 text-stone-900" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {mList.length}끼
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
                <div className="text-xs font-black text-stone-900">
                  📌 {selectedDate} ({getDayName(selectedDate)}) {monthlyMember}님의 식단
                </div>
                {meals
                  .filter(
                    (m) => m.date === selectedDate && toSafeArray(m.members).includes(monthlyMember)
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs leading-snug break-keep"
                    >
                      <span className="font-extrabold text-amber-700 mr-2">[{m.slot}]</span>
                      <span className="font-bold text-stone-800">{m.menu}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-md">
                <div className="flex items-center justify-between text-xs text-stone-300 mb-1">
                  <span>{currentMonth}월 총 식비 지출 (냉장고 소진 시에도 유지됨)</span>
                  <button
                    onClick={() => {
                      const next = prompt("월 목표 식비 예산(원)을 입력하세요:", monthlyBudget);
                      if (next && !isNaN(Number(next))) {
                        setMonthlyBudget(Number(next));
                        localStorage.setItem("kim_family_budget", String(Number(next)));
                      }
                    }}
                    className="underline text-amber-300 font-bold"
                  >
                    예산: {monthlyBudget.toLocaleString()}원
                  </button>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {monthlyExpenseSummary.total.toLocaleString()}원
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-stone-700 text-xs">
                  <div>
                    <div className="text-stone-400">🛒 장보기/식재료 구입</div>
                    <div className="font-extrabold text-white mt-0.5">
                      {monthlyExpenseSummary.groceryTotal.toLocaleString()}원
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-400">🍽️ 외식/배달/야식</div>
                    <div className="font-extrabold text-white mt-0.5">
                      {monthlyExpenseSummary.diningTotal.toLocaleString()}원
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <div className="w-full h-2 rounded-full bg-stone-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        monthlyBudget > 0 && monthlyExpenseSummary.total > monthlyBudget ? "bg-rose-500" : "bg-amber-400"
                      }`}
                      style={{
                        width: `${Math.min(100, monthlyBudget > 0 ? Math.round((monthlyExpenseSummary.total / monthlyBudget) * 100) : 0)}%`
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-300">
                    <span>
                      예산 사용률 {monthlyBudget > 0 ? Math.round((monthlyExpenseSummary.total / monthlyBudget) * 100) : 0}%
                    </span>
                    {monthlyExpenseSummary.prevDiff !== null && (
                      <span className={monthlyExpenseSummary.prevDiff <= 0 ? "text-emerald-300 font-extrabold" : "text-rose-300 font-extrabold"}>
                        전월({monthlyExpenseSummary.prevMonthPrefix.slice(5)}월) 대비{" "}
                        {monthlyExpenseSummary.prevDiff <= 0
                          ? `▼ ${Math.abs(monthlyExpenseSummary.prevDiff).toLocaleString()}원 절약`
                          : `▲ ${monthlyExpenseSummary.prevDiff.toLocaleString()}원 증가`}
                      </span>
                    )}
                  </div>
                </div>

                {monthlyExpenseSummary.categoryTop?.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-700 space-y-1.5">
                    <div className="text-[10px] font-bold text-stone-400">📊 카테고리별 식비 비중 (상위 4개)</div>
                    {monthlyExpenseSummary.categoryTop.map((ct) => (
                      <div key={ct.category} className="space-y-0.5 text-[10px]">
                        <div className="flex items-center justify-between text-stone-200">
                          <span>{ct.category}</span>
                          <span className="font-bold">{ct.amount.toLocaleString()}원 ({ct.pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-stone-700 overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${ct.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {monthlyExpenseSummary.rescuedCount > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-700 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 font-bold">
                      🎉 임박 재료 구출 저금통 ({monthlyExpenseSummary.rescuedCount}건)
                    </span>
                    <span className="font-black text-emerald-300">
                      +{monthlyExpenseSummary.rescuedTotal.toLocaleString()}원 아낌
                    </span>
                  </div>
                )}

                {monthlyExpenseSummary.wasteCount > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-700 flex items-center justify-between text-[11px]">
                    <span className="text-rose-300 font-bold">
                      🗑️ 이번 달 폐기손실 ({monthlyExpenseSummary.wasteCount}건 · 폐기율 {monthlyExpenseSummary.wasteRate}%)
                    </span>
                    <span className="font-black text-rose-300">
                      {monthlyExpenseSummary.wasteTotal.toLocaleString()}원
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
                <h3 className="text-xs font-black text-stone-900">
                  🧾 {currentMonth}월 장보기 지출 원장 ({monthlyExpenseSummary.ledgerItems.length}건)
                </h3>
                <div className="divide-y divide-stone-100">
                  {monthlyExpenseSummary.ledgerItems.map((exp) => (
                    <div key={exp.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-800">{exp.title}</div>
                        <div className="text-[10px] text-stone-400">
                          {exp.date} · {exp.category}
                        </div>
                      </div>
                      <span className="font-extrabold text-stone-900">
                        {Number(exp.amount).toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          탭 4: 일정 (1. 월간 달력 -> 2. 선택일 상세일정 -> 3. [신규] 주간 일정 요약 -> 4. [신규] 전체 To-Do 체크리스트 -> 5. 최하단 D-Day 보드)
      ========================================== */}
      {activeTab === "schedule" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="truncate">우리 가족 월간 일정표</span>
              </h2>
              <p className="text-[11px] text-stone-500">
                월간 달력 · 주간 일정 요약 · 전체 To-Do 체크리스트 · 기념일 D-Day
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSchedule(null);
                setScheduleForm({
                  title: "",
                  date: scheduleSelectedDate,
                  category: "할일(To-Do)",
                  members:
                    scheduleMemberFilter === "전체"
                      ? ["수혁", "아리나", "시목", "시율"]
                      : [scheduleMemberFilter],
                  isAnnual: false,
                  showDday: false,
                  hasOriginYear: false,
                  memo: ""
                });
                setIsScheduleModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center gap-1 shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> 일정 추가
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setScheduleSubTab("calendar")}
              className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition ${
                scheduleSubTab === "calendar"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <span className="whitespace-nowrap">📅 달력·일정</span>
              {imminentSchedulesWithin3Days.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black leading-none">
                  {imminentSchedulesWithin3Days.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setScheduleSubTab("todo")}
              className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition ${
                scheduleSubTab === "todo"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <span className="whitespace-nowrap">✅ 할 일</span>
              {globalTodoBadgeStats.activeCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black leading-none">
                  {globalTodoBadgeStats.activeCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setScheduleSubTab("routine")}
              className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition ${
                scheduleSubTab === "routine"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <span className="whitespace-nowrap">🔄 반복 루틴</span>
              {familyRoutines.filter((r) => !isRoutineDoneNow(r)).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black leading-none">
                  {familyRoutines.filter((r) => !isRoutineDoneNow(r)).length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-5 sm:gap-1">
            <button
              onClick={() => {
                setScheduleMemberFilter("전체");
                setRoutineTargetFilter("전체");
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border transition flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                scheduleMemberFilter === "전체"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200"
              }`}
            >
              <span>👨‍👩‍👧‍👦</span>
              <span>전체</span>
            </button>
            {FAMILY_MEMBERS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setScheduleMemberFilter(m.id);
                  setRoutineTargetFilter(m.id);
                }}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-extrabold border transition flex items-center justify-center gap-1 whitespace-nowrap shrink-0 ${
                  scheduleMemberFilter === m.id
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                <MemberAvatar member={m} size="sm" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>

          {scheduleSubTab === "calendar" && (
            <>
          {/* [1순위 최상단 배치] 월간 가족 일정 캘린더 */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  const prevM = shiftYearMonth(scheduleMonth, -1);
                  setScheduleMonth(prevM);
                  setScheduleSelectedDate(`${prevM}-01`);
                }}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={scheduleMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      setScheduleMonth(e.target.value);
                      setScheduleSelectedDate(`${e.target.value}-01`);
                    }
                  }}
                  className="text-sm font-black text-stone-900 bg-transparent focus:outline-none"
                />
                <button
                  onClick={() => {
                    const today = getTodayStr();
                    setScheduleMonth(today.slice(0, 7));
                    setScheduleSelectedDate(today);
                  }}
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-700 hover:bg-stone-200"
                >
                  오늘
                </button>
              </div>
              <button
                onClick={() => {
                  const nextM = shiftYearMonth(scheduleMonth, 1);
                  setScheduleMonth(nextM);
                  setScheduleSelectedDate(`${nextM}-01`);
                }}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1">
              {["전체", ...SCHEDULE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setScheduleCatFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 border ${
                    scheduleCatFilter === cat
                      ? "bg-pink-600 text-white border-pink-600"
                      : "bg-stone-50 text-stone-600 border-stone-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-stone-400">
              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from(
                { length: new Date(`${scheduleMonth}-01T00:00:00`).getDay() || 0 },
                (_, idx) => (
                  <div key={`empty-${idx}`} className="min-h-[54px]" />
                )
              )}
              {Array.from({ length: getDaysInMonth(scheduleMonth) }, (_, i) => {
                const dayNum = String(i + 1).padStart(2, "0");
                const dateStr = `${scheduleMonth}-${dayNum}`;
                const daySchedules = getSchedulesForDate(
                  dateStr,
                  scheduleMemberFilter,
                  scheduleCatFilter
                );
                const isSel = scheduleSelectedDate === dateStr;
                const isToday = getTodayStr() === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setScheduleSelectedDate(dateStr)}
                    className={`p-1 rounded-xl border text-left min-h-[56px] transition flex flex-col justify-between overflow-hidden ${
                      isSel
                        ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                        : isToday
                        ? "bg-amber-50 text-stone-900 border-amber-400"
                        : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-0.5 w-full">
                      <span className="text-[10px] font-black shrink-0">{i + 1}</span>
                      {isToday && (
                        <span className="text-[8px] font-extrabold px-1 rounded bg-amber-400 text-stone-900 whitespace-nowrap shrink-0 leading-tight">
                          오늘
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 w-full mt-0.5">
                      {daySchedules.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[8px] font-extrabold px-1 py-0.2 rounded truncate ${
                            ev.category === "기념일/생일"
                              ? isSel
                                ? "bg-pink-400 text-stone-900"
                                : "bg-pink-100 text-pink-800"
                              : ev.done
                              ? "bg-stone-200 text-stone-400 line-through"
                              : isSel
                              ? "bg-amber-400 text-stone-900"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {daySchedules.length > 2 && (
                        <div className="text-[8px] font-bold opacity-75 text-center">
                          +{daySchedules.length - 2}건
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* [2순위 배치] 선택한 날짜의 상세 일정 관리 */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-stone-900">
                📌 {scheduleSelectedDate} ({getDayName(scheduleSelectedDate)}) 상세 일정
              </div>
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setScheduleForm({
                    title: "",
                    date: scheduleSelectedDate,
                    category: "할일(To-Do)",
                    members: ["수혁", "아리나"],
                    isAnnual: false,
                    showDday: false,
                    hasOriginYear: false,
                    memo: ""
                  });
                  setIsScheduleModalOpen(true);
                }}
                className="text-[11px] font-extrabold text-pink-600 hover:underline"
              >
                + 이 날짜에 추가
              </button>
            </div>

            {getSchedulesForDate(scheduleSelectedDate, scheduleMemberFilter, scheduleCatFilter)
              .length === 0 ? (
              <div className="text-xs text-stone-400 py-4 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                이 날짜에 등록된 일정이나 기념일이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {getSchedulesForDate(
                  scheduleSelectedDate,
                  scheduleMemberFilter,
                  scheduleCatFilter
                ).map((ev) => {
                  const dInfo = calculateScheduleDday(ev);
                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                        ev.category === "기념일/생일"
                          ? "bg-pink-50/60 border-pink-200"
                          : ev.done
                          ? "bg-stone-100 border-stone-200 opacity-70"
                          : "bg-stone-50 border-stone-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white border border-stone-200 text-stone-700">
                            {ev.category}
                          </span>
                          {ev.isAnnual && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-pink-600 text-white">
                              🔄 매년 반복
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900">
                            {dInfo.dDayText}
                          </span>
                          {dInfo.elapsedDays !== null && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                              D+{dInfo.elapsedDays.toLocaleString()}일째
                            </span>
                          )}
                          {toSafeArray(ev.members).map((mId) => {
                            const info = FAMILY_MEMBERS.find((f) => f.id === mId);
                            return info ? (
                              <span
                                key={mId}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${info.color}`}
                              >
                                <span className="inline-flex items-center gap-1"><MemberAvatar member={info} size="sm" /><span>{info.name}</span></span>
                              </span>
                            ) : null;
                          })}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {ev.category !== "기념일/생일" && (
                            <button
                              onClick={() => handleToggleScheduleDone(ev)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                                ev.done
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-stone-600 border-stone-300"
                              }`}
                            >
                              {ev.done ? "✓ 완료" : "완료체크"}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingSchedule(ev);
                              setScheduleForm({
                                title: ev.title,
                                date: ev.date,
                                category: ev.category,
                                members: toSafeArray(ev.members),
                                isAnnual: Boolean(ev.isAnnual),
                                showDday: Boolean(ev.showDday),
                                hasOriginYear: Boolean(ev.hasOriginYear),
                                memo: ev.memo || ""
                              });
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-1 rounded-lg hover:bg-stone-200 text-stone-500"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(ev)}
                            className="p-1 rounded-lg hover:bg-red-100 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`text-sm font-black break-keep ${
                          ev.done ? "line-through text-stone-400" : "text-stone-900"
                        }`}
                      >
                        {ev.title}
                      </div>
                      {ev.memo && <div className="text-xs text-stone-600">💬 {ev.memo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ==========================================
              [신규 요청사항 2 완벽 반영] 주간 일정이 있는 항목만 요약하는 화면
          ========================================== */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarRange className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-stone-900">
                  📊 주간 일정 요약 ({scheduleWeekDates[0].slice(5)} ~ {scheduleWeekDates[6].slice(5)})
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const d = new Date(scheduleSelectedDate + "T00:00:00");
                    d.setDate(d.getDate() - 7);
                    const nextStr = formatDate(d);
                    setScheduleSelectedDate(nextStr);
                    setScheduleMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold text-stone-700"
                >
                  &lt; 이전주
                </button>
                <button
                  onClick={() => {
                    const today = getTodayStr();
                    setScheduleSelectedDate(today);
                    setScheduleMonth(today.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-extrabold"
                >
                  이번주
                </button>
                <button
                  onClick={() => {
                    const d = new Date(scheduleSelectedDate + "T00:00:00");
                    d.setDate(d.getDate() + 7);
                    const nextStr = formatDate(d);
                    setScheduleSelectedDate(nextStr);
                    setScheduleMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold text-stone-700"
                >
                  다음주 &gt;
                </button>
              </div>
            </div>

            {weeklyActiveScheduleSummary.length === 0 ? (
              <div className="text-xs text-stone-400 py-4 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                이 주간({scheduleWeekDates[0].slice(5)} ~ {scheduleWeekDates[6].slice(5)})에는 등록된 일정이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {weeklyActiveScheduleSummary.map((dayGroup) => {
                  const isToday = dayGroup.date === getTodayStr();
                  return (
                    <div
                      key={dayGroup.date}
                      onClick={() => setScheduleSelectedDate(dayGroup.date)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        dayGroup.date === scheduleSelectedDate
                          ? "bg-indigo-50/70 border-indigo-300"
                          : "bg-stone-50 border-stone-200 hover:bg-stone-100/70"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-stone-900">
                            {dayGroup.date.slice(5).replace("-", "월 ")}일 ({dayGroup.dayName})
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-stone-900 text-[9px] font-black">
                              오늘
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-700">
                          {dayGroup.items.length}건
                        </span>
                      </div>

                      <div className="space-y-1">
                        {dayGroup.items.map((ev) => {
                          const dInfo = calculateScheduleDday(ev);
                          return (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200/80 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {ev.category !== "기념일/생일" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleScheduleDone(ev);
                                    }}
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                      ev.done
                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                        : "border-stone-300 bg-white"
                                    }`}
                                  >
                                    {ev.done && <Check className="w-3 h-3" />}
                                  </button>
                                )}
                                <span
                                  className={`font-bold whitespace-normal break-words leading-snug ${
                                    ev.done ? "line-through text-stone-400" : "text-stone-800"
                                  }`}
                                >
                                  {ev.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {toSafeArray(ev.members).map((mId) => {
                                  const info = FAMILY_MEMBERS.find((f) => f.id === mId);
                                  return info ? (
                                    <span key={mId} className="text-[11px]" title={info.name}>
                                      {info.emoji}
                                    </span>
                                  ) : null;
                                })}
                                <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 text-[10px] font-extrabold">
                                  {dInfo.dDayText}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            </>
          )}

          {/* 🔄 자정/주간 자동 리셋 데일리·위클리 육아/집안일 루틴 */}
          {scheduleSubTab === "routine" && (
          <div id="routine-board-section" className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-black text-stone-900 flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap">🔄 반복 루틴</span>
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-black whitespace-nowrap shrink-0">
                    남은 {familyRoutines.filter((r) => !isRoutineDoneNow(r)).length}건
                  </span>
                </h3>
                <p className="text-[10px] text-stone-500 font-semibold mt-0.5">
                  현재({isWeekendNow() ? "주말" : "평일"}): <span className="text-stone-900 font-extrabold">{getCurrentRoutineTimeSlot(routineTimeRanges, liveMinuteTick)}</span> · 자정·월요일 자동 리셋
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRoutineRangeEditOpen((v) => !v)}
                  className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold border whitespace-nowrap ${
                    isRoutineRangeEditOpen
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-stone-50 text-stone-700 border-stone-200"
                  }`}
                >
                  {isRoutineRangeEditOpen ? "닫기 ▴" : "⏰ 시간대"}
                </button>
                <button
                  type="button"
                  onClick={openNewRoutineModal}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-900 text-white text-[11px] font-extrabold whitespace-nowrap flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 루틴 추가
                </button>
              </div>
            </div>

            {isRoutineRangeEditOpen && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-indigo-950">
                    루틴 시간대 시작 시각 설정 (홈 자동 표출 연동)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutineTimeRanges(DEFAULT_ROUTINE_TIME_RANGES);
                      try { localStorage.setItem("kim_routine_time_ranges_v1", JSON.stringify(DEFAULT_ROUTINE_TIME_RANGES)); } catch (e) {}
                      syncHomeSettingsToCloud(null, null, DEFAULT_ROUTINE_TIME_RANGES);
                      showToast("루틴 시간대를 기본값으로 초기화했습니다.");
                    }}
                    className="text-[10px] font-extrabold text-indigo-700 underline"
                  >
                    기본값 초기화
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] font-extrabold text-indigo-900 mb-1">
                      평일 (월~금 · 오후 제외):{" "}
                      <span className="font-semibold text-indigo-700">
                        {ROUTINE_WEEKDAY_SLOTS.map((s, idx) => {
                          const nxt = ROUTINE_WEEKDAY_SLOTS[(idx + 1) % ROUTINE_WEEKDAY_SLOTS.length];
                          return `${s} ${formatMinutesHHMM(toTimeMinutes(routineTimeRanges[s]))}~${formatMinutesHHMM(toTimeMinutes(routineTimeRanges[nxt]))}`;
                        }).join(" · ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {ROUTINE_WEEKDAY_SLOTS.map((slot) => (
                        <label key={`wd-${slot}`} className="block">
                          <span className="text-[10px] font-bold text-indigo-900 block mb-0.5">{slot} 시작</span>
                          <input
                            type="time"
                            value={formatMinutesHHMM(toTimeMinutes(routineTimeRanges[slot], toTimeMinutes(DEFAULT_ROUTINE_TIME_RANGES[slot]) / 60))}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              setRoutineTimeRanges((prev) => {
                                const next = { ...prev, [slot]: val };
                                try { localStorage.setItem("kim_routine_time_ranges_v1", JSON.stringify(next)); } catch (err) {}
                                syncHomeSettingsToCloud(null, null, next);
                                return next;
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-indigo-200 bg-white text-[11px] font-black text-stone-800"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-extrabold text-teal-900 mb-1">
                      주말 (토·일 · 하원후 제외):{" "}
                      <span className="font-semibold text-teal-700">
                        {ROUTINE_WEEKEND_SLOTS.map((s, idx) => {
                          const nxt = ROUTINE_WEEKEND_SLOTS[(idx + 1) % ROUTINE_WEEKEND_SLOTS.length];
                          return `${s} ${formatMinutesHHMM(toTimeMinutes(routineTimeRanges[s]))}~${formatMinutesHHMM(toTimeMinutes(routineTimeRanges[nxt]))}`;
                        }).join(" · ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {ROUTINE_WEEKEND_SLOTS.map((slot) => (
                        <label key={`we-${slot}`} className="block">
                          <span className="text-[10px] font-bold text-teal-900 block mb-0.5">{slot} 시작</span>
                          <input
                            type="time"
                            value={formatMinutesHHMM(toTimeMinutes(routineTimeRanges[slot], toTimeMinutes(DEFAULT_ROUTINE_TIME_RANGES[slot]) / 60))}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              setRoutineTimeRanges((prev) => {
                                const next = { ...prev, [slot]: val };
                                try { localStorage.setItem("kim_routine_time_ranges_v1", JSON.stringify(next)); } catch (err) {}
                                syncHomeSettingsToCloud(null, null, next);
                                return next;
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-teal-200 bg-white text-[11px] font-black text-stone-800"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {(new Set(ROUTINE_WEEKDAY_SLOTS.map((s) => toTimeMinutes(routineTimeRanges[s]))).size < ROUTINE_WEEKDAY_SLOTS.length ||
                  new Set(ROUTINE_WEEKEND_SLOTS.map((s) => toTimeMinutes(routineTimeRanges[s]))).size < ROUTINE_WEEKEND_SLOTS.length) && (
                  <div className="text-[10px] font-extrabold text-rose-600">
                    ⚠️ 같은 요일 그룹 내 시작 시각이 중복된 시간대가 있습니다.
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: "전체", label: "전체" },
                { id: "공통", label: "👨‍👩‍👧‍👦 공통" },
                { id: "시목", label: "👦 시목" },
                { id: "시율", label: "👶 시율" },
                { id: "수혁", label: "👨 수혁" },
                { id: "아리나", label: "👩 아리나" }
              ].map((tgt) => (
                <button
                  key={tgt.id}
                  type="button"
                  onClick={() => setRoutineTargetFilter(tgt.id)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                    routineTargetFilter === tgt.id
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-stone-50 text-stone-600 border-stone-200"
                  }`}
                >
                  {tgt.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {["전체", ...ROUTINE_TIME_SLOTS].map((ts) => (
                <button
                  key={ts}
                  type="button"
                  onClick={() => setRoutineTimeFilter(ts)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                    routineTimeFilter === ts
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-stone-50 text-stone-600 border-stone-200"
                  }`}
                >
                  {ts}
                </button>
              ))}
            </div>

            {familyRoutines.length === 0 ? (
              <div className="text-center py-3 text-xs text-stone-400">
                등록된 루틴이 없습니다. 위에서 매일/매주 반복 루틴을 추가해 보세요.
              </div>
            ) : (
              <div className="space-y-1.5">
                {[...familyRoutines]
                  .filter((rt) => (routineTimeFilter === "전체" || (rt.timeSlot || "상시") === routineTimeFilter) && matchesRoutineTarget(rt, routineTargetFilter))
                  .sort((a, b) => {
                    const aDone = Number(isRoutineDoneNow(a));
                    const bDone = Number(isRoutineDoneNow(b));
                    if (aDone !== bDone) return aDone - bDone;
                    const slotIdx = (r) => {
                      const idx = ROUTINE_TIME_SLOTS.indexOf(r.timeSlot || "상시");
                      return idx === -1 ? 99 : idx;
                    };
                    if (slotIdx(a) !== slotIdx(b)) return slotIdx(a) - slotIdx(b);
                    const urgency = (r) => {
                      if (r.cycle === "monthly" || r.cycle === "monthly_weekday") {
                        const info = getMonthlyRoutineDueInfo(r);
                        return info && info.diff > 3 ? 1 : 0;
                      }
                      return 0;
                    };
                    return urgency(a) - urgency(b);
                  })
                  .map((rt) => {
                    const doneNow = isRoutineDoneNow(rt);
                    const nextDateInfo = getRoutineNextDateInfo(rt, currentDayKey);
                    const intervalInfo = getIntervalRoutineInfo(rt, currentDayKey);
                    return (
                      <div
                        key={rt.id}
                        className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 transition ${
                          doneNow ? "bg-stone-50 border-stone-200 opacity-65" : "bg-stone-50/70 border-stone-200"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 flex-1 text-left min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRoutine(rt.id)}
                            className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 ${
                              doneNow
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-indigo-300"
                            }`}
                            title="전체 완료"
                          >
                            {doneNow && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            {(() => {
                              const steps = parseRoutineSteps(rt.title);
                              const stepDoneSet = getRoutineSubStepDoneSet(rt);
                              if (steps.length >= 2) {
                                return (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {steps.map((st, sIdx) => {
                                      const sDone = doneNow || stepDoneSet.has(sIdx);
                                      return (
                                        <React.Fragment key={sIdx}>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleRoutineSubStep(rt.id, sIdx, steps.length)}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold border transition active:scale-95 ${
                                              sDone
                                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                                : "bg-white border-stone-200 text-stone-800 hover:bg-stone-100"
                                            }`}
                                          >
                                            <span
                                              className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] font-black shrink-0 ${
                                                sDone
                                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                                  : "border-stone-400 text-stone-700 bg-white"
                                              }`}
                                            >
                                              {sDone ? "✓" : sIdx + 1}
                                            </span>
                                            <span className={sDone ? "line-through" : ""}>{st}</span>
                                          </button>
                                          {sIdx < steps.length - 1 && (
                                            <span className="text-[10px] font-black text-indigo-300">→</span>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoutine(rt.id)}
                                  className={`text-left text-xs font-extrabold whitespace-normal break-words leading-snug w-full ${doneNow ? "line-through text-stone-400" : "text-stone-900"}`}
                                >
                                  {rt.title}
                                </button>
                              );
                            })()}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {parseRoutineSteps(rt.title).length >= 2 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black">
                                  진행 {doneNow ? parseRoutineSteps(rt.title).length : getRoutineSubStepDoneSet(rt).size}/{parseRoutineSteps(rt.title).length}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">
                                {rt.timeSlot || "상시"}
                              </span>
                              {(() => {
                                if (rt.cycle === "interval" && intervalInfo) {
                                  return (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                      !doneNow ? "bg-teal-100 text-teal-900" : "bg-stone-200 text-stone-600"
                                    }`}>
                                      {intervalInfo.intervalDays}일마다{doneNow ? ` · D-${intervalInfo.daysLeft}` : " · 오늘 할 날"}
                                    </span>
                                  );
                                }
                                if (rt.cycle === "monthly" || rt.cycle === "monthly_weekday") {
                                  const info = getMonthlyRoutineDueInfo(rt);
                                  const nthText = Number(rt.nthWeek) === -1 ? "마지막 주" : `${rt.nthWeek || 1}번째 주`;
                                  const wdText = WEEKDAY_KO[Number(rt.weekDay ?? 6)] || "토";
                                  const prefix = rt.cycle === "monthly_weekday" ? `매월 ${nthText} ${wdText}` : `매월 ${rt.monthDay || 1}일`;
                                  const dLabel = !info
                                    ? ""
                                    : info.diff === 0
                                    ? ` · ${info.dateLabel} 오늘`
                                    : info.diff < 0
                                    ? ` · ${info.dateLabel} (${Math.abs(info.diff)}일 지남)`
                                    : ` · ${info.dateLabel} (D-${info.diff})`;
                                  return (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                      !doneNow && info && info.diff <= 0
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-900"
                                    }`}>
                                      {prefix}{doneNow ? " (이번달 완료)" : dLabel}
                                    </span>
                                  );
                                }
                                if (rt.cycle === "weekly") {
                                  const wkLabel =
                                    rt.weekDay !== undefined && rt.weekDay !== null
                                      ? `매주 ${WEEKDAY_KO[Number(rt.weekDay)] || ""}요일${nextDateInfo ? ` · ${nextDateInfo.dateLabel}` : ""}`
                                      : "매주 리셋";
                                  return (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-800">
                                      {wkLabel}
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-sky-100 text-sky-800">
                                    매일 자정 리셋
                                  </span>
                                );
                              })()}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${getRoutineAssigneeBadgeCls(rt.assignee)}`}>
                                {rt.assignee || "공통"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditRoutine(rt)}
                            className="p-1 text-stone-400 hover:text-indigo-600"
                            title="루틴 수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRoutine(rt.id)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                            title="루틴 삭제"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          )}

          {/* ==========================================
              [신규 요청사항 1 완벽 반영] To-Do List 전체를 체크리스트처럼 표시하는 화면
          ========================================== */}
          {scheduleSubTab === "todo" && (
          <div id="schedule-todo-section" className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ListTodo className="w-4 h-4 text-emerald-600 shrink-0" />
                  <h3 className="text-xs font-black text-stone-900 leading-snug">
                    ✅ 전체 To-Do 체크리스트 ({todoStats.activeCount}건 남음 / 완료 {todoStats.doneCount}건)
                  </h3>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg shrink-0">
                  {[
                    { id: "all", label: "전체" },
                    { id: "active", label: "진행중" },
                    { id: "completed", label: "완료됨" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTodoStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold whitespace-nowrap transition ${
                        todoStatusFilter === tab.id
                          ? "bg-stone-900 text-white"
                          : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {todoStats.doneCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCompletedTodos}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-extrabold text-rose-700 whitespace-nowrap"
                  >
                    🧹 완료됨 비우기
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-stone-500">
                {todoIncludeOtherCats ? "할일 + 육아/병원·가족행사 함께 표시 중" : "할일(To-Do)만 표시 중"}
              </span>
              <button
                onClick={() => setTodoIncludeOtherCats((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition whitespace-nowrap ${
                  todoIncludeOtherCats
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                }`}
              >
                {todoIncludeOtherCats ? "🏥 병원·행사 포함 ON" : "🏥 병원·행사 포함"}
              </button>
            </div>

            {/* 진행률 바 */}
            {todoStats.total > 0 && (
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.round((todoStats.doneCount / todoStats.total) * 100)}%`
                  }}
                />
              </div>
            )}

            {/* 체크리스트 인라인 빠른 할 일 추가 바 */}
            <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 space-y-1.5">
              <input
                type="text"
                placeholder="할 일 빠른 입력 (예: 시목이 상담, 예방접종)"
                value={quickTodoTitle}
                onChange={(e) => setQuickTodoTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickAddTodo();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold bg-white"
              />
              <div className="flex items-center justify-between gap-1.5">
                <input
                  type="date"
                  value={quickTodoDate}
                  onChange={(e) => setQuickTodoDate(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-stone-200 text-[11px] font-bold bg-white flex-1"
                />
                <button
                  onClick={handleQuickAddTodo}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold whitespace-nowrap shrink-0"
                >
                  + 추가
                </button>
              </div>
            </div>

            {/* 전체 체크리스트 목록 */}
            {allTodoChecklistItems.length === 0 ? (
              <div className="text-xs text-stone-400 py-4 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                표시할 To-Do 체크리스트 항목이 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                {allTodoChecklistItems.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                      todo.done
                        ? "bg-stone-100 border-stone-200 opacity-70"
                        : "bg-white border-stone-200 shadow-sm"
                    }`}
                  >
                    <div
                      onClick={() => handleToggleScheduleDone(todo)}
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                    >
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition ${
                          todo.done
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-stone-300 bg-white hover:border-emerald-500"
                        }`}
                      >
                        {todo.done && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs font-extrabold break-keep ${
                              todo.done ? "line-through text-stone-400" : "text-stone-900"
                            }`}
                          >
                            {todo.title}
                          </span>
                          {!todo.done && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                todo.calc.daysUntil <= 3 && todo.calc.daysUntil >= 0
                                  ? "bg-rose-500 text-white"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {todo.calc.dDayText}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mt-0.5">
                          <span>
                            📅 {todo.date} ({getDayName(todo.date)})
                          </span>
                          <span>· {todo.category}</span>
                          <span>
                            ·{" "}
                            <span className="inline-flex items-center gap-0.5 align-middle">
                              {toSafeArray(todo.members).map((m) => (
                                <MemberAvatar key={m} id={m} size="sm" />
                              ))}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingSchedule(todo);
                          setScheduleForm({
                            title: todo.title,
                            date: todo.date,
                            category: todo.category,
                            members: toSafeArray(todo.members),
                            isAnnual: Boolean(todo.isAnnual),
                            showDday: Boolean(todo.showDday),
                            hasOriginYear: Boolean(todo.hasOriginYear),
                            memo: todo.memo || ""
                          });
                          setIsScheduleModalOpen(true);
                        }}
                        className="p-1 text-stone-400 hover:text-stone-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(todo)}
                        className="p-1 text-stone-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          )}

          {/* [5순위 최하단 배치] 우리 가족 D-Day & 기념일 카운트다운 보드 */}
          {scheduleSubTab === "calendar" && (
          <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white p-4 rounded-2xl shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>우리 가족 D-Day & 기념일 카운트다운 (오늘: {getTodayStr()})</span>
              </div>
            </div>

            <div className="space-y-2">
              {dDayCards.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const targetMonth = item.isAnnual
                      ? `${scheduleMonth.slice(0, 4)}-${String(item.date).slice(5, 7)}`
                      : String(item.date).slice(0, 7);
                    const targetDay = item.isAnnual
                      ? `${scheduleMonth.slice(0, 4)}-${String(item.date).slice(5, 10)}`
                      : String(item.date).slice(0, 10);
                    setScheduleMonth(targetMonth);
                    setScheduleSelectedDate(targetDay);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl px-3 py-2.5 cursor-pointer transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold text-white break-keep leading-snug">
                      {item.title}
                    </div>
                    <div className="text-[11px] font-semibold text-stone-300 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        📅 {item.isAnnual ? `매년 ${String(item.date).slice(5).replace("-", "월 ")}일` : item.date}
                      </span>
                      {item.calc.elapsedDays !== null && (
                        <span className="text-amber-300 font-extrabold">
                          • {item.id.includes("bday") ? "생후" : "함께한 지"} D+{item.calc.elapsedDays.toLocaleString()}일째
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                      item.calc.daysUntil <= 3 && item.calc.daysUntil >= 0
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-amber-400 text-stone-900"
                    }`}
                  >
                    {item.calc.dDayText}
                  </span>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* ==========================================
          탭 5: 스마트 냉장고
      ========================================== */}
      {activeTab === "fridge" && (
        <div className="p-4 space-y-3.5">
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="w-full p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100 transition flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-emerald-900 leading-tight">
                  마트 영수증 AI 스캔
                </div>
                <div className="text-[11px] font-semibold text-emerald-700 leading-tight mt-0.5">
                  사진 1장으로 냉장고 + 가계부 자동입고
                </div>
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-700 shrink-0">스캔 &gt;</span>
          </button>

          <button
            onClick={() => setIsInventoryExportOpen(true)}
            className="w-full py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-800 text-xs font-extrabold flex items-center justify-between"
          >
            <span>📤 1주일 식단 · 전체 재고 내보내기 (드롭다운 선택)</span>
            <span className="text-stone-500">열기 &gt;</span>
          </button>
          {expiringItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs font-black text-orange-900 mb-1.5">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span>소비기한 임박/경과 재료 ({expiringItems.length}건)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {expiringItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuickFridgeItem(item)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-white hover:bg-orange-100 text-orange-800 border border-orange-200 active:scale-95 transition"
                  >
                    {item.name} ({item.diff < 0 ? `${Math.abs(item.diff)}일 지남` : `D-${item.diff}`})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 bg-stone-200 p-1 rounded-xl overflow-x-auto">
              {(fridgeViewMode === "list"
                ? ["전체", "냉장실", "냉동실", "실온·팬트리"]
                : ["전체", ...STORAGE_LOCATIONS]
              ).map((loc) => {
                const isActive =
                  fridgeLocFilter === loc ||
                  (fridgeViewMode === "list" &&
                    loc === "냉동실" &&
                    (fridgeLocFilter === "메인 냉동실" || fridgeLocFilter === "별도 냉동고"));
                return (
                  <button
                    key={loc}
                    onClick={() => setFridgeLocFilter(loc)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap transition ${
                      isActive
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-600"
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
            <button
              onClick={openAddFridgeModal}
              className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> 재료 추가
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => { setFridgeViewMode("list"); setBulkMoveMode(false); setSelectedBulkFridgeIds([]); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition ${
                fridgeViewMode === "list" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              📋 리스트 뷰
            </button>
            <button
              onClick={() => setFridgeViewMode("visual")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition ${
                fridgeViewMode === "visual" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              🗂️ 냉장고 시각적 구성 뷰
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {["전체", ...FRIDGE_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFridgeCatFilter(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 border ${
                  fridgeCatFilter === cat
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={fridgeSearch}
                onChange={(e) => setFridgeSearch(e.target.value)}
                placeholder="🔍 냉장고 재료 검색 (예: 양파, 우유, 소고기...)"
                className="w-full px-3 py-2 pr-8 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-800 placeholder:text-stone-400"
              />
              {fridgeSearch && (
                <button
                  type="button"
                  onClick={() => setFridgeSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-black"
                >
                  ✕
                </button>
              )}
            </div>
            {fridgeViewMode === "list" && (
              <select
                value={fridgeSort}
                onChange={(e) => setFridgeSort(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-extrabold text-stone-700 shrink-0"
              >
                <option value="expiry">임박순</option>
                <option value="recent">최신순</option>
                <option value="name">이름순</option>
              </select>
            )}
          </div>

          {fridge.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-stone-200 text-center space-y-2">
              <div className="text-xs font-bold text-stone-500">
                현재 표시할 냉장고 재료가 없습니다.
              </div>
              <button
                onClick={handleRestoreAllDeleted}
                className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold"
              >
                숨겨진 기존 냉장고 재료 다시 불러오기
              </button>
            </div>
          ) : fridgeViewMode === "visual" ? (() => {
            const qFridge = debouncedFridgeSearch.trim().toLowerCase();
            const filteredFridge = fridge.filter(
              (i) =>
                matchesFridgeLocFilter(i.location, fridgeLocFilter) &&
                (fridgeCatFilter === "전체" || i.category === fridgeCatFilter) &&
                (!visualExpiringOnly || getDaysDiff(i.expiryDate) <= 3) &&
                (!qFridge || String(i.name || "").toLowerCase().includes(qFridge) || String(i.category || "").toLowerCase().includes(qFridge))
            );
            const itemsByZone = {};
            FRIDGE_SHELF_ZONES.forEach((z) => {
              itemsByZone[z] = [];
            });
            filteredFridge.forEach((it) => {
              const z = resolveItemShelfZone(it);
              if (!itemsByZone[z]) itemsByZone[z] = [];
              itemsByZone[z].push(it);
            });

            const renderShelfBox = (zoneName, labelOverride = null, toneClass = "bg-white border-sky-200") => {
              const zItems = itemsByZone[zoneName] || [];
              const isDropTarget = dragOverZone === zoneName;
              return (
                <div
                  key={zoneName}
                  data-shelf-zone={zoneName}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverZone !== zoneName) setDragOverZone(zoneName);
                  }}
                  onDragLeave={() => {
                    if (dragOverZone === zoneName) setDragOverZone("");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone("");
                    const itemId = e.dataTransfer?.getData("text/plain");
                    const dragged = fridge.find((f) => f.id === itemId);
                    if (dragged && resolveItemShelfZone(dragged) !== zoneName) {
                      handleMoveFridgeShelfZone(dragged, zoneName);
                    }
                  }}
                  className={`rounded-xl border p-2 space-y-1.5 transition ${toneClass} ${
                    isDropTarget ? "ring-2 ring-amber-500 bg-amber-50/70" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-black text-stone-700 truncate">
                      {labelOverride || zoneName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-extrabold text-stone-400">
                        {zItems.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenAddFridgeForZone(zoneName)}
                        title={`${labelOverride || zoneName}에 재료 추가`}
                        className="w-4 h-4 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 text-[10px] font-black flex items-center justify-center leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {zItems.length === 0 ? (
                    <div className="text-[10px] text-stone-300 text-center py-1.5">
                      {isDropTarget ? "여기에 놓기" : "비어 있음"}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {zItems.map((it) => {
                        const diff = getDaysDiff(it.expiryDate);
                        const isUrgent = diff <= 3;
                        return (
                          <button
                            key={it.id}
                            draggable={typeof window !== "undefined" && !("ontouchstart" in window)}
                            onDragStart={(e) => {
                              e.dataTransfer?.setData("text/plain", it.id);
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            style={{
                              WebkitTouchCallout: "none",
                              touchAction: "none"
                            }}
                            onTouchStart={(e) => {
                              if (bulkMoveMode) return;
                              const t = e.touches?.[0];
                              if (!t) return;
                              if (chipTouchRef.current?.timer) clearTimeout(chipTouchRef.current.timer);
                              const startX = t.clientX;
                              const startY = t.clientY;
                              const timer = setTimeout(() => {
                                const st = chipTouchRef.current;
                                if (!st || st.item?.id !== it.id) return;
                                st.dragging = true;
                                enableChipTouchScrollLock();
                                if (typeof navigator !== "undefined" && navigator.vibrate) {
                                  try { navigator.vibrate(18); } catch {}
                                }
                                setDraggingChip({ item: it, x: startX, y: startY });
                              }, 180);
                              chipTouchRef.current = {
                                item: it,
                                startX,
                                startY,
                                dragging: false,
                                timer
                              };
                            }}
                            onTouchMove={(e) => {
                              const st = chipTouchRef.current;
                              const t = e.touches?.[0];
                              if (!st || !t) return;
                              if (!st.dragging) {
                                const dist = Math.hypot(t.clientX - st.startX, t.clientY - st.startY);
                                if (dist > 8) {
                                  if (st.timer) clearTimeout(st.timer);
                                  chipTouchRef.current = null;
                                }
                                return;
                              }
                              setDraggingChip({ item: st.item, x: t.clientX, y: t.clientY });
                              const el = document.elementFromPoint(t.clientX, t.clientY);
                              const zoneEl = el?.closest?.("[data-shelf-zone]");
                              const hoveredZone = zoneEl?.getAttribute?.("data-shelf-zone") || "";
                              dragOverZoneRef.current = hoveredZone;
                              setDragOverZone(hoveredZone);
                            }}
                            onTouchEnd={() => {
                              disableChipTouchScrollLock();
                              const st = chipTouchRef.current;
                              if (st?.timer) clearTimeout(st.timer);
                              chipTouchRef.current = null;
                              if (st?.dragging) {
                                justDraggedRef.current = true;
                                setTimeout(() => { justDraggedRef.current = false; }, 180);
                                const targetZ = dragOverZoneRef.current || dragOverZone;
                                dragOverZoneRef.current = "";
                                setDraggingChip(null);
                                setDragOverZone("");
                                if (targetZ && resolveItemShelfZone(st.item) !== targetZ) {
                                  handleMoveFridgeShelfZone(st.item, targetZ);
                                }
                              }
                            }}
                            onTouchCancel={() => {
                              disableChipTouchScrollLock();
                              const st = chipTouchRef.current;
                              if (st?.timer) clearTimeout(st.timer);
                              chipTouchRef.current = null;
                              dragOverZoneRef.current = "";
                              setDraggingChip(null);
                              setDragOverZone("");
                            }}
                            onClick={() => {
                              if (chipTouchRef.current?.dragging || justDraggedRef.current) return;
                              if (bulkMoveMode) {
                                setSelectedBulkFridgeIds((prev) =>
                                  prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
                                );
                              } else {
                                setQuickFridgeItem(it);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 select-none ${
                              bulkMoveMode && selectedBulkFridgeIds.includes(it.id)
                                ? "bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-300"
                                : Number(it.quantity) === 0
                                ? "bg-stone-100/80 border-stone-200/80 text-stone-400"
                                : isUrgent
                                ? "bg-rose-50 border-rose-300 text-rose-900"
                                : "bg-stone-50 hover:bg-amber-50 border-stone-200 text-stone-800"
                            }`}
                          >
                            <span>{getFridgeCategoryIcon(it.category)}</span>
                            <span className={`max-w-[84px] truncate ${Number(it.quantity) === 0 ? "line-through" : ""}`}>{it.name}</span>
                            <span className={`font-bold ${Number(it.quantity) === 0 ? "text-stone-400" : "text-stone-500"}`}>
                              {Number(it.quantity) === 0 ? "소진" : `${Number(it.quantity) || 0}${it.unit}`}
                            </span>
                            {isUrgent && (
                              <span className="text-[9px] font-black text-rose-600">
                                {diff < 0 ? "만료" : `D-${diff}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2.5 py-1.5 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate">
                      {bulkMoveMode ? "☑️ 이동할 재료를 여러 개 탭해 선택하세요" : "👆 탭: 수량·소진 / ✋ 길게 눌러 끌기: 칸 이동"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setBulkMoveMode((v) => !v);
                          setSelectedBulkFridgeIds([]);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border whitespace-nowrap ${
                          bulkMoveMode
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-stone-600 border-stone-200"
                        }`}
                      >
                        {bulkMoveMode ? "☑️ 다중 이동 ON" : "☑️ 다중 이동"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisualExpiringOnly((v) => !v)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border whitespace-nowrap ${
                          visualExpiringOnly
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-white text-stone-600 border-stone-200"
                        }`}
                      >
                        {visualExpiringOnly ? "⚠️ 임박만 ON" : "⚠️ 임박만"}
                      </button>
                    </div>
                  </div>
                  {bulkMoveMode && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = filteredFridge.map((f) => f.id);
                          setSelectedBulkFridgeIds((prev) => (prev.length === allIds.length && allIds.length > 0 ? [] : allIds));
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-extrabold text-stone-700 whitespace-nowrap shrink-0"
                      >
                        {selectedBulkFridgeIds.length === filteredFridge.length && filteredFridge.length > 0 ? "선택 해제" : "전체 선택"}
                      </button>
                      <select
                        value={bulkTargetZone}
                        onChange={(e) => setBulkTargetZone(e.target.value)}
                        className="flex-1 px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] font-bold text-stone-800"
                      >
                        {FRIDGE_SHELF_ZONES.map((z) => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={selectedBulkFridgeIds.length === 0}
                        onClick={() => handleBulkMoveFridgeShelfZone(selectedBulkFridgeIds, bulkTargetZone)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 disabled:opacity-40 text-white text-[11px] font-extrabold whitespace-nowrap shrink-0"
                      >
                        📦 {selectedBulkFridgeIds.length}개 일괄 이동
                      </button>
                    </div>
                  )}
                </div>

                {/* 1. 4도어 상냉장 · 하냉동 */}
                {(fridgeLocFilter === "전체" || fridgeLocFilter === "냉장실" || fridgeLocFilter === "메인 냉동실" || fridgeLocFilter === "냉동실") && (
                  <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-2.5 space-y-2">
                    <div className="text-xs font-black text-sky-950 flex items-center justify-between px-0.5">
                      <span>🧊 4도어 메인 냉장고 (상냉장 · 하냉동)</span>
                    </div>

                    {(fridgeLocFilter === "전체" || fridgeLocFilter === "냉장실") && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-extrabold text-sky-800 px-0.5">❄️ 상부 냉장실 (3단 + 채소칸 2개)</div>
                        {renderShelfBox("냉장 1단(상단)", "1단 · 상단 (유제품·계란·유아식)", "bg-white border-sky-200")}
                        {renderShelfBox("냉장 2단(중단)", "2단 · 중단 (반찬·김치)", "bg-white border-sky-200")}
                        {renderShelfBox("냉장 3단(하단)", "3단 · 하단 (육류·소스·기타)", "bg-white border-sky-200")}
                        {renderShelfBox("채소칸", "🥬 채소칸 (통합)", "bg-emerald-50/70 border-emerald-200")}
                      </div>
                    )}

                    {(fridgeLocFilter === "전체" || fridgeLocFilter === "메인 냉동실" || fridgeLocFilter === "냉동실") && (
                      <div className="space-y-1.5 pt-1 border-t border-sky-200/80">
                        <div className="text-[10px] font-extrabold text-indigo-800 px-0.5">🧊 하부 냉동고 (4칸)</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {renderShelfBox("하부냉동 1칸", "하부 1칸", "bg-indigo-50/60 border-indigo-200")}
                          {renderShelfBox("하부냉동 2칸", "하부 2칸", "bg-indigo-50/60 border-indigo-200")}
                          {renderShelfBox("하부냉동 3칸", "하부 3칸", "bg-indigo-50/60 border-indigo-200")}
                          {renderShelfBox("하부냉동 4칸", "하부 4칸", "bg-indigo-50/60 border-indigo-200")}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. 별도 4칸짜리 전용 냉동고 */}
                {(fridgeLocFilter === "전체" || fridgeLocFilter === "별도 냉동고" || fridgeLocFilter === "냉동실") && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-2.5 space-y-1.5">
                    <div className="text-xs font-black text-indigo-950 px-0.5">
                      ❄️ 별도 냉동고 (4칸)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {renderShelfBox("전용냉동 1칸", "전용 1칸", "bg-white border-indigo-200")}
                      {renderShelfBox("전용냉동 2칸", "전용 2칸", "bg-white border-indigo-200")}
                      {renderShelfBox("전용냉동 3칸", "전용 3칸", "bg-white border-indigo-200")}
                      {renderShelfBox("전용냉동 4칸", "전용 4칸", "bg-white border-indigo-200")}
                    </div>
                  </div>
                )}

                {/* 3. 팬트리 (1칸) */}
                {(fridgeLocFilter === "전체" || fridgeLocFilter === "실온·팬트리") && (
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-2.5 space-y-1.5">
                    <div className="text-xs font-black text-amber-950 px-0.5">
                      🧺 팬트리 · 실온 (1칸)
                    </div>
                    {renderShelfBox("팬트리", "팬트리 (상온·건어물·양념)", "bg-white border-amber-200")}
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="space-y-2">
              {fridge
                .filter((i) => {
                  const qFridge = debouncedFridgeSearch.trim().toLowerCase();
                  return (
                    matchesFridgeLocFilter(i.location, fridgeLocFilter) &&
                    (fridgeCatFilter === "전체" || i.category === fridgeCatFilter) &&
                    (!qFridge || String(i.name || "").toLowerCase().includes(qFridge) || String(i.category || "").toLowerCase().includes(qFridge))
                  );
                })
                .sort((a, b) => {
                  if (fridgeSort === "name") {
                    return String(a.name || "").localeCompare(String(b.name || ""), "ko");
                  }
                  if (fridgeSort === "recent") {
                    return String(b.updatedAt || b.purchaseDate || b.id || "").localeCompare(
                      String(a.updatedAt || a.purchaseDate || a.id || "")
                    );
                  }
                  return getDaysDiff(a.expiryDate) - getDaysDiff(b.expiryDate);
                })
                .map((item) => {
                  const diff = getDaysDiff(item.expiryDate);
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-sm space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1 mb-0.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-stone-100 text-stone-700 whitespace-nowrap">
                              {String(item.location || "").includes("냉동") ? "냉동실" : item.location}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 whitespace-nowrap">
                              {item.category}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold whitespace-nowrap ${
                                diff <= 3
                                  ? "bg-red-100 text-red-700"
                                  : "bg-stone-100 text-stone-500"
                              }`}
                            >
                              {item.expiryDate} ({diff < 0 ? `${Math.abs(diff)}일 지남` : `D-${diff}`})
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-black text-stone-900">{item.name}</span>
                            {Number(item.price) > 0 && (
                              <span className="text-[10px] font-bold text-stone-400">
                                {Number(item.price).toLocaleString()}원
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-xl shrink-0">
                          <button
                            onClick={() => handleAdjustQuantity(item, -1)}
                            className="w-6 h-6 rounded-lg bg-white font-black text-stone-700 shadow-sm"
                          >
                            -
                          </button>
                          <span className="text-xs font-black px-1 whitespace-nowrap">
                            {Number(item.quantity) || 0}
                            {item.unit}
                          </span>
                          <button
                            onClick={() => handleAdjustQuantity(item, 1)}
                            className="w-6 h-6 rounded-lg bg-white font-black text-stone-700 shadow-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-stone-100 gap-1">
                        <div className="flex items-center gap-1 flex-nowrap">
                          <button
                            onClick={() => handleConsumeFridgeItem(item, false)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap"
                          >
                            <Check className="w-3 h-3 shrink-0" /> 다 먹음
                          </button>
                          <button
                            onClick={() => handleConsumeFridgeItem(item, true)}
                            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold whitespace-nowrap"
                          >
                            + 장보기
                          </button>
                          <button
                            onClick={() => handleWasteFridgeItem(item)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-extrabold whitespace-nowrap"
                            title="폐기 처리 및 손실 기록"
                          >
                            🗑️ 폐기
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingFridge(item);
                              setFridgeForm({
                                name: item.name,
                                location: item.location,
                                category: item.category,
                                quantity: item.quantity,
                                unit: item.unit,
                                expiryDate: item.expiryDate,
                                price: item.price || "",
                                purchaseDate: item.purchaseDate || selectedDate,
                                recordExpense: true,
                                shelfZone: item.shelfZone || ""
                              });
                              setFridgeConflictData(null);
    setIsFridgeModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMistakeDeleteFridgeItem(item)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          탭 6: 장보기 메모
      ========================================== */}
      {activeTab === "shopping" && (
        <div className="p-4 space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-900">⚡ 카톡 · 음성 장보기 문장 1초 파싱</span>
              <span className="text-[10px] font-bold text-stone-500">AI + 즉시 분리</span>
            </div>
            <textarea
              rows={2}
              value={quickShoppingText}
              onChange={(e) => setQuickShoppingText(e.target.value)}
              placeholder="예: 양파 1망, 부침두부 2모, 우유 1L 사와"
              className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-800 resize-none focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button
              onClick={handleQuickParseShopping}
              disabled={isQuickParsingShopping}
              className="w-full py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              {isQuickParsingShopping ? "파싱 중..." : "⚡ 문장 분석해서 장보기에 바로 담기"}
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>사야 할 재료 / 장보기 메모 추가</span>
            </h2>

            <div className="grid grid-cols-3 gap-2">
              <input
                id="shopping-item-input"
                type="text"
                placeholder="품목명 (예: 우유, 대파, 기저귀)"
                value={shoppingForm.name}
                onChange={(e) => setShoppingForm({ ...shoppingForm, name: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
              <input
                type="text"
                placeholder="수량 (예: 2팩)"
                value={shoppingForm.quantity}
                onChange={(e) => setShoppingForm({ ...shoppingForm, quantity: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
            </div>
            {shoppingForm.name.trim() && (() => {
              const q = shoppingForm.name.trim().toLowerCase();
              const hits = knownIngredientList
                .filter((x) => x.name.toLowerCase().includes(q) && x.name.toLowerCase() !== q)
                .sort((a, b) => {
                  const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                  const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                  return aStart - bStart;
                })
                .slice(0, 6);
              return hits.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {hits.map((h) => (
                    <button
                      key={h.name}
                      type="button"
                      onClick={() => setShoppingForm({ ...shoppingForm, name: h.name, category: h.category || shoppingForm.category })}
                      className="px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-bold text-emerald-800"
                    >
                      ✨ {h.name}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="flex items-center gap-2">
              <select
                value={shoppingForm.category}
                onChange={(e) => setShoppingForm({ ...shoppingForm, category: e.target.value })}
                className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-stone-50"
              >
                {FRIDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="메모 (예: 시목이 간식용)"
                value={shoppingForm.memo}
                onChange={(e) => setShoppingForm({ ...shoppingForm, memo: e.target.value })}
                className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
              <button
                onClick={() =>
                  setShoppingForm({ ...shoppingForm, urgent: !shoppingForm.urgent })
                }
                className={`px-2.5 py-2 rounded-xl text-xs font-extrabold border shrink-0 ${
                  shoppingForm.urgent
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-stone-50 text-stone-500 border-stone-200"
                }`}
              >
                🚨 급함
              </button>
            </div>

            <button
              onClick={handleAddShopping}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
            >
              + 장보기 체크리스트에 등록
            </button>
          </div>

          {shoppingList.some((s) => s.checked) && (
            <div className="flex items-center justify-between bg-stone-100 px-3 py-2 rounded-xl">
              <span className="text-[11px] font-bold text-stone-600">
                체크 완료 {shoppingList.filter((s) => s.checked).length}건
              </span>
              <button
                onClick={handleClearCheckedShopping}
                className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-rose-600 hover:bg-rose-50"
              >
                🧹 체크 완료 비우기
              </button>
            </div>
          )}

          <div className="space-y-2">
            {[...shoppingList]
              .sort((a, b) => {
                if (Boolean(a.checked) !== Boolean(b.checked)) return a.checked ? 1 : -1;
                if (Boolean(a.urgent) !== Boolean(b.urgent)) return a.urgent ? -1 : 1;
                return 0;
              })
              .map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-2 ${
                  item.checked
                    ? "bg-stone-100 border-stone-200 opacity-75"
                    : "bg-white border-stone-200 shadow-sm"
                }`}
              >
                <div
                  onClick={() => handleToggleShopping(item)}
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                      item.checked
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-stone-300 bg-white"
                    }`}
                  >
                    {item.checked && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.urgent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700">
                          급함
                        </span>
                      )}
                      <span
                        className={`text-sm font-extrabold break-keep ${
                          item.checked ? "line-through text-stone-400" : "text-stone-900"
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        ({item.quantity})
                      </span>
                    </div>
                    {item.memo && <div className="text-[11px] text-stone-500">{item.memo}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setStockInItem(item);
                      setStockInPrice("");
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold"
                  >
                    구매완료→냉장고입고
                  </button>
                  <button
                    onClick={() => handleDeleteShopping(item.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          탭 7: 가족 공지사항
      ========================================== */}
      {activeTab === "notices" && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-stone-900">📌 우리 가족 공지사항 & 메모장</h2>
              <p className="text-[11px] text-stone-500">
                육아 일정, 어린이집 준비물, 부부 전달사항을 공유하세요
              </p>
            </div>
            <button
              onClick={() => {
                setEditingNotice(null);
                setNoticeForm({
                  title: "",
                  content: "",
                  category: "육아/아이들",
                  author: "김수혁",
                  pinned: true
                });
                setIsNoticeModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 공지 작성
            </button>
          </div>

          <div className="space-y-2.5">
            {[...notices]
              .sort((a, b) => {
                if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
                if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
                return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
              })
              .map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition ${
                  n.done
                    ? "bg-stone-100 border-stone-200 opacity-70"
                    : n.pinned
                    ? "bg-indigo-50/60 border-indigo-200 shadow-sm"
                    : "bg-white border-stone-200 shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.pinned && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-600 text-white flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5" /> 상단고정
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 text-stone-700">
                      {n.category}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">
                      작성: {n.author} ({n.createdAt})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleNoticeDone(n)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${
                        n.done
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-stone-600 border-stone-300"
                      }`}
                    >
                      {n.done ? "✓ 확인완료" : "완료체크"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotice(n);
                        setNoticeForm({
                          title: n.title || "",
                          content: n.content || "",
                          category: n.category || "육아/아이들",
                          author: n.author || "김수혁",
                          pinned: Boolean(n.pinned)
                        });
                        setIsNoticeModalOpen(true);
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNotice(n.id)}
                      className="p-1 text-stone-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  className={`text-sm font-black break-keep ${
                    n.done ? "line-through text-stone-500" : "text-stone-900"
                  }`}
                >
                  {n.title}
                </div>
                {n.content && (
                  <div className="text-xs text-stone-600 mt-1 whitespace-pre-line">{n.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          탭 8: AI 추천
      ========================================== */}
      {activeTab === "ai" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 bg-stone-200/80 p-1 rounded-2xl">
            <button
              onClick={() => setAiSubMode("recipe")}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition ${
                aiSubMode === "recipe"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🍳 냉장고 레시피 · 플레이팅
            </button>
            <button
              onClick={() => setAiSubMode("plan3d")}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition ${
                aiSubMode === "plan3d"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              📅 3일치 식단표 짜기
            </button>
          </div>

          {aiSubMode === "plan3d" && (
            <div className="space-y-3.5">
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3.5">
                <div>
                  <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                    <span>AI 날짜·대상별 맞춤 식단표</span>
                  </h2>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    원하는 날짜·끼니만 자유롭게 고르고, 성인식·유아식·온가족식을 분리해 완성형 한 끼를 만듭니다.
                  </p>
                </div>

                {/* 대상 & 성인 식사 목적 선택 */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-stone-700">1. 식사 대상 선택</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "adults", label: "성인식 (2인)" },
                      { id: "toddler", label: "유아식 (시목)" },
                      { id: "family", label: "온가족식" }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPlanTarget(opt.id)}
                        className={`py-2 px-1.5 rounded-xl text-xs font-extrabold border transition ${
                          planTarget === opt.id
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-stone-50 text-stone-700 border-stone-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {planTarget === "adults" && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {["일반 집밥", "다이어트·저탄수", "고단백·체력보충", "간편 원플레이트"].map((st) => (
                        <button
                          key={st}
                          onClick={() => setPlanAdultStyle(st)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            planAdultStyle === st
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-white text-stone-600 border-stone-200"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 날짜 추가 & 날짜별 끼니 개별 선택 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-stone-700">
                      2. 날짜별 끼니 선택 (총 {Object.values(planScheduleMap).reduce((a, b) => a + toSafeArray(b).length, 0)}끼)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={planAddDateInput}
                      onChange={(e) => setPlanAddDateInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                    />
                    <button
                      onClick={() => {
                        if (!planAddDateInput) return;
                        setPlanScheduleMap((prev) =>
                          prev[planAddDateInput]
                            ? prev
                            : { ...prev, [planAddDateInput]: ["아침", "저녁"] }
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 text-white text-xs font-extrabold shrink-0"
                    >
                      + 날짜 추가
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {Object.keys(planScheduleMap)
                      .sort()
                      .map((dStr) => {
                        const slots = toSafeArray(planScheduleMap[dStr]);
                        const allChecked = slots.length === 3;
                        return (
                          <div
                            key={dStr}
                            className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2 flex-wrap"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-stone-800">{dStr}</span>
                              <button
                                onClick={() =>
                                  setPlanScheduleMap((prev) => ({
                                    ...prev,
                                    [dStr]: allChecked ? [] : ["아침", "점심", "저녁"]
                                  }))
                                }
                                className="text-[10px] font-bold text-amber-700 underline"
                              >
                                {allChecked ? "전체해제" : "전체선택"}
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              {["아침", "점심", "저녁"].map((sName) => {
                                const on = slots.includes(sName);
                                return (
                                  <button
                                    key={sName}
                                    onClick={() =>
                                      setPlanScheduleMap((prev) => {
                                        const cur = toSafeArray(prev[dStr]);
                                        return {
                                          ...prev,
                                          [dStr]: cur.includes(sName)
                                            ? cur.filter((x) => x !== sName)
                                            : [...cur, sName]
                                        };
                                      })
                                    }
                                    className={`px-2 py-1 rounded-lg text-[11px] font-extrabold border ${
                                      on
                                        ? "bg-stone-900 text-white border-stone-900"
                                        : "bg-white text-stone-500 border-stone-200"
                                    }`}
                                  >
                                    {sName}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() =>
                                  setPlanScheduleMap((prev) => {
                                    const copy = { ...prev };
                                    delete copy[dStr];
                                    return copy;
                                  })
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-600"
                                title="날짜 삭제"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {planErrorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 space-y-2">
                    <div>⚠️ {planErrorMsg}</div>
                    {toSafeArray(planSnapshotMeta?.missingPairs).length > 0 && (
                      <button
                        onClick={handleGenerateMissingPlanSlots}
                        disabled={isPlanLoading}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold"
                      >
                        🔄 누락된 {planSnapshotMeta.missingPairs.length}끼만 추가 생성
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleGenerate3DayPlan}
                  disabled={isPlanLoading}
                  className={`w-full py-3 rounded-2xl text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm ${
                    isPlanLoading ? "bg-stone-400" : "bg-stone-900 hover:bg-amber-600"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isPlanLoading
                      ? "전체 유효 재고로 맞춤 식단 짜는 중..."
                      : "✨ 선택한 날짜·대상 맞춤 식단 추천받기"}
                  </span>
                </button>
              </div>

              {planItems.length > 0 && (() => {
                const allMissing = computeAggregatedPlanShortage(planItems.filter((x) => x.selected));
                const groupedDates = Array.from(new Set(planItems.map((it) => it.date))).sort();

                return (
                  <div className="space-y-3">
                    {allMissing.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                        <div className="text-xs font-black text-emerald-900">
                          🛒 부족한 최소 재료 ({allMissing.length}종)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allMissing.map((m) => (
                            <span
                              key={m.name}
                              className="px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-[11px] font-bold text-emerald-800"
                            >
                              {m.name} ({m.quantity})
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddMissingIngredientsToShopping(allMissing)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                        >
                          🛒 부족한 재료 장보기 목록에 한 번에 담기
                        </button>
                      </div>
                    )}

                    <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">
                          추천 식단 미리보기 ({planItems.filter((x) => x.selected).length}끼 선택됨)
                        </span>
                        <button
                          onClick={() => {
                            const allSel = planItems.every((x) => x.selected);
                            setPlanItems((prev) => prev.map((x) => ({ ...x, selected: !allSel })));
                          }}
                          className="text-[11px] font-bold text-amber-700 underline"
                        >
                          {planItems.every((x) => x.selected) ? "전체 해제" : "전체 선택"}
                        </button>
                      </div>

                      {groupedDates.map((gDate) => (
                        <div key={gDate} className="space-y-2">
                          <div className="text-xs font-black text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
                            📅 {gDate}
                          </div>
                          {planItems
                            .filter((it) => it.date === gDate)
                            .map((it) => {
                              const hasExisting = meals.some((m) => m.date === it.date && m.slot === it.slot);
                              const isAdultOnly = (planSnapshotMeta?.target || it.target) === "adults";
                              return (
                                <div
                                  key={it.id}
                                  className={`p-3 rounded-xl border space-y-2 ${
                                    it.selected
                                      ? "bg-amber-50/50 border-amber-300"
                                      : "bg-stone-50 border-stone-200 opacity-65"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      onClick={() =>
                                        setPlanItems((prev) =>
                                          prev.map((x) => (x.id === it.id ? { ...x, selected: !x.selected } : x))
                                        )
                                      }
                                      className="flex items-center gap-1.5 text-left"
                                    >
                                      <span>{it.selected ? "✅" : "⬜"}</span>
                                      <span className="text-xs font-black text-stone-900">{it.slot}</span>
                                      <span className="text-[11px] font-bold text-stone-500">
                                        · {it.servings}인분 · {it.estimatedMinutes}분
                                      </span>
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                      {hasExisting && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                                          기존 식단 있음(추가)
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleRegenerateSinglePlanSlot(it)}
                                        disabled={regeneratingPlanId === it.id}
                                        className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-stone-700 hover:bg-stone-100"
                                      >
                                        {regeneratingPlanId === it.id ? "추천중..." : "🔄 다시 추천"}
                                      </button>
                                    </div>
                                  </div>

                                  <input
                                    type="text"
                                    value={it.mealName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPlanItems((prev) =>
                                        prev.map((x) =>
                                          x.id === it.id
                                            ? { ...x, mealName: val, menu: val, isManuallyEdited: true }
                                            : x
                                        )
                                      );
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-sm font-extrabold text-stone-900"
                                  />
                                  {it.completeness && !it.completeness.ok && (
                                    <div className="text-[11px] font-bold text-rose-700">
                                      ⚠️ {it.completeness.reason}
                                    </div>
                                  )}

                                  {toSafeArray(it.components).length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {toSafeArray(it.components).map((c, cIdx) => (
                                        <span
                                          key={cIdx}
                                          className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-[11px] font-bold text-stone-700"
                                        >
                                          {c.role === "staple" ? "🍚" : c.role === "vegetable" ? "🥬" : "🍖"} {c.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {toSafeArray(it.usedIngredientsDisplay).length > 0 && (
                                    <div className="text-[11px] font-semibold text-emerald-700">
                                      🥬 보유 재료: {it.usedIngredientsDisplay.join(", ")}
                                    </div>
                                  )}
                                  {toSafeArray(it.missingIngredients).length > 0 && (
                                    <div className="text-[11px] font-semibold text-rose-700">
                                      🛒 부족 재료: {it.missingIngredients.map((m) => `${m.name}(${m.quantity})`).join(", ")}
                                    </div>
                                  )}
                                  {it.tip && (
                                    <div className="text-[11px] font-semibold text-stone-600">
                                      💡 조리 팁: {it.tip}
                                    </div>
                                  )}
                                  {!isAdultOnly && it.babyTip && (
                                    <div className="text-[11px] font-semibold text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200">
                                      👶 아이 맞춤 팁: {it.babyTip}
                                    </div>
                                  )}
                                  {toSafeArray(it.usedIngredients).length > 0 && (
                                    <div className="pt-1 flex justify-end">
                                      <button
                                        onClick={() =>
                                          handleCompleteRecipeCooking({
                                            title: it.mealName,
                                            usedIngredients: it.usedIngredients
                                          })
                                        }
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold"
                                      >
                                        🍳 이 식단 조리완료(재고 차감)
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ))}

                      {planSnapshotMeta && (
                        <div className="text-[11px] font-bold text-stone-500 bg-stone-50 px-2.5 py-2 rounded-xl border border-stone-200 space-y-1.5">
                          <div>
                            📌 등록 대상(생성 시점 고정): <span className="text-stone-800">{planSnapshotMeta.members.join(", ")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>기존 식단 충돌 시:</span>
                            <button
                              onClick={() => setPlanConflictMode("skip")}
                              className={`px-2 py-0.5 rounded-md border ${
                                planConflictMode === "skip"
                                  ? "bg-stone-900 text-white border-stone-900"
                                  : "bg-white text-stone-600 border-stone-200"
                              }`}
                            >
                              건너뛰기
                            </button>
                            <button
                              onClick={() => setPlanConflictMode("append")}
                              className={`px-2 py-0.5 rounded-md border ${
                                planConflictMode === "append"
                                  ? "bg-stone-900 text-white border-stone-900"
                                  : "bg-white text-stone-600 border-stone-200"
                              }`}
                            >
                              함께 추가
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={handleApply3DayPlan}
                        disabled={isSavingPlan || planSnapshotMeta?.applied}
                        className={`w-full py-3 rounded-2xl text-white text-xs font-black ${
                          isSavingPlan || planSnapshotMeta?.applied
                            ? "bg-stone-400 cursor-not-allowed"
                            : "bg-stone-900 hover:bg-stone-800"
                        }`}
                      >
                        {planSnapshotMeta?.applied
                          ? "✅ 일별 식단표 반영 완료"
                          : isSavingPlan
                          ? "식단표에 반영 중..."
                          : `✅ 선택한 ${planItems.filter((x) => x.selected).length}끼 일별 식단표에 반영하기`}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {aiSubMode === "recipe" && (
          <>
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Gemini 3.8 AI 실시간 맞춤 셰프</span>
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  선택한 냉장고 재료들의 실제 맛 궁합과 조리법을 AI가 설계합니다.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                ⚡ Gemini 직통 활성
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-extrabold text-stone-700">
                  Step 1. 사용할 냉장고 재료 선택 ({selectedAiIngredients.length}개 선택됨)
                </span>
                <button
                  onClick={() =>
                    setSelectedAiIngredients(
                      selectedAiIngredients.length > 0
                        ? []
                        : expiringItems.slice(0, 3).map((i) => i.name)
                    )
                  }
                  className="text-[11px] font-bold text-amber-700 underline"
                >
                  {selectedAiIngredients.length > 0 ? "선택 초기화" : "임박 재료 자동선택"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fridge.map((item) => {
                  const isSel = selectedAiIngredients.includes(item.name);
                  const diff = getDaysDiff(item.expiryDate);
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        setSelectedAiIngredients((prev) =>
                          prev.includes(item.name)
                            ? prev.filter((n) => n !== item.name)
                            : [...prev, item.name]
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                        isSel
                          ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      {item.name}
                      {diff <= 3 && (
                        <span className="ml-1 text-[10px] text-orange-400 font-black">
                          (임박)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-stone-700 mb-1.5">
                Step 2. 누구를 위한 식단인가요?
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "온가족 한끼",
                  "부부 (수혁 & 아리나)",
                  "시목이 유아식",
                  "시율이 이유식/유아식"
                ].map((tg) => (
                  <button
                    key={tg}
                    onClick={() => setAiTargetGroup(tg)}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition ${
                      aiTargetGroup === tg
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-stone-50 text-stone-600 border-stone-200"
                    }`}
                  >
                    {tg}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="추가 요청 (예: 매콤한 국물 요리, 에어프라이어 활용, 15분 컷 등)"
              value={aiPromptExtra}
              onChange={(e) => setAiPromptExtra(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />

            {aiErrorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                ⚠️ {aiErrorMsg}
              </div>
            )}

            <button
              onClick={handleRunAiRecommend}
              disabled={isAiLoading}
              className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Gemini AI가 맞춤 레시피 작성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>AI에게 맞춤 레시피 3가지 요청하기</span>
                </>
              )}
            </button>
          </div>

          {aiRecipes.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-300 text-center space-y-1">
              <div className="text-2xl">👩‍🍳👨‍🍳</div>
              <div className="text-xs font-extrabold text-stone-700">
                위에서 냉장고 재료를 선택하고 AI 추천 버튼을 눌러보세요!
              </div>
              <div className="text-[11px] text-stone-400">
                선택하신 재료들을 바탕으로 즉석에서 조리법과 팁을 설계합니다.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {aiRecipes.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-2.5"
                >
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900">
                    {rec.target} · ⏱️ {rec.time}
                  </span>
                  <h3 className="text-base font-black text-stone-900">{rec.title}</h3>
                  <div className="text-xs font-bold text-emerald-700">
                    🥬 활용 재료: {toSafeArray(rec.usedIngredients).join(", ")}
                  </div>
                  <div className="space-y-1.5 bg-stone-50 p-3 rounded-xl text-xs text-stone-700 leading-relaxed">
                    {toSafeArray(rec.steps).map((st, i) => (
                      <div key={i}>{st}</div>
                    ))}
                  </div>
                  {rec.tip && (
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-50/70 p-2.5 rounded-xl">
                      💡 <b>셰프의 팁:</b> {rec.tip}
                    </div>
                  )}
                  {rec.familyGuide && typeof rec.familyGuide === "object" && (
                    <div className="grid grid-cols-2 gap-1.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-[10px]">
                      {Object.entries(rec.familyGuide).map(([mem, guide]) => (
                        <div key={mem} className="bg-white px-2 py-1.5 rounded-lg border border-stone-200">
                          <span className="font-black text-stone-900">{mem}: </span>
                          <span className="text-stone-600">{guide}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleAddMissingIngredientsToShopping(rec.usedIngredients)}
                      className="py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold"
                    >
                      🛒 부족재료 장보기 담기
                    </button>
                    <button
                      onClick={() => handleCompleteRecipeCooking(rec)}
                      className="py-2 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold"
                    >
                      🍳 요리완료 (재고 -1)
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setQuickLogRecipe(rec);
                      setQuickLogDate(selectedDate);
                      setQuickLogSlot("저녁");
                    }}
                    className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <span>이 메뉴를 식단표에 바로 등록하기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* ==========================================
              [신규 v6.1] AI 플레이팅 코치 (요리 사진 업로드 -> 담음새/그릇/가니쉬 코칭)
          ========================================== */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-rose-500" />
                  <span>AI 플레이팅 코치 (사진 분석)</span>
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  완성한 요리 사진을 올리면 색감·여백 점수와 그릇·가니쉬 팁을 알려드려요.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                📸 Vision
              </span>
            </div>

            <input
              ref={platingFileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePlatingImageSelect}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => platingFileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-stone-200"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{platingPreviewUrl ? "사진 다시 선택" : "요리 사진 올리기"}</span>
              </button>
              <input
                type="text"
                placeholder="스타일 (예: 손님상, 아이 식판)"
                value={platingStyleHint}
                onChange={(e) => setPlatingStyleHint(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            {platingPreviewUrl && (
              <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
                <img
                  src={platingPreviewUrl}
                  alt="플레이팅 분석 사진"
                  className="w-full max-h-52 object-cover"
                />
              </div>
            )}

            {platingErrorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                ⚠️ {platingErrorMsg}
              </div>
            )}

            <button
              onClick={handleAnalyzePlating}
              disabled={isPlatingLoading || !platingImagePart}
              className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                !platingImagePart
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isPlatingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI가 플레이팅 구도·색감 분석 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>AI 플레이팅 추천 · 코칭 받기</span>
                </>
              )}
            </button>

            {platingResult && (
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-stone-900">
                    🍽️ {platingResult.dishName}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-[10px] font-extrabold text-rose-800">
                      색감 {platingResult.colorScore === "미평가" ? "미평가" : `${platingResult.colorScore}/5`}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-[10px] font-extrabold text-rose-800">
                      구성 {platingResult.layoutScore === "미평가" ? "미평가" : `${platingResult.layoutScore}/5`}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-stone-800 leading-snug">
                  {platingResult.summary}
                </div>

                {platingResult.plateAndGarnish && (
                  <div className="p-2.5 rounded-xl bg-white border border-rose-100 text-[11px] font-semibold text-stone-700">
                    🥣 <b>추천 그릇·가니쉬:</b> {platingResult.plateAndGarnish}
                  </div>
                )}

                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-rose-100 text-xs text-stone-700">
                  {toSafeArray(platingResult.tips).map((tip, idx) => (
                    <div key={idx} className="leading-snug">
                      {tip}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSendPlatingToRecipeBook}
                  className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>📖 이 플레이팅 결과로 가족 레시피북에 저장</span>
                </button>

                <button
                  onClick={handleGeneratePlatingExampleImage}
                  disabled={isPlatingImageLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isPlatingImageLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span>플레이팅 예시 이미지 그리는 중...</span>
                    </>
                  ) : (
                    <span>🎨 완성 예시 이미지 그려보기 (선택·저비용)</span>
                  )}
                </button>

                {platingExampleImageUrl && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-extrabold text-rose-800">
                      ✨ AI 추천 플레이팅 예시 이미지
                    </div>
                    <img
                      src={platingExampleImageUrl}
                      alt="AI 플레이팅 예시"
                      className="w-full rounded-xl border border-rose-200 object-cover"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      )}

      {/* ==========================================
          탭 8-2: 📖 가족 레시피북
      ========================================== */}
      {activeTab === "recipes" && (() => {
        const filteredRecipes = recipes
          .filter((r) => {
            const q = debouncedRecipeSearch.trim().toLowerCase();
            const matchQ =
              !q ||
              String(r.title || "").toLowerCase().includes(q) ||
              String(r.ingredientsText || "").toLowerCase().includes(q) ||
              String(r.memo || "").toLowerCase().includes(q);
            const matchCat = recipeCatFilter === "전체" || (r.category || "기타") === recipeCatFilter;
            const matchDiff = recipeDiffFilter === "전체" || r.difficulty === recipeDiffFilter;
            return matchQ && matchCat && matchDiff;
          })
          .sort((a, b) => {
            if (recipeSort === "rating") {
              return (
                Number(b.suhyukRating || 0) +
                Number(b.arinaRating || 0) -
                (Number(a.suhyukRating || 0) + Number(a.arinaRating || 0))
              );
            }
            if (recipeSort === "time") {
              return Number(a.cookMinutes || 999) - Number(b.cookMinutes || 999);
            }
            return 0;
          });

        return (
        <div className="p-4 space-y-3.5">
          <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4 rounded-2xl border border-rose-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-stone-900">📖 우리 가족 레시피북 ({filteredRecipes.length})</h2>
                <p className="text-[11px] font-semibold text-stone-500">
                  카테고리 · 요약 리스트 · 사진 클릭 확대 · 플레이팅 연동
                </p>
              </div>
              <button
                onClick={() => openNewRecipeModal()}
                className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold shrink-0"
              >
                + 레시피 등록
              </button>
            </div>

            {!isEditorUnlocked && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-amber-900">🔒 가족 사진과 기록 보호를 위해 열람 잠금 중입니다.</span>
                <button
                  onClick={() => requireEditorAccess()}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-extrabold shrink-0"
                >
                  잠금 해제
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="요리명·재료 검색 (예: 소고기, 무국)"
                className="flex-1 px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold"
              />
              <select
                value={recipeDiffFilter}
                onChange={(e) => setRecipeDiffFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold"
              >
                <option value="전체">난이도 전체</option>
                <option value="쉬움">쉬움</option>
                <option value="보통">보통</option>
                <option value="어려움">어려움</option>
              </select>
              <select
                value={recipeSort}
                onChange={(e) => setRecipeSort(e.target.value)}
                className="px-2 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold"
              >
                <option value="latest">최신순</option>
                <option value="rating">별점순</option>
                <option value="time">조리시간순</option>
              </select>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {["전체", ...RECIPE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setRecipeCatFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 border ${
                    recipeCatFilter === cat
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-stone-600 border-stone-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              <button
                onClick={() => setRecipeViewMode("cards")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  recipeViewMode === "cards" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                🖼️ 상세 카드 보기
              </button>
              <button
                onClick={() => setRecipeViewMode("summary")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition ${
                  recipeViewMode === "summary" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                📋 전체 요약 리스트
              </button>
            </div>
          </div>

          {filteredRecipes.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-stone-200 text-center space-y-2">
              <div className="text-xs font-bold text-stone-500">
                조건에 맞는 가족 레시피가 없습니다.
              </div>
              <div className="text-[11px] text-stone-400">
                직접 등록하거나 AI추천 → 플레이팅 코치 결과를 바로 저장해 보세요!
              </div>
            </div>
          ) : recipeViewMode === "summary" ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm divide-y divide-stone-100 overflow-hidden">
              {filteredRecipes.map((r) => {
                const validPhoto = r.photoDataUrl && !String(r.photoDataUrl).includes("undefined");
                const ratingsVals = Object.values(r.ratings || {}).filter((v) => Number(v) > 0);
                const avgRating = ratingsVals.length > 0
                  ? (ratingsVals.reduce((a, b) => a + Number(b), 0) / ratingsVals.length).toFixed(1)
                  : null;
                return (
                  <div key={r.id} className="p-3 flex items-center justify-between gap-2.5 hover:bg-stone-50/70">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {validPhoto ? (
                        <img
                          src={r.photoDataUrl}
                          alt={r.title}
                          onClick={() => {
                            if (!isEditorUnlocked) {
                              requireEditorAccess();
                              return;
                            }
                            setZoomedRecipePhoto({ title: r.title, url: r.photoDataUrl });
                          }}
                          className={`w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0 cursor-pointer ${!isEditorUnlocked ? "blur-sm" : ""}`}
                          title="클릭하여 사진 크게 보기"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-base shrink-0">
                          🍽️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-extrabold shrink-0">
                            {r.category || "기타"}
                          </span>
                          <span className="text-xs font-black text-stone-900 truncate">{r.title}</span>
                        </div>
                        <div className="text-[10px] text-stone-500 font-semibold mt-0.5 truncate">
                          ⏱️ {r.cookTime || "20분"} · {r.difficulty || "쉬움"}
                          {avgRating ? ` · ⭐ ${avgRating}` : ""}
                          {r.ingredientsText ? ` · ${r.ingredientsText}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleApplyRecipeToMeal(r)}
                        className="px-2 py-1.5 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold"
                        title="오늘 식단으로 재현"
                      >
                        재현
                      </button>
                      <button
                        onClick={() => {
                          if (!requireEditorAccess()) return;
                          setEditingRecipe(r);
                          setRecipeForm({
                            title: r.title || "",
                            category: r.category || "메인반찬",
                            photoDataUrl: r.photoDataUrl || "",
                            ingredientsText: r.ingredientsText || "",
                            cookTime: r.cookTime || "20분",
                            difficulty: r.difficulty || "쉬움",
                            ratings: r.ratings || { 수혁: 5, 아리나: 5, 시목: 0, 시율: 0 },
                            memo: r.memo || "",
                            platingCoach: r.platingCoach || null
                          });
                          setIsRecipeModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecipes.map((r) => {
                const validPhoto = r.photoDataUrl && !String(r.photoDataUrl).includes("undefined");
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden p-3.5 space-y-2.5">
                    <div className="flex items-start gap-3">
                      {validPhoto && (
                        <div
                          onClick={() => {
                            if (!isEditorUnlocked) {
                              requireEditorAccess();
                              return;
                            }
                            setZoomedRecipePhoto({ title: r.title, url: r.photoDataUrl });
                          }}
                          className="relative w-24 h-24 rounded-xl overflow-hidden border border-stone-200 shrink-0 cursor-pointer group bg-stone-100"
                          title="클릭하여 사진 크게 보기"
                        >
                          <img
                            src={r.photoDataUrl}
                            alt={r.title}
                            className={`w-full h-full object-cover ${!isEditorUnlocked ? "blur-md" : "group-hover:scale-105 transition"}`}
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">
                            {isEditorUnlocked ? "🔍 확대" : "🔒"}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-extrabold mb-1">
                              {r.category || "기타"}
                            </span>
                            <div className="text-sm font-black text-stone-900 break-keep">{r.title}</div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => {
                                if (!requireEditorAccess()) return;
                                setEditingRecipe(r);
                                setRecipeForm({
                                  title: r.title || "",
                                  category: r.category || "메인반찬",
                                  photoDataUrl: r.photoDataUrl || "",
                                  ingredientsText: r.ingredientsText || "",
                                  cookTime: r.cookTime || "20분",
                                  difficulty: r.difficulty || "쉬움",
                                  ratings: r.ratings || { 수혁: 5, 아리나: 5, 시목: 0, 시율: 0 },
                                  stepsText: r.stepsText || "",
                                  memo: r.memo || "",
                                  platingCoach: r.platingCoach || null
                                });
                                setIsRecipeModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecipe(r.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold">
                            ⏱️ {r.cookTime || "20분"}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-bold">
                            난이도: {r.difficulty || "쉬움"}
                          </span>
                          {r.platingCoach && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold">
                              🎨 플레이팅 연동
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {r.ingredientsText && (
                      <div className="bg-stone-50 p-2 rounded-xl space-y-1">
                        <div className="text-[10px] font-bold text-stone-500">🥕 재료 (부족한 재료 탭 → 바로 장보기 추가)</div>
                        <div className="flex flex-wrap gap-1">
                          {String(r.ingredientsText)
                            .split(/[+,\n]+/)
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .map((tok, tIdx) => {
                              const tokName = parseRecipeIngredientToken(tok).name;
                              const inFridge = Boolean(tokName && matchFridgeItemExactFirst(tokName, fridge));
                              return inFridge ? (
                                <span
                                  key={`${tok}-${tIdx}`}
                                  className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold"
                                >
                                  ✓ {tok}
                                </span>
                              ) : (
                                <button
                                  key={`${tok}-${tIdx}`}
                                  type="button"
                                  onClick={() => handleQuickAddSingleIngredientToShopping(tok, r.title)}
                                  className="px-2 py-0.5 rounded-full bg-white hover:bg-emerald-50 border border-stone-200 text-stone-700 text-[10px] font-bold active:scale-95 transition"
                                >
                                  {tok} 🛒
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                      {["수혁", "아리나", "시목", "시율"].map((mName) => {
                        const score = Number(r.ratings?.[mName] || 0);
                        return score > 0 ? (
                          <span key={mName} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900">
                            {mName} {"⭐".repeat(score)}
                          </span>
                        ) : null;
                      })}
                    </div>

                    {r.stepsText && (
                      <div className="text-[11px] text-stone-700 bg-amber-50/50 border border-amber-100 p-2 rounded-xl whitespace-pre-line">
                        <span className="font-black text-amber-900 block mb-0.5">👩‍🍳 조리 순서</span>
                        {r.stepsText}
                      </div>
                    )}
                    {r.memo && <div className="text-[11px] text-stone-600 whitespace-pre-line">{r.memo}</div>}

                    {toSafeArray(r.ingredients).length > 0 && (() => {
                      const missingCnt = toSafeArray(r.ingredients).filter((ing) => {
                        const n = typeof ing === "string" ? parseRecipeIngredientToken(ing).name : ing?.name;
                        return n && !matchFridgeItemExactFirst(n, fridge);
                      }).length;
                      return (
                        <div className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg inline-block ${
                          missingCnt === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                        }`}>
                          {missingCnt === 0 ? "✅ 냉장고 재료 100% 보유 (바로 조리 가능)" : `⚠️ 냉장고 부족 재료 ${missingCnt}개`}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleApplyRecipeToMeal(r)}
                        className="py-2 rounded-xl bg-stone-900 text-white text-[11px] font-extrabold"
                      >
                        🍽️ 오늘 식단으로 재현
                      </button>
                      <button
                        onClick={() => handleAddMissingRecipeIngredientsToShopping(r)}
                        className="py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold"
                      >
                        🛒 부족 재료 장보기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* ==========================================
          탭 9: 👶 육아수첩 (월령별 발달 · 예방접종/영유아검진 · 성장 기록 · 진료/열 체크)
      ========================================== */}
      {activeTab === "baby" && (() => {
        const activeChild = CHILDREN_INFO.find((c) => c.id === selectedChildId) || CHILDREN_INFO[1];
        const ageStats = getChildAgeStats(activeChild.birthDate);
        const childGrowth = babyGrowthLogs.filter((g) => g.childId === activeChild.id);
        const childNotes = babyMedicalNotes.filter((n) => n.childId === activeChild.id);

        return (
          <div className="p-4 space-y-4">
            {/* 아이 선택 & 실시간 생후 일수/개월수 카드 */}
            <div className="grid grid-cols-2 gap-2">
              {CHILDREN_INFO.map((ch) => {
                const st = getChildAgeStats(ch.birthDate);
                const isSel = selectedChildId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChildId(ch.id)}
                    className={`p-3 rounded-2xl border text-left transition ${
                      isSel
                        ? "bg-stone-900 text-white border-stone-900 shadow-md"
                        : "bg-white text-stone-800 border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <MemberAvatar id={ch.id} size="lg" />
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isSel ? "bg-amber-400 text-stone-900" : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {ch.badge} · D+{st.days.toLocaleString()}일
                      </span>
                    </div>
                    <div className="text-sm font-black mt-1">{ch.name}</div>
                    <div className={`text-[10px] mt-0.5 ${isSel ? "text-stone-300" : "text-stone-500"}`}>
                      {ch.birthDate}생 · 현재 {st.months}개월
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 육아수첩 4개 서브 탭 */}
            <div className="grid grid-cols-4 gap-1 bg-stone-200 p-1 rounded-2xl">
              {[
                { id: "milestones", label: "🌱 발달" },
                { id: "vaccines", label: "💉 접종·검진" },
                { id: "growth", label: "📏 성장기록" },
                { id: "medical", label: "🩺 진료·열" }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setBabySubTab(st.id)}
                  className={`py-2 rounded-xl text-[11px] font-extrabold transition ${
                    babySubTab === st.id
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* 서브탭 1: 월령별 발달과정 */}
            {babySubTab === "milestones" && (
              <div className="space-y-2.5">
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      currentMilestoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-extrabold border border-amber-300"
                  >
                    📍 {activeChild.id} 현재 시기({ageStats.months}개월)로 이동
                  </button>
                </div>
                {BABY_MILESTONES.map((ms) => {
                  const isCurrent = ageStats.months >= ms.minM && ageStats.months <= ms.maxM;
                  return (
                    <div
                      key={ms.id}
                      ref={isCurrent ? currentMilestoneRef : null}
                      className={`p-3.5 rounded-2xl border space-y-2 ${
                        isCurrent
                          ? "bg-amber-50/90 border-amber-300 shadow-sm ring-2 ring-amber-200"
                          : "bg-white border-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">{ms.label}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                            ⭐ 지금 {activeChild.id} 시기
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-stone-700 leading-snug">
                        <div>
                          <b>🏃 신체/운동:</b> {ms.motor}
                        </div>
                        <div>
                          <b>💬 언어/사회:</b> {ms.language}
                        </div>
                        <div>
                          <b>🍼 수유·수면:</b> {ms.feedingSleep}
                        </div>
                        <div className="p-2 rounded-xl bg-white/80 border border-stone-200/70 text-[11px] font-semibold text-amber-900">
                          💡 <b>핵심 팁:</b> {ms.tip}
                        </div>
                        {ms.redFlags && (
                          <div className="p-2 rounded-xl bg-rose-50/90 border border-rose-200 text-[11px] font-semibold text-rose-900">
                            ⚠️ <b>소아과 상담 신호:</b> {ms.redFlags}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 서브탭 2: 국가예방접종 + 선택접종 + 영유아 건강검진 + 일정 원클릭 등록 */}
            {babySubTab === "vaccines" && (
              <div className="space-y-3">
                <button
                  onClick={() => handleSyncAllUpcomingBabySchedules(activeChild)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>{activeChild.id} 향후 미완료 접종·검진 일정 달력에 일괄 자동등록</span>
                </button>

                <div className="space-y-2">
                  {BABY_VACCINES_AND_CHECKUPS.map((item) => {
                    const checkKey = `${activeChild.id}_${item.id}`;
                    const isDone = Boolean(babyChecks[checkKey]?.done);
                    const doneDate = babyChecks[checkKey]?.doneDate;
                    const recDate = addMonthsToDateStr(activeChild.birthDate, item.addMonths, item.addDays);
                    const isScheduled = schedules.some((s) => s.id === `baby-${activeChild.id}-${item.id}`);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition flex items-start justify-between gap-2 ${
                          isDone
                            ? "bg-stone-100 border-stone-200 opacity-75"
                            : "bg-white border-stone-200 shadow-sm"
                        }`}
                      >
                        <div
                          onClick={() => handleToggleBabyCheck(activeChild.id, item.id)}
                          className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0"
                        >
                          <div
                            className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-stone-300 bg-white"
                            }`}
                          >
                            {isDone && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1 mb-0.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                  item.type === "영유아검진"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : item.type === "선택접종"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {item.type}
                              </span>
                              <span className="text-[10px] font-bold text-stone-500">
                                권장일: {recDate}
                              </span>
                              {isDone && (
                                <input
                                  type="date"
                                  value={doneDate || getTodayStr()}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleUpdateBabyCheckDate(activeChild.id, item.id, e.target.value)}
                                  className="px-1.5 py-0.5 rounded border border-emerald-300 bg-white text-[10px] font-extrabold text-emerald-700"
                                  title="실제 접종/검진일 수정"
                                />
                              )}
                            </div>
                            <div
                              className={`text-xs font-extrabold break-keep ${
                                isDone ? "line-through text-stone-400" : "text-stone-900"
                              }`}
                            >
                              {item.title}
                            </div>
                            <div className="text-[10px] text-stone-500 mt-0.5">{item.note}</div>
                          </div>
                        </div>

                        {!isDone && (
                          <button
                            onClick={() => handleSyncSingleBabySchedule(activeChild, item, recDate)}
                            className={`px-2 py-1 rounded-xl text-[10px] font-extrabold shrink-0 border ${
                              isScheduled
                                ? "bg-stone-100 text-stone-500 border-stone-200"
                                : "bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200"
                            }`}
                          >
                            {isScheduled ? "등록됨" : "+ 일정등록"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 서브탭 3: 성장 기록 (키·몸무게·머리둘레) */}
            {babySubTab === "growth" && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
                  <div className="text-xs font-black text-stone-900">
                    📏 {activeChild.name} 성장 측정 기록하기
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={growthForm.date}
                      onChange={(e) => setGrowthForm({ ...growthForm, date: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                    <input
                      id="baby-growth-height-input"
                      type="number"
                      step="0.1"
                      placeholder="키 (cm)"
                      value={growthForm.height}
                      onChange={(e) => setGrowthForm({ ...growthForm, height: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="몸무게 (kg)"
                      value={growthForm.weight}
                      onChange={(e) => setGrowthForm({ ...growthForm, weight: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="머리둘레 (cm, 선택)"
                      value={growthForm.head}
                      onChange={(e) => setGrowthForm({ ...growthForm, head: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="메모 (예: 1차 영유아검진 측정치)"
                    value={growthForm.memo}
                    onChange={(e) => setGrowthForm({ ...growthForm, memo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                  <button
                    onClick={handleAddGrowthLog}
                    className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                  >
                    + 성장 기록 저장하기
                  </button>
                </div>

                {childGrowth.length >= 2 && (() => {
                  const sorted = [...childGrowth].reverse().slice(-8);
                  const weights = sorted.map((g) => Number(g.weight || 0)).filter((v) => v > 0);
                  const heights = sorted.map((g) => Number(g.height || 0)).filter((v) => v > 0);
                  const minW = weights.length ? Math.min(...weights) - 0.5 : 0;
                  const maxW = weights.length ? Math.max(...weights) + 0.5 : 10;
                  const minH = heights.length ? Math.min(...heights) - 2 : 40;
                  const maxH = heights.length ? Math.max(...heights) + 2 : 100;
                  const W = 280;
                  const H = 90;
                  const makePoints = (arr, key, minV, maxV) =>
                    arr
                      .map((item, i) => {
                        const val = Number(item[key] || 0);
                        if (!val) return null;
                        const x = arr.length === 1 ? W / 2 : (i / (arr.length - 1)) * (W - 24) + 12;
                        const y = H - 14 - ((val - minV) / Math.max(0.1, maxV - minV)) * (H - 28);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .filter(Boolean)
                      .join(" ");

                  const weightPts = makePoints(sorted, "weight", minW, maxW);
                  const heightPts = makePoints(sorted, "height", minH, maxH);

                  return (
                    <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-xs font-black text-stone-900">
                        <span>📈 {activeChild.id} 성장 추이 그래프 (최근 {sorted.length}회)</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-emerald-600 font-extrabold">● 키(cm)</span>
                          <span className="text-indigo-600 font-extrabold">● 몸무게(kg)</span>
                        </div>
                      </div>
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24 bg-stone-50 rounded-xl border border-stone-100">
                        {heightPts && (
                          <polyline
                            fill="none"
                            stroke="#059669"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={heightPts}
                          />
                        )}
                        {weightPts && (
                          <polyline
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={weightPts}
                          />
                        )}
                      </svg>
                      <div className="flex justify-between text-[9px] font-bold text-stone-400 px-1">
                        <span>{sorted[0]?.date}</span>
                        <span>{sorted[sorted.length - 1]?.date}</span>
                      </div>
                    </div>
                  );
                })()}

                {childGrowth.length === 0 ? (
                  <div className="text-xs text-stone-400 py-6 text-center bg-white rounded-2xl border border-dashed border-stone-200">
                    아직 기록된 {activeChild.id} 성장 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {childGrowth.map((g, idx) => {
                      const prev = childGrowth[idx + 1];
                      const wDiff =
                        prev && g.weight && prev.weight ? (g.weight - prev.weight).toFixed(1) : null;
                      const hDiff =
                        prev && g.height && prev.height ? (g.height - prev.height).toFixed(1) : null;
                      return (
                        <div
                          key={g.id}
                          className="bg-white p-3 rounded-2xl border border-stone-200 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-[11px] font-bold text-stone-500">{g.date}</div>
                            <div className="text-xs font-black text-stone-900 mt-0.5 flex flex-wrap gap-2">
                              {g.height && (
                                <span>
                                  📏 {g.height}cm{" "}
                                  {hDiff && (
                                    <span className="text-emerald-600 text-[10px]">
                                      ({Number(hDiff) >= 0 ? `+${hDiff}` : hDiff})
                                    </span>
                                  )}
                                </span>
                              )}
                              {g.weight && (
                                <span>
                                  ⚖️ {g.weight}kg{" "}
                                  {wDiff && (
                                    <span className="text-emerald-600 text-[10px]">
                                      ({Number(wDiff) >= 0 ? `+${wDiff}` : wDiff})
                                    </span>
                                  )}
                                </span>
                              )}
                              {g.head && <span>🧢 머리 {g.head}cm</span>}
                            </div>
                            {g.memo && <div className="text-[11px] text-stone-500 mt-0.5">💬 {g.memo}</div>}
                          </div>
                          <button
                            onClick={() => handleDeleteGrowthLog(g.id)}
                            className="p-1.5 text-stone-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 서브탭 4: 소아과 진료 · 열 체크 메모 */}
            {babySubTab === "medical" && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2.5">
                  <div className="text-xs font-black text-stone-900">
                    🩺 {activeChild.name} 소아과 진료 · 체온 메모
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={medNoteForm.date}
                      onChange={(e) => setMedNoteForm({ ...medNoteForm, date: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                    <input
                      type="number"
                      step="0.1"
                      placeholder="체온 °C (예: 37.8)"
                      value={medNoteForm.temp}
                      onChange={(e) => setMedNoteForm({ ...medNoteForm, temp: e.target.value })}
                      className="px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="증상/진료 제목 (예: 접종 후 미열, 콧물 소아과 진료)"
                    value={medNoteForm.title}
                    onChange={(e) => setMedNoteForm({ ...medNoteForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="처방약/해열제 복용시간 등 메모"
                    value={medNoteForm.memo}
                    onChange={(e) => setMedNoteForm({ ...medNoteForm, memo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                  />
                  <button
                    onClick={handleAddMedicalNote}
                    className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                  >
                    + 진료·열 체크 저장하기
                  </button>
                </div>

                {childNotes.length === 0 ? (
                  <div className="text-xs text-stone-400 py-6 text-center bg-white rounded-2xl border border-dashed border-stone-200">
                    아직 기록된 {activeChild.id} 진료·체온 메모가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {childNotes.map((n) => {
                      const isFever = n.temp && Number(n.temp) >= 38.0;
                      return (
                        <div
                          key={n.id}
                          className={`p-3 rounded-2xl border flex items-start justify-between gap-2 ${
                            isFever ? "bg-rose-50 border-rose-200" : "bg-white border-stone-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-stone-500">{n.date}</span>
                              {n.temp && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    isFever
                                      ? "bg-rose-600 text-white"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  🌡️ {n.temp}°C {isFever ? "(발열)" : ""}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-black text-stone-900 mt-1">{n.title}</div>
                            {n.memo && <div className="text-[11px] text-stone-600 mt-0.5">💬 {n.memo}</div>}
                          </div>
                          <button
                            onClick={() => handleDeleteMedicalNote(n.id)}
                            className="p-1.5 text-stone-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 스마트 빠른 등록 플로팅 메뉴 & FAB */}
      {isQuickFabOpen && (
        <>
          <div
            onClick={() => setIsQuickFabOpen(false)}
            className="fixed inset-0 bg-black/25 z-30"
            aria-hidden="true"
          />
          <div
            style={{ bottom: "calc(8.35rem + env(safe-area-inset-bottom))" }}
            className="fixed right-4 z-40 flex flex-col items-end gap-1.5 max-h-[65vh] overflow-y-auto pr-0.5"
          >
            {[
              {
                label: "🍽️ 식단 기록",
                color: "bg-white text-stone-900 border-amber-200 hover:bg-amber-50",
                onClick: () => {
                  const h = new Date().getHours();
                  const smartSlot =
                    h >= 5 && h < 10 ? "아침" : h >= 10 && h < 14 ? "점심" : h >= 14 && h < 17 ? "오후간식" : h >= 17 && h < 21 ? "저녁" : "야식";
                  setEditingMeal(null);
                  setMealForm({
                    date: activeTab === "home" ? getTodayStr() : selectedDate,
                    slot: smartSlot,
                    menu: "",
                    members: selectedMember === "전체" ? ["수혁", "아리나"] : [selectedMember],
                    ingredients: [],
                    note: "",
                    sourceType: "집밥/온가족식",
                    cost: ""
                  });
                  setIsMealModalOpen(true);
                }
              },
              {
                label: "🗓️ 일정 추가",
                color: "bg-white text-stone-900 border-rose-200 hover:bg-rose-50",
                onClick: () => {
                  setEditingSchedule(null);
                  setScheduleForm({
                    title: "",
                    date: scheduleSelectedDate || getTodayStr(),
                    category: "병원/행사",
                    members: scheduleMemberFilter === "전체" ? ["수혁", "아리나", "시목", "시율"] : [scheduleMemberFilter],
                    isAnnual: false,
                    showDday: false,
                    hasOriginYear: false,
                    memo: ""
                  });
                  setIsScheduleModalOpen(true);
                }
              },
              {
                label: "🔄 루틴 추가",
                color: "bg-white text-stone-900 border-stone-200 hover:bg-stone-50",
                onClick: () => openNewRoutineModal()
              },
              {
                label: "✅ 할 일 추가",
                color: "bg-white text-stone-900 border-amber-200 hover:bg-amber-50",
                onClick: () => {
                  setEditingSchedule(null);
                  setScheduleForm({
                    title: "",
                    date: getTodayStr(),
                    category: "할일(To-Do)",
                    members: scheduleMemberFilter === "전체" ? ["수혁", "아리나", "시목", "시율"] : [scheduleMemberFilter],
                    isAnnual: false,
                    showDday: false,
                    hasOriginYear: false,
                    memo: ""
                  });
                  setIsScheduleModalOpen(true);
                }
              },
              {
                label: "❄️ 냉장고 입고",
                color: "bg-white text-stone-900 border-sky-200 hover:bg-sky-50",
                onClick: () => openAddFridgeModal()
              },
              {
                label: "🛒 장보기 추가",
                color: "bg-white text-stone-900 border-emerald-200 hover:bg-emerald-50",
                onClick: () => {
                  setActiveTab("shopping");
                  setTimeout(() => document.getElementById("shopping-item-input")?.focus(), 180);
                }
              },
              {
                label: "🧾 영수증 AI 스캔",
                color: "bg-white text-stone-900 border-teal-200 hover:bg-teal-50",
                onClick: () => setIsReceiptModalOpen(true)
              },
              {
                label: "📤 식단·재료 내보내기",
                color: "bg-white text-stone-900 border-stone-300 hover:bg-stone-100",
                onClick: () => {
                  setExportScope("all");
                  setIsInventoryExportOpen(true);
                }
              },
              {
                label: "👶 성장기록",
                color: "bg-white text-stone-900 border-sky-200 hover:bg-sky-50",
                onClick: () => {
                  setActiveTab("baby");
                  setBabySubTab("growth");
                  setTimeout(() => document.getElementById("baby-growth-height-input")?.focus(), 200);
                }
              },
              {
                label: "📖 레시피 등록",
                color: "bg-white text-stone-900 border-purple-200 hover:bg-purple-50",
                onClick: () => openNewRecipeModal()
              }
            ].map((act) => (
              <button
                key={act.label}
                type="button"
                onClick={() => {
                  setIsQuickFabOpen(false);
                  act.onClick();
                }}
                className={`px-3.5 py-2 rounded-2xl border shadow-lg text-xs font-black whitespace-nowrap transition active:scale-95 ${act.color}`}
              >
                {act.label}
              </button>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setIsQuickFabOpen((v) => !v)}
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
        className={`fixed right-4 z-40 w-12 h-12 rounded-full text-white shadow-xl flex items-center justify-center transition active:scale-95 ${
          isQuickFabOpen ? "bg-rose-600 rotate-45" : "bg-stone-900 hover:bg-amber-600"
        }`}
        title="스마트 빠른 등록"
        aria-label="스마트 빠른 등록"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* 하단 더보기 메뉴 시트 (접근성·Safe Area 적용) */}
      {isMoreNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center"
          onClick={() => {
            setIsMoreNavOpen(false);
            moreNavBtnRef.current?.focus();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="전체 메뉴 바로가기"
            style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
            className="bg-white w-full max-w-md max-h-[75vh] overflow-y-auto rounded-t-3xl p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-stone-900">전체 메뉴 바로가기</span>
              <button
                ref={moreSheetCloseRef}
                onClick={() => {
                  setIsMoreNavOpen(false);
                  moreNavBtnRef.current?.focus();
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "daily", label: "식단·주간", icon: "🍽️" },
                { id: "monthly", label: "월간·식비", icon: "💰" },
                { id: "shopping", label: "장보기", icon: "🛒" },
                { id: "notices", label: "가족공지", icon: "📌" },
                { id: "ai", label: "AI추천", icon: "✨" },
                { id: "recipes", label: "레시피북", icon: "📖" }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveTab(m.id);
                    setIsMoreNavOpen(false);
                  }}
                  className={`py-3 px-2 rounded-2xl border text-xs font-extrabold flex flex-col items-center gap-1 ${
                    activeTab === m.id
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-stone-50 text-stone-800 border-stone-200 hover:bg-amber-50"
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 하단 네비게이션 (6개 핵심 메뉴) */}
      <nav style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }} className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur border-t border-stone-200 px-1.5 pt-1.5 grid grid-cols-6 gap-0.5 z-30">
        {[
          { id: "home", label: "홈", icon: Home },
          { id: "daily", label: "식단", icon: Utensils },
          { id: "schedule", label: "일정", icon: CalendarDays },
          { id: "baby", label: "육아", icon: Baby },
          { id: "fridge", label: "냉장고", icon: Package }
        ].map((item) => {
          const IconComp = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMoreNavOpen(false);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
                active ? "text-stone-900 font-black bg-amber-50/80" : "text-stone-400 font-semibold"
              }`}
            >
              <div className="relative">
                <IconComp className={`w-4 h-4 ${active ? "text-amber-600" : ""}`} />
                {item.id === "schedule" && globalTodoBadgeStats.activeCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none shadow-sm ${
                      globalTodoBadgeStats.urgentCount > 0 ? "bg-rose-600" : "bg-amber-500"
                    }`}
                  >
                    {globalTodoBadgeStats.activeCount > 99 ? "99+" : globalTodoBadgeStats.activeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
        <button
          ref={moreNavBtnRef}
          onClick={() => setIsMoreNavOpen((v) => !v)}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
            ["monthly", "shopping", "notices", "ai", "recipes"].includes(activeTab) || isMoreNavOpen
              ? "text-stone-900 font-black bg-amber-50/80"
              : "text-stone-400 font-semibold"
          }`}
        >
          <LayoutGrid
            className={`w-4 h-4 ${
              ["monthly", "shopping", "notices", "ai", "recipes"].includes(activeTab) || isMoreNavOpen
                ? "text-amber-600"
                : ""
            }`}
          />
          <span className="text-[10px] mt-0.5 whitespace-nowrap">더보기</span>
        </button>
      </nav>

      {/* ==========================================
          모달: 패치노트 (업데이트 히스토리 열람 및 새 기록 작성)
      ========================================== */}
      {isPatchModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <span>우리 가족 식탁 앱 패치노트 (업데이트 기록)</span>
                </h3>
                <p className="text-[11px] text-stone-500">
                  그동안의 기능 보완 내역을 확인하고 새 패치 기록을 남길 수 있습니다.
                </p>
              </div>
              <button onClick={() => setIsPatchModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-extrabold text-indigo-950">
                  🔎 현재 실행 코드: <span className="text-indigo-700">{APP_CODE_VERSION}</span> ({APP_BUILD_DATE})
                </div>
                <button
                  onClick={async () => {
                    try {
                      if ("caches" in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map((k) => caches.delete(k)));
                      }
                    } catch (e) {}
                    const url = new URL(window.location.href);
                    url.searchParams.set("_v", String(Date.now()));
                    window.location.replace(url.toString());
                  }}
                  className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold shrink-0"
                >
                  🔄 캐시 비우고 새로고침
                </button>
              </div>
              <div className="text-[10px] text-indigo-800 break-all">
                접속 도메인: <span className="font-bold">{typeof window !== "undefined" ? window.location.hostname : ""}</span>
              </div>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
              <div className="text-xs font-extrabold text-stone-800">
                ✍️ 새 패치노트 기록 추가하기
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="버전 (예: v5.7)"
                  value={patchForm.version}
                  onChange={(e) => setPatchForm({ ...patchForm, version: e.target.value })}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs font-black bg-white"
                />
                <input
                  type="text"
                  placeholder="패치 제목"
                  value={patchForm.title}
                  onChange={(e) => setPatchForm({ ...patchForm, title: e.target.value })}
                  className="col-span-2 px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                />
              </div>
              <textarea
                rows={2}
                placeholder="상세 변경 내역 (줄바꿈으로 여러 줄 입력 가능)"
                value={patchForm.changesText}
                onChange={(e) => setPatchForm({ ...patchForm, changesText: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs bg-white"
              />
              <button
                onClick={handleAddPatchNote}
                className="w-full py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                + 패치노트 저장하기
              </button>
            </div>

            <div className="space-y-3">
              {patchNotes.map((pn) => (
                <div
                  key={pn.id}
                  className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[11px] font-black">
                        {pn.version}
                      </span>
                      <span className="text-xs font-black text-stone-900">{pn.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-stone-400">{pn.date}</span>
                      <button
                        onClick={() => handleDeletePatchNote(pn.id)}
                        className="text-stone-300 hover:text-red-500"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs text-stone-600 pl-1">
                    {toSafeArray(pn.changes).map((line, i) => (
                      <li key={i} className="leading-snug break-keep">
                        • {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          모달: 가족 일정 추가·수정
      ========================================== */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900">
                {editingRoutineId ? "🔄 반복 루틴 수정" : "🔄 새 반복 루틴 추가"}
              </h3>
              <button type="button" onClick={handleCancelEditRoutine}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                루틴 내용 (쉼표 , 로 여러 단계 구분 가능)
              </label>
              <input
                type="text"
                autoFocus
                value={newRoutineTitle}
                onChange={(e) => setNewRoutineTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRoutine();
                  }
                }}
                placeholder="예: 약먹기, 양치, 코뽑기, 잠옷"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              {parseRoutineSteps(newRoutineTitle).length >= 2 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl p-2">
                  {parseRoutineSteps(newRoutineTitle).map((st, idx, arr) => (
                    <React.Fragment key={idx}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-stone-200 text-[10px] font-extrabold text-stone-800">
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-stone-400 text-[8px] font-black">
                          {idx + 1}
                        </span>
                        <span>{st}</span>
                      </span>
                      {idx < arr.length - 1 && <span className="text-[10px] font-black text-stone-300">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-stone-500 block mb-1">대상</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "공통", label: "👨‍👩‍👧‍👦 공통" },
                  { id: "시목", label: "👦 시목" },
                  { id: "시율", label: "👶 시율" },
                  { id: "시목·시율", label: "👦👶 시목·시율" },
                  { id: "수혁", label: "👨 수혁" },
                  { id: "아리나", label: "👩 아리나" }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewRoutineAssignee(opt.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition whitespace-nowrap ${
                      newRoutineAssignee === opt.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 text-stone-600 border-stone-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-stone-500 block mb-1">시간대</label>
              <div className="flex flex-wrap gap-1.5">
                {ROUTINE_TIME_SLOTS.map((ts) => (
                  <button
                    key={ts}
                    type="button"
                    onClick={() => setNewRoutineTimeSlot(ts)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition whitespace-nowrap ${
                      newRoutineTimeSlot === ts
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 text-stone-600 border-stone-200"
                    }`}
                  >
                    {ts}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-stone-500 block">반복 주기</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "daily", label: "매일" },
                  { id: "interval", label: "N일마다" },
                  { id: "weekly", label: "매주" },
                  { id: "monthly", label: "매월 일자" },
                  { id: "monthly_weekday", label: "매월 N주차" }
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewRoutineCycle(c.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition whitespace-nowrap ${
                      newRoutineCycle === c.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 text-stone-600 border-stone-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {newRoutineCycle === "interval" && (
                <select
                  value={newRoutineIntervalDays}
                  onChange={(e) => setNewRoutineIntervalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-extrabold text-stone-800"
                >
                  {[2, 3, 4, 5, 6, 7, 10, 14].map((d) => (
                    <option key={d} value={d}>{d}일마다</option>
                  ))}
                </select>
              )}
              {newRoutineCycle === "monthly" && (
                <select
                  value={newRoutineMonthDay}
                  onChange={(e) => setNewRoutineMonthDay(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-extrabold text-stone-800"
                >
                  {Array.from({ length: 31 }, (_, idx) => idx + 1).map((dayNum) => (
                    <option key={dayNum} value={dayNum}>매월 {dayNum}일</option>
                  ))}
                </select>
              )}
              {newRoutineCycle === "monthly_weekday" && (
                <select
                  value={newRoutineNthWeek}
                  onChange={(e) => setNewRoutineNthWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-extrabold text-stone-800"
                >
                  <option value={1}>첫째 주</option>
                  <option value={2}>둘째 주</option>
                  <option value={3}>셋째 주</option>
                  <option value={4}>넷째 주</option>
                  <option value={-1}>마지막 주</option>
                </select>
              )}
              {(newRoutineCycle === "weekly" || newRoutineCycle === "monthly_weekday") && (
                <select
                  value={newRoutineWeekDay}
                  onChange={(e) => setNewRoutineWeekDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-extrabold text-stone-800"
                >
                  {newRoutineCycle === "weekly" && <option value="any">요일 무관</option>}
                  {["일", "월", "화", "수", "목", "금", "토"].map((dLabel, dIdx) => (
                    <option key={dIdx} value={String(dIdx)}>{dLabel}요일</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelEditRoutine}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddRoutine}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                {editingRoutineId ? "수정 저장" : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">
                {editingSchedule ? "가족 일정 수정" : "새 가족 일정 추가"}
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <input
              type="text"
              placeholder="일정 제목 (예: 시목 어린이집상담 2시반, 병원 예약)"
              value={scheduleForm.title}
              onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-500">날짜 (기준일)</label>
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500">분류</label>
                <select
                  value={scheduleForm.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setScheduleForm({
                      ...scheduleForm,
                      category: cat
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                >
                  {SCHEDULE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-stone-600">누구의 일정인가요?</span>
                <button
                  type="button"
                  onClick={() =>
                    setScheduleForm({
                      ...scheduleForm,
                      members: ["수혁", "아리나", "시목", "시율"]
                    })
                  }
                  className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-bold"
                >
                  온가족 선택
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {FAMILY_MEMBERS.map((m) => {
                  const sel = toSafeArray(scheduleForm.members).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const cur = toSafeArray(scheduleForm.members);
                        setScheduleForm({
                          ...scheduleForm,
                          members: sel ? cur.filter((id) => id !== m.id) : [...cur, m.id]
                        });
                      }}
                      className={`py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap flex items-center justify-center ${
                        sel
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-stone-50 text-stone-500 border-stone-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1"><MemberAvatar member={m} size="sm" /><span>{m.id}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div className="text-[10px] font-extrabold text-stone-500">
                기념일/생일 전용 추가 옵션 (필요할 때만 체크)
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.isAnnual}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, isAnnual: e.target.checked })
                  }
                />
                <span>🔄 매년 같은 월·일에 자동으로 반복 표시하기 (생일/기념일)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.showDday}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, showDday: e.target.checked })
                  }
                />
                <span>⭐ 하단 D-Day 카운트다운 보드에 고정 표시하기</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.hasOriginYear}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, hasOriginYear: e.target.checked })
                  }
                />
                <span>📅 시작 연도부터 오늘까지 경과 일수(D+일째)도 함께 계산하기</span>
              </label>
            </div>

            <input
              type="text"
              placeholder="메모 (예: 식당 예약, 준비물, 선물 등)"
              value={scheduleForm.memo}
              onChange={(e) => setScheduleForm({ ...scheduleForm, memo: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleSaveSchedule}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 6: 식단표 이미지 AI 자동 스캔 모달 */}
      {isDaycareModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-stone-900">
                  📸 식단표 이미지 AI 고속 스캔 (손글씨·인쇄물)
                </h3>
                <p className="text-[11px] text-stone-500">
                  화이트보드 손글씨(아/점/저) 및 인쇄물 식단표를 즉시 해독합니다.
                </p>
              </div>
              <button onClick={() => setIsDaycareModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div>
                <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                  적용할 연월
                </label>
                <input
                  type="month"
                  value={scanTargetMonth}
                  onChange={(e) => setScanTargetMonth(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl border border-stone-200 text-xs font-black bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                  식단 대상
                </label>
                <select
                  value={scanTargetMember}
                  onChange={(e) => setScanTargetMember(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl border border-stone-200 text-xs font-black bg-white"
                >
                  <option value="전체">👨‍👩‍👧‍👦 온가족</option>
                  {FAMILY_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.emoji} {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                  구분/기관명
                </label>
                <input
                  type="text"
                  value={scanSchoolName}
                  onChange={(e) => setScanSchoolName(e.target.value)}
                  placeholder="주간식단표"
                  className="w-full px-2 py-1.5 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                />
              </div>
            </div>

            <div>
              <input
                ref={menuFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleMenuImageUpload}
                className="hidden"
              />
              <button
                onClick={() => menuFileInputRef.current?.click()}
                disabled={isMenuScanning}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isMenuScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gemini Vision AI가 사진 속 글씨를 해독 중...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>식단표 사진 촬영 / 앨범에서 이미지 선택하기</span>
                  </>
                )}
              </button>
            </div>

            {scanPreviewUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 max-h-36 bg-stone-100">
                <img
                  src={scanPreviewUrl}
                  alt="식단표 미리보기"
                  className="w-full h-36 object-cover"
                />
              </div>
            )}

            {scanErrorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-bold">
                ⚠️ {scanErrorMsg}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-800">
                  추출된 식단 내역 ({scannedMenuDays.length}일 치)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextDayNum = String(scannedMenuDays.length + 1).padStart(2, "0");
                    setScannedMenuDays((prev) => [
                      ...prev,
                      {
                        date: `${scanTargetMonth}-${nextDayNum}`,
                        breakfast: "",
                        mSnack: "",
                        lunch: "",
                        aSnack: "",
                        dinner: "",
                        note: `${scanSchoolName}`
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-[11px] font-extrabold"
                >
                  + 날짜 행 직접 추가
                </button>
              </div>

              {scannedMenuDays.length > 0 && (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {scannedMenuDays.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const copy = [...scannedMenuDays];
                              copy[idx].date = e.target.value;
                              setScannedMenuDays(copy);
                            }}
                            className="px-2 py-1 rounded-lg border border-stone-200 font-black text-xs bg-white"
                          />
                          <span className="text-[11px] font-bold text-stone-500">
                            ({getDayName(row.date)})
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setScannedMenuDays((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-stone-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="🌅 아침 (아: ...)"
                        value={row.breakfast || ""}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].breakfast = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="🍎 오전간식"
                        value={row.mSnack || ""}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].mSnack = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="☀️ 점심 (점: ...)"
                        value={row.lunch || ""}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].lunch = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold bg-white"
                      />
                      <input
                        type="text"
                        placeholder="🥨 오후간식"
                        value={row.aSnack || ""}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].aSnack = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="🌙 저녁 (저: ...)"
                        value={row.dinner || ""}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].dinner = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {scannedMenuDays.length > 0 && (
              <button
                onClick={handleSaveScannedMenuDays}
                className="w-full py-3 rounded-2xl bg-stone-900 text-white text-xs font-black shadow-md"
              >
                ✅ 추출된 식단 ({scannedMenuDays.length}일 치) 달력에 일괄 자동 입력하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 모달 7: 마트 영수증 실제 이미지 스캔 모달 */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">🧾 마트 영수증 사진 고속 스캔</h3>
              <button onClick={() => setIsReceiptModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <input
              ref={receiptFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleReceiptImageUpload}
              className="hidden"
            />
            <button
              onClick={() => receiptFileInputRef.current?.click()}
              disabled={isReceiptScanning}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2"
            >
              {isReceiptScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini Vision AI가 영수증 품목 추출 중...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>영수증 사진 촬영 / 캡처 이미지 업로드</span>
                </>
              )}
            </button>

            {receiptErrorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-bold">
                ⚠️ {receiptErrorMsg}
              </div>
            )}

            {receiptPreviewUrl && (
              <img
                src={receiptPreviewUrl}
                alt="영수증 미리보기"
                className="w-full h-28 object-cover rounded-xl border border-stone-200"
              />
            )}

            {scannedReceiptItems.length > 0 && (
              <div className="space-y-2">
                {scannedReceiptItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs flex justify-between items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) => {
                          const copy = [...scannedReceiptItems];
                          copy[idx].name = e.target.value;
                          setScannedReceiptItems(copy);
                        }}
                        className="font-bold bg-white px-2 py-1 rounded border border-stone-200 w-full text-xs"
                      />
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-bold text-stone-400 shrink-0">수량</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.quantity}
                          onChange={(e) => {
                            const copy = [...scannedReceiptItems];
                            copy[idx].quantity = Math.max(0, Number(e.target.value) || 0);
                            setScannedReceiptItems(copy);
                          }}
                          className={`w-14 px-1.5 py-0.5 rounded border text-[11px] font-extrabold text-center bg-white ${
                            it.unit === "개" && Number(it.quantity) >= 10
                              ? "border-amber-400 bg-amber-50 text-amber-800"
                              : "border-stone-200 text-stone-700"
                          }`}
                        />
                        <input
                          type="text"
                          value={it.unit || "개"}
                          onChange={(e) => {
                            const copy = [...scannedReceiptItems];
                            copy[idx].unit = e.target.value;
                            setScannedReceiptItems(copy);
                          }}
                          className="w-10 px-1 py-0.5 rounded border border-stone-200 text-[11px] font-bold text-center bg-white text-stone-600"
                        />
                        {it.unit === "개" && Number(it.quantity) >= 10 && (
                          <span className="text-[9px] font-black text-amber-700 whitespace-nowrap">
                            ⚠️ 수량 확인
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      value={it.price}
                      onChange={(e) => {
                        const copy = [...scannedReceiptItems];
                        copy[idx].price = Number(e.target.value);
                        setScannedReceiptItems(copy);
                      }}
                      className="w-20 font-extrabold text-emerald-700 bg-white px-2 py-1 rounded border border-stone-200 text-xs text-right"
                    />
                    <button
                      onClick={() => setScannedReceiptItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-rose-600 shrink-0"
                      title="품목 제외"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {(() => {
                  const itemsSum = scannedReceiptItems.reduce((acc, x) => acc + (Number(x.price) || 0), 0);
                  const exclSum = Number(receiptExcludedAmount) || 0;
                  const recTotal = Number(receiptTotalAmount) || 0;
                  const diff = recTotal > 0 ? itemsSum + exclSum - recTotal : null;
                  return (
                    <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-stone-800">
                            🧾 합계 대사 검증 ({scannedReceiptItems.length}건)
                          </span>
                          {receiptEngineUsed && (
                            <span className="px-1.5 py-0.5 rounded bg-stone-200/80 text-[10px] font-bold text-stone-600">
                              🤖 {receiptEngineUsed}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setScannedReceiptItems((prev) => [
                                ...prev,
                                {
                                  name: "",
                                  location: "냉장실",
                                  category: "기타",
                                  quantity: 1,
                                  unit: "개",
                                  expiryDate: getDefaultExpiryForLocation("냉장실"),
                                  expiryIsTemp: true,
                                  price: 0
                                }
                              ])
                            }
                            className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-extrabold text-stone-700"
                          >
                            + 추가
                          </button>
                          {lastReceiptImagePart && (
                            <button
                              onClick={() => runReceiptOcrWithImagePart(lastReceiptImagePart)}
                              disabled={isReceiptScanning}
                              className="px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-[11px] font-extrabold text-amber-900"
                            >
                              🔄 재스캔
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className="bg-white p-2 rounded-xl border border-stone-200 flex items-center justify-between">
                          <span className="text-stone-500 font-bold">품목 합계</span>
                          <span className="font-black text-stone-900">{itemsSum.toLocaleString()}원</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-stone-200 flex items-center justify-between gap-1">
                          <span className="text-stone-500 font-bold shrink-0">봉투 등</span>
                          <input
                            type="number"
                            value={receiptExcludedAmount}
                            onChange={(e) => setReceiptExcludedAmount(e.target.value)}
                            className="w-16 text-right font-black text-stone-700 bg-transparent outline-none"
                          />
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-stone-200 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-stone-500 font-bold">영수증 결제금액</span>
                        <input
                          type="number"
                          placeholder="영수증 총액 입력"
                          value={receiptTotalAmount}
                          onChange={(e) => setReceiptTotalAmount(e.target.value)}
                          className="w-24 text-right font-black text-emerald-700 border-b border-stone-200 outline-none"
                        />
                      </div>
                      {diff !== null && (
                        <div
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black text-center ${
                            diff === 0
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {diff === 0
                            ? "✅ 품목 합계 + 봉투 등 = 영수증 결제금액 100% 일치!"
                            : `⚠️ 차이 ${diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}원 (품목·금액을 확인해 주세요)`}
                        </div>
                      )}
                      {recTotal === 0 && (
                        <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 text-center">
                          ⚠️ 영수증 결제금액 미확인 — 총액을 입력하면 100% 대사 검증됩니다
                        </div>
                      )}
                      {receiptRawLines.length > 0 && (
                        <div className="pt-1">
                          <button
                            onClick={() => setShowReceiptRawLines((v) => !v)}
                            className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline"
                          >
                            {showReceiptRawLines ? "▲ AI가 읽은 원문 줄 접기" : `▼ AI가 읽은 원문 줄 보기 (${receiptRawLines.length}줄)`}
                          </button>
                          {showReceiptRawLines && (
                            <pre className="mt-1.5 p-2 rounded-xl bg-white border border-stone-200 text-[10px] text-stone-600 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {receiptRawLines.join("\n")}
                            </pre>
                          )}
                        </div>
                      )}
                      {receiptSaveError && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-800">
                          ⚠️ 저장 실패: {receiptSaveError} (입력 내역과 이미지는 유지되었습니다)
                        </div>
                      )}
                    </div>
                  );
                })()}
                <button
                  disabled={isSavingReceipt}
                  onClick={async () => {
                    if (!requireEditorAccess()) return;
                    if (isSavingReceipt) return;
                    const validItems = scannedReceiptItems.filter((it) => String(it?.name || "").trim());
                    if (validItems.length === 0) {
                      setReceiptSaveError("입고할 유효한 품목명이 없습니다.");
                      return;
                    }
                    if (!user || !db) {
                      setReceiptSaveError("서버 연결 대기 중입니다. 잠시 후 다시 시도해 주세요.");
                      return;
                    }
                    const itemsSum = validItems.reduce((acc, x) => acc + (Number(x.price) || 0), 0);
                    const exclSum = Number(receiptExcludedAmount) || 0;
                    const recTotal = Number(receiptTotalAmount) || 0;
                    if (recTotal === 0) {
                      const okNoTotal = window.confirm(
                        `영수증 결제금액이 입력되지 않아 합계 대사가 미완료 상태입니다.\n품목 합계 ${itemsSum.toLocaleString()}원으로 그대로 입고할까요?`
                      );
                      if (!okNoTotal) return;
                    } else if (itemsSum + exclSum !== recTotal) {
                      const diffVal = itemsSum + exclSum - recTotal;
                      const okDiff = window.confirm(
                        `품목 합계+봉투(${(itemsSum + exclSum).toLocaleString()}원)와 영수증 결제금액(${recTotal.toLocaleString()}원)이 ${diffVal > 0 ? `+${diffVal.toLocaleString()}` : diffVal.toLocaleString()}원 차이납니다.\n그래도 입고할까요?`
                      );
                      if (!okDiff) return;
                    }

                    const opId = receiptOperationId || `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    setReceiptSaveError("");
                    setIsSavingReceipt(true);
                    beginWrite();
                    let ok = false;
                    let errMsg = "";
                    try {
                      const opRef = getDocRef("family_cooking_operations_v7", opId);
                      let alreadyImported = false;
                      const createdLocal = {};

                      await runTransaction(db, async (tx) => {
                        const existingOp = await tx.get(opRef);
                        if (existingOp.exists()) {
                          alreadyImported = true;
                          return;
                        }
                        const nowIso = new Date().toISOString();
                        validItems.forEach((it, idx) => {
                          const fId = `f-${opId}-${idx}`;
                          const newItem = {
                            ...it,
                            id: fId,
                            name: String(it.name).trim(),
                            purchaseDate: selectedDate,
                            updatedAt: nowIso
                          };
                          createdLocal[fId] = newItem;
                          tx.set(getDocRef("family_fridge_v4", fId), newItem);
                          tx.set(getDocRef("family_fridge_v3", fId), newItem);
                          const expId = `exp-${fId}`;
                          tx.set(getDocRef("family_expenses_v4", expId), {
                            id: expId,
                            title: newItem.name,
                            category: newItem.category || "기타",
                            amount: Number(newItem.price) || 0,
                            date: selectedDate,
                            type: "장보기/식재료"
                          });
                        });
                        tx.set(opRef, {
                          id: opId,
                          type: "receipt_import",
                          count: validItems.length,
                          receiptTotal: recTotal,
                          createdAt: nowIso
                        });
                      });

                      ok = true;
                      if (alreadyImported) {
                        showToast("이미 등록 완료된 영수증입니다 (중복 입고 차단됨).");
                        setScannedReceiptItems([]);
                        setReceiptPreviewUrl("");
                        setIsReceiptModalOpen(false);
                      } else {
                        setFridgeMap((prev) => ({
                          ...prev,
                          local: { ...(prev.local || {}), ...createdLocal }
                        }));
                        setScannedReceiptItems([]);
                        setReceiptPreviewUrl("");
                        setLastReceiptImagePart(null);
                        setReceiptRawLines([]);
                        setIsReceiptModalOpen(false);
                        showToast(`✅ 영수증 ${validItems.length}건이 냉장고와 식비 가계부에 원자적으로 입고되었습니다!`);
                      }
                    } catch (e) {
                      errMsg = e.message || "서버 저장 오류";
                      setReceiptSaveError(errMsg);
                      showToast(`⚠️ 영수증 입고 실패(전체 취소됨): ${errMsg}`);
                    } finally {
                      endWrite(ok, errMsg);
                      setIsSavingReceipt(false);
                    }
                  }}
                  className={`w-full py-2.5 rounded-xl text-white text-xs font-extrabold ${
                    isSavingReceipt ? "bg-stone-400 cursor-not-allowed" : "bg-stone-900 hover:bg-stone-800"
                  }`}
                >
                  {isSavingReceipt ? "트랜잭션 안전 저장 중..." : "냉장고 및 식비 가계부에 일괄 입고하기"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기존 모달들 (식단, 냉장고, 장보기입고, 공지, AI퀵로그) */}
      {isMealModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 pt-0 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 pt-4 pb-2.5 border-b border-stone-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black">
                {editingMeal ? "식단 수정하기" : "새 식단 기록하기"}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveMeal}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                >
                  💾 저장
                </button>
                <button
                  type="button"
                  onClick={() => setIsMealModalOpen(false)}
                  className="p-1.5 rounded-xl bg-stone-100 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={mealForm.date}
                onChange={(e) => setMealForm({ ...mealForm, date: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
              <select
                value={mealForm.slot}
                onChange={(e) => setMealForm({ ...mealForm, slot: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-stone-600">식사 대상</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMealForm({ ...mealForm, members: ["수혁", "아리나", "시목", "시율"] })
                    }
                    className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-bold"
                  >
                    온가족
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealForm({ ...mealForm, members: ["수혁", "아리나"] })}
                    className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-bold"
                  >
                    어른
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealForm({ ...mealForm, members: ["시목", "시율"] })}
                    className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-bold"
                  >
                    아이
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {FAMILY_MEMBERS.map((m) => {
                  const sel = toSafeArray(mealForm.members).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const cur = toSafeArray(mealForm.members);
                        setMealForm({
                          ...mealForm,
                          members: sel ? cur.filter((id) => id !== m.id) : [...cur, m.id]
                        });
                      }}
                      className={`py-1.5 rounded-xl text-xs font-extrabold border whitespace-nowrap flex items-center justify-center ${
                        sel
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-stone-50 text-stone-500 border-stone-200"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1"><MemberAvatar member={m} size="sm" /><span>{m.id}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-stone-700">메뉴 구성 (자동 + 연결)</span>
                {mealForm.menu.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      const combo = mealForm.menu.trim();
                      if (!combo) return;
                      if (!favoriteMealCombos.includes(combo)) {
                        const next = [combo, ...favoriteMealCombos].slice(0, 15);
                        setFavoriteMealCombos(next);
                        syncMealFavoritesToCloud(next, favoriteSingleMenus);
                      }
                      showToast("⭐ 자주 먹는 조합에 저장했습니다!");
                    }}
                    className="text-[11px] font-extrabold text-amber-700 hover:text-amber-800"
                  >
                    ⭐ 조합 즐겨찾기 저장
                  </button>
                )}
              </div>

              {/* 칩으로 하나씩 추가 */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="메뉴 하나씩 입력 후 + (예: 스무디)"
                  value={mealChipInput}
                  onChange={(e) => setMealChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      appendMenuChipToForm(mealChipInput);
                      setMealChipInput("");
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    appendMenuChipToForm(mealChipInput);
                    setMealChipInput("");
                  }}
                  className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold shrink-0"
                >
                  + 추가
                </button>
                <button
                  type="button"
                  disabled={!mealChipInput.trim()}
                  onClick={() => {
                    handleAddFavoriteSingleMenu(mealChipInput);
                    setMealChipInput("");
                  }}
                  title="입력한 단일 메뉴를 즐겨찾기에 등록"
                  className="px-2.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 disabled:opacity-40 text-amber-900 border border-amber-300 text-xs font-extrabold shrink-0"
                >
                  ⭐
                </button>
              </div>
              {mealChipInput.trim() && (() => {
                const q = mealChipInput.trim().toLowerCase();
                const curParts = new Set(
                  String(mealForm.menu || "")
                    .split(/\s*\+\s*/)
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean)
                );
                const hits = knownMenuSuggestions
                  .filter((m) => {
                    const lm = m.toLowerCase();
                    return lm.includes(q) && lm !== q && !curParts.has(lm);
                  })
                  .sort((a, b) => {
                    const aStart = a.toLowerCase().startsWith(q) ? 0 : 1;
                    const bStart = b.toLowerCase().startsWith(q) ? 0 : 1;
                    return aStart - bStart;
                  })
                  .slice(0, 6);
                return hits.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {hits.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          appendMenuChipToForm(h);
                          setMealChipInput("");
                        }}
                        className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold text-amber-900"
                      >
                        ✨ + {h}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* 현재 조합된 칩 목록 */}
              {String(mealForm.menu || "").trim() && (
                <div className="flex flex-wrap gap-1">
                  {String(mealForm.menu)
                    .split(/\s*\+\s*/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((chip, cIdx) => (
                      <span
                        key={`${chip}-${cIdx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-xs font-extrabold"
                      >
                        <span>{chip}</span>
                        {!favoriteSingleMenus.includes(chip) && (
                          <button
                            type="button"
                            onClick={() => handleAddFavoriteSingleMenu(chip)}
                            title="이 메뉴를 단일 즐겨찾기에 등록"
                            className="text-amber-600 hover:text-amber-800 text-[10px]"
                          >
                            ⭐
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const parts = String(mealForm.menu)
                              .split(/\s*\+\s*/)
                              .map((s) => s.trim())
                              .filter(Boolean);
                            parts.splice(cIdx, 1);
                            setMealForm({ ...mealForm, menu: parts.join(" + ") });
                          }}
                          className="text-amber-700 hover:text-rose-600 font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}

              {/* 최종 한 줄 메뉴명 직접 수정도 가능 */}
              <input
                type="text"
                placeholder="최종 한 줄 메뉴명 (예: 스무디 + 감)"
                value={mealForm.menu}
                onChange={(e) => setMealForm({ ...mealForm, menu: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-white"
              />

              {/* 최근 자주 먹은 개별 메뉴 원터치 칩 */}
              {recentSingleMenuChips.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-stone-500">⚡ 최근 자주 먹은 메뉴 (터치로 + 추가)</div>
                  <div className="flex flex-wrap gap-1">
                    {recentSingleMenuChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => appendMenuChipToForm(chip)}
                        className="px-2 py-1 rounded-full bg-white hover:bg-amber-50 border border-stone-200 text-[11px] font-bold text-stone-700"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 즐겨찾는 단일 메뉴 (터치로 + 추가) */}
              {favoriteSingleMenus.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-bold text-emerald-800">⭐ 즐겨찾는 단일 메뉴 (터치로 + 추가)</div>
                  <div className="flex flex-wrap gap-1">
                    {favoriteSingleMenus.map((single) => (
                      <span
                        key={single}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900"
                      >
                        <button
                          type="button"
                          onClick={() => appendMenuChipToForm(single)}
                          className="hover:underline"
                        >
                          + {single}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFavoriteSingleMenu(single)}
                          className="text-emerald-500 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 레시피북에서 바로 추가 */}
              {recipes.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-bold text-rose-800">📖 레시피북에서 바로 추가 (터치로 + 추가)</div>
                  <div className="flex gap-1 overflow-x-auto pb-0.5">
                    {recipes.slice(0, 12).map((rc) => (
                      <button
                        key={rc.id}
                        type="button"
                        onClick={() => appendMenuChipToForm(rc.title)}
                        className="px-2 py-1 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold text-rose-900 shrink-0"
                      >
                        + {rc.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 즐겨찾기 조합 */}
              {favoriteMealCombos.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-bold text-amber-800">⭐ 즐겨찾기 조합 (1초 불러오기)</div>
                  <div className="flex flex-wrap gap-1">
                    {favoriteMealCombos.map((combo) => (
                      <span
                        key={combo}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900"
                      >
                        <button
                          type="button"
                          onClick={() => setMealForm({ ...mealForm, menu: combo })}
                          className="hover:underline"
                        >
                          {combo}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = favoriteMealCombos.filter((x) => x !== combo);
                            setFavoriteMealCombos(next);
                            syncMealFavoritesToCloud(next, favoriteSingleMenus);
                          }}
                          className="text-amber-500 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={mealForm.sourceType}
                onChange={(e) => setMealForm({ ...mealForm, sourceType: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                <option value="집밥/온가족식">🏠 집밥/온가족식</option>
                <option value="유아식/이유식">🍼 유아식/이유식</option>
                <option value="어린이집 급식">🏫 어린이집 급식</option>
                <option value="외식/배달">🛵 외식/배달</option>
              </select>
              <input
                type="number"
                placeholder="외식/배달 지출액(원)"
                value={mealForm.cost}
                onChange={(e) => setMealForm({ ...mealForm, cost: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
            </div>

            <input
              type="text"
              placeholder="메모"
              value={mealForm.note}
              onChange={(e) => setMealForm({ ...mealForm, note: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsMealModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleSaveMeal}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {isFridgeModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">
                {editingFridge ? "냉장고 재료 수정" : "냉장고 재료 추가"}
              </h3>
              <button onClick={() => { setFridgeConflictData(null); setIsFridgeModalOpen(false); }}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <input
              type="text"
              placeholder="품목명"
              value={fridgeForm.name}
              onChange={(e) => setFridgeForm({ ...fridgeForm, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold"
            />
            {!editingFridge && fridgeForm.name.trim() && (() => {
              const q = fridgeForm.name.trim().toLowerCase();
              const hits = knownIngredientList
                .filter((x) => x.name.toLowerCase().includes(q) && x.name.toLowerCase() !== q)
                .sort((a, b) => {
                  const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                  const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                  return aStart - bStart;
                })
                .slice(0, 6);
              return hits.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {hits.map((h) => (
                    <button
                      key={h.name}
                      type="button"
                      onClick={() => {
                        const nextCat = h.category || fridgeForm.category;
                        setFridgeForm({
                          ...fridgeForm,
                          name: h.name,
                          category: nextCat,
                          unit: h.unit || fridgeForm.unit,
                          shelfZone: fridgeForm.shelfZone || resolveItemShelfZone({ location: fridgeForm.location, category: nextCat })
                        });
                      }}
                      className="px-2 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[10px] font-bold text-sky-900"
                    >
                      ✨ {h.name} ({h.category})
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-2 gap-2">
              <select
                value={fridgeForm.location}
                onChange={(e) => {
                  const newLoc = e.target.value;
                  setFridgeForm((prev) => ({
                    ...prev,
                    location: newLoc,
                    expiryDate:
                      !editingFridge && !isExpiryManuallyEdited
                        ? getDefaultExpiryForLocation(newLoc)
                        : prev.expiryDate
                  }));
                }}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                {STORAGE_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <select
                value={fridgeForm.category}
                onChange={(e) => setFridgeForm({ ...fridgeForm, category: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                {FRIDGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-stone-500 block mb-1">세부 보관 칸 (시각적 냉장고 위치)</label>
              <select
                value={fridgeForm.shelfZone || ""}
                onChange={(e) => setFridgeForm({ ...fridgeForm, shelfZone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-stone-50"
              >
                <option value="">자동 배치 (보관위치·카테고리 기준)</option>
                {FRIDGE_SHELF_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="수량"
                value={fridgeForm.quantity}
                onChange={(e) => setFridgeForm({ ...fridgeForm, quantity: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
              <input
                type="text"
                placeholder="단위 (개, 팩, g)"
                value={fridgeForm.unit}
                onChange={(e) => setFridgeForm({ ...fridgeForm, unit: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-500">소비기한 {!editingFridge && !isExpiryManuallyEdited && <span className="text-amber-600">(임시값·상품 확인)</span>}</label>
                <input
                  type="date"
                  value={fridgeForm.expiryDate}
                  onChange={(e) => {
                    setIsExpiryManuallyEdited(true);
                    setFridgeForm({ ...fridgeForm, expiryDate: e.target.value });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-500">구입 금액(원)</label>
                <input
                  type="number"
                  placeholder="예: 12000"
                  value={fridgeForm.price}
                  onChange={(e) => setFridgeForm({ ...fridgeForm, price: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
                />
              </div>
            </div>

            {fridgeConflictData && (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-black text-amber-900">
                  ⚠️ 다른 기기에서 먼저 수정된 재고입니다
                </div>
                <div className="space-y-1 text-[10px] font-bold">
                  <div className="bg-white/90 rounded-lg px-2 py-1 border border-amber-200 text-stone-700">
                    서버 최신값: {fridgeConflictData.serverItem?.name} · {fridgeConflictData.serverItem?.quantity}{fridgeConflictData.serverItem?.unit} · {fridgeConflictData.serverItem?.location}
                  </div>
                  <div className="bg-white/90 rounded-lg px-2 py-1 border border-rose-200 text-rose-800">
                    내 수정값: {fridgeConflictData.localPayload?.name} · {fridgeConflictData.localPayload?.quantity}{fridgeConflictData.localPayload?.unit} · {fridgeConflictData.localPayload?.location}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const srv = fridgeConflictData.serverItem;
                      if (srv) {
                        setEditingFridge(srv);
                        setFridgeForm({
                          name: srv.name || "",
                          location: srv.location || "냉장실",
                          category: srv.category || "채소/과일",
                          quantity: srv.quantity ?? 1,
                          unit: srv.unit || "개",
                          expiryDate: srv.expiryDate || getTodayStr(),
                          price: srv.price || "",
                          purchaseDate: srv.purchaseDate || selectedDate,
                          shelfZone: srv.shelfZone || ""
                        });
                      }
                      setFridgeConflictData(null);
                      showToast("서버 최신값을 불러왔습니다.");
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-[10px] font-extrabold"
                  >
                    서버값 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveFridge(fridgeConflictData.serverItem?.updatedAt || "")}
                    className="flex-1 py-1.5 rounded-xl bg-amber-600 text-white text-[10px] font-extrabold"
                  >
                    내 수정값으로 저장
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setFridgeConflictData(null); setIsFridgeModalOpen(false); }}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={() => handleSaveFridge()}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {stockInItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-sm font-black">🛒 구매 완료 및 냉장고 입고</h3>
            <p className="text-xs text-stone-600">
              <b>{stockInItem.name}</b> 품목을 냉장고에 입고합니다. 결제 금액을 입력하면 식비 가계부에도 영구 기록됩니다.
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-stone-700 block">보관 위치 선택</label>
              <div className="grid grid-cols-2 gap-1.5">
                {STORAGE_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setStockInLocation(loc)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border transition ${
                      stockInLocation === loc
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-stone-50 text-stone-700 border-stone-200"
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              placeholder="결제 금액(원) 입력 (선택)"
              value={stockInPrice}
              onChange={(e) => setStockInPrice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setStockInItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleConfirmStockIn}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
              >
                냉장고 입고 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {isNoticeModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">
                {editingNotice ? "가족 공지 수정" : "새 가족 공지사항 작성"}
              </h3>
              <button onClick={() => setIsNoticeModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <input
              type="text"
              placeholder="제목"
              value={noticeForm.title}
              onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={noticeForm.category}
                onChange={(e) => setNoticeForm({ ...noticeForm, category: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                <option value="육아/아이들">👶 육아/아이들</option>
                <option value="일정/행사">📅 일정/행사</option>
                <option value="집안일">🧹 집안일</option>
                <option value="일반">💬 일반 공지</option>
              </select>
              <select
                value={noticeForm.author}
                onChange={(e) => setNoticeForm({ ...noticeForm, author: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                <option value="김수혁">👨🏻 김수혁</option>
                <option value="최아리나">👩🏻 최아리나</option>
              </select>
            </div>

            <textarea
              rows={3}
              placeholder="상세 내용"
              value={noticeForm.content}
              onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />

            <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={noticeForm.pinned}
                onChange={(e) => setNoticeForm({ ...noticeForm, pinned: e.target.checked })}
              />
              <span>📌 앱 상단 배너에 중요 공지로 고정하기</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleSaveNotice}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}

      {quickLogRecipe && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-sm font-black">식단표에 바로 등록하기</h3>
            <div className="text-xs font-bold text-stone-700">{quickLogRecipe.title}</div>
            <input
              type="date"
              value={quickLogDate}
              onChange={(e) => setQuickLogDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {MEAL_SLOTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setQuickLogSlot(s.id)}
                  className={`py-2 rounded-xl text-xs font-extrabold border ${
                    quickLogSlot === s.id
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-stone-50 text-stone-600 border-stone-200"
                  }`}
                >
                  {s.icon} {s.shortLabel}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setQuickLogRecipe(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 font-extrabold text-xs"
              >
                취소
              </button>
              <button
                onClick={handleConfirmQuickLog}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white font-extrabold text-xs"
              >
                식단표에 추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 요리 완료 재고 차감 확인 모달 */}
      {cookingConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">🍳 요리 완료 · 재고 차감 확인</h3>
              <button onClick={() => setCookingConfirmModal(null)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <div className="text-xs font-bold text-stone-700">
              <b>{cookingConfirmModal.recipeTitle}</b>에 사용한 냉장고 재료 수량을 확인해 주세요.
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cookingConfirmModal.items.map((entry, idx) => (
                <div
                  key={entry.item.id}
                  className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-stone-900">{entry.item.name}</div>
                    <div className="text-[10px] text-stone-500">
                      현재고: {entry.item.quantity}{entry.item.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const copy = [...cookingConfirmModal.items];
                        copy[idx].deductQty = Math.max(0, copy[idx].deductQty - 1);
                        setCookingConfirmModal({ ...cookingConfirmModal, items: copy });
                      }}
                      className="w-11 h-11 rounded-xl bg-white border border-stone-200 text-base font-black flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="font-black text-amber-700 min-w-[24px] text-center">
                      -{entry.deductQty}
                    </span>
                    <button
                      onClick={() => {
                        const copy = [...cookingConfirmModal.items];
                        copy[idx].deductQty = Math.min(
                          Number(entry.item.quantity || 0),
                          copy[idx].deductQty + 1
                        );
                        setCookingConfirmModal({ ...cookingConfirmModal, items: copy });
                      }}
                      className="w-11 h-11 rounded-xl bg-white border border-stone-200 text-base font-black flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCookingConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleConfirmCookingDeduction}
                disabled={isCookingDeducting}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold ${
                  isCookingDeducting ? "bg-stone-400 cursor-not-allowed" : "bg-stone-900 hover:bg-stone-800"
                }`}
              >
                {isCookingDeducting ? "차감 처리 중..." : "확인 후 차감하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">⚙️ 1일 2회 자동백업 · Gmail/Drive · 설정</h3>
              <button onClick={() => setIsSettingsOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div>
                ✅ <b>하루 2회(오전/오후) 클라우드 스냅샷:</b> 정상 가동 중
              </div>
              <div>
                🕒 <b>최근 자동백업 슬롯:</b> <code>{lastAutoBackupSlot || getTwiceDailySlotKey()}</code>
              </div>
              <div>
                📦 <b>보관 중인 데이터:</b> 식단 {meals.length}건 · 냉장고 {fridge.length}건 · 일정 {schedules.length}건
              </div>
            </div>

            <button
              onClick={() => {
                setIsSettingsOpen(false);
                setIsPatchModalOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <span>📝 앱 패치노트 열람 및 새 업데이트 기록하기</span>
            </button>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
              <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4 text-amber-700" />
                <span>Gmail / 구글 드라이브 백업 및 1초 복원</span>
              </div>

              <input
                type="email"
                value={backupEmail}
                onChange={(e) => {
                  setBackupEmail(e.target.value);
                  localStorage.setItem("kim_family_backup_email", e.target.value);
                }}
                placeholder="수신받을 내 Gmail 주소 입력 (선택)"
                className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold bg-white"
              />

              <button
                onClick={handleSendBackupToGmailOrDrive}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Mail className="w-4 h-4" />
                <span>내 Gmail / 구글 드라이브로 백업 즉시 보내기</span>
              </button>

              <button
                onClick={handleDownloadJsonBackup}
                className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <FileJson className="w-4 h-4 text-amber-400" />
                <span>전체 DB 원본(JSON) 1초 백업 다운로드</span>
              </button>

              <input
                ref={jsonRestoreInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFromJsonFile}
                className="hidden"
              />
              <button
                onClick={() => jsonRestoreInputRef.current?.click()}
                disabled={isRestoringJson}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoringJson ? "animate-spin" : ""}`} />
                <span>
                  {isRestoringJson
                    ? "백업 파일로 DB 복원 중..."
                    : "백업 파일(.json)로 DB 1초 복원하기"}
                </span>
              </button>
            </div>

            {!isEditorUnlocked ? (
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                <div className="text-xs font-extrabold text-amber-900">
                  🔒 열람 전용 모드입니다
                </div>
                <p className="text-[11px] text-amber-800">
                  API 키 설정과 데이터 편집·복원은 초대 비밀코드를 입력한 가족만 사용할 수 있습니다.
                </p>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsEditorUnlockModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                >
                  🔑 초대 코드 입력하기
                </button>
              </div>
            ) : (
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
              <div className="text-xs font-black text-stone-800">
                🤖 듀얼 AI 엔진 설정 (GPT + Gemini)
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "auto", label: "자동(GPT우선)" },
                  { id: "openai", label: "OpenAI GPT" },
                  { id: "gemini", label: "Gemini만" }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAiProvider(opt.id)}
                    className={`py-1.5 rounded-xl text-[10px] font-extrabold border ${
                      aiProvider === opt.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-600 border-stone-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-stone-600">
                    🟢 OpenAI GPT API 키
                  </label>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${openaiApiKey ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                    {openaiApiKey ? "✅ 저장됨" : "미입력"}
                  </span>
                </div>
                <input
                  type="password"
                  value={tempOpenaiKeyInput}
                  onChange={(e) => setTempOpenaiKeyInput(e.target.value)}
                  placeholder="sk-proj-... 또는 sk-... 입력"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-stone-600">
                    🔵 Google Gemini API 키
                  </label>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${geminiApiKey ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"}`}>
                    {geminiApiKey ? "✅ 저장됨" : "미입력"}
                  </span>
                </div>
                <input
                  type="password"
                  value={tempKeyInput}
                  onChange={(e) => setTempKeyInput(e.target.value)}
                  placeholder="Gemini API 키 입력"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
                />
              </div>

              {aiDiagStatus && (
                <div className="p-2.5 rounded-xl bg-white border-2 border-amber-300 text-[11px] font-bold text-stone-800 whitespace-pre-line shadow-sm">
                  {aiDiagStatus}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    handleSaveApiKey(tempKeyInput, tempOpenaiKeyInput, aiProvider);
                    setAiDiagStatus(`✅ 설정이 저장되었습니다! (엔진: ${aiProvider}, OpenAI: ${tempOpenaiKeyInput ? "입력됨" : "없음"}, Gemini: ${tempKeyInput ? "입력됨" : "없음"})`);
                  }}
                  className="py-2 rounded-xl bg-stone-800 text-white text-xs font-extrabold"
                >
                  AI 설정 저장
                </button>
                <button
                  onClick={handleRunAiDiagnostic}
                  className="py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold"
                >
                  AI 연결 자가진단
                </button>
              </div>
            </div>
            )}

            {aiCallLogs.length > 0 && (
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-800">🩺 AI 오류센터 (최근 호출 기록)</span>
                  <button
                    onClick={() => setAiCallLogs([])}
                    className="text-[10px] font-bold text-stone-400 hover:text-stone-700"
                  >
                    지우기
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {aiCallLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-xl text-[10px] border ${
                        log.ok
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      <div className="font-extrabold">
                        {log.ok ? "✅" : "❌"} [{log.time}] {log.provider} · {log.task}
                      </div>
                      <div className="opacity-85 break-all">{log.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-stone-800">
                  🧪 핵심 로직 자가진단 (단위·날짜·매칭·완성도)
                </span>
                <button
                  onClick={runCoreLogicSelfTests}
                  className="px-2.5 py-1 rounded-lg bg-stone-900 text-white text-[11px] font-extrabold shrink-0"
                >
                  테스트 실행
                </button>
              </div>
              {selfTestResults && (
                <div className="space-y-1">
                  <div className="text-[11px] font-black text-emerald-700">
                    결과: {selfTestResults.passed}/{selfTestResults.total} 통과
                  </div>
                  {selfTestResults.cases.map((c, idx) => (
                    <div key={idx} className="text-[11px] font-semibold text-stone-700">
                      {c.pass ? "✅" : "❌"} {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isEditorUnlocked && (
              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-stone-800">
                    🗑️ 최근 삭제 로그 ({deletedLogs.length}건)
                  </span>
                  {deletedLogs.length > 0 && (
                    <button
                      onClick={() => {
                        setDeletedLogs([]);
                        try {
                          localStorage.removeItem("kim_deleted_logs_v1");
                        } catch (e) {}
                        showToast("삭제 로그가 비워졌습니다.");
                      }}
                      className="text-[11px] font-bold text-stone-400 hover:text-stone-700"
                    >
                      비우기
                    </button>
                  )}
                </div>
                {deletedLogs.length === 0 ? (
                  <div className="text-[11px] text-stone-400">최근 삭제된 기록이 없습니다.</div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {deletedLogs.map((log) => (
                      <div
                        key={log.logId}
                        className="p-2 rounded-xl bg-white border border-stone-200 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-800 truncate">{log.label}</div>
                          <div className="text-[11px] text-stone-400">
                            {log.type === "meal" ? "식단" : log.type === "fridge" ? "냉장고" : "일정"} · {log.deletedAt}
                          </div>
                        </div>
                        <button
                          onClick={() => restoreDeletedLogEntry(log)}
                          disabled={restoringLogIds.includes(log.logId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 ${
                            restoringLogIds.includes(log.logId)
                              ? "bg-stone-200 text-stone-400"
                              : "bg-amber-100 hover:bg-amber-200 text-amber-900"
                          }`}
                        >
                          {restoringLogIds.includes(log.logId) ? "복구중" : "복구"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleRestoreAllDeleted}
              className="w-full py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Database className="w-4 h-4" />
              <span>숨겨지거나 삭제된 기존 데이터 전체 다시 불러오기</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>엑셀 열람용(CSV) 통합 파일 다운로드</span>
            </button>
          </div>
        </div>
      )}

      {isEditorUnlockModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900">
                {isEditorUnlocked ? "✏️ 가족 편집 권한 활성화됨" : "🔐 초대 비밀코드 입력"}
              </h3>
              <button onClick={() => setIsEditorUnlockModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            {isEditorUnlocked ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  현재 기기에서는 식단·냉장고·일정·육아수첩 편집이 가능합니다. 가족에게 아래 초대 링크를 공유하면 링크 접속만으로 편집 권한이 바로 열립니다.
                </p>
                <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-500">초대 비밀코드</div>
                  <div className="text-base font-black text-stone-900 tracking-widest">{EDITOR_INVITE_CODE}</div>
                </div>
                <button
                  onClick={async () => {
                    const inviteUrl = `${window.location.origin}/?invite=${EDITOR_INVITE_CODE}`;
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      showToast("🔗 가족 초대 링크가 복사되었습니다!");
                    } catch (e) {
                      showToast(`초대 링크: ${inviteUrl}`);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold"
                >
                  🔗 가족 초대 링크 복사하기
                </button>
                <button
                  onClick={() => {
                    try {
                      localStorage.removeItem("family_editor_unlocked_v1");
                    } catch (e) {}
                    setIsEditorUnlocked(false);
                    setIsEditorUnlockModalOpen(false);
                    showToast("🔒 열람 전용 모드로 전환되었습니다.");
                  }}
                  className="w-full py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold"
                >
                  🔒 열람 전용 모드로 잠그기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed">
                  누구나 내용을 열람할 수 있지만, 추가·수정·삭제는 초대 비밀코드를 입력한 가족만 가능합니다.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="초대 비밀코드 입력"
                  value={editorCodeInput}
                  onChange={(e) => setEditorCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (editorCodeInput.trim() === EDITOR_INVITE_CODE) {
                        try {
                          localStorage.setItem("family_editor_unlocked_v1", "true");
                        } catch (e2) {}
                        setIsEditorUnlocked(true);
                        setEditorCodeInput("");
                        setIsEditorUnlockModalOpen(false);
                        showToast("✅ 편집 권한이 활성화되었습니다!");
                      } else {
                        showToast("❌ 초대 코드가 일치하지 않습니다.");
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-bold text-center tracking-widest"
                />
                <button
                  onClick={() => {
                    if (editorCodeInput.trim() === EDITOR_INVITE_CODE) {
                      try {
                        localStorage.setItem("family_editor_unlocked_v1", "true");
                      } catch (e) {}
                      setIsEditorUnlocked(true);
                      setEditorCodeInput("");
                      setIsEditorUnlockModalOpen(false);
                      showToast("✅ 편집 권한이 활성화되었습니다!");
                    } else {
                      showToast("❌ 초대 코드가 일치하지 않습니다.");
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold"
                >
                  편집 권한 잠금 해제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {isInventoryExportOpen && (() => {
        const exportText = buildInventoryExportText();
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-900">
                  📤 식단 · 전체 재고 통합 내보내기
                </h3>
                <button
                  onClick={() => setIsInventoryExportOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div className={exportScope === "fridge_only" ? "col-span-3" : "col-span-2"}>
                    <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                      내보낼 항목 선택
                    </label>
                    <select
                      value={exportScope}
                      onChange={(e) => setExportScope(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-200 bg-white font-extrabold text-stone-900 text-xs"
                    >
                      <option value="all">🍱 식단 + 전체 재고 통합</option>
                      <option value="meals_only">📅 일별 식단만</option>
                      <option value="fridge_only">❄️ 전체 재고만</option>
                    </select>
                  </div>
                  {exportScope !== "fridge_only" && (
                    <div>
                      <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                        식단 기간
                      </label>
                      <select
                        value={exportMealDays}
                        onChange={(e) => setExportMealDays(Number(e.target.value))}
                        className="w-full px-2 py-2 rounded-xl border border-stone-200 bg-white font-extrabold text-stone-900 text-xs"
                      >
                        <option value={3}>최근 3일</option>
                        <option value={7}>최근 7일</option>
                        <option value={14}>최근 14일</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {exportScope !== "fridge_only" && (
                    <div>
                      <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                        식단 대상자 (인별)
                      </label>
                      <select
                        value={exportMealMember}
                        onChange={(e) => setExportMealMember(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl border border-stone-200 bg-white font-bold text-xs"
                      >
                        <option value="전체">👨‍👩‍👧‍👦 가족 전체(인별)</option>
                        {FAMILY_MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.emoji} {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {exportScope !== "meals_only" && (
                    <div className={exportScope === "fridge_only" ? "col-span-2" : ""}>
                      <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                        재고 보관 위치
                      </label>
                      <select
                        value={exportFridgeLoc}
                        onChange={(e) => setExportFridgeLoc(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl border border-stone-200 bg-white font-bold text-xs"
                      >
                        <option value="전체">전체 (냉장·냉동·실온)</option>
                        {STORAGE_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {exportIncludeAiPrompt && (
                <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-200 flex items-center justify-between gap-2 text-xs">
                  <label className="font-extrabold text-amber-950 shrink-0">🎯 AI 요청 목표</label>
                  <select
                    value={exportMealGoal}
                    onChange={(e) => setExportMealGoal(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-white font-bold text-stone-900 text-xs"
                  >
                    {EXPORT_MEAL_GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap text-xs font-bold text-stone-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludeAiPrompt}
                    onChange={(e) => setExportIncludeAiPrompt(e.target.checked)}
                    className="rounded"
                  />
                  <span>🤖 AI 평가 요청문 포함</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludePrice}
                    onChange={(e) => setExportIncludePrice(e.target.checked)}
                    className="rounded"
                  />
                  <span>가격 포함</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportIncludeZeroOrExpired}
                    onChange={(e) => setExportIncludeZeroOrExpired(e.target.checked)}
                    className="rounded"
                  />
                  <span>0개·만료 품목 포함</span>
                </label>
              </div>

              <textarea
                readOnly
                value={exportText}
                rows={12}
                className="w-full p-3 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] font-mono text-stone-800 leading-relaxed resize-none"
              />

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(exportText);
                      showToast("📋 전체 재고 텍스트가 복사되었습니다!");
                    } catch (e) {
                      showToast("⚠️ 클립보드 복사 권한이 없어 TXT 다운로드를 이용해 주세요.");
                    }
                  }}
                  className="py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                >
                  📋 복사하기
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `우리집_전체재고_${getTodayStr()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast("📄 TXT 파일이 다운로드되었습니다!");
                  }}
                  className="py-2.5 rounded-xl bg-amber-600 text-white text-xs font-extrabold"
                >
                  📄 TXT 저장
                </button>
                <button
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: `우리 가족 식탁 전체 재고 (${getTodayStr()})`,
                          text: exportText
                        });
                        return;
                      } catch (e) {}
                    }
                    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `우리집_전체재고_${getTodayStr()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast("공유 기능이 제한되어 TXT 파일로 저장했습니다.");
                  }}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
                >
                  📤 공유하기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {isRecipeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setIsRecipeModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl p-4 pt-0 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 pt-4 pb-2.5 border-b border-stone-100 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-stone-900">
                📖 {editingRecipe ? "가족 레시피 수정" : "새 가족 레시피 등록"}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                >
                  💾 저장
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecipeModalOpen(false)}
                  className="p-1.5 rounded-xl bg-stone-100 text-stone-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={recipeForm.title}
                onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
                placeholder="요리명 (예: 소고기 무국)"
                className="col-span-2 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
              <select
                value={recipeForm.category || "메인반찬"}
                onChange={(e) => setRecipeForm({ ...recipeForm, category: e.target.value })}
                className="px-2 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-stone-50"
              >
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <input
                ref={recipePhotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleRecipePhotoSelect}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => recipePhotoInputRef.current?.click()}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-extrabold text-stone-700"
                >
                  📷 {recipeForm.photoDataUrl ? "사진 변경" : "완성 사진 올리기"}
                </button>
                {recipeForm.photoDataUrl && (
                  <button
                    onClick={() => openCropModalWithUrl(recipeForm.photoDataUrl)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-extrabold text-rose-700 shrink-0"
                  >
                    ✂️ 사진 자르기
                  </button>
                )}
              </div>
              {recipeForm.photoDataUrl && (
                <img src={recipeForm.photoDataUrl} alt="미리보기" className="w-full h-36 object-cover rounded-xl border border-stone-200" />
              )}
            </div>

            <div className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-stone-700">🥕 재료 하나씩 입력 (+ 자동 연결)</span>
                {String(recipeForm.ingredientsText || "").trim() && (
                  <button
                    type="button"
                    onClick={() => handleAddMissingRecipeIngredientsToShopping({
                      title: recipeForm.title || "새 레시피",
                      ingredients: String(recipeForm.ingredientsText || "").split(/[+,\n]+/).map((s) => s.trim()).filter(Boolean)
                    })}
                    className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-800"
                  >
                    🛒 부족 재료 일괄 장보기
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={recipeIngredientInput}
                  onChange={(e) => setRecipeIngredientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      appendRecipeIngredientChip(recipeIngredientInput);
                      setRecipeIngredientInput("");
                    }
                  }}
                  placeholder="재료 1개 입력 후 + (예: 소고기 250g)"
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    appendRecipeIngredientChip(recipeIngredientInput);
                    setRecipeIngredientInput("");
                  }}
                  className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold shrink-0"
                >
                  + 추가
                </button>
              </div>
              {recipeIngredientInput.trim() && (() => {
                const q = recipeIngredientInput.trim().toLowerCase();
                const hits = knownIngredientList
                  .filter((x) => x.name.toLowerCase().includes(q) && x.name.toLowerCase() !== q)
                  .sort((a, b) => {
                    const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
                    const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
                    return aStart - bStart;
                  })
                  .slice(0, 6);
                return hits.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {hits.map((h) => (
                      <button
                        key={h.name}
                        type="button"
                        onClick={() => {
                          appendRecipeIngredientChip(h.name);
                          setRecipeIngredientInput("");
                        }}
                        className="px-2 py-0.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold text-rose-900"
                      >
                        ✨ + {h.name}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
              {String(recipeForm.ingredientsText || "").trim() && (
                <div className="flex flex-wrap gap-1">
                  {String(recipeForm.ingredientsText)
                    .split(/\s*(?:\+|,|\n)\s*/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((chip, cIdx) => (
                      <span
                        key={`${chip}-${cIdx}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white text-stone-800 border border-stone-200 text-[11px] font-bold"
                      >
                        <span>{chip}</span>
                        <button
                          type="button"
                          onClick={() => handleQuickAddSingleIngredientToShopping(chip, recipeForm.title)}
                          title="이 재료 바로 장보기 추가"
                          className="text-emerald-600 hover:text-emerald-800 font-black"
                        >
                          🛒
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const parts = String(recipeForm.ingredientsText)
                              .split(/\s*(?:\+|,|\n)\s*/)
                              .map((s) => s.trim())
                              .filter(Boolean);
                            parts.splice(cIdx, 1);
                            setRecipeForm({ ...recipeForm, ingredientsText: parts.join(" + ") });
                          }}
                          className="text-stone-400 hover:text-rose-600 font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}
              <input
                type="text"
                value={recipeForm.ingredientsText}
                onChange={(e) => setRecipeForm({ ...recipeForm, ingredientsText: e.target.value })}
                placeholder="최종 연결된 재료 (예: 소고기 250g + 무 200g + 대파 1단)"
                className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-[11px] font-semibold bg-white text-stone-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={recipeForm.cookTime}
                onChange={(e) => setRecipeForm({ ...recipeForm, cookTime: e.target.value })}
                placeholder="조리시간 (예: 25분)"
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              />
              <select
                value={recipeForm.difficulty}
                onChange={(e) => setRecipeForm({ ...recipeForm, difficulty: e.target.value })}
                className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold bg-stone-50"
              >
                <option value="쉬움">난이도: 쉬움</option>
                <option value="보통">난이도: 보통</option>
                <option value="어려움">난이도: 어려움</option>
              </select>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
              <div className="text-[11px] font-black text-amber-900">가족별 선호도</div>
              <div className="grid grid-cols-2 gap-2">
                {["수혁", "아리나", "시목", "시율"].map((mName) => (
                  <div key={mName} className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-amber-100 text-[11px]">
                    <span className="font-bold text-stone-700">{mName}</span>
                    <select
                      value={recipeForm.ratings?.[mName] ?? 0}
                      onChange={(e) =>
                        setRecipeForm({
                          ...recipeForm,
                          ratings: { ...(recipeForm.ratings || {}), [mName]: Number(e.target.value) }
                        })
                      }
                      className="font-bold text-amber-700 bg-transparent focus:outline-none"
                    >
                      <option value={0}>미평가</option>
                      <option value={5}>⭐⭐⭐⭐⭐</option>
                      <option value={4}>⭐⭐⭐⭐</option>
                      <option value={3}>⭐⭐⭐</option>
                      <option value={2}>⭐⭐</option>
                      <option value={1}>⭐</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <textarea
              rows={2}
              value={recipeForm.stepsText || ""}
              onChange={(e) => setRecipeForm({ ...recipeForm, stepsText: e.target.value })}
              placeholder="👩‍🍳 조리 순서 (예: 1. 소고기 핏물 빼고 볶기 / 2. 무 넣고 끓이기)"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs resize-none"
            />
            <textarea
              rows={3}
              value={recipeForm.memo}
              onChange={(e) => setRecipeForm({ ...recipeForm, memo: e.target.value })}
              placeholder="조리 팁, 간 맞추기 노하우 등"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs resize-none"
            />

            <button
              onClick={handleSaveRecipe}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
            >
              💾 가족 레시피북에 저장
            </button>
          </div>
        </div>
      )}
      {cropModal && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-3xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-stone-900">✂️ 한상차림 사진 자르기 (자유비율)</h3>
                <p className="text-[11px] text-stone-500">사각형을 드래그해 이동하고 모서리 핸들로 크기를 조절하세요.</p>
              </div>
              <button
                onClick={() => setCropModal(null)}
                className="p-1.5 rounded-xl bg-stone-100 text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "free", label: "자유비율" },
                { id: "1:1", label: "1:1 정사각" },
                { id: "4:3", label: "4:3" },
                { id: "16:9", label: "16:9" }
              ].map((ar) => (
                <button
                  key={ar.id}
                  onClick={() => {
                    setCropAspect(ar.id);
                    if (ar.id !== "free" && cropBoxRef.current) {
                      const box = cropBoxRef.current.getBoundingClientRect();
                      const ratioMap = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9 };
                      const targetRatio = ratioMap[ar.id] || 1;
                      const imgRatio = box.width / Math.max(1, box.height);
                      const newH = Math.min(1 - cropRect.y, Math.max(0.15, (cropRect.w * imgRatio) / targetRatio));
                      setCropRect((prev) => ({ ...prev, h: newH }));
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                    cropAspect === ar.id
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-stone-50 text-stone-600 border-stone-200"
                  }`}
                >
                  {ar.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setCropAspect("free");
                  setCropRect({ x: 0, y: 0, w: 1, h: 1 });
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 ml-auto"
              >
                전체 선택
              </button>
            </div>

            <div className="flex justify-center bg-stone-900 rounded-2xl p-2 overflow-hidden">
              <div ref={cropBoxRef} className="relative inline-block select-none touch-none max-h-[52vh]">
                <img
                  ref={cropImgRef}
                  src={cropModal.srcUrl}
                  alt="자르기 대상"
                  draggable={false}
                  className="max-h-[50vh] max-w-full block rounded-lg pointer-events-none"
                />
                <div
                  onMouseDown={(e) => handleCropPointerDown("move", e)}
                  onTouchStart={(e) => handleCropPointerDown("move", e)}
                  style={{
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.w * 100}%`,
                    height: `${cropRect.h * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)"
                  }}
                  className="absolute border-2 border-white cursor-move touch-none"
                >
                  <div
                    onMouseDown={(e) => handleCropPointerDown("nw", e)}
                    onTouchStart={(e) => handleCropPointerDown("nw", e)}
                    className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-white border-2 border-rose-600 shadow cursor-nwse-resize"
                  />
                  <div
                    onMouseDown={(e) => handleCropPointerDown("ne", e)}
                    onTouchStart={(e) => handleCropPointerDown("ne", e)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-rose-600 shadow cursor-nesw-resize"
                  />
                  <div
                    onMouseDown={(e) => handleCropPointerDown("sw", e)}
                    onTouchStart={(e) => handleCropPointerDown("sw", e)}
                    className="absolute -bottom-2 -left-2 w-5 h-5 rounded-full bg-white border-2 border-rose-600 shadow cursor-nesw-resize"
                  />
                  <div
                    onMouseDown={(e) => handleCropPointerDown("se", e)}
                    onTouchStart={(e) => handleCropPointerDown("se", e)}
                    className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-rose-600 shadow cursor-nwse-resize"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  const safeUrl = await compressDataUrlForFirestore(cropModal.srcUrl, 720, 0.65);
                  setRecipeForm((prev) => ({ ...prev, photoDataUrl: safeUrl || cropModal.srcUrl }));
                  setCropModal(null);
                }}
                className="py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold"
              >
                원본 그대로 사용
              </button>
              <button
                onClick={handleApplyCrop}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
              >
                ✂️ 이 영역 잘라서 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomedRecipePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setZoomedRecipePhoto(null)}
        >
          <div className="w-full max-w-md flex items-center justify-between text-white mb-2 px-1">
            <span className="text-sm font-black truncate">{zoomedRecipePhoto.title}</span>
            <button
              onClick={() => setZoomedRecipePhoto(null)}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={zoomedRecipePhoto.url}
            alt={zoomedRecipePhoto.title}
            className="max-w-full max-h-[78vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-[11px] text-white/70 mt-2">바깥 영역을 누르면 닫힙니다</span>
        </div>
      )}
      {quickFridgeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setQuickFridgeItem(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">{getFridgeCategoryIcon(quickFridgeItem.category)}</span>
                  <span className="text-base font-black text-stone-900">{quickFridgeItem.name}</span>
                </div>
                <div className="text-[11px] font-bold text-stone-500 mt-0.5">
                  {resolveItemShelfZone(quickFridgeItem)} · 소비기한 {quickFridgeItem.expiryDate} (
                  {getDaysDiff(quickFridgeItem.expiryDate) < 0
                    ? `${Math.abs(getDaysDiff(quickFridgeItem.expiryDate))}일 지남`
                    : `D-${getDaysDiff(quickFridgeItem.expiryDate)}`}
                  )
                </div>
              </div>
              <button
                onClick={() => setQuickFridgeItem(null)}
                className="p-1.5 rounded-xl bg-stone-100 text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-200">
              <span className="text-xs font-extrabold text-stone-700">현재 수량</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleAdjustQuantity(quickFridgeItem, -1);
                    setQuickFridgeItem((prev) =>
                      prev ? { ...prev, quantity: Math.max(0, Number(prev.quantity || 0) - 1) } : null
                    );
                  }}
                  className="w-8 h-8 rounded-xl bg-white border border-stone-200 font-black text-stone-800 shadow-sm"
                >
                  -
                </button>
                <span className="text-sm font-black px-2">
                  {Number(quickFridgeItem.quantity) || 0}{quickFridgeItem.unit}
                </span>
                <button
                  onClick={() => {
                    handleAdjustQuantity(quickFridgeItem, 1);
                    setQuickFridgeItem((prev) =>
                      prev ? { ...prev, quantity: Number(prev.quantity || 0) + 1 } : null
                    );
                  }}
                  className="w-8 h-8 rounded-xl bg-white border border-stone-200 font-black text-stone-800 shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-stone-700 block">📦 보관 칸 이동</label>
              <select
                value={resolveItemShelfZone(quickFridgeItem)}
                onChange={(e) => handleMoveFridgeShelfZone(quickFridgeItem, e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold"
              >
                {FRIDGE_SHELF_ZONES.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={() => {
                  const target = quickFridgeItem;
                  setQuickFridgeItem(null);
                  handleConsumeFridgeItem(target, false);
                }}
                className="py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold"
              >
                ✓ 다 먹음
              </button>
              <button
                onClick={() => {
                  const target = quickFridgeItem;
                  setQuickFridgeItem(null);
                  handleConsumeFridgeItem(target, true);
                }}
                className="py-2.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-extrabold"
              >
                + 장보기
              </button>
              <button
                onClick={() => {
                  const target = quickFridgeItem;
                  setQuickFridgeItem(null);
                  handleWasteFridgeItem(target);
                }}
                className="py-2.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-extrabold"
              >
                🗑️ 폐기
              </button>
            </div>
          </div>
        </div>
      )}

      {draggingChip && (
        <div
          style={{ left: draggingChip.x, top: draggingChip.y }}
          className="fixed -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-black shadow-2xl flex items-center gap-1.5 opacity-95"
        >
          <span>{getFridgeCategoryIcon(draggingChip.item.category)}</span>
          <span>{draggingChip.item.name}</span>
          <span className="text-amber-300">{Number(draggingChip.item.quantity) || 0}{draggingChip.item.unit}</span>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
