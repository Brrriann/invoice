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
  remarks: string;
}

interface Project {
  id: string;
  created_at: string;
  user_id: string;
  site_name: string;
  customer_name: string;
  total_amount: number;
  measure_date: string;
  measure_status: '예정' | '완료';
  install_date: string;
  install_status: '대기' | '확정' | '완료';
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

interface ExtraItem {
  id: string;
  title: string;
  desc: string;
}

interface DoorMeasure {
  id: string;
  label: string;
  installation: '내측' | '외측';
  width: string;
  height: string;
  extraItems: ExtraItem[];
  photos: string[];
}

interface MeasureOptionItem {
  id: string;
  type: '루프센서' | '레이더센서' | '리모컨' | '기타';
  remarks: string;
}

interface SavedMeasurement {
  id: string;
  created_at: string;
  site_name: string;
  customer_name: string;
  date: string;
  measurer: string;
  doors: DoorMeasure[];
  options: MeasureOptionItem[];
  power_source: string;
  floor_condition: string;
  obstacles: string;
  special_notes: string;
}

const initialProvider = {
  name: '주미산업',
  brandTagline: 'Industrial Solution Specialist',
  representative: '송제홍외 1명',
  address: '경기도 안산시 단원구 산단로 325, 3층 F-340호',
  contact: 'Tel: 02-3439-1888 / HP: 010-4857-9660 / Fax: 02-6442-1886',
  businessNo: '213-02-52092'
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
    { id: '1', type: 'door', name: '기본형 스피드 도어', unit: 'SET', width: 3000, height: 3000, quantity: 1, unitPrice: 2500000, remarks: '' }
  ]);
  const [provider, setProvider] = useState(initialProvider);
  const [customer, setCustomer] = useState(initialCustomer);
  const [quoteNumber, setQuoteNumber] = useState(`SD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-01`);
  const [greeting, setGreeting] = useState('평소 베풀어 주신 각별한 성원에 감사드리며,\n아래와 같이 견적을 제출하오니 검토 부탁드립니다.');
  const [remarks, setRemarks] = useState('※ 납기일: 발주 후 30일 이내\n※ 결제조건: 선금 50%, 잔금 설치 후 즉시\n※ 부가세 포함 금액입니다.');
  
  const [savedQuotations, setSavedQuotations] = useState<SavedQuotation[]>([]);
  const [savedMeasurements, setSavedMeasurements] = useState<SavedMeasurement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // --- 실측 템플릿 관련 상태 ---
  const [measureData, setMeasureData] = useState({
    siteName: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    measurer: '',
    doors: [
      { id: 'd1', label: '1번 도어', installation: '내측', width: '', height: '', extraItems: [{ id: 'e1', title: '', desc: '' }], photos: [] }
    ] as DoorMeasure[],
    options: [] as MeasureOptionItem[],
    powerSource: '유',
    floorCondition: '양호(수평)',
    obstacles: '',
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
    }
  }, [currentUser]);

  // --- DB 로직 (대시보드/프로젝트) ---
  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error) setProjects(data || []);
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
      measure_status: '예정',
      install_status: '대기',
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
      doors: measureData.doors,
      options: measureData.options,
      power_source: measureData.powerSource,
      floor_condition: measureData.floorCondition,
      obstacles: measureData.obstacles,
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
    
    // 이전 데이터 포맷 호환성 처리 (extraTitle/extraDesc -> extraItems)
    const convertedDoors = m.doors?.map((d: any) => {
      if (!d.extraItems && (d.extraTitle || d.extraDesc)) {
        return {
          ...d,
          extraItems: [{ id: 'old-data', title: d.extraTitle || '', desc: d.extraDesc || '' }]
        };
      }
      return d;
    }) || [];

    setMeasureData({
      siteName: m.site_name,
      customerName: m.customer_name,
      date: m.date,
      measurer: m.measurer,
      doors: convertedDoors,
      options: m.options || [],
      powerSource: m.power_source,
      floorCondition: m.floor_condition,
      obstacles: m.obstacles,
      specialNotes: m.special_notes
    });
  };

  // --- 실측 템플릿 핸들러 ---
  const addDoor = () => {
    const newDoor: DoorMeasure = {
      id: Math.random().toString(36).substr(2, 9),
      label: `${measureData.doors.length + 1}번 도어`,
      installation: '내측',
      width: '', height: '', extraItems: [{ id: Math.random().toString(36).substr(2, 9), title: '', desc: '' }], photos: []
    };
    setMeasureData({ ...measureData, doors: [...measureData.doors, newDoor] });
  };

  const removeDoor = (id: string) => {
    setMeasureData({ ...measureData, doors: measureData.doors.filter(d => d.id !== id) });
  };

  const updateDoor = (id: string, field: keyof DoorMeasure, value: any) => {
    setMeasureData({
      ...measureData,
      doors: measureData.doors.map(d => d.id === id ? { ...d, [field]: value } : d)
    });
  };

  const addExtraItem = (doorId: string) => {
    setMeasureData({
      ...measureData,
      doors: measureData.doors.map(d => d.id === doorId ? {
        ...d,
        extraItems: [...d.extraItems, { id: Math.random().toString(36).substr(2, 9), title: '', desc: '' }]
      } : d)
    });
  };

  const updateExtraItem = (doorId: string, itemId: string, field: 'title' | 'desc', value: string) => {
    setMeasureData({
      ...measureData,
      doors: measureData.doors.map(d => d.id === doorId ? {
        ...d,
        extraItems: d.extraItems.map(item => item.id === itemId ? { ...item, [field]: value } : item)
      } : d)
    });
  };

  const removeExtraItem = (doorId: string, itemId: string) => {
    setMeasureData({
      ...measureData,
      doors: measureData.doors.map(d => d.id === doorId ? {
        ...d,
        extraItems: d.extraItems.filter(item => item.id !== itemId)
      } : d)
    });
  };

  const addMeasureOption = () => {
    const newOption: MeasureOptionItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: '루프센서',
      remarks: ''
    };
    setMeasureData({ ...measureData, options: [...measureData.options, newOption] });
  };

  const updateMeasureOption = (id: string, field: keyof MeasureOptionItem, value: any) => {
    setMeasureData({
      ...measureData,
      options: measureData.options.map(o => o.id === id ? { ...o, [field]: value } : o)
    });
  };

  const handleDoorPhotoUpload = (doorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMeasureData(prev => ({
            ...prev,
            doors: prev.doors.map(d => d.id === doorId ? { ...d, photos: [...d.photos, reader.result as string] } : d)
          }));
        };
        reader.readAsDataURL(file);
      });
    }
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
  const addItem = (type: 'door' | 'option') => setItems([...items, { id: Math.random().toString(36).substr(2, 9), type, name: type === 'door' ? '스피드 도어 품목' : '옵션 항목 추가', unit: 'SET', width: 0, height: 0, quantity: 1, unitPrice: 0, remarks: '' }]);
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
                  <div key={project.id} className="project-card">
                    <div className="project-card-header">
                      <div className="project-title">
                        <h3>{project.site_name}</h3>
                        <input 
                          className="customer-input" 
                          placeholder="고객사명 입력"
                          value={project.customer_name || ''} 
                          onChange={e => updateProjectLocal(project.id, 'customer_name', e.target.value)} 
                          onBlur={e => syncProjectToDB(project.id, 'customer_name', e.target.value)}
                        />
                        </div>
                        <button className="btn-delete-project" onClick={() => deleteProject(project.id)}>×</button>
                        </div>

                        <div className="project-body">
                        <div className="status-timeline">
                        {/* 1. 실측 섹션 */}
                        <div className={`status-node ${project.measure_status === '완료' ? 'done' : ''}`}>
                          <div className="node-label">실측</div>
                          <select 
                            value={project.measure_status} 
                            onChange={e => handleProjectUpdateImmediate(project.id, 'measure_status', e.target.value)}
                            className={`status-select ${project.measure_status}`}
                          >
                            <option value="예정">예정</option>
                            <option value="완료">완료</option>
                          </select>
                          <input type="date" value={project.measure_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'measure_date', e.target.value)} />
                        </div>

                        {/* 2. 설치 섹션 */}
                        <div className={`status-node ${project.install_status === '완료' ? 'done' : ''}`}>
                          <div className="node-label">설치</div>
                          <select 
                            value={project.install_status} 
                            onChange={e => handleProjectUpdateImmediate(project.id, 'install_status', e.target.value)}
                            className={`status-select ${project.install_status}`}
                          >
                            <option value="대기">대기</option>
                            <option value="확정">확정</option>
                            <option value="완료">완료</option>
                          </select>
                          <input type="date" value={project.install_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'install_date', e.target.value)} />
                        </div>

                        {/* 3. 계산서 섹션 */}
                        <div className={`status-node ${project.invoice_status === '완료' ? 'done' : ''}`}>
                          <div className="node-label">계산서</div>
                          <select 
                            value={project.invoice_status} 
                            onChange={e => handleProjectUpdateImmediate(project.id, 'invoice_status', e.target.value)}
                            className={`status-select ${project.invoice_status}`}
                          >
                            <option value="미발급">미발급</option>
                            <option value="완료">완료</option>
                          </select>
                          <input type="date" value={project.invoice_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'invoice_date', e.target.value)} />
                        </div>

                        {/* 4. 수금 섹션 */}
                        <div className={`status-node ${project.payment_status === '완료' ? 'done' : ''}`}>
                          <div className="node-label">수금</div>
                          <select 
                            value={project.payment_status} 
                            onChange={e => handleProjectUpdateImmediate(project.id, 'payment_status', e.target.value)}
                            className={`status-select ${project.payment_status}`}
                          >
                            <option value="미수금">미수금</option>
                            <option value="일부수금">일부수금</option>
                            <option value="완료">완료</option>
                          </select>
                          <input type="date" value={project.payment_date || ''} onChange={e => handleProjectUpdateImmediate(project.id, 'payment_date', e.target.value)} />
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
                    const dayProjects = projects.filter(p => p.measure_date === dateStr || p.install_date === dateStr || p.invoice_date === dateStr || p.payment_date === dateStr);
                    
                    return (
                      <div key={day} className="calendar-day">
                        <span className="day-number">{day}</span>
                        <div className="day-events">
                          {dayProjects.map(p => (
                            <div key={p.id} className="calendar-event-group">
                              {p.measure_date === dateStr && <div className="event measure">실측: {p.site_name}</div>}
                              {p.install_date === dateStr && <div className="event install">설치: {p.site_name}</div>}
                              {p.invoice_date === dateStr && <div className="event invoice">계산서: {p.site_name}</div>}
                              {p.payment_date === dateStr && <div className="event payment">수금: {p.site_name}</div>}
                            </div>
                          ))}
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
            <h1>주미산업 SPEEDDOOR 견적서</h1>
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
              <h3>품목 관리 - 스피드도어</h3>
              <table>
                <thead><tr><th>품명</th><th>단위</th><th>가로</th><th>세로</th><th>수량</th><th>단가</th><th>소계</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'door').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.width} onChange={e => updateItem(i.id, 'width', parseInt(e.target.value))} /></td><td><input type="number" value={i.height} onChange={e => updateItem(i.id, 'height', parseInt(e.target.value))} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{(i.quantity * i.unitPrice).toLocaleString()}</td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('door')} className="btn-add">+ 추가</button>
            </div>
            <div className="items-section">
              <h3>품목 관리 - 옵션항목</h3>
              <table>
                <thead><tr><th>품명</th><th>단위</th><th>수량</th><th>단가</th><th>소계</th><th>삭제</th></tr></thead>
                <tbody>{items.filter(i => i.type === 'option').map(i => <tr key={i.id}><td><input value={i.name} onChange={e => updateItem(i.id, 'name', e.target.value)} /></td><td><input value={i.unit} onChange={e => updateItem(i.id, 'unit', e.target.value)} /></td><td><input type="number" value={i.quantity} onChange={e => updateItem(i.id, 'quantity', parseInt(e.target.value))} /></td><td><input type="number" value={i.unitPrice} onChange={e => updateItem(i.id, 'unitPrice', parseInt(e.target.value))} /></td><td>{(i.quantity * i.unitPrice).toLocaleString()}</td><td><button onClick={() => removeItem(i.id)}>×</button></td></tr>)}</tbody>
              </table>
              <button onClick={() => addItem('option')} className="btn-add">+ 추가</button>
            </div>
            <div className="form-section"><h3>특이사항</h3><textarea className="remarks-input" value={remarks} onChange={e => setRemarks(e.target.value)} rows={4} /></div>
            <div className="summary-section"><div className="row total">합계금액: ₩{(items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) * 1.1).toLocaleString()}</div></div>
            <div className="btn-group-main"><button onClick={saveCurrentQuotation} className="btn-save">클라우드 저장</button><button onClick={handlePrint} className="btn-print">인쇄 / PDF</button></div>
          </div>
        ) : (
          /* 실측 템플릿 작성 화면 */
          <div className="quotation-card">
            <h1>스피드도어 실측 리포트</h1>
            <div className="form-section">
              <h3>기본 정보</h3>
              <div className="grid">
                <input placeholder="현장명" value={measureData.siteName} onChange={e => setMeasureData({...measureData, siteName: e.target.value})} />
                <input placeholder="고객사" value={measureData.customerName} onChange={e => setMeasureData({...measureData, customerName: e.target.value})} />
                <input type="date" value={measureData.date} onChange={e => setMeasureData({...measureData, date: e.target.value})} />
                <input placeholder="실측자" value={measureData.measurer} onChange={e => setMeasureData({...measureData, measurer: e.target.value})} />
              </div>
            </div>

            <div className="form-section">
              <h3>개구부 및 설치 공간</h3>
              {measureData.doors.map((door, idx) => (
                <div key={door.id} className="door-input-box">
                  <div className="door-header">
                    <h4>{door.label}</h4>
                    {idx > 0 && <button className="btn-remove-door" onClick={() => removeDoor(door.id)}>삭제</button>}
                  </div>
                  <div className="grid">
                    <select value={door.installation} onChange={e => updateDoor(door.id, 'installation', e.target.value as any)}>
                      <option value="내측">내측 설치</option>
                      <option value="외측">외측 설치</option>
                    </select>
                    <input type="number" placeholder="폭(W)" value={door.width} onChange={e => updateDoor(door.id, 'width', e.target.value)} />
                    <input type="number" placeholder="높이(H)" value={door.height} onChange={e => updateDoor(door.id, 'height', e.target.value)} />
                  </div>

                  <div className="extra-items-section">
                    <label className="section-label">도어 추가설명</label>
                    {door.extraItems?.map((item) => (
                      <div key={item.id} className="extra-item-row">
                        <div className="extra-item-inputs">
                          <input type="text" placeholder="항목 제목 (예: 센서)" value={item.title} onChange={e => updateExtraItem(door.id, item.id, 'title', e.target.value)} className="extra-title" />
                          <input type="text" placeholder="항목 내용 (예: 레이더센서 2개)" value={item.desc} onChange={e => updateExtraItem(door.id, item.id, 'desc', e.target.value)} className="extra-desc" />
                        </div>
                        <button className="btn-remove-extra" onClick={() => removeExtraItem(door.id, item.id)}>×</button>
                      </div>
                    ))}
                    <button className="btn-add-extra" onClick={() => addExtraItem(door.id)}>+ 설명 추가</button>
                  </div>

                  <div className="door-photo-section">
                    <label>사진 업로드 (복수 선택 가능)</label>
                    <input type="file" multiple accept="image/*" onChange={(e) => handleDoorPhotoUpload(door.id, e)} />
                    <div className="photo-preview-grid">
                      {door.photos.map((p, i) => (
                        <div key={i} className="photo-preview">
                          <img src={p} alt="door-preview" />
                          <button onClick={() => updateDoor(door.id, 'photos', door.photos.filter((_, pid) => pid !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn-add-door" onClick={addDoor}>+ 도어 추가</button>
            </div>

            <div className="form-section">
              <h3>옵션 항목 추가</h3>
              {measureData.options.map((opt) => (
                <div key={opt.id} className="option-input-row">
                  <select value={opt.type} onChange={e => updateMeasureOption(opt.id, 'type', e.target.value as any)}>
                    <option value="루프센서">루프센서</option>
                    <option value="레이더센서">레이더센서</option>
                    <option value="리모컨">리모컨</option>
                    <option value="기타">기타</option>
                  </select>
                  <input type="text" placeholder="특이사항 입력" value={opt.remarks} onChange={e => updateMeasureOption(opt.id, 'remarks', e.target.value)} />
                  <button onClick={() => setMeasureData({...measureData, options: measureData.options.filter(o => o.id !== opt.id)})}>×</button>
                </div>
              ))}
              <button className="btn-add-option" onClick={addMeasureOption}>+ 옵션 추가</button>
            </div>

            <div className="form-section">
              <h3>기타 현장 환경</h3>
              <div className="grid">
                <select value={measureData.powerSource} onChange={e => setMeasureData({...measureData, powerSource: e.target.value})}>
                  <option value="유">전원 있음</option>
                  <option value="무">전원 없음</option>
                </select>
                <input type="text" placeholder="바닥 상태" value={measureData.floorCondition} onChange={e => setMeasureData({...measureData, floorCondition: e.target.value})} />
              </div>
              <textarea className="remarks-input" placeholder="장애물 유무 및 위치" value={measureData.obstacles} onChange={e => setMeasureData({...measureData, obstacles: e.target.value})} rows={2} />
              <textarea className="remarks-input" placeholder="추가 종합 비고" value={measureData.specialNotes} onChange={e => setMeasureData({...measureData, specialNotes: e.target.value})} rows={3} />
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
                <h2 className="brand-name">{provider.name}</h2>
                <p className="brand-tagline">{provider.brandTagline}</p>
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
                  <td className="desc-text">{item.name} {item.type === 'door' && <><br/><small className="dim">{item.width} x {item.height} mm</small></>}</td>
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

          <div className="sheet-strengths-page">
            <div className="strengths-image-top"><img src="/image.webp" alt="Happy Gate Strength" /></div>
            <div className="strengths-header"><h3>해피게이트 문번 강점</h3><div className="header-line" /></div>
            <ul className="strengths-list">
              <li><span className="bullet">01</span><p>1980년 아시아 최초로 개발된 스피드도어 전문 기업으로 업계를 선도하고 있는 기업입니다.</p></li>
              <li><span className="bullet">02</span><p>전국 A/S 망 구축으로 문제 발생시 빠른 처리가 가능합니다.</p></li>
              <li><span className="bullet">03</span><p>차 후 A/S 발생시 합리적인 수리비청구로 유지관리비용이 저렴합니다.</p></li>
              <li><span className="bullet">04</span><p>BLDC모터 사용으로 설치시 타사 대비 월등히 작은 크기로 공간활용성증대, 전력소비절감, 저소음 개폐가 가능합니다.</p></li>
              <li><span className="bullet">05</span><p>합리적인 이전 설치 비용으로 공장 리모델링 시에도 부담없이 이동이 가능합니다.</p></li>
              <li><span className="bullet">06</span><p>고장력강 파이프를 사용하여 충격에도 쉽게 변형되지 않고, 강풍에도 견고하게 버틸 수 있습니다.</p></li>
              <li><span className="bullet">07</span><p>재난 주관 방송사인 KBS에 재난 발생 피해를 막기 위해 설치하는 비상탈출문으로 보도된 제품을 보유하고 있습니다.</p></li>
            </ul>
            <div className="strengths-footer"><p>{provider.name}</p></div>
          </div>
        </div>
      )}

      {view === 'measurement' && (
        <div className="print-only measurement-sheet">
          <div className="sheet-border-top" />
          <header className="m-header">
            <h1>스피드도어 실측 리포트</h1>
            <div className="m-meta"><span>현장명: {measureData.siteName}</span><span>실측일: {measureData.date}</span></div>
          </header>

          <table className="m-table">
            <tbody>
              <tr><th>고객사</th><td>{measureData.customerName}</td><th>실측자</th><td>{measureData.measurer}</td></tr>
              {measureData.doors.map((door) => (
                <React.Fragment key={door.id}>
                  <tr className="m-door-row"><th colSpan={4} style={{ background: '#1e3a8a', color: 'white', textAlign: 'left', paddingLeft: '15px' }}>{door.label} ({door.installation})</th></tr>
                  <tr>
                    <th>폭(W) x 높이(H)</th>
                    <td>{door.width} x {door.height} mm</td>
                    <th colSpan={1}>도어 추가설명</th>
                    <td colSpan={1}>
                      {door.extraItems?.map((item) => (
                        <div key={item.id} style={{ fontSize: '9pt', marginBottom: '2px' }}>
                          <strong>{item.title}:</strong> {item.desc}
                        </div>
                      ))}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
              {measureData.options.length > 0 && (
                <>
                  <tr className="m-door-row"><th colSpan={4} style={{ background: '#334155', color: 'white', textAlign: 'left', paddingLeft: '15px' }}>옵션 항목</th></tr>
                  {measureData.options.map(opt => (
                    <tr key={opt.id}><th>{opt.type}</th><td colSpan={3}>{opt.remarks}</td></tr>
                  ))}
                </>
              )}
              <tr className="m-door-row"><th colSpan={4} style={{ background: '#334155', color: 'white', textAlign: 'left', paddingLeft: '15px' }}>현장 환경</th></tr>
              <tr><th>전원 유무</th><td>{measureData.powerSource === '유' ? '있음' : '없음'}</td><th>바닥 상태</th><td>{measureData.floorCondition}</td></tr>
              <tr><th>장애물 정보</th><td colSpan={3}>{measureData.obstacles}</td></tr>
              <tr><th>종합 비고</th><td colSpan={3} className="m-notes">{measureData.specialNotes}</td></tr>
            </tbody>
          </table>

          <div className="m-photos">
            <h3>실측 현장 사진</h3>
            {measureData.doors.map(door => (
              <div key={door.id} className="m-door-photo-group">
                {door.photos.length > 0 && (
                  <>
                    <h4>{door.label} 사진</h4>
                    <div className="m-photo-grid">
                      {door.photos.map((p, i) => <div key={i} className="m-photo-item"><img src={p} alt="site" /></div>)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <footer className="m-footer"><p>위 실측 데이터는 현장 설치 환경을 기준으로 작성되었습니다.</p><p className="m-company">{provider.name}</p></footer>
        </div>
      )}
    </div>
  );
}

export default App;
