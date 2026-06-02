// ============================================================
// معهد المستقبل التعليمي - Cloudflare Worker
// تطبيق ويب متكامل لمعهد تعليمي
// يتضمن: API Routes + SPA (HTML/CSS/JS) + D1 + R2
// ============================================================

// ============================
// ثوابت مساعدة
// ============================
const PERIODS = {
  1: { start: '7:30', end: '8:15' },
  2: { start: '8:20', end: '9:05' },
  3: { start: '9:10', end: '9:55' },
  4: { start: '10:00', end: '10:45' },
  5: { start: '11:00', end: '11:45' },
  6: { start: '11:50', end: '12:35' },
  7: { start: '12:40', end: '1:25' },
};

const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const SUBJECT_STYLES = {
  'رياضيات':  { color: '#4F46E5', bg: '#EEF2FF', icon: 'fa-calculator' },
  'علوم':     { color: '#059669', bg: '#ECFDF5', icon: 'fa-flask' },
  'لغة عربية': { color: '#EA580C', bg: '#FFF7ED', icon: 'fa-book-open' },
  'لغة إنجليزية': { color: '#D97706', bg: '#FEF3C7', icon: 'fa-language' },
  'تاريخ':    { color: '#DB2777', bg: '#FCE7F3', icon: 'fa-landmark' },
};

// ============================
// دوال مساعدة عامة
// ============================

/** إرجاع رؤوس CORS للتطوير */
function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
  };
}

/** بناء استجابة JSON */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

/** بناء استجابة خطأ JSON */
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

/** بناء استجابة HTML */
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

/** استخراج قيمة ملف تعريف الارتباط (Cookie) */
function getCookieValue(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// ============================
// توثيق JWT (مصادقة)
// ============================

/** ترميز Base64URL */
function base64url(input) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(input)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** فك ترميز Base64URL */
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(
    atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

/** إنشاء رمز JWT */
async function createToken(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const data = header + '.' + body;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return data + '.' + sigStr;
}

/** التحقق من رمز JWT وإرجاع البيانات أو null */
async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigData = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify('HMAC', key, sigData, new TextEncoder().encode(header + '.' + payload));
    if (!valid) return null;

    const data = JSON.parse(base64urlDecode(payload));
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// ============================
// SVG عنصر نائب للصور
// ============================
function placeholderSVG(title) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="220" viewBox="0 0 400 220">'
    + '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">'
    + '<stop offset="0%" style="stop-color:#6366F1"/>'
    + '<stop offset="100%" style="stop-color:#8B5CF6"/>'
    + '</linearGradient></defs>'
    + '<rect width="400" height="220" fill="url(#g)"/>'
    + '<text x="200" y="105" text-anchor="middle" dy=".3em" fill="white" '
    + 'font-family="sans-serif" font-size="22" font-weight="bold">' + title + '</text>'
    + '</svg>';
}

// ============================
// ملف PWA Manifest
// ============================
function getManifest() {
  return JSON.stringify({
    name: 'معهد المستقبل التعليمي',
    short_name: 'المعهد',
    description: 'تطبيق معهد المستقبل التعليمي',
    start_url: '/',
    display: 'standalone',
    background_color: '#4F46E5',
    theme_color: '#4F46E5',
    dir: 'rtl',
    lang: 'ar',
    icons: [{
      src: '/api/icon',
      sizes: '192x192',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    }],
  });
}

// ============================
// Service Worker
// ============================
function getServiceWorker() {
  return `const CACHE='institute-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/'])))});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});`;
}

// ============================
// أيقونة التطبيق (SVG)
// ============================
function getAppIcon() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">'
    + '<rect width="192" height="192" rx="40" fill="#4F46E5"/>'
    + '<text x="96" y="110" text-anchor="middle" fill="white" font-family="sans-serif" font-size="80" font-weight="bold">م</text>'
    + '</svg>';
}

