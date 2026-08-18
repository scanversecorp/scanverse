/** Student Cloud — AI / Cloud / Data Center admission + admin fee tracker */
import { useCallback, useEffect, useMemo, useState } from 'react';

export const SGR_FEE_FALLBACK_PAISE = 50000;
/** @deprecated use sgrFeePaise prop / pricing catalog */
export const CLOUD_SGR_FEE_PAISE = SGR_FEE_FALLBACK_PAISE;
export const STUDENT_CLOUD_ID_KEY = 'scanv_student_cloud_id';
export const STUDENT_CLOUD_FEE_EVENT = 'scanv-student-cloud-fee-updated';
export const STUDENT_CLOUD_PIN_KEY = 'scanv_student_cloud_pin';
const STUDENT_CLOUD_FN = 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/student-cloud';

export function getStoredStudentCloudId() {
  try { return sessionStorage.getItem(STUDENT_CLOUD_ID_KEY); } catch { return null; }
}

export function setStoredStudentCloudId(id) {
  try {
    if (id) sessionStorage.setItem(STUDENT_CLOUD_ID_KEY, id);
    else sessionStorage.removeItem(STUDENT_CLOUD_ID_KEY);
    window.dispatchEvent(new CustomEvent(STUDENT_CLOUD_FEE_EVENT));
  } catch { /* ignore */ }
}

export function resolveUserMobile10(user) {
  if (!user) return null;
  const fromPhone = digits10(user.phone || user.mobile || '');
  if (fromPhone.length === 10) return fromPhone;
  const id = String(user.id || '');
  const m10 = /^cust_(\d{10})$/.exec(id);
  if (m10) return m10[1];
  const mLegacy = /^cust_(\d+)$/.exec(id);
  if (mLegacy) {
    const d = mLegacy[1].slice(-10);
    if (d.length === 10) return d;
  }
  return null;
}

export async function fetchStudentCloudFeeView({ studentId, mobile, apikey } = {}) {
  if (!apikey) return { sgr_paid: false, course_id: null, course_fee_paise: null };
  const payload = {};
  if (studentId) payload.student_id = studentId;
  else if (mobile) payload.mobile = mobile;
  else return { sgr_paid: false, course_id: null, course_fee_paise: null };
  const data = await studentCloudFetch('fee_view', payload, { apikey });
  if (data?.student_id) setStoredStudentCloudId(data.student_id);
  return data;
}

export function useStudentCloudFeeView(apikey, mobile10 = null) {
  const [feeView, setFeeView] = useState(null);
  const [loading, setLoading] = useState(!!apikey);

  const refresh = useCallback(async () => {
    if (!apikey) {
      setFeeView({ sgr_paid: false, course_id: null, course_fee_paise: null });
      setLoading(false);
      return;
    }
    const id = getStoredStudentCloudId();
    setLoading(true);
    try {
      let data;
      if (mobile10) {
        data = await fetchStudentCloudFeeView({ mobile: mobile10, apikey });
      } else if (id) {
        data = await fetchStudentCloudFeeView({ studentId: id, apikey });
      } else {
        setFeeView({ sgr_paid: false, course_id: null, course_fee_paise: null });
        setLoading(false);
        return;
      }
      setFeeView(data);
    } catch {
      setFeeView({ sgr_paid: false, course_id: null, course_fee_paise: null });
    } finally {
      setLoading(false);
    }
  }, [apikey, mobile10]);

  useEffect(() => {
    refresh();
    const onUpdate = () => { refresh(); };
    window.addEventListener(STUDENT_CLOUD_FEE_EVENT, onUpdate);
    return () => window.removeEventListener(STUDENT_CLOUD_FEE_EVENT, onUpdate);
  }, [refresh]);

  return { feeView, loading, refresh };
}

