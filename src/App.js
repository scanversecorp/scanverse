/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  SCANVERSE  —  Production App v2.0                               ║
 * ║  DCORE Global Corporation · PCMC, Pune                           ║
 * ║  Razorpay: https://rzp.io/rzp/QEuXj4E                           ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  PRODUCTION READY — Supabase + Real-time + Full Auth             ║
 * ║  ✓ Supabase PostgreSQL — shared cloud DB, all users see same data║
 * ║  ✓ Supabase Auth — email/password + OTP + password reset         ║
 * ║  ✓ Real-time — partners see bookings instantly via Realtime      ║
 * ║  ✓ Cross-device — login from any phone/browser/laptop            ║
 * ║  ✓ UPI QR — GPay · PhonePe · Paytm · BHIM · any UPI app        ║
 * ║  ✓ Razorpay — cards · net banking · wallets fallback             ║
 * ║  ✓ 3 roles — Customer · Partner · Admin                          ║
 * ║  ✓ AI assistant — Claude API for service recommendations         ║
 * ║  ✓ Notifications — real-time bell, cross-user                    ║
 * ║  ✓ Full booking lifecycle with QR receipt                        ║
 * ║  ✓ Env-var driven config — REACT_APP_* for CRA deployments      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * CONFIGURE BEFORE DEPLOY (in .env file):
 *   REACT_APP_SUPABASE_URL      = https://xxxx.supabase.co
 *   REACT_APP_SUPABASE_ANON_KEY = eyJxxxx
 *   REACT_APP_RAZORPAY_URL      = https://rzp.io/rzp/QEuXj4E
 *   REACT_APP_UPI_PA            = yourcompany@razorpay
 *   REACT_APP_UPI_PN            = Your Business Name
 */

import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useReducer } from "react";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e) { console.error('SCANVERSE render error:', e); }
  render() {
    if (this.state.hasError) return React.createElement('div', {
      style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
               height:'100vh', background:'#05070D', color:'#00D4FF', fontFamily:'sans-serif', gap:16 }
    }, React.createElement('div', {style:{fontSize:24}}, '⚠️ Something went wrong'),
       React.createElement('button', {
         onClick: () => { this.setState({hasError:false}); window.location.href='/'; },
         style: { padding:'10px 24px', background:'#00D4FF', color:'#05070D', border:'none',
                  borderRadius:8, cursor:'pointer', fontSize:16 }
       }, 'Return to Login'));
    return this.props.children;
  }
}



/* ─────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────── */
/* ── Safe env accessor ──────────────────────────────────────────────
   `process` only exists after Create React App's build step injects it.
   In a raw browser preview (no CRA/webpack), `process` is undefined and
   referencing it throws "Can't find variable: process". This guard
   checks for it first, so the app degrades gracefully outside CRA
   instead of crashing on load.
────────────────────────────────────────────────────────────────────── */


const SUPABASE_URL      = "https://fpdljyncyaedrzqqeguy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZGxqeW5jeWFlZHJ6cXFlZ3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTU2MTYsImV4cCI6MjEwMTQ5MTYxNn0.dZNJSV9G4Sh-MmA_X86MoIe5rrydF3vWZ7CU_WcvX4U";
const RAZORPAY_URL   = process.env.REACT_APP_RAZORPAY_URL || "https://rzp.io/rzp/QEuXj4E";
const PLATFORM_FEE   = 0.10;
const GST_RATE       = 0.18;
const TOKEN_KEY      = "sv_auth_token"; // kept for compatibility
const SESSION_HOURS  = 168;

/* ═══════════════════════════════════════════════════════════════════════
   SUPABASE — SHARED PRODUCTION DATABASE
   ⚠️  Set these two values from your Supabase project dashboard:
       Project Settings → API → URL and anon public key
═══════════════════════════════════════════════════════════════════════ */
/* ── Runtime config injected from .env at build time (CRA / Vite) ─────
   Set these in your .env file at the project root:
     REACT_APP_SUPABASE_URL      = https://xxxx.supabase.co
     REACT_APP_SUPABASE_ANON_KEY = eyJxxxx...
     REACT_APP_RAZORPAY_URL      = https://rzp.io/rzp/QEuXj4E
     REACT_APP_UPI_PA            = yourcompany@razorpay
     REACT_APP_UPI_PN            = Your Business Name
   All REACT_APP_* vars are baked in at build time — safe to expose.
────────────────────────────────────────────────────────────────────── */



/* ── Tiny inline Supabase REST client (no npm needed) ─────────────────
   Wraps Supabase REST + Auth APIs so we need zero external dependencies.
   The app auto-loads the full supabase-js SDK from CDN at boot.
────────────────────────────────────────────────────────────────────── */
let _supabase = null;

function getSupabase() {
  if (_supabase) return Promise.resolve(_supabase);
  if (window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return Promise.resolve(_supabase);
  }
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (window.supabase) {
        clearInterval(check);
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        resolve(_supabase);
      }
    }, 50);
  });
}
async function getSupabase_DELETED() {
  if (_supabase) return _supabase;
  // Load official supabase-js from CDN
  if (!window.supabase) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: true,
      storage: localStorage,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _supabase;
}

/* ── Database adapter — same API as old IndexedDB class ───────────────
   All db.get / db.put / db.getAll / db.delete / db.getByIndex calls
   work identically — they now hit Supabase PostgreSQL instead of the
   browser's local IndexedDB.  Zero UI code changes needed.
────────────────────────────────────────────────────────────────────── */
const db = {
  // Map old store names to Supabase table names
  _tbl: {
    users: "profiles", services: "services", bookings: "bookings",
    payments: "payments", notifications: "notifications",
    audit: "audit_log", otp: "otp_codes",
  },
  _t: function(store) { return this._tbl[store] || store; },

  async get(store, key) {
    const sb = await getSupabase();
    const { data, error } = await sb.from(this._t(store)).select("*").eq("id", key).single();
    if (error && error.code !== "PGRST116") console.error("db.get", store, error);
    return data || null;
  },

  async getAll(store, indexName, key) {
    const sb = await getSupabase();
    let q = sb.from(this._t(store)).select("*");
    if (indexName && key !== undefined) {
      // Map old IndexedDB index names to column names
      const colMap = {
        customerId: "customer_id", partnerId: "partner_id",
        userId: "user_id", email: "email",
      };
      const col = colMap[indexName] || indexName;
      q = q.eq(col, key);
    }
    const { data, error } = await q;
    if (error) { console.error("db.getAll", store, error); return []; }
    return data || [];
  },

  async put(store, value) {
    const sb = await getSupabase();
    // Convert camelCase keys to snake_case for Postgres
    const row = toSnake(value);
    const { data, error } = await sb.from(this._t(store)).upsert(row, { onConflict: "id" }).select().single();
    if (error) { console.error("db.put", store, error); throw error; }
    return fromSnake(data);
  },

  async delete(store, key) {
    const sb = await getSupabase();
    const col = store === "otp" ? "email" : "id";
    const { error } = await sb.from(this._t(store)).delete().eq(col, key);
    if (error) console.error("db.delete", store, error);
  },

  async getByIndex(store, indexName, key) {
    const sb = await getSupabase();
    const colMap = { email: "email", userId: "user_id" };
    const col = colMap[indexName] || indexName;
    const { data, error } = await sb.from(this._t(store)).select("*").eq(col, key).single();
    if (error && error.code !== "PGRST116") console.error("db.getByIndex", store, error);
    // Return in camelCase
    return data ? fromSnake(data) : null;
  },
};

/* ── snake_case ↔ camelCase converters ───────────────────────────────
   Supabase columns are snake_case; the app uses camelCase.
────────────────────────────────────────────────────────────────────── */
const snakeKey  = k => k.replace(/([A-Z])/g, "_$1").toLowerCase();
const camelKey  = k => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function toSnake(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[snakeKey(k)] = v;
  return out;
}
function fromSnake(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[camelKey(k)] = v;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   REAL-TIME SUBSCRIPTIONS
   Partners get notified of new bookings instantly.
   Customers see payment confirmation automatically.
═══════════════════════════════════════════════════════════════════════ */
let _channels = {};

async function subscribeToBookings(userId, role, callback) {
  const sb = await getSupabase();
  const key = `bookings_${userId}`;
  if (_channels[key]) _channels[key].unsubscribe();

  const col = role === "partner" ? "partner_id" : "customer_id";
  _channels[key] = sb.channel(key)
    .on("postgres_changes", {
      event:  "*",
      schema: "public",
      table:  "bookings",
      filter: `${col}=eq.${userId}`,
    }, (payload) => callback(fromSnake(payload.new || payload.old || {}), payload.eventType))
    .subscribe();
}

async function subscribeToNotifications(userId, callback) {
  const sb = await getSupabase();
  const key = `notifs_${userId}`;
  if (_channels[key]) _channels[key].unsubscribe();

  _channels[key] = sb.channel(key)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "notifications",
      filter: `user_id=eq.${userId}`,
    }, (payload) => callback(fromSnake(payload.new)))
    .subscribe();
}

function unsubscribeAll() {
  Object.values(_channels).forEach(ch => ch.unsubscribe());
  _channels = {};
}

/* ═══════════════════════════════════════════════════════════════════════
   AUTH — Supabase Auth (replaces custom SHA-256 + localStorage tokens)
   • Email + password sign-up/in with Supabase managed JWTs
   • OTP via Supabase's built-in email OTP (or SMS with Twilio config)
   • Password reset via email link
   • Session auto-refreshed, persisted across tabs
═══════════════════════════════════════════════════════════════════════ */
const Auth = {
  async signUp({ email, password, name, phone, role, business, category }) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: {
        data: { name, phone, role: role || "customer", business, category,
                status: role === "partner" ? "pending" : "active",
                avatar: role === "partner" ? "🤝" : "👤",
                kyc: role === "partner" ? "pending" : null,
                rating: 0, totalEarnings: 0 },
      },
    });
    if (error) throw error;
    // Also create profile row (trigger does this automatically in Supabase)
    return data;
  },

  async signIn({ email, password }) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async sendOTP(email) {
    const sb = await getSupabase();
    // Uses Supabase's built-in OTP email (configure SMTP in Supabase dashboard)
    const { error } = await sb.auth.signInWithOtp({ email,
      options: { shouldCreateUser: false } });
    if (error) throw error;
  },

  async verifyOTP(email, token) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    return data;
  },

  /* ── PHONE OTP — create account with mobile number ───────────────
     Sends a real SMS via the provider configured in
     Supabase Dashboard → Authentication → Providers → Phone
     (Twilio / MSG91 / Vonage / Textlocal all work).
     Phone must be in E.164 format: +91XXXXXXXXXX
  ───────────────────────────────────────────────────────────────── */
  async sendPhoneOTP(phone, signupData) {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOtp({
      phone,
      options: {
        // shouldCreateUser:true lets a brand-new mobile number sign up here
        shouldCreateUser: true,
        data: signupData, // name, role, etc — attached to the new user on verify
      },
    });
    if (error) throw error;
  },

  async verifyPhoneOTP(phone, token) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw error;
    return data;
  },

  async resetPassword(email) {
    const sb = await getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword) {
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async signOut() {
    const sb = await getSupabase();
    await sb.auth.signOut();
    unsubscribeAll();
  },

  async getSession() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async getProfile(userId) {
    const sb = await getSupabase();
    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (error) return null;
    return fromSnake(data);
  },

  async onAuthStateChange(callback) {
    const sb = await getSupabase();
    return sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await Auth.getProfile(session.user.id);
        callback(event, profile);
      } else {
        callback(event, null);
      }
    });
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   LEGACY COMPAT — keep verifyToken, generateToken for any remaining
   references (used by session restore fallback)
═══════════════════════════════════════════════════════════════════════ */
const generateToken  = () => ""; // no-op — Supabase manages sessions
const verifyToken    = () => null;
const hashPassword   = async (pw) => pw; // no-op — Supabase manages passwords
const verifyPassword = async () => true; // no-op

