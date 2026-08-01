import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ohmptflnwplotzfwnsuq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obXB0Zmxud3Bsb3R6Znduc3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5MzEsImV4cCI6MjA5NzEyNTkzMX0.GtlDRgKW6surk-O_2jU1oChDOUnLGN_oIRblvfcF4k8';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 업종별 동적 포인트 컬러 테마 파서
 */
function getCategoryTheme(category = '') {
  const cat = (category || '').toLowerCase();
  if (cat.includes('맥주') || cat.includes('호프') || cat.includes('술집') || cat.includes('펍') || cat.includes('포차')) {
    return { primary: '#F5A623', primaryHover: '#D9822B', primaryLight: '#FFF9F0' }; // Warm Amber
  }
  if (cat.includes('음식') || cat.includes('식당') || cat.includes('맛집') || cat.includes('고기') || cat.includes('한식') || cat.includes('일식') || cat.includes('중식') || cat.includes('카페')) {
    return { primary: '#E85D04', primaryHover: '#DC2F02', primaryLight: '#FFF7ED' }; // Vibrant Orange
  }
  if (cat.includes('병원') || cat.includes('의원') || cat.includes('치과') || cat.includes('한의원') || cat.includes('약국')) {
    return { primary: '#2B6CB0', primaryHover: '#2C5282', primaryLight: '#EBF8FF' }; // Professional Blue
  }
  return { primary: '#4A5568', primaryHover: '#2D3748', primaryLight: '#F7FAFC' }; // Slate Gray (기본)
}

/**
 * 실시간 영업 상태 계산 로직 (자정 넘어가는 시간 및 예외 조용한 처리 지원)
 */
function getLiveStatus(hoursObj) {
  if (!hoursObj) return null;
  
  let hours = hoursObj;
  if (typeof hours === 'string') {
    try {
      hours = JSON.parse(hours);
    } catch (e) {
      return null;
    }
  }
  if (typeof hours !== 'object' || !hours) return null;

  try {
    // 한국 시각(KST) 구하기
    const now = new Date();
    const kstOffset = 9 * 60; // UTC+9 분
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (kstOffset * 60000));
    
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const currentDayIdx = kstDate.getDay();
    const currentDayKey = dayKeys[currentDayIdx];
    const prevDayKey = dayKeys[(currentDayIdx + 6) % 7];
    const currentMinutes = kstDate.getHours() * 60 + kstDate.getMinutes();

    function parseTimeStr(tStr) {
      if (!tStr) return null;
      const parts = tStr.split(':').map(Number);
      if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
      return parts[0] * 60 + parts[1];
    }

    function getDayTime(dayData) {
      if (!dayData) return null;
      if (typeof dayData === 'string') {
        const splitStr = dayData.split('~').map(s => s.trim());
        if (splitStr.length === 2) {
          return { open: parseTimeStr(splitStr[0]), close: parseTimeStr(splitStr[1]), rawOpen: splitStr[0], rawClose: splitStr[1] };
        }
      } else if (typeof dayData === 'object' && !dayData.closed && dayData.open && dayData.close) {
        return { open: parseTimeStr(dayData.open), close: parseTimeStr(dayData.close), rawOpen: dayData.open, rawClose: dayData.close };
      }
      return null;
    }

    // 1. 어제 자정 넘겨 영업 중인지 확인
    const prevData = getDayTime(hours[prevDayKey]);
    if (prevData && prevData.open !== null && prevData.close !== null && prevData.close <= prevData.open) {
      // 자정 넘김 (예: 17:00 ~ 01:00 -> close: 60)
      if (currentMinutes < prevData.close) {
        return {
          isOpen: true,
          badgeHtml: `<span class="live-status-badge open">🟢 영업중</span>`,
          text: `오늘 ${prevData.rawClose}에 영업 종료`
        };
      }
    }

    // 2. 오늘 영업시간 확인
    const todayData = getDayTime(hours[currentDayKey]);
    if (!todayData || todayData.open === null || todayData.close === null) {
      return {
        isOpen: false,
        badgeHtml: `<span class="live-status-badge closed">🔴 오늘 휴무</span>`,
        text: `휴무일입니다`
      };
    }

    const { open, close, rawOpen, rawClose } = todayData;
    const isOvernight = close <= open;

    let isOpenNow = false;
    if (isOvernight) {
      // 17:00 ~ 01:00 인 경우 open 이상이거나 (밤시간)
      isOpenNow = currentMinutes >= open;
    } else {
      // 09:00 ~ 22:00
      isOpenNow = currentMinutes >= open && currentMinutes < close;
    }

    if (isOpenNow) {
      return {
        isOpen: true,
        badgeHtml: `<span class="live-status-badge open">🟢 영업중</span>`,
        text: `오늘 ${rawClose}에 영업 종료`
      };
    } else {
      if (currentMinutes < open) {
        return {
          isOpen: false,
          badgeHtml: `<span class="live-status-badge closed">🔴 영업종료</span>`,
          text: `오늘 ${rawOpen}에 영업 시작`
        };
      } else {
        return {
          isOpen: false,
          badgeHtml: `<span class="live-status-badge closed">🔴 영업종료</span>`,
          text: `영업이 마감되었습니다`
        };
      }
    }
  } catch (err) {
    console.warn('Live status calculation error:', err);
    return null; // 에러 시 조용히 숨김 처리
  }
}

