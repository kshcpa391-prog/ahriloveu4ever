import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  Baby,
  Calendar,
  Check,
  ChefHat,
  ChevronRight,
  Clock,
  CloudSun,
  Copy,
  Download,
  Home,
  Image as ImageIcon,
  Megaphone,
  PackagePlus,
  Plus,
  Refrigerator,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Utensils,
  Wallet,
  X
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';

// ============================================================================
// [1] 환경 변수 및 Firebase 안전 초기화 (Single-File Mandate 준수)
// ============================================================================
const APP_VERSION = 'v11.31';
const LOCAL_FALLBACK_KEY = 'ahri_soohyeok_family_hub_v11_31';
const QUICK_RECENT_KEY = 'ahri_soohyeok_quick_recent_v11_31';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'ahrisoohyeok4ever-hub';
const geminiApiKey = typeof __gemini_api_key !== 'undefined' ? __gemini_api_key : '';

let firebaseServices = { app: null, auth: null, db: null, storage: null, enabled: false };

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const parsedConfig =
      typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    if (parsedConfig && parsedConfig.apiKey) {
      const fbApp = getApps().length > 0 ? getApps()[0] : initializeApp(parsedConfig);
      firebaseServices = {
        app: fbApp,
        auth: getAuth(fbApp),
        db: getFirestore(fbApp),
        storage: getStorage(fbApp),
        enabled: true
      };
    }
  }
} catch (err) {
  console.warn('Firebase config unavailable, running with safe offline/local sync:', err);
}

// ============================================================================
// [2] 가족 구성원, 아이 생년월일, 연령 포맷(D+N일 / xx개월 xx일) 및 안전 파싱 유틸
// ============================================================================
const FAMILY_MEMBERS = [
  { id: 'suhyeok', name: '김수혁', role: 'admin', label: '아빠 (김수혁)' },
  { id: 'arina', name: '최아리나', role: 'admin', label: '엄마 (최아리나)' },
  { id: 'family_guest', name: '가족 열람자', role: 'user', label: '가족 열람 (일기·백업 제한)' }
];

const CHILDREN_INFO = {
  시목: { id: '시목', fullName: '김시목', birthDate: '2025-08-03', emoji: '👦' },
  시율: { id: '시율', fullName: '김시율', birthDate: '2026-11-06', emoji: '👶' }
};

const STORAGE_LOCATIONS = [
  { id: 'all', label: '전체' },
  { id: 'fridge', label: '냉장실' },
  { id: 'freezer', label: '냉동실' },
  { id: 'pantry', label: '실온/팬트리' }
];

const EXPENSE_CATEGORIES = ['식재료', '외식·배달', '유아식·간식', '생필품'];

const ROUTINE_SLOTS = [
  { id: 'morning', label: '아침' },
  { id: 'afternoon', label: '오후' },
  { id: 'evening', label: '저녁/밤' }
];

const TIME_PRESETS = ['07:30', '09:00', '12:00', '17:30', '20:00', '21:30'];

const QUICK_ACTION_META = {
  diary: { label: '📖 육아일기 작성', tab: 'baby', sub: 'diary', adminOnly: true },
  meal: { label: '🍚 오늘 식단 등록', tab: 'meals', sub: null, adminOnly: false },
  shopping: { label: '🛒 장보기 담기', tab: 'shopping', sub: null, adminOnly: false },
  fridge: { label: '❄️ 냉장고 재고 추가', tab: 'fridge', sub: null, adminOnly: false },
  schedule: { label: '📅 가족 일정 추가', tab: 'schedule', sub: null, adminOnly: false },
  expense: { label: '💳 식비·지출 기록', tab: 'more', sub: 'expenses', adminOnly: false },
  health: { label: '📏 성장·진료 기록', tab: 'baby', sub: 'health', adminOnly: false }
};

