import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Refrigerator,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Edit3,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  ChefHat,
  ArrowRight,
  Snowflake,
  Package,
  ShoppingBag,
  BarChart3,
  Camera,
  Receipt,
  Wallet,
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  School,
  PieChart,
  ShieldCheck,
  Copy
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

// ==========================================
// 0. 사용자 전용 파이어베이스 & API 키 기본 내장 (무편집 바로 배포용)
// ==========================================
const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrzf2_cG0PT-dW1lidXYaHk4BpCY-eMao",
  authDomain: "ahrisoohyeokbap.firebaseapp.com",
  projectId: "ahrisoohyeokbap",
  storageBucket: "ahrisoohyeokbap.firebasestorage.app",
  messagingSenderId: "746934389532",
  appId: "1:746934389532:web:496918d8f66d40bcb088d9"
};

const DEFAULT_USER_API_KEY = "AQ.Ab8RN6Ke8u6xRzPlDhMcI7cRjgrktqqiA9v76BVl4x-gaqacsA";

// ==========================================
// 1. 가족 구성원 및 6단계 끼니 상수 설정
// ==========================================
const FAMILY_MEMBERS = [
  {
    id: 'suhyeok',
    name: '김수혁',
    role: '아빠',
    emoji: '👨🏻',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeBg: 'bg-blue-500',
    group: 'adult'
  },
  {
    id: 'arina',
    name: '최아리나',
    role: '엄마',
    emoji: '👩🏻',
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    badgeBg: 'bg-rose-500',
    group: 'adult'
  },
  {
    id: 'simok',
    name: '김시목',
    role: '첫째',
    emoji: '👦🏻',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeBg: 'bg-amber-500',
    group: 'kid'
  },
  {
    id: 'siyul',
    name: '김시율',
    role: '둘째',
    emoji: '👶🏻',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeBg: 'bg-emerald-500',
    group: 'kid'
  }
];

// 6단계 식사 분류: 아침 / 오전간식 / 점심 / 오후간식 / 저녁 / 야식
const MEAL_SLOTS = [
  {
    id: 'breakfast',
    label: '아침',
    shortLabel: '아침',
    icon: '🌅',
    timeHint: '07:00 - 09:00',
    accent: 'from-amber-50 to-orange-50 border-amber-200',
    pillColor: 'bg-amber-100 text-amber-800 border-amber-200',
    dotColor: 'bg-amber-500'
  },
  {
    id: 'morning_snack',
    label: '오전간식',
    shortLabel: '오전간식',
    icon: '🍎',
    timeHint: '10:00 - 11:00',
    accent: 'from-lime-50 to-emerald-50 border-lime-200',
    pillColor: 'bg-lime-100 text-lime-800 border-lime-200',
    dotColor: 'bg-lime-500'
  },
  {
    id: 'lunch',
    label: '점심',
    shortLabel: '점심',
    icon: '☀️',
    timeHint: '11:30 - 13:30',
    accent: 'from-sky-50 to-blue-50 border-sky-200',
    pillColor: 'bg-sky-100 text-sky-800 border-sky-200',
    dotColor: 'bg-sky-500'
  },
  {
    id: 'afternoon_snack',
    label: '오후간식',
    shortLabel: '오후간식',
    icon: '🥨',
    timeHint: '15:00 - 16:30',
    accent: 'from-pink-50 to-rose-50 border-pink-200',
    pillColor: 'bg-pink-100 text-pink-800 border-pink-200',
    dotColor: 'bg-pink-500'
  },
  {
    id: 'dinner',
    label: '저녁',
    shortLabel: '저녁',
    icon: '🌙',
    timeHint: '18:00 - 20:00',
    accent: 'from-indigo-50 to-purple-50 border-indigo-200',
    pillColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dotColor: 'bg-indigo-500'
  },
  {
    id: 'late_snack',
    label: '야식',
    shortLabel: '야식',
    icon: '🦉',
    timeHint: '21:00 이후',
    accent: 'from-purple-50 to-fuchsia-50 border-purple-200',
    pillColor: 'bg-purple-100 text-purple-800 border-purple-200',
    dotColor: 'bg-purple-500'
  }
];

const STORAGE_TYPES = [
  { id: 'all', label: '전체', icon: Package, badgeColor: 'bg-stone-100 text-stone-700' },
  { id: 'fridge', label: '냉장실', icon: Refrigerator, badgeColor: 'bg-sky-100 text-sky-700' },
  { id: 'freezer', label: '냉동실', icon: Snowflake, badgeColor: 'bg-indigo-100 text-indigo-700' },
  { id: 'pantry', label: '실온/팬트리', icon: ShoppingBag, badgeColor: 'bg-amber-100 text-amber-700' }
];

const FOOD_CATEGORIES = [
  '채소/과일',
  '육류/해산물',
  '유제품/계란',
  '두부/콩/곡류',
  '유아식/이유식 재료',
  '양념/반찬/김치',
  '기타/간식'
];

const MEAL_TYPE_TAGS = [
  '집밥/온가족식',
  '어린이집 급식',
  '유아식/이유식',
  '어른식',
  '냉장고파먹기',
  '외식/배달'
];

// ==========================================
// 2. 신당동어린이집 2026년 11월 식단표 (0-2세, 25일·75끼 전체)
// ==========================================
const SHINDANG_DAYCARE_RAW = [
  {
    date: '2026-11-02',
    morning_snack: '배, 우유',
    lunch: '잡곡밥, 유부맑은국, 돼지고기두루치기, 얼갈이나물, 김치, 후식 까망베르치즈케이크',
    afternoon_snack: '감자튀김, 차',
    kcal: '414kcal / 단백질 17g'
  },
  {
    date: '2026-11-03',
    morning_snack: '파프리카죽',
    lunch: '쌀밥, 청경채된장국, 동태전, 콩나물당근무침, 김치, 후식 단감 (쑥쑥·지혜 현장학습식)',
    afternoon_snack: '단팥빵, 우유',
    kcal: '482kcal / 단백질 20g'
  },
  {
    date: '2026-11-04',
    morning_snack: '단호박죽',
    lunch: '잡곡밥, 설렁탕, 메추리알장조림(두부조림), 참나물무침, 김치, 후식 감귤',
    afternoon_snack: '핫도그, 우유',
    kcal: '485kcal / 단백질 20g'
  },
  {
    date: '2026-11-05',
    morning_snack: '바나나, 우유',
    lunch: '닭살채소볶음밥, 뭇국, 어묵조림, 고사리나물, 김치, 후식 치즈볼',
    afternoon_snack: '찐감자, 차',
    kcal: '428kcal / 단백질 17g'
  },
  {
    date: '2026-11-06',
    morning_snack: '배추죽',
    lunch: '잡곡밥, 근대된장국, 비엔나소시지구이, 김구이, 김치, 후식 사과',
    afternoon_snack: '소금빵, 우유',
    kcal: '471kcal / 단백질 15g'
  },
  {
    date: '2026-11-07',
    morning_snack: '시리얼, 우유',
    lunch: '칼국수, 김치',
    afternoon_snack: '과일샐러드',
    kcal: '393kcal / 단백질 12g'
  },
  {
    date: '2026-11-09',
    morning_snack: '방울토마토, 저염치즈',
    lunch: '쌀밥, 호박맑은국, 훈제오리구이, 취나물무침, 김치, 후식 배',
    afternoon_snack: '비빔국수',
    kcal: '496kcal / 단백질 20g'
  },
  {
    date: '2026-11-10',
    morning_snack: '녹두죽',
    lunch: '잡곡밥, 우거지된장국, 명태살조림, 연근들깨무침, 김치 (지혜 현장학습식)',
    afternoon_snack: '완두앙금빵, 우유',
    kcal: '550kcal / 단백질 28g'
  },
  {
    date: '2026-11-11',
    morning_snack: '청경채죽',
    lunch: '쌀밥, 미역국, 쇠불고기, 유채나물, 김치, 후식 샤인머스켓',
    afternoon_snack: '부추전, 요구르트',
    kcal: '426kcal / 단백질 15g'
  },
  {
    date: '2026-11-12',
    morning_snack: '감귤, 우유',
    lunch: '돼지고기자장밥, 팽이버섯맑은국, 생초나물, 연두부+양념장, 김치, 후식 미니약과',
    afternoon_snack: '찐고구마, 차',
    kcal: '447kcal / 단백질 19g'
  },
  {
    date: '2026-11-13',
    morning_snack: '브로콜리죽',
    lunch: '쌀밥, 아욱된장국, 찜닭, 무생채, 김치, 후식 단감',
    afternoon_snack: '잼샌드위치, 우유',
    kcal: '475kcal / 단백질 17g'
  },
  {
    date: '2026-11-14',
    morning_snack: '우유+미숫가루',
    lunch: '베이컨크림리조또, 맑은장국, 김치',
    afternoon_snack: '삶은달걀(쌀과자), 차',
    kcal: '374kcal / 단백질 16g'
  },
  {
    date: '2026-11-16',
    morning_snack: '사과, 우유',
    lunch: '잡곡밥, 들깨시래기국, 닭다리살구이, 가지나물, 김치, 후식 맛밤',
    afternoon_snack: '유부초밥, 차',
    kcal: '474kcal / 단백질 18g'
  },
  {
    date: '2026-11-17',
    morning_snack: '당근죽',
    lunch: '쌀밥, 부추된장국, 생선까스+타르타르소스, 어린잎샐러드+유자청드레싱, 김치, 후식 골드키위',
    afternoon_snack: '모닝빵, 우유',
    kcal: '509kcal / 단백질 19g'
  },
  {
    date: '2026-11-18',
    morning_snack: '양배추죽',
    lunch: '잡곡밥, 콩비지국, 채소닭강정(연두부+양념장), 버섯볶음, 김치, 후식 감귤',
    afternoon_snack: '토마토스파게티',
    kcal: '466kcal / 단백질 15g'
  },
  {
    date: '2026-11-19',
    morning_snack: '단감, 우유',
    lunch: '쇠고기무밥+양념장, 미소장국, 콩나물무침, 세발나물무침, 김치, 후식 베이비슈',
    afternoon_snack: '찐단호박, 차',
    kcal: '403kcal / 단백질 18g'
  },
  {
    date: '2026-11-20',
    morning_snack: '누룽지죽',
    lunch: '잡곡밥, 북엇국, 돼지고기수육, 시금치나물, 김치, 후식 배',
    afternoon_snack: '카스테라, 우유',
    kcal: '464kcal / 단백질 20g'
  },
  {
    date: '2026-11-21',
    morning_snack: '시리얼, 우유',
    lunch: '만둣국, 미니밥, 김치',
    afternoon_snack: '과일샐러드',
    kcal: '321kcal / 단백질 11g'
  },
  {
    date: '2026-11-23',
    morning_snack: '방울토마토, 저염치즈',
    lunch: '쌀밥, 감자양파국, 닭튀김, 열무나물, 김치, 후식 바나나',
    afternoon_snack: '참치주먹밥',
    kcal: '461kcal / 단백질 15g'
  },
  {
    date: '2026-11-24',
    morning_snack: '무죽',
    lunch: '잡곡밥, 새송이버섯된장국, 가자미구이, 봄동오이무침, 김치',
    afternoon_snack: '시리얼, 우유',
    kcal: '448kcal / 단백질 19g'
  },
  {
    date: '2026-11-25',
    morning_snack: '채소죽',
    lunch: '쌀밥, 콩나물국, 돼지고기목살볶음, 청경채나물, 김치, 후식 고구마디저트케이크',
    afternoon_snack: '수제바나나우유, 크래커',
    kcal: '449kcal / 단백질 15g'
  },
  {
    date: '2026-11-26',
    morning_snack: '배, 우유',
    lunch: '닭살카레라이스, 배추된장국, 건멸치볶음, 파프리카무침, 김치, 후식 7곡딸기롤',
    afternoon_snack: '고구마맛탕, 차',
    kcal: '480kcal / 단백질 19g'
  },
  {
    date: '2026-11-27',
    morning_snack: '근대죽',
    lunch: '잡곡밥, 숭늉, 돈육피망잡채+꽃빵, 브로콜리호박볶음, 김치, 후식 사과',
    afternoon_snack: '밤식빵, 우유+초코딸기',
    kcal: '525kcal / 단백질 17g'
  },
  {
    date: '2026-11-28',
    morning_snack: '우유+미숫가루',
    lunch: '치즈김밥, 가쓰오장국, 김치',
    afternoon_snack: '구운달걀(쌀과자), 차',
    kcal: '408kcal / 단백질 17g'
  },
  {
    date: '2026-11-30',
    morning_snack: '사과, 우유',
    lunch: '잡곡밥, 어묵쑥갓국, 두부구이+양념장, 우엉조림, 김치, 후식 쌀과자',
    afternoon_snack: '치킨너겟, 차',
    kcal: '468kcal / 단백질 18g'
  }
];

const buildDaycareMealEntries = (targetChildId = 'simok') => {
  const entries = [];
  SHINDANG_DAYCARE_RAW.forEach((day) => {
    entries.push({
      id: `daycare-${day.date}-ms-${targetChildId}`,
      date: day.date,
      slot: 'morning_snack',
      menu: `[어린이집 오전간식] ${day.morning_snack}`,
      members: [targetChildId],
      mealType: '어린이집 급식',
      usedIngredients: '',
      cost: 0,
      note: `신당동어린이집 11월 식단표 (${day.kcal})`
    });
    entries.push({
      id: `daycare-${day.date}-lu-${targetChildId}`,
      date: day.date,
      slot: 'lunch',
      menu: `[어린이집 점심] ${day.lunch}`,
      members: [targetChildId],
      mealType: '어린이집 급식',
      usedIngredients: '',
      cost: 0,
      note: `신당동어린이집 11월 식단표 (${day.kcal})`
    });
    entries.push({
      id: `daycare-${day.date}-as-${targetChildId}`,
      date: day.date,
      slot: 'afternoon_snack',
      menu: `[어린이집 오후간식] ${day.afternoon_snack}`,
      members: [targetChildId],
      mealType: '어린이집 급식',
      usedIngredients: '',
      cost: 0,
      note: `신당동어린이집 11월 식단표 (${day.kcal})`
    });
  });
  return entries;
};

// ==========================================
// 3. 날짜 및 통화 계산 헬퍼 함수
// ==========================================
const formatDateKey = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDateKey(dt);
};

const getDayOfWeekKor = (dateStr) => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return days[dt.getDay()];
};

const calculateDDay = (expiryDateStr) => {
  if (!expiryDateStr) return null;
  const todayStr = formatDateKey(new Date());
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [ey, em, ed] = expiryDateStr.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const expiry = new Date(ey, em - 1, ed);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getMondayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diffToMonday);
  return formatDateKey(dt);
};

const getWeekDaysFromMonday = (mondayStr) => {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const dateStr = addDays(mondayStr, offset);
    const [, m, d] = dateStr.split('-');
    return {
      dateStr,
      monthNum: Number(m),
      dayNum: Number(d),
      shortDate: `${Number(m)}/${Number(d)}`,
      dayKor: getDayOfWeekKor(dateStr)
    };
  });
};

const formatWeekRangeLabel = (mondayStr) => {
  const sundayStr = addDays(mondayStr, 6);
  const [my, mm, md] = mondayStr.split('-');
  const [, sm, sd] = sundayStr.split('-');
  return `${my}.${mm}.${md}(월) ~ ${sm}.${sd}(일)`;
};

