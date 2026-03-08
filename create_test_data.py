#!/usr/bin/env python3
import os
import sys
from datetime import datetime, timedelta
import random

# Supabase 클라이언트 초기화
try:
    from supabase import create_client
except ImportError:
    print("Installing supabase-py...")
    os.system(f"{sys.executable} -m pip install supabase -q")
    from supabase import create_client

url = "https://puofpkpwfqwyzdsrvupf.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1b2Zwa3B3ZnF3eXpkc3J2dXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTkwMDMwMDAsImV4cCI6MTcxNzA3NTIwMH0.R4eJL3Ni9D3yzGsJ2H9dK8L1M2N9O1P2Q3R4S5T6U7"
supabase = create_client(url, key)

# ===== 데이터 정의 =====
SITES = [
    {"name": "서초동 오피스텔 인테리어", "customer": "김철수", "amount": 85000000},
    {"name": "강남역 카페 리모델링", "customer": "박영희", "amount": 42000000},
    {"name": "삼성동 아파트 증축", "customer": "이민준", "amount": 120000000},
    {"name": "홍대 상가 개조", "customer": "최수진", "amount": 65000000},
    {"name": "을지로 사무실 이전", "customer": "박준호", "amount": 55000000},
    {"name": "명동 매장 인테리어", "customer": "정민지", "amount": 38000000},
    {"name": "잠실 주상복합 공사", "customer": "이순신", "amount": 150000000},
    {"name": "대림동 공장 확장", "customer": "안영철", "amount": 95000000},
    {"name": "영등포 건물주택 리모델", "customer": "오지현", "amount": 72000000},
    {"name": "청담동 펜트하우스 인테리어", "customer": "구본영", "amount": 110000000},
]

WORK_ITEMS = [
    "철거 및 폐기물 처리",
    "기초 콘크리트 타설",
    "벽체 구조 시공",
    "전기 배선 공사",
    "수도/난방 배관",
    "방수 공사",
    "타일/석재 붙이기",
    "목공 및 조립",
    "페인트 도장",
    "마감재 설치",
    "조명 설치",
    "도어/창호 설치",
    "유리 시공",
    "금속 구조물 설치",
    "건축미장",
]

SUBCONTRACT_ITEMS = [
    "전기 전문가 팀",
    "배관 전문가",
    "목공 전문가",
    "페인트 시공팀",
    "타일 시공 팀",
    "철강구조 전문",
    "유리시공 업체",
]

QUOTATION_ITEMS = [
    {"name": "기초 자재", "unit": "일식", "qty": 100, "unit_price": 50000},
    {"name": "철근 콘크리트", "unit": "m3", "qty": 25, "unit_price": 180000},
    {"name": "벽체 자재", "unit": "박스", "qty": 500, "unit_price": 85000},
    {"name": "전선 케이블", "unit": "km", "qty": 3, "unit_price": 150000},
    {"name": "배관 자재", "unit": "개", "qty": 200, "unit_price": 25000},
    {"name": "페인트", "unit": "통", "qty": 80, "unit_price": 35000},
    {"name": "타일", "unit": "m2", "qty": 150, "unit_price": 45000},
    {"name": "문/창호", "unit": "개", "qty": 45, "unit_price": 280000},
    {"name": "조명기구", "unit": "개", "qty": 120, "unit_price": 65000},
    {"name": "수전 및 액세서리", "unit": "개", "qty": 80, "unit_price": 45000},
]

ROOMS = ["거실", "침실", "주방", "욕실", "현관", "복도", "사무실", "창고"]
MATERIALS = ["대리석", "타일", "목재", "벽지", "페인트", "석고보드", "강화마루", "유리"]

def get_user_id():
    """test3@test.com 사용자의 user_id 조회"""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": "test3@test.com",
            "password": "12345678"
        })
        return response.user.id
    except Exception as e:
        print(f"❌ 로그인 실패: {e}")
        return None

def create_projects(user_id):
    """현장 10개 생성"""
    print("\n📍 현장 생성 중...")
    projects = []
    for site in SITES:
        data = {
            "user_id": user_id,
            "site_name": site["name"],
            "customer_name": site["customer"],
            "total_amount": site["amount"],
            "invoice_status": random.choice(["미발급", "발급예정", "발급완료"]),
            "payment_status": random.choice(["미수금", "부분수금", "완납"]),
            "biz_name": "건축패스",
            "biz_owner": "이건주",
            "biz_address": "서울시 강남구",
            "biz_type": "인테리어 업체",
            "biz_item": "건축/건설 공사",
            "biz_email": "contact@architectpass.com"
        }
        response = supabase.table("projects").insert(data).execute()
        if response.data:
            projects.append(response.data[0])
            print(f"  ✓ {site['name']}")
    return projects

def create_work_items(user_id, projects):
    """각 현장마다 공정 3-5개 생성"""
    print("\n🔨 공정 항목 생성 중...")
    today = datetime.now().date()
    work_count = 0

    for project in projects:
        num_items = random.randint(3, 5)
        selected_items = random.sample(WORK_ITEMS, num_items)

        for idx, item_name in enumerate(selected_items):
            start_days = idx * 7  # 주간 단위로 시작일 설정
            start_date = (today + timedelta(days=start_days)).isoformat()
            end_date = (today + timedelta(days=start_days + 5)).isoformat()

            data = {
                "user_id": user_id,
                "project_id": project["id"],
                "label": item_name,
                "type": "시공",
                "status": random.choice(["실측예정", "실측 후 대기", "시공확정", "시공중", "완료"]),
                "start_date": start_date,
                "end_date": end_date
            }
            supabase.table("work_items").insert(data).execute()
            work_count += 1

    print(f"  ✓ 총 {work_count}개 공정 생성")

