#!/bin/bash

# Supabase 설정 - PAT 사용 (환경변수에서 로드)
# 사용법: export SUPABASE_PROJECT_ID=... && export SUPABASE_PAT=... && export SUPABASE_USER_ID=... && bash insert_test_data.sh
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

URL="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}"
PAT="${SUPABASE_PAT}"
USER_ID="${SUPABASE_USER_ID}"

if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$PAT" ] || [ -z "$USER_ID" ]; then
  echo "❌ 환경변수 SUPABASE_PROJECT_ID, SUPABASE_PAT, SUPABASE_USER_ID 가 필요합니다."
  echo "   .env.local 파일에 설정 후 실행하세요."
  exit 1
fi

echo "============================================================"
echo "🚀 공정관리 대시보드 - 테스트 데이터 일괄 생성"
echo "============================================================"
echo ""

# SQL 쿼리 실행 함수
execute_sql() {
  local sql="$1"
  curl -s -w "\nHTTP:%{http_code}" \
    -X POST "$URL/database/query" \
    -H "Authorization: Bearer $PAT" \
    -H "Content-Type: application/json" \
    -H "User-Agent: SupabaseCLI/2.77.0" \
    --data-binary "{\"query\":\"$sql\"}" 2>/dev/null
}

# 1. 현장 10개 생성
echo "📍 현장 10개 생성 중..."

sql_projects="
INSERT INTO projects (user_id, site_name, customer_name, total_amount, invoice_status, payment_status, biz_name, biz_owner, biz_address, biz_type, biz_item, biz_email)
VALUES
('$USER_ID', '서초동 오피스텔 인테리어', '김철수', 85000000, '미발급', '미수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '강남역 카페 리모델링', '박영희', 42000000, '발급예정', '부분수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '삼성동 아파트 증축', '이민준', 120000000, '발급완료', '완납', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '홍대 상가 개조', '최수진', 65000000, '미발급', '미수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '을지로 사무실 이전', '박준호', 55000000, '발급예정', '부분수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '명동 매장 인테리어', '정민지', 38000000, '발급완료', '완납', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '잠실 주상복합 공사', '이순신', 150000000, '미발급', '미수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '대림동 공장 확장', '안영철', 95000000, '발급예정', '부분수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '영등포 건물주택 리모델', '오지현', 72000000, '발급완료', '완납', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com'),
('$USER_ID', '청담동 펜트하우스 인테리어', '구본영', 110000000, '미발급', '미수금', '건축패스', '이건주', '서울시 강남구', '인테리어 업체', '건축/건설 공사', 'contact@architectpass.com')
RETURNING id, site_name;
"

echo "SQL 쿼리 실행..."
echo "$sql_projects"
