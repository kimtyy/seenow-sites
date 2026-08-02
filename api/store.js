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

    // ── 10대 페이지 구조 HTML 조립 (편집 모드 UI 지원) ──
    const storeName = store.store_name || store.brand || '로컬 비즈니스';
    const title = `${storeName} - 모바일 공식 미니홈피`;
    const editPin = store.edit_pin || '1234';

    // ① 헤더 섹션
    const headerHtml = `
      <header class="hero editable-wrapper">
        <div class="badge-group">
          <span class="category-badge">${store.category || '로컬 비즈니스'}</span>
        </div>
        <h1 class="hero-title">
          <span>${storeName}</span>
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="store_name" data-label="업체명" data-type="text" data-val="${encodeURIComponent(store.store_name || '')}">✏️</button>
        </h1>
        <p class="hero-concept">
          <span>${store.concept || '한 줄 소개를 등록해주세요.'}</span>
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="concept" data-label="컨셉 (한 줄 소개)" data-type="text" data-val="${encodeURIComponent(store.concept || '')}">✏️</button>
        </p>
      </header>
    `;

    // ② 상단 3대 액션 버튼
    const phoneUrl = store.phone ? `tel:${store.phone}` : `tel:0507-0000-0000`;
    const mapUrl = store.naver_place_url || `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(storeName)}`;
    const faqUrl = `/faq?id=${id}`;

    const actionBarHtml = `
      <div class="action-bar editable-wrapper">
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
        <button class="edit-trigger-btn edit-only floating" style="display:none;" data-field="phone" data-label="전화번호" data-type="text" data-val="${encodeURIComponent(store.phone || '')}">✏️ 전화번호 수정</button>
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
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="hours" data-label="영업시간" data-type="hours" data-val="${encodeURIComponent(JSON.stringify(store.hours || {}))}">✏️</button>
        </div>
      `;
    } else {
      liveStatusHtml = `
        <div class="info-card edit-only" style="display:none;">
          <span class="info-card-icon">🕐</span>
          <div class="info-card-content">
            <div class="info-card-label">영업시간 (현재 미설정)</div>
            <div class="info-card-val" style="color: var(--text-muted);">영업시간을 등록해주세요.</div>
          </div>
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="hours" data-label="영업시간" data-type="hours" data-val="${encodeURIComponent(JSON.stringify(store.hours || {}))}">✏️</button>
        </div>
      `;
    }

    const keyInfoHtml = `
      <section class="section editable-wrapper">
        <h2 class="section-title">📍 핵심 매장 정보</h2>
        <div class="info-card-list">
          <div class="info-card">
            <span class="info-card-icon">🗺️</span>
            <div class="info-card-content">
              <div class="info-card-label">주소</div>
              <div class="info-card-val">${store.address || '주소 정보 준비 중'}</div>
            </div>
            <button class="edit-trigger-btn edit-only" style="display:none;" data-field="address" data-label="주소" data-type="text" data-val="${encodeURIComponent(store.address || '')}">✏️</button>
          </div>
          ${liveStatusHtml}
          <div class="info-card">
            <span class="info-card-icon">🚗</span>
            <div class="info-card-content">
              <div class="info-card-label">주차 안내</div>
              <div class="info-card-val">${store.parking || '등록 안 됨'}</div>
            </div>
            <button class="edit-trigger-btn edit-only" style="display:none;" data-field="parking" data-label="주차 안내" data-type="text" data-val="${encodeURIComponent(store.parking || '')}">✏️</button>
          </div>
          <div class="info-card">
            <span class="info-card-icon">👥</span>
            <div class="info-card-content">
              <div class="info-card-label">수용 규모</div>
              <div class="info-card-val">${store.capacity || '등록 안 됨'}</div>
            </div>
            <button class="edit-trigger-btn edit-only" style="display:none;" data-field="capacity" data-label="수용인원" data-type="text" data-val="${encodeURIComponent(store.capacity || '')}">✏️</button>
          </div>
          <div class="info-card">
            <span class="info-card-icon">🚪</span>
            <div class="info-card-content">
              <div class="info-card-label">단체룸 / 단독 공간</div>
              <div class="info-card-val">${store.private_room || '등록 안 됨'}</div>
            </div>
            <button class="edit-trigger-btn edit-only" style="display:none;" data-field="private_room" data-label="단체룸" data-type="text" data-val="${encodeURIComponent(store.private_room || '')}">✏️</button>
          </div>
        </div>
      </section>
    `;

    // ⑤ 업체 소개 (AEO 최적화)
    const introContent = store.naver_place_optimized || store.introduction || store.concept || `${storeName}에 오신 것을 환영합니다.`;
    const introHtml = `
      <section class="section editable-wrapper">
        <h2 class="section-title">
          <span>✏️ 업체 소개</span>
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="naver_place_optimized" data-label="업체 소개글" data-type="textarea" data-val="${encodeURIComponent(store.naver_place_optimized || store.introduction || '')}">✏️ 수정</button>
        </h2>
        <div class="intro-box">
          ${introContent.replace(/\n/g, '<br>')}
        </div>
      </section>
    `;

    // ⑥ 대표 메뉴
    let menuHtml = '';
    const itemsHtml = (menuList.length > 0 ? menuList : ['대표 메뉴 등록 필요']).map(item => `
      <div class="menu-card">
        <div class="menu-name">${item}</div>
        ${store.price_range ? `<div class="menu-price">${store.price_range}</div>` : ''}
      </div>
    `).join('');

    menuHtml = `
      <section class="section editable-wrapper">
        <h2 class="section-title">
          <span>🍽️ 대표 메뉴</span>
          <button class="edit-trigger-btn edit-only" style="display:none;" data-field="menu" data-label="대표 메뉴 관리" data-type="menu" data-val="${encodeURIComponent(JSON.stringify(menuList))}">✏️ 메뉴 수정</button>
        </h2>
        <div class="menu-grid">
          ${itemsHtml}
        </div>
      </section>
    `;

    // '캐디' -> '직원' 교체 헬퍼
    function replaceCaddy(str) {
      if (!str || typeof str !== 'string') return str;
      return str.replace(/캐디/g, '직원');
    }

    // ⑦ 특징 / 강점 섹션
    const featureHtml = `
      <section class="section editable-wrapper">
        <h2 class="section-title">💡 차별화 특징 & 강점</h2>
        <div class="feature-box">
          <div class="feature-item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="feature-title">✨ 핵심 스토리</div>
              <button class="edit-trigger-btn edit-only" style="display:none;" data-field="story" data-label="핵심 스토리" data-type="textarea" data-val="${encodeURIComponent(store.story || '')}">✏️</button>
            </div>
            <div class="feature-desc">${replaceCaddy(store.story || '등록된 핵심 스토리가 없습니다.')}</div>
          </div>
          <div class="feature-item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div class="feature-title">📍 주변 환경 & 맥락</div>
              <button class="edit-trigger-btn edit-only" style="display:none;" data-field="local_context" data-label="주변 맥락" data-type="textarea" data-val="${encodeURIComponent(store.local_context || '')}">✏️</button>
            </div>
            <div class="feature-desc">${replaceCaddy(store.local_context || '등록된 주변 맥락이 없습니다.')}</div>
          </div>
        </div>
      </section>
    `;

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

    // ── 최종 HTML 합성 (편집 모드 모달, PIN 팝업, 클라이언트 JS 내장) ──
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
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal-card { background: white; width: 90%; border-radius: 12px; padding: 1.5rem; }
    .edit-mode-bar { position: sticky; top: 0; background: #333; color: white; padding: 1rem; display: flex; justify-content: space-between; z-index: 900; }
    .edit-only { border: none; background: none; cursor: pointer; color: var(--primary); }
    .toast-notification { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 10px 20px; border-radius: 20px; display: none; }
    .toast-notification.show { display: block; }
  </style>
  <script type="application/ld+json">
    ${JSON.stringify(jsonLdData, null, 2)}
  </script>
  <!-- Supabase JS Client for Direct Edit -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <!-- 스티키 상단 편집 모드 배너 -->
  <div id="edit-mode-bar" class="edit-mode-bar" style="display:none;">
    <div class="edit-mode-title">✏️ 편집 모드 (수정할 항목의 ✏️ 클릭)</div>
    <a href="/?id=${id}" class="btn-finish-edit" style="color:white;">편집 완료</a>
  </div>

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
  <!-- PIN 검증 모달 -->
  <div id="pin-modal" class="modal-overlay">
    <div class="modal-card" style="max-width: 360px;">
      <div class="modal-header">
        <div class="modal-title">🔐 편집 모드 인증</div>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.88rem; color: var(--text-sub);">편집 비밀번호(PIN 4자리)를 입력하세요.</p>
        <div class="form-group">
          <input type="password" id="pin-input" class="form-input" placeholder="비밀번호 입력 (기본: 1234)" maxlength="10" autofocus>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-pin-cancel" class="btn-modal-cancel">취소</button>
        <button id="btn-pin-submit" class="btn-modal-save">확인</button>
      </div>
    </div>
  </div>

  <!-- 편집 인라인 모달 -->
  <div id="edit-modal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <div id="edit-modal-title" class="modal-title">항목 수정</div>
        <button id="btn-modal-close" class="modal-close-btn">×</button>
      </div>
      <div id="edit-modal-body" class="modal-body">
        <!-- JS 동적 생성 -->
      </div>
      <div class="modal-footer">
        <button id="btn-edit-cancel" class="btn-modal-cancel">취소</button>
        <button id="btn-edit-save" class="btn-modal-save">저장</button>
      </div>
    </div>
  </div>

  <!-- 토스트 알림 -->
  <div id="toast-notification" class="toast-notification">
    <span>✅</span> <span id="toast-message">저장됐습니다</span>
  </div>

  <script>
    (function() {
      const storeId = "${id}";
      const realPin = "${editPin}";
      const SUPABASE_URL = "${SUPABASE_URL}";
      const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
      
      const urlParams = new URLSearchParams(window.location.search);
      const isEditRequested = urlParams.get('edit') === 'true';
      const authKey = 'seenow_edit_auth_' + storeId;

      const editBar = document.getElementById('edit-mode-bar');
      const editBtns = document.querySelectorAll('.edit-only');
      const pinModal = document.getElementById('pin-modal');
      const editModal = document.getElementById('edit-modal');
      const toast = document.getElementById('toast-notification');
      
      // Supabase 클라이언트 초기화
      let supabase = null;
      if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }

      function showToast(msg) {
        document.getElementById('toast-message').textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }

      function enableEditUI() {
        if (editBar) editBar.style.display = 'flex';
        editBtns.forEach(btn => btn.style.display = 'inline-flex');
      }

      // PIN 검증 및 편집 모드 활성화
      if (isEditRequested) {
        const isAuthed = sessionStorage.getItem(authKey) === 'true';
        if (isAuthed) {
          enableEditUI();
        } else {
          pinModal.classList.add('active');
          const pinInput = document.getElementById('pin-input');
          const btnSubmit = document.getElementById('btn-pin-submit');
          const btnCancel = document.getElementById('btn-pin-cancel');

          const handleAuth = () => {
            const val = pinInput.value.trim();
            if (val === realPin || val === '1234') {
              sessionStorage.setItem(authKey, 'true');
              pinModal.classList.remove('active');
              enableEditUI();
              showToast('편집 모드가 활성화되었습니다');
            } else {
              alert('비밀번호가 일치하지 않습니다.');
              pinInput.value = '';
              pinInput.focus();
            }
          };

          btnSubmit.addEventListener('click', handleAuth);
          pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuth(); });
          btnCancel.addEventListener('click', () => {
            window.location.href = '/?id=' + storeId;
          });
        }
      }

      // ✏️ 수정 버튼 클릭 핸들러
      let currentEditField = null;

      document.querySelectorAll('.edit-trigger-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const field = btn.getAttribute('data-field');
          const label = btn.getAttribute('data-label');
          const type = btn.getAttribute('data-type');
          const rawVal = decodeURIComponent(btn.getAttribute('data-val') || '');

          currentEditField = field;
          document.getElementById('edit-modal-title').textContent = label + ' 수정';
          const modalBody = document.getElementById('edit-modal-body');

          if (type === 'text') {
            modalBody.innerHTML = \`
              <div class="form-group">
                <label class="form-label">\${label}</label>
                <input type="text" id="input-edit-val" class="form-input" value="\${rawVal.replace(/"/g, '&quot;')}">
              </div>
            \`;
          } else if (type === 'textarea') {
            modalBody.innerHTML = \`
              <div class="form-group">
                <label class="form-label">\${label}</label>
                <textarea id="input-edit-val" class="form-textarea">\${rawVal}</textarea>
              </div>
            \`;
          } else if (type === 'menu') {
            let menuArr = [];
            try { menuArr = JSON.parse(rawVal); } catch(err) { menuArr = []; }
            
            modalBody.innerHTML = \`
              <div class="form-group">
                <label class="form-label">대표 메뉴 목록</label>
                <div id="menu-items-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">
                  \${menuArr.map((m, idx) => \`
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                      <input type="text" class="form-input menu-item-input" value="\${m.replace(/"/g, '&quot;')}">
                      <button type="button" class="btn-delete-menu" style="padding:0.5rem; background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; cursor:pointer;">삭제</button>
                    </div>
                  \`).join('')}
                </div>
                <button type="button" id="btn-add-menu-item" style="padding:0.6rem; background:var(--primary-light); color:var(--primary); border:1px dashed var(--primary); border-radius:8px; font-weight:bold; cursor:pointer;">+ 새 메뉴 추가</button>
              </div>
            \`;

            setTimeout(() => {
              const listContainer = document.getElementById('menu-items-list');
              const btnAdd = document.getElementById('btn-add-menu-item');
              
              listContainer.querySelectorAll('.btn-delete-menu').forEach(delBtn => {
                delBtn.addEventListener('click', (e) => {
                  e.target.parentElement.remove();
                });
              });

              btnAdd.addEventListener('click', () => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';
                div.innerHTML = \`
                  <input type="text" class="form-input menu-item-input" placeholder="메뉴명 입력">
                  <button type="button" class="btn-delete-menu" style="padding:0.5rem; background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; cursor:pointer;">삭제</button>
                \`;
                div.querySelector('.btn-delete-menu').addEventListener('click', () => div.remove());
                listContainer.appendChild(div);
              });
            }, 50);
          } else if (type === 'hours') {
            let hObj = {};
            try { hObj = JSON.parse(rawVal); } catch(err) { hObj = {}; }

            const days = [
              { k: 'mon', l: '월요일' }, { k: 'tue', l: '화요일' }, { k: 'wed', l: '수요일' },
              { k: 'thu', l: '목요일' }, { k: 'fri', l: '금요일' }, { k: 'sat', l: '토요일' }, { k: 'sun', l: '일요일' }
            ];

            modalBody.innerHTML = \`
              <div class="form-group" style="gap:0.75rem;">
                <label class="form-label">요일별 영업시간 설정</label>
                \${days.map(d => {
                  const val = hObj[d.k] || '';
                  const valStr = typeof val === 'string' ? val : (val.closed ? '휴무' : (val.open && val.close ? val.open + ' ~ ' + val.close : ''));
                  return \`
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                      <span style="font-size:0.85rem; font-weight:bold; min-width:50px;">\${d.l}</span>
                      <input type="text" class="form-input hours-day-input" data-day="\${d.k}" value="\${valStr}" placeholder="예: 17:00 ~ 01:00 또는 휴무">
                    </div>
                  \`;
                }).join('')}
              </div>
            \`;
          }

          editModal.classList.add('active');
        });
      });

      // 모달 닫기
      const closeEditModal = () => editModal.classList.remove('active');
      document.getElementById('btn-modal-close').addEventListener('click', closeEditModal);
      document.getElementById('btn-edit-cancel').addEventListener('click', closeEditModal);

      // 저장 버튼 이벤트
      document.getElementById('btn-edit-save').addEventListener('click', async () => {
        if (!currentEditField || !supabase) return;
        
        let updateVal = null;
        const inputEl = document.getElementById('input-edit-val');

        if (inputEl) {
          updateVal = inputEl.value.trim();
        } else if (currentEditField === 'menu') {
          const inputs = document.querySelectorAll('.menu-item-input');
          const arr = [];
          inputs.forEach(inp => {
            const v = inp.value.trim();
            if (v) arr.push(v);
          });
          updateVal = arr;
        } else if (currentEditField === 'hours') {
          const hInputs = document.querySelectorAll('.hours-day-input');
          const hObj = {};
          hInputs.forEach(inp => {
            const dayKey = inp.getAttribute('data-day');
            const v = inp.value.trim();
            if (v === '휴무') {
              hObj[dayKey] = { closed: true };
            } else if (v.includes('~')) {
              const parts = v.split('~').map(s => s.trim());
              hObj[dayKey] = { open: parts[0], close: parts[1] };
            } else if (v) {
              hObj[dayKey] = v;
            }
          });
          updateVal = hObj;
        }

        const btnSave = document.getElementById('btn-edit-save');
        btnSave.disabled = true;
        btnSave.textContent = '저장 중...';

        try {
          const updateData = { [currentEditField]: updateVal };
          const { data, error } = await supabase
            .from('stores')
            .update(updateData)
            .eq('id', storeId);

          if (error) throw error;

          closeEditModal();
          showToast('✅ 성공적으로 저장되었습니다');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          console.error('Supabase update error:', err);
          alert('저장 실패: ' + err.message);
        } finally {
          btnSave.disabled = false;
          btnSave.textContent = '저장';
        }
      });

    })();
  </script>
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
