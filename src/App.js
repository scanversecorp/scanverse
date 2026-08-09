/**
 * ScanV v5 — Production
 * DCORE Global Corporation · PCMC, Pune
 * URL: https://scanv-tau.vercel.app
 * Bold Dark Premium: #0d0f1a · #e94560
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

/* ─── CONFIG ─────────────────────────────────────────────────────── */
const SB_URL   = 'https://rwlwrmmqtedugcreweut.supabase.co';
const SB_KEY   = 'sb_publishable_sx3krTi2ijpvn-K8wAQP6w_VFwH0vR3';
const APP_URL  = 'https://scanv-tau.vercel.app';
const RZP_URL  = 'https://rzp.io/rzp/QEuXj4E';
const UPI_PA   = 'dcoreglobalcorp@razorpay';
const UPI_PN   = 'DCORE Global Corporation';
const ASSIST   = '+91-9270194842';
const FEE_PCT  = 0.10;
const GST_RATE = 0.18;

/* ─── DESIGN TOKENS ──────────────────────────────────────────────── */
const C = {
  bg:'#0d0f1a', surf:'#1a1a2e', card:'#16213e', deep:'#0f3460',
  acc:'#e94560', cyan:'#00d4ff', gold:'#f5a623',
  grn:'#00c48c', red:'#ff4d6d', vio:'#7c3aed',
  txt:'#f0f0f0', sub:'#a8a8c0', dim:'#5a5a7a',
  bdr:'rgba(255,255,255,0.08)', gls:'rgba(255,255,255,0.04)',
};

/* ─── SERVICES ───────────────────────────────────────────────────── */
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

/* ─── SUPABASE ───────────────────────────────────────────────────── */
let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!window.supabase) throw new Error('Supabase not loaded');
  _sb = window.supabase.createClient(SB_URL, SB_KEY);
  return _sb;
}

/* ─── CONTEXT ────────────────────────────────────────────────────── */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ─── ERROR BOUNDARY ─────────────────────────────────────────────── */
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