def create_subcontracts(user_id, projects):
    """각 현장마다 외주 2-3개 생성"""
    print("\n👷 외주 항목 생성 중...")
    today = datetime.now().date()
    sub_count = 0

    for project in projects:
        num_subs = random.randint(2, 3)
        selected_subs = random.sample(SUBCONTRACT_ITEMS, num_subs)

        for idx, sub_name in enumerate(selected_subs):
            start_days = idx * 10
            start_date = (today + timedelta(days=start_days)).isoformat()
            end_date = (today + timedelta(days=start_days + 15)).isoformat()

            data = {
                "user_id": user_id,
                "project_id": project["id"],
                "label": sub_name,
                "amount": random.randint(5000000, 30000000),
                "start_date": start_date,
                "end_date": end_date,
                "invoice_issued": random.choice([True, False]),
                "payment_done": random.choice([True, False])
            }
            supabase.table("subcontracts").insert(data).execute()
            sub_count += 1

    print(f"  ✓ 총 {sub_count}개 외주 생성")

def create_quotations(user_id, projects):
    """각 현장마다 견적서 1개 생성"""
    print("\n📋 견적서 생성 중...")
    quotations = []

    for idx, project in enumerate(projects):
        items_data = []
        total = 0

        # 각 견적서마다 3-5개의 항목 선택
        num_items = random.randint(3, 5)
        selected_items = random.sample(QUOTATION_ITEMS, num_items)

        for item in selected_items:
            item_total = item["qty"] * item["unit_price"]
            items_data.append({
                "name": item["name"],
                "unit": item["unit"],
                "quantity": item["qty"],
                "unit_price": item["unit_price"],
                "total": item_total
            })
            total += item_total

        vat = int(total * 0.1)
        grand_total = total + vat

        data = {
            "user_id": user_id,
            "project_id": project["id"],
            "customer_name": project["customer_name"],
            "items": items_data,
            "subtotal": total,
            "vat": vat,
            "total": grand_total,
            "issued_date": datetime.now().date().isoformat(),
            "notes": f"프로젝트: {project['site_name']}\n유효기간: 발급일로부터 30일"
        }
        response = supabase.table("quotations").insert(data).execute()
        if response.data:
            quotations.append(response.data[0])
            print(f"  ✓ {project['site_name']} 견적서")

    return quotations

def create_measurements(user_id, projects):
    """각 현장마다 실측 리포트 1개 생성"""
    print("\n📐 실측 리포트 생성 중...")
    measurements = []

    for project in projects:
        rooms_data = {}

        # 현장마다 3-5개의 공간 측정
        num_rooms = random.randint(3, 5)
        selected_rooms = random.sample(ROOMS, num_rooms)

        for room in selected_rooms:
            width = round(random.uniform(3, 8), 1)
            length = round(random.uniform(3, 12), 1)
            height = round(random.uniform(2.4, 3.5), 1)
            area = round(width * length, 2)

            selected_materials = random.sample(MATERIALS, random.randint(2, 4))

            rooms_data[room] = {
                "dimensions": f"{width}m × {length}m × {height}m (높이)",
                "area": f"{area}m²",
                "materials": selected_materials,
                "photos": [],
                "notes": f"{room} 공간 측정완료. 벽면 상태 양호, 바닥 상태 양호."
            }

        checklist = {
            "구조_점검": True,
            "전기_점검": random.choice([True, False]),
            "수도_점검": True,
            "환기_점검": random.choice([True, False]),
            "채광_점검": True,
            "안전_점검": True,
            "기타_사항": "실측 완료, 시공 가능"
        }

        data = {
            "user_id": user_id,
            "project_id": project["id"],
            "site_name": project["site_name"],
            "customer_name": project["customer_name"],
            "measurement_date": (datetime.now() - timedelta(days=random.randint(1, 30))).date().isoformat(),
            "rooms": rooms_data,
            "checklist": checklist,
            "overall_notes": f"{project['site_name']} 현장 실측 완료. 시공 일정은 협의 예정.",
            "surveyor": "이건주"
        }
        response = supabase.table("measurements_v2").insert(data).execute()
        if response.data:
            measurements.append(response.data[0])
            print(f"  ✓ {project['site_name']} 실측 리포트")

    return measurements

def main():
    print("=" * 60)
    print("🚀 공정관리 대시보드 - 테스트 데이터 생성")
    print("=" * 60)

    # 사용자 ID 조회
    print("\n🔑 사용자 인증 중...")
    user_id = get_user_id()
    if not user_id:
        print("❌ 사용자를 찾을 수 없습니다.")
        return
    print(f"  ✓ User ID: {user_id}")

    # 데이터 생성
    projects = create_projects(user_id)
    if not projects:
        print("❌ 현장 생성 실패")
        return

    create_work_items(user_id, projects)
    create_subcontracts(user_id, projects)
    create_quotations(user_id, projects)
    create_measurements(user_id, projects)

    print("\n" + "=" * 60)
    print("✅ 모든 테스트 데이터 생성 완료!")
    print("=" * 60)
    print(f"\n📊 생성된 데이터:")
    print(f"  • 현장: 10개")
    print(f"  • 공정: {len(projects) * 4}개 (현장당 평균 4개)")
    print(f"  • 외주: {len(projects) * 2}개 (현장당 평균 2개)")
    print(f"  • 견적서: 10개")
    print(f"  • 실측리포트: 10개")
    print(f"\n🔗 앱에 접속해서 확인하세요: https://invoice-2cd.pages.dev/")
    print(f"   ID: test3@test.com / PW: 12345678")

if __name__ == "__main__":
    main()