function fmtRs(paise) {
  return ((Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sgrFeePaiseFor(row) {
  return Number(row?.sgr_fee_paise || 0) >= 100 ? Number(row.sgr_fee_paise) : SGR_FEE_FALLBACK_PAISE;
}

export function isSgrPaidRow(row) {
  if (!row) return false;
  if (Number(row.sgr_paid_paise || 0) >= sgrFeePaiseFor(row)) return true;
  if (row.sgr_paid_at) return true;
  return ['sgr_paid', 'enrolled', 'fee_due', 'completed'].includes(String(row.status || ''));
}

function catalogCourseFeePaise(courses, courseId, row = null) {
  const fromApi = Number(row?.catalog_course_fee_paise || row?.effective_course_fee_paise || 0);
  if (fromApi > 0) return fromApi;
  const id = String(courseId || '').trim();
  if (!id) return null;
  const c = (courses || []).find((x) => x.id === id);
  const p = Number(c?.price);
  return p > 0 ? p : null;
}

function catalogScanvPaise(row, courseId, courses) {
  const fromApi = Number(row?.catalog_scanv_amount_paise || 0);
  if (fromApi > 0) return fromApi;
  const courseFee = catalogCourseFeePaise(courses, courseId, row);
  if (!courseFee) return 0;
  return Math.round(courseFee * 0.3);
}

function catalogPartnerPaise(row, courseId, courses) {
  const fromApi = Number(row?.catalog_partner_amount_paise || 0);
  if (fromApi > 0) return fromApi;
  const courseFee = catalogCourseFeePaise(courses, courseId, row) ?? 0;
  return Math.max(0, courseFee - catalogScanvPaise(row, courseId, courses));
}

function displayPendingPaise(row, courses, discountPaise) {
  const sgrDue = isSgrPaidRow(row)
    ? 0
    : Math.max(0, sgrFeePaiseFor(row) - Number(row.sgr_paid_paise || 0));
  const courseId = row.course_id;
  const courseFee = catalogCourseFeePaise(courses, courseId, row) ?? Number(row.course_fee_paise || 0);
  const scanvFee = catalogScanvPaise(row, courseId, courses);
  const discount = Number(discountPaise || 0);
  const scanvDiscount = courseFee > 0 ? Math.round(discount * scanvFee / courseFee) : 0;
  const scanvDue = Math.max(0, scanvFee - scanvDiscount - Number(row.course_paid_paise || 0));
  return sgrDue + scanvDue;
}

function digits10(raw) {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

function parseIsoDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function scheduleBounds() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 1);
  return {
    today,
    max,
    minStr: localIsoDate(today),
    maxStr: localIsoDate(max),
  };
}

function localIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultSgrScheduleDate() {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localIsoDate(tomorrow);
}

const DEFAULT_SGR_SCHEDULE_TIME = '14:30';

function validateSgrDob(dateStr, ageFromDob) {
  if (!dateStr) return 'Enter date of birth';
  if (!parseIsoDate(dateStr)) return 'Enter a valid date of birth';
  if (!ageFromDob?.(dateStr)) return 'Enter a valid date of birth (age 5–120)';
  return '';
}

function validateSgrSchedule(dateStr, timeStr) {
  if (!dateStr) return 'Pick a schedule date';
  const dt = parseIsoDate(dateStr);
  if (!dt) return 'Enter a valid schedule date — check day and month';
  const { today, max } = scheduleBounds();
  if (dt < today) return 'Schedule date cannot be in the past';
  if (dt > max) return 'Schedule date must be within the next 12 months';
  if (!timeStr) return 'Pick a schedule time';
  const tm = /^(\d{2}):(\d{2})$/.exec(String(timeStr).trim());
  if (!tm) return 'Pick a valid schedule time';
  const hh = Number(tm[1]);
  const mm = Number(tm[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return 'Pick a valid schedule time';
  if (dt.getTime() === today.getTime()) {
    const slot = new Date(dt);
    slot.setHours(hh, mm, 0, 0);
    if (slot <= new Date()) return 'Schedule time must be later today';
  }
  return '';
}

async function studentCloudFetch(action, payload, { pin, apikey } = {}) {
  const headers = { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json' };
  if (pin) headers['x-admin-pin'] = pin;
  const res = await fetch(STUDENT_CLOUD_FN, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function otpChange(i, raw, digits, setDigits, prefix) {
  const ch = raw.replace(/\D/g, '').slice(-1);
  const nd = [...digits];
  nd[i] = ch;
  setDigits(nd);
  if (ch && i < 5) document.getElementById(`${prefix}${i + 1}`)?.focus();
}

export function StudentCloudAdmitScreen({
  silentGeo, initialCourse, courses, sgrFeePaise = SGR_FEE_FALLBACK_PAISE, onBack, addToast, showCopyright = true, kit,
}) {
  const {
    C, S, FF, Field, Btn, Spin, BDR, CopyrightLine,
    invokeSendOtp, verifyOtpCode, reverseGeo, registerPaymentIntent, checkPaymentVerified,
    minDobInput, maxDobInput, ageFromDob, captureFreshGps, SB_KEY,
  } = kit;

  const courseList = courses || [];
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [experience, setExperience] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState(silentGeo?.address || '');
  const [village, setVillage] = useState(silentGeo?.village || '');
  const [city, setCity] = useState(silentGeo?.city || '');
  const [state, setState] = useState(silentGeo?.state || '');
  const [pincode, setPincode] = useState(silentGeo?.pincode || '');
  const [lat, setLat] = useState(silentGeo?.lat ?? null);
  const [lng, setLng] = useState(silentGeo?.lng ?? null);
  const [courseId, setCourseId] = useState(initialCourse?.id || courseList[0]?.id || 'cl-training');
  const [scheduleDate, setScheduleDate] = useState(defaultSgrScheduleDate);
  const [scheduleTime, setScheduleTime] = useState(DEFAULT_SGR_SCHEDULE_TIME);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [student, setStudent] = useState(null);
  const [txnId, setTxnId] = useState(null);
  const [payUrl, setPayUrl] = useState(null);
  const [paid, setPaid] = useState(false);
  const [sgrFeeLocked, setSgrFeeLocked] = useState(null);
  const effectiveSgrFee = sgrFeeLocked ?? sgrFeePaise;
  const sgrFeeLabel = useMemo(() => fmtRs(effectiveSgrFee), [effectiveSgrFee]);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [sgrFeeAck, setSgrFeeAck] = useState(false);
  const [err, setErr] = useState('');

  const courseName = useMemo(
    () => courseList.find((c) => c.id === courseId)?.name || initialCourse?.name || 'Cloud & IT Training',
    [courseList, courseId, initialCourse],
  );

  const fillGps = async () => {
    setGpsBusy(true); setErr('');
    try {
      const geo = await captureFreshGps?.(silentGeo) || silentGeo;
      if (!geo) {
        await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('GPS unavailable'));
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const g = await reverseGeo(pos.coords.latitude, pos.coords.longitude);
            setAddress(g.address || '');
            setVillage(g.village || '');
            setCity(g.city || '');
            setState(g.state || '');
            setPincode(g.pincode || '');
            setLat(g.lat ?? pos.coords.latitude);
            setLng(g.lng ?? pos.coords.longitude);
            resolve();
          }, () => reject(new Error('Allow location to auto-fill address')), { timeout: 10000, enableHighAccuracy: true });
        });
      } else {
        setAddress((a) => a || geo.address || '');
        setVillage((v) => v || geo.village || '');
        setCity((c) => c || geo.city || '');
        setState((s) => s || geo.state || '');
        setPincode((p) => p || geo.pincode || '');
        setLat(geo.lat ?? null);
        setLng(geo.lng ?? null);
        if (geo.address) setAddress(geo.address);
        if (geo.village) setVillage(geo.village);
        if (geo.city) setCity(geo.city);
        if (geo.state) setState(geo.state);
        if (geo.pincode) setPincode(geo.pincode);
      }
      addToast?.('Address filled from GPS — edit if needed', 'success');
    } catch (e) {
      setErr(e.message || 'GPS failed — enter address manually');
    } finally { setGpsBusy(false); }
  };

  useEffect(() => {
    if (silentGeo?.address || silentGeo?.city) {
      setAddress((a) => a || silentGeo.address || '');
      setVillage((v) => v || silentGeo.village || '');
      setCity((c) => c || silentGeo.city || '');
      setState((s) => s || silentGeo.state || '');
      setPincode((p) => p || silentGeo.pincode || '');
      setLat(silentGeo.lat ?? null);
      setLng(silentGeo.lng ?? null);
    }
  }, [silentGeo]);

  const schedBounds = scheduleBounds();

  const validateForm = () => {
    if (!firstName.trim()) return 'Enter first name';
    if (!lastName.trim()) return 'Enter last name';
    if (!experience.trim()) return 'Enter your experience';
    const dobErr = validateSgrDob(dob, ageFromDob);
    if (dobErr) return dobErr;
    if (digits10(mobile).length !== 10) return 'Enter valid 10-digit mobile';
    if (!address.trim()) return 'Enter address';
    if (!city.trim()) return 'Enter city';
    if (!state.trim()) return 'Enter state';
    const schedErr = validateSgrSchedule(scheduleDate, scheduleTime);
    if (schedErr) return schedErr;
    return '';
  };

  const sendOtp = async () => {
    const v = validateForm();
    if (v) return setErr(v);
    setLoading(true); setErr('');
    try {
      await invokeSendOtp(`+91${digits10(mobile)}`);
      setOtpSent(true);
      addToast?.('OTP sent', 'success');
    } catch (e) {
      setErr(e.message || 'OTP send failed');
    } finally { setLoading(false); }
  };

  const preparePayLink = useCallback(async (tid, feePaise) => {
    const pay = await registerPaymentIntent(tid, feePaise, null, {
      serviceId: 'cl-sgr',
      serviceName: 'Skill Gap Review (SGR)',
      servicePricePaise: feePaise,
    });
    if (pay?.txn_id && pay.txn_id !== tid) setTxnId(pay.txn_id);
    if (pay?.payment_link_url) {
      setPayUrl(pay.payment_link_url);
      setErr('');
      return true;
    }
    if (pay?.already_paid) {
      setPaid(true);
      setErr('');
      return true;
    }
    const payErr = pay?.error || pay?.razorpay_error || 'Could not prepare Razorpay link';
    setErr(payErr);
    addToast?.(payErr, 'error');
    return false;
  }, [registerPaymentIntent, addToast]);

  const verifyAndSubmit = async () => {
    const code = otpCode.join('');
    if (code.length < 6) return setErr('Enter 6-digit OTP');
    const formErr = validateForm();
    if (formErr) return setErr(formErr);
    setLoading(true); setErr('');
    try {
      const r = await studentCloudFetch('submit', {
        mobile: `+91${digits10(mobile)}`,
        otp: code,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        experience: experience.trim(),
        dob,
        address: address.trim(),
        village: village.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode,
        lat, lng,
        course_id: courseId,
        course_name: courseName,
        schedule_date: scheduleDate,
        schedule_time: scheduleTime,
      }, { apikey: SB_KEY });
      setOtpVerified(true);
      setStudent(r.student);
      if (r.student?.id) setStoredStudentCloudId(r.student.id);
      const lockedFee = Number(r.sgr_fee_paise) >= 100 ? Number(r.sgr_fee_paise) : sgrFeePaise;
      setSgrFeeLocked(lockedFee);
      const tid = `TXN-SGR-${Date.now()}`;
      setTxnId(tid);
      setPayUrl(null);
      const ok = await preparePayLink(tid, lockedFee);
      if (ok && !paid) addToast?.('Mobile verified — continue to Razorpay', 'success');
    } catch (e) {
      setErr(e.message || 'Could not submit form');
    } finally { setLoading(false); }
  };

  const openPay = () => {
    if (!sgrFeeAck) { addToast?.('Please confirm SGR fee is non-refundable', 'error'); return; }
    if (!payUrl) { addToast?.('Razorpay link not ready — wait a moment', 'error'); return; }
    window.open(payUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!txnId || !student?.id || paid || done) return undefined;
    let cancelled = false;
    const poll = async () => {
      const ok = await checkPaymentVerified(txnId, effectiveSgrFee);
      if (cancelled || !ok) return;
      setPaid(true);
      try {
        const r = await studentCloudFetch('confirm_sgr', { student_id: student.id, txn_id: txnId }, { apikey: SB_KEY });
        setStoredStudentCloudId(student.id);
        setDone(true);
        setDoneMsg(r.message || 'Skill Gap Review (SGR) form submitted. One of our consultant will call you in next 72 hours');
        addToast?.('SGR payment confirmed', 'success');
      } catch (e) {
        setErr(e.message);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [txnId, student?.id, paid, done, effectiveSgrFee, checkPaymentVerified, addToast, SB_KEY]);

  if (done) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ ...S.card(), padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.txt, marginBottom: 10 }}>Skill Gap Review (SGR)</div>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, fontWeight: 600 }}>
            {doneMsg || 'Skill Gap Review (SGR) form submitted. One of our consultant will call you in next 72 hours'}
          </div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>₹{sgrFeeLabel} paid · {courseName} · {scheduleDate} {scheduleTime}</div>
          <Btn full onClick={onBack} style={{ marginTop: 18 }}>Back to Cloud courses</Btn>
        </div>
        {showCopyright && CopyrightLine ? <CopyrightLine style={{ padding: '16px 0 8px', marginTop: 16 }} /> : null}
      </div>
    );
  }

  return (
    <>
      <div style={{ background: C.surf, borderBottom: BDR, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 22 }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, flex: 1, textAlign: 'center', marginRight: 30 }}>Skill Gap Review (SGR) - Form A1</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 28px' }}>
        {err && <div style={S.err}>{err}</div>}
        <div style={{ ...S.card(), padding: 14, marginBottom: 14, background: '#EFF6FF', border: '1.5px solid #93C5FD' }}>
          <div style={{ fontWeight: 800, color: '#1D4ED8', fontSize: 14 }}>Skill Gap Review (SGR)</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>AI, Cloud & Data Center · verify mobile, book a schedule, then pay via Razorpay.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="First name" req><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Rahul" style={S.inp()} disabled={otpVerified} /></Field>
          <Field label="Last name" req><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sharma" style={S.inp()} disabled={otpVerified} /></Field>
        </div>
        <Field label="Experience" req note="Years / domain — e.g. 2 yrs networking">
          <input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Fresher / 3 years IT support" style={S.inp()} disabled={otpVerified} />
        </Field>
        <Field label="Date of birth" req note="Age 5–120">
          <input type="date" min={minDobInput()} max={maxDobInput()} value={dob} onChange={(e) => setDob(e.target.value)} style={S.inp()} disabled={otpVerified} />
        </Field>
        <Field label="Mobile" req note="Verified by OTP">
          <div style={{ display: 'flex', alignItems: 'center', background: C.surf, border: BDR, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '12px', background: C.deep, borderRight: BDR, color: C.sub, fontSize: 14, fontWeight: 700 }}>+91</div>
            <input type="tel" maxLength={10} value={mobile} onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setOtpSent(false); setOtpVerified(false); }} placeholder="9876543210" style={{ ...S.inp(), border: 'none', borderRadius: 0, background: 'transparent' }} disabled={otpVerified} />
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" onClick={fillGps} disabled={gpsBusy || otpVerified} style={{ background: 'none', border: `1.5px solid ${C.acc}`, color: C.acc, borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}>{gpsBusy ? 'Locating…' : '📍 Use GPS'}</button>
        </div>
        <Field label="Address" req><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, area" style={S.inp()} disabled={otpVerified} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Village"><input value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village" style={S.inp()} disabled={otpVerified} /></Field>
          <Field label="City" req><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pune" style={S.inp()} disabled={otpVerified} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="State" req><input value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" style={S.inp()} disabled={otpVerified} /></Field>
          <Field label="PIN"><input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="411057" style={S.inp()} disabled={otpVerified} /></Field>
        </div>

        <Field label="Course" req>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={S.inp()} disabled={otpVerified}>
            {courseList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Schedule date" req note="Today or a future date within 12 months">
            <input type="date" min={schedBounds.minStr} max={schedBounds.maxStr} value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={S.inp()} disabled={otpVerified} />
          </Field>
          <Field label="Time" req><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} style={S.inp()} disabled={otpVerified} /></Field>
        </div>

        {!otpVerified && !otpSent && (
          <Btn full onClick={sendOtp} disabled={loading}>{loading ? <><Spin size={16} /> Sending OTP…</> : 'Send OTP →'}</Btn>
        )}
        {!otpVerified && otpSent && (
          <>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '12px 0' }}>
              {otpCode.map((d, i) => (
                <input key={i} maxLength={1} value={d} inputMode="numeric" id={`sgr-otp-${i}`}
                  onChange={(e) => otpChange(i, e.target.value, otpCode, setOtpCode, 'sgr-otp-')}
                  style={{ width: 44, height: 50, textAlign: 'center', border: d ? `2px solid ${C.acc}` : BDR, borderRadius: 10, fontSize: 20, fontWeight: 800, fontFamily: FF, color: C.acc }} />
              ))}
            </div>
            <Btn full onClick={verifyAndSubmit} disabled={loading}>{loading ? <><Spin size={16} /> Saving…</> : 'Verify OTP & continue to pay →'}</Btn>
          </>
        )}

        {otpVerified && !done && (
          <div style={{ ...S.card(), padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Razorpay · we confirm automatically after payment.</div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, cursor: 'pointer', fontSize: 11, color: C.dim, lineHeight: 1.45 }}>
              <input type="checkbox" checked={sgrFeeAck} onChange={(e) => setSgrFeeAck(e.target.checked)} style={{ marginTop: 2, accentColor: C.acc, flexShrink: 0 }} />
              <span>I understand that SGR fees ₹{sgrFeeLabel} is non-refundable</span>
            </label>
            <Btn full onClick={openPay} disabled={!payUrl || loading || !sgrFeeAck}>{payUrl ? 'Pay with Razorpay →' : 'Preparing Razorpay…'}</Btn>
            {!payUrl && txnId && !paid && (
              <Btn v="outline" full onClick={async () => { setLoading(true); await preparePayLink(txnId, effectiveSgrFee); setLoading(false); }} disabled={loading} style={{ marginTop: 8 }}>
                Retry Razorpay link
              </Btn>
            )}
            {paid && <div style={{ fontSize: 12, color: C.grn, marginTop: 8, fontWeight: 700 }}>Payment seen — confirming…</div>}
          </div>
        )}
        {showCopyright && CopyrightLine ? <CopyrightLine style={{ padding: '16px 0 8px', marginTop: 16 }} /> : null}
      </div>
    </>
  );
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  } catch {
    return String(iso).slice(0, 16);
  }
}

