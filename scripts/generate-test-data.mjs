#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://puofpkpwfqwyzdsrvupf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2Zwa3B3ZnF3eXpkc3J2dXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTQ5OTMsImV4cCI6MjA4ODQzMDk5M30.1vDMhYabqa2Ay-TZvuDng1GuKTwKGTFB6qAImBwAE9g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SITES = [
  { name: '서초동 오피스텔 인테리어', customer: '김철수', amount: 85000000 },
  { name: '강남역 카페 리모델링', customer: '박영희', amount: 42000000 },
  { name: '삼성동 아파트 증축', customer: '이민준', amount: 120000000 },
  { name: '홍대 상가 개조', customer: '최수진', amount: 65000000 },
  { name: '을지로 사무실 이전', customer: '박준호', amount: 55000000 },
  { name: '명동 매장 인테리어', customer: '정민지', amount: 38000000 },
  { name: '잠실 주상복합 공사', customer: '이순신', amount: 150000000 },
  { name: '대림동 공장 확장', customer: '안영철', amount: 95000000 },
  { name: '영등포 건물주택 리모델', customer: '오지현', amount: 72000000 },
  { name: '청담동 펜트하우스 인테리어', customer: '구본영', amount: 110000000 },
];

const WORK_ITEMS = [
  '철거 및 폐기물 처리',
  '기초 콘크리트 타설',
  '벽체 구조 시공',
  '전기 배선 공사',
  '수도/난방 배관',
  '방수 공사',
  '타일/석재 붙이기',
  '목공 및 조립',
  '페인트 도장',
  '마감재 설치',
];

const SUBCONTRACT_ITEMS = [
  '전기 전문가 팀',
  '배관 전문가',
  '목공 전문가',
  '페인트 시공팀',
  '타일 시공 팀',
  '철강구조 전문',
  '유리시공 업체',
];

const QUOTATION_ITEMS = [
  { name: '기초 자재', unit: '일식', qty: 100, price: 50000 },
  { name: '철근 콘크리트', unit: 'm3', qty: 25, price: 180000 },
  { name: '벽체 자재', unit: '박스', qty: 500, price: 85000 },
  { name: '전선 케이블', unit: 'km', qty: 3, price: 150000 },
  { name: '배관 자재', unit: '개', qty: 200, price: 25000 },
  { name: '페인트', unit: '통', qty: 80, price: 35000 },
  { name: '타일', unit: 'm2', qty: 150, price: 45000 },
  { name: '문/창호', unit: '개', qty: 45, price: 280000 },
];

