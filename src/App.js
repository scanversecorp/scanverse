/**
 * ScanV v5.5 -- Daylight Trust UI
 * DCORE Global Corporation - PCMC, Pune
 * URL: https://scanv-tau.vercel.app
 * Daylight Trust: #f2efe8 · #d63a56 · Android-first
 *
 * OTP FIX: Using Fast2SMS (India, free tier) directly from client
 * + Supabase email OTP fallback + manual email entry fallback
 *
 * QR SCAN: Captures maximum device/user data on scan before registration
 */

import {
  useState, useEffect, useRef, useCallback,
  createContext, useContext, useReducer, Component
} from 'react';
/* --- CONFIG ------------------------------------------------------- */
const SB_URL   = 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY   = 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const APP_URL  = 'https://scanv-tau.vercel.app';
const RZP_URL  = 'https://rzp.io/rzp/QEuXj4E';
const RZP_BUTTON_ID = 'pl_TORikAHmO4yfg5';
const UPI_PA   = 'vyapar.172928067841@hdfcbank';
const UPI_PN   = 'DCORE GLOBAL CORPORATION';
const ASSIST   = '+91-9270194842';

const UPI_PACKAGES = {
  GPay: 'com.google.android.apps.nbu.paisa.user',
  PhonePe: 'com.phonepe.app',
  Paytm: 'net.one97.paytm',
  Navi: 'com.naviapp',
  BHIM: 'in.org.npci.upiapp',
};

const UPI_APPS = [
  ['🟢', 'GPay'],
  ['🟣', 'PhonePe'],
  ['🔵', 'Paytm'],
  ['🟠', 'Navi'],
  ['🇮🇳', 'BHIM'],
  ['⚡', 'Any UPI'],
];

/** @wahdfcbank / @wa* handles are WhatsApp Pay only — GPay/PhonePe always route to WhatsApp */
function isWhatsAppOnlyVpa(vpa = UPI_PA) {
  return /@wa/i.test(vpa);
}

function isAndroidUA() { return /Android/i.test(navigator.userAgent); }
function isIOSUA() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /WhatsApp/i.test(ua) || /FBAN|FBAV/i.test(ua) || /Instagram/i.test(ua);
}
function buildUpiParams(amountPaise, txnRef, note) {
  const sp = new URLSearchParams();
  sp.set('pa', UPI_PA);
  sp.set('pn', UPI_PN);
  if (amountPaise) sp.set('am', (amountPaise / 100).toFixed(2));
  sp.set('cu', 'INR');
  if (note) sp.set('tn', note);
  return sp.toString();
}
function buildUpiLink(amountPaise, txnRef, note) {
  return `upi://pay?${buildUpiParams(amountPaise, txnRef, note)}`;
}
/** Android Chrome: force target app via Intent scheme (bypasses WhatsApp default handler) */
function buildAndroidIntent(params, pkg) {
  return `intent://pay?${params}#Intent;scheme=upi;package=${pkg};end`;
}
/** iOS: app-specific URL schemes (Android intents do not work on iOS) */
function buildIOSAppLink(app, params) {
  if (app === 'GPay') return `gpay://upi/pay?${params}`;
  if (app === 'PhonePe') return `phonepe://upi/pay?${params}`;
  if (app === 'Paytm') return `paytmmp://pay?${params}`;
  if (app === 'BHIM') return `bhim://upi/pay?${params}`;
  if (app === 'Navi') return `upi://pay?${params}`;
  return `upi://pay?${params}`;
}
function buildAppPayUrl(app, amountPaise, txnRef, note) {
  const params = buildUpiParams(amountPaise, txnRef, note);
  if (isAndroidUA()) {
    const pkg = UPI_PACKAGES[app];
    if (!pkg) return null;
    return buildAndroidIntent(params, pkg);
  }
  if (isIOSUA()) {
    return buildIOSAppLink(app, params);
  }
  return `upi://pay?${params}`;
}
/** Open URL via hidden anchor — avoids WhatsApp intercept from window.location on intent:// */
function openUrlViaAnchor(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
/**
 * Open UPI app — Android Intent per app (Chrome), iOS custom schemes, desktop fallback upi://
 */
function openUpiPay(app, amountPaise, txnRef, note) {
  if (isWhatsAppOnlyVpa()) return false;
  if (isAndroidUA() && app === 'Any UPI') return false;
  const url = buildAppPayUrl(app, amountPaise, txnRef, note || 'ScanV Booking');
  if (!url) return false;
  openUrlViaAnchor(url);
  return true;
}
function InAppBrowserBanner({ addToast }) {
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      addToast?.('Link copied — paste in Chrome or Safari', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      addToast?.('Copy failed — select URL manually', 'error');
    }
  };
  return (
    <div style={{ background: '#fff3cd', border: '2px solid #ffc107', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#856404', marginBottom: 6 }}>⚠️ UPI won&apos;t work inside WhatsApp</div>
      <div style={{ fontSize: 12, color: '#664d03', lineHeight: 1.5, marginBottom: 10 }}>
        Tap ⋮ → <strong>Open in Chrome</strong> (Android) or <strong>Safari</strong> (iPhone), then pay again.
      </div>
      <div style={{ fontSize: 11, color: '#664d03', marginBottom: 10 }}>
        Or copy your UPI ID below and pay manually in any UPI app.
      </div>
      <button type="button" onClick={copyLink} style={{ background: '#856404', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
        {copied ? 'Link copied ✓' : 'Copy link to open in browser'}
      </button>
    </div>
  );
}
function UpiPickerModal({ onPick, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: C.surf, borderRadius: '16px 16px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, textAlign: 'center', marginBottom: 6 }}>Pick your UPI app</div>
        <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', marginBottom: 16 }}>Opens the app directly on your phone</div>
        {UPI_APPS.filter(([, lbl]) => lbl !== 'Any UPI').map(([ic, lbl]) => (
          <button key={lbl} type="button" onClick={() => onPick(lbl)} style={{ display: 'flex', alignItems: 'center', gap: 14, ...S.card(), padding: '16px 18px', cursor: 'pointer', background: C.card, border: BDR, width: '100%', textAlign: 'left', marginBottom: 10 }}>
            <span style={{ fontSize: 28 }}>{ic}</span>
            <span style={{ color: C.txt, fontSize: 16, fontWeight: 700 }}>{lbl}</span>
          </button>
        ))}
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'block', margin: '4px auto 0' }}>Cancel</button>
      </div>
    </div>
  );
}
function RazorpayPayButton({ onInteract }) {
  const formRef = useRef(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form || form.querySelector('script[data-payment_button_id]')) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.setAttribute('data-payment_button_id', RZP_BUTTON_ID);
    form.appendChild(script);
    const mark = () => onInteract?.();
    form.addEventListener('click', mark);
    return () => {
      form.removeEventListener('click', mark);
      script.remove();
    };
  }, [onInteract]);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 10, textAlign: 'center' }}>Or pay via Razorpay</div>
      <form ref={formRef} style={{ display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}
function UpiPaymentPanel({ pay, addToast, onConfirm, loading, disabled }) {
  const { paymentVerified, upiOpened, checkingPay, launchUpi, showUpiPicker, setShowUpiPicker, launchUpiDirect, setUpiOpened, amountPaise, txnId } = pay;
  const inApp = isInAppBrowser();
  const amountRu = amountPaise ? (amountPaise / 100).toFixed(0) : '0';
  return (
    <>
      {inApp && <InAppBrowserBanner addToast={addToast} />}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>Pay now</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: C.acc, fontFamily: FF }}>₹{amountRu}</div>
        {txnId && <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Ref: {txnId}</div>}
      </div>
      <UpiVpaCopy addToast={addToast} />
      <Btn full onClick={() => launchUpi('Any UPI')} disabled={inApp} style={{ marginBottom: 14, boxShadow: inApp ? 'none' : '0 4px 16px rgba(214,58,86,0.35)', opacity: inApp ? 0.5 : 1 }}>
        💳 Pay via UPI →
      </Btn>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {UPI_APPS.map(([ic, lbl]) => (
          <button key={lbl} type="button" onClick={() => launchUpi(lbl)} disabled={inApp} style={{ display: 'flex', alignItems: 'center', gap: 10, ...S.card(), padding: '12px 14px', cursor: inApp ? 'not-allowed' : 'pointer', background: C.card, border: BDR, width: '100%', textAlign: 'left', opacity: inApp ? 0.5 : 1 }}>
            <span style={{ fontSize: 22 }}>{ic}</span>
            <span style={{ color: C.txt, fontSize: 13, fontWeight: 700 }}>{lbl}</span>
          </button>
        ))}
      </div>
      {inApp && (
        <div style={{ fontSize: 11, color: C.dim, textAlign: 'center', marginBottom: 14 }}>Open in Chrome/Safari to launch UPI apps</div>
      )}
      <RazorpayPayButton onInteract={() => setUpiOpened(true)} />
      {upiOpened && !paymentVerified && (
        <div style={{ background: '#fff8e6', border: `1.5px solid rgba(184,134,11,0.35)`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: C.gold, fontWeight: 700 }}>
          {checkingPay ? '⏳ Checking payment status…' : 'Complete payment in your UPI app, then tap I\'ve paid — continue'}
        </div>
      )}
      {paymentVerified && (
        <div style={{ background: '#e6f4ee', border: `1.5px solid rgba(0,122,77,0.35)`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: C.grn, fontWeight: 700 }}>
          ✅ Payment confirmed — you can continue
        </div>
      )}
      <Btn full onClick={onConfirm} disabled={loading || disabled || (!upiOpened && !paymentVerified)}>
        {paymentVerified ? '✅ Payment confirmed — continue →' : upiOpened ? 'I\'ve paid — continue →' : 'Pay via UPI or Razorpay first'}
      </Btn>
      {showUpiPicker && (
        <UpiPickerModal onPick={launchUpiDirect} onClose={() => setShowUpiPicker(false)} />
      )}
    </>
  );
}
function UpiVpaCopy({ addToast }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(UPI_PA);
      setCopied(true);
      addToast?.('UPI ID copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      addToast?.('Copy failed — select manually', 'error');
    }
  };
  return (
    <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 11, color: C.dim }}>
      <span>Pay to: </span>
      <span style={{ fontWeight: 700, color: C.sub, fontFamily: 'monospace' }}>{UPI_PA}</span>
      <button type="button" onClick={copy} style={{ marginLeft: 8, background: 'none', border: `1px solid ${C.bdr}`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: C.cyan, cursor: 'pointer' }}>
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}
async function registerPaymentIntent(txnId, amountPaise, userId) {
  if (!txnId || !amountPaise) return;
  try {
    await sb().functions.invoke('razorpay-payment', { body: { action: 'register', txn_id: txnId, amount_paise: amountPaise, user_id: userId || null } });
  } catch (_) {
    try {
      await sb().from('payment_intents').upsert({ txn_id: txnId, amount_paise: amountPaise, user_id: userId || null, status: 'pending' }, { onConflict: 'txn_id', ignoreDuplicates: true });
    } catch (_2) {}
  }
}
async function checkPaymentVerified(txnId) {
  if (!txnId) return false;
  try {
    const r = await sb().functions.invoke('razorpay-payment', { body: { action: 'check', txn_id: txnId } });
    if (r.data?.verified) return true;
  } catch (_) {}
  try {
    const { data } = await sb().from('payment_intents').select('status').eq('txn_id', txnId).maybeSingle();
    return data?.status === 'paid';
  } catch (_) { return false; }
}
function usePaymentVerification(txnId, amountPaise, userId, addToast) {
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [upiOpened, setUpiOpened] = useState(false);
  const [checkingPay, setCheckingPay] = useState(false);
  const [showUpiPicker, setShowUpiPicker] = useState(false);
  useEffect(() => {
    if (!txnId || !amountPaise) return;
    registerPaymentIntent(txnId, amountPaise, userId);
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === txnId && params.get('razorpay_payment_link_status') === 'paid') {
      setPaymentVerified(true);
      setUpiOpened(true);
    }
  }, [txnId, amountPaise, userId]);
  useEffect(() => {
    if (!upiOpened || !txnId || paymentVerified) return;
    let cancelled = false;
    const poll = async () => {
      setCheckingPay(true);
      const ok = await checkPaymentVerified(txnId);
      if (!cancelled && ok) {
        setPaymentVerified(true);
        addToast?.('Payment confirmed ✓', 'success');
      }
      if (!cancelled) setCheckingPay(false);
    };
    poll();
    const id = setInterval(poll, 3000);
    const onVis = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [upiOpened, txnId, paymentVerified, addToast]);
  const triggerUpi = (app) => {
    if (isInAppBrowser()) {
      addToast?.('Open in Chrome or Safari to pay via UPI', 'error');
      return;
    }
    if (isWhatsAppOnlyVpa()) {
      addToast?.('This UPI ID is WhatsApp Pay only — use Razorpay below', 'error');
      return;
    }
    if (openUpiPay(app, amountPaise, txnId, 'ScanV Booking')) {
      setUpiOpened(true);
      addToast?.('Opening UPI app…', 'info');
    }
  };
  const launchUpi = (app) => {
    if (isInAppBrowser()) {
      addToast?.('Open in Chrome or Safari to pay via UPI', 'error');
      return;
    }
    if (app === 'Any UPI') {
      if (isAndroidUA()) {
        setShowUpiPicker(true);
        return;
      }
      triggerUpi('Any UPI');
      return;
    }
    triggerUpi(app);
  };
  const launchUpiDirect = (app) => {
    setShowUpiPicker(false);
    triggerUpi(app);
  };
  return {
    paymentVerified, upiOpened, checkingPay, launchUpi, launchUpiDirect,
    showUpiPicker, setShowUpiPicker, setPaymentVerified, setUpiOpened,
    amountPaise, txnId,
  };
}
const FEE_PCT  = 0.10;
const GST_RATE = 0.18;

/* --- DESIGN TOKENS · Daylight Trust -------------------------------- */
const C = {
  bg:'#f2efe8', surf:'#fffcf8', card:'#fffcf8', deep:'#ebe6dc',
  acc:'#d63a56', cyan:'#0d47a1', gold:'#b8860b',
  grn:'#007a4d', red:'#c62828', vio:'#7c3aed',
  txt:'#121212', sub:'#3d4f5f', dim:'#5c6b7a',
  bdr:'rgba(18,18,18,0.14)', gls:'rgba(18,18,18,0.04)',
};
const FF = "'Inter',system-ui,sans-serif";
const BDR = `1.5px solid ${C.bdr}`;
const SVC_SHORT = { legal:'Legal', cloud:'Cloud', vip:'VIP', health:'Health', property:'Property', household:'Household', delivery:'Delivery', food:'Food', 'two-wheeler':'2-Wheeler', 'four-wheeler':'4-Wheeler' };

const DISC_PCT = 0.25;
const discPaise = (mrpPaise) => Math.round(mrpPaise * (1 - DISC_PCT));
const fmtRs = (paise) => (paise / 100).toLocaleString('en-IN');
const svcDisc = (mrpRupees) => ({ mrp: mrpRupees * 100, price: discPaise(mrpRupees * 100) });

/** ScanV household card themes — user-facing only. fulfillVia is backend routing (not shown in UI). */
const HH_THEME = {
  pink: { id:'pink', label:'Deep cleaning', color:'#F472B6', bg:'#FFF1F5', border:'#FBCFE8', gradFrom:'#FFD6E8', gradTo:'#F9A8D4', tagline:'Professional deep clean · supplies included' },
  green:{ id:'green', label:'Home help', color:'#34D399', bg:'#ECFDF5', border:'#A7F3D0', gradFrom:'#D1FAE5', gradTo:'#86EFAC', tagline:'Verified help · hourly · flexible booking' },
};

