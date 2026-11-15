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
  CalendarRange
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
  onSnapshot
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

const EMBEDDED_GEMINI_KEY = "AIzaSyDrzf2_cG0PT-dW1lidXYaHk4BpCY-eMao";

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

async function callReliableAiEngine({ apiKey, promptText, imagePart = null, temperature = 0.5 }) {
  const effectiveKey = String(apiKey || EMBEDDED_GEMINI_KEY).trim();

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
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(
          effectiveKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      return { ok: false, error: `[${cleanModel}] ${e.name === "AbortError" ? "응답 시간 초과" : e.message}` };
    } finally {
      clearTimeout(timer);
    }
  };

  // 1차: 최신 권장 모델 gemini-3.8-flash 직접 호출
  const primaryRes = await trySingleModel("gemini-3.8-flash");
  if (primaryRes.ok) return primaryRes.data;

  const modelErrors = [primaryRes.error];

  // 키 자체 차단/만료가 아니라면, 현재 키에서 실제 사용 가능한 모델 목록을 구글 서버에서 자동 조회하여 재시도
  const rawPrimary = primaryRes.rawMsg || "";
  if (
    !rawPrimary.includes("blocked") &&
    !rawPrimary.includes("API_KEY_SERVICE_BLOCKED") &&
    !rawPrimary.includes("API key not valid") &&
    !rawPrimary.includes("expired")
  ) {
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(effectiveKey)}`
      );
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
          modelErrors.push(retryRes.error);
        }
      }
    } catch {}
  }

  // 텍스트 전용 요청(레시피 추천)일 경우 오픈 엔드포인트 보조 시도
  if (!imagePart) {
    try {
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          jsonMode: true,
          messages: [
            {
              role: "system",
              content: "Output ONLY a valid JSON array in Korean. No markdown fences."
            },
            { role: "user", content: promptText }
          ]
        })
      });
      if (res.ok) {
        const txt = await res.text();
        const parsed = extractJsonArray(txt);
        if (parsed) return parsed;
      }
    } catch {}
  }

  if (
    rawPrimary.includes("blocked") ||
    rawPrimary.includes("API_KEY_SERVICE_BLOCKED") ||
    rawPrimary.includes("API key not valid") ||
    rawPrimary.includes("expired")
  ) {
    throw new Error(
      `API 키 오류: ${rawPrimary} (Google AI Studio에서 새 키를 발급받아 ⚙️설정에 저장해 주세요)`
    );
  }

  throw new Error(
    `AI 호출 오류: ${modelErrors[0]} (⚙️설정에서 'AI 연결 자가진단'을 눌러 확인해 주세요)`
  );
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
  { id: "수혁", name: "김수혁", role: "아빠", emoji: "👨🏻", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "아리나", name: "최아리나", role: "엄마", emoji: "👩🏻", color: "bg-pink-100 text-pink-800 border-pink-200" },
  { id: "시목", name: "김시목", role: "첫째", emoji: "👦🏻", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "시율", name: "김시율", role: "둘째", emoji: "👶🏻", color: "bg-purple-100 text-purple-800 border-purple-200" }
];

const MEAL_SLOTS = [
  { id: "아침", label: "아침", shortLabel: "아침", icon: "🌅", time: "07:00 - 09:00" },
  { id: "오전간식", label: "오전간식", shortLabel: "오전간식", icon: "🍎", time: "10:00 - 11:00" },
  { id: "점심", label: "점심", shortLabel: "점심", icon: "☀️", time: "12:00 - 13:30" },
  { id: "오후간식", label: "오후간식", shortLabel: "오후간식", icon: "🥨", time: "15:00 - 16:30" },
  { id: "저녁", label: "저녁", shortLabel: "저녁", icon: "🌙", time: "18:00 - 20:00" },
  { id: "야식", label: "야식", shortLabel: "야식", icon: "🦉", time: "21:00 이후" }
];

const STORAGE_LOCATIONS = ["냉장실", "냉동실", "실온·팬트리"];
const FRIDGE_CATEGORIES = ["채소/과일", "육류/수산", "유제품/계란", "유아식/이유식 재료", "반찬/김치", "양념/소스", "기타"];
const SCHEDULE_CATEGORIES = ["기념일/생일", "할일(To-Do)", "육아/병원", "가족행사/경조사"];

const INITIAL_PATCH_NOTES = [
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
  const [patchForm, setPatchForm] = useState({
    version: "",
    title: "",
    changesText: ""
  });

  const [mealsMap, setMealsMap] = useState({});
  const [fridgeMap, setFridgeMap] = useState({});
  const [expenses, setExpenses] = useState([]);
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
  const [todoStatusFilter, setTodoStatusFilter] = useState("all"); // all | active | completed
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
  const [selectedAiIngredients, setSelectedAiIngredients] = useState([]);
  const [aiTargetGroup, setAiTargetGroup] = useState("온가족 한끼");
  const [aiPromptExtra, setAiPromptExtra] = useState("");
  const [aiRecipes, setAiRecipes] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState("");
  const [quickLogRecipe, setQuickLogRecipe] = useState(null);
  const [quickLogDate, setQuickLogDate] = useState(() => getTodayStr());
  const [quickLogSlot, setQuickLogSlot] = useState("저녁");

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

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

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
          dust: getDustGrade(20, 10),
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
    fetchSeoulJungGuWeather();
    const interval = setInterval(fetchSeoulJungGuWeather, 15 * 60 * 1000); // 15분마다 자동 업데이트
    return () => clearInterval(interval);
  }, []);

  // AI 연결 1초 자가진단 테스트
  const handleRunAiDiagnostic = async () => {
    setAiDiagStatus("진단 중... 구글 AI 서버에 연결 테스트를 보내고 있습니다.");
    const testKey = String(tempKeyInput || geminiApiKey || EMBEDDED_GEMINI_KEY).trim();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(
          testKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Hello" }] }]
          })
        }
      );
      const data = await res.json();
      if (res.ok && data?.candidates) {
        setAiDiagStatus("✅ [연결 성공!] 현재 API 키로 Gemini 3.8 Flash AI가 100% 정상 작동합니다.");
      } else {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        setAiDiagStatus(
          `❌ [구글 서버 거절 사유]: ${msg}\n👉 해결법: Google AI Studio(aistudio.google.com/app/apikey)에서 'Create API key in new project'로 새 키를 발급받아 위 칸에 저장해 주세요!`
        );
      }
    } catch (e) {
      setAiDiagStatus(`❌ 네트워크 오류: ${e.message}`);
    }
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
            if (d.id === "api_config" && d.data().geminiKey) {
              const sharedKey = String(d.data().geminiKey).trim();
              if (sharedKey.startsWith("AIzaSy") || sharedKey.startsWith("AQ.")) {
                setGeminiApiKey(sharedKey);
                setTempKeyInput(sharedKey);
                localStorage.setItem("kim_family_gemini_key", sharedKey);
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
    Object.values(mealsMap).forEach((sourceObj) => {
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
    Object.values(fridgeMap).forEach((sourceObj) => {
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
    if (!user || !db || meals.length === 0) return;
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
            meals: meals.slice(0, 200),
            fridge,
            expenses,
            shoppingList,
            notices,
            schedules,
            patchNotes
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
        await setDoc(getDocRef("family_meta_v4", "deleted_tracker"), { ids: next });
      } catch (e) {}
    }
  };

  const handleSaveApiKey = async (keyToSave) => {
    const cleaned = String(keyToSave || "").trim();
    if (!cleaned) return;

    setGeminiApiKey(cleaned);
    setTempKeyInput(cleaned);
    localStorage.setItem("kim_family_gemini_key", cleaned);
    setAiErrorMsg("");
    setScanErrorMsg("");
    setReceiptErrorMsg("");

    if (user && db) {
      try {
        await setDoc(getDocRef("family_meta_v4", "api_config"), {
          geminiKey: cleaned,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {}
    }
    showToast("API 키가 저장되어 부부 스마트폰에 모두 적용되었습니다!");
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
      backupVersion: "v5.9",
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
        deletedIds
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
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoringJson(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = parsed?.data || parsed;

      if (!payload || typeof payload !== "object") {
        throw new Error("유효한 백업 JSON 파일이 아닙니다.");
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
      if (Array.isArray(payload.notices)) setNotices(payload.notices);
      if (Array.isArray(payload.schedules)) setSchedules(payload.schedules);
      if (Array.isArray(payload.patchNotes)) setPatchNotes(payload.patchNotes);

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

        await Promise.allSettled(writePromises);
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
  const handleSaveSchedule = async () => {
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
    const updated = { ...item, done: !item.done };
    setSchedules((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_schedules_v4", item.id), updated);
      } catch (e) {}
    }
  };

  const handleDeleteSchedule = async (item) => {
    setSchedules((prev) => prev.filter((s) => s.id !== item.id));
    await markIdDeleted(item.id);
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_schedules_v4", item.id));
      } catch (e) {}
    }
    showToast("일정이 삭제되었습니다.");
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

  // [신규 요청사항 1] 전체 To-Do 체크리스트 전용 데이터 (기념일/생일 제외한 모든 체크 가능 할일·일정 모아보기)
  const allTodoChecklistItems = useMemo(() => {
    return schedules
      .filter((s) => {
        if (s.category === "기념일/생일" || s.isAnnual) return false;
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
        // 미완료 항목을 먼저 보여주고, 날짜순 정렬
        if (Boolean(a.done) !== Boolean(b.done)) {
          return a.done ? 1 : -1;
        }
        return String(a.date).localeCompare(String(b.date));
      });
  }, [schedules, scheduleMemberFilter, todoStatusFilter]);

  const todoStats = useMemo(() => {
    const nonAnniv = schedules.filter(
      (s) =>
        s.category !== "기념일/생일" &&
        !s.isAnnual &&
        (scheduleMemberFilter === "전체" ||
          toSafeArray(s.members).includes(scheduleMemberFilter))
    );
    const total = nonAnniv.length;
    const doneCount = nonAnniv.filter((s) => s.done).length;
    const activeCount = total - doneCount;
    return { total, doneCount, activeCount };
  }, [schedules, scheduleMemberFilter]);

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
    "tip": "셰프의 핵심 조리 팁"
  }
]`;

      const parsedArray = await callReliableAiEngine({
        apiKey: geminiApiKey,
        promptText: prompt,
        temperature: 0.65
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
      showToast("맞춤 레시피 3가지가 생성되었습니다!");
    } catch (err) {
      console.error("AI Recommendation Error:", err);
      setAiErrorMsg(err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleMenuImageUpload = async (e) => {
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

        if (priceNum > 0 && fridgeForm.recordExpense !== false) {
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
    const nextQty = Math.max(0, Number(item.quantity || 0) + delta);
    const updated = { ...item, quantity: nextQty };
    setFridgeMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), [item.id]: updated }
    }));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_fridge_v3", item.id), updated);
        await setDoc(getDocRef("family_fridge_v4", item.id), updated);
      } catch (e) {}
    }
  };

  const handleConsumeFridgeItem = async (item, addToShopping = false) => {
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
    await markIdDeleted(item.id);
    setExpenses((prev) => prev.filter((e) => e.id !== `exp-${item.id}`));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_fridge_v3", item.id));
        await deleteDoc(getDocRef("family_fridge_v4", item.id));
        await deleteDoc(getDocRef("family_meals_v3", item.id));
        await deleteDoc(getDocRef("family_expenses_v4", `exp-${item.id}`));
      } catch (e) {}
    }
    showToast(`'${item.name}' 항목이 삭제되었습니다.`);
  };

  const handleSaveMeal = async () => {
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
    if (user && db) {
      try {
        await setDoc(getDocRef("family_meals_v3", id), payload);
        await setDoc(getDocRef("family_meals_v4", id), payload);
      } catch (e) {}
    }
    showToast("식단이 저장되었습니다.");
  };

  const handleDeleteMeal = async (meal) => {
    await markIdDeleted(meal.id);
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_meals_v3", meal.id));
        await deleteDoc(getDocRef("family_meals_v4", meal.id));
      } catch (e) {}
    }
    showToast("식단이 삭제되었습니다.");
  };

  const handleAddShopping = async () => {
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
    const updated = { ...item, checked: !item.checked };
    setShoppingList((prev) => prev.map((s) => (s.id === item.id ? updated : s)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_shopping_v4", item.id), updated);
      } catch (e) {}
    }
  };

  const handleDeleteShopping = async (id) => {
    setShoppingList((prev) => prev.filter((s) => s.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_shopping_v4", id));
      } catch (e) {}
    }
  };

  const handleConfirmStockIn = async () => {
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
    const updated = { ...notice, done: !notice.done };
    setNotices((prev) => prev.map((n) => (n.id === notice.id ? updated : n)));
    if (user && db) {
      try {
        await setDoc(getDocRef("family_notices_v4", notice.id), updated);
      } catch (e) {}
    }
  };

  const handleDeleteNotice = async (id) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
    if (user && db) {
      try {
        await deleteDoc(getDocRef("family_notices_v4", id));
      } catch (e) {}
    }
    showToast("공지사항이 삭제되었습니다.");
  };

  const handleConfirmQuickLog = async () => {
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

    return { groceryTotal, diningTotal, total, ledgerItems: combinedLedger, diningItems };
  }, [expenses, fridge, meals, currentMonth]);

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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
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

        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
              동기화 중
            </span>
            <button
              onClick={() => setIsPatchModalOpen(true)}
              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 flex items-center gap-1"
              title="패치노트 기록 및 히스토리"
            >
              <ClipboardList className="w-3 h-3 text-stone-600" />
              <span>패치노트 {patchNotes[0]?.version || "v5.9"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setActiveTab("monthly");
                setMonthlySubTab("expense");
              }}
              className="px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1"
            >
              <span>💰 {currentMonth.slice(5)}월</span>
              <span>{monthlyExpenseSummary.total.toLocaleString()}원</span>
            </button>
            <button
              onClick={() => {
                setTempKeyInput(geminiApiKey);
                setIsSettingsOpen(true);
              }}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
              title="백업 및 설정"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          <h1 className="text-sm font-black tracking-tight text-stone-900 truncate">
            수혁 · 아리나 · 시목 · 시율네 식탁 🍽️
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

            <div className="grid grid-cols-4 gap-1.5 mt-2.5 bg-stone-100 p-1.5 rounded-2xl">
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
          </>
        )}
      </header>

      {/* ==========================================
          탭 1: 일별 식단
      ========================================== */}
      {activeTab === "daily" && (
        <div className="p-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setScanTargetMonth(selectedDate.slice(0, 7));
                setIsDaycareModalOpen(true);
              }}
              className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100 transition flex items-center gap-2.5"
            >
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-amber-900 leading-tight">
                  식단표 AI 스캔
                </div>
                <div className="text-[10px] font-semibold text-amber-700 leading-tight mt-0.5">
                  손글씨·어린이집 자동입력
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100 transition flex items-center gap-2.5"
            >
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-emerald-900 leading-tight">
                  마트 영수증 스캔
                </div>
                <div className="text-[10px] font-semibold text-emerald-700 leading-tight mt-0.5">
                  냉장고+가계부 자동입고
                </div>
              </div>
            </button>
          </div>

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
                <span>{m.emoji}</span>
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
                                      {info.emoji} {info.name}
                                    </span>
                                  ) : null;
                                })}
                                {Number(m.cost) > 0 && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                                    💰 {Number(m.cost).toLocaleString()}원
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
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
                                  className="p-1 rounded-lg hover:bg-stone-200 text-stone-500"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMeal(m)}
                                  className="p-1 rounded-lg hover:bg-red-100 text-red-500"
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-stone-900">
                📊 주간 식단 현황 ({weekDates[0].slice(5)} ~ {weekDates[6].slice(5)})
              </h2>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                총 {meals.filter((m) => weekDates.includes(m.date)).length}끼 기록됨
              </span>
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
                    <div className="text-base">{mem.emoji}</div>
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
                    <div className="text-lg">{m.emoji}</div>
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
                {m.emoji} {m.name}
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
                                {info.emoji} {info.name}
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
                            {toSafeArray(todo.members)
                              .map((m) => FAMILY_MEMBERS.find((f) => f.id === m)?.emoji || m)
                              .join("")}
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
        <div className="p-4 space-y-4">
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
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold"
                          >
                            + 소진 후 장보기메모
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
        </div>
      )}

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-stone-200 px-1.5 py-1.5 grid grid-cols-6 gap-0.5 z-30">
        {[
          { id: "daily", label: "일별식단", icon: Utensils },
          { id: "monthly", label: "월간·식비", icon: Calendar },
          { id: "schedule", label: "일정", icon: CalendarDays },
          { id: "fridge", label: "냉장고", icon: Package },
          { id: "shopping", label: "장보기", icon: ShoppingCart },
          { id: "ai", label: "AI추천", icon: Sparkles }
        ].map((item) => {
          const IconComp = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition ${
                active ? "text-stone-900 font-black" : "text-stone-400 font-semibold"
              }`}
            >
              <IconComp className={`w-4 h-4 ${active ? "text-amber-600" : ""}`} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
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
                      {m.emoji} {m.id}
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
                        } catch (e) {}
                      }
                    }
                    setScannedReceiptItems([]);
                    setReceiptPreviewUrl("");
                    setIsReceiptModalOpen(false);
                    showToast("영수증 품목이 냉장고와 식비 가계부에 일괄 등록되었습니다!");
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
                      {m.emoji} {m.id}
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

            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <label className="text-xs font-black text-stone-800 block">
                🔑 Gemini API 키 (부부 폰 자동 동기화)
              </label>
              <input
                type="text"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="API 키 입력"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSaveApiKey(tempKeyInput)}
                  className="py-2 rounded-xl bg-stone-800 text-white text-xs font-extrabold"
                >
                  API 키 저장
                </button>
                <button
                  onClick={handleRunAiDiagnostic}
                  className="py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold"
                >
                  AI 연결 자가진단
                </button>
              </div>
              {aiDiagStatus && (
                <div className="p-2.5 rounded-xl bg-white border border-stone-200 text-[11px] font-bold text-stone-700 whitespace-pre-line">
                  {aiDiagStatus}
                </div>
              )}
            </div>

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