// ============================
// قالب HTML الكامل (SPA)
// ============================
function getHTML(user) {
  const userData = user ? JSON.stringify(user) : 'null';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
  <meta name="theme-color" content="#4F46E5">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>معهد المستقبل</title>
  <link rel="manifest" href="/manifest.json">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    /* ====== متغيرات الثيمات ====== */
    :root {
      --bg: #F0F4F8; --bg2: #FFFFFF; --bg-card: #FFFFFF;
      --text: #1A202C; --text2: #4A5568; --text3: #A0AEC0;
      --accent: #4F46E5; --accent2: #818CF8; --accent-dark: #3730A3;
      --green: #10B981; --amber: #F59E0B; --red: #EF4444; --pink: #EC4899;
      --border: #E2E8F0; --shadow: 0 2px 8px rgba(0,0,0,0.08);
      --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
      --radius: 18px; --radius-sm: 12px;
      --nav-h: 72px; --header-h: 60px;
    }
    .dark {
      --bg: #0F172A; --bg2: #1E293B; --bg-card: #1E293B;
      --text: #F1F5F9; --text2: #94A3B8; --text3: #475569;
      --border: #334155;
      --shadow: 0 2px 8px rgba(0,0,0,0.3);
      --shadow-lg: 0 12px 32px rgba(0,0,0,0.4);
    }
    /* ====== الأساسيات ====== */
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    body {
      font-family:'Cairo',sans-serif; background:var(--bg); color:var(--text);
      min-height:100vh; min-height:100dvh; overflow-x:hidden;
      transition: background .3s, color .3s;
      padding-top: env(safe-area-inset-top);
    }
    input,button,select { font-family:inherit; }
    a { color:var(--accent); text-decoration:none; }

    /* ====== شاشة تسجيل الدخول ====== */
    #login-screen {
      min-height:100vh; min-height:100dvh;
      background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 50%,#A855F7 100%);
      display:flex; align-items:center; justify-content:center;
      padding:24px; position:relative; overflow:hidden;
    }
    #login-screen::before {
      content:''; position:absolute; width:300px; height:300px;
      background:rgba(255,255,255,0.08); border-radius:50%;
      top:-80px; right:-80px;
    }
    #login-screen::after {
      content:''; position:absolute; width:200px; height:200px;
      background:rgba(255,255,255,0.06); border-radius:50%;
      bottom:-50px; left:-50px;
    }
    .login-card {
      background:var(--bg2); border-radius:var(--radius); padding:36px 28px;
      width:100%; max-width:380px; box-shadow:var(--shadow-lg);
      position:relative; z-index:1;
      animation: slideUp .5s ease;
    }
    .login-icon {
      width:72px; height:72px; border-radius:50%;
      background:linear-gradient(135deg,#4F46E5,#7C3AED);
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 20px; color:white; font-size:28px;
    }
    .login-card h1 { text-align:center; font-size:22px; margin-bottom:4px; font-weight:700; }
    .login-card p.subtitle { text-align:center; color:var(--text3); font-size:14px; margin-bottom:28px; }
    .form-group { margin-bottom:16px; }
    .form-group label { display:block; font-size:13px; color:var(--text2); margin-bottom:6px; font-weight:600; }
    .form-input {
      width:100%; padding:14px 16px; border:2px solid var(--border);
      border-radius:var(--radius-sm); font-size:15px; background:var(--bg);
      color:var(--text); transition: border-color .2s; outline:none;
    }
    .form-input:focus { border-color:var(--accent); }
    .btn-primary {
      width:100%; padding:14px; border:none; border-radius:var(--radius-sm);
      background:linear-gradient(135deg,#4F46E5,#7C3AED);
      color:white; font-size:16px; font-weight:700; cursor:pointer;
      transition: opacity .2s, transform .1s;
    }
    .btn-primary:active { transform:scale(0.98); }
    .btn-primary:disabled { opacity:.5; cursor:default; }

    /* ====== التطبيق الرئيسي ====== */
    #app { display:none; padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); }
    #app.visible { display:block; animation: fadeIn .3s ease; }

    /* الشريط العلوي */
    #app-header {
      position:sticky; top:0; z-index:100;
      background:var(--bg2); border-bottom:1px solid var(--border);
      height:var(--header-h);
      display:flex; align-items:center; justify-content:space-between;
      padding:0 20px;
      backdrop-filter:blur(12px); background:rgba(255,255,255,0.85);
    }
    .dark #app-header { background:rgba(30,41,59,0.85); }
    #header-title { font-size:18px; font-weight:700; }
    #header-actions { display:flex; gap:8px; align-items:center; }
    .icon-btn {
      width:40px; height:40px; border-radius:50%; border:none;
      background:var(--bg); color:var(--text); font-size:18px;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition: background .2s;
    }
    .icon-btn:active { background:var(--border); }

    /* ====== حاوية الصفحات ====== */
    #pages-container { padding:16px; }
    .page { display:none; }
    .page.active { display:block; animation: pageIn .3s ease; }

    @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

    /* ====== التنقل السفلي ====== */
    #bottom-nav {
      position:fixed; bottom:0; left:0; right:0; z-index:100;
      background:var(--bg2); border-top:1px solid var(--border);
      display:flex; height:var(--nav-h);
      padding-bottom:env(safe-area-inset-bottom);
      backdrop-filter:blur(12px); background:rgba(255,255,255,0.9);
    }
    .dark #bottom-nav { background:rgba(30,41,59,0.9); }
    .nav-item {
      flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:3px; border:none; background:none; color:var(--text3);
      font-size:11px; font-weight:600; cursor:pointer; transition: color .2s;
      position:relative;
    }
    .nav-item i { font-size:20px; transition: transform .2s, color .2s; }
    .nav-item.active { color:var(--accent); }
    .nav-item.active i { transform:scale(1.15); }
    .nav-item.active::before {
      content:''; position:absolute; top:-1px; left:50%; transform:translateX(-50%);
      width:32px; height:3px; border-radius:0 0 4px 4px; background:var(--accent);
    }

    /* ====== البطاقات ====== */
    .card {
      background:var(--bg-card); border-radius:var(--radius);
      padding:20px; box-shadow:var(--shadow); margin-bottom:14px;
      transition: transform .2s, box-shadow .2s;
    }
    .card:active { transform:scale(0.985); }

    /* ====== لوحة التحكم ====== */
    .welcome-card {
      background:linear-gradient(135deg,#4F46E5,#7C3AED);
      border-radius:var(--radius); padding:28px 24px; color:white; margin-bottom:20px;
      position:relative; overflow:hidden;
    }
    .welcome-card::after {
      content:''; position:absolute; width:120px; height:120px;
      background:rgba(255,255,255,0.1); border-radius:50%;
      top:-30px; left:-30px;
    }
    .welcome-card h2 { font-size:24px; font-weight:700; margin-bottom:4px; position:relative; z-index:1; }
    .welcome-card p { font-size:15px; opacity:.85; position:relative; z-index:1; }
    .stats-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;
    }
    .stat-card {
      background:var(--bg-card); border-radius:var(--radius); padding:18px;
      box-shadow:var(--shadow); text-align:center;
    }
    .stat-card .stat-icon {
      width:44px; height:44px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 10px; font-size:18px;
    }
    .stat-card .stat-value { font-size:22px; font-weight:800; margin-bottom:2px; }
    .stat-card .stat-label { font-size:12px; color:var(--text2); font-weight:600; }

    /* ====== الجدول ====== */
    .day-tabs {
      display:flex; gap:8px; overflow-x:auto; padding-bottom:8px;
      margin-bottom:16px; scrollbar-width:none;
    }
    .day-tabs::-webkit-scrollbar { display:none; }
    .day-tab {
      padding:10px 20px; border-radius:25px; border:2px solid var(--border);
      background:var(--bg-card); color:var(--text2); font-size:14px;
      font-weight:600; cursor:pointer; white-space:nowrap; transition: all .2s;
    }
    .day-tab.active { background:var(--accent); color:white; border-color:var(--accent); }
    .schedule-item {
      display:flex; gap:14px; margin-bottom:12px; align-items:stretch;
    }
    .schedule-time {
      width:65px; flex-shrink:0; text-align:center;
      display:flex; flex-direction:column; justify-content:center;
      font-size:12px; font-weight:600; color:var(--text2);
      border-left:3px solid var(--border); padding-left:14px;
    }
    .schedule-time .period-num { font-size:11px; color:var(--text3); margin-top:2px; }
    .schedule-card {
      flex:1; border-radius:var(--radius-sm); padding:14px 16px;
      display:flex; align-items:center; gap:12px; box-shadow:var(--shadow);
      background:var(--bg-card);
    }
    .schedule-subject-icon {
      width:42px; height:42px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; flex-shrink:0;
    }
    .schedule-info h3 { font-size:15px; font-weight:700; margin-bottom:2px; }
    .schedule-info p { font-size:12px; color:var(--text2); }
    .online-badge {
      margin-right:auto; padding:6px 12px; border-radius:20px;
      background:var(--green); color:white; font-size:11px; font-weight:600;
      display:flex; align-items:center; gap:4px;
    }

    /* ====== الدرجات ====== */
    .avg-card {
      background:linear-gradient(135deg,#059669,#10B981);
      border-radius:var(--radius); padding:24px; color:white;
      text-align:center; margin-bottom:20px;
    }
    .avg-card .avg-value { font-size:48px; font-weight:800; line-height:1; }
    .avg-card .avg-label { font-size:14px; opacity:.85; margin-top:4px; }
    .grade-card {
      background:var(--bg-card); border-radius:var(--radius-sm);
      padding:16px; box-shadow:var(--shadow); margin-bottom:12px; cursor:pointer;
      transition: transform .2s;
    }
    .grade-card:active { transform:scale(0.98); }
    .grade-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .grade-header h3 { font-size:15px; font-weight:700; }
    .grade-header span { font-size:14px; font-weight:700; }
    .progress-bar { height:8px; background:var(--border); border-radius:4px; overflow:hidden; }
    .progress-fill { height:100%; border-radius:4px; transition: width .8s ease; }
    .grade-details { margin-top:12px; border-top:1px solid var(--border); padding-top:12px; display:none; }
    .grade-details.show { display:block; animation:pageIn .3s ease; }
    .grade-detail-item {
      display:flex; justify-content:space-between; padding:8px 0;
      font-size:13px; border-bottom:1px solid var(--border);
    }
    .grade-detail-item:last-child { border-bottom:none; }

    /* ====== الأنشطة ====== */
    .activity-tabs {
      display:flex; background:var(--bg-card); border-radius:var(--radius-sm);
      padding:4px; margin-bottom:16px; box-shadow:var(--shadow);
    }
    .activity-tab {
      flex:1; padding:12px; text-align:center; border-radius:10px;
      font-size:14px; font-weight:700; cursor:pointer;
      transition: all .3s; color:var(--text2); border:none; background:none;
    }
    .activity-tab.active { background:var(--accent); color:white; box-shadow:0 2px 8px rgba(79,70,229,0.3); }
    .activity-card {
      background:var(--bg-card); border-radius:var(--radius);
      overflow:hidden; box-shadow:var(--shadow); margin-bottom:16px;
    }
    .activity-img {
      width:100%; height:180px; object-fit:cover;
      background:linear-gradient(135deg,#6366F1,#A855F7);
    }
    .activity-body { padding:16px; }
    .activity-body h3 { font-size:17px; font-weight:700; margin-bottom:6px; }
    .activity-body p { font-size:13px; color:var(--text2); line-height:1.6; margin-bottom:10px; }
    .activity-footer {
      display:flex; align-items:center; justify-content:space-between;
      padding-top:12px; border-top:1px solid var(--border);
    }
    .spots-badge {
      padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700;
      display:flex; align-items:center; gap:4px;
    }
    .spots-badge.available { background:#ECFDF5; color:#059669; }
    .spots-badge.full { background:#FEF2F2; color:#DC2626; }
    .btn-register {
      padding:10px 24px; border-radius:25px; border:none;
      background:linear-gradient(135deg,#4F46E5,#7C3AED); color:white;
      font-size:13px; font-weight:700; cursor:pointer;
      transition: opacity .2s, transform .1s;
    }
    .btn-register:active { transform:scale(0.95); }
    .btn-register:disabled { opacity:.4; cursor:default; }
    .btn-register.registered {
      background:var(--green); cursor:default;
    }

    /* ====== الاختبارات ====== */
    .quiz-card {
      background:var(--bg-card); border-radius:var(--radius);
      padding:20px; box-shadow:var(--shadow); margin-bottom:14px;
      display:flex; align-items:center; gap:16px; cursor:pointer;
      transition: transform .2s;
    }
    .quiz-card:active { transform:scale(0.98); }
    .quiz-icon {
      width:52px; height:52px; border-radius:14px;
      background:linear-gradient(135deg,#F59E0B,#F97316);
      display:flex; align-items:center; justify-content:center;
      color:white; font-size:20px; flex-shrink:0;
    }
    .quiz-info { flex:1; }
    .quiz-info h3 { font-size:15px; font-weight:700; margin-bottom:3px; }
    .quiz-meta { display:flex; gap:12px; font-size:12px; color:var(--text2); }
    .quiz-meta span { display:flex; align-items:center; gap:4px; }

    /* شاشة حل الاختبار */
    #page-quiz-take {
      display:none; position:fixed; inset:0; z-index:200;
      background:var(--bg);
    }
    #page-quiz-take.active { display:flex; flex-direction:column; }
    .quiz-header {
      background:var(--bg2); padding:16px 20px;
      display:flex; align-items:center; justify-content:space-between;
      border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .quiz-timer {
      display:flex; align-items:center; gap:8px;
      font-size:18px; font-weight:800; color:var(--red);
    }
    .quiz-progress-text { font-size:13px; color:var(--text2); font-weight:600; }
    .progress-bar-lg { height:6px; background:var(--border); border-radius:3px; margin:0 20px; flex-shrink:0; }
    .quiz-body { flex:1; overflow-y:auto; padding:20px; }
    .question-card {
      background:var(--bg-card); border-radius:var(--radius);
      padding:24px; box-shadow:var(--shadow); margin-bottom:20px;
    }
    .question-num { font-size:13px; color:var(--accent); font-weight:700; margin-bottom:8px; }
    .question-text { font-size:17px; font-weight:700; line-height:1.7; margin-bottom:20px; }
    .option-btn {
      width:100%; padding:16px; border:2px solid var(--border);
      border-radius:var(--radius-sm); background:var(--bg);
      color:var(--text); font-size:14px; font-weight:600;
      cursor:pointer; margin-bottom:10px; text-align:right;
      transition: all .2s; display:flex; align-items:center; gap:12px;
    }
    .option-btn:hover { border-color:var(--accent2); }
    .option-btn.selected { border-color:var(--accent); background:rgba(79,70,229,0.08); }
    .option-btn.correct { border-color:var(--green); background:rgba(16,185,129,0.08); }
    .option-btn.wrong { border-color:var(--red); background:rgba(239,68,68,0.08); }
    .option-letter {
      width:32px; height:32px; border-radius:50%; background:var(--border);
      display:flex; align-items:center; justify-content:center;
      font-size:13px; font-weight:700; flex-shrink:0;
    }
    .option-btn.selected .option-letter { background:var(--accent); color:white; }
    .option-btn.correct .option-letter { background:var(--green); color:white; }
    .option-btn.wrong .option-letter { background:var(--red); color:white; }
    .quiz-footer {
      padding:16px 20px; background:var(--bg2); border-top:1px solid var(--border);
      display:flex; gap:12px; flex-shrink:0;
      padding-bottom:calc(16px + env(safe-area-inset-bottom));
    }
    .btn-outline {
      flex:1; padding:14px; border:2px solid var(--border); border-radius:var(--radius-sm);
      background:var(--bg-card); color:var(--text); font-size:14px; font-weight:700;
      cursor:pointer; transition: all .2s;
    }
    .btn-outline:disabled { opacity:.4; }
    .btn-gradient {
      flex:1; padding:14px; border:none; border-radius:var(--radius-sm);
      background:linear-gradient(135deg,#4F46E5,#7C3AED);
      color:white; font-size:14px; font-weight:700; cursor:pointer;
      transition: all .2s;
    }
    .btn-gradient:disabled { opacity:.4; }

    /* نتيجة الاختبار */
    .result-card {
      text-align:center; padding:40px 24px;
    }
    .result-score {
      width:120px; height:120px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 20px; font-size:36px; font-weight:800; color:white;
    }
    .result-card h2 { font-size:22px; margin-bottom:8px; }
    .result-card p { color:var(--text2); font-size:14px; line-height:1.6; margin-bottom:24px; }

    /* ====== Skeleton loaders ====== */
    .skeleton {
      background: linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%);
      background-size:200% 100%; animation:shimmer 1.5s infinite;
      border-radius:8px;
    }
    .skeleton-text { height:16px; margin-bottom:10px; border-radius:6px; }
    .skeleton-text.w60 { width:60%; }
    .skeleton-text.w80 { width:80%; }
    .skeleton-text.w40 { width:40%; }
    .skeleton-card { height:80px; border-radius:var(--radius-sm); margin-bottom:12px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ====== إشعارات Toast ====== */
    #toast-container {
      position:fixed; bottom:calc(var(--nav-h) + 20px); left:50%; transform:translateX(-50%);
      z-index:999; display:flex; flex-direction:column; gap:8px; align-items:center;
    }
    .toast {
      padding:14px 28px; border-radius:14px;
      background:var(--text); color:var(--bg); font-size:14px; font-weight:700;
      box-shadow:var(--shadow-lg);
      opacity:0; transform:translateY(16px) scale(0.9);
      transition:all .3s cubic-bezier(.175,.885,.32,1.275);
      display:flex; align-items:center; gap:8px;
    }
    .toast.show { opacity:1; transform:translateY(0) scale(1); }
    .toast.success { background:#059669; color:white; }
    .toast.error { background:#DC2626; color:white; }

    /* ====== حالة فارغة ====== */
    .empty-state {
      text-align:center; padding:48px 24px; color:var(--text3);
    }
    .empty-state i { font-size:48px; margin-bottom:12px; display:block; }
    .empty-state p { font-size:14px; font-weight:600; }

    /* ====== مساعدات ====== */
    .section-title { font-size:18px; font-weight:700; margin-bottom:14px; }
    .badge {
      padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;
      display:inline-flex; align-items:center; gap:4px;
    }
    .section-pad { padding:0 0 20px; }
    .mb-12 { margin-bottom:12px; }
    .flex-center { display:flex; align-items:center; justify-content:center; }
    .gap-10 { gap:10px; }
    .text-sm { font-size:13px; }
    .text-xs { font-size:11px; }

    /* تأثير التمرير */
    ::-webkit-scrollbar { width:4px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }
  </style>
</head>
<body>

  <!-- ====== شاشة تسجيل الدخول ====== -->
  <div id="login-screen">
    <div class="login-card">
      <div class="login-icon">
        <i class="fa-solid fa-graduation-cap"></i>
      </div>
      <h1>معهد المستقبل</h1>
      <p class="subtitle">سجّل دخولك للمتابعة</p>
      <div class="form-group">
        <label>اسم المستخدم</label>
        <input type="text" id="login-name" class="form-input" placeholder="مثال: أحمد محمد" autocomplete="username">
      </div>
      <div class="form-group">
        <label>كلمة المرور</label>
        <input type="password" id="login-pass" class="form-input" placeholder="أدخل كلمة المرور" autocomplete="current-password">
      </div>
      <button id="login-btn" class="btn-primary" onclick="doLogin()">
        <i class="fa-solid fa-arrow-right-to-bracket"></i>&nbsp; تسجيل الدخول
      </button>
      <p style="text-align:center;margin-top:16px;font-size:12px;color:var(--text3);">
        للتجربة: أحمد محمد / 1234 أو سارة أحمد / 1234
      </p>
    </div>
  </div>

  <!-- ====== التطبيق الرئيسي ====== -->
  <div id="app">
    <!-- الشريط العلوي -->
    <header id="app-header">
      <h1 id="header-title">معهد المستقبل</h1>
      <div id="header-actions">
        <button class="icon-btn" onclick="toggleDark()" id="dark-btn" title="تبديل الوضع">
          <i class="fa-solid fa-moon"></i>
        </button>
        <button class="icon-btn" onclick="doLogout()" title="تسجيل الخروج">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </header>

    <!-- حاوية الصفحات -->
    <main id="pages-container">

      <!-- ===== الصفحة الرئيسية ===== -->
      <section id="page-home" class="page">
        <div class="welcome-card">
          <h2 id="welcome-name">أهلاً بك</h2>
          <p id="welcome-class">الصف</p>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background:#EEF2FF;color:#4F46E5;">
              <i class="fa-solid fa-calendar-check"></i>
            </div>
            <div class="stat-value" id="stat-activities">-</div>
            <div class="stat-label">أنشطة قادمة</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#ECFDF5;color:#059669;">
              <i class="fa-solid fa-chart-line"></i>
            </div>
            <div class="stat-value" id="stat-grade">-</div>
            <div class="stat-label">آخر درجة</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FEF3C7;color:#D97706;">
              <i class="fa-solid fa-clipboard-question"></i>
            </div>
            <div class="stat-value" id="stat-quizzes">-</div>
            <div class="stat-label">اختبارات متاحة</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#FCE7F3;color:#DB2777;">
              <i class="fa-solid fa-book"></i>
            </div>
            <div class="stat-value" id="stat-next-class">-</div>
            <div class="stat-label">الحصة القادمة</div>
          </div>
        </div>
        <h3 class="section-title">آخر الأنشطة</h3>
        <div id="home-activities"></div>
      </section>

      <!-- ===== جدول الحصص ===== -->
      <section id="page-schedule" class="page">
        <div class="day-tabs" id="day-tabs"></div>
        <div id="schedule-list"></div>
      </section>

      <!-- ===== درجاتي ===== -->
      <section id="page-grades" class="page">
        <div class="avg-card">
          <div class="avg-value" id="avg-value">-%</div>
          <div class="avg-label">المعدل العام</div>
        </div>
        <div id="grades-list"></div>
      </section>

      <!-- ===== الأنشطة ===== -->
      <section id="page-activities" class="page">
        <div class="activity-tabs">
          <button class="activity-tab active" onclick="switchActivityTab('all',this)">عام</button>
          <button class="activity-tab" onclick="switchActivityTab('summer',this)">صيفي</button>
        </div>
        <div id="activities-list"></div>
      </section>

      <!-- ===== الاختبارات ===== -->
      <section id="page-quizzes" class="page">
        <h3 class="section-title">الاختبارات المتاحة</h3>
        <div id="quizzes-list"></div>
        <div id="quiz-history"></div>
      </section>

    </main>

    <!-- التنقل السفلي -->
    <nav id="bottom-nav">
      <button class="nav-item active" data-page="home" onclick="navigateTo('home')">
        <i class="fa-solid fa-house"></i>
        <span>الرئيسية</span>
      </button>
      <button class="nav-item" data-page="schedule" onclick="navigateTo('schedule')">
        <i class="fa-solid fa-calendar-days"></i>
        <span>الجدول</span>
      </button>
      <button class="nav-item" data-page="grades" onclick="navigateTo('grades')">
        <i class="fa-solid fa-chart-column"></i>
        <span>درجاتي</span>
      </button>
      <button class="nav-item" data-page="activities" onclick="navigateTo('activities')">
        <i class="fa-solid fa-trophy"></i>
        <span>الأنشطة</span>
      </button>
      <button class="nav-item" data-page="quizzes" onclick="navigateTo('quizzes')">
        <i class="fa-solid fa-clipboard-question"></i>
        <span>اختباراتي</span>
      </button>
    </nav>
  </div>

  <!-- ====== شاشة حل الاختبار (overlay) ====== -->
  <div id="page-quiz-take">
    <div class="quiz-header">
      <button class="icon-btn" onclick="exitQuiz()"><i class="fa-solid fa-xmark"></i></button>
      <div class="quiz-timer"><i class="fa-solid fa-clock"></i> <span id="quiz-timer-val">00:00</span></div>
      <div class="quiz-progress-text" id="quiz-progress-text">0/0</div>
    </div>
    <div class="progress-bar-lg"><div class="progress-fill" id="quiz-progress-bar" style="width:0%;background:var(--accent);"></div></div>
    <div class="quiz-body" id="quiz-body"></div>
    <div class="quiz-footer">
      <button class="btn-outline" id="quiz-prev" onclick="quizPrev()" disabled>السابق</button>
      <button class="btn-gradient" id="quiz-next" onclick="quizNext()">التالي</button>
    </div>
  </div>

  <!-- ====== إشعارات ====== -->
  <div id="toast-container"></div>

  <!-- ====== السكربت الرئيسي ====== -->
  <script>
    // ========== الحالة العامة ==========
    const INITIAL_USER = ${userData};
    let currentUser = INITIAL_USER;
    let darkMode = localStorage.getItem('darkMode') === 'true';
    let selectedDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'السبت';
    let activityTab = 'all';

    // حالة الاختبار
    let quizExam = null;
    let quizQuestions = [];
    let quizAnswers = [];
    let quizIndex = 0;
    let quizTimerInterval = null;
    let quizSeconds = 0;

    // ========== تهيئة التطبيق ==========
    (function init() {
      if (darkMode) {
        document.body.classList.add('dark');
        updateDarkIcon();
      }
      if (currentUser) {
        showApp();
        navigateTo('home');
      }
      // السماح بتسجيل الدخول بالضغط على Enter
      document.getElementById('login-pass').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doLogin();
      });
      // تسجيل Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(function(){});
      }
    })();

    // ========== عرض/إخفاء ==========
    function showApp() {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').classList.add('visible');
      document.getElementById('welcome-name').textContent = 'أهلاً، ' + currentUser.name;
      document.getElementById('welcome-class').textContent = 'الصف ' + formatClass(currentUser.class);
    }

    function showLogin() {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app').classList.remove('visible');
    }

    // ========== تسجيل الدخول ==========
    async function doLogin() {
      var nameInput = document.getElementById('login-name');
      var passInput = document.getElementById('login-pass');
      var btn = document.getElementById('login-btn');
      var name = nameInput.value.trim();
      var pass = passInput.value.trim();
      if (!name || !pass) {
        showToast('أدخل اسم المستخدم وكلمة المرور', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'جارٍ التحقق...';
      try {
        var res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name, password: pass })
        });
        var data = await res.json();
        if (data.error) {
          showToast(data.error, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>&nbsp; تسجيل الدخول';
          return;
        }
        currentUser = { id: data.id, name: data.name, role: data.role, class: data.class };
        showApp();
        navigateTo('home');
        showToast('مرحباً ' + data.name, 'success');
      } catch (e) {
        showToast('خطأ في الاتصال', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>&nbsp; تسجيل الدخول';
      }
    }

    async function doLogout() {
      try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
      currentUser = null;
      showLogin();
      document.getElementById('login-name').value = '';
      document.getElementById('login-pass').value = '';
    }

    // ========== التنقل ==========
    function navigateTo(page) {
      document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
      var el = document.getElementById('page-' + page);
      if (el) el.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
      var navBtn = document.querySelector('[data-page="' + page + '"]');
      if (navBtn) navBtn.classList.add('active');
      loadPageData(page);
      window.scrollTo(0, 0);
    }

    // ========== تحميل بيانات الصفحة ==========
    var loadedPages = {};
    async function loadPageData(page) {
      if (page === 'home') await loadDashboard();
      else if (page === 'schedule') await loadSchedule();
      else if (page === 'grades') await loadGrades();
      else if (page === 'activities') await loadActivities();
      else if (page === 'quizzes') await loadQuizzes();
    }

    // ========== لوحة التحكم ==========
    async function loadDashboard() {
      try {
        var [actsRes, gradesRes, quizzesRes] = await Promise.all([
          fetch('/api/activities?summer=false'),
          fetch('/api/grades?student_id=' + currentUser.id),
          fetch('/api/exams?class=' + currentUser.class)
        ]);
        var acts = await actsRes.json();
        var grades = await gradesRes.json();
        var quizzes = await quizzesRes.json();

        document.getElementById('stat-activities').textContent = (acts.activities || []).length;
        var allGrades = grades.grades || [];
        if (allGrades.length > 0) {
          var last = allGrades[allGrades.length - 1];
          document.getElementById('stat-grade').textContent = Math.round(last.score / last.max_score * 100) + '%';
        } else {
          document.getElementById('stat-grade').textContent = '-';
        }
        document.getElementById('stat-quizzes').textContent = (quizzes.exams || []).length;

        // الحصة القادمة
        var todayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'السبت';
        try {
          var schedRes = await fetch('/api/schedule?class=' + currentUser.class + '&day=' + todayName);
          var sched = await schedRes.json();
          var schedule = sched.schedule || [];
          if (schedule.length > 0) {
            document.getElementById('stat-next-class').textContent = schedule[0].subject.substring(0, 8);
          } else {
            document.getElementById('stat-next-class').textContent = '-';
          }
        } catch(e) {
          document.getElementById('stat-next-class').textContent = '-';
        }

        // عرض آخر الأنشطة في الرئيسية
        var container = document.getElementById('home-activities');
        var homeActs = (acts.activities || []).slice(0, 2);
        if (homeActs.length === 0) {
          container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>لا توجد أنشطة حالياً</p></div>';
        } else {
          var html = '';
          homeActs.forEach(function(a) {
            html += '<div class="card" style="display:flex;align-items:center;gap:14px;">'
              + '<div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#F59E0B,#F97316);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;flex-shrink:0;">'
              + '<i class="fa-solid fa-star"></i></div>'
              + '<div style="flex:1;"><h4 style="font-size:14px;font-weight:700;">' + a.title + '</h4>'
              + '<p style="font-size:12px;color:var(--text2);">' + (a.date || '') + '</p></div>'
              + '<i class="fa-solid fa-chevron-left" style="color:var(--text3);"></i>'
              + '</div>';
          });
          container.innerHTML = html;
        }
        loadedPages.home = true;
      } catch(e) {
        console.error('Dashboard error:', e);
      }
    }

    // ========== جدول الحصص ==========
    async function loadSchedule() {
      var tabsContainer = document.getElementById('day-tabs');
      tabsContainer.innerHTML = DAYS.map(function(d) {
        return '<button class="day-tab' + (d === selectedDay ? ' active' : '') + '" onclick="selectDay(\\'' + d + '\\',this)">' + d + '</button>';
      }).join('');
      await fetchSchedule();
    }

    function selectDay(day, btn) {
      selectedDay = day;
      document.querySelectorAll('.day-tab').forEach(function(t) { t.classList.remove('active'); });
      btn.classList.add('active');
      fetchSchedule();
    }

    async function fetchSchedule() {
      var list = document.getElementById('schedule-list');
      list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
      try {
        var res = await fetch('/api/schedule?class=' + currentUser.class + '&day=' + encodeURIComponent(selectedDay));
        var data = await res.json();
        var schedule = data.schedule || [];
        if (schedule.length === 0) {
          list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>لا توجد حصص في هذا اليوم</p></div>';
          return;
        }
        var html = '';
        schedule.forEach(function(item) {
          var p = PERIODS[item.period] || { start: '?', end: '?' };
          var style = SUBJECT_STYLES[item.subject] || { color:'#6366F1', bg:'#EEF2FF', icon:'fa-book' };
          html += '<div class="schedule-item">'
            + '<div class="schedule-time"><span style="font-weight:700;">' + p.start + '</span>'
            + '<span class="period-num">حصة ' + item.period + '</span>'
            + '<span style="margin-top:2px;">' + p.end + '</span></div>'
            + '<div class="schedule-card">'
            + '<div class="schedule-subject-icon" style="background:' + style.bg + ';color:' + style.color + ';">'
            + '<i class="fa-solid ' + style.icon + '"></i></div>'
            + '<div class="schedule-info"><h3>' + item.subject + '</h3>'
            + '<p><i class="fa-solid fa-location-dot"></i> ' + (item.room || '-') + '</p></div>'
            + (item.online_link ? '<a href="' + item.online_link + '" target="_blank" class="online-badge"><i class="fa-solid fa-video"></i> اونلاين</a>' : '')
            + '</div></div>';
        });
        list.innerHTML = html;
      } catch(e) {
        list.innerHTML = '<div class="empty-state"><p>خطأ في تحميل الجدول</p></div>';
      }
    }

    // ========== الدرجات ==========
    async function loadGrades() {
      var list = document.getElementById('grades-list');
      list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
      try {
        var res = await fetch('/api/grades?student_id=' + currentUser.id);
        var data = await res.json();
        var grades = data.grades || [];

        // حساب المعدل
        if (grades.length > 0) {
          var totalPct = 0;
          grades.forEach(function(g) { totalPct += (g.score / g.max_score) * 100; });
          var avg = Math.round(totalPct / grades.length);
          document.getElementById('avg-value').textContent = avg + '%';
        } else {
          document.getElementById('avg-value').textContent = '-%';
        }

        // تجميع حسب المادة
        var subjects = {};
        grades.forEach(function(g) {
          if (!subjects[g.subject]) subjects[g.subject] = [];
          subjects[g.subject].push(g);
        });

        var html = '';
        var subjectKeys = Object.keys(subjects);
        for (var i = 0; i < subjectKeys.length; i++) {
          var subj = subjectKeys[i];
          var items = subjects[subj];
          var total = 0;
          items.forEach(function(g) { total += (g.score / g.max_score) * 100; });
          var avgSubj = Math.round(total / items.length);
          var color = avgSubj >= 80 ? '#10B981' : avgSubj >= 60 ? '#F59E0B' : '#EF4444';

          html += '<div class="grade-card" onclick="this.querySelector(\\'.grade-details\\').classList.toggle(\\'show\\')">'
            + '<div class="grade-header"><h3>' + subj + '</h3>'
            + '<span style="color:' + color + ';">' + avgSubj + '%</span></div>'
            + '<div class="progress-bar"><div class="progress-fill" style="width:' + avgSubj + '%;background:' + color + ';"></div></div>'
            + '<div class="grade-details">';
          items.forEach(function(g) {
            var pct = Math.round((g.score / g.max_score) * 100);
            html += '<div class="grade-detail-item">'
              + '<span>' + g.exam_name + '</span>'
              + '<span style="font-weight:700;color:' + (pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444') + ';">'
              + g.score + '/' + g.max_score + ' (' + pct + '%)</span></div>';
          });
          html += '</div></div>';
        }
        if (subjectKeys.length === 0) {
          html = '<div class="empty-state"><i class="fa-solid fa-chart-simple"></i><p>لا توجد درجات بعد</p></div>';
        }
        list.innerHTML = html;
      } catch(e) {
        list.innerHTML = '<div class="empty-state"><p>خطأ في تحميل الدرجات</p></div>';
      }
    }

    // ========== الأنشطة ==========
    async function loadActivities() {
      var list = document.getElementById('activities-list');
      list.innerHTML = '<div class="skeleton-card" style="height:260px;"></div><div class="skeleton-card" style="height:260px;"></div>';
      try {
        var summer = activityTab === 'summer';
        var res = await fetch('/api/activities?summer=' + summer);
        var data = await res.json();
        var acts = data.activities || [];

        // جلب تسجيلات الطالب
        var regsRes = await fetch('/api/activities/my-registrations?student_id=' + currentUser.id);
        var regsData = await regsRes.json();
        var myRegs = (regsData.registrations || []).map(function(r) { return r.activity_id; });

        if (acts.length === 0) {
          list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>لا توجد أنشطة حالياً</p></div>';
          return;
        }

        var html = '';
        acts.forEach(function(a) {
          var registered = myRegs.indexOf(a.id) >= 0;
          var spotsLeft = a.max_capacity - (a.registered_count || 0);
          var full = spotsLeft <= 0;

          html += '<div class="activity-card">'
            + '<img class="activity-img" src="/api/images/' + encodeURIComponent(a.image_key || '') + '" alt="' + a.title + '" onerror="this.style.display=\\'none\\'">'
            + '<div class="activity-body"><h3>' + a.title + '</h3>'
            + '<p>' + (a.description || '') + '</p>'
            + '<div class="activity-footer">'
            + '<span class="spots-badge ' + (full ? 'full' : 'available') + '">'
            + '<i class="fa-solid ' + (full ? 'fa-ban' : 'fa-users') + '"></i> '
            + (full ? 'مكتمل' : spotsLeft + ' مقاعد متبقية')
            + '</span>'
            + (registered
              ? '<button class="btn-register registered" disabled><i class="fa-solid fa-check"></i> مسجّل</button>'
              : '<button class="btn-register" onclick="registerActivity(' + a.id + ',this)" ' + (full ? 'disabled' : '') + '>'
                + '<i class="fa-solid fa-plus"></i> تسجيل</button>')
            + '</div></div></div>';
        });
        list.innerHTML = html;
      } catch(e) {
        list.innerHTML = '<div class="empty-state"><p>خطأ في تحميل الأنشطة</p></div>';
      }
    }

    function switchActivityTab(tab, btn) {
      activityTab = tab;
      document.querySelectorAll('.activity-tab').forEach(function(t) { t.classList.remove('active'); });
      btn.classList.add('active');
      loadActivities();
    }

    async function registerActivity(actId, btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        var res = await fetch('/api/activities/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activity_id: actId, student_id: currentUser.id })
        });
        var data = await res.json();
        if (data.error) {
          showToast(data.error, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-plus"></i> تسجيل';
        } else {
          showToast('تم التسجيل في النشاط بنجاح', 'success');
          loadActivities();
        }
      } catch(e) {
        showToast('خطأ في التسجيل', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> تسجيل';
      }
    }

    // ========== الاختبارات ==========
    async function loadQuizzes() {
      var list = document.getElementById('quizzes-list');
      var historyEl = document.getElementById('quiz-history');
      list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
      historyEl.innerHTML = '';
      try {
        var res = await fetch('/api/exams?class=' + currentUser.class + '&student_id=' + currentUser.id);
        var data = await res.json();
        var exams = data.exams || [];

        if (exams.length === 0) {
          list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clipboard-question"></i><p>لا توجد اختبارات متاحة</p></div>';
        } else {
          var html = '';
          exams.forEach(function(ex) {
            var qs = [];
            try { qs = JSON.parse(ex.questions); } catch(e) { qs = []; }
            html += '<div class="quiz-card" onclick="startQuiz(' + ex.id + ')">'
              + '<div class="quiz-icon"><i class="fa-solid fa-file-pen"></i></div>'
              + '<div class="quiz-info"><h3>' + ex.title + '</h3>'
              + '<div class="quiz-meta">'
              + '<span><i class="fa-solid fa-list-ol"></i> ' + qs.length + ' أسئلة</span>'
              + '<span><i class="fa-solid fa-clock"></i> ' + Math.floor(ex.time_limit / 60) + ' دقيقة</span>'
              + '</div>'
              + (ex.last_score !== null && ex.last_score !== undefined
                ? '<div style="margin-top:6px;font-size:12px;font-weight:700;color:' + (ex.last_score >= 50 ? 'var(--green)' : 'var(--red)') + ';">'
                  + '<i class="fa-solid fa-rotate-left"></i> آخر محاولة: ' + ex.last_score + '%' + '</div>'
                : '')
              + '</div>'
              + '<i class="fa-solid fa-chevron-left" style="color:var(--text3);"></i>'
              + '</div>';
          });
          list.innerHTML = html;
        }

        // تاريخ المحاولات
        if (data.history && data.history.length > 0) {
          var histHtml = '<h3 class="section-title" style="margin-top:20px;">سجل المحاولات</h3>';
          data.history.forEach(function(h) {
            histHtml += '<div class="card" style="display:flex;align-items:center;justify-content:space-between;">'
              + '<div><h4 style="font-size:14px;">' + h.exam_title + '</h4>'
              + '<p style="font-size:12px;color:var(--text2);">' + h.completed_at + '</p></div>'
              + '<span style="font-size:20px;font-weight:800;color:' + (h.score >= 50 ? 'var(--green)' : 'var(--red)') + ';">' + h.score + '%</span>'
              + '</div>';
          });
          historyEl.innerHTML = histHtml;
        }
      } catch(e) {
        list.innerHTML = '<div class="empty-state"><p>خطأ في تحميل الاختبارات</p></div>';
      }
    }

    // ========== حل الاختبار ==========
    async function startQuiz(examId) {
      try {
        var res = await fetch('/api/exam/' + examId + '/questions');
        var data = await res.json();
        if (data.error) {
          showToast(data.error, 'error');
          return;
        }
        quizExam = data.exam;
        quizQuestions = data.questions || [];
        quizAnswers = new Array(quizQuestions.length).fill(-1);
        quizIndex = 0;
        quizSeconds = quizExam.time_limit || 300;

        // إخفاء التنقل
        document.getElementById('bottom-nav').style.display = 'none';
        document.getElementById('app-header').style.display = 'none';
        document.getElementById('page-quiz-take').classList.add('active');

        renderQuestion();
        startQuizTimer();
      } catch(e) {
        showToast('خطأ في تحميل الأسئلة', 'error');
      }
    }

    function startQuizTimer() {
      clearInterval(quizTimerInterval);
      updateTimerDisplay();
      quizTimerInterval = setInterval(function() {
        quizSeconds--;
        updateTimerDisplay();
        if (quizSeconds <= 0) {
          clearInterval(quizTimerInterval);
          submitQuiz();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      var m = Math.floor(quizSeconds / 60);
      var s = quizSeconds % 60;
      var el = document.getElementById('quiz-timer-val');
      el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      if (quizSeconds <= 30) el.style.color = 'var(--red)';
    }

    function renderQuestion() {
      var q = quizQuestions[quizIndex];
      var body = document.getElementById('quiz-body');
      var letters = ['أ', 'ب', 'ج', 'د'];

      document.getElementById('quiz-progress-text').textContent = (quizIndex + 1) + '/' + quizQuestions.length;
      document.getElementById('quiz-progress-bar').style.width = ((quizIndex + 1) / quizQuestions.length * 100) + '%';

      var html = '<div class="question-card">'
        + '<div class="question-num">السؤال ' + (quizIndex + 1) + ' من ' + quizQuestions.length + '</div>'
        + '<div class="question-text">' + q.q + '</div>';

      for (var i = 0; i < q.options.length; i++) {
        var selected = quizAnswers[quizIndex] === i ? ' selected' : '';
        html += '<button class="option-btn' + selected + '" onclick="selectOption(' + i + ')">'
          + '<span class="option-letter">' + letters[i] + '</span>'
          + '<span>' + q.options[i] + '</span></button>';
      }
      html += '</div>';
      body.innerHTML = html;

      document.getElementById('quiz-prev').disabled = quizIndex === 0;
      var nextBtn = document.getElementById('quiz-next');
      if (quizIndex === quizQuestions.length - 1) {
        nextBtn.textContent = 'إنهاء الاختبار';
        nextBtn.onclick = function() { submitQuiz(); };
      } else {
        nextBtn.textContent = 'التالي';
        nextBtn.onclick = function() { quizNext(); };
      }
    }

    function selectOption(idx) {
      quizAnswers[quizIndex] = idx;
      document.querySelectorAll('.option-btn').forEach(function(b) { b.classList.remove('selected'); });
      document.querySelectorAll('.option-btn')[idx].classList.add('selected');
    }

    function quizNext() {
      if (quizIndex < quizQuestions.length - 1) {
        quizIndex++;
        renderQuestion();
      }
    }

    function quizPrev() {
      if (quizIndex > 0) {
        quizIndex--;
        renderQuestion();
      }
    }

    async function submitQuiz() {
      clearInterval(quizTimerInterval);
      var unanswered = quizAnswers.filter(function(a) { return a === -1; }).length;
      if (unanswered > 0 && quizSeconds > 0) {
        if (!confirm('لديك ' + unanswered + ' أسئلة بدون إجابة. هل تريد الإنهاء؟')) return;
      }

      // حساب النتيجة
      var correct = 0;
      quizQuestions.forEach(function(q, i) {
        if (quizAnswers[i] === q.answer) correct++;
      });
      var score = Math.round((correct / quizQuestions.length) * 100);

      // حفظ النتيجة
      try {
        await fetch('/api/exam/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: currentUser.id,
            exam_id: quizExam.id,
            answers: quizAnswers
          })
        });
      } catch(e) {}

      // عرض النتيجة
      var color = score >= 80 ? 'linear-gradient(135deg,#059669,#10B981)' : score >= 50 ? 'linear-gradient(135deg,#D97706,#F59E0B)' : 'linear-gradient(135deg,#DC2626,#EF4444)';
      var msg = score >= 80 ? 'ممتاز! أداء رائع' : score >= 50 ? 'جيد، واصل التحسين' : 'تحتاج مراجعة أكثر';

      var body = document.getElementById('quiz-body');
      body.innerHTML = '<div class="result-card">'
        + '<div class="result-score" style="background:' + color + ';">' + score + '%</div>'
        + '<h2>' + msg + '</h2>'
        + '<p>أجبت على ' + correct + ' من ' + quizQuestions.length + ' أسئلة بشكل صحيح</p>'
        + '<button class="btn-gradient" style="width:100%;max-width:280px;margin:0 auto;" onclick="exitQuiz()">العودة للاختبارات</button>'
        + '</div>';

      document.getElementById('quiz-progress-bar').style.width = '100%';
      document.querySelector('.quiz-footer').style.display = 'none';
    }

    function exitQuiz() {
      clearInterval(quizTimerInterval);
      document.getElementById('page-quiz-take').classList.remove('active');
      document.getElementById('bottom-nav').style.display = '';
      document.getElementById('app-header').style.display = '';
      document.querySelector('.quiz-footer').style.display = '';
      quizExam = null;
      quizQuestions = [];
      quizAnswers = [];
      navigateTo('quizzes');
    }

    // ========== الوضع الليلي ==========
    function toggleDark() {
      darkMode = !darkMode;
      document.body.classList.toggle('dark', darkMode);
      localStorage.setItem('darkMode', darkMode);
      updateDarkIcon();
    }

    function updateDarkIcon() {
      var icon = document.querySelector('#dark-btn i');
      if (icon) {
        icon.className = darkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      }
    }

    // ========== إشعارات Toast ==========
    function showToast(message, type) {
      var container = document.getElementById('toast-container');
      var toast = document.createElement('div');
      toast.className = 'toast' + (type ? ' ' + type : '');
      var iconClass = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      toast.innerHTML = '<i class="fa-solid ' + iconClass + '"></i> ' + message;
      container.appendChild(toast);
      requestAnimationFrame(function() {
        toast.classList.add('show');
      });
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
      }, 3000);
    }

    // ========== تنسيق الصف ==========
    function formatClass(cls) {
      if (cls === '9th') return 'التاسع';
      if (cls === '10th') return 'العاشر';
      return cls;
    }
  </script>
</body>
</html>`;
}

// ============================================================
// معالجات API
// ============================================================

/** POST /api/login - تسجيل الدخول */
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse('أدخل اسم المستخدم وكلمة المرور');
    }

    // تسجيل دخول المدير
    if (username === 'admin') {
      const adminSecret = env.ADMIN_SECRET || 'admin123';
      if (password !== adminSecret) {
        return errorResponse('كلمة مرور خاطئة');
      }
      const token = await createToken({ id: 0, name: 'المدير', role: 'admin', class: 'all' }, env.JWT_SECRET || 'default-secret');
      const headers = {
        'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(),
      };
      return new Response(JSON.stringify({ id: 0, name: 'المدير', role: 'admin', class: 'all' }), {
        status: 200, headers,
      });
    }

    // تسجيل دخول طالب
    const db = env.DB;
    const student = await db.prepare('SELECT id, name, class, password FROM students WHERE name = ?').bind(username).first();

    if (!student || student.password !== password) {
      return errorResponse('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    const token = await createToken(
      { id: student.id, name: student.name, role: 'student', class: student.class },
      env.JWT_SECRET || 'default-secret'
    );

    const headers = {
      'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    };
    return new Response(JSON.stringify({
      id: student.id,
      name: student.name,
      role: 'student',
      class: student.class,
    }), { status: 200, headers });
  } catch (e) {
    return errorResponse('خطأ داخلي: ' + e.message, 500);
  }
}

/** POST /api/logout - تسجيل الخروج */
async function handleLogout(request) {
  const headers = {
    'Set-Cookie': 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
  };
  return new Response(JSON.stringify({ message: 'تم تسجيل الخروج' }), { status: 200, headers });
}

/** GET /api/schedule - جدول حصص */
async function handleGetSchedule(request, env) {
  try {
    const url = new URL(request.url);
    const cls = url.searchParams.get('class') || '9th';
    const day = url.searchParams.get('day') || 'السبت';

    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT s.*, t.name as teacher_name FROM schedule s LEFT JOIN teachers t ON s.teacher_id = t.id WHERE s.class = ? AND s.day = ? ORDER BY s.period ASC'
    ).bind(cls, day).all();

    return jsonResponse({ schedule: results });
  } catch (e) {
    return errorResponse('خطأ في تحميل الجدول: ' + e.message, 500);
  }
}

/** GET /api/grades - درجات الطالب */
async function handleGetGrades(request, env) {
  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id');

    if (!studentId) return errorResponse('معرف الطالب مطلوب');

    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT * FROM grades WHERE student_id = ? ORDER BY date ASC'
    ).bind(studentId).all();

    return jsonResponse({ grades: results });
  } catch (e) {
    return errorResponse('خطأ في تحميل الدرجات: ' + e.message, 500);
  }
}

/** GET /api/activities - قائمة الأنشطة */
async function handleGetActivities(request, env) {
  try {
    const url = new URL(request.url);
    const summerParam = url.searchParams.get('summer');
    const isSummer = summerParam === 'true' ? 1 : 0;

    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT a.*, (SELECT COUNT(*) FROM activity_registrations WHERE activity_id = a.id) as registered_count FROM activities a WHERE a.is_summer = ? ORDER BY a.date ASC'
    ).bind(isSummer).all();

    return jsonResponse({ activities: results });
  } catch (e) {
    return errorResponse('خطأ في تحميل الأنشطة: ' + e.message, 500);
  }
}

/** GET /api/activities/my-registrations - تسجيلات الطالب */
async function handleMyRegistrations(request, env) {
  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id');
    if (!studentId) return errorResponse('معرف الطالب مطلوب');

    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT DISTINCT activity_id FROM activity_registrations WHERE student_id = ?'
    ).bind(studentId).all();

    return jsonResponse({ registrations: results });
  } catch (e) {
    return errorResponse('خطأ: ' + e.message, 500);
  }
}

/** POST /api/activities/register - تسجيل في نشاط */
async function handleRegisterActivity(request, env) {
  try {
    const body = await request.json();
    const { activity_id, student_id } = body;

    if (!activity_id || !student_id) {
      return errorResponse('بيانات غير مكتملة');
    }

    const db = env.DB;

    // التحقق من السعة
    const activity = await db.prepare('SELECT max_capacity FROM activities WHERE id = ?').bind(activity_id).first();
    if (!activity) return errorResponse('النشاط غير موجود');

    const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM activity_registrations WHERE activity_id = ?').bind(activity_id).first();
    if (countResult.cnt >= activity.max_capacity) {
      return errorResponse('النشاط مكتمل العدد');
    }

    // التحقق من تسجيل مسبق
    const existing = await db.prepare('SELECT id FROM activity_registrations WHERE activity_id = ? AND student_id = ?').bind(activity_id, student_id).first();
    if (existing) {
      return errorResponse('أنت مسجل بالفعل في هذا النشاط');
    }

    // إجراء التسجيل
    await db.prepare('INSERT INTO activity_registrations (activity_id, student_id, registered_at) VALUES (?, ?, datetime("now"))').bind(activity_id, student_id).run();

    return jsonResponse({ message: 'تم التسجيل بنجاح' });
  } catch (e) {
    return errorResponse('خطأ في التسجيل: ' + e.message, 500);
  }
}

/** GET /api/exams - قائمة الاختبارات */
async function handleGetExams(request, env) {
  try {
    const url = new URL(request.url);
    const cls = url.searchParams.get('class') || '9th';
    const studentId = url.searchParams.get('student_id');

    const db = env.DB;
    const { results } = await db.prepare(
      'SELECT * FROM exams WHERE class = ? ORDER BY id ASC'
    ).bind(cls).all();

    // جلب آخر درجة لكل اختبار (إن وجدت)
    if (studentId) {
      for (let i = 0; i < results.length; i++) {
        const attempt = await db.prepare(
          'SELECT score FROM exam_attempts WHERE exam_id = ? AND student_id = ? ORDER BY completed_at DESC LIMIT 1'
        ).bind(results[i].id, studentId).first();
        results[i].last_score = attempt ? Math.round((attempt.score / 100) * 100) : null;
      }
    }

    // جلب سجل المحاولات
    let history = [];
    if (studentId) {
      const histResult = await db.prepare(
        'SELECT ea.*, e.title as exam_title FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id WHERE ea.student_id = ? ORDER BY ea.completed_at DESC LIMIT 10'
      ).bind(studentId).all();
      history = histResult.results;
    }

    return jsonResponse({ exams: results, history });
  } catch (e) {
    return errorResponse('خطأ في تحميل الاختبارات: ' + e.message, 500);
  }
}

/** GET /api/exam/:id/questions - أسئلة اختبار */
async function handleGetExamQuestions(request, env, examId) {
  try {
    const db = env.DB;
    const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first();

    if (!exam) return errorResponse('الاختبار غير موجود');

    let questions;
    try {
      questions = JSON.parse(exam.questions);
    } catch {
      questions = [];
    }

    return jsonResponse({ exam, questions });
  } catch (e) {
    return errorResponse('خطأ في تحميل الأسئلة: ' + e.message, 500);
  }
}

/** POST /api/exam/submit - تسليم اختبار */
async function handleExamSubmit(request, env) {
  try {
    const body = await request.json();
    const { student_id, exam_id, answers } = body;

    if (!student_id || !exam_id || !answers) {
      return errorResponse('بيانات غير مكتملة');
    }

    const db = env.DB;
    const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').bind(exam_id).first();
    if (!exam) return errorResponse('الاختبار غير موجود');

    let questions;
    try {
      questions = JSON.parse(exam.questions);
    } catch {
      return errorResponse('خطأ في بيانات الاختبار');
    }

    // حساب النتيجة
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].answer) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);

    // حفظ المحاولة
    await db.prepare(
      'INSERT INTO exam_attempts (student_id, exam_id, score, answers, completed_at) VALUES (?, ?, ?, ?, datetime("now"))'
    ).bind(student_id, exam_id, score, JSON.stringify(answers)).run();

    return jsonResponse({ score, correct, total: questions.length });
  } catch (e) {
    return errorResponse('خطأ في تسليم الاختبار: ' + e.message, 500);
  }
}

/** POST /api/upload - رفع صورة (للمدير) */
async function handleUpload(request, env) {
  try {
    // التحقق من مفتاح المدير
    const adminKey = request.headers.get('X-Admin-Key');
    if (adminKey !== (env.ADMIN_SECRET || 'admin123')) {
      return errorResponse('غير مصرح', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return errorResponse('لا يوجد ملف مرفق');
    }

    const key = 'activities/' + Date.now() + '-' + file.name;
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    return jsonResponse({ key, message: 'تم رفع الصورة بنجاح' });
  } catch (e) {
    return errorResponse('فشل رفع الصورة: ' + e.message, 500);
  }
}

/** GET /api/images/:key - جلب صورة من R2 */
async function handleGetImage(request, env, key) {
  try {
    const object = await env.BUCKET.get(key);
    if (!object) {
      // إرجاع SVG عنصر نائب
      return new Response(placeholderSVG('صورة النشاط'), {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Content-Disposition', 'inline');

    return new Response(object.body, { headers });
  } catch (e) {
    return new Response(placeholderSVG('خطأ'), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
    });
  }
}

// ============================================================
// الموجّه الرئيسي (Router)
// ============================================================
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // التعامل مع طلبات OPTIONS (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // ===== ملفات ثابتة =====

  // PWA Manifest
  if (path === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', ...corsHeaders() },
    });
  }

  // Service Worker
  if (path === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  // أيقونة التطبيق
  if (path === '/api/icon') {
    return new Response(getAppIcon(), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  // ===== API Routes =====

  // تسجيل الدخول
  if (path === '/api/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  // تسجيل الخروج
  if (path === '/api/logout' && request.method === 'POST') {
    return handleLogout(request);
  }

  // جدول الحصص
  if (path === '/api/schedule' && request.method === 'GET') {
    return handleGetSchedule(request, env);
  }

  // الدرجات
  if (path === '/api/grades' && request.method === 'GET') {
    return handleGetGrades(request, env);
  }

  // الأنشطة
  if (path === '/api/activities' && request.method === 'GET') {
    return handleGetActivities(request, env);
  }

  // تسجيلاتي في الأنشطة
  if (path === '/api/activities/my-registrations' && request.method === 'GET') {
    return handleMyRegistrations(request, env);
  }

  // تسجيل في نشاط
  if (path === '/api/activities/register' && request.method === 'POST') {
    return handleRegisterActivity(request, env);
  }

  // الاختبارات
  if (path === '/api/exams' && request.method === 'GET') {
    return handleGetExams(request, env);
  }

  // أسئلة اختبار: /api/exam/:id/questions
  const examQuestionsMatch = path.match(/^\/api\/exam\/(\d+)\/questions$/);
  if (examQuestionsMatch && request.method === 'GET') {
    return handleGetExamQuestions(request, env, examQuestionsMatch[1]);
  }

  // تسليم اختبار
  if (path === '/api/exam/submit' && request.method === 'POST') {
    return handleExamSubmit(request, env);
  }

  // رفع صورة
  if (path === '/api/upload' && request.method === 'POST') {
    return handleUpload(request, env);
  }

  // جلب صورة من R2: /api/images/:key
  const imageMatch = path.match(/^\/api\/images\/(.+)$/);
  if (imageMatch && request.method === 'GET') {
    return handleGetImage(request, env, imageMatch[1]);
  }

  // ===== الصفحة الرئيسية (SPA) =====

  // التحقق من الجلسة الموجودة
  let user = null;
  const token = getCookieValue(request, 'token');
  if (token) {
    user = await verifyToken(token, env.JWT_SECRET || 'default-secret');
  }

  return htmlResponse(getHTML(user));
}

// ============================================================
// تصدير Worker
// ============================================================
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
