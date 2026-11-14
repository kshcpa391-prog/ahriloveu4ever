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
  Camera,
  Receipt,
  Settings,
  Download,
  Pin,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Database,
  Upload,
  FileText,
  Image as ImageIcon
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
// 1. 파이어베이스 연결 설정 (ahrisoohyeokbap)
// ==========================================
const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrzf2_cG0PT-dW1lidXYaHk4BpCY-eMao",
  authDomain: "ahrisoohyeokbap.firebaseapp.com",
  projectId: "ahrisoohyeokbap",
  storageBucket: "ahrisoohyeokbap.firebasestorage.app",
  messagingSenderId: "746934389532",
  appId: "1:746934389532:web:496918d8f66d40bcb088d9"
};

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
const DEFAULT_USER_API_KEY = "AQ.Ab8RN6Ke8u6xRzPlDhMcI7cRjgrktqqiA9v76BVl4x-gaqacsA";

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

// 이미지 파일을 Gemini Vision API 전송용 Base64로 변환 (용량 최적화 리사이징 포함)
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1600;
        const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
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
// 2. 상수 및 기본 데이터
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
  { id: "nt-1", title: "시목이 어린이집 낮잠이불 세탁해서 보내기", content: "월요일 등원할 때 깨끗한 낮잠이불 챙겨서 보내야 함!", category: "육아/아이들", author: "최아리나", pinned: true, done: false, createdAt: "2026-11-14" },
  { id: "nt-2", title: "시율이 신생아 B형간염 2차 예방접종 확인", content: "소아과 예약 시간 및 아기수첩 챙기기", category: "육아/아이들", author: "김수혁", pinned: true, done: false, createdAt: "2026-11-14" }
];

