import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ohmptflnwplotzfwnsuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obXB0Zmxud3Bsb3R6Znduc3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5MzEsImV4cCI6MjA5NzEyNTkzMX0.GtlDRgKW6surk-O_2jU1oChDOUnLGN_oIRblvfcF4k8';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatBusinessHours(hoursObj) {
  if (!hoursObj) return null;
  
  let hours = hoursObj;
  if (typeof hours === 'string') {
    try {
      hours = JSON.parse(hours);
    } catch (e) {
      return null;
    }
  }

  const daysMap = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  
  const groups = {};
  
  dayKeys.forEach(day => {
    const data = hours[day];
    if (!data) return;
    
    let timeStr;
    if (typeof data === 'string') {
      timeStr = data;
    } else if (typeof data === 'object') {
      if (data.closed) {
        timeStr = '휴무';
      } else if (data.open && data.close) {
        timeStr = `${data.open} ~ ${data.close}`;
      } else {
        return;
      }
    } else {
      return;
    }
    
    if (!groups[timeStr]) {
      groups[timeStr] = [];
    }
    groups[timeStr].push(day);
  });
  
  if (Object.keys(groups).length === 0) return null;
  
  const parts = [];
  for (const [timeStr, days] of Object.entries(groups)) {
    const sortedDays = days.sort((a, b) => dayKeys.indexOf(a) - dayKeys.indexOf(b));
    const result = [];
    let currentGroup = [sortedDays[0]];
    
    for (let i = 1; i < sortedDays.length; i++) {
      const prevDay = currentGroup[currentGroup.length - 1];
      const currDay = sortedDays[i];
      
      if (dayKeys.indexOf(currDay) === dayKeys.indexOf(prevDay) + 1) {
        currentGroup.push(currDay);
      } else {
        if (currentGroup.length >= 3) {
          result.push(`${daysMap[currentGroup[0]]}~${daysMap[currentGroup[currentGroup.length - 1]]}`);
        } else {
          result.push(currentGroup.map(d => daysMap[d]).join(', '));
        }
        currentGroup = [currDay];
      }
    }
    
    if (currentGroup.length > 0) {
      if (currentGroup.length >= 3) {
        result.push(`${daysMap[currentGroup[0]]}~${daysMap[currentGroup[currentGroup.length - 1]]}`);
      } else {
        result.push(currentGroup.map(d => daysMap[d]).join(', '));
      }
    }
    
    parts.push(`${result.join(', ')}: ${timeStr}`);
  }
  
  return parts.join(' / ');
}

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send('<div style="text-align:center; padding: 4rem;">잘못된 접근입니다. URL에 매장 ID를 포함해주세요.</div>');
  }

  try {
    const { data: store, error } = await supabaseClient
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !store) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send('<div style="text-align:center; padding: 4rem;">매장 정보를 찾을 수 없습니다.</div>');
    }

    const formattedHours = formatBusinessHours(store.hours) || store.business_hours || '영업시간 정보가 없습니다.';
    const phone = store.phone || store.phone_number;
    
    let phoneSection = '';
    if (phone) {
      phoneSection = `
        <article class="info-item">
          <svg class="info-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          <div class="info-text"><a href="tel:${phone.replace(/[^0-9]/g, '')}" style="color: inherit; text-decoration: none;">${phone}</a></div>
        </article>
      `;
    }

    let menuHtml = '';
    if (store.menu && Array.isArray(store.menu) && store.menu.length > 0) {
      menuHtml = store.menu.map(item => `
        <li class="menu-item">
          <span class="menu-name">${item}</span>
        </li>
      `).join('');
    } else {
      menuHtml = '<li class="menu-item"><span class="menu-name" style="color: var(--text-muted);">등록된 메뉴가 없습니다.</span></li>';
    }

    const title = `${store.store_name} - 미니홈페이지`;
    const desc = store.concept || `${store.store_name} 매장 소개입니다.`;
    const keywords = `${store.store_name}, 매장, 소개, ${store.address ? store.address.split(' ').slice(0, 2).join(' ') : ''}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": store.menu && store.menu.length > 0 ? "FoodEstablishment" : "LocalBusiness",
      "name": store.store_name,
      "description": desc,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": store.address || ""
      },
      "telephone": phone || "",
      "openingHours": formattedHours || ""
    };

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${keywords}">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/style.css">
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>
</head>
<body>
  <div class="container">
    <div id="app-container">
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
          <time class="info-text">${formattedHours}</time>
        </article>
        ${phoneSection}
      </section>
      
      <section class="menu-section">
        <h2 class="section-title">대표 메뉴</h2>
        <ul class="menu-list">
          ${menuHtml}
        </ul>
      </section>
    </div>
    
    <a href="/faq?id=${id}" id="faq-link" class="floating-btn">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      FAQ 보기
    </a>
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