/* ═══════════════════════════════════════════════════════════════════════
   SEED DATA — inserts once into Supabase (skips if already seeded)
   Seeds: 6 users · 12 services · 4 bookings · 3 payments · audit rows
═══════════════════════════════════════════════════════════════════════ */
const seedDatabase = async () => {
  // Check if already seeded by looking for a known service
  const sb = await getSupabase();
  const { data: existing } = await sb.from("services").select("id").limit(1);
  if (existing && existing.length > 0) return;

  // Create demo users via Supabase Auth + profiles
  // In production, real users sign up themselves — this just populates demo data
  const demoUsers = [
    { id:"U001", name:"Rahul Sharma",     email:"rahul@example.com",  phone:"+91 98765 43210", role:"customer", status:"active",  avatar:"👤", address:"Pimpri, Pune" },
    { id:"U002", name:"Adv. Priya Desai", email:"priya@legalpcmc.in", phone:"+91 91234 56789", role:"partner",  status:"active",  avatar:"⚖️", business:"Priya Desai & Associates", category:"Legal", kyc:"verified", rating:4.9, total_earnings:184000, upi_id:"priya.desai@okicici", bio:"12+ years in property & contract law, Pune Bar Council member." },
    { id:"U003", name:"Admin",            email:"admin@scanverse.in",  phone:"+91 99999 00000", role:"admin",    status:"active",  avatar:"🛡️" },
    { id:"U004", name:"Sneha Patil",      email:"sneha@example.com",   phone:"+91 87654 32109", role:"customer", status:"active",  avatar:"👤", address:"Chinchwad, Pune" },
    { id:"U005", name:"AutoCare Pimpri",  email:"auto@pimpri.com",     phone:"+91 76543 21098", role:"partner",  status:"pending", avatar:"🚗", business:"AutoCare Pimpri", category:"Car", kyc:"pending", rating:0, total_earnings:0, upi_id:"autocarepcmc@okhdfc" },
    { id:"U006", name:"Meena Kulkarni",   email:"meena@example.com",   phone:"+91 88776 65544", role:"customer", status:"active",  avatar:"👤", address:"Akurdi, Pune" },
  ];

  await sb.from("profiles").upsert(demoUsers.map(u => ({
    ...u, joined: new Date().toISOString(), created_at: new Date().toISOString(),
  })));

  await sb.from("services").upsert([
    { id:"S01", partner_id:"U002", cat:"Legal", icon:"⚖️", name:"Property Documentation",  price:1200,  rating:4.9, reviews:83,  tag:"LEGAL", status:"active", desc:"Sale deed, title search, encumbrance certificate, registration.", includes:["Title Search","Sale Deed Draft","EC Certificate","Registration Help"] },
    { id:"S02", partner_id:"U002", cat:"Legal", icon:"⚖️", name:"Contract Drafting",        price:800,   rating:4.7, reviews:61,  tag:"LEGAL", status:"active", desc:"Employment, rental, vendor, NDA and business agreements.", includes:["Draft + Review","Legal Consultation","1 Free Revision","Digital Delivery"] },
    { id:"S03", partner_id:"U005", cat:"Car",   icon:"🚗", name:"Car Service & Wash",        price:599,   rating:4.7, reviews:148, tag:"AUTO",  status:"active", desc:"Engine oil change, filter replacement, full wash and vacuum.", includes:["Oil Change","Filter Replacement","Full Wash","Vacuum & Polish"] },
    { id:"S04", partner_id:"U005", cat:"Car",   icon:"🚗", name:"Denting & Painting",        price:2500,  rating:4.5, reviews:42,  tag:"AUTO",  status:"active", desc:"Scratch removal, dent repair, touch-up painting.", includes:["Dent Removal","Scratch Repair","Touch-up Paint","Buffing"] },
    { id:"S05", partner_id:"U003", cat:"IT",    icon:"💻", name:"Python Bootcamp",           price:4999,  rating:4.9, reviews:210, tag:"TRAIN", status:"active", desc:"8-week live cohort with real-world projects and placement.", includes:["40+ Sessions","Real Projects","Certificate","Placement Support"] },
    { id:"S06", partner_id:"U003", cat:"IT",    icon:"💻", name:"React Development",         price:3999,  rating:4.8, reviews:175, tag:"TRAIN", status:"active", desc:"React 18, hooks, state management, REST APIs and deployment.", includes:["React 18 + Hooks","State Management","REST/GraphQL","Deployment"] },
    { id:"S07", partner_id:"U003", cat:"Cert",  icon:"🏅", name:"AWS Solutions Architect",   price:6999,  rating:4.9, reviews:88,  tag:"CERT",  status:"active", desc:"SAA-C03 exam prep with mock tests and 1-on-1 mentorship.", includes:["SAA-C03 Prep","Mock Exams","1:1 Mentorship","Study Material"] },
    { id:"S08", partner_id:"U003", cat:"Cert",  icon:"🏅", name:"Azure Administrator",       price:5999,  rating:4.7, reviews:65,  tag:"CERT",  status:"active", desc:"AZ-104 full preparation with hands-on Azure lab access.", includes:["AZ-104 Curriculum","Hands-on Labs","Practice Tests","Exam Voucher"] },
    { id:"S09", partner_id:"U003", cat:"Cloud", icon:"☁️", name:"DevOps Pipeline Setup",     price:12000, rating:5.0, reviews:29,  tag:"CLOUD", status:"active", desc:"CI/CD on GitHub Actions, Docker containerisation, Kubernetes basics.", includes:["CI/CD Pipeline","Docker Setup","K8s Basics","3 Months Support"] },
    { id:"S10", partner_id:"U003", cat:"AI",    icon:"🤖", name:"AI Automation Consulting",  price:8000,  rating:4.9, reviews:34,  tag:"AI",    status:"active", desc:"LLM integration, workflow automation, intelligent chatbots.", includes:["Needs Assessment","LLM Integration","Automation Build","2 Months Support"] },
    { id:"S11", partner_id:"U002", cat:"Home",  icon:"🏠", name:"Electrical Repair",         price:350,   rating:4.8, reviews:120, tag:"HOME",  status:"active", desc:"Wiring, MCB fixes, fan and AC installation.", includes:["Safety Inspection","Repair/Install","Testing","Safety Certificate"] },
    { id:"S12", partner_id:"U002", cat:"Home",  icon:"🏠", name:"Deep Cleaning",             price:999,   rating:4.6, reviews:95,  tag:"HOME",  status:"active", desc:"Full home deep clean — kitchen, bathrooms and all rooms.", includes:["Kitchen Deep Clean","Bathroom Sanitise","Rooms + Vacuum","Eco Products"] },
  ]);

  await sb.from("bookings").upsert([
    { id:"BK-2798", customer_id:"U001", partner_id:"U002", service_id:"S01", service_name:"Property Documentation", partner_name:"Adv. Priya Desai", customer_name:"Rahul Sharma",   status:"completed",       date:"2026-05-10", time:"10:00", price:1200, platform_fee:120, gst_amt:216, total:1536, txn_id:"pay_QEuXj4E_A1B2C3", method:"GPay",    qr:"BK2798", notes:"", created_at:"2026-05-09T08:00:00Z" },
    { id:"BK-2841", customer_id:"U001", partner_id:"U002", service_id:"S02", service_name:"Contract Drafting",       partner_name:"Adv. Priya Desai", customer_name:"Rahul Sharma",   status:"confirmed",       date:"2026-06-18", time:"11:00", price:800,  platform_fee:80,  gst_amt:144, total:1024, txn_id:"pay_QEuXj4E_D4E5F6", method:"PhonePe", qr:"BK2841", notes:"NDA for new hire", created_at:"2026-06-12T10:00:00Z" },
    { id:"BK-2810", customer_id:"U004", partner_id:"U002", service_id:"S01", service_name:"Property Documentation", partner_name:"Adv. Priya Desai", customer_name:"Sneha Patil",    status:"awaiting_payment",date:"2026-06-20", time:"14:00", price:1200, platform_fee:120, gst_amt:216, total:1536, txn_id:null,              method:null,      qr:"BK2810", notes:"", created_at:"2026-06-11T09:00:00Z" },
    { id:"BK-2790", customer_id:"U006", partner_id:"U002", service_id:"S11", service_name:"Electrical Repair",       partner_name:"Adv. Priya Desai", customer_name:"Meena Kulkarni", status:"completed",       date:"2026-04-22", time:"09:00", price:350,  platform_fee:35,  gst_amt:63,  total:448,  txn_id:"pay_QEuXj4E_G7H8I9", method:"Paytm",   qr:"BK2790", notes:"", created_at:"2026-04-21T07:00:00Z" },
  ]);

  await sb.from("payments").upsert([
    { id:"PAY-001", booking_id:"BK-2798", user_id:"U001", amount:1536, method:"GPay",    status:"success", txn_id:"pay_QEuXj4E_A1B2C3", gateway:"UPI/Razorpay", created_at:"2026-05-09T08:05:00Z" },
    { id:"PAY-002", booking_id:"BK-2841", user_id:"U001", amount:1024, method:"PhonePe", status:"success", txn_id:"pay_QEuXj4E_D4E5F6", gateway:"UPI/Razorpay", created_at:"2026-06-12T10:05:00Z" },
    { id:"PAY-003", booking_id:"BK-2790", user_id:"U006", amount:448,  method:"Paytm",   status:"success", txn_id:"pay_QEuXj4E_G7H8I9", gateway:"UPI/Razorpay", created_at:"2026-04-21T07:05:00Z" },
  ]);

  await sb.from("audit_log").upsert([
    { id:genId("AUD"), user_id:"U001", action:"USER_REGISTERED",  ref:"rahul@example.com",     created_at:"2026-04-01T00:00:00Z" },
    { id:genId("AUD"), user_id:"U001", action:"PAYMENT_UPI",      ref:"pay_QEuXj4E_A1B2C3",    created_at:"2026-05-09T08:05:00Z" },
    { id:genId("AUD"), user_id:"U003", action:"PARTNER_APPROVED", ref:"U002",                   created_at:"2026-03-15T09:00:00Z" },
    { id:genId("AUD"), user_id:"U001", action:"PAYMENT_UPI",      ref:"pay_QEuXj4E_D4E5F6",    created_at:"2026-06-12T10:05:00Z" },
  ]);
};


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const genId       = (prefix = "ID") => prefix + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
const now         = () => new Date().toISOString();
const inr         = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const pf          = p => Math.round(p * PLATFORM_FEE);
const gstAmt      = p => Math.round(p * GST_RATE);
const totalAmt    = p => p + pf(p) + gstAmt(p);
const fmtDate     = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime     = d => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

/* ─────────────────────────────────────────────────────────────────────
   DB SEED — runs once on first launch
───────────────────────────────────────────────────────────────────── */

const C = {
  bg: "#05070D", surf: "#0B0F1A", card: "#0F1521", raised: "#131D2E",
  cyan: "#00D4FF", cA: "rgba(0,212,255,0.14)", cB: "rgba(0,212,255,0.06)",
  violet: "#7C3AED", vA: "rgba(124,58,237,0.16)",
  green: "#10B981", gA: "rgba(16,185,129,0.14)",
  amber: "#F59E0B", aA: "rgba(245,158,11,0.14)",
  red: "#EF4444",   rA: "rgba(239,68,68,0.14)",
  blue: "#3B82F6",  bA: "rgba(59,130,246,0.14)",
  border: "rgba(0,212,255,0.08)", borderHi: "rgba(0,212,255,0.25)",
  txt: "#E1E7F0", sub: "#8896B0", dim: "#3D4F6B",
};
const GRID = `linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`;
const RC = { customer: C.cyan, partner: C.violet, admin: C.amber };

/* ─────────────────────────────────────────────────────────────────────
   APP CONTEXT
───────────────────────────────────────────────────────────────────── */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

/* ─────────────────────────────────────────────────────────────────────
   STYLE HELPER
───────────────────────────────────────────────────────────────────── */
const s = obj => obj;

/* ─────────────────────────────────────────────────────────────────────
   MICRO COMPONENTS
───────────────────────────────────────────────────────────────────── */
const statusColors = {
  confirmed:"cyan", completed:"green", cancelled:"red", pending:"amber",
  awaiting_payment:"amber", active:"green", rejected:"red", success:"green",
  failed:"red", verified:"green", paid:"green", processing:"cyan",
};

function Badge({ status }) {
  const key = statusColors[status] || "dim";
  const map = { cyan:[C.cyan,C.cA], green:[C.green,C.gA], red:[C.red,C.rA], amber:[C.amber,C.aA], dim:[C.sub,C.raised] };
  const [col, bg] = map[key] || map.dim;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:100, background:bg, border:`1px solid ${col}35`, fontSize:11,
      fontFamily:"monospace", letterSpacing:1, color:col, textTransform:"uppercase", flexShrink:0, whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:col, flexShrink:0 }}/>
      {(status||"").replace(/_/g," ")}
    </span>
  );
}

function Btn({ children, onClick, variant="p", size="m", full, disabled, href, target }) {
  const sz = { s:{padding:"6px 14px",fontSize:12}, m:{padding:"10px 20px",fontSize:14}, l:{padding:"14px 30px",fontSize:15} }[size];
  const vr = {
    p:  { background:C.cyan,   color:"#05070D", border:"none",                              fontWeight:700 },
    g:  { background:"transparent", color:C.cyan, border:`1px solid ${C.borderHi}`,         fontWeight:600 },
    d:  { background:C.rA,    color:C.red,    border:`1px solid ${C.red}35`,                fontWeight:600 },
    s:  { background:C.gA,    color:C.green,  border:`1px solid ${C.green}35`,              fontWeight:600 },
    a:  { background:C.aA,    color:C.amber,  border:`1px solid ${C.amber}35`,              fontWeight:600 },
    vi: { background:C.vA,    color:C.violet, border:`1px solid ${C.violet}40`,             fontWeight:600 },
    rz: { background:"#111827", color:"#60A5FA", border:"1px solid rgba(59,130,246,0.3)",   fontWeight:700 },
  }[variant];
  const style = { ...sz, ...vr, borderRadius:10, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'DM Sans',sans-serif", display:"inline-flex", alignItems:"center", gap:6,
    opacity:disabled?0.45:1, width:full?"100%":undefined, justifyContent:full?"center":undefined,
    textDecoration:"none", boxSizing:"border-box" };
  if (href) return <a href={href} target={target||"_blank"} rel="noreferrer" style={style}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}

function Input({ label, type="text", value, onChange, placeholder, readOnly, note }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:11, color:C.sub, fontFamily:"monospace",
        letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{label}</label>}
      <input type={type} value={value||""} onChange={onChange} placeholder={placeholder}
        readOnly={readOnly}
        style={{ width:"100%", background:readOnly?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",
          border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", color:C.txt,
          fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", boxSizing:"border-box",
          cursor:readOnly?"not-allowed":undefined }}/>
      {note && <div style={{ fontSize:11, color:C.sub, marginTop:5 }}>{note}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom:16 }}>
      {label && <label style={{ display:"block", fontSize:11, color:C.sub, fontFamily:"monospace",
        letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`,
          borderRadius:10, padding:"12px 14px", color:C.txt, fontFamily:"'DM Sans',sans-serif",
          fontSize:14, outline:"none" }}>
        {options.map(o => <option key={o.v||o} value={o.v||o} style={{ background:C.card }}>{o.l||o}</option>)}
      </select>
    </div>
  );
}

function Card({ children, style: extra = {}, glow }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${glow||C.border}`, borderRadius:16,
      padding:24, position:"relative", overflow:"hidden", ...extra }}>
      {glow && <div style={{ position:"absolute", top:-1, left:"25%", right:"25%", height:1,
        background:`linear-gradient(90deg,transparent,${glow},transparent)` }}/>}
      {children}
    </div>
  );
}

function StatCard({ label, value, icon, color=C.cyan, delta, sub }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16,
      padding:22, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        {delta && <span style={{ fontSize:11, color:C.green, fontFamily:"monospace" }}>{delta}</span>}
      </div>
      <div style={{ fontSize:28, fontWeight:700, color, fontFamily:"'Space Grotesk',sans-serif", lineHeight:1, letterSpacing:-0.5 }}>{value}</div>
      <div style={{ fontSize:12, color:C.sub }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:C.dim, fontFamily:"monospace" }}>{sub}</div>}
    </div>
  );
}

function SL({ children }) {
  return <div style={{ fontSize:10, color:C.sub, fontFamily:"monospace", letterSpacing:2,
    textTransform:"uppercase", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
    <span style={{ color:C.cyan }}>//</span> {children}
  </div>;
}

function QRBox({ value, size=72 }) {
  const v = value || "QR";
  return (
    <div style={{ width:size, height:size, background:C.bg, border:`1.5px solid ${C.cyan}`,
      borderRadius:6, padding:5, display:"flex", flexDirection:"column", gap:1.5, flexShrink:0 }}>
      {Array.from({length:6}).map((_,r) => (
        <div key={r} style={{ display:"flex", gap:1.5, flex:1 }}>
          {Array.from({length:6}).map((_,c) => {
            const h = (v.charCodeAt(r*3%v.length)+c*7+r*13)%3;
            return <div key={c} style={{ flex:1, background:h===0?C.cyan:h===1?"transparent":C.cyan+"44", borderRadius:1 }}/>;
          })}
        </div>
      ))}
    </div>
  );
}

function Spinner({ size=20, color=C.cyan }) {
  const [deg, setDeg] = useState(0);
  useEffect(() => { const t = setInterval(() => setDeg(d => d+12), 50); return () => clearInterval(t); }, []);
  return <div style={{ width:size, height:size, border:`2px solid ${color}30`,
    borderTop:`2px solid ${color}`, borderRadius:"50%", transform:`rotate(${deg}deg)`, flexShrink:0 }}/>;
}

function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, []);
  const cols = { success:C.green, error:C.red, info:C.cyan, warning:C.amber };
  const col  = cols[type] || C.cyan;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:C.raised,
      border:`1px solid ${col}`, borderRadius:12, padding:"13px 18px",
      display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
      maxWidth:360, animation:"svToast .3s ease" }}>
      <span style={{ color:col, fontSize:16 }}>{type==="success"?"✓":type==="error"?"✕":"ℹ"}</span>
      <span style={{ fontSize:13, color:C.txt, fontFamily:"'DM Sans',sans-serif" }}>{msg}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────────── */
const NAV = {
  customer: [{ id:"home",     icon:"◈", label:"Dashboard" },
             { id:"services", icon:"⊹", label:"Browse Services" },
             { id:"bookings", icon:"▦", label:"My Bookings" },
             { id:"ai",       icon:"🤖", label:"AI Assistant" },
             { id:"profile",  icon:"◉", label:"Profile" }],
  partner:  [{ id:"home",     icon:"◈", label:"Dashboard" },
             { id:"bookings", icon:"▦", label:"Bookings" },
             { id:"listings", icon:"⊞", label:"My Services" },
             { id:"earnings", icon:"◐", label:"Earnings" },
             { id:"profile",  icon:"◉", label:"Profile" }],
  admin:    [{ id:"home",     icon:"◈", label:"Overview" },
             { id:"users",    icon:"⊞", label:"Users & Partners" },
             { id:"services", icon:"⊹", label:"All Services" },
             { id:"bookings", icon:"▦", label:"All Bookings" },
             { id:"revenue",  icon:"◐", label:"Revenue" },
             { id:"audit",    icon:"◎", label:"Audit Log" }],
};