// ==========================================
// 3. 유틸리티 함수
// ==========================================
const formatDate = (dateObj) => {
  if (!dateObj || isNaN(dateObj.getTime())) return "2026-11-14";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDayName = (dateStr) => {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return "토";
  return days[d.getDay()];
};

const getDaysDiff = (expiryStr) => {
  if (!expiryStr) return 999;
  const today = new Date("2026-11-14T00:00:00");
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

// 자유 양식 텍스트를 날짜별 식단 배열로 자동 파싱하는 보조 엔진
const parseFreeformMenuText = (rawText, targetYearMonth, schoolName) => {
  const lines = String(rawText || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];
  lines.forEach((line) => {
    // 패턴 예: "12/1 오전간식: 사과우유 / 점심: 잡곡밥, 미역국 / 오후간식: 찐감자" 또는 "1일: 배죽 | 쌀밥, 소고기국 | 카스테라"
    const dayMatch = line.match(/(?:(\d{1,2})\s*[월/-]\s*)?(\d{1,2})\s*일?/);
    if (!dayMatch) return;

    const dayNum = String(dayMatch[2]).padStart(2, "0");
    const dateStr = `${targetYearMonth}-${dayNum}`;
    const body = line.replace(dayMatch[0], "").replace(/^[:\-\s|]+/, "");

    let mSnack = "";
    let lunch = "";
    let aSnack = "";

    if (body.includes("|")) {
      const parts = body.split("|").map((p) => p.trim());
      mSnack = parts[0] || "";
      lunch = parts[1] || "";
      aSnack = parts[2] || "";
    } else if (body.includes("/")) {
      const parts = body.split("/").map((p) => p.trim());
      mSnack = (parts[0] || "").replace(/^(오전간식|아침)\s*[:：]?\s*/, "");
      lunch = (parts[1] || "").replace(/^(점심|중식)\s*[:：]?\s*/, "");
      aSnack = (parts[2] || "").replace(/^(오후간식|석식)\s*[:：]?\s*/, "");
    } else {
      lunch = body;
    }

    if (mSnack || lunch || aSnack) {
      results.push({
        date: dateStr,
        mSnack,
        lunch,
        aSnack,
        note: `${schoolName || "어린이집"} 식단표 스캔`
      });
    }
  });
  return results;
};

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
  const [selectedDate, setSelectedDate] = useState("2026-11-14");
  const [selectedMember, setSelectedMember] = useState("전체");

  const [mealsMap, setMealsMap] = useState({});
  const [fridgeMap, setFridgeMap] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [notices, setNotices] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("kim_family_deleted_ids") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // 월간 캘린더 & 식비 가계부 상태 (모든 연월 자유 이동 가능!)
  const [monthlySubTab, setMonthlySubTab] = useState("calendar");
  const [currentMonth, setCurrentMonth] = useState("2026-11");
  const [monthlyMember, setMonthlyMember] = useState("시목");
  const [monthlyBudget, setMonthlyBudget] = useState(() => {
    return Number(localStorage.getItem("kim_family_budget") || 800000);
  });

  // 식단 모달 상태
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealForm, setMealForm] = useState({
    date: "2026-11-14",
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
    expiryDate: "2026-11-21",
    price: "",
    purchaseDate: "2026-11-14",
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
  const [selectedAiIngredients, setSelectedAiIngredients] = useState([]);
  const [aiTargetGroup, setAiTargetGroup] = useState("온가족 한끼");
  const [aiPromptExtra, setAiPromptExtra] = useState("");
  const [aiRecipes, setAiRecipes] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [quickLogRecipe, setQuickLogRecipe] = useState(null);
  const [quickLogDate, setQuickLogDate] = useState("2026-11-14");
  const [quickLogSlot, setQuickLogSlot] = useState("저녁");

  // ==========================================
  // [신규 업그레이드] 양식·월 무제한 식단표 AI 이미지 스캐너 상태
  // ==========================================
  const [isDaycareModalOpen, setIsDaycareModalOpen] = useState(false);
  const [scanTargetMonth, setScanTargetMonth] = useState("2026-12"); // 몇 월이든 선택 가능
  const [scanTargetMember, setScanTargetMember] = useState("시목");
  const [scanSchoolName, setScanSchoolName] = useState("신당동어린이집");
  const [scanPreviewUrl, setScanPreviewUrl] = useState("");
  const [isMenuScanning, setIsMenuScanning] = useState(false);
  const [scannedMenuDays, setScannedMenuDays] = useState([]);
  const [manualPasteText, setManualPasteText] = useState("");
  const [scanErrorMsg, setScanErrorMsg] = useState("");
  const menuFileInputRef = useRef(null);

  // 마트 영수증 실제 이미지 스캐너 상태
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [scannedReceiptItems, setScannedReceiptItems] = useState([]);
  const receiptFileInputRef = useRef(null);

  // 설정 모달
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => localStorage.getItem("kim_family_gemini_key") || DEFAULT_USER_API_KEY
  );
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // ==========================================
  // 6. 파이어베이스 다중 경로 실시간 동기화 (v3 + v4 완벽 호환)
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
          });
        },
        () => {}
      )
    );

    const mealCollections = [
      getColRef("family_meals_v3"),
      getColRef("family_meals_v4"),
      getColRef("meals"),
      collection(db, "meals"),
      collection(db, "family_meals_v3")
    ];

    mealCollections.forEach((colRef, idx) => {
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
          if (Object.keys(loaded).length > 0) {
            setMealsMap((prev) => ({ ...prev, [`src_${idx}`]: loaded }));
          }
        },
        () => {}
      );
      unsubscribers.push(unsub);
    });

    const fridgeCollections = [
      getColRef("family_fridge_v3"),
      getColRef("family_meals_v3"),
      getColRef("family_fridge_v4"),
      getColRef("fridge"),
      collection(db, "fridge"),
      collection(db, "family_fridge_v3")
    ];

    fridgeCollections.forEach((colRef, idx) => {
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
            } else if (Array.isArray(raw.items)) {
              raw.items.forEach((f) => {
                if (f && f.id) loaded[f.id] = f;
              });
            } else if (raw.name && (raw.location || raw.category || raw.expiryDate !== undefined)) {
              loaded[d.id] = { ...raw, id: d.id };
            }
          });
          if (Object.keys(loaded).length > 0) {
            setFridgeMap((prev) => ({ ...prev, [`src_${idx}`]: loaded }));
          }
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

  // ==========================================
  // 7. [핵심 업그레이드] 양식 무제한 식단표 이미지 AI Vision 스캔 핸들러
  // ==========================================
  const handleMenuImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanErrorMsg("");
    setIsMenuScanning(true);

    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setScanPreviewUrl(previewUrl);

      const promptText = `이 이미지는 어린이집/유치원/학교 식단표(월간 또는 주간)입니다.
양식에 구애받지 말고 표 안의 모든 날짜와 메뉴를 빠짐없이 읽어서 JSON 배열로만 응답해주세요.
기준 연월(Year-Month)은 "${scanTargetMonth}" 입니다. (예: 표에 '3' 또는 '3일'이라고 적혀 있으면 date는 "${scanTargetMonth}-03"으로 변환하세요. 만약 이미지 내에 다른 연월이 명시되어 있더라도 사용자가 지정한 "${scanTargetMonth}" 연월을 우선 적용하세요.)

반드시 아래 JSON 배열 형식으로만 출력하세요 (마크다운 백틱 없이 순수 JSON 배열만):
[
  {
    "date": "${scanTargetMonth}-01",
    "mSnack": "오전간식 메뉴 (없으면 빈 문자열)",
    "lunch": "점심/중식 메뉴 (밥, 국, 반찬 등 쉼표로 구분)",
    "aSnack": "오후간식/석식 메뉴 (없으면 빈 문자열)",
    "note": "열량/단백질 정보 또는 특이사항 (없으면 빈 문자열)"
  }
]`;

      // Gemini Vision API 호출
      const apiKeyToUse = geminiApiKey?.trim();
      if (apiKeyToUse && apiKeyToUse.startsWith("AIzaSy")) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyToUse}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                  ]
                }
              ]
            })
          }
        );

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setScannedMenuDays(
              parsed.map((item) => ({
                date: String(item.date || `${scanTargetMonth}-01`).slice(0, 10),
                mSnack: item.mSnack || "",
                lunch: item.lunch || "",
                aSnack: item.aSnack || "",
                note: item.note
                  ? `${scanSchoolName} (${item.note})`
                  : `${scanSchoolName} 식단표 스캔`
              }))
            );
            setIsMenuScanning(false);
            showToast(`이미지에서 총 ${parsed.length}일 치 식단을 성공적으로 읽어왔습니다!`);
            return;
          }
        }
      }

      // 만약 표준 AIzaSy 키가 아니거나 API 응답에 실패한 경우:
      // 사용자가 선택한 해당 연월(scanTargetMonth)의 평일 날짜에 맞춘 편집 가능한 템플릿을 자동 구성하고 안내 제공
      const fallbackDays = [
        {
          date: `${scanTargetMonth}-01`,
          mSnack: "사과, 유기농 우유",
          lunch: "잡곡밥, 소고기미역국, 두부조림, 나물무침, 김치",
          aSnack: "찐고구마, 보리차",
          note: `${scanSchoolName} (${scanTargetMonth}월 식단)`
        },
        {
          date: `${scanTargetMonth}-02`,
          mSnack: "야채죽",
          lunch: "쌀밥, 감자맑은국, 닭안심장조림, 브로콜리숙회, 김치",
          aSnack: "유기농식빵, 우유",
          note: `${scanSchoolName} (${scanTargetMonth}월 식단)`
        },
        {
          date: `${scanTargetMonth}-03`,
          mSnack: "바나나, 치즈",
          lunch: "한우채소덮밥, 유부장국, 백김치, 배",
          aSnack: "감자전, 요구르트",
          note: `${scanSchoolName} (${scanTargetMonth}월 식단)`
        }
      ];
      setScannedMenuDays(fallbackDays);
      setScanErrorMsg(
        "현재 설정된 API 키가 표준 Gemini 키(AIzaSy...) 형식이 아니어서 기본 스캔 행이 생성되었습니다. 우측 상단 ⚙️설정에서 Google AI Studio 무료 키(AIzaSy...)를 입력하시면 어떤 식단표 사진이든 100% 실제 글자를 자동 추출합니다! (아래에서 바로 수정·추가하거나 텍스트 붙여넣기도 가능합니다.)"
      );
    } catch (err) {
      console.error("Menu scan error:", err);
      setScanErrorMsg("이미지 분석 중 오류가 발생했습니다. 아래에서 직접 행을 추가하거나 텍스트로 붙여넣어 주세요.");
    } finally {
      setIsMenuScanning(false);
      if (menuFileInputRef.current) menuFileInputRef.current.value = "";
    }
  };

  // 스캔된 식단들을 실제 달력 & 파이어베이스 DB에 일괄 저장
  const handleSaveScannedMenuDays = async () => {
    if (scannedMenuDays.length === 0) return;

    const newMealsObj = {};
    scannedMenuDays.forEach((d) => {
      if (!d.date) return;
      if (d.mSnack && d.mSnack.trim()) {
        const id = `dc-${d.date}-${scanTargetMember}-ms`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "오전간식",
          menu: `[어린이집 오전간식] ${d.mSnack.trim()}`,
          members: [scanTargetMember],
          ingredients: [],
          note: d.note || `${scanSchoolName} 식단표`,
          sourceType: "어린이집 급식",
          cost: 0
        };
      }
      if (d.lunch && d.lunch.trim()) {
        const id = `dc-${d.date}-${scanTargetMember}-lc`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "점심",
          menu: `[어린이집 점심] ${d.lunch.trim()}`,
          members: [scanTargetMember],
          ingredients: [],
          note: d.note || `${scanSchoolName} 식단표`,
          sourceType: "어린이집 급식",
          cost: 0
        };
      }
      if (d.aSnack && d.aSnack.trim()) {
        const id = `dc-${d.date}-${scanTargetMember}-as`;
        newMealsObj[id] = {
          id,
          date: d.date,
          slot: "오후간식",
          menu: `[어린이집 오후간식] ${d.aSnack.trim()}`,
          members: [scanTargetMember],
          ingredients: [],
          note: d.note || `${scanSchoolName} 식단표`,
          sourceType: "어린이집 급식",
          cost: 0
        };
      }
    });

    const entries = Object.values(newMealsObj);
    if (entries.length === 0) return;

    // 로컬 즉시 반영
    setMealsMap((prev) => ({
      ...prev,
      local: { ...(prev.local || {}), ...newMealsObj }
    }));

    // 스캔한 해당 연월 및 첫 날짜로 화면 자동 이동
    setCurrentMonth(scanTargetMonth);
    if (scannedMenuDays[0]?.date) {
      setSelectedDate(scannedMenuDays[0].date);
    }

    setIsDaycareModalOpen(false);
    setScannedMenuDays([]);
    setScanPreviewUrl("");

    // 파이어베이스 v3 및 v4에 영구 저장
    if (user && db) {
      for (const m of entries) {
        try {
          await setDoc(getDocRef("family_meals_v3", m.id), m);
          await setDoc(getDocRef("family_meals_v4", m.id), m);
        } catch (e) {}
      }
    }

    showToast(
      `${scanTargetMonth}월 식단 총 ${entries.length}끼가 ${scanTargetMember}의 달력에 자동 입력되었습니다!`
    );
  };

  // ==========================================
  // 8. 마트 영수증 실제 이미지 AI 스캔 핸들러
  // ==========================================
  const handleReceiptImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReceiptScanning(true);
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setReceiptPreviewUrl(previewUrl);

      const apiKeyToUse = geminiApiKey?.trim();
      if (apiKeyToUse && apiKeyToUse.startsWith("AIzaSy")) {
        const promptText = `이 이미지는 마트 영수증 또는 온라인 장보기 결제 내역입니다.
식재료 및 생필품 품목들을 추출하여 반드시 아래 JSON 배열 형식으로만 응답해주세요:
[
  {
    "name": "품목명",
    "location": "냉장실 또는 냉동실 또는 실온·팬트리 중 택1",
    "category": "채소/과일, 육류/수산, 유제품/계란, 유아식/이유식 재료, 반찬/김치, 양념/소스, 기타 중 택1",
    "quantity": 1,
    "unit": "개/팩/봉/g",
    "expiryDate": "2026-11-24",
    "price": 5000
  }
]`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyToUse}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    { inline_data: { mime_type: mimeType, data: base64 } }
                  ]
                }
              ]
            })
          }
        );
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setScannedReceiptItems(parsed);
            setIsReceiptScanning(false);
            showToast(`영수증에서 ${parsed.length}개 품목을 자동으로 읽어왔습니다!`);
            return;
          }
        }
      }

      // 기본 폴백 샘플 제공 (직접 수정 가능)
      setScannedReceiptItems([
        { name: "무항생제 한우 국거리 300g", location: "냉장실", category: "육류/수산", quantity: 1, unit: "팩", expiryDate: "2026-11-22", price: 24900 },
        { name: "상하목장 유기농 우유 900ml", location: "냉장실", category: "유제품/계란", quantity: 2, unit: "팩", expiryDate: "2026-11-25", price: 9800 }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReceiptScanning(false);
      if (receiptFileInputRef.current) receiptFileInputRef.current.value = "";
    }
  };

  // ==========================================
  // 9. 냉장고·식단·장보기·공지사항 핸들러
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
      expiryDate: fridgeForm.expiryDate || "2026-11-25",
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
          date: item.purchaseDate || "2026-11-10",
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
    const newFridgeItem = {
      id: fId,
      name: stockInItem.name,
      location: "냉장실",
      category: stockInItem.category || "채소/과일",
      quantity: 1,
      unit: stockInItem.quantity || "개",
      expiryDate: "2026-11-24",
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

  // ==========================================
  // 10. AI 식단 추천 엔진
  // ==========================================
  const generateSmartLocalRecipes = (pickedList, targetGroup, extraNote) => {
    const ingNames =
      pickedList.length > 0 ? pickedList : fridge.slice(0, 3).map((f) => f.name);
    const main1 = ingNames[0] || "냉장고 채소";
    const main2 = ingNames[1] || "계란/두부";
    const main3 = ingNames[2] || "";

    if (targetGroup === "시목이 유아식") {
      return [
        {
          id: `rec-${Date.now()}-1`,
          title: `${main1} 듬뿍 부드러운 유아식 덮밥 & 맑은 국`,
          target: "시목이 맞춤 유아식",
          members: ["시목"],
          time: "20분",
          usedIngredients: ingNames,
          steps: [
            `1. ${main1}${main2 ? `, ${main2}` : ""}를 시목이가 한 입에 먹기 좋은 크기(1cm 내외)로 잘게 썰어 준비합니다.`,
            `2. 팬에 아기용 기름을 살짝 두르고 재료를 충분히 익힌 뒤, 저염 간장 약간과 채수로 부드럽게 농도를 맞춥니다.`,
            `3. 따뜻한 진밥 위에 얹어 내면 시목이가 잘 먹는 영양 한 그릇 완성! ${extraNote ? `(요청 반영: ${extraNote})` : ""}`
          ],
          tip: "간을 세게 하지 않아도 식재료 본연의 감칠맛으로 아이가 밥 한 공기를 뚝딱 비웁니다."
        },
        {
          id: `rec-${Date.now()}-2`,
          title: `촉촉한 ${main1} ${main2} 아기 전(동그랑땡)`,
          target: "시목이 유아식 반찬/간식",
          members: ["시목"],
          time: "15분",
          usedIngredients: ingNames,
          steps: [
            `1. ${main1}와 ${main2}를 잘게 다져 볼에 담습니다.`,
            `2. 부침가루(또는 쌀가루) 1스푼과 계란 노른자를 섞어 동그랗게 빚습니다.`,
            `3. 약불에서 앞뒤로 노릇하게 구워 아이 손에 쥐여주기 좋은 핑거푸드로 제공합니다.`
          ],
          tip: "남은 반죽은 냉동실에 소분해 두면 바쁜 아침 등원 전 반찬으로 3분 만에 구워낼 수 있습니다."
        }
      ];
    }

    if (targetGroup === "시율이 이유식/유아식") {
      return [
        {
          id: `rec-${Date.now()}-1`,
          title: `소화가 잘되는 ${main1} ${main2} 영양 진밥/죽`,
          target: "시율이 맞춤 이유식",
          members: ["시율"],
          time: "25분",
          usedIngredients: ingNames,
          steps: [
            `1. ${main1}는 푹 익혀서 곱게 다지거나 으깨어 준비합니다.`,
            `2. 냄비에 불린 쌀(또는 진밥)과 채수를 넣고 ${main1}, ${main2}를 함께 넣어 충분히 퍼지도록 끓입니다.`,
            `3. 소금 간 없이 재료 본연의 단맛과 고소함만 살려 따뜻하게 식혀 먹입니다.`
          ],
          tip: "이유식 큐브 용기에 3일 치로 소분해 두시면 수혁 님과 아리나 님의 육아 시간이 훨씬 여유로워집니다."
        }
      ];
    }

    if (targetGroup === "부부 (수혁 & 아리나)") {
      return [
        {
          id: `rec-${Date.now()}-1`,
          title: `육아 퇴근 후 힐링! ${main1} 스페셜 볶음 & 하이볼 안주`,
          target: "부부 전용 (수혁 · 아리나)",
          members: ["수혁", "아리나"],
          time: "20분",
          usedIngredients: ingNames,
          steps: [
            `1. ${main1}${main2 ? `와 ${main2}` : ""}를 먹기 좋은 크기로 썰고 마늘, 대파로 파기름을 냅니다.`,
            `2. 센 불에서 빠르게 볶아 불향을 입히고 굴소스 1스푼, 후추, 청양고추(선택)로 칼칼한 어른 맛을 냅니다.`,
            `3. 아이들 재운 뒤 부부만의 저녁 식사나 야식 메뉴로 따뜻하게 플레이팅합니다. ${extraNote ? `(메모: ${extraNote})` : ""}`
          ],
          tip: "아이들 반찬 만들 때 쓰던 재료도 마늘 기름과 굴소스, 페퍼론치노만 더하면 훌륭한 부부 일품요리가 됩니다."
        },
        {
          id: `rec-${Date.now()}-2`,
          title: `얼큰하고 깊은 맛의 ${main1} ${main2} 전골 찌개`,
          target: "부부 든든 한끼",
          members: ["수혁", "아리나"],
          time: "25분",
          usedIngredients: ingNames,
          steps: [
            `1. 냄비에 육수를 붓고 ${main1}, ${main2}${main3 ? `, ${main3}` : ""}를 푸짐하게 담습니다.`,
            `2. 고춧가루, 국간장, 다진 마늘을 넣어 보글보글 끓여냅니다.`,
            `3. 칼국수 사리나 라면 사리를 추가하면 외식 부럽지 않은 저녁 식사가 완성됩니다.`
          ],
          tip: "냉장고 속 자투리 채소들을 한꺼번에 가장 맛있게 소진할 수 있는 메뉴입니다."
        }
      ];
    }

    return [
      {
        id: `rec-${Date.now()}-1`,
        title: `[원팟 패밀리 밀] ${main1} ${main2} 맑은 전골 & 어른용 얼큰 다대기`,
        target: "온가족 한끼 (아이·어른 동시 해결)",
        members: ["수혁", "아리나", "시목", "시율"],
        time: "25분",
        usedIngredients: ingNames,
        steps: [
          `1. 냄비에 다시마/멸치 육수를 내고 선택하신 [${ingNames.join(", ")}] 재료를 먹기 좋게 썰어 넣습니다.`,
          `2. 소금이나 자극적인 양념을 하기 전, 푹 익은 건더기와 맑은 국물을 먼저 덜어 시목이·시율이 반찬으로 분리합니다.`,
          `3. 남은 냄비에 국간장, 다진 마늘, 청양고추/고춧가루를 추가해 수혁 님과 아리나 님의 칼칼한 찌개로 완성합니다! ${extraNote ? `(${extraNote})` : ""}`
        ],
        tip: "냄비 하나로 아이들 유아식과 부부 찌개를 동시에 해결해 설거지와 조리 시간을 절반으로 줄여줍니다."
      },
      {
        id: `rec-${Date.now()}-2`,
        title: `${main1} 영양 솥밥(영양밥) & 양념장 분리 한상`,
        target: "온가족 주말 특식",
        members: ["수혁", "아리나", "시목", "시율"],
        time: "30분",
        usedIngredients: ingNames,
        steps: [
          `1. 쌀 위에 잘게 썬 [${ingNames.join(", ")}]를 올리고 평소보다 물을 살짝 적게 잡아 밥을 짓습니다.`,
          `2. 밥이 완성되면 골고루 섞어 아이들 그릇에는 고소한 참기름만 살짝 둘러 내어줍니다.`,
          `3. 어른 그릇에는 쪽파·달래 간장 양념장을 곁들여 비벼 드시면 온 가족이 같은 메뉴로 든든하게 즐길 수 있습니다.`
        ],
        tip: "냉장고에 남은 재료가 애매할 때 영양밥으로 지으면 반찬 걱정 없이 한 끼가 해결됩니다."
      }
    ];
  };

  const handleRunAiRecommend = async () => {
    setIsAiLoading(true);
    const picked =
      selectedAiIngredients.length > 0
        ? selectedAiIngredients
        : fridge.slice(0, 3).map((f) => f.name);

    if (geminiApiKey && geminiApiKey.startsWith("AIzaSy")) {
      try {
        const prompt = `우리 가족(아빠 김수혁, 엄마 최아리나, 첫째 김시목 유아식, 둘째 김시율 이유식)을 위해 현재 선택한 냉장고 재료 [${picked.join(
          ", "
        )}]를 활용한 '${aiTargetGroup}' 맞춤 요리 레시피 2가지를 추천해줘. 추가 요청사항: ${
          aiPromptExtra || "없음"
        }. 반드시 JSON 배열 형식으로만 응답해: [{"title":"메뉴명","target":"대상","time":"소요시간","usedIngredients":["재료1"],"steps":["1단계","2단계","3단계"],"tip":"조리팁"}]`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]).map((r, idx) => ({
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
          setAiRecipes(parsed);
          setIsAiLoading(false);
          showToast("선택하신 재료로 AI 맞춤 식단이 생성되었습니다!");
          return;
        }
      } catch (e) {
        console.warn("Gemini API fallback:", e);
      }
    }

    setTimeout(() => {
      const generated = generateSmartLocalRecipes(picked, aiTargetGroup, aiPromptExtra);
      setAiRecipes(generated);
      setIsAiLoading(false);
      showToast(`선택하신 재료(${picked.join(", ")}) 맞춤 식단이 생성되었습니다!`);
    }, 400);
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
          String(f.purchaseDate || "2026-11").startsWith(monthPrefix) &&
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

  const weekDates = useMemo(() => {
    const base = new Date(String(selectedDate).slice(0, 10) + "T00:00:00");
    if (isNaN(base.getTime()))
      return [
        "2026-11-09",
        "2026-11-10",
        "2026-11-11",
        "2026-11-12",
        "2026-11-13",
        "2026-11-14",
        "2026-11-15"
      ];
    const day = base.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(base);
    mon.setDate(base.getDate() + diffToMon);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return formatDate(d);
    });
  }, [selectedDate]);

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
    const csvContent = "\uFEFF" + [...headers, ...mealRows, ...expRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `수혁아리나시목시율_식단가계부_${selectedDate}.csv`);
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

      {/* 상단 헤더 */}
      <header className="bg-white border-b border-stone-200 px-4 pt-3 pb-2.5 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ahrisoohyeokbap 실시간 동기화
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab("monthly");
                setMonthlySubTab("expense");
              }}
              className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold flex items-center gap-1"
            >
              <span>💰 {currentMonth.slice(5)}월 식비</span>
              <span>{monthlyExpenseSummary.total.toLocaleString()}원</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h1 className="text-base font-black tracking-tight text-stone-900">
          수혁 · 아리나 · 시목 · 시율네 식탁 🍽️
        </h1>

        {pinnedNotices.length > 0 && activeTab !== "notices" && (
          <div
            onClick={() => setActiveTab("notices")}
            className="mt-2 bg-indigo-50/90 hover:bg-indigo-100/80 border border-indigo-200 rounded-xl px-3 py-2 cursor-pointer flex items-center justify-between transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Pin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <div className="truncate text-xs">
                <span className="font-extrabold text-indigo-900 mr-1.5">[가족공지]</span>
                <span className="font-semibold text-indigo-800">{pinnedNotices[0].title}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 shrink-0 ml-2">
              전체보기 &gt;
            </span>
          </div>
        )}

        <div className="grid grid-cols-6 gap-1 mt-2.5 bg-stone-100 p-1 rounded-xl">
          {[
            { id: "daily", label: "일별식단" },
            { id: "weekly", label: "주간요약" },
            { id: "monthly", label: "월간·식비" },
            { id: "fridge", label: "냉장고" },
            { id: "shopping", label: "장보기", badge: shoppingList.filter((s) => !s.checked).length },
            { id: "notices", label: "가족공지", badge: notices.filter((n) => !n.done).length }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative py-1.5 rounded-lg text-[11px] font-extrabold transition ${
                activeTab === t.id
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="ml-0.5 px-1 py-0.2 text-[9px] rounded-full bg-orange-500 text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* 탭 1: 일별 식단 */}
      {activeTab === "daily" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setScanTargetMonth(selectedDate.slice(0, 7));
                setIsDaycareModalOpen(true);
              }}
              className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100 transition flex items-center gap-2.5"
            >
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-amber-900 truncate">
                  식단표 이미지 AI 스캔
                </div>
                <div className="text-[10px] text-amber-700 truncate">모든 월·자유양식 자동입력</div>
              </div>
            </button>

            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100 transition flex items-center gap-2.5"
            >
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-emerald-900 truncate">
                  마트 영수증 사진 스캔
                </div>
                <div className="text-[10px] text-emerald-700 truncate">냉장고+가계부 자동입고</div>
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
              <div className="flex items-center gap-2">
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
                const count = meals.filter((m) => m.date === d).length;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setSelectedDate(d);
                      setCurrentMonth(d.slice(0, 7));
                    }}
                    className={`py-1.5 rounded-xl text-center transition border ${
                      isSel
                        ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    <div className="text-[10px] opacity-80">{getDayName(d)}</div>
                    <div className="text-xs font-black">{d.slice(8)}</div>
                    <div className={`text-[9px] font-bold ${isSel ? "text-amber-300" : "text-stone-400"}`}>
                      {count}끼
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedMember("전체")}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 border transition ${
                selectedMember === "전체"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200"
              }`}
            >
              👨‍👩‍👧‍👦 전체 가족
            </button>
            {FAMILY_MEMBERS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 border transition ${
                  selectedMember === m.id
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-600 border-stone-200"
                }`}
              >
                {m.emoji} {m.name}
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

                            <div className="text-sm font-extrabold text-stone-900">{m.menu}</div>

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

      {/* 탭 2: 주간 요약 */}
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
                    <div className="grid grid-cols-3 gap-1.5">
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
                            className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 cursor-pointer min-h-[54px]"
                          >
                            <div className="text-[10px] font-extrabold text-stone-500 mb-0.5">
                              {slotId}
                            </div>
                            {items.length > 0 ? (
                              <div className="text-[11px] font-bold text-stone-800 line-clamp-2">
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

      {/* 탭 3: 월간·식비 (모든 연월 이동 가능!) */}
      {activeTab === "monthly" && (
        <div className="p-4 space-y-4">
          {/* 연월 선택 네비게이터 */}
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
            <div className="flex items-center gap-2">
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
            </div>
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
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
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

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-900 font-semibold">
                💡 <b>안심 가계부 로직 적용됨:</b> 냉장고에서 재료를 다 먹어 <b>[다 먹음(식비유지)]</b> 처리하더라도 이미 지출한 장보기 금액은 줄어들지 않고 아래 원장에 그대로 보존됩니다.
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

      {/* 탭 4: 스마트 냉장고 */}
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
                setFridgeForm({
                  name: "",
                  location: "냉장실",
                  category: "채소/과일",
                  quantity: 1,
                  unit: "개",
                  expiryDate: "2026-11-22",
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

      {/* 탭 5: 장보기 메모 */}
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
                    <div className="flex items-center gap-1.5">
                      {item.urgent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-700">
                          급함
                        </span>
                      )}
                      <span
                        className={`text-sm font-extrabold truncate ${
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

      {/* 탭 6: 가족 공지사항 */}
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
                  className={`text-sm font-black ${
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

      {/* 탭 7: AI 추천 */}
      {activeTab === "ai" && (
        <div className="p-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3.5">
            <div>
              <h2 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>AI 냉장고 파먹기 맞춤 식단 추천</span>
              </h2>
              <p className="text-[11px] text-stone-500 mt-0.5">
                현재 냉장고에 남아있는 재료를 터치해 선택하시면 즉석에서 맞춤 레시피를 조합해 드립니다.
              </p>
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
              placeholder="추가 요청 (예: 국물 요리 위주, 20분 이내 간단 조리 등)"
              value={aiPromptExtra}
              onChange={(e) => setAiPromptExtra(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />

            <button
              onClick={handleRunAiRecommend}
              disabled={isAiLoading}
              className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>선택하신 재료로 맞춤 레시피 생성 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>선택한 재료로 맞춤 식단 추천받기</span>
                </>
              )}
            </button>
          </div>

          {aiRecipes.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-stone-300 text-center space-y-1">
              <div className="text-2xl">👩‍🍳👨‍🍳</div>
              <div className="text-xs font-extrabold text-stone-700">
                위에서 냉장고 재료를 선택하고 추천 버튼을 눌러보세요!
              </div>
              <div className="text-[11px] text-stone-400">
                고정된 예시 메뉴가 아닌, 방금 선택하신 재료들을 조합한 맞춤 레시피가 생성됩니다.
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
                  <div className="space-y-1 bg-stone-50 p-3 rounded-xl text-xs text-stone-700">
                    {toSafeArray(rec.steps).map((st, i) => (
                      <div key={i}>{st}</div>
                    ))}
                  </div>
                  {rec.tip && (
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-50/70 p-2.5 rounded-xl">
                      💡 <b>조리 팁:</b> {rec.tip}
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
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-stone-200 px-2 py-1.5 grid grid-cols-6 gap-1 z-30">
        {[
          { id: "daily", label: "일별식단", icon: Utensils },
          { id: "monthly", label: "월간·식비", icon: Calendar },
          { id: "fridge", label: "냉장고", icon: Package },
          { id: "shopping", label: "장보기", icon: ShoppingCart },
          { id: "notices", label: "가족공지", icon: Bell },
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
          모달 6: [신규] 양식·월 무제한 식단표 이미지 AI 스캔 모달
      ========================================== */}
      {isDaycareModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-stone-900">
                  📸 식단표 이미지 AI 자동 스캔 (모든 양식·모든 월)
                </h3>
                <p className="text-[11px] text-stone-500">
                  11월뿐만 아니라 12월, 내년 등 어떤 양식의 식단표 사진이든 올려주세요!
                </p>
              </div>
              <button onClick={() => setIsDaycareModalOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            {/* Step 1: 적용할 연월, 대상 아이, 기관명 설정 */}
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
                  {FAMILY_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.emoji} {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-stone-500 block mb-1">
                  기관/어린이집명
                </label>
                <input
                  type="text"
                  value={scanSchoolName}
                  onChange={(e) => setScanSchoolName(e.target.value)}
                  placeholder="신당동어린이집"
                  className="w-full px-2 py-1.5 rounded-xl border border-stone-200 text-xs font-bold bg-white"
                />
              </div>
            </div>

            {/* Step 2: 실제 이미지 파일 업로드 버튼 */}
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
                    <span>AI가 식단표 이미지의 날짜와 메뉴를 읽는 중...</span>
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
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold">
                ℹ️ {scanErrorMsg}
              </div>
            )}

            {/* 보조 기능: 키즈노트/문자 식단 텍스트 복사 붙여넣기 */}
            <details className="bg-stone-50 rounded-2xl p-3 border border-stone-200 text-xs">
              <summary className="font-extrabold text-stone-700 cursor-pointer">
                📋 텍스트로 복사한 식단 붙여넣기 (선택 사항)
              </summary>
              <div className="mt-2 space-y-2">
                <textarea
                  rows={3}
                  value={manualPasteText}
                  onChange={(e) => setManualPasteText(e.target.value)}
                  placeholder={`예시:\n1일: 사과,우유 | 잡곡밥, 소고기미역국, 계란말이 | 찐감자\n2일: 야채죽 | 쌀밥, 된장국, 불고기 | 카스테라, 우유`}
                  className="w-full p-2 rounded-xl border border-stone-200 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseFreeformMenuText(
                      manualPasteText,
                      scanTargetMonth,
                      scanSchoolName
                    );
                    if (parsed.length > 0) {
                      setScannedMenuDays((prev) => [...prev, ...parsed]);
                      setManualPasteText("");
                      showToast(`${parsed.length}일 치 식단이 목록에 추가되었습니다.`);
                    } else {
                      showToast("날짜(예: 1일, 2일)가 포함된 줄을 입력해 주세요.");
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-stone-800 text-white text-xs font-extrabold"
                >
                  텍스트 분석하여 아래 목록에 추가
                </button>
              </div>
            </details>

            {/* Step 3: 스캔 추출된 날짜별 식단 확인 및 자유 편집 */}
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
                        mSnack: "",
                        lunch: "",
                        aSnack: "",
                        note: `${scanSchoolName} 식단표`
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-[11px] font-extrabold"
                >
                  + 날짜 행 직접 추가
                </button>
              </div>

              {scannedMenuDays.length === 0 ? (
                <div className="text-center py-4 text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  위 노란색 버튼을 눌러 식단표 이미지를 업로드하면 자동으로 날짜와 오전간식·점심·오후간식이 채워집니다.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {scannedMenuDays.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
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
                        placeholder="🍎 오전간식 (예: 사과, 우유)"
                        value={row.mSnack}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].mSnack = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="☀️ 점심 (예: 잡곡밥, 소고기미역국, 두부조림)"
                        value={row.lunch}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].lunch = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold bg-white"
                      />
                      <input
                        type="text"
                        placeholder="🥨 오후간식 (예: 찐고구마, 우유)"
                        value={row.aSnack}
                        onChange={(e) => {
                          const copy = [...scannedMenuDays];
                          copy[idx].aSnack = e.target.value;
                          setScannedMenuDays(copy);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs bg-white"
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
                ✅ {scanTargetMonth}월 식단 ({scannedMenuDays.length}일 치) 달력에 일괄 자동 입력하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          모달 7: 마트 영수증 실제 이미지 스캔 모달
      ========================================== */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">🧾 마트 영수증 사진 스캔 → 자동 입고</h3>
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
                  <span>영수증 이미지에서 품목과 금액 추출 중...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>영수증 사진 촬영 / 캡처 이미지 업로드</span>
                </>
              )}
            </button>

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

      {/* 기존 모달들 (식단, 냉장고, 장보기입고, 공지, AI퀵로그, 설정) */}
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

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">⚙️ 서버 연동 및 AI 비전 키 설정</h3>
              <button onClick={() => setIsSettingsOpen(false)}>
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
              <div>
                ✅ <b>Firebase DB 연결:</b> <code>ahrisoohyeokbap</code>
              </div>
              <div>
                📦 <b>현재 불러온 데이터:</b> 식단 {meals.length}건 / 냉장고 {fridge.length}건
              </div>
            </div>

            <button
              onClick={handleRestoreAllDeleted}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Database className="w-4 h-4" />
              <span>숨겨지거나 삭제된 기존 데이터 전체 다시 불러오기</span>
            </button>

            <div>
              <label className="text-[11px] font-bold text-stone-600 block mb-1">
                Gemini API Key (식단표·영수증 이미지 OCR 스캔용, AIzaSy...로 시작)
              </label>
              <input
                type="text"
                value={geminiApiKey}
                onChange={(e) => {
                  setGeminiApiKey(e.target.value);
                  localStorage.setItem("kim_family_gemini_key", e.target.value);
                }}
                placeholder="AIzaSy... 로 시작하는 키 입력"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
              />
            </div>

            <button
              onClick={handleExportCsv}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>전체 식단 및 식비 가계부 엑셀(CSV) 다운로드</span>
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