/* --- HOUSEHOLD SUB-SERVICES (ScanV-branded; fulfillVia routes backend later) --- */
const HOUSEHOLD_SVCS = [
  { id:'hh-bathroom-deep', parent:'household', theme:'pink', fulfillVia:'x', icon:'🚿', img:'/services/bathroom-deep.png', name:'Bathroom Deep Clean', sub:'Deep scrub · sanitise · 45–60 min', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV bathroom deep clean — tiles, WC, taps, mirrors & exhaust fan. Eco-friendly products, background-verified professionals, satisfaction guaranteed.',
    features:['WC & basin deep scrub','Tile & grout cleaning','Mirror & tap polish','Exhaust fan wipe','Re-clean if not satisfied'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'5,000+' },
  { id:'hh-kitchen-deep', parent:'household', theme:'pink', fulfillVia:'x', icon:'🍳', img:'/services/kitchen-deep.png', name:'Kitchen Deep Clean', sub:'Counters · chimney · floor · grease', unit:'visit', mrp:59900, price:discPaise(59900), cash:false,
    desc:'ScanV kitchen deep clean — counters, chimney exterior, cabinets, sink & floor. All supplies included, verified professionals across Pune & PCMC.',
    features:['Counter & cabinet wipe','Chimney exterior clean','Sink & tap descale','Floor mop & degrease','Eco-friendly products'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'3,200+' },
  { id:'hh-flat-clean', parent:'household', theme:'pink', fulfillVia:'x', icon:'🏠', img:'/services/flat-clean.png', name:'Full Flat Cleaning', sub:'Complete home · 1–3 BHK · 3–5 hrs', unit:'visit', mrp:199900, price:discPaise(199900), cash:false,
    desc:'Complete flat cleaning through ScanV — every room, kitchen & bathroom. Ideal for move-in, festival prep or monthly deep clean.',
    features:['All rooms dust & mop','Kitchen + bathroom included','Balcony sweep','Furniture wipe-down','Team of 2 for 2BHK+'], turnaround:'24–48 hrs', rating:'4.9 ⭐', bookings:'2,100+' },
  { id:'hh-care-plan', parent:'household', theme:'pink', fulfillVia:'x', icon:'📅', img:'/services/care-plan.png', name:'Bathroom Care Plan', sub:'Weekly / fortnightly · fixed slot', unit:'month', mrp:149900, price:discPaise(149900), cash:false,
    desc:'ScanV recurring bathroom care — hassle-free scheduled cleaning without rebooking every time. Same trusted professional, fixed slot.',
    features:['4 visits per month','Fixed day & time slot','Same professional','Priority rescheduling','Save vs one-time booking'], turnaround:'Starts in 48 hrs', rating:'4.8 ⭐', bookings:'890+' },
  { id:'hh-quick-clean', parent:'household', theme:'pink', fulfillVia:'x', icon:'✨', img:'/services/quick-clean.png', name:'Quick Clean', sub:'Single task · bathroom · fan · 30 min', unit:'visit', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV quick clean — affordable single-task service for one bathroom, fan or appliance. Perfect when you need just one thing done fast.',
    features:['Single bathroom refresh','Fan / exhaust wipe','Appliance exterior','30-min visit','Best-value quick booking'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'4,400+' },
  { id:'hh-sofa-clean', parent:'household', theme:'pink', fulfillVia:'x', icon:'🛋️', img:'/services/sofa-clean.png', name:'Sofa & Upholstery Clean', sub:'Fabric · cushions · stain treatment · 1–2 hrs', unit:'visit', mrp:24900, price:discPaise(24900), cash:false,
    desc:'ScanV sofa & upholstery deep clean — fabric-safe shampoo, cushion refresh, and stain treatment for sofas, chairs, and dining seats. Ideal before guests or after monsoon.',
    features:['Fabric-safe shampoo','Cushion & armrest clean','Stain spot treatment','Quick-dry method','All supplies included'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'1,600+' },
  { id:'hh-house-help', parent:'household', theme:'green', fulfillVia:'s', icon:'🏡', img:'/services/house-help.png', name:'House Help', sub:'Sweep · mop · dust · multi-task · hourly', unit:'hour', mrp:18200, price:discPaise(18200), cash:false,
    desc:'ScanV house help — trained, background-verified experts for sweeping, mopping, dusting, dishes & more. Book by the hour, instant or scheduled.',
    features:['Background verified experts','Professional training','Hourly — book 1–4 hrs','Instant or scheduled','Flexible tasks in one visit'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'12,000+' },
  { id:'hh-dishwashing', parent:'household', theme:'green', fulfillVia:'s', icon:'🍽️', img:'/services/dishwashing.png', name:'Dishwashing', sub:'Utensils · sink · platform wipe', unit:'hour', mrp:9900, price:discPaise(9900), cash:false,
    desc:'ScanV dishwashing help — sink, utensils & platform cleaned efficiently. Hourly booking, transparent pricing, verified professionals.',
    features:['All utensils washed','Sink & platform clean','Supplies included','Hourly booking','Trusted ScanV partners'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'8,000+' },
  { id:'hh-kitchen-help', parent:'household', theme:'green', fulfillVia:'s', icon:'🧽', img:'/services/kitchen-help.png', name:'Kitchen Tidy-Up', sub:'Platform · tiles · chimney wipe', unit:'hour', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV kitchen tidy-up — platform, tiles, chimney exterior & sink within your booked hours. No contracts, cancel anytime before the slot.',
    features:['Platform & tile wipe','Chimney exterior','Sink clean','Cabinet exterior dust','Transparent hourly rate'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'4,500+' },
  { id:'hh-fan-clean', parent:'household', theme:'green', fulfillVia:'s', icon:'🌀', img:'/services/fan-clean.png', name:'Fan Cleaning', sub:'Ceiling fan · blades · reachable only', unit:'visit', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV fan cleaning — blade wipe & dust removal for reachable ceiling fans. Safe service — no ladder or height work.',
    features:['Blade dust & wipe','Cover clean','Safe reachable access','Add to hourly booking','No ladder tasks'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'2,200+' },
  { id:'hh-window-clean', parent:'household', theme:'green', fulfillVia:'s', icon:'🪟', img:'/services/window-clean.png', name:'Window Cleaning', sub:'Glass · frames · inside only', unit:'visit', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV window cleaning — glass & frame wipe for accessible windows inside your home. Streak-free finish by trained experts.',
    features:['Glass wipe inside','Frame & sill clean','Reachable windows only','Streak-free finish','Bundle with house help'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'1,800+' },
  { id:'hh-laundry', parent:'household', theme:'green', fulfillVia:'s', icon:'👕', img:'/services/laundry.png', name:'Laundry Help', sub:'Fold · sort · organise wardrobe', unit:'hour', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV laundry help — folding, sorting & organising clean clothes. Washing machine operation or ironing by separate agreement.',
    features:['Fold clean laundry','Sort by type/colour','Wardrobe organise','Bed linen change','Hourly booking'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'3,500+' },
  { id:'hh-bathroom-help', parent:'household', theme:'green', fulfillVia:'s', icon:'🛁', img:'/services/bathroom-help.png', name:'Bathroom Refresh', sub:'WC · floor · taps · hourly', unit:'hour', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV bathroom refresh — WC, floor, taps & mirror within booked hours. Ideal for quick upkeep — book 1–2 hours.',
    features:['WC & floor clean','Tap & mirror wipe','Bucket & mug rinse','Hourly scope','Verified ScanV partners'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'5,200+' },
  { id:'hh-ironing', parent:'household', theme:'green', fulfillVia:'s', icon:'👔', img:'/services/ironing.png', name:'Ironing & Pressing', sub:'Shirts · sarees · formals · hourly', unit:'hour', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV ironing help — crisp pressing for office wear, sarees, and daily clothes at home. Book by the hour with your iron or ours.',
    features:['Shirt & trouser press','Saree & kurta care','Steam finish','Hourly booking','Neat folding included'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'2,900+' },
];

/** ScanV cloud card themes — hosting, infrastructure, managed */
const CL_THEME = {
  host:  { id:'host',  label:'Cloud hosting',    color:'#2563EB', bg:'#DBEAFE', border:'#93C5FD', gradFrom:'#BFDBFE', gradTo:'#60A5FA', tagline:'IaaS · PaaS · SaaS · hybrid models' },
  build: { id:'build', label:'Infrastructure',   color:'#6366F1', bg:'#EEF2FF', border:'#A5B4FC', gradFrom:'#E0E7FF', gradTo:'#818CF8', tagline:'Design · deploy · enterprise supply' },
  care:  { id:'care',  label:'Managed & media',  color:'#0891B2', bg:'#CFFAFE', border:'#67E8F9', gradFrom:'#A5F3FC', gradTo:'#22D3EE', tagline:'24×7 ops · backup · streaming · training' },
  pack:  { id:'pack',  label:'Turnkey packages', color:'#7C3AED', bg:'#F3E8FF', border:'#C4B5FD', gradFrom:'#EDE9FE', gradTo:'#A78BFA', tagline:'Ready bundles · faster go-live · one partner' },
};

const CLOUD_SVCS = [
  { id:'cl-iaas', parent:'cloud', theme:'host', icon:'🖥️', img:'/services/cloud/iaas.png', name:'Cloud Compute (IaaS)', sub:'Virtual servers · storage · scale on demand', unit:'month', mrp:999900, price:discPaise(999900), cash:false,
    desc:'ScanV infrastructure-as-a-service — provision virtual machines, block storage, and networking without owning hardware. Scale up or down as your workload changes, with monitoring and SLA-backed uptime.',
    features:['Virtual servers & volumes','Auto-scale options','Private network segments','Usage-based billing','99.9% uptime SLA'], turnaround:'Live in 24 hrs', rating:'4.9 ⭐', bookings:'620+' },
  { id:'cl-paas', parent:'cloud', theme:'host', icon:'⚙️', img:'/services/cloud/paas.png', name:'App Platform (PaaS)', sub:'Deploy apps · skip server management', unit:'month', mrp:799900, price:discPaise(799900), cash:false,
    desc:'ScanV platform-as-a-service — push code, containers, or APIs and we handle the runtime, patches, and scaling. Ideal for startups and product teams that want speed without ops overhead.',
    features:['Container & app hosting','CI/CD ready pipelines','Managed databases add-on','Staging & production slots','DevSecOps best practices'], turnaround:'Live in 48 hrs', rating:'4.8 ⭐', bookings:'410+' },
  { id:'cl-saas', parent:'cloud', theme:'host', icon:'📱', img:'/services/cloud/saas.png', name:'Business Apps (SaaS)', sub:'Ready software · subscribe & go', unit:'month', mrp:499900, price:discPaise(499900), cash:false,
    desc:'ScanV software-as-a-service — curated business tools delivered over the cloud with updates, backups, and support included. Pay per user or per module with transparent monthly pricing.',
    features:['Pre-configured business suites','Automatic updates & patches','Role-based access control','Mobile & web access','Onboarding assistance'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'890+' },
  { id:'cl-hybrid', parent:'cloud', theme:'host', icon:'🔀', img:'/services/cloud/hybrid.png', name:'Hybrid Cloud Setup', sub:'On-prem + cloud · unified control', unit:'project', mrp:1499900, price:discPaise(1499900), cash:false,
    desc:'ScanV hybrid cloud — connect your office or private rack with public cloud resources under one governance model. Perfect when compliance, latency, or legacy apps need a blended architecture.',
    features:['Architecture assessment','Secure VPN / interconnect','Workload placement plan','Migration roadmap','Unified monitoring'], turnaround:'1–2 weeks', rating:'4.9 ⭐', bookings:'280+' },
  { id:'cl-datacenter', parent:'cloud', theme:'build', icon:'🏢', img:'/services/cloud/datacenter.png', name:'Datacenter Consulting', sub:'Design · build · optimise facilities', unit:'project', mrp:4999900, price:discPaise(4999900), cash:false,
    desc:'ScanV datacenter consulting — from capacity planning and rack layout to power, cooling, and compliance documentation. We help you build or refresh facilities that are secure, efficient, and future-ready.',
    features:['Site & capacity planning','Rack & power design','Compliance documentation','Vendor-neutral advice','Handover runbooks'], turnaround:'2–4 weeks', rating:'4.9 ⭐', bookings:'150+' },
  { id:'cl-network', parent:'cloud', theme:'build', icon:'🌐', img:'/services/cloud/network.png', name:'Enterprise Networking', sub:'LAN · WAN · secure connectivity', unit:'project', mrp:2999900, price:discPaise(2999900), cash:false,
    desc:'ScanV enterprise networking — structured cabling, switching, routing, Wi‑Fi, and WAN links designed for reliability. We segment traffic, enforce policies, and document every connection for your team.',
    features:['Office LAN / Wi‑Fi design','Firewall & segmentation','VPN & remote access','Performance tuning','As-built documentation'], turnaround:'1–3 weeks', rating:'4.8 ⭐', bookings:'340+' },
  { id:'cl-hardware', parent:'cloud', theme:'build', icon:'💻', img:'/services/cloud/hardware.png', name:'IT Hardware Supply', sub:'Servers · storage · laptops · networking', unit:'project', mrp:1999900, price:discPaise(1999900), cash:false,
    desc:'ScanV hardware supply — source, configure, and deliver enterprise servers, storage, switches, and end-user devices. Pre-staging and imaging available so equipment arrives ready to plug in.',
    features:['Enterprise-grade sourcing','Pre-config & imaging','Warranty registration','Delivery & rack-mount','Asset tagging'], turnaround:'3–7 days', rating:'4.7 ⭐', bookings:'520+' },
  { id:'cl-infra-audit', parent:'cloud', theme:'build', icon:'📋', img:'/services/cloud/infra-audit.png', name:'Infrastructure Audit & Roadmap', sub:'Assess · benchmark · 12-month upgrade plan', unit:'project', mrp:899900, price:discPaise(899900), cash:false,
    desc:'ScanV infrastructure audit — we review your servers, network, storage, and security posture, then deliver a prioritised roadmap with cost options. Ideal before expansion, compliance reviews, or cloud migration.',
    features:['On-site or remote assessment','Performance & risk report','Costed upgrade options','12-month phased roadmap','Executive presentation'], turnaround:'1–2 weeks', rating:'4.8 ⭐', bookings:'275+' },
  { id:'cl-managed', parent:'cloud', theme:'care', icon:'🛡️', img:'/services/cloud/managed.png', name:'Managed IT Services', sub:'24×7 monitoring · IAM · proactive ops', unit:'month', mrp:249900, price:discPaise(249900), cash:false,
    desc:'ScanV managed services — we watch your systems around the clock, patch vulnerabilities, manage identities, and respond to incidents before users notice. SLA-driven delivery with monthly health reports.',
    features:['24×7 monitoring & alerts','Patch & vulnerability mgmt','Identity & access reviews','Monthly health reports','Dedicated service desk'], turnaround:'Starts in 72 hrs', rating:'4.9 ⭐', bookings:'760+' },
  { id:'cl-backup', parent:'cloud', theme:'care', icon:'💾', img:'/services/cloud/backup.png', name:'Backup & Disaster Recovery', sub:'Snapshots · replication · restore drills', unit:'month', mrp:149900, price:discPaise(149900), cash:false,
    desc:'ScanV backup & DR — automated snapshots, off-site replication, and tested restore runbooks so a outage does not become a crisis. RPO/RTO targets agreed upfront and reviewed quarterly.',
    features:['Automated backup schedules','Off-site replication','Restore testing drills','RPO / RTO planning','Compliance-ready logs'], turnaround:'Live in 48 hrs', rating:'4.9 ⭐', bookings:'680+' },
  { id:'cl-video', parent:'cloud', theme:'care', icon:'🎬', img:'/services/cloud/video.png', name:'Video & Streaming Platform', sub:'Secure delivery · education · media', unit:'month', mrp:399900, price:discPaise(399900), cash:false,
    desc:'ScanV video platform — host lectures, webinars, or OTT-style libraries with adaptive streaming, access control, and usage analytics. White-label player options for institutes and creators.',
    features:['Adaptive bitrate streaming','Access control & DRM options','Viewer analytics','CDN-backed delivery','Embed & mobile apps'], turnaround:'1 week', rating:'4.8 ⭐', bookings:'290+' },
  { id:'cl-training', parent:'cloud', theme:'care', icon:'🎓', img:'/services/cloud/training.png', name:'Cloud & IT Training', sub:'Hands-on labs · certs · career tracks', unit:'course', mrp:499900, price:discPaise(499900), cash:false,
    desc:'ScanV cloud training — instructor-led and lab-based programmes covering cloud fundamentals, DevOps, networking, and security. Learn on live infrastructure, not slides alone.',
    features:['Live instructor sessions','Hands-on lab access','Certification pathways','Weekend & evening batches','Career guidance sessions'], turnaround:'Batch weekly', rating:'4.9 ⭐', bookings:'1,200+' },
  { id:'cl-office-box', parent:'cloud', theme:'pack', icon:'📦', img:'/services/cloud/office-box.png', name:'Office IT-in-a-Box', sub:'Desks · Wi‑Fi · PCs · phones · go-live ready', unit:'project', mrp:3499900, price:discPaise(3499900), cash:false,
    desc:'ScanV office-in-a-box — a pre-tested bundle that wires up your new branch or startup floor: cabling, Wi‑Fi, workstations, printers, and baseline security policies. Arrive Monday, work Tuesday.',
    features:['Structured cabling & Wi‑Fi','Workstation imaging','Firewall baseline config','User onboarding guide','30-day hypercare support'], turnaround:'5–10 days', rating:'4.9 ⭐', bookings:'190+' },
  { id:'cl-dc-operate', parent:'cloud', theme:'pack', icon:'🏗️', img:'/services/cloud/dc-operate.png', name:'Datacenter Build & Run', sub:'Design · rack · power · operate · handover', unit:'project', mrp:7999900, price:discPaise(7999900), cash:false,
    desc:'ScanV datacenter build & operate — we take you from empty floor to production-ready facility, then optionally run day-two ops. Capacity, cooling, security, and monitoring included in one programme.',
    features:['Facility & rack design','Power / cooling planning','Security & access layers','Monitoring from day one','Optional managed operate'], turnaround:'4–8 weeks', rating:'4.9 ⭐', bookings:'95+' },
  { id:'cl-dr-pack', parent:'cloud', theme:'pack', icon:'🔒', img:'/services/cloud/dr-pack.png', name:'Business Continuity Pack', sub:'Backup · failover · tested recovery playbooks', unit:'project', mrp:2499900, price:discPaise(2499900), cash:false,
    desc:'ScanV business continuity pack — a fixed-scope programme that maps critical apps, configures replication, and runs a live restore drill with your team. Know your RPO/RTO before an incident, not during one.',
    features:['Critical app inventory','Replication setup','Failover runbook','Quarterly restore test','Executive summary report'], turnaround:'2–3 weeks', rating:'4.9 ⭐', bookings:'210+' },
  { id:'cl-maas', parent:'cloud', theme:'pack', icon:'📊', img:'/services/cloud/maas.png', name:'Monitoring-as-a-Service', sub:'Dashboards · alerts · compliance views', unit:'month', mrp:199900, price:discPaise(199900), cash:false,
    desc:'ScanV monitoring-as-a-service — unified dashboards for servers, networks, apps, and cloud resources with alert routing and audit-friendly reports. We tune thresholds so on-call teams see signal, not noise.',
    features:['Unified metric dashboards','Smart alert routing','Uptime & SLA reports','Compliance export packs','Monthly tuning review'], turnaround:'Live in 72 hrs', rating:'4.8 ⭐', bookings:'430+' },
  { id:'cl-edtech', parent:'cloud', theme:'pack', icon:'📚', img:'/services/cloud/edtech-lms.png', name:'Learning Platform Pack', sub:'LMS · secure video · student portal', unit:'project', mrp:5999900, price:discPaise(5999900), cash:false,
    desc:'ScanV learning platform pack — launch classes online with course pages, assignments, secure lecture streaming, and parent or admin portals. Ideal for institutes moving from classroom-only to blended learning.',
    features:['Course & batch management','Secure lecture streaming','Quiz & assignment module','Admin & teacher roles','Mobile-friendly portal'], turnaround:'2–4 weeks', rating:'4.9 ⭐', bookings:'160+' },
  { id:'cl-ott-pack', parent:'cloud', theme:'pack', icon:'📺', img:'/services/cloud/ott-pack.png', name:'Streaming Platform Pack', sub:'Catalogue · player · CDN · monetisation ready', unit:'project', mrp:6999900, price:discPaise(6999900), cash:false,
    desc:'ScanV streaming platform pack — go from content library to branded viewer experience with adaptive playback, catalogue management, and subscription or pay-per-view options. Built for creators, studios, and niche OTT brands.',
    features:['Branded web & TV apps','Adaptive video delivery','Subscription / PPV setup','Content CMS & metadata','Launch & analytics training'], turnaround:'3–5 weeks', rating:'4.8 ⭐', bookings:'120+' },
];

/** ScanV legal card themes */
const LG_THEME = {
  counsel: { id:'counsel', label:'Consultation & court', color:'#6366F1', bg:'#EEF2FF', border:'#A5B4FC', gradFrom:'#E0E7FF', gradTo:'#818CF8', tagline:'Verified advocates · online & offline' },
  docs:    { id:'docs',    label:'Documents & registration', color:'#4F46E5', bg:'#E0E7FF', border:'#818CF8', gradFrom:'#C7D2FE', gradTo:'#6366F1', tagline:'Drafting · registration · notarisation' },
};
const LEGAL_SVCS = [
  { id:'lg-consult', parent:'legal', theme:'counsel', icon:'⚖️', img:'/services/legal/consult.png', name:'Lawyer Consultation', sub:'30-min advice · civil · property · family', unit:'visit', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV lawyer consultation — speak with a verified advocate for initial advice on civil, property, family, or business matters. Online or in-person across Pune & PCMC.',
    features:['Verified advocates','30-min session','Written summary note','Follow-up quote if needed','Online or office'], turnaround:'Within 24 hrs', rating:'4.8 ⭐', bookings:'2,400+' },
  { id:'lg-court', parent:'legal', theme:'counsel', icon:'🏛️', img:'/services/legal/court.png', name:'Court Filing & Notices', sub:'Draft · file · track · represent', unit:'project', mrp:2999900, price:discPaise(2999900), cash:false,
    desc:'ScanV court services — drafting and filing notices, plaints, and replies with status tracking. Advocate representation available for Pune district courts.',
    features:['Draft & review','E-filing where supported','Case status updates','Court day briefing','Escalation support'], turnaround:'2–5 days', rating:'4.7 ⭐', bookings:'680+' },
  { id:'lg-contract', parent:'legal', theme:'counsel', icon:'📋', img:'/services/legal/contract.png', name:'Business Contract Review', sub:'Vendor · lease · employment · NDAs', unit:'project', mrp:3999900, price:discPaise(3999900), cash:false,
    desc:'ScanV contract review — protect your business with lawyer-reviewed agreements before you sign. Turnaround includes redlines and a short risk summary.',
    features:['Full clause review','Risk summary memo','Suggested redlines','One revision round','Phone walkthrough'], turnaround:'3–5 days', rating:'4.8 ⭐', bookings:'420+' },
  { id:'lg-family', parent:'legal', theme:'counsel', icon:'👨‍👩‍👧', img:'/services/legal/family.png', name:'Family & Divorce Consult', sub:'Marriage · custody · maintenance · mediation', unit:'visit', mrp:149900, price:discPaise(149900), cash:false,
    desc:'ScanV family law consultation — sensitive guidance on divorce, custody, maintenance, and mediation with verified family court advocates in Pune & PCMC.',
    features:['Confidential session','Custody & maintenance advice','Mediation options','Document checklist','Court roadmap if needed'], turnaround:'Within 48 hrs', rating:'4.8 ⭐', bookings:'960+' },
  { id:'lg-doc-draft', parent:'legal', theme:'docs', icon:'📝', img:'/services/legal/doc-draft.png', name:'Document Drafting', sub:'Agreements · wills · affidavits · deeds', unit:'project', mrp:1999900, price:discPaise(1999900), cash:false,
    desc:'ScanV document drafting — custom legal documents prepared by qualified advocates. Includes one revision and e-copy delivery.',
    features:['Custom drafting','Legal formatting','One revision included','E-copy + print ready','Stamp duty guidance'], turnaround:'2–4 days', rating:'4.8 ⭐', bookings:'1,100+' },
  { id:'lg-property-reg', parent:'legal', theme:'docs', icon:'🏠', img:'/services/legal/property-reg.png', name:'Property Registration', sub:'Sale deed · gift · lease · index II', unit:'project', mrp:4999900, price:discPaise(4999900), cash:false,
    desc:'ScanV property registration — end-to-end support for sale deeds, gift deeds, and lease registration with document checklist and sub-registrar coordination.',
    features:['Document checklist','Draft & vetting','Appointment booking','Registration day support','Index II follow-up'], turnaround:'5–10 days', rating:'4.9 ⭐', bookings:'890+' },
  { id:'lg-notary', parent:'legal', theme:'docs', icon:'✍️', img:'/services/legal/notary.png', name:'Notary & Affidavit', sub:'Attestation · sworn statements · copies', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV notary services — affidavits, attestations, and certified copies through empanelled notaries. Home or office visit available in PCMC/Pune.',
    features:['Affidavit drafting help','Notary attestation','Certified true copies','Same-day slots','Doorstep option'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'3,200+' },
  { id:'lg-rental', parent:'legal', theme:'docs', icon:'🔑', img:'/services/legal/rental-agreement.png', name:'Rental Agreement Pack', sub:'Draft · stamp · registration guidance · 11-month', unit:'project', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV rental agreement pack — lawyer-drafted leave & licence or rent agreement with stamp duty guidance and registration steps for landlords and tenants.',
    features:['Custom draft for both parties','Stamp duty estimate','Registration checklist','One revision','E-copy + print ready'], turnaround:'1–2 days', rating:'4.8 ⭐', bookings:'2,700+' },
];

const VIP_THEME = {
  concierge: { id:'concierge', label:'Concierge & assistant', color:'#D97706', bg:'#FEF3C7', border:'#FCD34D', gradFrom:'#FDE68A', gradTo:'#FBBF24', tagline:'Priority support · executive care' },
  travel:    { id:'travel',    label:'Travel & events', color:'#B45309', bg:'#FFEDD5', border:'#FDBA74', gradFrom:'#FED7AA', gradTo:'#FB923C', tagline:'Airport · events · premium hosting' },
};
const VIP_SVCS = [
  { id:'vip-concierge', parent:'vip', theme:'concierge', icon:'👑', img:'/services/vip/concierge.png', name:'24×7 Personal Concierge', sub:'Tasks · bookings · reminders · errands', unit:'month', mrp:9999900, price:discPaise(9999900), cash:false,
    desc:'ScanV personal concierge — a dedicated coordinator for reservations, errands, reminders, and day-to-day executive tasks. Available on phone and WhatsApp.',
    features:['Dedicated coordinator','24×7 phone & chat','Restaurant & travel bookings','Gift & errand runs','Monthly activity log'], turnaround:'Starts in 24 hrs', rating:'5.0 ⭐', bookings:'180+' },
  { id:'vip-assistant', parent:'vip', theme:'concierge', icon:'💼', img:'/services/vip/assistant.png', name:'Executive Assistant', sub:'Calendar · calls · research · hourly', unit:'hour', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV executive assistant — trained support for calendar management, call screening, research, and meeting prep. Book by the hour with NDAs in place.',
    features:['Calendar management','Call screening','Research briefs','Meeting prep','NDA-backed staff'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'320+' },
  { id:'vip-priority', parent:'vip', theme:'concierge', icon:'⭐', img:'/services/vip/priority.png', name:'Priority Appointments', sub:'Doctors · lawyers · govt · fast-track', unit:'visit', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV priority appointments — skip the queue for hard-to-get slots with doctors, consultants, and government-related visits. Confirmation within hours.',
    features:['Fast-track booking','Reminder calls','Reschedule support','Multi-category requests','Escalation desk'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'540+' },
  { id:'vip-dining', parent:'vip', theme:'concierge', icon:'🍷', img:'/services/vip/dining.png', name:'Premium Dining Reservations', sub:'Top restaurants · private tables · occasions', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV dining concierge — secure hard-to-get tables at premium Pune restaurants with preference notes for birthdays, anniversaries, and client dinners.',
    features:['Priority table holds','Special occasion notes','Dietary preferences sent','Reminder & directions','Cancel / change support'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'410+' },
  { id:'vip-airport', parent:'vip', theme:'travel', icon:'✈️', img:'/services/vip/airport.png', name:'Airport Transfer', sub:'Pickup · drop · meet & greet · Pune', unit:'visit', mrp:1499900, price:discPaise(1499900), cash:false,
    desc:'ScanV airport transfer — chauffeur pickup and drop for Pune airport with flight tracking, meet-and-greet, and clean premium vehicles.',
    features:['Flight tracking','Meet & greet option','Premium sedans & SUVs','Bottled water & tissues','Corporate billing'], turnaround:'On schedule', rating:'4.9 ⭐', bookings:'760+' },
  { id:'vip-event', parent:'vip', theme:'travel', icon:'🎉', img:'/services/vip/event.png', name:'Event Planning', sub:'Corporate · wedding · private · end-to-end', unit:'project', mrp:4999900, price:discPaise(4999900), cash:false,
    desc:'ScanV event planning — venue shortlist, vendor coordination, run-of-show, and on-day management for corporate events and private celebrations.',
    features:['Concept & budget plan','Vendor coordination','Run-of-show timeline','On-day manager','Post-event wrap-up'], turnaround:'1–3 weeks', rating:'5.0 ⭐', bookings:'210+' },
];

const HL_THEME = {
  home:     { id:'home',     label:'Home care', color:'#DC2626', bg:'#FEE2E2', border:'#FCA5A5', gradFrom:'#FECACA', gradTo:'#F87171', tagline:'Doctors & specialists at your door' },
  clinical: { id:'clinical', label:'Tests & pharmacy', color:'#E11D48', bg:'#FFE4E6', border:'#FDA4AF', gradFrom:'#FECDD3', gradTo:'#FB7185', tagline:'Labs · medicines · checkups' },
};
const HEALTH_SVCS = [
  { id:'hl-doctor', parent:'health', theme:'home', icon:'🩺', img:'/services/health/doctor.png', name:'Doctor at Home', sub:'GP visit · vitals · prescription · PCMC', unit:'visit', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV doctor at home — general physician visit with vitals check and e-prescription. Ideal for fever, minor illness, or elderly patients who prefer home care.',
    features:['MBBS / MD doctors','Vitals & basic exam','E-prescription','Follow-up advice','Same-day slots'], turnaround:'Within 2 hrs', rating:'4.8 ⭐', bookings:'5,200+' },
  { id:'hl-specialist', parent:'health', theme:'home', icon:'👨‍⚕️', img:'/services/health/specialist.png', name:'Specialist Consultation', sub:'Cardio · ortho · derma · paediatric', unit:'visit', mrp:1499900, price:discPaise(1499900), cash:false,
    desc:'ScanV specialist consult — book verified specialists for second opinions or chronic care. Home or clinic visit based on availability in Pune & PCMC.',
    features:['Verified specialists','Home or clinic','Report review','Care plan summary','Referral network'], turnaround:'24–48 hrs', rating:'4.7 ⭐', bookings:'1,400+' },
  { id:'hl-elder', parent:'health', theme:'home', icon:'🤝', img:'/services/health/elder.png', name:'Elder Care Visit', sub:'Vitals · medication · mobility · hourly', unit:'hour', mrp:29900, price:discPaise(29900), cash:false,
    desc:'ScanV elder care — trained caregivers for vitals monitoring, medication reminders, and companionship at home. Book hourly blocks with family updates.',
    features:['Trained caregivers','Vitals logging','Medication reminders','Family WhatsApp updates','Flexible hours'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'2,800+' },
  { id:'hl-nursing', parent:'health', theme:'home', icon:'💉', img:'/services/health/nursing.png', name:'Nursing Care at Home', sub:'Post-op · injections · wound dressings', unit:'hour', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV nursing at home — qualified nurses for post-operative care, injections, IV support, and wound dressing under doctor prescription in PCMC/Pune.',
    features:['Registered nurses','Post-op monitoring','Injection & dressing','Doctor prescription required','Shift booking'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'1,100+' },
  { id:'hl-checkup', parent:'health', theme:'clinical', icon:'📋', img:'/services/health/checkup.png', name:'Full Body Checkup', sub:'40+ tests · home sample · report', unit:'visit', mrp:1999900, price:discPaise(1999900), cash:false,
    desc:'ScanV full body checkup — comprehensive preventive health package with home sample collection and digital report with doctor summary call.',
    features:['40+ parameters','Home sample pickup','Digital report','Doctor summary call','Annual reminder'], turnaround:'24–48 hrs', rating:'4.7 ⭐', bookings:'3,600+' },
  { id:'hl-lab', parent:'health', theme:'clinical', icon:'🧪', img:'/services/health/lab.png', name:'Lab Tests at Home', sub:'Blood · urine · single or panel', unit:'visit', mrp:79900, price:discPaise(79900), cash:false,
    desc:'ScanV lab at home — certified phlebotomists collect samples at your doorstep. Choose individual tests or curated panels with app-tracked reports.',
    features:['Certified phlebotomist','NABL partner labs','App-tracked reports','Fasting guidance','Bulk family booking'], turnaround:'Same day pickup', rating:'4.8 ⭐', bookings:'8,900+' },
  { id:'hl-pharmacy', parent:'health', theme:'clinical', icon:'💊', img:'/services/health/pharmacy.png', name:'Pharmacy Delivery', sub:'Prescription · OTC · 60 min target', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV pharmacy delivery — upload prescription or order OTC essentials with fast delivery from verified pharmacies near you in PCMC/Pune.',
    features:['Prescription upload','Verified pharmacies','60-min target zones','Cold-chain items','Reorder reminders'], turnaround:'30–60 min', rating:'4.6 ⭐', bookings:'12,000+' },
  { id:'hl-vaccine', parent:'health', theme:'clinical', icon:'💉', img:'/services/health/vaccine.png', name:'Vaccination at Home', sub:'Flu · hepatitis · travel · corporate camps', unit:'visit', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV vaccination at home — certified nurses administer approved vaccines at your doorstep with cold-chain handling and digital records.',
    features:['Certified nurse visit','Cold-chain vaccines','Digital record card','Family & corporate slots','Doctor helpline'], turnaround:'24–48 hrs', rating:'4.8 ⭐', bookings:'2,200+' },
];

const PR_THEME = {
  find:   { id:'find',   label:'Find property', color:'#EA580C', bg:'#FFEDD5', border:'#FDBA74', gradFrom:'#FED7AA', gradTo:'#FB923C', tagline:'Buy · rent · PG · site visits' },
  verify: { id:'verify', label:'Verify & finance', color:'#C2410C', bg:'#FFF7ED', border:'#FDBA74', gradFrom:'#FFEDD5', gradTo:'#F97316', tagline:'Legal checks · loan assistance' },
};
const PROPERTY_SVCS = [
  { id:'pr-buy', parent:'property', theme:'find', icon:'🏘️', img:'/services/property/buy-sell.png', name:'Buy / Sell Assistance', sub:'Shortlist · negotiate · close · PCMC', unit:'project', mrp:9999900, price:discPaise(9999900), cash:false,
    desc:'ScanV buy/sell assistance — verified listings, site coordination, price benchmarking, and documentation support for flats, plots, and commercial units.',
    features:['Verified listings','Price benchmarking','Site visit coordination','Negotiation support','Documentation checklist'], turnaround:'3–7 days', rating:'4.6 ⭐', bookings:'890+' },
  { id:'pr-rent', parent:'property', theme:'find', icon:'🔑', img:'/services/property/rent.png', name:'Rent & PG Finder', sub:'Flat · PG · coliving · tenant match', unit:'project', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV rent & PG finder — curated options by budget, location, and amenities with virtual tours and landlord verification before you visit.',
    features:['Budget & area match','Landlord verification','Virtual tour option','Visit scheduling','Agreement template'], turnaround:'24–48 hrs', rating:'4.7 ⭐', bookings:'2,400+' },
  { id:'pr-site', parent:'property', theme:'find', icon:'📍', img:'/services/property/site-visit.png', name:'Site Visit Package', sub:'3–5 properties · agent · same day', unit:'visit', mrp:1999900, price:discPaise(1999900), cash:false,
    desc:'ScanV site visit package — an assigned agent takes you through shortlisted properties in one trip with comparison notes and photos after the tour.',
    features:['Pre-shortlisted list','Dedicated agent','Comparison sheet','Photos & notes','Follow-up call'], turnaround:'Same day', rating:'4.6 ⭐', bookings:'1,100+' },
  { id:'pr-commercial', parent:'property', theme:'find', icon:'🏢', img:'/services/property/commercial.png', name:'Commercial Space Finder', sub:'Office · shop · warehouse · PCMC', unit:'project', mrp:2999900, price:discPaise(2999900), cash:false,
    desc:'ScanV commercial finder — shortlist offices, retail shops, and warehouses by size, budget, and connectivity with landlord verification before you visit.',
    features:['Size & budget match','Connectivity check','Landlord verification','Comparison sheet','Lease term guidance'], turnaround:'3–5 days', rating:'4.7 ⭐', bookings:'480+' },
  { id:'pr-legal', parent:'property', theme:'verify', icon:'📑', img:'/services/property/legal-check.png', name:'Legal Verification', sub:'Title · encumbrance · approvals · report', unit:'project', mrp:2999900, price:discPaise(2999900), cash:false,
    desc:'ScanV legal verification — lawyer-led title search, encumbrance check, and approval review before you pay a token. Written risk report included.',
    features:['Title search','Encumbrance certificate','Approval review','Written risk report','Lawyer call summary'], turnaround:'3–5 days', rating:'4.8 ⭐', bookings:'620+' },
  { id:'pr-loan', parent:'property', theme:'verify', icon:'🏦', img:'/services/property/loan.png', name:'Home Loan Assistance', sub:'Compare banks · paperwork · faster sanction', unit:'project', mrp:1999900, price:discPaise(1999900), cash:false,
    desc:'ScanV home loan assistance — compare offers, prepare paperwork, and coordinate with bank partners for faster sanction and disbursal tracking.',
    features:['Bank comparison','Document prep','Application filing','Status tracking','Sanction guidance'], turnaround:'5–10 days', rating:'4.7 ⭐', bookings:'780+' },
];

const DL_THEME = {
  local:   { id:'local',   label:'Local delivery', color:'#0891B2', bg:'#CFFAFE', border:'#67E8F9', gradFrom:'#A5F3FC', gradTo:'#22D3EE', tagline:'Same-day · documents · parcels' },
  express: { id:'express', label:'Express & bulk', color:'#0E7490', bg:'#ECFEFF', border:'#A5F3FC', gradFrom:'#CFFAFE', gradTo:'#06B6D4', tagline:'Inter-city · business logistics' },
};
const DELIVERY_SVCS = [
  { id:'dl-sameday', parent:'delivery', theme:'local', icon:'📦', img:'/services/delivery/sameday.png', name:'Same-Day Courier', sub:'Pickup in 60 min · PCMC · Pune', unit:'visit', mrp:9900, price:discPaise(9900), cash:false,
    desc:'ScanV same-day courier — door pickup and delivery within Pune & PCMC city limits. Live status updates and OTP handover for security.',
    features:['60-min pickup target','Live tracking','OTP delivery','Up to 5 kg standard','Insurance add-on'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'12,000+' },
  { id:'dl-doc', parent:'delivery', theme:'local', icon:'📄', img:'/services/delivery/document.png', name:'Document Delivery', sub:'Legal · bank · office · confidential', unit:'visit', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV document delivery — confidential handover for legal papers, cheques, and contracts with chain-of-custody notes and photo proof.',
    features:['Confidential handling','Photo proof','Chain-of-custody note','Return trip option','Corporate accounts'], turnaround:'Same day', rating:'4.9 ⭐', bookings:'4,500+' },
  { id:'dl-parcel', parent:'delivery', theme:'local', icon:'🎁', img:'/services/delivery/parcel.png', name:'Parcel Pickup & Drop', sub:'Gifts · ecommerce · returns · multi-stop', unit:'visit', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV parcel service — flexible pickup and drop for personal parcels, returns, and multi-stop routes. Weight-based pricing shown upfront.',
    features:['Door pickup','Multi-stop routes','Weight-based quote','Return pickups','Evening slots'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'6,200+' },
  { id:'dl-grocery', parent:'delivery', theme:'local', icon:'🛒', img:'/services/delivery/grocery.png', name:'Grocery & Essentials Run', sub:'Kirana · milk · bread · 90 min target', unit:'visit', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV grocery run — send your list and we pick up from nearby stores and deliver to your door. Perfect when you cannot step out.',
    features:['Custom shopping list','Local kirana partners','Bill photo before pay','90-min target','OTP handover'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'9,800+' },
  { id:'dl-intercity', parent:'delivery', theme:'express', icon:'🚚', img:'/services/delivery/intercity.png', name:'Inter-City Express', sub:'Maharashtra · overnight · tracked', unit:'project', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV inter-city express — overnight and next-day delivery across Maharashtra with tracking, insurance options, and business manifests.',
    features:['Overnight lanes','Live tracking','Insurance optional','Business manifests','Pickup scheduling'], turnaround:'Next day', rating:'4.8 ⭐', bookings:'2,100+' },
  { id:'dl-bulk', parent:'delivery', theme:'express', icon:'🏢', img:'/services/delivery/bulk.png', name:'Business Bulk Delivery', sub:'Daily routes · SLAs · invoicing', unit:'project', mrp:99900, price:discPaise(99900), cash:false,
    desc:'ScanV bulk delivery — recurring routes for shops, pharmacies, and offices with SLA-backed pickups, monthly invoicing, and dedicated coordinator.',
    features:['Dedicated coordinator','SLA-backed routes','Monthly billing','Volume discounts','API-ready ops'], turnaround:'Starts in 48 hrs', rating:'4.8 ⭐', bookings:'380+' },
];

const FD_THEME = {
  daily:  { id:'daily',  label:'Daily meals', color:'#DB2777', bg:'#FCE7F3', border:'#F9A8D4', gradFrom:'#FBCFE8', gradTo:'#F472B6', tagline:'Tiffin · restaurant · office lunch' },
  events: { id:'events', label:'Catering & events', color:'#BE185D', bg:'#FFF1F2', border:'#FDA4AF', gradFrom:'#FFE4E6', gradTo:'#FB7185', tagline:'Parties · festivals · corporate' },
};
const FOOD_SVCS = [
  { id:'fd-tiffin', parent:'food', theme:'daily', icon:'🍱', img:'/services/food/tiffin.png', name:'Home Tiffin Plan', sub:'Veg · non-veg · monthly · 2 meals', unit:'month', mrp:5999900, price:discPaise(5999900), cash:false,
    desc:'ScanV home tiffin — hygienic home-style meals from verified kitchens with monthly plans, pause days, and allergy notes on every order.',
    features:['Verified home kitchens','Veg & non-veg plans','Pause & skip days','Allergy notes','Monthly billing'], turnaround:'Starts in 48 hrs', rating:'4.7 ⭐', bookings:'8,400+' },
  { id:'fd-restaurant', parent:'food', theme:'daily', icon:'🍽️', img:'/services/food/restaurant.png', name:'Restaurant Order', sub:'Local restaurants · 30–60 min · track', unit:'visit', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV restaurant order — discover nearby restaurants and cloud kitchens with live tracking, UPI payment, and repeat favourites saved to your profile.',
    features:['Local restaurant partners','Live order tracking','UPI at checkout','Repeat favourites','Group orders'], turnaround:'30–60 min', rating:'4.6 ⭐', bookings:'18,000+' },
  { id:'fd-office', parent:'food', theme:'daily', icon:'🥗', img:'/services/food/office.png', name:'Office Lunch Box', sub:'Team orders · invoicing · daily menu', unit:'month', mrp:1499900, price:discPaise(1499900), cash:false,
    desc:'ScanV office lunch — daily lunch boxes for teams with rotating menus, bulk pricing, and GST invoices for Pune & PCMC offices.',
    features:['Team dashboards','Rotating menus','Bulk pricing','GST invoices','Dedicated support'], turnaround:'Next day start', rating:'4.7 ⭐', bookings:'620+' },
  { id:'fd-breakfast', parent:'food', theme:'daily', icon:'🥐', img:'/services/food/breakfast.png', name:'Breakfast & Snacks Plan', sub:'Morning tiffin · poha · idli · monthly', unit:'month', mrp:3499900, price:discPaise(3499900), cash:false,
    desc:'ScanV breakfast plan — hot morning meals and evening snacks delivered on schedule from verified home kitchens. Pause days supported.',
    features:['Daily morning slot','Veg & egg options','Pause & skip days','Evening snack add-on','Monthly billing'], turnaround:'Starts in 48 hrs', rating:'4.8 ⭐', bookings:'1,450+' },
  { id:'fd-catering', parent:'food', theme:'events', icon:'🎂', img:'/services/food/catering.png', name:'Party Catering', sub:'Birthday · corporate · 20–500 guests', unit:'project', mrp:9999900, price:discPaise(9999900), cash:false,
    desc:'ScanV party catering — menu planning, tasting, service staff, and live counters for birthdays, anniversaries, and corporate events.',
    features:['Custom menu planning','Tasting session','Service staff option','Live counters','Leftover packaging'], turnaround:'3–7 days', rating:'4.8 ⭐', bookings:'940+' },
  { id:'fd-festival', parent:'food', theme:'events', icon:'🪔', img:'/services/food/festival.png', name:'Festival Special Menu', sub:'Diwali · Ganesh · wedding sweets · bulk', unit:'project', mrp:2999900, price:discPaise(2999900), cash:false,
    desc:'ScanV festival menu — seasonal sweets, snacks, and feast packages from trusted caterers with advance booking and doorstep delivery.',
    features:['Seasonal menus','Advance booking','Bulk sweet boxes','Doorstep delivery','Corporate gifting'], turnaround:'2–5 days', rating:'4.9 ⭐', bookings:'1,200+' },
];

const TW_THEME = {
  roadside: { id:'roadside', label:'Roadside help', color:'#EA580C', bg:'#FFEDD5', border:'#FDBA74', gradFrom:'#FED7AA', gradTo:'#FB923C', tagline:'Mechanic · fixing · battery & tyre' },
  care:     { id:'care',     label:'Care & pickup', color:'#2563EB', bg:'#DBEAFE', border:'#93C5FD', gradFrom:'#BFDBFE', gradTo:'#60A5FA', tagline:'Pick-up · wash · deep clean' },
};
const TWO_WHEELER_SVCS = [
  { id:'tw-mechanic', parent:'two-wheeler', theme:'roadside', icon:'🔧', img:'/services/two-wheeler/mechanic.png', name:'Mechanic Support', sub:'Breakdown · tune-up · at home or roadside', unit:'visit', mrp:29900, price:discPaise(29900), cash:false,
    desc:'ScanV two-wheeler mechanic — verified bike technicians for breakdowns, tune-ups, and general repairs at your location or roadside across Pune & PCMC.',
    features:['Roadside or home visit','Verified bike mechanics','Parts guidance','Same-day slots','Live partner tracking'], turnaround:'60–90 min', rating:'4.8 ⭐', bookings:'3,400+' },
  { id:'tw-pickup', parent:'two-wheeler', theme:'care', icon:'🛵', img:'/services/two-wheeler/pickup.png', name:'Pick-up & Drop Servicing', sub:'Garage run · service · return to doorstep', unit:'visit', mrp:39900, price:discPaise(39900), cash:false,
    desc:'ScanV pick-up & drop — we collect your two-wheeler, take it to a trusted garage for servicing, and return it washed and ready. Live GPS tracking throughout.',
    features:['Doorstep pick-up','Partner garage network','Status updates','Drop-back same/next day','Live location map'], turnaround:'Same/next day', rating:'4.9 ⭐', bookings:'2,800+' },
  { id:'tw-fix', parent:'two-wheeler', theme:'roadside', icon:'⚡', img:'/services/two-wheeler/fixing.png', name:'On-Road Fixing', sub:'Flat tyre · chain · fuse · minor electrical', unit:'visit', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV on-road fixing — quick roadside assistance for flat tyres, chain issues, fuse replacement, and minor electrical faults on scooters and bikes.',
    features:['30-min response target','Tyre puncture repair','Chain & cable fix','Battery jump-start','Track mechanic live'], turnaround:'30–60 min', rating:'4.7 ⭐', bookings:'5,100+' },
  { id:'tw-wash', parent:'two-wheeler', theme:'care', icon:'💦', img:'/services/two-wheeler/washing.png', name:'Bike Washing', sub:'Exterior wash · chain lube · 30 min', unit:'visit', mrp:9900, price:discPaise(9900), cash:false,
    desc:'ScanV bike wash — eco-friendly exterior wash, chain wipe, and tyre shine at your parking spot or society gate. Book solo or add to a service visit.',
    features:['Water-efficient wash','Chain lube option','Tyre & rim clean','Society gate friendly','Same-day booking'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'6,200+' },
  { id:'tw-deep', parent:'two-wheeler', theme:'care', icon:'✨', img:'/services/two-wheeler/deep-clean.png', name:'Deep Cleaning', sub:'Engine bay wipe · degrease · polish · 1–2 hrs', unit:'visit', mrp:14900, price:discPaise(14900), cash:false,
    desc:'ScanV two-wheeler deep clean — thorough degrease, engine bay wipe, plastic polish, and under-seat vacuum for a showroom-fresh bike.',
    features:['Engine bay degrease','Full body polish','Seat & storage clean','Rust spot treatment','Premium products'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'2,400+' },
  { id:'tw-battery', parent:'two-wheeler', theme:'roadside', icon:'🔋', img:'/services/two-wheeler/battery.png', name:'Battery & Tyre Check', sub:'Health test · air · replacement guidance', unit:'visit', mrp:12900, price:discPaise(12900), cash:false,
    desc:'ScanV battery & tyre check — doorstep health diagnostics, air top-up, and honest replacement guidance from verified partners. No upsell pressure.',
    features:['Battery load test','Tyre pressure check','Tread inspection','Replacement quote','Monsoon prep add-on'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'1,900+' },
];

const FW_THEME = {
  service: { id:'service', label:'Service & repair', color:'#7C3AED', bg:'#EDE9FE', border:'#C4B5FD', gradFrom:'#DDD6FE', gradTo:'#A78BFA', tagline:'Mechanic · pick-up · on-site fix' },
  care:    { id:'care',    label:'Cleaning & care', color:'#0891B2', bg:'#CFFAFE', border:'#67E8F9', gradFrom:'#A5F3FC', gradTo:'#22D3EE', tagline:'Wash · deep clean · detailing' },
};
const FOUR_WHEELER_SVCS = [
  { id:'fw-mechanic', parent:'four-wheeler', theme:'service', icon:'🔧', img:'/services/four-wheeler/mechanic.png', name:'Mechanic Support', sub:'Breakdown · diagnostics · home or roadside', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV four-wheeler mechanic — certified car technicians for breakdowns, diagnostics, and repairs at your location. Live GPS tracking like delivery apps.',
    features:['Home or roadside visit','OBD diagnostics','Verified car mechanics','Same-day slots','Live partner map'], turnaround:'60–120 min', rating:'4.8 ⭐', bookings:'2,200+' },
  { id:'fw-pickup', parent:'four-wheeler', theme:'service', icon:'🚗', img:'/services/four-wheeler/pickup.png', name:'Pick-up & Drop Servicing', sub:'Collect · service centre · return washed', unit:'visit', mrp:79900, price:discPaise(79900), cash:false,
    desc:'ScanV car pick-up & drop — we collect your car, complete scheduled servicing at a partner garage, and return it to your doorstep with live tracking end-to-end.',
    features:['Doorstep pick-up','Authorised partner garages','Digital job card','Washed return delivery','Live GPS until closed'], turnaround:'1–2 days', rating:'4.9 ⭐', bookings:'1,600+' },
  { id:'fw-fix', parent:'four-wheeler', theme:'service', icon:'⚡', img:'/services/four-wheeler/fixing.png', name:'On-Site Fixing', sub:'Battery · tyre · minor electrical · fluid top-up', unit:'visit', mrp:39900, price:discPaise(39900), cash:false,
    desc:'ScanV on-site car fixing — battery jump-start, tyre change, fuse replacement, and fluid top-ups at your parking spot or roadside location.',
    features:['45-min response target','Battery & tyre assist','Minor electrical fix','Fluid top-up','Track technician live'], turnaround:'45–90 min', rating:'4.7 ⭐', bookings:'3,800+' },
  { id:'fw-wash', parent:'four-wheeler', theme:'care', icon:'💦', img:'/services/four-wheeler/washing.png', name:'Car Washing', sub:'Exterior wash · vacuum · 45–60 min', unit:'visit', mrp:19900, price:discPaise(19900), cash:false,
    desc:'ScanV car wash — doorstep exterior wash and interior vacuum at your home or office parking. Eco-friendly products, verified partners.',
    features:['Doorstep wash','Interior vacuum','Tyre & glass clean','Water-saving method','Monthly plans'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'4,500+' },
  { id:'fw-deep', parent:'four-wheeler', theme:'care', icon:'✨', img:'/services/four-wheeler/deep-clean.png', name:'Deep Cleaning', sub:'Interior shampoo · AC vent · engine bay', unit:'visit', mrp:29900, price:discPaise(29900), cash:false,
    desc:'ScanV car deep clean — interior shampoo, AC vent sanitisation, engine bay degrease, and odour treatment for a fresh cabin and engine bay.',
    features:['Seat shampoo','AC vent sanitise','Engine bay degrease','Odour treatment','3–4 hr visit'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'1,800+' },
  { id:'fw-detail', parent:'four-wheeler', theme:'care', icon:'💎', img:'/services/four-wheeler/detailing.png', name:'Detailing & Interior', sub:'Polish · ceramic prep · leather care · premium', unit:'visit', mrp:49900, price:discPaise(49900), cash:false,
    desc:'ScanV car detailing — premium polish, leather conditioning, ceramic prep, and full interior restoration from specialist partners.',
    features:['Machine polish','Leather conditioning','Ceramic prep','Dashboard restore','Premium finish'], turnaround:'1–2 days', rating:'4.9 ⭐', bookings:'920+' },
];

const SUB_CATEGORIES = {
  household: { title:'Household services', subtitle:'Deep cleaning & home help · 25% off · verified partners', cat:'Household Services', themes:HH_THEME, svcs:HOUSEHOLD_SVCS, themeOrder:['pink','green'] },
  cloud:     { title:'Cloud services', subtitle:'Hosting · infrastructure · packages · 25% off', cat:'Cloud Services', themes:CL_THEME, svcs:CLOUD_SVCS, themeOrder:['host','build','care','pack'] },
  legal:     { title:'Legal services', subtitle:'Lawyers · docs · registration · 25% off', cat:'Legal', themes:LG_THEME, svcs:LEGAL_SVCS, themeOrder:['counsel','docs'] },
  vip:       { title:'VIP appointments', subtitle:'Concierge · travel · events · 25% off', cat:'VIP Appointments', themes:VIP_THEME, svcs:VIP_SVCS, themeOrder:['concierge','travel'] },
  health:    { title:'Health care', subtitle:'Doctors · tests · pharmacy · 25% off', cat:'Health Care', themes:HL_THEME, svcs:HEALTH_SVCS, themeOrder:['home','clinical'] },
  property:  { title:'Property & rentals', subtitle:'Buy · rent · verify · 25% off', cat:'Property & Rentals', themes:PR_THEME, svcs:PROPERTY_SVCS, themeOrder:['find','verify'] },
  delivery:  { title:'Deliveries', subtitle:'Courier · parcels · express · 25% off', cat:'Deliveries', themes:DL_THEME, svcs:DELIVERY_SVCS, themeOrder:['local','express'] },
  food:      { title:'Food', subtitle:'Tiffin · restaurant · catering · 25% off', cat:'Food', themes:FD_THEME, svcs:FOOD_SVCS, themeOrder:['daily','events'] },
  'two-wheeler': { title:'Two Wheeler Support', subtitle:'Mechanic · pick-up · wash · deep clean · 6 services', cat:'Two Wheeler Support', themes:TW_THEME, svcs:TWO_WHEELER_SVCS, themeOrder:['roadside','care'] },
  'four-wheeler': { title:'Four Wheeler Support', subtitle:'Car mechanic · pick-up · wash · detailing · 6 services', cat:'Four Wheeler Support', themes:FW_THEME, svcs:FOUR_WHEELER_SVCS, themeOrder:['service','care'] },
};

const ALL_SUB_SVCS = Object.values(SUB_CATEGORIES).flatMap(c => c.svcs);
const SUB_BY_ID = Object.fromEntries(ALL_SUB_SVCS.map(s => [s.id, s]));

function subCatId(svc) {
  if (!svc) return null;
  if (SUB_CATEGORIES[svc.id]) return svc.id;
  if (svc.parent && SUB_CATEGORIES[svc.parent]) return svc.parent;
  return null;
}

function subSvcCount(svc) {
  const id = subCatId(svc);
  return id ? SUB_CATEGORIES[id].svcs.length : 0;
}

/* --- LIVE PRICING (Supabase overrides) ----------------------------- */
const PRICING_ADMIN_HASH = 'pricing-admin';
const VENDOR_ONBOARD_HASH = 'vendor-onboard';
const VENDOR_ADMIN_HASH = 'vendor-admin';
const TRACK_HASH = 'track';
const TRACK_BOOKING_KEY = 'scanv_track_booking';
const PRICING_PIN_KEY = 'scanv_pricing_pin';
const PRICING_AUTH_KEY = 'scanv_pricing_auth';
const VENDOR_PIN_KEY = 'scanv_vendor_pin';
const PRICING_FN = `${SB_URL}/functions/v1/pricing-admin`;
const VENDOR_FN = `${SB_URL}/functions/v1/vendor-onboard`;
const DISPATCH_FN = `${SB_URL}/functions/v1/booking-dispatch`;

function findSvcById(id) {
  return SVCS.find(s => s.id === id) || SUB_BY_ID[id] || null;
}

function applyLivePricingRows(rows) {
  if (!rows?.length) return;
  for (const row of rows) {
    const svc = findSvcById(row.service_id);
    if (!svc) continue;
    if (row.price_paise != null) svc.price = row.price_paise;
    if (row.mrp_paise != null) svc.mrp = row.mrp_paise;
  }
}

async function fetchLivePricing() {
  try {
    const { data, error } = await sb().from('service_prices_public').select('service_id,price_paise,mrp_paise');
    if (error || !data?.length) return [];
    applyLivePricingRows(data);
    return data;
  } catch { return []; }
}

function pricingAuthOk() {
  try {
    const raw = sessionStorage.getItem(PRICING_AUTH_KEY);
    if (!raw) return false;
    const { pin, exp } = JSON.parse(raw);
    return !!pin && Date.now() < exp;
  } catch { return false; }
}

function setPricingAuth(pin) {
  sessionStorage.setItem(PRICING_AUTH_KEY, JSON.stringify({ pin, exp: Date.now() + 86400000 }));
}

async function pricingAdminFetch(pin) {
  const res = await fetch(PRICING_FN, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'x-pricing-pin': pin },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Fetch failed');
  return res.json();
}

async function pricingAdminSave(pin, rows) {
  const res = await fetch(PRICING_FN, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'x-pricing-pin': pin },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
  return res.json();
}

function splitPricingRow(row, field, value) {
  const next = { ...row };
  const num = (v) => Math.max(0, Math.round(Number(v) || 0));
  if (field === 'new_amount_paise') {
    next.new_amount_paise = num(value);
    const pPct = Number(next.partner_pct) || 70;
    next.partner_amount_paise = Math.round(next.new_amount_paise * pPct / 100);
    next.scanv_amount_paise = next.new_amount_paise - next.partner_amount_paise;
    next.scanv_pct = Math.round((100 - pPct) * 100) / 100;
  } else if (field === 'partner_pct') {
    next.partner_pct = Math.min(100, Math.max(0, Number(value) || 0));
    next.partner_amount_paise = Math.round(next.new_amount_paise * next.partner_pct / 100);
    next.scanv_amount_paise = next.new_amount_paise - next.partner_amount_paise;
    next.scanv_pct = Math.round((100 - next.partner_pct) * 100) / 100;
  } else if (field === 'scanv_pct') {
    next.scanv_pct = Math.min(100, Math.max(0, Number(value) || 0));
    next.partner_pct = Math.round((100 - next.scanv_pct) * 100) / 100;
    next.partner_amount_paise = Math.round(next.new_amount_paise * next.partner_pct / 100);
    next.scanv_amount_paise = next.new_amount_paise - next.partner_amount_paise;
  } else if (field === 'partner_amount_paise') {
    next.partner_amount_paise = num(value);
    next.partner_pct = next.new_amount_paise ? Math.round(next.partner_amount_paise / next.new_amount_paise * 10000) / 100 : 0;
    next.scanv_amount_paise = next.new_amount_paise - next.partner_amount_paise;
    next.scanv_pct = Math.round((100 - next.partner_pct) * 100) / 100;
  } else if (field === 'scanv_amount_paise') {
    next.scanv_amount_paise = num(value);
    next.scanv_pct = next.new_amount_paise ? Math.round(next.scanv_amount_paise / next.new_amount_paise * 10000) / 100 : 0;
    next.partner_pct = Math.round((100 - next.scanv_pct) * 100) / 100;
    next.partner_amount_paise = next.new_amount_paise - next.scanv_amount_paise;
  } else if (field === 'current_amount_paise') {
    next.current_amount_paise = num(value);
  }
  return next;
}

function isPricingAdminRoute() {
  return window.location.hash.replace(/^#/, '') === PRICING_ADMIN_HASH;
}

function isVendorOnboardRoute() {
  return window.location.hash.replace(/^#/, '') === VENDOR_ONBOARD_HASH;
}

function isVendorAdminRoute() {
  return window.location.hash.replace(/^#/, '') === VENDOR_ADMIN_HASH;
}

function isTrackRoute() {
  const h = window.location.hash.replace(/^#/, '');
  return h === TRACK_HASH || h.startsWith(`${TRACK_HASH}?`) || h.startsWith(`${TRACK_HASH}/`);
}

function trackBookingIdFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith(TRACK_HASH)) return null;
  const q = raw.includes('?') ? raw.split('?')[1] : '';
  const params = new URLSearchParams(q);
  return params.get('id') || params.get('booking') || null;
}

function goToTrack(setTrackBookingId, setScreen, bookingId) {
  if (!bookingId) return;
  sessionStorage.setItem(TRACK_BOOKING_KEY, bookingId);
  setTrackBookingId?.(bookingId);
  setScreen?.('track');
  window.location.hash = `${TRACK_HASH}?id=${encodeURIComponent(bookingId)}`;
}

/** All bookable services for vendor onboarding selection */
function allVendorSelectableServices() {
  const list = [];
  for (const [catId, cfg] of Object.entries(SUB_CATEGORIES)) {
    for (const s of cfg.svcs) {
      list.push({ service_id: s.id, category_id: catId, name: s.name, cat: cfg.title });
    }
  }
  for (const s of SVCS) {
    if (!SUB_CATEGORIES[s.id]) {
      list.push({ service_id: s.id, category_id: s.id, name: s.name, cat: s.cat });
    }
  }
  return list;
}

async function vendorOnboardFetch(action, payload = {}, pin) {
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  if (pin) headers['x-vendor-admin-pin'] = pin;
  const res = await fetch(VENDOR_FN, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function invokeBookingDispatch({ bookingId, serviceId, serviceName, lat, lng, location, date, time }) {
  try {
    const r = await sb().functions.invoke('booking-dispatch', {
      body: {
        action: 'start',
        booking_id: bookingId,
        service_id: serviceId || '',
        service_name: serviceName,
        lat: lat ?? null,
        lng: lng ?? null,
        location: location || '',
        date: date || null,
        time: time || null,
      },
    });
    if (r.error) console.warn('[Dispatch]', r.error.message);
    return r.data;
  } catch (e) {
    console.warn('[Dispatch]', e.message);
    return null;
  }
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh','Puducherry',
];

const COUNTRY_OPTIONS = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SG', name: 'Singapore' },
];

const paiseInp = (p) => Math.round((Number(p) || 0) / 100);
const paiseFromInp = (r) => Math.round((Number(r) || 0) * 100);

/* --- SERVICES ----------------------------------------------------- */
const SVCS = [
  { id:'legal',    icon:'⚖️', name:'Legal services',     sub:'Lawyers · docs · registration · 8 services', cat:'Legal',              cash:false, ...svcDisc(999), legal:true },
  { id:'cloud',    icon:'☁️', name:'Cloud services',     sub:'Hosting · infra · packages · 18 services', cat:'Cloud Services',     cash:false, ...svcDisc(4999), cloud:true },
  { id:'vip',      icon:'👑', name:'VIP appointments',   sub:'Concierge · travel · events · 6 services', cat:'VIP Appointments',   cash:false, ...svcDisc(9999), vip:true },
  { id:'health',   icon:'🏥', name:'Health care',        sub:'Doctors · tests · pharmacy · 8 services',  cat:'Health Care',        cash:false, ...svcDisc(499), health:true },
  { id:'property', icon:'🏡', name:'Property & rentals', sub:'Buy · rent · verify · 6 services',         cat:'Property & Rentals', cash:false, ...svcDisc(1999), property:true },
  { id:'household',icon:'🧹', name:'Household services', sub:'Deep clean · home help · 14 services', cat:'Household Services', cash:false, ...svcDisc(149), household:true },
  { id:'delivery', icon:'📦', name:'Deliveries',         sub:'Courier · parcels · express · 6 services', cat:'Deliveries',         cash:false, ...svcDisc(99), delivery:true },
  { id:'food',     icon:'🍱', name:'Food',               sub:'Tiffin · restaurant · catering · 6 services', cat:'Food',               cash:false, ...svcDisc(199), food:true },
  { id:'two-wheeler', icon:'🛵', name:'Two Wheeler Support', sub:'Mechanic · pick-up · wash · 6 services', cat:'Two Wheeler Support', cash:false, ...svcDisc(299), twowheeler:true },
  { id:'four-wheeler', icon:'🚗', name:'Four Wheeler Support', sub:'Car service · pick-up · detailing · 6 services', cat:'Four Wheeler Support', cash:false, ...svcDisc(499), fourwheeler:true },
];

const SVC_CARD_THEME = {
  legal:    { bgFrom:'#EEF2FF', bgTo:'#E0E7FF', b1:'#818CF8', b2:'#6366F1', glow:'rgba(99,102,241,0.18)', img:'/home-models/legal.png' },
  cloud:    { bgFrom:'#DBEAFE', bgTo:'#BFDBFE', b1:'#60A5FA', b2:'#2563EB', glow:'rgba(37,99,235,0.18)', img:'/home-models/cloud.png' },
  vip:      { bgFrom:'#FEF3C7', bgTo:'#FDE68A', b1:'#FBBF24', b2:'#D97706', glow:'rgba(217,119,6,0.2)',  tag:'👑 Premium', img:'/home-models/vip.png' },
  health:   { bgFrom:'#FEE2E2', bgTo:'#FECACA', b1:'#F87171', b2:'#DC2626', glow:'rgba(220,38,38,0.16)', img:'/home-models/health.png' },
  property: { bgFrom:'#FFEDD5', bgTo:'#FED7AA', b1:'#FB923C', b2:'#EA580C', glow:'rgba(234,88,12,0.18)', img:'/home-models/property.png' },
  household:{ bgFrom:'#FFF1F5', bgTo:'#ECFDF5', b1:'#FFD6E8', b2:'#86EFAC', glow:'rgba(244,114,182,0.22)', tag:'✨ POPULAR', img:'/home-models/household.png' },
  delivery: { bgFrom:'#CFFAFE', bgTo:'#A5F3FC', b1:'#22D3EE', b2:'#0891B2', glow:'rgba(8,145,178,0.18)', img:'/home-models/delivery.png' },
  food:     { bgFrom:'#FCE7F3', bgTo:'#FBCFE8', b1:'#F472B6', b2:'#DB2777', glow:'rgba(219,39,119,0.18)', img:'/home-models/food.png' },
  'two-wheeler': { bgFrom:'#FFEDD5', bgTo:'#FED7AA', b1:'#FB923C', b2:'#EA580C', glow:'rgba(234,88,12,0.2)', tag:'🛵 Bike', img:'/home-models/two-wheeler.png' },
  'four-wheeler': { bgFrom:'#EDE9FE', bgTo:'#DDD6FE', b1:'#A78BFA', b2:'#7C3AED', glow:'rgba(124,58,237,0.2)', tag:'🚗 Car', img:'/home-models/four-wheeler.png' },
};

const HOME_CARD_META = {
  legal:    { commitment:'Justice with a human touch.',     face:'Adv. Priya · verified lawyer' },
  cloud:    { commitment:'Scale with confidence.',          face:'Cloud · infra · 18 services' },
  vip:      { commitment:'You first. Every single time.',   face:'Meera · concierge lead' },
  health:   { commitment:'Care that starts with a smile.',  face:'Dr. Ananya · home visits' },
  property: { commitment:'Find home. Find peace.',          face:'Verified listings · PCMC' },
  household:{ commitment:'A lighter home. A lighter heart.',face:'Deep clean & home help · 12 services' },
  delivery: { commitment:'On time. With a smile.',          face:'Vikram · local delivery' },
  food:     { commitment:'Happiness, served fresh.',        face:'Chef Kavita · tiffin & more' },
  'two-wheeler': { commitment:'Back on the road. Fast.',    face:'Ravi · bike mechanic · live GPS' },
  'four-wheeler': { commitment:'Your car. Our care.',       face:'Suresh · car service · live tracking' },
};

/** Search categories + all sub-services */
function searchAllServices(query) {
  const q = query.trim().toLowerCase();
  const emptySubs = Object.fromEntries(Object.keys(SUB_CATEGORIES).map(k => [k, []]));
  if (!q) return { categories: SVCS, ...emptySubs };
  const inText = (parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);
  const categories = SVCS.filter(s => {
    const d = SVC_DETAIL[s.id] || {};
    return inText([s.name, s.sub, s.cat, SVC_SHORT[s.id], d.desc, ...(d.features || [])]);
  });
  const subs = {};
  for (const [id, cfg] of Object.entries(SUB_CATEGORIES)) {
    subs[id] = cfg.svcs.filter(s => inText([s.name, s.sub, s.desc, ...(s.features || [])]));
  }
  return { categories, ...subs };
}

/* --- SUPABASE ----------------------------------------------------- */
let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!window.supabase) throw new Error('Supabase not loaded');
  _sb = window.supabase.createClient(SB_URL, SB_KEY);
  return _sb;
}

/* --- CONTEXT ------------------------------------------------------ */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* --- ERROR BOUNDARY ----------------------------------------------- */
class Boundary extends Component {
  constructor(p) { super(p); this.state = { err:null }; }
  static getDerivedStateFromError(e) { return { err:e }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={S.center}>
        <div style={{fontSize:40}}>⚠️</div>
        <div style={{color:C.txt,fontSize:18,fontWeight:600}}>Something went wrong</div>
        <div style={{color:C.sub,fontSize:13,maxWidth:300,textAlign:'center'}}>{this.state.err.message}</div>
        <Btn onClick={()=>{this.setState({err:null});window.location.reload();}}>Reload</Btn>
      </div>
    );
  }
}

/* --- STYLES ------------------------------------------------------- */
const S = {
  center: {height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,gap:16,fontFamily:FF,padding:20},
  inp: (x={}) => ({width:'100%',background:C.surf,border:BDR,borderRadius:10,padding:'12px 14px',color:C.txt,fontSize:15,outline:'none',fontFamily:FF,boxSizing:'border-box',...x}),
  lbl: {fontSize:11,fontWeight:700,color:C.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5,display:'block'},
  card: (x={}) => ({background:C.card,border:BDR,borderRadius:14,padding:16,boxShadow:'0 3px 14px rgba(18,18,18,0.08)',...x}),
  err: {background:`${C.red}12`,border:`1.5px solid ${C.red}55`,borderRadius:8,padding:'10px 14px',color:C.red,fontSize:13,marginBottom:14},
};

const APP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.txt};font-family:${FF};overscroll-behavior:none;-webkit-font-smoothing:antialiased;font-size:15px}
  input,select,textarea,button{font-family:${FF}}
  input::placeholder,textarea::placeholder{color:${C.dim}}
  select option{background:${C.surf};color:${C.txt}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes heroPulse{0%,100%{opacity:0.45;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
  ::-webkit-scrollbar{width:0}
  a:focus-visible,button:focus-visible{outline:2px solid ${C.acc};outline-offset:2px}
`;

const LEGAL_ROUTES = new Set(['privacy','terms','refund','payment']);

/** First path segment only; empty for `/` — never treat home as a legal page. */
function legalSegment() {
  const seg = window.location.pathname.replace(/^\/+|\/+$/g,'').split('/')[0];
  return seg || '';
}

function isLegalRoute() {
  return LEGAL_ROUTES.has(legalSegment());
}

/* --- PRIMITIVES --------------------------------------------------- */
function Spin({size=20}) {
  return <div style={{width:size,height:size,border:`2px solid ${C.bdr}`,borderTop:`2px solid ${C.acc}`,borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>;
}

function Btn({children,onClick,v='primary',full,disabled,sm,style}) {
  const b={borderRadius:11,fontFamily:FF,fontWeight:700,cursor:disabled?'not-allowed':'pointer',width:full?'100%':'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,opacity:disabled?.6:1,border:'none',padding:sm?'8px 14px':'13px 22px',fontSize:sm?12:15,transition:'opacity .15s',...style};
  const vs={primary:{...b,background:disabled?C.deep:C.acc,color:disabled?C.dim:'#fff',boxShadow:disabled?'none':'0 4px 16px rgba(214,58,86,0.35)'},outline:{...b,background:'transparent',color:C.acc,border:`1.5px solid ${C.acc}`,boxShadow:'none'},ghost:{...b,background:C.gls,color:C.txt,border:BDR,boxShadow:'none'},secondary:{...b,background:C.deep,color:C.txt,border:BDR,boxShadow:'none'},danger:{...b,background:disabled?C.deep:C.red,color:disabled?C.dim:'#fff',boxShadow:'none'}};
  return <button onClick={onClick} disabled={disabled} style={vs[v]||vs.primary}>{children}</button>;
}

function Field({label,req,note,children}) {
  return (
    <div style={{marginBottom:13}}>
      {label && <label style={S.lbl}>{label}{req&&<span style={{color:C.acc}}> *</span>}</label>}
      {children}
      {note && <div style={{fontSize:11,color:C.dim,marginTop:3}}>{note}</div>}
    </div>
  );
}

function Badge({label,color}) {
  return <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:99,fontSize:11,fontWeight:600,padding:'2px 10px',display:'inline-block'}}>{label}</span>;
}

function HomeModelCard({ svc, onClick, compact, index = 0, hero }) {
  const theme = SVC_CARD_THEME[svc.id] || SVC_CARD_THEME.legal;
  const meta = HOME_CARD_META[svc.id] || {};
  const d = SVC_DETAIL[svc.id] || {};
  const title = SVC_SHORT[svc.id] ? `${SVC_SHORT[svc.id]} services` : svc.name;
  const imgH = compact ? 72 : hero ? 168 : 132;

  if (hero && !compact) {
    return (
      <div onClick={onClick} style={{ gridColumn:'1 / -1', borderRadius:20, overflow:'hidden', cursor:'pointer', border:'2px solid transparent', background:`linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, ${theme.b1}, ${theme.b2}) border-box`, boxShadow:`0 12px 32px ${theme.glow}`, animation:`fadeUp .4s ease ${index * 0.04}s both` }}>
        <div style={{ display:'flex', alignItems:'stretch', minHeight:168, background:`linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)` }}>
          <div style={{ flex:1, padding:'18px 18px 16px', display:'flex', flexDirection:'column', justifyContent:'center', gap:7 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {svc.household && <span style={{ background:C.acc, color:'#fff', fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:99 }}>✨ MOST LOVED</span>}
              {svc.cloud && <span style={{ background:theme.b2, color:'#fff', fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:99 }}>☁️ ENTERPRISE</span>}
              {theme.tag && !svc.household && !svc.cloud && <span style={{ background:theme.b2, color:'#fff', fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:99 }}>{theme.tag}</span>}
              <span style={{ background:'#fef3c7', color:'#b45309', fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:99 }}>25% OFF</span>
            </div>
            <div style={{ color:theme.b2, fontSize:12, fontWeight:700, fontStyle:'italic', lineHeight:1.35 }}>&ldquo;{meta.commitment}&rdquo;</div>
            <div style={{ color:C.txt, fontWeight:800, fontSize:18, lineHeight:1.2 }}>{title}</div>
            <div style={{ color:C.sub, fontSize:11, fontWeight:600 }}>{meta.face}</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginTop:2 }}>
              <span style={{ color:C.acc, fontSize:14, fontWeight:800 }}>From ₹{fmtRs(svc.price)} →</span>
              <span style={{ color:C.dim, fontSize:10, fontWeight:600 }}>
                {d.rating||'4.8 ⭐'} · {subSvcCount(svc) ? `${subSvcCount(svc)} options` : (d.turnaround?.split(' ').slice(0, 2).join(' ') || 'Same day')}
              </span>
            </div>
          </div>
          <div style={{ width:148, flexShrink:0, position:'relative' }}>
            <img src={theme.img} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 12%' }} />
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(90deg, ${theme.bgFrom} 0%, transparent 42%)` }} />
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div onClick={onClick} style={{ borderRadius:14, overflow:'hidden', cursor:'pointer', border:BDR, background:C.card, boxShadow:'0 4px 16px rgba(18,18,18,0.06)', animation:`fadeUp .35s ease ${index * 0.04}s both`, display:'flex', alignItems:'stretch' }}>
        <div style={{ width:72, flexShrink:0, position:'relative' }}>
          <img src={theme.img} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 15%' }} />
        </div>
        <div style={{ flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', justifyContent:'center', gap:3 }}>
          <div style={{ color:theme.b2, fontSize:10, fontWeight:700, fontStyle:'italic', lineHeight:1.3 }}>&ldquo;{meta.commitment}&rdquo;</div>
          <div style={{ color:C.txt, fontWeight:800, fontSize:13 }}>{title}</div>
          <span style={{ color:C.acc, fontSize:11, fontWeight:800 }}>From ₹{fmtRs(svc.price)} →</span>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{ borderRadius:16, overflow:'hidden', cursor:'pointer', border:'2px solid transparent', background:`linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg, ${theme.b1}, ${theme.b2}) border-box`, boxShadow:`0 8px 22px ${theme.glow}`, animation:`fadeUp .35s ease ${index * 0.04}s both`, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'relative', height:imgH, flexShrink:0, background:theme.bgFrom }}>
        <img src={theme.img} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center 12%' }} />
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 35%, rgba(18,18,18,0.55) 100%)' }} />
        <div style={{ position:'absolute', top:8, left:8, display:'flex', gap:4, flexWrap:'wrap' }}>
          {theme.tag && <span style={{ background:theme.b2, color:'#fff', fontSize:8, fontWeight:800, padding:'2px 7px', borderRadius:99 }}>{theme.tag}</span>}
          <span style={{ background:'rgba(255,255,255,0.92)', color:'#b45309', fontSize:8, fontWeight:800, padding:'2px 7px', borderRadius:99 }}>25% OFF</span>
        </div>
        <div style={{ position:'absolute', bottom:8, left:10, right:10, color:'#fff', fontSize:10, fontWeight:600, textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>{meta.face}</div>
      </div>
      <div style={{ padding:'11px 12px 13px', background:`linear-gradient(180deg, ${theme.bgFrom} 0%, #fff 100%)`, display:'flex', flexDirection:'column', gap:5, flex:1 }}>
        <div style={{ color:theme.b2, fontSize:11, fontWeight:700, fontStyle:'italic', lineHeight:1.35 }}>&ldquo;{meta.commitment}&rdquo;</div>
        <div style={{ color:C.txt, fontWeight:800, fontSize:14, lineHeight:1.2 }}>{title}</div>
        <div style={{ color:C.sub, fontSize:10, fontWeight:600, lineHeight:1.3 }}>{svc.sub}</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginTop:'auto' }}>
          <span style={{ color:C.acc, fontSize:12, fontWeight:800 }}>₹{fmtRs(svc.price)} →</span>
          <span style={{ color:C.dim, fontSize:9, fontWeight:600 }}>{d.rating||'4.8 ⭐'}</span>
        </div>
      </div>
    </div>
  );
}

/** Auto-rotating hero carousel — slides all service cards right to left */
function HomeHeroCarousel({ services, onSelect, intervalMs = 4500 }) {
  const [idx, setIdx] = useState(0);
  const n = services.length;
  const pauseRef = useRef(false);

  useEffect(() => {
    if (n <= 1) return undefined;
    const id = setInterval(() => {
      if (!pauseRef.current) setIdx(i => (i + 1) % n);
    }, intervalMs);
    return () => clearInterval(id);
  }, [n, intervalMs]);

  if (!n) return null;

  return (
    <div
      style={{ marginBottom: 14 }}
      onMouseEnter={() => { pauseRef.current = true; }}
      onMouseLeave={() => { pauseRef.current = false; }}
      onTouchStart={() => { pauseRef.current = true; }}
      onTouchEnd={() => { setTimeout(() => { pauseRef.current = false; }, 2800); }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ color:C.dim, fontSize:10, fontWeight:800, letterSpacing:'0.07em', textTransform:'uppercase' }}>Featured · swipe of care</div>
        <div style={{ color:C.dim, fontSize:10, fontWeight:700 }}>{idx + 1} / {n}</div>
      </div>
      <div style={{ overflow:'hidden', borderRadius:20 }}>
        <div
          style={{
            display:'flex',
            transform:`translateX(-${idx * 100}%)`,
            transition:'transform 0.72s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {services.map((svc, i) => (
            <div key={svc.id} style={{ minWidth:'100%', flexShrink:0 }}>
              <HomeModelCard svc={svc} onClick={() => onSelect(svc)} hero index={i} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:10 }}>
        {services.map((svc, i) => (
          <button
            key={svc.id}
            type="button"
            aria-label={`Show ${svc.name}`}
            onClick={() => setIdx(i)}
            style={{
              width: i === idx ? 18 : 7,
              height: 7,
              borderRadius: 99,
              border:'none',
              padding:0,
              cursor:'pointer',
              background: i === idx ? C.acc : `${C.dim}55`,
              transition:'width 0.25s ease, background 0.25s ease',
              animation: i === idx ? 'heroPulse 2.4s ease-in-out infinite' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** @deprecated use HomeModelCard — v1 backup in src/backup/homecards_v1.js */
function ServiceFeaturedCard(props) { return <HomeModelCard {...props} hero={props.fullWidth && props.svc?.household} />; }

function CategoryPill({ categoryId, theme, sm }) {
  const t = SUB_CATEGORIES[categoryId]?.themes?.[theme];
  if (!t) return null;
  return (
    <span style={{ background: t.bg, color: t.color, border: `1.5px solid ${t.border}`, borderRadius: 99, fontSize: sm ? 9 : 10, fontWeight: 800, padding: sm ? '2px 8px' : '3px 10px' }}>
      {t.label}
    </span>
  );
}
function HhCategoryPill({ theme, sm }) { return <CategoryPill categoryId="household" theme={theme} sm={sm} />; }
function CloudCategoryPill({ theme, sm }) { return <CategoryPill categoryId="cloud" theme={theme} sm={sm} />; }

function PriceTag({ svc, sm }) {
  const mrp = svc.mrp || Math.round((svc.price || 0) / (1 - DISC_PCT));
  const unit = svc.unit === 'hour' ? '/hr' : svc.unit === 'month' ? '/mo' : svc.unit === 'project' ? '/project' : svc.unit === 'course' ? '/course' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: C.dim, fontSize: sm ? 10 : 11, textDecoration: 'line-through', fontWeight: 600 }}>₹{fmtRs(mrp)}{unit}</span>
      <span style={{ color: C.acc, fontSize: sm ? 13 : 15, fontWeight: 800 }}>₹{fmtRs(svc.price || 0)}{unit}</span>
      <span style={{ background: '#fef3c7', color: '#b45309', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>25% OFF</span>
    </div>
  );
}

function ServiceThumb({ svc, height = 100 }) {
  if (svc.img) {
    return (
      <img
        src={svc.img}
        alt=""
        loading="lazy"
        style={{ width: '100%', height, objectFit: 'cover', objectPosition: 'center 15%', borderRadius: 10, display: 'block' }}
      />
    );
  }
  return (
    <div style={{ width: '100%', height, borderRadius: 10, background: C.deep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: height * 0.4 }}>
      {svc.icon}
    </div>
  );
}

function CategorySvcCard({ categoryId, svc, onClick, compact }) {
  const cfg = SUB_CATEGORIES[categoryId];
  const t = cfg?.themes?.[svc.theme] || Object.values(cfg?.themes || {})[0] || { bg: C.surf, border: C.bdr };
  return (
    <div onClick={onClick} style={{ ...S.card(), padding: 0, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${t.border}` }}>
      <ServiceThumb svc={svc} height={compact ? 96 : 112} />
      <div style={{ padding: compact ? '10px 10px 12px' : '12px 12px 14px', background: t.bg }}>
        <div style={{ marginBottom: 6 }}><CategoryPill categoryId={categoryId} theme={svc.theme} sm={compact} /></div>
        <div style={{ color: C.txt, fontWeight: 800, fontSize: compact ? 12 : 13, lineHeight: 1.3, marginBottom: 3 }}>{svc.name}</div>
        <div style={{ color: C.sub, fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>{svc.sub}</div>
        <PriceTag svc={svc} sm={compact} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.gold, fontSize: 10, fontWeight: 700 }}>{svc.rating}</span>
          <span style={{ color: C.dim, fontSize: 10 }}>· {svc.turnaround}</span>
        </div>
      </div>
    </div>
  );
}
function HouseholdSvcCard(props) { return <CategorySvcCard categoryId="household" {...props} />; }
function CloudSvcCard(props) { return <CategorySvcCard categoryId="cloud" {...props} />; }

function CategoryListBody({ categoryId, onSelect }) {
  const cfg = SUB_CATEGORIES[categoryId];
  const [filter, setFilter] = useState('all');
  if (!cfg) return null;
  const list = cfg.svcs.filter(s => filter === 'all' || s.theme === filter);
  const accent = SVC_CARD_THEME[categoryId]?.b2 || C.acc;
  const pills = [['all', 'All', accent, C.surf], ...cfg.themeOrder.map(k => [k, cfg.themes[k].label, cfg.themes[k].color, cfg.themes[k].bg])];
  return (
    <div style={{ padding: '14px 16px 24px', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {pills.map(([k, l, col, bg]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '8px 14px', borderRadius: 99, border: filter === k ? `2px solid ${col}` : BDR, background: filter === k ? bg : C.surf, color: filter === k ? col : C.sub, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: FF }}>
            {l}
          </button>
        ))}
      </div>
      {cfg.themeOrder.map(theme => {
        const items = list.filter(s => s.theme === theme);
        if (!items.length) return null;
        const t = cfg.themes[theme];
        return (
          <div key={theme} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <CategoryPill categoryId={categoryId} theme={theme} />
              <span style={{ color: C.dim, fontSize: 11, fontWeight: 600 }}>{t.tagline}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {items.map(svc => <CategorySvcCard key={svc.id} categoryId={categoryId} svc={svc} onClick={() => onSelect(svc)} compact />)}
            </div>
          </div>
        );
      })}
      <AssistBanner />
    </div>
  );
}
function HouseholdListBody(props) { return <CategoryListBody categoryId="household" {...props} />; }
function CloudListBody(props) { return <CategoryListBody categoryId="cloud" {...props} />; }

function ServiceSearchResults({ query, categories, onCategory, onSubSvc, renderCategory, ...searchSubs }) {
  const q = query.trim();
  if (!q) return null;
  const subBlocks = Object.entries(SUB_CATEGORIES)
    .map(([id, cfg]) => ({ id, title: cfg.title, items: searchSubs[id] || [] }))
    .filter(b => b.items.length > 0);
  const total = categories.length + subBlocks.reduce((a, b) => a + b.items.length, 0);
  if (!total) {
    return (
      <div style={{ ...S.card(), padding: 24, textAlign: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
        <div style={{ color: C.txt, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No services found</div>
        <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.5 }}>Try &ldquo;kitchen clean&rdquo;, &ldquo;doctor home&rdquo;, &ldquo;legal&rdquo;, or &ldquo;tiffin&rdquo;</div>
      </div>
    );
  }
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: C.txt, fontSize: 16, fontWeight: 800, marginBottom: 3 }}>Search results</div>
        <div style={{ color: C.dim, fontSize: 12, fontWeight: 500 }}>{total} found for &ldquo;{q}&rdquo;</div>
      </div>
      {subBlocks.map(({ id, title, items }) => (
        <div key={id} style={{ marginBottom: 16 }}>
          <div style={{ color: C.txt, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{title} · {items.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {items.map(svc => <CategorySvcCard key={svc.id} categoryId={id} svc={svc} onClick={() => onSubSvc(id, svc)} compact />)}
          </div>
        </div>
      ))}
      {categories.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {subBlocks.length > 0 && <div style={{ color: C.txt, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Categories · {categories.length}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {categories.map((s, i) => renderCategory(s, i))}
          </div>
        </div>
      )}
    </>
  );
}

function Toast({toasts}) {
  return (
    <div style={{position:'fixed',top:16,right:16,zIndex:9999,display:'flex',flexDirection:'column',gap:8,maxWidth:300,width:'90vw'}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:t.type==='error'?`${C.red}22`:t.type==='success'?`${C.grn}22`:`${C.cyan}22`,border:`1px solid ${t.type==='error'?C.red:t.type==='success'?C.grn:C.cyan}`,borderRadius:10,padding:'12px 16px',fontSize:13,color:C.txt}}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function AssistBanner() {
  return (
    <a href={`tel:${ASSIST.replace(/-/g,'')}`} style={{display:'flex',alignItems:'center',gap:12,background:C.surf,border:'1.5px solid #f0c040',borderRadius:12,padding:'12px 14px',textDecoration:'none',marginBottom:16,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
      <span style={{fontSize:22}}>📞</span>
      <div><div style={{color:C.txt,fontSize:13,fontWeight:700}}>Need help booking?</div><div style={{color:C.sub,fontSize:11}}>{ASSIST} · Call our team</div></div>
      <div style={{marginLeft:'auto',background:C.acc,color:'#fff',fontSize:11,fontWeight:800,padding:'8px 12px',borderRadius:8,boxShadow:'0 4px 12px rgba(214,58,86,0.3)'}}>Call</div>
    </a>
  );
}

function GuestBottomNav({ screen, setScreen, addToast }) {
  const active = screen==='services' ? 'home' : 'services';
  const tabs = [
    {id:'home', icon:'🏠', label:'Home', go:()=>setScreen('services')},
    {id:'services', icon:'🔍', label:'Services', go:()=>setScreen('services')},
    {id:'bookings', icon:'📅', label:'Bookings', go:()=>addToast?.('Book & verify to see your bookings here','info')},
    {id:'profile', icon:'👤', label:'Profile', go:()=>setScreen('login')},
  ];
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,maxWidth:480,margin:'0 auto',background:C.surf,borderTop:BDR,display:'flex',padding:'8px 0 calc(8px + env(safe-area-inset-bottom,0px))',boxShadow:'0 -4px 16px rgba(18,18,18,0.08)',zIndex:50}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={t.go} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'4px 0'}}>
          <span style={{fontSize:20}}>{t.icon}</span>
          <span style={{fontSize:10,fontWeight:700,fontFamily:FF,color:active===t.id?C.acc:C.dim}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function StickyCta({ children, onClick }) {
  return (
    <div style={{position:'fixed',bottom:64,left:0,right:0,maxWidth:480,margin:'0 auto',padding:'10px 16px',background:`linear-gradient(transparent, ${C.bg} 40%)`,zIndex:40}}>
      <button onClick={onClick} style={{width:'100%',background:C.acc,color:'#fff',border:'none',borderRadius:12,padding:14,fontSize:15,fontWeight:800,fontFamily:FF,cursor:'pointer',boxShadow:'0 6px 20px rgba(214,58,86,0.4)'}}>{children}</button>
    </div>
  );
}

/* --- DEVICE / IP / GEO UTILS -------------------------------------- */
function detectDevice() {
  const ua = navigator.userAgent;
  const mob = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const tab = /iPad|Tablet/i.test(ua)||(mob&&window.innerWidth>600);
  let os='Unknown', osv='';
  if (/Windows NT 10/i.test(ua))  { os='Windows'; osv='10/11'; }
  else if (/Android/i.test(ua))   { os='Android'; const m=ua.match(/Android ([\d.]+)/); osv=m?m[1]:''; }
  else if (/iPhone/i.test(ua))    { os='iOS'; const m=ua.match(/OS ([\d_]+)/); osv=m?m[1].replace(/_/g,'.'):'';}
  else if (/iPad/i.test(ua))      { os='iPadOS'; }
  else if (/Mac OS X/i.test(ua))  { os='macOS'; }
  else if (/Linux/i.test(ua))     { os='Linux'; }
  let br='Unknown', brv='';
  if (/CriOS\/([\d.]+)/i.test(ua))      { br='Chrome iOS';  brv=ua.match(/CriOS\/([\d.]+)/i)?.[1]||''; }
  else if (/FxiOS/i.test(ua))           { br='Firefox iOS'; }
  else if (/SamsungBrowser\/([\d.]+)/i.test(ua)) { br='Samsung Browser'; brv=ua.match(/SamsungBrowser\/([\d.]+)/i)?.[1]||''; }
  else if (/OPR\/([\d.]+)/i.test(ua))   { br='Opera'; brv=ua.match(/OPR\/([\d.]+)/i)?.[1]||''; }
  else if (/Edg\/([\d.]+)/i.test(ua))   { br='Edge';  brv=ua.match(/Edg\/([\d.]+)/i)?.[1]||''; }
  else if (/Chrome\/([\d.]+)/i.test(ua))  { br='Chrome'; brv=ua.match(/Chrome\/([\d.]+)/i)?.[1]||''; }
  else if (/Safari\/([\d.]+)/i.test(ua))  { br='Safari'; brv=ua.match(/Version\/([\d.]+)/i)?.[1]||''; }
  else if (/Firefox\/([\d.]+)/i.test(ua)) { br='Firefox'; brv=ua.match(/Firefox\/([\d.]+)/i)?.[1]||''; }
  const conn = navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  return {
    deviceType: tab?'Tablet':mob?'Mobile':'Desktop',
    osName:os, osVersion:osv,
    browser:br, browserVersion:brv,
    screenRes:`${window.screen.width}×${window.screen.height}`,
    colorDepth: window.screen.colorDepth||0,
    pixelRatio: window.devicePixelRatio||1,
    touchPoints: navigator.maxTouchPoints||0,
    language: navigator.language||'en',
    languages: (navigator.languages||[navigator.language||'en']).join(','),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kolkata',
    cpuCores: navigator.hardwareConcurrency||0,
    deviceMemory: navigator.deviceMemory||0,
    connectionType: conn?.effectiveType||conn?.type||'unknown',
    userAgent: ua.slice(0,300),
  };
}

async function getIP() {
  try { const r=await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; }
  catch(e) { return 'unknown'; }
}

async function lookupPinByPlaceName(name, stateHint='Maharashtra') {
  if (!name || name.length < 3) return '';
  try {
    const r=await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(name)}`);
    const d=await r.json();
    if (!d?.[0]||d[0].Status!=='Success'||!d[0].PostOffice?.length) return '';
    const offices=d[0].PostOffice;
    const stateLow=(stateHint||'').toLowerCase();
    const nameLow=name.toLowerCase();
    const exact=offices.find(o=>o.Name?.toLowerCase()===nameLow&&(!stateLow||o.State?.toLowerCase().includes(stateLow.slice(0,4))));
    if (exact?.Pincode) return exact.Pincode;
    const inState=offices.find(o=>!stateLow||o.State?.toLowerCase()===stateLow||o.State?.toLowerCase().includes(stateLow.slice(0,4)));
    if (inState?.Pincode) return inState.Pincode;
    return offices[0]?.Pincode||'';
  } catch(e) { return ''; }
}

async function reverseGeo(lat,lng) {
  try {
    // Nominatim for address text — zoom=18 for locality; OSM postcodes are often wrong in India
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en&zoom=18&addressdetails=1`,{
      headers:{'User-Agent':'ScanV/5.5 (https://scanv-tau.vercel.app; dcoreglobal.com)'}
    });
    const d=await r.json(); const a=d.address||{};
    const state=a.state||'Maharashtra';
    const isIndia=(a.country_code==='in')||(a.country==='India');

    let pincode='';
    if (isIndia) {
      const places=[a.village,a.suburb,a.neighbourhood,a.town,a.city_district]
        .filter(Boolean)
        .filter((v,i,arr)=>arr.indexOf(v)===i);
      for (const place of places) {
        pincode=await lookupPinByPlaceName(place,state);
        if (/^\d{6}$/.test(pincode)) break;
        pincode='';
      }
    }
    if (!pincode) pincode=(a.postcode||'').replace(/\D/g,'').slice(0,6);

    const street=[a.house_number,a.road].filter(Boolean).join(' ').trim();
    const locality=[a.suburb,a.village,a.neighbourhood].filter(Boolean).filter((v,i,arr)=>arr.indexOf(v)===i);
    const address=street
      ? [street,...locality].join(', ')
      : (d.display_name?.split(',').slice(0,4).join(',').trim()||'');

    return {
      address,
      village: a.village||a.suburb||a.neighbourhood||a.town||'',
      city: a.city||a.state_district||a.town||a.county?.replace(/\s*Subdistrict$/i,'')||'Pune',
      state,
      pincode,
      country: a.country||'India',
      lat,lng,
    };
  } catch(e) { return {address:'',village:'',city:'Pune',state:'Maharashtra',pincode:'',country:'India',lat,lng}; }
}

/* --- CANVAS FINGERPRINT ------------------------------------------- */
function getCanvasFP() {
  try {
    const c=document.createElement('canvas'); c.width=200; c.height=50;
    const ctx=c.getContext('2d');
    ctx.textBaseline='top'; ctx.font="14px 'DM Sans'";
    ctx.fillStyle='#e94560'; ctx.fillRect(0,0,200,50);
    ctx.fillStyle='#f0f0f0'; ctx.fillText('ScanV🔧📍',2,2);
    return c.toDataURL().slice(-50);
  } catch(e) { return 'unavailable'; }
}

/* --- BATTERY API -------------------------------------------------- */
async function getBattery() {
  try {
    if (!navigator.getBattery) return {level:null,charging:null};
    const b=await navigator.getBattery();
    return {level:Math.round(b.level*100)/100, charging:b.charging};
  } catch(e) { return {level:null,charging:null}; }
}

/* --- OTP: FAST2SMS (India) --------------------------------------- */
// 2Factor.in -- India OTP SMS (works instantly, no verification needed)
// Get free API key: https://2factor.in/cp/ → API → Copy key
const TWOFACTOR_KEY = '2e5ec291-9406-11f1-908b-0200cd936042';
// Fast2SMS (blocked until website verified + ₹100 recharge -- keep for later)
const FAST2SMS_KEY  = 'qT5XNR8YLirx6unhwDIcyAVm9WajkMldotCHGzgKvpe2Q03sP7JetNE75xFYRpgsdcH6qL3fyvr8Pm1z';

function emptyOtpDigits() { return ['','','','','','']; }

function OtpSentFooter({ mobile, onChangeNumber, onResend, loading }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: C.grn, fontSize: 12, marginBottom: 10, fontWeight: 700, textAlign: 'center' }}>✅ OTP sent to +91 {mobile}</div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={onChangeNumber} style={{ background: 'none', border: 'none', color: C.cyan, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}>Change number</button>
        <button type="button" onClick={onResend} disabled={loading} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: FF, opacity: loading ? 0.5 : 1 }}>{loading ? 'Sending…' : 'Resend OTP'}</button>
      </div>
    </div>
  );
}

async function invokeSendOtp(mobile) {
  const norm = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g,'').slice(-10)}`;
  const r = await sb().functions.invoke('send-otp', { body: { mobile: norm } });
  if (r.error) throw new Error(r.error.message || 'OTP service unavailable');
  if (r.data?.success || r.data?.provider) return { ...r.data, mobile: norm };
  throw new Error(r.data?.error || r.data?.message || 'OTP send failed — check number and try again');
}

async function verifyOtpCode(mobile, code) {
  const norm = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g,'').slice(-10)}`;
  try {
    const r = await sb().functions.invoke('send-otp', { body: { mobile: norm, otp: code, action: 'verify' } });
    if (r.data?.success) return true;
  } catch (_) {}
  return verifyCustomOTP(norm, code);
}

async function sendSMSViaSB(mobile, otp) {
  // Store OTP in DB first
  await sb().from('custom_otp').insert({
    mobile, otp,
    expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
  }).then(()=>{}).catch(e=>console.warn('[OTP DB]',e.message));
}

// SMS sent via Supabase Edge Function send-otp (server-side, no CORS)

/* --- WHATSAPP VERIFICATION (outbound message → user replies) --- */

async function invokeWA(action, payload) {
  const r = await sb().functions.invoke('whatsapp-verify', {
    body: { action, ...payload }
  });
  if (r.error) {
    const msg = r.error.message || '';
    const unavailable = /404|not found|failed to fetch|function.*not|non-2xx/i.test(msg);
    throw new Error(unavailable ? 'WhatsApp verification is temporarily unavailable' : (msg || 'WhatsApp service error'));
  }
  if (r.data?.error) throw new Error(r.data.error);
  return r.data;
}

async function generateWAToken(mobile) {
  const data = await invokeWA('generate', { mobile });
  if (!data?.token) throw new Error('Could not generate WhatsApp token');
  return data;
}

async function checkWAVerified(token) {
  return invokeWA('check', { token });
}

/** Start WA verify: server sends outbound message, poll until user replies */
async function startWAVerify(mobile, onVerified, { setWaToken, setWaChecking, setOtpSent, onUnavailable }) {
  try {
    const data = await generateWAToken(mobile);
    if (!data?.messageSent) {
      onUnavailable?.(data?.sendError || 'Could not send WhatsApp message');
      return false;
    }
    setWaToken(data.token);
    setOtpSent(true);
    setWaChecking(true);
    const poll = setInterval(async () => {
      try {
        const res = await checkWAVerified(data.token);
        if (res?.verified) {
          clearInterval(poll);
          setWaChecking(false);
          await onVerified();
        }
      } catch (_) { /* keep polling until timeout */ }
    }, 3000);
    setTimeout(() => { clearInterval(poll); setWaChecking(false); }, 600000);
    return true;
  } catch (e) {
    onUnavailable?.(e.message || 'WhatsApp verification is temporarily unavailable');
    return false;
  }
}

function WaSentPanel({ mobile10, token, waChecking, onUseSms }) {
  return (
    <div style={{background:'#e8f8ef',border:'1.5px solid #25D366',borderRadius:12,padding:14,textAlign:'center'}}>
      <div style={{color:'#128C7E',fontSize:13,fontWeight:700,marginBottom:8}}>💬 Check your WhatsApp</div>
      <div style={{color:C.sub,fontSize:12,lineHeight:1.7,marginBottom:10}}>
        We sent a verification message to <strong style={{color:C.txt}}>+91 {mobile10}</strong>.<br/>
        Reply <strong style={{color:'#128C7E'}}>VERIFY {token}</strong> to confirm.
      </div>
      {waChecking&&<div style={{fontSize:11,color:C.dim,fontWeight:600,marginBottom:10}}>⏳ Waiting for your reply…</div>}
      <button type="button" onClick={onUseSms}
        style={{background:'none',border:'none',color:C.acc,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:FF}}>
        📱 Use SMS OTP instead →
      </button>
    </div>
  );
}

async function generateAndSendOTP(mobile) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  // Invalidate old OTPs for this mobile
  await sb().from('custom_otp').update({used:true}).eq('mobile', mobile).eq('used', false);
  await sendSMSViaSB(mobile, otp);
  return otp; // returned so app can show it as fallback during dev
}

async function verifyCustomOTP(mobile, enteredOtp) {
  const { data, error } = await sb().from('custom_otp')
    .select('*')
    .eq('mobile', mobile)
    .eq('otp', enteredOtp)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', {ascending:false})
    .limit(1)
    .single();
  if (error || !data) return false;
  // Mark used
  await sb().from('custom_otp').update({used:true}).eq('id', data.id);
  return true;
}

/* ================================================================
   QR CODE GENERATOR COMPONENT
================================================================ */
function QRCodeDisplay({ url, size=220 }) {
  // QR via Google Charts API (reliable, no library needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=0d0f1a&color=e94560&margin=10&format=png&qzone=2`;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{background:'#0d0f1a',borderRadius:16,padding:12,border:`2px solid ${C.acc}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <img src={qrUrl} alt="ScanV QR Code" width={size} height={size} style={{borderRadius:8,display:'block'}}
          onError={e=>{e.target.style.display='none'; e.target.nextSibling.style.display='block';}}/>
        <div style={{display:'none',color:C.sub,fontSize:12,padding:20,textAlign:'center'}}>
          QR service unavailable.<br/>Scan:<br/><code style={{color:C.acc,fontSize:10}}>{url}</code>
        </div>
      </div>
      <div style={{fontSize:11,color:C.sub,textAlign:'center',lineHeight:1.6}}>
        📱 Scan with any camera app<br/>
        <span style={{color:C.acc,fontWeight:600}}>{url}</span>
      </div>
    </div>
  );
}

/* ================================================================
   QR LANDING PAGE -- shown when ?qr=1 in URL
   Captures maximum data on scan
================================================================ */
function QRLandingPage({ onContinue }) {
  const [loading, setLoading] = useState(true);
  const [scanId, setScanId]   = useState(null);
  const [gpsMsg, setGpsMsg]   = useState('Detecting location…');

  useEffect(()=>{
    (async()=>{
      const dev     = detectDevice();
      const battery = await getBattery();
      const canvasFP = getCanvasFP();
      const ip      = await getIP();
      const params  = new URLSearchParams(window.location.search);

      // Store everything immediately on QR scan
      const scanData = {
        ip_address:      ip,
        device_type:     dev.deviceType,
        os_name:         dev.osName,
        os_version:      dev.osVersion,
        browser:         dev.browser,
        browser_version: dev.browserVersion,
        screen_res:      dev.screenRes,
        color_depth:     dev.colorDepth,
        pixel_ratio:     dev.pixelRatio,
        touch_points:    dev.touchPoints,
        language:        dev.language,
        languages:       dev.languages,
        timezone:        dev.timezone,
        cpu_cores:       dev.cpuCores,
        device_memory:   dev.deviceMemory,
        connection_type: dev.connectionType,
        canvas_fp:       canvasFP,
        battery_level:   battery.level,
        battery_charging:battery.charging,
        user_agent:      dev.userAgent,
        utm_source:      params.get('utm_source')||'qr',
        utm_medium:      params.get('utm_medium')||'print',
        referrer:        document.referrer||'',
        consent_given:   true,
        consent_at:      new Date().toISOString(),
      };

      const { data:vs } = await sb().from('qr_scans').insert(scanData).select('id').single();
      if (vs?.id) setScanId(vs.id);

      // Now get GPS
      setGpsMsg('Getting your location…');
      navigator.geolocation.getCurrentPosition(
        async pos=>{
          const geo = await reverseGeo(pos.coords.latitude, pos.coords.longitude);
          setGpsMsg(`📍 ${geo.village||geo.city}`);
          if (vs?.id) {
            await sb().from('qr_scans').update({
              lat:pos.coords.latitude, lng:pos.coords.longitude,
              address:geo.address, village:geo.village, city:geo.city,
              state:geo.state, pincode:geo.pincode, country:geo.country,
            }).eq('id', vs.id);
          }
          setLoading(false);
          setTimeout(()=> onContinue(vs?.id, dev, ip, geo, pos.coords), 800);
        },
        ()=>{
          setGpsMsg('Location unavailable');
          setLoading(false);
          setTimeout(()=> onContinue(vs?.id, dev, ip, null, null), 800);
        },
        {timeout:8000, enableHighAccuracy:true, maximumAge:0}
      );
    })();
  },[]);

  return (
    <div style={S.center}>
      <div style={{fontSize:34,fontWeight:800,fontFamily:"'Space Grotesk',sans-serif"}}>
        <span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span>
      </div>
      <Spin size={36}/>
      <div style={{color:C.txt,fontSize:15,fontWeight:600}}>
        {loading?'Setting up for you…':'Ready!'}
      </div>
      <div style={{color:C.sub,fontSize:12}}>{gpsMsg}</div>
      <div style={{color:C.dim,fontSize:11,maxWidth:260,textAlign:'center'}}>
        Collecting your device & location details to show nearby services
      </div>
    </div>
  );
}

/* ================================================================
   BROWSE FLOW -- Services first, no registration wall
   User browses → picks service → books → THEN registers
================================================================ */
function BrowseFlow({ silentGeo, onRegistered, addToast }) {
  const [screen, setScreen] = useState('services'); // services | detail | verify | payment | schedule
  const [activeSvc, setActiveSvc] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [userId, setUserId] = useState(null);
  const [pendingProfile, setPendingProfile] = useState(null);
  const [txnId, setTxnId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Mini registration state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [mobile, setMobile]       = useState('');
  const [address, setAddress]     = useState(silentGeo?.address||'');
  const [village, setVillage]     = useState(silentGeo?.village||'');
  const [city, setCity]           = useState(silentGeo?.city||'');
  const [pincode, setPincode]     = useState(silentGeo?.pincode||'');
  const [otpSent, setOtpSent]     = useState(false);
  const [otpCode, setOtpCode]     = useState(['','','','','','']);
  const [otpTargetMobile, setOtpTargetMobile] = useState('');
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');
  const [bookGps, setBookGps]     = useState('idle'); // GPS state for book screen
  const [verifyMethod, setVerifyMethod] = useState('sms'); // 'sms' | 'whatsapp'
  const [search, setSearch]               = useState('');
  const [waToken, setWaToken]     = useState('');
  const [waChecking, setWaChecking] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(!!localStorage.getItem('scanv_terms_accepted'));
  const acceptTerms = () => { localStorage.setItem('scanv_terms_accepted', new Date().toISOString()); setTermsAccepted(true); };

  const browsePrice = activeSvc?.price || 50000;
  const browseFee = Math.round(browsePrice * FEE_PCT);
  const browseGst = Math.round((browsePrice + browseFee) * GST_RATE);
  const browseTotal = browsePrice + browseFee + browseGst;
  const browsePay = usePaymentVerification(
    screen === 'payment' ? txnId : null,
    screen === 'payment' ? browseTotal : 0,
    userId,
    addToast,
  );

  // Update address fields when GPS arrives
  useEffect(()=>{
    if (silentGeo) {
      setAddress(a=>a||silentGeo.address||'');
      setVillage(v=>v||silentGeo.village||'');
      setCity(c=>c||silentGeo.city||'Pune');
      setPincode(p=>p||silentGeo.pincode||'');
    }
  },[silentGeo]);

  const resetOtpFlow = () => {
    setOtpSent(false);
    setOtpCode(emptyOtpDigits());
    setOtpTargetMobile('');
    setWaToken('');
    setWaChecking(false);
  };

  const sendOTP = async (resend = false) => {
    if (!firstName.trim()) return setErr('Enter your first name');
    if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
    if (!address.trim()) return setErr('Enter your address');
    if (!city.trim()) return setErr('Enter your city');
    if (!pincode.trim()||pincode.length<6) return setErr('Enter valid 6-digit PIN code');
    if (!localStorage.getItem('scanv_terms_accepted')) return setErr('Please accept Terms & Conditions to continue');
    setLoading(true); setErr('');
    try {
      await invokeSendOtp(`+91${mobile}`);
      setOtpSent(true);
      setOtpTargetMobile(mobile);
      setOtpCode(emptyOtpDigits());
      if (resend) setErr('');
      addToast?.(resend ? `OTP resent to +91 ${mobile}` : `OTP sent to +91 ${mobile}`, 'success');
    } catch(e) { setErr(e.message||'Could not send OTP'); if (!resend) resetOtpFlow(); }
    finally { setLoading(false); }
  };

  const verifyProfile = async (waVerified=false) => {
    if (!waVerified) {
      const code = otpCode.join('');
      if (code.length<6) return setErr('Enter 6-digit OTP');
    }
    setLoading(true); setErr('');
    try {
      const mob = `+91${mobile}`;
      if (!waVerified) {
        const code = otpCode.join('');
        const ok = await verifyOtpCode(mob, code);
        if (!ok) throw new Error('Invalid OTP. Try again.');
      }

      const fakeEmail = `${mobile}@scanv.app`;
      const fakePass  = `ScanV_${mobile.slice(-4)}_${Date.now()}`;
      let uid;
      try {
        const {data:su,error:se} = await sb().auth.signUp({email:fakeEmail,password:fakePass});
        if (se?.message?.includes('already registered')) {
          const {data:si} = await sb().auth.signInWithPassword({email:fakeEmail,password:fakePass});
          uid = si?.user?.id;
        } else { uid = su?.user?.id; }
      } catch(e) {}
      if (!uid) { uid = localStorage.getItem('scanv_uid')||crypto.randomUUID(); localStorage.setItem('scanv_uid',uid); }

      const dev = detectDevice();
      const ip  = await getIP();

      await sb().from('profiles').upsert({
        id:uid, email:fakeEmail, name:`${firstName} ${lastName}`.trim(),
        first_name:firstName.trim(), last_name:lastName.trim(),
        phone:mob, address, village, city, pincode,
        ip_address:ip, last_lat:silentGeo?.lat||null, last_lng:silentGeo?.lng||null,
        device_type:dev.deviceType, os_name:dev.osName, browser:dev.browser,
        timezone:dev.timezone, language:dev.language,
        mobile_verified:true, mobile_verified_at:new Date().toISOString(),
        role:'customer', status:'active', avatar:'👤',
      },{onConflict:'id'});

      const prof = {id:uid,name:`${firstName} ${lastName}`.trim(),first_name:firstName,last_name:lastName,phone:mob,email:fakeEmail,role:'customer',status:'active',avatar:'👤',mobile_verified:true,city,village,pincode,device_type:dev.deviceType,os_name:dev.osName,browser:dev.browser,ip_address:ip};
      setUserId(uid);
      setPendingProfile(prof);
      setTxnId('TXN-'+Date.now());
      browsePay.setUpiOpened(false);
      browsePay.setPaymentVerified(false);
      setPaymentMethod(null);
      setScreen('payment');
    } catch(e) { setErr(e.message||'Verification failed.'); }
    finally { setLoading(false); }
  };

  /** Profile sign-in (guest bottom nav): OTP required every login, not on bookings */
  const loginProfile = async (waVerified=false) => {
    if (!waVerified) {
      const code = otpCode.join('');
      if (code.length<6) return setErr('Enter 6-digit OTP');
    }
    if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
    setLoading(true); setErr('');
    try {
      const mob = `+91${mobile}`;
      if (!waVerified) {
        const code = otpCode.join('');
        const ok = await verifyOtpCode(mob, code);
        if (!ok) throw new Error('Invalid OTP. Try again.');
      }
      const {data:existing} = await sb().from('profiles').select('*').eq('phone',mob).maybeSingle();
      if (!existing||!existing.first_name) throw new Error('No account found. Book a service first to create your profile.');
      await sb().from('profiles').update({mobile_verified:true,mobile_verified_at:new Date().toISOString()}).eq('id',existing.id);
      localStorage.setItem('scanv_uid',existing.id);
      const prof = {...existing,mobile_verified:true};
      addToast?.(`Welcome back, ${existing.first_name}!`,'success');
      onRegistered(prof);
    } catch(e) { setErr(e.message||'Sign-in failed.'); }
    finally { setLoading(false); }
  };

  const sendLoginOTP = async (resend = false) => {
    if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
    setLoading(true); setErr('');
    try {
      await invokeSendOtp(`+91${mobile}`);
      setOtpSent(true);
      setOtpTargetMobile(mobile);
      setOtpCode(emptyOtpDigits());
      if (resend) setErr('');
      addToast?.(resend ? `OTP resent to +91 ${mobile}` : `OTP sent to +91 ${mobile}`, 'success');
    } catch(e) { setErr(e.message||'Could not send OTP'); if (!resend) resetOtpFlow(); }
    finally { setLoading(false); }
  };

  const sendLoginWA = async () => {
    if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
    setLoading(true); setErr('');
    const ok = await startWAVerify(`+91${mobile}`, () => loginProfile(true), {
      setWaToken, setWaChecking, setOtpSent,
      onUnavailable: async (msg) => {
        setVerifyMethod('sms');
        setOtpSent(false);
        setWaToken('');
        setErr(`${msg} — use SMS OTP below`);
        try {
          await invokeSendOtp(`+91${mobile}`);
          setOtpSent(true);
          setOtpTargetMobile(mobile);
        } catch (_) {}
      },
    });
    setLoading(false);
  };

  const confirmPayment = (method) => {
    if (!browsePay.upiOpened && !browsePay.paymentVerified) { addToast?.('Pay via UPI first','error'); return; }
    setPaymentMethod(method);
    setScreen('schedule');
    addToast?.('Payment confirmed — pick date & time','success');
  };

  const createBooking = async () => {
    if (!bookingDetail?.date) return setErr('Select a date');
    if (!userId||!activeSvc||!txnId) return setErr('Session expired — start again');
    if (!paymentMethod) return setErr('Complete payment first');
    setLoading(true); setErr('');
    try {
      const svc = activeSvc;
      const price = svc.price||50000;
      const fee   = Math.round(price*FEE_PCT);
      const gst   = Math.round((price+fee)*GST_RATE);
      const total = price+fee+gst;
      const loc   = bookingDetail.loc||`${village}, ${city} ${pincode}`.trim();
      const {data:bk,error} = await sb().from('bookings').insert({
        customer_id:userId, service_name:svc.name,
        customer_name:`${firstName} ${lastName}`.trim(),
        customer_email:`${mobile}@scanv.app`,
        date:bookingDetail.date, time:bookingDetail.time||'10:00',
        notes:bookingDetail.notes||'', location_text:loc,
        price, platform_fee:fee, gst_amt:gst, total,
        status:'confirmed', txn_id:txnId,
        paid_at:new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      await sb().from('service_requests').insert({
        customer_id:userId, service_name:svc.name, service_type:svc.cat,
        preferred_date:bookingDetail.date, preferred_time:bookingDetail.time||'10:00',
        notes:bookingDetail.notes||'', location_text:loc,
        price, platform_fee:fee, gst_amount:gst, total,
        status:'new', txn_id:txnId, added_by:userId,
      });
      await sb().from('payments').insert({
        booking_id:bk.id, user_id:userId, amount:total,
        method:paymentMethod||'UPI', status:'success', txn_id:txnId, gateway:'Razorpay',
      }).catch(()=>{});
      invokeBookingDispatch({
        bookingId: bk.id,
        serviceId: svc.id || svc.parent || activeSvc?.id || '',
        serviceName: svc.name,
        lat: silentGeo?.lat || bookingDetail.lat || null,
        lng: silentGeo?.lng || bookingDetail.lng || null,
        location: loc,
        date: bookingDetail.date,
        time: bookingDetail.time || '10:00',
      });
      sessionStorage.setItem(TRACK_BOOKING_KEY, bk.id);
      onRegistered(pendingProfile, bk.id);
    } catch(e) { setErr(e.message||'Booking failed.'); }
    finally { setLoading(false); }
  };

  const browseWrap = (content, sticky=null) => (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:FF,display:'flex',flexDirection:'column',maxWidth:480,margin:'0 auto',paddingBottom:72}}>
      {content}
      {sticky}
      <GuestBottomNav screen={screen} setScreen={setScreen} addToast={addToast}/>
    </div>
  );

  const searchResult = searchAllServices(search);
  const { categories: svcList, ...searchSubs } = searchResult;
  const searching = !!search.trim();

  const openBrowseSvc = (s) => {
    if (SUB_CATEGORIES[s.id]) { setActiveSvc(s); setScreen(`${s.id}-list`); return; }
    setActiveSvc(s);
    setScreen('detail');
  };

  const openSubSvc = (catId, svc) => {
    const cfg = SUB_CATEGORIES[catId];
    setActiveSvc({ ...svc, cat: cfg?.cat || svc.cat, cash: false });
    setScreen('detail');
  };

  const listCatId = screen.endsWith('-list') ? screen.slice(0, -5) : null;
  if (listCatId && SUB_CATEGORIES[listCatId]) {
    const cfg = SUB_CATEGORIES[listCatId];
    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
          <button onClick={()=>setScreen('services')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22,padding:0}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:C.txt}}>{cfg.title}</div>
            <div style={{fontSize:11,color:C.dim,fontWeight:600}}>{cfg.subtitle}</div>
          </div>
        </div>
        <CategoryListBody categoryId={listCatId} onSelect={(svc)=>openSubSvc(listCatId, svc)} />
      </>
    );
  }

  // -- SERVICES LIST --------------------------------------------------------
  if (screen==='services') return browseWrap(
    <>
      <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
        <div style={{fontWeight:800,fontSize:20,fontFamily:FF,color:C.txt}}>Scan<span style={{color:C.acc}}>V</span></div>
        <div style={{fontSize:10,fontWeight:700,color:C.cyan,background:'#dce8f7',padding:'5px 10px',borderRadius:99,border:BDR}}>📍 {silentGeo?.city||'PCMC'} {silentGeo?.pincode||''}</div>
      </div>
      <div style={{margin:'12px 16px 0',borderRadius:18,overflow:'hidden',background:`linear-gradient(135deg, ${C.acc} 0%, #9f1239 55%, #7c2d12 100%)`,padding:'18px 20px',color:'#fff',boxShadow:'0 10px 28px rgba(214,58,86,0.28)'}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:'0.08em',textTransform:'uppercase',opacity:0.92,marginBottom:6}}>Real people · Real care</div>
        <div style={{fontSize:20,fontWeight:800,lineHeight:1.28,marginBottom:6,fontFamily:FF}}>Book services with a smile</div>
        <div style={{fontSize:12,fontWeight:500,opacity:0.94,lineHeight:1.45}}>Happy faces behind every category · verified partners · 25% off · UPI at booking</div>
      </div>
      <div style={{margin:'12px 16px 0',background:C.surf,border:BDR,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
        <span>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search IaaS, kitchen clean, legal…" style={{border:'none',outline:'none',background:'transparent',flex:1,fontSize:14,fontFamily:FF,color:C.txt}}/>
        {search&&<button type="button" onClick={()=>setSearch('')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:18,lineHeight:1,padding:0}} aria-label="Clear search">×</button>}
      </div>
      <div style={{display:'flex',gap:6,padding:'10px 16px 0',overflowX:'auto'}}>
        {['✓ DPDP 2023','✓ Verified partners','✓ 25% off','✓ Human-first'].map(p=>(
          <span key={p} style={{flexShrink:0,fontSize:9,fontWeight:800,color:C.grn,background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,padding:'4px 9px',borderRadius:99}}>{p}</span>
        ))}
      </div>
      <div style={{padding:'14px 16px 24px',flex:1,overflowY:'auto'}}>
        {searching ? (
          <ServiceSearchResults
            query={search}
            categories={svcList}
            onCategory={openBrowseSvc}
            onSubSvc={openSubSvc}
            renderCategory={(s,i)=><HomeModelCard key={s.id} svc={s} onClick={()=>openBrowseSvc(s)} index={i} />}
            {...searchSubs}
          />
        ) : (
          <>
            <div style={{marginBottom:14}}>
              <div style={{color:C.txt,fontSize:16,fontWeight:800,marginBottom:3}}>Our commitments to you</div>
              <div style={{color:C.dim,fontSize:12,fontWeight:500}}>10 categories · {silentGeo?.city||'PCMC, Pune'} · people you can trust</div>
            </div>
            {svcList.length > 0 && <HomeHeroCarousel services={svcList} onSelect={openBrowseSvc} />}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {svcList.map((s,i)=>(
                <HomeModelCard key={s.id} svc={s} onClick={()=>openBrowseSvc(s)} index={i} />
              ))}
            </div>
          </>
        )}
        <AssistBanner/>
        <div style={{textAlign:'center',padding:'12px 0 8px',borderTop:BDR,marginTop:8}}>
          {[['privacy','Privacy'],['terms','Terms'],['refund','Refund'],['payment','Payment']].map(([k,l])=>(
            <a key={k} href={'/'+k} style={{color:C.dim,fontSize:10,textDecoration:'none',margin:'0 6px',fontWeight:600}}>{l}</a>
          ))}
        </div>
      </div>
    </>
  );

  // -- SERVICE DETAIL -------------------------------------------------------
  if (screen==='detail'&&activeSvc) {
    const d = activeSvc.desc ? activeSvc : (SVC_DETAIL[activeSvc.id]||{});
    const parentCat = subCatId(activeSvc);
    const isSubSvc = !!parentCat && !!activeSvc.parent;
    const listBack = isSubSvc ? `${parentCat}-list` : 'services';
    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
          <button onClick={()=>setScreen(listBack)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22,padding:0}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>{activeSvc.name}</div>
        </div>
        <div style={{padding:'14px 16px 120px',overflowY:'auto'}}>
          {isSubSvc && <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}><ServiceThumb svc={activeSvc} height={140} /></div>}
          <div style={{...S.card(),padding:22,textAlign:'center',marginBottom:12}}>
            {isSubSvc && <div style={{ marginBottom: 10 }}><CategoryPill categoryId={parentCat} theme={activeSvc.theme} /></div>}
            {!isSubSvc && <div style={{fontSize:52,marginBottom:8}}>{activeSvc.icon}</div>}
            <div style={{color:C.txt,fontSize:17,fontWeight:800,marginBottom:4}}>{activeSvc.name}</div>
            <div style={{color:C.sub,fontSize:12,lineHeight:1.6,marginBottom:12}}>{d.desc||activeSvc.sub}</div>
            {isSubSvc && <div style={{ marginBottom: 12 }}><PriceTag svc={activeSvc} /></div>}
            <div style={{display:'flex',justifyContent:'center',gap:22}}>
              <div><div style={{color:C.acc,fontSize:14,fontWeight:800}}>{d.rating||activeSvc.rating||'4.8 ⭐'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Rating</div></div>
              <div><div style={{color:C.grn,fontSize:14,fontWeight:800}}>{d.bookings||activeSvc.bookings||'1000+'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Bookings</div></div>
              <div><div style={{color:C.cyan,fontSize:14,fontWeight:800}}>{d.turnaround||activeSvc.turnaround||'Same day'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Response</div></div>
            </div>
          </div>
          <div style={S.card({marginBottom:12,padding:'12px 14px'})}>
            <div style={{color:C.txt,fontSize:13,fontWeight:700,marginBottom:8}}>What&#39;s included</div>
            {(d.features||[activeSvc.sub]).slice(0,6).map(f=>(
              <div key={f} style={{display:'flex',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.bdr}`,fontSize:12,color:C.sub}}>
                <span style={{color:C.grn,fontWeight:700}}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      </>,
      <StickyCta onClick={()=>setScreen('verify')}>Book now — verify & pay →</StickyCta>
    );
  }

  // -- SCHEDULE: Date/Time/Location (after payment) -----------------------
  if (screen==='schedule'&&activeSvc) {
    const doGPS=()=>{setBookGps('loading');navigator.geolocation.getCurrentPosition(async pos=>{const geo=await reverseGeo(pos.coords.latitude,pos.coords.longitude);setBookingDetail(b=>({...b,loc:[geo.address,geo.village,geo.city,geo.pincode].filter(Boolean).join(', ')}));setBookGps('done');},()=>setBookGps('idle'),{timeout:8000,enableHighAccuracy:true,maximumAge:0});};

    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setScreen('payment')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>Pick date & time</div>
        </div>
        <div style={{padding:'14px 16px 120px'}}>
          <div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:C.grn,fontWeight:700}}>✅ Payment received · {txnId}</div>
          <Field label="Date" req><input type="date" defaultValue={bookingDetail?.date||''} onChange={e=>setBookingDetail(b=>({...b,date:e.target.value}))} style={S.inp()}/></Field>
          <Field label="Time"><input type="time" defaultValue={bookingDetail?.time||'10:00'} onChange={e=>setBookingDetail(b=>({...b,time:e.target.value}))} style={S.inp()}/></Field>
          <Field label="Service location" note="Auto-filled from your GPS">
            <div style={{display:'flex',gap:8}}>
              <input defaultValue={bookingDetail?.loc||[village,city,pincode].filter(Boolean).join(', ')} onChange={e=>setBookingDetail(b=>({...b,loc:e.target.value}))} placeholder="Address, city, PIN" style={{...S.inp(),flex:1}}/>
              <button onClick={doGPS} disabled={bookGps==='loading'} style={{background:C.surf,border:`1.5px solid ${C.acc}`,borderRadius:10,padding:'11px 14px',color:C.acc,cursor:'pointer',fontSize:18,flexShrink:0}}>{bookGps==='loading'?<Spin size={16}/>:'📍'}</button>
            </div>
            {bookGps==='done'&&<div style={{fontSize:11,color:C.grn,marginTop:4,fontWeight:600}}>✅ Location updated</div>}
          </Field>
          <Field label="Notes (optional)"><input defaultValue={bookingDetail?.notes||''} onChange={e=>setBookingDetail(b=>({...b,notes:e.target.value}))} placeholder="Any special requirements…" style={S.inp()}/></Field>
          {err&&<div style={{...S.err,marginTop:10}}>{err}</div>}
        </div>
      </>,
      <StickyCta onClick={createBooking}>{loading?<><Spin size={16}/> Confirming…</>:'Confirm booking →'}</StickyCta>
    );
  }

  // -- PAYMENT: UPI / Razorpay (after verify, before schedule) ------------
  if (screen==='payment'&&activeSvc) {
    const price=browsePrice,fee=browseFee,gst=browseGst,total=browseTotal;
    const { setUpiOpened, setPaymentVerified } = browsePay;
    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>{setScreen('verify');setUpiOpened(false);setPaymentVerified(false);}} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>Pay platform fee</div>
        </div>
        <div style={{padding:'14px 16px 120px'}}>
          <div style={{...S.card(),textAlign:'center',marginBottom:16,padding:20}}>
            <div style={{fontSize:13,color:C.sub,marginBottom:6,fontWeight:600}}>Amount due now</div>
            <div style={{fontSize:36,fontWeight:800,color:C.acc,marginBottom:4}}>₹{(total/100).toLocaleString('en-IN')}</div>
            <div style={{fontSize:11,color:C.dim}}>Ref: {txnId}</div>
          </div>
          <div style={S.card({marginBottom:14,padding:'12px 14px'})}>
            {[['Service (indicative)',price],['Platform fee (10%)',fee],['GST (18%)',gst],['Pay now',total]].map(([k,v],i)=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderTop:i?`1px solid ${C.bdr}`:'none',fontWeight:i===3?800:500,color:i===3?C.acc:C.sub,fontSize:i===3?15:13}}>
                <span>{k}</span><span>₹{(v/100).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
          <UpiPaymentPanel
            pay={browsePay}
            addToast={addToast}
            loading={loading}
            disabled={false}
            onConfirm={() => confirmPayment('UPI')}
          />
          {err&&<div style={{...S.err,marginTop:10}}>{err}</div>}
        </div>
      </>
    );
  }

  // -- VERIFY: Name + Mobile + OTP (before payment) -------------------------
  if (screen==='verify') {

    const sendWA = async () => {
      if (!firstName.trim()) return setErr('Enter your first name');
      if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
      if (!address.trim()) return setErr('Enter your address');
      if (!city.trim()) return setErr('Enter your city');
      if (!pincode.trim()||pincode.length<6) return setErr('Enter valid 6-digit PIN code');
      if (!termsAccepted) return setErr('Please accept Terms & Conditions to continue');
      setLoading(true); setErr('');
      const ok = await startWAVerify(`+91${mobile}`, () => verifyProfile(true), {
        setWaToken, setWaChecking, setOtpSent,
        onUnavailable: async (msg) => {
          setVerifyMethod('sms');
          setOtpSent(false);
          setWaToken('');
          setErr(`${msg} — use SMS OTP below`);
          try {
            await invokeSendOtp(`+91${mobile}`);
            setOtpSent(true);
            setOtpTargetMobile(mobile);
          } catch (_) {}
        },
      });
      setLoading(false);
    };

    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setScreen('detail')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>Verify mobile</div>
        </div>
        <div style={{padding:'16px 16px 24px'}}>
          {err&&<div style={S.err}>{err}</div>}
          <div style={{color:C.sub,fontSize:12,marginBottom:14,lineHeight:1.6,fontWeight:500}}>Step 1 of 3 · Name, address & mobile OTP before payment</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:4}}>
            <Field label="First name" req><input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Rahul" style={S.inp()}/></Field>
            <Field label="Last name"><input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Sharma" style={S.inp()}/></Field>
          </div>
          <Field label="Mobile" req note="10-digit Indian mobile">
            <div style={{display:'flex',alignItems:'center',background:C.surf,border:BDR,borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 12px',background:C.deep,borderRight:BDR,color:C.sub,fontSize:14,fontWeight:700,flexShrink:0}}>+91</div>
              <input type="tel" maxLength={10} value={mobile} onChange={e=>{ if (otpSent) resetOtpFlow(); setMobile(e.target.value.replace(/\D/g,'').slice(0,10)); }} placeholder="9876543210" style={{...S.inp(),border:'none',borderRadius:0,background:'transparent'}}/>
            </div>
          </Field>
          <Field label="Address" req note="House no, street, area">
            <input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Flat 302, Rose Society, Wakad" style={S.inp()}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:4}}>
            <Field label="City" req><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Pune" style={S.inp()}/></Field>
            <Field label="PIN code" req><input type="tel" maxLength={6} value={pincode} onChange={e=>setPincode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="411018" style={S.inp()}/></Field>
          </div>
          {!termsAccepted&&(
            <div style={{background:C.deep,border:BDR,borderRadius:10,padding:14,marginBottom:14}}>
              <label style={{display:'flex',gap:10,alignItems:'flex-start',cursor:'pointer'}}>
                <input type="checkbox" onChange={e=>e.target.checked&&acceptTerms()} style={{marginTop:2,accentColor:C.acc,width:18,height:18,flexShrink:0}}/>
                <span style={{fontSize:12,color:C.sub,lineHeight:1.6}}>I accept <a href="/terms" style={{color:C.acc}}>Terms</a>, <a href="/privacy" style={{color:C.acc}}>Privacy</a> & DPDP Act 2023 <span style={{color:C.acc}}>*</span></span>
              </label>
            </div>
          )}
          {termsAccepted&&<div style={{fontSize:11,color:C.grn,marginBottom:10,fontWeight:700}}>✅ Terms & DPDP accepted</div>}
          {!otpSent&&(
            <div style={{display:'flex',background:C.deep,borderRadius:10,padding:3,gap:3,marginBottom:14,border:BDR}}>
              {[['sms','📱 SMS OTP'],['whatsapp','💬 WhatsApp']].map(([v,l])=>(
                <button key={v} onClick={()=>setVerifyMethod(v)} style={{flex:1,padding:'10px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:FF,fontSize:12,fontWeight:700,background:verifyMethod===v?(v==='whatsapp'?'#25D366':C.acc):'transparent',color:verifyMethod===v?'#fff':C.dim}}>{l}</button>
              ))}
            </div>
          )}
          {verifyMethod==='sms'&&!otpSent&&(
            <Btn full onClick={sendOTP} disabled={loading||!termsAccepted}>{loading?<><Spin size={16}/>Sending…</>:'Send SMS OTP →'}</Btn>
          )}
          {verifyMethod==='sms'&&otpSent&&(
            <>
              <OtpSentFooter mobile={otpTargetMobile||mobile} onChangeNumber={resetOtpFlow} onResend={()=>sendOTP(true)} loading={loading} />
              <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:14}}>
                {otpCode.map((d,i)=>(
                  <input key={i} maxLength={1} value={d} inputMode="numeric" id={`votp-${i}`}
                    onChange={e=>{const nd=[...otpCode];nd[i]=e.target.value.replace(/\D/g,'').slice(-1);setOtpCode(nd);if(e.target.value&&i<5)document.getElementById(`votp-${i+1}`)?.focus();}}
                    onKeyDown={e=>{if(e.key==='Backspace'&&!otpCode[i]&&i>0)document.getElementById(`votp-${i-1}`)?.focus();}}
                    style={{width:46,height:52,textAlign:'center',background:d?'#fff0f3':C.surf,border:d?`2px solid ${C.acc}`:BDR,borderRadius:10,color:C.acc,fontFamily:FF,fontSize:22,fontWeight:800,outline:'none'}}/>
                ))}
              </div>
              <Btn full onClick={()=>verifyProfile(false)} disabled={loading||otpCode.join('').length<6}>{loading?<><Spin size={16}/>Verifying…</>:'Verify & continue to pay →'}</Btn>
            </>
          )}
          {verifyMethod==='whatsapp'&&!otpSent&&(
            <Btn full onClick={sendWA} disabled={loading||!termsAccepted} style={{background:'#25D366',boxShadow:'0 4px 14px rgba(37,211,102,0.35)'}}>{loading?<><Spin size={16}/>…</>:<>💬 Verify via WhatsApp</>}</Btn>
          )}
          {verifyMethod==='whatsapp'&&otpSent&&waToken&&(
            <WaSentPanel mobile10={mobile} token={waToken} waChecking={waChecking}
              onUseSms={()=>{setVerifyMethod('sms');resetOtpFlow();sendOTP();}}/>
          )}
        </div>
      </>
    );
  }

  // -- LOGIN: Guest Profile tab — OTP gate at sign-in -----------------------
  if (screen==='login') {
    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>{setScreen('services');resetOtpFlow();setErr('');}} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>Sign in</div>
        </div>
        <div style={{padding:'16px 16px 24px'}}>
          {err&&<div style={S.err}>{err}</div>}
          <div style={{color:C.sub,fontSize:12,marginBottom:14,lineHeight:1.6,fontWeight:500}}>Verify mobile to access bookings. OTP required each sign-in — skipped when already signed in.</div>
          <Field label="Mobile" req note="10-digit Indian mobile">
            <div style={{display:'flex',alignItems:'center',background:C.surf,border:BDR,borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'12px 12px',background:C.deep,borderRight:BDR,color:C.sub,fontSize:14,fontWeight:700,flexShrink:0}}>+91</div>
              <input type="tel" maxLength={10} value={mobile} onChange={e=>{ if (otpSent) resetOtpFlow(); setMobile(e.target.value.replace(/\D/g,'').slice(0,10)); }} placeholder="9876543210" style={{...S.inp(),border:'none',borderRadius:0,background:'transparent'}}/>
            </div>
          </Field>
          {!otpSent&&(
            <div style={{display:'flex',background:C.deep,borderRadius:10,padding:3,gap:3,marginBottom:14,border:BDR}}>
              {[['sms','📱 SMS OTP'],['whatsapp','💬 WhatsApp']].map(([v,l])=>(
                <button key={v} onClick={()=>setVerifyMethod(v)} style={{flex:1,padding:'10px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:FF,fontSize:12,fontWeight:700,background:verifyMethod===v?(v==='whatsapp'?'#25D366':C.acc):'transparent',color:verifyMethod===v?'#fff':C.dim}}>{l}</button>
              ))}
            </div>
          )}
          {verifyMethod==='sms'&&!otpSent&&(
            <Btn full onClick={sendLoginOTP} disabled={loading}>{loading?<><Spin size={16}/>Sending…</>:'Send SMS OTP →'}</Btn>
          )}
          {verifyMethod==='sms'&&otpSent&&(
            <>
              <OtpSentFooter mobile={otpTargetMobile||mobile} onChangeNumber={resetOtpFlow} onResend={()=>sendLoginOTP(true)} loading={loading} />
              <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:14}}>
                {otpCode.map((d,i)=>(
                  <input key={i} maxLength={1} value={d} inputMode="numeric" id={`lotp-${i}`}
                    onChange={e=>{const nd=[...otpCode];nd[i]=e.target.value.replace(/\D/g,'').slice(-1);setOtpCode(nd);if(e.target.value&&i<5)document.getElementById(`lotp-${i+1}`)?.focus();}}
                    onKeyDown={e=>{if(e.key==='Backspace'&&!otpCode[i]&&i>0)document.getElementById(`lotp-${i-1}`)?.focus();}}
                    style={{width:46,height:52,textAlign:'center',background:d?'#fff0f3':C.surf,border:d?`2px solid ${C.acc}`:BDR,borderRadius:10,color:C.acc,fontFamily:FF,fontSize:22,fontWeight:800,outline:'none'}}/>
                ))}
              </div>
              <Btn full onClick={()=>loginProfile(false)} disabled={loading||otpCode.join('').length<6}>{loading?<><Spin size={16}/>Verifying…</>:'Sign in →'}</Btn>
            </>
          )}
          {verifyMethod==='whatsapp'&&!otpSent&&(
            <Btn full onClick={sendLoginWA} disabled={loading} style={{background:'#25D366',boxShadow:'0 4px 14px rgba(37,211,102,0.35)'}}>{loading?<><Spin size={16}/>…</>:<>💬 Verify via WhatsApp</>}</Btn>
          )}
          {verifyMethod==='whatsapp'&&otpSent&&waToken&&(
            <WaSentPanel mobile10={mobile} token={waToken} waChecking={waChecking}
              onUseSms={()=>{setVerifyMethod('sms');setOtpSent(false);setWaToken('');setWaChecking(false);setOtpCode(['','','','','','']);sendLoginOTP();}}/>
          )}
        </div>
      </>
    );
  }

  return null;
}

/* ================================================================
   REGISTRATION FLOW
================================================================ */
function RegistrationFlow({ onComplete, prefill }) {
  const [phase, setPhase]   = useState('consent');
  const [dev, setDev]       = useState(prefill?.dev||null);
  const [ip, setIp]         = useState(prefill?.ip||'');
  const [geo, setGeo]       = useState(prefill?.geo||null);
  const [sessionId, setSessionId] = useState(prefill?.scanId||null);
  const [waToken, setWaToken]       = useState('');
  const [waChecking, setWaChecking] = useState(false);

  const [form, setForm] = useState({
    firstName:'', lastName:'', age:'', mobile:'', email:'',
    address:prefill?.geo?.address||'',
    village:prefill?.geo?.village||'',
    city:prefill?.geo?.city||'Pune',
    state:prefill?.geo?.state||'Maharashtra',
    pincode:prefill?.geo?.pincode||'',
    gender:'',
  });
  const [digits, setDigits] = useState(['','','','','','']);
  const [cd, setCd]         = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');
  const timer = useRef(null);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    if (cd>0) { timer.current=setTimeout(()=>setCd(c=>c-1),1000); }
    return ()=>clearTimeout(timer.current);
  },[cd]);

  const startCollection = async () => {
    setPhase('collecting');
    const device = dev || detectDevice(); setDev(device);
    const ipAddr = ip  || await getIP(); setIp(ipAddr);

    // Silent: try IP-based city estimate (PIN from IP is unreliable — GPS resolves it)
    try {
      const ipGeo = await fetch(`https://ipapi.co/${ipAddr}/json/`).then(r=>r.json());
      if (ipGeo?.city) {
        setForm(p=>({
          ...p,
          city: p.city||ipGeo.city||'Pune',
          state: p.state||ipGeo.region||'Maharashtra',
        }));
      }
    } catch(e) { /* silent fail */ }

    setPhase('gps');
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const {latitude:lat,longitude:lng}=pos.coords;
        const geoData=await reverseGeo(lat,lng); setGeo({lat,lng,...geoData,source:'gps'});
        setForm(p=>({...p,address:geoData.address,village:geoData.village,city:geoData.city,state:geoData.state,pincode:geoData.pincode}));
        const {data:vs}=await sb().from('visitor_sessions').insert({
          ip_address:ipAddr,user_agent:device.userAgent,lat,lng,
          address:geoData.address,village:geoData.village,city:geoData.city,
          state:geoData.state,pincode:geoData.pincode,country:geoData.country,
          device_type:device.deviceType,os_name:device.osName,browser:device.browser,
          screen_res:device.screenRes,language:device.language,timezone:device.timezone,
          consent_given:true,consent_at:new Date().toISOString(),verified:false,
        }).select('id').single();
        if (vs?.id) setSessionId(vs.id);
        setPhase('form');
      },
      async ()=>{
        const {data:vs}=await sb().from('visitor_sessions').insert({
          ip_address:ipAddr,user_agent:device?.userAgent||'',
          device_type:device?.deviceType||'',os_name:device?.osName||'',browser:device?.browser||'',
          screen_res:device?.screenRes||'',language:device?.language||'',timezone:device?.timezone||'',
          consent_given:true,consent_at:new Date().toISOString(),verified:false,
        }).select('id').single();
        if (vs?.id) setSessionId(vs.id);
        setPhase('form');
      },
      {timeout:8000,maximumAge:0,enableHighAccuracy:true}
    );
  };

  const sendOTP = async () => {
    if (!form.firstName.trim()) return setErr('Enter your first name');
    if (!form.lastName.trim())  return setErr('Enter your last name');
    if (!form.age||form.age<5||form.age>120) return setErr('Enter a valid age');
    if (!form.mobile)           return setErr('Enter your mobile number');
    if (!form.city.trim())      return setErr('Enter your city');
    if (!form.pincode.trim())   return setErr('Enter PIN code');
    setLoading(true); setErr('');
    try {
      const mob = `+91${form.mobile.replace(/\D/g,'').slice(0,10)}`;
      // 1. Send OTP via Twilio Verify (server-side, no DLT needed)
      //    Twilio generates and sends the OTP -- we don’t need to store it
      setLoading(false);
      setPhase('otp'); setCd(120); setDigits(['','','','','','']);
      setWaToken('');
      // 2. Fire SMS via Edge Function in background
      sb().functions.invoke('send-otp', { body: { mobile: mob } })
        .then(r => {
          if (r.data?.success) {
            console.log('[OTP] Sent via', r.data.provider, '✓');
          } else {
            console.warn('[OTP]', r.data);
            setErr('SMS could not be sent. Tap Resend OTP or check your number.');
          }
        })
        .catch(e => { console.warn('[OTP]', e.message); setErr('SMS delivery failed. Tap Resend OTP.'); });
      // 3. Try outbound WhatsApp verify in parallel (optional — SMS is primary)
      generateWAToken(mob)
        .then(data => {
          if (!data?.messageSent) return;
          setWaToken(data.token);
          setWaChecking(true);
          const poll = setInterval(async () => {
            try {
              const res = await checkWAVerified(data.token);
              if (res?.verified) {
                clearInterval(poll);
                setWaChecking(false);
                setPhase('completing');
                await sb().from('custom_otp').insert({
                  mobile: mob, otp: 'WA-VERIFIED',
                  expires_at: new Date(Date.now() + 60000).toISOString(), used: true,
                }).then(() => {});
                await verifyOTP_direct(mob);
              }
            } catch (_) { /* keep polling */ }
          }, 3000);
          setTimeout(() => { clearInterval(poll); setWaChecking(false); }, 600000);
        })
        .catch(e => console.warn('[WA]', e.message));
    } catch(e) { setErr(e.message||'Could not prepare OTP. Try again.'); setLoading(false); }
  };

  // Direct verification for WhatsApp path (skips OTP check)
  const verifyOTP_direct = async (mob) => {
    setLoading(true); setErr('');
    try {
      const fakeEmail = `${mob.replace(/^\+91/,'').replace(/\s/g,'')}@scanv.app`;
      const fakePass  = `ScanV_${mob.slice(-4)}_${Date.now()}`;
      let userId;
      try {
        const { data:su, error:se } = await sb().auth.signUp({ email:fakeEmail, password:fakePass });
        if (se && se.message?.includes('already registered')) {
          const { data:si } = await sb().auth.signInWithPassword({ email:fakeEmail, password:fakePass });
          userId = si?.user?.id;
        } else { userId = su?.user?.id; }
      } catch(e) {}
      if (!userId) { userId = localStorage.getItem('scanv_uid') || crypto.randomUUID(); localStorage.setItem('scanv_uid', userId); }
      await finalise(userId, fakeEmail, mob);
    } catch(e) { setErr(e.message||'Verification failed.'); setPhase('form'); }
    finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    const token = digits.join('');
    if (token.length<6) return setErr('Enter all 6 digits');
    setLoading(true); setErr('');
    try {
      const mob = `+91${form.mobile.replace(/\D/g,'').slice(0,10)}`;
      // Try Twilio Verify first (if SMS came from Twilio)
      let ok = false;
      try {
        const r = await sb().functions.invoke('send-otp', { body: { mobile: mob, otp: token, action: 'verify' } });
        if (r.data?.success) ok = true;
      } catch(e) { console.warn('[Verify Twilio]', e.message); }
      // Fallback: check custom_otp table (for screen OTP / other providers)
      if (!ok) ok = await verifyCustomOTP(mob, token);
      if (!ok) throw new Error('Invalid or expired OTP. Request a new one.');

      // Create Supabase auth user via email (phone auth needs SMS provider)
      const fakeEmail = `${mob.replace(/\+/,'').replace(/\s/g,'')}@scanv.app`;
      const fakePass  = `ScanV_${mob.slice(-4)}_${Date.now()}`;
      let userId;
      try {
        const { data:su, error:se } = await sb().auth.signUp({ email:fakeEmail, password:fakePass });
        if (se && se.message?.includes('already registered')) {
          // User exists -- sign them in
          const { data:si } = await sb().auth.signInWithPassword({ email:fakeEmail, password:fakePass });
          userId = si?.user?.id;
        } else {
          userId = su?.user?.id;
        }
      } catch(authErr) { console.warn('Auth:', authErr); }

      if (!userId) {
        // Fallback -- use anonymous UUID stored in localStorage
        userId = localStorage.getItem('scanv_uid') || crypto.randomUUID();
        localStorage.setItem('scanv_uid', userId);
      }

      setPhase('completing');
      await finalise(userId, fakeEmail, mob);
    } catch(e) { setErr(e.message||'Verification failed.'); }
    finally { setLoading(false); }
  };

  const finalise = async (userId, userEmail, mob) => {
    try {
      const ipAddr = ip||await getIP();
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      const {data:profile,error} = await sb().from('profiles').upsert({
        id:userId, email:userEmail||'', name:fullName,
        first_name:form.firstName.trim(), last_name:form.lastName.trim(),
        age:parseInt(form.age)||null, gender:form.gender||'',
        phone:mob, address:form.address, village:form.village,
        city:form.city, state:form.state, pincode:form.pincode,
        ip_address:ipAddr, last_lat:geo?.lat||null, last_lng:geo?.lng||null,
        last_address:form.address||geo?.address||'',
        device_type:dev?.deviceType||'', os_name:dev?.osName||'',
        browser:dev?.browser||'', timezone:dev?.timezone||'', language:dev?.language||'',
        mobile_verified:true, mobile_verified_at:new Date().toISOString(),
        role:'customer', status:'active', avatar:'👤',
      },{onConflict:'id'}).select().single();
      if (error) console.warn('Profile upsert:', error.message);

      await sb().from('user_locations').insert({
        user_id:userId, lat:geo?.lat||null, lng:geo?.lng||null,
        address:form.address, village:form.village, city:form.city,
        state:form.state, pincode:form.pincode, ip_address:ipAddr,
        source:geo?.source||'manual', consent_given:true,
        consent_at:new Date().toISOString(), is_primary:true,
      }).then(()=>{});

      if (sessionId) {
        await sb().from('visitor_sessions').update({
          user_id:userId, mobile:mob, first_name:form.firstName.trim(),
          last_name:form.lastName.trim(), verified:true,
          verified_at:new Date().toISOString(),
          lat:geo?.lat||null, lng:geo?.lng||null,
          address:form.address, village:form.village, city:form.city, pincode:form.pincode,
        }).eq('id',sessionId).then(()=>{});
      }

      // Update QR scan record if came via QR
      if (prefill?.scanId) {
        await sb().from('qr_scans').update({
          user_id:userId, mobile:mob, first_name:form.firstName.trim(),
          last_name:form.lastName.trim(), age:parseInt(form.age)||null,
          gender:form.gender||'', verified:true, verified_at:new Date().toISOString(),
        }).eq('id', prefill.scanId).then(()=>{});
      }

      onComplete(profile || {id:userId,name:fullName,first_name:form.firstName.trim(),last_name:form.lastName.trim(),phone:mob,role:'customer',status:'active',avatar:'👤',mobile_verified:true,city:form.city,village:form.village,pincode:form.pincode,device_type:dev?.deviceType||'',os_name:dev?.osName||'',browser:dev?.browser||'',ip_address:ipAddr});
    } catch(e) { setErr(e.message||'Could not save profile. Try again.'); setPhase('form'); }
  };

  /* -- UI -- */
  const logo = (
    <div style={{textAlign:'center',marginBottom:22}}>
      <div style={{fontSize:32,fontWeight:800,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-0.02em'}}>
        <span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span>
      </div>
      <div style={{fontSize:11,color:C.sub,marginTop:3}}>DCORE Global Corporation · PCMC, Pune</div>
    </div>
  );

  const steps=['Consent','Your info','Verify','Done'];
  const si=phase==='consent'?0:phase==='collecting'||phase==='gps'?0:phase==='form'?1:phase==='otp'?2:3;

  const stepBar=(
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:20,position:'relative'}}>
      <div style={{position:'absolute',top:14,left:'12%',right:'12%',height:2,background:C.deep}}/>
      <div style={{position:'absolute',top:14,left:'12%',height:2,background:C.acc,width:`${si/3*76}%`,transition:'width .4s'}}/>
      {steps.map((l,i)=>(
        <div key={l} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,zIndex:1}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:i<=si?C.acc:C.deep,border:`2px solid ${i<=si?C.acc:C.bdr}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',transition:'all .3s'}}>
            {i<si?'✓':i+1}
          </div>
          <div style={{fontSize:9,color:i<=si?C.acc:C.dim}}>{l}</div>
        </div>
      ))}
    </div>
  );

  const wrap=content=>(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'16px',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:'100%',maxWidth:420}}>
        {logo}{stepBar}
        <div style={S.card({padding:24})}>
          {err&&<div style={S.err}>{err}</div>}
          {content}
        </div>
        <div style={{textAlign:'center',marginTop:12,fontSize:10,color:C.dim}}>
          © 2026 ScanV · DCORE Global Corporation · DPDP Act 2023
        </div>
      </div>
    </div>
  );

  /* CONSENT */
  if (phase==='consent') return wrap(
    <>
      <div style={{fontSize:40,textAlign:'center',marginBottom:12}}>📍</div>
      <div style={{color:C.txt,fontSize:17,fontWeight:600,textAlign:'center',marginBottom:8}}>Welcome to ScanV</div>
      <div style={{color:C.sub,fontSize:12,textAlign:'center',lineHeight:1.65,marginBottom:10}}>
        Find and book verified services near you — Legal, Health, Cloud Services, Property, Household, Food & more.
      </div>
      {/* DPDP consent -- compact as requested */}
      <div style={{background:C.gls,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'9px 12px',marginBottom:18,fontSize:11,color:C.dim,lineHeight:1.6}}>
        <strong style={{color:C.sub}}>Before we begin:</strong> ScanV collects your GPS location, IP address and device details to show nearby services and enable local deliveries. Data is stored securely in India under the <strong style={{color:C.sub}}>DPDP Act 2023</strong>. You can update or delete your data anytime in Profile.
      </div>
      <Btn full onClick={startCollection}>Allow location & get started →</Btn>
      <div style={{textAlign:'center',marginTop:10}}>
        <button onClick={()=>{setPhase('form');}} style={{background:'none',border:'none',color:C.sub,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
          Enter location manually instead
        </button>
      </div>
    </>
  );

  /* COLLECTING */
  if (phase==='collecting'||phase==='gps') return wrap(
    <div style={{textAlign:'center',padding:'16px 0'}}>
      <Spin size={40}/>
      <div style={{color:C.txt,fontSize:15,fontWeight:600,marginTop:18,marginBottom:6}}>
        {phase==='collecting'?'Detecting your device…':'Finding your location…'}
      </div>
      <div style={{color:C.sub,fontSize:12}}>Just a moment</div>
      {dev&&<div style={{marginTop:14,background:C.card,borderRadius:8,padding:'8px 12px',textAlign:'left'}}>
        <div style={{fontSize:11,color:C.dim,lineHeight:1.8}}>📱 {dev.deviceType} · {dev.osName} {dev.osVersion}<br/>🌐 {dev.browser} · {dev.language}<br/>🕐 {dev.timezone}</div>
      </div>}
    </div>
  );

  /* FORM */
  if (phase==='form') return wrap(
    <>
      <div style={{color:C.txt,fontSize:15,fontWeight:600,marginBottom:4}}>Your details</div>
      <div style={{color:C.sub,fontSize:12,marginBottom:14,lineHeight:1.5}}>
        {geo?`📍 ${geo.village||geo.city||'Location detected'}`:' Enter your location below'}
      </div>
      {dev&&<div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'7px 11px',marginBottom:14,fontSize:10,color:C.dim,lineHeight:1.7}}>
        📱 {dev.deviceType} · {dev.osName} · {dev.browser} · IP: {ip}
      </div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Field label="First name" req><input value={form.firstName} onChange={e=>f('firstName',e.target.value)} placeholder="Rahul" style={S.inp()}/></Field>
        <Field label="Last name" req><input value={form.lastName} onChange={e=>f('lastName',e.target.value)} placeholder="Sharma" style={S.inp()}/></Field>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Field label="Age" req><input type="number" min="5" max="120" value={form.age} onChange={e=>f('age',e.target.value)} placeholder="32" style={S.inp()}/></Field>
        <Field label="Gender">
          <select value={form.gender} onChange={e=>f('gender',e.target.value)} style={S.inp()}>
            <option value="">Select</option>
            <option>Male</option><option>Female</option><option>Other</option><option>Prefer not to say</option>
          </select>
        </Field>
      </div>

      <Field label="Mobile number" req note="6-digit OTP will be sent via SMS">
        <div style={{display:'flex',alignItems:'center',background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'11px 12px',background:C.card,borderRight:`1px solid ${C.bdr}`,color:C.sub,fontSize:14,fontWeight:600,flexShrink:0}}>+91</div>
          <input type="tel" maxLength={10} value={form.mobile} onChange={e=>f('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="9876543210" style={{...S.inp(),border:'none',borderRadius:0,background:'transparent'}}/>
        </div>
      </Field>

      <Field label="Address" note="House no, street, area"><input value={form.address} onChange={e=>f('address',e.target.value)} placeholder="House no, street, area" style={S.inp()}/></Field>
      <Field label="Village / Area" note="e.g. Pimpri, Wakad, Chinchwad"><input value={form.village} onChange={e=>f('village',e.target.value)} placeholder="Pimpri, Wakad…" style={S.inp()}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Field label="City" req><input value={form.city} onChange={e=>f('city',e.target.value)} placeholder="Pune" style={S.inp()}/></Field>
        <Field label="PIN code" req><input type="tel" maxLength={6} value={form.pincode} onChange={e=>f('pincode',e.target.value)} placeholder="411018" style={S.inp()}/></Field>
      </div>

      <div style={{background:C.gls,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:11,color:C.dim}}>
        🔒 Name, age, mobile, location & device stored in India per DPDP Act 2023
      </div>
      <Btn full onClick={sendOTP} disabled={loading}>
        {loading?<><Spin size={16}/>Sending OTP…</>:'Send OTP →'}
      </Btn>
    </>
  );

  /* OTP */
  if (phase==='otp') return wrap(
    <>
      <div style={{color:C.txt,fontSize:15,fontWeight:600,marginBottom:4}}>Verify your mobile</div>
      <div style={{color:C.sub,fontSize:12,marginBottom:6,lineHeight:1.6}}>
        OTP sent to <strong style={{color:C.txt}}>{form.mobile}</strong>
      </div>

      {waToken&&(
        <div style={{marginBottom:14}}>
          <WaSentPanel
            mobile10={form.mobile.replace(/\D/g,'').slice(0,10)}
            token={waToken}
            waChecking={waChecking}
            onUseSms={()=>{}}
          />
          <div style={{textAlign:'center',marginTop:6,fontSize:10,color:C.dim}}>
            Or enter the SMS OTP below
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:14}}>
        {digits.map((d,i)=>(
          <input key={i} maxLength={1} value={d} inputMode="numeric" id={`otp-${i}`}
            onChange={e=>{
              const nd=[...digits]; nd[i]=e.target.value.replace(/\D/,'').slice(-1); setDigits(nd);
              if(e.target.value&&i<5) document.getElementById(`otp-${i+1}`)?.focus();
            }}
            onKeyDown={e=>{if(e.key==='Backspace'&&!digits[i]&&i>0) document.getElementById(`otp-${i-1}`)?.focus();}}
            style={{width:44,height:52,textAlign:'center',background:d?`${C.acc}20`:C.deep,border:`1.5px solid ${d?C.acc:C.bdr}`,borderRadius:10,color:C.acc,fontFamily:'monospace',fontSize:24,outline:'none'}}/>
        ))}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,fontSize:12}}>
        <span style={{color:C.sub,fontFamily:'monospace'}}>
          {cd>0?`Resend in ${Math.floor(cd/60)}:${String(cd%60).padStart(2,'0')}`:<span style={{color:C.red}}>Expired</span>}
        </span>
        <button onClick={sendOTP} disabled={cd>0||loading} style={{background:'none',border:'none',color:C.acc,cursor:'pointer',fontSize:12,fontFamily:"'DM Sans',sans-serif",opacity:cd>0?.4:1}}>Resend OTP</button>
      </div>

      {/* Setup instructions for OTP */}
      <div style={{background:C.gls,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'9px 12px',marginBottom:14,fontSize:11,color:C.dim,lineHeight:1.7}}>
        📱 OTP delivery: SMS (primary) → verify the number above.<br/>
        Not received? Check if number is correct, then tap Resend.
      </div>

      <Btn full onClick={verifyOTP} disabled={loading||digits.join('').length<6}>
        {loading?<><Spin size={16}/>Verifying…</>:'Verify & enter ScanV →'}
      </Btn>
      <div style={{textAlign:'center',marginTop:10}}>
        <button onClick={()=>{setPhase('form');setErr('');}} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>← Change number</button>
      </div>
    </>
  );

  /* COMPLETING */
  return wrap(
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <Spin size={40}/>
      <div style={{color:C.txt,fontSize:15,fontWeight:600,marginTop:18,marginBottom:6}}>Setting up your account…</div>
      <div style={{color:C.sub,fontSize:12}}>Saving your details securely</div>
    </div>
  );
}

/* ================================================================
   QR CODE SCREEN (accessible from admin)
================================================================ */
function QRScreen() {
  const { setScreen } = useApp();
  const qrUrl = `${APP_URL}?qr=1&utm_source=qr&utm_medium=print`;
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 20px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>setScreen('home')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
        <div style={{fontSize:15,fontWeight:600,color:C.txt,flex:1,textAlign:'center'}}>ScanV QR Code</div>
      </div>
      <div style={{padding:24,display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
        <QRCodeDisplay url={qrUrl} size={240}/>

        <div style={S.card({width:'100%',textAlign:'center'})}>
          <div style={{color:C.txt,fontSize:14,fontWeight:600,marginBottom:8}}>What this QR captures</div>
          {[
            ['📍','GPS location, address, city, PIN code'],
            ['📱','Device type, OS, browser, screen resolution'],
            ['🌐','IP address, connection type (4G/WiFi)'],
            ['🔋','Battery level & charging status'],
            ['🖥️','CPU cores, device memory, pixel ratio'],
            ['🌍','Language, timezone, touch points'],
            ['🎨','Canvas fingerprint (device identity)'],
            ['📊','UTM source, medium, referrer URL'],
          ].map(([ic,txt])=>(
            <div key={txt} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.bdr}`,textAlign:'left'}}>
              <span style={{fontSize:16,flexShrink:0}}>{ic}</span>
              <span style={{color:C.sub,fontSize:12}}>{txt}</span>
            </div>
          ))}
          <div style={{marginTop:10,fontSize:11,color:C.dim}}>All stored to <code>qr_scans</code> table before user registers</div>
        </div>

        <div style={S.card({width:'100%'})}>
          <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:8}}>Print this QR code on:</div>
          {['Business cards','Shop banners & standees','Vehicle stickers','Flyers & pamphlets','WhatsApp status','Website footer'].map(t=>(
            <div key={t} style={{color:C.sub,fontSize:12,padding:'4px 0'}}>• {t}</div>
          ))}
        </div>

        <div style={{width:'100%',background:`${C.acc}22`,border:`1px solid ${C.acc}44`,borderRadius:12,padding:'12px 16px',textAlign:'center'}}>
          <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:4}}>Direct link</div>
          <code style={{color:C.acc,fontSize:12,wordBreak:'break-all'}}>{qrUrl}</code>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN APP SCREENS (unchanged structure, updated URL ref)
================================================================ */
function BottomNav() {
  const {screen,setScreen,user,notifs}=useApp();
  const unread=notifs.filter(n=>!n.read).length;
  const tabs=[
    {id:'home',icon:'🏠',label:'Home'},
    {id:'services',icon:'🔍',label:'Services'},
    {id:'bookings',icon:'📅',label:'Bookings'},
    ...(['admin','partner'].includes(user?.role)?[{id:'crm',icon:'📊',label:'CRM'}]:[]),
    {id:'profile',icon:'👤',label:'Profile'},
  ];
  return (
    <div style={{display:'flex',background:C.surf,borderTop:`1px solid ${C.bdr}`,padding:'8px 0 4px',position:'sticky',bottom:0,zIndex:50}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>setScreen(t.id)}
          style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'4px 0',position:'relative'}}>
          <span style={{fontSize:20}}>{t.icon}</span>
          <span style={{fontSize:10,color:screen===t.id?C.acc:C.dim,fontFamily:"'DM Sans',sans-serif",fontWeight:screen===t.id?600:400}}>{t.label}</span>
          {t.id==='home'&&unread>0&&<div style={{position:'absolute',top:2,right:'20%',background:C.red,color:'#fff',borderRadius:99,width:16,height:16,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{unread}</div>}
          {screen===t.id&&<div style={{position:'absolute',bottom:0,left:'25%',right:'25%',height:2,background:C.acc,borderRadius:2}}/>}
        </button>
      ))}
    </div>
  );
}

function TopBar({title,back}) {
  const {setScreen,logout}=useApp();
  return (
    <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 20px',display:'flex',alignItems:'center',gap:12,fontFamily:"'DM Sans',sans-serif"}}>
      {back?<button onClick={()=>setScreen(back)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
           :<div style={{fontWeight:800,fontSize:20,fontFamily:"'Space Grotesk',sans-serif"}}><span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span></div>}
      <div style={{fontSize:15,fontWeight:600,color:C.txt,flex:1,textAlign:back?'center':'left'}}>{title||''}</div>
      {!back&&<button onClick={logout} style={{background:C.gls,border:`1px solid ${C.bdr}`,color:C.sub,padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>Sign out</button>}
    </div>
  );
}

function HomeScreen() {
  const {user,setScreen,setActiveSvc}=useApp();
  const [bookings,setBookings]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const col=user.role==='partner'?'partner_id':'customer_id';
    sb().from('bookings').select('*').eq(col,user.id).order('created_at',{ascending:false}).limit(3)
      .then(({data})=>{setBookings(data||[]);setLoading(false);});
  },[user.id,user.role]);
  const rc=user.role==='admin'?C.gold:user.role==='partner'?C.cyan:user.role==='candidate'?C.vio:C.acc;
  const rl=user.role==='admin'?'Leader':user.role==='partner'?'Partner':user.role==='candidate'?'Candidate':'Customer';
  const loc=[user.village,user.city,user.pincode].filter(Boolean).join(', ')||'PCMC, Pune';
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar/>
      <div style={{padding:'20px 16px'}}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:13,color:C.sub,marginBottom:2}}>Welcome back</div>
          <div style={{fontSize:22,fontWeight:700,color:C.txt,fontFamily:"'Space Grotesk',sans-serif"}}>{user.avatar} {user.first_name||user.name?.split(' ')[0]}</div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <Badge label={rl} color={rc}/>
            <span style={{color:C.dim,fontSize:11}}>📍 {loc}</span>
            {user.mobile_verified&&<span style={{color:C.grn,fontSize:11}}>📱 Verified</span>}
            {user.device_type&&<span style={{color:C.dim,fontSize:10}}>💻 {user.device_type}</span>}
          </div>
        </div>
        <div onClick={()=>setScreen('services')} style={{display:'flex',alignItems:'center',gap:10,background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 16px',marginBottom:16,cursor:'pointer'}}>
          <span style={{fontSize:18}}>🔍</span>
          <span style={{color:C.dim,fontSize:14}}>Search services near {user.village||user.city||'you'}…</span>
          <div style={{marginLeft:'auto',background:C.acc,color:'#fff',fontSize:11,padding:'4px 10px',borderRadius:6,fontWeight:600}}>Search</div>
        </div>
        <AssistBanner/>
        <div style={{marginBottom:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:C.txt}}>Our commitments</div>
            <button onClick={()=>setScreen('services')} style={{background:'none',border:'none',color:C.acc,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>View all</button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[...SVCS].sort((a,b)=>(b.household?1:0)-(a.household?1:0)).map((s,i)=>(
              <HomeModelCard key={s.id} svc={s} compact index={i} onClick={()=>{setActiveSvc(s);setScreen(SUB_CATEGORIES[s.id]?'services':'book');}} />
            ))}
          </div>
        </div>
        {/* QR code button for admin */}
        {user.role==='admin'&&(
          <div onClick={()=>setScreen('qr')} style={{background:`${C.acc}22`,border:`1px solid ${C.acc}44`,borderRadius:12,padding:'12px 16px',marginBottom:16,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:22}}>📲</span>
            <div><div style={{color:C.txt,fontSize:13,fontWeight:600}}>ScanV QR Code</div><div style={{color:C.sub,fontSize:11}}>Print & share · captures user data on scan</div></div>
            <span style={{marginLeft:'auto',color:C.acc,fontSize:16}}>→</span>
          </div>
        )}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:600,color:C.txt}}>Recent bookings</div>
            <button onClick={()=>setScreen('bookings')} style={{background:'none',border:'none',color:C.acc,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>See all</button>
          </div>
          {loading?<div style={{textAlign:'center',padding:20}}><Spin/></div>
          :bookings.length?bookings.map(b=>(
            <div key={b.id} style={{...S.card(),padding:'12px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{color:C.txt,fontWeight:600,fontSize:14}}>{b.service_name}</div><div style={{color:C.sub,fontSize:12,marginTop:2}}>{b.date||'TBD'}</div></div>
              <div style={{textAlign:'right'}}><div style={{color:C.acc,fontWeight:700}}>₹{((b.total||0)/100).toLocaleString('en-IN')}</div><div style={{fontSize:11,color:b.status==='completed'?C.grn:b.status==='confirmed'?C.cyan:C.gold,marginTop:2}}>{b.status}</div></div>
            </div>
          )):<div style={{...S.card(),padding:20,textAlign:'center',color:C.dim,fontSize:13}}>No bookings yet</div>}
        </div>
      </div>
    </div>
  );
}

// Service detail data
const SVC_DETAIL = {
  legal:    { desc:'Verified lawyers for consultation, drafting, registration, and court filings — 8 ScanV legal services · 25% off.', features:['Lawyer consultation','Document drafting','Property registration','Court filing support','Rental agreements & notary'], turnaround:'Within 24 hours', rating:'4.8 ⭐', bookings:'2,400+' },
  cloud:    { desc:'Enterprise cloud hosting, infrastructure, managed IT, turnkey packages, and training — 18 ScanV services · 25% off.', features:['IaaS · PaaS · SaaS hosting','Datacenter & network design','Infrastructure audits & roadmaps','Turnkey office & OTT packs','Learning & streaming platforms'], turnaround:'From 24 hours', rating:'4.9 ⭐', bookings:'7,600+' },
  vip:      { desc:'Premium concierge, executive assistant, airport transfers, and event planning — 6 VIP services · 25% off.', features:['24×7 personal concierge','Executive assistant hourly','Premium dining reservations','Airport transfers','Event planning'], turnaround:'Same day', rating:'5.0 ⭐', bookings:'800+' },
  health:   { desc:'Doctors at home, lab tests, pharmacy delivery, nursing, and vaccinations — 8 health services · 25% off.', features:['Doctor at home','Lab tests at doorstep','Pharmacy delivery','Nursing care at home','Vaccination at home'], turnaround:'Within 2 hours', rating:'4.7 ⭐', bookings:'5,200+' },
  property: { desc:'Buy, sell, rent, verify, and finance property in PCMC/Pune — 6 property services · 25% off.', features:['Buy / sell assistance','Rent & PG finder','Commercial space search','Legal verification','Home loan assistance'], turnaround:'24-48 hours', rating:'4.6 ⭐', bookings:'3,100+' },
  household:{ desc:'Professional home cleaning and hourly home help through ScanV verified partners. 14 services · 25% off.', features:['Deep cleaning visits','Sofa & upholstery clean','Hourly home help','Ironing & pressing','Same-day booking'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'12,000+' },
  delivery: { desc:'Same-day courier, documents, parcels, groceries, and inter-city express — 6 delivery services · 25% off.', features:['Same-day pickup','Document handover','Grocery & essentials run','Inter-city express','Business bulk SLAs'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'12,000+' },
  food:     { desc:'Home tiffin, breakfast plans, restaurant orders, office lunch, and catering — 6 food services · 25% off.', features:['Monthly tiffin plans','Breakfast & snacks plan','Restaurant delivery','Office lunch boxes','Party catering'], turnaround:'30-60 min', rating:'4.6 ⭐', bookings:'18,000+' },
  'two-wheeler': { desc:'Mechanic support, pick-up & drop servicing, roadside fixing, washing, and deep cleaning — 6 bike services · 25% off · live GPS.', features:['Roadside mechanic','Pick-up & drop servicing','On-road fixing','Bike wash & deep clean','Live partner tracking'], turnaround:'30–90 min', rating:'4.8 ⭐', bookings:'6,400+' },
  'four-wheeler': { desc:'Car mechanic, pick-up & drop servicing, on-site fixing, washing, deep cleaning, and detailing — 6 car services · 25% off · live GPS.', features:['Home/roadside mechanic','Pick-up & drop servicing','On-site fixing','Wash & deep clean','Live partner map'], turnaround:'45 min–2 days', rating:'4.8 ⭐', bookings:'4,200+' },
};

function ServicesScreen() {
  const {setActiveSvc,setScreen,activeSvc}=useApp();
  const [search,setSearch]=useState('');
  const [detail,setDetail]=useState(null);
  const [subListCat,setSubListCat]=useState(null);
  const searchResult = searchAllServices(search);
  const { categories: list, ...searchSubs } = searchResult;
  const searching = !!search.trim();

  useEffect(()=>{
    if (activeSvc && SUB_CATEGORIES[activeSvc.id] && !detail) setSubListCat(activeSvc.id);
  }, [activeSvc, detail]);

  const openSubSvc = (catId, svc) => {
    const cfg = SUB_CATEGORIES[catId];
    setActiveSvc({ ...svc, cat: cfg?.cat || svc.cat, cash: false });
    setDetail(svc);
    setSubListCat(null);
  };

  const openCategory = (s) => {
    if (SUB_CATEGORIES[s.id]) { setSubListCat(s.id); return; }
    setDetail(s);
  };

  if (subListCat && SUB_CATEGORIES[subListCat]) {
    const cfg = SUB_CATEGORIES[subListCat];
    return (
      <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 20px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setSubListCat(null)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:C.txt}}>{cfg.title}</div>
            <div style={{fontSize:11,color:C.dim}}>{cfg.subtitle}</div>
          </div>
        </div>
        <CategoryListBody categoryId={subListCat} onSelect={(svc)=>openSubSvc(subListCat, svc)} />
      </div>
    );
  }

  if(detail) {
    const d = detail.desc ? detail : (SVC_DETAIL[detail.id]||{});
    const parentCat = subCatId(detail);
    const isSubSvc = !!parentCat && !!detail.parent;
    return (
      <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 20px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setDetail(null)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:600,color:C.txt,flex:1,textAlign:'center'}}>{detail.name}</div>
        </div>
        <div style={{padding:16}}>
          {isSubSvc && <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden' }}><ServiceThumb svc={detail} height={160} /></div>}
          <div style={{background:`linear-gradient(135deg,${C.deep},${C.card})`,borderRadius:16,padding:24,textAlign:'center',marginBottom:16,border:`1px solid ${C.bdr}`}}>
            {isSubSvc && <div style={{ marginBottom: 10 }}><CategoryPill categoryId={parentCat} theme={detail.theme} /></div>}
            {!isSubSvc && <div style={{fontSize:56,marginBottom:10}}>{detail.icon}</div>}
            <div style={{color:C.txt,fontSize:18,fontWeight:700,marginBottom:4}}>{detail.name}</div>
            <div style={{color:C.sub,fontSize:12,lineHeight:1.6,marginBottom:12}}>{d.desc||detail.sub}</div>
            {isSubSvc ? <div style={{ marginBottom: 12 }}><PriceTag svc={detail} /></div> : (
              <div style={{ marginBottom: 12 }}><PriceTag svc={detail} sm /></div>
            )}
            <div style={{display:'flex',justifyContent:'center',gap:20,flexWrap:'wrap'}}>
              <div style={{textAlign:'center'}}><div style={{color:C.gold,fontSize:14,fontWeight:700}}>{d.rating||detail.rating}</div><div style={{color:C.dim,fontSize:10}}>Rating</div></div>
              <div style={{textAlign:'center'}}><div style={{color:C.grn,fontSize:14,fontWeight:700}}>{d.bookings||detail.bookings}</div><div style={{color:C.dim,fontSize:10}}>Bookings</div></div>
              <div style={{textAlign:'center'}}><div style={{color:C.cyan,fontSize:14,fontWeight:700}}>{d.turnaround||detail.turnaround}</div><div style={{color:C.dim,fontSize:10}}>Response</div></div>
            </div>
          </div>
          <div style={S.card({marginBottom:16})}>
            <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:10}}>What&#39;s included</div>
            {(d.features||[]).map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{color:C.grn,fontSize:14}}>✓</span>
                <span style={{color:C.sub,fontSize:13}}>{f}</span>
              </div>
            ))}
          </div>
          <AssistBanner/>
          <Btn full onClick={()=>{
            const cfg = SUB_CATEGORIES[detail.parent];
            const payload = isSubSvc ? {...detail, cat: cfg?.cat || detail.cat, cash:false} : detail;
            setActiveSvc(payload);
            setScreen('book');
          }}>Book now →</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title="Services"/>
      <div style={{padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'11px 14px',marginBottom:16}}>
          <span>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search IaaS, kitchen clean, legal…" style={{border:'none',outline:'none',background:'transparent',color:C.txt,fontSize:14,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
          {search&&<button type="button" onClick={()=>setSearch('')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:18,lineHeight:1,padding:0}} aria-label="Clear search">×</button>}
        </div>
        {searching ? (
          <ServiceSearchResults
            query={search}
            categories={list}
            onCategory={openCategory}
            onSubSvc={openSubSvc}
            renderCategory={(s,i)=><HomeModelCard key={s.id} svc={s} index={i} onClick={()=>openCategory(s)} />}
            {...searchSubs}
          />
        ) : (
        <>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {list.length > 0 && (
            <div style={{ gridColumn:'1 / -1' }}>
              <HomeHeroCarousel services={list} onSelect={openCategory} />
            </div>
          )}
          {list.map((s,i)=>(
            <HomeModelCard key={s.id} svc={s} index={i} onClick={()=>openCategory(s)} />
          ))}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function BookScreen() {
  const {activeSvc,user,addToast,setScreen,setTrackBookingId}=useApp();
  const skipVerify=!!(user?.mobile_verified&&user?.first_name);
  const [step,setStep]=useState(1);
  const [date,setDate]=useState('');
  const [time,setTime]=useState('10:00');
  const [notes,setNotes]=useState('');
  const [loc,setLoc]=useState([user?.village,user?.city,user?.pincode].filter(Boolean).join(', ')||'');
  const [gpsState,setGpsState]=useState('idle');
  const [booking,setBooking]=useState(null);
  const [loading,setLoading]=useState(false);
  const [txnId,setTxnId]=useState(null);
  const [payMethod,setPayMethod]=useState(null);
  const svc=activeSvc;
  const price=svc?.price||50000,fee=Math.round(price*FEE_PCT),gst=Math.round((price+fee)*GST_RATE),total=price+fee+gst;
  const bookPay=usePaymentVerification(step===3?txnId:null,step===3?total:0,user?.id,addToast);
  if (!svc) { setScreen('services'); return null; }
  const doGPS=()=>{setGpsState('loading');navigator.geolocation.getCurrentPosition(async pos=>{const geo=await reverseGeo(pos.coords.latitude,pos.coords.longitude);setLoc([geo.address,geo.village,geo.city,geo.pincode].filter(Boolean).join(', '));setGpsState('done');await sb().from('user_locations').insert({user_id:user.id,lat:pos.coords.latitude,lng:pos.coords.longitude,address:geo.address,village:geo.village,city:geo.city,pincode:geo.pincode,source:'gps',consent_given:true,consent_at:new Date().toISOString()});},()=>{addToast('GPS unavailable','error');setGpsState('idle');},{enableHighAccuracy:true,maximumAge:0});};
  const [bookOtpSent,setBookOtpSent]=useState(false);
  const [bookOtpCode,setBookOtpCode]=useState(['','','','','','']);
  const [bookOtpTarget,setBookOtpTarget]=useState('');
  const [bookOtpVerified,setBookOtpVerified]=useState(false);
  const [bookPhone,setBookPhone]=useState(user?.phone?.replace(/^\+91/,'')||'');
  const [bookFirstName,setBookFirstName]=useState(user?.first_name||'');
  const [bookLastName,setBookLastName]=useState(user?.last_name||'');
  const [bookAddress,setBookAddress]=useState(user?.address||'');
  const [bookCity,setBookCity]=useState(user?.city||'');
  const [bookPincode,setBookPincode]=useState(user?.pincode||'');

  const resetBookOtp=()=>{setBookOtpSent(false);setBookOtpCode(emptyOtpDigits());setBookOtpTarget('');};

  const sendBookOTP=async(resend=false)=>{
    if(!bookPhone||bookPhone.replace(/\D/g,'').length!==10) return addToast('Enter valid 10-digit mobile','error');
    if(!bookFirstName.trim()) return addToast('Enter first name','error');
    if(!bookAddress.trim()) return addToast('Enter your address','error');
    if(!bookCity.trim()) return addToast('Enter your city','error');
    if(!bookPincode.trim()||bookPincode.length<6) return addToast('Enter valid PIN code','error');
    setLoading(true);
    try{
      const mob='+91'+bookPhone.replace(/\D/g,'');
      await invokeSendOtp(mob);
      setBookOtpSent(true);
      setBookOtpTarget(bookPhone.replace(/\D/g,''));
      setBookOtpCode(emptyOtpDigits());
      addToast(resend?'OTP resent to '+mob:'OTP sent to '+mob,'success');
    }catch(e){addToast(e.message||'Could not send OTP','error'); if(!resend) resetBookOtp();}
    finally{setLoading(false);}
  };

  const verifyBookOTP=async()=>{
    const code=bookOtpCode.join('');
    if(code.length<6) return addToast('Enter 6-digit OTP','error');
    setLoading(true);
    try{
      const mob='+91'+bookPhone.replace(/\D/g,'');
      const ok=await verifyOtpCode(mob,code);
      if(ok){ setBookOtpVerified(true); setLoc([bookAddress,bookCity,bookPincode].filter(Boolean).join(', ')); setTxnId('TXN-'+Date.now()); bookPay.setUpiOpened(false); bookPay.setPaymentVerified(false); setPayMethod(null); setStep(3); addToast('Mobile verified — proceed to payment ✓','success'); }
      else throw new Error('Invalid OTP');
    }catch(e){addToast(e.message||'Verification failed','error');}
    finally{setLoading(false);}
  };

  const create=async()=>{if(!date)return addToast('Select a date','error');if(!txnId)return addToast('Complete payment first','error');if(!payMethod)return addToast('Complete UPI payment first','error');setLoading(true);try{const mob='+91'+bookPhone.replace(/\D/g,'');const fullName=bookFirstName+' '+bookLastName;const{data,error}=await sb().from('bookings').insert({customer_id:user.id,service_name:svc.name,customer_name:fullName.trim()||user.name,customer_email:user.email||'',date,time,notes,location_text:loc,price,platform_fee:fee,gst_amt:gst,total,status:'confirmed',txn_id:txnId,paid_at:new Date().toISOString()}).select().single();if(error)throw error;await sb().from('service_requests').insert({customer_id:user.id,service_name:svc.name,service_type:svc.cat,preferred_date:date,preferred_time:time,notes,location_text:loc,price,platform_fee:fee,gst_amount:gst,total,status:'new',txn_id:txnId,added_by:user.id});await sb().from('payments').insert({booking_id:data.id,user_id:user.id,amount:total,method:payMethod||'UPI',status:'success',txn_id:txnId,gateway:'Razorpay'}).catch(()=>{});invokeBookingDispatch({bookingId:data.id,serviceId:svc.id||svc.parent||'',serviceName:svc.name,lat:user.last_lat||null,lng:user.last_lng||null,location:loc,date,time});setBooking(data);addToast('Booking confirmed! Track your partner live 📍','success');goToTrack(setTrackBookingId,setScreen,data.id);}catch(e){addToast(e.message||'Booking failed','error');}finally{setLoading(false);}};
  const confirmPaid=method=>{if(!bookPay.upiOpened&&!bookPay.paymentVerified){addToast('Pay via UPI first','error');return;}setPayMethod(method);setStep(4);addToast('Payment confirmed — pick date & time','success');};
  const goFromService=()=>{
    if(skipVerify){ setTxnId('TXN-'+Date.now()); bookPay.setUpiOpened(false); bookPay.setPaymentVerified(false); setPayMethod(null); setStep(3); }
    else setStep(2);
  };
  const progressTotal=skipVerify?3:4;
  const progressIdx=step===1?1:step===2?2:step===3?(skipVerify?2:3):step===4?(skipVerify?3:4):1;
  const stepLabels=skipVerify?['Service','Pay','Schedule']:['Service','Verify','Pay','Schedule'];
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:FF}}>
      <TopBar title={svc.name} back="services"/>
      <div style={{display:'flex',padding:'12px 16px',gap:4}}>{Array.from({length:progressTotal},(_,i)=>{const n=i+1;return <div key={n} style={{flex:1,height:3,borderRadius:2,background:progressIdx>=n?C.acc:C.deep}} title={stepLabels[i]}/>;})}</div>
      <div style={{padding:'8px 16px 40px'}}>
        {step===1&&<>
          <div style={{...S.card(),marginBottom:20,padding:0,overflow:'hidden'}}>
            {svc.img && <ServiceThumb svc={svc} height={120} />}
            <div style={{padding:16}}>
              {svc.theme && <div style={{marginBottom:8}}><HhCategoryPill theme={svc.theme} /></div>}
              {!svc.img && <div style={{fontSize:48,textAlign:'center',marginBottom:12}}>{svc.icon}</div>}
              <div style={{color:C.txt,fontWeight:700,fontSize:18,textAlign:'center',marginBottom:4}}>{svc.name}</div>
              <div style={{color:C.sub,fontSize:13,textAlign:'center',marginBottom:12}}>{svc.sub}</div>
              <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><PriceTag svc={svc} /></div>
              {[['Service fee (25% off)',price],['Platform fee (10%)',fee],['GST (18%)',gst],['Total',total]].map(([k,v],i)=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:i?`1px solid ${C.bdr}`:'none',fontWeight:i===3?700:400,color:i===3?C.acc:C.txt,fontSize:i===3?16:14}}><span>{k}</span><span>₹{fmtRs(v)}</span></div>)}
            </div>
          </div>
          {skipVerify&&<div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:C.grn,fontWeight:700}}>✅ Signed in as {user.first_name} · skip OTP</div>}
          <Btn full onClick={goFromService}>{skipVerify?'Continue to payment →':'Continue →'}</Btn>
        </>}

        {step===2&&!skipVerify&&<>
          <div style={{color:C.txt,fontSize:14,fontWeight:700,marginBottom:12}}>Step 2 · Name, address & OTP</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <Field label="First name" req><input value={bookFirstName} onChange={e=>setBookFirstName(e.target.value)} placeholder="Rahul" style={S.inp()}/></Field>
            <Field label="Last name"><input value={bookLastName} onChange={e=>setBookLastName(e.target.value)} placeholder="Sharma" style={S.inp()}/></Field>
          </div>
          <Field label="Mobile number" req note="OTP will be sent to verify">
            <div style={{display:'flex',alignItems:'center',background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
              <div style={{padding:'11px 12px',background:C.card,borderRight:`1px solid ${C.bdr}`,color:C.sub,fontSize:14,fontWeight:600,flexShrink:0}}>+91</div>
              <input type="tel" maxLength={10} value={bookPhone} onChange={e=>{ if(bookOtpSent) resetBookOtp(); setBookPhone(e.target.value.replace(/\D/g,'').slice(0,10)); }} placeholder="9876543210" style={{...S.inp(),border:'none',borderRadius:0,background:'transparent'}}/>
            </div>
          </Field>
          <Field label="Address" req note="Where should the expert visit?">
            <input value={bookAddress} onChange={e=>setBookAddress(e.target.value)} placeholder="Flat 302, Rose Society, Wakad" style={S.inp()}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <Field label="City" req><input value={bookCity} onChange={e=>setBookCity(e.target.value)} placeholder="Pune" style={S.inp()}/></Field>
            <Field label="PIN code" req><input type="tel" maxLength={6} value={bookPincode} onChange={e=>setBookPincode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="411018" style={S.inp()}/></Field>
          </div>
          {!bookOtpSent?<Btn full onClick={sendBookOTP} disabled={loading}>{loading?<><Spin size={16}/>Sending…</>:'Send OTP →'}</Btn>:(
            <>
              <OtpSentFooter mobile={bookOtpTarget||bookPhone} onChangeNumber={resetBookOtp} onResend={()=>sendBookOTP(true)} loading={loading} />
              <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:12}}>
                {bookOtpCode.map((d,i)=>(
                  <input key={i} maxLength={1} value={d} inputMode="numeric" id={`botp-${i}`}
                    onChange={e=>{const nd=[...bookOtpCode];nd[i]=e.target.value.replace(/\D/,'').slice(-1);setBookOtpCode(nd);if(e.target.value&&i<5)document.getElementById(`botp-${i+1}`)?.focus();}}
                    onKeyDown={e=>{if(e.key==='Backspace'&&!bookOtpCode[i]&&i>0)document.getElementById(`botp-${i-1}`)?.focus();}}
                    style={{width:40,height:48,textAlign:'center',background:d?`${C.acc}20`:C.deep,border:`1.5px solid ${d?C.acc:C.bdr}`,borderRadius:8,color:C.acc,fontFamily:'monospace',fontSize:22,outline:'none'}}/>
                ))}
              </div>
              <Btn full onClick={verifyBookOTP} disabled={loading||bookOtpCode.join('').length<6}>{loading?<><Spin size={16}/>Verifying…</>:'Verify & pay →'}</Btn>
            </>
          )}
        </>}

        {step===3&&<>
          <div style={{color:C.txt,fontSize:14,fontWeight:700,marginBottom:12}}>Step 3 · Pay platform fee</div>
          <div style={{...S.card(),textAlign:'center',marginBottom:16,padding:20}}>
            <div style={{fontSize:13,color:C.sub,marginBottom:6}}>Amount due now</div>
            <div style={{fontSize:36,fontWeight:800,color:C.acc,marginBottom:4}}>₹{(total/100).toLocaleString('en-IN')}</div>
            <div style={{fontSize:11,color:C.dim}}>Ref: {txnId}</div>
          </div>
          <UpiPaymentPanel
            pay={bookPay}
            addToast={addToast}
            loading={false}
            disabled={false}
            onConfirm={() => confirmPaid('UPI')}
          />
        </>}

        {step===4&&<>
          <div style={{color:C.txt,fontSize:14,fontWeight:700,marginBottom:12}}>Step 4 · Pick date & time</div>
          <div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:C.grn,fontWeight:700}}>✅ Payment received · {txnId}</div>
          <Field label="Date" req><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.inp()}/></Field>
          <Field label="Time"><input type="time" value={time} onChange={e=>setTime(e.target.value)} style={S.inp()}/></Field>
          <Field label="Service location"><div style={{display:'flex',gap:8,marginBottom:6}}><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Address or area" style={{...S.inp(),flex:1}}/><button onClick={doGPS} disabled={gpsState==='loading'} style={{background:C.surf,border:`1.5px solid ${C.acc}`,borderRadius:10,padding:'11px 14px',color:C.acc,cursor:'pointer',fontSize:18,flexShrink:0}}>{gpsState==='loading'?<Spin size={16}/>:'📍'}</button></div>{gpsState==='done'&&<div style={{fontSize:11,color:C.grn,fontWeight:600}}>✅ GPS captured</div>}</Field>
          <Field label="Notes"><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special requirements…" style={S.inp()}/></Field>
          <Btn full onClick={create} disabled={loading}>{loading?<><Spin size={16}/>Confirming…</>:'Confirm booking →'}</Btn>
        </>}
      </div>
    </div>
  );
}

function osmEmbedUrl(vLat, vLng, cLat, cLng) {
  const lat = vLat || cLat || 18.6298;
  const lng = vLng || cLng || 73.7997;
  const pad = 0.012;
  const minLng = Math.min(lng, cLng ?? lng) - pad;
  const maxLng = Math.max(lng, cLng ?? lng) + pad;
  const minLat = Math.min(lat, cLat ?? lat) - pad;
  const maxLat = Math.max(lat, cLat ?? lat) + pad;
  let url = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik`;
  if (vLat && vLng) url += `&marker=${vLat}%2C${vLng}`;
  return url;
}

function LiveVendorMap({ live, booking, partnerName, large }) {
  const mapH = large ? 320 : 180;
  const hasLive = live?.tracking_active && live.lat && live.lng;
  const updated = live?.updated_at ? new Date(live.updated_at) : null;
  const minsAgo = updated ? Math.max(0, Math.round((Date.now() - updated.getTime()) / 60000)) : null;
  const mapsLink = hasLive ? `https://www.google.com/maps/dir/?api=1&destination=${live.lat},${live.lng}` : null;
  const embedSrc = hasLive
    ? osmEmbedUrl(live.lat, live.lng, booking?.customer_lat, booking?.customer_lng)
    : osmEmbedUrl(booking?.customer_lat, booking?.customer_lng, null, null);

  return (
    <div style={{ marginTop: large ? 0 : 12, borderTop: large ? 'none' : `1px solid ${C.bdr}`, paddingTop: large ? 0 : 12 }}>
      {hasLive && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.grn, boxShadow: `0 0 0 3px ${C.grn}44`, animation: 'heroPulse 1.5s ease infinite' }} />
              <span style={{ fontSize: large ? 14 : 12, fontWeight: 700, color: C.grn }}>Live partner location</span>
            </div>
            <span style={{ fontSize: 10, color: C.dim }}>{minsAgo === 0 ? 'Just now' : minsAgo != null ? `${minsAgo}m ago` : ''}</span>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
            {partnerName || 'Your partner'} is en route · tracking until service is closed
          </div>
        </>
      )}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: BDR, height: mapH, background: C.deep }}>
        <iframe title="Live partner map" src={embedSrc} style={{ width: '100%', height: '100%', border: 0 }} loading="lazy" />
      </div>
      {mapsLink && (
        <a href={mapsLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700, color: C.acc, textDecoration: 'none' }}>
          Open in Google Maps ↗
        </a>
      )}
    </div>
  );
}

function useLiveBookingTrack(bookingId) {
  const [booking, setBooking] = useState(null);
  const [live, setLive] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookingId) { setLoading(false); return; }
    const { data: bk } = await sb().from('bookings').select('*').eq('id', bookingId).maybeSingle();
    setBooking(bk || null);
    if (bk?.partner_id) {
      const { data: vendor } = await sb().from('vendor_partners').select('business_name').eq('profile_id', bk.partner_id).maybeSingle();
      if (vendor?.business_name) setPartnerName(vendor.business_name);
      else {
        const { data: prof } = await sb().from('profiles').select('first_name,last_name').eq('id', bk.partner_id).maybeSingle();
        if (prof) setPartnerName(`${prof.first_name || ''} ${prof.last_name || ''}`.trim());
      }
    }
    const { data: loc } = await sb().from('vendor_live_locations').select('*').eq('booking_id', bookingId).maybeSingle();
    setLive(loc?.tracking_active ? loc : null);
    try {
      const r = await sb().functions.invoke('booking-dispatch', { body: { action: 'status', booking_id: bookingId } });
      setDispatch(r.data?.dispatch || null);
    } catch { /* optional */ }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    refresh();
    if (!bookingId) return undefined;
    const poll = setInterval(refresh, 5000);
    let channel;
    try {
      channel = sb().channel(`track-${bookingId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_live_locations', filter: `booking_id=eq.${bookingId}` }, refresh)
        .subscribe();
    } catch { /* ignore */ }
    return () => { clearInterval(poll); if (channel) sb().removeChannel(channel); };
  }, [bookingId, refresh]);

  return { booking, live, dispatch, partnerName, loading, refresh };
}

const WAIT_HEALTH_TIPS = [
  { tip: 'Drink a glass of water while you wait — mild dehydration can cause fatigue and headaches.', source: 'WHO hydration guidance' },
  { tip: 'Take 6 slow deep breaths: inhale 4 sec, hold 2, exhale 6. It lowers stress in under a minute.', source: 'NIH / stress research' },
  { tip: 'Stand up and stretch your neck and shoulders for 30 seconds if you have been sitting a while.', source: 'WHO physical activity' },
  { tip: 'Wash hands with soap for 20 seconds before meals — the simplest infection guard.', source: 'WHO hand hygiene' },
  { tip: 'Aim for 7–8 hours of sleep tonight. Good rest speeds recovery and focus.', source: 'ICMR sleep hygiene' },
  { tip: 'Add one extra fruit or vegetable to your next meal — fibre supports gut health.', source: 'ICMR balanced diet' },
  { tip: 'If you work at a screen, look 20 feet away for 20 seconds every 20 minutes (20-20-20 rule).', source: 'American Optometric Association' },
  { tip: 'Short walks after meals help blood sugar control — even 5 minutes around home helps.', source: 'ADA / physical activity' },
];

const WAIT_JOKES = [
  'Why did the delivery partner bring a ladder? The customer ordered high-speed internet.',
  'My Wi‑Fi and my motivation have something in common — both disappear when I need them most.',
  'Partner: “I’m 5 minutes away.” Also partner: still finishing their chai. Classic Pune timing.',
  'I told my smart speaker to book a cleaner. It replied: “Playing ‘Clean Bandit’ on Spotify.”',
  'Why don’t secrets stay at the gym? Because they always get leaked at the water cooler.',
  'Customer: “Is the expert verified?” ScanV: “Yes — OTP, GPS, and a very serious profile photo.”',
  'What did one plate say to the other? “Lunch is on me.”',
  'Why did the scooter go to therapy? Too many unresolved pickup & drop issues.',
  'I asked the cloud service for a joke. It said: “404 — humour not found. Try again in 503 seconds.”',
  'Doctor: “Take two jokes and call me in the morning.” Patient: “Finally, affordable healthcare.”',
];

function WaitEngagementPanel({ compact }) {
  const [slot, setSlot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlot(s => s + 1), 7000);
    return () => clearInterval(t);
  }, []);
  const showJoke = slot % 2 === 1;
  const tipIdx = Math.floor(slot / 2) % WAIT_HEALTH_TIPS.length;
  const jokeIdx = Math.floor(slot / 2) % WAIT_JOKES.length;
  const tip = WAIT_HEALTH_TIPS[tipIdx];
  const pad = compact ? '12px 14px' : '16px 18px';

  return (
    <div style={{ ...S.card(), marginBottom: compact ? 10 : 12, padding: pad, background: showJoke ? '#fffbeb' : '#ecfdf5', border: showJoke ? '1.5px solid #fde68a' : '1.5px solid rgba(0,122,77,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: showJoke ? '#b45309' : C.grn }}>
          {showJoke ? '😄 While you wait' : '💚 Verified health tip'}
        </span>
        <span style={{ fontSize: 9, color: C.dim, fontWeight: 600 }}>Rotates every 7s</span>
      </div>
      {showJoke ? (
        <div style={{ fontSize: compact ? 13 : 14, color: C.txt, lineHeight: 1.55, fontWeight: 500 }}>{WAIT_JOKES[jokeIdx]}</div>
      ) : (
        <>
          <div style={{ fontSize: compact ? 13 : 14, color: C.txt, lineHeight: 1.55, marginBottom: 8 }}>{tip.tip}</div>
          <div style={{ fontSize: 10, color: C.grn, fontWeight: 700 }}>✓ {tip.source}</div>
        </>
      )}
      <div style={{ fontSize: 9, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>
        General wellness only — not medical advice. Consult a doctor for symptoms.
      </div>
    </div>
  );
}

function trackStatusLabel(booking, dispatch, live) {
  if (!booking) return { label: 'Loading…', color: C.dim, step: 0 };
  if (booking.status === 'completed') return { label: 'Service completed', color: C.grn, step: 4 };
  if (booking.status === 'cancelled' || booking.status === 'disputed') return { label: booking.status, color: C.red, step: 0 };
  if (dispatch?.status === 'exhausted') return { label: 'Finding partner — trying more vendors', color: C.gold, step: 1 };
  if (live?.tracking_active) return { label: 'Partner en route — live GPS', color: C.grn, step: 3 };
  if (booking.partner_id) return { label: 'Partner assigned — awaiting GPS', color: C.cyan, step: 2 };
  if (dispatch?.status === 'dispatching') return { label: 'Contacting nearest partner…', color: C.cyan, step: 1 };
  return { label: 'Booking confirmed — finding partner', color: C.acc, step: 1 };
}

function TrackServiceScreen() {
  const { user, setScreen, trackBookingId, setTrackBookingId, addToast } = useApp();
  const bookingId = trackBookingId || trackBookingIdFromHash() || sessionStorage.getItem(TRACK_BOOKING_KEY);
  const { booking, live, dispatch, partnerName, loading } = useLiveBookingTrack(bookingId);
  const status = trackStatusLabel(booking, dispatch, live);
  const steps = ['Confirmed', 'Finding partner', 'Partner assigned', 'Live tracking', 'Complete'];

  useEffect(() => {
    if (bookingId) sessionStorage.setItem(TRACK_BOOKING_KEY, bookingId);
  }, [bookingId]);

  useEffect(() => {
    if (booking?.status === 'completed') {
      addToast?.('Service completed ✅', 'success');
      sessionStorage.removeItem(TRACK_BOOKING_KEY);
      setTrackBookingId?.(null);
      window.location.hash = '';
    }
  }, [booking?.status, addToast, setTrackBookingId]);

  if (!bookingId) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: FF }}>
        <TopBar title="Track my service" back="bookings" />
        <div style={{ ...S.card(), margin: 16, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
          <div style={{ color: C.txt, fontWeight: 700, marginBottom: 8 }}>No active booking to track</div>
          <Btn onClick={() => setScreen('bookings')}>View bookings</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', fontFamily: FF, display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Track my service" back="bookings" />
      {loading && !booking ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size={32} /></div>
      ) : (
        <div style={{ padding: '0 16px 24px', flex: 1 }}>
          <div style={{ ...S.card(), marginBottom: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.txt }}>{booking?.service_name || 'Your service'}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{booking?.date} · {booking?.time || 'TBD'}</div>
                {booking?.location_text && <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>📍 {booking.location_text}</div>}
              </div>
              <Badge label={status.label} color={status.color} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: status.step >= i ? (i === 3 && live ? C.grn : C.acc) : C.deep }} title={s} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.dim, textAlign: 'center' }}>{steps[status.step] || status.label}</div>
          </div>

          {!booking?.partner_id && booking?.status === 'confirmed' && (
            <div style={{ background: '#eef6ff', border: `1.5px solid ${C.cyan}44`, borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
              <strong style={{ color: C.txt }}>Notifying nearest partners</strong> — SMS, phone call & WhatsApp. Map updates when a partner accepts and shares GPS.
            </div>
          )}

          <div style={{ ...S.card(), padding: 12, marginBottom: 12 }}>
            <LiveVendorMap live={live} booking={booking} partnerName={partnerName} large />
            {!live?.tracking_active && booking?.partner_id && (
              <div style={{ marginTop: 12, fontSize: 12, color: C.sub, textAlign: 'center' }}>
                Waiting for {partnerName || 'partner'} to share live location…
              </div>
            )}
          </div>

          {dispatch?.accept_code && !booking?.partner_id && (
            <div style={{ fontSize: 11, color: C.dim, textAlign: 'center', marginBottom: 12 }}>
              Dispatch code {dispatch.accept_code} · attempt {dispatch.attempt_num || 1} of 2 per partner
            </div>
          )}

          {booking?.status === 'confirmed' && <WaitEngagementPanel />}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn full onClick={() => { setScreen('bookings'); window.location.hash = ''; }}>All bookings</Btn>
            <Btn v="outline" full onClick={() => window.location.reload()}>Refresh map</Btn>
          </div>
          <div style={{ marginTop: 16, fontSize: 10, color: C.dim, textAlign: 'center' }}>
            Bookmark: <code style={{ color: C.acc }}>{APP_URL}/#track?id={bookingId}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function usePartnerLocationShare(user, bookings, addToast) {
  const watchRef = useRef(null);
  useEffect(() => {
    if (user?.role !== 'partner') return undefined;
    const active = bookings.filter(b => b.status === 'confirmed' && b.partner_id);
    if (!active.length) {
      if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data: vendor } = await sb().from('vendor_partners').select('id').eq('profile_id', user.id).eq('status', 'active').maybeSingle();
      if (cancelled || !vendor?.id) return;
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = navigator.geolocation.watchPosition(async (pos) => {
        for (const b of active) {
          await sb().from('vendor_live_locations').upsert({
            booking_id: b.id,
            vendor_id: vendor.id,
            partner_id: user.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : null,
            tracking_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'booking_id' }).catch(() => {});
        }
      }, () => addToast?.('Enable GPS to share live location with customer', 'error'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    })();
    return () => { cancelled = true; if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; } };
  }, [user?.id, user?.role, bookings, addToast]);
}

function BookingsScreen() {
  const {user,addToast,setScreen,setTrackBookingId}=useApp();
  const [bookings,setBookings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [stars,setStars]=useState({});
  const [disputing,setDisputing]=useState(null);
  const [reason,setReason]=useState('');
  const [liveLocs,setLiveLocs]=useState({});
  const [partners,setPartners]=useState({});

  const load=useCallback(async()=>{
    const col=user.role==='partner'?'partner_id':'customer_id';
    const{data}=await sb().from('bookings').select('*').eq(col,user.id).order('created_at',{ascending:false});
    setBookings(data||[]);
    const ids=(data||[]).map(b=>b.id);
    if(ids.length){
      const{data:lives}=await sb().from('vendor_live_locations').select('*').in('booking_id',ids);
      const map={}; (lives||[]).forEach(l=>{ map[l.booking_id]=l; });
      setLiveLocs(map);
      const pids=[...new Set((data||[]).filter(b=>b.partner_id).map(b=>b.partner_id))];
      if(pids.length){
        const{data:vendors}=await sb().from('vendor_partners').select('id,profile_id,business_name,contact_name').in('profile_id',pids);
        const{data:profiles}=await sb().from('profiles').select('id,first_name,last_name').in('id',pids);
        const pmap={};
        (vendors||[]).forEach(v=>{ if(v.profile_id) pmap[v.profile_id]=v.business_name; });
        (profiles||[]).forEach(p=>{ if(!pmap[p.id]) pmap[p.id]=`${p.first_name||''} ${p.last_name||''}`.trim(); });
        setPartners(pmap);
      }
    }
    setLoading(false);
  },[user.id,user.role]);

  usePartnerLocationShare(user, bookings, addToast);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const openIds=bookings.filter(b=>b.status==='confirmed'&&b.partner_id).map(b=>b.id);
    if(!openIds.length) return undefined;
    let channel;
    try{
      channel=sb().channel('live-vendor-locs')
        .on('postgres_changes',{event:'*',schema:'public',table:'vendor_live_locations'},(payload)=>{
          const row=payload.new||payload.old;
          if(row?.booking_id&&openIds.includes(row.booking_id)){
            if(payload.eventType==='DELETE'||(row.tracking_active===false)){
              setLiveLocs(prev=>{ const n={...prev}; delete n[row.booking_id]; return n; });
            } else {
              setLiveLocs(prev=>({...prev,[row.booking_id]:row}));
            }
          }
        })
        .subscribe();
    }catch{}
    const poll=setInterval(async()=>{
      const{data}=await sb().from('vendor_live_locations').select('*').in('booking_id',openIds).eq('tracking_active',true);
      const map={}; (data||[]).forEach(l=>{ map[l.booking_id]=l; });
      setLiveLocs(prev=>({...prev,...map}));
    },20000);
    return ()=>{ if(channel) sb().removeChannel(channel); clearInterval(poll); };
  },[bookings]);

  const sc=s=>s==='completed'?C.grn:s==='confirmed'?C.cyan:s==='cancelled'||s==='disputed'?C.red:C.gold;
  const showLive=(b)=>user.role==='customer'&&b.status==='confirmed'&&b.partner_id&&liveLocs[b.id]?.tracking_active;

  const markComplete=async(b)=>{
    await sb().from('bookings').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',b.id);
    await sb().from('vendor_live_locations').update({tracking_active:false}).eq('booking_id',b.id).catch(()=>{});
    await sb().from('service_requests').update({status:'completed'}).eq('txn_id',b.txn_id).catch(()=>{});
    addToast('Complete ✅ — live tracking stopped','success');
    load();
  };

  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:FF}}>
      <TopBar title="Bookings"/>
      {user.role==='partner'&&bookings.some(b=>b.status==='confirmed')&&(
        <div style={{margin:'0 16px 8px',background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',fontSize:11,color:C.grn,fontWeight:700}}>
          📍 Sharing live GPS with customers on active bookings
        </div>
      )}
      <div style={{padding:16}}>
        {loading?<div style={{textAlign:'center',padding:40}}><Spin/></div>
        :bookings.length?bookings.map(b=>(
          <div key={b.id} style={{...S.card(),marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div><div style={{color:C.txt,fontWeight:600,fontSize:15}}>{b.service_name}</div><div style={{color:C.sub,fontSize:12,marginTop:2}}>{b.date||'TBD'} {b.time||''}</div>{b.location_text&&<div style={{color:C.dim,fontSize:11,marginTop:2}}>📍 {b.location_text}</div>}{b.partner_id&&user.role==='customer'&&<div style={{color:C.cyan,fontSize:11,marginTop:4,fontWeight:600}}>🤝 {partners[b.partner_id]||'Partner assigned'}</div>}</div>
              <div style={{textAlign:'right'}}><div style={{color:C.acc,fontWeight:700}}>₹{((b.total||0)/100).toLocaleString('en-IN')}</div><Badge label={b.status} color={sc(b.status)}/></div>
            </div>
            {showLive(b)&&<LiveVendorMap live={liveLocs[b.id]} booking={b} partnerName={partners[b.partner_id]}/>}
            {user.role==='customer'&&b.status==='confirmed'&&<WaitEngagementPanel compact />}
            {user.role==='customer'&&b.status==='confirmed'&&(
              <Btn sm v="outline" onClick={()=>goToTrack(setTrackBookingId,setScreen,b.id)} style={{marginTop:8}}>📍 Track my service</Btn>
            )}
            {user.role==='partner'&&b.status==='confirmed'&&<Btn sm onClick={()=>markComplete(b)}>✓ Mark complete</Btn>}
            {b.status==='completed'&&user.role==='customer'&&(
              <div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:12,marginTop:8}}>
                {!stars[b.id]?<><div style={{fontSize:12,color:C.sub,marginBottom:6}}>Rate this service</div><div style={{display:'flex',gap:6}}>{[1,2,3,4,5].map(s=><button key={s} onClick={async()=>{await sb().from('reviews').insert({booking_id:b.id,reviewer_id:user.id,target_id:b.partner_id,rating:s,review_type:'customer_to_partner'});setStars(r=>({...r,[b.id]:s}));addToast(`Rated ${s}⭐`,'success');}} style={{background:'none',border:'none',fontSize:22,cursor:'pointer'}}>⭐</button>)}</div></>:<div style={{color:C.grn,fontSize:12}}>✅ Rated {stars[b.id]}⭐</div>}
                <button onClick={()=>setDisputing(b.id)} style={{background:'none',border:'none',color:C.red,fontSize:12,cursor:'pointer',fontFamily:FF,marginTop:8,display:'block'}}>Raise a dispute</button>
              </div>
            )}
            {disputing===b.id&&<div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:12,marginTop:8}}><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe the issue…" style={{...S.inp(),marginBottom:10}}/><div style={{display:'flex',gap:8}}><Btn sm v="danger" onClick={async()=>{if(!reason)return addToast('Enter reason','error');await sb().from('disputes').insert({booking_id:b.id,raised_by:user.id,reason});await sb().from('vendor_live_locations').update({tracking_active:false}).eq('booking_id',b.id).catch(()=>{});addToast('Dispute raised','success');setDisputing(null);setReason('');load();}}>Submit</Btn><Btn sm v="ghost" onClick={()=>setDisputing(null)}>Cancel</Btn></div></div>}
          </div>
        )):<div style={{...S.card(),padding:40,textAlign:'center',color:C.dim}}>No bookings yet</div>}
      </div>
    </div>
  );
}

function CRMScreen() {
  const {user,addToast}=useApp();
  const [tab,setTab]=useState('service');
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [frm,setFrm]=useState({type:'customer',firstName:'',lastName:'',age:'',mobile:'',course:'',service_type:'Legal',village:'',city:'Pune',pincode:''});
  const f=(k,v)=>setFrm(p=>({...p,[k]:v}));
  const STATS={service:['new','assigned','in_progress','awaiting_payment','paid','completed','cancelled','escalated'],training:['enquiry','enrolled','fee_due','fee_paid','in_training','certified','dropped','deferred']};
  const SC={new:'#5a5a7a',enquiry:'#5a5a7a',assigned:'#7c3aed',enrolled:'#7c3aed',in_progress:'#f5a623',fee_due:'#f5a623',in_training:'#f5a623',awaiting_payment:'#e94560',fee_paid:'#e94560',paid:'#00c48c',completed:'#00c48c',certified:'#00c48c',cancelled:'#ff4d6d',escalated:'#ff4d6d',dropped:'#ff4d6d',deferred:'#888'};
  const load=useCallback(async()=>{setLoading(true);const tbl=tab==='service'?'service_requests':'training_requests';let q=sb().from(tbl).select('*').order('created_at',{ascending:false});if(user.role!=='admin')q=q.eq('added_by',user.id);const{data}=await q;setRequests(data||[]);setLoading(false);},[tab,user.id,user.role]);
  useEffect(()=>{load();},[load]);
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title="CRM"/>
      <div style={{padding:'12px 16px'}}>
        <div style={{display:'flex',background:C.deep,borderRadius:10,padding:3,gap:3,marginBottom:16}}>
          {[['service','Service'],['training','Training']].map(([v,l])=>(<button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:tab===v?600:400,background:tab===v?C.acc:'transparent',color:tab===v?'#fff':C.sub}}>{l}</button>))}
        </div>
        {loading?<div style={{textAlign:'center',padding:40}}><Spin/></div>
        :requests.length?requests.map(r=>(
          <div key={r.id} style={{...S.card(),marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}><div><div style={{color:C.txt,fontWeight:600,fontSize:14}}>{r.service_name||r.course||'Request'}</div><div style={{color:C.sub,fontSize:11,marginTop:2}}>{r.service_type||r.batch||''}</div></div><Badge label={r.status} color={SC[r.status]||C.dim}/></div>
            {r.notes&&<div style={{color:C.dim,fontSize:11,marginBottom:8}}>{r.notes}</div>}
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(STATS[tab]||[]).filter(s=>s!==r.status).slice(0,3).map(s=><button key={s} onClick={async()=>{const tbl=tab==='service'?'service_requests':'training_requests';await sb().from(tbl).update({status:s}).eq('id',r.id);addToast(`→ ${s}`,'success');load();}} style={{background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:6,padding:'4px 10px',color:C.sub,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>→ {s}</button>)}</div>
          </div>
        )):<div style={{...S.card(),padding:40,textAlign:'center',color:C.dim}}>No requests yet</div>}
      </div>
    </div>
  );
}

function ProfileScreen() {
  const {user,setUser,addToast,logout,setScreen}=useApp();
  const [frm,setFrm]=useState({firstName:user?.first_name||'',lastName:user?.last_name||'',phone:user?.phone||'',age:user?.age||'',gender:user?.gender||'',upi_id:user?.upi_id||'',address:user?.address||'',village:user?.village||'',city:user?.city||'',pincode:user?.pincode||''});
  const [saving,setSaving]=useState(false);
  const f=(k,v)=>setFrm(p=>({...p,[k]:v}));
  const save=async()=>{setSaving(true);try{const{data}=await sb().from('profiles').update({first_name:frm.firstName,last_name:frm.lastName,name:`${frm.firstName} ${frm.lastName}`,phone:frm.phone,age:parseInt(frm.age)||null,gender:frm.gender,upi_id:frm.upi_id,address:frm.address,village:frm.village,city:frm.city,pincode:frm.pincode}).eq('id',user.id).select().single();setUser(data);addToast('Profile saved ✅','success');}catch(e){addToast(e.message||'Save failed','error');}finally{setSaving(false);}};
  const rc=user.role==='admin'?C.gold:user.role==='partner'?C.cyan:user.role==='candidate'?C.vio:C.acc;
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title="Profile"/>
      <div style={{padding:16}}>
        <div style={{...S.card(),textAlign:'center',marginBottom:16,padding:24}}>
          <div style={{fontSize:56,marginBottom:8}}>{user?.avatar}</div>
          <div style={{color:C.txt,fontSize:18,fontWeight:700}}>{user?.first_name} {user?.last_name}</div>
          <Badge label={user?.role==='admin'?'Leader':user?.role} color={rc}/>
          <div style={{color:C.sub,fontSize:12,marginTop:6}}>{user?.phone}{user?.mobile_verified?' · 📱 Verified':''}</div>
          <div style={{color:C.dim,fontSize:11,marginTop:4}}>📍 {[user?.village,user?.city,user?.pincode].filter(Boolean).join(', ')||'Not set'}</div>
          <div style={{color:C.dim,fontSize:10,marginTop:2}}>💻 {user?.device_type} · {user?.os_name} · {user?.browser}</div>
          <div style={{color:C.dim,fontSize:10,marginTop:2}}>🌐 IP: {user?.ip_address||'—'} · Age: {user?.age||'—'}</div>
        </div>
        {user.role==='admin'&&<div onClick={()=>setScreen('qr')} style={{background:`${C.acc}22`,border:`1px solid ${C.acc}44`,borderRadius:12,padding:'12px 16px',marginBottom:16,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:22}}>📲</span><div style={{color:C.txt,fontSize:13,fontWeight:600}}>View QR Code & share</div><span style={{marginLeft:'auto',color:C.acc}}>→</span></div>}
        <div style={{...S.card(),marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:600,color:C.txt,marginBottom:14}}>Edit profile</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field label="First name"><input value={frm.firstName} onChange={e=>f('firstName',e.target.value)} style={S.inp()}/></Field><Field label="Last name"><input value={frm.lastName} onChange={e=>f('lastName',e.target.value)} style={S.inp()}/></Field></div>
          {/* Age & Gender captured silently from device -- not shown in form */}
          <Field label="Mobile"><input value={frm.phone} onChange={e=>f('phone',e.target.value)} style={S.inp()}/></Field>
          <Field label="Address"><input value={frm.address} onChange={e=>f('address',e.target.value)} style={S.inp()}/></Field>
          <Field label="Village / Area"><input value={frm.village} onChange={e=>f('village',e.target.value)} style={S.inp()}/></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field label="City"><input value={frm.city} onChange={e=>f('city',e.target.value)} style={S.inp()}/></Field><Field label="PIN code"><input value={frm.pincode} onChange={e=>f('pincode',e.target.value)} style={S.inp()}/></Field></div>
          {user.role==='partner'&&<Field label="UPI ID"><input value={frm.upi_id} onChange={e=>f('upi_id',e.target.value)} placeholder="yourname@upi" style={S.inp()}/></Field>}
          <Btn onClick={save} disabled={saving}>{saving?'Saving…':'Save changes'}</Btn>
        </div>
        <AssistBanner/>
        <Btn full v="outline" onClick={logout}>Sign out</Btn>
      </div>
    </div>
  );
}

function LeaderHome() {
  const {setScreen}=useApp();
  const [stats,setStats]=useState(null);
  const [visitors,setVisitors]=useState([]);
  const [qrScans,setQrScans]=useState([]);
  useEffect(()=>{
    (async()=>{
      const [{count:customers},{count:partners},{count:bookings},{data:pays},{data:vis},{data:qrs}]=await Promise.all([
        sb().from('profiles').select('*',{count:'exact',head:true}).eq('role','customer'),
        sb().from('profiles').select('*',{count:'exact',head:true}).eq('role','partner'),
        sb().from('bookings').select('*',{count:'exact',head:true}),
        sb().from('payments').select('amount').eq('status','success'),
        sb().from('visitor_sessions').select('ip_address,city,mobile,first_name,last_name,device_type,os_name,browser,verified,created_at').order('created_at',{ascending:false}).limit(10),
        sb().from('qr_scans').select('ip_address,city,mobile,first_name,last_name,device_type,os_name,browser,battery_level,connection_type,verified,scanned_at').order('scanned_at',{ascending:false}).limit(10),
      ]);
      setStats({customers,partners,bookings,gmv:(pays||[]).reduce((a,p)=>a+(p.amount||0),0)});
      setVisitors(vis||[]); setQrScans(qrs||[]);
    })();
  },[]);
  if (!stats) return <div style={{padding:40,textAlign:'center'}}><Spin/></div>;
  return (
    <div style={{flex:1,overflowY:'auto',padding:16,fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {[['👥','Customers',stats.customers,C.cyan],['🤝','Partners',stats.partners,C.acc],['📅','Bookings',stats.bookings,C.gold],['💰','GMV',`₹${((stats.gmv||0)/100).toLocaleString('en-IN')}`,C.grn]].map(([ic,lbl,val,col])=>(
          <div key={lbl} style={S.card()}><div style={{fontSize:24,marginBottom:6}}>{ic}</div><div style={{color:C.sub,fontSize:12,marginBottom:4}}>{lbl}</div><div style={{color:col,fontWeight:700,fontSize:22}}>{val}</div></div>
        ))}
      </div>
      {/* QR Scans */}
      {qrScans.length>0&&<div style={{...S.card(),marginBottom:16}}>
        <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:10}}>📲 QR Scans <Badge label={qrScans.length} color={C.acc}/></div>
        {qrScans.map((v,i)=>(
          <div key={i} style={{padding:'8px 0',borderTop:i?`1px solid ${C.bdr}`:'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{color:C.txt,fontSize:12,fontWeight:500}}>{[v.first_name,v.last_name].filter(Boolean).join(' ')||'Anonymous'} · {v.mobile||'—'}</div>
                <div style={{color:C.dim,fontSize:10,marginTop:1}}>IP: {v.ip_address} · {v.city||'—'} · {v.connection_type||'—'}</div>
                <div style={{color:C.dim,fontSize:10,marginTop:1}}>💻 {v.device_type} · {v.os_name} · {v.browser}</div>
                <div style={{color:C.dim,fontSize:10,marginTop:1}}>🔋 {v.battery_level!=null?Math.round(v.battery_level*100)+'%':'—'} · {v.scanned_at?.slice(0,16).replace('T',' ')}</div>
              </div>
              <Badge label={v.verified?'Verified':'Scanned'} color={v.verified?C.grn:C.gold}/>
            </div>
          </div>
        ))}
      </div>}
      {/* QR code shortcut */}
      <div onClick={()=>setScreen('qr')} style={{background:`${C.acc}22`,border:`1px solid ${C.acc}44`,borderRadius:12,padding:'12px 16px',marginBottom:16,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:22}}>📲</span>
        <div><div style={{color:C.txt,fontSize:13,fontWeight:600}}>ScanV QR Code</div><div style={{color:C.sub,fontSize:11}}>Print & share · view scan analytics</div></div>
        <span style={{marginLeft:'auto',color:C.acc,fontSize:16}}>→</span>
      </div>
      {visitors.length>0&&<div style={{...S.card(),marginBottom:16}}>
        <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:10}}>🌐 Recent visitors</div>
        {visitors.map((v,i)=>(
          <div key={i} style={{padding:'7px 0',borderTop:i?`1px solid ${C.bdr}`:'none'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{color:C.txt,fontSize:12,fontWeight:500}}>{[v.first_name,v.last_name].filter(Boolean).join(' ')||'Anonymous'} · {v.mobile||'—'}</div>
                <div style={{color:C.dim,fontSize:10,marginTop:1}}>IP: {v.ip_address} · {v.city||'—'}</div>
                <div style={{color:C.dim,fontSize:10,marginTop:1}}>💻 {v.device_type} · {v.os_name} · {v.browser}</div>
              </div>
              <Badge label={v.verified?'Verified':'Anonymous'} color={v.verified?C.grn:C.gold}/>
            </div>
          </div>
        ))}
      </div>}
      <AssistBanner/>
    </div>
  );
}

/* ================================================================
   CONFIDENTIAL PRICING ADMIN — #pricing-admin (PIN only, not in nav)
================================================================ */
function PricingAdminPage({ onPricesUpdated }) {
  const [pin, setPin] = useState(() => sessionStorage.getItem(PRICING_PIN_KEY) || '');
  const [authed, setAuthed] = useState(pricingAuthOk());
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const cards = ['all', ...Array.from(new Set(rows.map(r => r.card)))];

  const load = useCallback(async (usePin) => {
    setLoading(true); setErr('');
    try {
      const { rows: data } = await pricingAdminFetch(usePin);
      setRows(data || []);
      setMsg(`Loaded ${data?.length || 0} services`);
    } catch (e) {
      setErr(e.message || 'Could not load pricing');
      setAuthed(false);
      sessionStorage.removeItem(PRICING_AUTH_KEY);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authed && pin) load(pin);
  }, [authed, pin, load]);

  const login = async () => {
    if (!pin) { setErr('Enter your PIN'); return; }
    setLoading(true); setErr('');
    try {
      const { rows: data } = await pricingAdminFetch(pin);
      sessionStorage.setItem(PRICING_PIN_KEY, pin);
      setPricingAuth(pin);
      setRows(data || []);
      setAuthed(true);
      setMsg(`Loaded ${data?.length || 0} services`);
    } catch {
      setErr('Incorrect PIN — set it in Supabase: npx supabase secrets set PRICING_ADMIN_PIN=YourPin');
      setAuthed(false);
      sessionStorage.removeItem(PRICING_AUTH_KEY);
    } finally { setLoading(false); }
  };

  const updateRow = (idx, field, rawVal) => {
    setRows(prev => prev.map((r, i) => i === idx ? splitPricingRow(r, field, field.includes('pct') ? rawVal : paiseFromInp(rawVal)) : r));
  };

  const saveAll = async () => {
    setSaving(true); setErr(''); setMsg('');
    try {
      await pricingAdminSave(pin, rows);
      await fetchLivePricing();
      onPricesUpdated?.();
      setMsg(`Saved ${rows.length} rows — live on site now`);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const saveOne = async (idx) => {
    setSaving(true); setErr('');
    try {
      await pricingAdminSave(pin, [rows[idx]]);
      await fetchLivePricing();
      onPricesUpdated?.();
      setMsg(`Saved ${rows[idx].service_name}`);
    } catch (e) {
      setErr(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const th = { padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:C.sub, borderBottom:BDR, whiteSpace:'nowrap', background:C.surf, position:'sticky', top:0, zIndex:2 };
  const td = { padding:'6px 8px', borderBottom:`1px solid ${C.bdr}`, fontSize:11, verticalAlign:'middle' };
  const inp = { width:72, padding:'4px 6px', borderRadius:6, border:BDR, background:C.bg, color:C.txt, fontSize:11, fontFamily:FF };

  if (!authed) {
    return (
      <div style={{ minHeight:'100vh', background:C.bg, fontFamily:FF, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div style={{ ...S.card(), maxWidth:360, width:'100%', padding:24 }}>
          <div style={{ fontSize:11, color:C.red, fontWeight:700, letterSpacing:1, marginBottom:8 }}>CONFIDENTIAL</div>
          <div style={{ fontSize:20, fontWeight:800, color:C.txt, marginBottom:6 }}>ScanV Pricing Input</div>
          <div style={{ fontSize:12, color:C.sub, marginBottom:20, lineHeight:1.5 }}>Leader-only. Not linked in the app. Enter your private PIN to edit service amounts and partner splits.</div>
          <Field label="Private PIN">
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} style={S.inp()} placeholder="••••••••" autoComplete="off"/>
          </Field>
          {err && <div style={{ color:C.red, fontSize:12, marginBottom:12 }}>{err}</div>}
          <Btn full onClick={login} disabled={!pin}>Unlock pricing table</Btn>
          <div style={{ marginTop:16, fontSize:11, color:C.dim, textAlign:'center' }}>
            Bookmark: <code style={{ color:C.acc }}>{APP_URL}/#pricing-admin</code>
          </div>
        </div>
      </div>
    );
  }

  const shown = filter === 'all' ? rows : rows.filter(r => r.card === filter);

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:FF }}>
      <div style={{ background:C.surf, borderBottom:BDR, padding:'12px 16px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(18,18,18,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, maxWidth:1400, margin:'0 auto' }}>
          <div>
            <div style={{ fontSize:10, color:C.red, fontWeight:700, letterSpacing:1 }}>CONFIDENTIAL · PRICING</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.txt }}>ScanV Pricing Input</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Btn v="outline" sm onClick={()=>load(pin)} disabled={loading}>{loading?'Loading…':'Reload'}</Btn>
            <Btn sm onClick={saveAll} disabled={saving||!rows.length}>{saving?'Saving…':'Save all & go live'}</Btn>
            <Btn v="ghost" sm onClick={()=>{ sessionStorage.removeItem(PRICING_AUTH_KEY); setAuthed(false); }}>Lock</Btn>
          </div>
        </div>
        {msg && <div style={{ color:C.grn, fontSize:12, marginTop:8, maxWidth:1400, margin:'8px auto 0' }}>{msg}</div>}
        {err && <div style={{ color:C.red, fontSize:12, marginTop:8, maxWidth:1400, margin:'8px auto 0' }}>{err}</div>}
      </div>

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'16px' }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
          {cards.map(c => (
            <button key={c} onClick={()=>setFilter(c)} style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${filter===c?C.acc:C.bdr}`, background:filter===c?`${C.acc}18`:C.surf, color:filter===c?C.acc:C.sub, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:FF }}>
              {c === 'all' ? 'All cards' : c}
            </button>
          ))}
        </div>

        <div style={{ ...S.card(), padding:0, overflow:'auto', maxHeight:'calc(100vh - 180px)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100 }}>
            <thead>
              <tr>
                {[['#','num'],['Card','card'],['Sub-card','sub_card'],['Service','service_name'],['Sub-service','sub_service_name'],['Current ₹','current'],['New ₹','new'],['Partner ₹','partner_amt'],['Partner %','partner_pct'],['ScanV ₹','scanv_amt'],['ScanV %','scanv_pct'],['','save']].map(([label, key])=>(
                  <th key={key} style={{ ...th, ...(key === 'num' ? { width:36, textAlign:'center' } : {}) }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const idx = rows.indexOf(r);
                const rowNum = idx + 1;
                return (
                  <tr key={r.service_id}>
                    <td style={{ ...td, textAlign:'center', fontWeight:700, color:C.acc, fontSize:11 }} title={`Row ${rowNum} · ${r.service_id}`}>{rowNum}</td>
                    <td style={{ ...td, color:C.sub, maxWidth:100 }}>{r.card}</td>
                    <td style={{ ...td, color:C.dim, fontSize:10 }}>{r.sub_card}</td>
                    <td style={{ ...td, fontWeight:600, color:C.txt }}>{r.service_name}</td>
                    <td style={{ ...td, color:C.dim, fontSize:10, maxWidth:140 }}>{r.sub_service_name}</td>
                    <td style={td}><input type="number" value={paiseInp(r.current_amount_paise)} onChange={e=>updateRow(idx,'current_amount_paise',e.target.value)} style={inp}/></td>
                    <td style={td}><input type="number" value={paiseInp(r.new_amount_paise)} onChange={e=>updateRow(idx,'new_amount_paise',e.target.value)} style={{ ...inp, borderColor:C.acc, fontWeight:700 }}/></td>
                    <td style={td}><input type="number" value={paiseInp(r.partner_amount_paise)} onChange={e=>updateRow(idx,'partner_amount_paise',e.target.value)} style={inp}/></td>
                    <td style={td}><input type="number" step="0.01" value={r.partner_pct} onChange={e=>updateRow(idx,'partner_pct',e.target.value)} style={{ ...inp, width:56 }}/></td>
                    <td style={td}><input type="number" value={paiseInp(r.scanv_amount_paise)} onChange={e=>updateRow(idx,'scanv_amount_paise',e.target.value)} style={inp}/></td>
                    <td style={td}><input type="number" step="0.01" value={r.scanv_pct} onChange={e=>updateRow(idx,'scanv_pct',e.target.value)} style={{ ...inp, width:56 }}/></td>
                    <td style={td}><Btn v="ghost" sm onClick={()=>saveOne(idx)} disabled={saving}>Save</Btn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && !loading && <div style={{ padding:40, textAlign:'center', color:C.dim }}>No rows — deploy migration & edge function first</div>}
        </div>
        <div style={{ marginTop:14, fontSize:11, color:C.dim, lineHeight:1.6 }}>
          <strong>#</strong> is the fixed row number (1–{rows.length}) — use it when asking to change a specific row. Change <strong>New ₹</strong> to update card prices on the live app. Partner % and ScanV % auto-balance to 100%. Click <strong>Save all & go live</strong> — changes reflect immediately for all visitors.
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   VENDOR ONBOARDING — #vendor-onboard (Partner self-registration)
================================================================ */
function VendorOnboardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(emptyOtpDigits());
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [shopOrFlat, setShopOrFlat] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [streetName, setStreetName] = useState('');
  const [village, setVillage] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [stateName, setStateName] = useState('Maharashtra');
  const [countryCode, setCountryCode] = useState('IN');
  const [gps, setGps] = useState(null);
  const [gpsCheck, setGpsCheck] = useState(null);
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarOk, setAadhaarOk] = useState(false);
  const [pan, setPan] = useState('');
  const [panOk, setPanOk] = useState(null);
  const [selectedSvcs, setSelectedSvcs] = useState({});
  const allSvcs = allVendorSelectableServices();

  const captureGps = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const geo = await reverseGeo(pos.coords.latitude, pos.coords.longitude);
      setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, ...geo });
      setCity(geo.city || city);
      setPincode(geo.pincode || pincode);
      setVillage(geo.village || village);
      try {
        const ip = await getIP();
        const check = await vendorOnboardFetch('check-gps', {
          lat: pos.coords.latitude, lng: pos.coords.longitude, ip,
          requested_country_code: countryCode,
        });
        setGpsCheck(check);
        if (!check.country_allowed && countryCode !== 'IN') {
          setErr(check.message || 'Country not allowed for your GPS location');
          setCountryCode('IN');
        }
      } catch (e) { setErr(e.message); }
      setLoading(false);
    }, () => { setErr('GPS required for partner onboarding'); setLoading(false); },
    { enableHighAccuracy: true, maximumAge: 0 });
  };

  const sendOtp = async () => {
    if (phone.replace(/\D/g, '').length !== 10) return setErr('Enter valid 10-digit mobile');
    setLoading(true); setErr('');
    try {
      await vendorOnboardFetch('send-otp', { mobile: '+91' + phone.replace(/\D/g, '') });
      setOtpSent(true);
      setMsg('OTP sent to +91' + phone);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return setErr('Enter 6-digit OTP');
    setLoading(true); setErr('');
    try {
      await vendorOnboardFetch('verify-otp', { mobile: '+91' + phone.replace(/\D/g, ''), otp: code });
      setPhoneVerified(true);
      setStep(2);
      setMsg('Phone verified ✓');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const verifyAadhaar = async () => {
    if (aadhaar.replace(/\s/g, '').length !== 12) return setErr('Enter 12-digit Aadhaar');
    setLoading(true); setErr('');
    try {
      const r = await vendorOnboardFetch('ekyc-aadhaar', { aadhaar, name: contactName });
      if (!r.verified) throw new Error(r.error || 'Aadhaar eKYC failed');
      setAadhaarOk(true);
      setMsg('Aadhaar verified ✓ (last 4: ' + (r.last4 || '****') + ')');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const verifyPan = async () => {
    if (!pan.trim()) { setPanOk(true); return; }
    setLoading(true); setErr('');
    try {
      const r = await vendorOnboardFetch('validate-pan', { pan, name: contactName });
      setPanOk(r.valid);
      if (!r.valid) setErr(r.error || 'Invalid PAN');
      else setMsg('PAN validated ✓');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const toggleSvc = (id) => setSelectedSvcs(prev => ({ ...prev, [id]: !prev[id] }));

  const submit = async () => {
    const services = allSvcs.filter(s => selectedSvcs[s.service_id]).map(s => ({
      service_id: s.service_id, category_id: s.category_id,
    }));
    if (!services.length) return setErr('Select at least one service');
    if (!gps) return setErr('Capture GPS location first');
    if (!aadhaarOk) return setErr('Complete Aadhaar eKYC first');
    setLoading(true); setErr('');
    try {
      const ip = await getIP();
      const r = await vendorOnboardFetch('register', {
        phone: '+91' + phone.replace(/\D/g, ''),
        business_name: businessName,
        contact_name: contactName,
        email,
        shop_or_flat: shopOrFlat,
        building_name: buildingName,
        street_name: streetName,
        village,
        city,
        pincode,
        state: stateName,
        country: COUNTRY_OPTIONS.find(c => c.code === countryCode)?.name || 'India',
        country_code: countryCode,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        address_lat: gps.lat,
        address_lng: gps.lng,
        ip,
        aadhaar_number: aadhaar,
        pan_number: pan || null,
        pan_verified: !!pan && panOk,
        services,
      });
      setMsg(r.message || 'Registration submitted!');
      setStep(6);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const stepLabels = ['Phone OTP', 'Business & address', 'Aadhaar eKYC', 'PAN (optional)', 'Services', 'Done'];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FF }}>
      <div style={{ background: C.surf, borderBottom: BDR, padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 10, color: C.cyan, fontWeight: 700, letterSpacing: 1 }}>PARTNER ONBOARDING</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.txt }}>Become a ScanV Partner</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {stepLabels.map((l, i) => (
            <div key={l} style={{ flex: 1, height: 3, borderRadius: 2, background: step > i ? C.acc : C.deep }} title={l} />
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
        {err && <div style={S.err}>{err}</div>}
        {msg && <div style={{ background: '#e6f4ee', border: `1.5px solid rgba(0,122,77,0.35)`, borderRadius: 8, padding: '10px 14px', color: C.grn, fontSize: 13, marginBottom: 14 }}>{msg}</div>}

        {step === 1 && <>
          <Field label="Mobile number" req note="OTP verified — required for booking alerts">
            <div style={{ display: 'flex', alignItems: 'center', background: C.deep, border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '11px 12px', background: C.card, borderRight: `1px solid ${C.bdr}`, color: C.sub, fontSize: 14, fontWeight: 600 }}>+91</div>
              <input type="tel" maxLength={10} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" style={{ ...S.inp(), border: 'none', borderRadius: 0, background: 'transparent' }} disabled={phoneVerified} />
            </div>
          </Field>
          {!otpSent ? <Btn full onClick={sendOtp} disabled={loading}>{loading ? <><Spin size={16} /> Sending…</> : 'Send OTP →'}</Btn> : <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              {otp.map((d, i) => (
                <input key={i} maxLength={1} value={d} inputMode="numeric"
                  onChange={e => { const nd = [...otp]; nd[i] = e.target.value.replace(/\D/, '').slice(-1); setOtp(nd); }}
                  style={{ width: 40, height: 48, textAlign: 'center', background: d ? `${C.acc}20` : C.deep, border: `1.5px solid ${d ? C.acc : C.bdr}`, borderRadius: 8, color: C.acc, fontFamily: 'monospace', fontSize: 22, outline: 'none' }} />
              ))}
            </div>
            <Btn full onClick={verifyOtp} disabled={loading || phoneVerified}>{loading ? <><Spin size={16} /> Verifying…</> : 'Verify OTP →'}</Btn>
          </>}
        </>}

        {step === 2 && <>
          <Field label="Business / shop name" req><input value={businessName} onChange={e => setBusinessName(e.target.value)} style={S.inp()} placeholder="Sharma Home Services" /></Field>
          <Field label="Contact person name" req><input value={contactName} onChange={e => setContactName(e.target.value)} style={S.inp()} placeholder="Rahul Sharma" /></Field>
          <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={S.inp()} placeholder="partner@example.com" /></Field>
          <Field label="Shop # / Flat #" req><input value={shopOrFlat} onChange={e => setShopOrFlat(e.target.value)} style={S.inp()} placeholder="Shop 12 / Flat 302" /></Field>
          <Field label="Building name"><input value={buildingName} onChange={e => setBuildingName(e.target.value)} style={S.inp()} placeholder="Rose Plaza" /></Field>
          <Field label="Street name" req><input value={streetName} onChange={e => setStreetName(e.target.value)} style={S.inp()} placeholder="Wakad Main Road" /></Field>
          <Field label="Village / locality"><input value={village} onChange={e => setVillage(e.target.value)} style={S.inp()} placeholder="Wakad" /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="City" req><input value={city} onChange={e => setCity(e.target.value)} style={S.inp()} placeholder="Pune" /></Field>
            <Field label="PIN code" req><input maxLength={6} value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={S.inp()} placeholder="411057" /></Field>
          </div>
          <Field label="State" req>
            <select value={stateName} onChange={e => setStateName(e.target.value)} style={S.inp()}>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Country" note="India default. Other countries only if real GPS shows you outside India (no VPN).">
            <select value={countryCode} onChange={async e => {
              const code = e.target.value;
              setCountryCode(code);
              if (code !== 'IN' && gps) {
                try {
                  const ip = await getIP();
                  const check = await vendorOnboardFetch('check-gps', { lat: gps.lat, lng: gps.lng, ip, requested_country_code: code });
                  setGpsCheck(check);
                  if (!check.country_allowed) { setErr(check.message); setCountryCode('IN'); }
                } catch (ex) { setErr(ex.message); }
              }
            }} style={S.inp()}>
              {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="GPS location" req note="Required — used to match you with nearby bookings">
            <Btn v="outline" full onClick={captureGps} disabled={loading}>{gps ? `✓ GPS: ${gps.lat?.toFixed(4)}, ${gps.lng?.toFixed(4)}` : loading ? 'Getting GPS…' : '📍 Capture GPS location'}</Btn>
            {gpsCheck?.vpn_suspected && <div style={{ color: C.red, fontSize: 11, marginTop: 6 }}>⚠ VPN/proxy detected — disable VPN for accurate location</div>}
          </Field>
          <Btn full onClick={() => { if (!businessName || !contactName || !shopOrFlat || !streetName || !city || !pincode || !gps) return setErr('Complete all required fields + GPS'); setStep(3); setErr(''); }}>Continue →</Btn>
        </>}

        {step === 3 && <>
          <div style={{ ...S.card(), marginBottom: 16, padding: 14, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>
            Aadhaar eKYC is mandatory. Your full Aadhaar is never stored — only last 4 digits after verification via UIDAI-approved provider.
          </div>
          <Field label="Aadhaar number" req note="12 digits — OTP sent to Aadhaar-linked mobile">
            <input type="tel" maxLength={14} value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} style={S.inp()} placeholder="XXXX XXXX XXXX" disabled={aadhaarOk} />
          </Field>
          {!aadhaarOk ? <Btn full onClick={verifyAadhaar} disabled={loading}>{loading ? <><Spin size={16} /> Verifying…</> : 'Verify Aadhaar (eKYC) →'}</Btn>
            : <Btn full onClick={() => setStep(4)}>Continue →</Btn>}
        </>}

        {step === 4 && <>
          <Field label="PAN card (optional)" note="Format: AAAAA9999A — validated if provided">
            <input value={pan} onChange={e => setPan(e.target.value.toUpperCase().slice(0, 10))} style={S.inp()} placeholder="ABCDE1234F" />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            {pan && <Btn v="outline" onClick={verifyPan} disabled={loading}>Validate PAN</Btn>}
            <Btn full onClick={() => { if (pan && panOk === false) return setErr('Fix PAN or leave blank'); setStep(5); setErr(''); }}>{pan ? 'Continue →' : 'Skip PAN →'}</Btn>
          </div>
        </>}

        {step === 5 && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 10 }}>Select services you can provide</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
            {Object.entries(
              allSvcs.reduce((acc, s) => { (acc[s.cat] = acc[s.cat] || []).push(s); return acc; }, {})
            ).map(([cat, svcs]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.acc, marginBottom: 6 }}>{cat}</div>
                {svcs.map(s => (
                  <label key={s.service_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.bdr}`, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={!!selectedSvcs[s.service_id]} onChange={() => toggleSvc(s.service_id)} />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <Btn full onClick={submit} disabled={loading}>{loading ? <><Spin size={16} /> Submitting…</> : 'Submit partner application →'}</Btn>
        </>}

        {step === 6 && (
          <div style={{ ...S.card(), textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 8 }}>Application submitted!</div>
            <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>ScanV will review and activate your partner account. Once active, you'll receive booking alerts via SMS, call & WhatsApp.</div>
          </div>
        )}

        {step > 1 && step < 6 && (
          <button type="button" onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, marginTop: 16, cursor: 'pointer', fontFamily: FF }}>← Back</button>
        )}
        <div style={{ marginTop: 24, fontSize: 11, color: C.dim, textAlign: 'center' }}>
          Bookmark: <code style={{ color: C.acc }}>{APP_URL}/#vendor-onboard</code>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   VENDOR ADMIN — #vendor-admin (Activate / offboard partners)
================================================================ */
function VendorAdminPage() {
  const [pin, setPin] = useState(() => sessionStorage.getItem(VENDOR_PIN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (usePin) => {
    setLoading(true); setErr('');
    try {
      const { vendors: data } = await vendorOnboardFetch('list', {}, usePin);
      setVendors(data || []);
      setAuthed(true);
      sessionStorage.setItem(VENDOR_PIN_KEY, usePin);
      setMsg(`Loaded ${data?.length || 0} partners`);
    } catch (e) {
      setErr(e.message);
      setAuthed(false);
    } finally { setLoading(false); }
  }, []);

  const login = () => load(pin);

  const activate = async (id) => {
    setLoading(true);
    try {
      await vendorOnboardFetch('activate', { vendor_id: id }, pin);
      await load(pin);
      setMsg('Partner activated');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const offboard = async (id) => {
    if (!window.confirm('Offboard this partner? They will stop receiving bookings.')) return;
    setLoading(true);
    try {
      await vendorOnboardFetch('offboard', { vendor_id: id }, pin);
      await load(pin);
      setMsg('Partner offboarded');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const shown = filter === 'all' ? vendors : vendors.filter(v => v.status === filter);
  const statusColor = { pending: C.cyan, active: C.grn, suspended: C.red, offboarded: C.dim };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FF, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...S.card(), maxWidth: 360, width: '100%', padding: 24 }}>
          <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>LEADER ONLY</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 6 }}>Partner Admin</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>Activate or offboard ScanV partners. Not linked in public nav.</div>
          <Field label="Admin PIN">
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} style={S.inp()} placeholder="••••••••" />
          </Field>
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
          <Btn full onClick={login} disabled={!pin || loading}>{loading ? 'Loading…' : 'Unlock partner admin'}</Btn>
          <div style={{ marginTop: 16, fontSize: 11, color: C.dim, textAlign: 'center' }}>
            Bookmark: <code style={{ color: C.acc }}>{APP_URL}/#vendor-admin</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FF }}>
      <div style={{ background: C.surf, borderBottom: BDR, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>PARTNER ADMIN</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.txt }}>ScanV Partners ({vendors.length})</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn v="outline" sm onClick={() => load(pin)} disabled={loading}>Reload</Btn>
            <Btn v="ghost" sm onClick={() => { setAuthed(false); sessionStorage.removeItem(VENDOR_PIN_KEY); }}>Lock</Btn>
          </div>
        </div>
        {msg && <div style={{ color: C.grn, fontSize: 12, marginTop: 8 }}>{msg}</div>}
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {['all', 'pending', 'active', 'offboarded'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${filter === f ? C.acc : C.bdr}`, background: filter === f ? `${C.acc}18` : C.surf, color: filter === f ? C.acc : C.sub, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {shown.map(v => (
          <div key={v.id} style={{ ...S.card(), marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, color: C.txt, fontSize: 15 }}>{v.business_name}</div>
                <div style={{ fontSize: 12, color: C.sub }}>{v.contact_name} · {v.phone}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{v.shop_or_flat}, {v.street_name}, {v.city} {v.pincode}, {v.state}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                  {v.aadhaar_verified && '✓ Aadhaar '}{v.pan_verified && '✓ PAN '}{v.phone_verified && '✓ Phone '}
                  · {(v.vendor_partner_services || []).filter(s => s.is_active).length} services
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Badge label={v.status} color={statusColor[v.status] || C.sub} />
                {v.status === 'pending' && <Btn sm onClick={() => activate(v.id)} disabled={loading}>Activate</Btn>}
                {v.status === 'active' && <Btn v="danger" sm onClick={() => offboard(v.id)} disabled={loading}>Offboard</Btn>}
              </div>
            </div>
          </div>
        ))}
        {!shown.length && !loading && <div style={{ textAlign: 'center', color: C.dim, padding: 40 }}>No partners — share {APP_URL}/#vendor-onboard</div>}
      </div>
    </div>
  );
}

/* ================================================================
   ROOT APP
================================================================ */
/* ================================================================
   LEGAL PAGES -- Served at /privacy /terms /refund /payment
================================================================ */
function LegalPage({page}) {
  const pages = {
    privacy:  {
      title:'Privacy Policy',
      badge:'PRIVACY',
      updated:'10 August 2026',
      content: (
        <>
          <div style={{background:`${C.grn}22`,border:`1px solid ${C.grn}44`,borderRadius:10,padding:14,marginBottom:24}}>
            <p style={{margin:0,color:C.grn,fontSize:13}}>🔒 All data stored in India (AWS Mumbai) · DPDP Act 2023 compliant · We never sell your data</p>
          </div>
          {[
            ['Who We Are','ScanV is operated by DCORE Global Corporation, Pune, Maharashtra. We connect customers with independent service providers across PCMC, Pune and Maharashtra. DPO: privacy@dcoreglobal.com'],
            ['Data We Collect','Identity (name), Contact (mobile — OTP verified), Location (GPS, IP, PIN code, city), Device (type, OS, browser, timezone, language, battery, canvas fingerprint), Booking details, and session behaviour. We do NOT collect Aadhaar, PAN, passport, card numbers, passwords, or biometrics.'],
            ['How We Use It','Verify identity via OTP before any booking · Match you with nearby service providers · Send booking updates · Process payments for GST compliance · Prevent fraud · Improve platform quality through anonymised analytics · Comply with Indian law'],
            ['Location Data','ScanV requests GPS when you open the app and when you book. Location is used only to show nearby services and enable delivery routing. IP-based location is used as fallback. We never sell location data to advertisers.'],
            ['Data Sharing','Name, mobile, and location shared with your assigned Partner to fulfil the booking · Transaction data with Razorpay (PCI-DSS L1) for payments · Mobile with Twilio/MSG91 for OTP delivery · Government/courts only when legally required. We never share with advertisers or data brokers.'],
            ['Retention','Bookings: 7 years (GST compliance) · OTP records: 30 days · Device/session data: 12 months · Account deletion: permanently removed within 30 days'],
            ['Your Rights (DPDP Act 2023)','Access your data · Correct inaccurate data · Request erasure · Raise a grievance · Nominate a representative · Withdraw consent. Contact: privacy@dcoreglobal.com · Response within 30 days'],
            ['Security','TLS 1.3 encryption in transit · AES-256 at rest · AWS Mumbai (data never leaves India) · OTP-only authentication (no passwords stored) · Row-level database security · Regular security audits'],
            ['Children','ScanV is for users 18+. We do not knowingly collect data from minors. Contact privacy@dcoreglobal.com if you believe a minor has registered.'],
          ].map(([h,b])=>(<div key={h} style={{marginBottom:20}}><div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bdr}`}}>{h}</div><p style={{color:C.sub,fontSize:13,lineHeight:1.7,margin:0}}>{b}</p></div>))}
        </>
      )
    },
    terms: {
      title:'Terms & Conditions',
      badge:'TERMS',
      updated:'10 August 2026',
      content: (
        <>
          <div style={{background:`${C.gold}22`,border:`1px solid ${C.gold}44`,borderRadius:10,padding:14,marginBottom:24}}>
            <p style={{margin:0,color:C.gold,fontSize:13}}>⚠️ By using ScanV or placing a booking, you agree to these terms in full.</p>
          </div>
          {[
            ['ScanV as Marketplace Intermediary','DCORE Global Corporation operates ScanV as an IT Intermediary under the IT Act 2000. We connect Users with independent Partners. We do not employ Partners, do not deliver services, and are not responsible for service quality, safety, timeliness, or outcomes. DCORE’s maximum liability for any booking is limited to the platform fee collected for that booking.'],
            ['Eligibility','Must be 18+ · Valid Indian mobile · Legally capable of contracts under Indian law · Must accept Terms, Privacy Policy, and DPDP Act 2023 compliance before first booking'],
            ['Booking Confirmation','A booking is confirmed only when: mobile OTP/WhatsApp verified + Terms accepted + unique TXN ID generated + platform fee paid. DCORE may cancel bookings if no Partner is available or fraud is detected.'],
            ['User Responsibilities','Provide accurate booking details · Be present at the agreed time and location · Treat Partners respectfully · Report disputes within 48 hours of service completion · Do not book for unlawful purposes'],
            ['Payment & Fees','Platform fee: 10% of service value · GST at applicable rates on total · Service fees are indicative and agreed with the Partner · Cash-on-service: platform fee still payable online'],
            ['Professional Services Disclaimer','Legal services: advice is between you and the advocate (DCORE has no liability). Healthcare: treatment is between you and the practitioner (DCORE has no liability). Training: results are between you and the trainer.'],
            ['Liability Limitation','DCORE’s total liability for any claim is capped at the platform fee for that booking. We are not liable for indirect, consequential, or punitive damages. Partners are independent contractors.'],
            ['Prohibited Uses','Illegal purposes · Reverse engineering the platform · Fake bookings or reviews · Soliciting Partners outside ScanV · Abuse or harassment of Partners or Users'],
            ['Governing Law','Laws of India · Courts of Pune, Maharashtra have exclusive jurisdiction · 30-day good-faith negotiation before legal action · Contact: legal@dcoreglobal.com'],
          ].map(([h,b])=>(<div key={h} style={{marginBottom:20}}><div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bdr}`}}>{h}</div><p style={{color:C.sub,fontSize:13,lineHeight:1.7,margin:0}}>{b}</p></div>))}
        </>
      )
    },
    refund: {
      title:'Refund Policy',
      badge:'REFUNDS',
      updated:'10 August 2026',
      content: (
        <>
          <div style={{background:`${C.gold}22`,border:`1px solid ${C.gold}44`,borderRadius:10,padding:14,marginBottom:24}}>
            <p style={{margin:0,color:C.gold,fontSize:13}}>⚠️ Refunds apply only to the platform fee (10%) collected by DCORE. Service fees paid to Partners — including cash — are outside DCORE’s refund scope.</p>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${C.bdr}`}}>Cancellation Schedule</div>
            {[['24+ hrs before','Platform fee: 100% refunded'],['2–24 hrs before','Platform fee: 50% refunded'],['Under 2 hrs','Platform fee: no refund'],['No-show','No refund'],['Cancelled by DCORE','100% refunded']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.bdr}`,fontSize:13}}>
                <span style={{color:C.sub}}>{k}</span><span style={{color:C.txt,fontWeight:500}}>{v}</span>
              </div>
            ))}
          </div>
          {[
            ['What DCORE Refunds','DCORE cancels due to unavailable Partner · Technical error causing incorrect charge · Duplicate payment · Payment processed but no booking confirmed'],
            ['What DCORE Does Not Refund','Service quality disputes (User vs Partner) · User cancellation after Partner assigned · User no-show · Change of mind · Cash payments to Partners · Professional service outcomes (legal, medical, training)'],
            ['Non-Refundable Categories','Legal consultations (once conducted) · Cloud training (once batch started) · VIP appointments (deposit within 24hrs) · Food (once preparation started) · Healthcare (once consultation complete)'],
            ['Refund Processing','5–7 business days · Returned to original payment method · UPI refunds: 3–5 business days post-processing · GST credit note issued for all refunds'],
            ['How to Request','App: Open booking → Raise a dispute → Refund Request · Email: refunds@dcoreglobal.com with your TXN-XXXXXXXX · Response within 24 business hours'],
          ].map(([h,b])=>(<div key={h} style={{marginBottom:20}}><div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bdr}`}}>{h}</div><p style={{color:C.sub,fontSize:13,lineHeight:1.7,margin:0}}>{b}</p></div>))}
        </>
      )
    },
    payment: {
      title:'Payment Policy',
      badge:'PAYMENTS',
      updated:'10 August 2026',
      content: (
        <>
          <div style={{background:`${C.cyan}22`,border:`1px solid ${C.cyan}44`,borderRadius:10,padding:14,marginBottom:24}}>
            <p style={{margin:0,color:C.cyan,fontSize:13}}>💳 All online payments processed by Razorpay (PCI-DSS Level 1). We never store card or bank details.</p>
          </div>
          {[
            ['Accepted Methods','UPI (GPay, PhonePe, Paytm, any UPI app) · Debit/Credit cards (Visa, Mastercard, RuPay) · Net banking (all major Indian banks)'],
            ['How It Works','Platform fee (10%) paid online at booking via UPI. GST added to total. Tax invoice auto-generated for every booking.'],
            ['UPI Payment','Pay to: dcoreglobal@upi · Use your TXN-XXXXXXXX as payment reference · Confirmation SMS within 5 minutes · Always include TXN ID to avoid reconciliation delays'],
            ['Security','Razorpay PCI-DSS L1 · TLS 1.3 encryption · AES-256 at rest · No card/CVV/bank details stored by ScanV · RBI-mandated 2FA for card payments'],
            ['Failed Payments','No deduction on failure · Booking stays "Pending Payment" for 24 hours · Auto-refund in 5–7 days if deducted but booking not confirmed · Contact: payments@dcoreglobal.com'],
            ['Partner Payouts','Within 3 business days of service completion · Via UPI to Partner’s registered UPI ID · TDS deducted under Section 194-O Income Tax Act · Monthly payout statements issued'],
            ['Regulatory','RBI compliant payment aggregator · GST Act 2017 · Section 194-O TDS · 8-year payment record retention · GSTR-1 filed annually'],
          ].map(([h,b])=>(<div key={h} style={{marginBottom:20}}><div style={{color:C.txt,fontWeight:600,fontSize:14,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.bdr}`}}>{h}</div><p style={{color:C.sub,fontSize:13,lineHeight:1.7,margin:0}}>{b}</p></div>))}
        </>
      )
    },
  };
  const pg = pages[page];
  if (!pg) return null;
  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:FF}}>
      {/* Header */}
      <div style={{background:C.surf,borderBottom:BDR,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
        <div style={{fontWeight:800,fontSize:20,fontFamily:FF}}><span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span></div>
        <button onClick={()=>window.history.back()} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:13,fontFamily:FF}}>← Back</button>
      </div>
      <div style={{maxWidth:720,margin:'0 auto',padding:'32px 20px 80px'}}>
        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${C.surf},${C.card})`,border:`1px solid ${C.bdr}`,borderRadius:16,padding:'28px 24px',marginBottom:28}}>
          <div style={{display:'inline-block',background:C.acc,color:'#fff',fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:20,letterSpacing:1,marginBottom:10}}>{pg.badge}</div>
          <div style={{color:C.txt,fontSize:24,fontWeight:800,marginBottom:4}}>{pg.title}</div>
          <div style={{color:C.sub,fontSize:12}}>DCORE Global Corporation · ScanV · Updated: {pg.updated}</div>
        </div>
        {/* Content */}
        {pg.content}
        {/* Footer links */}
        <div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:20,marginTop:20,display:'flex',gap:16,flexWrap:'wrap',justifyContent:'center'}}>
          {[['privacy','Privacy'],['terms','Terms'],['refund','Refund'],['payment','Payment']].map(([k,l])=>(
            <a key={k} href={`/${k}`} style={{color:page===k?C.acc:C.dim,fontSize:12,textDecoration:'none'}}>{l} Policy</a>
          ))}
          <a href="https://www.dcoreglobal.com" target="_blank" rel="noreferrer" style={{color:C.dim,fontSize:12}}>DCORE Global ↗</a>
        </div>
        <div style={{textAlign:'center',marginTop:16,color:C.dim,fontSize:11}}>
          © 2026 DCORE Global Corporation · ScanV · Pune, India · DPDP Act 2023 Compliant
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state,setState]       = useState('boot');
  const [user,setUser]         = useState(null);
  const [screen,setScreen]     = useState('home');
  const [activeSvc,setActiveSvc] = useState(null);
  const [toasts,setToasts]     = useState([]);
  const [notifs,setNotifs]     = useState([]);
  const [qrPrefill,setQrPrefill] = useState(null);
  const [,forceUpdate]         = useReducer(x=>x+1,0);
  const [silentGeo, setSilentGeo] = useState(null); // GPS captured silently
  const [trackBookingId, setTrackBookingId] = useState(() => trackBookingIdFromHash() || sessionStorage.getItem(TRACK_BOOKING_KEY) || null);
  const refreshPricing = useCallback(() => { forceUpdate(); }, []);

  const addToast=useCallback((msg,type='info')=>{
    const id=Date.now(); setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);
  },[]);

  const logout=useCallback(async()=>{
    try{await sb().auth.signOut();}catch(e){}
    localStorage.removeItem('scanv_uid');
    setUser(null); setState('browse'); setScreen('services');
  },[]);

  // Check if QR scan (?qr=1 in URL)
  const isQRScan = new URLSearchParams(window.location.search).get('qr')==='1';
  // Pass silentGeo down via context

  useEffect(()=>{
    (async()=>{
      // Load live pricing overrides before showing services
      await fetchLivePricing();

      // Silently capture device + IP + location in background
      try {
        const device = detectDevice();
        const ipAddr = await getIP();
        const battery = await getBattery();
        const canvasFP = getCanvasFP();
        // Store visitor session silently
        sb().from('visitor_sessions').insert({
          ip_address:ipAddr, user_agent:device.userAgent, device_type:device.deviceType,
          os_name:device.osName, browser:device.browser, screen_res:device.screenRes,
          language:device.language, timezone:device.timezone,
          canvas_fp:canvasFP, battery_level:battery.level,
          consent_given:true, consent_at:new Date().toISOString(), verified:false,
        }).then(()=>{}).catch(()=>{});
        // Silently get GPS
        navigator.geolocation.getCurrentPosition(async pos=>{
          const geo = await reverseGeo(pos.coords.latitude, pos.coords.longitude);
          setSilentGeo({lat:pos.coords.latitude,lng:pos.coords.longitude,...geo,device,ip:ipAddr});
        },()=>{}, {timeout:8000,enableHighAccuracy:true,maximumAge:0});
      } catch(e){}

      // Try restoring existing session
      try {
        const {data:{session}}=await sb().auth.getSession();
        if (session) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',session.user.id).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) {
            setUser(p); setState('app');
            const tid = trackBookingIdFromHash() || sessionStorage.getItem(TRACK_BOOKING_KEY);
            if (isTrackRoute() && tid) { setTrackBookingId(tid); setScreen('track'); }
            return;
          }
        }
        const uid=localStorage.getItem('scanv_uid');
        if (uid) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',uid).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) {
            setUser(p); setState('app');
            const tid = trackBookingIdFromHash() || sessionStorage.getItem(TRACK_BOOKING_KEY);
            if (isTrackRoute() && tid) { setTrackBookingId(tid); setScreen('track'); }
            return;
          }
        }
      } catch(e){ console.warn('[ScanV]',e.message); }
      // Always show services first -- no registration wall
      setState(isQRScan?'qr':'browse');
    })();
  },[]);

  // Realtime price sync — card amounts update without reload
  useEffect(()=>{
    let channel;
    try {
      channel = sb().channel('live-pricing')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_prices_public' }, async () => {
          await fetchLivePricing();
          refreshPricing();
        })
        .subscribe();
    } catch { /* supabase not ready */ }
    return () => { if (channel) sb().removeChannel(channel); };
  }, [refreshPricing]);

  useEffect(()=>{
    if (state!=='app'||!user) return;
    const onHash=()=>{
      const tid=trackBookingIdFromHash();
      if(isTrackRoute()&&tid){ setTrackBookingId(tid); setScreen('track'); }
    };
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[state,user]);

  useEffect(()=>{
    if (!user) return;
    sb().from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
      .then(({data})=>setNotifs(data||[]));
  },[user]);

  const legalPath = legalSegment();
  if (isLegalRoute()) {
    return <Boundary><style>{APP_CSS}</style><LegalPage page={legalPath}/></Boundary>;
  }

  if (isPricingAdminRoute()) {
    return (
      <Boundary>
        <style>{APP_CSS}</style>
        <PricingAdminPage onPricesUpdated={refreshPricing}/>
      </Boundary>
    );
  }

  if (isVendorOnboardRoute()) {
    return (
      <Boundary>
        <style>{APP_CSS}</style>
        <VendorOnboardPage/>
      </Boundary>
    );
  }

  if (isVendorAdminRoute()) {
    return (
      <Boundary>
        <style>{APP_CSS}</style>
        <VendorAdminPage/>
      </Boundary>
    );
  }

  if (state==='boot') return (
    <><style>{APP_CSS}</style>
    <div style={S.center}><div style={{fontSize:32,fontWeight:800,fontFamily:FF}}><span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span></div><Spin size={32}/></div></>
  );

  // QR landing page -- capture data then proceed to register
  if (state==='qr') return (
    <Boundary><style>{APP_CSS}</style><Toast toasts={toasts}/>
    <QRLandingPage onContinue={(scanId,dev,ip,geo,coords)=>{
      setQrPrefill({scanId,dev,ip,geo});
      setState('register');
    }}/>
    </Boundary>
  );

  // BROWSE: Show services without registration wall
  if (state==='browse') return (
    <Boundary><style>{APP_CSS}</style><Toast toasts={toasts}/>
    <BrowseFlow
      silentGeo={silentGeo}
      onRegistered={(p, bookingId)=>{setUser(p);setState('app');if(bookingId)goToTrack(setTrackBookingId,setScreen,bookingId);else setScreen('home');}}
      addToast={addToast}
    />
    </Boundary>
  );

  if (state==='register') return (
    <Boundary><style>{APP_CSS}</style><Toast toasts={toasts}/>
    <RegistrationFlow prefill={qrPrefill} onComplete={p=>{setUser(p);setState('app');}}/>
    </Boundary>
  );

  const ctx={user,setUser,screen,setScreen,activeSvc,setActiveSvc,notifs,addToast,logout,silentGeo,setSilentGeo,setState,setUser,refreshPricing,trackBookingId,setTrackBookingId};

  const renderScreen=()=>{
    if (screen==='book')     return <BookScreen/>;
    if (screen==='track')    return <TrackServiceScreen/>;
    if (screen==='services') return <ServicesScreen/>;
    if (screen==='bookings') return <BookingsScreen/>;
    if (screen==='crm')      return <CRMScreen/>;
    if (screen==='qr')       return <QRScreen/>;
    if (screen==='profile')  return <ProfileScreen/>;
    if (user.role==='admin') return <><TopBar/><LeaderHome/></>;
    return <HomeScreen/>;
  };

  return (
    <Boundary>
      <Ctx.Provider value={ctx}>
        <style>{APP_CSS}</style>
        <Toast toasts={toasts}/>
        <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:480,margin:'0 auto',background:C.bg}}>
          <Boundary>{renderScreen()}</Boundary>
          {!['book','track'].includes(screen)&&<BottomNav/>}
        </div>
      </Ctx.Provider>
    </Boundary>
  );
}
