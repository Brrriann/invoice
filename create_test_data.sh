#!/bin/bash

# Supabase 설정 - 환경변수에서 로드 (.env.local 파일 또는 export로 미리 설정)
# 사용법: export SUPABASE_URL=... && export SUPABASE_ANON_KEY=... && bash create_test_data.sh
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

URL="${SUPABASE_URL}"
ANON_KEY="${SUPABASE_ANON_KEY}"

if [ -z "$URL" ] || [ -z "$ANON_KEY" ]; then
  echo "❌ 환경변수 SUPABASE_URL, SUPABASE_ANON_KEY 가 설정되지 않았습니다."
  echo "   .env.local 파일에 설정하거나 export로 지정 후 실행하세요."
  exit 1
fi

echo "============================================================"
echo "🚀 공정관리 대시보드 - 테스트 데이터 생성"
echo "============================================================"

# 1. 사용자 로그인 및 user_id 획득
echo ""
echo "🔑 사용자 인증 중..."

LOGIN_RESPONSE=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test3@test.com",
    "password": "12345678"
  }')

USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "❌ 로그인 실패"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "  ✓ User ID: $USER_ID"
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 2. 현장 10개 생성
echo ""
echo "📍 현장 생성 중..."

SITES=(
  '{"name":"서초동 오피스텔 인테리어","customer":"김철수","amount":85000000}'
  '{"name":"강남역 카페 리모델링","customer":"박영희","amount":42000000}'
  '{"name":"삼성동 아파트 증축","customer":"이민준","amount":120000000}'
  '{"name":"홍대 상가 개조","customer":"최수진","amount":65000000}'
  '{"name":"을지로 사무실 이전","customer":"박준호","amount":55000000}'
  '{"name":"명동 매장 인테리어","customer":"정민지","amount":38000000}'
  '{"name":"잠실 주상복합 공사","customer":"이순신","amount":150000000}'
  '{"name":"대림동 공장 확장","customer":"안영철","amount":95000000}'
  '{"name":"영등포 건물주택 리모델","customer":"오지현","amount":72000000}'
  '{"name":"청담동 펜트하우스 인테리어","customer":"구본영","amount":110000000}'
)

PROJECT_IDS=()
for site_json in "${SITES[@]}"; do
  SITE_NAME=$(echo "$site_json" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  CUSTOMER=$(echo "$site_json" | grep -o '"customer":"[^"]*"' | cut -d'"' -f4)
  AMOUNT=$(echo "$site_json" | grep -o '"amount":[0-9]*' | cut -d':' -f2)

  RESPONSE=$(curl -s -X POST "$URL/rest/v1/projects" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"$USER_ID\",
      \"site_name\": \"$SITE_NAME\",
      \"customer_name\": \"$CUSTOMER\",
      \"total_amount\": $AMOUNT,
      \"invoice_status\": \"미발급\",
      \"payment_status\": \"미수금\",
      \"biz_name\": \"건축패스\",
      \"biz_owner\": \"이건주\",
      \"biz_address\": \"서울시 강남구\",
      \"biz_type\": \"인테리어 업체\",
      \"biz_item\": \"건축/건설 공사\",
      \"biz_email\": \"contact@architectpass.com\"
    }")

  PROJECT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ ! -z "$PROJECT_ID" ]; then
    PROJECT_IDS+=("$PROJECT_ID")
    echo "  ✓ $SITE_NAME"
  else
    echo "  ✗ $SITE_NAME (생성 실패)"
  fi
done

echo "  → 생성된 현장: ${#PROJECT_IDS[@]}개"

# 3. 공정 항목 생성
echo ""
echo "🔨 공정 항목 생성 중..."

WORK_ITEMS=(
  "철거 및 폐기물 처리"
  "기초 콘크리트 타설"
  "벽체 구조 시공"
  "전기 배선 공사"
  "수도/난방 배관"
  "방수 공사"
  "타일/석재 붙이기"
  "목공 및 조립"
  "페인트 도장"
  "마감재 설치"
)

STATUSES=("실측예정" "실측 후 대기" "시공확정" "시공중" "완료")
WORK_COUNT=0

TODAY=$(date +%Y-%m-%d)