const ROOMS = ['거실', '침실', '주방', '욕실', '현관'];
const MATERIALS = ['대리석', '타일', '목재', '벽지', '페인트', '석고보드'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log('============================================================');
  console.log('🚀 공정관리 대시보드 - 테스트 데이터 생성');
  console.log('============================================================\n');

  // 로그인
  console.log('🔑 사용자 인증 중...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test3@test.com',
    password: '12345678',
  });

  if (authError) {
    console.error('❌ 로그인 실패:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`  ✓ User ID: ${userId}\n`);

  // 현장 생성
  console.log('📍 현장 10개 생성 중...');
  const projects = [];

  for (const site of SITES) {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        site_name: site.name,
        customer_name: site.customer,
        total_amount: site.amount,
        invoice_status: getRandomItem(['미발급', '발급예정', '발급완료']),
        payment_status: getRandomItem(['미수금', '부분수금', '완납']),
        biz_name: '건축패스',
        biz_owner: '이건주',
        biz_address: '서울시 강남구',
        biz_type: '인테리어 업체',
        biz_item: '건축/건설 공사',
        biz_email: 'contact@architectpass.com',
      })
      .select();

    if (error) {
      console.error(`  ✗ ${site.name} (실패)`, error.message);
    } else if (data && data.length > 0) {
      projects.push(data[0]);
      console.log(`  ✓ ${site.name}`);
    }
  }

  console.log(`  → 생성된 현장: ${projects.length}개\n`);

  // 공정 항목 생성
  console.log('🔨 공정 항목 생성 중...');
  let workCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const numItems = Math.floor(Math.random() * 3) + 3; // 3-5개

    for (let j = 0; j < numItems; j++) {
      const workName = getRandomItem(WORK_ITEMS);
      const status = getRandomItem(['실측예정', '실측 후 대기', '시공확정', '시공중', '완료']);
      const startDate = getRandomDate(j * 7);
      const endDate = getRandomDate(j * 7 + 5);

      const { error } = await supabase.from('work_items').insert({
        user_id: userId,
        project_id: project.id,
        label: workName,
        type: '시공',
        status,
        start_date: startDate,
        end_date: endDate,
      });

      if (!error) workCount++;
    }
  }

  console.log(`  ✓ 총 ${workCount}개 공정 생성\n`);

  // 외주 항목 생성
  console.log('👷 외주 항목 생성 중...');
  let subCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const numSubs = Math.floor(Math.random() * 2) + 2; // 2-3개

    for (let j = 0; j < numSubs; j++) {
      const subName = getRandomItem(SUBCONTRACT_ITEMS);
      const amount = Math.floor(Math.random() * 25 + 5) * 1000000;
      const startDate = getRandomDate(j * 10);
      const endDate = getRandomDate(j * 10 + 15);

      const { error } = await supabase.from('subcontracts').insert({
        user_id: userId,
        project_id: project.id,
        label: subName,
        amount,
        start_date: startDate,
        end_date: endDate,
        invoice_issued: Math.random() > 0.5,
        payment_done: Math.random() > 0.5,
      });

      if (!error) subCount++;
    }
  }

  console.log(`  ✓ 총 ${subCount}개 외주 생성\n`);

  // 견적서 생성
  console.log('📋 견적서 생성 중...');
  let quoteCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const site = SITES[i];

    const items = [];
    let total = 0;
    const numItems = Math.floor(Math.random() * 3) + 3; // 3-5개

    // 견적 항목 선택
    const selectedItems = [];
    for (let j = 0; j < numItems; j++) {
      selectedItems.push(getRandomItem(QUOTATION_ITEMS));
    }

    for (const item of selectedItems) {
      const itemTotal = item.qty * item.price;
      items.push({
        name: item.name,
        unit: item.unit,
        quantity: item.qty,
        unitPrice: item.price,
        total: itemTotal,
      });
      total += itemTotal;
    }

    const totalAmount = Math.floor(total * 1.1);

    const { data, error } = await supabase.from('quotations').insert({
      user_id: userId,
      items,
      provider: '건축패스',
      customer: site.customer,
      quoteNumber: `QT-${Date.now()}-${i}`,
      greeting: '안녕하세요',
      remarks: `프로젝트: ${site.name}`,
      total_amount: totalAmount,
    }).select();

    if (error) {
      console.log(`  ✗ ${site.name} 견적서 (실패):`, error.message);
    } else if (data && data.length > 0) {
      quoteCount++;
    }
  }

  console.log(`  ✓ 총 ${quoteCount}개 견적서 생성\n`);

  // 실측 리포트 생성
  console.log('📐 실측 리포트 생성 중...');
  let measurementCount = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const site = SITES[i];

    // doors/spaces 데이터 구성
    const spaces = {};
    const numRooms = Math.floor(Math.random() * 3) + 3; // 3-5개

    for (let j = 0; j < numRooms; j++) {
      const roomName = getRandomItem(ROOMS);
      const width = (Math.random() * 5 + 3).toFixed(1);
      const length = (Math.random() * 9 + 3).toFixed(1);
      const height = (Math.random() * 1.1 + 2.4).toFixed(1);

      spaces[roomName] = {
        dimensions: `${width}m × ${length}m × ${height}m`,
        materials: [getRandomItem(MATERIALS), getRandomItem(MATERIALS)],
        notes: `${roomName} 공간 측정완료.`,
      };
    }

    // options/checklist 데이터
    const checklist = {
      structure: true,
      electrical: Math.random() > 0.5,
      plumbing: true,
      ventilation: Math.random() > 0.5,
      lighting: true,
      safety: true,
    };

    const { data, error } = await supabase.from('measurements_v2').insert({
      user_id: userId,
      site_name: site.name,
      customer_name: site.customer,
      date: getRandomDate(-Math.floor(Math.random() * 30)),
      measurer: '이건주',
      doors: spaces,
      options: checklist,
      contact: '010-1234-5678',
      address: '서울시 강남구',
      special_notes: `${site.name} 현장 실측 완료. 시공 일정은 협의 예정.`,
    }).select();

    if (error) {
      console.log(`  ✗ ${site.name} 실측리포트 (실패):`, error.message);
    } else if (data && data.length > 0) {
      measurementCount++;
    }
  }

  console.log(`  ✓ 총 ${measurementCount}개 실측 리포트 생성\n`);

  console.log('============================================================');
  console.log('✅ 모든 테스트 데이터 생성 완료!');
  console.log('============================================================\n');

  console.log('📊 생성된 데이터:');
  console.log(`  • 현장: ${projects.length}개`);
  console.log(`  • 공정: ${workCount}개`);
  console.log(`  • 외주: ${subCount}개`);
  console.log(`  • 견적서: ${quoteCount}개`);
  console.log(`  • 실측리포트: ${measurementCount}개`);
  console.log('');
  console.log('🔗 앱에 접속해서 확인하세요: https://invoice-2cd.pages.dev/');
  console.log('   ID: test3@test.com / PW: 12345678');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 오류 발생:', err);
  process.exit(1);
});
