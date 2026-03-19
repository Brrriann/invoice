/**
 * 🔐 안전한 Supabase 쿼리 헬퍼
 * - 자동 user_id 필터링
 * - RLS 정책 강제
 * - 권한 검증
 */

import { supabase } from './supabase';

/**
 * 테이블 이름 타입 정의
 */
type SecureTable = 'projects' | 'work_items' | 'subcontracts' | 'quotations' | 'measurements_v2' | 'company_profiles';

/**
 * 안전한 SELECT 쿼리 (user_id 필터 필수)
 *
 * ✅ 사용 예:
 * ```
 * const data = await selectSecure('projects', user.id);
 * ```
 *
 * ❌ 방지되는 쿼리:
 * ```
 * const data = await supabase.from('projects').select('*'); // ← user_id 필터 없음!
 * ```
 */
export async function selectSecure(
  table: SecureTable,
  userId: string,
  options?: {
    select?: string;
    filter?: Record<string, any>;
    single?: boolean;
  }
): Promise<any> {
  try {
    let query = supabase.from(table).select(options?.select || '*');

    // ✅ 필수: user_id 필터
    query = query.eq('user_id', userId);

    // 추가 필터 조건 (있으면)
    if (options?.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const result = options?.single ? await query.single() : await query;

    if (result.error) {
      throw new Error(`Query failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.debug('Supabase SELECT error');
    throw error;
  }
}

/**
 * 안전한 INSERT (user_id 자동 추가)
 *
 * ✅ 사용 예:
 * ```
 * await insertSecure('projects', user.id, {
 *   site_name: '현장명',
 *   customer_name: '고객명'
 * });
 * ```
 */
export async function insertSecure(
  table: SecureTable,
  userId: string,
  data: Record<string, any>
): Promise<any> {
  try {
    // ✅ 자동으로 user_id 추가
    const dataWithUserId = { ...data, user_id: userId };

    const result = await supabase
      .from(table)
      .insert([dataWithUserId])
      .select();

    if (result.error) {
      throw new Error(`Insert failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.debug('Supabase INSERT error');
    throw error;
  }
}

/**
 * 안전한 UPDATE (user_id 소유권 검증)
 *
 * ✅ 사용 예:
 * ```
 * await updateSecure('projects', user.id, recordId, {
 *   site_name: '새로운 현장명'
 * });
 * ```
 */
export async function updateSecure(
  table: SecureTable,
  userId: string,
  recordId: string,
  data: Record<string, any>
): Promise<any> {
  try {
    // ✅ 검증: 해당 레코드가 user_id 소유인지 확인
    const { data: existing } = await supabase
      .from(table)
      .select('user_id')
      .eq('id', recordId)
      .single();

    if (!existing || existing.user_id !== userId) {
      throw new Error('Unauthorized: Cannot update record of another user');
    }

    // ✅ user_id는 변경 불가능하도록
    const { user_id, ...safeData } = data;

    const result = await supabase
      .from(table)
      .update(safeData)
      .eq('id', recordId)
      .eq('user_id', userId);

    if (result.error) {
      throw new Error(`Update failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.debug('Supabase UPDATE error');
    throw error;
  }
}

/**
 * 안전한 DELETE (user_id 소유권 검증)
 *
 * ✅ 사용 예:
 * ```
 * await deleteSecure('projects', user.id, recordId);
 * ```
 */
export async function deleteSecure(
  table: SecureTable,
  userId: string,
  recordId: string
): Promise<any> {
  try {
    // ✅ 검증: 해당 레코드가 user_id 소유인지 확인
    const { data: existing } = await supabase
      .from(table)
      .select('user_id')
      .eq('id', recordId)
      .single();

    if (!existing || existing.user_id !== userId) {
      throw new Error('Unauthorized: Cannot delete record of another user');
    }

    const result = await supabase
      .from(table)
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId);

    if (result.error) {
      throw new Error(`Delete failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.debug('Supabase DELETE error');
    throw error;
  }
}

/**
 * 배치 작업: 여러 레코드를 user_id 소유권 검증 후 수정
 */
export async function batchUpdateSecure(
  table: SecureTable,
  userId: string,
  updates: Array<{ id: string; data: Record<string, any> }>
): Promise<any> {
  try {
    const promises = updates.map(({ id, data }) =>
      updateSecure(table, userId, id, data)
    );

    return Promise.all(promises);
  } catch (error) {
    console.debug('Batch update error');
    throw error;
  }
}

/**
 * 안전한 UPSERT (user_id 자동 포함 및 검증)
 *
 * ✅ 사용 예:
 * ```
 * await upsertSecure('company_profiles', user.id, {
 *   name: '회사명',
 *   contact: '연락처'
 * });
 * ```
 */
export async function upsertSecure(
  table: SecureTable,
  userId: string,
  data: Record<string, any>
): Promise<any> {
  try {
    // ✅ 자동으로 user_id 추가
    const dataWithUserId = { ...data, user_id: userId };

    const result = await supabase
      .from(table)
      .upsert([dataWithUserId], { onConflict: 'user_id' })
      .select();

    if (result.error) {
      throw new Error(`Upsert failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.debug('Supabase UPSERT error');
    throw error;
  }
}