for i in "${!PROJECT_IDS[@]}"; do
  PROJECT_ID="${PROJECT_IDS[$i]}"

  # 각 현장마다 3-5개의 공정 생성
  NUM_ITEMS=$((RANDOM % 3 + 3))

  for j in $(seq 0 $((NUM_ITEMS - 1))); do
    WORK_NAME="${WORK_ITEMS[$((RANDOM % ${#WORK_ITEMS[@]}))]}"
    STATUS="${STATUSES[$((RANDOM % ${#STATUSES[@]}))]}"
    START_DAYS=$((j * 7))
    START_DATE=$(date -d "$TODAY + $START_DAYS days" +%Y-%m-%d 2>/dev/null || echo "$TODAY")
    END_DATE=$(date -d "$TODAY + $((START_DAYS + 5)) days" +%Y-%m-%d 2>/dev/null || echo "$TODAY")

    curl -s -X POST "$URL/rest/v1/work_items" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"user_id\": \"$USER_ID\",
        \"project_id\": \"$PROJECT_ID\",
        \"label\": \"$WORK_NAME\",
        \"type\": \"시공\",
        \"status\": \"$STATUS\",
        \"start_date\": \"$START_DATE\",
        \"end_date\": \"$END_DATE\"
      }" > /dev/null

    WORK_COUNT=$((WORK_COUNT + 1))
  done
done

echo "  ✓ 총 $WORK_COUNT개 공정 생성"

# 4. 외주 항목 생성
echo ""
echo "👷 외주 항목 생성 중..."

SUBCONTRACT_ITEMS=(
  "전기 전문가 팀"
  "배관 전문가"
  "목공 전문가"
  "페인트 시공팀"
  "타일 시공 팀"
  "철강구조 전문"
  "유리시공 업체"
)

SUB_COUNT=0

for PROJECT_ID in "${PROJECT_IDS[@]}"; do
  # 각 현장마다 2-3개의 외주 생성
  NUM_SUBS=$((RANDOM % 2 + 2))

  for j in $(seq 0 $((NUM_SUBS - 1))); do
    SUB_NAME="${SUBCONTRACT_ITEMS[$((RANDOM % ${#SUBCONTRACT_ITEMS[@]}))]}"
    AMOUNT=$((RANDOM % 25 + 5))000000
    START_DAYS=$((j * 10))
    START_DATE=$(date -d "$TODAY + $START_DAYS days" +%Y-%m-%d 2>/dev/null || echo "$TODAY")
    END_DATE=$(date -d "$TODAY + $((START_DAYS + 15)) days" +%Y-%m-%d 2>/dev/null || echo "$TODAY")

    curl -s -X POST "$URL/rest/v1/subcontracts" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"user_id\": \"$USER_ID\",
        \"project_id\": \"$PROJECT_ID\",
        \"label\": \"$SUB_NAME\",
        \"amount\": $AMOUNT,
        \"start_date\": \"$START_DATE\",
        \"end_date\": \"$END_DATE\",
        \"invoice_issued\": $([ $((RANDOM % 2)) -eq 0 ] && echo 'true' || echo 'false'),
        \"payment_done\": $([ $((RANDOM % 2)) -eq 0 ] && echo 'true' || echo 'false')
      }" > /dev/null

    SUB_COUNT=$((SUB_COUNT + 1))
  done
done

echo "  ✓ 총 $SUB_COUNT개 외주 생성"

# 5. 견적서 생성
echo ""
echo "📋 견적서 생성 중..."

QUOTATION_ITEMS=(
  '{"name":"기초 자재","unit":"일식","qty":100,"price":50000}'
  '{"name":"철근 콘크리트","unit":"m3","qty":25,"price":180000}'
  '{"name":"벽체 자재","unit":"박스","qty":500,"price":85000}'
  '{"name":"전선 케이블","unit":"km","qty":3,"price":150000}'
  '{"name":"배관 자재","unit":"개","qty":200,"price":25000}'
  '{"name":"페인트","unit":"통","qty":80,"price":35000}'
  '{"name":"타일","unit":"m2","qty":150,"price":45000}'
  '{"name":"문/창호","unit":"개","qty":45,"price":280000}'
)