/**
 * 텍스트 형식 영업시간 헬퍼
 */
function formatBusinessHours(hoursObj) {
  if (!hoursObj) return null;
  let hours = hoursObj;
  if (typeof hours === 'string') {
    try { hours = JSON.parse(hours); } catch (e) { return null; }
  }
  if (typeof hours !== 'object' || !hours) return null;

  const daysMap = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  
  const result = [];
  dayKeys.forEach(day => {
    const data = hours[day];
    if (!data) return;
    let t = '';
    if (typeof data === 'string') t = data;
    else if (typeof data === 'object') {
      if (data.closed) t = '휴무';
      else if (data.open && data.close) t = `${data.open} ~ ${data.close}`;
    }
    if (t) result.push(`${daysMap[day]}: ${t}`);
  });
  
  return result.length > 0 ? result.join(' / ') : null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<div style="text-align:center; padding: 4rem;">잘못된 접근입니다. URL에 업체 ID를 포함해주세요.</div>');
  }

  try {
    // 1. 업체 정보 및 FAQ 미리보기 병렬 조회 (faq.js와 동일한 Client 초기화 방식 적용)
    const [storeRes, faqsRes] = await Promise.all([
      supabaseClient.from('stores').select('*').eq('id', id).single(),
      supabaseClient.from('faqs').select('question, answer').eq('store_id', id).order('created_at', { ascending: true })
    ]);

    if (storeRes.error || !storeRes.data) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send('<div style="text-align:center; padding: 4rem;">업체 정보를 찾을 수 없습니다.</div>');
    }

    const store = storeRes.data;
    const faqs = faqsRes.data || [];

    // 업종별 동적 포인트 컬러 테마
    const theme = getCategoryTheme(store.category);

    // 실시간 영업 상태
    const liveStatus = getLiveStatus(store.hours);
    const formattedHours = formatBusinessHours(store.hours);

    // 메뉴 파싱
    let menuList = [];
    if (store.menu) {
      if (typeof store.menu === 'string') {
        try { menuList = JSON.parse(store.menu); } catch(e) { menuList = [store.menu]; }
      } else if (Array.isArray(store.menu)) {
        menuList = store.menu;
      }
    }

    // ── 10대 페이지 구조 HTML 조립 ──
    const storeName = store.store_name || store.brand || '로컬 비즈니스';
    const title = `${storeName} - 모바일 공식 미니홈피`;

    // ① 헤더 섹션
    const headerHtml = `
      <header class="hero">
        <div class="badge-group">
          <span class="category-badge">${store.category || '로컬 비즈니스'}</span>
        </div>
        <h1 class="hero-title">${storeName}</h1>
        ${store.concept ? `<p class="hero-concept">${store.concept}</p>` : ''}
      </header>
    `;

    // ② 상단 3대 액션 버튼
    const phoneUrl = store.phone ? `tel:${store.phone}` : `tel:0507-0000-0000`;
    const mapUrl = store.naver_place_url || `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(storeName)}`;
    const faqUrl = `/faq?id=${id}`;

    const actionBarHtml = `
      <div class="action-bar">
        <a href="${phoneUrl}" class="action-btn">
          <span class="btn-icon">📞</span>
          <span>전화하기</span>
        </a>
        <a href="${mapUrl}" target="_blank" rel="noopener" class="action-btn">
          <span class="btn-icon">🗺️</span>
          <span>길찾기</span>
        </a>
        <a href="${faqUrl}" class="action-btn">
          <span class="btn-icon">❓</span>
          <span>FAQ 보기</span>
        </a>
      </div>
    `;

    // ③ 사진 갤러리 영역 (플레이스홀더)
    const galleryHtml = `
      <section class="gallery-section">
        <div class="gallery-placeholder">
          <span class="gallery-icon">📷</span>
          <div class="gallery-title">${storeName} 매장 사진 준비 중입니다</div>
        </div>
      </section>
    `;

    // ④ 핵심 정보 카드 섹션
    let liveStatusHtml = '';
    if (liveStatus) {
      liveStatusHtml = `
        <div class="info-card">
          <span class="info-card-icon">🕐</span>
          <div class="info-card-content">
            <div class="info-card-label">영업 상태</div>
            <div class="info-card-val">
              ${liveStatus.badgeHtml} ${liveStatus.text}
              ${formattedHours ? `<div style="font-size: 0.8rem; color: var(--text-sub); margin-top: 4px;">${formattedHours}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    const keyInfoHtml = `
      <section class="section">
        <h2 class="section-title">📍 핵심 매장 정보</h2>
        <div class="info-card-list">
          <div class="info-card">
            <span class="info-card-icon">🗺️</span>
            <div class="info-card-content">
              <div class="info-card-label">주소</div>
              <div class="info-card-val">${store.address || '주소 정보 준비 중'}</div>
            </div>
          </div>
          ${liveStatusHtml}
          ${store.parking ? `
          <div class="info-card">
            <span class="info-card-icon">🚗</span>
            <div class="info-card-content">
              <div class="info-card-label">주차 안내</div>
              <div class="info-card-val">${store.parking}</div>
            </div>
          </div>` : ''}
          ${store.capacity ? `
          <div class="info-card">
            <span class="info-card-icon">👥</span>
            <div class="info-card-content">
              <div class="info-card-label">수용 규모</div>
              <div class="info-card-val">${store.capacity}</div>
            </div>
          </div>` : ''}
          ${store.private_room ? `
          <div class="info-card">
            <span class="info-card-icon">🚪</span>
            <div class="info-card-content">
              <div class="info-card-label">단체룸 / 단독 공간</div>
              <div class="info-card-val">${store.private_room}</div>
            </div>
          </div>` : ''}
        </div>
      </section>
    `;

    // ⑤ 업체 소개 (AEO 최적화)
    const introContent = store.naver_place_optimized || store.concept || store.introduction || `${storeName}에 오신 것을 환영합니다.`;
    const introHtml = `
      <section class="section">
        <h2 class="section-title">✏️ 업체 소개</h2>
        <div class="intro-box">
          ${introContent.replace(/\n/g, '<br>')}
        </div>
      </section>
    `;

    // ⑥ 대표 메뉴
    let menuHtml = '';
    if (menuList.length > 0) {
      const itemsHtml = menuList.map(item => `
        <div class="menu-card">
          <div class="menu-name">${item}</div>
          ${store.price_range ? `<div class="menu-price">${store.price_range}</div>` : ''}
        </div>
      `).join('');

      menuHtml = `
        <section class="section">
          <h2 class="section-title">🍽️ 대표 메뉴</h2>
          <div class="menu-grid">
            ${itemsHtml}
          </div>
        </section>
      `;
    }

    // ⑦ 특징 / 강점 섹션
    let featureItems = '';
    if (store.story) {
      featureItems += `
        <div class="feature-item">
          <div class="feature-title">✨ 핵심 스토리</div>
          <div class="feature-desc">${store.story}</div>
        </div>
      `;
    }
    if (store.target_customers) {
      featureItems += `
        <div class="feature-item">
          <div class="feature-title">🎯 추천 타겟 고객</div>
          <div class="feature-desc">${store.target_customers}</div>
        </div>
      `;
    }
    if (store.local_context) {
      featureItems += `
        <div class="feature-item">
          <div class="feature-title">📍 주변 환경 & 맥락</div>
          <div class="feature-desc">${store.local_context}</div>
        </div>
      `;
    }

    const featureHtml = featureItems ? `
      <section class="section">
        <h2 class="section-title">💡 차별화 특징 & 강점</h2>
        <div class="feature-box">
          ${featureItems}
        </div>
      </section>
    ` : '';

    // ⑧ 위치 및 지도 바로가기 버튼
    const googleMapUrl = store.google_biz_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeName + ' ' + (store.address || ''))}`;
    const locationHtml = `
      <section class="section">
        <h2 class="section-title">🗺️ 찾아오시는 길</h2>
        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">
          ${store.address || '주소 정보 준비 중'}
        </div>
        <div class="map-btn-group">
          <a href="${mapUrl}" target="_blank" rel="noopener" class="map-btn naver">
            <span>N</span> 네이버 지도
          </a>
          <a href="${googleMapUrl}" target="_blank" rel="noopener" class="map-btn google">
            <span>G</span> 구글 지도
          </a>
        </div>
      </section>
    `;

    // ⑨ FAQ 섹션 미리보기 (상위 3개)
    let faqPreviewHtml = '';
    const topFaqs = faqs.slice(0, 3);
    if (topFaqs.length > 0) {
      const faqItems = topFaqs.map(f => `
        <div class="faq-preview-item">
          <div class="faq-preview-q">Q. ${f.question.replace(/^Q\.?\s*/i, '')}</div>
          <div class="faq-preview-a">${f.answer.replace(/^A\.?\s*/i, '')}</div>
        </div>
      `).join('');

      faqPreviewHtml = `
        <section class="section">
          <h2 class="section-title">❓ 자주 묻는 질문 (FAQ)</h2>
          ${faqItems}
          <a href="${faqUrl}" class="faq-more-btn">
            전체 FAQ ${faqs.length}개 보기 →
          </a>
        </section>
      `;
    }

    // ⑩ Schema.org JSON-LD (AEO SEO 강화)
    const jsonLdFaqs = faqs.map(f => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer
      }
    }));

    const jsonLdData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "LocalBusiness",
          "@id": `https://seenow.kr/?id=${id}#business`,
          "name": storeName,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": store.address || ''
          },
          "description": store.concept || store.introduction || '',
          "url": `https://seenow.kr/?id=${id}`
        },
        ...(jsonLdFaqs.length > 0 ? [{
          "@type": "FAQPage",
          "mainEntity": jsonLdFaqs
        }] : []),
        ...(menuList.length > 0 ? [{
          "@type": "Menu",
          "hasMenuItem": menuList.map(m => ({
            "@type": "MenuItem",
            "name": m
          }))
        }] : [])
      ]
    };

    // ── 최종 HTML 합성 ──
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${storeName} 공식 미니홈피 - ${store.concept || store.address || ''}">
  <link rel="stylesheet" href="/css/style.css">
  <style>
    :root {
      --primary: ${theme.primary};
      --primary-hover: ${theme.primaryHover};
      --primary-light: ${theme.primaryLight};
    }
  </style>
  <script type="application/ld+json">
    ${JSON.stringify(jsonLdData, null, 2)}
  </script>
</head>
<body>
  <div class="container">
    ${headerHtml}
    ${actionBarHtml}
    ${galleryHtml}
    ${keyInfoHtml}
    ${introHtml}
    ${menuHtml}
    ${featureHtml}
    ${locationHtml}
    ${faqPreviewHtml}
    <footer class="footer">
      © ${new Date().getFullYear()} ${storeName}. All rights reserved. Powered by Seenow
    </footer>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Store page rendering error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<div style="text-align:center; padding: 4rem;">서버 오류가 발생했습니다.</div>');
  }
}