function localDatetimeInputValue(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
  } catch { return ''; }
}

const PAYMENT_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Bank transfer', 'Cash', 'Razorpay', 'Other'];

function PaymentCaptureModal({ open, onClose, onSubmit, C, S, Btn, defaultAmount = '' }) {
  const [form, setForm] = useState({
    amount_rs: defaultAmount,
    payment_by: '',
    payment_app: 'GPay',
    payment_at: localDatetimeInputValue(new Date().toISOString()),
    txn_id: '',
    upi_id: '',
    note: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        amount_rs: defaultAmount,
        payment_by: '',
        payment_app: 'GPay',
        payment_at: localDatetimeInputValue(new Date().toISOString()),
        txn_id: '',
        upi_id: '',
        note: '',
      });
    }
  }, [open, defaultAmount]);

  if (!open) return null;
  const inp = { ...S.inp(), padding: '8px 10px', fontSize: 12, margin: 0 };
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ ...S.card(), maxWidth: 420, width: '100%', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Record payment</div>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 14 }}>Capture payer, app, date/time, transaction ID, and UPI details.</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 11, color: C.dim }}>Amount (₹)
            <input type="number" step="0.01" value={form.amount_rs} onChange={(e) => set('amount_rs', e.target.value)} style={inp} placeholder="0.00" />
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>Payment by
            <input value={form.payment_by} onChange={(e) => set('payment_by', e.target.value)} style={inp} placeholder="Student / parent name" />
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>Payment app
            <select value={form.payment_app} onChange={(e) => set('payment_app', e.target.value)} style={inp}>
              {PAYMENT_APPS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>Payment date & time
            <input type="datetime-local" value={form.payment_at} onChange={(e) => set('payment_at', e.target.value)} style={inp} />
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>Transaction ID
            <input value={form.txn_id} onChange={(e) => set('txn_id', e.target.value)} style={inp} placeholder="UPI ref / bank txn" />
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>UPI ID
            <input value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} style={inp} placeholder="name@upi" />
          </label>
          <label style={{ fontSize: 11, color: C.dim }}>Note
            <input value={form.note} onChange={(e) => set('note', e.target.value)} style={inp} placeholder="Optional note" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Btn v="ghost" sm onClick={onClose}>Cancel</Btn>
          <Btn sm onClick={() => onSubmit(form)}>Save payment</Btn>
        </div>
      </div>
    </div>
  );
}

