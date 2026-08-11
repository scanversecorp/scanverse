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
const SVC_SHORT = { legal:'Legal', cloud:'Cloud', vip:'VIP', health:'Health', property:'Property', household:'Household', delivery:'Delivery', food:'Food' };

/* --- SERVICES ----------------------------------------------------- */
const SVCS = [
  { id:'legal',    icon:'⚖️', name:'Legal services',     sub:'Lawyers · docs · filings',        cat:'Legal',              cash:false },
  { id:'cloud',    icon:'☁️', name:'Cloud training',     sub:'AWS · Azure · GCP · AI',           cat:'Cloud Training',     cash:false },
  { id:'vip',      icon:'👑', name:'VIP appointments',   sub:'Priority · concierge · executive', cat:'VIP Appointments',   cash:false },
  { id:'health',   icon:'🏥', name:'Health care',        sub:'Doctors · tests · pharmacy',       cat:'Health Care',        cash:false },
  { id:'property', icon:'🏡', name:'Property & rentals', sub:'Buy · sell · PG · flat · plots',   cat:'Property & Rentals', cash:false },
  { id:'household',icon:'🔧', name:'Household services', sub:'Plumbing · electrical · cleaning', cat:'Household Services', cash:true  },
  { id:'delivery', icon:'📦', name:'Deliveries',         sub:'Courier · parcels · documents',    cat:'Deliveries',         cash:true  },
  { id:'food',     icon:'🍱', name:'Food',               sub:'Restaurants · tiffin · catering',  cat:'Food',               cash:true  },
];

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

async function reverseGeo(lat,lng) {
  try {
    // Primary: Nominatim for address details
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
    const d=await r.json(); const a=d.address||{};
    let pincode = a.postcode||'';
    // Secondary: India Post API for accurate PIN code (Nominatim PIN is often wrong)
    if (!pincode || pincode.length !== 6) {
      try {
        const r2 = await fetch(`https://api.postalpincode.in/latlong/${lat}/${lng}`);
        const d2 = await r2.json();
        if (d2&&d2[0]&&d2[0].Status==='Success'&&d2[0].PostOffice?.[0]?.Pincode) {
          pincode = d2[0].PostOffice[0].Pincode;
        }
      } catch(e2) { /* fallback to Nominatim */ }
    }
    return {
      address: d.display_name?.split(',').slice(0,4).join(',').trim()||'',
      village: a.village||a.suburb||a.neighbourhood||a.town||a.residential||'',
      city: a.city||a.town||a.county||'Pune',
      state: a.state||'Maharashtra',
      pincode,
      country: a.country||'India'
    };
  } catch(e) { return {address:'',village:'',city:'Pune',state:'Maharashtra',pincode:'',country:'India'}; }
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

function OtpSentFooter({ mobile, onChangeNumber, onResend, onScreenFallback, loading, screenMode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {!screenMode ? (
        <>
          <div style={{ color: C.grn, fontSize: 12, marginBottom: 10, fontWeight: 700, textAlign: 'center' }}>✅ OTP sent to +91 {mobile}</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <button type="button" onClick={onChangeNumber} style={{ background: 'none', border: 'none', color: C.cyan, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}>Change number</button>
            <button type="button" onClick={onResend} disabled={loading} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: FF, opacity: loading ? 0.5 : 1 }}>{loading ? 'Sending…' : 'Resend OTP'}</button>
          </div>
          {onScreenFallback && (
            <button type="button" onClick={onScreenFallback} disabled={loading} style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: C.acc, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FF, textDecoration: 'underline' }}>
              Didn&apos;t receive SMS? Show code on screen
            </button>
          )}
        </>
      ) : (
        <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Using on-screen code for +91 {mobile}</div>
      )}
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

async function storeClientOtp(mobile) {
  const norm = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g,'').slice(-10)}`;
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await sb().from('custom_otp').update({ used: true }).eq('mobile', norm).eq('used', false);
  await sb().from('custom_otp').insert({
    mobile: norm, otp,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  return otp;
}

async function verifyOtpCode(mobile, code) {
  const norm = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g,'').slice(-10)}`;
  try {
    const r = await sb().functions.invoke('send-otp', { body: { mobile: norm, otp: code, action: 'verify' } });
    if (r.data?.success) return true;
  } catch (_) {}
  return verifyCustomOTP(norm, code);
}