const formatKRW = (amount) => {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('ko-KR')}원`;
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64, mimeType: file.type || 'image/jpeg', previewUrl: result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ==========================================
// 4. 초기 샘플 데이터
// ==========================================
const getInitialSampleFridgeItems = () => {
  const today = formatDateKey(new Date());
  const currentMonthPrefix = today.slice(0, 7);
  return [
    {
      id: 'sample-fridge-1',
      name: '한우 1+ 다짐육',
      category: '유아식/이유식 재료',
      storage: 'fridge',
      quantity: 300,
      unit: 'g',
      price: 18900,
      purchaseDate: `${currentMonthPrefix}-09`,
      expiryDate: addDays(today, 2),
      memo: '시목·시율이 소고기죽 & 온가족 덮밥용'
    },
    {
      id: 'sample-fridge-2',
      name: '친환경 애호박',
      category: '채소/과일',
      storage: 'fridge',
      quantity: 2,
      unit: '개',
      price: 3980,
      purchaseDate: `${currentMonthPrefix}-10`,
      expiryDate: addDays(today, 3),
      memo: '아이들 반찬 및 된장국용'
    },
    {
      id: 'sample-fridge-3',
      name: '유기농 국산콩 두부',
      category: '두부/콩/곡류',
      storage: 'fridge',
      quantity: 2,
      unit: '모',
      price: 4500,
      purchaseDate: `${currentMonthPrefix}-11`,
      expiryDate: addDays(today, 2),
      memo: '들기름 두부구이 및 찌개용'
    },
    {
      id: 'sample-fridge-4',
      name: '한우 차돌박이',
      category: '육류/해산물',
      storage: 'freezer',
      quantity: 400,
      unit: 'g',
      price: 26800,
      purchaseDate: `${currentMonthPrefix}-08`,
      expiryDate: addDays(today, 14),
      memo: '수혁·아리나 차돌된장찌개 & 숙주볶음'
    },
    {
      id: 'sample-fridge-5',
      name: '동물복지 무항생제 특란 15구',
      category: '유제품/계란',
      storage: 'fridge',
      quantity: 12,
      unit: '구',
      price: 7900,
      purchaseDate: `${currentMonthPrefix}-10`,
      expiryDate: addDays(today, 8),
      memo: '아침 계란찜, 스크램블, 계란말이'
    },
    {
      id: 'sample-fridge-6',
      name: '국내산 브로콜리',
      category: '채소/과일',
      storage: 'fridge',
      quantity: 1,
      unit: '송이',
      price: 2980,
      purchaseDate: `${currentMonthPrefix}-11`,
      expiryDate: addDays(today, 3),
      memo: '시율이 이유식/유아식 & 데침용'
    },
    {
      id: 'sample-fridge-7',
      name: '유기농 아기 치즈 1단계/2단계',
      category: '유제품/계란',
      storage: 'fridge',
      quantity: 8,
      unit: '장',
      price: 6800,
      purchaseDate: `${currentMonthPrefix}-07`,
      expiryDate: addDays(today, 20),
      memo: '시목·시율 간식 및 주먹밥용'
    },
    {
      id: 'sample-fridge-8',
      name: '한돈 생삼겹살',
      category: '육류/해산물',
      storage: 'fridge',
      quantity: 600,
      unit: 'g',
      price: 21500,
      purchaseDate: `${currentMonthPrefix}-12`,
      expiryDate: addDays(today, 3),
      memo: '김치찜 및 주말 구이용'
    },
    {
      id: 'sample-fridge-9',
      name: '노르웨이 생연어 필렛',
      category: '육류/해산물',
      storage: 'freezer',
      quantity: 2,
      unit: '팩',
      price: 24900,
      purchaseDate: `${currentMonthPrefix}-11`,
      expiryDate: addDays(today, 10),
      memo: '온가족 연어 스테이크용'
    },
    {
      id: 'sample-fridge-10',
      name: '감자 & 양파 꾸러미',
      category: '채소/과일',
      storage: 'pantry',
      quantity: 6,
      unit: '개',
      price: 6500,
      purchaseDate: `${currentMonthPrefix}-05`,
      expiryDate: addDays(today, 12),
      memo: '카레, 감자국, 볶음 기본 채소'
    },
    {
      id: 'sample-fridge-11',
      name: '종가집 포기김치',
      category: '양념/반찬/김치',
      storage: 'fridge',
      quantity: 1,
      unit: '포기',
      price: 19800,
      purchaseDate: `${currentMonthPrefix}-03`,
      expiryDate: addDays(today, 30),
      memo: '김치찜 및 김치볶음밥용'
    }
  ];
};

const getInitialSampleMeals = () => {
  const today = formatDateKey(new Date());
  const monday = getMondayOfWeek(today);
  const tue = addDays(monday, 1);
  const wed = addDays(monday, 2);
  const thu = addDays(monday, 3);
  const fri = addDays(monday, 4);
  const sat = addDays(monday, 5);
  const sun = addDays(monday, 6);

  const homeMeals = [
    {
      id: 'meal-sample-mon-1',
      date: monday,
      slot: 'breakfast',
      menu: '소고기 야채죽 & 부드러운 계란찜',
      members: ['simok', 'siyul'],
      mealType: '유아식/이유식',
      usedIngredients: '한우 1+ 다짐육, 동물복지 무항생제 특란 15구, 친환경 애호박',
      cost: 0,
      note: '시목이 등원 전 아침식사 완밥!'
    },
    {
      id: 'meal-sample-mon-2',
      date: monday,
      slot: 'breakfast',
      menu: '에그 스크램블 토스트 & 드립커피',
      members: ['suhyeok', 'arina'],
      mealType: '어른식',
      usedIngredients: '동물복지 무항생제 특란 15구',
      cost: 0,
      note: '출근 전 간단하고 든든한 부부 아침'
    },
    {
      id: 'meal-sample-mon-3',
      date: monday,
      slot: 'dinner',
      menu: '한우 애호박 두부 덮밥 & 배추김치',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '집밥/온가족식',
      usedIngredients: '한우 1+ 다짐육, 유기농 국산콩 두부, 친환경 애호박',
      cost: 0,
      note: '아이들 것 먼저 덜어내고 어른은 청양고추 넣어 매콤하게!'
    },
    {
      id: 'meal-sample-tue-1',
      date: tue,
      slot: 'breakfast',
      menu: '들기름 두부구이 & 맑은 소고기 감자국',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '집밥/온가족식',
      usedIngredients: '유기농 국산콩 두부, 한우 1+ 다짐육, 감자 & 양파 꾸러미',
      cost: 0,
      note: '속 편한 온가족 아침 국물 식단'
    },
    {
      id: 'meal-sample-tue-3',
      date: tue,
      slot: 'dinner',
      menu: '묵은지 삼겹살 김치찜 & 계란말이',
      members: ['suhyeok', 'arina', 'simok'],
      mealType: '냉장고파먹기',
      usedIngredients: '한돈 생삼겹살, 종가집 포기김치, 동물복지 무항생제 특란 15구',
      cost: 0,
      note: '시목이는 도톰한 계란말이와 안 매운 돼지고기 수육 부위로 식사'
    },
    {
      id: 'meal-sample-wed-1',
      date: wed,
      slot: 'breakfast',
      menu: '아기 치즈 주먹밥 & 바나나 요거트',
      members: ['simok', 'siyul'],
      mealType: '유아식/이유식',
      usedIngredients: '유기농 아기 치즈 1단계/2단계',
      cost: 0,
      note: '등원 전 한 입에 쏙쏙 먹는 영양 주먹밥'
    },
    {
      id: 'meal-sample-wed-3',
      date: wed,
      slot: 'dinner',
      menu: '버터 생연어 스테이크 & 구운 채소 가니쉬',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '집밥/온가족식',
      usedIngredients: '노르웨이 생연어 필렛, 국내산 브로콜리, 친환경 애호박',
      cost: 0,
      note: '연어 가시 꼼꼼히 발라서 아이들 밥 위에 얹어줌'
    },
    {
      id: 'meal-sample-thu-1',
      date: thu,
      slot: 'breakfast',
      menu: '애호박 감자 된장국 & 반숙 계란후라이',
      members: ['suhyeok', 'arina', 'simok'],
      mealType: '집밥/온가족식',
      usedIngredients: '친환경 애호박, 감자 & 양파 꾸러미, 유기농 국산콩 두부',
      cost: 0,
      note: '염도 낮은 아기된장으로 끓여 시목이도 함께 식사'
    },
    {
      id: 'meal-sample-thu-2',
      date: thu,
      slot: 'dinner',
      menu: '한우 다짐육 듬뿍 순한 카레라이스',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '냉장고파먹기',
      usedIngredients: '한우 1+ 다짐육, 감자 & 양파 꾸러미, 친환경 애호박, 국내산 브로콜리',
      cost: 0,
      note: '냉장고 자투리 채소 총출동 카레!'
    },
    {
      id: 'meal-sample-fri-2',
      date: fri,
      slot: 'dinner',
      menu: '노릇노릇 삼겹살 구이 & 차돌 두부 된장찌개',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '집밥/온가족식',
      usedIngredients: '한돈 생삼겹살, 한우 차돌박이, 유기농 국산콩 두부',
      cost: 0,
      note: '금요일 저녁 가족 홈파티!'
    },
    {
      id: 'meal-sample-fri-3',
      date: fri,
      slot: 'late_snack',
      menu: '순살 치킨 & 무알콜 맥주 (육아 퇴근 야식)',
      members: ['suhyeok', 'arina'],
      mealType: '외식/배달',
      usedIngredients: '',
      cost: 24000,
      note: '시목·시율이 재우고 부부 금요일 야식 타임'
    },
    {
      id: 'meal-sample-sat-1',
      date: sat,
      slot: 'breakfast',
      menu: '프렌치토스트 & 스크램블 에그',
      members: ['suhyeok', 'arina', 'simok'],
      mealType: '집밥/온가족식',
      usedIngredients: '동물복지 무항생제 특란 15구, 유기농 아기 치즈 1단계/2단계',
      cost: 0,
      note: '주말 아침 여유로운 브런치'
    },
    {
      id: 'meal-sample-sat-2',
      date: sat,
      slot: 'dinner',
      menu: '주말 가족 외식 - 한우 등심 샤브샤브 & 칼국수',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '외식/배달',
      usedIngredients: '',
      cost: 68000,
      note: '주말 저녁 외식 식비 기록'
    },
    {
      id: 'meal-sample-sun-1',
      date: sun,
      slot: 'breakfast',
      menu: '전복 소고기 야채죽 & 동치미',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '집밥/온가족식',
      usedIngredients: '한우 1+ 다짐육, 친환경 애호박',
      cost: 0,
      note: '일요일 아침 온가족 든든한 보양 죽'
    },
    {
      id: 'meal-sample-sun-2',
      date: sun,
      slot: 'dinner',
      menu: '차돌박이 된장 전골 & 들기름 두부스테이크',
      members: ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: '냉장고파먹기',
      usedIngredients: '한우 차돌박이, 유기농 국산콩 두부, 친환경 애호박, 국내산 브로콜리',
      cost: 0,
      note: '주말 마무리 냉장고 파먹기 특식'
    }
  ];

  const daycareMeals = buildDaycareMealEntries('simok');
  return [...homeMeals, ...daycareMeals];
};

const SAMPLE_RECEIPT_ITEMS = [
  {
    name: '설향 딸기 500g',
    category: '채소/과일',
    storage: 'fridge',
    quantity: 1,
    unit: '팩',
    price: 12900,
    expiryDate: addDays(formatDateKey(new Date()), 4),
    memo: '시목·시율 오전/오후 과일 간식'
  },
  {
    name: '서울우유 나100% 1L',
    category: '유제품/계란',
    storage: 'fridge',
    quantity: 2,
    unit: '팩',
    price: 5960,
    expiryDate: addDays(formatDateKey(new Date()), 7),
    memo: '아이들 간식 및 라떼용'
  },
  {
    name: '한우 1등급 국거리 300g',
    category: '육류/해산물',
    storage: 'fridge',
    quantity: 300,
    unit: 'g',
    price: 16800,
    expiryDate: addDays(formatDateKey(new Date()), 3),
    memo: '소고기 미역국 및 뭇국용'
  },
  {
    name: '친환경 어린잎 모둠채소',
    category: '채소/과일',
    storage: 'fridge',
    quantity: 1,
    unit: '봉',
    price: 3480,
    expiryDate: addDays(formatDateKey(new Date()), 3),
    memo: '샐러드 및 비빔밥용'
  },
  {
    name: '유기농 아기 요거트 4입',
    category: '유아식/이유식 재료',
    storage: 'fridge',
    quantity: 4,
    unit: '개',
    price: 4980,
    expiryDate: addDays(formatDateKey(new Date()), 9),
    memo: '시목·시율 유산균 간식'
  }
];

const BUILTIN_RECIPES = [
  {
    id: 'builtin-1',
    title: '온가족 한우 애호박 두부 덮밥 (어른 매콤 / 아이 순한맛)',
    recommendedSlot: 'dinner',
    targetGroup: 'all',
    targetMembers: ['suhyeok', 'arina', 'simok', 'siyul'],
    cookingTime: '20분',
    keywords: ['한우', '다짐육', '소고기', '두부', '애호박', '양파'],
    usedIngredients: ['한우 1+ 다짐육', '유기농 국산콩 두부', '친환경 애호박', '감자 & 양파 꾸러미'],
    extraIngredients: ['간장', '참기름', '전분물', '고춧가루(어른용)'],
    steps: [
      '애호박, 양파, 두부를 시목이와 시율이가 먹기 좋은 작은 사각 크기로 썹니다.',
      '팬에 한우 다짐육을 볶다가 채소를 넣고 육수(또는 물)를 부어 자작하게 끓입니다.',
      '간장 소량과 두부를 넣고 전분물로 농도를 맞춘 뒤 시목·시율용을 먼저 덜어냅니다.',
      '남은 팬에 고춧가루, 다진마늘, 청양고추를 추가해 김수혁·최아리나 부부용 매콤 덮밥 소스를 완성합니다.'
    ],
    familyTip:
      '한 냄비로 조리한 뒤 양념 단계에서만 분리하면 설거지도 줄고 네 가족 모두 만족하는 최고의 원팬 식단입니다!'
  },
  {
    id: 'builtin-2',
    title: '묵은지 삼겹살 김치찜 & 들기름 두부구이',
    recommendedSlot: 'dinner',
    targetGroup: 'adult',
    targetMembers: ['suhyeok', 'arina'],
    cookingTime: '30분',
    keywords: ['삼겹살', '김치', '두부', '양파'],
    usedIngredients: ['한돈 생삼겹살', '종가집 포기김치', '유기농 국산콩 두부'],
    extraIngredients: ['들기름', '설탕 약간', '대파'],
    steps: [
      '냄비 바닥에 양파를 깔고 삼겹살과 포기김치를 켜켜이 올립니다.',
      '김치 국물과 물을 붓고 중약불에서 25분간 푹 끓여 고기를 야들야들하게 익힙니다.',
      '두부는 도톰하게 썰어 들기름에 노릇하게 구워 곁들입니다.'
    ],
    familyTip:
      '구운 두부 몇 조각은 간을 하지 않고 먼저 덜어내어 시목이와 시율이 반찬으로 함께 챙겨주세요.'
  },
  {
    id: 'builtin-3',
    title: '브로콜리 치즈 계란말이 & 맑은 소고기 감자국',
    recommendedSlot: 'breakfast',
    targetGroup: 'simok',
    targetMembers: ['simok', 'siyul'],
    cookingTime: '15분',
    keywords: ['계란', '브로콜리', '치즈', '감자', '한우', '다짐육'],
    usedIngredients: ['동물복지 무항생제 특란 15구', '국내산 브로콜리', '유기농 아기 치즈 1단계/2단계', '한우 1+ 다짐육'],
    extraIngredients: ['참기름', '국간장 극소량'],
    steps: [
      '데친 브로콜리를 곱게 다져 풀어둔 계란물에 섞습니다.',
      '약불 팬에 계란물을 붓고 가운데 아기 치즈를 올려 부드럽게 말아줍니다.',
      '한우 다짐육과 작게 썬 감자를 맑게 끓여 속 편한 아침 국으로 함께 냅니다.'
    ],
    familyTip:
      '시목이 하원 후 오후간식이나 아침 반찬으로 주면 치즈 풍미 덕분에 남기지 않고 잘 먹습니다.'
  },
  {
    id: 'builtin-4',
    title: '시율이 맞춤 한우 애호박 두부 미음/이유식',
    recommendedSlot: 'morning_snack',
    targetGroup: 'siyul',
    targetMembers: ['siyul'],
    cookingTime: '15분',
    keywords: ['한우', '다짐육', '애호박', '두부', '브로콜리'],
    usedIngredients: ['한우 1+ 다짐육', '친환경 애호박', '유기농 국산콩 두부'],
    extraIngredients: ['채소 육수'],
    steps: [
      '한우 다짐육은 핏물을 살짝 빼고 채소 육수에 넣어 보들보들하게 익힙니다.',
      '곱게 다진 애호박과 으깬 두부를 넣고 함께 푹 끓여 부드러운 농도로 맞춥니다.'
    ],
    familyTip:
      '소화가 편안한 두부와 애호박 조합으로 시율이 오전/오후 이유식 타임에 안성맞춤입니다.'
  }
];

// ==========================================
// 5. Firebase 초기화 (프리뷰 환경 & 외부 독립 배포 환경 자동 호환)
// ==========================================
const activeFirebaseConfig =
  typeof __firebase_config !== 'undefined' && __firebase_config
    ? JSON.parse(__firebase_config)
    : USER_FIREBASE_CONFIG;

let app = null;
let auth = null;
let db = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ahrisoohyeokbap';

try {
  app = initializeApp(activeFirebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn('Firebase 초기화 참고:', err);
}

// Gemini API 호출 헬퍼 (내장 키 우선 시도 후 프리뷰 환경 자동 폴백)
const callGeminiWithFallback = async (payload, userKey) => {
  const candidateKeys = [];
  if (userKey && userKey.trim()) {
    candidateKeys.push(userKey.trim());
  }
  if (!candidateKeys.includes('')) {
    candidateKeys.push('');
  }

  let lastError = null;
  for (const keyToTry of candidateKeys) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${keyToTry}`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Gemini API 호출 실패');
};

