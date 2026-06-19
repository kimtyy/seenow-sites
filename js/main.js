// URL에서 store_id 파라미터 가져오기
function getStoreIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// 매장 정보 가져오기
async function fetchStore(storeId) {
  try {
    const { data, error } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching store:', error);
    return null;
  }
}

// FAQ 데이터 가져오기
async function fetchFAQs(storeId) {
  try {
    const { data, error } = await supabaseClient
      .from('contents')
      .select('*')
      .eq('store_id', storeId)
      .eq('type', '질문뱅크(FAQ)')
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return [];
  }
}

// 메인 페이지 렌더링
async function initHomePage() {
  const storeId = getStoreIdFromUrl();
  const container = document.getElementById('app-container');
  
  if (!storeId) {
    container.innerHTML = '<div class="error">잘못된 접근입니다. URL에 매장 ID를 포함해주세요.</div>';
    return;
  }

  const store = await fetchStore(storeId);
  if (!store) {
    container.innerHTML = '<div class="error">매장 정보를 찾을 수 없습니다.</div>';
    return;
  }

  // 메타 태그 및 타이틀 업데이트
  document.title = `${store.store_name} - 미니홈페이지`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = store.concept || `${store.store_name} 매장 소개입니다.`;

  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.name = "keywords";
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.content = `${store.store_name}, 매장, 소개, ${store.address ? store.address.split(' ').slice(0, 2).join(' ') : ''}`;

  // JSON-LD 마크업 추가 (SEO / LLM AEO 최적화)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": store.menu && store.menu.length > 0 ? "FoodEstablishment" : "LocalBusiness",
    "name": store.store_name,
    "description": store.concept || `${store.store_name} 매장입니다.`,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": store.address || ""
    },
    "telephone": store.phone_number || "",
    "openingHours": store.business_hours || ""
  };
  
  const scriptLd = document.createElement('script');
  scriptLd.type = 'application/ld+json';
  scriptLd.text = JSON.stringify(jsonLd);
  document.head.appendChild(scriptLd);

  // FAQ 링크 업데이트
  const faqBtn = document.getElementById('faq-link');
  if (faqBtn) {
    faqBtn.href = `faq.html?id=${storeId}`;
  }

  // HTML 렌더링
  let menuHtml = '';
  if (store.menu && Array.isArray(store.menu) && store.menu.length > 0) {
    menuHtml = store.menu.map(item => `
      <li class="menu-item">
        <span class="menu-name">${item}</span>
      </li>
    `).join('');
  } else {
    menuHtml = '<li class="menu-item"><span class="menu-name text-muted">등록된 메뉴가 없습니다.</span></li>';
  }

  container.innerHTML = `
    <header class="hero">
      <h1 class="hero-title">${store.store_name || '이름 없는 매장'}</h1>
      <p class="hero-concept">${store.concept || '안녕하세요! 우리 매장에 오신 것을 환영합니다.'}</p>
    </header>
    
    <section class="info-section">
      <article class="info-item">
        <svg class="info-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        <address class="info-text" style="font-style: normal;">${store.address || '주소 정보가 없습니다.'}</address>
      </article>
      <article class="info-item">
        <svg class="info-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <time class="info-text">${store.business_hours || '영업시간 정보가 없습니다.'}</time>
      </article>
      <article class="info-item">
        <svg class="info-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
        <div class="info-text"><a href="tel:${(store.phone_number || '').replace(/[^0-9]/g, '')}" style="color: inherit; text-decoration: none;">${store.phone_number || '전화번호 정보가 없습니다.'}</a></div>
      </article>
    </section>
    
    <section class="menu-section">
      <h2 class="section-title">대표 메뉴</h2>
      <ul class="menu-list">
        ${menuHtml}
      </ul>
    </section>
  `;
}

// FAQ 페이지 렌더링
async function initFaqPage() {
  const storeId = getStoreIdFromUrl();
  const container = document.getElementById('faq-container');
  const backLink = document.getElementById('back-link');
  
  if (!storeId) {
    container.innerHTML = '<div class="error">잘못된 접근입니다. URL에 매장 ID를 포함해주세요.</div>';
    return;
  }

  if (backLink) {
    backLink.href = `index.html?id=${storeId}`;
  }

  const [store, faqs] = await Promise.all([
    fetchStore(storeId),
    fetchFAQs(storeId)
  ]);

  if (store) {
    document.title = `${store.store_name} - FAQ`;
  }

  if (!faqs || faqs.length === 0) {
    container.innerHTML = '<div class="loading">등록된 FAQ가 없습니다.</div>';
    return;
  }

  const faqHtml = faqs.map(faq => {
    // Q는 content_data 객체에 question, answer 등의 형태로 저장되어 있다고 가정 (또는 raw 텍스트 처리)
    // 기존 AEO-GEO 프로젝트 데이터 구조에 맞춰 파싱: content_data 혹은 raw text
    let q = '질문';
    let a = '답변';
    
    if (typeof faq.content_data === 'string') {
      try {
        const parsed = JSON.parse(faq.content_data);
        q = parsed.question || faq.content_data;
        a = parsed.answer || '';
      } catch (e) {
        // 일반 텍스트일 경우
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

  container.innerHTML = faqHtml;
}

// 페이지 로드 시 실행 분기
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('app-container')) {
    initHomePage();
  } else if (document.getElementById('faq-container')) {
    initFaqPage();
  }
});
