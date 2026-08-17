/** Student Cloud — AI / Cloud / Data Center admission + admin fee tracker */
import { useCallback, useEffect, useMemo, useState } from 'react';

export const SGR_FEE_FALLBACK_PAISE = 50000;
/** @deprecated use sgrFeePaise prop / pricing catalog */
export const CLOUD_SGR_FEE_PAISE = SGR_FEE_FALLBACK_PAISE;
const STUDENT_CLOUD_FN = 'https://rwlwrmmqtedugcreweut.supabase.co/functions/v1/student-cloud';

function fmtRs(paise) {
  return ((Number(paise) || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  silentGeo, initialCourse, courses, sgrFeePaise = SGR_FEE_FALLBACK_PAISE, onBack, addToast, kit,
}) {
  const {
    C, S, FF, Field, Btn, Spin, BDR,
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
      </div>
    </>
  );
}

export function AdminStudentCloudTab({ pin, apikey, courses, C, S, FF, Spin, Btn }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState({});
  const [payAmt, setPayAmt] = useState({});

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
    try {
      await studentCloudFetch('update', {
        student_id: id,
        course_fee_paise: patch.course_fee_rs != null ? Math.round(Number(patch.course_fee_rs) * 100) : undefined,
        discount_paise: patch.discount_rs != null ? Math.round(Number(patch.discount_rs) * 100) : undefined,
        status: patch.status,
        notes: patch.notes,
        course_id: patch.course_id,
        course_name: patch.course_id ? (courses || []).find((c) => c.id === patch.course_id)?.name : undefined,
      }, { pin, apikey });
      setMsg('Saved');
      load();
    } catch (e) { setErr(e.message); }
  };

  const recordPay = async (id) => {
    const rs = Number(payAmt[id] || 0);
    if (rs <= 0) return setErr('Enter payment amount in rupees');
    try {
      await studentCloudFetch('record_payment', { student_id: id, kind: 'course', amount_paise: Math.round(rs * 100), note: 'Partial / course fee' }, { pin, apikey });
      setPayAmt((p) => ({ ...p, [id]: '' }));
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
    const headers = ['Name', 'Mobile', 'Course', 'Schedule', 'Experience', 'DOB', 'Village', 'City', 'State', 'SGR fee', 'SGR paid', 'Course fee', 'Discount', 'Course paid', 'Pending', 'Status'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const vals = [
        `${r.first_name} ${r.last_name}`, r.mobile, r.course_name, `${r.schedule_date || ''} ${r.schedule_time || ''}`,
        r.experience, r.dob, r.village, r.city, r.state,
        fmtRs(r.sgr_fee_paise), fmtRs(r.sgr_paid_paise), fmtRs(r.course_fee_paise), fmtRs(r.discount_paise), fmtRs(r.course_paid_paise), fmtRs(r.pending_paise), r.status,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Student Cloud</div>
          <div style={{ fontSize: 12, color: C.sub }}>AI, Cloud & Data Center · SGR ₹500 + course fees · partial pay · reminders</div>
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
          <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: FF, minWidth: 1280 }}>
            <thead>
              <tr>
                {['Student', 'Mobile', 'Course', 'Schedule', 'SGR', 'SGR paid', 'Course fee', 'Discount', 'Course paid', 'Pending', 'Status', 'Pay / remind'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const e = edit[r.id] || {};
                const pending = r.pending_paise || 0;
                return (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{r.first_name} {r.last_name}</div>
                      <div style={{ color: C.dim, fontSize: 10 }}>{r.city}{r.state ? `, ${r.state}` : ''} · {r.experience}</div>
                    </td>
                    <td style={td}><a href={`tel:+91${r.mobile}`} style={{ color: C.cyan, fontWeight: 700 }}>{r.mobile}</a></td>
                    <td style={td}>
                      <select value={e.course_id ?? r.course_id ?? ''} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], course_id: ev.target.value } }))} style={{ ...inp, minWidth: 140 }}>
                        {(courses || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={td}>{r.schedule_date || '—'} {r.schedule_time || ''}</td>
                    <td style={td}>₹{fmtRs(r.sgr_fee_paise)}</td>
                    <td style={{ ...td, color: Number(r.sgr_paid_paise) >= Number(r.sgr_fee_paise) ? C.grn : C.gold, fontWeight: 700 }}>₹{fmtRs(r.sgr_paid_paise)}</td>
                    <td style={td}><input value={e.course_fee_rs ?? (Number(r.course_fee_paise || 0) / 100)} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], course_fee_rs: ev.target.value } }))} style={{ ...inp, width: 90 }} /></td>
                    <td style={td}><input value={e.discount_rs ?? (Number(r.discount_paise || 0) / 100)} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], discount_rs: ev.target.value } }))} style={{ ...inp, width: 80 }} /></td>
                    <td style={td}>₹{fmtRs(r.course_paid_paise)}</td>
                    <td style={{ ...td, fontWeight: 800, color: pending > 0 ? C.acc : C.grn }}>₹{fmtRs(pending)}</td>
                    <td style={td}>
                      <select value={e.status ?? r.status} onChange={(ev) => setEdit((p) => ({ ...p, [r.id]: { ...p[r.id], status: ev.target.value } }))} style={inp}>
                        {['sgr_pending', 'sgr_paid', 'enrolled', 'fee_due', 'completed', 'dropped'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input value={payAmt[r.id] || ''} onChange={(ev) => setPayAmt((p) => ({ ...p, [r.id]: ev.target.value }))} placeholder="₹ partial" style={{ ...inp, width: 72 }} />
                        <button type="button" onClick={() => recordPay(r.id)} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 700 }}>+Pay</button>
                        <button type="button" onClick={() => save(r.id)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Save</button>
                        <button type="button" onClick={() => remind(r.id, 'sms')} disabled={pending <= 0} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>SMS</button>
                        <button type="button" onClick={() => remind(r.id, 'call')} disabled={pending <= 0} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>Call</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={12} style={{ ...td, textAlign: 'center', color: C.dim, padding: 24 }}>No student admissions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
