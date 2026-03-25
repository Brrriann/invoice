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

// 추출된 텍스트에서 사업자 정보 파싱
function parseBizText(text) {
  const result = {
    biz_no: '', biz_name: '', biz_owner: '',
    biz_address: '', biz_type: '', biz_item: '', biz_email: ''
  };

  // 사업자등록번호: 000-00-00000
  const bizNoMatch = text.match(/(\d{3}-\d{2}-\d{5})/);
  if (bizNoMatch) result.biz_no = bizNoMatch[1];

  // 상호: 콜론 이후 텍스트 (공백 포함)
  const bizNameMatch = text.match(/상\s*호\s*[：:]\s*(.+?)(?:\n|성\s*명|$)/s)
    || text.match(/상\s*호[^가-힣]*([가-힣].+?)(?:\n|$)/);
  if (bizNameMatch) result.biz_name = bizNameMatch[1].trim().split('\n')[0].trim();

  // 성명: '상호' 줄과 '생년' 사이 구간에서 콜론 뒤 2~5자 한글 이름 추출
  // (OCR이 라벨을 '영:', '명:', '성명:' 등 다양하게 오인식하므로 라벨 무시)
  const nameSection = text.match(/상\s*호[^\n]*\n([\s\S]*?)생\s*년/);
  if (nameSection) {
    const nameMatch = nameSection[1].match(/[：:]\s*([가-힣]{2,5})/);
    if (nameMatch) result.biz_owner = nameMatch[1];
  }
  // fallback: 라벨 직접 매칭
  if (!result.biz_owner) {
    const ownerMatch = text.match(/성\s*명[\s:：]*([가-힣]{2,5})/)
      || text.match(/대\s*표\s*자[\s:：]*([가-힣]{2,5})/)
      || text.match(/[영명]\s*:\s*([가-힣]{2,5})/);
    if (ownerMatch) result.biz_owner = ownerMatch[1];
  }

  // 사업장 소재지
  const addressMatch = text.match(/사\s*업\s*장\s*소\s*재\s*지\s*[：:]\s*(.+?)(?:\n|사\s*업|$)/s)
    || text.match(/소\s*재\s*지[^가-힣]*(.+?)(?:\n|$)/);
  if (addressMatch) result.biz_address = addressMatch[1].trim().split('\n')[0].trim();

  // 업태: 첫 번째 항목만
  const typeMatch = text.match(/업\s*태\s*[：:]\s*([^\n종목]+)/)
    || text.match(/\[?업태\]?\s*([가-힣]+)/);
  if (typeMatch) result.biz_type = typeMatch[1].trim().split(/[\s,]/)[0];

  // 종목: 첫 번째 항목만
  const itemMatch = text.match(/종\s*목\s*[：:]\s*([^\n]+)/)
    || text.match(/\[?종목\]?\s*([가-힣]+)/);
  if (itemMatch) result.biz_item = itemMatch[1].trim().split(/[\n,]/)[0].trim();

  // 이메일: 프롬프트 지시로 모델이 'EMAIL: 주소' 형식으로 출력한 경우 우선 파싱
  const emailLabelMatch = text.match(/EMAIL:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailLabelMatch) {
    result.biz_email = emailLabelMatch[1];
  } else {
    // fallback: @ 기호 위치 기준 영역 추출
    const atIdx = text.indexOf('@');
    if (atIdx > 0) {
      const region = text.slice(Math.max(0, atIdx - 40), atIdx + 60).replace(/\s+/g, '');
      const regionMatch = region.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (regionMatch) result.biz_email = regionMatch[0];
    }
  }

  return result;
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

    // Step 1: 이미지에서 텍스트 전체 추출 (OCR)
    const ocrPrompt = `이 사업자등록증 이미지에 적힌 모든 텍스트를 그대로 읽어서 출력하세요.
빨간색, 파란색 등 색상과 관계없이 이미지에 보이는 모든 글자를 포함하세요.
특수문자, 띄어쓰기, 줄바꿈을 최대한 원본 그대로 유지하세요.
해석이나 설명 없이 텍스트만 출력하세요.
마지막으로, 이미지에 이메일 주소(@ 기호 포함)가 보이면 맨 마지막 줄에 반드시 EMAIL: 이메일주소 형식으로 출력하세요.`;

    const models = [
      'meta/llama-3.2-90b-vision-instruct',
      'meta/llama-3.2-11b-vision-instruct',
    ];

    let rawText = '';
    let usedModel = '';
    let lastError = '';

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
                { type: 'text', text: ocrPrompt },
              ],
            }],
            max_tokens: 1024,
            temperature: 0.1,
          }),
        });

        if (!res.ok) {
          lastError = `${model}: HTTP ${res.status}`;
          continue;
        }

        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
        usedModel = model;
        if (rawText.trim()) break;

      } catch (e) {
        lastError = `${model}: ${e.message}`;
      }
    }

    if (!rawText.trim()) {
      return new Response(JSON.stringify({ error: `텍스트 추출 실패: ${lastError}` }), { status: 502, headers });
    }

    // Step 2: 정규식으로 구조화
    const parsed = parseBizText(rawText);

    // Step 3: 이메일이 추출되지 않은 경우 전용 2차 호출
    if (!parsed.biz_email && !rawText.includes('@')) {
      try {
        const emailPrompt = `이 이미지에서 이메일 주소(@ 기호가 포함된 텍스트)를 찾아서 이메일 주소만 출력하세요. 빨간색이나 다른 색상의 글씨도 포함합니다. 이메일이 없으면 "없음"이라고만 출력하세요.`;
        const emailRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: usedModel,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                { type: 'text', text: emailPrompt },
              ],
            }],
            max_tokens: 64,
            temperature: 0,
          }),
        });
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          const emailRaw = emailData.choices?.[0]?.message?.content || '';
          const emailMatch = emailRaw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) parsed.biz_email = emailMatch[0];
        }
      } catch (_) { /* 이메일 추출 실패는 무시 */ }
    }

    return new Response(JSON.stringify({
      success: true,
      data: parsed,
      model: usedModel,
      rawText,
    }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: `서버 오류: ${e.message}` }), { status: 500, headers });
  }
}
