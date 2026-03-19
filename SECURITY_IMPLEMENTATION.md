# 보안 개선 - App.tsx 적용 예제

## 현재 위치: App.tsx 라인 251

### ❌ 현재 코드 (위험)
```typescript
// Line 251
} catch (error: unknown) {
  console.error('AI 블로그 생성 에러:', error);  // ← 민감정보 노출!

  let errorMessage = '알 수 없는 오류가 발생했습니다.';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  if (errorMessage.includes('401') || errorMessage.includes('permission')) {
    alert("API 키가 유효하지 않습니다...");
  } else if (errorMessage.includes('429')) {
    alert("API 사용량 한계에 도달했습니다...");
  } else {
    alert(`글 생성 중 오류가 발생했습니다: ${errorMessage}`);  // ← 에러 메시지 노출
  }
  setBlogData(prev => ({ ...prev, isGenerating: false }));
}
```

### ✅ 개선된 코드

```typescript
import { logSecureError, getUserFriendlyError } from './lib/secureLogger';

// 라인 251 근처 - AI 블로그 생성 에러 처리
} catch (error: unknown) {
  // 1️⃣ 보안 로깅 (민감정보 제외)
  logSecureError(
    'BLOG_GENERATION_ERROR',
    error,
    currentUser?.id,
    'error'
  );

  // 2️⃣ 사용자 친화적 메시지만 표시
  const userMessage = getUserFriendlyError(error);
  alert(userMessage);

  // 3️⃣ 상태 업데이트
  setBlogData(prev => ({ ...prev, isGenerating: false }));
}
```

**Note:** 현재는 Google API 키를 사용하지 않으므로, 향후 외부 AI API 연동 시 반드시 백엔드 프록시를 통해 호출해주세요.

---

## Supabase 쿼리 마이그레이션

### 예제 1: 프로젝트 목록 조회

**❌ 현재 (위험)**
```typescript
// 라인 389 근처
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .order('created_at', { ascending: false });
```

**✅ 개선**
```typescript
import { selectSecure } from './lib/supabaseSecure';

const data = await selectSecure('projects', currentUser.id, {
  select: '*',
  filter: { user_id: currentUser.id }  // 중복이지만 명시적
});
```

---

### 예제 2: 새 프로젝트 추가

**❌ 현재 (위험)**
```typescript
// 라인 470 근처
const { error } = await supabase.from('projects').insert([{
  user_id: currentUser.id,  // 수동으로 추가
  site_name,
  customer_name,
  // ...
}]);
```

**✅ 개선**
```typescript
import { insertSecure } from './lib/supabaseSecure';

await insertSecure('projects', currentUser.id, {
  site_name,
  customer_name,
  // user_id는 자동으로 추가됨
});
```

---

### 예제 3: 프로젝트 수정

**❌ 현재 (위험)**
```typescript
// user_id 검증이 없음!
await supabase
  .from('projects')
  .update({ site_name: newName })
  .eq('id', projectId);
```

**✅ 개선**
```typescript
import { updateSecure } from './lib/supabaseSecure';

// user_id 소유권 자동 검증
await updateSecure('projects', currentUser.id, projectId, {
  site_name: newName
});
```

---

### 예제 4: 프로젝트 삭제

**❌ 현재 (위험)**
```typescript
// 라인 462 근처
await supabase.from('subcontracts').delete().eq('id', id);
```

**✅ 개선**
```typescript
import { deleteSecure } from './lib/supabaseSecure';

await deleteSecure('subcontracts', currentUser.id, id);
```

---

## 적용 순서

### Phase 1: 로그 보안 (30분, 높은 우선순위)
1. `secureLogger.ts` 적용
2. `App.tsx`의 모든 `console.error` 제거
3. 사용자 알림은 `getUserFriendlyError()` 사용

```bash
# 확인: App.tsx에서 console.error 제거
grep -n "console.error" /c/invoice/src/App.tsx
```

### Phase 2: Supabase 쿼리 안전화 (1~2시간, 중간 우선순위)
1. `supabaseSecure.ts` 적용
2. 모든 `supabase.from()` 호출을 `selectSecure()` 등으로 변경
3. user_id 필터 추가

```bash
# 확인: supabase 쿼리 개수 세기
grep -n "supabase.from" /c/invoice/src/App.tsx | wc -l
```

### Phase 3: Role 기반 권한 (이후, 중간 우선순위)
1. Supabase에서 role 컬럼 추가
2. `permissions.ts` 구현
3. 권한 체크 추가

---

## 검증 체크리스트

```
□ console.error 모두 제거
□ 모든 supabase.from() 호출에 user_id 필터 추가
□ insertSecure 사용 시 user_id 중복 제거
□ updateSecure/deleteSecure 사용으로 권한 검증
□ 에러 메시지는 getUserFriendlyError() 사용
□ API 키 console.log 제거
□ 프로덕션 빌드에서 민감정보 확인
```

---

## 주의사항

### 1. insertSecure 사용 시
```typescript
// ❌ 안 됨 (user_id 중복)
await insertSecure('projects', userId, {
  user_id: userId,  // 중복!
  site_name: ''
});

// ✅ 정상
await insertSecure('projects', userId, {
  site_name: ''
  // user_id는 함수에서 자동 추가
});
```

### 2. RLS 정책이 없으면?
- supabaseSecure.ts는 **클라이언트 레벨** 검증만 제공
- 반드시 Supabase에서 **RLS 정책**도 설정해야 함
- 그렇지 않으면 직접 API로 쿼리 가능

### 3. user_id 필터가 없으면?
- RLS 없는 경우: 데이터 노출
- RLS 있는 경우: DB에서 차단 (느린 응답)
- **둘 다 필수!**
