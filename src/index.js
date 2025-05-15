import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

// 1. تعيين عنوان الصفحة
document.title = "TimeCapsule";

// 2. مسح ذاكرة التخزين المؤقت القديمة
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      caches.delete(cacheName);
    });
  });
}

// 3. تصيير التطبيق مع إعدادات المسار الصحيحة
ReactDOM.render(دا
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

// 4. إدارة Service Worker
serviceWorkerRegistration.unregister();

// 5. إعدادات Web Vitals
reportWebVitals();

// 6. إصلاح مسارات GitHub Pages
if (process.env.NODE_ENV === 'production') {
  const baseUrl = '/frist-1';
  if (!window.location.pathname.startsWith(baseUrl)) {
    window.history.replaceState('', '', baseUrl + window.location.pathname);
  }
}