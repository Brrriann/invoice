const ALLOWED_ORIGINS = [
  'https://invoice-2cd.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await context.request.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: '이미지 데이터가 없습니다.' }), { status: 400, headers });
    }

    const apiKey = context.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }), { status: 500, headers });
    }

    // phi-4-multimodal 우선, 실패 시 llama-3.2-11b-vision 폴백
    const models = [
      'microsoft/phi-4-multimodal-instruct',
      'meta/llama-3.2-11b-vision-instruct',
    ];

    const prompt = `이 사업자등록증에서 다음 정보를 JSON 형식으로 추출해주세요.
다른 설명 없이 JSON만 출력하세요:
{
  "biz_no": "사업자등록번호 (000-00-00000 형식)",
  "biz_name": "상호",
  "biz_owner": "대표자 성명",
  "biz_address": "사업장 소재지",
  "biz_type": "업태",
  "biz_item": "종목",
  "biz_email": "이메일 (없으면 빈 문자열)"
}`;

    let lastError = null;
    for (const model of models) {
      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: prompt },
              ],
            }],
            max_tokens: 512,
            temperature: 0.1,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          lastError = `${model}: HTTP ${res.status} - ${errText}`;
          continue;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';

        // JSON 추출
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          lastError = `${model}: JSON 파싱 실패 - ${content}`;
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({ success: true, data: parsed, model }), { headers });

      } catch (e) {
        lastError = `${model}: ${e.message}`;
      }
    }

    return new Response(JSON.stringify({ error: `모든 모델 실패: ${lastError}` }), { status: 502, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: `서버 오류: ${e.message}` }), { status: 500, headers });
  }
}
