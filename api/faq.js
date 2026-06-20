import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ohmptflnwplotzfwnsuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obXB0Zmxud3Bsb3R6Znduc3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5MzEsImV4cCI6MjA5NzEyNTkzMX0.GtlDRgKW6surk-O_2jU1oChDOUnLGN_oIRblvfcF4k8';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<div style="text-align:center; padding: 4rem;">잘못된 접근입니다. URL에 매장 ID를 포함해주세요.</div>');
  }

  try {
    const [storeRes, faqsRes] = await Promise.all([
      supabaseClient.from('stores').select('store_name').eq('id', id).single(),
      supabaseClient.from('contents').select('*').eq('store_id', id).eq('type', '질문뱅크(FAQ)').order('created_at', { ascending: true })
    ]);

    const store = storeRes.data;
    const faqs = faqsRes.data || [];

    const storeName = store ? store.store_name : '매장';
    const title = `${storeName} - FAQ`;

    let faqHtml = '';
    if (faqs.length === 0) {
      faqHtml = '<div class="loading">등록된 FAQ가 없습니다.</div>';
    } else {
      faqHtml = faqs.map(faq => {
        let q = '질문';
        let a = '답변';
        
        if (typeof faq.content_data === 'string') {
          try {
            const parsed = JSON.parse(faq.content_data);
            q = parsed.question || faq.content_data;
            a = parsed.answer || '';
          } catch (e) {
            const parts = faq.content_data.split('\n');
            q = parts[0] || '';
            a = parts.slice(1).join('<br>') || '';
          }
        } else if (faq.content_data && typeof faq.content_data === 'object') {
          q = faq.content_data.question || faq.content_data.Q || faq.content_data.q || '';
          a = faq.content_data.answer || faq.content_data.A || faq.content_data.a || '';
        } else if (faq.content_text) {
          const parts = faq.content_text.split('\n');
          q = parts[0] || '';
          a = parts.slice(1).join('<br>') || '';
        }

        return `
          <article class="faq-item">
            <h3 class="faq-q">Q. ${q.replace(/^Q\.?\s*/i, '')}</h3>
            <div class="faq-a">${a.replace(/^A\.?\s*/i, '')}</div>
          </article>
        `;
      }).join('');
    }

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <div class="faq-header">
      <a href="/?id=${id}" id="back-link" class="back-link">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        홈으로 돌아가기
      </a>
    </div>
    
    <h1 class="faq-title">자주 묻는 질문</h1>
    
    <div id="faq-container" class="faq-list">
      ${faqHtml}
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error(error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<div style="text-align:center; padding: 4rem;">서버 오류가 발생했습니다.</div>');
  }
}
