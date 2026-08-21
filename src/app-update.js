import { useEffect } from 'react';

const VERSION_URL = '/version.json';
const POLL_MS = 3 * 60 * 1000; // 3 minutes
const RELOAD_DELAY_MS = 2500;
const BANNER_RELOAD_DELAY_MS = 3500;

async function fetchDeployedVersion() {
  const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.version) return null;
  return {
    version: String(data.version),
    major: data.major === true,
  };
}

/** 7:00 AM – 11:59 PM IST (inclusive) */
export function isScanvDaytimeIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const total = hour * 60 + minute;
  return total >= 7 * 60 && total <= 23 * 60 + 59;
}

function showUpdateBanner() {
  if (document.getElementById('scanv-update-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'scanv-update-banner';
  bar.setAttribute('role', 'status');
  bar.textContent = 'ScanV updated — refreshing…';
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '99999',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #007a4d 0%, #00a86b 100%)',
    color: '#fff',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '14px',
    fontWeight: '700',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    letterSpacing: '0.02em',
  });
  document.body.prepend(bar);
}

function scheduleReload(reason, { showBanner = false } = {}) {
  if (sessionStorage.getItem('scanv_reload_pending') === '1') return;
  sessionStorage.setItem('scanv_reload_pending', '1');
  if (showBanner) showUpdateBanner();
  const delay = showBanner ? BANNER_RELOAD_DELAY_MS : RELOAD_DELAY_MS;
  console.log('[ScanV] App update detected — reloading:', reason, showBanner ? '(banner)' : '(silent)');
  setTimeout(() => {
    window.location.reload();
  }, delay);
}

function listenForServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return undefined;

  if (navigator.serviceWorker.controller) {
    sessionStorage.setItem('scanv_had_sw_controller', '1');
  }

  const onControllerChange = () => {
    if (sessionStorage.getItem('scanv_had_sw_controller') === '1') {
      scheduleReload('service-worker');
      return;
    }
    sessionStorage.setItem('scanv_had_sw_controller', '1');
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  navigator.serviceWorker.ready.then((reg) => {
    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener('statechange', () => {
        if (next.state === 'installed' && navigator.serviceWorker.controller) {
          next.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }).catch(() => {});

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  };
}

/** Poll version.json; reload when a new build is deployed. Major + daytime IST → banner. */
export function useAppUpdateCheck() {
  useEffect(() => {
    let cancelled = false;
    let knownVersion = null;

    const check = async () => {
      try {
        const remote = await fetchDeployedVersion();
        if (cancelled || !remote) return;
        if (knownVersion == null) {
          knownVersion = remote.version;
          return;
        }
        if (remote.version !== knownVersion) {
          const showBanner = remote.major && isScanvDaytimeIST();
          scheduleReload(remote.version, { showBanner });
        }
      } catch (_) { /* offline / transient */ }
    };

    check();
    const poll = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const cleanupSw = listenForServiceWorkerUpdates();

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      cleanupSw?.();
    };
  }, []);
}
