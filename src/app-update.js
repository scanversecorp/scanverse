import { useEffect } from 'react';

const VERSION_URL = '/version.json';
const POLL_MS = 3 * 60 * 1000; // 3 minutes
const RELOAD_DELAY_MS = 2500;

async function fetchDeployedVersion() {
  const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.version ? String(data.version) : null;
}

function scheduleReload(reason) {
  if (sessionStorage.getItem('scanv_reload_pending') === '1') return;
  sessionStorage.setItem('scanv_reload_pending', '1');
  console.log('[ScanV] App update detected — reloading:', reason);
  setTimeout(() => {
    window.location.reload();
  }, RELOAD_DELAY_MS);
}

function listenForServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return undefined;

  const onControllerChange = () => {
    scheduleReload('service-worker');
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

/** Poll version.json and reload when a new build is deployed. */
export function useAppUpdateCheck() {
  useEffect(() => {
    let cancelled = false;
    let knownVersion = null;

    const check = async () => {
      try {
        const remote = await fetchDeployedVersion();
        if (cancelled || !remote) return;
        if (knownVersion == null) {
          knownVersion = remote;
          return;
        }
        if (remote !== knownVersion) scheduleReload(remote);
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