const DEFAULT_RECIPES = [
  {
    id: 'rec-1',
    title: '소고기 애호박 진밥 & 가족 덮밥',
    category: '유아식·가족식',
    cookTime: '20분',
    ingredients: ['소고기', '애호박', '양파', '당근', '밥'],
    steps:
      '1. 다진 소고기 핏물을 빼고 채소를 잘게 다집니다.\n2. 참기름에 볶다가 육수를 붓고 푹 끓여 완성합니다.'
  },
  {
    id: 'rec-2',
    title: '두부 계란 간장조림',
    category: '반찬',
    cookTime: '15분',
    ingredients: ['두부', '계란', '대파', '양파'],
    steps:
      '1. 두부를 노릇하게 굽고 간장·다진마늘 양념장을 끼얹습니다.\n2. 대파를 올려 약불에서 3분간 졸입니다.'
  },
  {
    id: 'rec-3',
    title: '닭가슴살 브로콜리 크림 리조또',
    category: '한그릇',
    cookTime: '25분',
    ingredients: ['닭가슴살', '브로콜리', '우유', '양파', '치즈'],
    steps:
      '1. 데친 브로콜리와 닭가슴살을 잘게 썹니다.\n2. 우유와 밥, 치즈를 넣고 농도를 맞추며 끓입니다.'
  },
  {
    id: 'rec-4',
    title: '감자 애호박 된장찌개',
    category: '국/찌개',
    cookTime: '20분',
    ingredients: ['감자', '애호박', '두부', '대파', '양파'],
    steps:
      '1. 멸치다시마 육수에 된장을 풀고 감자·양파를 먼저 끓입니다.\n2. 애호박과 두부를 넣고 한소끔 더 끓입니다.'
  }
];

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDaysStr = (days, baseDateStr = null) => {
  const base = baseDateStr ? new Date(`${baseDateStr}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return getTodayStr();
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekendDateStr = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const diffToSat = day === 6 ? 0 : (6 - day + 7) % 7;
  return addDaysStr(diffToSat);
};

const getCurrentWeekKey = () => {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

const getCurrentMonthKey = () => getTodayStr().slice(0, 7);

const parseSafeQty = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
};

const parseSafeAmount = (val) => {
  const cleaned = String(val ?? '').replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
};

const safePercent = (numerator, denominator) => {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
};

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate || typeof expiryDate !== 'string' || !expiryDate.trim()) return null;
  const parsed = new Date(`${expiryDate.trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date(`${getTodayStr()}T00:00:00`);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
};

const isExpiringSoonItem = (item) => {
  if (!item) return false;
  const d = getDaysUntilExpiry(item.expiryDate);
  return d !== null && d <= 2;
};

const isHalfRemainingItem = (item) => {
  if (!item) return false;
  const q = parseSafeQty(item.quantity);
  return q > 0 && q < 1;
};

// 12개월 미만은 D+N일, 12개월 이상은 xx개월 xx일 형식으로 변환
const formatBabyAgeLabel = (birthDateStr, targetDateStr = getTodayStr()) => {
  const birth = new Date(`${birthDateStr}T00:00:00`);
  const target = new Date(`${(targetDateStr || getTodayStr()).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(target.getTime())) return 'D+0일';

  const totalDays = Math.max(0, Math.floor((target.getTime() - birth.getTime()) / 86400000));
  let months =
    (target.getFullYear() - birth.getFullYear()) * 12 + (target.getMonth() - birth.getMonth());
  let anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
  if (anchor.getTime() > target.getTime()) {
    months -= 1;
    anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
  }
  const remDays = Math.max(0, Math.floor((target.getTime() - anchor.getTime()) / 86400000));

  if (months < 12) {
    return `D+${totalDays}일`;
  }
  return `${months}개월 ${remDays}일`;
};

const formatKoreanTimeTag = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  return m === 0 ? `${h}시` : `${h}시${String(m).padStart(2, '0')}분`;
};

const isRoutineDoneToday = (routine) => {
  if (!routine) return false;
  const freq = routine.frequency || 'daily';
  if (freq === 'weekly') return routine.lastDoneKey === getCurrentWeekKey();
  if (freq === 'monthly') return routine.lastDoneKey === getCurrentMonthKey();
  return routine.lastDoneKey === getTodayStr();
};

const getActiveDoneKeyForFreq = (freq) => {
  if (freq === 'weekly') return getCurrentWeekKey();
  if (freq === 'monthly') return getCurrentMonthKey();
  return getTodayStr();
};

// ============================================================================
// [3] 초기 샘플 데이터 및 백업 스키마 정규화 (전 컬렉션 대칭 백업·복원)
// ============================================================================
const createInitialState = () => {
  const today = getTodayStr();
  return {
    meals: [
      {
        id: 'meal-1',
        date: today,
        slot: '아침',
        menu: '소고기 애호박 진밥 & 계란찜',
        category: '집밥',
        ingredients: '소고기, 애호박, 계란',
        note: '시목이 유아식 함께'
      },
      {
        id: 'meal-2',
        date: today,
        slot: '저녁',
        menu: '감자 애호박 된장찌개 & 두부조림',
        category: '집밥',
        ingredients: '애호박, 두부, 감자, 양파',
        note: '반남은 재료 소진'
      }
    ],
    fridgeItems: [
      {
        id: 'fr-1',
        name: '애호박',
        quantity: 0.5,
        unit: '개',
        location: 'fridge',
        expiryDate: addDaysStr(2),
        memo: '이유식 쓰고 반남음'
      },
      {
        id: 'fr-2',
        name: '두부',
        quantity: 0.5,
        unit: '모',
        location: 'fridge',
        expiryDate: addDaysStr(1),
        memo: '찌개용 반모'
      },
      {
        id: 'fr-3',
        name: '우유',
        quantity: 0.5,
        unit: '팩',
        location: 'fridge',
        expiryDate: addDaysStr(1),
        memo: '내일까지'
      },
      {
        id: 'fr-4',
        name: '계란',
        quantity: 8,
        unit: '구',
        location: 'fridge',
        expiryDate: addDaysStr(6),
        memo: ''
      },
      {
        id: 'fr-5',
        name: '소고기 다짐육',
        quantity: 200,
        unit: 'g',
        location: 'freezer',
        expiryDate: addDaysStr(14),
        memo: '큐브 소분'
      },
      {
        id: 'fr-6',
        name: '당근',
        quantity: 0.5,
        unit: '개',
        location: 'fridge',
        expiryDate: '',
        memo: '기한 미입력'
      }
    ],
    shoppingItems: [
      { id: 'sh-1', name: '아기 보리차 티백', qty: '1박스', checked: false, memo: '쿠팡 주문' },
      { id: 'sh-2', name: '브로콜리', qty: '2송이', checked: true, memo: '이유식 재료' },
      { id: 'sh-3', name: '시금치', qty: '1단', checked: true, memo: '' }
    ],
    routines: [
      {
        id: 'rt-1',
        title: '젖병 열탕 소독 & 분유포트 물 끓이기',
        slot: 'morning',
        scheduledTime: '07:30',
        frequency: 'daily',
        lastDoneKey: today,
        stepDoneIndices: []
      },
      {
        id: 'rt-2',
        title: '시목이 하원 간식 & 저녁 이유식 준비',
        slot: 'afternoon',
        scheduledTime: '17:30',
        frequency: 'daily',
        lastDoneKey: '',
        stepDoneIndices: []
      },
      {
        id: 'rt-3',
        title: '시목·시율 목욕 및 수면 의식',
        slot: 'evening',
        scheduledTime: '20:00',
        frequency: 'daily',
        lastDoneKey: '',
        stepDoneIndices: []
      }
    ],
    todos: [
      { id: 'td-1', title: '시율이 출생신고 서류 확인', dueDate: today, done: true, memo: '주민센터' },
      { id: 'td-2', title: '주말 친정 방문 짐 챙기기', dueDate: addDaysStr(3), done: false, memo: '' }
    ],
    schedules: [
      {
        id: 'sc-1',
        date: today,
        time: '10:30',
        title: '시율이 BCG 접종 및 신생아 검진',
        category: '병원'
      },
      {
        id: 'sc-2',
        date: addDaysStr(2),
        time: '15:00',
        title: '시목이 영유아 발달 상담',
        category: '육아'
      }
    ],
    notices: [
      {
        id: 'nt-1',
        date: today,
        author: '최아리나',
        title: '이번 주 금요일 시율이 예방접종 일정 공유',
        content: '오전 10시 30분 예약이라 10시에 출발합니다. 아기수첩 챙겨주세요!',
        pinned: true
      }
    ],
    recipes: DEFAULT_RECIPES,
    expenses: [
      {
        id: 'ex-1',
        date: today,
        category: '식재료',
        title: '한우 다짐육 & 유기농 애호박 장보기',
        amount: 34500,
        payer: '김수혁'
      },
      {
        id: 'ex-2',
        date: addDaysStr(-1),
        category: '유아식·간식',
        title: '시목이 아기치즈 · 보리차',
        amount: 18900,
        payer: '최아리나'
      },
      {
        id: 'ex-3',
        date: addDaysStr(-3),
        category: '외식·배달',
        title: '주말 가족 저녁 식사',
        amount: 46000,
        payer: '김수혁'
      }
    ],
    babyDiaryEntries: [
      {
        id: 'bd-1',
        date: today,
        childIds: ['시목', '시율'],
        mood: '🥰',
        title: '동생 쓰다듬어주는 든든한 형아 시목이',
        content:
          '시목이가 새근새근 자는 시율이 옆에 살며시 앉아 손을 토닥여주었다. 두 아이가 함께 있는 모습이 너무 뭉클하다.',
        photos: [],
        author: '김수혁'
      }
    ],
    babyHealthLogs: [
      {
        id: 'bh-1',
        date: today,
        childId: '시율',
        type: '성장·검진',
        heightCm: '51.2',
        weightKg: '3.6',
        note: '신생아 수유량 안정적, 황달 수치 정상'
      }
    ]
  };
};

const normalizeStoreSchema = (src) => {
  const base = createInitialState();
  const safe = src && typeof src === 'object' ? src : {};
  return {
    meals: Array.isArray(safe.meals) ? safe.meals : base.meals,
    fridgeItems: Array.isArray(safe.fridgeItems) ? safe.fridgeItems : base.fridgeItems,
    shoppingItems: Array.isArray(safe.shoppingItems) ? safe.shoppingItems : base.shoppingItems,
    routines: Array.isArray(safe.routines) ? safe.routines : base.routines,
    todos: Array.isArray(safe.todos) ? safe.todos : base.todos,
    schedules: Array.isArray(safe.schedules) ? safe.schedules : base.schedules,
    notices: Array.isArray(safe.notices) ? safe.notices : base.notices,
    recipes: Array.isArray(safe.recipes) ? safe.recipes : base.recipes,
    expenses: Array.isArray(safe.expenses) ? safe.expenses : base.expenses,
    babyDiaryEntries: Array.isArray(safe.babyDiaryEntries)
      ? safe.babyDiaryEntries
      : base.babyDiaryEntries,
    babyHealthLogs: Array.isArray(safe.babyHealthLogs) ? safe.babyHealthLogs : base.babyHealthLogs
  };
};

// ============================================================================
// [4] 메인 애플리케이션 컴포넌트 (App)
// ============================================================================
export default function App() {
  // --------------------------------------------------------------------------
  // 4-1. 인증·역할·네비게이션 상태 (중복 useState 0건 검증)
  // --------------------------------------------------------------------------
  const [fbUser, setFbUser] = useState(null);
  const [currentMemberId, setCurrentMemberId] = useState('suhyeok');
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'meals' | 'fridge' | 'shopping' | 'schedule' | 'baby' | 'more'
  const [babySubTab, setBabySubTab] = useState('diary'); // 'diary' | 'health'
  const [moreSubTab, setMoreSubTab] = useState('expenses'); // 'expenses' | 'notice' | 'recipes' | 'backup'

  // --------------------------------------------------------------------------
  // 4-2. 핵심 도메인 데이터 상태 (LocalStorage + Firestore 실시간 동기화)
  // --------------------------------------------------------------------------
  const [store, setStore] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
      if (raw) {
        return normalizeStoreSchema(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Local fallback load skipped:', e);
    }
    return createInitialState();
  });

  // --------------------------------------------------------------------------
  // 4-3. UI 필터·입력·모달·토스트 상태
  // --------------------------------------------------------------------------
  const [toastMessage, setToastMessage] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [recentQuickActions, setRecentQuickActions] = useState(() => {
    try {
      const saved = localStorage.getItem(QUICK_RECENT_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['diary', 'meal', 'shopping'];
    } catch {
      return ['diary', 'meal', 'shopping'];
    }
  });
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);

  // 날씨 상태 (서울 중구 Open-Meteo 무료 API 연동)
  const [weatherState, setWeatherState] = useState({
    temp: 13,
    minTemp: 7,
    maxTemp: 16,
    rainAlert: '오늘 비 소식 없음 (강수확률 10%)',
    hasRainSoon: false,
    pm10: '좋음 (24㎍/㎥)',
    pm25: '좋음 (11㎍/㎥)',
    hourly: [
      { time: '18:00', temp: 12, pop: 10 },
      { time: '20:00', temp: 10, pop: 10 },
      { time: '22:00', temp: 9, pop: 0 }
    ]
  });

  // 식단 필터 & 입력 & 냉장고 자동 차감 연동 ([4] 신규 고도화 기능)
  const [mealSearchQuery, setMealSearchQuery] = useState('');
  const [newMealForm, setNewMealForm] = useState({
    date: getTodayStr(),
    slot: '저녁',
    menu: '',
    category: '집밥',
    ingredients: '',
    note: '',
    autoDeductFridge: true,
    deductStep: 0.5
  });
  const [lastMealDeductUndo, setLastMealDeductUndo] = useState(null);

  // 냉장고 필터 & 입력 & 레시피 추천 모달
  const [fridgeSearch, setFridgeSearch] = useState('');
  const [fridgeLocationFilter, setFridgeLocationFilter] = useState('all');
  const [onlyUrgentOrHalfFilter, setOnlyUrgentOrHalfFilter] = useState(false);
  const [fridgeSortBy, setFridgeSortBy] = useState('expiry');
  const [newFridgeForm, setNewFridgeForm] = useState({
    name: '',
    quantity: '1',
    unit: '개',
    location: 'fridge',
    expiryDate: '',
    memo: ''
  });
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState([]);

  // 장보기 필터 & 입력 & 직전 입고 실행취소 버퍼
  const [shoppingSearch, setShoppingSearch] = useState('');
  const [shoppingStatusFilter, setShoppingStatusFilter] = useState('all');
  const [newShoppingForm, setNewShoppingForm] = useState({ name: '', qty: '1개', memo: '' });
  const [lastMovedShoppingUndo, setLastMovedShoppingUndo] = useState(null);

  // 루틴 & 할일 입력
  const [newRoutineForm, setNewRoutineForm] = useState({
    title: '',
    slot: 'morning',
    scheduledTime: '',
    frequency: 'daily'
  });
  const [todoSearch, setTodoSearch] = useState('');
  const [newTodoForm, setNewTodoForm] = useState({ title: '', dueDate: getTodayStr(), memo: '' });
  const [newScheduleForm, setNewScheduleForm] = useState({
    date: getTodayStr(),
    time: '10:30',
    title: '',
    category: '육아'
  });

  // 육아일기 입력 & 필터 & 라이트박스 & 한 장 내보내기 미리보기
  const [diaryChildFilter, setDiaryChildFilter] = useState('all');
  const [diarySearch, setDiarySearch] = useState('');
  const [diaryLightboxUrl, setDiaryLightboxUrl] = useState('');
  const [exportedDiaryPngUrl, setExportedDiaryPngUrl] = useState('');
  const [isPolishingDiary, setIsPolishingDiary] = useState(false);
  const [newDiaryForm, setNewDiaryForm] = useState({
    date: getTodayStr(),
    childTarget: 'both',
    mood: '🥰',
    title: '',
    content: '',
    photos: []
  });
  const [isDiaryUploading, setIsDiaryUploading] = useState(false);
  const [newHealthForm, setNewHealthForm] = useState({
    date: getTodayStr(),
    childId: '시율',
    type: '성장·검진',
    heightCm: '',
    weightKg: '',
    note: ''
  });

  // 가계부·식비 입력 & 공지 & 레시피 & 백업 JSON
  const [newExpenseForm, setNewExpenseForm] = useState({
    date: getTodayStr(),
    category: '식재료',
    title: '',
    amount: ''
  });
  const [newNoticeForm, setNewNoticeForm] = useState({ title: '', content: '' });
  const [newRecipeForm, setNewRecipeForm] = useState({
    title: '',
    category: '유아식·가족식',
    cookTime: '20분',
    ingredients: '',
    steps: ''
  });
  const [importJsonText, setImportJsonText] = useState('');

  const toastTimerRef = useRef(null);
  const activeBlobUrlsRef = useRef(new Set());

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 3200);
  };

  // 현재 사용자 역할 및 권한 계산
  const currentMember = useMemo(
    () => FAMILY_MEMBERS.find((m) => m.id === currentMemberId) || FAMILY_MEMBERS[0],
    [currentMemberId]
  );
  const isAdmin = currentMember.role === 'admin';

  // 일반(user) 계정일 때 관리자 전용 화면 접근 차단 가드
  useEffect(() => {
    if (!isAdmin) {
      if (activeTab === 'baby' && babySubTab === 'diary') {
        setBabySubTab('health');
      }
      if (activeTab === 'more' && moreSubTab === 'backup') {
        setMoreSubTab('expenses');
      }
    }
  }, [isAdmin, activeTab, babySubTab, moreSubTab]);

  // 임시 blob: URL 정리 (언마운트 시 메모리 누수 방지)
  useEffect(() => {
    const urls = activeBlobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
      urls.clear();
    };
  }, []);

  // 로컬 스토리지 자동 백업 동기화
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn('LocalStorage write warning:', e);
    }
  }, [store]);

  // --------------------------------------------------------------------------
  // 4-4. Firebase 인증 및 실시간 컬렉션 동기화 (RULE 1, 2, 3 준수)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!firebaseServices.enabled || !firebaseServices.auth) return;
    let mounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(firebaseServices.auth, __initial_auth_token);
        } else {
          await signInAnonymously(firebaseServices.auth);
        }
      } catch (err) {
        console.warn('Firebase auth fallback:', err);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(firebaseServices.auth, (user) => {
      if (mounted) setFbUser(user || null);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!firebaseServices.enabled || !firebaseServices.db || !fbUser) return;
    const stateDocRef = doc(
      firebaseServices.db,
      'artifacts',
      appId,
      'public',
      'data',
      'family_hub_state_v11',
      'singleton'
    );
    const unsub = onSnapshot(
      stateDocRef,
      (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          if (remote && typeof remote === 'object') {
            setStore((prev) => {
              const normalized = normalizeStoreSchema({ ...prev, ...remote });
              return {
                ...normalized,
                routines: mergeRoutinesPreservingActiveCompletion(
                  normalized.routines,
                  prev.routines
                )
              };
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore snapshot warning:', err);
      }
    );
    return () => unsub();
  }, [fbUser]);

  // 서울 중구 실시간 날씨 및 시간대별 강수 확률 조회
  useEffect(() => {
    let active = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=37.5636&longitude=126.9975&current=temperature_2m&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1'
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data) return;

        const nowHour = new Date().getHours();
        const times = data.hourly?.time || [];
        const temps = data.hourly?.temperature_2m || [];
        const pops = data.hourly?.precipitation_probability || [];

        const upcoming = [];
        let maxRainPop = 0;
        let firstRainHour = '';

        for (let i = 0; i < times.length; i += 1) {
          const hourStr = String(times[i]).slice(11, 13);
          const hNum = Number(hourStr);
          if (Number.isFinite(hNum) && hNum >= nowHour) {
            const popVal = Number(pops[i] || 0);
            if (popVal > maxRainPop) maxRainPop = popVal;
            if (popVal >= 40 && !firstRainHour) firstRainHour = `${hourStr}시`;
            if (upcoming.length < 6) {
              upcoming.push({
                time: `${hourStr}:00`,
                temp: Math.round(Number(temps[i] ?? 13)),
                pop: popVal
              });
            }
          }
        }

        const hasRainSoon = maxRainPop >= 40;
        setWeatherState((prev) => ({
          ...prev,
          temp: Math.round(Number(data.current?.temperature_2m ?? prev.temp)),
          minTemp: Math.round(Number(data.daily?.temperature_2m_min?.[0] ?? prev.minTemp)),
          maxTemp: Math.round(Number(data.daily?.temperature_2m_max?.[0] ?? prev.maxTemp)),
          hasRainSoon,
          rainAlert: hasRainSoon
            ? `☔ ${firstRainHour || '오늘 중'} 비 예보 (${maxRainPop}%)`
            : `오늘 비 소식 없음 (강수확률 ${maxRainPop}%)`,
          hourly: upcoming.length > 0 ? upcoming : prev.hourly
        }));
      } catch {
        // 오프라인 시 기본 상태 유지
      }
    };
    fetchWeather();
    return () => {
      active = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 4-5. 클라우드 동기화 및 반복 루틴 완료 상태 보존 병합 로직
  // --------------------------------------------------------------------------
  function mergeRoutinesPreservingActiveCompletion(targetList, referenceList) {
    const refMap = new Map((referenceList || []).map((r) => [r.id, r]));
    return (targetList || []).map((item) => {
      const refItem = refMap.get(item.id);
      if (!refItem) return item;
      const activeKey = getActiveDoneKeyForFreq(item.frequency || 'daily');
      const itemDone = item.lastDoneKey === activeKey;
      const refDone = refItem.lastDoneKey === activeKey;
      const mergedSteps = Array.from(
        new Set([...(item.stepDoneIndices || []), ...(refItem.stepDoneIndices || [])])
      );
      return {
        ...item,
        lastDoneKey: itemDone || refDone ? activeKey : item.lastDoneKey || '',
        stepDoneIndices: mergedSteps
      };
    });
  }

  const persistStore = async (updaterFn) => {
    let nextSnapshot = null;
    setStore((prev) => {
      nextSnapshot = updaterFn(prev);
      return nextSnapshot;
    });
    if (nextSnapshot && firebaseServices.enabled && firebaseServices.db && fbUser) {
      try {
        const stateDocRef = doc(
          firebaseServices.db,
          'artifacts',
          appId,
          'public',
          'data',
          'family_hub_state_v11',
          'singleton'
        );
        await setDoc(stateDocRef, { ...nextSnapshot, updatedAt: Date.now() }, { merge: true });
      } catch (err) {
        console.warn('Cloud sync deferred to local storage:', err);
      }
    }
  };

  // --------------------------------------------------------------------------
  // 4-6. 파생 통계 계산 (TDZ 없는 순수 useMemo 체인 + Zero-Division 방어)
  // --------------------------------------------------------------------------
  const todayStr = getTodayStr();
  const currentMonthStr = getCurrentMonthKey();

  // 냉장고 통계 (전체 / 임박 D-2 이하 / 반남음 0 < qty < 1)
  const fridgeStats = useMemo(() => {
    const list = Array.isArray(store.fridgeItems) ? store.fridgeItems : [];
    let expiringCount = 0;
    let halfCount = 0;
    list.forEach((item) => {
      if (isExpiringSoonItem(item)) expiringCount += 1;
      if (isHalfRemainingItem(item)) halfCount += 1;
    });
    return {
      totalCount: list.length,
      expiringCount,
      halfCount,
      urgentOrHalfCount: list.filter((i) => isExpiringSoonItem(i) || isHalfRemainingItem(i)).length
    };
  }, [store.fridgeItems]);

  // 루틴 달성률 통계
  const routineStats = useMemo(() => {
    const list = Array.isArray(store.routines) ? store.routines : [];
    const total = list.length;
    const done = list.filter((r) => isRoutineDoneToday(r)).length;
    return {
      total,
      done,
      percent: safePercent(done, total)
    };
  }, [store.routines]);

  // 오늘 식단 & 장보기 남은 건수
  const snapshotStats = useMemo(() => {
    const todayMealsCount = (store.meals || []).filter((m) => m.date === todayStr).length;
    const remainingShoppingCount = (store.shoppingItems || []).filter((s) => !s.checked).length;
    const checkedShoppingCount = (store.shoppingItems || []).filter((s) => s.checked).length;
    return {
      todayMealsCount,
      remainingShoppingCount,
      checkedShoppingCount
    };
  }, [store.meals, store.shoppingItems, todayStr]);

  // [2] 시각화 개선: 이번 달 식비·가계부 통계 (Zero-Division & Number.isFinite 가드)
  const expenseStats = useMemo(() => {
    const list = Array.isArray(store.expenses) ? store.expenses : [];
    const thisMonthList = list.filter((e) => String(e.date || '').startsWith(currentMonthStr));
    const totalAmount = thisMonthList.reduce((acc, cur) => acc + parseSafeAmount(cur.amount), 0);
    const dayOfMonth = Math.max(1, new Date().getDate());
    const dailyAverage = totalAmount > 0 ? Math.round(totalAmount / dayOfMonth) : 0;

    const breakdown = EXPENSE_CATEGORIES.map((cat) => {
      const sum = thisMonthList
        .filter((e) => e.category === cat)
        .reduce((acc, cur) => acc + parseSafeAmount(cur.amount), 0);
      return {
        category: cat,
        amount: sum,
        percent: safePercent(sum, totalAmount)
      };
    });

    return {
      totalAmount,
      dailyAverage,
      count: thisMonthList.length,
      breakdown
    };
  }, [store.expenses, currentMonthStr]);

  // [4] 신규 고도화: 최근 7일 주간 가족 리포트 집계
  const weeklyReportData = useMemo(() => {
    const sevenDaysAgo = addDaysStr(-6);
    const recentMeals = (store.meals || []).filter(
      (m) => m.date >= sevenDaysAgo && m.date <= todayStr
    );
    const homeMeals = recentMeals.filter((m) => m.category !== '외식·배달').length;
    const eatingOutMeals = recentMeals.filter((m) => m.category === '외식·배달').length;
    const homeMealRatio = safePercent(homeMeals, recentMeals.length);

    const recentExpenses = (store.expenses || []).filter(
      (e) => e.date >= sevenDaysAgo && e.date <= todayStr
    );
    const weeklySpend = recentExpenses.reduce((acc, cur) => acc + parseSafeAmount(cur.amount), 0);

    const recentDiaries = (store.babyDiaryEntries || []).filter(
      (d) => d.date >= sevenDaysAgo && d.date <= todayStr
    );
    const recentHealth = (store.babyHealthLogs || []).filter(
      (h) => h.date >= sevenDaysAgo && h.date <= todayStr
    );

    return {
      periodLabel: `${sevenDaysAgo} ~ ${todayStr}`,
      totalMeals: recentMeals.length,
      homeMeals,
      eatingOutMeals,
      homeMealRatio,
      weeklySpend,
      routinePercent: routineStats.percent,
      routineDone: routineStats.done,
      routineTotal: routineStats.total,
      diaryCount: recentDiaries.length,
      healthCount: recentHealth.length,
      latestDiaryTitle: recentDiaries[0]?.title || '이번 주 등록된 일기 없음',
      fridgeTotal: fridgeStats.totalCount,
      fridgeUrgentOrHalf: fridgeStats.urgentOrHalfCount,
      remainingShopping: snapshotStats.remainingShoppingCount
    };
  }, [
    store.meals,
    store.expenses,
    store.babyDiaryEntries,
    store.babyHealthLogs,
    todayStr,
    routineStats,
    fridgeStats,
    snapshotStats
  ]);

  // 식단 입력 시 매칭되는 냉장고 재료 실시간 감지 ([4] 식단-냉장고 자동 차감 연동)
  const matchedFridgeItemsForNewMeal = useMemo(() => {
    const rawKeywords = `${newMealForm.menu} ${newMealForm.ingredients}`
      .toLowerCase()
      .split(/[\s,&+/·()]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (rawKeywords.length === 0) return [];
    return (store.fridgeItems || []).filter((item) => {
      const iName = String(item.name || '').toLowerCase();
      return rawKeywords.some((kw) => iName.includes(kw) || kw.includes(iName));
    });
  }, [newMealForm.menu, newMealForm.ingredients, store.fridgeItems]);

  // 냉장고 필터링 & 정렬 목록
  const filteredFridgeItems = useMemo(() => {
    const q = fridgeSearch.trim().toLowerCase();
    const list = (store.fridgeItems || []).filter((item) => {
      if (!item || !item.name) return false;
      if (fridgeLocationFilter !== 'all' && item.location !== fridgeLocationFilter) return false;
      if (onlyUrgentOrHalfFilter && !isExpiringSoonItem(item) && !isHalfRemainingItem(item)) {
        return false;
      }
      if (q) {
        const matchName = String(item.name).toLowerCase().includes(q);
        const matchMemo = String(item.memo || '').toLowerCase().includes(q);
        if (!matchName && !matchMemo) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (fridgeSortBy === 'name') {
        return String(a.name).localeCompare(String(b.name), 'ko');
      }
      if (fridgeSortBy === 'half') {
        const aH = isHalfRemainingItem(a) ? 0 : 1;
        const bH = isHalfRemainingItem(b) ? 0 : 1;
        if (aH !== bH) return aH - bH;
      }
      const dA = getDaysUntilExpiry(a.expiryDate);
      const dB = getDaysUntilExpiry(b.expiryDate);
      if (dA === null && dB === null) return String(a.name).localeCompare(String(b.name), 'ko');
      if (dA === null) return 1;
      if (dB === null) return -1;
      return dA - dB;
    });
  }, [store.fridgeItems, fridgeSearch, fridgeLocationFilter, onlyUrgentOrHalfFilter, fridgeSortBy]);

  // 맞춤 레시피 매칭 결과
  const matchedRecipes = useMemo(() => {
    const selectedSet = new Set(
      selectedRecipeIngredients.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    );
    const fridgeSet = new Set(
      (store.fridgeItems || []).map((i) => String(i.name).trim().toLowerCase()).filter(Boolean)
    );

    return (store.recipes || [])
      .map((rec) => {
        const ings = Array.isArray(rec.ingredients) ? rec.ingredients : [];
        const matchedSelected = [];
        const matchedFridge = [];
        const missing = [];
        ings.forEach((ing) => {
          const lower = String(ing).toLowerCase();
          if (Array.from(selectedSet).some((s) => s.includes(lower) || lower.includes(s))) {
            matchedSelected.push(ing);
          } else if (Array.from(fridgeSet).some((f) => f.includes(lower) || lower.includes(f))) {
            matchedFridge.push(ing);
          } else {
            missing.push(ing);
          }
        });
        return {
          ...rec,
          matchedSelected,
          matchedFridge,
          missing,
          score: matchedSelected.length * 3 + matchedFridge.length
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [store.recipes, store.fridgeItems, selectedRecipeIngredients]);

  // 장보기 필터링 목록 & 냉장고 임박·부족 추천 재료
  const filteredShoppingItems = useMemo(() => {
    const q = shoppingSearch.trim().toLowerCase();
    return (store.shoppingItems || []).filter((item) => {
      if (shoppingStatusFilter === 'remaining' && item.checked) return false;
      if (shoppingStatusFilter === 'checked' && !item.checked) return false;
      if (q) {
        const mName = String(item.name || '').toLowerCase().includes(q);
        const mMemo = String(item.memo || '').toLowerCase().includes(q);
        if (!mName && !mMemo) return false;
      }
      return true;
    });
  }, [store.shoppingItems, shoppingSearch, shoppingStatusFilter]);

  const shoppingRestockSuggestions = useMemo(() => {
    const existingNames = new Set(
      (store.shoppingItems || []).map((s) => String(s.name || '').trim().toLowerCase())
    );
    return (store.fridgeItems || [])
      .filter((f) => isExpiringSoonItem(f) || isHalfRemainingItem(f) || parseSafeQty(f.quantity) <= 1)
      .filter((f) => !existingNames.has(String(f.name || '').trim().toLowerCase()))
      .slice(0, 6);
  }, [store.fridgeItems, store.shoppingItems]);

  // --------------------------------------------------------------------------
  // 4-7. 주요 액션 핸들러
  // --------------------------------------------------------------------------
  const triggerQuickAction = (actionKey) => {
    const meta = QUICK_ACTION_META[actionKey];
    if (!meta) return;
    if (meta.adminOnly && !isAdmin) {
      showToast('관리자 계정에서만 사용할 수 있는 기능입니다.');
      return;
    }
    const updatedRecent = [actionKey, ...recentQuickActions.filter((k) => k !== actionKey)].slice(
      0,
      3
    );
    setRecentQuickActions(updatedRecent);
    try {
      localStorage.setItem(QUICK_RECENT_KEY, JSON.stringify(updatedRecent));
    } catch {
      // ignore
    }
    setIsQuickAddOpen(false);
    setActiveTab(meta.tab);
    if (meta.tab === 'baby' && meta.sub) setBabySubTab(meta.sub);
    if (meta.tab === 'more' && meta.sub) setMoreSubTab(meta.sub);
  };

  // [4] 식단 등록 + 매칭된 냉장고 재료 자동 차감 및 실행취소
  const handleCreateMealWithFridgeSync = async (e) => {
    e.preventDefault();
    if (!newMealForm.menu.trim()) return;

    const matchedIds = new Set(matchedFridgeItemsForNewMeal.map((m) => m.id));
    const shouldDeduct = newMealForm.autoDeductFridge && matchedIds.size > 0;
    const step = parseSafeQty(newMealForm.deductStep) || 0.5;
    const prevFridgeSnapshot = shouldDeduct ? [...(store.fridgeItems || [])] : null;

    await persistStore((prev) => {
      const nextFridge = shouldDeduct
        ? (prev.fridgeItems || [])
            .map((item) => {
              if (!matchedIds.has(item.id)) return item;
              const nextQty = Math.max(0, Math.round((parseSafeQty(item.quantity) - step) * 100) / 100);
              return { ...item, quantity: nextQty };
            })
            .filter((item) => item.quantity > 0)
        : prev.fridgeItems || [];

      return {
        ...prev,
        fridgeItems: nextFridge,
        meals: [
          {
            id: `meal-${Date.now()}`,
            date: newMealForm.date,
            slot: newMealForm.slot,
            menu: newMealForm.menu.trim(),
            category: newMealForm.category,
            ingredients: newMealForm.ingredients.trim(),
            note: newMealForm.note.trim()
          },
          ...(prev.meals || [])
        ]
      };
    });

    if (shouldDeduct && prevFridgeSnapshot) {
      setLastMealDeductUndo(prevFridgeSnapshot);
      showToast(
        `🍽️ 식단 등록 완료! 냉장고 ${matchedIds.size}종 재고에서 -${step}씩 차감했습니다.`
      );
    } else {
      showToast('식단이 등록되었습니다.');
    }

    setNewMealForm((prev) => ({ ...prev, menu: '', ingredients: '', note: '' }));
  };

  const handleUndoMealFridgeDeduction = async () => {
    if (!lastMealDeductUndo) return;
    const restored = lastMealDeductUndo;
    await persistStore((prev) => ({
      ...prev,
      fridgeItems: restored
    }));
    setLastMealDeductUndo(null);
    showToast('방금 차감된 냉장고 재고를 원래대로 복구했습니다.');
  };

  // [3] 편의성 개선: 장보기 구매완료 품목 → 냉장고 일괄 입고 (7일 기본 유통기한)
  const handleMoveCheckedShoppingToFridge = async () => {
    const checkedItems = (store.shoppingItems || []).filter((i) => i.checked);
    if (checkedItems.length === 0) {
      showToast('체크 완료된 장보기 품목이 없습니다.');
      return;
    }

    const defaultExpiry = addDaysStr(7);
    const createdFridgeItems = checkedItems.map((item, idx) => ({
      id: `fr-${Date.now()}-${idx}`,
      name: item.name,
      quantity: 1,
      unit: item.qty || '개',
      location: 'fridge',
      expiryDate: defaultExpiry,
      memo: item.memo ? `장보기 입고 (${item.memo})` : '장보기 구매완료 입고'
    }));

    setLastMovedShoppingUndo({
      checkedItems,
      createdIds: createdFridgeItems.map((f) => f.id)
    });

    await persistStore((prev) => ({
      ...prev,
      fridgeItems: [...createdFridgeItems, ...(prev.fridgeItems || [])],
      shoppingItems: (prev.shoppingItems || []).filter((i) => !i.checked)
    }));

    showToast(`📦 ${checkedItems.length}개 품목을 냉장고로 입고했습니다! (기한 +7일)`);
  };

  const handleUndoMovedShoppingToFridge = async () => {
    if (!lastMovedShoppingUndo) return;
    const { checkedItems, createdIds } = lastMovedShoppingUndo;
    const createdSet = new Set(createdIds);
    await persistStore((prev) => ({
      ...prev,
      fridgeItems: (prev.fridgeItems || []).filter((f) => !createdSet.has(f.id)),
      shoppingItems: [...checkedItems, ...(prev.shoppingItems || [])]
    }));
    setLastMovedShoppingUndo(null);
    showToast('방금 입고한 장보기 항목을 되돌렸습니다.');
  };

  // 임박·반남음 재료 자동 선택 레시피 추천 열기
  const handleOpenUrgentRecipeModal = () => {
    const urgentOrHalf = (store.fridgeItems || []).filter(
      (i) => isExpiringSoonItem(i) || isHalfRemainingItem(i)
    );
    const names =
      urgentOrHalf.length > 0
        ? Array.from(new Set(urgentOrHalf.map((i) => i.name)))
        : (store.fridgeItems || []).slice(0, 4).map((i) => i.name);
    setSelectedRecipeIngredients(names);
    setIsRecipeModalOpen(true);
  };

  // [4] 주간 리포트 카카오톡 공유 텍스트 복사
  const handleCopyWeeklyReport = async () => {
    const r = weeklyReportData;
    const text = [
      `📊 [우리집 주간 가족 리포트] (${r.periodLabel})`,
      `• 🍽️ 식단 기록: 총 ${r.totalMeals}끼 (집밥 ${r.homeMeals}끼 · 외식/배달 ${r.eatingOutMeals}끼 / 집밥비율 ${r.homeMealRatio}%)`,
      `• 💳 최근 7일 식비·생활 지출: ${r.weeklySpend.toLocaleString()}원`,
      `• ⏰ 오늘 루틴 달성률: ${r.routineDone}/${r.routineTotal}건 (${r.routinePercent}%)`,
      `• 👶 시목(${formatBabyAgeLabel(CHILDREN_INFO.시목.birthDate)}) · 시율(${formatBabyAgeLabel(CHILDREN_INFO.시율.birthDate)}): 주간 일기 ${r.diaryCount}편 · 성장/진료 ${r.healthCount}건`,
      `• ❄️ 냉장고 현황: 총 ${r.fridgeTotal}종 (임박·반남음 ${r.fridgeUrgentOrHalf}종) · 남은 장보기 ${r.remainingShopping}건`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      showToast('📋 주간 가족 리포트가 클립보드에 복사되었습니다!');
    } catch {
      showToast('복사 권한을 확인해 주세요.');
    }
  };

  // 육아일기: 오늘 아이 식단·성장·진료 기록 자동 불러오기
  const handlePullTodayBabySummary = () => {
    const targetDate = newDiaryForm.date || getTodayStr();
    const targetIds =
      newDiaryForm.childTarget === 'both' ? ['시목', '시율'] : [newDiaryForm.childTarget];

    const dayMeals = (store.meals || []).filter((m) => m.date === targetDate);
    const dayHealth = (store.babyHealthLogs || []).filter(
      (h) => h.date === targetDate && targetIds.includes(h.childId)
    );

    const lines = [];
    if (dayMeals.length > 0) {
      lines.push(`🍚 오늘 식단: ${dayMeals.map((m) => `${m.slot}(${m.menu})`).join(', ')}`);
    }
    if (dayHealth.length > 0) {
      dayHealth.forEach((h) => {
        const metrics = [
          h.heightCm ? `키 ${h.heightCm}cm` : '',
          h.weightKg ? `몸무게 ${h.weightKg}kg` : ''
        ]
          .filter(Boolean)
          .join(' · ');
        lines.push(`🩺 ${h.childId} 기록: ${metrics} ${h.note || ''}`.trim());
      });
    }

    if (lines.length === 0) {
      showToast('선택한 날짜에 등록된 식단이나 성장·진료 기록이 없습니다.');
      return;
    }

    setNewDiaryForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${lines.join('\n')}` : lines.join('\n')
    }));
    showToast('✨ 오늘의 식단·성장 기록을 일기에 불러왔습니다.');
  };

  // 육아일기: AI 문장 다듬기 (Gemini API 연동 + 오프라인 안전 폴백)
  const handlePolishDiaryWithAi = async () => {
    if (!newDiaryForm.content.trim()) {
      showToast('먼저 간단한 일기 메모를 입력해 주세요.');
      return;
    }
    setIsPolishingDiary(true);
    try {
      if (geminiApiKey) {
        const prompt = `다음은 부모가 작성한 육아일기 초안입니다. 사실(식단, 수치, 행동)은 절대 바꾸지 말고 따뜻하고 자연스러운 한국어 육아일기 제목 1줄과 본문으로 다듬어 JSON({"title":"...","content":"..."}) 형식으로만 답하세요.\n\n제목: ${newDiaryForm.title}\n내용: ${newDiaryForm.content}`;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.content) {
              setNewDiaryForm((prev) => ({
                ...prev,
                title: parsed.title || prev.title,
                content: parsed.content
              }));
              showToast('✨ AI가 일기 문장을 따뜻하게 다듬었습니다!');
              return;
            }
          }
        }
      }

      // API 키 미설정 시 로컬 문장 정리 폴백
      const polishedContent = newDiaryForm.content
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n');
      setNewDiaryForm((prev) => ({
        ...prev,
        title: prev.title.trim() || `${prev.date} 소중한 하루 기록`,
        content: `${polishedContent}\n오늘도 건강하게 자라주어 고마워 ♡`
      }));
      showToast('✨ 일기 문장을 깔끔하게 정리했습니다!');
    } catch {
      showToast('일기 정리를 완료했습니다.');
    } finally {
      setIsPolishingDiary(false);
    }
  };

  // 육아일기: 다중 사진 원본 비율 유지 + 가변 길이 한 장 PNG 내보내기
  const handleExportDiaryCardPng = async (entry) => {
    try {
      const cIds = Array.isArray(entry.childIds) ? entry.childIds : ['시율'];
      const headerSubtitle = cIds
        .map((cid) => {
          const info = CHILDREN_INFO[cid] || CHILDREN_INFO.시율;
          return `${info.fullName}(${info.birthDate}생 · ${formatBabyAgeLabel(info.birthDate, entry.date)})`;
        })
        .join(' · ');

      const loadedImages = [];
      for (const url of entry.photos || []) {
        try {
          const img = await loadCorsSafeImage(url);
          if (img) loadedImages.push(img);
        } catch {
          // skip unloadable image
        }
      }

      const canvasWidth = 900;
      const padding = 56;
      const contentWidth = canvasWidth - padding * 2;

      const measureCanvas = document.createElement('canvas');
      const mCtx = measureCanvas.getContext('2d');
      mCtx.font = '28px sans-serif';
      const wrappedBody = wrapCanvasLines(mCtx, String(entry.content || ''), contentWidth);

      let photosTotalHeight = 0;
      const scaledPhotos = loadedImages.map((img) => {
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
        const drawW = contentWidth;
        const drawH = Math.round(drawW * ratio);
        photosTotalHeight += drawH + 24;
        return { img, drawW, drawH };
      });

      const headerHeight = 165;
      const titleHeight = 64;
      const bodyHeight = Math.max(110, wrappedBody.length * 44 + 40);
      const footerHeight = 76;
      const totalHeight = headerHeight + photosTotalHeight + titleHeight + bodyHeight + footerHeight;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');

      // Warm Ivory 배경 & Sage Green 테두리
      ctx.fillStyle = '#FAF8F3';
      ctx.fillRect(0, 0, canvasWidth, totalHeight);
      ctx.strokeStyle = '#35503C';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, canvasWidth - 40, totalHeight - 40);

      // 상단 헤더
      ctx.fillStyle = '#35503C';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`📖 ${headerSubtitle}`, padding, 76);

      ctx.fillStyle = '#263329';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(`${entry.date}   ${entry.mood || '🥰'}`, padding, 128);

      let cursorY = headerHeight;

      // 다중 사진 원본 비율 유지 렌더링
      for (const item of scaledPhotos) {
        ctx.drawImage(item.img, padding, cursorY, item.drawW, item.drawH);
        cursorY += item.drawH + 24;
      }

      // 제목 & 본문
      ctx.fillStyle = '#263329';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(String(entry.title || ''), padding, cursorY + 28);
      cursorY += titleHeight;

      ctx.fillStyle = '#3A4A3E';
      ctx.font = '28px sans-serif';
      wrappedBody.forEach((line, idx) => {
        ctx.fillText(line, padding, cursorY + 24 + idx * 44);
      });

      // 하단 서명
      ctx.fillStyle = '#55695A';
      ctx.font = '22px sans-serif';
      ctx.fillText(
        `작성: ${entry.author || '가족'}  |  수혁 · 아리나 · 시목 · 시율 ♡`,
        padding,
        totalHeight - 44
      );

      const pngUrl = canvas.toDataURL('image/png');
      setExportedDiaryPngUrl(pngUrl);
      showToast('🖼️ 원본 사진 비율이 유지된 육아일기 이미지가 생성되었습니다!');
    } catch {
      showToast('이미지 내보내기 중 오류가 발생했습니다.');
    }
  };

  // 육아일기 다중 사진 첨부 핸들러 (Firebase Storage 원본 업로드 + 안전 폴백)
  const handleDiaryPhotosSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const added = files.map((file, idx) => {
      const blobUrl = URL.createObjectURL(file);
      activeBlobUrlsRef.current.add(blobUrl);
      return {
        id: `ph-${Date.now()}-${idx}`,
        url: blobUrl,
        file,
        isBlob: true
      };
    });

    setNewDiaryForm((prev) => ({
      ...prev,
      photos: [...prev.photos, ...added]
    }));
    e.target.value = '';
  };

  const handleRemoveDraftPhoto = (photoId) => {
    setNewDiaryForm((prev) => {
      const target = prev.photos.find((p) => p.id === photoId);
      if (target && target.isBlob && target.url) {
        try {
          URL.revokeObjectURL(target.url);
          activeBlobUrlsRef.current.delete(target.url);
        } catch {
          // ignore
        }
      }
      return {
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId)
      };
    });
  };

  const handleSaveBabyDiary = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('관리자(수혁·아리나)만 육아일기를 작성할 수 있습니다.');
      return;
    }
    if (!newDiaryForm.title.trim() || !newDiaryForm.content.trim()) {
      showToast('일기 제목과 내용을 입력해 주세요.');
      return;
    }

    setIsDiaryUploading(true);
    try {
      const uploadedUrls = [];
      for (const photo of newDiaryForm.photos) {
        if (photo.file && firebaseServices.enabled && firebaseServices.storage && fbUser) {
          try {
            const path = `artifacts/${appId}/baby_diary/${Date.now()}_${photo.file.name}`;
            const ref = storageRef(firebaseServices.storage, path);
            await uploadBytes(ref, photo.file);
            const downloadUrl = await getDownloadURL(ref);
            uploadedUrls.push(downloadUrl);
            if (photo.isBlob) {
              URL.revokeObjectURL(photo.url);
              activeBlobUrlsRef.current.delete(photo.url);
            }
            continue;
          } catch {
            // Storage 미활성화 시 안전 압축 폴백
          }
        }
        if (photo.file) {
          const dataUrl = await compressImageFileToDataUrl(photo.file);
          uploadedUrls.push(dataUrl);
          if (photo.isBlob) {
            URL.revokeObjectURL(photo.url);
            activeBlobUrlsRef.current.delete(photo.url);
          }
        } else if (photo.url) {
          uploadedUrls.push(photo.url);
        }
      }

      const childIds =
        newDiaryForm.childTarget === 'both' ? ['시목', '시율'] : [newDiaryForm.childTarget];

      const newEntry = {
        id: `bd-${Date.now()}`,
        date: newDiaryForm.date || getTodayStr(),
        childIds,
        mood: newDiaryForm.mood,
        title: newDiaryForm.title.trim(),
        content: newDiaryForm.content.trim(),
        photos: uploadedUrls,
        author: currentMember.name
      };

      await persistStore((prev) => ({
        ...prev,
        babyDiaryEntries: [newEntry, ...(prev.babyDiaryEntries || [])]
      }));

      setNewDiaryForm({
        date: getTodayStr(),
        childTarget: 'both',
        mood: '🥰',
        title: '',
        content: '',
        photos: []
      });
      showToast('📖 소중한 육아일기가 저장되었습니다!');
    } finally {
      setIsDiaryUploading(false);
    }
  };

  const handleDeleteBabyDiary = async (entry) => {
    if (!isAdmin) return;
    if (Array.isArray(entry.photos) && firebaseServices.enabled && firebaseServices.storage) {
      for (const url of entry.photos) {
        if (typeof url === 'string' && url.includes('firebasestorage')) {
          try {
            const ref = storageRef(firebaseServices.storage, url);
            await deleteObject(ref);
          } catch {
            // ignore already-deleted storage file
          }
        }
      }
    }
    await persistStore((prev) => ({
      ...prev,
      babyDiaryEntries: (prev.babyDiaryEntries || []).filter((d) => d.id !== entry.id)
    }));
    showToast('육아일기를 삭제했습니다.');
  };

  // JSON 전체 백업 내보내기 & 대칭 복원 (Admin 전용)
  const handleExportBackupJson = async () => {
    if (!isAdmin) return;
    const payload = {
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: store
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      showToast('전체 데이터 JSON 백업이 클립보드에 복사되었습니다.');
    } catch {
      setImportJsonText(jsonStr);
      showToast('아래 입력창에 백업 JSON이 생성되었습니다.');
    }
  };

  const handleImportBackupJson = async () => {
    if (!isAdmin) return;
    if (!importJsonText.trim()) {
      showToast('복원할 JSON 데이터를 붙여넣어 주세요.');
      return;
    }
    try {
      const parsed = JSON.parse(importJsonText);
      const src = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const restored = normalizeStoreSchema(src);
      await persistStore(() => restored);
      setImportJsonText('');
      showToast('✅ 모든 컬렉션 데이터가 정상적으로 복원되었습니다.');
    } catch {
      showToast('JSON 형식이 올바르지 않습니다. 다시 확인해 주세요.');
    }
  };

  // --------------------------------------------------------------------------
  // 4-8. 렌더링 헬퍼
  // --------------------------------------------------------------------------
  const renderExpiryChip = (expiryDate) => {
    const d = getDaysUntilExpiry(expiryDate);
    if (d === null) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500 border border-stone-200">
          기한미지정
        </span>
      );
    }
    if (d < 0) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          지남 D+{Math.abs(d)}
        </span>
      );
    }
    if (d === 0) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          🔥 오늘까지
        </span>
      );
    }
    if (d <= 2) {
      return (
        <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          ⚠️ 임박 D-{d}
        </span>
      );
    }
    return (
      <span className="whitespace-nowrap inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF3EE] text-[#35503C] border border-[#35503C]/20">
        D-{d}
      </span>
    );
  };

  // ============================================================================
  // [5] 메인 UI 렌더링 (Warm Ivory #FAF8F3 & Sage Green #35503C / #EEF3EE)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#263329] font-sans pb-24 md:pb-12">
      {/* 상단 토스트 메시지 */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#35503C] text-[#FAF8F3] px-4 py-2.5 rounded-full shadow-lg text-xs sm:text-sm font-semibold flex items-center gap-2 border border-[#FAF8F3]/20 max-w-[92vw]">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#35503C]/15">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#35503C] text-[#FAF8F3] flex items-center justify-center shrink-0 shadow-xs">
              <Home className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-[#263329] truncate">
                  수혁·아리나·시목·시율 ♡
                </h1>
                <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C] border border-[#35503C]/20">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-[#55695A] truncate">
                시목 {formatBabyAgeLabel(CHILDREN_INFO.시목.birthDate)} · 시율{' '}
                {formatBabyAgeLabel(CHILDREN_INFO.시율.birthDate)}
              </p>
            </div>
          </div>

          {/* 역할 전환 셀렉터 (Admin vs User 권한 검증용) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="현재 가족 사용자 선택"
              value={currentMemberId}
              onChange={(e) => {
                setCurrentMemberId(e.target.value);
                const next = FAMILY_MEMBERS.find((m) => m.id === e.target.value);
                showToast(`${next?.name || '사용자'} 계정으로 전환되었습니다.`);
              }}
              className="whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-[#EEF3EE] text-[#35503C] border border-[#35503C]/20 text-xs font-bold focus:outline-none"
            >
              {FAMILY_MEMBERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'admin' ? '관리자' : '열람'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 데스크톱 상단 네비게이션 */}
        <nav className="hidden md:block border-t border-[#35503C]/10 bg-[#FAF8F3]">
          <div className="max-w-5xl mx-auto px-5 py-1.5 flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'home', label: '홈', icon: Home },
              { id: 'meals', label: '식단', icon: Utensils },
              { id: 'schedule', label: '일정·루틴', icon: Calendar },
              { id: 'baby', label: '육아', icon: Baby },
              {
                id: 'fridge',
                label: '냉장고',
                icon: Refrigerator,
                badge: fridgeStats.urgentOrHalfCount
              },
              {
                id: 'shopping',
                label: '장보기',
                icon: ShoppingCart,
                badge: snapshotStats.remainingShoppingCount
              },
              { id: 'more', label: '더보기', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-[#35503C] text-[#FAF8F3] shadow-xs'
                      : 'text-[#4A5D4E] hover:bg-[#EEF3EE] hover:text-[#35503C]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span
                      className={`whitespace-nowrap text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        active ? 'bg-amber-300 text-[#263329]' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ======================================================================
          메인 콘텐츠 영역
         ====================================================================== */}
      <main className="max-w-5xl mx-auto px-3.5 sm:px-5 pt-4 space-y-5">
        {/* --------------------------------------------------------------------
            TAB 1: 홈 (HOME)
           -------------------------------------------------------------------- */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* 오늘 가족 한눈에 보기 4종 상태 스트립 */}
            <section
              aria-label="오늘 가족 한눈에 보기"
              className="rounded-2xl bg-white border border-[#35503C]/20 p-3.5 sm:p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap text-xs font-extrabold text-[#35503C] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>오늘 가족 한눈에 보기</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsWeeklyReportOpen(true)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#EEF3EE] hover:bg-[#35503C] text-[#35503C] hover:text-[#FAF8F3] text-[11px] font-extrabold flex items-center gap-1 border border-[#35503C]/20 transition"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>📊 주간 가족 리포트</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('meals')}
                  className="text-left rounded-xl bg-[#FAF8F3] hover:bg-[#EEF3EE]/70 border border-[#35503C]/15 px-3 py-2.5 transition"
                >
                  <div className="whitespace-nowrap text-[11px] font-semibold text-[#55695A]">
                    🍽️ 오늘 식단 등록
                  </div>
                  <div className="whitespace-nowrap text-base font-extrabold text-[#263329] mt-0.5">
                    {snapshotStats.todayMealsCount}끼
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="text-left rounded-xl bg-[#FAF8F3] hover:bg-[#EEF3EE]/70 border border-[#35503C]/15 px-3 py-2.5 transition"
                >
                  <div className="whitespace-nowrap text-[11px] font-semibold text-[#55695A]">
                    ⏰ 루틴 달성률
                  </div>
                  <div className="whitespace-nowrap text-base font-extrabold text-[#35503C] mt-0.5">
                    {routineStats.percent}%{' '}
                    <span className="text-[11px] font-semibold text-[#55695A]">
                      ({routineStats.done}/{routineStats.total})
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOnlyUrgentOrHalfFilter(true);
                    setActiveTab('fridge');
                  }}
                  className="text-left rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-300/70 px-3 py-2.5 transition"
                >
                  <div className="whitespace-nowrap text-[11px] font-bold text-amber-900">
                    ⚠️ 임박·반남음 재료
                  </div>
                  <div className="whitespace-nowrap text-base font-extrabold text-amber-900 mt-0.5">
                    {fridgeStats.urgentOrHalfCount}종
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('shopping')}
                  className="text-left rounded-xl bg-[#FAF8F3] hover:bg-[#EEF3EE]/70 border border-[#35503C]/15 px-3 py-2.5 transition"
                >
                  <div className="whitespace-nowrap text-[11px] font-semibold text-[#55695A]">
                    🛒 남은 장보기
                  </div>
                  <div className="whitespace-nowrap text-base font-extrabold text-[#263329] mt-0.5">
                    {snapshotStats.remainingShoppingCount}건
                  </div>
                </button>
              </div>
            </section>

            {/* 서울 중구 2줄 날씨 + 비 예보 바 */}
            <button
              type="button"
              onClick={() => setIsWeatherModalOpen(true)}
              className={`w-full text-left rounded-2xl p-3.5 sm:p-4 border transition flex items-center justify-between gap-3 ${
                weatherState.hasRainSoon
                  ? 'bg-sky-50 border-sky-300'
                  : 'bg-[#EEF3EE] border-[#35503C]/20'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#35503C] text-[#FAF8F3] flex items-center justify-center shrink-0">
                  <CloudSun className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap text-sm font-extrabold text-[#263329]">
                      서울 중구 {weatherState.temp}°C ({weatherState.minTemp}°/{weatherState.maxTemp}°)
                    </span>
                    <span
                      className={`whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded-full ${
                        weatherState.hasRainSoon
                          ? 'bg-sky-600 text-white'
                          : 'bg-white text-[#35503C] border border-[#35503C]/15'
                      }`}
                    >
                      {weatherState.rainAlert}
                    </span>
                  </div>
                  <div className="text-xs text-[#4A5D4E] flex items-center gap-2 flex-wrap">
                    <span className="whitespace-nowrap">미세먼지 {weatherState.pm10}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">초미세먼지 {weatherState.pm25}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#35503C] shrink-0" />
            </button>

            {/* 오늘 루틴 진행률 및 빠른 체크 카드 */}
            <section className="rounded-2xl bg-white border border-[#35503C]/15 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="whitespace-nowrap text-sm sm:text-base font-extrabold text-[#263329] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#35503C]" />
                  <span>오늘의 반복 루틴</span>
                </h2>
                <span className="whitespace-nowrap text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                  달성 {routineStats.done}/{routineStats.total} ({routineStats.percent}%)
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-[#EEF3EE] overflow-hidden">
                <div
                  className="h-full bg-[#35503C] transition-all duration-300"
                  style={{ width: `${routineStats.percent}%` }}
                />
              </div>

              <div className="space-y-2">
                {[...(store.routines || [])]
                  .sort((a, b) =>
                    String(a.scheduledTime || '99:99').localeCompare(
                      String(b.scheduledTime || '99:99')
                    )
                  )
                  .map((rt) => {
                    const done = isRoutineDoneToday(rt);
                    const timeText = formatKoreanTimeTag(rt.scheduledTime);
                    return (
                      <button
                        key={rt.id}
                        type="button"
                        onClick={() => {
                          const activeKey = getActiveDoneKeyForFreq(rt.frequency || 'daily');
                          persistStore((prev) => ({
                            ...prev,
                            routines: (prev.routines || []).map((item) =>
                              item.id === rt.id
                                ? { ...item, lastDoneKey: done ? '' : activeKey }
                                : item
                            )
                          }));
                        }}
                        className="w-full text-left p-2.5 rounded-xl bg-[#FAF8F3] hover:bg-[#EEF3EE]/70 border border-[#35503C]/10 flex items-center justify-between gap-2 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                              done
                                ? 'bg-[#35503C] border-[#35503C] text-white'
                                : 'bg-white border-stone-300'
                            }`}
                          >
                            {done && <Check className="w-3.5 h-3.5" />}
                          </span>
                          {timeText && (
                            <span className="whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 shrink-0">
                              ⏰ {timeText}
                            </span>
                          )}
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              done ? 'line-through text-stone-400' : 'text-[#263329]'
                            }`}
                          >
                            {rt.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 2: 식단 (MEALS + 🍳 식단 등록 시 냉장고 자동 차감 연동)
           -------------------------------------------------------------------- */}
        {activeTab === 'meals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="whitespace-nowrap text-lg font-extrabold text-[#263329]">
                우리집 식단표
              </h2>
              <div className="flex items-center gap-1.5">
                {lastMealDeductUndo && (
                  <button
                    type="button"
                    onClick={handleUndoMealFridgeDeduction}
                    className="whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-950 text-xs font-extrabold border border-amber-300 flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>차감 되돌리기</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenUrgentRecipeModal}
                  className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-[#EEF3EE] text-[#35503C] text-xs font-extrabold border border-[#35503C]/20 flex items-center gap-1.5"
                >
                  <ChefHat className="w-4 h-4" />
                  <span>임박 재료 레시피 추천</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#55695A] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mealSearchQuery}
                onChange={(e) => setMealSearchQuery(e.target.value)}
                placeholder="식단 메뉴·재료 검색..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-[#35503C]/20 text-sm"
              />
              {mealSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMealSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-200 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <form
              onSubmit={handleCreateMealWithFridgeSync}
              className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-2.5"
            >
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <input
                  type="date"
                  value={newMealForm.date}
                  onChange={(e) => setNewMealForm({ ...newMealForm, date: e.target.value })}
                  className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm"
                />
                <select
                  value={newMealForm.slot}
                  onChange={(e) => setNewMealForm({ ...newMealForm, slot: e.target.value })}
                  className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm font-semibold"
                >
                  <option value="아침">아침</option>
                  <option value="점심">점심</option>
                  <option value="저녁">저녁</option>
                  <option value="유아식">유아식</option>
                </select>
                <select
                  value={newMealForm.category}
                  onChange={(e) => setNewMealForm({ ...newMealForm, category: e.target.value })}
                  className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm font-semibold"
                >
                  <option value="집밥">집밥</option>
                  <option value="외식·배달">외식·배달</option>
                </select>
                <input
                  type="text"
                  placeholder="메뉴명 (예: 애호박 두부된장국)"
                  value={newMealForm.menu}
                  onChange={(e) => setNewMealForm({ ...newMealForm, menu: e.target.value })}
                  className="col-span-2 px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-[#35503C] text-[#FAF8F3] text-xs sm:text-sm font-bold"
                >
                  + 등록
                </button>
              </div>

              {/* [4] 신규 고도화: 매칭된 냉장고 재료 자동 차감 안내 바 */}
              {matchedFridgeItemsForNewMeal.length > 0 && (
                <div className="rounded-xl bg-[#EEF3EE] border border-[#35503C]/25 p-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-xs font-extrabold text-[#35503C] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMealForm.autoDeductFridge}
                      onChange={(e) =>
                        setNewMealForm({ ...newMealForm, autoDeductFridge: e.target.checked })
                      }
                      className="rounded accent-[#35503C]"
                    />
                    <span>
                      ❄️ 냉장고 보유 재료 자동 차감:{' '}
                      {matchedFridgeItemsForNewMeal.map((i) => i.name).join(', ')}
                    </span>
                  </label>
                  <select
                    value={newMealForm.deductStep}
                    onChange={(e) =>
                      setNewMealForm({ ...newMealForm, deductStep: Number(e.target.value) })
                    }
                    className="whitespace-nowrap px-2 py-1 rounded-lg bg-white border border-[#35503C]/20 text-xs font-bold text-[#35503C]"
                  >
                    <option value={0.5}>-0.5 단위 차감</option>
                    <option value={1}>-1.0 단위 차감</option>
                  </select>
                </div>
              )}
            </form>

            <div className="space-y-2.5">
              {(store.meals || [])
                .filter((m) => {
                  const q = mealSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    String(m.menu || '').toLowerCase().includes(q) ||
                    String(m.ingredients || '').toLowerCase().includes(q) ||
                    String(m.note || '').toLowerCase().includes(q)
                  );
                })
                .map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="whitespace-nowrap text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                          {meal.slot}
                        </span>
                        <span
                          className={`whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            meal.category === '외식·배달'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {meal.category || '집밥'}
                        </span>
                        <span className="whitespace-nowrap text-xs text-[#55695A]">{meal.date}</span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-[#263329]">
                        {meal.menu}
                      </div>
                      {meal.note && <p className="text-xs text-[#55695A]">{meal.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        persistStore((prev) => ({
                          ...prev,
                          meals: (prev.meals || []).filter((x) => x.id !== meal.id)
                        }))
                      }
                      className="p-2 text-stone-400 hover:text-rose-600 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 3: 냉장고 (FRIDGE)
           -------------------------------------------------------------------- */}
        {activeTab === 'fridge' && (
          <div className="space-y-4">
            <section className="rounded-2xl bg-[#EEF3EE] border border-[#35503C]/25 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="whitespace-nowrap text-base sm:text-lg font-extrabold text-[#263329]">
                    ❄️ 스마트 냉장고 재고
                  </h2>
                  <p className="text-xs text-[#4A5D4E]">
                    임박(D-2 이하) · 🌗 반남음(0.5 단위) 재료를 우선 소진하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenUrgentRecipeModal}
                  className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-[#35503C] text-[#FAF8F3] text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>🍳 임박·반남음 레시피 추천</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyUrgentOrHalfFilter(false)}
                  className={`text-left rounded-xl p-2.5 border ${
                    !onlyUrgentOrHalfFilter
                      ? 'bg-white border-[#35503C] font-extrabold'
                      : 'bg-white/75 border-[#35503C]/20'
                  }`}
                >
                  <div className="whitespace-nowrap text-[11px] text-[#55695A]">전체 식재료</div>
                  <div className="whitespace-nowrap text-lg font-extrabold text-[#263329]">
                    {fridgeStats.totalCount}종
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyUrgentOrHalfFilter(true)}
                  className={`text-left rounded-xl p-2.5 border ${
                    onlyUrgentOrHalfFilter
                      ? 'bg-amber-100 border-amber-600'
                      : 'bg-white border-amber-300'
                  }`}
                >
                  <div className="whitespace-nowrap text-[11px] font-bold text-amber-900">
                    ⚠️ 임박 D-2
                  </div>
                  <div className="whitespace-nowrap text-lg font-extrabold text-amber-900">
                    {fridgeStats.expiringCount}종
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyUrgentOrHalfFilter(true)}
                  className={`text-left rounded-xl p-2.5 border ${
                    onlyUrgentOrHalfFilter
                      ? 'bg-[#35503C] text-white border-[#35503C]'
                      : 'bg-white border-[#35503C]/25'
                  }`}
                >
                  <div className="whitespace-nowrap text-[11px] font-bold">🌗 반남음</div>
                  <div className="whitespace-nowrap text-lg font-extrabold">
                    {fridgeStats.halfCount}종
                  </div>
                </button>
              </div>
            </section>

            {/* 검색 + 위치 필터 + 원터치 임박·반남음 토글 */}
            <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#55695A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fridgeSearch}
                    onChange={(e) => setFridgeSearch(e.target.value)}
                    placeholder="재료명·메모 검색..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  {fridgeSearch && (
                    <button
                      type="button"
                      onClick={() => setFridgeSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-stone-200 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={fridgeSortBy}
                  onChange={(e) => setFridgeSortBy(e.target.value)}
                  className="whitespace-nowrap px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-bold"
                >
                  <option value="expiry">임박순</option>
                  <option value="half">🌗 반남음순</option>
                  <option value="name">이름순</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STORAGE_LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setFridgeLocationFilter(loc.id)}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold ${
                        fridgeLocationFilter === loc.id
                          ? 'bg-[#35503C] text-white'
                          : 'bg-[#FAF8F3] text-[#4A5D4E] border border-[#35503C]/15'
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyUrgentOrHalfFilter((prev) => !prev)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-extrabold border ${
                    onlyUrgentOrHalfFilter
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  ⚠️ 임박·반남음만 {onlyUrgentOrHalfFilter ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* 냉장고 추가 폼 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFridgeForm.name.trim()) return;
                const qty = parseSafeQty(newFridgeForm.quantity) || 1;
                persistStore((prev) => ({
                  ...prev,
                  fridgeItems: [
                    {
                      id: `fr-${Date.now()}`,
                      name: newFridgeForm.name.trim(),
                      quantity: qty,
                      unit: newFridgeForm.unit.trim() || '개',
                      location: newFridgeForm.location,
                      expiryDate: newFridgeForm.expiryDate || '',
                      memo: newFridgeForm.memo.trim()
                    },
                    ...(prev.fridgeItems || [])
                  ]
                }));
                setNewFridgeForm({
                  name: '',
                  quantity: '1',
                  unit: '개',
                  location: 'fridge',
                  expiryDate: '',
                  memo: ''
                });
                showToast('냉장고 재고를 추가했습니다.');
              }}
              className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 grid grid-cols-2 sm:grid-cols-6 gap-2"
            >
              <input
                type="text"
                placeholder="재료명"
                value={newFridgeForm.name}
                onChange={(e) => setNewFridgeForm({ ...newFridgeForm, name: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={newFridgeForm.quantity}
                  onChange={(e) => setNewFridgeForm({ ...newFridgeForm, quantity: e.target.value })}
                  className="w-full px-2 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                />
                <input
                  type="text"
                  value={newFridgeForm.unit}
                  onChange={(e) => setNewFridgeForm({ ...newFridgeForm, unit: e.target.value })}
                  className="w-14 px-2 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                />
              </div>
              <select
                value={newFridgeForm.location}
                onChange={(e) => setNewFridgeForm({ ...newFridgeForm, location: e.target.value })}
                className="px-2 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm"
              >
                <option value="fridge">냉장실</option>
                <option value="freezer">냉동실</option>
                <option value="pantry">실온</option>
              </select>
              <input
                type="date"
                value={newFridgeForm.expiryDate}
                onChange={(e) => setNewFridgeForm({ ...newFridgeForm, expiryDate: e.target.value })}
                className="px-2 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
              />
              <button
                type="submit"
                className="whitespace-nowrap col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-[#35503C] text-white text-xs sm:text-sm font-bold"
              >
                + 등록
              </button>
            </form>

            {/* 냉장고 목록 */}
            <div className="space-y-2">
              {filteredFridgeItems.map((item) => {
                const isHalf = isHalfRemainingItem(item);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-extrabold text-[#263329]">
                          {item.name}
                        </span>
                        {renderExpiryChip(item.expiryDate)}
                        {isHalf && (
                          <span className="whitespace-nowrap text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#35503C] text-white">
                            🌗 반남음
                          </span>
                        )}
                      </div>
                      {item.memo && <p className="text-xs text-[#55695A] truncate">{item.memo}</p>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          persistStore((prev) => ({
                            ...prev,
                            fridgeItems: (prev.fridgeItems || [])
                              .map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      quantity: Math.max(
                                        0,
                                        Math.round((parseSafeQty(x.quantity) - 0.5) * 10) / 10
                                      )
                                    }
                                  : x
                              )
                              .filter((x) => x.quantity > 0)
                          }))
                        }
                        className="whitespace-nowrap px-2 py-1 rounded-lg bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-extrabold text-[#35503C]"
                      >
                        -0.5
                      </button>
                      <span className="whitespace-nowrap text-xs sm:text-sm font-extrabold px-1.5">
                        {parseSafeQty(item.quantity)}
                        {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          persistStore((prev) => ({
                            ...prev,
                            fridgeItems: (prev.fridgeItems || []).map((x) =>
                              x.id === item.id
                                ? {
                                    ...x,
                                    quantity:
                                      Math.round((parseSafeQty(x.quantity) + 0.5) * 10) / 10
                                  }
                                : x
                            )
                          }))
                        }
                        className="whitespace-nowrap px-2 py-1 rounded-lg bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-extrabold text-[#35503C]"
                      >
                        +0.5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 4: 장보기 (SHOPPING + 📦 구매완료 → 냉장고 입고 + 냉장고 부족 재료 추천)
           -------------------------------------------------------------------- */}
        {activeTab === 'shopping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="whitespace-nowrap text-lg font-extrabold text-[#263329]">
                🛒 장보기 목록
              </h2>
              <div className="flex items-center gap-1.5">
                {lastMovedShoppingUndo && (
                  <button
                    type="button"
                    onClick={handleUndoMovedShoppingToFridge}
                    className="whitespace-nowrap px-2.5 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold"
                  >
                    ↩ 입고 취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMoveCheckedShoppingToFridge}
                  disabled={snapshotStats.checkedShoppingCount === 0}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                    snapshotStats.checkedShoppingCount > 0
                      ? 'bg-[#35503C] text-[#FAF8F3] shadow-xs'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>📦 구매완료 → 냉장고 입고 ({snapshotStats.checkedShoppingCount})</span>
                </button>
              </div>
            </div>

            {/* 냉장고 부족·임박 재료 1탭 장보기 담기 추천 */}
            {shoppingRestockSuggestions.length > 0 && (
              <div className="rounded-2xl bg-[#EEF3EE] border border-[#35503C]/20 p-3 space-y-1.5">
                <div className="text-xs font-extrabold text-[#35503C]">
                  ❄️ 냉장고 부족 · 임박 재료 1탭 담기
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {shoppingRestockSuggestions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        persistStore((prev) => ({
                          ...prev,
                          shoppingItems: [
                            {
                              id: `sh-${Date.now()}-${f.id}`,
                              name: f.name,
                              qty: `1${f.unit || '개'}`,
                              checked: false,
                              memo: '냉장고 보충'
                            },
                            ...(prev.shoppingItems || [])
                          ]
                        }));
                        showToast(`'${f.name}' 품목을 장보기에 담았습니다.`);
                      }}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-[#35503C] text-[#35503C] hover:text-white border border-[#35503C]/20 text-xs font-bold transition"
                    >
                      + {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 장보기 진행률 바 */}
            <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#35503C]">
                  장보기 진행률 {snapshotStats.checkedShoppingCount}/
                  {(store.shoppingItems || []).length}건
                </span>
                <span className="text-[#263329]">
                  {safePercent(
                    snapshotStats.checkedShoppingCount,
                    (store.shoppingItems || []).length
                  )}
                  %
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#EEF3EE] overflow-hidden">
                <div
                  className="h-full bg-[#35503C] transition-all"
                  style={{
                    width: `${safePercent(
                      snapshotStats.checkedShoppingCount,
                      (store.shoppingItems || []).length
                    )}%`
                  }}
                />
              </div>
            </div>

            {/* 필터 & 검색 */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'all', label: '전체' },
                { id: 'remaining', label: '남음' },
                { id: 'checked', label: '담음' }
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setShoppingStatusFilter(st.id)}
                  className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold ${
                    shoppingStatusFilter === st.id
                      ? 'bg-[#35503C] text-white'
                      : 'bg-white text-[#4A5D4E] border border-[#35503C]/15'
                  }`}
                >
                  {st.label}
                </button>
              ))}
              <input
                type="text"
                value={shoppingSearch}
                onChange={(e) => setShoppingSearch(e.target.value)}
                placeholder="장보기 품목 검색..."
                className="flex-1 min-w-[140px] px-3 py-1.5 rounded-xl bg-white border border-[#35503C]/20 text-xs sm:text-sm"
              />
            </div>

            {/* 장보기 추가 폼 */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newShoppingForm.name.trim()) return;
                persistStore((prev) => ({
                  ...prev,
                  shoppingItems: [
                    {
                      id: `sh-${Date.now()}`,
                      name: newShoppingForm.name.trim(),
                      qty: newShoppingForm.qty.trim() || '1개',
                      checked: false,
                      memo: newShoppingForm.memo.trim()
                    },
                    ...(prev.shoppingItems || [])
                  ]
                }));
                setNewShoppingForm({ name: '', qty: '1개', memo: '' });
              }}
              className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 flex gap-2 flex-wrap"
            >
              <input
                type="text"
                placeholder="품목명 (예: 아기 치즈)"
                value={newShoppingForm.name}
                onChange={(e) => setNewShoppingForm({ ...newShoppingForm, name: e.target.value })}
                className="flex-1 min-w-[150px] px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
              />
              <input
                type="text"
                placeholder="수량"
                value={newShoppingForm.qty}
                onChange={(e) => setNewShoppingForm({ ...newShoppingForm, qty: e.target.value })}
                className="w-24 px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
              />
              <button
                type="submit"
                className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#35503C] text-white text-xs sm:text-sm font-bold"
              >
                + 담기
              </button>
            </form>

            <div className="space-y-2">
              {filteredShoppingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() =>
                      persistStore((prev) => ({
                        ...prev,
                        shoppingItems: (prev.shoppingItems || []).map((x) =>
                          x.id === item.id ? { ...x, checked: !x.checked } : x
                        )
                      }))
                    }
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                        item.checked
                          ? 'bg-[#35503C] border-[#35503C] text-white'
                          : 'border-stone-300'
                      }`}
                    >
                      {item.checked && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span
                      className={`text-sm font-bold truncate ${
                        item.checked ? 'line-through text-stone-400' : 'text-[#263329]'
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C] shrink-0">
                      {item.qty}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      persistStore((prev) => ({
                        ...prev,
                        shoppingItems: (prev.shoppingItems || []).filter((x) => x.id !== item.id)
                      }))
                    }
                    className="p-1.5 text-stone-400 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 5: 일정·루틴 (SCHEDULES & ROUTINES + 오늘/내일/주말 To-Do 단축키)
           -------------------------------------------------------------------- */}
        {activeTab === 'schedule' && (
          <div className="space-y-5">
            {/* 반복 루틴 & 수행 시간 태그 */}
            <section className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="whitespace-nowrap text-base font-extrabold text-[#263329]">
                  ⏰ 반복 루틴 (수행시간 태그)
                </h2>
                <span className="whitespace-nowrap text-xs font-extrabold text-[#35503C]">
                  달성 {routineStats.done}/{routineStats.total} ({routineStats.percent}%)
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newRoutineForm.title.trim()) return;
                  persistStore((prev) => ({
                    ...prev,
                    routines: [
                      ...(prev.routines || []),
                      {
                        id: `rt-${Date.now()}`,
                        title: newRoutineForm.title.trim(),
                        slot: newRoutineForm.slot,
                        scheduledTime: newRoutineForm.scheduledTime,
                        frequency: newRoutineForm.frequency,
                        lastDoneKey: '',
                        stepDoneIndices: []
                      }
                    ]
                  }));
                  setNewRoutineForm({
                    title: '',
                    slot: 'morning',
                    scheduledTime: '',
                    frequency: 'daily'
                  });
                  showToast('반복 루틴이 추가되었습니다.');
                }}
                className="space-y-2 bg-[#FAF8F3] p-3 rounded-xl border border-[#35503C]/15"
              >
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={newRoutineForm.slot}
                    onChange={(e) => setNewRoutineForm({ ...newRoutineForm, slot: e.target.value })}
                    className="px-2.5 py-2 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold"
                  >
                    {ROUTINE_SLOTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={newRoutineForm.scheduledTime}
                    onChange={(e) =>
                      setNewRoutineForm({ ...newRoutineForm, scheduledTime: e.target.value })
                    }
                    className="px-2.5 py-2 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="루틴 내용 (예: 젖병 소독)"
                    value={newRoutineForm.title}
                    onChange={(e) => setNewRoutineForm({ ...newRoutineForm, title: e.target.value })}
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-white border border-[#35503C]/20 text-sm"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                  >
                    + 추가
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[#55695A] font-semibold">빠른 시각:</span>
                  {TIME_PRESETS.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setNewRoutineForm({ ...newRoutineForm, scheduledTime: tp })}
                      className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        newRoutineForm.scheduledTime === tp
                          ? 'bg-[#35503C] text-white border-[#35503C]'
                          : 'bg-white text-[#4A5D4E] border-[#35503C]/20'
                      }`}
                    >
                      {formatKoreanTimeTag(tp)}
                    </button>
                  ))}
                </div>
              </form>

              <div className="space-y-2">
                {[...(store.routines || [])]
                  .sort((a, b) =>
                    String(a.scheduledTime || '99:99').localeCompare(
                      String(b.scheduledTime || '99:99')
                    )
                  )
                  .map((rt) => {
                    const done = isRoutineDoneToday(rt);
                    const timeLabel = formatKoreanTimeTag(rt.scheduledTime);
                    return (
                      <div
                        key={rt.id}
                        className="p-3 rounded-xl bg-[#FAF8F3] border border-[#35503C]/15 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const activeKey = getActiveDoneKeyForFreq(rt.frequency || 'daily');
                            persistStore((prev) => ({
                              ...prev,
                              routines: (prev.routines || []).map((x) =>
                                x.id === rt.id
                                  ? { ...x, lastDoneKey: done ? '' : activeKey }
                                  : x
                              )
                            }));
                          }}
                          className="flex items-center gap-2 text-left flex-1 min-w-0"
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                              done
                                ? 'bg-[#35503C] border-[#35503C] text-white'
                                : 'bg-white border-stone-300'
                            }`}
                          >
                            {done && <Check className="w-3.5 h-3.5" />}
                          </span>
                          {timeLabel && (
                            <span className="whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 shrink-0">
                              ⏰ {timeLabel}
                            </span>
                          )}
                          <span
                            className={`text-sm font-bold truncate ${
                              done ? 'line-through text-stone-400' : 'text-[#263329]'
                            }`}
                          >
                            {rt.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            persistStore((prev) => ({
                              ...prev,
                              routines: (prev.routines || []).filter((x) => x.id !== rt.id)
                            }))
                          }
                          className="p-1.5 text-stone-400 hover:text-rose-600 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* 가족 일정 & 할 일 */}
            <section className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-3">
              <h2 className="whitespace-nowrap text-base font-extrabold text-[#263329]">
                📅 가족 일정 & To-Do
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newScheduleForm.title.trim()) return;
                  persistStore((prev) => ({
                    ...prev,
                    schedules: [
                      {
                        id: `sc-${Date.now()}`,
                        ...newScheduleForm,
                        title: newScheduleForm.title.trim()
                      },
                      ...(prev.schedules || [])
                    ]
                  }));
                  setNewScheduleForm({ ...newScheduleForm, title: '' });
                }}
                className="flex gap-2 flex-wrap"
              >
                <input
                  type="date"
                  value={newScheduleForm.date}
                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, date: e.target.value })}
                  className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                />
                <input
                  type="time"
                  value={newScheduleForm.time}
                  onChange={(e) => setNewScheduleForm({ ...newScheduleForm, time: e.target.value })}
                  className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                />
                <input
                  type="text"
                  placeholder="가족·병원 일정 입력"
                  value={newScheduleForm.title}
                  onChange={(e) =>
                    setNewScheduleForm({ ...newScheduleForm, title: e.target.value })
                  }
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                >
                  + 일정
                </button>
              </form>

              <div className="space-y-2">
                {(store.schedules || []).map((sc) => (
                  <div
                    key={sc.id}
                    className="p-3 rounded-xl bg-[#FAF8F3] border border-[#35503C]/10 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="whitespace-nowrap text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-[#EEF3EE] text-[#35503C]">
                        {sc.date} {sc.time}
                      </span>
                      <span className="text-sm font-bold text-[#263329] truncate">{sc.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        persistStore((prev) => ({
                          ...prev,
                          schedules: (prev.schedules || []).filter((x) => x.id !== sc.id)
                        }))
                      }
                      className="p-1.5 text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* To-Do 검색 및 오늘/내일/주말 단축 버튼 */}
              <div className="pt-2 border-t border-[#35503C]/10 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <input
                    type="text"
                    value={todoSearch}
                    onChange={(e) => setTodoSearch(e.target.value)}
                    placeholder="🔍 할 일 검색..."
                    className="flex-1 min-w-[150px] px-3 py-1.5 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    {[
                      { label: '오늘', dateVal: getTodayStr() },
                      { label: '내일', dateVal: addDaysStr(1) },
                      { label: '주말', dateVal: getWeekendDateStr() }
                    ].map((sc) => (
                      <button
                        key={sc.label}
                        type="button"
                        onClick={() => setNewTodoForm({ ...newTodoForm, dueDate: sc.dateVal })}
                        className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          newTodoForm.dueDate === sc.dateVal
                            ? 'bg-[#35503C] text-white border-[#35503C]'
                            : 'bg-[#EEF3EE] text-[#35503C] border-[#35503C]/20'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTodoForm.title.trim()) return;
                    persistStore((prev) => ({
                      ...prev,
                      todos: [
                        {
                          id: `td-${Date.now()}`,
                          title: newTodoForm.title.trim(),
                          dueDate: newTodoForm.dueDate,
                          done: false,
                          memo: ''
                        },
                        ...(prev.todos || [])
                      ]
                    }));
                    setNewTodoForm({ ...newTodoForm, title: '' });
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder={`새 할 일 (${newTodoForm.dueDate})...`}
                    value={newTodoForm.title}
                    onChange={(e) => setNewTodoForm({ ...newTodoForm, title: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                  >
                    + 할일
                  </button>
                </form>

                {(store.todos || [])
                  .filter((t) =>
                    !todoSearch.trim()
                      ? true
                      : String(t.title || '')
                          .toLowerCase()
                          .includes(todoSearch.trim().toLowerCase())
                  )
                  .map((td) => (
                    <div
                      key={td.id}
                      className="p-2.5 rounded-xl bg-[#FAF8F3] flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          persistStore((prev) => ({
                            ...prev,
                            todos: (prev.todos || []).map((x) =>
                              x.id === td.id ? { ...x, done: !x.done } : x
                            )
                          }))
                        }
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            td.done
                              ? 'bg-[#35503C] border-[#35503C] text-white'
                              : 'bg-white border-stone-300'
                          }`}
                        >
                          {td.done && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            td.done ? 'line-through text-stone-400' : 'text-[#263329]'
                          }`}
                        >
                          {td.title}
                        </span>
                        {td.dueDate && (
                          <span className="whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-[#55695A] border border-[#35503C]/10 shrink-0">
                            {td.dueDate}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          persistStore((prev) => ({
                            ...prev,
                            todos: (prev.todos || []).filter((x) => x.id !== td.id)
                          }))
                        }
                        className="p-1 text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 6: 육아 (BABY: Admin 전용 육아일기 + 성장·진료 기록)
           -------------------------------------------------------------------- */}
        {activeTab === 'baby' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-[#35503C]/15">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setBabySubTab('diary')}
                  className={`whitespace-nowrap flex-1 py-2 rounded-xl text-xs font-extrabold transition ${
                    babySubTab === 'diary'
                      ? 'bg-[#35503C] text-white'
                      : 'text-[#4A5D4E] hover:bg-[#EEF3EE]'
                  }`}
                >
                  📖 육아일기 (관리자 전용)
                </button>
              )}
              <button
                type="button"
                onClick={() => setBabySubTab('health')}
                className={`whitespace-nowrap flex-1 py-2 rounded-xl text-xs font-extrabold transition ${
                  babySubTab === 'health'
                    ? 'bg-[#35503C] text-white'
                    : 'text-[#4A5D4E] hover:bg-[#EEF3EE]'
                }`}
              >
                📏 시목·시율 성장·진료 기록
              </button>
            </div>

            {babySubTab === 'diary' && isAdmin ? (
              <div className="space-y-4">
                {/* 육아일기 작성 카드 (2단 버튼 배치로 모바일 줄바꿈 깨짐 방지) */}
                <form
                  onSubmit={handleSaveBabyDiary}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="whitespace-nowrap text-base font-extrabold text-[#263329]">
                      📖 육아일기 작성
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { id: '시목', label: '👦 시목' },
                        { id: '시율', label: '👶 시율' },
                        { id: 'both', label: '👦👶 시목·시율 함께' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewDiaryForm({ ...newDiaryForm, childTarget: opt.id })}
                          className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border ${
                            newDiaryForm.childTarget === opt.id
                              ? 'bg-[#35503C] text-white border-[#35503C]'
                              : 'bg-[#FAF8F3] text-[#4A5D4E] border-[#35503C]/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDiaryForm.date}
                      onChange={(e) => setNewDiaryForm({ ...newDiaryForm, date: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm"
                    />
                    <select
                      value={newDiaryForm.mood}
                      onChange={(e) => setNewDiaryForm({ ...newDiaryForm, mood: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs sm:text-sm"
                    >
                      <option value="🥰">🥰 행복</option>
                      <option value="😴">😴 꿀잠</option>
                      <option value="🍚">🍚 완밥</option>
                      <option value="🥹">🥹 감동</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    placeholder="오늘의 한 줄 제목"
                    value={newDiaryForm.title}
                    onChange={(e) => setNewDiaryForm({ ...newDiaryForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />

                  <textarea
                    rows={3}
                    placeholder="시목·시율의 오늘 성장 기록을 남겨보세요..."
                    value={newDiaryForm.content}
                    onChange={(e) => setNewDiaryForm({ ...newDiaryForm, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />

                  {/* 다중 사진 첨부 미리보기 */}
                  {newDiaryForm.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {newDiaryForm.photos.map((ph) => (
                        <div
                          key={ph.id}
                          className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#35503C]/20"
                        >
                          <img
                            src={ph.url}
                            alt="첨부 미리보기"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftPhoto(ph.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 1행: 보조 기능 3열 균등 배치 / 2행: 전체 폭 저장 버튼 */}
                  <div className="grid grid-cols-3 gap-2">
                    <label className="whitespace-nowrap cursor-pointer py-2 px-2 rounded-xl bg-[#FAF8F3] text-[#35503C] text-xs font-extrabold text-center border border-[#35503C]/20">
                      📷 사진 첨부
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDiaryPhotosSelected}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handlePullTodayBabySummary}
                      className="whitespace-nowrap py-2 px-2 rounded-xl bg-[#EEF3EE] text-[#35503C] text-xs font-extrabold border border-[#35503C]/20"
                    >
                      ✨ 기록 불러오기
                    </button>
                    <button
                      type="button"
                      disabled={isPolishingDiary}
                      onClick={handlePolishDiaryWithAi}
                      className="whitespace-nowrap py-2 px-2 rounded-xl bg-amber-50 text-amber-950 text-xs font-extrabold border border-amber-300"
                    >
                      {isPolishingDiary ? '다듬는 중...' : '✨ AI 다듬기'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isDiaryUploading}
                    className="whitespace-nowrap w-full py-2.5 px-3 rounded-xl bg-[#35503C] text-white text-xs sm:text-sm font-extrabold"
                  >
                    {isDiaryUploading ? '원본 사진 업로드 중...' : '💾 육아일기 저장하기'}
                  </button>
                </form>

                {/* 통합 타임라인 필터 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: `전체 (${(store.babyDiaryEntries || []).length})` },
                    { id: '시목', label: '👦 시목' },
                    { id: '시율', label: '👶 시율' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDiaryChildFilter(f.id)}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold ${
                        diaryChildFilter === f.id
                          ? 'bg-[#35503C] text-white'
                          : 'bg-white text-[#4A5D4E] border border-[#35503C]/15'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={diarySearch}
                    onChange={(e) => setDiarySearch(e.target.value)}
                    placeholder="일기 검색..."
                    className="flex-1 min-w-[130px] px-3 py-1 rounded-xl bg-white border border-[#35503C]/20 text-xs"
                  />
                </div>

                {/* 일기 카드 목록 */}
                <div className="space-y-3">
                  {(store.babyDiaryEntries || [])
                    .filter((entry) => {
                      const cIds = Array.isArray(entry.childIds) ? entry.childIds : ['시율'];
                      if (diaryChildFilter !== 'all' && !cIds.includes(diaryChildFilter)) {
                        return false;
                      }
                      const q = diarySearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        String(entry.title || '').toLowerCase().includes(q) ||
                        String(entry.content || '').toLowerCase().includes(q)
                      );
                    })
                    .map((entry) => {
                      const cIds = Array.isArray(entry.childIds) ? entry.childIds : ['시율'];
                      const ageBadges = cIds.map((cid) => {
                        const info = CHILDREN_INFO[cid] || CHILDREN_INFO.시율;
                        return `${info.emoji} ${info.fullName}(${info.birthDate}생 · ${formatBabyAgeLabel(info.birthDate, entry.date)})`;
                      });
                      return (
                        <article
                          key={entry.id}
                          className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {ageBadges.map((badge) => (
                                  <span
                                    key={badge}
                                    className="whitespace-nowrap text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]"
                                  >
                                    {badge}
                                  </span>
                                ))}
                                <span className="whitespace-nowrap text-xs text-[#55695A]">
                                  {entry.date}
                                </span>
                              </div>
                              <h4 className="text-base font-extrabold text-[#263329]">
                                {entry.mood} {entry.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleExportDiaryCardPng(entry)}
                                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#EEF3EE] text-[#35503C] text-[11px] font-extrabold flex items-center gap-1"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>한 장 내보내기</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBabyDiary(entry)}
                                className="p-1.5 text-stone-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {Array.isArray(entry.photos) && entry.photos.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {entry.photos.map((url, idx) => (
                                <img
                                  key={`${entry.id}-p-${idx}`}
                                  src={url}
                                  alt="육아일기 사진"
                                  onClick={() => setDiaryLightboxUrl(url)}
                                  className="w-full h-auto rounded-xl object-contain bg-[#FAF8F3] border border-[#35503C]/15 cursor-zoom-in"
                                />
                              ))}
                            </div>
                          )}

                          <p className="text-sm text-[#3A4A3E] leading-relaxed whitespace-pre-line">
                            {entry.content}
                          </p>
                        </article>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* 성장·진료 기록 (Admin & User 공용) */
              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !newHealthForm.note.trim() &&
                      !newHealthForm.heightCm &&
                      !newHealthForm.weightKg
                    ) {
                      return;
                    }
                    persistStore((prev) => ({
                      ...prev,
                      babyHealthLogs: [
                        { id: `bh-${Date.now()}`, ...newHealthForm },
                        ...(prev.babyHealthLogs || [])
                      ]
                    }));
                    setNewHealthForm({
                      ...newHealthForm,
                      heightCm: '',
                      weightKg: '',
                      note: ''
                    });
                    showToast('성장·진료 기록이 저장되었습니다.');
                  }}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-2.5"
                >
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={newHealthForm.childId}
                      onChange={(e) =>
                        setNewHealthForm({ ...newHealthForm, childId: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-bold"
                    >
                      <option value="시목">👦 김시목 (2025-08-03생)</option>
                      <option value="시율">👶 김시율 (2026-11-06생)</option>
                    </select>
                    <input
                      type="date"
                      value={newHealthForm.date}
                      onChange={(e) => setNewHealthForm({ ...newHealthForm, date: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="키(cm)"
                      value={newHealthForm.heightCm}
                      onChange={(e) =>
                        setNewHealthForm({ ...newHealthForm, heightCm: e.target.value })
                      }
                      className="w-24 px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="몸무게(kg)"
                      value={newHealthForm.weightKg}
                      onChange={(e) =>
                        setNewHealthForm({ ...newHealthForm, weightKg: e.target.value })
                      }
                      className="w-24 px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="진료·접종·성장 메모"
                      value={newHealthForm.note}
                      onChange={(e) => setNewHealthForm({ ...newHealthForm, note: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                    />
                    <button
                      type="submit"
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                    >
                      + 기록
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {(store.babyHealthLogs || []).map((log) => {
                    const info = CHILDREN_INFO[log.childId] || CHILDREN_INFO.시율;
                    return (
                      <div
                        key={log.id}
                        className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="whitespace-nowrap text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                            {info.emoji} {info.fullName} ·{' '}
                            {formatBabyAgeLabel(info.birthDate, log.date)}
                          </span>
                          <span className="text-xs text-[#55695A]">{log.date}</span>
                        </div>
                        <div className="text-sm font-bold text-[#263329]">
                          {log.heightCm && `키 ${log.heightCm}cm `}
                          {log.weightKg && `· 몸무게 ${log.weightKg}kg`}
                        </div>
                        {log.note && <p className="text-xs text-[#55695A]">{log.note}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------------
            TAB 7: 더보기 (MORE: 식비·가계부 분석 / 가족 공지 / 레시피북 / JSON 백업·복원)
           -------------------------------------------------------------------- */}
        {activeTab === 'more' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-[#35503C]/15 overflow-x-auto">
              <button
                type="button"
                onClick={() => setMoreSubTab('expenses')}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-extrabold ${
                  moreSubTab === 'expenses' ? 'bg-[#35503C] text-white' : 'text-[#4A5D4E]'
                }`}
              >
                💳 식비·가계부 분석
              </button>
              <button
                type="button"
                onClick={() => setMoreSubTab('notice')}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-extrabold ${
                  moreSubTab === 'notice' ? 'bg-[#35503C] text-white' : 'text-[#4A5D4E]'
                }`}
              >
                📢 가족 공지사항
              </button>
              <button
                type="button"
                onClick={() => setMoreSubTab('recipes')}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-extrabold ${
                  moreSubTab === 'recipes' ? 'bg-[#35503C] text-white' : 'text-[#4A5D4E]'
                }`}
              >
                📖 우리집 레시피북
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setMoreSubTab('backup')}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-extrabold ${
                    moreSubTab === 'backup' ? 'bg-[#35503C] text-white' : 'text-[#4A5D4E]'
                  }`}
                >
                  🔐 JSON 백업·복원
                </button>
              )}
            </div>

            {/* [2] 시각화 개선: 이번 달 식비·생활 지출 대시보드 카드 */}
            {moreSubTab === 'expenses' && (
              <div className="space-y-4">
                <section className="rounded-2xl bg-white border border-[#35503C]/20 p-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#35503C]" />
                      <h3 className="text-sm sm:text-base font-extrabold text-[#263329]">
                        {currentMonthStr} 누적 식비·생활 지출
                      </h3>
                    </div>
                    <span className="whitespace-nowrap text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                      총 {expenseStats.count}건
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[#FAF8F3] border border-[#35503C]/15 p-3">
                      <div className="text-[11px] font-semibold text-[#55695A]">이번 달 누적</div>
                      <div className="text-lg sm:text-xl font-extrabold text-[#263329] mt-0.5">
                        {expenseStats.totalAmount.toLocaleString()}원
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F3] border border-[#35503C]/15 p-3">
                      <div className="text-[11px] font-semibold text-[#55695A]">일평균 지출</div>
                      <div className="text-lg sm:text-xl font-extrabold text-[#35503C] mt-0.5">
                        {expenseStats.dailyAverage.toLocaleString()}원
                      </div>
                    </div>
                  </div>

                  {/* 카테고리별 가로 비율 막대 */}
                  <div className="space-y-2 pt-1">
                    {expenseStats.breakdown.map((row) => (
                      <div key={row.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#263329]">{row.category}</span>
                          <span className="text-[#55695A]">
                            {row.amount.toLocaleString()}원 ({row.percent}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#EEF3EE] overflow-hidden">
                          <div
                            className="h-full bg-[#35503C] transition-all duration-300"
                            style={{ width: `${row.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 지출 내역 등록 폼 */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const amt = parseSafeAmount(newExpenseForm.amount);
                    if (!newExpenseForm.title.trim() || amt <= 0) {
                      showToast('내역명과 0원보다 큰 금액을 입력해 주세요.');
                      return;
                    }
                    persistStore((prev) => ({
                      ...prev,
                      expenses: [
                        {
                          id: `ex-${Date.now()}`,
                          date: newExpenseForm.date || getTodayStr(),
                          category: newExpenseForm.category,
                          title: newExpenseForm.title.trim(),
                          amount: amt,
                          payer: currentMember.name
                        },
                        ...(prev.expenses || [])
                      ]
                    }));
                    setNewExpenseForm({ ...newExpenseForm, title: '', amount: '' });
                    showToast('지출 내역이 등록되었습니다.');
                  }}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-2"
                >
                  <input
                    type="date"
                    value={newExpenseForm.date}
                    onChange={(e) => setNewExpenseForm({ ...newExpenseForm, date: e.target.value })}
                    className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs"
                  />
                  <select
                    value={newExpenseForm.category}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, category: e.target.value })
                    }
                    className="px-2.5 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-bold"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="지출 내역"
                    value={newExpenseForm.title}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, title: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="금액(원)"
                    value={newExpenseForm.amount}
                    onChange={(e) =>
                      setNewExpenseForm({ ...newExpenseForm, amount: e.target.value })
                    }
                    className="px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                  >
                    + 기록
                  </button>
                </form>

                {/* 최근 지출 리스트 */}
                <div className="space-y-2">
                  {(store.expenses || []).map((ex) => (
                    <div
                      key={ex.id}
                      className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="whitespace-nowrap text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                            {ex.category}
                          </span>
                          <span className="text-xs text-[#55695A]">
                            {ex.date} · {ex.payer}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-[#263329] truncate">{ex.title}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="whitespace-nowrap text-sm font-extrabold text-[#263329]">
                          {parseSafeAmount(ex.amount).toLocaleString()}원
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            persistStore((prev) => ({
                              ...prev,
                              expenses: (prev.expenses || []).filter((x) => x.id !== ex.id)
                            }))
                          }
                          className="p-1 text-stone-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {moreSubTab === 'notice' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newNoticeForm.title.trim()) return;
                    persistStore((prev) => ({
                      ...prev,
                      notices: [
                        {
                          id: `nt-${Date.now()}`,
                          date: getTodayStr(),
                          author: currentMember.name,
                          title: newNoticeForm.title.trim(),
                          content: newNoticeForm.content.trim(),
                          pinned: false
                        },
                        ...(prev.notices || [])
                      ]
                    }));
                    setNewNoticeForm({ title: '', content: '' });
                    showToast('가족 공지가 등록되었습니다.');
                  }}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-2"
                >
                  <input
                    type="text"
                    placeholder="공지 제목"
                    value={newNoticeForm.title}
                    onChange={(e) => setNewNoticeForm({ ...newNoticeForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <textarea
                    rows={2}
                    placeholder="가족에게 공유할 내용을 입력하세요..."
                    value={newNoticeForm.content}
                    onChange={(e) =>
                      setNewNoticeForm({ ...newNoticeForm, content: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                  >
                    + 공지 올리기
                  </button>
                </form>

                {(store.notices || []).map((nt) => (
                  <div
                    key={nt.id}
                    className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-[#263329] flex items-center gap-1.5">
                        <Megaphone className="w-4 h-4 text-[#35503C]" />
                        {nt.title}
                      </span>
                      <span className="text-xs text-[#55695A]">
                        {nt.author} · {nt.date}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4A5D4E]">{nt.content}</p>
                  </div>
                ))}
              </div>
            )}

            {moreSubTab === 'recipes' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newRecipeForm.title.trim()) return;
                    persistStore((prev) => ({
                      ...prev,
                      recipes: [
                        {
                          id: `rec-${Date.now()}`,
                          title: newRecipeForm.title.trim(),
                          category: newRecipeForm.category,
                          cookTime: newRecipeForm.cookTime,
                          ingredients: newRecipeForm.ingredients
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                          steps: newRecipeForm.steps.trim()
                        },
                        ...(prev.recipes || [])
                      ]
                    }));
                    setNewRecipeForm({
                      title: '',
                      category: '유아식·가족식',
                      cookTime: '20분',
                      ingredients: '',
                      steps: ''
                    });
                    showToast('새 레시피가 등록되었습니다.');
                  }}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-2"
                >
                  <input
                    type="text"
                    placeholder="레시피 제목"
                    value={newRecipeForm.title}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="필요 재료 (쉼표로 구분: 소고기, 애호박, 당근)"
                    value={newRecipeForm.ingredients}
                    onChange={(e) =>
                      setNewRecipeForm({ ...newRecipeForm, ingredients: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <textarea
                    rows={2}
                    placeholder="조리 순서 메모"
                    value={newRecipeForm.steps}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, steps: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-sm"
                  />
                  <button
                    type="submit"
                    className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold"
                  >
                    + 레시피 저장
                  </button>
                </form>

                {(store.recipes || []).map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm sm:text-base font-extrabold text-[#263329]">
                        {rec.title}
                      </h4>
                      <span className="whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                        {rec.cookTime}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(rec.ingredients || []).map((ing) => (
                        <span
                          key={ing}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-[#FAF8F3] border border-[#35503C]/15 text-[#4A5D4E]"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                    {rec.steps && (
                      <p className="text-xs text-[#55695A] whitespace-pre-line">{rec.steps}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {moreSubTab === 'backup' && isAdmin && (
              <div className="rounded-2xl bg-white border border-[#35503C]/15 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-[#263329]">
                    🔐 전체 데이터 JSON 백업 및 복원 (관리자 전용)
                  </h3>
                  <button
                    type="button"
                    onClick={handleExportBackupJson}
                    className="whitespace-nowrap px-3.5 py-2 rounded-xl bg-[#35503C] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>전체 백업 JSON 복사</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="백업받은 JSON 텍스트를 붙여넣고 복원하기를 누르세요..."
                  className="w-full p-3 rounded-xl bg-[#FAF8F3] border border-[#35503C]/20 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleImportBackupJson}
                  className="whitespace-nowrap px-4 py-2 rounded-xl bg-[#EEF3EE] text-[#35503C] border border-[#35503C]/25 text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>JSON 데이터 복원 실행</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================================
          [4] 신규 고도화 모달: 📊 주간 가족 리포트 (Weekly Family Retrospective)
         ====================================================================== */}
      {isWeeklyReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FAF8F3] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#35503C]/20 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-[#35503C] text-[#FAF8F3] flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-300" />
                  <span>📊 주간 가족 요약 리포트</span>
                </h3>
                <p className="text-xs text-[#EEF3EE]/85 mt-0.5">{weeklyReportData.periodLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsWeeklyReportOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {/* 1. 식단 기록 & 집밥 비율 */}
              <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#35503C]">
                    🍽️ 최근 7일 식단 기록 현황
                  </span>
                  <span className="whitespace-nowrap text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#EEF3EE] text-[#35503C]">
                    집밥 비율 {weeklyReportData.homeMealRatio}%
                  </span>
                </div>
                <div className="text-sm font-bold text-[#263329]">
                  총 {weeklyReportData.totalMeals}끼 기록 (집밥 {weeklyReportData.homeMeals}끼 ·
                  외식/배달 {weeklyReportData.eatingOutMeals}끼)
                </div>
                <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
                  <div
                    className="h-full bg-[#35503C]"
                    style={{ width: `${weeklyReportData.homeMealRatio}%` }}
                  />
                </div>
              </div>

              {/* 2. 최근 7일 식비 지출 & 루틴 달성률 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-1">
                  <div className="text-xs font-extrabold text-[#35503C]">💳 주간 식비·생활비</div>
                  <div className="text-base font-extrabold text-[#263329]">
                    {weeklyReportData.weeklySpend.toLocaleString()}원
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-1">
                  <div className="text-xs font-extrabold text-[#35503C]">⏰ 루틴 달성률</div>
                  <div className="text-base font-extrabold text-[#263329]">
                    {weeklyReportData.routinePercent}% ({weeklyReportData.routineDone}/
                    {weeklyReportData.routineTotal})
                  </div>
                </div>
              </div>

              {/* 3. 시목·시율 육아일기 & 성장 기록 */}
              <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-1">
                <div className="text-xs font-extrabold text-[#35503C]">
                  👶 시목·시율 육아 & 성장 요약
                </div>
                <div className="text-sm font-bold text-[#263329]">
                  주간 육아일기 {weeklyReportData.diaryCount}편 · 성장/진료{' '}
                  {weeklyReportData.healthCount}건
                </div>
                <p className="text-xs text-[#55695A] truncate">
                  최근 일기: {weeklyReportData.latestDiaryTitle}
                </p>
              </div>

              {/* 4. 냉장고 & 장보기 현황 */}
              <div className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5">
                <div className="text-xs font-extrabold text-[#35503C]">
                  ❄️ 냉장고 · 🛒 장보기 현황
                </div>
                <div className="text-xs sm:text-sm font-bold text-[#263329] mt-0.5">
                  보관 {weeklyReportData.fridgeTotal}종 (임박·반남음{' '}
                  {weeklyReportData.fridgeUrgentOrHalf}종) · 남은 장보기{' '}
                  {weeklyReportData.remainingShopping}건
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyWeeklyReport}
                className="w-full py-3 rounded-2xl bg-[#35503C] hover:bg-[#273C2D] text-[#FAF8F3] text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
              >
                <Copy className="w-4 h-4" />
                <span>📋 주간 리포트 카톡 복사</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서울 중구 상세 날씨 모달 */}
      {isWeatherModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#FAF8F3] w-full max-w-md rounded-3xl p-5 border border-[#35503C]/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#263329]">🌤️ 서울 중구 시간대별 날씨</h3>
              <button
                type="button"
                onClick={() => setIsWeatherModalOpen(false)}
                className="p-1 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {weatherState.hourly.map((h) => (
                <div
                  key={h.time}
                  className={`p-2.5 rounded-xl border text-center ${
                    h.pop >= 40
                      ? 'bg-sky-50 border-sky-300'
                      : 'bg-white border-[#35503C]/15'
                  }`}
                >
                  <div className="text-xs font-bold text-[#55695A]">{h.time}</div>
                  <div className="text-base font-extrabold text-[#263329] mt-0.5">{h.temp}°C</div>
                  <div className="text-[11px] font-bold text-sky-700">☔ {h.pop}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 임박·반남음 맞춤 레시피 모달 */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FAF8F3] w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#35503C]/20 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-[#35503C] text-white flex items-center justify-between">
              <h3 className="text-base font-extrabold">🍳 임박·반남음 맞춤 레시피</h3>
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="p-1 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(store.fridgeItems || []).map((item) => {
                  const selected = selectedRecipeIngredients.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedRecipeIngredients((prev) =>
                          prev.includes(item.name)
                            ? prev.filter((x) => x !== item.name)
                            : [...prev, item.name]
                        )
                      }
                      className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border ${
                        selected
                          ? 'bg-[#35503C] text-white border-[#35503C]'
                          : 'bg-white text-[#4A5D4E] border-[#35503C]/20'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>

              {matchedRecipes.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-white border border-[#35503C]/15 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#263329]">{rec.title}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        persistStore((prev) => ({
                          ...prev,
                          meals: [
                            {
                              id: `meal-${Date.now()}`,
                              date: getTodayStr(),
                              slot: '저녁',
                              menu: rec.title,
                              category: '집밥',
                              ingredients: rec.ingredients.join(', '),
                              note: '냉장고 소진 추천'
                            },
                            ...(prev.meals || [])
                          ]
                        }));
                        setIsRecipeModalOpen(false);
                        setActiveTab('meals');
                        showToast(`'${rec.title}' 메뉴를 오늘 식단에 등록했습니다.`);
                      }}
                      className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-[#35503C] text-white text-xs font-bold"
                    >
                      식단 등록
                    </button>
                  </div>
                  <p className="text-xs text-[#55695A] whitespace-pre-line">{rec.steps}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 그룹화된 (+) 빠른 추가 플로팅 버튼 & 자주 쓰는 기능 상단 고정 모달 */}
      <button
        type="button"
        aria-label="빠른 추가 열기"
        onClick={() => setIsQuickAddOpen(true)}
        className="fixed right-4 bottom-20 md:bottom-8 z-40 w-13 h-13 rounded-full bg-[#35503C] hover:bg-[#273C2D] text-[#FAF8F3] shadow-xl flex items-center justify-center border-2 border-[#FAF8F3]"
      >
        <Plus className="w-6 h-6" />
      </button>

      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#FAF8F3] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 border border-[#35503C]/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#263329]">⚡ 빠른 추가 메뉴</h3>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* [3] 편의성 개선: 최근 자주 쓰는 기능 상단 단축 행 */}
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-amber-900">⚡ 자주 쓰는 기능</div>
              <div className="flex gap-1.5 flex-wrap">
                {recentQuickActions
                  .filter((k) => {
                    const meta = QUICK_ACTION_META[k];
                    return meta && (!meta.adminOnly || isAdmin);
                  })
                  .map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => triggerQuickAction(k)}
                      className="whitespace-nowrap px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-xs font-extrabold text-amber-950"
                    >
                      {QUICK_ACTION_META[k].label}
                    </button>
                  ))}
              </div>
            </div>

            {/* 그룹 1: 식단·냉장고·장보기 */}
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-[#35503C]">🍽️ 식단·냉장고·장보기</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => triggerQuickAction('meal')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  🍚 오늘 식단 등록
                </button>
                <button
                  type="button"
                  onClick={() => triggerQuickAction('fridge')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  ❄️ 냉장고 재고 추가
                </button>
                <button
                  type="button"
                  onClick={() => triggerQuickAction('shopping')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  🛒 장보기 품목 담기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickAddOpen(false);
                    setIsWeeklyReportOpen(true);
                  }}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-[#EEF3EE] border border-[#35503C]/25 text-xs font-extrabold text-[#35503C] text-left"
                >
                  📊 주간 가족 리포트
                </button>
              </div>
            </div>

            {/* 그룹 2: 일정·루틴 */}
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-[#35503C]">🗓️ 일정·루틴</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => triggerQuickAction('schedule')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  📅 가족 일정 추가
                </button>
                <button
                  type="button"
                  onClick={() => triggerQuickAction('expense')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  💳 식비·지출 기록
                </button>
              </div>
            </div>

            {/* 그룹 3: 육아·레시피 */}
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-[#35503C]">👶 육아·성장</div>
              <div className="grid grid-cols-2 gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => triggerQuickAction('diary')}
                    className="whitespace-nowrap p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-extrabold text-amber-950 text-left"
                  >
                    📖 육아일기 작성
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => triggerQuickAction('health')}
                  className="whitespace-nowrap p-2.5 rounded-xl bg-white border border-[#35503C]/20 text-xs font-bold text-left hover:bg-[#EEF3EE]"
                >
                  📏 성장·진료 기록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 육아일기 한 장 PNG 내보내기 미리보기 모달 */}
      {exportedDiaryPngUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#FAF8F3] w-full max-w-md rounded-3xl p-4 space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#263329]">🖼️ 한 장 내보내기 미리보기</span>
              <button
                type="button"
                onClick={() => setExportedDiaryPngUrl('')}
                className="p-1 text-stone-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 rounded-2xl border border-[#35503C]/20 bg-white">
              <img
                src={exportedDiaryPngUrl}
                alt="육아일기 내보내기 카드"
                className="w-full h-auto"
              />
            </div>
            <a
              href={exportedDiaryPngUrl}
              download={`baby_diary_${getTodayStr()}.png`}
              className="w-full py-2.5 rounded-xl bg-[#35503C] text-white text-xs sm:text-sm font-extrabold text-center"
            >
              ⬇️ PNG 이미지 저장하기
            </a>
          </div>
        </div>
      )}

      {/* 원본 사진 라이트박스 모달 */}
      {diaryLightboxUrl && (
        <div
          onClick={() => setDiaryLightboxUrl('')}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <img
            src={diaryLightboxUrl}
            alt="원본 확대"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain"
          />
        </div>
      )}

      {/* 모바일 하단 네비게이션 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FAF8F3]/95 backdrop-blur-md border-t border-[#35503C]/15 px-1 py-1">
        <div className="grid grid-cols-7 gap-0.5">
          {[
            { id: 'home', label: '홈', icon: Home },
            { id: 'meals', label: '식단', icon: Utensils },
            { id: 'schedule', label: '일정', icon: Calendar },
            { id: 'baby', label: '육아', icon: Baby },
            { id: 'fridge', label: '냉장고', icon: Refrigerator },
            { id: 'shopping', label: '장보기', icon: ShoppingCart },
            { id: 'more', label: '더보기', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
                  active ? 'bg-[#35503C] text-[#FAF8F3]' : 'text-[#4A5D4E]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="whitespace-nowrap text-[10px] font-bold mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ============================================================================
// [6] 이미지 압축 폴백 & Canvas CORS 안전 합성 유틸리티
// ============================================================================
function compressImageFileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(String(ev.target?.result || ''));
      img.src = String(ev.target?.result || '');
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function loadCorsSafeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrapCanvasLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  paragraphs.forEach((p) => {
    if (!p) {
      lines.push('');
      return;
    }
    let current = '';
    for (const ch of p) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  });
  return lines;
}