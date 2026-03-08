// 앱이 실행 중일 때 브라우저 콘솔에서 실행할 스크립트
// (자동화를 위해 Puppeteer 사용)

const sites = [
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

const workItems = [
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

const subcontractItems = [
  '전기 전문가 팀',
  '배관 전문가',
  '목공 전문가',
  '페인트 시공팀',
  '타일 시공 팀',
];

const quotationItems = [
  { name: '기초 자재', unit: '일식', qty: 100, price: 50000 },
  { name: '철근 콘크리트', unit: 'm3', qty: 25, price: 180000 },
  { name: '벽체 자재', unit: '박스', qty: 500, price: 85000 },
  { name: '전선 케이블', unit: 'km', qty: 3, price: 150000 },
  { name: '배관 자재', unit: '개', qty: 200, price: 25000 },
  { name: '페인트', unit: '통', qty: 80, price: 35000 },
  { name: '타일', unit: 'm2', qty: 150, price: 45000 },
  { name: '문/창호', unit: '개', qty: 45, price: 280000 },
];

const rooms = ['거실', '침실', '주방', '욕실', '현관'];
const materials = ['대리석', '타일', '목재', '벽지', '페인트'];

// localStorage에 저장할 전체 데이터 객체
const testData = {
  projects: sites.map((site, idx) => ({
    id: `proj-${idx}`,
    name: site.name,
    customer: site.customer,
    amount: site.amount,
    status: ['미발급', '발급예정', '발급완료'][Math.floor(Math.random() * 3)],
    payment: ['미수금', '부분수금', '완납'][Math.floor(Math.random() * 3)],
    created: new Date().toISOString(),
  })),
};

console.log('테스트 데이터 생성 준비 완료');
console.log(testData);
