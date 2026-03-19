/**
 * 🔒 보안 로깅 시스템
 * 민감정보 노출 방지 + 프로덕션 에러 추적
 */

interface ErrorLog {
  type: string;
  code?: string;
  userId?: string;
  timestamp: string;
  severity: 'debug' | 'info' | 'warning' | 'error';
  // 민감정보는 포함하지 않음
}

// 개발 환경에서만 상세 로그 출력
const isDev = import.meta.env.DEV;

/**
 * 에러 코드 추출 (민감정보 제외)
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    // API 에러 코드만 추출 (예: "401", "429")
    const match = error.message.match(/\d{3}/);
    return match ? match[0] : 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/**
 * 안전한 에러 로깅
 * - 콘솔에는 로그 타입만 출력
 * - 서버에는 코드 + 사용자ID만 전송
 * - 민감정보(스택트레이스, API 키 등)는 제외
 */
export function logSecureError(
  type: string,
  error: unknown,
  userId?: string,
  severity: 'debug' | 'info' | 'warning' | 'error' = 'error'
): ErrorLog {
  const errorCode = getErrorCode(error);
  const log: ErrorLog = {
    type,
    code: errorCode,
    userId,
    timestamp: new Date().toISOString(),
    severity
  };

  // 개발 환경: 상세 정보 출력
  if (isDev) {
    console.log(`[${type}] Code: ${errorCode}`, error);
  } else {
    // 프로덕션: 최소 정보만
    console.debug(`Error: ${type}`);
  }

  // 선택: 서버로 전송 (나중에 구현)
  // sendToErrorTracking(log);

  return log;
}

/**
 * 사용자 친화적 에러 메시지 생성
 * - 에러 코드에 따른 메시지 반환
 * - 민감정보 포함 안 함
 */
export function getUserFriendlyError(error: unknown): string {
  const code = getErrorCode(error);

  const messages: Record<string, string> = {
    '401': '인증이 필요합니다. 다시 로그인해주세요.',
    '403': '접근 권한이 없습니다.',
    '404': '요청한 데이터를 찾을 수 없습니다.',
    '429': 'API 사용량 한계에 도달했습니다. 잠시 후 다시 시도해주세요.',
    '500': '서버 오류가 발생했습니다. 관리자에게 문의해주세요.',
    'UNKNOWN': '알 수 없는 오류가 발생했습니다.'
  };

  return messages[code] || messages['UNKNOWN'];
}

/**
 * API 에러 필터링
 * - 에러 메시지에 민감정보 포함 확인
 * - 프로덕션에서 상세 메시지 숨기기
 */
export function sanitizeApiError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('An error occurred');
  }

  // 개발 환경에서만 원본 에러 반환
  if (isDev) {
    return error;
  }

  // 프로덕션: 에러 코드만 유지
  const code = getErrorCode(error);
  return new Error(`Error ${code}`);
}