export function StudentCloudDashboard({ pin, apikey, courses, C, S, FF, Spin, Btn }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState({});
  const [payModal, setPayModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await studentCloudFetch('list', { q }, { pin, apikey });
      setRows(r.students || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [pin, apikey, q]);

  useEffect(() => { load(); }, [load]);

  const save = async (id) => {
    const patch = edit[id] || {};
    const row = rows.find((r) => r.id === id);
    const courseId = patch.course_id ?? row?.course_id;
    const catalogFee = catalogCourseFeePaise(courses, courseId, row);
    try {
      await studentCloudFetch('update', {
        student_id: id,
        course_fee_paise: catalogFee ?? (patch.course_fee_rs != null ? Math.round(Number(patch.course_fee_rs) * 100) : undefined),
        discount_paise: patch.discount_rs != null ? Math.round(Number(patch.discount_rs) * 100) : undefined,
        admin_comment: patch.admin_comment,
        installment_1_date: patch.installment_1_date,
        installment_2_date: patch.installment_2_date,
        course_id: patch.course_id,
        course_name: patch.course_id ? (courses || []).find((c) => c.id === patch.course_id)?.name : undefined,
      }, { pin, apikey });
      setMsg('Saved');
      load();
    } catch (e) { setErr(e.message); }
  };

  const submitPayment = async (studentId, form) => {
    const rs = Number(form.amount_rs || 0);
    if (rs <= 0) return setErr('Enter payment amount in rupees');
    try {
      await studentCloudFetch('record_payment', {
        student_id: studentId,
        kind: 'course',
        amount_paise: Math.round(rs * 100),
        note: form.note || 'Course fee payment',
        payment_by: form.payment_by || undefined,
        payment_app: form.payment_app || undefined,
        payment_at: form.payment_at ? new Date(form.payment_at).toISOString() : undefined,
        txn_id: form.txn_id || undefined,
        upi_id: form.upi_id || undefined,
      }, { pin, apikey });
      setPayModal(null);
      setMsg('Payment recorded');
      load();
    } catch (e) { setErr(e.message); }
  };

  const remind = async (id, channel) => {
    try {
      const r = await studentCloudFetch('remind', { student_id: id, channel }, { pin, apikey });
      setMsg(channel === 'call' ? `Call reminder sent · ${r.tel || ''}` : 'SMS reminder sent');
      if (channel === 'call' && r.tel) window.open(r.tel);
      load();
    } catch (e) { setErr(e.message); }
  };

  const csv = () => {
    const headers = ['Name', 'Mobile', 'Course', 'SGR paid', 'Course fee', 'ScanV ₹', 'Partner ₹', 'Discount', 'Course paid', 'Pending (ScanV)', 'Inst 1', 'Inst 2', 'Comment', 'Last payment'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const scanv = catalogScanvPaise(r, r.course_id, courses);
      const partner = catalogPartnerPaise(r, r.course_id, courses);
      const pending = displayPendingPaise(r, courses, r.discount_paise);
      const lastPay = (r.student_cloud_payments || []).slice().sort((a, b) => new Date(b.payment_at || b.created_at) - new Date(a.payment_at || a.created_at))[0];
      const vals = [
        `${r.first_name} ${r.last_name}`, r.mobile, r.course_name,
        fmtRs(r.sgr_paid_paise), fmtRs(r.effective_course_fee_paise || r.course_fee_paise),
        fmtRs(scanv), fmtRs(partner), fmtRs(r.discount_paise), fmtRs(r.course_paid_paise), fmtRs(pending),
        r.installment_1_date || '', r.installment_2_date || '', r.admin_comment || '',
        lastPay ? `${fmtRs(lastPay.amount_paise)} · ${lastPay.payment_app || ''} · ${lastPay.txn_id || ''}` : '',
      ].map((v) => `"${String(v || '').replace(/"/g, '""')}"`);
      lines.push(vals.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `student-cloud-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const th = { position: 'sticky', top: 0, background: '#f8fafc', fontSize: 10, fontWeight: 800, color: C.dim, textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${C.bdr}`, whiteSpace: 'nowrap' };
  const td = { fontSize: 11, padding: '7px 6px', borderBottom: `1px solid ${C.bdr}`, verticalAlign: 'middle', whiteSpace: 'nowrap' };
  const inp = { ...S.inp(), padding: '6px 8px', fontSize: 11, margin: 0 };

  return (
    <div>
      <PaymentCaptureModal
        open={!!payModal}
        defaultAmount={payModal?.defaultAmount || ''}
        onClose={() => setPayModal(null)}
        onSubmit={(form) => submitPayment(payModal?.id, form)}
        C={C}
        S={S}
        Btn={Btn}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Student Cloud</div>
          <div style={{ fontSize: 12, color: C.sub }}>ScanV ₹ & Partner ₹ from Pricing Input · Pending uses ScanV share · 2 installments · payment capture</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn v="outline" sm onClick={csv}>Export CSV</Btn>
          <Btn sm onClick={load} disabled={loading}>{loading ? '…' : 'Refresh'}</Btn>
        </div>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, course…" style={{ ...S.inp(), marginBottom: 10 }} />
      {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{err}</div>}
      {msg && <div style={{ color: C.grn, fontSize: 12, marginBottom: 8 }}>{msg}</div>}
      {loading && !rows.length ? <div style={{ padding: 24, display: 'flex', gap: 8, alignItems: 'center' }}><Spin size={16} /> Loading…</div> : (
        <div style={{ overflow: 'auto', border: `1px solid ${C.bdr}`, borderRadius: 12, maxHeight: '70vh' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FF, minWidth: 1680 }}>
            <thead>
              <tr>
                {['Profile', 'Enrollment', 'Schedule', 'SGR', 'Course fee', 'ScanV ₹', 'Partner ₹', 'Discount', 'Paid', 'Pending', 'Inst 1', 'Inst 2', 'Comment', 'Pay / remind'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = edit[r.id] || {};
                const courseId = e.course_id ?? r.course_id;
                const catalogFee = catalogCourseFeePaise(courses, courseId, r);
                const scanvAmt = catalogScanvPaise(r, courseId, courses);
                const partnerAmt = catalogPartnerPaise(r, courseId, courses);
                const discountPaise = e.discount_rs != null ? Math.round(Number(e.discount_rs) * 100) : Number(r.discount_paise || 0);
                const pending = displayPendingPaise({ ...r, course_id: courseId }, courses, discountPaise);
                const sgrPaid = isSgrPaidRow(r);
                const addr = [r.address, r.village, r.city, r.state, r.pincode].filter(Boolean).join(', ');
                const payments = (r.student_cloud_payments || []).slice().sort((a, b) => new Date(b.payment_at || b.created_at) - new Date(a.payment_at || a.created_at));
                const lastPay = payments[0];
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 180, maxWidth: 240 }}>
                      <div style={{ fontWeight: 800 }}>{r.first_name} {r.last_name}</div>
                      <div style={{ marginTop: 4 }}><a href={`tel:+91${r.mobile}`} style={{ color: C.cyan, fontWeight: 700 }}>+91 {r.mobile}</a></div>
                      <div style={{ color: C.dim, fontSize: 10, marginTop: 4, lineHeight: 1.45 }}>
                        DOB: {r.dob || '—'} · {r.experience || '—'}
                      </div>
                      <div style={{ color: C.sub, fontSize: 10, marginTop: 4, lineHeight: 1.45 }}>{addr || '—'}</div>
                      <div style={{ color: C.dim, fontSize: 9, marginTop: 4 }}>Joined {formatWhen(r.created_at)}</div>
                      {lastPay && (
                        <div style={{ color: C.dim, fontSize: 9, marginTop: 6, lineHeight: 1.4 }}>
                          Last: ₹{fmtRs(lastPay.amount_paise)} · {lastPay.payment_app || '—'} · {formatWhen(lastPay.payment_at || lastPay.created_at)}
                          {lastPay.txn_id ? ` · ${lastPay.txn_id}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 150 }}>
                      <select value={courseId ?? ''} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], course_id: ev.target.value } }))} style={{ ...inp, minWidth: 140, marginBottom: 6 }}>
                        {(courses || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <div style={{ fontSize: 10, color: C.sub }}>{(courses || []).find((c) => c.id === courseId)?.name || r.course_name || '—'}</div>
                      {sgrPaid ? (
                        <div style={{ fontSize: 10, color: C.grn, marginTop: 4, fontWeight: 700 }}>
                          SGR paid{r.sgr_paid_at ? ` · ${formatWhen(r.sgr_paid_at)}` : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: C.gold, marginTop: 4, fontWeight: 700 }}>SGR pending · ₹{fmtRs(r.sgr_fee_paise)}</div>
                      )}
                    </td>
                    <td style={td}>{r.schedule_date || '—'} {r.schedule_time || ''}</td>
                    <td style={td}>₹{fmtRs(r.sgr_paid_paise)}</td>
                    <td style={td}>
                      {sgrPaid ? (
                        <span style={{ fontWeight: 700, color: C.txt }}>
                          ₹{fmtRs(catalogFee ?? 0)}
                          {!catalogFee && <span style={{ color: C.gold, fontWeight: 600, marginLeft: 4, fontSize: 10 }}>no catalog price</span>}
                        </span>
                      ) : (
                        <span style={{ color: C.dim, fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: C.acc }}>{sgrPaid ? `₹${fmtRs(scanvAmt)}` : '—'}</td>
                    <td style={{ ...td, color: C.cyan }}>{sgrPaid ? `₹${fmtRs(partnerAmt)}` : '—'}</td>
                    <td style={td}><input value={e.discount_rs ?? (Number(r.discount_paise || 0) / 100)} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], discount_rs: ev.target.value } }))} style={{ ...inp, width: 72 }} /></td>
                    <td style={td}>₹{fmtRs(r.course_paid_paise)}</td>
                    <td style={{ ...td, fontWeight: 800, color: pending > 0 ? C.acc : C.grn }} title="ScanV share pending">₹{fmtRs(pending)}</td>
                    <td style={td}>
                      <input type="date" value={e.installment_1_date ?? r.installment_1_date ?? ''} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], installment_1_date: ev.target.value || null } }))} style={{ ...inp, width: 118 }} />
                    </td>
                    <td style={td}>
                      <input type="date" value={e.installment_2_date ?? r.installment_2_date ?? ''} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], installment_2_date: ev.target.value || null } }))} style={{ ...inp, width: 118 }} />
                    </td>
                    <td style={{ ...td, whiteSpace: 'normal', minWidth: 120, maxWidth: 160 }}>
                      <input value={e.admin_comment ?? r.admin_comment ?? ''} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], admin_comment: ev.target.value } }))} style={{ ...inp, width: '100%', minWidth: 100 }} placeholder="Notes…" />
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setPayModal({ id: r.id, defaultAmount: pending > 0 ? String((pending / 100).toFixed(2)) : '' })} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 700 }}>+Pay</button>
                        <button type="button" onClick={() => save(r.id)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Save</button>
                        <button type="button" onClick={() => remind(r.id, 'sms')} disabled={pending <= 0} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>SMS</button>
                        <button type="button" onClick={() => remind(r.id, 'call')} disabled={pending <= 0} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Call</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={14} style={{ ...td, textAlign: 'center', color: C.dim, padding: 24 }}>No student admissions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminStudentCloudTab(props) {
  return <StudentCloudDashboard {...props} />;
}

export function StudentCloudPage({ apikey, courses, kit }) {
  const { C, S, FF, Field, Btn, Spin } = kit;
  const [pin, setPin] = useState(() => {
    try { return sessionStorage.getItem(STUDENT_CLOUD_PIN_KEY) || ''; } catch { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const login = async () => {
    if (!pin || pin.length < 6) { setErr('Enter your HardPin (6+ characters)'); return; }
    setLoading(true); setErr('');
    try {
      await studentCloudFetch('list', {}, { pin, apikey });
      try { sessionStorage.setItem(STUDENT_CLOUD_PIN_KEY, pin); } catch { /* ignore */ }
      setAuthed(true);
    } catch (e) {
      setErr(e.message || 'Incorrect HardPin — use STUDENT_CLOUD_PIN or admin hub PIN');
      setAuthed(false);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!pin || pin.length < 6) return;
    let cancelled = false;
    (async () => {
      try {
        await studentCloudFetch('list', {}, { pin, apikey });
        if (!cancelled) setAuthed(true);
      } catch { /* stay on gate */ }
    })();
    return () => { cancelled = true; };
  }, [pin, apikey]);

  const lock = () => {
    try { sessionStorage.removeItem(STUDENT_CLOUD_PIN_KEY); } catch { /* ignore */ }
    setAuthed(false);
    setPin('');
  };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FF, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ ...S.card(), maxWidth: 420, width: '100%', padding: 24 }}>
          <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>CONFIDENTIAL · STUDENT CLOUD</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.txt, marginBottom: 6 }}>Student Cloud</div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 20, lineHeight: 1.5 }}>
            SGR admissions · profile · enrollment · course fees. Protected by HardPin.
          </div>
          <Field label="HardPin (STUDENT_CLOUD_PIN or admin hub PIN)">
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} style={S.inp()} placeholder="••••••••" autoComplete="off" />
          </Field>
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
          <Btn full onClick={login} disabled={!pin || loading}>{loading ? 'Checking…' : 'Unlock Student Cloud'}</Btn>
          <div style={{ marginTop: 16, fontSize: 11, color: C.dim, textAlign: 'center' }}>
            Bookmark: <code style={{ color: C.acc }}>https://getscanv.com/#student-cloud</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FF, padding: '16px 16px 32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: 1 }}>STUDENT CLOUD · HARDPIN</div>
          <div style={{ fontSize: 11, color: C.sub }}>ScanV ₹ & Partner ₹ from Pricing Input (#pricing-admin)</div>
          <Btn v="outline" sm onClick={lock}>Lock</Btn>
        </div>
        <StudentCloudDashboard pin={pin} apikey={apikey} courses={courses} C={C} S={S} FF={FF} Spin={Spin} Btn={Btn} />
      </div>
    </div>
  );
}
