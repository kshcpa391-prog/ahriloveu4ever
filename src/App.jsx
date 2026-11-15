import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Utensils,
  Calendar,
  Package,
  Sparkles,
  ShoppingCart,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
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
  Heart,
  Cake,
  CalendarDays,
  Star,
  Clock,
  FileJson,
  RotateCcw,
  Mail,
  CloudUpload,
  ClipboardList,
  ListTodo,
  CalendarRange,
  Baby,
  LayoutGrid,
  Activity,
  Stethoscope
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
  runTransaction
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

async function callOpenAiEngine({ openaiKey, promptText, imagePart = null, temperature = 0.5 }) {
  const cleanKey = String(openaiKey || "").trim();
  if (!cleanKey) throw new Error("OpenAI API 키가 비어 있습니다.");

  const userContent = [{ type: "text", text: promptText }];
  if (imagePart) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${imagePart.mimeType};base64,${imagePart.base64}`
      }
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature,
        messages: [
          {
            role: "system",
            content:
              "You are an expert Korean culinary & OCR AI. Output ONLY a valid JSON array. No markdown fences."
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
    const parsed = extractJsonArray(text);
    if (!parsed) throw new Error("[GPT] 응답을 JSON 배열로 변환하지 못했습니다.");
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

    const geminiBody = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json"
      }
    });

    const trySingleModel = async (modelId) => {
      const cleanModel = String(modelId).replace(/^models\//, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
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
          const parsed = extractJsonArray(text);
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
      temperature
    });

  // 엔진 선택 정책에 따른 실행 및 자동 페일오버
  if (aiProvider === "openai") {
    const res = await runOpenAi();
    if (onProviderUsed) onProviderUsed("OpenAI GPT");
    return res;
  }
  if (aiProvider === "gemini") {
    const res = await runGemini();
    if (onProviderUsed) onProviderUsed("Gemini");
    return res;
  }

  // auto 모드: OpenAI 키가 있으면 GPT 우선 -> 실패 시 Gemini / 없으면 Gemini -> GPT
  const errors = [];
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

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIDE = 720;
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
        const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        resolve({
          base64: dataUrl.split(",")[1],
          mimeType: "image/jpeg",
          previewUrl: dataUrl
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

const STORAGE_LOCATIONS = ["냉장실", "냉동실", "실온·팬트리"];
const FRIDGE_CATEGORIES = ["채소/과일", "육류/수산", "유제품/계란", "유아식/이유식 재료", "반찬/김치", "밀키트", "양념/소스", "기타"];
const SCHEDULE_CATEGORIES = ["기념일/생일", "할일(To-Do)", "육아/병원", "가족행사/경조사"];

const APP_CODE_VERSION = "v8.7";
const APP_BUILD_DATE = "2026-11-15 22:28";
const EDITOR_INVITE_CODE = "0402";

const INITIAL_PATCH_NOTES = [
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
function MainApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(() => getTodayStr());
  const [selectedMember, setSelectedMember] = useState("전체");

  // 상단 바 펼치기/접기 및 틀고정(Sticky) 해제 상태
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => {
    return localStorage.getItem("kim_header_collapsed") === "true";
  });
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
  const [isTopAlertsExpanded, setIsTopAlertsExpanded] = useState(false);
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
    recordExpense: true
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
        if (remote.length > 0) {
          setDeletedLogs(remote);
          try {
            localStorage.setItem("kim_deleted_logs_v1", JSON.stringify(remote));
          } catch (e) {}
        }
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
          pushAiLog("Gemini", "자가진단", true, "정상 연결");
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
                if (f && f.id) loaded[f.id] = f;
              });
            } else if (raw.name && (raw.location || raw.category || raw.expiryDate !== undefined)) {
              loaded[d.id] = { ...raw, id: d.id };
            }
          });
          setFridgeMap((prev) => ({ ...prev, [`src_${idx}`]: loaded }));
        },
        () => {}
      );
      unsubscribers.push(unsub);
    });

    unsubscribers.push(
      onSnapshot(
        getColRef("family_expenses_v4"),
        (snap) => {
          setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => {}
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_inventory_events_v7"),
        (snap) => {
          setWasteEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => {}
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
        () => {}
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
        () => {}
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
        () => {}
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_shopping_v4"),
        async (snap) => {
          const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (loaded.length === 0 && !localStorage.getItem("kim_shopping_seeded_v5")) {
            localStorage.setItem("kim_shopping_seeded_v5", "true");
            setShoppingList(INITIAL_SHOPPING);
            for (const s of INITIAL_SHOPPING) {
              try {
                await setDoc(getDocRef("family_shopping_v4", s.id), s);
              } catch (e) {}
            }
          } else {
            setShoppingList(loaded);
          }
        },
        () => {}
      )
    );

    unsubscribers.push(
      onSnapshot(
        getColRef("family_notices_v4"),
        async (snap) => {
          const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (loaded.length === 0 && !localStorage.getItem("kim_notices_seeded_v5")) {
            localStorage.setItem("kim_notices_seeded_v5", "true");
            setNotices(INITIAL_NOTICES);
            for (const n of INITIAL_NOTICES) {
              try {
                await setDoc(getDocRef("family_notices_v4", n.id), n);
              } catch (e) {}
            }
          } else {
            setNotices(loaded);
          }
        },
        () => {}
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
          const delList = JSON.parse(localStorage.getItem("kim_family_deleted_ids") || "[]");

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
        () => {}
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
          const combined = [...loaded, ...missingDefaults].sort((a, b) =>
            String(b.version || "").localeCompare(String(a.version || ""))
          );
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

  // 하루 2번(오전 AM / 오후 PM) 자동 클라우드 스냅샷 백업 엔진
  useEffect(() => {
    if (!isEditorUnlocked || !user || !db || meals.length === 0) return;
    const currentSlot = getTwiceDailySlotKey();
    if (lastAutoBackupSlot === currentSlot) return;

    const timer = setTimeout(async () => {
      try {
        const snapshotPayload = {
          slot: currentSlot,
          createdAt: new Date().toISOString(),
          counts: {
            meals: meals.length,
            fridge: fridge.length,
            schedules: schedules.length
          },
          data: {
            meals,
            fridge,
            expenses,
            shoppingList,
            notices,
            schedules,
            patchNotes,
            wasteEvents,
            babyChecks,
            babyGrowthLogs,
            babyMedicalNotes
          }
        };
        await setDoc(getDocRef("family_backups_v4", currentSlot), snapshotPayload);
        await setDoc(
          getDocRef("family_meta_v4", "backup_status"),
          { lastSlot: currentSlot, updatedAt: new Date().toISOString(), email: backupEmail },
          { merge: true }
        );
        setLastAutoBackupSlot(currentSlot);
        localStorage.setItem("kim_twice_daily_backup_slot", currentSlot);
      } catch (e) {
        console.warn("Auto snapshot warning:", e);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [user, meals.length, fridge.length, schedules.length, lastAutoBackupSlot]);

  // 상단 바 접기/펼치기 및 틀고정 토글 핸들러
  const handleToggleHeaderCollapse = () => {
    const next = !isHeaderCollapsed;
    setIsHeaderCollapsed(next);
    localStorage.setItem("kim_header_collapsed", String(next));
  };

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

  const weekDates = useMemo(() => getWeekDatesFromBase(selectedDate), [selectedDate]);
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
        notices,
        schedules,
        patchNotes,
        deletedIds,
        wasteEvents,
        babyChecks,
        babyGrowthLogs,
        babyMedicalNotes
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

      const confirmRestore = window.confirm(
        `백업 파일을 불러올까요?\n(식단 ${(payload.meals || []).length}건, 냉장고 ${(payload.fridge || []).length}건, 일정 ${(payload.schedules || []).length}건이 현재 데이터에 병합·복원됩니다.)`
      );
      if (!confirmRestore) {
        if (jsonRestoreInputRef.current) jsonRestoreInputRef.current.value = "";
        return;
      }

      setIsRestoringJson(true);

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
    if (!growthForm.height && !growthForm.weight && !growthForm.head) return;
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
      } catch (e) {}
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
      } catch (e) {}
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
      } catch (e) {}
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
      } catch (e) {}
    }
    showToast("To-Do 체크리스트에 새 할 일이 추가되었습니다!");
  };

  const handleToggleScheduleDone = async (item) => {
    if (!requireEditorAccess()) return;
    const updated = { ...item, done: !item.done };
    setSchedules((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", item.id), updated);
      } catch (e) {}
    }
  };

  const handleDeleteSchedule = async (item) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 삭제할 수 있습니다.");
      return;
    }
    beginWrite();
    try {
      const entry = await recordDeletedLog("schedule", item.title || "가족 일정", item, "delete");
      await markIdDeleted(item.id);
      await deleteDoc(getDocRef("family_schedules_v4", item.id));
      setSchedules((prev) => prev.filter((s) => s.id !== item.id));
      endWrite(true);
      showToast(`'${item.title || "일정"}' 삭제됨`, entry ? () => restoreDeletedLogEntry(entry) : null);
    } catch (e) {
      endWrite(false, e.message);
      showToast("⚠️ 일정 삭제 실패: 네트워크 상태를 확인해 주세요.");
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

  const handlePlatingImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPlatingErrorMsg("");
    setPlatingResult(null);
    setPlatingExampleImageUrl("");
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
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
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
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

  const handleReceiptImageUpload = async (e) => {
    if (!requireEditorAccess()) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptErrorMsg("");
    setIsReceiptScanning(true);
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setReceiptPreviewUrl(previewUrl);

      const promptText = `영수증 이미지에서 품목명, 수량, 결제 금액을 읽어 순수 JSON 배열로만 출력하세요 (소비기한은 ${selectedDate} 기준 산정):
[{"name":"품목명","location":"냉장실","category":"채소/과일","quantity":1,"unit":"개","expiryDate":"2026-11-24","price":5000}]`;

      const parsedArray = await callReliableAiEngine({
        apiKey: geminiApiKey,
        openaiApiKey,
        aiProvider,
        promptText,
        imagePart: { base64, mimeType },
        temperature: 0.1
      });

      setScannedReceiptItems(parsedArray);
      showToast(`영수증에서 총 ${parsedArray.length}개 품목을 빠르게 읽어왔습니다!`);
    } catch (err) {
      console.error(err);
      setReceiptErrorMsg(err.message);
    } finally {
      setIsReceiptScanning(false);
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
    }
  };

  // ==========================================
  // 10. 냉장고·식단·장보기·공지사항 핸들러
  // ==========================================
  const handleSaveFridge = async () => {
    if (!requireEditorAccess()) return;
    if (!fridgeForm.name.trim()) return;
    const id = editingFridge ? editingFridge.id : `f-${Date.now()}`;
    const priceNum = Number(fridgeForm.price) || 0;

    const payload = {
      id,
      name: fridgeForm.name.trim(),
      location: fridgeForm.location,
      category: fridgeForm.category,
      quantity: Number(fridgeForm.quantity) || 1,
      unit: fridgeForm.unit || "개",
      expiryDate: fridgeForm.expiryDate || getTodayStr(),
      price: priceNum,
      purchaseDate: fridgeForm.purchaseDate || selectedDate
    };

    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [id]: payload }
    }));

    setIsFridgeModalOpen(false);
    setEditingFridge(null);

    if (user && db) {
      try {
        await setDoc(getDocRef("family_fridge_v3", id), payload);
        await setDoc(getDocRef("family_fridge_v4", id), payload);

        if (!editingFridge && priceNum > 0 && fridgeForm.recordExpense !== false) {
          const expId = `exp-${id}`;
          await setDoc(getDocRef("family_expenses_v4", expId), {
            id: expId,
            title: payload.name,
            category: payload.category,
            amount: priceNum,
            date: payload.purchaseDate,
            type: "장보기/식재료"
          });
        }
      } catch (e) {}
    }
    showToast(editingFridge ? "냉장고 재료가 수정되었습니다." : "냉장고에 새 재료가 입고되었습니다.");
  };

  const handleAdjustQuantity = async (item, delta) => {
    if (!requireEditorAccess()) return;
    if (!Number.isFinite(delta)) return;
    const optimisticNext = Math.max(0, Number(item.quantity || 0) + delta);
    const updated = { ...item, quantity: optimisticNext };
    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [item.id]: updated }
    }));
    if (user && db) {
      try {
        const ref = getDocRef("family_fridge_v4", item.id);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) {
            throw new Error("이미 삭제되었거나 존재하지 않는 재고입니다.");
          }
          const serverQty = Number(snap.data().quantity || 0);
          const next = serverQty + delta;
          if (!Number.isFinite(next) || next < 0) {
            throw new Error("재고가 부족하여 차감할 수 없습니다.");
          }
          tx.update(ref, { quantity: next, updatedAt: new Date().toISOString() });
        });
      } catch (e) {
        setFridgeMap((prev) => ({
          ...prev,
          local: { ...(prev.local || {}), [item.id]: item }
        }));
        showToast(`⚠️ ${e.message || "수량 저장 실패"}`);
      }
    }
  };

  // [신규 v6.2] 냉장고 식재료 폐기(소비기한 경과 등) -> 손실 금액 별도 기록
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
    const fridgeNames = fridge.map((f) => String(f.name || "").toLowerCase());
    const missing = toSafeArray(usedIngs).filter(
      (ing) => !fridgeNames.some((fn) => fn.includes(ing.toLowerCase()) || ing.toLowerCase().includes(fn))
    );
    if (missing.length === 0) {
      showToast("모든 재료가 이미 냉장고에 있습니다!");
      return;
    }
    for (const ing of missing) {
      const shId = `sh-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newShop = {
        id: shId,
        name: ing,
        quantity: "1개",
        category: "기타",
        urgent: false,
        checked: false,
        memo: "AI 레시피 부족 재료"
      };
      setShoppingList((prev) => [newShop, ...prev]);
      if (user && db) {
        try {
          await setDoc(getDocRef("family_shopping_v4", shId), newShop);
        } catch (e) {}
      }
    }
    showToast(`부족한 재료 ${missing.length}종을 장보기 목록에 담았습니다!`);
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
            const ref = getDocRef("family_fridge_v4", entry.item.id);
            const snap = await tx.get(ref);
            if (!snap.exists()) {
              throw new Error(`'${entry.item.name}' 재고를 찾을 수 없습니다.`);
            }
            const cur = Number(snap.data().quantity || 0);
            const next = cur - entry.deductQty;
            if (!Number.isFinite(next) || next < 0) {
              throw new Error(`'${entry.item.name}' 재고가 부족합니다 (현재고 ${cur}).`);
            }
            snapshots.push({ ref, next });
          }
          for (const s of snapshots) {
            tx.update(s.ref, { quantity: s.next, updatedAt: new Date().toISOString() });
          }
          tx.set(opRef, {
            id: opId,
            recipeTitle: cookingConfirmModal.recipeTitle,
            status: "completed",
            createdAt: new Date().toISOString()
          });
        });
        if (alreadyProcessed) {
          setCookingConfirmModal(null);
          showToast("이미 처리된 요리 완료 기록입니다.");
          return;
        }
        endWrite(true);
        setCookingConfirmModal(null);
        showToast(`요리 완료! 선택한 재료 ${toDeduct.length}종이 안전하게 일괄 차감되었습니다.`);
      } catch (e) {
        endWrite(false, e.message);
        showToast(`⚠️ 차감 실패(전체 취소됨): ${e.message}`);
      } finally {
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
      } catch (e) {}
    }

    await markIdDeleted(item.id);
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_fridge_v3", item.id));
        await deleteDoc(getDocRef("family_fridge_v4", item.id));
        await deleteDoc(getDocRef("family_meals_v3", item.id));
      } catch (e) {}
    }

    if (addToShopping) {
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
        } catch (e) {}
      }
      showToast(`'${item.name}' 소진 완료! (식비 유지 & 장보기 메모 추가됨)`);
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
    beginWrite();
    try {
      const entry = await recordDeletedLog("fridge", item.name || "냉장고 재료", item, "delete");
      await markIdDeleted(item.id);
      await deleteDoc(getDocRef("family_fridge_v3", item.id));
      await deleteDoc(getDocRef("family_fridge_v4", item.id));
      await deleteDoc(getDocRef("family_meals_v3", item.id));
      await deleteDoc(getDocRef("family_expenses_v4", `exp-${item.id}`));
      setExpenses((prev) => prev.filter((e) => e.id !== `exp-${item.id}`));
      endWrite(true);
      showToast(`'${item.name}' 삭제됨`, entry ? () => restoreDeletedLogEntry(entry) : null);
    } catch (e) {
      endWrite(false, e.message);
      showToast("⚠️ 재고 삭제 실패: 네트워크 상태를 확인해 주세요.");
    }
  };

  const handleSaveMeal = async () => {
    if (!requireEditorAccess()) return;
    if (!mealForm.menu.trim()) return;
    const id = editingMeal ? editingMeal.id : `m-${Date.now()}`;
    const safeMembers = toSafeArray(mealForm.members);
    const payload = {
      id,
      date: mealForm.date,
      slot: mealForm.slot,
      menu: mealForm.menu.trim(),
      members: safeMembers.length > 0 ? safeMembers : ["수혁", "아리나"],
      ingredients: toSafeArray(mealForm.ingredients),
      note: mealForm.note || "",
      sourceType: mealForm.sourceType || "집밥/온가족식",
      cost: Number(mealForm.cost) || 0
    };

    setMealsMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [id]: payload }
    }));

    setIsMealModalOpen(false);
    setEditingMeal(null);
    if (!user || !db) {
      showToast("⚠️ 서버 미연결 상태입니다. 연결 후 다시 저장해 주세요.");
      return;
    }
    beginWrite();
    try {
      await setDoc(getDocRef("family_meals_v3", id), payload);
      await setDoc(getDocRef("family_meals_v4", id), payload);
      endWrite(true);
      showToast("식단이 저장되었습니다.");
    } catch (e) {
      endWrite(false, e.message);
      showToast("⚠️ 식단 저장 실패: 네트워크 상태를 확인해 주세요.");
    }
  };

  const handleDeleteMeal = async (meal) => {
    if (!requireEditorAccess()) return;
    if (!user || !db) {
      showToast("⚠️ 서버 연결 후 삭제할 수 있습니다.");
      return;
    }
    beginWrite();
    try {
      const entry = await recordDeletedLog("meal", meal.menu || "식단", meal, "delete");
      await markIdDeleted(meal.id);
      await deleteDoc(getDocRef("family_meals_v3", meal.id));
      await deleteDoc(getDocRef("family_meals_v4", meal.id));
      endWrite(true);
      showToast(`'${meal.menu || "식단"}' 삭제됨`, entry ? () => restoreDeletedLogEntry(entry) : null);
    } catch (e) {
      endWrite(false, e.message);
      showToast("⚠️ 식단 삭제 실패: 네트워크 상태를 확인해 주세요.");
    }
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
      } catch (e) {}
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
      } catch (e) {}
    }
  };

  const handleDeleteShopping = async (id) => {
    if (!requireEditorAccess()) return;
    setShoppingList((prev) => prev.filter((s) => s.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_shopping_v4", id));
      } catch (e) {}
    }
  };

  const handleConfirmStockIn = async () => {
    if (!requireEditorAccess()) return;
    if (!stockInItem) return;
    const fId = `f-${Date.now()}`;
    const priceNum = Number(stockInPrice) || 0;
    const expDateObj = new Date();
    expDateObj.setDate(expDateObj.getDate() + 10);

    const newFridgeItem = {
      id: fId,
      name: stockInItem.name,
      location: "냉장실",
      category: stockInItem.category || "채소/과일",
      quantity: 1,
      unit: stockInItem.quantity || "개",
      expiryDate: formatDate(expDateObj),
      price: priceNum,
      purchaseDate: selectedDate
    };

    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [fId]: newFridgeItem }
    }));
    setShoppingList((prev) => prev.filter((s) => s.id !== stockInItem.id));

    if (user && db) {
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
      } catch (e) {}
    }
    setStockInItem(null);
    setStockInPrice("");
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
      } catch (e) {}
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
      } catch (e) {}
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!requireEditorAccess()) return;
    setNotices((prev) => prev.filter((n) => n.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_notices_v4", id));
      } catch (e) {}
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
      } catch (e) {}
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

    const combinedLedger = [...ledgerItems, ...unrecordedFridgeAsLedger];
    const diningItems = meals.filter(
      (m) => String(m.date || "").startsWith(monthPrefix) && Number(m.cost) > 0
    );

    const groceryTotal = combinedLedger.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const diningTotal = diningItems.reduce((acc, cur) => acc + (Number(cur.cost) || 0), 0);
    const total = groceryTotal + diningTotal;
    const monthWasteItems = wasteEvents.filter((w) => String(w.date || "").startsWith(monthPrefix));
    const wasteTotal = monthWasteItems.reduce((acc, cur) => acc + (Number(cur.estimatedLoss) || 0), 0);

    return {
      groceryTotal,
      diningTotal,
      total,
      wasteTotal,
      wasteCount: monthWasteItems.length,
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

        <div className="space-y-1.5 mb-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
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
                className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 inline-flex items-center gap-1 whitespace-nowrap"
                title="패치노트 기록 및 히스토리"
              >
                <ClipboardList className="w-3 h-3 text-stone-600 shrink-0" />
                <span>패치노트 {APP_CODE_VERSION}</span>
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setIsEditorUnlockModalOpen(true)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1 whitespace-nowrap ${
                isEditorUnlocked
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
              }`}
              title={isEditorUnlocked ? "편집 가능 (초대 링크/잠금)" : "열람 전용 모드 (초대 코드 입력)"}
            >
              <span>{isEditorUnlocked ? "✏️ 편집가능" : "🔒 열람전용"}</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("monthly");
                setMonthlySubTab("expense");
              }}
              className="px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>💰 {currentMonth.slice(5)}월 {monthlyExpenseSummary.total.toLocaleString()}원</span>
            </button>
          </div>
        </div>

        {!isHeaderCollapsed && (
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
            우리 가족 식탁 🍽️
          </h1>

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

            <button
              onClick={handleToggleHeaderCollapse}
              className="px-2 py-1 rounded-lg bg-stone-900 text-white text-[10px] font-extrabold flex items-center gap-0.5"
              title="상단 메뉴 바 접기/펼치기"
            >
              <span>{isHeaderCollapsed ? "펼치기" : "접기"}</span>
              {isHeaderCollapsed ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronUp className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {!isHeaderCollapsed && (
          <>
            {/* 핵심 1줄 요약 바 (단일 행 가로 스크롤 지원) + 상세 펼치기 */}
            <div className="mt-2 flex items-center justify-between gap-1.5 bg-stone-50 border border-stone-200/90 rounded-2xl px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto min-w-0">
                <button
                  onClick={() => setIsTopAlertsExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-stone-800 whitespace-nowrap shrink-0"
                >
                  <span>{weatherInfo ? `${weatherInfo.emoji} ${weatherInfo.temp}°C` : "🌤️ 날씨"}</span>
                  {weatherInfo && (
                    <span className="text-[11px] font-semibold text-stone-500">
                      · 미세{weatherInfo.pm10}
                    </span>
                  )}
                </button>
                {imminentSchedulesWithin3Days.length > 0 && (
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-extrabold whitespace-nowrap shrink-0"
                  >
                    일정 {imminentSchedulesWithin3Days.length}
                  </button>
                )}
                {pinnedNotices.length > 0 && (
                  <button
                    onClick={() => setActiveTab("notices")}
                    className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold whitespace-nowrap shrink-0"
                  >
                    공지 {pinnedNotices.length}
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsTopAlertsExpanded((v) => !v)}
                className="px-2.5 py-1 rounded-xl bg-white border border-stone-200 text-[11px] font-extrabold text-stone-700 shrink-0 whitespace-nowrap"
              >
                {isTopAlertsExpanded ? "요약 ▲" : "상세 ▼"}
              </button>
            </div>

            {isTopAlertsExpanded && (
              <>
            {/* 서울 중구 실시간 날씨 · 주간예보 · 미세먼지 바 (접기 시 함께 접힘) */}
            {weatherInfo ? (
              <div className="mt-2 bg-sky-50/80 border border-sky-200/80 rounded-2xl px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setIsWeeklyWeatherOpen((prev) => !prev)}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                    title="눌러서 주간 날씨 펼치기/접기"
                  >
                    <span className="text-lg shrink-0">{weatherInfo.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-stone-900 truncate flex items-center gap-1">
                        <span>
                          {weatherInfo.location} {weatherInfo.temp}°C
                        </span>
                        <span className="text-[10px] font-bold text-stone-500">
                          ({weatherInfo.min}°/{weatherInfo.max}°)
                        </span>
                        <span className="text-[9px] font-extrabold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded-full">
                          주간 {isWeeklyWeatherOpen ? "▲" : "▼"}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-stone-600 truncate">
                        {weatherInfo.tip}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      fetchSeoulJungGuWeather();
                      showToast("서울 중구 날씨·주간예보·미세먼지를 새로고침했습니다.");
                    }}
                    className={`px-2 py-1 rounded-xl border text-[10px] font-extrabold shrink-0 text-right ${weatherInfo.dust.badgeClass}`}
                    title="눌러서 날씨·미세먼지 새로고침"
                  >
                    <div>
                      {weatherInfo.dust.emoji} 미세 {weatherInfo.pm10} · 초미세 {weatherInfo.pm25}
                    </div>
                    <div className="text-[9px] opacity-85">
                      {weatherInfo.dust.label} · {weatherInfo.updatedTime} ↻
                    </div>
                  </button>
                </div>

                {isWeeklyWeatherOpen && Array.isArray(weatherInfo.weekly) && weatherInfo.weekly.length > 0 && (
                  <div className="pt-2 border-t border-sky-200/70">
                    <div className="grid grid-cols-7 gap-1">
                      {weatherInfo.weekly.map((day, idx) => (
                        <div
                          key={day.date}
                          className={`rounded-xl py-1.5 px-0.5 text-center border ${
                            idx === 0
                              ? "bg-white border-sky-300 shadow-sm"
                              : "bg-white/60 border-sky-100"
                          }`}
                        >
                          <div className={`text-[9px] font-black ${idx === 0 ? "text-sky-700" : "text-stone-500"}`}>
                            {day.dayName}
                          </div>
                          <div className="text-sm my-0.5 leading-none">{day.emoji}</div>
                          <div className="text-[9px] font-extrabold text-stone-800 leading-tight">
                            <span className="text-rose-600">{day.max}°</span>
                            <span className="text-stone-400">/</span>
                            <span className="text-blue-600">{day.min}°</span>
                          </div>
                          {day.rainProb > 0 && (
                            <div className="text-[8px] font-bold text-sky-600 mt-0.5">
                              💧{day.rainProb}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-[9px] text-stone-400 text-right mt-1">
                      Open-Meteo 실시간 연동 (15분마다 자동 갱신)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 bg-sky-50/70 border border-sky-200/80 rounded-2xl px-3 py-2 flex items-center justify-between text-[11px] font-bold text-sky-900">
                <span>
                  {isWeatherLoading
                    ? "🌤️ 서울 중구 실시간 날씨·미세먼지 불러오는 중..."
                    : `⚠️ ${weatherError || "날씨 정보를 불러오지 못했습니다."}`}
                </span>
                <button
                  onClick={fetchSeoulJungGuWeather}
                  className="px-2 py-0.5 rounded-lg bg-white border border-sky-300 text-[10px] font-extrabold text-sky-800"
                >
                  새로고침 ↻
                </button>
              </div>
            )}


            {imminentSchedulesWithin3Days.length > 0 && activeTab !== "schedule" && (
              <div
                onClick={() => setActiveTab("schedule")}
                className="mt-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl px-3 py-2 cursor-pointer transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-rose-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    <span>3일 이내 도래하는 가족 일정 ({imminentSchedulesWithin3Days.length}건)</span>
                  </span>
                  <span className="text-[10px] font-extrabold text-rose-600">일정표 열기 &gt;</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {imminentSchedulesWithin3Days.map((ev) => (
                    <span
                      key={ev.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-rose-200 text-[11px] font-extrabold text-rose-900"
                    >
                      <span>{ev.title}</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-black">
                        {ev.calc.dDayText}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {pinnedNotices.length > 0 && activeTab !== "notices" && (
              <div
                onClick={() => setActiveTab("notices")}
                className="mt-2 bg-indigo-50/90 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl px-3 py-2 cursor-pointer flex items-start justify-between gap-2 transition"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <Pin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-snug break-keep">
                    <span className="font-extrabold text-indigo-900 mr-1">[가족공지]</span>
                    <span className="font-semibold text-indigo-800">{pinnedNotices[0].title}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 shrink-0 mt-0.5">
                  전체보기 &gt;
                </span>
              </div>
            )}

              </>
            )}

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setIsQuickMenuExpanded((v) => !v)}
                className="w-full py-1.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-xs font-extrabold text-stone-700 flex items-center justify-between"
              >
                <span>🧭 전체 바로가기 (9개 메뉴)</span>
                <span>{isQuickMenuExpanded ? "접기 ▲" : "펼치기 ▼"}</span>
              </button>
            </div>

            {isQuickMenuExpanded && (
            <div className="grid grid-cols-3 gap-1.5 mt-1.5 bg-stone-100 p-1.5 rounded-2xl">
              {[
                { id: "daily", label: "일별식단", icon: "🍽️" },
                { id: "weekly", label: "주간요약", icon: "📊" },
                { id: "monthly", label: "월간·식비", icon: "💰" },
                {
                  id: "schedule",
                  label: "일정",
                  icon: "🗓️",
                  badge: imminentSchedulesWithin3Days.length
                },
                { id: "baby", label: "육아수첩", icon: "👶" },
                { id: "fridge", label: "냉장고", icon: "❄️" },
                {
                  id: "shopping",
                  label: "장보기",
                  icon: "🛒",
                  badge: shoppingList.filter((s) => !s.checked).length
                },
                {
                  id: "notices",
                  label: "가족공지",
                  icon: "📌",
                  badge: notices.filter((n) => !n.done).length
                },
                { id: "ai", label: "AI추천", icon: "✨" }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative h-9 px-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition flex items-center justify-center gap-1 ${
                    activeTab === t.id
                      ? "bg-stone-900 text-white shadow-sm"
                      : "bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/80"
                  }`}
                >
                  <span className="text-xs leading-none">{t.icon}</span>
                  <span className="tracking-tight leading-none">{t.label}</span>
                  {t.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[9px] rounded-full bg-orange-500 text-white font-black flex items-center justify-center shadow-sm">
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
            )}
          </>
        )}
      </header>

      {/* ==========================================
          탭 1: 일별 식단
      ========================================== */}
      {activeTab === "daily" && (
        <div className="p-4 space-y-3.5">
          <button
            onClick={() => {
              setScanTargetMonth(selectedDate.slice(0, 7));
              setIsDaycareModalOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-amber-50/90 border border-amber-200 hover:bg-amber-100 transition flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-extrabold text-amber-900 truncate">
                식단표 AI 스캔 (어린이집·손글씨)
              </span>
            </div>
            <span className="text-[11px] font-bold text-amber-700 shrink-0">열기 &gt;</span>
          </button>

          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <button
                onClick={() => {
                  const d = new Date(selectedDate + "T00:00:00");
                  d.setDate(d.getDate() - 1);
                  const next = formatDate(d);
                  setSelectedDate(next);
                  setCurrentMonth(next.slice(0, 7));
                }}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (e.target.value) setCurrentMonth(e.target.value.slice(0, 7));
                  }}
                  className="text-sm font-black text-stone-900 bg-transparent focus:outline-none"
                />
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {getDayName(selectedDate)}요일
                </span>
                {selectedDate !== getTodayStr() ? (
                  <button
                    onClick={() => {
                      const today = getTodayStr();
                      setSelectedDate(today);
                      setCurrentMonth(today.slice(0, 7));
                    }}
                    className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-sm"
                  >
                    오늘로
                  </button>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                    오늘
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  const d = new Date(selectedDate + "T00:00:00");
                  d.setDate(d.getDate() + 1);
                  const next = formatDate(d);
                  setSelectedDate(next);
                  setCurrentMonth(next.slice(0, 7));
                }}
                className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((d) => {
                const isSel = d === selectedDate;
                const isToday = d === getTodayStr();
                const count = meals.filter((m) => m.date === d).length;
                const dayEvents = getSchedulesForDate(d);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDate(d);
                      setCurrentMonth(d.slice(0, 7));
                    }}
                    className={`relative py-1.5 rounded-xl text-center transition border ${
                      isSel
                        ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                        : isToday
                        ? "bg-amber-50 text-amber-900 border-amber-300"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    <div className="text-[10px] opacity-80">{getDayName(d)}</div>
                    <div className="text-xs font-black">{d.slice(8)}</div>
                    <div className={`text-[9px] font-bold ${isSel ? "text-amber-300" : "text-stone-400"}`}>
                      {count}끼
                    </div>
                    {dayEvents.length > 0 && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-pink-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {getSchedulesForDate(selectedDate).length > 0 && (
            <div
              onClick={() => {
                setScheduleSelectedDate(selectedDate);
                setScheduleMonth(selectedDate.slice(0, 7));
                setActiveTab("schedule");
              }}
              className="bg-pink-50 border border-pink-200 rounded-2xl p-3 cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="text-[11px] font-black text-pink-900 flex items-center gap-1">
                  <Cake className="w-3.5 h-3.5 text-pink-600" />
                  <span>{selectedDate} 가족 일정 · 기념일</span>
                </div>
                {getSchedulesForDate(selectedDate).map((ev) => (
                  <div key={ev.id} className="text-xs font-bold text-pink-800">
                    • {ev.title} {ev.memo ? `(${ev.memo})` : ""}
                  </div>
                ))}
              </div>
              <span className="text-[10px] font-extrabold text-pink-600 shrink-0">일정탭 &gt;</span>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={() => setSelectedMember("전체")}
              className={`py-2 rounded-xl text-[11px] font-extrabold border transition flex items-center justify-center gap-0.5 ${
                selectedMember === "전체"
                  ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                  : "bg-white text-stone-600 border-stone-200"
              }`}
            >
              <span>👨‍👩‍👧‍👦</span>
              <span>전체</span>
            </button>
            {FAMILY_MEMBERS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m.id)}
                className={`py-2 rounded-xl text-[11px] font-extrabold border transition flex items-center justify-center gap-0.5 ${
                  selectedMember === m.id
                    ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                <MemberAvatar member={m} size="sm" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {MEAL_SLOTS.map((slot) => {
              const slotMeals = meals.filter(
                (m) =>
                  m.date === selectedDate &&
                  m.slot === slot.id &&
                  (selectedMember === "전체" || toSafeArray(m.members).includes(selectedMember))
              );

              return (
                <div
                  key={slot.id}
                  className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{slot.icon}</span>
                      <div>
                        <span className="text-sm font-black text-stone-900">{slot.label}</span>
                        <span className="text-[11px] text-stone-400 ml-2">{slot.time}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingMeal(null);
                        setMealForm({
                          date: selectedDate,
                          slot: slot.id,
                          menu: "",
                          members:
                            selectedMember === "전체"
                              ? ["수혁", "아리나", "시목", "시율"]
                              : [selectedMember],
                          ingredients: [],
                          note: "",
                          sourceType: "집밥/온가족식",
                          cost: ""
                        });
                        setIsMealModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> 추가
                    </button>
                  </div>

                  {slotMeals.length === 0 ? (
                    <div className="text-xs text-stone-400 py-2 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                      기록된 {slot.label} 메뉴가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slotMeals.map((m) => {
                        const safeMems = toSafeArray(m.members);
                        const safeIngs = toSafeArray(m.ingredients);
                        return (
                          <div
                            key={m.id}
                            className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col gap-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-200 text-stone-700">
                                  {m.sourceType || "집밥"}
                                </span>
                                {safeMems.map((memId) => {
                                  const info = FAMILY_MEMBERS.find((f) => f.id === memId);
                                  return info ? (
                                    <span
                                      key={memId}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${info.color}`}
                                    >
                                      <span className="inline-flex items-center gap-1"><MemberAvatar member={info} size="sm" /><span>{info.name}</span></span>
                                    </span>
                                  ) : null;
                                })}
                                {Number(m.cost) > 0 && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                    💰 {Number(m.cost).toLocaleString()}원
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingMeal(m);
                                    setMealForm({
                                      date: m.date,
                                      slot: m.slot,
                                      menu: m.menu || "",
                                      members: safeMems,
                                      ingredients: safeIngs,
                                      note: m.note || "",
                                      sourceType: m.sourceType || "집밥/온가족식",
                                      cost: m.cost || ""
                                    });
                                    setIsMealModalOpen(true);
                                  }}
                                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-50 hover:bg-stone-200 border border-stone-200 text-stone-600"
                                  title="식단 수정"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMeal(m)}
                                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-rose-50/70 hover:bg-rose-100 border border-rose-200/70 text-rose-600"
                                  title="식단 삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-sm font-extrabold text-stone-900 break-keep leading-snug">
                              {m.menu}
                            </div>

                            {safeIngs.length > 0 && (
                              <div className="text-[11px] text-emerald-700 font-semibold">
                                🥬 사용 재료: {safeIngs.join(", ")}
                              </div>
                            )}
                            {m.note && <div className="text-[11px] text-stone-500">💬 {m.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==========================================
          탭 2: 주간 요약
      ========================================== */}
      {activeTab === "weekly" && (
        <div className="p-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-2 gap-1">
              <h2 className="text-sm font-black text-stone-900 truncate">
                📊 주간 식단 ({weekDates[0].slice(5)} ~ {weekDates[6].slice(5)})
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    const d = new Date(selectedDate + "T00:00:00");
                    d.setDate(d.getDate() - 7);
                    const nextStr = formatDate(d);
                    setSelectedDate(nextStr);
                    setCurrentMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold"
                >
                  &lt; 이전주
                </button>
                <button
                  onClick={() => {
                    const today = getTodayStr();
                    setSelectedDate(today);
                    setCurrentMonth(today.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-extrabold"
                >
                  이번주
                </button>
                <button
                  onClick={() => {
                    const d = new Date(selectedDate + "T00:00:00");
                    d.setDate(d.getDate() + 7);
                    const nextStr = formatDate(d);
                    setSelectedDate(nextStr);
                    setCurrentMonth(nextStr.slice(0, 7));
                  }}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[10px] font-extrabold"
                >
                  다음주 &gt;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3">
              {FAMILY_MEMBERS.map((mem) => {
                const cnt = meals.filter(
                  (m) => weekDates.includes(m.date) && toSafeArray(m.members).includes(mem.id)
                ).length;
                return (
                  <button
                    key={mem.id}
                    onClick={() =>
                      setSelectedMember(selectedMember === mem.id ? "전체" : mem.id)
                    }
                    className={`p-2.5 rounded-xl border text-center transition ${
                      selectedMember === mem.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-stone-50 border-stone-200"
                    }`}
                  >
                    <div className="flex justify-center mb-0.5"><MemberAvatar member={mem} size="md" /></div>
                    <div className="text-[11px] font-extrabold mt-0.5">{mem.name}</div>
                    <div className="text-[10px] opacity-75">{cnt}끼</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="divide-y divide-stone-200">
              {weekDates.map((d) => {
                const dayMeals = meals.filter(
                  (m) =>
                    m.date === d &&
                    (selectedMember === "전체" || toSafeArray(m.members).includes(selectedMember))
                );
                return (
                  <div key={d} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-stone-900">
                        {d.slice(5)} ({getDayName(d)})
                      </span>
                      <button
                        onClick={() => {
                          setSelectedDate(d);
                          setActiveTab("daily");
                        }}
                        className="text-[10px] font-bold text-stone-500 hover:text-stone-900"
                      >
                        상세보기 &gt;
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {["아침", "점심", "저녁", "오전간식", "오후간식", "야식"].map((slotId) => {
                        const items = dayMeals.filter((m) => m.slot === slotId);
                        return (
                          <div
                            key={slotId}
                            onClick={() => {
                              setEditingMeal(null);
                              setMealForm({
                                date: d,
                                slot: slotId,
                                menu: "",
                                members: ["수혁", "아리나", "시목", "시율"],
                                ingredients: [],
                                note: "",
                                sourceType: "집밥/온가족식",
                                cost: ""
                              });
                              setIsMealModalOpen(true);
                            }}
                            className="p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 cursor-pointer min-h-[54px]"
                          >
                            <div className="text-[10px] font-extrabold text-stone-500 mb-0.5">
                              {slotId}
                            </div>
                            {items.length > 0 ? (
                              <div className="text-xs font-bold text-stone-800 break-keep leading-snug">
                                {items
                                  .map((i) => String(i.menu || "").replace(/\[.*?\]\s*/, ""))
                                  .join(", ")}
                              </div>
                            ) : (
                              <div className="text-[10px] text-stone-300">+ 등록</div>
                            )}
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

                {monthlyExpenseSummary.wasteCount > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-700 flex items-center justify-between text-[11px]">
                    <span className="text-rose-300 font-bold">
                      🗑️ 이번 달 폐기손실 추정 ({monthlyExpenseSummary.wasteCount}건 · 합산 제외)
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-pink-600" />
                <span>우리 가족 월간 일정표</span>
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

          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={() => setScheduleMemberFilter("전체")}
              className={`py-2 rounded-xl text-[11px] font-extrabold border transition ${
                scheduleMemberFilter === "전체"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200"
              }`}
            >
              👨‍👩‍👧‍👦 전체
            </button>
            {FAMILY_MEMBERS.map((m) => (
              <button
                key={m.id}
                onClick={() => setScheduleMemberFilter(m.id)}
                className={`py-2 rounded-xl text-[11px] font-extrabold border transition ${
                  scheduleMemberFilter === m.id
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                <span className="inline-flex items-center gap-1"><MemberAvatar member={m} size="sm" /><span>{m.name}</span></span>
              </button>
            ))}
          </div>

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
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-black">{i + 1}</span>
                      {isToday && (
                        <span className="text-[8px] font-extrabold px-1 rounded bg-amber-400 text-stone-900">
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
                                  className={`font-bold truncate ${
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

          {/* ==========================================
              [신규 요청사항 1 완벽 반영] To-Do List 전체를 체크리스트처럼 표시하는 화면
          ========================================== */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-emerald-600" />
                <div>
                  <h3 className="text-xs font-black text-stone-900">
                    ✅ 전체 To-Do 체크리스트 ({todoStats.activeCount}건 남음 / 완료 {todoStats.doneCount}건)
                  </h3>
                </div>
              </div>

              <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg">
                {[
                  { id: "all", label: "전체" },
                  { id: "active", label: "진행중" },
                  { id: "completed", label: "완료됨" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTodoStatusFilter(tab.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition ${
                      todoStatusFilter === tab.id
                        ? "bg-stone-900 text-white"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
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
            <div className="flex items-center gap-1.5 bg-stone-50 p-2 rounded-xl border border-stone-200">
              <input
                type="date"
                value={quickTodoDate}
                onChange={(e) => setQuickTodoDate(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-stone-200 text-[11px] font-bold bg-white w-[112px] shrink-0"
              />
              <input
                type="text"
                placeholder="할 일 빠른 입력 (예: 시목이 상담, 예방접종)"
                value={quickTodoTitle}
                onChange={(e) => setQuickTodoTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickAddTodo();
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold bg-white min-w-0"
              />
              <button
                onClick={handleQuickAddTodo}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shrink-0"
              >
                + 추가
              </button>
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

          {/* [5순위 최하단 배치] 우리 가족 D-Day & 기념일 카운트다운 보드 */}
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
          {expiringItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-xs font-black text-orange-900 mb-1.5">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span>소비기한 임박/경과 재료 ({expiringItems.length}건)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {expiringItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-white text-orange-800 border border-orange-200"
                  >
                    {item.name} ({item.diff < 0 ? `${Math.abs(item.diff)}일 지남` : `D-${item.diff}`})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 bg-stone-200 p-1 rounded-xl">
              {["전체", ...STORAGE_LOCATIONS].map((loc) => (
                <button
                  key={loc}
                  onClick={() => setFridgeLocFilter(loc)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                    fridgeLocFilter === loc
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setEditingFridge(null);
                const defaultExp = new Date();
                defaultExp.setDate(defaultExp.getDate() + 7);
                setFridgeForm({
                  name: "",
                  location: "냉장실",
                  category: "채소/과일",
                  quantity: 1,
                  unit: "개",
                  expiryDate: formatDate(defaultExp),
                  price: "",
                  purchaseDate: selectedDate,
                  recordExpense: true
                });
                setIsFridgeModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> 재료 추가
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
          ) : (
            <div className="space-y-2.5">
              {fridge
                .filter(
                  (i) =>
                    (fridgeLocFilter === "전체" || i.location === fridgeLocFilter) &&
                    (fridgeCatFilter === "전체" || i.category === fridgeCatFilter)
                )
                .map((item) => {
                  const diff = getDaysDiff(item.expiryDate);
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1 mb-1">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-stone-100 text-stone-700">
                              {item.location}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              {item.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                diff <= 3
                                  ? "bg-red-100 text-red-700"
                                  : "bg-stone-100 text-stone-500"
                              }`}
                            >
                              소비기한 {item.expiryDate} (
                              {diff < 0 ? `${Math.abs(diff)}일 지남` : `D-${diff}`})
                            </span>
                          </div>
                          <div className="text-sm font-black text-stone-900">{item.name}</div>
                          {Number(item.price) > 0 && (
                            <div className="text-[11px] font-bold text-stone-500 mt-0.5">
                              구입가: {Number(item.price).toLocaleString()}원 ({item.purchaseDate})
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 bg-stone-100 px-2 py-1 rounded-xl shrink-0">
                          <button
                            onClick={() => handleAdjustQuantity(item, -1)}
                            className="w-6 h-6 rounded-lg bg-white font-black text-stone-700 shadow-sm"
                          >
                            -
                          </button>
                          <span className="text-xs font-black px-1.5">
                            {item.quantity}
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

                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleConsumeFridgeItem(item, false)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> 다 먹음 (식비유지)
                          </button>
                          <button
                            onClick={() => handleConsumeFridgeItem(item, true)}
                            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-extrabold"
                          >
                            + 장보기
                          </button>
                          <button
                            onClick={() => handleWasteFridgeItem(item)}
                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold"
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
                                recordExpense: true
                              });
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
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>사야 할 재료 / 장보기 메모 추가</span>
            </h2>

            <div className="grid grid-cols-3 gap-2">
              <input
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

          <div className="space-y-2">
            {shoppingList.map((item) => (
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
            {notices.map((n) => (
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
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Gemini 2.5 AI 실시간 맞춤 셰프</span>
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
        </div>
      )}

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

      {/* 빠른 추가 플로팅 버튼 (FAB) */}
      <button
        onClick={() => {
          if (activeTab === "fridge") {
            setEditingFridge(null);
            setIsFridgeModalOpen(true);
          } else if (activeTab === "schedule") {
            setIsScheduleModalOpen(true);
          } else if (activeTab === "notices") {
            setIsNoticeModalOpen(true);
          } else if (activeTab === "shopping") {
            window.scrollTo({ top: 0, behavior: "smooth" });
            showToast("상단 입력창에서 장보기 품목을 바로 추가해 보세요!");
          } else {
            setEditingMeal(null);
            setMealForm({
              date: selectedDate,
              slot: "아침",
              menu: "",
              members: selectedMember === "전체" ? ["수혁", "아리나", "시목", "시율"] : [selectedMember],
              ingredients: [],
              note: "",
              sourceType: "집밥/온가족식",
              cost: ""
            });
            setIsMealModalOpen(true);
          }
        }}
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
        className="fixed right-4 z-30 w-12 h-12 rounded-full bg-stone-900 hover:bg-amber-600 text-white shadow-xl flex items-center justify-center transition active:scale-95"
        title="빠른 추가"
        aria-label="빠른 추가"
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
                { id: "weekly", label: "주간요약", icon: "📊" },
                { id: "monthly", label: "월간·식비", icon: "💰" },
                { id: "shopping", label: "장보기", icon: "🛒" },
                { id: "notices", label: "가족공지", icon: "📌" },
                { id: "ai", label: "AI추천", icon: "✨" }
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

      {/* 하단 네비게이션 (5개 핵심 메뉴) */}
      <nav style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }} className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur border-t border-stone-200 px-2 pt-1.5 grid grid-cols-5 gap-1 z-30">
        {[
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
              }}
              className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
                active ? "text-stone-900 font-black bg-amber-50/80" : "text-stone-400 font-semibold"
              }`}
            >
              <IconComp className={`w-4 h-4 ${active ? "text-amber-600" : ""}`} />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
        <button
          ref={moreNavBtnRef}
          onClick={() => setIsMoreNavOpen((v) => !v)}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
            ["weekly", "monthly", "shopping", "notices", "ai"].includes(activeTab) || isMoreNavOpen
              ? "text-stone-900 font-black bg-amber-50/80"
              : "text-stone-400 font-semibold"
          }`}
        >
          <LayoutGrid
            className={`w-4 h-4 ${
              ["weekly", "monthly", "shopping", "notices", "ai"].includes(activeTab) || isMoreNavOpen
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
                      className={`py-1.5 rounded-xl text-xs font-extrabold border ${
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
                      <span className="inline-flex items-center gap-1"><MemberAvatar member={m} size="sm" /><span>{m.name}</span></span>
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
                    </div>
                    <input
                      type="number"
                      value={it.price}
                      onChange={(e) => {
                        const copy = [...scannedReceiptItems];
                        copy[idx].price = Number(e.target.value);
                        setScannedReceiptItems(copy);
                      }}
                      className="w-24 font-extrabold text-emerald-700 bg-white px-2 py-1 rounded border border-stone-200 text-xs text-right"
                    />
                  </div>
                ))}
                <button
                  onClick={async () => {
                    if (!requireEditorAccess()) return;
                    let failCount = 0;
                    for (const it of scannedReceiptItems) {
                      const fId = `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                      const newItem = { ...it, id: fId, purchaseDate: selectedDate };
                      setFridgeMap((prev) => ({
                        ...prev,
                        local: { ...(prev.local || {}), [fId]: newItem }
                      }));
                      if (user && db) {
                        try {
                          await setDoc(getDocRef("family_fridge_v3", fId), newItem);
                          await setDoc(getDocRef("family_fridge_v4", fId), newItem);
                          const expId = `exp-${fId}`;
                          await setDoc(getDocRef("family_expenses_v4", expId), {
                            id: expId,
                            title: newItem.name,
                            category: newItem.category || "기타",
                            amount: Number(newItem.price) || 0,
                            date: selectedDate,
                            type: "장보기/식재료"
                          });
                        } catch (e) {
                          failCount += 1;
                        }
                      }
                    }
                    setScannedReceiptItems([]);
                    setReceiptPreviewUrl("");
                    setIsReceiptModalOpen(false);
                    if (failCount > 0) {
                      showToast(`⚠️ ${failCount}건 서버 저장에 실패했습니다. 네트워크 상태를 확인해 주세요.`);
                    } else {
                      showToast("영수증 품목이 냉장고와 식비 가계부에 일괄 등록되었습니다!");
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold"
                >
                  냉장고 및 식비 가계부에 일괄 입고하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기존 모달들 (식단, 냉장고, 장보기입고, 공지, AI퀵로그) */}
      {isMealModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">
                {editingMeal ? "식단 수정하기" : "새 식단 기록하기"}
              </h3>
              <button onClick={() => setIsMealModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
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
                      className={`py-1.5 rounded-xl text-xs font-extrabold border ${
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

            <input
              type="text"
              placeholder="메뉴명 (예: 한우 미역국 & 고등어구이)"
              value={mealForm.menu}
              onChange={(e) => setMealForm({ ...mealForm, menu: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold"
            />

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
              <button onClick={() => setIsFridgeModalOpen(false)}>
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

            <div className="grid grid-cols-2 gap-2">
              <select
                value={fridgeForm.location}
                onChange={(e) => setFridgeForm({ ...fridgeForm, location: e.target.value })}
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
                <label className="text-[10px] font-bold text-stone-500">소비기한</label>
                <input
                  type="date"
                  value={fridgeForm.expiryDate}
                  onChange={(e) => setFridgeForm({ ...fridgeForm, expiryDate: e.target.value })}
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

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsFridgeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-extrabold"
              >
                취소
              </button>
              <button
                onClick={handleSaveFridge}
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