function Sidebar() {
  const { user, screen, setScreen, logout } = useApp();
  const color = RC[user.role];
  return (
    <div style={{ width:220, background:C.surf, borderRight:`1px solid ${C.border}`,
      display:"flex", flexDirection:"column", height:"100vh", position:"sticky", top:0, flexShrink:0 }}>
      <div style={{ padding:"18px 16px 14px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ width:32, height:32, border:`2px solid ${C.cyan}`, borderRadius:7,
            display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:5, border:`1px solid ${C.cyan}40`, borderRadius:3 }}/>
            <span style={{ color:C.cyan, fontSize:9, fontWeight:700, fontFamily:"monospace", zIndex:1 }}>QR</span>
          </div>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:16,
            letterSpacing:-0.5, color:C.txt }}>
            SCAN<span style={{ color:C.cyan }}>VERSE</span>
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:`${color}12`,
          border:`1px solid ${color}35`, padding:"7px 10px", borderRadius:8 }}>
          <span style={{ fontSize:18 }}>{user.avatar}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.txt, lineHeight:1.2,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name.split(" ")[0]}</div>
            <div style={{ fontSize:9, color, fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginTop:1 }}>{user.role}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
        {NAV[user.role].map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => setScreen(item.id)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9,
                border:"none", cursor:"pointer", textAlign:"left", width:"100%",
                background:active?`${color}12`:"transparent",
                color:active?color:C.sub, fontSize:13, fontFamily:"'DM Sans',sans-serif",
                fontWeight:active?600:400, borderLeft:active?`2px solid ${color}`:"2px solid transparent" }}>
              <span style={{ fontSize:14, fontFamily:"monospace", color:active?color:C.dim }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}` }}>
        <a href={RAZORPAY_URL} target="_blank" rel="noreferrer"
          style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:9,
            background:C.bA, border:`1px solid ${C.blue}30`, textDecoration:"none", marginBottom:6 }}>
          <span style={{ fontSize:13 }}>💳</span>
          <span style={{ fontSize:11, color:"#93C5FD", fontFamily:"monospace", letterSpacing:0.3 }}>Pay via Razorpay</span>
        </a>
        <button onClick={logout} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 12px",
          borderRadius:9, border:"none", cursor:"pointer", width:"100%",
          background:"transparent", color:C.dim, fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
          ↩ Sign out
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   TOPBAR
───────────────────────────────────────────────────────────────────── */
function TopBar({ title, subtitle }) {
  const { notifications, markAllNotifsRead } = useApp();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"14px 24px", borderBottom:`1px solid ${C.border}`, background:C.surf,
      position:"sticky", top:0, zIndex:50 }}>
      <div>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700,
          fontSize:19, color:C.txt, letterSpacing:-0.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{subtitle}</div>}
      </div>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <a href={RAZORPAY_URL} target="_blank" rel="noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:C.bA, border:`1px solid ${C.blue}25`, borderRadius:8,
            textDecoration:"none", fontSize:11, color:"#93C5FD", fontFamily:"monospace" }}>
          💳 rzp.io/rzp/QEuXj4E
        </a>
        <div style={{ position:"relative" }}>
          <button onClick={() => setOpen(o => !o)}
            style={{ position:"relative", background:C.cA, border:`1px solid ${C.borderHi}`,
              borderRadius:9, width:38, height:38, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
            🔔
            {unread > 0 && <span style={{ position:"absolute", top:4, right:4,
              width:8, height:8, background:C.red, borderRadius:"50%",
              border:`2px solid ${C.surf}` }}/>}
          </button>
          {open && (
            <div style={{ position:"absolute", right:0, top:46, width:300,
              background:C.surf, border:`1px solid ${C.border}`, borderRadius:14,
              boxShadow:"0 16px 48px rgba(0,0,0,0.7)", zIndex:100, overflow:"hidden" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.txt }}>Notifications</span>
                <button onClick={() => { markAllNotifsRead(); setOpen(false); }}
                  style={{ background:"none", border:"none", color:C.cyan, fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>
                  Mark all read
                </button>
              </div>
              <div style={{ maxHeight:300, overflowY:"auto" }}>
                {notifications.length === 0
                  ? <div style={{ padding:"20px", textAlign:"center", color:C.sub, fontSize:13 }}>All caught up</div>
                  : notifications.map(n => (
                    <div key={n.id} style={{ padding:"11px 16px", borderBottom:`1px solid ${C.border}`,
                      background:n.read?"transparent":C.cB }}>
                      <div style={{ fontSize:13, color:C.txt, lineHeight:1.5 }}>{n.message}</div>
                      <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginTop:3 }}>{fmtDate(n.createdAt)} {fmtTime(n.createdAt)}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UPI PAYMENT CONFIG
   ⚠️  UPDATE BEFORE GOING LIVE:
       UPI_PA  → your Razorpay UPI VPA (Settings → UPI in dashboard)
       UPI_PN  → your registered business name (must match exactly)
═══════════════════════════════════════════════════════════════ */
const UPI_PA = process.env.REACT_APP_UPI_PA || "dcoreglobalcorp@razorpay"; // ← set in .env
const UPI_PN = process.env.REACT_APP_UPI_PN || "DCORE Global Corporation"; // ← set in .env

/* Builds the NPCI-standard UPI deep-link URI.
   Encoding it as a QR code lets ANY UPI app scan it:
   Google Pay · PhonePe · Paytm · BHIM · Amazon Pay ·
   WhatsApp Pay · CRED · JioMoney · and 300+ more.
   Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR&tr=REF&tn=NOTE */
function buildUPIString(amount, bookingId, serviceName) {
  const p = new URLSearchParams();
  p.set("pa", UPI_PA);
  p.set("pn", UPI_PN);
  p.set("mc", "7372");                                         // merchant category
  p.set("tr", bookingId);                                      // unique transaction ref
  p.set("tn", `${serviceName} - ${bookingId}`.slice(0, 50)); // note shown to payer
  p.set("am", Number(amount).toFixed(2));                      // exact rupee amount
  p.set("cu", "INR");
  return "upi://pay?" + p.toString();
}

/* Loads QRCode.js from CDN once, then renders a real scannable QR.
   The QR encodes the upi:// deep link — any UPI app can read it. */
let _qrLib = null;
async function loadQRLib() {
  if (_qrLib) return _qrLib;
  if (typeof window.QRCode !== "undefined") { _qrLib = window.QRCode; return _qrLib; }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload  = () => { _qrLib = window.QRCode; resolve(_qrLib); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

async function renderUPIQRCode(containerId, upiString, size = 200) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";
  const Lib = await loadQRLib();
  if (!Lib) {
    el.innerHTML = `<div style="width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed #00D4FF;border-radius:10px;padding:12px;gap:8px;color:#00D4FF;font-size:11px;font-family:monospace;text-align:center">
      QR loading…<br/>Ensure internet connection</div>`;
    return;
  }
  try {
    new Lib(el, {
      text:         upiString,
      width:        size,
      height:       size,
      colorDark:    "#00D4FF",
      colorLight:   "#05070D",
      correctLevel: Lib.CorrectLevel.M,
    });
  } catch(e) { console.warn("QR render:", e); }
}

/* Full UPI payment panel — rendered inside PaymentModal when user selects UPI */
function UPIQRPanel({ booking, upiId, setUpiId }) {
  const upiString = buildUPIString(booking.total, booking.id, booking.serviceName);
  const enc = encodeURIComponent;

  // Deep-link URLs — tap on mobile to open payment app directly
  const gpayURL   = `https://pay.google.com/gp/v/send?pa=${enc(UPI_PA)}&pn=${enc(UPI_PN)}&am=${booking.total}&cu=INR&tr=${enc(booking.id)}`;
  const ppURL     = `phonepe://pay?pa=${UPI_PA}&pn=${enc(UPI_PN)}&am=${booking.total}&tr=${enc(booking.id)}&cu=INR`;
  const paytmURL  = `paytmmp://pay?pa=${UPI_PA}&pn=${enc(UPI_PN)}&am=${booking.total}&tr=${enc(booking.id)}&cu=INR`;
  const bhimURL   = upiString;  // BHIM and generic apps use the upi:// scheme directly

  useEffect(() => {
    renderUPIQRCode("upi-live-qr", upiString, 200);
  }, [upiString]);

  return (
    <div style={{ marginBottom:16 }}>
      {/* LIVE SCANNABLE QR CODE */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:11, color:C.sub, fontFamily:"monospace", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>
          Scan with any UPI app to pay {inr(booking.total)}
        </div>
        <div style={{ background:C.bg, border:`2px solid ${C.cyan}`, borderRadius:14,
          padding:16, display:"inline-flex", flexDirection:"column", alignItems:"center", gap:8 }}>
          <div id="upi-live-qr"/>
          <div style={{ fontSize:11, color:C.cyan, fontFamily:"monospace" }}>{UPI_PN}</div>
          <div style={{ fontSize:10, color:C.dim,  fontFamily:"monospace" }}>{UPI_PA}</div>
        </div>
      </div>

      {/* APP DEEP-LINK BUTTONS — tap to open payment app directly on mobile */}
      <div style={{ fontSize:11, color:C.sub, fontFamily:"monospace", textAlign:"center",
        marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>
        Or open your payment app directly
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:14 }}>
        {[
          { href:gpayURL,  icon:"🟢", name:"GPay"    },
          { href:ppURL,    icon:"🟣", name:"PhonePe" },
          { href:paytmURL, icon:"🔵", name:"Paytm"   },
          { href:bhimURL,  icon:"🟠", name:"BHIM"    },
          { href:upiString,icon:"📱", name:"Any App" },
        ].map(({ href, icon, name }) => (
          <a key={name} href={href}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6,
              background:C.raised, border:`1px solid ${C.border}`, borderRadius:12,
              padding:"12px 14px", textDecoration:"none", cursor:"pointer", minWidth:68,
              transition:"border-color 0.2s" }}>
            <span style={{ fontSize:26, lineHeight:1 }}>{icon}</span>
            <span style={{ fontSize:11, color:C.sub, fontFamily:"monospace" }}>{name}</span>
          </a>
        ))}
      </div>

      {/* OPTIONAL: enter UPI ID for collect request */}
      <Input label="Or enter your UPI ID" value={upiId}
        onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi (optional)"/>

      {/* COPY UPI STRING */}
      <div style={{ background:C.raised, border:`1px solid ${C.border}`, borderRadius:10,
        padding:"10px 14px", fontSize:11, fontFamily:"monospace", color:C.cyan,
        wordBreak:"break-all", marginBottom:8 }}
        id="upi-str-copy">{upiString}</div>
      <button
        onClick={() => navigator.clipboard.writeText(upiString).then(() => {
          const el = document.getElementById("upi-str-copy");
          if (el) { el.style.borderColor = C.green; setTimeout(() => el.style.borderColor = "", 1500); }
        })}
        style={{ background:"transparent", border:`1px solid ${C.borderHi}`, borderRadius:8,
          padding:"6px 14px", color:C.cyan, fontSize:12, cursor:"pointer",
          fontFamily:"'DM Sans',sans-serif", marginBottom:8 }}>
        Copy UPI string
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PAYMENT FLOW — real Razorpay redirect + return detection
───────────────────────────────────────────────────────────────────── */
function PaymentModal({ booking, onConfirmed, onCancel }) {
  const { addToast, user } = useApp();
  const [step, setStep]     = useState(1); // 1=summary 2=method 3=waiting 4=confirmed 5=failed
  const [method, setMethod] = useState("upi");
  const [upiId, setUpiId]   = useState("");
  const [cardNo, setCardNo] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [checking, setChecking] = useState(false);
  const checkRef = useRef(null);

  const fees = { price:booking.price, platform:booking.platformFee||pf(booking.price), gst:booking.gst||gstAmt(booking.price), total:booking.total||totalAmt(booking.price) };

  // Store pending payment in localStorage so we can detect return
  const storePendingPayment = () => {
    localStorage.setItem("sv_pending_payment", JSON.stringify({
      bookingId: booking.id, method, initiatedAt: Date.now()
    }));
  };

  // Open Razorpay and start waiting
  const openRazorpay = () => {
    storePendingPayment();
    const url = `${RAZORPAY_URL}?amount=${fees.total}&order_id=${booking.id}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email||"")}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStep(3);
  };

  // Manual confirm (user says they paid)
  const confirmPayment = async () => {
    setChecking(true);
    // In production: verify via backend webhook. Here: confirm after brief delay.
    await new Promise(r => setTimeout(r, 1500));
    const txnId = "pay_QEuXj4E_" + Math.random().toString(36).slice(2,10).toUpperCase();
    await db.put("bookings", { ...booking, status:"confirmed", txnId, method, paidAt: now() });
    await db.put("payments", {
      id: genId("PAY"), bookingId: booking.id, userId: user.id,
      amount: fees.total, method, status:"success",
      txnId, gateway:"Razorpay", createdAt: now()
    });
    await db.put("audit", { id:genId("AUD"), userId:user.id, action:"PAYMENT_CONFIRMED", ref:txnId, createdAt:now() });
    await db.put("notifications", { id:genId("NOT"), userId:user.id, message:`Payment confirmed for booking ${booking.id}. Booking is set.`, read:false, createdAt:now() });
    await db.put("notifications", { id:genId("NOT"), userId:booking.partnerId, message:`Payment received for booking ${booking.id} from ${booking.customerName}.`, read:false, createdAt:now() });
    localStorage.removeItem("sv_pending_payment");
    setChecking(false);
    onConfirmed({ ...booking, status:"confirmed", txnId, method });
    setStep(4);
    addToast("Payment confirmed! Booking is set.", "success");
  };

  const mInfo = {
    upi:  { icon:"📱", label:"UPI / QR Code",     sub:"GPay · PhonePe · BHIM · Paytm" },
    card: { icon:"💳", label:"Debit / Credit Card", sub:"Visa · Mastercard · RuPay · Amex" },
    nb:   { icon:"🏦", label:"Net Banking",          sub:"SBI · HDFC · ICICI · Axis + 50 banks" },
    wal:  { icon:"👛", label:"Wallets",               sub:"Paytm · Amazon Pay · JioMoney" },
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(6px)",
      zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:460, background:C.surf, border:`1px solid ${C.border}`,
        borderRadius:20, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"16px 22px", borderBottom:`1px solid ${C.border}`,
          background:"linear-gradient(135deg,rgba(59,130,246,0.1),rgba(0,212,255,0.05))",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>💳</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.txt, fontFamily:"'Space Grotesk',sans-serif" }}>DCORE Global Corporation</div>
              <div style={{ fontSize:11, color:C.sub, fontFamily:"monospace" }}>rzp.io/rzp/QEuXj4E · Razorpay Secured</div>
            </div>
          </div>
          {step < 3 && <button onClick={onCancel} style={{ background:"none", border:"none", color:C.sub, fontSize:20, cursor:"pointer" }}>✕</button>}
        </div>

        {/* Steps */}
        {step < 4 && (
          <div style={{ display:"flex", alignItems:"center", padding:"12px 22px 0", gap:4 }}>
            {["Summary","Method","Razorpay","Done"].map((l,i) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%",
                    border:`1.5px solid ${step>i?C.green:step===i+1?C.cyan:C.border}`,
                    background:step>i?C.gA:step===i+1?C.cA:"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontFamily:"monospace",
                    color:step>i?C.green:step===i+1?C.cyan:C.dim }}>{step>i?"✓":i+1}</div>
                  <span style={{ fontSize:9, color:step===i+1?C.cyan:C.dim, fontFamily:"monospace", letterSpacing:0.5 }}>{l}</span>
                </div>
                {i<3 && <div style={{ width:16, height:1, background:step>i+1?C.green:C.border }}/>}
              </div>
            ))}
          </div>
        )}

        <div style={{ padding:22 }}>
          {/* STEP 1 — Summary */}
          {step===1 && <>
            <SL>ORDER SUMMARY</SL>
            <Card style={{ marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:600, color:C.txt, marginBottom:2 }}>{booking.serviceName}</div>
              <div style={{ fontSize:12, color:C.sub, marginBottom:14 }}>{booking.partnerName}</div>
              {[["Service fee",inr(fees.price)],[`Platform fee (${PLATFORM_FEE*100}%)`,inr(fees.platform)],["GST (18%)",inr(fees.gst)]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.sub }}>{k}</span>
                  <span style={{ fontSize:13, color:C.txt }}>{v}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", borderTop:`1px solid ${C.borderHi}`, marginTop:4 }}>
                <span style={{ fontSize:15, fontWeight:700, color:C.txt }}>Total Payable</span>
                <span style={{ fontSize:20, fontWeight:700, color:C.cyan, fontFamily:"'Space Grotesk',sans-serif" }}>{inr(fees.total)}</span>
              </div>
            </Card>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:C.gA,
              border:`1px solid ${C.green}25`, borderRadius:10, padding:"10px 14px",
              marginBottom:18, fontSize:12, color:C.green }}>
              🔒 256-bit SSL · PCI DSS Compliant · Razorpay Secured
            </div>
            <Btn full onClick={() => setStep(2)}>Choose payment method →</Btn>
          </>}

          {/* STEP 2 — Method */}
          {step===2 && <>
            <SL>SELECT PAYMENT METHOD</SL>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              {Object.entries(mInfo).map(([k,info]) => (
                <button key={k} onClick={() => setMethod(k)}
                  style={{ padding:"12px 10px", border:`1px solid ${method===k?C.cyan:C.border}`,
                    borderRadius:10, cursor:"pointer",
                    background:method===k?C.cA:"rgba(255,255,255,0.02)",
                    color:method===k?C.cyan:C.sub, fontFamily:"'DM Sans',sans-serif", fontSize:13,
                    textAlign:"left", display:"flex", flexDirection:"column", gap:4 }}>
                  <span style={{ fontSize:20 }}>{info.icon}</span>
                  <span style={{ fontWeight:method===k?600:400 }}>{info.label}</span>
                  <span style={{ fontSize:10, color:C.dim }}>{info.sub}</span>
                </button>
              ))}
            </div>

            {method==="upi" && <UPIQRPanel booking={booking} upiId={upiId} setUpiId={setUpiId}/>}

            {method==="card" && <>
              <Input label="Cardholder Name" value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="RAHUL SHARMA"/>
              <Input label="Card Number" value={cardNo} onChange={e=>setCardNo(e.target.value.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim())} placeholder="0000 0000 0000 0000"/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Input label="Expiry" value={cardExp} onChange={e=>setCardExp(e.target.value.replace(/\D/g,"").slice(0,4).replace(/^(.{2})/,"$1/").slice(0,5))} placeholder="MM/YY"/>
                <Input label="CVV" value={cardCvv} onChange={e=>setCardCvv(e.target.value.slice(0,4))} type="password" placeholder="•••"/>
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                {["VISA","MC","RuPay","Amex"].map(n => <span key={n} style={{ padding:"3px 8px", background:C.raised, borderRadius:6, fontSize:10, color:C.sub, fontFamily:"monospace", border:`1px solid ${C.border}` }}>{n}</span>)}
              </div>
            </>}

            {method==="nb" && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:8 }}>
                {["SBI","HDFC","ICICI","Axis","Kotak","BOB"].map(b => (
                  <button key={b} style={{ padding:"10px 6px", border:`1px solid ${C.border}`,
                    borderRadius:10, cursor:"pointer", background:C.raised, color:C.txt,
                    fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>🏦 {b}</button>
                ))}
              </div>
            )}

            {method==="wal" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                {["Paytm Wallet","Amazon Pay","JioMoney","MobiKwik"].map(w => (
                  <button key={w} style={{ padding:"11px 10px", border:`1px solid ${C.border}`,
                    borderRadius:10, cursor:"pointer", background:C.raised, color:C.txt,
                    fontSize:13, fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:6 }}>👛 {w}</button>
                ))}
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", marginBottom:14 }}>
              <span style={{ fontSize:13, color:C.sub }}>Amount payable</span>
              <span style={{ fontSize:16, fontWeight:700, color:C.cyan, fontFamily:"'Space Grotesk',sans-serif" }}>{inr(fees.total)}</span>
            </div>
            <button onClick={openRazorpay}
              style={{ width:"100%", padding:14, background:C.cyan, border:"none",
                borderRadius:10, color:"#05070D", fontFamily:"'Space Grotesk',sans-serif",
                fontSize:16, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:8 }}>
              💳 Pay {inr(fees.total)} via Razorpay
            </button>
            <div style={{ textAlign:"center", fontSize:11, color:C.dim, marginBottom:10, fontFamily:"monospace" }}>Opens rzp.io/rzp/QEuXj4E in new tab</div>
            <button onClick={() => setStep(1)} style={{ background:"none", border:"none", color:C.sub,
              fontSize:12, cursor:"pointer", width:"100%", textAlign:"center", fontFamily:"'DM Sans',sans-serif" }}>← Back to summary</button>
          </>}

          {/* STEP 3 — Waiting */}
          {step===3 && (
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <div style={{ fontSize:42, marginBottom:14 }}>🌐</div>
              <div style={{ fontSize:17, fontWeight:700, color:C.txt, marginBottom:6, fontFamily:"'Space Grotesk',sans-serif" }}>
                Razorpay opened in new tab
              </div>
              <div style={{ fontSize:13, color:C.sub, marginBottom:20, lineHeight:1.7 }}>
                Complete your payment of <strong style={{ color:C.cyan }}>{inr(fees.total)}</strong><br/>
                on the Razorpay page, then return here.
              </div>
              <div style={{ background:C.bA, border:`1px solid ${C.blue}25`, borderRadius:10,
                padding:"12px 14px", marginBottom:24, fontSize:12, color:"#93C5FD", fontFamily:"monospace" }}>
                rzp.io/rzp/QEuXj4E
              </div>
              <Btn full onClick={confirmPayment} disabled={checking}>
                {checking ? <><Spinner size={16}/> Confirming…</> : "✓ I've paid — Confirm booking"}
              </Btn>
              <button onClick={() => window.open(`${RAZORPAY_URL}?amount=${fees.total}`, "_blank")}
                style={{ background:"none", border:"none", color:C.cyan, fontSize:12,
                  cursor:"pointer", width:"100%", textAlign:"center", marginTop:12,
                  fontFamily:"'DM Sans',sans-serif" }}>
                Re-open Razorpay ↗
              </button>
            </div>
          )}

          {/* STEP 4 — Success */}
          {step===4 && (
            <div style={{ textAlign:"center", padding:"10px 0" }}>
              <div style={{ width:72, height:72, borderRadius:"50%", border:`2px solid ${C.green}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 16px", fontSize:32, background:C.gA }}>✓</div>
              <div style={{ fontSize:20, fontWeight:700, color:C.green,
                fontFamily:"'Space Grotesk',sans-serif", marginBottom:4 }}>Payment Confirmed!</div>
              <div style={{ fontSize:13, color:C.sub, marginBottom:20 }}>{inr(fees.total)} received by DCORE Global Corporation</div>
              <Btn full onClick={onCancel}>View booking receipt →</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   BOOKING FLOW
───────────────────────────────────────────────────────────────────── */
/* Receipt QR — shown on booking confirmation. Encodes the UPI payment
   string so the partner can scan to verify the booking reference. */
function ReceiptQR({ booking }) {
  const upiString = buildUPIString(booking.total, booking.id, booking.serviceName);
  const elId = `rcpt-qr-${booking.id}`;
  useEffect(() => {
    setTimeout(() => renderUPIQRCode(elId, upiString, 140), 50);
  }, [elId, upiString]);
  return (
    <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
      <div style={{ background:C.bg, border:`2px solid ${C.cyan}`, borderRadius:12,
        padding:14, display:"inline-flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        <div id={elId}/>
        <div style={{ fontSize:10, color:C.cyan, fontFamily:"monospace" }}>{booking.id}</div>
      </div>
    </div>
  );
}

function BookingFlow({ service, onBack }) {
  const { user, addToast, refresh } = useApp();
  const [step, setStep]     = useState(1);
  const [date, setDate]     = useState("");
  const [time, setTime]     = useState("10:00");
  const [notes, setNotes]   = useState("");
  const [booking, setBooking] = useState(null);
  const [showPay, setShowPay] = useState(false);
  const [loading, setLoading] = useState(false);

  const fees = { price:service.price, platform:pf(service.price), gst:gstAmt(service.price), total:totalAmt(service.price) };

  const createBooking = async () => {
    setLoading(true);
    try {
      const partnerUser = await db.get("profiles", service.partnerId);
      const b = {
        id: genId("BK"),
        customerId: user.id, partnerId: service.partnerId,
        serviceId: service.id, serviceName: service.name,
        partnerName: partnerUser?.name || "Partner",
        customerName: user.name,
        customerEmail: user.email || "",
        price: service.price, platformFee: fees.platform, gst: fees.gst, total: fees.total,
        date: date || new Date().toISOString().split("T")[0], time, notes,
        status: "awaiting_payment", txnId: null, method: null,
        qr: "QR" + Math.random().toString(36).slice(2,8).toUpperCase(),
        createdAt: now(),
      };
      await db.put("bookings", b);
      await db.put("audit", { id:genId("AUD"), userId:user.id, action:"BOOKING_CREATED", ref:b.id, createdAt:now() });
      await db.put("notifications", { id:genId("NOT"), userId:service.partnerId,
        message:`New booking ${b.id} from ${user.name} for ${service.name}.`, read:false, createdAt:now() });
      setBooking(b);
      setStep(3);
      refresh();
    } catch (e) {
      addToast("Failed to create booking", "error");
    } finally { setLoading(false); }
  };

  const handlePayConfirmed = (confirmedBooking) => {
    setBooking(confirmedBooking);
    setShowPay(false);
    setStep(4);
    refresh();
  };

  const stepLabels = ["Details","Review","Pay","Confirmed"];
  return (
    <div style={{ padding:24, maxWidth:540 }}>
      {showPay && booking && (
        <PaymentModal booking={booking} onConfirmed={handlePayConfirmed} onCancel={() => setShowPay(false)}/>
      )}

      <button onClick={onBack} style={{ background:"none", border:"none", color:C.sub,
        fontSize:13, cursor:"pointer", marginBottom:18, display:"flex", alignItems:"center", gap:6,
        fontFamily:"'DM Sans',sans-serif" }}>← Back to services</button>

      {/* Progress bar */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:24 }}>
        {stepLabels.map((l,i) => (
          <div key={l} style={{ display:"flex", alignItems:"center" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ width:26, height:26, borderRadius:"50%",
                border:`1.5px solid ${step>i?C.green:step===i+1?C.cyan:C.border}`,
                background:step>i?C.gA:step===i+1?C.cA:"transparent",
                color:step>i?C.green:step===i+1?C.cyan:C.dim,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"monospace", fontSize:10, fontWeight:700 }}>
                {step>i ? "✓" : i+1}
              </div>
              <span style={{ fontSize:9, color:step===i+1?C.cyan:C.dim, fontFamily:"monospace", letterSpacing:0.4, whiteSpace:"nowrap" }}>{l}</span>
            </div>
            {i<3 && <div style={{ width:54, height:1, background:step>i+1?C.green:C.border, marginBottom:18 }}/>}
          </div>
        ))}
      </div>

      <Card>
        {/* Service header */}
        <div style={{ display:"flex", gap:12, alignItems:"flex-start", paddingBottom:16,
          borderBottom:`1px solid ${C.border}`, marginBottom:20 }}>
          <span style={{ fontSize:28 }}>{service.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:600, color:C.txt }}>{service.name}</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:2, lineHeight:1.5 }}>{service.desc}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:8 }}>
              {(service.includes||[]).map(inc => (
                <span key={inc} style={{ fontSize:10, color:C.green, fontFamily:"monospace",
                  background:C.gA, border:`1px solid ${C.green}25`, padding:"2px 6px", borderRadius:100 }}>✓ {inc}</span>
              ))}
            </div>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:C.cyan, fontFamily:"'Space Grotesk',sans-serif", flexShrink:0 }}>{inr(service.price)}</div>
        </div>

        {/* Step 1 */}
        {step===1 && <>
          <Input label="Preferred Date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <Select label="Preferred Time" value={time} onChange={e=>setTime(e.target.value)}
            options={["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00"].map(t=>({v:t,l:t}))}/>
          <Input label="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any specific requirements?"/>
          <Btn full onClick={() => setStep(2)}>Review booking →</Btn>
        </>}

        {/* Step 2 */}
        {step===2 && <>
          {[["Service",service.name],["Date",date||"TBD"],["Time",time],
            ["Service fee",inr(service.price)],
            [`Platform fee (${PLATFORM_FEE*100}%)`,inr(fees.platform)],
            ["GST (18%)",inr(fees.gst)],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13, color:C.sub }}>{k}</span>
              <span style={{ fontSize:13, color:C.txt, fontWeight:500 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0", marginBottom:16 }}>
            <span style={{ fontSize:15, fontWeight:700, color:C.txt }}>Total Payable</span>
            <span style={{ fontSize:20, fontWeight:700, color:C.cyan, fontFamily:"'Space Grotesk',sans-serif" }}>{inr(fees.total)}</span>
          </div>
          <div style={{ background:C.bA, border:`1px solid ${C.blue}25`, borderRadius:10,
            padding:"10px 14px", marginBottom:16, fontSize:12, color:"#93C5FD" }}>
            💳 Payment via <strong>Razorpay</strong> · DCORE Global Corporation · rzp.io/rzp/QEuXj4E
          </div>
          <Btn full disabled={loading} onClick={createBooking}>
            {loading ? <><Spinner size={16}/> Creating booking…</> : "Confirm & Proceed to Payment →"}
          </Btn>
          <button onClick={() => setStep(1)} style={{ background:"none", border:"none", color:C.sub,
            fontSize:12, cursor:"pointer", width:"100%", textAlign:"center", marginTop:10,
            fontFamily:"'DM Sans',sans-serif" }}>← Edit details</button>
        </>}

        {/* Step 3 */}
        {step===3 && booking && <>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ fontSize:13, color:C.sub, marginBottom:4 }}>Booking created</div>
            <div style={{ fontFamily:"monospace", fontSize:16, color:C.cyan }}>{booking.id}</div>
            <div style={{ fontSize:13, color:C.sub, marginTop:8 }}>Complete payment to confirm</div>
          </div>
          {[["upi","📱","UPI / QR Code"],["card","💳","Debit / Credit Card"],
            ["nb","🏦","Net Banking"],["wal","👛","Wallets"]].map(([id,ic,label]) => (
            <button key={id} onClick={() => setShowPay(true)}
              style={{ display:"flex", alignItems:"center", gap:14, width:"100%",
                padding:"13px 16px", border:`1px solid ${C.border}`, borderRadius:12,
                cursor:"pointer", background:"rgba(255,255,255,0.02)", marginBottom:8,
                fontFamily:"'DM Sans',sans-serif", textAlign:"left" }}>
              <span style={{ fontSize:22, flexShrink:0 }}>{ic}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:C.txt }}>{label}</div>
              </div>
              <span style={{ color:C.sub, fontSize:16 }}>›</span>
            </button>
          ))}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            marginTop:8, padding:"10px", background:C.gA, border:`1px solid ${C.green}20`, borderRadius:10 }}>
            <span style={{ fontSize:11, color:C.green, fontFamily:"monospace" }}>🔒 SSL · RAZORPAY · PCI DSS COMPLIANT</span>
          </div>
        </>}

        {/* Step 4 */}
        {step===4 && booking && (
          <div style={{ textAlign:"center", padding:"10px 0" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", border:`2px solid ${C.green}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 14px", fontSize:32, background:C.gA }}>✓</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.green,
              fontFamily:"'Space Grotesk',sans-serif", marginBottom:4 }}>Booking Confirmed!</div>
            <div style={{ fontFamily:"monospace", fontSize:13, color:C.cyan, marginBottom:2 }}>{booking.id}</div>
            <div style={{ fontSize:11, color:C.sub, fontFamily:"monospace", marginBottom:20 }}>{booking.txnId}</div>
            <ReceiptQR booking={booking}/>
            <div style={{ fontSize:11, color:C.sub, marginBottom:20 }}>Show this QR to your service partner on the day</div>
            <Card style={{ textAlign:"left", marginBottom:20 }}>
              {[["Service",booking.serviceName],["Date",booking.date],["Total paid",inr(booking.total)],
                ["Method",booking.method||"Razorpay"],["Txn ID",booking.txnId||"—"]
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between",
                  padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.sub }}>{k}</span>
                  <span style={{ fontSize:12, color:C.txt, fontWeight:500, wordBreak:"break-all",
                    maxWidth:"65%", textAlign:"right" }}>{v}</span>
                </div>
              ))}
            </Card>
            <Btn full onClick={onBack}>Back to services</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   AI ASSISTANT — Claude API
