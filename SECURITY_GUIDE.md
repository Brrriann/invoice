# 🔒 공정관리시스템 - 보안 강화 가이드

## 현재 상태 분석

### ✅ 이미 적용된 보안
- Supabase 세션 기반 인증
- 환경변수로 API 키 관리 (`.env`)
- Supabase RLS 정책 설정 (DB 레벨)

### ⚠️ 개선 필요 사항
1. **로그 보안** - console.error로 민감정보 노출
2. **Role 기반 권한** - 모든 사용자 동일 권한
3. **API 키 보안** - VITE_ 접두사로 브라우저 노출
4. **Rate Limit** - API 호출 제한 없음
5. **클라이언트 권한 강제** - user_id 필터링 미흡

---

## 🛠️ 개선 방안 (3단계)

### **Step 1: 보안 로깅 시스템 구축**

**취약점:**
```javascript
// ❌ 현재 (민감정보 노출)
catch (error: unknown) {
  console.error('AI 블로그 생성 에러:', error);  // 전체 에러 객체 노출
  const errorMessage = error.message;  // stack trace 노출 가능
}
```

**개선된 코드:**
```javascript
// ✅ 개선 후
catch (error: unknown) {
  // 1. 에러 타입만 서버로 전송 (민감정보 제외)
  logErrorToServer({
    type: 'GEMINI_API_ERROR',
    code: getErrorCode(error),
    userId: currentUser.id,
    timestamp: new Date().toISOString()
  });

  // 2. 콘솔에는 일반 메시지만 출력
  console.debug('API error occurred');  // 프로덕션에서는 숨겨짐

  // 3. 사용자에게는 친화적 메시지만 표시
  showUserFriendlyError(error);
}
```

---

### **Step 2: Role 기반 권한 분리**

**데이터베이스 구조 (Supabase):**
```sql
-- users 테이블에 role 추가
ALTER TABLE auth.users ADD COLUMN role TEXT DEFAULT 'user';

-- RLS 정책 (모든 테이블에 적용)
CREATE POLICY "users_can_see_own_data"
  ON projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admin_can_see_all"
  ON projects
  FOR SELECT
  USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );
```

**클라이언트 권한 강제:**
```typescript
// 🔐 permissions.ts
type Permission = 'read' | 'write' | 'delete' | 'admin';
type Role = 'user' | 'team_lead' | 'admin';

const rolePermissions: Record<Role, Permission[]> = {
  user: ['read', 'write'],
  team_lead: ['read', 'write', 'delete'],
  admin: ['read', 'write', 'delete', 'admin']
};

export function canPerform(role: Role, action: Permission): boolean {
  return rolePermissions[role].includes(action);
}

// 사용 예
if (!canPerform(userRole, 'delete')) {
  throw new Error('Unauthorized: Cannot delete');
}
```

---

### **Step 3: API 키 안전 관리**

**현재 문제:**
```
VITE_GEMINI_API_KEY=AIzaSy... # ← 브라우저에 노출!
```

**개선 방식 1: 백엔드 프록시 사용** (향후 필요 시)
```javascript
// 현재: Google API 키 사용 안 함
// 향후 Claude API 또는 다른 AI 서비스 연동 시
// 반드시 백엔드 프록시를 통해 호출 필수

async function generateBlog(content: string) {
  // ✅ 자신의 백엔드를 통해 호출
  const response = await fetch('/api/ai/generate-blog', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
  return response.json();
}
```

```typescript
// backend/routes/ai.ts (Node.js / Deno)
import { Anthropic } from '@anthropic-ai/sdk';

export async function generateBlog(req, res) {
  // API 키는 서버 환경변수에서만 읽음
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY  // ← 서버에만 존재
  });

  const result = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [{ role: "user", content: req.body.content }]
  });

  res.json({ result: result.content[0].text });
}
```

**개선 방식 2: Rate Limit 추가**
```typescript
// backend/middleware/rateLimit.ts
const rateLimitMap = new Map<string, number[]>();
const REQUESTS_PER_MINUTE = 5;

export function rateLimitMiddleware(req, res, next) {
  const userId = req.user.id;
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];

  // 1분 이내 요청만 유지
  const recent = timestamps.filter(t => now - t < 60000);

  if (recent.length >= REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: 60
    });
  }

  rateLimitMap.set(userId, [...recent, now]);
  next();
}
```

---

### **Step 4: Supabase RLS 강제 확인**

**클라이언트 코드에서 항상 user_id 필터링:**
```typescript
// ❌ 위험한 코드
const { data } = await supabase
  .from('projects')
  .select('*');  // 모든 데이터 노출 가능

// ✅ 안전한 코드
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', currentUser.id)  // 필수!
  .single();  // 하나만 가져오기 (오류 감지)
```

---

## 📋 출시 전 최종 체크리스트

```
□ API 인증
  □ 모든 API 엔드포인트에 인증 토큰 필수
  □ 토큰 만료 시간 설정 (권장: 30분)
  □ 토큰 새로고침 메커니즘 구현

□ 권한 분리
  □ Role 테이블 생성 및 마이그레이션 완료
  □ RLS 정책 모든 테이블에 적용
  □ 클라이언트에서 권한 검증 추가

□ 민감정보 보호
  □ console.error/log에 민감정보 없음
  □ 에러 메시지는 일반적인 내용만
  □ 스택 트레이스는 로그만

□ API 키 보안
  □ 클라이언트 API 키 제거
  □ 백엔드 프록시 구현
  □ Rate limit 설정

□ 로깅 시스템
  □ 서버 에러 로그 시스템 구축
  □ 민감정보 필터링
  □ 감시 알림 설정

□ 테스트
  □ RLS 정책 테스트
  □ 권한 오버라이드 테스트
  □ API 키 유출 확인
```

---

## 🚀 우선순위

| 순위 | 작업 | 긴급도 | 난이도 |
|------|------|--------|--------|
| 1 | 로그 보안 (console 제거) | 🔴 높음 | 🟢 낮음 |
| 2 | user_id 필터링 강제 | 🔴 높음 | 🟢 낮음 |
| 3 | Role 기반 권한 | 🟡 중간 | 🟡 중간 |
| 4 | API 백엔드 프록시 | 🟡 중간 | 🔴 높음 |
| 5 | Rate Limit | 🟢 낮음 | 🟡 중간 |