QUOTE_COUNT=0
for i in "${!PROJECT_IDS[@]}"; do
  PROJECT_ID="${PROJECT_IDS[$i]}"
  SITE_NAME="${SITES[$i]}"
  SITE_NAME=$(echo "$SITE_NAME" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  CUSTOMER=$(echo "${SITES[$i]}" | grep -o '"customer":"[^"]*"' | cut -d'"' -f4)

  # 견적 항목 3-5개 선택
  ITEMS_JSON="["
  NUM_ITEMS=$((RANDOM % 3 + 3))

  TOTAL=0
  for j in $(seq 0 $((NUM_ITEMS - 1))); do
    ITEM="${QUOTATION_ITEMS[$((RANDOM % ${#QUOTATION_ITEMS[@]}))]}"
    ITEM_NAME=$(echo "$ITEM" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    UNIT=$(echo "$ITEM" | grep -o '"unit":"[^"]*"' | cut -d'"' -f4)
    QTY=$(echo "$ITEM" | grep -o '"qty":[0-9]*' | cut -d':' -f2)
    PRICE=$(echo "$ITEM" | grep -o '"price":[0-9]*' | cut -d':' -f2)

    ITEM_TOTAL=$((QTY * PRICE))
    TOTAL=$((TOTAL + ITEM_TOTAL))

    if [ $j -gt 0 ]; then ITEMS_JSON+=","; fi
    ITEMS_JSON+="{\"name\":\"$ITEM_NAME\",\"unit\":\"$UNIT\",\"quantity\":$QTY,\"unit_price\":$PRICE,\"total\":$ITEM_TOTAL}"
  done
  ITEMS_JSON+="]"

  VAT=$((TOTAL * 10 / 100))
  GRAND_TOTAL=$((TOTAL + VAT))

  curl -s -X POST "$URL/rest/v1/quotations" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"$USER_ID\",
      \"project_id\": \"$PROJECT_ID\",
      \"customer_name\": \"$CUSTOMER\",
      \"items\": $ITEMS_JSON,
      \"subtotal\": $TOTAL,
      \"vat\": $VAT,
      \"total\": $GRAND_TOTAL,
      \"issued_date\": \"$TODAY\",
      \"notes\": \"프로젝트: $SITE_NAME\\n유효기간: 발급일로부터 30일\"
    }" > /dev/null

  QUOTE_COUNT=$((QUOTE_COUNT + 1))
done

echo "  ✓ 총 $QUOTE_COUNT개 견적서 생성"

# 6. 실측 리포트 생성
echo ""
echo "📐 실측 리포트 생성 중..."

ROOMS=("거실" "침실" "주방" "욕실" "현관")
MATERIALS=("대리석" "타일" "목재" "벽지" "페인트")

MEASUREMENT_COUNT=0
for i in "${!PROJECT_IDS[@]}"; do
  PROJECT_ID="${PROJECT_IDS[$i]}"
  SITE_NAME=$(echo "${SITES[$i]}" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  CUSTOMER=$(echo "${SITES[$i]}" | grep -o '"customer":"[^"]*"' | cut -d'"' -f4)

  # 공간별 측정 데이터
  ROOMS_JSON="{"
  for j in "${!ROOMS[@]}"; do
    ROOM="${ROOMS[$j]}"
    WIDTH=$((RANDOM % 6 + 3))
    LENGTH=$((RANDOM % 10 + 3))
    HEIGHT=$((RANDOM % 12 + 24))
    AREA=$((WIDTH * LENGTH))

    MAT1="${MATERIALS[$((RANDOM % ${#MATERIALS[@]}))]}"
    MAT2="${MATERIALS[$((RANDOM % ${#MATERIALS[@]}))]}"

    if [ $j -gt 0 ]; then ROOMS_JSON+=","; fi
    ROOMS_JSON+="\"$ROOM\":{\"dimensions\":\"${WIDTH}m × ${LENGTH}m × ${HEIGHT}cm\",\"area\":\"${AREA}m²\",\"materials\":[\"$MAT1\",\"$MAT2\"],\"photos\":[],\"notes\":\"$ROOM 공간 측정완료. 상태 양호.\"}"
  done
  ROOMS_JSON+="}"

  CHECKLIST="{\"구조_점검\":true,\"전기_점검\":true,\"수도_점검\":true,\"환기_점검\":true,\"채광_점검\":true,\"안전_점검\":true,\"기타_사항\":\"실측 완료, 시공 가능\"}"

  curl -s -X POST "$URL/rest/v1/measurements_v2" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_id\": \"$USER_ID\",
      \"project_id\": \"$PROJECT_ID\",
      \"site_name\": \"$SITE_NAME\",
      \"customer_name\": \"$CUSTOMER\",
      \"measurement_date\": \"$TODAY\",
      \"rooms\": $ROOMS_JSON,
      \"checklist\": $CHECKLIST,
      \"overall_notes\": \"$SITE_NAME 현장 실측 완료. 시공 일정은 협의 예정.\",
      \"surveyor\": \"이건주\"
    }" > /dev/null

  MEASUREMENT_COUNT=$((MEASUREMENT_COUNT + 1))
done

echo "  ✓ 총 $MEASUREMENT_COUNT개 실측 리포트 생성"

echo ""
echo "============================================================"
echo "✅ 모든 테스트 데이터 생성 완료!"
echo "============================================================"
echo ""
echo "📊 생성된 데이터:"
echo "  • 현장: ${#PROJECT_IDS[@]}개"
echo "  • 공정: $WORK_COUNT개"
echo "  • 외주: $SUB_COUNT개"
echo "  • 견적서: $QUOTE_COUNT개"
echo "  • 실측리포트: $MEASUREMENT_COUNT개"
echo ""
echo "🔗 앱에 접속해서 확인하세요: https://invoice-2cd.pages.dev/"
echo "   ID: test3@test.com / PW: 12345678"
echo ""