/* ─── STYLES ─────────────────────────────────────────────────────── */
const S = {
  center: {height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,gap:16,fontFamily:"'DM Sans',sans-serif",padding:20},
  inp: (x={}) => ({width:'100%',background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'11px 14px',color:C.txt,fontSize:14,outline:'none',fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box',...x}),
  lbl: {fontSize:11,fontWeight:600,color:C.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5,display:'block'},
  card: (x={}) => ({background:C.card,border:`1px solid ${C.bdr}`,borderRadius:14,padding:16,...x}),
  err: {background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,padding:'10px 14px',color:C.red,fontSize:13,marginBottom:14},
};

/* ─── PRIMITIVES ─────────────────────────────────────────────────── */
function Spin({size=20}) {
  return <div style={{width:size,height:size,border:`2px solid ${C.bdr}`,borderTop:`2px solid ${C.acc}`,borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>;
}

function Btn({children,onClick,v='primary',full,disabled,sm}) {
  const b={borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:disabled?'not-allowed':'pointer',width:full?'100%':'auto',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,opacity:disabled?.6:1,border:'none',padding:sm?'7px 14px':'11px 22px',fontSize:sm?12:14,transition:'opacity .15s'};
  const vs={primary:{...b,background:disabled?'#2a2a3e':C.acc,color:disabled?C.dim:'#fff'},outline:{...b,background:'transparent',color:C.acc,border:`1px solid ${C.acc}`},ghost:{...b,background:C.gls,color:C.txt,border:`1px solid ${C.bdr}`},secondary:{...b,background:C.deep,color:C.txt,border:`1px solid ${C.bdr}`},danger:{...b,background:disabled?'#2a2a3e':C.red,color:disabled?C.dim:'#fff'}};
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
    <a href={`tel:${ASSIST}`} style={{display:'flex',alignItems:'center',gap:12,background:C.acc,borderRadius:12,padding:'12px 16px',textDecoration:'none',marginBottom:16}}>
      <span style={{fontSize:22}}>📞</span>
      <div><div style={{color:'#fff',fontSize:13,fontWeight:600}}>Quick assistance</div><div style={{color:'rgba(255,255,255,0.8)',fontSize:11}}>{ASSIST} · 24/7</div></div>
      <div style={{marginLeft:'auto',color:'rgba(255,255,255,0.7)',fontSize:18}}>→</div>
    </a>
  );
}

/* ─── DEVICE / IP / GEO UTILS ────────────────────────────────────── */
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
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
    const d=await r.json(); const a=d.address||{};
    return { address:d.display_name?.split(',').slice(0,4).join(',').trim()||'', village:a.village||a.suburb||a.neighbourhood||a.town||a.residential||'', city:a.city||a.town||a.county||'Pune', state:a.state||'Maharashtra', pincode:a.postcode||'', country:a.country||'India' };
  } catch(e) { return {address:'',village:'',city:'Pune',state:'Maharashtra',pincode:'',country:'India'}; }
}

/* ─── CANVAS FINGERPRINT ─────────────────────────────────────────── */
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

/* ─── BATTERY API ────────────────────────────────────────────────── */
async function getBattery() {
  try {
    if (!navigator.getBattery) return {level:null,charging:null};
    const b=await navigator.getBattery();
    return {level:Math.round(b.level*100)/100, charging:b.charging};
  } catch(e) { return {level:null,charging:null}; }
}

/* ─── OTP: FAST2SMS (India) ─────────────────────────────────────── */
// 2Factor.in — India OTP SMS (works instantly, no verification needed)
// Get free API key: https://2factor.in/cp/ → API → Copy key
const TWOFACTOR_KEY = '2e5ec291-9406-11f1-908b-0200cd936042';
// Fast2SMS (blocked until website verified + ₹100 recharge — keep for later)
const FAST2SMS_KEY  = 'qT5XNR8YLirx6unhwDIcyAVm9WajkMldotCHGzgKvpe2Q03sP7JetNE75xFYRpgsdcH6qL3fyvr8Pm1z';

async function sendSMSViaSB(mobile, otp) {
  // Store OTP in DB first
  await sb().from('custom_otp').insert({
    mobile, otp,
    expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
  }).then(()=>{}).catch(e=>console.warn('[OTP DB]',e.message));
}

// SMS sent via Supabase Edge Function send-otp (server-side, no CORS)

/* ─── WHATSAPP VERIFICATION ──────────────────────────────────── */
async function generateWAToken(mobile) {
  const r = await sb().functions.invoke('whatsapp-verify', {
    body: { action:'generate', mobile }
  });
  return r.data;
}

async function checkWAVerified(token) {
  const r = await sb().functions.invoke('whatsapp-verify', {
    body: { action:'check', token }
  });
  return r.data;
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

/* ════════════════════════════════════════════════════════════════
   QR CODE GENERATOR COMPONENT
════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════
   QR LANDING PAGE — shown when ?qr=1 in URL
   Captures maximum data on scan
════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════
   REGISTRATION FLOW
════════════════════════════════════════════════════════════════ */
function RegistrationFlow({ onComplete, prefill }) {
  const [phase, setPhase]   = useState('consent');
  const [dev, setDev]       = useState(prefill?.dev||null);
  const [ip, setIp]         = useState(prefill?.ip||'');
  const [geo, setGeo]       = useState(prefill?.geo||null);
  const [sessionId, setSessionId] = useState(prefill?.scanId||null);
  const [screenOTP, setScreenOTP] = useState(''); // fallback: show OTP when all SMS providers fail
  const [waToken, setWaToken]       = useState('');
  const [waLink, setWaLink]         = useState('');
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
      const mob = form.mobile.startsWith('+')?form.mobile:`+91${form.mobile.replace(/\D/g,'')}`;
      // 1. Send OTP via Twilio Verify (server-side, no DLT needed)
      //    Twilio generates and sends the OTP — we don't need to store it
      setLoading(false);
      setPhase('otp'); setCd(120); setDigits(['','','','','','']);
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
      (async () => {
        try {
          const r = await sb().functions.invoke('send-otp', { body: { mobile: mob, otp } });
          if (r.data?.success) console.log('[OTP] SMS also sent via', r.data.provider, '✓');
        } catch(e) { console.warn('[OTP] SMS background error:', e.message); }
      })();
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
      const mob = form.mobile.startsWith('+')?form.mobile:`+91${form.mobile.replace(/\D/g,'')}`;
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
          // User exists — sign them in
          const { data:si } = await sb().auth.signInWithPassword({ email:fakeEmail, password:fakePass });
          userId = si?.user?.id;
        } else {
          userId = su?.user?.id;
        }
      } catch(authErr) { console.warn('Auth:', authErr); }

      if (!userId) {
        // Fallback — use anonymous UUID stored in localStorage
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

  /* ── UI ── */
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
      {/* DPDP consent — compact as requested */}
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
        <input type="tel" value={form.mobile} onChange={e=>f('mobile',e.target.value)} placeholder="+91 98765 43210" style={S.inp()}/>
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

      {/* OTP always shown on screen — tap to auto-fill */}
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

      {/* WhatsApp verification option */}
      {!screenOTP&&waLink&&(
        <div style={{background:`${C.grn}22`,border:`1.5px solid ${C.grn}`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{color:C.grn,fontSize:12,fontWeight:600,marginBottom:8}}>📱 Verify via WhatsApp</div>
          <div style={{color:C.sub,fontSize:11,lineHeight:1.6,marginBottom:10}}>
            Tap below → WhatsApp opens with a pre-filled message → Send it → you're verified.<br/>
            <span style={{color:C.dim,fontSize:10}}>This proves you own this number.</span>
          </div>
          <a href={waLink} target="_blank" rel="noreferrer"
            onClick={()=>{
              // Start polling for verification
              setWaChecking(true);
              const poll = setInterval(async()=>{
                const res = await checkWAVerified(waToken);
                if(res?.verified){
                  clearInterval(poll);
                  setWaChecking(false);
                  // Mark as verified via WhatsApp — proceed to finalise
                  const mob = form.mobile.startsWith('+')?form.mobile:`+91${form.mobile.replace(/\D/g,'')}`;
                  setPhase('completing');
                  // Store OTP as used
                  await sb().from('custom_otp').insert({
                    mobile:mob, otp:'WA-VERIFIED',
                    expires_at:new Date(Date.now()+60000).toISOString(), used:true
                  }).then(()=>{});
                  await verifyOTP_direct(mob);
                }
              }, 3000);
              // Stop polling after 10 min
              setTimeout(()=>{clearInterval(poll);setWaChecking(false);}, 600000);
            }}
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,background:'#25D366',borderRadius:10,padding:'11px 16px',textDecoration:'none'}}>
            <span style={{fontSize:20}}>💬</span>
            <span style={{color:'#fff',fontWeight:700,fontSize:14}}>Open WhatsApp to verify</span>
          </a>
          {waChecking&&<div style={{textAlign:'center',marginTop:8,fontSize:11,color:C.sub}}>
            <span>Waiting for WhatsApp message… </span><span style={{color:C.grn}}>●</span>
          </div>}
          <div style={{textAlign:'center',marginTop:8,fontSize:10,color:C.dim}}>
            Send to: <strong style={{color:C.sub}}>+91-9270194842</strong> · Token: <code style={{color:C.acc}}>{waToken}</code>
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

/* ════════════════════════════════════════════════════════════════
   QR CODE SCREEN (accessible from admin)
════════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════════
   MAIN APP SCREENS (unchanged structure, updated URL ref)
════════════════════════════════════════════════════════════════ */
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

function ServicesScreen() {
  const {setActiveSvc,setScreen}=useApp();
  const [search,setSearch]=useState('');
  const list=SVCS.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||s.sub.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title="Services"/>
      <div style={{padding:16}}>
        <div style={{display:'flex',alignItems:'center',gap:10,background:C.deep,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'11px 14px',marginBottom:16}}>
          <span>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services…" style={{border:'none',outline:'none',background:'transparent',color:C.txt,fontSize:14,flex:1,fontFamily:"'DM Sans',sans-serif"}}/>
          {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',fontSize:18}}>×</button>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {list.map(s=>(
            <div key={s.id} onClick={()=>{setActiveSvc(s);setScreen('book');}} style={{...S.card(),display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:8,cursor:'pointer'}}>
              <div style={{fontSize:32}}>{s.icon}</div>
              <div style={{color:C.txt,fontWeight:600,fontSize:14}}>{s.name}</div>
              <div style={{color:C.sub,fontSize:11,lineHeight:1.4}}>{s.sub}</div>
              {s.cash&&<div style={{color:C.grn,fontSize:11}}>💵 Cash on service</div>}
              <div style={{background:C.acc,color:'#fff',fontSize:12,fontWeight:600,padding:'6px 0',borderRadius:8,width:'100%'}}>Book now</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookScreen() {
  const {activeSvc,user,addToast,setScreen}=useApp();
  const [step,setStep]=useState(1);
  const [date,setDate]=useState('');
  const [time,setTime]=useState('10:00');
  const [notes,setNotes]=useState('');
  const [loc,setLoc]=useState([user?.village,user?.city,user?.pincode].filter(Boolean).join(', ')||'');
  const [gpsState,setGpsState]=useState('idle');
  const [booking,setBooking]=useState(null);
  const [loading,setLoading]=useState(false);
  const svc=activeSvc;
  if (!svc) { setScreen('services'); return null; }
  const price=svc.price||50000,fee=Math.round(price*FEE_PCT),gst=Math.round((price+fee)*GST_RATE),total=price+fee+gst;
  const doGPS=()=>{setGpsState('loading');navigator.geolocation.getCurrentPosition(async pos=>{const geo=await reverseGeo(pos.coords.latitude,pos.coords.longitude);setLoc([geo.address,geo.village,geo.city,geo.pincode].filter(Boolean).join(', '));setGpsState('done');await sb().from('user_locations').insert({user_id:user.id,lat:pos.coords.latitude,lng:pos.coords.longitude,address:geo.address,village:geo.village,city:geo.city,pincode:geo.pincode,source:'gps',consent_given:true,consent_at:new Date().toISOString()});},()=>{addToast('GPS unavailable','error');setGpsState('idle');});};
  const create=async()=>{if(!date)return addToast('Select a date','error');setLoading(true);try{const txn='TXN-'+Date.now();const{data,error}=await sb().from('bookings').insert({customer_id:user.id,service_name:svc.name,customer_name:user.name,customer_email:user.email||'',date,time,notes,location_text:loc,price,platform_fee:fee,gst_amt:gst,total,status:'awaiting_payment',txn_id:txn}).select().single();if(error)throw error;await sb().from('service_requests').insert({customer_id:user.id,service_name:svc.name,service_type:svc.cat,preferred_date:date,preferred_time:time,notes,location_text:loc,price,platform_fee:fee,gst_amount:gst,total,status:'new',txn_id:txn,added_by:user.id});setBooking(data);setStep(3);}catch(e){addToast(e.message||'Booking failed','error');}finally{setLoading(false);}};
  const confirmPaid=async method=>{if(!booking)return;setLoading(true);try{await sb().from('bookings').update({status:'confirmed',paid_at:new Date().toISOString()}).eq('id',booking.id);await sb().from('payments').insert({booking_id:booking.id,user_id:user.id,amount:total,method,status:'success',txn_id:booking.txn_id,gateway:'Razorpay'});addToast('Booking confirmed! 🎉','success');setScreen('bookings');}catch(e){addToast('Could not confirm payment','error');}finally{setLoading(false);}};
  const upiLink=`upi://pay?pa=${UPI_PA}&pn=${encodeURIComponent(UPI_PN)}&am=${(total/100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(svc.name)}`;
  return (
    <div style={{flex:1,overflowY:'auto',fontFamily:"'DM Sans',sans-serif"}}>
      <TopBar title={svc.name} back="services"/>
      <div style={{display:'flex',padding:'12px 16px',gap:4}}>{[1,2,3].map(n=><div key={n} style={{flex:1,height:3,borderRadius:2,background:step>=n?C.acc:C.deep}}/>)}</div>
      <div style={{padding:'8px 16px 40px'}}>
        {step===1&&<><div style={{...S.card(),marginBottom:20}}><div style={{fontSize:48,textAlign:'center',marginBottom:12}}>{svc.icon}</div><div style={{color:C.txt,fontWeight:700,fontSize:18,textAlign:'center',marginBottom:4}}>{svc.name}</div><div style={{color:C.sub,fontSize:13,textAlign:'center',marginBottom:20}}>{svc.sub}</div>{[['Service fee',price],['Platform fee (10%)',fee],['GST (18%)',gst],['Total',total]].map(([k,v],i)=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:i?`1px solid ${C.bdr}`:'none',fontWeight:i===3?700:400,color:i===3?C.acc:C.txt,fontSize:i===3?16:14}}><span>{k}</span><span>₹{(v/100).toLocaleString('en-IN')}</span></div>)}{svc.cash&&<div style={{background:`${C.grn}22`,border:`1px solid ${C.grn}44`,borderRadius:8,padding:'8px 12px',marginTop:12,color:C.grn,fontSize:12}}>💵 Cash on service available</div>}</div><Btn full onClick={()=>setStep(2)}>Continue →</Btn></>}
        {step===2&&<><Field label="Date" req><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={S.inp()}/></Field><Field label="Time"><input type="time" value={time} onChange={e=>setTime(e.target.value)} style={S.inp()}/></Field><Field label="Service location"><div style={{display:'flex',gap:8,marginBottom:6}}><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Address or area" style={{...S.inp(),flex:1}}/><button onClick={doGPS} disabled={gpsState==='loading'} style={{background:C.deep,border:`1px solid ${C.acc}`,borderRadius:10,padding:'11px 14px',color:C.acc,cursor:'pointer',fontSize:18,flexShrink:0}}>{gpsState==='loading'?<Spin size={16}/>:'📍'}</button></div>{gpsState==='done'&&<div style={{fontSize:11,color:C.grn}}>✅ GPS captured</div>}</Field><Field label="Notes"><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special requirements…" style={S.inp()}/></Field><Btn full onClick={create} disabled={loading}>{loading?<><Spin size={16}/>Creating…</>:'Confirm booking →'}</Btn></>}
        {step===3&&<><div style={{...S.card(),textAlign:'center',marginBottom:20,padding:24}}><div style={{fontSize:13,color:C.sub,marginBottom:6}}>Amount to pay</div><div style={{fontSize:40,fontWeight:800,color:C.acc,marginBottom:4}}>₹{(total/100).toLocaleString('en-IN')}</div><div style={{fontSize:11,color:C.dim}}>UPI: {UPI_PA} · Ref: {booking?.txn_id}</div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>{[['🟢','GPay'],['🟣','PhonePe'],['🔵','Paytm'],['⚡','Any UPI']].map(([ic,lbl])=><a key={lbl} href={upiLink} target="_blank" rel="noreferrer" onClick={()=>confirmPaid(lbl)} style={{display:'flex',alignItems:'center',gap:10,...S.card(),textDecoration:'none'}}><span style={{fontSize:22}}>{ic}</span><span style={{color:C.txt,fontSize:14,fontWeight:600}}>{lbl}</span></a>)}</div>{svc.cash&&<Btn full v="secondary" onClick={()=>confirmPaid('Cash')} style={{marginBottom:10}}>💵 Pay cash on service</Btn>}<div style={{textAlign:'center',marginBottom:16}}><a href={RZP_URL} target="_blank" rel="noreferrer" style={{color:C.sub,fontSize:12}}>Card / Net Banking via Razorpay ↗</a></div><Btn full onClick={()=>confirmPaid('UPI')} disabled={loading}>{loading?<><Spin size={16}/>Confirming…</>:"✅ I've paid — confirm booking"}</Btn></>}
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
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field label="Age"><input type="number" value={frm.age} onChange={e=>f('age',e.target.value)} placeholder="32" style={S.inp()}/></Field><Field label="Gender"><select value={frm.gender} onChange={e=>f('gender',e.target.value)} style={S.inp()}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field></div>
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

/* ════════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════════ */
export default function App() {
  const [state,setState]       = useState('boot');
  const [user,setUser]         = useState(null);
  const [screen,setScreen]     = useState('home');
  const [activeSvc,setActiveSvc] = useState(null);
  const [toasts,setToasts]     = useState([]);
  const [notifs,setNotifs]     = useState([]);
  const [qrPrefill,setQrPrefill] = useState(null);
  const [,forceUpdate]         = useReducer(x=>x+1,0);

  const addToast=useCallback((msg,type='info')=>{
    const id=Date.now(); setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);
  },[]);

  const logout=useCallback(async()=>{
    try{await sb().auth.signOut();}catch(e){}
    localStorage.removeItem('scanv_uid');
    setUser(null); setState('register'); setScreen('home');
  },[]);

  // Check if QR scan (?qr=1 in URL)
  const isQRScan = new URLSearchParams(window.location.search).get('qr')==='1';

  useEffect(()=>{
    (async()=>{
      // Try restoring session
      try {
        const {data:{session}}=await sb().auth.getSession();
        if (session) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',session.user.id).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) { setUser(p); setState('app'); return; }
        }
        // Try localStorage UID
        const uid=localStorage.getItem('scanv_uid');
        if (uid) {
          const {data:p}=await sb().from('profiles').select('*').eq('id',uid).single();
          if (p&&p.status!=='suspended'&&p.mobile_verified&&p.first_name) { setUser(p); setState('app'); return; }
        }
      } catch(e){ console.warn('[ScanV]',e.message); }
      setState(isQRScan?'qr':'register');
    })();
  },[]);

  useEffect(()=>{
    if (!user) return;
    sb().from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
      .then(({data})=>setNotifs(data||[]));
  },[user]);

  const CSS=`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.bg};color:${C.txt};font-family:'DM Sans',sans-serif;overscroll-behavior:none}
    input,select,textarea,button{font-family:'DM Sans',sans-serif}
    input::placeholder,textarea::placeholder{color:${C.dim}}
    select option{background:${C.deep};color:${C.txt}}
    @keyframes spin{to{transform:rotate(360deg)}}
    ::-webkit-scrollbar{width:0}
  `;

  if (state==='boot') return (
    <><style>{CSS}</style>
    <div style={S.center}><div style={{fontSize:32,fontWeight:800,fontFamily:"'Space Grotesk',sans-serif"}}><span style={{color:C.txt}}>Scan</span><span style={{color:C.acc}}>V</span></div><Spin size={32}/></div></>
  );

  // QR landing page — capture data then proceed to register
  if (state==='qr') return (
    <Boundary><style>{CSS}</style><Toast toasts={toasts}/>
    <QRLandingPage onContinue={(scanId,dev,ip,geo,coords)=>{
      setQrPrefill({scanId,dev,ip,geo});
      setState('register');
    }}/>
    </Boundary>
  );

  if (state==='register') return (
    <Boundary><style>{CSS}</style><Toast toasts={toasts}/>
    <RegistrationFlow prefill={qrPrefill} onComplete={p=>{setUser(p);setState('app');}}/>
    </Boundary>
  );

  const ctx={user,setUser,screen,setScreen,activeSvc,setActiveSvc,notifs,addToast,logout};

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
        <style>{CSS}</style>
        <Toast toasts={toasts}/>
        <div style={{display:'flex',flexDirection:'column',height:'100vh',maxWidth:480,margin:'0 auto',background:C.surf}}>
          <Boundary>{renderScreen()}</Boundary>
          {!['book'].includes(screen)&&<BottomNav/>}
        </div>
      </Ctx.Provider>
    </Boundary>
  );
}