function ScreenOtpBanner({ otp, onFill }) {
  if (!otp) return null;
  return (
    <div
      onClick={() => onFill?.(otp)}
      style={{ background: C.acc, borderRadius: 12, padding: 16, marginBottom: 14, textAlign: 'center', cursor: 'pointer' }}
    >
      <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>🔐 Your OTP — tap to auto-fill</div>
      <div style={{ color: '#fff', fontSize: 40, fontFamily: 'monospace', fontWeight: 800, letterSpacing: 8 }}>{otp}</div>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 6 }}>SMS may be delayed — use this code to continue</div>
    </div>
  );
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
        {timeout:8000, enableHighAccuracy:true}
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
  const [screenOtp, setScreenOtp] = useState('');
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
    setScreenOtp('');
    setWaToken('');
    setWaChecking(false);
  };

  const fillOtpFromScreen = (otp) => {
    const d = otp.split('');
    setOtpCode([d[0]||'', d[1]||'', d[2]||'', d[3]||'', d[4]||'', d[5]||'']);
  };

  const showScreenOtpFallback = async () => {
    if (!mobile || mobile.length !== 10) return setErr('Enter valid 10-digit mobile');
    setLoading(true); setErr('');
    try {
      const otp = await storeClientOtp(`+91${mobile}`);
      setScreenOtp(otp);
      setOtpSent(true);
      setOtpTargetMobile(mobile);
      setOtpCode(emptyOtpDigits());
      addToast?.('Code shown below — tap it to auto-fill', 'info');
      invokeSendOtp(`+91${mobile}`).catch(() => {});
    } catch (e) { setErr(e.message || 'Could not generate code'); }
    finally { setLoading(false); }
  };

  const sendOTP = async (resend = false) => {
    if (!firstName.trim()) return setErr('Enter your first name');
    if (!mobile||mobile.length!==10) return setErr('Enter valid 10-digit mobile');
    if (!localStorage.getItem('scanv_terms_accepted')) return setErr('Please accept Terms & Conditions to continue');
    setLoading(true); setErr('');
    try {
      await invokeSendOtp(`+91${mobile}`);
      setOtpSent(true);
      setOtpTargetMobile(mobile);
      setOtpCode(emptyOtpDigits());
      setScreenOtp('');
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
      setScreenOtp('');
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
      onRegistered(pendingProfile);
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

  const svcList = SVCS.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||s.sub.toLowerCase().includes(search.toLowerCase())||(SVC_SHORT[s.id]||'').toLowerCase().includes(search.toLowerCase()));

  // -- SERVICES LIST --------------------------------------------------------
  if (screen==='services') return browseWrap(
    <>
      <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
        <div style={{fontWeight:800,fontSize:20,fontFamily:FF,color:C.txt}}>Scan<span style={{color:C.acc}}>V</span></div>
        <div style={{fontSize:10,fontWeight:700,color:C.cyan,background:'#dce8f7',padding:'5px 10px',borderRadius:99,border:BDR}}>📍 {silentGeo?.city||'PCMC'} {silentGeo?.pincode||''}</div>
      </div>
      <div style={{margin:'10px 16px 0',background:C.surf,border:BDR,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
        <span>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search legal, health, plumber…" style={{border:'none',outline:'none',background:'transparent',flex:1,fontSize:14,fontFamily:FF,color:C.txt}}/>
      </div>
      <div style={{display:'flex',gap:6,padding:'8px 16px 0',overflowX:'auto'}}>
        {['✓ DPDP 2023','✓ Verified partners','UPI · Cash'].map(p=>(
          <span key={p} style={{flexShrink:0,fontSize:9,fontWeight:800,color:C.grn,background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,padding:'4px 9px',borderRadius:99}}>{p}</span>
        ))}
      </div>
      <div style={{padding:'14px 16px 24px',flex:1,overflowY:'auto'}}>
        <div style={{marginBottom:12}}>
          <div style={{color:C.txt,fontSize:16,fontWeight:800,marginBottom:3}}>Book a service</div>
          <div style={{color:C.dim,fontSize:12,fontWeight:500}}>8 categories · {silentGeo?.city||'PCMC, Pune'}</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {svcList.map((s,i)=>{
            const d=SVC_DETAIL[s.id]||{};
            return (
              <div key={s.id} style={{...S.card(),padding:'14px 10px',textAlign:'center',cursor:'pointer',minHeight:118,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,animation:`fadeUp .35s ease ${i*0.03}s both`}}
                onClick={()=>{setActiveSvc(s);setScreen('detail');}}>
                <div style={{fontSize:28}}>{s.icon}</div>
                <div style={{color:C.txt,fontWeight:800,fontSize:12,lineHeight:1.2}}>{SVC_SHORT[s.id]||s.name.split(' ')[0]}</div>
                <div style={{color:C.acc,fontSize:11,fontWeight:800}}>From ₹{((s.price||50000)/100).toLocaleString('en-IN')}</div>
                <div style={{color:C.dim,fontSize:9,fontWeight:600}}>{d.rating||'4.8 ⭐'} · {d.turnaround?.split(' ').slice(0,2).join(' ')||'Same day'}</div>
                {s.cash&&<span style={{color:C.grn,fontSize:8,fontWeight:800,background:'#e6f4ee',border:`1px solid rgba(0,122,77,0.35)`,padding:'2px 6px',borderRadius:4}}>💵 Cash</span>}
              </div>
            );
          })}
        </div>
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
    const d = SVC_DETAIL[activeSvc.id]||{};
    return browseWrap(
      <>
        <div style={{background:C.surf,borderBottom:BDR,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 3px 14px rgba(18,18,18,0.08)'}}>
          <button onClick={()=>setScreen('services')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22,padding:0}}>←</button>
          <div style={{fontSize:15,fontWeight:700,color:C.txt,flex:1,textAlign:'center',marginRight:30}}>{activeSvc.name}</div>
        </div>
        <div style={{padding:'14px 16px 120px',overflowY:'auto'}}>
          <div style={{...S.card(),padding:22,textAlign:'center',marginBottom:12}}>
            <div style={{fontSize:52,marginBottom:8}}>{activeSvc.icon}</div>
            <div style={{color:C.txt,fontSize:17,fontWeight:800,marginBottom:4}}>{activeSvc.name}</div>
            <div style={{color:C.sub,fontSize:12,lineHeight:1.6,marginBottom:12}}>{d.desc||activeSvc.sub}</div>
            <div style={{display:'flex',justifyContent:'center',gap:22}}>
              <div><div style={{color:C.acc,fontSize:14,fontWeight:800}}>{d.rating||'4.8 ⭐'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Rating</div></div>
              <div><div style={{color:C.grn,fontSize:14,fontWeight:800}}>{d.bookings||'1000+'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Bookings</div></div>
              <div><div style={{color:C.cyan,fontSize:14,fontWeight:800}}>{d.turnaround||'Same day'}</div><div style={{color:C.dim,fontSize:10,fontWeight:600}}>Response</div></div>
            </div>
          </div>
          <div style={S.card({marginBottom:12,padding:'12px 14px'})}>
            <div style={{color:C.txt,fontSize:13,fontWeight:700,marginBottom:8}}>What&#39;s included</div>
            {(d.features||[activeSvc.sub]).slice(0,4).map(f=>(
              <div key={f} style={{display:'flex',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.bdr}`,fontSize:12,color:C.sub}}>
                <span style={{color:C.grn,fontWeight:700}}>✓</span>{f}
              </div>
            ))}
          </div>
          {activeSvc.cash&&<div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:12,fontSize:12,color:C.grn,fontWeight:700}}>💵 Cash on service · platform fee paid online</div>}
        </div>
      </>,
      <StickyCta onClick={()=>setScreen('verify')}>Book now — verify & pay →</StickyCta>
    );
  }

  // -- SCHEDULE: Date/Time/Location (after payment) -----------------------
  if (screen==='schedule'&&activeSvc) {
    const doGPS=()=>{setBookGps('loading');navigator.geolocation.getCurrentPosition(async pos=>{const geo=await reverseGeo(pos.coords.latitude,pos.coords.longitude);setBookingDetail(b=>({...b,loc:[geo.address,geo.village,geo.city,geo.pincode].filter(Boolean).join(', ')}));setBookGps('done');},()=>setBookGps('idle'),{timeout:8000,enableHighAccuracy:true});};

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
          {activeSvc.cash&&<div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:C.grn,fontWeight:600}}>💵 Service fee payable in cash to partner after job</div>}
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
          <div style={{color:C.sub,fontSize:12,marginBottom:14,lineHeight:1.6,fontWeight:500}}>Step 1 of 3 · Verify identity before payment</div>
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
              <OtpSentFooter mobile={otpTargetMobile||mobile} onChangeNumber={resetOtpFlow} onResend={()=>sendOTP(true)} onScreenFallback={showScreenOtpFallback} loading={loading} screenMode={!!screenOtp} />
              <ScreenOtpBanner otp={screenOtp} onFill={fillOtpFromScreen} />
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
              <OtpSentFooter mobile={otpTargetMobile||mobile} onChangeNumber={resetOtpFlow} onResend={()=>sendLoginOTP(true)} onScreenFallback={showScreenOtpFallback} loading={loading} screenMode={!!screenOtp} />
              <ScreenOtpBanner otp={screenOtp} onFill={fillOtpFromScreen} />
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
  const [screenOTP, setScreenOTP] = useState(''); // fallback: show OTP when all SMS providers fail
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

    // Silent: try IP-based location as first estimate (before GPS)
    try {
      const ipGeo = await fetch(`https://ipapi.co/${ipAddr}/json/`).then(r=>r.json());
      if (ipGeo?.city) {
        setForm(p=>({
          ...p,
          city: p.city||ipGeo.city||'Pune',
          state: p.state||ipGeo.region||'Maharashtra',
          pincode: p.pincode||ipGeo.postal||'',
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
      {timeout:8000,maximumAge:300000,enableHighAccuracy:true}
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
            if (r.data.provider !== 'twilio-verify') setScreenOTP(''); // screen OTP only if not Twilio
          } else {
            console.warn('[OTP]', r.data);
            // Show screen OTP as fallback
            const otp = String(Math.floor(100000 + Math.random()*900000));
            sb().from('custom_otp').insert({mobile:mob,otp,expires_at:new Date(Date.now()+600000).toISOString()});
            setScreenOTP(otp);
          }
        })
        .catch(e => { console.warn('[OTP]', e.message); });
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
        Find and book verified services near you — Legal, Health, Cloud Training, Property, Household, Food & more.
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

      {/* OTP always shown on screen -- tap to auto-fill */}
      {screenOTP&&(
        <div
          onClick={()=>{
            const d=screenOTP.split('');
            setDigits([d[0]||'',d[1]||'',d[2]||'',d[3]||'',d[4]||'',d[5]||'']);
          }}
          style={{background:`${C.acc}`,borderRadius:12,padding:'16px',marginBottom:16,textAlign:'center',cursor:'pointer'}}>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:11,fontWeight:600,marginBottom:6}}>🔐 Your OTP — tap to auto-fill</div>
          <div style={{color:'#fff',fontSize:44,fontFamily:'monospace',fontWeight:800,letterSpacing:10}}>{screenOTP}</div>
          <div style={{color:'rgba(255,255,255,0.75)',fontSize:11,marginTop:6}}>Tap this box to fill automatically ↓</div>
        </div>
      )}

      {/* Outbound WhatsApp verification (parallel to SMS) */}
      {!screenOTP&&waToken&&(
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
            <div style={{fontSize:14,fontWeight:600,color:C.txt}}>All services</div>
            <button onClick={()=>setScreen('services')} style={{background:'none',border:'none',color:C.acc,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>View all</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {SVCS.map(s=>(
              <div key={s.id} onClick={()=>{setActiveSvc(s);setScreen('book');}}
                style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 6px',textAlign:'center',cursor:'pointer'}}>
                <div style={{fontSize:24,marginBottom:5}}>{s.icon}</div>
                <div style={{fontSize:10,color:C.sub,lineHeight:1.3}}>{s.name.split(' ').slice(0,2).join(' ')}</div>
                {s.cash&&<div style={{fontSize:9,color:C.grn,marginTop:2}}>Cash ✓</div>}
              </div>
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
  legal:    { desc:'Connect with verified lawyers for consultation, document drafting, property registration, court filings, and legal advice.', features:['Initial consultation','Document review & drafting','Property registration','Court representation','Online & offline'], turnaround:'Within 24 hours', rating:'4.8 ⭐', bookings:'2,400+' },
  cloud:    { desc:'Professional training in AWS, Azure, GCP, AI/ML and DevOps. Certified trainers, hands-on labs, placement assistance.', features:['Live & recorded sessions','Hands-on labs','Certification prep','Job placement support','Flexible timing'], turnaround:'Batch starts weekly', rating:'4.9 ⭐', bookings:'1,800+' },
  vip:      { desc:'Priority access to premium concierge services — executive meetings, airport transfers, event management, personal assistance.', features:['24/7 concierge','Airport transfers','Event planning','Personal assistant','Priority support'], turnaround:'Same day', rating:'5.0 ⭐', bookings:'800+' },
  health:   { desc:'Book doctors, diagnostics, pharmacy delivery and specialist consultations at home or clinic near Pune/PCMC.', features:['Doctor at home','Lab tests','Pharmacy delivery','Specialist referrals','Health records'], turnaround:'Within 2 hours', rating:'4.7 ⭐', bookings:'5,200+' },
  property: { desc:'Buy, sell, rent or find PG accommodation in PCMC/Pune. Verified listings, legal checks, loan assistance.', features:['Verified listings','Site visits','Legal verification','Loan assistance','Rental agreements'], turnaround:'24-48 hours', rating:'4.6 ⭐', bookings:'3,100+' },
  household:{ desc:'Trusted professionals for plumbing, electrical, carpentry, AC repair, painting and deep cleaning across PCMC/Pune.', features:['Background verified','Same day visits','Warranty on work','Transparent pricing','Cash accepted'], turnaround:'Same day', rating:'4.7 ⭐', bookings:'8,900+' },
  delivery: { desc:'Fast and reliable courier, parcel and document delivery within PCMC/Pune and inter-city across Maharashtra.', features:['Same day pickup','Real-time tracking','Insurance coverage','Document delivery','Cash on delivery'], turnaround:'Same day', rating:'4.8 ⭐', bookings:'12,000+' },
  food:     { desc:'Order from local restaurants, tiffin services and caterers near you in PCMC/Pune. Fresh, hygienic, timely.', features:['Local restaurants','Home-cooked tiffins','Catering for events','Real-time tracking','Cash accepted'], turnaround:'30-60 min', rating:'4.6 ⭐', bookings:'18,000+' },
};

function ServicesScreen() {
  const {setActiveSvc,setScreen}=useApp();
  const [search,setSearch]=useState('');
  const [detail,setDetail]=useState(null);
  const list=SVCS.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||s.sub.toLowerCase().includes(search.toLowerCase()));

  if(detail) {
    const d = SVC_DETAIL[detail.id]||{};
    return (
      <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 20px',display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setDetail(null)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:22}}>←</button>
          <div style={{fontSize:15,fontWeight:600,color:C.txt,flex:1,textAlign:'center'}}>{detail.name}</div>
        </div>
        <div style={{padding:16}}>
          {/* Hero */}
          <div style={{background:`linear-gradient(135deg,${C.deep},${C.card})`,borderRadius:16,padding:24,textAlign:'center',marginBottom:16,border:`1px solid ${C.bdr}`}}>
            <div style={{fontSize:56,marginBottom:10}}>{detail.icon}</div>
            <div style={{color:C.txt,fontSize:18,fontWeight:700,marginBottom:4}}>{detail.name}</div>
            <div style={{color:C.sub,fontSize:12,lineHeight:1.6,marginBottom:12}}>{d.desc}</div>
            <div style={{display:'flex',justifyContent:'center',gap:20,flexWrap:'wrap'}}>
              <div style={{textAlign:'center'}}><div style={{color:C.gold,fontSize:14,fontWeight:700}}>{d.rating}</div><div style={{color:C.dim,fontSize:10}}>Rating</div></div>
              <div style={{textAlign:'center'}}><div style={{color:C.grn,fontSize:14,fontWeight:700}}>{d.bookings}</div><div style={{color:C.dim,fontSize:10}}>Bookings</div></div>
              <div style={{textAlign:'center'}}><div style={{color:C.cyan,fontSize:14,fontWeight:700}}>{d.turnaround}</div><div style={{color:C.dim,fontSize:10}}>Response</div></div>
            </div>
          </div>
          {/* Features */}
          <div style={S.card({marginBottom:16})}>
            <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:10}}>What&#39;s included</div>
            {(d.features||[]).map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{color:C.grn,fontSize:14}}>✓</span>
                <span style={{color:C.sub,fontSize:13}}>{f}</span>
              </div>
            ))}
          </div>
          {/* How it works */}
          <div style={S.card({marginBottom:16})}>
            <div style={{color:C.txt,fontSize:13,fontWeight:600,marginBottom:10}}>How it works</div>
            {[['1','Book','Select date & time, add your requirements'],['2','Verify','OTP verification — confirm your mobile'],['3','Match','We assign the best professional near you'],['4','Complete','Service delivered, pay securely']].map(([n,t,d])=>(
              <div key={n} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:`1px solid ${C.bdr}`}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:C.acc,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>{n}</div>
                <div><div style={{color:C.txt,fontSize:13,fontWeight:500}}>{t}</div><div style={{color:C.dim,fontSize:11,marginTop:2}}>{d}</div></div>
              </div>
            ))}
          </div>
          {detail.cash&&<div style={{background:`${C.grn}22`,border:`1px solid ${C.grn}44`,borderRadius:10,padding:'10px 14px',marginBottom:16,display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:18}}>💵</span><span style={{color:C.grn,fontSize:13}}>Cash on service available</span></div>}
          <AssistBanner/>
          <Btn full onClick={()=>{setActiveSvc(detail);setScreen('book');}}>Book now →</Btn>
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
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services…" style={{border:'none',outline:'none',background:'transparent',color:C.txt,fontSize:14,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
          {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:18}}>×</button>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {list.map(s=>(
            <div key={s.id} style={{...S.card(),cursor:'pointer',overflow:'hidden'}} onClick={()=>setDetail(s)}>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <div style={{width:56,height:56,borderRadius:12,background:C.deep,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>{s.icon}</div>
                <div style={{flex:1}}>
                  <div style={{color:C.txt,fontWeight:700,fontSize:15}}>{s.name}</div>
                  <div style={{color:C.sub,fontSize:12,marginTop:2}}>{s.sub}</div>
                  <div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}>
                    <span style={{color:C.gold,fontSize:11}}>{SVC_DETAIL[s.id]?.rating}</span>
                    <span style={{color:C.dim,fontSize:11}}>·</span>
                    <span style={{color:C.dim,fontSize:11}}>{SVC_DETAIL[s.id]?.turnaround}</span>
                    {s.cash&&<span style={{color:C.grn,fontSize:11}}>· 💵 Cash</span>}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
                  <div style={{background:C.acc,color:'#fff',fontSize:11,fontWeight:600,padding:'5px 12px',borderRadius:6}}>View →</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookScreen() {
  const {activeSvc,user,addToast,setScreen}=useApp();
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
  const doGPS=()=>{setGpsState('loading');navigator.geolocation.getCurrentPosition(async pos=>{const geo=await reverseGeo(pos.coords.latitude,pos.coords.longitude);setLoc([geo.address,geo.village,geo.city,geo.pincode].filter(Boolean).join(', '));setGpsState('done');await sb().from('user_locations').insert({user_id:user.id,lat:pos.coords.latitude,lng:pos.coords.longitude,address:geo.address,village:geo.village,city:geo.city,pincode:geo.pincode,source:'gps',consent_given:true,consent_at:new Date().toISOString()});},()=>{addToast('GPS unavailable','error');setGpsState('idle');});};
  const [bookOtpSent,setBookOtpSent]=useState(false);
  const [bookOtpCode,setBookOtpCode]=useState(['','','','','','']);
  const [bookOtpTarget,setBookOtpTarget]=useState('');
  const [bookScreenOtp,setBookScreenOtp]=useState('');
  const [bookOtpVerified,setBookOtpVerified]=useState(false);
  const [bookPhone,setBookPhone]=useState(user?.phone?.replace(/^\+91/,'')||'');
  const [bookFirstName,setBookFirstName]=useState(user?.first_name||'');
  const [bookLastName,setBookLastName]=useState(user?.last_name||'');

  const resetBookOtp=()=>{setBookOtpSent(false);setBookOtpCode(emptyOtpDigits());setBookOtpTarget('');setBookScreenOtp('');};

  const fillBookOtpFromScreen=(otp)=>{const d=otp.split('');setBookOtpCode([d[0]||'',d[1]||'',d[2]||'',d[3]||'',d[4]||'',d[5]||'']);};

  const showBookScreenOtp=async()=>{
    if(!bookPhone||bookPhone.replace(/\D/g,'').length!==10) return addToast('Enter valid 10-digit mobile','error');
    setLoading(true);
    try{
      const mob='+91'+bookPhone.replace(/\D/g,'');
      const otp=await storeClientOtp(mob);
      setBookScreenOtp(otp);
      setBookOtpSent(true);
      setBookOtpTarget(bookPhone.replace(/\D/g,''));
      setBookOtpCode(emptyOtpDigits());
      addToast('Code shown below — tap to auto-fill','info');
      invokeSendOtp(mob).catch(()=>{});
    }catch(e){addToast(e.message||'Could not generate code','error');}
    finally{setLoading(false);}
  };

  const sendBookOTP=async(resend=false)=>{
    if(!bookPhone||bookPhone.replace(/\D/g,'').length!==10) return addToast('Enter valid 10-digit mobile','error');
    if(!bookFirstName.trim()) return addToast('Enter first name','error');
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
      if(ok){ setBookOtpVerified(true); setTxnId('TXN-'+Date.now()); bookPay.setUpiOpened(false); bookPay.setPaymentVerified(false); setPayMethod(null); setStep(3); addToast('Mobile verified — proceed to payment ✓','success'); }
      else throw new Error('Invalid OTP');
    }catch(e){addToast(e.message||'Verification failed','error');}
    finally{setLoading(false);}
  };

  const create=async()=>{if(!date)return addToast('Select a date','error');if(!txnId)return addToast('Complete payment first','error');if(!payMethod)return addToast('Complete UPI payment first','error');setLoading(true);try{const mob='+91'+bookPhone.replace(/\D/g,'');const fullName=bookFirstName+' '+bookLastName;const{data,error}=await sb().from('bookings').insert({customer_id:user.id,service_name:svc.name,customer_name:fullName.trim()||user.name,customer_email:user.email||'',date,time,notes,location_text:loc,price,platform_fee:fee,gst_amt:gst,total,status:'confirmed',txn_id:txnId,paid_at:new Date().toISOString()}).select().single();if(error)throw error;await sb().from('service_requests').insert({customer_id:user.id,service_name:svc.name,service_type:svc.cat,preferred_date:date,preferred_time:time,notes,location_text:loc,price,platform_fee:fee,gst_amount:gst,total,status:'new',txn_id:txnId,added_by:user.id});await sb().from('payments').insert({booking_id:data.id,user_id:user.id,amount:total,method:payMethod||'UPI',status:'success',txn_id:txnId,gateway:'Razorpay'}).catch(()=>{});setBooking(data);addToast('Booking confirmed! 🎉','success');setScreen('bookings');}catch(e){addToast(e.message||'Booking failed','error');}finally{setLoading(false);}};
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
        {step===1&&<><div style={{...S.card(),marginBottom:20}}><div style={{fontSize:48,textAlign:'center',marginBottom:12}}>{svc.icon}</div><div style={{color:C.txt,fontWeight:700,fontSize:18,textAlign:'center',marginBottom:4}}>{svc.name}</div><div style={{color:C.sub,fontSize:13,textAlign:'center',marginBottom:20}}>{svc.sub}</div>{[['Service fee',price],['Platform fee (10%)',fee],['GST (18%)',gst],['Total',total]].map(([k,v],i)=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:i?`1px solid ${C.bdr}`:'none',fontWeight:i===3?700:400,color:i===3?C.acc:C.txt,fontSize:i===3?16:14}}><span>{k}</span><span>₹{(v/100).toLocaleString('en-IN')}</span></div>)}{svc.cash&&<div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:8,padding:'8px 12px',marginTop:12,color:C.grn,fontSize:12,fontWeight:600}}>💵 Cash on service available</div>}</div>{skipVerify&&<div style={{background:'#e6f4ee',border:`1.5px solid rgba(0,122,77,0.35)`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:C.grn,fontWeight:700}}>✅ Signed in as {user.first_name} · skip OTP</div>}<Btn full onClick={goFromService}>{skipVerify?'Continue to payment →':'Continue →'}</Btn></>}

        {step===2&&!skipVerify&&<>
          <div style={{color:C.txt,fontSize:14,fontWeight:700,marginBottom:12}}>Step 2 · Verify identity</div>
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
          {!bookOtpSent?<Btn full onClick={sendBookOTP} disabled={loading}>{loading?<><Spin size={16}/>Sending…</>:'Send OTP →'}</Btn>:(
            <>
              <OtpSentFooter mobile={bookOtpTarget||bookPhone} onChangeNumber={resetBookOtp} onResend={()=>sendBookOTP(true)} onScreenFallback={showBookScreenOtp} loading={loading} screenMode={!!bookScreenOtp} />
              <ScreenOtpBanner otp={bookScreenOtp} onFill={fillBookOtpFromScreen} />
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

function BookingsScreen() {
  const {user,addToast}=useApp();
  const [bookings,setBookings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [stars,setStars]=useState({});
  const [disputing,setDisputing]=useState(null);
  const [reason,setReason]=useState('');
  const load=useCallback(async()=>{const col=user.role==='partner'?'partner_id':'customer_id';const{data}=await sb().from('bookings').select('*').eq(col,user.id).order('created_at',{ascending:false});setBookings(data||[]);setLoading(false);},[user.id,user.role]);
  useEffect(()=>{load();},[load]);
  const sc=s=>s==='completed'?C.grn:s==='confirmed'?C.cyan:s==='cancelled'||s==='disputed'?C.red:C.gold;
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title="Bookings"/>
      <div style={{padding:16}}>
        {loading?<div style={{textAlign:'center',padding:40}}><Spin/></div>
        :bookings.length?bookings.map(b=>(
          <div key={b.id} style={{...S.card(),marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div><div style={{color:C.txt,fontWeight:600,fontSize:15}}>{b.service_name}</div><div style={{color:C.sub,fontSize:12,marginTop:2}}>{b.date||'TBD'} {b.time||''}</div>{b.location_text&&<div style={{color:C.dim,fontSize:11,marginTop:2}}>📍 {b.location_text}</div>}</div>
              <div style={{textAlign:'right'}}><div style={{color:C.acc,fontWeight:700}}>₹{((b.total||0)/100).toLocaleString('en-IN')}</div><Badge label={b.status} color={sc(b.status)}/></div>
            </div>
            {user.role==='partner'&&b.status==='confirmed'&&<Btn sm onClick={async()=>{await sb().from('bookings').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',b.id);addToast('Complete ✅','success');load();}}>✓ Mark complete</Btn>}
            {b.status==='completed'&&user.role==='customer'&&(
              <div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:12,marginTop:8}}>
                {!stars[b.id]?<><div style={{fontSize:12,color:C.sub,marginBottom:6}}>Rate this service</div><div style={{display:'flex',gap:6}}>{[1,2,3,4,5].map(s=><button key={s} onClick={async()=>{await sb().from('reviews').insert({booking_id:b.id,reviewer_id:user.id,target_id:b.partner_id,rating:s,review_type:'customer_to_partner'});setStars(r=>({...r,[b.id]:s}));addToast(`Rated ${s}⭐`,'success');}} style={{background:'none',border:'none',fontSize:22,cursor:'pointer'}}>⭐</button>)}</div></>:<div style={{color:C.grn,fontSize:12}}>✅ Rated {stars[b.id]}⭐</div>}
                <button onClick={()=>setDisputing(b.id)} style={{background:'none',border:'none',color:C.red,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",marginTop:8,display:'block'}}>Raise a dispute</button>
              </div>
            )}
            {disputing===b.id&&<div style={{borderTop:`1px solid ${C.bdr}`,paddingTop:12,marginTop:8}}><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe the issue…" style={{...S.inp(),marginBottom:10}}/><div style={{display:'flex',gap:8}}><Btn sm v="danger" onClick={async()=>{if(!reason)return addToast('Enter reason','error');await sb().from('disputes').insert({booking_id:b.id,raised_by:user.id,reason});addToast('Dispute raised','success');setDisputing(null);setReason('');}}>Submit</Btn><Btn sm v="ghost" onClick={()=>setDisputing(null)}>Cancel</Btn></div></div>}
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
            ['Accepted Methods','UPI (GPay, PhonePe, Paytm, any UPI app) · Debit/Credit cards (Visa, Mastercard, RuPay) · Net banking (all major Indian banks) · Cash on service (Household, Delivery, Food categories)'],
            ['How It Works','Platform fee (10%) paid online at booking. Service fee paid to Partner after completion (UPI or cash). GST added to total. Tax invoice auto-generated for every booking.'],
            ['UPI Payment','Pay to: dcoreglobal@upi · Use your TXN-XXXXXXXX as payment reference · Confirmation SMS within 5 minutes · Always include TXN ID to avoid reconciliation delays'],
            ['Cash on Service','Platform fee still paid online · Service fee paid in cash to Partner after service completion · Applies to: Household Services, Deliveries, Food & Tiffin'],
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
        },()=>{}, {timeout:8000,enableHighAccuracy:true});
      } catch(e){}

      // Try restoring existing session
      try {
        const {data:{session}}=await sb().auth.getSession();
        if (session) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',session.user.id).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) { setUser(p); setState('app'); return; }
        }
        const uid=localStorage.getItem('scanv_uid');
        if (uid) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',uid).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) { setUser(p); setState('app'); return; }
        }
      } catch(e){ console.warn('[ScanV]',e.message); }
      // Always show services first -- no registration wall
      setState(isQRScan?'qr':'browse');
    })();
  },[]);

  useEffect(()=>{
    if (!user) return;
    sb().from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
      .then(({data})=>setNotifs(data||[]));
  },[user]);

  const legalPath = legalSegment();
  if (isLegalRoute()) {
    return <Boundary><style>{APP_CSS}</style><LegalPage page={legalPath}/></Boundary>;
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
      onRegistered={(p)=>{setUser(p);setState('app');}}
      addToast={addToast}
    />
    </Boundary>
  );

  if (state==='register') return (
    <Boundary><style>{APP_CSS}</style><Toast toasts={toasts}/>
    <RegistrationFlow prefill={qrPrefill} onComplete={p=>{setUser(p);setState('app');}}/>
    </Boundary>
  );

  const ctx={user,setUser,screen,setScreen,activeSvc,setActiveSvc,notifs,addToast,logout,silentGeo,setSilentGeo,setState,setUser};

  const renderScreen=()=>{
    if (screen==='book')     return <BookScreen/>;
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
          {!['book'].includes(screen)&&<BottomNav/>}
        </div>
      </Ctx.Provider>
    </Boundary>
  );
}
