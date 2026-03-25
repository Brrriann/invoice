import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { logSecureError, getUserFriendlyError } from './lib/secureLogger';
import { selectSecure, insertSecure, updateSecure, deleteSecure, upsertSecure } from './lib/supabaseSecure';
import './App.css';
import React from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import LandingPage from './pages/LandingPage';

// --- 인터페이스 정의 ---
interface Item {
  id: string;
  type: 'door' | 'option';
  name: string;
  unit: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  specialNote: string;
  remarks: string;
}

interface Project {
  id: string;
  created_at: string;
  user_id: string;
  site_name: string;
  customer_name: string;
  total_amount: number;
  invoice_date: string;
  invoice_status: '미발급' | '발급완료';
  payment_date: string;
  payment_status: '미수금' | '일부수금' | '완료';
  notes: string;
  biz_name: string;
  biz_owner: string;
  biz_address: string;
  biz_type: string;
  biz_item: string;
  biz_email: string;
  biz_no: string;
}

interface WorkItem {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  type: '실측' | '시공';
  start_date: string;
  end_date: string;
  status: '실측예정' | '실측 후 대기' | '시공확정' | '시공중' | '완료';
}

interface Subcontract {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  amount: number;
  invoice_issued: boolean;
  payment_done: boolean;
  start_date: string;
  end_date: string;
}

interface SavedQuotation {
  id: string;
  created_at: string;
  items: Item[];
  provider: typeof initialProvider;
  customer: typeof initialCustomer;
  quoteNumber: string;
  greeting: string;
  remarks: string;
}

interface InteriorSpace {
  id: string;
  name: string;
  width: string;
  depth: string;
  height: string;
  window: string;
  doorInfo: string;
  floorCurrent: string;
  floorPlan: string;
  wallCurrent: string;
  wallPlan: string;
  ceilCurrent: string;
  ceilPlan: string;
  notes: string;
  photos: string[];
}

interface WorkChecklist {
  demolition: boolean;
  flooring: boolean;
  wallpaper: boolean;
  carpentry: boolean;
  electric: boolean;
  plumbing: boolean;
  tile: boolean;
  lighting: boolean;
  furniture: boolean;
  etc: boolean;
  etcNote: string;
}

interface SavedMeasurement {
  id: string;
  created_at: string;
  site_name: string;
  customer_name: string;
  contact: string;
  address: string;
  date: string;
  measurer: string;
  doors: InteriorSpace[];
  options: WorkChecklist;
  power_source: string;
  floor_condition: string;
  special_notes: string;
}

// --- 홈택스 엑셀 설정 ---
interface InvoiceExportSettings {
  issueDate: string;
  taxType: '01' | '02';
  purposeType: '01' | '02';
  itemName: string;
  supplierBizNo: string;
  supplierName: string;
  supplierOwner: string;
  supplierEmail: string;
  supplierType: string;
  supplierItem: string;
  supplierAddress: string;
}

const defaultInvoiceExportSettings: InvoiceExportSettings = {
  issueDate: new Date().toISOString().split('T')[0],
  taxType: '01',
  purposeType: '02',
  itemName: '인테리어 공사',
  supplierBizNo: '', supplierName: '', supplierOwner: '',
  supplierEmail: '', supplierType: '', supplierItem: '', supplierAddress: '',
};

