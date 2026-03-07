import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './App.css';
import React from 'react';
import * as XLSX from 'xlsx';

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
  invoice_status: '미발급' | '완료';
  payment_date: string;
  payment_status: '미수금' | '일부수금' | '완료';
  notes: string;
  biz_name: string;
  biz_owner: string;
  biz_address: string;
  biz_type: string;
  biz_item: string;
  biz_email: string;
}

interface WorkItem {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  type: '실측' | '시공';
  date: string;
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
  date: string;
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
  date: string;
  measurer: string;
  doors: InteriorSpace[];
  options: WorkChecklist;
  power_source: string;
  floor_condition: string;
  special_notes: string;
}

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

function App() {
  // --- 인증 관련 상태 ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [authInputs, setAuthViewInputs] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(true);

  // --- 메인 앱 상태 ---
  const [view, setView] = useState<'quotation' | 'measurement' | 'dashboard'>('dashboard');
  const [dashboardMode, setDashboardMode] = useState<'list' | 'calendar' | 'invoice'>('list');
  const [invoiceFilter, setInvoiceFilter] = useState<'전체' | '미발급' | '완료'>('전체');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [items, setItems] = useState<Item[]>([
    { id: '1', type: 'door', name: '', unit: 'SET', width: 0, height: 0, quantity: 1, unitPrice: 0, specialNote: '', remarks: '' }
  ]);
  const [provider, setProvider] = useState(initialProvider);
  const [customer, setCustomer] = useState(initialCustomer);
  const [quoteNumber, setQuoteNumber] = useState(`SD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-01`);
  const [greeting, setGreeting] = useState('평소 베풀어 주신 각별한 성원에 감사드리며,\n아래와 같이 견적을 제출하오니 검토 부탁드립니다.');
  const [remarks, setRemarks] = useState('※ 납기일: 발주 후 30일 이내\n※ 결제조건: 선금 50%, 잔금 설치 후 즉시\n※ 부가세 포함 금액입니다.');
  
  const [savedQuotations, setSavedQuotations] = useState<SavedQuotation[]>([]);
  const [savedMeasurements, setSavedMeasurements] = useState<SavedMeasurement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [companyIntro, setCompanyIntro] = useState('');
  const [showIntroInPrint, setShowIntroInPrint] = useState(false);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchQuotations();
      fetchMeasurements();
      fetchProjects();
      fetchWorkItems();
      fetchSubcontracts();
    }
  }, [currentUser]);

  // --- DB 로직 (대시보드/프로젝트) ---
  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error) setProjects(data || []);
  };

  const fetchWorkItems = async () => {
    const { data, error } = await supabase.from('work_items').select('*').order('created_at', { ascending: true });
    if (!error) setWorkItems(data || []);
  };

  const fetchSubcontracts = async () => {
    const { data, error } = await supabase.from('subcontracts').select('*').order('created_at', { ascending: true });
    if (!error) setSubcontracts(data || []);
  };

  const addSubcontract = async (projectId: string) => {
    if (!currentUser) return;
    const { error } = await supabase.from('subcontracts').insert([{
      project_id: projectId, user_id: currentUser.id,
      label: '', amount: 0, invoice_issued: false, payment_done: false, date: ''
    }]);
    if (!error) fetchSubcontracts();
  };

  const updateSubcontract = async (id: string, field: string, value: any) => {
    setSubcontracts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    await supabase.from('subcontracts').update({ [field]: value }).eq('id', id);
  };

  const deleteSubcontract = async (id: string) => {
    await supabase.from('subcontracts').delete().eq('id', id);
    setSubcontracts(prev => prev.filter(s => s.id !== id));
  };

  const addProject = async () => {
    if (!currentUser) return;
    const siteName = prompt('신규 현장명을 입력하세요:');
    if (!siteName) return;
    const { error } = await supabase.from('projects').insert([{
      user_id: currentUser.id,
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
      biz_email: ''
    }]);
    if (error) alert('생성 실패: ' + error.message);
    else fetchProjects();
  };

  const addWorkItem = async (projectId: string, count: number) => {
    if (!currentUser) return;
    const { error } = await supabase.from('work_items').insert([{
      project_id: projectId,
      user_id: currentUser.id,
      label: `공정${count + 1}`,
      type: '시공',
      date: '',
      status: '실측예정'
    }]);
    if (!error) fetchWorkItems();
  };

  const updateWorkItem = async (id: string, field: string, value: string) => {
    setWorkItems(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    await supabase.from('work_items').update({ [field]: value }).eq('id', id);
  };

  const deleteWorkItem = async (id: string) => {
    await supabase.from('work_items').delete().eq('id', id);
    setWorkItems(prev => prev.filter(w => w.id !== id));
  };

  const exportFilteredProjectsToExcel = (filteredProjects: Project[]) => {
    if (filteredProjects.length === 0) {
      alert("출력할 데이터가 없습니다.");
      return;
    }

    const header = ["현장명", "고객사", "계약금액", "계산서상태", "발행(예정)일", "상호", "성명", "이메일", "업태", "종목", "사업장주소"];
    const rows = filteredProjects.map(p => [
      p.site_name,
      p.customer_name,
      p.total_amount,
      p.invoice_status,
      p.invoice_date || "-",
      p.biz_name || "-",
      p.biz_owner || "-",
      p.biz_email || "-",
      p.biz_type || "-",
      p.biz_item || "-",
      p.biz_address || "-"
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "계산서 발행 리스트");
    
    XLSX.writeFile(workbook, `계산서발행현황_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateProjectLocal = (id: string, field: string, value: any) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const syncProjectToDB = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from('projects').update({ [field]: value }).eq('id', id);
    if (error) console.error('DB Sync Error:', error.message);
  };

  const handleProjectUpdateImmediate = (id: string, field: string, value: any) => {
    updateProjectLocal(id, field, value);
    syncProjectToDB(id, field, value);
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('현장 데이터를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) fetchProjects();
  };

  // --- DB 로직 (견적서) ---
  const fetchQuotations = async () => {
    const { data, error } = await supabase.from('quotations').select('*').order('created_at', { ascending: false });
    if (!error) setSavedQuotations(data || []);
  };

  const saveCurrentQuotation = async () => {
    if (!currentUser) return;
    const { error } = await supabase.from('quotations').insert([{
      user_id: currentUser.id, items, provider, customer, quoteNumber, greeting, remarks, total_amount: items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0) * 1.1
    }]);
    if (error) alert('저장 실패: ' + error.message);
    else { alert('견적서가 저장되었습니다.'); fetchQuotations(); }
  };

  const deleteQuotation = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (!error) fetchQuotations();
  };

  // --- DB 로직 (실측) ---
  const fetchMeasurements = async () => {
    const { data, error } = await supabase.from('measurements_v2').select('*').order('created_at', { ascending: false });
    if (!error) setSavedMeasurements(data || []);
  };

  const saveCurrentMeasurement = async () => {
    if (!currentUser) return;
    const { error } = await supabase.from('measurements_v2').insert([{
      user_id: currentUser.id,
      site_name: measureData.siteName,
      customer_name: measureData.customerName,
      date: measureData.date,
      measurer: measureData.measurer,
      doors: measureData.spaces,
      options: measureData.checklist,
      power_source: measureData.contact,
      floor_condition: measureData.address,
      special_notes: measureData.specialNotes
    }]);
    if (error) alert('저장 실패: ' + error.message);
    else { alert('실측 리포트가 저장되었습니다.'); fetchMeasurements(); }
  };

  const deleteMeasurement = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('measurements_v2').delete().eq('id', id);
    if (!error) fetchMeasurements();
  };

  const loadMeasurement = (m: any) => {
    if (!window.confirm('작성 중인 내용이 사라집니다. 불러오시겠습니까?')) return;
    setMeasureData({
      siteName: m.site_name,
      customerName: m.customer_name,
      contact: m.power_source || '',
      address: m.floor_condition || '',
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

  const updateSpace = (id: string, field: keyof InteriorSpace, value: any) => {
    setMeasureData({ ...measureData, spaces: measureData.spaces.map(s => s.id === id ? { ...s, [field]: value } : s) });
  };

  const handleSpacePhotoUpload = (spaceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMeasureData(prev => ({
            ...prev,
            spaces: prev.spaces.map(s => s.id === spaceId ? { ...s, photos: [...s.photos, reader.result as string] } : s)
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const toggleChecklist = (field: keyof WorkChecklist, value: any) => {
    setMeasureData({ ...measureData, checklist: { ...measureData.checklist, [field]: value } });
  };

  // --- 기타 핸들러 ---
  const loadQuotation = (q: SavedQuotation) => {
    if (!window.confirm('작성 중인 내용이 사라집니다. 불러오시겠습니까?')) return;
    setItems(q.items); setProvider(q.provider); setCustomer(q.customer);
    setQuoteNumber(q.quoteNumber); setGreeting(q.greeting); setRemarks(q.remarks);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (authView === 'signup') {
      const { error } = await supabase.auth.signUp({ email: authInputs.email, password: authInputs.password });
      if (error) alert(error.message); else alert('회원가입 완료! 로그인을 시도해 주세요.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authInputs.email, password: authInputs.password });
      if (error) alert('로그인 실패: ' + error.message);
    }
    setIsLoading(false);
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

  if (isLoading) return <div className="loading">로딩 중...</div>;

  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header"><h2>공정관리 대시보드</h2><p>{authView === 'login' ? '로그인이 필요합니다' : '새로운 계정을 만드세요'}</p></div>
          <form onSubmit={handleAuthSubmit}>
            <div className="auth-group"><label>이메일</label><input type="email" required value={authInputs.email} onChange={e => setAuthViewInputs({...authInputs, email: e.target.value})} placeholder="이메일을 입력하세요" /></div>
            <div className="auth-group"><label>비밀번호</label><input type="password" required value={authInputs.password} onChange={e => setAuthViewInputs({...authInputs, password: e.target.value})} placeholder="비밀번호를 입력하세요" /></div>
            <button type="submit" className="btn-auth" disabled={isLoading}>{authView === 'login' ? '로그인' : '회원가입 완료'}</button>
          </form>
          <div className="auth-footer">{authView === 'login' ? <p>계정이 없으신가요? <span onClick={() => setAuthView('signup')}>회원가입</span></p> : <p>이미 계정이 있으신가요? <span onClick={() => setAuthView('login')}>로그인</span></p>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="main-header no-print">
        <div className="user-info"><strong>{currentUser.email}</strong>님 안녕하세요<button onClick={handleLogout}>로그아웃</button></div>
      </header>

      <nav className="main-nav no-print">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>공정 대시보드</button>
        <button className={view === 'quotation' ? 'active' : ''} onClick={() => setView('quotation')}>견적서 작성</button>
        <button className={view === 'measurement' ? 'active' : ''} onClick={() => setView('measurement')}>실측 템플릿</button>
      </nav>

      <div className="main-layout no-print">
        {view === 'dashboard' ? (
          <div className="dashboard-container">
            <div className="dashboard-header">
              <div className="header-left">
                <h1>공정 관리 대시보드</h1>
                <div className="dashboard-tabs">
                  <button className={dashboardMode === 'list' ? 'active' : ''} onClick={() => setDashboardMode('list')}>리스트 보기</button>
                  <button className={dashboardMode === 'calendar' ? 'active' : ''} onClick={() => setDashboardMode('calendar')}>캘린더 보기</button>
                  <button className={dashboardMode === 'invoice' ? 'active' : ''} onClick={() => setDashboardMode('invoice')}>계산서 현황</button>
                </div>
              </div>
              <button className="btn-add-project" onClick={addProject}>+ 새 현장 추가</button>
            </div>

            {dashboardMode === 'list' ? (
              <div className="project-grid">
                {projects.length === 0 && <div className="empty-state">등록된 현장이 없습니다. '새 현장 추가'를 눌러 시작하세요.</div>}
                {projects.map(project => (
                  <div key={project.id} className="project-card" style={{'--card-color': getProjectColor(project.id).border} as React.CSSProperties}>
                    <div className="project-card-header">
                      <div className="project-title">
                        <h3>{project.site_name}</h3>
                        <div className="customer-row">
                          <input
                            className="customer-input"
                            placeholder="캘린더표기 고객사명"
                            value={project.customer_name || ''}
                            onChange={e => updateProjectLocal(project.id, 'customer_name', e.target.value)}
                            onBlur={e => syncProjectToDB(project.id, 'customer_name', e.target.value)}
                          />
                          <button className="btn-add-work" onClick={() => addWorkItem(project.id, workItems.filter(w => w.project_id === project.id).length)}>+ 공정 추가</button>
                          <button className="btn-add-sub" onClick={() => addSubcontract(project.id)}>+ 외주 추가</button>
                        </div>
                      </div>
                      <button className="btn-delete-project" onClick={() => deleteProject(project.id)}>×</button>
                    </div>

                        <div className="project-body">

                        {/* 공정 항목 */}
                        <div className="work-items-section">
                          <div className="work-items-grid">
                            {workItems.filter(w => w.project_id === project.id).map((w, idx) => (
                              <div key={w.id} className={`work-item-chip ${w.status === '완료' ? 'done' : ''}`}>
                                <div className="chip-top">
                                  <span className="chip-index">공정{idx + 1}</span>
                                  <button className="btn-remove-work" onClick={() => deleteWorkItem(w.id)}>×</button>
                                </div>
                                <input
                                  className="work-label-input"
                                  value={w.label}
                                  onChange={e => updateWorkItem(w.id, 'label', e.target.value)}
                                  placeholder="공정명"
                                />
                                <select value={w.status} onChange={e => updateWorkItem(w.id, 'status', e.target.value)} className={`status-select ${w.status.replace(/ /g, '-')}`}>
                                  <option value="실측예정">실측예정</option>
                                  <option value="실측 후 대기">실측 후 대기</option>
                                  <option value="시공확정">시공확정</option>
                                  <option value="시공중">시공중</option>
                                  <option value="완료">완료</option>
                                </select>
                                <input type="date" value={w.date || ''} onChange={e => updateWorkItem(w.id, 'date', e.target.value)} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 외주 관리 */}
                        <div className="subcontract-section">
                          <div className="sub-cards-grid">
                            {subcontracts.filter(s => s.project_id === project.id).map((s, idx) => (
                              <div key={s.id} className={`sub-card ${s.payment_done ? 'done' : ''}`}>
                                <div className="chip-top">
                                  <span className="chip-index">외주{idx + 1}</span>
                                  <button className="btn-remove-work" onClick={() => deleteSubcontract(s.id)}>×</button>
                                </div>
                                <input className="work-label-input" placeholder="공정명" value={s.label} onChange={e => updateSubcontract(s.id, 'label', e.target.value)} />
                                <input className="sub-amount-input" placeholder="금액" type="text" value={s.amount ? formatNumber(s.amount) : ''} onChange={e => updateSubcontract(s.id, 'amount', parseNumber(e.target.value))} />
                                <input type="date" value={s.date || ''} onChange={e => updateSubcontract(s.id, 'date', e.target.value)} />
                                <div className="sub-checks">
                                  <label className={`sub-check ${s.invoice_issued ? 'on' : ''}`}>
                                    <input type="checkbox" checked={s.invoice_issued} onChange={e => updateSubcontract(s.id, 'invoice_issued', e.target.checked)} />
                                    계산서
                                  </label>
                                  <label className={`sub-check ${s.payment_done ? 'on' : ''}`}>
                                    <input type="checkbox" checked={s.payment_done} onChange={e => updateSubcontract(s.id, 'payment_done', e.target.checked)} />
                                    대금지급
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="project-info-row">
                          <div className="amount-field">
                            <span>계약금액:</span>
                            <input
                              type="text"
                              value={formatNumber(project.total_amount)}
                              onChange={e => updateProjectLocal(project.id, 'total_amount', parseNumber(e.target.value))}
                              onBlur={e => syncProjectToDB(project.id, 'total_amount', parseNumber(e.target.value))}
                            />
                          </div>
                          <textarea
                            className="project-notes"
                            placeholder="특이사항 및 메모 입력"
                            value={project.notes || ''}
                            onChange={e => updateProjectLocal(project.id, 'notes', e.target.value)}
                            onBlur={e => syncProjectToDB(project.id, 'notes', e.target.value)}
                            rows={1}
                          />
                        </div>

                        {/* 계산서/수금 - 현장 단위로 관리 */}
                        <div className="invoice-payment-section">
                          <div className="invoice-payment-row">
                            <div className={`status-node ${project.invoice_status === '완료' ? 'done' : ''}`}>
                              <div className="node-label">계산서</div>
                              <select value={project.invoice_status} onChange={e => handleProjectUpdateImmediate(project.id, 'invoice_status', e.target.value)} className={`status-select ${project.invoice_status}`}>
                                <option value="미발급">미발급</option>
                                <option value="완료">완료</option>
                              </select>
                              <input type="date" value={project.invoice_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'invoice_date', e.target.value)} />
                            </div>
                            <div className={`status-node ${project.payment_status === '완료' ? 'done' : ''}`}>
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

                        <div className="biz-info-section">
                          <div className="section-title">계산서 발행 정보</div>
                          <div className="biz-info-grid">
                            <input placeholder="상호" value={project.biz_name || ''} onChange={e => updateProjectLocal(project.id, 'biz_name', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_name', e.target.value)} />
                            <input placeholder="성명" value={project.biz_owner || ''} onChange={e => updateProjectLocal(project.id, 'biz_owner', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_owner', e.target.value)} />
                            <input placeholder="이메일" value={project.biz_email || ''} onChange={e => updateProjectLocal(project.id, 'biz_email', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_email', e.target.value)} />
                            <input placeholder="업태" value={project.biz_type || ''} onChange={e => updateProjectLocal(project.id, 'biz_type', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_type', e.target.value)} />
                            <input placeholder="종목" value={project.biz_item || ''} onChange={e => updateProjectLocal(project.id, 'biz_item', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_item', e.target.value)} />
                            <input placeholder="사업장주소" className="full-width" value={project.biz_address || ''} onChange={e => updateProjectLocal(project.id, 'biz_address', e.target.value)} onBlur={e => syncProjectToDB(project.id, 'biz_address', e.target.value)} />
                          </div>
                        </div>

                  </div>
                </div>
              ))}
            </div>
            ) : dashboardMode === 'calendar' ? (
              <div className="calendar-card">
                <div className="calendar-header">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>&lt;</button>
                  <h2>{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>&gt;</button>
                </div>
                <div className="calendar-grid">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => <div key={day} className="calendar-day-label">{day}</div>)}
                  {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
                  {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayWorkItems = workItems.filter(w => w.date === dateStr);
                    const daySubcontracts = subcontracts.filter(s => s.date === dateStr);

                    return (
                      <div key={day} className="calendar-day">
                        <span className="day-number">{day}</span>
                        <div className="day-events">
                          {dayWorkItems.map(w => {
                            const proj = projects.find(p => p.id === w.project_id);
                            const customerName = proj?.customer_name || proj?.site_name || '';
                            const color = getProjectColor(w.project_id);
                            return (
                              <div key={w.id} className="event" style={{ background: color.bg, color: color.text, borderColor: color.border, borderWidth: '1px', borderStyle: 'solid' }}>
                                {customerName}:{w.label}:{w.status}
                              </div>
                            );
                          })}
                          {daySubcontracts.map(s => {
                            const proj = projects.find(p => p.id === s.project_id);
                            const customerName = proj?.customer_name || proj?.site_name || '';
                            return (
                              <div key={s.id} className="event subcontract-event">
                                🔧 {customerName}:{s.label}:외주
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="invoice-container">
                <div className="invoice-filter-bar">
                  <div className="filter-group">
                    <button className={invoiceFilter === '전체' ? 'active' : ''} onClick={() => setInvoiceFilter('전체')}>전체 ({projects.length})</button>
                    <button className={invoiceFilter === '미발급' ? 'active' : ''} onClick={() => setInvoiceFilter('미발급')}>미발급 ({projects.filter(p => p.invoice_status === '미발급').length})</button>
                    <button className={invoiceFilter === '완료' ? 'active' : ''} onClick={() => setInvoiceFilter('완료')}>발급완료 ({projects.filter(p => p.invoice_status === '완료').length})</button>
                  </div>
                  <div className="invoice-summary">
                    미발급 합계: <span className="highlight">₩{projects.filter(p => p.invoice_status !== '완료').reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString()}</span>
                  </div>
                  <button 
                    className="btn-excel-export-list" 
                    onClick={() => exportFilteredProjectsToExcel(projects.filter(p => invoiceFilter === '전체' ? true : p.invoice_status === invoiceFilter))}
                  >
                    📊 선택된 리스트 엑셀 다운로드
                  </button>
                </div>

                <div className="invoice-list-table">
                  <table>
                    <thead>
                      <tr>
                        <th>현장명</th>
                        <th>고객사</th>
                        <th>계약금액</th>
                        <th>계산서 상태</th>
                        <th>발행(예정)일</th>
                        <th>수금상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects
                        .filter(p => invoiceFilter === '전체' ? true : p.invoice_status === invoiceFilter)
                        .map(p => (
                          <tr key={p.id}>
                            <td className="bold">{p.site_name}</td>
                            <td>{p.customer_name}</td>
                            <td className="right">{(p.total_amount || 0).toLocaleString()}원</td>
                            <td>
                              <select 
                                value={p.invoice_status} 
                                onChange={e => handleProjectUpdateImmediate(p.id, 'invoice_status', e.target.value)}
                                className={`invoice-badge ${p.invoice_status === '완료' ? '완료' : p.invoice_status}`}
                              >
                                <option value="미발급">미발급</option>
                                <option value="완료">발급완료</option>
                              </select>
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
                </div>
              </div>
            )}
          </div>
        ) : view === 'quotation' ? (
          <div className="quotation-card">
            <h1>견적서 작성</h1>
            <div className="form-section">
              <h3>공급자 정보</h3>
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
                <thead><tr><th>품명</th><th>단위</th><th>수량</th><th>단가</th><th>소계</th><th>특이사항</th><th>비고</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'door').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{(i.quantity * i.unitPrice).toLocaleString()}</td><td><input value={i.specialNote} onChange={e => updateItem(i.id, 'specialNote', e.target.value)} /></td><td><input value={i.remarks} onChange={e => updateItem(i.id, 'remarks', e.target.value)} /></td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('door')} className="btn-add">+ 추가</button>
            </div>
            <div className="items-section">
              <h3>품목 관리 - 옵션항목</h3>
              <table>
                <thead><tr><th>품명</th><th>단위</th><th>수량</th><th>단가</th><th>소계</th><th>특이사항</th><th>비고</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'option').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{(i.quantity * i.unitPrice).toLocaleString()}</td><td><input value={i.specialNote} onChange={e => updateItem(i.id, 'specialNote', e.target.value)} /></td><td><input value={i.remarks} onChange={e => updateItem(i.id, 'remarks', e.target.value)} /></td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('option')} className="btn-add">+ 추가</button>
            </div>
            <div className="form-section"><h3>특이사항</h3><textarea className="remarks-input" value={remarks} onChange={e => setRemarks(e.target.value)} rows={4} /></div>
            <div className="form-section">
              <div className="intro-section-header">
                <h3>로고 및 자사 소개</h3>
                <label className="intro-toggle-label">
                  <input type="checkbox" checked={showIntroInPrint} onChange={e => setShowIntroInPrint(e.target.checked)} />
                  출력에 포함
                </label>
              </div>
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
            <div className="summary-section"><div className="row total">합계금액: ₩{(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</div></div>
            <div className="btn-group-main"><button onClick={saveCurrentQuotation} className="btn-save">클라우드 저장</button><button onClick={handlePrint} className="btn-print">인쇄 / PDF</button></div>
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
                    <label>사진 업로드</label>
                    <input type="file" multiple accept="image/*" onChange={e => handleSpacePhotoUpload(space.id, e)} />
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

        {view !== 'dashboard' && (
          <div className="saved-list-panel">
            {view === 'quotation' ? (
              <><h3>견적 저장내역</h3><div className="saved-items">{savedQuotations.map(q => <div key={q.id} className="saved-item"><div className="item-info" onClick={() => loadQuotation(q)}><div className="item-name">{q.customer.name || '(무명)'}</div><div className="item-date">{new Date(q.created_at).toLocaleDateString()}</div></div><button onClick={() => deleteQuotation(q.id)} className="btn-item-delete">×</button></div>)}</div></>
            ) : (
              <><h3>실측 저장내역</h3><div className="saved-items">{savedMeasurements.map(m => <div key={m.id} className="saved-item"><div className="item-info" onClick={() => loadMeasurement(m)}><div className="item-name">{m.site_name || '(무명현장)'}</div><div className="item-date">{new Date(m.created_at).toLocaleDateString()}</div></div><button onClick={() => deleteMeasurement(m.id)} className="btn-item-delete">×</button></div>)}</div></>
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
            <div className="total-value"><span className="currency">KRW</span><span className="amount">{(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</span></div>
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
                  <td className="center">{item.unit}</td><td className="center">{item.quantity}</td><td className="right">{item.unitPrice.toLocaleString()}</td><td className="right">{(item.quantity * item.unitPrice).toLocaleString()}</td><td className="center small-text">{item.remarks}</td>
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
              <div className="calc-row"><span className="c-label">공급가액 합계</span><span className="c-value">{items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0).toLocaleString()}</span></div>
              <div className="calc-row"><span className="c-label">부가가치세 (10%)</span><span className="c-value">{(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 0.1).toLocaleString()}</span></div>
              <div className="calc-total"><span className="c-label">총 합계금액</span><span className="c-value">₩ {(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</span></div>
            </div>
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
                  {space.photos.map((p, i) => <div key={i} className="m-photo-item"><img src={p} alt="space" /></div>)}
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
    </div>
  );
}

export default App;