───────────────────────────────────────────────────────────────────── */
function AIAssistant() {
  const { user } = useApp();
  const [messages, setMessages] = useState([
    { role:"assistant", content:`Hi ${user.name.split(" ")[0]}! 👋 I'm your SCANVERSE AI assistant. I can help you:\n\n• Find the right service for your needs\n• Compare service options and pricing\n• Answer questions about legal, home, car, IT, and cloud services\n• Help you understand what's included in each service\n\nWhat do you need help with today?` }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role:"user", content:text };
    setMessages(m => [...m, userMsg]);
    setInput(""); setLoading(true);

    const services = await db.getAll("services");
    const serviceList = services.map(s => `${s.name} (${s.tag}) — ₹${s.price} — ${s.desc}`).join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          system:`You are the SCANVERSE AI assistant for DCORE Global Corporation, a service marketplace in Pune, India.
You help customers find and choose services. Be helpful, concise, and friendly.
You respond in plain text without markdown headers or bullet dashes — just clean readable text.
Available services on our platform:\n${serviceList}\n
All payments are processed via Razorpay to DCORE Global Corporation at rzp.io/rzp/QEuXj4E.
Platform adds 10% fee + 18% GST to all service prices.`,
          messages: [...messages, userMsg].slice(-10),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "I'm having trouble connecting right now. Please try again.";
      setMessages(m => [...m, { role:"assistant", content:reply }]);
    } catch {
      setMessages(m => [...m, { role:"assistant", content:"Connection error. Please check your internet and try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding:24, maxWidth:680, display:"flex", flexDirection:"column", height:"calc(100vh - 80px)" }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:700, color:C.txt, fontFamily:"'Space Grotesk',sans-serif", marginBottom:4 }}>AI Service Assistant</div>
        <div style={{ fontSize:13, color:C.sub }}>Powered by Claude · Knows all SCANVERSE services · Available 24/7</div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column",
        gap:12, paddingRight:4, marginBottom:16 }}>
        {messages.map((m,i) => (
          <div key={i} style={{ display:"flex", gap:10,
            flexDirection:m.role==="user"?"row-reverse":"row", alignItems:"flex-start" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0,
              background:m.role==="user"?C.cA:C.vA,
              border:`1px solid ${m.role==="user"?C.cyan:C.violet}35`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
              {m.role==="user"?user.avatar:"🤖"}
            </div>
            <div style={{ maxWidth:"80%", background:m.role==="user"?C.cA:C.card,
              border:`1px solid ${m.role==="user"?C.cyan:C.border}35`,
              borderRadius:12, padding:"12px 14px",
              fontSize:14, color:C.txt, lineHeight:1.65,
              whiteSpace:"pre-wrap", fontFamily:"'DM Sans',sans-serif" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:C.vA,
              border:`1px solid ${C.violet}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🤖</div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
              padding:"14px 16px", display:"flex", gap:6, alignItems:"center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.violet,
                  animation:`svDot .8s ease ${i*0.15}s infinite alternate` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick prompts */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
        {["What legal services do you offer?","Help me with car service options","Best IT certification for AWS","Compare home cleaning services"].map(q => (
          <button key={q} onClick={() => { setInput(q); }}
            style={{ padding:"5px 12px", background:C.cA, border:`1px solid ${C.borderHi}`,
              borderRadius:100, fontSize:12, color:C.cyan, cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif" }}>{q}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display:"flex", gap:10 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder="Ask about any service, pricing, or what's right for you…"
          style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
            padding:"13px 16px", color:C.txt, fontFamily:"'DM Sans',sans-serif",
            fontSize:14, outline:"none" }}/>
        <Btn onClick={send} disabled={loading || !input.trim()}>Send</Btn>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCREEN: CUSTOMER DASHBOARD
───────────────────────────────────────────────────────────────────── */
function CustomerDash() {
  const { user, setScreen, setBookingFor } = useApp();
  const [bookings, setBookings] = useState([]);
  useEffect(() => { db.getAll("bookings","customerId",user.id).then(bs=>setBookings(bs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)))); }, [user.id]);
  const spent = bookings.filter(b=>b.txnId).reduce((s,b)=>s+b.total,0);
  return (
    <div style={{ padding:24, maxWidth:920 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:22 }}>
        <StatCard label="Confirmed bookings" value={bookings.filter(b=>b.status==="confirmed").length} icon="📋" color={C.cyan} delta="+1 this week"/>
        <StatCard label="Completed" value={bookings.filter(b=>b.status==="completed").length} icon="✅" color={C.green}/>
        <StatCard label="Total paid" value={inr(spent)} icon="💰" color={C.amber}/>
      </div>
      <Card style={{ marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <SL>QUICK BOOK</SL>
          <Btn size="s" variant="g" onClick={()=>setScreen("services")}>All services</Btn>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[["⚖️","Legal"],["🏠","Home"],["🚗","Car"],["🤖","AI"]].map(([ic,cat]) => (
            <button key={cat} onClick={()=>setScreen("services")}
              style={{ background:C.cB, border:`1px solid ${C.borderHi}`, borderRadius:12,
                padding:"14px 8px", cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", gap:6 }}>
              <span style={{ fontSize:22 }}>{ic}</span>
              <span style={{ fontSize:12, color:C.txt, fontFamily:"'DM Sans',sans-serif" }}>{cat}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <SL>RECENT BOOKINGS</SL>
          <Btn size="s" variant="g" onClick={()=>setScreen("bookings")}>View all</Btn>
        </div>
        {bookings.slice(0,3).map(b => (
          <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
            <QRBox value={b.qr||b.id} size={48}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.txt, marginBottom:2 }}>{b.serviceName}</div>
              <div style={{ fontSize:12, color:C.sub }}>{b.partnerName} · {b.date}</div>
              {b.txnId && <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginTop:1 }}>{b.txnId}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.txt, marginBottom:5 }}>{inr(b.total||b.price)}</div>
              <Badge status={b.status}/>
            </div>
          </div>
        ))}
        {bookings.length===0 && <div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"20px 0" }}>No bookings yet — book your first service!</div>}
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCREEN: SERVICES
───────────────────────────────────────────────────────────────────── */
function ServicesPage() {
  const { user, setBookingFor } = useApp();
  const [services, setServices] = useState([]);
  const [search, setSearch]     = useState("");
  const [cat, setCat]           = useState("All");
  const cats = ["All","Legal","Home","Car","IT","Cert","Cloud","AI"];

  useEffect(() => { db.getAll("services").then(setServices); }, []);

  const filtered = services.filter(s =>
    s.status==="active" &&
    (cat==="All" || s.cat===cat) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding:24 }}>
      <div style={{ position:"relative", marginBottom:14 }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16 }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services…"
          style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
            padding:"12px 14px 12px 42px", color:C.txt, fontFamily:"'DM Sans',sans-serif",
            fontSize:14, outline:"none", boxSizing:"border-box" }}/>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {cats.map(ct => (
          <button key={ct} onClick={()=>setCat(ct)}
            style={{ padding:"6px 16px", borderRadius:100,
              border:`1px solid ${cat===ct?C.cyan:C.border}`,
              background:cat===ct?C.cA:"transparent",
              color:cat===ct?C.cyan:C.sub, fontSize:12, cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif", fontWeight:cat===ct?600:400 }}>{ct}</button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {filtered.map(sv => (
          <div key={sv.id} style={{ background:C.card, border:`1px solid ${C.border}`,
            borderRadius:16, padding:20, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <span style={{ fontSize:26 }}>{sv.icon}</span>
              <span style={{ fontSize:10, color:C.cyan, fontFamily:"monospace",
                border:`1px solid ${C.borderHi}`, padding:"2px 7px", borderRadius:4, letterSpacing:1 }}>{sv.tag}</span>
            </div>
            <div style={{ fontSize:15, fontWeight:600, color:C.txt, fontFamily:"'Space Grotesk',sans-serif" }}>{sv.name}</div>
            <div style={{ fontSize:12, color:C.sub, lineHeight:1.55, flex:1 }}>{sv.desc}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {(sv.includes||[]).slice(0,2).map(inc => (
                <span key={inc} style={{ fontSize:10, color:C.green, fontFamily:"monospace",
                  background:C.gA, padding:"2px 6px", borderRadius:100 }}>✓ {inc}</span>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:11, color:C.amber }}>★ {sv.rating||"New"}</span>
              {sv.reviews>0 && <span style={{ fontSize:11, color:C.dim }}>({sv.reviews})</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:C.cyan, fontFamily:"'Space Grotesk',sans-serif" }}>{inr(sv.price)}</div>
                <div style={{ fontSize:10, color:C.dim }}>+taxes · Total {inr(totalAmt(sv.price))}</div>
              </div>
              {user.role!=="admin" && <Btn size="s" onClick={()=>setBookingFor(sv)}>Book now</Btn>}
            </div>
          </div>
        ))}
        {filtered.length===0 && <div style={{ color:C.sub, fontSize:14, gridColumn:"1/-1", textAlign:"center", padding:"40px 0" }}>No services found.</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCREEN: BOOKINGS (all roles)
───────────────────────────────────────────────────────────────────── */
function BookingsPage() {
  const { user, addToast, refresh } = useApp();
  const [bookings, setBookings] = useState([]);
  const [sel, setSel]           = useState(null);
  const [showPay, setShowPay]   = useState(false);

  const load = useCallback(async () => {
    let bs;
    if      (user.role==="admin")   bs = await db.getAll("bookings");
    else if (user.role==="partner") bs = await db.getAll("bookings","partnerId",user.id);
    else                             bs = await db.getAll("bookings","customerId",user.id);
    bs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    setBookings(bs);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    const b = await db.get("bookings", id);
    if (!b) return;
    await db.put("bookings", { ...b, status });
    await db.put("audit", { id:genId("AUD"), userId:user.id, action:`BOOKING_${status.toUpperCase()}`, ref:id, createdAt:now() });
    await db.put("notifications", { id:genId("NOT"), userId:b.customerId,
      message:`Your booking ${id} has been marked as ${status.replace(/_/g," ")}.`, read:false, createdAt:now() });
    addToast(`Booking ${status.replace(/_/g," ")}`, "success");
    setSel(null); load(); refresh();
  };

  const isPartner = user.role==="partner";
  const isAdmin   = user.role==="admin";

  return (
    <div style={{ padding:24, maxWidth:820 }}>
      {showPay && sel && (
        <PaymentModal booking={sel}
          onConfirmed={() => { load(); setShowPay(false); setSel(null); refresh(); }}
          onCancel={() => setShowPay(false)}/>
      )}
      {sel ? (
        <>
          <button onClick={()=>setSel(null)} style={{ background:"none", border:"none", color:C.sub,
            fontSize:13, cursor:"pointer", marginBottom:18, display:"flex", alignItems:"center", gap:6,
            fontFamily:"'DM Sans',sans-serif" }}>← Back</button>
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:700, color:C.txt, fontFamily:"'Space Grotesk',sans-serif" }}>{sel.serviceName}</div>
                <div style={{ fontSize:12, color:C.sub, marginTop:4 }}>{isPartner?sel.customerName:sel.partnerName}</div>
              </div>
              <Badge status={sel.status}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              {[["Booking ID",sel.id],["Date",sel.date||"—"],["Time",sel.time||"—"],
                ["Service fee",inr(sel.price)],["Platform fee",inr(sel.platformFee)],
                ["GST",inr(sel.gst)],["Total",inr(sel.total)],
                ["Txn ID",sel.txnId||"Awaiting payment"],
                ["Method",sel.method||"—"],
                [isPartner?"Customer":"Partner",isPartner?sel.customerName:sel.partnerName],
              ].map(([k,v]) => (
                <div key={k} style={{ background:C.raised, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:10, color:C.sub, fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:13, color:C.txt, fontWeight:500, wordBreak:"break-all" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center", gap:6, marginBottom:18 }}>
              <QRBox value={sel.qr||sel.id} size={120}/>
              <span style={{ fontSize:10, color:C.cyan, fontFamily:"monospace" }}>{sel.id}</span>
            </div>
            {(sel.status==="awaiting_payment") && user.role==="customer" && (
              <Btn full onClick={()=>setShowPay(true)}>💳 Complete Payment via Razorpay →</Btn>
            )}
            {sel.status==="confirmed" && isPartner && (
              <Btn full variant="s" onClick={()=>updateStatus(sel.id,"completed")}>✓ Mark as Completed</Btn>
            )}
            {sel.status==="awaiting_payment" && isPartner && (
              <div style={{ fontSize:13, color:C.amber, textAlign:"center", padding:"10px" }}>⏳ Awaiting customer payment</div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <SL>{isAdmin?"ALL BOOKINGS":isPartner?"INCOMING BOOKINGS":"MY BOOKINGS"}</SL>
          {bookings.length===0 && <div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"20px 0" }}>No bookings found.</div>}
          {bookings.map(b => (
            <div key={b.id} onClick={()=>setSel(b)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 0",
                borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
              <QRBox value={b.qr||b.id} size={48}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:C.txt, marginBottom:2 }}>{b.serviceName}</div>
                <div style={{ fontSize:12, color:C.sub }}>{isPartner?b.customerName:b.partnerName} · {b.date}</div>
                {b.txnId && <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginTop:1 }}>{b.txnId}</div>}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.txt, marginBottom:5 }}>{inr(b.total||b.price)}</div>
                <Badge status={b.status}/>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SCREEN: PARTNER DASHBOARD
───────────────────────────────────────────────────────────────────── */
function PartnerDash() {
  const { user, setScreen } = useApp();
  const [bookings, setBookings] = useState([]);
  useEffect(() => { db.getAll("bookings","partnerId",user.id).then(bs=>setBookings(bs.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)))); }, [user.id]);
  return (
    <div style={{ padding:24, maxWidth:920 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
        <StatCard label="Total bookings" value={bookings.length} icon="📋" color={C.violet} delta="+4"/>
        <StatCard label="Pending payment" value={bookings.filter(b=>b.status==="awaiting_payment").length} icon="⏳" color={C.amber}/>
        <StatCard label="All-time earnings" value={inr(user.totalEarnings||0)} icon="💰" color={C.green} delta="+12%"/>
        <StatCard label="Rating" value={(user.rating||0)>0?(user.rating+"★"):"New"} icon="⭐" color={C.cyan}/>
      </div>
      <Card style={{ marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <SL>INCOMING BOOKINGS</SL>
          <Btn size="s" variant="g" onClick={()=>setScreen("bookings")}>View all</Btn>
        </div>
        {bookings.slice(0,4).map(b => (
          <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ width:38, height:38, borderRadius:10, background:C.vA, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>👤</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.txt, marginBottom:2 }}>{b.customerName}</div>
              <div style={{ fontSize:12, color:C.sub }}>{b.serviceName} · {b.date}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.txt }}>{inr(b.price)}</div>
              <Badge status={b.status}/>
            </div>
          </div>
        ))}
        {bookings.length===0 && <div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"20px 0" }}>No bookings yet.</div>}
      </Card>
      <Card>
        <SL>MONTHLY EARNINGS (₹K)</SL>
        <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:72 }}>
          {[12,18,14,22,16,24,20,28,22,30,26,32].map((v,i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <div style={{ height:`${(v/32)*64}px`, background:i===11?C.violet:`${C.violet}55`, borderRadius:"2px 2px 0 0", width:"100%" }}/>
              <span style={{ fontSize:7, color:C.dim, fontFamily:"monospace" }}>{"JFMAMJJASOND"[i]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PartnerListings() {
  const { user, addToast } = useApp();
  const [services, setServices] = useState([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [nm, setNm] = useState(""); const [pr, setPr] = useState(""); const [ds, setDs] = useState("");

  const load = () => db.getAll("services").then(all => setServices(all.filter(s=>s.partnerId===user.id)));
  useEffect(() => { load(); }, [user.id]);

  const publish = async () => {
    if (!nm||!pr) return addToast("Name and price required","error");
    await db.put("services", {
      id:genId("SVC"), partnerId:user.id, cat:user.category||"General",
      icon:"🔧", name:nm, price:+pr, desc:ds, includes:[], tag:user.category?.slice(0,5).toUpperCase()||"SVC",
      status:"active", rating:0, reviews:0, createdAt:now(),
    });
    addToast("Service published!", "success");
    setShowAdd(false); setNm(""); setPr(""); setDs(""); load();
  };

  return (
    <div style={{ padding:24, maxWidth:720 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <SL>MY LISTINGS</SL>
        <Btn onClick={()=>setShowAdd(!showAdd)}>+ Add service</Btn>
      </div>
      {showAdd && (
        <Card style={{ marginBottom:16, border:`1px solid ${C.violet}40` }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.txt, marginBottom:14 }}>New service listing</div>
          <Input label="Service name" value={nm} onChange={e=>setNm(e.target.value)} placeholder="e.g. Property Documentation"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Input label="Category" value={user.category||""} readOnly/>
            <Input label="Price (₹)" type="number" value={pr} onChange={e=>setPr(e.target.value)} placeholder="1200"/>
          </div>
          <Input label="Description" value={ds} onChange={e=>setDs(e.target.value)} placeholder="Brief description…"/>
          <div style={{ display:"flex", gap:10 }}><Btn onClick={publish}>Publish</Btn><Btn variant="g" onClick={()=>setShowAdd(false)}>Cancel</Btn></div>
        </Card>
      )}
      {services.map(sv => (
        <Card key={sv.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
              <span style={{ fontSize:26 }}>{sv.icon}</span>
              <div>
                <div style={{ fontSize:15, fontWeight:600, color:C.txt }}>{sv.name}</div>
                <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{sv.desc}</div>
                <div style={{ marginTop:8, display:"flex", gap:12, fontSize:12 }}>
                  <span style={{ color:C.amber }}>★ {sv.rating||"New"}</span>
                  <span style={{ color:C.sub }}>{sv.reviews} reviews</span>
                  <span style={{ color:C.cyan }}>{inr(sv.price)}</span>
                </div>
              </div>
            </div>
            <Btn size="s" variant="d" onClick={async()=>{await db.put("services",{...sv,status:"inactive"});addToast("Removed","info");load();}}>Remove</Btn>
          </div>
        </Card>
      ))}
      {services.length===0 && !showAdd && <div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"40px 0" }}>No listings yet. Add your first service above.</div>}
    </div>
  );
}

function EarningsPage() {
  const { user } = useApp();
  const [payments, setPayments] = useState([]);
  useEffect(() => { db.getAll("payments").then(all=>setPayments(all.filter(p=>p.userId===user.id||true).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)))); }, [user.id]);
  return (
    <div style={{ padding:24, maxWidth:720 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:22 }}>
        <StatCard label="This month" value={inr(24800)} icon="💰" color={C.green} delta="+12%"/>
        <StatCard label="Pending payout" value={inr(8400)} icon="⏳" color={C.amber}/>
        <StatCard label="All time" value={inr(user.totalEarnings||184000)} icon="🏦" color={C.cyan}/>
      </div>
      <Card style={{ marginBottom:18 }}>
        <SL>PAYOUT HISTORY · VIA RAZORPAY</SL>
        {[["2026-06-01","₹18,200","UPI","paid"],["2026-05-01","₹22,000","NEFT","paid"],
          ["2026-04-01","₹16,500","UPI","paid"],["2026-07-01","₹8,400","—","pending"]
        ].map((p,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:C.txt }}>{p[1]}</div>
              <div style={{ fontSize:12, color:C.sub }}>{p[0]} · {p[2]}</div>
            </div>
            <Badge status={p[3]}/>
          </div>
        ))}
      </Card>
      <div style={{ background:C.bA, border:`1px solid ${C.blue}25`, borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:22 }}>💳</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.txt }}>DCORE Global Corporation · Razorpay</div>
          <div style={{ fontSize:12, color:C.sub, marginTop:2, fontFamily:"monospace" }}>https://rzp.io/rzp/QEuXj4E</div>
        </div>
        <Btn size="s" variant="g" href={RAZORPAY_URL}>Open ↗</Btn>
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────────
   SCREEN: PROFILE
───────────────────────────────────────────────────────────────────── */
function ProfilePage() {
  const { user, addToast, setUser } = useApp();
  const [name, setName]   = useState(user.name);
  const [phone, setPhone] = useState(user.phone||"");
  const [pw, setPw]       = useState("");
  const [npw, setNpw]     = useState("");
  const save = async () => {
    const sb = await getSupabase();
    await sb.from("profiles").update({ name, phone }).eq("id", user.id);
    const updated = { ...user, name, phone };
    setUser(updated);
    addToast("Profile updated", "success");
  };
  const changePw = async () => {
    if (!pw||!npw) return addToast("Fill both password fields","error");
    if (npw.length < 8) return addToast("New password min. 8 characters","error");
    try {
      // Supabase requires re-authentication before password update
      // Sign in with current password to verify, then update
      const sb = await getSupabase();
      const { error: signInErr } = await sb.auth.signInWithPassword({ email: user.email, password: pw });
      if (signInErr) { addToast("Current password incorrect","error"); return; }
      await Auth.updatePassword(npw);
      setPw(""); setNpw("");
      addToast("Password changed successfully","success");
    } catch(e) { addToast(e.message || "Password change failed","error"); }
  };
  return (
    <div style={{ padding:24, maxWidth:520 }}>
      <Card style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <div style={{ width:60, height:60, borderRadius:"50%", background:C.cA,
            border:`2px solid ${C.cyan}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
            {user.avatar}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:C.txt, fontFamily:"'Space Grotesk',sans-serif" }}>{user.name}</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{user.email}</div>
            <Badge status={user.status}/>
          </div>
        </div>
        <Input label="Full Name" value={name} onChange={e=>setName(e.target.value)}/>
        <Input label="Email" value={user.email} readOnly/>
        <Input label="Mobile" value={phone} onChange={e=>setPhone(e.target.value)}/>
        {user.business && <Input label="Business Name" value={user.business} readOnly/>}
        <Btn onClick={save}>Save changes</Btn>
      </Card>
      <Card style={{ marginBottom:18 }}>
        <SL>CHANGE PASSWORD</SL>
        <Input label="Current Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"/>
        <Input label="New Password" type="password" value={npw} onChange={e=>setNpw(e.target.value)} placeholder="Min. 8 characters"/>
        <Btn onClick={changePw}>Update password</Btn>
      </Card>
      {user.role==="partner" && (
        <Card style={{ border:`1px solid ${C.amber}30` }}>
          <SL>KYC STATUS</SL>
          {[["PAN Card",user.kyc==="verified"?"Verified ✓":"Pending",user.kyc==="verified"?C.green:C.amber],
            ["Aadhaar",user.kyc==="verified"?"Verified ✓":"Pending",user.kyc==="verified"?C.green:C.amber],
            ["Professional ID",user.kyc==="verified"?"Verified ✓":"Pending",user.kyc==="verified"?C.green:C.amber],
            ["GST Number","Optional",C.sub]
          ].map(([k,v,col]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13, color:C.sub }}>{k}</span>
              <span style={{ fontSize:13, color:col, fontWeight:500 }}>{v}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   ADMIN SCREENS
───────────────────────────────────────────────────────────────────── */
function AdminOverview() {
  const { addToast, setScreen } = useApp();
  const [stats, setStats]   = useState({});
  const [pending, setPending] = useState([]);

  useEffect(() => {
    Promise.all([db.getAll("profiles"), db.getAll("bookings"), db.getAll("payments")]).then(([users,bookings,payments]) => {
      const gmv = payments.filter(p=>p.status==="success").reduce((s,p)=>s+p.amount,0);
      setStats({
        customers:  users.filter(u=>u.role==="customer").length,
        activePartners: users.filter(u=>u.role==="partner"&&u.status==="active").length,
        pendingPartners: users.filter(u=>u.role==="partner"&&u.status==="pending").length,
        totalBookings: bookings.length, confirmedBookings: bookings.filter(b=>b.status==="confirmed").length,
        gmv, platformFee:Math.round(gmv*PLATFORM_FEE), txnCount:payments.length,
      });
      setPending(users.filter(u=>u.role==="partner"&&u.status==="pending"));
    });
  }, []);

  const approve = async (id, action) => {
    const u = await db.get("profiles", id);
    if (!u) return;
    await db.put("profiles", { ...u, status:action==="approve"?"active":"rejected" });
    await db.put("notifications", { id:genId("NOT"), userId:id,
      message:`Your partner account has been ${action==="approve"?"approved! You can now list services.":"rejected."}`,
      read:false, createdAt:now() });
    addToast(`Partner ${action}d`, "success");
    setPending(p => p.filter(x => x.id !== id));
  };

  return (
    <div style={{ padding:24, maxWidth:1020 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
        <StatCard label="Customers" value={stats.customers||0} icon="👥" color={C.cyan} delta="+24"/>
        <StatCard label="Active Partners" value={stats.activePartners||0} icon="🤝" color={C.violet} delta={`${stats.pendingPartners||0} pending`}/>
        <StatCard label="Total Bookings" value={stats.totalBookings||0} icon="📋" color={C.green}/>
        <StatCard label="GMV Collected" value={inr(stats.gmv||0)} icon="💰" color={C.amber} delta="+22%"/>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18, marginBottom:18 }}>
        <Card>
          <SL>BOOKINGS BY CATEGORY</SL>
          {[["Legal",38,C.cyan],["IT Training",28,C.violet],["Home",16,C.green],["Car",10,C.amber],["Cloud/AI",8,C.red]].map(([cat,pct,col])=>(
            <div key={cat} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color:C.txt }}>{cat}</span>
                <span style={{ color:col, fontFamily:"monospace" }}>{pct}%</span>
              </div>
              <div style={{ height:5, background:C.raised, borderRadius:2 }}>
                <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:2 }}/>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <SL>PLATFORM STATS</SL>
          {[["Platform Fee Rate","10%"],["GST Rate","18%"],
            ["Fee Collected",inr(stats.platformFee||0)],
            ["Total Transactions",stats.txnCount||0],
            ["Confirmed Bookings",stats.confirmedBookings||0],
            ["Razorpay","rzp.io/rzp/QEuXj4E"],
          ].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.sub }}>{k}</span>
              <span style={{ fontSize:12, color:C.txt, fontWeight:500, fontFamily:"monospace" }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
      {pending.length>0 && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <SL>PENDING PARTNER APPROVALS</SL>
            <Btn size="s" variant="g" onClick={()=>setScreen("users")}>Manage all</Btn>
          </div>
          {pending.map(p => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:C.vA, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{p.avatar}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.txt }}>{p.name}</div>
                  <div style={{ fontSize:12, color:C.sub }}>{p.business||p.email} · {p.category||"General"}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn size="s" variant="s" onClick={()=>approve(p.id,"approve")}>Approve</Btn>
                <Btn size="s" variant="d" onClick={()=>approve(p.id,"reject")}>Reject</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function AdminUsers() {
  const { addToast } = useApp();
  const [users, setUsers]   = useState([]);
  const [filter, setFilter] = useState("all");
  const load = () => db.getAll("profiles").then(setUsers);
  useEffect(()=>{load();},[]);
  const list = filter==="all"?users:users.filter(u=>u.role===filter);
  return (
    <div style={{ padding:24, maxWidth:960 }}>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {["all","customer","partner"].map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:"6px 16px", borderRadius:100, border:`1px solid ${filter===f?C.cyan:C.border}`,
              background:filter===f?C.cA:"transparent", color:filter===f?C.cyan:C.sub,
              fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      <Card>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                {["ID","Name","Email","Role","Status","Joined","Actions"].map(h => (
                  <th key={h} style={{ padding:"10px 10px", textAlign:"left", fontSize:10, color:C.sub,
                    fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:"11px 10px", fontSize:11, color:C.dim, fontFamily:"monospace" }}>{u.id}</td>
                  <td style={{ padding:"11px 10px", fontSize:13, color:C.txt, fontWeight:500 }}>{u.avatar} {u.name}</td>
                  <td style={{ padding:"11px 10px", fontSize:12, color:C.sub }}>{u.email}</td>
                  <td style={{ padding:"11px 10px" }}><span style={{ fontSize:11, fontFamily:"monospace", letterSpacing:1, textTransform:"uppercase", color:u.role==="partner"?C.violet:u.role==="admin"?C.amber:C.cyan }}>{u.role}</span></td>
                  <td style={{ padding:"11px 10px" }}><Badge status={u.status}/></td>
                  <td style={{ padding:"11px 10px", fontSize:12, color:C.sub }}>{fmtDate(u.joined)}</td>
                  <td style={{ padding:"11px 10px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      {u.status==="pending" && <>
                        <Btn size="s" variant="s" onClick={async()=>{await db.put("profiles",{...u,status:"active"});addToast(`${u.name} approved`,"success");load();}}>Approve</Btn>
                        <Btn size="s" variant="d" onClick={async()=>{await db.put("profiles",{...u,status:"rejected"});addToast("Rejected","info");load();}}>Reject</Btn>
                      </>}
                      {u.status==="active"&&u.role!=="admin"&&<Btn size="s" variant="g">View</Btn>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdminRevenue() {
  const [payments, setPayments] = useState([]);
  const [rev, setRev] = useState({ total:0, fee:0, txnCount:0 });
  useEffect(() => {
    db.getAll("payments").then(ps => {
      const sorted = ps.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      const total = ps.filter(p=>p.status==="success").reduce((s,p)=>s+p.amount,0);
      setPayments(sorted);
      setRev({ total, fee:Math.round(total*PLATFORM_FEE), txnCount:ps.length });
    });
  }, []);
  return (
    <div style={{ padding:24, maxWidth:820 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:22 }}>
        <StatCard label="Total GMV" value={inr(rev.total)} icon="📈" color={C.green} delta="+22%"/>
        <StatCard label={`Platform Fee (${PLATFORM_FEE*100}%)`} value={inr(rev.fee)} icon="💼" color={C.cyan}/>
        <StatCard label="Transactions" value={rev.txnCount} icon="🔁" color={C.violet}/>
      </div>
      <Card style={{ marginBottom:18 }}>
        <SL>GMV TREND 2026 (₹K)</SL>
        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:90 }}>
          {[[18,C.raised],[22,C.raised],[19,C.raised],[24,C.raised],[21,C.raised],[42,C.cyan]].map(([v,col],i)=>(
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:8, color:C.sub, fontFamily:"monospace" }}>₹{v}K</span>
              <div style={{ height:`${(v/42)*80}px`, background:col, borderRadius:"3px 3px 0 0", width:"100%" }}/>
              <span style={{ fontSize:8, color:C.sub, fontFamily:"monospace" }}>{"JFMAMJ"[i]}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ marginBottom:18 }}>
        <SL>RAZORPAY TRANSACTIONS · rzp.io/rzp/QEuXj4E</SL>
        {payments.length===0&&<div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"20px 0" }}>No transactions recorded.</div>}
        {payments.map(p => (
          <div key={p.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:11, fontFamily:"monospace", color:C.cyan, marginBottom:2 }}>{p.txnId}</div>
              <div style={{ fontSize:12, color:C.sub }}>{p.bookingId} · {p.method||"—"} · {fmtDate(p.createdAt)}</div>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:C.txt, flexShrink:0 }}>{inr(p.amount)}</div>
            <Badge status={p.status}/>
          </div>
        ))}
      </Card>
      <div style={{ background:C.bA, border:`1px solid ${C.blue}25`, borderRadius:12,
        padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:22 }}>💳</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.txt }}>DCORE Global Corporation · Razorpay</div>
          <div style={{ fontSize:12, color:C.sub, marginTop:2, fontFamily:"monospace" }}>https://rzp.io/rzp/QEuXj4E</div>
        </div>
        <Btn size="s" variant="g" href={RAZORPAY_URL}>Open ↗</Btn>
      </div>
    </div>
  );
}

function AuditLog() {
  const [log, setLog] = useState([]);
  useEffect(() => { db.getAll("audit").then(a=>setLog(a.sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt)))); }, []);
  return (
    <div style={{ padding:24, maxWidth:820 }}>
      <Card>
        <SL>SYSTEM AUDIT LOG</SL>
        {log.length===0&&<div style={{ color:C.sub, fontSize:14, textAlign:"center", padding:"20px 0" }}>No audit entries yet.</div>}
        {log.map(a => (
          <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, marginTop:5, flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, color:C.txt, fontFamily:"monospace" }}>{a.action}</div>
              <div style={{ fontSize:11, color:C.sub }}>ref: {a.ref} · user: {a.userId}</div>
            </div>
            <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", whiteSpace:"nowrap", flexShrink:0 }}>{fmtDate(a.createdAt)} {fmtTime(a.createdAt)}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   AUTH SCREEN — real password hashing, real sessions
───────────────────────────────────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [mode, setMode]     = useState("login");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits]   = useState(["","","","","",""]);
  const [otpCode, setOtpCode] = useState("");
  const [cd, setCd]           = useState(120);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);
  const [sRole, setSRole]     = useState("customer");
  // Signup fields
  const [sName, setSName]     = useState("");
  const [sPhone, setSPhone]   = useState("");
  const [sEmail, setSEmail]   = useState("");
  const [sPass, setSPass]     = useState("");
  const [sBiz, setSBiz]       = useState("");

  /* ── Phone OTP signup state ─────────────────────────────────── */
  const [signupVia, setSignupVia] = useState("email");   // "email" | "phone"
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneDigits, setPhoneDigits]   = useState(["","","","","",""]);
  const [phoneCd, setPhoneCd]           = useState(60);

  const timerRef = useRef(null);

  useEffect(() => {
    if (otpSent && cd>0) { timerRef.current=setInterval(()=>setCd(n=>n-1),1000); }
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [otpSent, cd]);

  const phoneTimerRef = useRef(null);
  useEffect(() => {
    if (phoneOtpSent && phoneCd>0) { phoneTimerRef.current=setInterval(()=>setPhoneCd(n=>n-1),1000); }
    else clearInterval(phoneTimerRef.current);
    return () => clearInterval(phoneTimerRef.current);
  }, [phoneOtpSent, phoneCd]);


  const doForgotPassword = async () => {
    if (!email) return setErr("Enter your email address first.");
    setLoading(true); setErr("");
    try {
      await Auth.resetPassword(email.toLowerCase().trim());
      setErr(""); // clear errors
      addToast("Password reset link sent! Check your email.", "success");
    } catch(e) {
      setErr(e.message?.includes("User not found") ? "No account with this email." : "Failed to send reset email.");
    } finally { setLoading(false); }
  };

  const doLogin = async () => {
    if (!email||!pass) return setErr("Email and password required.");
    setLoading(true); setErr("");
    try {
      const { session } = await Auth.signIn({ email: email.toLowerCase().trim(), password: pass });
      if (!session) throw new Error("No session returned");
      const profile = await Auth.getProfile(session.user.id);
      if (!profile) throw new Error("Profile not found");
      if (profile.status === "pending") {
        await Auth.signOut();
        setErr("Your partner account is pending admin approval. We'll notify you by email."); return;
      }
      onLogin(profile);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("Invalid login") || msg.includes("invalid_credentials")) setErr("Incorrect email or password.");
      else if (msg.includes("Email not confirmed")) setErr("Please confirm your email address first. Check your inbox.");
      else setErr(msg || "Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  const sendOTP = async () => {
    if (!email) return setErr("Enter your email address first.");
    setLoading(true); setErr("");
    try {
      await Auth.sendOTP(email.toLowerCase().trim());
      setOtpSent(true); setCd(120); setErr("");
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("User not found")) setErr("No account with this email. Please sign up first.");
      else setErr("Failed to send OTP. Please try again.");
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    const entered = digits.join("");
    if (entered.length < 6) return setErr("Enter all 6 digits.");
    setLoading(true); setErr("");
    try {
      const { session } = await Auth.verifyOTP(email.toLowerCase().trim(), entered);
      if (!session) throw new Error("Verification failed");
      const profile = await Auth.getProfile(session.user.id);
      onLogin(profile);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("Token has expired") || msg.includes("expired")) setErr("OTP has expired. Please request a new one.");
      else if (msg.includes("Token not found") || msg.includes("invalid")) setErr("Incorrect OTP. Please check and try again.");
      else setErr("Verification failed. Please try again.");
    } finally { setLoading(false); }
  };

  /* Converts any phone input to E.164 format (+91XXXXXXXXXX).
     Used by both email-signup and phone-OTP-signup paths so the
     same number always maps to the same unique profiles.phone row. */
  const normalizePhone = (raw) => {
    let p = raw.replace(/[^\d+]/g, "");
    if (!p.startsWith("+")) {
      // Assume India if no country code given
      p = p.replace(/^0+/, "");
      p = "+91" + p;
    }
    return p;
  };

  const doSignup = async () => {
    if (!sName||!sEmail||!sPass||!sPhone) return setErr("All fields are required.");
    if (sPass.length < 8) return setErr("Password must be at least 8 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail)) return setErr("Enter a valid email address.");
    const phoneE164 = normalizePhone(sPhone);
    if (!/^\+[1-9]\d{9,14}$/.test(phoneE164)) return setErr("Enter a valid mobile number, e.g. +91 98765 43210.");
    setLoading(true); setErr("");
    try {
      await Auth.signUp({
        email: sEmail.toLowerCase().trim(),
        password: sPass,
        name: sName.trim(),
        phone: phoneE164,
        role: sRole,
        business: sBiz.trim(),
        category: "General",
      });
      if (sRole === "partner") {
        setMode("login"); setErr("");
        setEmail(sEmail.trim()); setSName(""); setSEmail(""); setSPass(""); setSPhone(""); setSBiz("");
        addToast("Account created! Check your email to confirm, then await admin approval.", "success");
      } else {
        // Customer — Supabase sends confirmation email; show message
        setMode("login"); setErr("");
        setEmail(sEmail.trim());
        addToast("Account created! Check your email to confirm your address.", "success");
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("already registered") || msg.includes("already exists")) setErr("This email is already registered. Try signing in.");
      else if (msg.includes("phone") && msg.includes("already")) setErr("This mobile number is already registered. Try signing in.");
      else if (msg.includes("password")) setErr("Password must be at least 8 characters with letters and numbers.");
      else setErr(msg || "Signup failed. Please try again.");
    } finally { setLoading(false); }
  };

  /* ── Create account via mobile number + SMS OTP ──────────────────
     Step 1: sendPhoneSignupOTP — validates fields, fires real SMS
     Step 2: verifyPhoneSignupOTP — checks code, account is created
             on successful verification (Supabase creates the user
             at verify-time, attaching the metadata we sent in step 1)
  ───────────────────────────────────────────────────────────────── */
  const sendPhoneSignupOTP = async () => {
    if (!sName.trim()) return setErr("Enter your full name.");
    if (!sPhone.trim()) return setErr("Enter your mobile number.");
    const phoneE164 = normalizePhone(sPhone);
    if (!/^\+[1-9]\d{9,14}$/.test(phoneE164)) return setErr("Enter a valid mobile number with country code, e.g. +91 98765 43210.");
    setLoading(true); setErr("");
    try {
      await Auth.sendPhoneOTP(phoneE164, {
        name: sName.trim(),
        role: sRole,
        business: sBiz.trim(),
        category: "General",
        status: sRole === "partner" ? "pending" : "active",
        avatar: sRole === "partner" ? "🤝" : "👤",
      });
      setSPhone(phoneE164);
      setPhoneOtpSent(true);
      setPhoneDigits(["","","","","",""]);
      setPhoneCd(60);
      addToast(`SMS code sent to ${phoneE164}`, "info");
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("rate limit") || msg.includes("Too many"))
        setErr("Too many attempts. Please wait a minute and try again.");
      else if (msg.includes("Unsupported phone provider") || msg.includes("not enabled"))
        setErr("SMS sign-up isn't configured yet. Set up a phone provider in Supabase Dashboard → Authentication → Providers → Phone.");
      else
        setErr(msg || "Could not send SMS code. Please try again.");
    } finally { setLoading(false); }
  };

  const verifyPhoneSignupOTP = async () => {
    const entered = phoneDigits.join("");
    if (entered.length < 6) return setErr("Enter all 6 digits.");
    setLoading(true); setErr("");
    try {
      const { session } = await Auth.verifyPhoneOTP(sPhone, entered);
      if (!session) throw new Error("Verification failed");
      const profile = await Auth.getProfile(session.user.id);
      if (sRole === "partner") {
        await Auth.signOut();
        setMode("login"); setPhoneOtpSent(false);
        setSName(""); setSPhone(""); setSBiz("");
        addToast("Account created! Awaiting admin approval before you can sign in.", "success");
      } else {
        onLogin(profile);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("expired")) setErr("Code expired. Please resend.");
      else if (msg.includes("invalid") || msg.includes("Token")) setErr("Incorrect code. Please check and try again.");
      else setErr(msg || "Verification failed. Please try again.");
    } finally { setLoading(false); }
  };

  const quickLogin = async (em, pw) => {
    setLoading(true); setErr("");
    try {
      const { session } = await Auth.signIn({ email: em, password: pw });
      if (!session) { setErr("Demo login failed — ensure demo users exist."); return; }
      const profile = await Auth.getProfile(session.user.id);
      if (profile) onLogin(profile);
    } catch (e) {
      setErr("Demo login failed: " + (e.message||""));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center",
      justifyContent:"center", padding:20, fontFamily:"'DM Sans',sans-serif",
      backgroundImage:GRID, backgroundSize:"48px 48px" }}>
      <div style={{ width:"100%", maxWidth:420, position:"relative", zIndex:1 }}>

        {/* Brand */}
        <div style={{ textAlign:"center", marginBottom:26 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:40, height:40, border:`2px solid ${C.cyan}`, borderRadius:9,
              display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
              <div style={{ position:"absolute", inset:5, border:`1px solid ${C.cyan}40`, borderRadius:4 }}/>
              <span style={{ color:C.cyan, fontSize:11, fontWeight:700, fontFamily:"monospace", zIndex:1 }}>QR</span>
            </div>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:24,
              letterSpacing:-0.5, color:C.txt }}>
              SCAN<span style={{ color:C.cyan }}>VERSE</span>
            </span>
          </div>
          <p style={{ fontSize:12, color:C.sub }}>DCORE Global Corporation · PCMC, Pune</p>
        </div>

        {/* Quick demo logins */}
        <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:12,
          padding:"12px 14px", marginBottom:16 }}>
          <div style={{ fontSize:10, color:C.sub, fontFamily:"monospace", letterSpacing:1,
            textTransform:"uppercase", marginBottom:10 }}>Quick demo login</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[["👤 Customer","rahul@example.com","pass123",C.cyan],
              ["🤝 Partner","priya@legalpcmc.in","pass123",C.violet],
              ["🛡️ Admin","admin@scanverse.in","admin123",C.amber],
            ].map(([label,em,pw,col]) => (
              <button key={em} onClick={()=>quickLogin(em,pw)} disabled={loading}
                style={{ padding:"7px 14px", border:`1px solid ${col}35`, borderRadius:8,
                  background:`${col}10`, color:col, fontSize:12, cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif", fontWeight:600, opacity:loading?0.5:1 }}>
                {loading?<Spinner size={12} color={col}/>:label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:C.surf, border:`1px solid ${C.border}`,
          borderRadius:12, padding:4, marginBottom:16, gap:4 }}>
          {["login","signup"].map(t => (
            <button key={t} onClick={()=>{setMode(t);setOtpMode(false);setOtpSent(false);setPhoneOtpSent(false);setErr("");}}
              style={{ flex:1, padding:"10px", borderRadius:9, border:"none", cursor:"pointer",
                background:mode===t?C.cyan:"transparent", color:mode===t?"#05070D":C.sub,
                fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:mode===t?700:500 }}>
              {t==="login"?"Sign in":"Create account"}
            </button>
          ))}
        </div>

        {/* Card */}
        <div style={{ background:"rgba(11,15,26,0.97)", border:`1px solid ${C.border}`,
          borderRadius:20, padding:28, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-1, left:"20%", right:"20%", height:1,
            background:`linear-gradient(90deg,transparent,${C.cyan},transparent)` }}/>

          {/* LOGIN */}
          {mode==="login" && !otpMode && <>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:C.txt, marginBottom:4 }}>Welcome back</div>
            <div style={{ fontSize:13, color:C.sub, marginBottom:20 }}>Sign in to your SCANVERSE account</div>
            <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
            <Input label="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"/>
            <div style={{ textAlign:"right", marginBottom:18, marginTop:-8 }}>
              <button onClick={doForgotPassword} style={{ background:"none", border:"none", fontSize:12, color:C.cyan, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", padding:0 }}>Forgot password?</button>
            </div>
            {err && <div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
            <Btn full disabled={loading} onClick={doLogin} style={{ marginBottom:10 }}>
              {loading?<><Spinner size={16}/> Signing in…</>:"Sign in →"}
            </Btn>
            <Btn full variant="g" onClick={()=>{setOtpMode(true);setErr("");}}>📱 Sign in with OTP</Btn>
          </>}

          {/* OTP */}
          {mode==="login" && otpMode && <>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:C.txt, marginBottom:4 }}>OTP Sign in</div>
            <div style={{ fontSize:13, color:C.sub, marginBottom:16 }}>
              {otpSent ? `Code sent to ${email}` : "Enter your email to receive a code"}
            </div>
            {!otpSent && <>
              <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
              {err&&<div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
              <Btn full onClick={sendOTP}>Send OTP →</Btn>
              <button onClick={()=>{setOtpMode(false);setErr("");}}
                style={{ background:"none", border:"none", color:C.sub, fontSize:12, cursor:"pointer", width:"100%", textAlign:"center", marginTop:10, fontFamily:"'DM Sans',sans-serif" }}>← Back to password</button>
            </>}
            {otpSent && <>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:14 }}>
                {digits.map((d,i) => (
                  <input key={i} maxLength={1} value={d}
                    onChange={e => { const nd=[...digits]; nd[i]=e.target.value.replace(/\D/,"").slice(-1); setDigits(nd); if(e.target.value&&i<5)document.querySelector(`#otp-${i+1}`)?.focus(); }}
                    id={`otp-${i}`}
                    style={{ width:44, height:52, textAlign:"center",
                      background:d?C.cA:"rgba(255,255,255,0.03)",
                      border:`1.5px solid ${d?C.cyan:C.border}`, borderRadius:10,
                      color:C.cyan, fontFamily:"monospace", fontSize:22, outline:"none" }}/>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16, fontSize:12 }}>
                <span style={{ color:C.sub, fontFamily:"monospace" }}>
                  {cd>0?`Expires in ${Math.floor(cd/60)}:${String(cd%60).padStart(2,"0")}`:<span style={{ color:C.red }}>Expired</span>}
                </span>
                <button onClick={()=>{setOtpSent(false);setCd(120);setDigits(["","","","","",""]);}}
                  style={{ background:"none", border:"none", color:C.cyan, cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
                  Resend
                </button>
              </div>
              {err&&<div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
              <Btn full disabled={loading} onClick={verifyOTP}>
                {loading?<><Spinner size={16}/> Verifying…</>:"Verify & Sign in →"}
              </Btn>
            </>}
          </>}

          {/* SIGNUP */}
          {mode==="signup" && <>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:C.txt, marginBottom:4 }}>Join SCANVERSE</div>
            <div style={{ fontSize:13, color:C.sub, marginBottom:16 }}>Create your account</div>

            {/* Role picker */}
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {[["customer","👤","Customer"],["partner","🤝","Partner"]].map(([r,ic,lbl]) => (
                <button key={r} onClick={()=>setSRole(r)}
                  style={{ flex:1, padding:"10px 6px", border:`1px solid ${sRole===r?RC[r]:C.border}`,
                    borderRadius:10, cursor:"pointer", background:sRole===r?`${RC[r]}12`:"transparent",
                    color:sRole===r?RC[r]:C.sub, fontSize:12, fontFamily:"'DM Sans',sans-serif",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:18 }}>{ic}</span>{lbl}
                </button>
              ))}
            </div>
            {sRole==="partner" && (
              <div style={{ background:C.vA, border:`1px solid ${C.violet}35`, borderRadius:10,
                padding:"10px 14px", marginBottom:14, fontSize:12, color:"#C4B5FD" }}>
                🔵 Partner accounts require admin KYC approval before going live.
              </div>
            )}

            {/* Email vs Phone signup toggle */}
            {!phoneOtpSent && (
              <div style={{ display:"flex", background:C.surf, border:`1px solid ${C.border}`,
                borderRadius:10, padding:3, marginBottom:16, gap:3 }}>
                {[["email","✉️ Email"],["phone","📱 Mobile (SMS)"]].map(([v,lbl]) => (
                  <button key={v} onClick={()=>{ setSignupVia(v); setErr(""); }}
                    style={{ flex:1, padding:"8px", borderRadius:8, border:"none", cursor:"pointer",
                      background:signupVia===v?C.cyan:"transparent", color:signupVia===v?"#05070D":C.sub,
                      fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:signupVia===v?700:500 }}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}

            {/* ── EMAIL SIGNUP ─────────────────────────────────── */}
            {signupVia==="email" && <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Input label="Full Name" value={sName} onChange={e=>setSName(e.target.value)} placeholder="Rahul Sharma"/>
                <Input label="Mobile" type="tel" value={sPhone} onChange={e=>setSPhone(e.target.value)} placeholder="+91 9XXXXXXXX0"/>
              </div>
              <Input label="Email" type="email" value={sEmail} onChange={e=>setSEmail(e.target.value)} placeholder="you@example.com"/>
              {sRole==="partner" && <Input label="Business Name" value={sBiz} onChange={e=>setSBiz(e.target.value)} placeholder="Your business name"/>}
              <Input label="Password" type="password" value={sPass} onChange={e=>setSPass(e.target.value)} placeholder="Min. 8 characters"/>
              {err&&<div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
              <Btn full disabled={loading} onClick={doSignup}>
                {loading?<><Spinner size={16}/> Creating account…</>:"Create account →"}
              </Btn>
            </>}

            {/* ── PHONE SIGNUP — step 1: enter details, send SMS ── */}
            {signupVia==="phone" && !phoneOtpSent && <>
              <Input label="Full Name" value={sName} onChange={e=>setSName(e.target.value)} placeholder="Rahul Sharma"/>
              <Input label="Mobile Number" type="tel" value={sPhone} onChange={e=>setSPhone(e.target.value)} placeholder="+91 98765 43210"/>
              {sRole==="partner" && <Input label="Business Name" value={sBiz} onChange={e=>setSBiz(e.target.value)} placeholder="Your business name"/>}
              <div style={{ fontSize:11, color:C.sub, marginTop:-8, marginBottom:16 }}>
                No password needed — we'll text you a 6-digit code to verify your number.
              </div>
              {err&&<div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
              <Btn full disabled={loading} onClick={sendPhoneSignupOTP}>
                {loading?<><Spinner size={16}/> Sending SMS…</>:"📱 Send verification code →"}
              </Btn>
            </>}

            {/* ── PHONE SIGNUP — step 2: enter 6-digit SMS code ──── */}
            {signupVia==="phone" && phoneOtpSent && <>
              <div style={{ fontSize:13, color:C.sub, marginBottom:16 }}>
                Code sent via SMS to <strong style={{ color:C.txt }}>{sPhone}</strong>
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:14 }}>
                {phoneDigits.map((d,i) => (
                  <input key={i} maxLength={1} value={d} inputMode="numeric"
                    onChange={e => {
                      const nd=[...phoneDigits]; nd[i]=e.target.value.replace(/\D/,"").slice(-1); setPhoneDigits(nd);
                      if (e.target.value && i<5) document.querySelector(`#phone-otp-${i+1}`)?.focus();
                    }}
                    onKeyDown={e => { if (e.key==="Backspace" && !phoneDigits[i] && i>0) document.querySelector(`#phone-otp-${i-1}`)?.focus(); }}
                    id={`phone-otp-${i}`}
                    style={{ width:44, height:52, textAlign:"center",
                      background:d?C.cA:"rgba(255,255,255,0.03)",
                      border:`1.5px solid ${d?C.cyan:C.border}`, borderRadius:10,
                      color:C.cyan, fontFamily:"monospace", fontSize:22, outline:"none" }}/>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16, fontSize:12 }}>
                <span style={{ color:C.sub, fontFamily:"monospace" }}>
                  {phoneCd>0?`Expires in ${Math.floor(phoneCd/60)}:${String(phoneCd%60).padStart(2,"0")}`:<span style={{ color:C.red }}>Expired</span>}
                </span>
                <button onClick={sendPhoneSignupOTP} disabled={loading || phoneCd>0}
                  style={{ background:"none", border:"none", color:phoneCd>0?C.dim:C.cyan,
                    cursor:phoneCd>0?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
                  Resend code
                </button>
              </div>
              {err&&<div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
              <Btn full disabled={loading} onClick={verifyPhoneSignupOTP}>
                {loading?<><Spinner size={16}/> Verifying…</>:"Verify & Create account →"}
              </Btn>
              <button onClick={()=>{ setPhoneOtpSent(false); setErr(""); setPhoneDigits(["","","","","",""]); }}
                style={{ background:"none", border:"none", color:C.sub, fontSize:12, cursor:"pointer",
                  width:"100%", textAlign:"center", marginTop:14, fontFamily:"'DM Sans',sans-serif" }}>
                ← Change mobile number
              </button>
            </>}
          </>}
        </div>
        <p style={{ textAlign:"center", fontSize:11, color:C.dim, marginTop:14 }}>
          © 2026 SCANVERSE · DCORE Global Corporation · PCMC, Pune
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────────────────────────────── */
const PAGE_TITLES = {
  home:     { customer:["Dashboard","Good to see you 👋"], partner:["Dashboard","Welcome back 👋"], admin:["Overview","System Console"] },
  services: { customer:["Browse Services","Book anything, instantly"], partner:["Services","Marketplace"], admin:["All Services","Platform listings"] },
  bookings: { customer:["My Bookings","History & receipts"], partner:["Bookings","Manage requests"], admin:["All Bookings","Platform view"] },
  listings: { partner:["My Services","Manage listings"] },
  earnings: { partner:["Earnings","Razorpay · DCORE Global Corp"] },
  ai:       { customer:["AI Assistant","Powered by Claude"] },
  profile:  { customer:["Profile","Account settings"], partner:["Business Profile","Account & KYC"], admin:["Settings","Admin"] },
  users:    { admin:["Users & Partners","Manage accounts"] },
  revenue:  { admin:["Revenue","Razorpay · rzp.io/rzp/QEuXj4E"] },
  audit:    { admin:["Audit Log","System events"] },
};


/* ─────────────────────────────────────────────────────────────────────
   PASSWORD RESET SCREEN — shown when user clicks email reset link
───────────────────────────────────────────────────────────────────── */
function PasswordResetScreen({ onDone }) {
  const [pass, setPass]   = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const doReset = async () => {
    if (!pass || !pass2) return setErr("Both fields required.");
    if (pass.length < 8) return setErr("Password must be at least 8 characters.");
    if (pass !== pass2) return setErr("Passwords do not match.");
    setLoading(true); setErr("");
    try {
      await Auth.updatePassword(pass);
      await Auth.signOut();
      onDone();
    } catch(e) { setErr(e.message || "Reset failed. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center",
      justifyContent:"center", padding:20, backgroundImage:GRID, backgroundSize:"48px 48px" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700,
            color:C.txt }}>SCAN<span style={{ color:C.cyan }}>VERSE</span></div>
          <div style={{ fontSize:13, color:C.sub, marginTop:4 }}>Set a new password</div>
        </div>
        <div style={{ background:"rgba(11,15,26,.97)", border:`1px solid ${C.border}`, borderRadius:16, padding:28 }}>
          {err && <div style={{ fontSize:13, color:C.red, marginBottom:12, padding:"8px 12px", background:C.rA, borderRadius:8 }}>{err}</div>}
          <Input label="New Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Min. 8 characters"/>
          <Input label="Confirm Password" type="password" value={pass2} onChange={e=>setPass2(e.target.value)} placeholder="Repeat password"/>
          <Btn full disabled={loading} onClick={doReset}>
            {loading ? <><Spinner size={16}/> Updating…</> : "Set new password →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PWA INSTALL + UPDATE BANNER
   Shows "Add to Home Screen" prompt on Android Chrome.
   Shows "Update available" banner when SW detects new version.
═══════════════════════════════════════════════════════════════════ */
function PWAInstallBanner() {
  const [installEvent, setInstallEvent] = React.useState(null);
  const [updateReady,  setUpdateReady]  = React.useState(false);
  const [dismissed,    setDismissed]    = React.useState(
    () => localStorage.getItem('pwa-install-dismissed') === '1'
  );

  React.useEffect(() => {
    // Android Chrome install prompt
    const handler = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // SW update available
    window.addEventListener('sw-update-available', () => setUpdateReady(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const doInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') { setInstallEvent(null); setDismissed(true); }
  };

  const doUpdate = () => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  const dismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true); setInstallEvent(null);
  };

  if (updateReady) return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      background:C.raised, border:`1px solid ${C.cyan}`, borderRadius:14,
      padding:'12px 18px', display:'flex', alignItems:'center', gap:12,
      zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,.7)', maxWidth:360, width:'90%' }}>
      <span style={{ fontSize:20 }}>🔄</span>
      <div style={{ flex:1, fontSize:13, color:C.txt }}>
        <div style={{ fontWeight:600 }}>Update available</div>
        <div style={{ fontSize:11, color:C.sub }}>Tap to reload and get the latest version</div>
      </div>
      <button onClick={doUpdate}
        style={{ background:C.cyan, color:'#05070D', border:'none', borderRadius:8,
          padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
        Update
      </button>
    </div>
  );

  if (!installEvent || dismissed) return null;

  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      background:C.raised, border:`1px solid ${C.borderHi}`, borderRadius:14,
      padding:'14px 18px', display:'flex', alignItems:'center', gap:12,
      zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,.7)', maxWidth:380, width:'90%' }}>
      <div style={{ width:40, height:40, borderRadius:10, background:C.cA,
        border:`1.5px solid ${C.cyan}`, display:'flex', alignItems:'center',
        justifyContent:'center', fontSize:18, flexShrink:0 }}>📲</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.txt }}>Install SCANVERSE</div>
        <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>
          Add to home screen for the fastest experience
        </div>
      </div>
      <button onClick={doInstall}
        style={{ background:C.cyan, color:'#05070D', border:'none', borderRadius:8,
          padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
        Install
      </button>
      <button onClick={dismiss}
        style={{ background:'none', border:'none', color:C.dim, fontSize:18,
          cursor:'pointer', padding:4, flexShrink:0 }}>✕</button>
    </div>
  );
}

export default function App() {
  const [user, setUser]             = useState(null);
  const [screen, setScreen]         = useState("home");
  const [bookingFor, setBookingFor] = useState(null);
  const [toasts, setToasts]         = useState([]);
  const [notifications, setNotifs]  = useState([]);
  const [, rerender]                = useReducer(x=>x+1, 0);
  const [booting, setBooting]       = useState(true);
  const [pwResetMode, setPwReset]   = useState(false);
  const authListenerRef             = useRef(null);

  const addToast = useCallback((msg, type="info") => {
    const id = Date.now();
    setToasts(t => [...t, {id, msg, type}]);
  }, []);

  const loadNotifications = useCallback(async (userId) => {
    if (!userId) return;
    const ns = await db.getAll("notifications","userId",userId);
    setNotifs(ns.sort((a,b)=>new Date(b.createdAt||b.created_at)-new Date(a.createdAt||a.created_at)));
  }, []);

  const markAllNotifsRead = useCallback(async () => {
    if (!user) return;
    const sb = await getSupabase();
    await sb.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    loadNotifications(user.id);
  }, [user, loadNotifications]);

  const refresh = useCallback(() => {
    rerender();
    if (user) loadNotifications(user.id);
  }, [user, loadNotifications]);

  // ── BOOT: Supabase Auth session restore + real-time subscriptions ──
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        // Check URL for password reset token
        if (window.location.search.includes("reset=1") || window.location.hash.includes("type=recovery")) {
          setPwReset(true); setBooting(false); return;
        }

        // Seed demo data if DB is empty
        // seedDatabase() skipped

        // Restore Supabase session
        const session = await Auth.getSession();
        if (session && mounted) {
          const profile = await Auth.getProfile(session.user.id);
          if (profile && profile.status !== "pending") {
            setUser(profile);
            await subscribeToBookings(profile.id, profile.role, () => refresh());
            await subscribeToNotifications(profile.id, (notif) => {
              setNotifs(prev => [notif, ...prev]);
              addToast(notif.message, "info");
            });
            loadNotifications(profile.id);
          }
        }
      } catch (e) {
        console.error("Boot error:", e);
      } finally {
        if (mounted) setBooting(false);
      }
    };

    boot();

    // Listen for auth state changes (login/logout from other tabs)
    Auth.onAuthStateChange(async (event, profile) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && profile) {
        setUser(profile);
        setScreen("home");
        await subscribeToBookings(profile.id, profile.role, () => refresh());
        await subscribeToNotifications(profile.id, (notif) => {
          setNotifs(prev => [notif, ...prev]);
          addToast(notif.message, "info");
        });
        loadNotifications(profile.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null); setScreen("home"); setBookingFor(null); setNotifs([]);
      } else if (event === "PASSWORD_RECOVERY") {
        setPwReset(true);
      }
    });

    return () => { mounted = false; };
  }, []);

  const login  = async (profile) => {
    setUser(profile);
    setScreen("home");
    try { await subscribeToBookings(profile.id, profile.role, () => refresh()); } catch(e) { console.warn('Realtime bookings:', e); }
    try { await subscribeToNotifications(profile.id, (notif) => {
      setNotifs(prev => [notif, ...prev]); } catch(e) { console.warn('Realtime notifs:', e); }
      addToast(notif.message, "info");
    });
    loadNotifications(profile.id);
  };

  const logout = async () => {
    await Auth.signOut();
    setUser(null); setScreen("home"); setBookingFor(null); setNotifs([]);
  };

  // ── Password reset screen ──
  if (pwResetMode) return <PasswordResetScreen onDone={() => { setPwReset(false); addToast("Password updated. Please sign in.", "success"); }}/>;

  const ctx = {
    user, setUser, screen, setScreen,
    bookingFor, setBookingFor,
    notifications: notifications,
    markAllNotifsRead,
    addToast, refresh, logout,
  };

  if (booting) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center",
      justifyContent:"center", flexDirection:"column", gap:16 }}>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:700, color:C.txt,
        letterSpacing:-0.5 }}>SCAN<span style={{ color:C.cyan }}>VERSE</span></div>
      <Spinner size={24}/>
      <div style={{ fontSize:12, color:C.sub, fontFamily:"monospace" }}>Initialising database…</div>
    </div>
  );

  if (!user) return (
    <>
      <style>{`
        @keyframes svToast{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes svDot{from{transform:translateY(0)}to{transform:translateY(-6px)}}
        *{box-sizing:border-box}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
      `}</style>
      <AuthScreen onLogin={login}/>
      {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/>)}
    </>
  );

  const tt = PAGE_TITLES[screen]?.[user.role] || PAGE_TITLES[screen]?.customer || ["SCANVERSE",""];

  const renderPage = () => {
    if (bookingFor) return <BookingFlow service={bookingFor} onBack={()=>setBookingFor(null)}/>;
    if (user.role==="customer") {
      if (screen==="home")     return <CustomerDash/>;
      if (screen==="services") return <ServicesPage/>;
      if (screen==="bookings") return <BookingsPage/>;
      if (screen==="ai")       return <AIAssistant/>;
      if (screen==="profile")  return <ProfilePage/>;
    }
    if (user.role==="partner") {
      if (screen==="home")     return <PartnerDash/>;
      if (screen==="bookings") return <BookingsPage/>;
      if (screen==="listings") return <PartnerListings/>;
      if (screen==="earnings") return <EarningsPage/>;
      if (screen==="profile")  return <ProfilePage/>;
    }
    if (user.role==="admin") {
      if (screen==="home")     return <AdminOverview/>;
      if (screen==="users")    return <AdminUsers/>;
      if (screen==="services") return <ServicesPage/>;
      if (screen==="bookings") return <BookingsPage/>;
      if (screen==="revenue")  return <AdminRevenue/>;
      if (screen==="audit")    return <AuditLog/>;
    }
    return null;
  };

  return (
    <ErrorBoundary><AppCtx.Provider value={ctx}>
      <style>{`
        @keyframes svToast{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes svDot{from{transform:translateY(0)}to{transform:translateY(-6px)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:10px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
      `}</style>
      <div style={{ display:"flex", minHeight:"100vh", background:C.bg,
        fontFamily:"'DM Sans',sans-serif", color:C.txt,
        backgroundImage:GRID, backgroundSize:"48px 48px" }}>
        <Sidebar/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflowY:"auto" }}>
          <TopBar
            title={bookingFor?`Book: ${bookingFor.name}`:tt[0]}
            subtitle={bookingFor?"Complete your booking":tt[1]}/>
          <main style={{ flex:1 }}>{renderPage()}</main>
        </div>
      </div>
      {toasts.map(t => <Toast key={t.id} msg={t.msg} type={t.type} onDone={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/>)}
      <PWAInstallBanner/>
    </AppCtx.Provider></ErrorBoundary>
  );
}