const PROJECT_COLORS = [
  { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#fef3c7', text: '#78350f', border: '#fcd34d' },
  { bg: '#ede9fe', text: '#4c1d95', border: '#c4b5fd' },
  { bg: '#ffedd5', text: '#7c2d12', border: '#fdba74' },
  { bg: '#e0f2fe', text: '#0c4a6e', border: '#7dd3fc' },
  { bg: '#fdf4ff', text: '#701a75', border: '#e879f9' },
  { bg: '#ecfdf5', text: '#064e3b', border: '#34d399' },
  { bg: '#fff1f2', text: '#881337', border: '#fda4af' },
  { bg: '#f0fdf4', text: '#166534', border: '#4ade80' },
  { bg: '#fafafa', text: '#27272a', border: '#a1a1aa' },
];

const getProjectColor = (projectId: string) => {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = projectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
};

const initialProvider = {
  name: '',
  brandTagline: '',
  representative: '',
  address: '',
  contact: '',
  businessNo: ''
};

const initialCustomer = {
  name: '',
  contact: '',
  date: new Date().toISOString().split('T')[0]
};

// --- 날짜 포맷팅 헬퍼 함수 ---
const formatDateToMMDD = (dateStr: string): string => {
  if (!dateStr) return '';
  return dateStr.slice(5); // YYYY-MM-DD → MM-DD
};

function App() {
  // --- 인증 관련 상태 ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [authInputs, setAuthViewInputs] = useState({ email: '', password: '', confirmPassword: '', phone: '' });
  const [newPassword, setNewPassword] = useState({ password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);

  // --- 메인 앱 상태 ---
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', company: '', phone: '', email: '', type: '그룹웨어', message: '' });
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [view, setView] = useState<'quotation' | 'measurement' | 'dashboard' | 'blog'>('dashboard');
  const [dashboardMode, setDashboardMode] = useState<'list' | 'calendar' | 'invoice'>('list');
  const [invoiceFilter, setInvoiceFilter] = useState<'전체' | '미발급' | '발급완료'>('전체');
  const [searchProject, setSearchProject] = useState('');

  // AI 블로그 상태
  const [blogData, setBlogData] = useState({
    siteName: '',
    style: '모던 화이트',
    features: '',
    materials: '',
    tone: '전문적이고 신뢰감 있는',
    role: '10년 차 베테랑 인테리어 실장',
    isGenerating: false,
    result: ''
  });

  // Google API 키 관리
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // 인쇄용 사진 base64 변환 캐시
  const [printPhotosBase64, setPrintPhotosBase64] = useState<Record<string, Record<number, string>>>({});

  // 사진 업로드 진행률 및 상태 관리
  const [uploadProgress, setUploadProgress] = useState<{ [spaceId: string]: number }>({});
  const [isUploading, setIsUploading] = useState<{ [spaceId: string]: boolean }>({});

  const generateBlogPost = async () => {
    if (!blogData.siteName || !blogData.features) {
      alert('현장명과 핵심 시공 내용을 입력해주세요.');
      return;
    }

    if (!googleApiKey) {
      setShowApiKeyInput(true);
      alert('먼저 Google API 키를 설정해주세요.');
      return;
    }

    setBlogData(prev => ({ ...prev, isGenerating: true }));

    try {
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const prompt = `
        너는 ${blogData.role}이야. 아래 정보를 바탕으로 네이버 블로그 포스팅을 작성해줘.

        현장명: ${blogData.siteName}
        스타일: ${blogData.style}
        내용: ${blogData.features}
        자재: ${blogData.materials}
        문체: ${blogData.tone}

        중요 지침:
        1. 절대로 ** 기호를 사용해서 단어를 강조하지 마. 마크다운 형식을 사용하지 말고 자연스러운 글로 작성해줘.
        2. 체류시간 3분 이상을 목표로 작성해줘 (충분히 길고 밀도있는 글).
        3. 너무 짧은 글은 절대 금지. 각 항목에 대해 상세한 설명과 충분한 내용을 포함해야 해.
        4. 시공 과정, 선택 이유, 자재의 특징, 시공 후 느낌 등 다양한 각도에서 설명해줘.
        5. 독자가 충분히 읽을 수 있도록 여러 문단으로 구성하고 단락을 나눠서 작성해줘.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setBlogData(prev => ({ ...prev, result: text, isGenerating: false }));
    } catch (error: unknown) {
      // 🔒 보안 로깅: 민감정보 제외
      logSecureError('BLOG_GENERATION_ERROR', error, currentUser?.id, 'error');

      // 사용자 친화적 메시지
      const userMessage = getUserFriendlyError(error);
      alert(userMessage);

      setBlogData(prev => ({ ...prev, isGenerating: false }));
    }
  };  const [items, setItems] = useState<Item[]>([
    { id: '1', type: 'door', name: '', unit: 'SET', width: 0, height: 0, quantity: 1, unitPrice: 0, specialNote: '', remarks: '' }
  ]);
  const [provider, setProvider] = useState(initialProvider);
  const [customer, setCustomer] = useState(initialCustomer);
  const [quoteNumber, setQuoteNumber] = useState(`SD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-01`);
  const [greeting, setGreeting] = useState('최저가보다는 최고 효율의 합리적인 견적을 \n아래와 같이 제출하오니, 긍정적인 검토 부탁드립니다.');
  const [remarks, setRemarks] = useState('※ 납기일: 발주 후 30일 이내\n※ 결제조건: 선금 50%, 잔금 설치 후 즉시\n※ 부가세 포함 금액입니다.');
  
  const [savedQuotations, setSavedQuotations] = useState<SavedQuotation[]>([]);
  const [savedMeasurements, setSavedMeasurements] = useState<SavedMeasurement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [companyIntro, setCompanyIntro] = useState('');
  const [showIntroInPrint, setShowIntroInPrint] = useState(false);
  const [expandedBizInfo, setExpandedBizInfo] = useState<Set<string>>(new Set());
  const [invoiceExportSettings, setInvoiceExportSettings] = useState<InvoiceExportSettings>(() => {
    try {
      const saved = localStorage.getItem('invoiceExportSettings');
      return saved ? { ...defaultInvoiceExportSettings, ...JSON.parse(saved) } : defaultInvoiceExportSettings;
    } catch { return defaultInvoiceExportSettings; }
  });
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [ocrLoading, setOcrLoading] = useState<Record<string, boolean>>({});
  const [ocrPickerId, setOcrPickerId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuotation, setSearchQuotation] = useState('');
  const [searchMeasurement, setSearchMeasurement] = useState('');

  // --- 실측 템플릿 관련 상태 ---
  const defaultChecklist: WorkChecklist = {
    demolition: false, flooring: false, wallpaper: false, carpentry: false,
    electric: false, plumbing: false, tile: false, lighting: false, furniture: false,
    etc: false, etcNote: ''
  };
  const [measureData, setMeasureData] = useState({
    siteName: '',
    customerName: '',
    contact: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    measurer: '',
    spaces: [
      { id: 's1', name: '거실', width: '', depth: '', height: '', window: '', doorInfo: '', floorCurrent: '', floorPlan: '', wallCurrent: '', wallPlan: '', ceilCurrent: '', ceilPlan: '', notes: '', photos: [] }
    ] as InteriorSpace[],
    checklist: { ...defaultChecklist } as WorkChecklist,
    specialNotes: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('reset');
      }
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);



  // --- 회사 프로필 ---
  const fetchCompanyProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('company_profiles', currentUser.id, { single: true });
      if (data) {
        setProvider({ name: data.name || '', brandTagline: data.brandTagline || '', representative: data.representative || '', businessNo: data.businessNo || '', address: data.address || '', contact: data.contact || '' });
        if (data.company_intro) setCompanyIntro(data.company_intro);
      }
    } catch (error) {
      logSecureError('FETCH_COMPANY_PROFILE', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setProvider]);

  const saveCompanyProfile = async () => {
    if (!currentUser) return;
    try {
      await upsertSecure('company_profiles', currentUser.id, {
        name: provider.name,
        brand_tagline: provider.brandTagline,
        representative: provider.representative,
        business_no: provider.businessNo,
        address: provider.address,
        contact: provider.contact,
        updated_at: new Date().toISOString()
      });
      alert('공급자정보가 저장되었습니다.\n견적서 저장은 아래의 클라우드저장 버튼을 눌러주세요!');
    } catch (error) {
      logSecureError('PROFILE_SAVE', error, currentUser?.id, 'error');
      alert(getUserFriendlyError(error));
    }
  };

  const saveCompanyIntro = async () => {
    if (!currentUser) {
      alert('로그인 후 저장할 수 있습니다.');
      return;
    }
    if (!companyIntro.trim()) {
      alert('자사 소개 내용을 입력해주세요.');
      return;
    }
    try {
      await upsertSecure('company_profiles', currentUser.id, {
        company_intro: companyIntro,
        updated_at: new Date().toISOString()
      });
      alert('자사 소개가 저장되었습니다.');
    } catch (error) {
      logSecureError('INTRO_SAVE', error, currentUser?.id, 'error');
      alert(getUserFriendlyError(error));
    }
  };

  const handleApiKeySubmit = () => {
    if (!apiKeyInput.trim()) {
      alert('API 키를 입력해주세요.');
      return;
    }
    setGoogleApiKey(apiKeyInput.trim());
    setShowApiKeyInput(false);
    setApiKeyInput('');
    alert('API 키가 설정되었습니다. (이 세션 동안만 유지됩니다)');
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return key;
    return key.substring(0, 6) + '...' + key.substring(key.length - 3);
  };

  // --- DB 로직 (대시보드/프로젝트) ---
  const fetchProjects = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('projects', currentUser.id);
      if (data) setProjects(data);
    } catch (error) {
      logSecureError('FETCH_PROJECTS', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setProjects]);

  const fetchWorkItems = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('work_items', currentUser.id);
      if (data) setWorkItems(data);
    } catch (error) {
      logSecureError('FETCH_WORKITEMS', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setWorkItems]);

  const fetchSubcontracts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('subcontracts', currentUser.id);
      if (data) setSubcontracts(data);
    } catch (error) {
      logSecureError('FETCH_SUBCONTRACTS', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setSubcontracts]);

  const createSubcontractFromWorkItem = async (projectId: string, workItem: WorkItem) => {
    if (!currentUser) return;
    try {
      await insertSecure('subcontracts', currentUser.id, {
        project_id: projectId,
        label: workItem.label,
        amount: 0,
        invoice_issued: false,
        payment_done: false,
        start_date: workItem.start_date,
        end_date: workItem.end_date
      });
      // 원본 공정 삭제
      await deleteWorkItem(workItem.id);
      await fetchSubcontracts();
    } catch (error) {
      logSecureError('CREATE_SUBCONTRACT', error, currentUser?.id, 'error');
      // 외주 섹션으로 스크롤
      const subSection = document.querySelector('.sub-cards-grid');
      if (subSection) {
        setTimeout(() => subSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  };

  const updateSubcontract = useCallback(async (id: string, field: keyof Subcontract, value: string | number | boolean) => {
    if (!currentUser) return;
    setSubcontracts(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, [field]: value };
        // 시작일을 변경했는데 종료일이 없으면 시작일과 동일하게 설정
        if (field === 'start_date' && value && !s.end_date) {
          updated.end_date = value as string;
          // DB에도 함께 업데이트
          updateSecure('subcontracts', currentUser.id, id, { end_date: value as string }).catch(e =>
            logSecureError('SUBCONTRACT_UPDATE', e, currentUser?.id, 'warning')
          );
        }
        return updated;
      }
      return s;
    }));
    // label은 한글 입력 완료 후에만 DB 저장 (onCompositionEnd에서 호출)
    if (field !== 'label') {
      try {
        await updateSecure('subcontracts', currentUser.id, id, { [field]: value });
      } catch (error) {
        logSecureError('SUBCONTRACT_UPDATE', error, currentUser?.id, 'warning');
      }
    }
  }, [currentUser, setSubcontracts]);

  const saveSubcontractLabel = async (id: string, value: string) => {
    if (!value.trim() || !currentUser) return;
    try {
      await updateSecure('subcontracts', currentUser.id, id, { label: value });
    } catch (error) {
      logSecureError('SUBCONTRACT_UPDATE', error, currentUser?.id, 'error');
      alert('외주 공정명 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const deleteSubcontract = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteSecure('subcontracts', currentUser.id, id);
      setSubcontracts(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      logSecureError('SUBCONTRACT_DELETE', error, currentUser?.id, 'error');
    }
  };

  const addProject = async () => {
    if (!currentUser) return;
    const siteName = prompt('신규 현장명을 입력하세요:');
    if (!siteName) return;
    try {
      await insertSecure('projects', currentUser.id, {
        site_name: siteName,
        customer_name: '',
        total_amount: 0,
        invoice_status: '미발급',
        payment_status: '미수금',
        biz_name: '',
        biz_owner: '',
        biz_address: '',
        biz_type: '',
        biz_item: '',
        biz_email: '',
        biz_no: ''
      });
      fetchProjects();
    } catch (error) {
      logSecureError('PROJECT_INSERT', error, currentUser?.id, 'error');
      alert('현장 생성 실패했습니다. 다시 시도해주세요.');
    }
  };

  const addWorkItem = async (projectId: string, count: number) => {
    if (!currentUser) return;
    try {
      await insertSecure('work_items', currentUser.id, {
        project_id: projectId,
        label: `공정${count + 1}`,
        type: '시공',
        start_date: '',
        end_date: '',
        status: '실측예정'
      });
      fetchWorkItems();
    } catch (error) {
      logSecureError('WORKITEM_INSERT', error, currentUser?.id, 'error');
    }
  };

  const updateWorkItem = useCallback(async (id: string, field: string, value: string) => {
    setWorkItems(prev => prev.map(w => {
      if (w.id === id) {
        const updated = { ...w, [field]: value };
        // 시작일을 변경했는데 종료일이 없으면 시작일과 동일하게 설정
        if (field === 'start_date' && value && !w.end_date) {
          updated.end_date = value;
          if (currentUser) {
            updateSecure('work_items', currentUser.id, id, { end_date: value }).catch(error => {
              logSecureError('WORKITEM_UPDATE', error, currentUser?.id, 'warning');
            });
          }
        }
        return updated;
      }
      return w;
    }));
    // label은 한글 입력 완료 후에만 DB 저장 (onCompositionEnd에서 호출)
    if (field !== 'label' && currentUser) {
      updateSecure('work_items', currentUser.id, id, { [field]: value }).catch(error => {
        logSecureError('WORKITEM_UPDATE', error, currentUser?.id, 'warning');
      });
    }
  }, [setWorkItems, currentUser]);

  const saveWorkItemLabel = async (id: string, value: string) => {
    if (!value.trim() || !currentUser) return; // 비어있으면 저장하지 않음
    try {
      await updateSecure('work_items', currentUser.id, id, { label: value });
    } catch (error) {
      logSecureError('WORKITEM_UPDATE', error, currentUser?.id, 'warning');
      alert('공정명 저장 실패했습니다. 다시 시도해주세요.');
    }
  };

  const deleteWorkItem = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteSecure('work_items', currentUser.id, id);
      setWorkItems(prev => prev.filter(w => w.id !== id));
    } catch (error) {
      logSecureError('WORKITEM_DELETE', error, currentUser?.id, 'error');
      alert('공정 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const exportFilteredProjectsToExcel = (filteredProjects: Project[]) => {
    if (filteredProjects.length === 0) { alert("출력할 데이터가 없습니다."); return; }
    const s = invoiceExportSettings;
    const issueDateStr = s.issueDate.replace(/-/g, '');
    const issueDay = s.issueDate.split('-')[2] || '01';

    const hometaxHeaders = [
      '전자(세금)계산서 종류(01:일반,02:영세율)', '작성일자(YYYYMMDD)',
      '공급자 등록번호', '공급자 종사업장번호', '공급자 상호', '공급자 성명',
      '공급자 사업장주소', '공급자 업태', '공급자 종목', '공급자 이메일',
      '공급받는자 등록번호', '공급받는자 종사업장번호', '공급받는자 상호',
      '공급받는자 성명', '공급받는자 사업장주소', '공급받는자 업태',
      '공급받는자 종목', '공급받는자 이메일1', '공급받는자 이메일2',
      '공급가액 합계', '세액 합계', '비고',
      '일자1', '품목1', '규격1', '수량1', '단가1', '공급가액1', '세액1', '품목비고1',
      '일자2', '품목2', '규격2', '수량2', '단가2', '공급가액2', '세액2', '품목비고2',
      '일자3', '품목3', '규격3', '수량3', '단가3', '공급가액3', '세액3', '품목비고3',
      '일자4', '품목4', '규격4', '수량4', '단가4', '공급가액4', '세액4', '품목비고4',
      '현금', '수표', '어음', '외상미수금', '영수(01)/청구(02)',
    ];

    const rows = filteredProjects.map(p => {
      const total = p.total_amount || 0;
      const supplyCost = s.taxType === '01' ? Math.round(total / 1.1) : total;
      const taxAmt    = s.taxType === '01' ? total - supplyCost : 0;
      const bizNo  = (p.biz_no || '').replace(/-/g, '');
      const dateStr = p.invoice_date ? p.invoice_date.replace(/-/g, '') : issueDateStr;
      const day     = p.invoice_date ? p.invoice_date.split('-')[2] : issueDay;

      const row: (string | number)[] = new Array(59).fill('');
      row[0]  = s.taxType;
      row[1]  = dateStr;
      row[2]  = s.supplierBizNo.replace(/-/g, '');
      row[3]  = '';
      row[4]  = s.supplierName;
      row[5]  = s.supplierOwner;
      row[6]  = s.supplierAddress;
      row[7]  = s.supplierType;
      row[8]  = s.supplierItem;
      row[9]  = s.supplierEmail;
      row[10] = bizNo;
      row[11] = '';
      row[12] = p.biz_name    || '';
      row[13] = p.biz_owner   || '';
      row[14] = p.biz_address || '';
      row[15] = p.biz_type    || '';
      row[16] = p.biz_item    || '';
      row[17] = p.biz_email   || '';
      row[18] = '';
      row[19] = supplyCost;
      row[20] = taxAmt;
      row[21] = p.notes || '';
      row[22] = day;
      row[23] = s.itemName;
      row[24] = '';
      row[25] = 1;
      row[26] = supplyCost;
      row[27] = supplyCost;
      row[28] = taxAmt;
      row[29] = p.site_name || '';
      row[58] = s.purposeType;
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([hometaxHeaders, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '엑셀업로드양식');
    XLSX.writeFile(workbook, `홈택스_세금계산서_${issueDateStr}.xlsx`);
  };

  const markExportedAsComplete = async (exportedProjects: Project[]) => {
    const today = new Date().toISOString().split('T')[0];
    const pendingIds = exportedProjects.filter(p => p.invoice_status !== '발급완료').map(p => p.id);
    if (pendingIds.length === 0) return;
    setProjects(prev => prev.map(p =>
      pendingIds.includes(p.id) ? { ...p, invoice_status: '발급완료', invoice_date: p.invoice_date || today } : p
    ));
    if (!currentUser) return;
    for (const id of pendingIds) {
      const p = projects.find(x => x.id === id);
      await updateSecure('projects', currentUser.id, id, {
        invoice_status: '발급완료',
        invoice_date: p?.invoice_date || today
      }).catch(() => {});
    }
  };

  const extractBizInfoFromOCR = async (projectId: string, file: File) => {
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    const mimeType = file.type || 'image/jpeg';

    setOcrLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(`OCR 실패: ${result.error || '알 수 없는 오류'}`);
        return;
      }

      const updates: Partial<Project> = {};
      const d = result.data;
      if (d.biz_no)      updates.biz_no      = d.biz_no;
      if (d.biz_name)    updates.biz_name    = d.biz_name;
      if (d.biz_owner)   updates.biz_owner   = d.biz_owner;
      if (d.biz_address) updates.biz_address = d.biz_address;
      if (d.biz_type)    updates.biz_type    = d.biz_type;
      if (d.biz_item)    updates.biz_item    = d.biz_item;
      if (d.biz_email)   updates.biz_email   = d.biz_email;

      if (Object.keys(updates).length === 0) {
        alert('사업자 정보를 인식하지 못했습니다.\n사업자등록증 사진인지 확인해주세요.');
        return;
      }

      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));

      if (currentUser) {
        const { error } = await supabase.from('projects').update(updates).eq('id', projectId);
        if (error) alert(`DB 저장 실패: ${error.message}`);
        else alert(`✅ ${Object.keys(updates).length}개 항목이 자동 입력되었습니다!`);
      }
    } finally {
      setOcrLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const updateProjectLocal = (id: string, field: keyof Project, value: string | number | '미발급' | '발급완료' | '미수금' | '일부수금' | '완료') => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const syncProjectToDB = async (id: string, field: keyof Project, value: string | number | '미발급' | '발급완료' | '미수금' | '일부수금' | '완료') => {
    if (!currentUser) return;
    try {
      await updateSecure('projects', currentUser.id, id, { [field]: value });
    } catch (error) {
      logSecureError('PROJECT_SYNC', error, currentUser?.id, 'warning');
    }
  };

  const handleProjectUpdateImmediate = (id: string, field: keyof Project, value: string | number | '미발급' | '발급완료' | '미수금' | '일부수금' | '완료') => {
    updateProjectLocal(id, field, value);
    syncProjectToDB(id, field, value);
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('현장 데이터를 삭제하시겠습니까?')) return;
    if (!currentUser) return;
    try {
      await deleteSecure('projects', currentUser.id, id);
      fetchProjects();
    } catch (error) {
      logSecureError('PROJECT_DELETE', error, currentUser?.id, 'error');
      alert('현장 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // --- DB 로직 (견적서) ---
  const fetchQuotations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('quotations', currentUser.id);
      setSavedQuotations((Array.isArray(data) ? data : []).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      logSecureError('FETCH_QUOTATIONS', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setSavedQuotations]);

  const saveCurrentQuotation = async () => {
    if (!currentUser) return;
    if (!customer.name.trim()) {
      alert('고객명을 입력하세요');
      return;
    }
    try {
      await insertSecure('quotations', currentUser.id, {
        items, provider, customer: customer.name, quoteNumber, greeting, remarks,
        total_amount: Math.floor(items.reduce((sum, i) => sum + Math.floor(i.quantity * i.unitPrice), 0) * 1.1)
      });
      alert('견적서가 저장되었습니다.');
      fetchQuotations();
    } catch (error) {
      logSecureError('QUOTATION_SAVE', error, currentUser?.id, 'error');
      alert(getUserFriendlyError(error));
    }
  };

  const deleteQuotation = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    if (!currentUser) return;
    try {
      await deleteSecure('quotations', currentUser.id, id);
      fetchQuotations();
    } catch (error) {
      logSecureError('QUOTATION_DELETE', error, currentUser?.id, 'error');
      alert('견적서 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // --- DB 로직 (실측) ---
  const fetchMeasurements = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await selectSecure('measurements_v2', currentUser.id);
      setSavedMeasurements((Array.isArray(data) ? data : []).sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      logSecureError('FETCH_MEASUREMENTS', error, currentUser?.id, 'warning');
    }
  }, [currentUser, setSavedMeasurements]);

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (currentUser) {
      fetchQuotations();
      fetchMeasurements();
      fetchProjects();
      fetchWorkItems();
      fetchSubcontracts();
      fetchCompanyProfile();
    }
  }, [currentUser, fetchQuotations, fetchMeasurements, fetchProjects, fetchWorkItems, fetchSubcontracts, fetchCompanyProfile]);

  // 인쇄 미리보기 표시 시 Storage URL을 base64로 변환
  useEffect(() => {
    if (view === 'measurement') {
      const convertAllPhotos = async () => {
        const converted: Record<string, Record<number, string>> = {};
        for (const space of measureData.spaces) {
          if (space.photos.length > 0) {
            converted[space.id] = {};
            for (let i = 0; i < space.photos.length; i++) {
              const photo = space.photos[i];
              if (photo.startsWith('https://')) {
                // Storage URL만 변환 (이미 변환되지 않았으면)
                if (!printPhotosBase64[space.id]?.[i]) {
                  try {
                    const response = await fetch(photo);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    converted[space.id][i] = await new Promise<string>((resolve) => {
                      reader.onloadend = () => {
                        resolve(reader.result as string);
                      };
                      reader.readAsDataURL(blob);
                    });
                  } catch (error) {
                    logSecureError('PHOTO_CONVERSION', error, currentUser?.id, 'warning');
                    // 변환 실패 시 placeholder 표시
                    const placeholderBase64 = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e2e8f0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" font-size="10" fill="%23999"%3E사진 오류%3C/text%3E%3C/svg%3E';
                    converted[space.id][i] = placeholderBase64;
                  }
                } else {
                  converted[space.id][i] = printPhotosBase64[space.id][i];
                }
              }
            }
          }
        }
        if (Object.keys(converted).length > 0) {
          setPrintPhotosBase64(prev => ({ ...prev, ...converted }));
        }
      };
      convertAllPhotos();
    }
  }, [view, measureData.spaces]);

  // --- 이미지 압축 함수 ---
  const compressImage = async (file: File, maxSizeKB = 500): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');

          // 1:1 비율 강제 (정사각형 크롭 + 1600px)
          const maxDim = 1600;
          const imgWidth = img.width;
          const imgHeight = img.height;
          const size = Math.min(imgWidth, imgHeight); // 정사각형 크기 (작은 쪽)

          // 중앙 정렬로 크롭할 위치 계산
          const cropX = (imgWidth - size) / 2;
          const cropY = (imgHeight - size) / 2;

          canvas.width = maxDim;
          canvas.height = maxDim;

          const ctx = canvas.getContext('2d')!;
          // 원본에서 정사각형 영역을 캔버스로 드로우 (중앙 크롭)
          ctx.drawImage(img, cropX, cropY, size, size, 0, 0, maxDim, maxDim);

          // 품질 조정 루프로 목표 크기 달성
          let quality = 0.85;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) return;
                if (blob.size > maxSizeKB * 1024 && quality > 0.2) {
                  quality -= 0.1;
                  tryCompress();
                } else {
                  resolve(blob);
                }
              },
              'image/jpeg',
              quality
            );
          };
          tryCompress();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const saveCurrentMeasurement = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 필수 정보 확인
    if (!measureData.siteName.trim() || !measureData.customerName.trim()) {
      alert('현장명과 고객명을 입력하세요.');
      return;
    }

    try {
      const data = await insertSecure('measurements_v2', currentUser.id, {
        site_name: measureData.siteName,
        customer_name: measureData.customerName,
        date: measureData.date,
        measurer: measureData.measurer,
        doors: measureData.spaces,
        options: measureData.checklist,
        contact: measureData.contact,
        address: measureData.address,
        special_notes: measureData.specialNotes
      });

      if (!data || data.length === 0) {
        logSecureError('MEASUREMENT_SAVE', new Error('No data returned'), currentUser?.id, 'warning');
        alert('저장 완료되었으나 데이터 확인 실패');
        return;
      }

      alert('실측 리포트가 저장되었습니다.');
      fetchMeasurements();

      // 폼 초기화
      setMeasureData({
        siteName: '', customerName: '', contact: '', address: '', date: new Date().toISOString().split('T')[0],
        measurer: '', spaces: [], checklist: { ...defaultChecklist }, specialNotes: ''
      });
    } catch (error) {
      logSecureError('MEASUREMENT_SAVE', error, currentUser?.id, 'error');
      alert('실측 리포트 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const deleteMeasurement = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    if (!currentUser) return;
    try {
      await deleteSecure('measurements_v2', currentUser.id, id);
      fetchMeasurements();
    } catch (error) {
      logSecureError('MEASUREMENT_DELETE', error, currentUser?.id, 'error');
      alert('실측 리포트 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const loadMeasurement = (m: SavedMeasurement) => {
    if (!window.confirm('작성 중인 내용이 사라집니다. 불러오시겠습니까?')) return;
    setMeasureData({
      siteName: m.site_name,
      customerName: m.customer_name,
      contact: m.contact || '',
      address: m.address || '',
      date: m.date,
      measurer: m.measurer,
      spaces: m.doors || [],
      checklist: m.options || { ...defaultChecklist },
      specialNotes: m.special_notes
    });
  };

  // --- 인테리어 실측 핸들러 ---
  const addSpace = () => {
    const newSpace: InteriorSpace = {
      id: Math.random().toString(36).substr(2, 9),
      name: `공간${measureData.spaces.length + 1}`,
      width: '', depth: '', height: '', window: '', doorInfo: '',
      floorCurrent: '', floorPlan: '', wallCurrent: '', wallPlan: '',
      ceilCurrent: '', ceilPlan: '', notes: '', photos: []
    };
    setMeasureData({ ...measureData, spaces: [...measureData.spaces, newSpace] });
  };

  const removeSpace = (id: string) => {
    setMeasureData({ ...measureData, spaces: measureData.spaces.filter(s => s.id !== id) });
  };

  const updateSpace = (id: string, field: keyof InteriorSpace, value: string | string[]) => {
    setMeasureData({ ...measureData, spaces: measureData.spaces.map(s => s.id === id ? { ...s, [field]: value } : s) });
  };

  const handleSpacePhotoUpload = async (spaceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentUser) {
      if (!files) alert('파일을 선택해주세요.');
      return;
    }

    // 업로드 시작
    setIsUploading(prev => ({ ...prev, [spaceId]: true }));
    setUploadProgress(prev => ({ ...prev, [spaceId]: 0 }));

    const fileArray = Array.from(files);
    for (let index = 0; index < fileArray.length; index++) {
      const file = fileArray[index];
      try {
        // 1. 이미지 압축
        const compressed = await compressImage(file);

        // 2. Supabase Storage 업로드
        // 파일명을 영문/숫자로 변환 (한글 미지원)
        const sanitizedFileName = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const fileName = `${currentUser.id}/${sanitizedFileName}`;

        const { data, error } = await supabase.storage
          .from('measurement-photos')
          .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: false });

        if (error) {
          logSecureError('PHOTO_UPLOAD', error, currentUser?.id, 'warning');
          alert('사진 업로드 실패했습니다. 다시 시도해주세요.');
          continue;
        }

        if (!data || !data.path) {
          logSecureError('PHOTO_UPLOAD', new Error('No path returned'), currentUser?.id, 'warning');
          alert('사진 업로드 실패했습니다. 다시 시도해주세요.');
          continue;
        }

        // 3. Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('measurement-photos')
          .getPublicUrl(data.path);

        if (!urlData || !urlData.publicUrl) {
          logSecureError('PHOTO_URL_GENERATION', new Error('No public URL'), currentUser?.id, 'warning');
          alert('사진 URL 생성 실패했습니다. 다시 시도해주세요.');
          continue;
        }

        // 4. photos 배열에 URL만 저장
        setMeasureData(prev => ({
          ...prev,
          spaces: prev.spaces.map(s => s.id === spaceId ? { ...s, photos: [...s.photos, urlData.publicUrl] } : s)
        }));

        // 5. 진행률 업데이트
        const progress = Math.round(((index + 1) / fileArray.length) * 100);
        setUploadProgress(prev => ({ ...prev, [spaceId]: progress }));
      } catch (error) {
        logSecureError('PHOTO_UPLOAD', error, currentUser?.id, 'error');
        alert('사진 업로드 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }

    // 업로드 완료
    setIsUploading(prev => ({ ...prev, [spaceId]: false }));
    setUploadProgress(prev => ({ ...prev, [spaceId]: 0 }));
  };

  const toggleChecklist = (field: keyof WorkChecklist, value: boolean | string) => {
    setMeasureData({ ...measureData, checklist: { ...measureData.checklist, [field]: value } });
  };

  // --- 기타 핸들러 ---
  const loadQuotation = (q: SavedQuotation) => {
    if (!window.confirm('작성 중인 내용이 사라집니다. 불러오시겠습니까?')) return;
    setItems(q.items);
    setProvider(q.provider);
    // customer가 문자열이면 객체로 변환
    const customerObj = typeof q.customer === 'string' ? { name: q.customer, contact: '', date: new Date().toISOString().split('T')[0] } : q.customer;
    setCustomer(customerObj);
    setQuoteNumber(q.quoteNumber);
    setGreeting(q.greeting);
    setRemarks(q.remarks);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (authView === 'signup') {
      if (authInputs.password !== authInputs.confirmPassword) {
        alert('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
        setIsLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: authInputs.email,
        password: authInputs.password,
        options: { data: { phone: authInputs.phone } }
      });
      if (error) {
        alert(error.message);
      } else {
        alert('회원가입 완료! 로그인을 시도해 주세요.');
        setAuthView('login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authInputs.email, password: authInputs.password });
      if (error) alert('로그인 실패: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(authInputs.email, {
      redirectTo: 'https://invoice-2cd.pages.dev/',
    });
    setIsLoading(false);
    if (error) alert('오류: ' + error.message);
    else alert('비밀번호 재설정 링크를 이메일로 발송했습니다. 이메일을 확인해 주세요.');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.password !== newPassword.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword.password });
    setIsLoading(false);
    if (error) alert('오류: ' + error.message);
    else { alert('비밀번호가 변경되었습니다.'); setAuthView('login'); }
  };

  const handleLogout = async () => await supabase.auth.signOut();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoDataUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const addItem = (type: 'door' | 'option') => setItems([...items, { id: Math.random().toString(36).substr(2, 9), type, name: type === 'door' ? '품목명 입력' : '옵션 항목', unit: 'SET', width: 0, height: 0, quantity: 1, unitPrice: 0, specialNote: '', remarks: '' }]);
  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id));
  const updateItem = (id: string, field: keyof Item, value: string | number) => setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  const handlePrint = () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); requestAnimationFrame(() => window.print()); };

  // --- 유틸리티 함수 (금액 포맷팅) ---
  const formatNumber = (num: number | string) => {
    if (!num) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseNumber = (str: string) => {
    return parseInt(str.replace(/,/g, "")) || 0;
  };

  // --- 공정명 입력 핸들러 (숫자/기호 허용으로 복구) ---
  const handleWorkLabelChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    id: string,
  ) => {
    updateWorkItem(id, 'label', e.target.value);
  }, [updateWorkItem]);

  // --- 외주 공정명 입력 핸들러 (숫자/기호 허용으로 복구) ---
  const handleSubcontractLabelChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    id: string,
  ) => {
    updateSubcontract(id, 'label', e.target.value);
  }, [updateSubcontract]);

  if (isLoading) return <div className="loading">로딩 중...</div>;

  // 로그인 안 됨 → 랜딩페이지 표시
  if (!currentUser && isLoading === false && !showAuthForm) {
    return <div style={{ background: '#fff', color: '#1F2937', minHeight: '100vh' }}><LandingPage onStartClick={() => { setAuthView('signup'); setShowAuthForm(true); }} /></div>;
  }

  if (authView === 'reset') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header"><h2>새 비밀번호 설정</h2><p>새로운 비밀번호를 입력해 주세요</p></div>
          <form onSubmit={handleResetPassword}>
            <div className="auth-group"><label>새 비밀번호</label><input type="password" required value={newPassword.password} onChange={e => setNewPassword({...newPassword, password: e.target.value})} placeholder="새 비밀번호를 입력하세요" /></div>
            <div className="auth-group"><label>새 비밀번호 확인</label><input type="password" required value={newPassword.confirmPassword} onChange={e => setNewPassword({...newPassword, confirmPassword: e.target.value})} placeholder="새 비밀번호를 한 번 더 입력하세요" /></div>
            <button type="submit" className="btn-auth" disabled={isLoading}>비밀번호 변경</button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          {authView === 'forgot' ? (
            <>
              <div className="auth-header"><h2>비밀번호 찾기</h2><p>가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다</p></div>
              <form onSubmit={handleForgotPassword}>
                <div className="auth-group"><label>이메일</label><input type="email" required value={authInputs.email} onChange={e => setAuthViewInputs({...authInputs, email: e.target.value})} placeholder="가입한 이메일을 입력하세요" /></div>
                <button type="submit" className="btn-auth" disabled={isLoading}>재설정 링크 발송</button>
              </form>
              <div className="auth-footer"><p><span onClick={() => setAuthView('login')}>로그인으로 돌아가기</span></p></div>
            </>
          ) : (
            <>
              <div className="auth-header"><h2>공정관리 대시보드</h2><p>{authView === 'login' ? '로그인이 필요합니다' : '새로운 계정을 만드세요'}</p></div>
              <form onSubmit={handleAuthSubmit}>
                <div className="auth-group"><label>이메일</label><input type="email" required value={authInputs.email} onChange={e => setAuthViewInputs({...authInputs, email: e.target.value})} placeholder="이메일을 입력하세요" /></div>
                <div className="auth-group"><label>비밀번호</label><input type="password" required value={authInputs.password} onChange={e => setAuthViewInputs({...authInputs, password: e.target.value})} placeholder="비밀번호를 입력하세요" /></div>
                {authView === 'signup' && (
                  <>
                    <div className="auth-group"><label>비밀번호 확인</label><input type="password" required value={authInputs.confirmPassword} onChange={e => setAuthViewInputs({...authInputs, confirmPassword: e.target.value})} placeholder="비밀번호를 한 번 더 입력하세요" /></div>
                    <div className="auth-group"><label>휴대폰 번호</label><input type="tel" required value={authInputs.phone} onChange={e => setAuthViewInputs({...authInputs, phone: e.target.value})} placeholder="예: 010-1234-5678" /></div>
                  </>
                )}
                <button type="submit" className="btn-auth" disabled={isLoading}>{authView === 'login' ? '로그인' : '회원가입 완료'}</button>
              </form>
              <div className="auth-footer">
                {authView === 'login' ? (
                  <p>계정이 없으신가요? <span onClick={() => setAuthView('signup')}>회원가입</span></p>
                ) : (
                  <p>이미 계정이 있으신가요? <span onClick={() => setAuthView('login')}>로그인</span></p>
                )}
                {authView === 'login' && <p><span onClick={() => setAuthView('forgot')}>비밀번호를 잊으셨나요?</span></p>}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="app-shell">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar no-print ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>공정관리시스템</h1>
          <span>Construction Management</span>
        </div>
        <nav className="sidebar-nav">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => { setView('dashboard'); setSidebarOpen(false); }}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </span>
            공정 대시보드
          </button>
          <button className={view === 'quotation' ? 'active' : ''} onClick={() => { setView('quotation'); setSidebarOpen(false); }}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </span>
            견적서 작성
          </button>
          <button className={view === 'measurement' ? 'active' : ''} onClick={() => { setView('measurement'); setSidebarOpen(false); }}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/><path d="M9 20v-4h6v4"/></svg>
            </span>
            실측 템플릿
          </button>
          <button className={view === 'blog' ? 'active' : ''} onClick={() => { setView('blog'); setSidebarOpen(false); }}>
            <span className="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </span>
            AI 블로그 작성기
            <span className="nav-badge">HOT</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-header">
              <div className="user-avatar">{currentUser.email?.charAt(0).toUpperCase()}</div>
              <div className="user-detail">
                <div className="user-email">{currentUser.email}</div>
              </div>
            </div>
            <div className="inquiry-card" onClick={() => { setShowInquiryModal(true); setInquiryStatus('idle'); }}>
              <div className="inquiry-card-icon">💼</div>
              <div className="inquiry-card-text">
                <div className="inquiry-card-title">맞춤 소프트웨어 문의</div>
                <div className="inquiry-card-sub">그룹웨어 · 업무 자동화 · 대시보드</div>
              </div>
              <span className="inquiry-card-arrow">→</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </aside>

      {/* Mobile toggle */}
      {/* 맞춤 소프트웨어 문의 모달 */}
      {showInquiryModal && (
        <div className="modal-overlay" onClick={() => setShowInquiryModal(false)}>
          <div className="modal-box inquiry-modal" onClick={e => e.stopPropagation()}>
            <div className="inquiry-modal-header">
              <div>
                <div className="inquiry-modal-title">💼 맞춤 소프트웨어 문의</div>
                <div className="inquiry-modal-subtitle">그룹웨어 · 사내 소프트웨어 · 업무 자동화 · 업무 간결화 · 대시보드 개인화</div>
              </div>
              <button className="modal-close" onClick={() => setShowInquiryModal(false)}>✕</button>
            </div>

            <div className="inquiry-phone-bar">
              <span>📞 대표전화</span>
              <a href="tel:15338763" className="inquiry-phone-num">1533-8763</a>
              <span className="inquiry-phone-note">평일 09:00 ~ 18:00</span>
            </div>

            {inquiryStatus === 'sent' ? (
              <div className="inquiry-sent">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
                <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '0.5rem' }}>문의가 접수되었습니다!</div>
                <div style={{ color: '#64748B', fontSize: '13px' }}>빠른 시일 내에 연락드리겠습니다.</div>
                <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setShowInquiryModal(false)}>닫기</button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setInquiryStatus('sending');
                  try {
                    const fd = new FormData();
                    fd.append('name', inquiryForm.name);
                    fd.append('email', inquiryForm.email);
                    fd.append('_replyto', inquiryForm.email);
                    fd.append('회사명', inquiryForm.company);
                    fd.append('연락처', inquiryForm.phone);
                    fd.append('문의유형', inquiryForm.type);
                    fd.append('내용', inquiryForm.message);
                    const res = await fetch('https://formspree.io/f/maqprlng', {
                      method: 'POST',
                      headers: { Accept: 'application/json' },
                      body: fd,
                    });
                    if (res.ok) {
                      setInquiryStatus('sent');
                      setInquiryForm({ name: '', company: '', phone: '', email: '', type: '그룹웨어', message: '' });
                    } else {
                      setInquiryStatus('error');
                    }
                  } catch {
                    setInquiryStatus('error');
                  }
                }}
                className="inquiry-form"
              >
                <div className="inquiry-form-row">
                  <div className="form-group">
                    <label>이름 *</label>
                    <input required value={inquiryForm.name} onChange={e => setInquiryForm(p => ({ ...p, name: e.target.value }))} placeholder="홍길동" />
                  </div>
                  <div className="form-group">
                    <label>회사명 *</label>
                    <input required value={inquiryForm.company} onChange={e => setInquiryForm(p => ({ ...p, company: e.target.value }))} placeholder="(주)예시" />
                  </div>
                </div>
                <div className="inquiry-form-row">
                  <div className="form-group">
                    <label>연락처 *</label>
                    <input required value={inquiryForm.phone} onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      const formatted = digits.length <= 3 ? digits
                        : digits.length <= 7 ? `${digits.slice(0,3)}-${digits.slice(3)}`
                        : `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
                      setInquiryForm(p => ({ ...p, phone: formatted }));
                    }} placeholder="010-0000-0000" inputMode="numeric" />
                  </div>
                  <div className="form-group">
                    <label>이메일 *</label>
                    <input required type="email" value={inquiryForm.email} onChange={e => setInquiryForm(p => ({ ...p, email: e.target.value }))} placeholder="example@company.com" />
                  </div>
                </div>
                <div className="inquiry-form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>문의 유형</label>
                    <select value={inquiryForm.type} onChange={e => setInquiryForm(p => ({ ...p, type: e.target.value }))}>
                      <option>그룹웨어</option>
                      <option>사내 소프트웨어</option>
                      <option>업무 자동화</option>
                      <option>업무 간결화</option>
                      <option>대시보드 개인화</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>문의 내용</label>
                  <textarea rows={4} value={inquiryForm.message} onChange={e => setInquiryForm(p => ({ ...p, message: e.target.value }))} placeholder="어떤 업무를 자동화하고 싶으신지, 현재 어떤 문제가 있는지 간략하게 적어주세요." />
                </div>
                {inquiryStatus === 'error' && <div style={{ color: '#EF4444', fontSize: '13px', marginBottom: '0.5rem' }}>전송에 실패했습니다. 다시 시도해주세요.</div>}
                <button type="submit" className="btn-primary inquiry-submit" disabled={inquiryStatus === 'sending'}>
                  {inquiryStatus === 'sending' ? '전송 중...' : '문의 보내기'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <button className="sidebar-toggle no-print" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Main Content */}
      <main className="main-content">
      <div className="main-layout no-print">
        {view === 'dashboard' ? (
          <div className="dashboard-container">
            {/* 모바일 OCR 바텀시트 */}
            {ocrPickerId && (
              <div className="ocr-picker-overlay" onClick={() => setOcrPickerId(null)}>
                <div className="ocr-picker-sheet" onClick={e => e.stopPropagation()}>
                  <p className="ocr-picker-title">사업자등록증 불러오기</p>
                  <label className="ocr-picker-option">
                    📷 카메라로 촬영
                    <input type="file" accept="image/*" capture="environment" style={{display:'none'}}
                      onChange={e => { if (e.target.files?.[0]) extractBizInfoFromOCR(ocrPickerId, e.target.files[0]); setOcrPickerId(null); }} />
                  </label>
                  <label className="ocr-picker-option">
                    🖼️ 사진 보관함
                    <input type="file" accept="image/*" style={{display:'none'}}
                      onChange={e => { if (e.target.files?.[0]) extractBizInfoFromOCR(ocrPickerId, e.target.files[0]); setOcrPickerId(null); }} />
                  </label>
                  <button className="ocr-picker-cancel" onClick={() => setOcrPickerId(null)}>취소</button>
                </div>
              </div>
            )}
            <div className="page-header">
              <h1>공정 관리 대시보드</h1>
              <div className="page-header-actions">
                <div className="dashboard-tabs">
                  <button className={dashboardMode === 'list' ? 'active' : ''} onClick={() => { setDashboardMode('list'); setSearchProject(''); }}>리스트</button>
                  <button className={dashboardMode === 'calendar' ? 'active' : ''} onClick={() => { setDashboardMode('calendar'); setSearchProject(''); }}>캘린더</button>
                  <button className={dashboardMode === 'invoice' ? 'active' : ''} onClick={() => { setDashboardMode('invoice'); setSearchProject(''); }}>계산서</button>
                </div>
                <button className="btn-add-project" onClick={addProject}>+ 새 현장</button>
              </div>
            </div>

            {dashboardMode === 'list' ? (
              <>
              {projects.length > 0 && (
                <div className="search-bar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input placeholder="현장명, 고객사명으로 검색..." value={searchProject} onChange={e => setSearchProject(e.target.value)} />
                  {searchProject && <button className="search-clear" onClick={() => setSearchProject('')}>&times;</button>}
                </div>
              )}
              <div className="project-grid">
                {projects.length === 0 && <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 16px',display:'block'}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  등록된 현장이 없습니다.<br/>'+ 새 현장' 버튼을 눌러 시작하세요.
                </div>}
                {projects.filter(p => {
                  if (!searchProject) return true;
                  const q = searchProject.toLowerCase();
                  return (p.site_name || '').toLowerCase().includes(q) || (p.customer_name || '').toLowerCase().includes(q);
                }).map(project => {
                  const projWorkItems = workItems.filter(w => w.project_id === project.id);
                  const projSubs = subcontracts.filter(s => s.project_id === project.id);
                  const doneCount = projWorkItems.filter(w => w.status === '완료').length;
                  const totalCount = projWorkItems.length;
                  const progressPct = totalCount > 0 ? Math.floor((doneCount / totalCount) * 100) : 0;
                  const cardColor = getProjectColor(project.id);

                  return (
                  <div key={project.id} className="project-card" style={{'--card-color': cardColor.border} as React.CSSProperties}>
                    {/* ── 카드 헤더: 현장명 + 금액 + 진행률 ── */}
                    <div className="card-header-bar">
                      <div className="card-header-top">
                        <div className="card-title-group">
                          <h3>{project.site_name}</h3>
                          <input
                            className="customer-input"
                            placeholder="고객사명"
                            value={project.customer_name || ''}
                            onChange={e => updateProjectLocal(project.id, 'customer_name', e.target.value)}
                            onBlur={e => syncProjectToDB(project.id, 'customer_name', e.target.value)}
                          />
                        </div>
                        <div className="card-header-right">
                          <div className="card-amount">
                            <span className="card-amount-label">계약금액</span>
                            <input
                              className="card-amount-input"
                              type="text"
                              value={formatNumber(project.total_amount)}
                              onChange={e => updateProjectLocal(project.id, 'total_amount', parseNumber(e.target.value))}
                              onBlur={e => syncProjectToDB(project.id, 'total_amount', parseNumber(e.target.value))}
                            />
                          </div>
                          <button className="btn-delete-project" onClick={() => deleteProject(project.id)} aria-label="현장 삭제">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                      {/* 진행률 바 */}
                      {totalCount > 0 && (
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{width: `${progressPct}%`, background: progressPct === 100 ? '#10b981' : 'var(--color-accent)'}} />
                          </div>
                          <span className="progress-text">{doneCount}/{totalCount} 완료 ({progressPct}%)</span>
                        </div>
                      )}
                      {/* 상태 뱃지 요약 */}
                      <div className="card-status-badges">
                        <span className={`mini-badge ${project.invoice_status}`}>{project.invoice_status === '발급완료' ? '계산서 발급' : '계산서 미발급'}</span>
                        <span className={`mini-badge ${project.payment_status}`}>{project.payment_status === '완료' ? '수금 완료' : project.payment_status}</span>
                      </div>
                    </div>

                    <div className="project-body">
                      {/* ── 공정 항목 ── */}
                      <div className="card-section">
                        <div className="card-section-header">
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            <span className="card-section-title">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                              공정 ({projWorkItems.length})
                            </span>
                            <div style={{color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold'}}>*입력창이 빨간색일때 페이지를 벗어나면 내용이 저장되지 않습니다. 페이지를 벗어나기전 다른곳을 클릭하여 입력창값을 확정해주세요.</div>
                          </div>
                          <button className="btn-add-work" onClick={() => addWorkItem(project.id, projWorkItems.length)}>+ 추가</button>
                        </div>
                        <div className="work-items-grid">
                          {projWorkItems.map((w, idx) => (
                            <div key={w.id} className={`work-item-chip ${w.status === '완료' ? 'done' : ''}`}>
                              <div className="chip-top">
                                <span className="chip-index">{idx + 1}</span>
                                <div className="chip-actions">
                                  <button className="btn-create-subcontract" onClick={() => createSubcontractFromWorkItem(project.id, w)} title="외주로 생성">외주</button>
                                  <button className="btn-remove-work" onClick={() => deleteWorkItem(w.id)} aria-label="공정 삭제">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                              </div>
                              <input 
                                className="work-label-input"
                                value={w.label} 
                                onChange={e => handleWorkLabelChange(e, w.id)} 
                                onCompositionEnd={e => saveWorkItemLabel(w.id, e.currentTarget.value)} 
                                onBlur={e => saveWorkItemLabel(w.id, e.currentTarget.value)} 
                                placeholder="공정명"
                              />
                              <select value={w.status} onChange={e => updateWorkItem(w.id, 'status', e.target.value)} className={`status-select ${w.status.replace(/ /g, '-')}`}>
                                <option value="실측예정">실측예정</option>
                                <option value="실측 후 대기">실측 후 대기</option>
                                <option value="시공확정">시공확정</option>
                                <option value="시공중">시공중</option>
                                <option value="완료">완료</option>
                              </select>
                              <div className="date-range-inputs">
                                <div className="date-input-container" onClick={(e) => {
                                  const input = e.currentTarget.querySelector('input[type="date"]');
                                  if (input) (input as any).showPicker();
                                }}>
                                  <svg className="calendar-mini-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  <input type="text" placeholder="MM-DD" value={formatDateToMMDD(w.start_date || '')} readOnly />
                                  <input type="date" value={w.start_date || ''} onChange={e => updateWorkItem(w.id, 'start_date', e.target.value)} className="date-picker-overlay" title="시작일" />
                                </div>
                                <span className="date-separator">~</span>
                                <div className="date-input-container" onClick={(e) => {
                                  const input = e.currentTarget.querySelector('input[type="date"]');
                                  if (input) (input as any).showPicker();
                                }}>
                                  <svg className="calendar-mini-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  <input type="text" placeholder="MM-DD" value={formatDateToMMDD(w.end_date || '')} readOnly />
                                  <input type="date" value={w.end_date || ''} onChange={e => updateWorkItem(w.id, 'end_date', e.target.value)} className="date-picker-overlay" title="종료일" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── 외주 관리 ── */}
                      <div className="card-section">
                        <div className="card-section-header">
                          <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                            <span className="card-section-title">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              외주 ({projSubs.length})
                            </span>
                            <div style={{color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold'}}>*입력창이 빨간색일때 페이지를 벗어나면 내용이 저장되지 않습니다. 페이지를 벗어나기전 다른곳을 클릭하여 입력창값을 확정해주세요.</div>
                          </div>
                        </div>
                        <div className="sub-cards-grid">
                          {projSubs.map((s, idx) => (
                            <div key={s.id} className={`sub-card ${s.payment_done ? 'done' : ''}`}>
                              <div className="chip-top">
                                <span className="chip-index">{idx + 1}</span>
                                <button className="btn-remove-work" onClick={() => deleteSubcontract(s.id)} aria-label="외주 삭제">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                              <input 
                                className="work-label-input"
                                placeholder="공정명" 
                                value={s.label} 
                                onChange={e => handleSubcontractLabelChange(e, s.id)} 
                                onCompositionEnd={e => saveSubcontractLabel(s.id, e.currentTarget.value)} 
                                onBlur={e => saveSubcontractLabel(s.id, e.currentTarget.value)} 
                              />
                              <input className="sub-amount-input" placeholder="금액" type="text" value={s.amount ? formatNumber(s.amount) : ''} onChange={e => updateSubcontract(s.id, 'amount', parseNumber(e.target.value))} />
                              <div className="date-range-inputs">
                                <div className="date-input-container" onClick={(e) => {
                                  const input = e.currentTarget.querySelector('input[type="date"]');
                                  if (input) (input as any).showPicker();
                                }}>
                                  <svg className="calendar-mini-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  <input type="text" placeholder="MM-DD" value={formatDateToMMDD(s.start_date || '')} readOnly />
                                  <input type="date" value={s.start_date || ''} onChange={e => updateSubcontract(s.id, 'start_date', e.target.value)} className="date-picker-overlay" title="시작일" />
                                </div>
                                <span className="date-separator">~</span>
                                <div className="date-input-container" onClick={(e) => {
                                  const input = e.currentTarget.querySelector('input[type="date"]');
                                  if (input) (input as any).showPicker();
                                }}>
                                  <svg className="calendar-mini-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                  <input type="text" placeholder="MM-DD" value={formatDateToMMDD(s.end_date || '')} readOnly />
                                  <input type="date" value={s.end_date || ''} onChange={e => updateSubcontract(s.id, 'end_date', e.target.value)} className="date-picker-overlay" title="종료일" />
                                </div>
                              </div>
                              <div className="sub-checks">
                                <label className={`sub-check ${s.invoice_issued ? 'on' : ''}`}>
                                  <input type="checkbox" checked={s.invoice_issued} onChange={e => updateSubcontract(s.id, 'invoice_issued', e.target.checked)} style={{display:'none'}} />
                                  {s.invoice_issued ? '✓ ' : ''}계산서
                                </label>
                                <label className={`sub-check ${s.payment_done ? 'on' : ''}`}>
                                  <input type="checkbox" checked={s.payment_done} onChange={e => updateSubcontract(s.id, 'payment_done', e.target.checked)} style={{display:'none'}} />
                                  {s.payment_done ? '✓ ' : ''}대금지급
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── 메모 ── */}
                      <textarea
                        className="project-notes"
                        placeholder="특이사항 및 메모"
                        value={project.notes || ''}
                        onChange={e => updateProjectLocal(project.id, 'notes', e.target.value)}
                        onBlur={e => syncProjectToDB(project.id, 'notes', e.target.value)}
                        rows={1}
                      />

                      {/* ── 계산서/수금 ── */}
                      <div className="card-section">
                        <div className="card-section-header">
                          <span className="card-section-title">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                            계산서 / 수금
                          </span>
                        </div>
                        <div className="invoice-payment-row">
                          <div className="status-node">
                            <div className="node-label">계산서</div>
                            <button
                              className={`btn-invoice-status ${project.invoice_status === '발급완료' ? 'done' : 'pending'}`}
                              onClick={() => handleProjectUpdateImmediate(project.id, 'invoice_status', project.invoice_status === '발급완료' ? '미발급' : '발급완료')}
                            >
                              {project.invoice_status === '발급완료' ? '✓ 발급완료' : '미발급'}
                            </button>
                            <input type="date" value={project.invoice_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'invoice_date', e.target.value)} />
                          </div>
                          <div className="status-node">
                            <div className="node-label">수금</div>
                            <select value={project.payment_status} onChange={e => handleProjectUpdateImmediate(project.id, 'payment_status', e.target.value)} className={`status-select ${project.payment_status}`}>
                              <option value="미수금">미수금</option>
                              <option value="일부수금">일부수금</option>
                              <option value="완료">완료</option>
                            </select>
                            <input type="date" value={project.payment_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'payment_date', e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {/* ── 계산서 발행 정보 (접기/펼치기) ── */}
                      <div className="biz-info-section">
                        <button className="biz-info-toggle" onClick={() => {
                          setExpandedBizInfo(prev => {
                            const next = new Set(prev);
                            if (next.has(project.id)) {
                              next.delete(project.id);
                            } else {
                              next.add(project.id);
                            }
                            return next;
                          });
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{transform: expandedBizInfo.has(project.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 200ms'}}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                          계산서 발행 정보
                        </button>
                        {expandedBizInfo.has(project.id) && (
                          <div className="biz-info-grid">
                            {/* OCR 버튼 */}
                            <div className="biz-ocr-row">
                              {ocrLoading[project.id] ? (
                                <span className="ocr-loading">🔍 정확한 처리를 위해 AI가 분석하고 있습니다. 30초 가량 소요됩니다...</span>
                              ) : ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? (
                                <button className="btn-ocr" onClick={() => setOcrPickerId(project.id)}>📷 사업자등록증 OCR</button>
                              ) : (
                                <>
                                  <input type="file" accept="image/*" style={{display:'none'}} id={`ocr-input-${project.id}`}
                                    onChange={e => { if (e.target.files?.[0]) extractBizInfoFromOCR(project.id, e.target.files[0]); }} />
                                  <button className="btn-ocr" onClick={() => document.getElementById(`ocr-input-${project.id}`)?.click()}>📷 사업자등록증 OCR</button>
                                </>
                              )}
                            </div>
                            <input placeholder="상호" value={project.biz_name || ''} onChange={e => updateProjectLocal(project.id, 'biz_name', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_name', e.target.value)} />
                            <input placeholder="성명" value={project.biz_owner || ''} onChange={e => updateProjectLocal(project.id, 'biz_owner', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_owner', e.target.value)} />
                            <input placeholder="사업자등록번호" value={project.biz_no || ''} onChange={e => updateProjectLocal(project.id, 'biz_no', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_no', e.target.value)} />
                            <input placeholder="이메일" value={project.biz_email || ''} onChange={e => updateProjectLocal(project.id, 'biz_email', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_email', e.target.value)} />
                            <input placeholder="업태" value={project.biz_type || ''} onChange={e => updateProjectLocal(project.id, 'biz_type', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_type', e.target.value)} />
                            <input placeholder="종목" value={project.biz_item || ''} onChange={e => updateProjectLocal(project.id, 'biz_item', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_item', e.target.value)} />
                            <input placeholder="사업장주소" className="full-width" value={project.biz_address || ''} onChange={e => updateProjectLocal(project.id, 'biz_address', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_address', e.target.value)} />
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                  );
                })}
              </div>
              </>
            ) : dashboardMode === 'calendar' ? (
              <div className="calendar-card">
                <div className="calendar-header">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>&lt;</button>
                  <h2>{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>&gt;</button>
                </div>
                <div className="calendar-grid-wrapper">
                <div className="calendar-grid">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day} className="calendar-day-label">{day}</div>)}
                  {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
                  {(() => {
                    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
                    const monthStartStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
                    const monthEndStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                    // 해당 월에 걸쳐 있는 모든 이벤트를 가져와서 슬롯(행) 할당
                    const monthEvents = [...workItems, ...subcontracts]
                      .filter(e => e.start_date && (
                        (e.start_date <= monthEndStr && (e.end_date || e.start_date) >= monthStartStr)
                      ))
                      .sort((a, b) => a.start_date.localeCompare(b.start_date) || (b.end_date || b.start_date).localeCompare(a.end_date || a.start_date));

                    const eventSlots: (WorkItem | Subcontract)[][] = [];
                    monthEvents.forEach(event => {
                    const slotIndex = eventSlots.findIndex(slot => {
                        return !slot.some(se => {
                          const eStart = event.start_date;
                          const eEnd = event.end_date || event.start_date;
                          const seStart = se.start_date;
                          const seEnd = se.end_date || se.start_date;
                          return (eStart <= seEnd && eEnd >= seStart);
                        });
                      });
                      if (slotIndex === -1) eventSlots.push([event]);
                      else eventSlots[slotIndex].push(event);
                    });

                    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
                    return Array.from({ length: lastDay }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayOfWeek = new Date(dateStr).getDay();
                      const dayLabel = dayLabels[dayOfWeek];

                      return (
                        <div key={day} className="calendar-day">
                          <span className="day-number">{day}<span className="day-label-mobile"> {dayLabel}</span></span>
                          <div className="day-events-container">
                            {eventSlots.map((slot, sIdx) => {
                              const event = slot.find(e => {
                                const eStart = e.start_date;
                                const eEnd = e.end_date || e.start_date;
                                return dateStr >= eStart && dateStr <= eEnd;
                              });

                              if (!event) return <div key={sIdx} className="event-spacer" />;

                              const isWorkItem = 'status' in event;
                              const proj = projects.find(p => p.id === event.project_id);
                              const customerName = proj?.customer_name || proj?.site_name || '';
                              const color = getProjectColor(event.project_id);

                              const isStart = event.start_date === dateStr;
                              const isEnd = (event.end_date || event.start_date) === dateStr;
                              const isSunday = new Date(dateStr).getDay() === 0;
                              const isMonthStart = day === 1; 
                              const isMonthBoundary = isMonthStart && event.start_date < dateStr; 
                              const showText = isStart || (isSunday && dateStr <= (event.end_date || event.start_date)) || isMonthBoundary;

                              return (
                                <div
                                  key={event.id}
                                  className={`event-bar ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${!isWorkItem ? 'subcontract' : ''}`}
                                  style={{
                                    background: color.bg,
                                    color: color.text,
                                    borderColor: color.border
                                  }}
                                >
                                  {showText && (
                                    <span className="event-label">
                                      {!isWorkItem && '🔧 '}{customerName}:{event.label}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                </div>
              </div>
            ) : (
              <div className="invoice-container">
                {/* 공급자 설정 패널 */}
                <div className="supplier-panel">
                  <div className="supplier-panel-grid">
                    <div>
                      <label>과세유형</label>
                      <select value={invoiceExportSettings.taxType} onChange={e => setInvoiceExportSettings(p => ({...p, taxType: e.target.value as '01'|'02'}))}>
                        <option value="01">과세 (10%)</option>
                        <option value="02">면세 (영세율)</option>
                      </select>
                    </div>
                    <div>
                      <label>영수/청구</label>
                      <select value={invoiceExportSettings.purposeType} onChange={e => setInvoiceExportSettings(p => ({...p, purposeType: e.target.value as '01'|'02'}))}>
                        <option value="01">영수</option>
                        <option value="02">청구</option>
                      </select>
                    </div>
                    <div>
                      <label>발행일자</label>
                      <input type="date" value={invoiceExportSettings.issueDate} onChange={e => setInvoiceExportSettings(p => ({...p, issueDate: e.target.value}))} />
                    </div>
                    <div>
                      <label>품목명</label>
                      <input placeholder="예: 인테리어 공사" value={invoiceExportSettings.itemName} onChange={e => setInvoiceExportSettings(p => ({...p, itemName: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 사업자번호</label>
                      <input placeholder="0000000000 (하이픈 없이)" value={invoiceExportSettings.supplierBizNo} onChange={e => setInvoiceExportSettings(p => ({...p, supplierBizNo: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 상호</label>
                      <input placeholder="상호명" value={invoiceExportSettings.supplierName} onChange={e => setInvoiceExportSettings(p => ({...p, supplierName: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 성명</label>
                      <input placeholder="대표자명" value={invoiceExportSettings.supplierOwner} onChange={e => setInvoiceExportSettings(p => ({...p, supplierOwner: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 이메일</label>
                      <input placeholder="email@example.com" value={invoiceExportSettings.supplierEmail} onChange={e => setInvoiceExportSettings(p => ({...p, supplierEmail: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 업태</label>
                      <input placeholder="건설" value={invoiceExportSettings.supplierType} onChange={e => setInvoiceExportSettings(p => ({...p, supplierType: e.target.value}))} />
                    </div>
                    <div>
                      <label>공급자 종목</label>
                      <input placeholder="인테리어공사" value={invoiceExportSettings.supplierItem} onChange={e => setInvoiceExportSettings(p => ({...p, supplierItem: e.target.value}))} />
                    </div>
                    <div className="supplier-address-field">
                      <label>공급자 사업장주소</label>
                      <input placeholder="사업장 주소" value={invoiceExportSettings.supplierAddress} onChange={e => setInvoiceExportSettings(p => ({...p, supplierAddress: e.target.value}))} />
                    </div>
                  </div>
                  <div className="supplier-panel-actions">
                    <button className="btn-save-supplier" onClick={() => { localStorage.setItem('invoiceExportSettings', JSON.stringify(invoiceExportSettings)); alert('저장되었습니다.'); }}>💾 저장</button>
                    <button className="btn-reset-supplier" onClick={() => { localStorage.removeItem('invoiceExportSettings'); setInvoiceExportSettings(defaultInvoiceExportSettings); }}>초기화</button>
                  </div>
                </div>

                <div className="invoice-filter-bar">
                  {(() => {
                    const searchedProjects = projects.filter(p => {
                      if (!searchProject) return true;
                      const q = searchProject.toLowerCase();
                      return (p.site_name || '').toLowerCase().includes(q) || (p.customer_name || '').toLowerCase().includes(q);
                    });
                    const unissuedCount = searchedProjects.filter(p => p.invoice_status !== '발급완료').length;
                    const issuedCount = searchedProjects.filter(p => p.invoice_status === '발급완료').length;
                    return (
                      <div className="filter-group">
                        <button className={invoiceFilter === '전체' ? 'active' : ''} onClick={() => setInvoiceFilter('전체')}>전체 ({searchedProjects.length})</button>
                        <button className={invoiceFilter === '미발급' ? 'active' : ''} onClick={() => setInvoiceFilter('미발급')}>미발급 ({unissuedCount})</button>
                        <button className={invoiceFilter === '발급완료' ? 'active' : ''} onClick={() => setInvoiceFilter('발급완료')}>발급완료 ({issuedCount})</button>
                      </div>
                    );
                  })()}
                  {(() => {
                    const filteredForTotal = projects
                      .filter(p => { if (!searchProject) return true; const q = searchProject.toLowerCase(); return (p.site_name||'').toLowerCase().includes(q)||(p.customer_name||'').toLowerCase().includes(q); })
                      .filter(p => { if (invoiceFilter==='전체') return true; if (invoiceFilter==='미발급') return p.invoice_status!=='발급완료'; if (invoiceFilter==='발급완료') return p.invoice_status==='발급완료'; return true; });
                    const totalSum = filteredForTotal.reduce((sum, p) => sum + (p.total_amount || 0), 0);
                    return (
                      <div className="invoice-summary">
                        {invoiceFilter === '발급완료' ? '발급완료 합계' : '미발급 합계'}: <span className="highlight">₩{Math.floor(totalSum).toLocaleString()}</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const filteredProjects = projects
                      .filter(p => { if (!searchProject) return true; const q = searchProject.toLowerCase(); return (p.site_name||'').toLowerCase().includes(q)||(p.customer_name||'').toLowerCase().includes(q); })
                      .filter(p => { if (invoiceFilter==='전체') return true; if (invoiceFilter==='미발급') return p.invoice_status!=='발급완료'; if (invoiceFilter==='발급완료') return p.invoice_status==='발급완료'; return true; });
                    const selectedCount = selectedInvoiceIds.size;
                    const toExport = selectedCount > 0 ? filteredProjects.filter(p => selectedInvoiceIds.has(p.id)) : filteredProjects;
                    return (
                      <button className="btn-excel-export-list" onClick={() => { exportFilteredProjectsToExcel(toExport); markExportedAsComplete(toExport); }}>
                        📊 {selectedCount > 0 ? `선택 ${selectedCount}건 ` : ''}홈택스 엑셀 다운로드
                      </button>
                    );
                  })()}
                </div>

                <div className="search-bar" style={{marginBottom: '20px'}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input placeholder="현장명, 고객사명으로 검색..." value={searchProject} onChange={e => setSearchProject(e.target.value)} />
                  {searchProject && <button className="search-clear" onClick={() => setSearchProject('')}>&times;</button>}
                </div>

                <div className="invoice-list-table">
                  {(() => {
                    const filteredProjects = projects
                      .filter(p => { if (invoiceFilter==='전체') return true; if (invoiceFilter==='미발급') return p.invoice_status!=='발급완료'; if (invoiceFilter==='발급완료') return p.invoice_status==='발급완료'; return true; })
                      .filter(p => { if (!searchProject) return true; const q = searchProject.toLowerCase(); return (p.site_name||'').toLowerCase().includes(q)||(p.customer_name||'').toLowerCase().includes(q); });
                    const allSelected = filteredProjects.length > 0 && filteredProjects.every(p => selectedInvoiceIds.has(p.id));
                    return (
                      <table>
                        <thead>
                          <tr>
                            <th>
                              <input type="checkbox" checked={allSelected} onChange={() => setSelectedInvoiceIds(prev => { const next = new Set(prev); if (allSelected) filteredProjects.forEach(p => next.delete(p.id)); else filteredProjects.forEach(p => next.add(p.id)); return next; })} />
                            </th>
                            <th>현장명</th>
                            <th>고객사</th>
                            <th>계약금액</th>
                            <th>계산서 상태</th>
                            <th>발행(예정)일</th>
                            <th>수금상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProjects.map(p => (
                            <tr key={p.id} className={selectedInvoiceIds.has(p.id) ? 'selected-row' : ''}>
                              <td>
                                <input type="checkbox" checked={selectedInvoiceIds.has(p.id)} onChange={() => setSelectedInvoiceIds(prev => { const next = new Set(prev); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })} />
                              </td>
                              <td className="bold">{p.site_name}</td>
                              <td>{p.customer_name}</td>
                              <td className="right">{Math.floor(p.total_amount || 0).toLocaleString()}원</td>
                              <td>
                                <button
                                  className={`btn-invoice-status ${p.invoice_status === '발급완료' ? 'done' : 'pending'}`}
                                  onClick={() => handleProjectUpdateImmediate(p.id, 'invoice_status', p.invoice_status === '발급완료' ? '미발급' : '발급완료')}
                                >
                                  {p.invoice_status === '발급완료' ? '✓ 발급완료' : '미발급'}
                                </button>
                              </td>
                              <td>
                                <input type="date" value={p.invoice_date || ''} onChange={e => handleProjectUpdateImmediate(p.id, 'invoice_date', e.target.value)} />
                              </td>
                              <td>
                                <span className={`status-badge ${p.payment_status}`}>{p.payment_status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : view === 'quotation' ? (
          <div className="quotation-card">
            <h1>견적서 작성</h1>
            <div className="form-section">
              <h3>공급자 정보
                <button className="btn-save-profile" onClick={saveCompanyProfile}>공급자정보 저장</button>
              </h3>
              <p className="profile-hint">저장하면 다음 로그인 시 자동으로 불러옵니다.</p>
              <div className="grid">
                <input type="text" placeholder="상호" value={provider.name} onChange={e => setProvider({...provider, name: e.target.value})} />
                <input type="text" placeholder="영문 상호" value={provider.brandTagline} onChange={e => setProvider({...provider, brandTagline: e.target.value})} />
                <input type="text" placeholder="대표자" value={provider.representative} onChange={e => setProvider({...provider, representative: e.target.value})} />
                <input type="text" placeholder="사업자번호" value={provider.businessNo} onChange={e => setProvider({...provider, businessNo: e.target.value})} />
                <input type="text" placeholder="주소" value={provider.address} onChange={e => setProvider({...provider, address: e.target.value})} />
                <input type="text" placeholder="연락처" value={provider.contact} onChange={e => setProvider({...provider, contact: e.target.value})} />
              </div>
            </div>
            <div className="form-section">
              <h3>수요자 및 견적 정보</h3>
              <div className="grid">
                <input type="text" placeholder="고객명" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                <input type="text" placeholder="연락처" value={customer.contact} onChange={e => setCustomer({...customer, contact: e.target.value})} />
                <input type="date" value={customer.date} onChange={e => setCustomer({...customer, date: e.target.value})} />
                <input type="text" placeholder="견적번호" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} />
              </div>
              <textarea className="remarks-input" value={greeting} onChange={e => setGreeting(e.target.value)} rows={2} />
            </div>
            <div className="items-section">
              <h3>품목 관리</h3>
              <table>
                <thead><tr><th>품명</th><th>단위</th><th>수량</th><th>단가</th><th>소계</th><th>특이사항<br/><small style={{fontSize: '0.75em', fontWeight: 'normal', color: '#999'}}>품목아래 표기됨</small></th><th>비고</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'door').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{Math.floor(i.quantity * i.unitPrice).toLocaleString()}</td><td><input value={i.specialNote} onChange={e => updateItem(i.id, 'specialNote', e.target.value)} /></td><td><input value={i.remarks} onChange={e => updateItem(i.id, 'remarks', e.target.value)} /></td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('door')} className="btn-add">+ 추가</button>
            </div>
            <div className="items-section">
              <h3>품목 관리 - 옵션항목</h3>
              <table>
                <thead><tr><th>품명</th><th>단위</th><th>수량</th><th>단가</th><th>소계</th><th>특이사항<br/><small style={{fontSize: '0.75em', fontWeight: 'normal', color: '#999'}}>품목아래 표기됨</small></th><th>비고</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'option').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{Math.floor(i.quantity * i.unitPrice).toLocaleString()}</td><td><input value={i.specialNote} onChange={e => updateItem(i.id, 'specialNote', e.target.value)} /></td><td><input value={i.remarks} onChange={e => updateItem(i.id, 'remarks', e.target.value)} /></td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('option')} className="btn-add">+ 추가</button>
            </div>
            <div className="form-section"><h3>특이사항</h3><textarea className="remarks-input" placeholder="※ 납기일: 발주 후 30일 이내&#10;※ 결제조건: 선금-50%,  잔금-공사 완료 후 즉시&#10;※ 부가세 포함 금액입니다." value={remarks} onChange={e => setRemarks(e.target.value)} rows={4} /></div>
            <div className="form-section">
              <h3>로고 및 자사 소개
                <label className="intro-toggle-label">
                  <input type="checkbox" checked={showIntroInPrint} onChange={e => setShowIntroInPrint(e.target.checked)} />
                  출력에 포함
                </label>
                <button className="btn-save-intro" onClick={saveCompanyIntro}>자사소개 저장</button>
              </h3>
              <div className="logo-upload-area">
                {logoDataUrl && <img src={logoDataUrl} alt="logo-preview" className="logo-preview" />}
                <label className="btn-logo-upload">
                  {logoDataUrl ? '로고 변경' : '🖼 로고 업로드'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{display:'none'}} />
                </label>
                {logoDataUrl && <button className="btn-logo-remove" onClick={() => setLogoDataUrl('')}>로고 제거</button>}
              </div>
              <textarea className="remarks-input" placeholder="자사 소개 내용을 입력하세요 (출력 시 견적서 하단에 디자인 카드로 표시됩니다)" value={companyIntro} onChange={e => setCompanyIntro(e.target.value)} rows={5} />
            </div>
            <div className="summary-section"><div className="row total">합계금액: ₩{Math.floor(items.reduce((s, i) => s + Math.floor(i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</div></div>
            <div className="btn-group-main"><button onClick={saveCurrentQuotation} className="btn-save">클라우드 저장</button><button onClick={handlePrint} className="btn-print">인쇄 / PDF</button></div>
          </div>
        ) : view === 'blog' ? (
          <div className="quotation-card blog-view">
            <div className="blog-header-box">
              <h1>✨ AI 블로그 포스팅 생성기</h1>
              <p>현장 정보만 입력하면 베테랑 실장님이 글을 써드립니다.</p>
            </div>

            {/* API 키 설정 섹션 */}
            <div className="api-key-section">
              {googleApiKey ? (
                <div className="api-key-display">
                  <div>
                    <h3>🔑 Google API 키 설정됨 <span style={{fontSize: '12px', color: '#0369a1'}}>⏰ 세션 중</span></h3>
                    <p className="api-key-masked">{maskApiKey(googleApiKey)}</p>
                    <small style={{color: '#64748b', marginTop: '5px', display: 'block'}}>새로고침 시 자동으로 초기화됩니다</small>
                  </div>
                  <button onClick={() => setShowApiKeyInput(true)} className="btn-small">다시 입력</button>
                </div>
              ) : (
                <div>
                  <h3>🔑 Google API 키 설정 필요</h3>
                  {!showApiKeyInput ? (
                    <div className="api-key-guide">
                      <p style={{marginBottom: '15px'}}>AI 블로그 생성을 위해 Google의 Gemini API 키가 필요합니다.<br/>아래 단계를 따라 API 키를 발급받아주세요:</p>
                      <ol className="guide-steps">
                        <li>
                          <strong>1단계:</strong>
                          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"> Google AI Studio</a> 접속
                        </li>
                        <li>
                          <strong>2단계:</strong> 우상단의 <strong>「API 키 받기」</strong> 버튼 클릭
                        </li>
                        <li>
                          <strong>3단계:</strong> <strong>「새 프로젝트에서 API 키 생성」</strong> 클릭
                        </li>
                        <li>
                          <strong>4단계:</strong> 생성된 API 키를 복사하여 아래에 붙여넣으세요.
                        </li>
                      </ol>
                      <div style={{backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '15px', fontSize: '13px', lineHeight: '1.6', color: '#92400e'}}>
                        <strong>💡 팁:</strong> 한 번 발급받은 키는 메모장에 저장해두시고 계속 사용이 가능합니다.<br/>
                        <strong>⚠️ 주의:</strong> API 키를 타인과 공유하지 마세요. 노출 시 비용 청구가 될 수 있습니다.
                      </div>
                      <button onClick={() => setShowApiKeyInput(true)} className="btn-primary">API 키 입력</button>
                    </div>
                  ) : (
                    <div className="api-key-input-form">
                      <div style={{backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#991b1b'}}>
                        <strong>🔒 보안 주의:</strong> 이 페이지에서 입력한 키는 브라우저 메모리에만 유지되며 서버에 저장되지 않습니다. 새로고침하면 초기화됩니다.
                      </div>
                      <input
                        type="password"
                        placeholder="AIza... (예: AIzaSyDAerE1lUDYgYwRtoZxv1gK9GcdD3EZzCM)"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleApiKeySubmit()}
                      />
                      <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                        <button onClick={handleApiKeySubmit} className="btn-primary">설정</button>
                        <button onClick={() => {setShowApiKeyInput(false); setApiKeyInput('');}} className="btn-secondary">취소</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="blog-main-layout">
              <div className="blog-input-side">
                <div className="form-section">
                  <h3>🏠 현장 기본 정보</h3>
                  <div className="grid">
                    <div className="input-group">
                      <label>현장명 (지역 및 아파트명)</label>
                      <input placeholder="예: 서초동 래미안 34평형" value={blogData.siteName} onChange={e => setBlogData({...blogData, siteName: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>인테리어 스타일</label>
                      <select value={['모던 화이트', '내추럴 우드', '미니멀리즘', '프렌치 클래식', '산업형 빈티지', '따뜻한 베이지', '스칸디나비안', '보호드', '인더스트리얼', '북유럽', '지중해 스타일', '클래식 모던'].includes(blogData.style) ? blogData.style : '기타'} onChange={e => {
                        if (e.target.value === '기타') {
                          setBlogData({...blogData, style: ''});
                        } else {
                          setBlogData({...blogData, style: e.target.value});
                        }
                      }}>
                        <option value="모던 화이트">모던 화이트</option>
                        <option value="내추럴 우드">내추럴 우드</option>
                        <option value="미니멀리즘">미니멀리즘</option>
                        <option value="프렌치 클래식">프렌치 클래식</option>
                        <option value="산업형 빈티지">산업형 빈티지</option>
                        <option value="따뜻한 베이지">따뜻한 베이지</option>
                        <option value="스칸디나비안">스칸디나비안</option>
                        <option value="보호드">보호드</option>
                        <option value="인더스트리얼">인더스트리얼</option>
                        <option value="북유럽">북유럽</option>
                        <option value="지중해 스타일">지중해 스타일</option>
                        <option value="클래식 모던">클래식 모던</option>
                        <option value="기타">기타 (직접입력)</option>
                      </select>
                      {!['모던 화이트', '내추럴 우드', '미니멀리즘', '프렌치 클래식', '산업형 빈티지', '따뜻한 베이지', '스칸디나비안', '보호드', '인더스트리얼', '북유럽', '지중해 스타일', '클래식 모던'].includes(blogData.style) && (
                        <input
                          placeholder="스타일명 입력"
                          value={blogData.style}
                          onChange={e => setBlogData({...blogData, style: e.target.value})}
                          style={{marginTop: '10px'}}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>🔨 핵심 시공 및 자재</h3>
                  <div className="input-group">
                    <label>핵심 시공 내용 (강조하고 싶은 포인트)</label>
                    <textarea 
                      placeholder="예: 주방 대면형 구조 변경, 거실 실물 라인 조명 설치, 무몰딩 도배 등" 
                      value={blogData.features} 
                      onChange={e => setBlogData({...blogData, features: e.target.value})}
                      rows={4}
                    />
                  </div>
                  <div className="input-group" style={{marginTop:'15px'}}>
                    <label>주요 사용 자재</label>
                    <input 
                      placeholder="예: LX 지인 바닥재, 융 스위치, 600각 포세린 타일" 
                      value={blogData.materials} 
                      onChange={e => setBlogData({...blogData, materials: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h3>👤 글쓴이 역할 지정</h3>
                  <div className="input-group">
                    <input
                      placeholder="예: 10년 차 베테랑 인테리어 실장, 디자이너, 건축가 등"
                      value={blogData.role}
                      onChange={e => setBlogData({...blogData, role: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h3>✍️ 글의 분위기</h3>
                  <div className="tone-grid">
                    {['전문적이고 신뢰감 있는', '따뜻하고 감성적인', '친근하고 유머러스한', '간결하고 명확한'].map(t => (
                      <button 
                        key={t} 
                        className={`btn-tone ${blogData.tone === t ? 'active' : ''}`}
                        onClick={() => setBlogData({...blogData, tone: t})}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  className={`btn-generate-blog ${blogData.isGenerating ? 'loading' : ''}`} 
                  onClick={generateBlogPost}
                  disabled={blogData.isGenerating}
                >
                  {blogData.isGenerating ? (
                    <>
                      <span className="spinner"></span>
                      베테랑 실장님이 글을 쓰는 중...
                    </>
                  ) : '🪄 고효율 블로그 글 생성하기'}
                </button>
              </div>

              <div className="blog-result-side">
                <div className="result-header">
                  <h3>📝 생성된 포스팅 결과</h3>
                  {blogData.result && (
                    <button className="btn-copy-result" onClick={() => {
                      navigator.clipboard.writeText(blogData.result);
                      alert('클립보드에 복사되었습니다!');
                    }}>📋 복사하기</button>
                  )}
                </div>
                <div className="result-content-area">
                  {blogData.result ? (
                    <div className="generated-text-wrapper">
                      {blogData.result.split('\n').map((line, i) => (
                        <p key={i}>{line || '\u00A0'}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="result-empty">
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      <p>왼쪽 정보를 입력하고 버튼을 누르면<br/>전문가급 블로그 글이 여기 나타납니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 인테리어 실측 템플릿 */
          <div className="quotation-card">
            <h1>인테리어 실측 리포트</h1>

            <div className="form-section">
              <h3>기본 정보</h3>
              <div className="grid">
                <input placeholder="현장명 / 프로젝트명" value={measureData.siteName} onChange={e => setMeasureData({...measureData, siteName: e.target.value})} />
                <input placeholder="고객명" value={measureData.customerName} onChange={e => setMeasureData({...measureData, customerName: e.target.value})} />
                <input placeholder="연락처" value={measureData.contact} onChange={e => setMeasureData({...measureData, contact: e.target.value})} />
                <input placeholder="현장 주소" value={measureData.address} onChange={e => setMeasureData({...measureData, address: e.target.value})} />
                <input type="date" value={measureData.date} onChange={e => setMeasureData({...measureData, date: e.target.value})} />
                <input placeholder="실측자" value={measureData.measurer} onChange={e => setMeasureData({...measureData, measurer: e.target.value})} />
              </div>
            </div>

            <div className="form-section">
              <h3>공간별 실측</h3>
              {measureData.spaces.map((space, idx) => (
                <div key={space.id} className="door-input-box">
                  <div className="door-header">
                    <input className="space-name-input" placeholder="공간명 (예: 거실, 주방, 침실1)" value={space.name} onChange={e => updateSpace(space.id, 'name', e.target.value)} />
                    {idx > 0 && <button className="btn-remove-door" onClick={() => removeSpace(space.id)}>삭제</button>}
                  </div>
                  <div className="measure-section-label">📐 규격 (mm)</div>
                  <div className="grid">
                    <input type="number" placeholder="가로(W)" value={space.width} onChange={e => updateSpace(space.id, 'width', e.target.value)} />
                    <input type="number" placeholder="세로(D)" value={space.depth} onChange={e => updateSpace(space.id, 'depth', e.target.value)} />
                    <input type="number" placeholder="천장고(H)" value={space.height} onChange={e => updateSpace(space.id, 'height', e.target.value)} />
                    <input placeholder="창문 위치/크기" value={space.window} onChange={e => updateSpace(space.id, 'window', e.target.value)} />
                    <input placeholder="출입문 위치/크기" value={space.doorInfo} onChange={e => updateSpace(space.id, 'doorInfo', e.target.value)} />
                  </div>
                  <div className="measure-section-label">🪵 마감재</div>
                  <div className="finish-grid">
                    <div className="finish-row-header"><span/><span>현재 상태</span><span>제안/교체</span></div>
                    <div className="finish-row"><span>바닥재</span><input placeholder="현재" value={space.floorCurrent} onChange={e => updateSpace(space.id, 'floorCurrent', e.target.value)} /><input placeholder="제안" value={space.floorPlan} onChange={e => updateSpace(space.id, 'floorPlan', e.target.value)} /></div>
                    <div className="finish-row"><span>벽면</span><input placeholder="현재" value={space.wallCurrent} onChange={e => updateSpace(space.id, 'wallCurrent', e.target.value)} /><input placeholder="제안" value={space.wallPlan} onChange={e => updateSpace(space.id, 'wallPlan', e.target.value)} /></div>
                    <div className="finish-row"><span>천장</span><input placeholder="현재" value={space.ceilCurrent} onChange={e => updateSpace(space.id, 'ceilCurrent', e.target.value)} /><input placeholder="제안" value={space.ceilPlan} onChange={e => updateSpace(space.id, 'ceilPlan', e.target.value)} /></div>
                  </div>
                  <textarea className="remarks-input" placeholder="공간 특이사항 메모" value={space.notes} onChange={e => updateSpace(space.id, 'notes', e.target.value)} rows={2} />
                  <div className="door-photo-section">
                    <label>사진 업로드 <span style={{ fontSize: '0.85em', color: '#999' }}>사진은 1:1 비율로 업로드하시면 출력 시 더 잘보입니다</span></label>
                    <input type="file" multiple accept="image/*" onChange={e => handleSpacePhotoUpload(space.id, e)} disabled={isUploading[space.id]} />
                    {isUploading[space.id] && (
                      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9em', color: '#666' }}>
                          <span>업로드 중...</span>
                          <span>{uploadProgress[space.id] || 0}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', backgroundColor: '#3b82f6', width: `${uploadProgress[space.id] || 0}%`, transition: 'width 0.2s ease' }} />
                        </div>
                      </div>
                    )}
                    <div className="photo-preview-grid">
                      {space.photos.map((p, i) => (
                        <div key={i} className="photo-preview">
                          <img src={p} alt="space" />
                          <button onClick={() => updateSpace(space.id, 'photos', space.photos.filter((_, pi) => pi !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn-add-door" onClick={addSpace}>+ 공간 추가</button>
            </div>

            <div className="form-section">
              <h3>공사 항목 체크리스트</h3>
              <div className="checklist-grid">
                {([
                  ['demolition','철거','🔨'], ['flooring','바닥재','🪵'], ['wallpaper','도배/도장','🎨'],
                  ['carpentry','목공','🪚'], ['electric','전기','⚡'], ['plumbing','배관/위생','🚿'],
                  ['tile','타일','🧱'], ['lighting','조명','💡'], ['furniture','가구/붙박이','🪑'],
                  ['etc','기타','📝']
                ] as [keyof WorkChecklist, string, string][]).map(([key, label, icon]) => (
                  <label key={key} className={`checklist-item ${measureData.checklist[key] ? 'checked' : ''}`}>
                    <input type="checkbox" checked={!!measureData.checklist[key]} onChange={e => toggleChecklist(key, e.target.checked)} style={{display:'none'}} />
                    <span className="check-icon">{icon}</span>
                    <span className="check-label">{label}</span>
                    {measureData.checklist[key] && <span className="check-mark">✓</span>}
                  </label>
                ))}
              </div>
              {measureData.checklist.etc && (
                <input className="etc-note-input" placeholder="기타 공사 내용 입력" value={measureData.checklist.etcNote} onChange={e => toggleChecklist('etcNote', e.target.value)} />
              )}
            </div>

            <div className="form-section">
              <h3>종합 메모</h3>
              <textarea className="remarks-input" placeholder="고객 요청사항, 특이사항, 주의사항 등" value={measureData.specialNotes} onChange={e => setMeasureData({...measureData, specialNotes: e.target.value})} rows={4} />
            </div>

            <div className="btn-group-main"><button onClick={saveCurrentMeasurement} className="btn-save">실측 리포트 저장</button><button onClick={handlePrint} className="btn-print">인쇄 / PDF</button></div>
          </div>
        )}

        {view !== 'dashboard' && view !== 'blog' && (
          <div className="saved-list-panel">
            {view === 'quotation' ? (
              <>
                <h3>견적 저장내역</h3>
                {savedQuotations.length > 0 && (
                  <div className="search-bar-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="고객사명, 견적번호 검색..." value={searchQuotation} onChange={e => setSearchQuotation(e.target.value)} />
                    {searchQuotation && <button className="search-clear" onClick={() => setSearchQuotation('')}>&times;</button>}
                  </div>
                )}
                <div className="saved-items">
                  {savedQuotations.filter(q => {
                    if (!searchQuotation) return true;
                    const s = searchQuotation.toLowerCase();
                    const customerName = typeof q.customer === 'string' ? q.customer : (q.customer?.name || '');
                    return customerName.toLowerCase().includes(s) || (q.quoteNumber || '').toLowerCase().includes(s);
                  }).map(q => (
                    <div key={q.id} className="saved-item">
                      <div className="item-info" onClick={() => loadQuotation(q)}>
                        <div className="item-name">{(typeof q.customer === 'string' ? q.customer : q.customer?.name) || '(무명)'}</div>
                        <div className="item-date">{new Date(q.created_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => deleteQuotation(q.id)} className="btn-item-delete">&times;</button>
                    </div>
                  ))}
                  {savedQuotations.length > 0 && searchQuotation && savedQuotations.filter(q => {
                    const customerName = typeof q.customer === 'string' ? q.customer : (q.customer?.name || '');
                    return customerName.toLowerCase().includes(searchQuotation.toLowerCase()) || (q.quoteNumber || '').toLowerCase().includes(searchQuotation.toLowerCase());
                  }).length === 0 && (
                    <div className="search-no-result">검색 결과가 없습니다</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3>실측 저장내역</h3>
                {savedMeasurements.length > 0 && (
                  <div className="search-bar-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="현장명, 고객사명 검색..." value={searchMeasurement} onChange={e => setSearchMeasurement(e.target.value)} />
                    {searchMeasurement && <button className="search-clear" onClick={() => setSearchMeasurement('')}>&times;</button>}
                  </div>
                )}
                <div className="saved-items">
                  {savedMeasurements.filter(m => {
                    if (!searchMeasurement) return true;
                    const s = searchMeasurement.toLowerCase();
                    return (m.site_name || '').toLowerCase().includes(s) || (m.customer_name || '').toLowerCase().includes(s);
                  }).map(m => (
                    <div key={m.id} className="saved-item">
                      <div className="item-info" onClick={() => loadMeasurement(m)}>
                        <div className="item-name">{m.site_name || '(무명현장)'}</div>
                        <div className="item-date">{new Date(m.created_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => deleteMeasurement(m.id)} className="btn-item-delete">&times;</button>
                    </div>
                  ))}
                  {savedMeasurements.length > 0 && searchMeasurement && savedMeasurements.filter(m => (m.site_name || '').toLowerCase().includes(searchMeasurement.toLowerCase()) || (m.customer_name || '').toLowerCase().includes(searchMeasurement.toLowerCase())).length === 0 && (
                    <div className="search-no-result">검색 결과가 없습니다</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* --- 인쇄용 프리뷰 영역 --- */}
      {view === 'quotation' && (
        <div className="print-only quotation-sheet">
          <div className="sheet-border-top" />
          <header className="sheet-header">
            <div className="header-top">
              <div className="company-branding">
                {showIntroInPrint && logoDataUrl
                  ? <img src={logoDataUrl} alt="logo" className="print-logo" />
                  : <><h2 className="brand-name">{provider.name}</h2><p className="brand-tagline">{provider.brandTagline}</p></>
                }
              </div>
              <div className="doc-title-wrapper">
                <h1 className="doc-title">견 적 서</h1>
                <div className="doc-number">{quoteNumber}</div>
              </div>
            </div>
            <div className="header-bottom">
              <div className="client-box">
                <div className="label">RECIPIENT</div>
                <div className="client-name">{customer.name || '(상호를 입력하세요)'} <span className="honorific">귀하</span></div>
                <div className="client-contact">{customer.contact}</div>
                <div className="quote-intro">{greeting.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
              </div>
              <div className="provider-box">
                <div className="label">SENDER</div>
                <div className="provider-details">
                  <div className="row"><span className="p-label">등록번호</span> {provider.businessNo}</div>
                  <div className="row"><span className="p-label">상 호</span> {provider.name}</div>
                  <div className="row"><span className="p-label">대 표 자</span> {provider.representative}</div>
                  <div className="row"><span className="p-label">주 소</span> {provider.address}</div>
                  <div className="row"><span className="p-label">연 락 처</span> {provider.contact}</div>
                </div>
              </div>
            </div>
          </header>

          <section className="total-bar">
            <div className="total-label">견적 총 합계액 <span className="small">(VAT포함)</span></div>
            <div className="total-value"><span className="currency">KRW</span><span className="amount">{Math.floor(items.reduce((s, i) => s + Math.floor(i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</span></div>
            <div className="issue-date">발행일: {customer.date}</div>
          </section>

          <table className="sheet-table">
            <thead>
              <tr><th className="w-no">NO</th><th className="w-desc">품명 및 규격</th><th className="w-unit-name">단위</th><th className="w-qty">수량</th><th className="w-unit">단가</th><th className="w-amount">금액</th><th className="w-remarks">비고</th></tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="center">{idx + 1}</td>
                  <td className="desc-text">{item.name}{item.specialNote && <><br/><small className="dim">{item.specialNote}</small></>}</td>
                  <td className="center">{item.unit}</td><td className="center">{item.quantity}</td><td className="right">{Math.floor(item.unitPrice).toLocaleString()}</td><td className="right">{Math.floor(item.quantity * item.unitPrice).toLocaleString()}</td><td className="center small-text">{item.remarks}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 10 - items.length))].map((_, i) => (
                <tr key={`empty-${i}`} className="empty-row"><td className="center">{items.length + i + 1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table>

          <div className="sheet-footer">
            <div className="footer-left"><div className="remarks-box"><div className="label">SPECIAL NOTES / REMARKS</div><div className="remarks-content">{remarks.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div></div></div>
            <div className="footer-right">
              <div className="calc-row"><span className="c-label">공급가액 합계</span><span className="c-value">{Math.floor(items.reduce((s, i) => s + Math.floor(i.quantity * i.unitPrice), 0)).toLocaleString()}</span></div>              <div className="calc-row"><span className="c-label">부가가치세 (10%)</span><span className="c-value">{Math.floor(items.reduce((s, i) => s + Math.floor(i.quantity * i.unitPrice), 0) * 0.1).toLocaleString()}</span></div>
              <div className="calc-total"><span className="c-label">총 합계금액</span><span className="c-value">₩ {Math.floor(items.reduce((s, i) => s + Math.floor(i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</span></div>            </div>
          </div>

          <div className="sheet-final"><p>견적 유효기간: 발행일로부터 15일</p><div className="signature-area"><p>위와 같이 견적 하오니, 긍정적인 검토 부탁드립니다.</p><div className="sign-box">{customer.date.split('-')[0]}년 {customer.date.split('-')[1]}월 {customer.date.split('-')[2]}일</div></div></div>

          {showIntroInPrint && companyIntro && (
            <div className="company-intro-page">
              <div className="intro-header">
                <div className="intro-header-left">
                  {logoDataUrl && <img src={logoDataUrl} alt="logo" className="intro-logo" />}
                  <div>
                    <h2 className="intro-company-name">{provider.name}</h2>
                    {provider.brandTagline && <p className="intro-tagline">{provider.brandTagline}</p>}
                  </div>
                </div>
                <div className="intro-title-badge">회 사 소 개</div>
              </div>
              <div className="intro-divider" />
              <div className="intro-content">
                {companyIntro.split('\n').map((line, i) => <p key={i}>{line || <br />}</p>)}
              </div>
              <div className="intro-footer">
                <div className="intro-footer-info">
                  {provider.address && <span>📍 {provider.address}</span>}
                  {provider.contact && <span>📞 {provider.contact}</span>}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {view === 'measurement' && (
        <div className="print-only measurement-sheet">
          <div className="sheet-border-top" />
          <header className="m-header">
            <div className="m-header-top">
              {logoDataUrl && <img src={logoDataUrl} alt="logo" className="m-logo" />}
              <div>
                <h1>인테리어 실측 리포트</h1>
                <div className="m-meta">
                  <span>프로젝트: {measureData.siteName}</span>
                  <span>실측일: {measureData.date}</span>
                  <span>실측자: {measureData.measurer}</span>
                </div>
              </div>
            </div>
          </header>

          <table className="m-table">
            <tbody>
              <tr><th>고객명</th><td>{measureData.customerName}</td><th>연락처</th><td>{measureData.contact}</td></tr>
              <tr><th>현장 주소</th><td colSpan={3}>{measureData.address}</td></tr>
            </tbody>
          </table>

          {measureData.spaces.map((space, idx) => (
            <div key={space.id} className="m-space-block">
              <div className="m-space-title">공간 {idx + 1}. {space.name}</div>
              <table className="m-table">
                <tbody>
                  <tr>
                    <th>규격 (W×D×H)</th>
                    <td>{space.width && space.depth && space.height ? `${space.width} × ${space.depth} × ${space.height} mm` : '-'}</td>
                    <th>창문</th><td>{space.window || '-'}</td>
                  </tr>
                  <tr><th>출입문</th><td>{space.doorInfo || '-'}</td><th/><td/></tr>
                  <tr><th>바닥재</th><td>현재: {space.floorCurrent || '-'}</td><th>→ 제안</th><td>{space.floorPlan || '-'}</td></tr>
                  <tr><th>벽면</th><td>현재: {space.wallCurrent || '-'}</td><th>→ 제안</th><td>{space.wallPlan || '-'}</td></tr>
                  <tr><th>천장</th><td>현재: {space.ceilCurrent || '-'}</td><th>→ 제안</th><td>{space.ceilPlan || '-'}</td></tr>
                  {space.notes && <tr><th>특이사항</th><td colSpan={3}>{space.notes}</td></tr>}
                </tbody>
              </table>
              {space.photos.length > 0 && (
                <div className="m-photo-grid">
                  {space.photos.map((p, i) => {
                    // 변환된 base64가 있으면 사용, 없으면 원본 사용
                    const photoSrc = printPhotosBase64[space.id]?.[i] || p;
                    return <div key={i} className="m-photo-item"><img src={photoSrc} alt="space" /></div>;
                  })}
                </div>
              )}
            </div>
          ))}

          {Object.values(measureData.checklist).some(v => v === true) && (
            <div className="m-checklist-section">
              <div className="m-space-title">공사 항목</div>
              <div className="m-checklist-grid">
                {([['demolition','철거','🔨'],['flooring','바닥재','🪵'],['wallpaper','도배/도장','🎨'],['carpentry','목공','🪚'],['electric','전기','⚡'],['plumbing','배관/위생','🚿'],['tile','타일','🧱'],['lighting','조명','💡'],['furniture','가구/붙박이','🪑'],['etc','기타','📝']] as [keyof WorkChecklist, string, string][]).map(([key, label, icon]) =>
                  measureData.checklist[key] ? (
                    <div key={key} className="m-check-badge">
                      <span className="m-badge-icon">{icon}</span>
                      <span className="m-badge-label">✓ {label}{key === 'etc' && measureData.checklist.etcNote ? `: ${measureData.checklist.etcNote}` : ''}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {measureData.specialNotes && (
            <div className="m-notes-section">
              <div className="m-space-title">종합 메모</div>
              <p className="m-notes-content">{measureData.specialNotes}</p>
            </div>
          )}

          <footer className="m-footer"><p>본 실측 리포트는 현장 방문 실측을 기준으로 작성되었습니다.</p>{provider.name && <p className="m-company">{provider.name}</p>}</footer>
        </div>
      )}
      </main>
    </div>
  );
}

export default App;