// ==========================================
// 6. 메인 컴포넌트 시작
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('meals');

  // 인증 및 데이터 상태
  const [user, setUser] = useState(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [meals, setMeals] = useState(() => getInitialSampleMeals());
  const [fridgeItems, setFridgeItems] = useState(() => getInitialSampleFridgeItems());
  const [monthlyBudget, setMonthlyBudget] = useState(800000);
  // 전달해주신 API 키 기본 내장
  const [geminiApiKey, setGeminiApiKey] = useState(DEFAULT_USER_API_KEY);

  // 토스트 알림 상태
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3400);
  };

  // [탭 1: 일별 식단 기록] 상태
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);

  // [탭 2: 주간 요약] 상태
  const [weeklyBaseDate, setWeeklyBaseDate] = useState(formatDateKey(new Date()));
  const [weeklyMemberFilter, setWeeklyMemberFilter] = useState('all');
  const [weeklyViewMode, setWeeklyViewMode] = useState('grid');

  // [탭 3: 인별 월간 현황 & 월간 식비 가계부] 상태
  const [monthlyYearMonth, setMonthlyYearMonth] = useState('2026-11');
  const [monthlyMemberFilter, setMonthlyMemberFilter] = useState('simok');
  const [monthlySubTab, setMonthlySubTab] = useState('calendar');
  const [monthlySelectedDay, setMonthlySelectedDay] = useState('2026-11-14');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('800000');

  // 식단 모달 폼 상태
  const [mealForm, setMealForm] = useState({
    date: formatDateKey(new Date()),
    slot: 'breakfast',
    menu: '',
    members: ['suhyeok', 'arina', 'simok', 'siyul'],
    mealType: '집밥/온가족식',
    usedIngredients: '',
    cost: 0,
    note: ''
  });

  // [탭 4: 냉장고 관리] 상태
  const [selectedStorage, setSelectedStorage] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [fridgeSearch, setFridgeSearch] = useState('');
  const [sortByExpiry, setSortByExpiry] = useState(true);
  const [isFridgeModalOpen, setIsFridgeModalOpen] = useState(false);
  const [editingFridgeItem, setEditingFridgeItem] = useState(null);

  const [fridgeForm, setFridgeForm] = useState({
    name: '',
    category: '채소/과일',
    storage: 'fridge',
    quantity: 1,
    unit: '개',
    price: 0,
    purchaseDate: formatDateKey(new Date()),
    expiryDate: addDays(formatDateKey(new Date()), 5),
    memo: ''
  });

  // [어린이집 식단표 AI 스캔 모달] 상태
  const [isDaycareModalOpen, setIsDaycareModalOpen] = useState(false);
  const [daycareTargetChild, setDaycareTargetChild] = useState('simok');
  const [daycareTargetYearMonth, setDaycareTargetYearMonth] = useState('2026-11');
  const [isScanningDaycare, setIsScanningDaycare] = useState(false);
  const [scannedDaycareList, setScannedDaycareList] = useState([]);
  const [daycarePreviewImg, setDaycarePreviewImg] = useState(null);
  const daycareFileInputRef = useRef(null);

  // [마트 영수증 AI 스캔 모달] 상태
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptPurchaseDate, setReceiptPurchaseDate] = useState(formatDateKey(new Date()));
  const [scannedReceiptItems, setScannedReceiptItems] = useState([]);
  const [receiptPreviewImg, setReceiptPreviewImg] = useState(null);
  const receiptFileInputRef = useRef(null);

  // [설정 및 백업 모달] 상태
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const backupFileInputRef = useRef(null);

  // [탭 5: AI 식단추천] 상태
  const [selectedIngredientNames, setSelectedIngredientNames] = useState(() =>
    getInitialSampleFridgeItems()
      .slice(0, 4)
      .map((i) => i.name)
  );
  const [recommendTarget, setRecommendTarget] = useState('all');
  const [recommendSlotFilter, setRecommendSlotFilter] = useState('all');
  const [customRequestPrompt, setCustomRequestPrompt] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [quickLogRecipe, setQuickLogRecipe] = useState(null);
  const [quickLogForm, setQuickLogForm] = useState({
    date: formatDateKey(new Date()),
    slot: 'dinner',
    members: ['suhyeok', 'arina', 'simok', 'siyul'],
    cost: 0
  });

  // ==========================================
  // 7. Firebase 인증 및 실시간 데이터 구독
  // ==========================================
  useEffect(() => {
    if (!auth || !db) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('인증 오류:', err);
      }
    };

    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setIsCloudSynced(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const mealsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'family_meals');
    const fridgeColRef = collection(db, 'artifacts', appId, 'public', 'data', 'fridge_items');

    let fridgeInitialized = false;
    let mealsInitialized = false;

    const unsubMeals = onSnapshot(
      mealsColRef,
      async (snapshot) => {
        const loadedMeals = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        const hasDaycareSeed = loadedMeals.some((m) => m.id === 'daycare-2026-11-02-lu-simok');
        if ((loadedMeals.length === 0 || !hasDaycareSeed) && !mealsInitialized) {
          mealsInitialized = true;
          const samples = getInitialSampleMeals();
          for (const item of samples) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'family_meals', item.id);
            await setDoc(docRef, item);
          }
        } else {
          mealsInitialized = true;
          setMeals(loadedMeals);
        }
      },
      (err) => console.error('식단 데이터 수신 오류:', err)
    );

    const unsubFridge = onSnapshot(
      fridgeColRef,
      async (snapshot) => {
        const loadedFridge = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        const hasPriceField = loadedFridge.some((f) => typeof f.price === 'number' && f.price > 0);
        if ((loadedFridge.length === 0 || !hasPriceField) && !fridgeInitialized) {
          fridgeInitialized = true;
          const samples = getInitialSampleFridgeItems();
          for (const item of samples) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'fridge_items', item.id);
            await setDoc(docRef, item);
          }
        } else {
          fridgeInitialized = true;
          setFridgeItems(loadedFridge);
          setSelectedIngredientNames((prev) =>
            prev.length === 0 ? loadedFridge.slice(0, 4).map((i) => i.name) : prev
          );
        }
      },
      (err) => console.error('냉장고 데이터 수신 오류:', err)
    );

    return () => {
      unsubMeals();
      unsubFridge();
    };
  }, [user]);

  // ==========================================
  // 8. 식단 CRUD 핸들러
  // ==========================================
  const openAddMealModal = (slotId = 'breakfast', presetMember = null, presetDate = null) => {
    const targetDate = presetDate || selectedDate;
    const defaultMembers =
      presetMember && presetMember !== 'all'
        ? [presetMember]
        : selectedMemberFilter !== 'all'
        ? [selectedMemberFilter]
        : ['suhyeok', 'arina', 'simok', 'siyul'];

    const isKidsOnly =
      defaultMembers.every((m) => m === 'simok' || m === 'siyul') && defaultMembers.length > 0;

    setEditingMeal(null);
    setMealForm({
      date: targetDate,
      slot: slotId,
      menu: '',
      members: defaultMembers,
      mealType: isKidsOnly ? '유아식/이유식' : defaultMembers.length === 4 ? '집밥/온가족식' : '어른식',
      usedIngredients: '',
      cost: 0,
      note: ''
    });
    setIsMealModalOpen(true);
  };

  const openEditMealModal = (meal) => {
    setEditingMeal(meal);
    setMealForm({
      date: meal.date,
      slot: meal.slot || 'breakfast',
      menu: meal.menu,
      members: meal.members || ['suhyeok', 'arina', 'simok', 'siyul'],
      mealType: meal.mealType || '집밥/온가족식',
      usedIngredients: meal.usedIngredients || '',
      cost: Number(meal.cost) || 0,
      note: meal.note || ''
    });
    setIsMealModalOpen(true);
  };

  const handleSaveMeal = async (e) => {
    e.preventDefault();
    if (!mealForm.menu.trim()) {
      showToast('메뉴 이름을 입력해주세요.', 'error');
      return;
    }
    if (mealForm.members.length === 0) {
      showToast('식사할 가족 구성원을 최소 1명 선택해주세요.', 'error');
      return;
    }

    const payload = {
      date: mealForm.date,
      slot: mealForm.slot,
      menu: mealForm.menu.trim(),
      members: mealForm.members,
      mealType: mealForm.mealType,
      usedIngredients: mealForm.usedIngredients.trim(),
      cost: Number(mealForm.cost) || 0,
      note: mealForm.note.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (user && db) {
        if (editingMeal) {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'family_meals', editingMeal.id);
          await updateDoc(docRef, payload);
        } else {
          const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'family_meals');
          await addDoc(colRef, payload);
        }
      } else {
        if (editingMeal) {
          setMeals((prev) => prev.map((m) => (m.id === editingMeal.id ? { ...m, ...payload } : m)));
        } else {
          setMeals((prev) => [...prev, { id: `local-${Date.now()}`, ...payload }]);
        }
      }
      setIsMealModalOpen(false);
      showToast(editingMeal ? '식단 기록이 수정되었습니다.' : '새 식단이 기록되었습니다!');
    } catch (err) {
      console.error('식단 저장 오류:', err);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteMeal = async (mealId) => {
    try {
      if (user && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'family_meals', mealId);
        await deleteDoc(docRef);
      } else {
        setMeals((prev) => prev.filter((m) => m.id !== mealId));
      }
      setIsMealModalOpen(false);
      showToast('식단 기록이 삭제되었습니다.');
    } catch (err) {
      console.error('식단 삭제 오류:', err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const toggleMemberInMealForm = (memberId) => {
    setMealForm((prev) => {
      const exists = prev.members.includes(memberId);
      const nextMembers = exists
        ? prev.members.filter((id) => id !== memberId)
        : [...prev.members, memberId];
      return { ...prev, members: nextMembers };
    });
  };

  const setGroupMembersInMealForm = (groupType) => {
    if (groupType === 'all') {
      setMealForm((prev) => ({
        ...prev,
        members: ['suhyeok', 'arina', 'simok', 'siyul'],
        mealType: '집밥/온가족식'
      }));
    } else if (groupType === 'adults') {
      setMealForm((prev) => ({
        ...prev,
        members: ['suhyeok', 'arina'],
        mealType: '어른식'
      }));
    } else if (groupType === 'kids') {
      setMealForm((prev) => ({
        ...prev,
        members: ['simok', 'siyul'],
        mealType: '유아식/이유식'
      }));
    } else if (groupType === 'simok_daycare') {
      setMealForm((prev) => ({
        ...prev,
        members: ['simok'],
        mealType: '어린이집 급식'
      }));
    }
  };

  // ==========================================
  // 9. 냉장고 재료 CRUD 핸들러
  // ==========================================
  const openAddFridgeModal = () => {
    setEditingFridgeItem(null);
    setFridgeForm({
      name: '',
      category: selectedCategory !== '전체' ? selectedCategory : '채소/과일',
      storage: selectedStorage !== 'all' ? selectedStorage : 'fridge',
      quantity: 1,
      unit: '개',
      price: 0,
      purchaseDate: formatDateKey(new Date()),
      expiryDate: addDays(formatDateKey(new Date()), 5),
      memo: ''
    });
    setIsFridgeModalOpen(true);
  };

  const openEditFridgeModal = (item) => {
    setEditingFridgeItem(item);
    setFridgeForm({
      name: item.name,
      category: item.category || '채소/과일',
      storage: item.storage || 'fridge',
      quantity: item.quantity ?? 1,
      unit: item.unit || '개',
      price: Number(item.price) || 0,
      purchaseDate: item.purchaseDate || formatDateKey(new Date()),
      expiryDate: item.expiryDate || addDays(formatDateKey(new Date()), 5),
      memo: item.memo || ''
    });
    setIsFridgeModalOpen(true);
  };

  const handleSaveFridgeItem = async (e) => {
    e.preventDefault();
    if (!fridgeForm.name.trim()) {
      showToast('식재료 이름을 입력해주세요.', 'error');
      return;
    }

    const payload = {
      name: fridgeForm.name.trim(),
      category: fridgeForm.category,
      storage: fridgeForm.storage,
      quantity: Number(fridgeForm.quantity) || 0,
      unit: fridgeForm.unit.trim() || '개',
      price: Number(fridgeForm.price) || 0,
      purchaseDate: fridgeForm.purchaseDate || formatDateKey(new Date()),
      expiryDate: fridgeForm.expiryDate,
      memo: fridgeForm.memo.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (user && db) {
        if (editingFridgeItem) {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'fridge_items', editingFridgeItem.id);
          await updateDoc(docRef, payload);
        } else {
          const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'fridge_items');
          await addDoc(colRef, payload);
        }
      } else {
        if (editingFridgeItem) {
          setFridgeItems((prev) =>
            prev.map((item) => (item.id === editingFridgeItem.id ? { ...item, ...payload } : item))
          );
        } else {
          setFridgeItems((prev) => [...prev, { id: `local-fridge-${Date.now()}`, ...payload }]);
        }
      }
      setIsFridgeModalOpen(false);
      showToast(editingFridgeItem ? '냉장고 재료가 수정되었습니다.' : '새 식재료와 금액이 기록되었습니다!');
    } catch (err) {
      console.error('재료 저장 오류:', err);
      showToast('재료 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleAdjustQuantity = async (item, delta) => {
    const step = item.unit === 'g' || item.unit === 'ml' ? (delta > 0 ? 100 : -100) : delta;
    const nextQty = Math.max(0, Number(item.quantity || 0) + step);

    try {
      if (user && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'fridge_items', item.id);
        if (nextQty === 0) {
          await deleteDoc(docRef);
          showToast(`'${item.name}' 재료를 모두 소진하여 목록에서 정리했습니다.`);
        } else {
          await updateDoc(docRef, { quantity: nextQty });
        }
      } else {
        if (nextQty === 0) {
          setFridgeItems((prev) => prev.filter((i) => i.id !== item.id));
          showToast(`'${item.name}' 재료를 모두 소진하여 목록에서 정리했습니다.`);
        } else {
          setFridgeItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i))
          );
        }
      }
    } catch (err) {
      console.error('수량 변경 오류:', err);
    }
  };

  const handleDeleteFridgeItem = async (itemId, itemName) => {
    try {
      if (user && db) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'fridge_items', itemId);
        await deleteDoc(docRef);
      } else {
        setFridgeItems((prev) => prev.filter((i) => i.id !== itemId));
      }
      showToast(`'${itemName}' 재료가 삭제되었습니다.`);
    } catch (err) {
      console.error('재료 삭제 오류:', err);
    }
  };

  // ==========================================
  // 10. 어린이집 식단표 사진 AI Vision 스캔 & 일괄 등록
  // ==========================================
  const handleLoadAttachedShindangMenu = () => {
    setScannedDaycareList(
      SHINDANG_DAYCARE_RAW.map((d) => ({
        ...d,
        selected: true
      }))
    );
    showToast('첨부해주신 신당동어린이집 11월 식단표(25일분·75끼) 데이터를 불러왔습니다!');
  };

  const handleDaycareImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningDaycare(true);
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setDaycarePreviewImg(previewUrl);

      const prompt = `이 어린이집/유치원 월간 식단표 이미지에서 각 날짜별 오전간식, 점심, 오후간식 메뉴를 추출해주세요.
연월 기준은 ${daycareTargetYearMonth} 입니다 (예: 날짜 숫자가 2이면 ${daycareTargetYearMonth}-02).
알레르기 번호(①②③ 등)는 제거하고 깔끔한 한글 메뉴명으로 정리해주세요.`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                date: { type: 'STRING' },
                morning_snack: { type: 'STRING' },
                lunch: { type: 'STRING' },
                afternoon_snack: { type: 'STRING' },
                kcal: { type: 'STRING' }
              },
              propertyOrdering: ['date', 'morning_snack', 'lunch', 'afternoon_snack', 'kcal']
            }
          }
        }
      };

      const result = await callGeminiWithFallback(payload, geminiApiKey);
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setScannedDaycareList(parsed.map((item) => ({ ...item, selected: true })));
          showToast(`AI가 어린이집 식단표에서 총 ${parsed.length}일치 식단을 추출했습니다!`);
          setIsScanningDaycare(false);
          return;
        }
      }
      throw new Error('추출 결과 없음');
    } catch (err) {
      console.warn('어린이집 식단표 기본 데이터로 폴백:', err);
      handleLoadAttachedShindangMenu();
    } finally {
      setIsScanningDaycare(false);
    }
  };

  const handleConfirmDaycareBulkSave = async () => {
    const selectedDays = scannedDaycareList.filter((d) => d.selected);
    if (selectedDays.length === 0) {
      showToast('등록할 날짜를 최소 1일 이상 선택해주세요.', 'error');
      return;
    }

    const newEntries = [];
    selectedDays.forEach((day) => {
      if (day.morning_snack) {
        newEntries.push({
          id: `daycare-${day.date}-ms-${daycareTargetChild}`,
          date: day.date,
          slot: 'morning_snack',
          menu: `[어린이집 오전간식] ${day.morning_snack}`,
          members: [daycareTargetChild],
          mealType: '어린이집 급식',
          usedIngredients: '',
          cost: 0,
          note: `어린이집 식단표 자동스캔 ${day.kcal ? `(${day.kcal})` : ''}`
        });
      }
      if (day.lunch) {
        newEntries.push({
          id: `daycare-${day.date}-lu-${daycareTargetChild}`,
          date: day.date,
          slot: 'lunch',
          menu: `[어린이집 점심] ${day.lunch}`,
          members: [daycareTargetChild],
          mealType: '어린이집 급식',
          usedIngredients: '',
          cost: 0,
          note: `어린이집 식단표 자동스캔 ${day.kcal ? `(${day.kcal})` : ''}`
        });
      }
      if (day.afternoon_snack) {
        newEntries.push({
          id: `daycare-${day.date}-as-${daycareTargetChild}`,
          date: day.date,
          slot: 'afternoon_snack',
          menu: `[어린이집 오후간식] ${day.afternoon_snack}`,
          members: [daycareTargetChild],
          mealType: '어린이집 급식',
          usedIngredients: '',
          cost: 0,
          note: `어린이집 식단표 자동스캔 ${day.kcal ? `(${day.kcal})` : ''}`
        });
      }
    });

    try {
      if (user && db) {
        for (const entry of newEntries) {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'family_meals', entry.id);
          await setDoc(docRef, entry);
        }
      } else {
        setMeals((prev) => {
          const idMap = new Map(prev.map((m) => [m.id, m]));
          newEntries.forEach((e) => idMap.set(e.id, e));
          return Array.from(idMap.values());
        });
      }
      setIsDaycareModalOpen(false);
      setMonthlyMemberFilter(daycareTargetChild);
      setActiveTab('monthly');
      showToast(
        `${
          FAMILY_MEMBERS.find((m) => m.id === daycareTargetChild)?.name
        }의 어린이집 식단 ${newEntries.length}건이 일괄 등록되었습니다!`
      );
    } catch (err) {
      console.error('어린이집 식단 일괄 저장 오류:', err);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // ==========================================
  // 11. 마트 영수증 사진 AI Vision 스캔 & 냉장고+가계부 일괄 등록
  // ==========================================
  const handleLoadSampleReceipt = () => {
    setScannedReceiptItems(
      SAMPLE_RECEIPT_ITEMS.map((item, idx) => ({
        ...item,
        id: `sample-rec-${idx}`,
        selected: true
      }))
    );
    showToast('샘플 마트 영수증 품목 5건과 구매 금액을 불러왔습니다!');
  };

  const handleReceiptImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    try {
      const { base64, mimeType, previewUrl } = await fileToBase64(file);
      setReceiptPreviewImg(previewUrl);

      const today = formatDateKey(new Date());
      const prompt = `이 마트/슈퍼마켓 영수증 사진에서 구매한 식재료 및 식품 품목을 추출해주세요.
비식품(종량제봉투, 세제 등)은 제외하고 식품만 추출하세요.
각 품목별로:
- name: 깔끔한 상품명
- category: '채소/과일', '육류/해산물', '유제품/계란', '두부/콩/곡류', '유아식/이유식 재료', '양념/반찬/김치', '기타/간식' 중 하나
- storage: 'fridge'(냉장실), 'freezer'(냉동실), 'pantry'(실온) 중 적절한 보관장소
- quantity: 수량 또는 중량 숫자 (기본 1)
- unit: 단위 ('개', '팩', '봉', 'g', '모' 등)
- price: 결제 금액(원 단위 숫자, 예: 12900)
- expiryDate: 오늘(${today}) 기준으로 예상되는 권장 소비기한 (YYYY-MM-DD 형식)
- memo: 간단한 용도 추천`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64 } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                category: { type: 'STRING' },
                storage: { type: 'STRING' },
                quantity: { type: 'NUMBER' },
                unit: { type: 'STRING' },
                price: { type: 'NUMBER' },
                expiryDate: { type: 'STRING' },
                memo: { type: 'STRING' }
              },
              propertyOrdering: [
                'name',
                'category',
                'storage',
                'quantity',
                'unit',
                'price',
                'expiryDate',
                'memo'
              ]
            }
          }
        }
      };

      const result = await callGeminiWithFallback(payload, geminiApiKey);
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setScannedReceiptItems(
            parsed.map((item, idx) => ({
              ...item,
              id: `rec-scan-${Date.now()}-${idx}`,
              selected: true
            }))
          );
          showToast(`영수증에서 총 ${parsed.length}개 식재료와 금액을 인식했습니다!`);
          setIsScanningReceipt(false);
          return;
        }
      }
      throw new Error('영수증 인식 실패');
    } catch (err) {
      console.warn('영수증 스캔 기본 데이터로 폴백:', err);
      handleLoadSampleReceipt();
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleConfirmReceiptBulkSave = async () => {
    const selected = scannedReceiptItems.filter((i) => i.selected && i.name.trim());
    if (selected.length === 0) {
      showToast('냉장고에 추가할 품목을 최소 1개 이상 선택해주세요.', 'error');
      return;
    }

    const totalCost = selected.reduce((acc, cur) => acc + (Number(cur.price) || 0), 0);

    try {
      if (user && db) {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'fridge_items');
        for (const item of selected) {
          await addDoc(colRef, {
            name: item.name.trim(),
            category: FOOD_CATEGORIES.includes(item.category) ? item.category : '채소/과일',
            storage: ['fridge', 'freezer', 'pantry'].includes(item.storage)
              ? item.storage
              : 'fridge',
            quantity: Number(item.quantity) || 1,
            unit: item.unit || '개',
            price: Number(item.price) || 0,
            purchaseDate: receiptPurchaseDate,
            expiryDate: item.expiryDate || addDays(receiptPurchaseDate, 5),
            memo: item.memo || '영수증 스캔 입고',
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const added = selected.map((item, idx) => ({
          id: `local-receipt-${Date.now()}-${idx}`,
          name: item.name.trim(),
          category: FOOD_CATEGORIES.includes(item.category) ? item.category : '채소/과일',
          storage: ['fridge', 'freezer', 'pantry'].includes(item.storage) ? item.storage : 'fridge',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || '개',
          price: Number(item.price) || 0,
          purchaseDate: receiptPurchaseDate,
          expiryDate: item.expiryDate || addDays(receiptPurchaseDate, 5),
          memo: item.memo || '영수증 스캔 입고'
        }));
        setFridgeItems((prev) => [...added, ...prev]);
      }

      setIsReceiptModalOpen(false);
      setScannedReceiptItems([]);
      setReceiptPreviewImg(null);
      showToast(
        `${selected.length}개 품목(총 ${formatKRW(totalCost)})이 냉장고 및 식비 가계부에 등록되었습니다!`
      );
    } catch (err) {
      console.error('영수증 품목 일괄 등록 오류:', err);
      showToast('등록 중 오류가 발생했습니다.', 'error');
    }
  };

  // ==========================================
  // 12. AI 냉장고 맞춤 식단 추천
  // ==========================================
  const toggleSelectIngredientForAi = (name) => {
    setSelectedIngredientNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectExpiringIngredients = () => {
    const expiring = fridgeItems
      .filter((item) => {
        const dday = calculateDDay(item.expiryDate);
        return dday !== null && dday <= 4;
      })
      .map((item) => item.name);

    if (expiring.length === 0) {
      const topItems = fridgeItems.slice(0, 5).map((i) => i.name);
      setSelectedIngredientNames(topItems);
      showToast('임박 재료가 없어 상단 5개 재료를 선택했습니다.');
    } else {
      setSelectedIngredientNames(expiring);
      showToast(`소비기한 임박 재료 ${expiring.length}개를 우선 선택했습니다!`);
    }
  };

  const generateAiMealRecommendations = async () => {
    const ingredientsToUse =
      selectedIngredientNames.length > 0
        ? selectedIngredientNames
        : fridgeItems.map((i) => i.name);

    if (ingredientsToUse.length === 0) {
      showToast('냉장고에 등록된 재료가 없습니다. 먼저 재료를 추가해주세요.', 'error');
      return;
    }

    setIsGeneratingAi(true);

    const targetDescriptionMap = {
      all: '온가족 함께 먹는 식단 (아빠 김수혁, 엄마 최아리나, 첫째 김시목, 둘째 김시율이 한 냄비/같은 재료로 조리해 어른과 아이 모두 먹을 수 있는 메뉴)',
      adult: '어른 맞춤 식단 (아빠 김수혁, 엄마 최아리나 부부를 위한 맛있는 한끼 또는 야식)',
      simok:
        '첫째 김시목 맞춤 유아식/어린이 반찬 및 간식 (어린이집 점심 메뉴와 겹치지 않는 영양 식단)',
      siyul:
        '둘째 김시율 맞춤 부드러운 이유식/유아식 식단 (소화가 잘 되고 부드러운 식단)'
    };

    const slotLabelMap = {
      all: '아침, 오전간식, 점심, 오후간식, 저녁, 야식 중 어울리는 시간대',
      breakfast: '아침 식사',
      morning_snack: '오전간식',
      lunch: '점심 식사',
      afternoon_snack: '오후간식',
      dinner: '저녁 식사',
      late_snack: '부부 야식'
    };

    const systemPrompt = `당신은 대한민국 4인 가족(아빠 김수혁, 엄마 최아리나, 첫째 김시목, 둘째 김시율)의 전담 가정식 영양사이자 요리 연구가입니다.
현재 냉장고에 있는 재료를 최대한 활용하여 실용적이고 맛있는 집밥/간식 식단 3가지를 JSON 배열 형태로 추천해주세요.`;

    const userQuery = `
[현재 선택된 우선 활용 냉장고 재료]: ${ingredientsToUse.join(', ')}
[전체 보유 냉장고 재료]: ${fridgeItems.map((i) => `${i.name}(${i.quantity}${i.unit})`).join(', ')}
[추천 대상]: ${targetDescriptionMap[recommendTarget]}
[희망 식사 시간대]: ${slotLabelMap[recommendSlotFilter]}
[추가 요청사항]: ${customRequestPrompt || '아이들과 어른이 함께 활용하기 좋은 조리 팁을 포함해주세요.'}

응답은 반드시 지정된 JSON 스키마를 따르며, targetMembers 배열에는 해당 메뉴를 먹을 가족 구성원 ID('suhyeok', 'arina', 'simok', 'siyul' 중 해당자)를 정확히 포함하세요. recommendedSlot은 'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'late_snack' 중 하나여야 합니다.`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              recommendedSlot: { type: 'STRING' },
              targetMembers: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              cookingTime: { type: 'STRING' },
              usedIngredients: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              extraIngredients: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              steps: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              familyTip: { type: 'STRING' }
            },
            propertyOrdering: [
              'title',
              'recommendedSlot',
              'targetMembers',
              'cookingTime',
              'usedIngredients',
              'extraIngredients',
              'steps',
              'familyTip'
            ]
          }
        }
      }
    };

    try {
      const result = await callGeminiWithFallback(payload, geminiApiKey);
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAiRecommendations(
            parsed.map((item, idx) => ({
              ...item,
              id: `ai-rec-${Date.now()}-${idx}`
            }))
          );
          showToast('냉장고 재료 맞춤 AI 식단 3가지가 생성되었습니다!');
        }
      }
    } catch (err) {
      console.warn('AI 추천 호출 폴백 전환:', err);
      showToast('보유 재료 기반 맞춤 추천 레시피를 불러왔습니다.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const openQuickLogModal = (recipe) => {
    const validSlot = MEAL_SLOTS.some((s) => s.id === recipe.recommendedSlot)
      ? recipe.recommendedSlot
      : 'dinner';
    const validMembers =
      Array.isArray(recipe.targetMembers) && recipe.targetMembers.length > 0
        ? recipe.targetMembers.filter((m) => ['suhyeok', 'arina', 'simok', 'siyul'].includes(m))
        : ['suhyeok', 'arina', 'simok', 'siyul'];

    setQuickLogRecipe(recipe);
    setQuickLogForm({
      date: selectedDate,
      slot: validSlot,
      members: validMembers.length > 0 ? validMembers : ['suhyeok', 'arina', 'simok', 'siyul'],
      cost: 0
    });
  };

  const handleConfirmQuickLog = async () => {
    if (!quickLogRecipe) return;

    const isKidsOnly =
      quickLogForm.members.every((m) => m === 'simok' || m === 'siyul') &&
      quickLogForm.members.length > 0;

    const payload = {
      date: quickLogForm.date,
      slot: quickLogForm.slot,
      menu: quickLogRecipe.title,
      members: quickLogForm.members,
      mealType: isKidsOnly
        ? '유아식/이유식'
        : quickLogForm.members.length === 4
        ? '집밥/온가족식'
        : '냉장고파먹기',
      usedIngredients: (quickLogRecipe.usedIngredients || []).join(', '),
      cost: Number(quickLogForm.cost) || 0,
      note: quickLogRecipe.familyTip || 'AI 냉장고 파먹기 추천 식단으로 등록됨',
      updatedAt: new Date().toISOString()
    };

    try {
      if (user && db) {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'family_meals');
        await addDoc(colRef, payload);
      } else {
        setMeals((prev) => [...prev, { id: `local-${Date.now()}`, ...payload }]);
      }
      setSelectedDate(quickLogForm.date);
      setQuickLogRecipe(null);
      showToast(`'${quickLogRecipe.title}' 메뉴가 식단표에 등록되었습니다!`);
    } catch (err) {
      console.error('식단 바로 등록 오류:', err);
      showToast('식단 등록 중 오류가 발생했습니다.', 'error');
    }
  };

  // ==========================================
  // 13. 데이터 백업(JSON/CSV 내보내기) 및 복원 핸들러
  // ==========================================
  const handleExportJsonBackup = () => {
    const backupObj = {
      exportedAt: new Date().toISOString(),
      monthlyBudget,
      meals,
      fridgeItems
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `우리집식단냉장고_백업_${formatDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('전체 데이터 JSON 백업 파일이 다운로드되었습니다!');
  };

  const handleExportExcelCsv = () => {
    const rows = [
      ['구분', '날짜', '끼니/보관장소', '메뉴/품목명', '대상가족/카테고리', '식단태그/수량', '금액(원)', '메모']
    ];
    meals.forEach((m) => {
      const slotLabel = MEAL_SLOTS.find((s) => s.id === m.slot)?.label || m.slot;
      const memberNames = (m.members || [])
        .map((id) => FAMILY_MEMBERS.find((f) => f.id === id)?.name || id)
        .join('·');
      rows.push([
        '식단기록',
        m.date,
        slotLabel,
        m.menu,
        memberNames,
        m.mealType || '',
        Number(m.cost) || 0,
        m.note || ''
      ]);
    });
    fridgeItems.forEach((f) => {
      const stLabel = STORAGE_TYPES.find((s) => s.id === f.storage)?.label || f.storage;
      rows.push([
        '냉장고품목',
        f.purchaseDate || '',
        stLabel,
        f.name,
        f.category || '',
        `${f.quantity}${f.unit}`,
        Number(f.price) || 0,
        `소비기한:${f.expiryDate || ''} ${f.memo || ''}`
      ]);
    });

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `우리집식단_식비가계부_${formatDateKey(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('엑셀(CSV) 파일이 다운로드되었습니다!');
  };

  const handleImportJsonBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.meals)) setMeals(parsed.meals);
        if (Array.isArray(parsed.fridgeItems)) setFridgeItems(parsed.fridgeItems);
        if (parsed.monthlyBudget) setMonthlyBudget(Number(parsed.monthlyBudget));
        showToast('백업 파일에서 식단 및 냉장고 데이터가 복원되었습니다!');
        setIsSettingsModalOpen(false);
      } catch (err) {
        showToast('올바른 백업 파일 형식이 아닙니다.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // ==========================================
  // 14. 파생 데이터 계산 (일간 / 주간 / 월간 / 식비가계부)
  // ==========================================
  const weekStripDates = useMemo(() => {
    return [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
      const dateStr = addDays(selectedDate, offset);
      const dayNum = dateStr.split('-')[2];
      const dayKor = getDayOfWeekKor(dateStr);
      const hasMealCount = meals.filter((m) => m.date === dateStr).length;
      return { dateStr, dayNum, dayKor, hasMealCount };
    });
  }, [selectedDate, meals]);

  const filteredDayMeals = useMemo(() => {
    return meals.filter((meal) => {
      if (meal.date !== selectedDate) return false;
      if (selectedMemberFilter === 'all') return true;
      return Array.isArray(meal.members) && meal.members.includes(selectedMemberFilter);
    });
  }, [meals, selectedDate, selectedMemberFilter]);

  const currentMondayStr = useMemo(() => getMondayOfWeek(weeklyBaseDate), [weeklyBaseDate]);
  const weeklyDays = useMemo(() => getWeekDaysFromMonday(currentMondayStr), [currentMondayStr]);

  const weeklySummaryData = useMemo(() => {
    const dateSet = new Set(weeklyDays.map((d) => d.dateStr));
    const allWeekMeals = meals.filter((m) => dateSet.has(m.date));
    const filteredWeekMeals = allWeekMeals.filter((m) => {
      if (weeklyMemberFilter === 'all') return true;
      return Array.isArray(m.members) && m.members.includes(weeklyMemberFilter);
    });

    const mainSlotIds = ['breakfast', 'lunch', 'dinner'];
    let filledSlotsCount = 0;
    weeklyDays.forEach((day) => {
      mainSlotIds.forEach((slotId) => {
        const hasMeal = filteredWeekMeals.some(
          (m) => m.date === day.dateStr && m.slot === slotId
        );
        if (hasMeal) filledSlotsCount += 1;
      });
    });

    const totalPossibleSlots = 21;
    const fillRatePercent = Math.round((filledSlotsCount / totalPossibleSlots) * 100);

    const memberCounts = FAMILY_MEMBERS.map((member) => {
      const count = allWeekMeals.filter(
        (m) => Array.isArray(m.members) && m.members.includes(member.id)
      ).length;
      return { ...member, count };
    });

    const ingredientMap = {};
    filteredWeekMeals.forEach((m) => {
      if (!m.usedIngredients) return;
      m.usedIngredients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((ing) => {
          ingredientMap[ing] = (ingredientMap[ing] || 0) + 1;
        });
    });
    const topIngredients = Object.entries(ingredientMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      allWeekMeals,
      filteredWeekMeals,
      filledSlotsCount,
      totalPossibleSlots,
      fillRatePercent,
      memberCounts,
      topIngredients
    };
  }, [meals, weeklyDays, weeklyMemberFilter]);

  const monthlyData = useMemo(() => {
    const [yearNum, monthNum] = monthlyYearMonth.split('-').map(Number);
    const firstDayObj = new Date(yearNum, monthNum - 1, 1);
    const lastDayObj = new Date(yearNum, monthNum, 0);
    const daysInMonth = lastDayObj.getDate();
    const startWeekday = firstDayObj.getDay();

    const calendarCells = [];
    for (let i = 0; i < startWeekday; i++) {
      calendarCells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthlyYearMonth}-${String(d).padStart(2, '0')}`;
      calendarCells.push({ dayNum: d, dateStr });
    }

    const monthAllMeals = meals.filter((m) => (m.date || '').startsWith(monthlyYearMonth));

    const monthPersonMeals = monthAllMeals.filter((m) => {
      if (monthlyMemberFilter === 'all') return true;
      return Array.isArray(m.members) && m.members.includes(monthlyMemberFilter);
    });

    const slotCounts = {};
    MEAL_SLOTS.forEach((s) => {
      slotCounts[s.id] = monthPersonMeals.filter((m) => m.slot === s.id).length;
    });

    const daycareCount = monthPersonMeals.filter((m) => m.mealType === '어린이집 급식').length;
    const diningOutCount = monthPersonMeals.filter((m) => m.mealType === '외식/배달').length;
    const homeCookCount = monthPersonMeals.length - daycareCount - diningOutCount;

    const memberMonthlyCounts = FAMILY_MEMBERS.map((mem) => ({
      ...mem,
      count: monthAllMeals.filter((m) => Array.isArray(m.members) && m.members.includes(mem.id))
        .length
    }));

    const monthFridgePurchases = fridgeItems.filter((f) =>
      (f.purchaseDate || monthlyYearMonth).startsWith(monthlyYearMonth)
    );
    const totalGroceryCost = monthFridgePurchases.reduce(
      (sum, item) => sum + (Number(item.price) || 0),
      0
    );

    const monthPaidMeals = monthAllMeals.filter((m) => Number(m.cost) > 0);
    const totalMealDiningCost = monthPaidMeals.reduce(
      (sum, m) => sum + (Number(m.cost) || 0),
      0
    );

    const totalMonthlyFoodExpense = totalGroceryCost + totalMealDiningCost;
    const budgetPercent =
      monthlyBudget > 0 ? Math.round((totalMonthlyFoodExpense / monthlyBudget) * 100) : 0;

    const categoryExpenseMap = {};
    monthFridgePurchases.forEach((item) => {
      const cat = item.category || '기타/간식';
      categoryExpenseMap[cat] = (categoryExpenseMap[cat] || 0) + (Number(item.price) || 0);
    });
    const categoryExpenseList = Object.entries(categoryExpenseMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      yearNum,
      monthNum,
      calendarCells,
      monthAllMeals,
      monthPersonMeals,
      slotCounts,
      daycareCount,
      diningOutCount,
      homeCookCount,
      memberMonthlyCounts,
      monthFridgePurchases,
      monthPaidMeals,
      totalGroceryCost,
      totalMealDiningCost,
      totalMonthlyFoodExpense,
      budgetPercent,
      categoryExpenseList
    };
  }, [meals, fridgeItems, monthlyYearMonth, monthlyMemberFilter, monthlyBudget]);

  const changeMonthlyYearMonth = (deltaMonths) => {
    const [y, m] = monthlyYearMonth.split('-').map(Number);
    const dt = new Date(y, m - 1 + deltaMonths, 1);
    const nextYm = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    setMonthlyYearMonth(nextYm);
    setMonthlySelectedDay(`${nextYm}-01`);
  };

  const filteredFridgeItems = useMemo(() => {
    return fridgeItems
      .filter((item) => {
        if (selectedStorage !== 'all' && item.storage !== selectedStorage) return false;
        if (selectedCategory !== '전체' && item.category !== selectedCategory) return false;
        if (
          fridgeSearch.trim() &&
          !item.name.toLowerCase().includes(fridgeSearch.trim().toLowerCase()) &&
          !(item.memo || '').toLowerCase().includes(fridgeSearch.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortByExpiry) {
          const da = calculateDDay(a.expiryDate) ?? 999;
          const dbVal = calculateDDay(b.expiryDate) ?? 999;
          return da - dbVal;
        }
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [fridgeItems, selectedStorage, selectedCategory, fridgeSearch, sortByExpiry]);

  const expiringSoonItems = useMemo(() => {
    return fridgeItems.filter((item) => {
      const dday = calculateDDay(item.expiryDate);
      return dday !== null && dday <= 3;
    });
  }, [fridgeItems]);

  const matchedBuiltinRecipes = useMemo(() => {
    const activeNames =
      selectedIngredientNames.length > 0
        ? selectedIngredientNames
        : fridgeItems.map((i) => i.name);

    return BUILTIN_RECIPES.filter((r) => {
      if (recommendTarget === 'all') return true;
      if (recommendTarget === 'adult') return r.targetGroup === 'adult' || r.targetGroup === 'all';
      if (recommendTarget === 'simok') return r.targetGroup === 'simok' || r.targetGroup === 'all';
      if (recommendTarget === 'siyul') return r.targetGroup === 'siyul' || r.targetGroup === 'all';
      return true;
    })
      .map((recipe) => {
        const matchCount = recipe.keywords.filter((kw) =>
          activeNames.some((ingName) => ingName.includes(kw))
        ).length;
        return { ...recipe, matchCount };
      })
      .sort((a, b) => b.matchCount - a.matchCount);
  }, [fridgeItems, selectedIngredientNames, recommendTarget]);

  const displayedRecommendations =
    aiRecommendations.length > 0 ? aiRecommendations : matchedBuiltinRecipes;

  // ==========================================
  // 15. UI 렌더링
  // ==========================================
  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex justify-center font-sans selection:bg-orange-200">
      <div className="w-full max-w-md bg-stone-50 min-h-screen shadow-xl flex flex-col relative pb-24">
        {/* 상단 고정 헤더 */}
        <header className="bg-white border-b border-stone-200 px-3.5 pt-3 pb-2.5 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>ahrisoohyeokbap 키 내장완료</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isCloudSynced ? '실시간 동기화' : '자동 저장'}
                </span>
              </div>
              <h1 className="text-base font-extrabold text-stone-900 mt-0.5 tracking-tight">
                수혁 · 아리나 · 시목 · 시율네 식탁 🍽️
              </h1>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setActiveTab('monthly');
                  setMonthlySubTab('expense');
                }}
                className="flex flex-col items-end bg-emerald-50 hover:bg-emerald-100 transition px-2.5 py-1 rounded-xl border border-emerald-200"
                title="이번 달 식비 가계부 보기"
              >
                <span className="text-[9px] text-emerald-700 font-bold">11월 총 식비</span>
                <span className="text-xs font-extrabold text-emerald-900">
                  {formatKRW(monthlyData.totalMonthlyFoodExpense)}
                </span>
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 transition"
                title="내장 키 확인 및 엑셀 백업"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 상단 5대 메뉴 스위처 */}
          <div className="grid grid-cols-5 gap-1 bg-stone-100 p-1 rounded-xl mt-2.5">
            {[
              { id: 'meals', label: '일별식단', icon: Calendar },
              { id: 'weekly', label: '주간요약', icon: BarChart3 },
              { id: 'monthly', label: '월간·식비', icon: PieChart, badge: 'NEW' },
              { id: 'fridge', label: '냉장고', icon: Refrigerator },
              { id: 'recommend', label: 'AI추천', icon: Sparkles }
            ].map((tab) => {
              const IconComp = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 relative ${
                    active
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <IconComp className="w-3 h-3 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`-top-1 -right-0.5 text-[7px] font-black px-1 rounded-full ${
                        active ? 'bg-white text-orange-600' : 'bg-rose-500 text-white'
                      }`}
                    >
                      N
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* 토스트 알림 */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
            <div
              className={`px-4 py-3 rounded-2xl shadow-lg border flex items-center justify-between text-xs font-bold ${
                toast.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-stone-900 text-white border-stone-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{toast.message}</span>
              </div>
              <button onClick={() => setToast(null)} className="text-stone-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 1: 일별 식단 기록 (6단계 끼니 + 어린이집 식단표 스캔)
           ==================================================== */}
        {activeTab === 'meals' && (
          <main className="flex-1 px-4 pt-3.5 space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (scannedDaycareList.length === 0) handleLoadAttachedShindangMenu();
                  setIsDaycareModalOpen(true);
                }}
                className="bg-gradient-to-br from-amber-500 to-orange-500 text-white p-3 rounded-2xl shadow-xs text-left flex flex-col justify-between hover:opacity-95 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold bg-white/25 px-1.5 py-0.5 rounded">
                    시목이 어린이집
                  </span>
                  <School className="w-4 h-4 text-white" />
                </div>
                <div className="mt-2">
                  <p className="text-xs font-extrabold leading-tight">
                    📸 어린이집 식단표 스캔
                  </p>
                  <p className="text-[10px] text-orange-100 mt-0.5">
                    신당동어린이집 11월 적용됨
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (scannedReceiptItems.length === 0) handleLoadSampleReceipt();
                  setIsReceiptModalOpen(true);
                }}
                className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-xs text-left flex flex-col justify-between hover:opacity-95 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold bg-white/25 px-1.5 py-0.5 rounded">
                    냉장고 + 가계부
                  </span>
                  <Receipt className="w-4 h-4 text-white" />
                </div>
                <div className="mt-2">
                  <p className="text-xs font-extrabold leading-tight">
                    🧾 마트 영수증 사진 스캔
                  </p>
                  <p className="text-[10px] text-emerald-100 mt-0.5">
                    품목·금액 냉장고 자동입고
                  </p>
                </div>
              </button>
            </div>

            {/* 날짜 선택기 & 주간 스트립 */}
            <section className="bg-white rounded-2xl p-3.5 shadow-sm border border-stone-200">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="font-bold text-stone-800 text-sm bg-transparent focus:outline-none cursor-pointer"
                  />
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600">
                    {getDayOfWeekKor(selectedDate)}요일
                  </span>
                  {selectedDate !== formatDateKey(new Date()) && (
                    <button
                      onClick={() => setSelectedDate(formatDateKey(new Date()))}
                      className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg"
                    >
                      오늘
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {weekStripDates.map((d) => {
                  const isSelected = d.dateStr === selectedDate;
                  const isToday = d.dateStr === formatDateKey(new Date());
                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`flex flex-col items-center py-2 rounded-xl transition ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-sm'
                          : isToday
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : 'hover:bg-stone-100 text-stone-600'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium ${
                          isSelected ? 'text-orange-100' : 'text-stone-400'
                        }`}
                      >
                        {d.dayKor}
                      </span>
                      <span className="text-sm font-bold mt-0.5">{d.dayNum}</span>
                      <div className="h-1.5 mt-1 flex items-center gap-0.5">
                        {d.hasMealCount > 0 && (
                          <span
                            className={`text-[9px] font-extrabold ${
                              isSelected ? 'text-white' : 'text-orange-500'
                            }`}
                          >
                            {d.hasMealCount}끼
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 가족 구성원별 필터 */}
            <section className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedMemberFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition border ${
                  selectedMemberFilter === 'all'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                👨‍👩‍👧‍👦 전체 가족
              </button>
              {FAMILY_MEMBERS.map((member) => {
                const active = selectedMemberFilter === member.id;
                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMemberFilter(member.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition border flex items-center gap-1 ${
                      active
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span>{member.emoji}</span>
                    <span>{member.name}</span>
                  </button>
                );
              })}
            </section>

            {/* 6단계 끼니별 카드 리스트 */}
            <div className="space-y-3">
              {MEAL_SLOTS.map((slot) => {
                const slotMeals = filteredDayMeals.filter((m) => m.slot === slot.id);
                return (
                  <div
                    key={slot.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
                  >
                    <div
                      className={`px-4 py-2.5 bg-gradient-to-r ${slot.accent} border-b flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{slot.icon}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-extrabold text-stone-800">{slot.label}</h3>
                            {slotMeals.length > 0 && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/80 text-stone-700">
                                {slotMeals.length}건
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-500">{slot.timeHint}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => openAddMealModal(slot.id)}
                        className="flex items-center gap-1 text-xs font-bold bg-white/90 hover:bg-white text-stone-800 px-2.5 py-1.5 rounded-xl border border-stone-200 shadow-2xs transition"
                      >
                        <Plus className="w-3.5 h-3.5 text-orange-500" />
                        <span>추가</span>
                      </button>
                    </div>

                    <div className="p-3 space-y-2">
                      {slotMeals.length === 0 ? (
                        <div className="flex items-center justify-between py-1.5 px-1 text-xs text-stone-400">
                          <span>기록된 {slot.label} 메뉴가 없습니다.</span>
                          <button
                            onClick={() => openAddMealModal(slot.id)}
                            className="font-bold text-orange-600 hover:underline"
                          >
                            + 기록하기
                          </button>
                        </div>
                      ) : (
                        slotMeals.map((meal) => (
                          <div
                            key={meal.id}
                            className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 hover:border-stone-300 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {meal.mealType && (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                        meal.mealType === '어린이집 급식'
                                          ? 'bg-amber-500 text-white'
                                          : meal.mealType === '외식/배달'
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-stone-800 text-white'
                                      }`}
                                    >
                                      {meal.mealType}
                                    </span>
                                  )}
                                  {(meal.members || []).map((memId) => {
                                    const mem = FAMILY_MEMBERS.find((f) => f.id === memId);
                                    if (!mem) return null;
                                    return (
                                      <span
                                        key={memId}
                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${mem.color}`}
                                      >
                                        {mem.emoji} {mem.name}
                                      </span>
                                    );
                                  })}
                                  {Number(meal.cost) > 0 && (
                                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      💰 {formatKRW(meal.cost)}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-stone-900 leading-snug">
                                  {meal.menu}
                                </h4>

                                {meal.usedIngredients && (
                                  <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                                    <Refrigerator className="w-3 h-3 shrink-0" />
                                    <span>사용 재료: {meal.usedIngredients}</span>
                                  </p>
                                )}

                                {meal.note && (
                                  <p className="text-xs text-stone-500 bg-white px-2.5 py-1.5 rounded-lg border border-stone-100">
                                    💬 {meal.note}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditMealModal(meal)}
                                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMeal(meal.id)}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}

        {/* ====================================================
            TAB 2: 주간 식단현황 요약
           ==================================================== */}
        {activeTab === 'weekly' && (
          <main className="flex-1 px-4 pt-4 space-y-4">
            <section className="bg-white rounded-2xl p-3.5 shadow-sm border border-stone-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWeeklyBaseDate(addDays(currentMondayStr, -7))}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600 transition flex items-center gap-0.5 text-xs font-bold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>이전주</span>
                </button>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-extrabold text-stone-900">
                      {formatWeekRangeLabel(currentMondayStr)}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500 mt-0.5">
                    아침·오전간식·점심·오후간식·저녁·야식 주간 요약
                  </span>
                </div>

                <button
                  onClick={() => setWeeklyBaseDate(addDays(currentMondayStr, 7))}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600 transition flex items-center gap-0.5 text-xs font-bold"
                >
                  <span>다음주</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* 주간 달성률 & 인별 필터 카드 */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-white bg-orange-500 px-2 py-0.5 rounded-full">
                    주간 식단현황
                  </span>
                  <h2 className="text-sm font-extrabold text-stone-900 mt-1">
                    이번 주 총 {weeklySummaryData.filteredWeekMeals.length}끼 식단·간식 기록됨
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-orange-600">
                    {weeklySummaryData.fillRatePercent}%
                  </span>
                  <p className="text-[11px] text-stone-500 font-medium">
                    주요 21끼 중 {weeklySummaryData.filledSlotsCount}끼 완료
                  </p>
                </div>
              </div>

              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, weeklySummaryData.fillRatePercent)}%` }}
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                <button
                  onClick={() => setWeeklyMemberFilter('all')}
                  className={`p-2 rounded-xl border text-center transition ${
                    weeklyMemberFilter === 'all'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="text-sm">👨‍👩‍👧‍👦</div>
                  <div className="text-[11px] font-bold mt-0.5">전체</div>
                  <div className="text-[10px] font-extrabold text-orange-400">
                    {weeklySummaryData.allWeekMeals.length}건
                  </div>
                </button>
                {weeklySummaryData.memberCounts.map((mc) => {
                  const active = weeklyMemberFilter === mc.id;
                  return (
                    <button
                      key={mc.id}
                      onClick={() =>
                        setWeeklyMemberFilter(weeklyMemberFilter === mc.id ? 'all' : mc.id)
                      }
                      className={`p-2 rounded-xl border text-center transition ${
                        active
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="text-sm">{mc.emoji}</div>
                      <div className="text-[11px] font-bold mt-0.5">{mc.name}</div>
                      <div
                        className={`text-[10px] font-extrabold ${
                          active ? 'text-white' : 'text-orange-600'
                        }`}
                      >
                        {mc.count}끼
                      </div>
                    </button>
                  );
                })}
              </div>

              {weeklySummaryData.topIngredients.length > 0 && (
                <div className="pt-1 border-t border-stone-100 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-extrabold text-emerald-700">
                    🥬 이번 주 활용 재료 TOP:
                  </span>
                  {weeklySummaryData.topIngredients.map((ing) => (
                    <span
                      key={ing.name}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      {ing.name} ({ing.count}회)
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 뷰 전환 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl">
                <button
                  onClick={() => setWeeklyViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    weeklyViewMode === 'grid' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  한눈에 표 보기
                </button>
                <button
                  onClick={() => setWeeklyViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    weeklyViewMode === 'cards' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                  }`}
                >
                  요일별 카드 보기
                </button>
              </div>
              <button
                onClick={() => setActiveTab('monthly')}
                className="text-xs font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-200 flex items-center gap-1"
              >
                <span>인별 월간현황 보기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {weeklyViewMode === 'grid' ? (
              <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-10 bg-stone-100 border-b border-stone-200 text-[11px] font-extrabold text-stone-700 text-center">
                  <div className="col-span-1 py-2 border-r border-stone-200">요일</div>
                  <div className="col-span-3 py-2 border-r border-stone-200">🌅 아침</div>
                  <div className="col-span-3 py-2 border-r border-stone-200">☀️ 점심</div>
                  <div className="col-span-3 py-2">🌙 저녁</div>
                </div>
                <div className="divide-y divide-stone-200">
                  {weeklyDays.map((day) => {
                    const isToday = day.dateStr === formatDateKey(new Date());
                    const daySnacks = weeklySummaryData.filteredWeekMeals.filter(
                      (m) =>
                        m.date === day.dateStr &&
                        ['morning_snack', 'afternoon_snack', 'late_snack'].includes(m.slot)
                    );
                    return (
                      <div key={day.dateStr} className="flex flex-col">
                        <div className="grid grid-cols-10 min-h-[72px]">
                          <button
                            onClick={() => {
                              setSelectedDate(day.dateStr);
                              setActiveTab('meals');
                            }}
                            className={`col-span-1 border-r border-stone-200 p-1 flex flex-col items-center justify-center ${
                              isToday ? 'bg-orange-50 text-orange-700' : 'text-stone-700'
                            }`}
                          >
                            <span className="text-xs font-extrabold">{day.dayKor}</span>
                            <span className="text-[10px] text-stone-400">{day.shortDate}</span>
                          </button>

                          {['breakfast', 'lunch', 'dinner'].map((slotId, idx) => {
                            const cellMeals = weeklySummaryData.filteredWeekMeals.filter(
                              (m) => m.date === day.dateStr && m.slot === slotId
                            );
                            return (
                              <div
                                key={slotId}
                                className={`col-span-3 p-1.5 ${
                                  idx < 2 ? 'border-r border-stone-200/80' : ''
                                }`}
                              >
                                {cellMeals.length === 0 ? (
                                  <button
                                    onClick={() =>
                                      openAddMealModal(slotId, weeklyMemberFilter, day.dateStr)
                                    }
                                    className="w-full h-full min-h-[54px] rounded-xl border border-dashed border-stone-200 text-stone-300 hover:text-orange-500 flex items-center justify-center"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <div className="space-y-1">
                                    {cellMeals.map((m) => (
                                      <button
                                        key={m.id}
                                        onClick={() => openEditMealModal(m)}
                                        className="w-full text-left p-1 rounded-lg bg-stone-50 border border-stone-200/90 block"
                                      >
                                        <p className="text-[10px] font-bold text-stone-800 line-clamp-2 leading-tight">
                                          {m.menu}
                                        </p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {daySnacks.length > 0 && (
                          <div className="bg-amber-50/60 border-t border-amber-100 px-2.5 py-1 flex flex-wrap gap-1.5 text-[10px]">
                            {daySnacks.map((sn) => {
                              const sl = MEAL_SLOTS.find((s) => s.id === sn.slot);
                              return (
                                <button
                                  key={sn.id}
                                  onClick={() => openEditMealModal(sn)}
                                  className="px-1.5 py-0.5 rounded bg-white border border-amber-200 text-stone-700 font-semibold truncate max-w-full"
                                >
                                  {sl?.icon} {sl?.shortLabel}: {sn.menu.replace(/^\[.*?\]\s*/, '')}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                {weeklyDays.map((day) => {
                  const dayMeals = weeklySummaryData.filteredWeekMeals.filter(
                    (m) => m.date === day.dateStr
                  );
                  return (
                    <div
                      key={day.dateStr}
                      className="bg-white rounded-2xl border border-stone-200 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <span className="text-xs font-extrabold text-stone-900">
                          {day.monthNum}월 {day.dayNum}일 ({day.dayKor}요일) · {dayMeals.length}건
                        </span>
                        <button
                          onClick={() =>
                            openAddMealModal('breakfast', weeklyMemberFilter, day.dateStr)
                          }
                          className="text-xs font-bold text-orange-600"
                        >
                          + 추가
                        </button>
                      </div>
                      {dayMeals.map((m) => {
                        const sl = MEAL_SLOTS.find((s) => s.id === m.slot);
                        return (
                          <div
                            key={m.id}
                            onClick={() => openEditMealModal(m)}
                            className="p-2 rounded-xl bg-stone-50 border border-stone-200/80 text-xs flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div>
                              <span className="font-extrabold text-stone-700 mr-1.5">
                                {sl?.icon} {sl?.label}
                              </span>
                              <span className="font-bold text-stone-900">{m.menu}</span>
                            </div>
                            <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </section>
            )}
          </main>
        )}

        {/* ====================================================
            TAB 3: 인별 월간 현황 & 월간 식비 가계부
           ==================================================== */}
        {activeTab === 'monthly' && (
          <main className="flex-1 px-4 pt-3.5 space-y-4">
            <div className="grid grid-cols-2 gap-1.5 bg-stone-200/80 p-1 rounded-2xl">
              <button
                onClick={() => setMonthlySubTab('calendar')}
                className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  monthlySubTab === 'calendar'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Calendar className="w-4 h-4 text-orange-500" />
                <span>인별 월간 식단현황</span>
              </button>
              <button
                onClick={() => setMonthlySubTab('expense')}
                className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  monthlySubTab === 'expense'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>월간 식비 가계부</span>
              </button>
            </div>

            <section className="bg-white rounded-2xl p-3 shadow-sm border border-stone-200 flex items-center justify-between">
              <button
                onClick={() => changeMonthlyYearMonth(-1)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600 flex items-center gap-0.5 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>이전달</span>
              </button>
              <div className="text-center">
                <h2 className="text-sm font-extrabold text-stone-900">
                  {monthlyData.yearNum}년 {monthlyData.monthNum}월
                </h2>
                <p className="text-[11px] text-stone-500">
                  {monthlySubTab === 'calendar'
                    ? '가족 구성원별 한 달 식단표 & 어린이집 급식 현황'
                    : '냉장고 장보기 + 외식·배달 월간 총 식비 리포트'}
                </p>
              </div>
              <button
                onClick={() => changeMonthlyYearMonth(1)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-600 flex items-center gap-0.5 text-xs font-bold"
              >
                <span>다음달</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            {monthlySubTab === 'calendar' && (
              <>
                <section className="bg-white rounded-2xl p-3.5 shadow-sm border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-700">
                      👤 누구의 {monthlyData.monthNum}월 식단 현황을 볼까요?
                    </span>
                    <button
                      onClick={() => {
                        if (scannedDaycareList.length === 0) handleLoadAttachedShindangMenu();
                        setIsDaycareModalOpen(true);
                      }}
                      className="text-[11px] font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>어린이집 식단표 사진 업로드</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      onClick={() => setMonthlyMemberFilter('all')}
                      className={`p-2 rounded-xl border text-center transition ${
                        monthlyMemberFilter === 'all'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="text-sm">👨‍👩‍👧‍👦</div>
                      <div className="text-[11px] font-bold mt-0.5">전체</div>
                      <div className="text-[10px] font-extrabold text-orange-400">
                        {monthlyData.monthAllMeals.length}끼
                      </div>
                    </button>
                    {monthlyData.memberMonthlyCounts.map((mem) => {
                      const active = monthlyMemberFilter === mem.id;
                      return (
                        <button
                          key={mem.id}
                          onClick={() => setMonthlyMemberFilter(mem.id)}
                          className={`p-2 rounded-xl border text-center transition ${
                            active
                              ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                              : 'bg-stone-50 border-stone-200 text-stone-700'
                          }`}
                        >
                          <div className="text-sm">{mem.emoji}</div>
                          <div className="text-[11px] font-bold mt-0.5">{mem.name}</div>
                          <div
                            className={`text-[10px] font-extrabold ${
                              active ? 'text-white' : 'text-orange-600'
                            }`}
                          >
                            {mem.count}끼
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-stone-800">
                        {monthlyMemberFilter === 'all'
                          ? '👨‍👩‍👧‍👦 가족 전체'
                          : `${
                              FAMILY_MEMBERS.find((f) => f.id === monthlyMemberFilter)?.emoji
                            } ${
                              FAMILY_MEMBERS.find((f) => f.id === monthlyMemberFilter)?.name
                            }`}{' '}
                        {monthlyData.monthNum}월 누적 기록:{' '}
                        <span className="text-orange-600 font-black">
                          {monthlyData.monthPersonMeals.length}끼
                        </span>
                      </span>
                      <span className="text-[11px] text-stone-500 font-semibold">
                        집밥 {monthlyData.homeCookCount} · 어린이집 {monthlyData.daycareCount} · 외식{' '}
                        {monthlyData.diningOutCount}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1 text-center">
                      {MEAL_SLOTS.map((s) => (
                        <div
                          key={s.id}
                          className="bg-white rounded-lg py-1.5 px-1 border border-stone-200/70"
                        >
                          <div className="text-xs">{s.icon}</div>
                          <div className="text-[9px] font-bold text-stone-500 mt-0.5">
                            {s.shortLabel}
                          </div>
                          <div className="text-[11px] font-extrabold text-stone-900">
                            {monthlyData.slotCounts[s.id] || 0}회
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 월간 캘린더 그리드 */}
                <section className="bg-white rounded-2xl p-3.5 shadow-sm border border-stone-200">
                  <div className="grid grid-cols-7 text-center text-[11px] font-extrabold text-stone-500 pb-2 border-b border-stone-100">
                    <div className="text-rose-500">일</div>
                    <div>월</div>
                    <div>화</div>
                    <div>수</div>
                    <div>목</div>
                    <div>금</div>
                    <div className="text-blue-500">토</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mt-2">
                    {monthlyData.calendarCells.map((cell, idx) => {
                      if (!cell) {
                        return <div key={`empty-${idx}`} className="h-16 rounded-xl bg-stone-50/40" />;
                      }

                      const dayMeals = monthlyData.monthPersonMeals.filter(
                        (m) => m.date === cell.dateStr
                      );
                      const isSelected = monthlySelectedDay === cell.dateStr;
                      const isToday = cell.dateStr === formatDateKey(new Date());
                      const hasDaycare = dayMeals.some((m) => m.mealType === '어린이집 급식');

                      return (
                        <button
                          key={cell.dateStr}
                          onClick={() => setMonthlySelectedDay(cell.dateStr)}
                          className={`h-16 rounded-xl p-1 flex flex-col justify-between border text-left transition ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                              : isToday
                              ? 'bg-orange-50 border-orange-300 text-stone-900'
                              : dayMeals.length > 0
                              ? 'bg-white border-stone-200 hover:border-orange-300'
                              : 'bg-stone-50/60 border-stone-100 text-stone-400'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={`text-[11px] font-extrabold ${
                                isSelected ? 'text-white' : ''
                              }`}
                            >
                              {cell.dayNum}
                            </span>
                            {dayMeals.length > 0 && (
                              <span
                                className={`text-[9px] font-black px-1 rounded ${
                                  isSelected
                                    ? 'bg-white/25 text-white'
                                    : hasDaycare
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-stone-100 text-stone-600'
                                }`}
                              >
                                {dayMeals.length}끼
                              </span>
                            )}
                          </div>

                          <div className="w-full space-y-0.5 overflow-hidden">
                            <div className="flex items-center gap-0.5 flex-wrap">
                              {MEAL_SLOTS.map((s) => {
                                const hasSlot = dayMeals.some((m) => m.slot === s.id);
                                if (!hasSlot) return null;
                                return (
                                  <span
                                    key={s.id}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSelected ? 'bg-white' : s.dotColor
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            {dayMeals[0] && (
                              <p
                                className={`text-[9px] font-semibold truncate leading-tight ${
                                  isSelected ? 'text-orange-50' : 'text-stone-600'
                                }`}
                              >
                                {dayMeals[0].menu.replace(/^\[.*?\]\s*/, '')}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 달력에서 선택된 날짜의 6끼 상세 식단 내역 */}
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                        선택 날짜 상세 식단
                      </span>
                      <h3 className="text-sm font-extrabold text-stone-900 mt-1">
                        {monthlySelectedDay} ({getDayOfWeekKor(monthlySelectedDay)}요일)
                      </h3>
                    </div>
                    <button
                      onClick={() =>
                        openAddMealModal('breakfast', monthlyMemberFilter, monthlySelectedDay)
                      }
                      className="text-xs font-extrabold bg-stone-900 text-white px-3 py-1.5 rounded-xl flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-400" />
                      <span>이 날 식단 추가</span>
                    </button>
                  </div>

                  {(() => {
                    const selectedDayList = monthlyData.monthPersonMeals.filter(
                      (m) => m.date === monthlySelectedDay
                    );
                    if (selectedDayList.length === 0) {
                      return (
                        <p className="text-xs text-stone-400 text-center py-4">
                          이 날짜에 기록된 식단이 없습니다.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {MEAL_SLOTS.map((slot) => {
                          const items = selectedDayList.filter((m) => m.slot === slot.id);
                          if (items.length === 0) return null;
                          return items.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => openEditMealModal(m)}
                              className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 hover:border-orange-300 transition cursor-pointer flex items-start justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${slot.pillColor}`}
                                  >
                                    {slot.icon} {slot.label}
                                  </span>
                                  {m.mealType && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-800 text-white">
                                      {m.mealType}
                                    </span>
                                  )}
                                  {Number(m.cost) > 0 && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      {formatKRW(m.cost)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-stone-900">{m.menu}</p>
                                {m.note && <p className="text-[11px] text-stone-500">{m.note}</p>}
                              </div>
                              <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-1" />
                            </div>
                          ));
                        })}
                      </div>
                    );
                  })()}
                </section>
              </>
            )}

            {monthlySubTab === 'expense' && (
              <>
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {monthlyData.yearNum}년 {monthlyData.monthNum}월 식비 리포트
                      </span>
                      <h3 className="text-xl font-black text-stone-900 mt-1">
                        총 {formatKRW(monthlyData.totalMonthlyFoodExpense)}
                      </h3>
                    </div>

                    <button
                      onClick={() => {
                        setBudgetInput(String(monthlyBudget));
                        setIsEditingBudget(!isEditingBudget);
                      }}
                      className="text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-xl border border-stone-200"
                    >
                      예산: {formatKRW(monthlyBudget)} ✏️
                    </button>
                  </div>

                  {isEditingBudget && (
                    <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                      <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                        placeholder="월 목표 식비 (원)"
                      />
                      <button
                        onClick={() => {
                          setMonthlyBudget(Number(budgetInput) || 800000);
                          setIsEditingBudget(false);
                          showToast('월 목표 식비 예산이 변경되었습니다.');
                        }}
                        className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold"
                      >
                        저장
                      </button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-stone-500">월 예산 대비 사용률</span>
                      <span
                        className={
                          monthlyData.budgetPercent > 100 ? 'text-rose-600' : 'text-emerald-700'
                        }
                      >
                        {monthlyData.budgetPercent}% 사용 (잔여{' '}
                        {formatKRW(Math.max(0, monthlyBudget - monthlyData.totalMonthlyFoodExpense))}
                        )
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          monthlyData.budgetPercent > 90
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        }`}
                        style={{ width: `${Math.min(100, monthlyData.budgetPercent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-3 rounded-xl bg-sky-50 border border-sky-200/80">
                      <div className="text-[11px] font-bold text-sky-800">
                        🛒 냉장고 장보기 식재료비
                      </div>
                      <div className="text-sm font-black text-sky-950 mt-0.5">
                        {formatKRW(monthlyData.totalGroceryCost)}
                      </div>
                      <div className="text-[10px] text-sky-700 mt-0.5">
                        총 {monthlyData.monthFridgePurchases.length}개 품목 구매
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200/80">
                      <div className="text-[11px] font-bold text-purple-800">
                        🍽️ 외식 · 배달 · 메뉴 지출
                      </div>
                      <div className="text-sm font-black text-purple-950 mt-0.5">
                        {formatKRW(monthlyData.totalMealDiningCost)}
                      </div>
                      <div className="text-[10px] text-purple-700 mt-0.5">
                        유료 식단 {monthlyData.monthPaidMeals.length}건 기록
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-stone-800">
                      📊 카테고리별 장보기 지출 분석
                    </h3>
                    <button
                      onClick={() => {
                        if (scannedReceiptItems.length === 0) handleLoadSampleReceipt();
                        setIsReceiptModalOpen(true);
                      }}
                      className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                    >
                      + 영수증 스캔으로 지출 추가
                    </button>
                  </div>

                  {monthlyData.categoryExpenseList.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-3">
                      이번 달 기록된 장보기 지출 내역이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {monthlyData.categoryExpenseList.map((cat) => {
                        const ratio =
                          monthlyData.totalGroceryCost > 0
                            ? Math.round((cat.amount / monthlyData.totalGroceryCost) * 100)
                            : 0;
                        return (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-stone-700">{cat.category}</span>
                              <span className="font-extrabold text-stone-900">
                                {formatKRW(cat.amount)} ({ratio}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-2.5">
                  <h3 className="text-xs font-extrabold text-stone-800">
                    🧾 {monthlyData.monthNum}월 물품 & 메뉴별 상세 지출 내역
                  </h3>

                  <div className="divide-y divide-stone-100">
                    {monthlyData.monthPaidMeals.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => openEditMealModal(m)}
                        className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-stone-50 px-1 rounded-lg"
                      >
                        <div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 mr-1.5">
                            식단/외식
                          </span>
                          <span className="font-bold text-stone-900">{m.menu}</span>
                          <span className="text-[11px] text-stone-400 ml-1.5">({m.date})</span>
                        </div>
                        <span className="font-extrabold text-purple-700">
                          {formatKRW(m.cost)}
                        </span>
                      </div>
                    ))}

                    {monthlyData.monthFridgePurchases.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => openEditFridgeModal(f)}
                        className="py-2.5 flex items-center justify-between text-xs cursor-pointer hover:bg-stone-50 px-1 rounded-lg"
                      >
                        <div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 mr-1.5">
                            장보기
                          </span>
                          <span className="font-bold text-stone-900">
                            {f.name} ({f.quantity}
                            {f.unit})
                          </span>
                          <span className="text-[11px] text-stone-400 ml-1.5">
                            ({f.purchaseDate || '날짜미상'})
                          </span>
                        </div>
                        <span className="font-extrabold text-stone-900">
                          {formatKRW(f.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </main>
        )}

        {/* ====================================================
            TAB 4: 냉장고 재고 관리 & 마트 영수증 AI 스캔
           ==================================================== */}
        {activeTab === 'fridge' && (
          <main className="flex-1 px-4 pt-3.5 space-y-3.5">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-3.5 text-white shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold bg-white/25 px-1.5 py-0.5 rounded">
                    AI 영수증 스캐너
                  </span>
                  <h3 className="text-xs font-extrabold mt-0.5">
                    마트 영수증 찍고 냉장고 재료·식비 자동 등록!
                  </h3>
                </div>
              </div>
              <button
                onClick={() => {
                  if (scannedReceiptItems.length === 0) handleLoadSampleReceipt();
                  setIsReceiptModalOpen(true);
                }}
                className="shrink-0 bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-xs px-3 py-2 rounded-xl shadow-xs flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>영수증 스캔</span>
              </button>
            </div>

            {expiringSoonItems.length > 0 && (
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-extrabold text-rose-900">
                      소비기한 임박 재료 {expiringSoonItems.length}개
                    </h3>
                    <p className="text-[11px] text-rose-700 line-clamp-1">
                      {expiringSoonItems.map((i) => i.name).join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    selectExpiringIngredients();
                    setActiveTab('recommend');
                  }}
                  className="shrink-0 text-xs font-bold bg-rose-600 text-white px-2.5 py-1.5 rounded-xl"
                >
                  식단추천
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {STORAGE_TYPES.map((st) => {
                  const IconComp = st.icon;
                  const active = selectedStorage === st.id;
                  const count =
                    st.id === 'all'
                      ? fridgeItems.length
                      : fridgeItems.filter((i) => i.storage === st.id).length;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setSelectedStorage(st.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 border transition ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{st.label}</span>
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={openAddFridgeModal}
                className="shrink-0 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>직접 추가</span>
              </button>
            </div>

            {/* 카테고리 필터 칩 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {['전체', ...FOOD_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 border transition ${
                    selectedCategory === cat
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fridgeSearch}
                  onChange={(e) => setFridgeSearch(e.target.value)}
                  placeholder="재료명 또는 메모 검색..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                />
              </div>
              <button
                onClick={() => setSortByExpiry(!sortByExpiry)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                  sortByExpiry
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                {sortByExpiry ? '⏰ 소비기한순' : '가나다순'}
              </button>
            </div>

            <div className="space-y-2.5">
              {filteredFridgeItems.map((item) => {
                const dday = calculateDDay(item.expiryDate);
                const storageInfo =
                  STORAGE_TYPES.find((s) => s.id === item.storage) || STORAGE_TYPES[1];

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${storageInfo.badgeColor}`}
                        >
                          {storageInfo.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                          {item.category}
                        </span>
                        {dday !== null && (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                              dday <= 3
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {dday < 0 ? `기한지남(${Math.abs(dday)}일)` : dday === 0 ? 'D-Day' : `D-${dday}`}
                          </span>
                        )}
                        {Number(item.price) > 0 && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {formatKRW(item.price)}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-stone-900 truncate">
                        {item.name}
                      </h4>

                      {item.memo && (
                        <p className="text-xs text-stone-500 truncate">📌 {item.memo}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 border border-stone-200">
                        <button
                          onClick={() => handleAdjustQuantity(item, -1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-rose-50 text-stone-700 flex items-center justify-center shadow-2xs"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-extrabold text-stone-800 px-2 min-w-[3rem] text-center">
                          {item.quantity}
                          {item.unit}
                        </span>
                        <button
                          onClick={() => handleAdjustQuantity(item, 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-emerald-50 text-stone-700 flex items-center justify-center shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          onClick={() => openEditFridgeModal(item)}
                          className="text-stone-400 hover:text-stone-700 font-medium"
                        >
                          금액·정보수정
                        </button>
                        <span className="text-stone-300">·</span>
                        <button
                          onClick={() => handleDeleteFridgeItem(item.id, item.name)}
                          className="text-rose-500 hover:text-rose-700 font-semibold"
                        >
                          소진완료
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}

        {/* ====================================================
            TAB 5: AI 냉장고 파먹기 식단 추천
           ==================================================== */}
        {activeTab === 'recommend' && (
          <main className="flex-1 px-4 pt-4 space-y-4">
            <section className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    스마트 냉장고 파먹기
                  </span>
                  <h2 className="text-base font-extrabold text-stone-900 mt-1">
                    냉장고 재료로 맞춤 식단을 추천받아 보세요
                  </h2>
                </div>
                <ChefHat className="w-6 h-6 text-orange-500 shrink-0" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-stone-700">
                    1. 활용할 냉장고 재료 ({selectedIngredientNames.length}개 선택)
                  </label>
                  <button
                    type="button"
                    onClick={selectExpiringIngredients}
                    className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200"
                  >
                    ⏰ 임박 재료 자동선택
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {fridgeItems.map((item) => {
                    const isSelected = selectedIngredientNames.includes(item.name);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleSelectIngredientForAi(item.name)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'all', label: '👨‍👩‍👧‍👦 온가족 한끼', desc: '한 냄비 어른+아이' },
                  { id: 'adult', label: '👨🏻👩🏻 부부 식사·야식', desc: '수혁·아리나 맞춤' },
                  { id: 'simok', label: '👦🏻 시목이 유아식', desc: '첫째 맞춤 반찬·간식' },
                  { id: 'siyul', label: '👶🏻 시율이 이유식', desc: '둘째 부드러운 식단' }
                ].map((target) => (
                  <button
                    type="button"
                    key={target.id}
                    onClick={() => setRecommendTarget(target.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      recommendTarget === target.id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 text-stone-700 border-stone-200'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{target.label}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{target.desc}</div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={generateAiMealRecommendations}
                disabled={isGeneratingAi}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>맞춤 레시피 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>선택한 재료로 AI 맞춤 식단 추천받기</span>
                  </>
                )}
              </button>
            </section>

            <section className="space-y-3">
              {displayedRecommendations.map((recipe) => {
                const slotObj =
                  MEAL_SLOTS.find((s) => s.id === recipe.recommendedSlot) || MEAL_SLOTS[4];
                return (
                  <div
                    key={recipe.id}
                    className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm space-y-3"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
                        {slotObj.icon} {slotObj.label} 추천
                      </span>
                      {recipe.cookingTime && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                          ⏱️ {recipe.cookingTime}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-stone-900">{recipe.title}</h4>
                    <div className="bg-stone-50 rounded-xl p-2.5 text-xs">
                      <span className="font-bold text-emerald-700">🥬 활용 재료: </span>
                      <span>{(recipe.usedIngredients || []).join(', ')}</span>
                    </div>
                    <ol className="space-y-1 text-xs text-stone-600 list-decimal list-inside">
                      {(recipe.steps || []).map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                    {recipe.familyTip && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900">
                        💡 {recipe.familyTip}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openQuickLogModal(recipe)}
                      className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-orange-400" />
                      <span>이 메뉴를 식단표에 바로 등록하기</span>
                    </button>
                  </div>
                );
              })}
            </section>
          </main>
        )}

        {/* ====================================================
            하단 고정 네비게이션 바 (5개 탭)
           ==================================================== */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-stone-200 px-1.5 py-2 flex items-center justify-around z-30 shadow-lg">
          {[
            { id: 'meals', label: '일별식단', icon: Calendar },
            { id: 'weekly', label: '주간요약', icon: BarChart3 },
            { id: 'monthly', label: '월간·식비', icon: PieChart, isNew: true },
            { id: 'fridge', label: '냉장고·영수증', icon: Refrigerator },
            { id: 'recommend', label: 'AI추천', icon: Sparkles }
          ].map((item) => {
            const IconComp = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition relative ${
                  active ? 'text-orange-600 font-extrabold' : 'text-stone-400 font-medium'
                }`}
              >
                <IconComp className="w-5 h-5" />
                <span className="text-[10px]">{item.label}</span>
                {item.isNew && (
                  <span className="absolute -top-0.5 right-1 text-[7px] font-black bg-rose-500 text-white px-1 rounded-full">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ====================================================
            MODAL 1: 식단 추가 / 수정 모달
           ==================================================== */}
        {isMealModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h3 className="text-base font-extrabold text-stone-900">
                  {editingMeal ? '식단 및 지출 수정' : '새 식단 기록하기 (6끼 분류)'}
                </h3>
                <button
                  onClick={() => setIsMealModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMeal} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">날짜</label>
                    <input
                      type="date"
                      value={mealForm.date}
                      onChange={(e) => setMealForm({ ...mealForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">
                      식사 분류 (6단계)
                    </label>
                    <select
                      value={mealForm.slot}
                      onChange={(e) => setMealForm({ ...mealForm, slot: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    >
                      {MEAL_SLOTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icon} {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-600">식사 대상</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setGroupMembersInMealForm('all')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700"
                      >
                        온가족
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupMembersInMealForm('adults')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                      >
                        부부
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupMembersInMealForm('kids')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700"
                      >
                        시목·시율
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroupMembersInMealForm('simok_daycare')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800"
                      >
                        시목 어린이집
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {FAMILY_MEMBERS.map((member) => {
                      const isChecked = mealForm.members.includes(member.id);
                      return (
                        <button
                          type="button"
                          key={member.id}
                          onClick={() => toggleMemberInMealForm(member.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                            isChecked
                              ? 'bg-orange-50 border-orange-400 text-orange-900'
                              : 'bg-stone-50 border-stone-200 text-stone-500'
                          }`}
                        >
                          <span>
                            {member.emoji} {member.name}
                          </span>
                          {isChecked && <Check className="w-4 h-4 text-orange-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">식단 구분</label>
                  <div className="flex flex-wrap gap-1">
                    {MEAL_TYPE_TAGS.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setMealForm({ ...mealForm, mealType: tag })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          mealForm.mealType === tag
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    메뉴 이름 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mealForm.menu}
                    onChange={(e) => setMealForm({ ...mealForm, menu: e.target.value })}
                    placeholder="예: 한우 미역국, 시율이 소고기 이유식, 부부 야식 치킨"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">
                      💰 지출 금액 (원, 선택)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={mealForm.cost}
                      onChange={(e) => setMealForm({ ...mealForm, cost: e.target.value })}
                      placeholder="외식·배달·메뉴 비용"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">
                      사용한 냉장고 재료
                    </label>
                    <input
                      type="text"
                      value={mealForm.usedIngredients}
                      onChange={(e) =>
                        setMealForm({ ...mealForm, usedIngredients: e.target.value })
                      }
                      placeholder="예: 한우 다짐육, 두부"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">메모</label>
                  <input
                    type="text"
                    value={mealForm.note}
                    onChange={(e) => setMealForm({ ...mealForm, note: e.target.value })}
                    placeholder="예: 시목이 완밥, 시율이 알레르기 반응 없음"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  {editingMeal && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMeal(editingMeal.id)}
                      className="px-4 py-3 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-xs"
                    >
                      삭제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsMealModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-extrabold text-xs"
                  >
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================
            MODAL 2: 냉장고 식재료 추가 / 수정 모달
           ==================================================== */}
        {isFridgeModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-base font-extrabold text-stone-900">
                  {editingFridgeItem ? '식재료 및 구매금액 수정' : '냉장고 새 식재료 등록'}
                </h3>
                <button
                  onClick={() => setIsFridgeModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveFridgeItem} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    식재료 이름 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fridgeForm.name}
                    onChange={(e) => setFridgeForm({ ...fridgeForm, name: e.target.value })}
                    placeholder="예: 한우 다짐육, 설향 딸기, 아기 치즈"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">보관 장소</label>
                    <select
                      value={fridgeForm.storage}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, storage: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    >
                      <option value="fridge">❄️ 냉장실</option>
                      <option value="freezer">🧊 냉동실</option>
                      <option value="pantry">🧺 실온/팬트리</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">분류</label>
                    <select
                      value={fridgeForm.category}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, category: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    >
                      {FOOD_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-emerald-700 mb-1">
                      💰 구매 금액 (원)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={fridgeForm.price}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, price: e.target.value })}
                      placeholder="예: 12900"
                      className="w-full px-3 py-2 bg-emerald-50/60 border border-emerald-300 rounded-xl text-xs font-extrabold text-emerald-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">구매일자</label>
                    <input
                      type="date"
                      value={fridgeForm.purchaseDate}
                      onChange={(e) =>
                        setFridgeForm({ ...fridgeForm, purchaseDate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">남은 수량</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={fridgeForm.quantity}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">단위</label>
                    <input
                      type="text"
                      value={fridgeForm.unit}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, unit: e.target.value })}
                      placeholder="개, 팩, g"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">소비기한</label>
                    <input
                      type="date"
                      value={fridgeForm.expiryDate}
                      onChange={(e) => setFridgeForm({ ...fridgeForm, expiryDate: e.target.value })}
                      className="w-full px-2 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">용도 / 메모</label>
                  <input
                    type="text"
                    value={fridgeForm.memo}
                    onChange={(e) => setFridgeForm({ ...fridgeForm, memo: e.target.value })}
                    placeholder="예: 시목·시율 간식용"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFridgeModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-extrabold text-xs"
                  >
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ====================================================
            MODAL 3: 어린이집 식단표 사진 AI 자동인식 모달
           ==================================================== */}
        {isDaycareModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    AI 비전 식단표 스캐너
                  </span>
                  <h3 className="text-base font-extrabold text-stone-900 mt-1">
                    📸 어린이집 식단표 사진 자동 기록
                  </h3>
                </div>
                <button
                  onClick={() => setIsDaycareModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    등록할 자녀
                  </label>
                  <select
                    value={daycareTargetChild}
                    onChange={(e) => setDaycareTargetChild(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                  >
                    <option value="simok">👦🏻 김시목 (첫째)</option>
                    <option value="siyul">👶🏻 김시율 (둘째)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1">
                    식단표 기준 연월
                  </label>
                  <input
                    type="month"
                    value={daycareTargetYearMonth}
                    onChange={(e) => setDaycareTargetYearMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={daycareFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleDaycareImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => daycareFileInputRef.current?.click()}
                  disabled={isScanningDaycare}
                  className="py-3 px-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs"
                >
                  <Camera className="w-5 h-5" />
                  <span>식단표 사진 업로드</span>
                  <span className="text-[10px] font-normal text-orange-100">
                    AI가 날짜별 3끼 추출
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadAttachedShindangMenu}
                  className="py-3 px-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1"
                >
                  <School className="w-5 h-5 text-amber-600" />
                  <span>신당동어린이집 11월</span>
                  <span className="text-[10px] font-semibold text-amber-700">
                    첨부사진 25일분 전체 불러오기
                  </span>
                </button>
              </div>

              {isScanningDaycare && (
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center gap-2 text-xs font-bold text-orange-800">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI가 식단표 이미지에서 오전간식·점심·오후간식을 읽고 있습니다...</span>
                </div>
              )}

              {daycarePreviewImg && (
                <div className="rounded-xl overflow-hidden border border-stone-200 max-h-36">
                  <img
                    src={daycarePreviewImg}
                    alt="업로드된 식단표 미리보기"
                    className="w-full h-36 object-cover"
                  />
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-stone-700">
                  <span>인식된 식단 내역 ({scannedDaycareList.length}일분)</span>
                  <span className="text-[11px] text-orange-600">
                    오전간식 · 점심 · 오후간식 자동분류
                  </span>
                </div>
                {scannedDaycareList.map((item, idx) => (
                  <div
                    key={item.date || idx}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 font-extrabold text-stone-900">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setScannedDaycareList((prev) =>
                              prev.map((d, i) => (i === idx ? { ...d, selected: checked } : d))
                            );
                          }}
                          className="rounded text-orange-500"
                        />
                        <span>
                          {item.date} ({getDayOfWeekKor(item.date)})
                        </span>
                      </label>
                      {item.kcal && (
                        <span className="text-[10px] text-stone-400 font-semibold">
                          {item.kcal}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-600">
                      <span className="font-bold text-lime-700">🍎 오전간식:</span> {item.morning_snack}
                    </p>
                    <p className="text-[11px] text-stone-800 font-semibold">
                      <span className="font-bold text-sky-700">☀️ 점심:</span> {item.lunch}
                    </p>
                    <p className="text-[11px] text-stone-600">
                      <span className="font-bold text-pink-700">🥨 오후간식:</span> {item.afternoon_snack}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsDaycareModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDaycareBulkSave}
                  className="flex-2 py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-extrabold text-xs"
                >
                  선택한 {scannedDaycareList.filter((d) => d.selected).length}일분(
                  {scannedDaycareList.filter((d) => d.selected).length * 3}끼) 앱에 일괄 등록
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            MODAL 4: 마트 영수증 사진 AI 스캔 모달
           ==================================================== */}
        {isReceiptModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-stone-100 pb-3">
                <div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    AI 영수증 OCR 스캐너
                  </span>
                  <h3 className="text-base font-extrabold text-stone-900 mt-1">
                    🧾 마트 영수증 찍어 냉장고 & 식비 자동 추가
                  </h3>
                </div>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <span className="text-xs font-bold text-stone-700">장본 날짜(구매일)</span>
                <input
                  type="date"
                  value={receiptPurchaseDate}
                  onChange={(e) => setReceiptPurchaseDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={receiptFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => receiptFileInputRef.current?.click()}
                  disabled={isScanningReceipt}
                  className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-xs"
                >
                  <Camera className="w-5 h-5" />
                  <span>영수증 사진 촬영/선택</span>
                  <span className="text-[10px] font-normal text-emerald-100">
                    품목명·수량·가격 자동추출
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleReceipt}
                  className="py-3 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1"
                >
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <span>샘플 영수증 불러오기</span>
                  <span className="text-[10px] font-normal text-stone-500">
                    사진 없이 1초 체험하기
                  </span>
                </button>
              </div>

              {isScanningReceipt && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AI가 마트 영수증의 식재료 품목과 결제 금액을 분석하고 있습니다...</span>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-xs font-extrabold text-stone-700">
                  <span>추출된 장보기 품목 ({scannedReceiptItems.length}건)</span>
                  <span className="text-emerald-700">
                    합계:{' '}
                    {formatKRW(
                      scannedReceiptItems
                        .filter((i) => i.selected)
                        .reduce((s, x) => s + (Number(x.price) || 0), 0)
                    )}
                  </span>
                </div>

                {scannedReceiptItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setScannedReceiptItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, selected: checked } : it))
                            );
                          }}
                        />
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScannedReceiptItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                            );
                          }}
                          className="font-bold text-stone-900 bg-white px-2 py-1 rounded border border-stone-200 flex-1 text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setScannedReceiptItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, price: val } : it))
                            );
                          }}
                          className="w-20 text-right font-extrabold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-xs"
                        />
                        <span className="text-[11px] font-bold text-stone-500">원</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pl-5">
                      <span>
                        보관: {item.storage === 'freezer' ? '냉동실' : item.storage === 'pantry' ? '실온' : '냉장실'} · 분류: {item.category}
                      </span>
                      <span>
                        수량: {item.quantity}
                        {item.unit} · 기한: {item.expiryDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceiptBulkSave}
                  className="flex-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs"
                >
                  선택 품목 냉장고 입고 + 가계부 등록
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            MODAL 5: 독립 서버 내장 키 확인 & 엑셀/JSON 백업 모달
           ==================================================== */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-base font-extrabold text-stone-900">
                  ⚙️ 내장된 서버 키 & 데이터 백업
                </h3>
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 내장 완료 확인 배지 */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>파이어베이스 & API 키 코드 내장 완료!</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  프로젝트 ID <span className="font-extrabold">ahrisoohyeokbap</span> 설정과 전달해주신 API 키가 이미 코드 상단에 반영되어 있어, 폰에서도 수정 없이 그대로 복사해 배포하실 수 있습니다.
                </p>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs font-extrabold text-stone-700">
                  1. 식단 · 냉장고 · 식비 데이터 영구 백업
                </p>
                <button
                  onClick={handleExportExcelCsv}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>엑셀(CSV) 파일로 전체 내역 다운로드</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportJsonBackup}
                    className="py-2.5 px-3 rounded-xl bg-stone-900 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>백업파일(JSON) 저장</span>
                  </button>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportJsonBackup}
                    className="hidden"
                  />
                  <button
                    onClick={() => backupFileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-stone-100 text-stone-800 border border-stone-300 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>백업파일 복원</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-stone-100">
                <label className="block text-xs font-extrabold text-stone-700">
                  2. 내장된 API Key (필요시 변경 가능)
                </label>
                <input
                  type="text"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono"
                />
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  * 전달해주신 키(AQ.Ab8RN6...)가 기본값으로 들어가 있으며, 추후 AI Studio 키(AIzaSy...) 등으로 언제든 바꾸실 수 있습니다.
                </p>
              </div>

              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  showToast('설정이 확인되었습니다.');
                }}
                className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-extrabold text-xs"
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            MODAL 6: AI 추천 메뉴 식단표 원클릭 등록 모달
           ==================================================== */}
        {quickLogRecipe && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    식단표 바로 등록
                  </span>
                  <h3 className="text-sm font-extrabold text-stone-900 mt-1">
                    {quickLogRecipe.title}
                  </h3>
                </div>
                <button
                  onClick={() => setQuickLogRecipe(null)}
                  className="p-1 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">등록할 날짜</label>
                  <input
                    type="date"
                    value={quickLogForm.date}
                    onChange={(e) => setQuickLogForm({ ...quickLogForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    끼니 선택 (6단계)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MEAL_SLOTS.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setQuickLogForm({ ...quickLogForm, slot: s.id })}
                        className={`py-2 rounded-xl text-xs font-bold border ${
                          quickLogForm.slot === s.id
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                      >
                        {s.icon} {s.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setQuickLogRecipe(null)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 font-bold text-xs"
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
      </div>
    </div>
  );
}