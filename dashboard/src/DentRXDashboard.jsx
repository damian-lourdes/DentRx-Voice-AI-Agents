import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard, PhoneCall, ListChecks, CalendarDays, AlertCircle,
  Play, Pause, PhoneIncoming, PhoneOutgoing, Search, ChevronDown,
  Bot, User, Clock, CheckCircle2, XCircle, AlertTriangle, Download,
  Mic, Filter, X, TrendingUp, TrendingDown, MessageSquare, Check,
  CheckCheck, RotateCw, Plus, Ban, ArrowUpRight, Trash2,
  Mail, Lock, Eye, EyeOff, LogOut
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

/* ---------------------------------------------------------
   TOKENS
   bg canvas   #F6F7F9   surface #FFFFFF   ink #12172B
   accent(human calm)  teal   #0F6E63
   accent(ai voice)    violet #6D5EF5
   danger              #D64545   success #1E8E5A   warn #C88A1E
   hairline            #E4E7EC
   display: Space Grotesk / body: Inter / data: JetBrains Mono
--------------------------------------------------------- */

const COLORS = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  ink: "#12172B",
  sub: "#6B7280",
  teal: "#0F6E63",
  tealSoft: "#E4F1EF",
  violet: "#6D5EF5",
  violetSoft: "#EDEBFE",
  danger: "#D64545",
  dangerSoft: "#FBEAEA",
  success: "#1E8E5A",
  successSoft: "#E8F5EE",
  warn: "#C88A1E",
  warnSoft: "#FBF2E2",
  hairline: "#E4E7EC",
};

/* ---------------- seeded PRNG for deterministic waveforms ---------------- */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function genWave(id, n, lane) {
  const rnd = mulberry32(hashSeed(id + lane));
  const bars = [];
  let v = 0.3;
  for (let i = 0; i < n; i++) {
    v = Math.max(0.08, Math.min(1, v + (rnd() - 0.5) * 0.6));
    // patient/agent lanes talk in turns -> silence stretches
    const gate = rnd();
    bars.push(gate > 0.72 ? 0.04 : v);
  }
  return bars;
}

/* ---------------------------------------------------------
   SEED DATA
--------------------------------------------------------- */
const CALLS = [
  {
    id: "C-10231",
    patient: "Maria Gonzalez",
    phone: "(860) 555-0148",
    direction: "inbound",
    intent: "Book appointment",
    provider: "Dr. Patel",
    time: "2026-08-10T08:12:00",
    duration: 96,
    outcome: "Booked",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Thanks for calling Riverside Dental, this is the scheduling assistant. Can I get your name?" },
      { s: "patient", t: 5, text: "Hi, it's Maria Gonzalez. I need to book a cleaning." },
      { s: "agent", t: 10, text: "Happy to help, Maria. Best callback number, is it this one ending 0148?" },
      { s: "patient", t: 16, text: "Yes that's right." },
      { s: "agent", t: 20, text: "What date were you hoping for?" },
      { s: "patient", t: 24, text: "Sometime next Tuesday if possible." },
      { s: "agent", t: 29, text: "Tuesday the 11th, Dr. Patel has 9:15am or 2:40pm open." },
      { s: "patient", t: 37, text: "2:40 works better for me." },
      { s: "agent", t: 41, text: "Booked for Tuesday, Aug 11 at 2:40pm with Dr. Patel. I'll text a confirmation now." },
      { s: "patient", t: 50, text: "Perfect, thank you!" },
    ],
  },
  {
    id: "C-10232",
    patient: "James Okafor",
    phone: "(860) 555-0177",
    direction: "inbound",
    intent: "Cancel appointment",
    provider: "Dr. Lin",
    time: "2026-08-10T08:41:00",
    duration: 64,
    outcome: "Cancelled",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental scheduling assistant, how can I help?" },
      { s: "patient", t: 4, text: "I need to cancel my appointment tomorrow." },
      { s: "agent", t: 8, text: "Sure, can I get your name and phone number?" },
      { s: "patient", t: 12, text: "James Okafor, 860 555 0177." },
      { s: "agent", t: 18, text: "I see a cleaning with Dr. Lin tomorrow at 10:30am. Is that the one?" },
      { s: "patient", t: 25, text: "Yes, that's it." },
      { s: "agent", t: 29, text: "Cancelled. Want me to look at rebooking, or should I just send the cancellation confirmation?" },
      { s: "patient", t: 37, text: "Just cancel for now, I'll call back." },
      { s: "agent", t: 41, text: "Done, confirmation is on its way by text." },
    ],
  },
  {
    id: "C-10233",
    patient: "Priya Ramaswami",
    phone: "(860) 555-0193",
    direction: "inbound",
    intent: "Insurance / billing",
    provider: "-",
    time: "2026-08-10T09:03:00",
    duration: 142,
    outcome: "Claim status provided",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help today?" },
      { s: "patient", t: 4, text: "I wanted to check if my insurance claim went through for my last visit." },
      { s: "agent", t: 10, text: "I can check that. Name, phone, and insurance member ID please." },
      { s: "patient", t: 16, text: "Priya Ramaswami, 860 555 0193, member ID PR central 44821." },
      { s: "agent", t: 27, text: "One moment... your claim for the July 22nd visit was processed and paid by Delta Dental." },
      { s: "patient", t: 36, text: "Great, do I still owe anything?" },
      { s: "agent", t: 40, text: "Yes, there's a patient responsibility balance of $42.00 after insurance." },
      { s: "patient", t: 47, text: "Can you text me a way to pay that?" },
      { s: "agent", t: 51, text: "Sending a secure payment link to your phone now." },
    ],
  },
  {
    id: "C-10234",
    patient: "Unknown caller",
    phone: "(203) 555-0910",
    direction: "inbound",
    intent: "Emergency triage",
    provider: "On-call: Dr. Patel",
    time: "2026-08-10T09:22:00",
    duration: 38,
    outcome: "Escalated - transferred",
    resolvedBy: "Human",
    tag: "danger",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help?" },
      { s: "patient", t: 3, text: "My son fell and his tooth is bleeding a lot, what do I do?" },
      { s: "agent", t: 8, text: "I understand, this sounds urgent. I'm connecting you to our on-call dentist right now, please stay on the line." },
      { s: "system", t: 13, text: "Call transferred to on-call staff (Dr. Patel)." },
    ],
  },
  {
    id: "C-10235",
    patient: "Robert Fields",
    phone: "(860) 555-0055",
    direction: "outbound",
    intent: "Reminder call",
    provider: "Dr. Lin",
    time: "2026-08-10T10:00:00",
    duration: 51,
    outcome: "Confirmed",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Hi, this is a reminder call from Riverside Dental for Robert Fields." },
      { s: "patient", t: 5, text: "Yes speaking." },
      { s: "agent", t: 7, text: "You have a cleaning with Dr. Lin tomorrow at 3:00pm. Will you be able to make it?" },
      { s: "patient", t: 15, text: "Yes I'll be there." },
      { s: "agent", t: 18, text: "Great, see you then. Reply to the text if anything changes." },
    ],
  },
  {
    id: "C-10236",
    patient: "Angela Brooks",
    phone: "(860) 555-0271",
    direction: "inbound",
    intent: "New patient intake",
    provider: "Dr. Patel",
    time: "2026-08-10T10:31:00",
    duration: 187,
    outcome: "Registered + booked",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Thanks for calling Riverside Dental, are you an existing patient with us?" },
      { s: "patient", t: 5, text: "No, first time. I just moved to the area." },
      { s: "agent", t: 9, text: "Welcome. Let's get you set up - can I get your full name and date of birth?" },
      { s: "patient", t: 15, text: "Angela Brooks, March 4th 1991." },
      { s: "agent", t: 21, text: "And do you have dental insurance you'd like on file?" },
      { s: "patient", t: 26, text: "Yes, Cigna." },
      { s: "agent", t: 29, text: "I've pre-registered you. I'll text a link for your new patient forms. What brings you in?" },
      { s: "patient", t: 38, text: "Just a general checkup and cleaning." },
      { s: "agent", t: 42, text: "Dr. Patel has Thursday at 11am or Friday at 1:30pm." },
      { s: "patient", t: 50, text: "Friday works." },
      { s: "agent", t: 53, text: "Booked for Friday at 1:30pm. Forms link is on its way." },
    ],
  },
  {
    id: "C-10237",
    patient: "Tom Whitfield",
    phone: "(860) 555-0304",
    direction: "inbound",
    intent: "General inquiry",
    provider: "-",
    time: "2026-08-10T11:05:00",
    duration: 29,
    outcome: "Info provided",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help?" },
      { s: "patient", t: 3, text: "Do you guys take MetLife?" },
      { s: "agent", t: 6, text: "Yes, we're in-network with MetLife, Delta Dental, and Cigna." },
      { s: "patient", t: 12, text: "Great, and what are your hours on Saturday?" },
      { s: "agent", t: 15, text: "We're open Saturdays 9am to 1pm." },
      { s: "patient", t: 20, text: "Perfect, thanks." },
    ],
  },
  {
    id: "C-10238",
    patient: "Denise Carter",
    phone: "(860) 555-0442",
    direction: "inbound",
    intent: "Prescription / post-op",
    provider: "Dr. Lin",
    time: "2026-08-10T11:40:00",
    duration: 47,
    outcome: "Escalated - clinical queue",
    resolvedBy: "Human",
    tag: "warn",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help?" },
      { s: "patient", t: 3, text: "I had a extraction Tuesday and the pain medication isn't lasting, can I get a refill?" },
      { s: "agent", t: 10, text: "I can't approve medication changes, but I'll pass this to Dr. Lin's clinical team right away with your details." },
      { s: "patient", t: 18, text: "Okay, how soon will someone call back?" },
      { s: "agent", t: 21, text: "Typically within the hour. I've flagged it as priority given the post-op context." },
    ],
  },
  {
    id: "C-10239",
    patient: "Wei Zhang",
    phone: "(860) 555-0518",
    direction: "inbound",
    intent: "Book appointment",
    provider: "Dr. Lin",
    time: "2026-08-10T12:15:00",
    duration: 88,
    outcome: "Booked (next available)",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help?" },
      { s: "patient", t: 3, text: "I need a checkup, is anything open this Thursday?" },
      { s: "agent", t: 8, text: "Thursday is fully booked with Dr. Lin. The next opening is Monday the 17th." },
      { s: "patient", t: 15, text: "Hmm, nothing sooner at all?" },
      { s: "agent", t: 18, text: "There's a cancellation slot next Friday the 14th at 8am if that works." },
      { s: "patient", t: 25, text: "Yes, I'll take that." },
      { s: "agent", t: 28, text: "Booked for Friday, Aug 14 at 8:00am. Confirmation text is on its way." },
    ],
  },
  {
    id: "C-10240",
    patient: "Sarah Nguyen",
    phone: "(860) 555-0629",
    direction: "outbound",
    intent: "Balance reminder",
    provider: "-",
    time: "2026-08-10T12:50:00",
    duration: 34,
    outcome: "Payment link sent",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Hi, this is Riverside Dental calling about an outstanding balance for Sarah Nguyen." },
      { s: "patient", t: 5, text: "Oh right, how much is it?" },
      { s: "agent", t: 8, text: "$68.00 remaining after insurance from your June 3rd visit." },
      { s: "patient", t: 14, text: "Can you text me a link to pay it?" },
      { s: "agent", t: 17, text: "Sending that now, thanks for confirming." },
    ],
  },
  {
    id: "C-10241",
    patient: "Marcus Bell",
    phone: "(860) 555-0812",
    direction: "inbound",
    intent: "Book appointment",
    provider: "Dr. Patel",
    time: "2026-08-10T13:22:00",
    duration: 73,
    outcome: "Booked",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Thanks for calling Riverside Dental, this is the scheduling assistant. How can I help?" },
      { s: "patient", t: 4, text: "Hey, I chipped a tooth and want to get it looked at." },
      { s: "agent", t: 8, text: "Sorry to hear that. Can I get your name and a callback number?" },
      { s: "patient", t: 13, text: "Marcus Bell, 860 555 0812." },
      { s: "agent", t: 18, text: "Dr. Patel has an opening tomorrow at 9:40am, or Thursday at 4:00pm." },
      { s: "patient", t: 25, text: "Tomorrow morning works." },
      { s: "agent", t: 28, text: "Booked for tomorrow, Aug 11 at 9:40am with Dr. Patel. Confirmation text on its way." },
    ],
  },
  {
    id: "C-10242",
    patient: "Grace Kim",
    phone: "(860) 555-0367",
    direction: "inbound",
    intent: "Reminder call",
    provider: "Dr. Lin",
    time: "2026-08-10T14:05:00",
    duration: 42,
    outcome: "Confirmed",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Hi, this is a reminder call from Riverside Dental for Grace Kim." },
      { s: "patient", t: 5, text: "Yes, that's me." },
      { s: "agent", t: 7, text: "You have a checkup with Dr. Lin this Friday at 8:30am. Will that still work?" },
      { s: "patient", t: 14, text: "Yes, I'll be there." },
      { s: "agent", t: 16, text: "Great, see you then." },
    ],
  },
  {
    id: "C-10243",
    patient: "David Alonso",
    phone: "(860) 555-0429",
    direction: "inbound",
    intent: "Insurance / billing",
    provider: "-",
    time: "2026-08-10T14:47:00",
    duration: 118,
    outcome: "Claim status provided",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help today?" },
      { s: "patient", t: 4, text: "I'm trying to find out about a claim from a couple weeks ago." },
      { s: "agent", t: 9, text: "I can check that. Name, phone, and insurance member ID please." },
      { s: "patient", t: 15, text: "David Alonso, 860 555 0429, member ID JO 11029." },
      { s: "agent", t: 24, text: "One moment... that claim is still in process with your insurer, no balance is due yet." },
      { s: "patient", t: 33, text: "Okay, how long does that usually take?" },
      { s: "agent", t: 37, text: "Typically 2 to 3 weeks. I'll text you a summary for your records." },
    ],
  },
  {
    id: "C-10244",
    patient: "Unknown caller",
    phone: "(860) 555-0958",
    direction: "inbound",
    intent: "General inquiry",
    provider: "-",
    time: "2026-08-10T15:18:00",
    duration: 21,
    outcome: "Info provided",
    resolvedBy: "AI",
    tag: "success",
    transcript: [
      { s: "agent", t: 0, text: "Riverside Dental assistant, how can I help?" },
      { s: "patient", t: 3, text: "What's your address?" },
      { s: "agent", t: 5, text: "We're at 142 Riverside Ave, West Hartford. Anything else?" },
      { s: "patient", t: 10, text: "Nope, that's all, thanks." },
    ],
  },
];

const APPOINTMENTS = [
  { id: "A-501", patient: "Maria Gonzalez", provider: "Dr. Patel", date: "2026-08-11", time: "2:40 PM", type: "Cleaning", status: "Confirmed", source: "AI" },
  { id: "A-502", patient: "Angela Brooks", provider: "Dr. Patel", date: "2026-08-14", time: "1:30 PM", type: "New patient exam", status: "Confirmed", source: "AI" },
  { id: "A-503", patient: "Robert Fields", provider: "Dr. Lin", date: "2026-08-13", time: "3:00 PM", type: "Cleaning", status: "Confirmed", source: "AI" },
  { id: "A-504", patient: "Wei Zhang", provider: "Dr. Lin", date: "2026-08-14", time: "8:00 AM", type: "Checkup", status: "Confirmed", source: "AI" },
  { id: "A-505", patient: "Deepak Iyer", provider: "Dr. Patel", date: "2026-08-13", time: "10:15 AM", type: "Filling", status: "Confirmed", source: "Front desk" },
  { id: "A-506", patient: "Lucy Martins", provider: "Dr. Lin", date: "2026-08-13", time: "11:00 AM", type: "Cleaning", status: "Confirmed", source: "AI" },
  { id: "A-507", patient: "Marcus Bell", provider: "Dr. Patel", date: "2026-08-11", time: "9:40 AM", type: "Emergency exam", status: "Confirmed", source: "AI" },
];

const APPT_DURATION_MIN = {
  Cleaning: 30,
  Checkup: 30,
  "New patient exam": 60,
  Filling: 45,
};

const PROVIDER_COLORS = {
  "Dr. Patel": { fg: "#0F6E63", bg: "#E4F1EF" },
  "Dr. Lin": { fg: "#2E7DB8", bg: "#E7F1FA" },
};

const MESSAGES = [
  {
    id: "M-1", patient: "Maria Gonzalez", phone: "(860) 555-0148", type: "Booking confirmation",
    time: "2026-08-10T08:13:00", status: "Read", relatedCall: "C-10231",
    body: "Riverside Dental: You're confirmed for Tue Aug 11 at 2:40 PM with Dr. Patel. Reply C to cancel.",
  },
  {
    id: "M-2", patient: "James Okafor", phone: "(860) 555-0177", type: "Cancellation confirmation",
    time: "2026-08-10T08:42:00", status: "Delivered", relatedCall: "C-10232",
    body: "Riverside Dental: Your appointment on Sat Aug 8 at 10:30 AM has been cancelled. Call anytime to rebook.",
  },
  {
    id: "M-3", patient: "Priya Ramaswami", phone: "(860) 555-0193", type: "Payment link",
    time: "2026-08-10T09:06:00", status: "Read", relatedCall: "C-10233",
    body: "Riverside Dental: Balance of $42.00 due after insurance. Pay securely: pay.riversidedental.com/x92j4",
  },
  {
    id: "M-4", patient: "Angela Brooks", phone: "(860) 555-0271", type: "New patient forms",
    time: "2026-08-10T10:33:00", status: "Delivered", relatedCall: "C-10236",
    body: "Welcome to Riverside Dental! Complete your new patient forms before your visit: forms.riversidedental.com/ab771",
  },
  {
    id: "M-5", patient: "Angela Brooks", phone: "(860) 555-0271", type: "Booking confirmation",
    time: "2026-08-10T10:34:00", status: "Delivered", relatedCall: "C-10236",
    body: "Riverside Dental: You're confirmed for Fri Aug 14 at 1:30 PM with Dr. Patel.",
  },
  {
    id: "M-6", patient: "Robert Fields", phone: "(860) 555-0055", type: "Reminder",
    time: "2026-08-10T10:01:00", status: "Read", relatedCall: "C-10235",
    body: "Riverside Dental: Reminder - cleaning tomorrow Sat Aug 8 at 3:00 PM with Dr. Lin. Reply Y to confirm.",
  },
  {
    id: "M-7", patient: "Wei Zhang", phone: "(860) 555-0518", type: "Booking confirmation",
    time: "2026-08-10T12:16:00", status: "Delivered", relatedCall: "C-10239",
    body: "Riverside Dental: You're confirmed for Fri Aug 14 at 8:00 AM with Dr. Lin (next available slot).",
  },
  {
    id: "M-8", patient: "Sarah Nguyen", phone: "(860) 555-0629", type: "Payment link",
    time: "2026-08-10T12:51:00", status: "Failed", relatedCall: "C-10240",
    body: "Riverside Dental: Balance of $68.00 due after insurance. Pay securely: pay.riversidedental.com/n55k1",
  },
  {
    id: "M-9", patient: "Lucy Martins", phone: "(860) 555-0733", type: "Reminder",
    time: "2026-08-09T09:00:00", status: "Delivered", relatedCall: null,
    body: "Riverside Dental: Reminder - cleaning tomorrow Sat Aug 8 at 11:00 AM with Dr. Lin. Reply Y to confirm.",
  },
  {
    id: "M-10", patient: "Marcus Bell", phone: "(860) 555-0812", type: "Booking confirmation",
    time: "2026-08-10T13:23:00", status: "Delivered", relatedCall: "C-10241",
    body: "Riverside Dental: You're confirmed for Tue Aug 11 at 9:40 AM with Dr. Patel.",
  },
  {
    id: "M-11", patient: "Grace Kim", phone: "(860) 555-0367", type: "Reminder",
    time: "2026-08-10T14:06:00", status: "Read", relatedCall: "C-10242",
    body: "Riverside Dental: Reminder - checkup Fri Aug 14 at 8:30 AM with Dr. Lin. Reply Y to confirm.",
  },
  {
    id: "M-12", patient: "David Alonso", phone: "(860) 555-0429", type: "Claim summary",
    time: "2026-08-10T14:49:00", status: "Delivered", relatedCall: "C-10243",
    body: "Riverside Dental: Your claim (member ID JO-11029) is in process with your insurer, no balance due yet.",
  },
];

const INTENT_COLORS = {
  "Book appointment": COLORS.teal,
  "Cancel appointment": COLORS.warn,
  "Insurance / billing": COLORS.violet,
  "Emergency triage": COLORS.danger,
  "Reminder call": COLORS.sub,
  "New patient intake": "#2E9CCA",
  "General inquiry": "#8A8FA3",
  "Prescription / post-op": COLORS.warn,
  "Balance reminder": COLORS.violet,
};

/* ---------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------- */
function Pill({ tone = "sub", children }) {
  const map = {
    success: { bg: COLORS.successSoft, fg: COLORS.success },
    danger: { bg: COLORS.dangerSoft, fg: COLORS.danger },
    warn: { bg: COLORS.warnSoft, fg: COLORS.warn },
    ai: { bg: COLORS.violetSoft, fg: COLORS.violet },
    human: { bg: COLORS.tealSoft, fg: COLORS.teal },
    sub: { bg: "#EEF0F3", fg: COLORS.sub },
  };
  const c = map[tone] || map.sub;
  return (
    <span
      style={{ background: c.bg, color: c.fg }}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
    >
      {children}
    </span>
  );
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(18,23,43,0.45)" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.surface, width, maxWidth: "100%" }}
        className="rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
          <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</div>
          <button onClick={onClose} style={{ color: COLORS.sub }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block mb-3.5">
      <div className="text-xs font-medium mb-1.5" style={{ color: COLORS.sub }}>{label}</div>
      {children}
    </label>
  );
}
const fieldStyle = {
  border: `1px solid ${COLORS.hairline}`,
  background: COLORS.bg,
};

/* ---------------------------------------------------------
   DUAL WAVEFORM PLAYER (simulated two-way recording)
--------------------------------------------------------- */
/* ---------------------------------------------------------
   BROWSER TEXT-TO-SPEECH — real, audible call playback
--------------------------------------------------------- */
function useSpeechVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  return voices;
}

function CallRecordingPlayer({ call }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const voices = useSpeechVoices();
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const cancelledRef = useRef(false);

  const agentWave = useMemo(() => genWave(call.id, 64, "agent"), [call.id]);
  const patientWave = useMemo(() => genWave(call.id, 64, "patient"), [call.id]);

  const enVoices = useMemo(() => voices.filter((v) => v.lang?.startsWith("en")), [voices]);
  const pool = enVoices.length ? enVoices : voices;
  const agentVoice = useMemo(
    () => pool.find((v) => /male|david|alex|daniel|fred|guy/i.test(v.name)) || pool[0] || null,
    [pool]
  );
  const patientVoice = useMemo(() => {
    const preferred = pool.find((v) => /female|samantha|victoria|karen|zira|susan|aria/i.test(v.name));
    if (preferred) return preferred;
    return pool.length > 1 ? pool.find((v) => v !== agentVoice) || pool[1] : pool[0] || null;
  }, [pool, agentVoice]);

  const stopPlayback = () => {
    cancelledRef.current = true;
    if (supported) window.speechSynthesis.cancel();
    setPlaying(false);
    setActiveIndex(-1);
  };

  const playFrom = (startIdx) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    setPlaying(true);
    const lines = call.transcript;
    const speakNext = (idx) => {
      if (cancelledRef.current || idx >= lines.length) {
        setPlaying(false);
        setActiveIndex(-1);
        return;
      }
      const line = lines[idx];
      setActiveIndex(idx);
      const utter = new SpeechSynthesisUtterance(line.text);
      utter.lang = "en-US";
      if (line.s === "agent") {
        if (agentVoice) utter.voice = agentVoice;
        utter.pitch = 0.9; utter.rate = 1.03;
      } else if (line.s === "patient") {
        if (patientVoice) utter.voice = patientVoice;
        utter.pitch = 1.15; utter.rate = 1.0;
      } else {
        utter.pitch = 1; utter.rate = 0.95; utter.volume = 0.75;
      }
      utter.onend = () => speakNext(idx + 1);
      utter.onerror = () => { setPlaying(false); setActiveIndex(-1); };
      window.speechSynthesis.speak(utter);
    };
    // small delay avoids a known Chrome bug where speak() right after cancel() is dropped
    setTimeout(() => speakNext(startIdx), 30);
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (supported) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = activeIndex >= 0 ? (activeIndex + 1) / call.transcript.length : 0;
  const currentSec = progress * call.duration;

  const Wave = ({ bars, color, label, icon }) => (
    <div className="flex items-center gap-2">
      <div className="w-16 shrink-0 flex items-center gap-1 text-xs font-medium" style={{ color }}>
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-[2px] h-8 flex-1 overflow-hidden">
        {bars.map((h, i) => {
          const barPos = i / bars.length;
          const isPast = barPos <= progress;
          return (
            <div
              key={i}
              style={{
                height: `${Math.max(8, h * 100)}%`,
                background: isPast ? color : "#DDE1E8",
                width: 3,
                borderRadius: 2,
                transition: "background 0.1s linear",
              }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      style={{ border: `1px solid ${COLORS.hairline}`, background: "#FBFBFC" }}
      className="rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.sub }}>
          <Mic size={13} />
          TWO-WAY RECORDING · VOICE PLAYBACK
        </div>
        <button
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: COLORS.teal }}
          onClick={() => alert("Mock action: recording download would start here.")}
        >
          <Download size={13} /> Download
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        <Wave bars={agentWave} color={COLORS.violet} label="AI agent" icon={<Bot size={13} />} />
        <Wave bars={patientWave} color={COLORS.teal} label="Patient" icon={<User size={13} />} />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => (playing ? stopPlayback() : playFrom(0))}
          disabled={!supported}
          style={{ background: supported ? COLORS.ink : COLORS.hairline }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 disabled:cursor-not-allowed"
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-[#E4E7EC] relative">
          <div
            style={{ width: `${progress * 100}%`, background: COLORS.ink }}
            className="h-full rounded-full"
          />
        </div>
        <div className="text-xs font-mono w-20 text-right" style={{ color: COLORS.sub }}>
          {fmtDur(Math.floor(currentSec))} / {fmtDur(call.duration)}
        </div>
      </div>

      <div className="text-[11px] mt-2" style={{ color: COLORS.sub }}>
        {supported
          ? "Voice preview — your browser reads this transcript aloud, distinct voices per speaker. Not the original call audio."
          : "Voice playback isn't supported in this browser. The transcript below is still fully readable."}
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
        <div className="text-xs font-mono mb-2" style={{ color: COLORS.sub }}>TRANSCRIPT</div>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {call.transcript.map((line, i) => {
            const isActive = playing && i === activeIndex;
            const isSystem = line.s === "system";
            return (
              <div
                key={i}
                className="flex gap-2 text-sm rounded-lg px-2 py-1.5 transition-colors"
                style={{
                  background: isActive ? COLORS.tealSoft : "transparent",
                }}
              >
                {!isSystem && (
                  <div className="shrink-0 mt-0.5" style={{ color: line.s === "agent" ? COLORS.violet : COLORS.teal }}>
                    {line.s === "agent" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                )}
                <div>
                  {!isSystem ? (
                    <>
                      <span className="font-medium" style={{ color: COLORS.ink }}>
                        {line.s === "agent" ? "AI Agent" : call.patient.split(" ")[0]}:{" "}
                      </span>
                      <span style={{ color: COLORS.sub }}>{line.text}</span>
                    </>
                  ) : (
                    <span className="italic text-xs" style={{ color: COLORS.warn }}>{line.text}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   CALL LOG ROW
--------------------------------------------------------- */
function CallRow({ call, expanded, onToggle }) {
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-3.5 px-1 text-left hover:bg-[#FAFAFB] transition-colors"
      >
        <div className="shrink-0" style={{ color: call.direction === "inbound" ? COLORS.teal : COLORS.violet }}>
          {call.direction === "inbound" ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
        </div>
        <div className="w-40 shrink-0">
          <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{call.patient}</div>
          <div className="text-xs font-mono" style={{ color: COLORS.sub }}>{call.phone}</div>
        </div>
        <div className="w-40 shrink-0 hidden md:block">
          <span className="text-sm" style={{ color: COLORS.ink }}>{call.intent}</span>
        </div>
        <div className="flex-1 hidden lg:block">
          <Pill tone={call.tag}>{call.outcome}</Pill>
        </div>
        <div className="w-20 shrink-0 hidden sm:block">
          <Pill tone={call.resolvedBy === "AI" ? "ai" : "human"}>
            {call.resolvedBy === "AI" ? <Bot size={11} /> : <User size={11} />}
            {call.resolvedBy}
          </Pill>
        </div>
        <div className="w-16 shrink-0 text-xs font-mono text-right" style={{ color: COLORS.sub }}>
          {fmtDur(call.duration)}
        </div>
        <div className="w-20 shrink-0 text-xs font-mono text-right" style={{ color: COLORS.sub }}>
          {fmtTime(call.time)}
        </div>
        <ChevronDown
          size={16}
          style={{ color: COLORS.sub, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {expanded && (
        <div className="pb-4 px-1">
          <CallRecordingPlayer call={call} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   GLASS STAT CARDS (glassmorphic: frosted translucent panels
   over a dark backdrop with blurred color orbs)
--------------------------------------------------------- */
const GLASS_TEXT = COLORS.ink;
const GLASS_TEXT_SOFT = COLORS.sub;
const GLASS_BG = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.9)";
const GLASS_BADGE_BG = "rgba(18,23,43,0.06)";
const GLASS_SHADOW = "0 8px 24px rgba(18,23,43,0.06)";

function BentoIconBadge({ icon }) {
  return (
    <div style={{ background: GLASS_BADGE_BG }} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
      <span style={{ color: GLASS_TEXT }}>{icon}</span>
    </div>
  );
}

function BentoHero({ label, icon, value, valueIcon, caption, sub, progress, avatars }) {
  return (
    <div style={{ background: GLASS_BG, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }} className="relative z-10 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: GLASS_TEXT_SOFT }}>{label}</div>
        <BentoIconBadge icon={icon} />
      </div>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span style={{ color: GLASS_TEXT }}>{valueIcon}</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", color: GLASS_TEXT }} className="text-5xl font-bold leading-none">
            {value}
          </span>
        </div>
        <div className="text-right text-sm" style={{ color: GLASS_TEXT }}>
          <div style={{ color: GLASS_TEXT_SOFT }}>{caption}</div>
          {sub && <div className="font-semibold">{sub}</div>}
        </div>
      </div>
      {typeof progress === "number" && (
        <div className="h-2 rounded-full mb-4" style={{ background: "rgba(18,23,43,0.08)" }}>
          <div style={{ width: `${progress}%`, background: GLASS_TEXT }} className="h-full rounded-full" />
        </div>
      )}
      {avatars && (
        <div className="flex items-center -space-x-2">
          {avatars.map((initials, i) => (
            <div
              key={i}
              style={{ background: COLORS.ink, border: "2px solid rgba(255,255,255,0.9)", color: "#fff" }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
            >
              {initials}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BentoStat({ label, icon, value, caption, sub }) {
  return (
    <div style={{ background: GLASS_BG, border: GLASS_BORDER, boxShadow: GLASS_SHADOW, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }} className="relative z-10 rounded-3xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: GLASS_TEXT_SOFT }}>{label}</div>
        <BentoIconBadge icon={icon} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: GLASS_TEXT }} className="text-3xl font-bold leading-none mb-3">
        {value}
      </div>
      <div className="mt-auto text-xs" style={{ color: GLASS_TEXT_SOFT }}>
        {caption}
        {sub && <div className="font-semibold mt-0.5" style={{ color: GLASS_TEXT }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   PAGES
--------------------------------------------------------- */
function OverviewPage({ onNavigate }) {
  const intentData = useMemo(() => {
    const counts = {};
    CALLS.forEach((c) => { counts[c.intent] = (counts[c.intent] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const hourData = useMemo(() => {
    const counts = {};
    CALLS.forEach((c) => {
      const h = new Date(c.time).getHours();
      const label = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([hour, calls]) => ({ hour, calls }));
  }, []);

  const providerData = useMemo(() => {
    const counts = {};
    APPOINTMENTS.forEach((a) => { counts[a.provider] = (counts[a.provider] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const aiResolved = CALLS.filter((c) => c.resolvedBy === "AI").length;
  const resolutionRate = Math.round((aiResolved / CALLS.length) * 100);
  const avgDur = Math.round(CALLS.reduce((a, c) => a + c.duration, 0) / CALLS.length);
  const bookedCount = CALLS.filter((c) => /book/i.test(c.outcome)).length;
  const exceptionsCount = CALLS.filter((c) => c.resolvedBy === "Human").length;

  const msgCounts = { Read: 0, Delivered: 0, Failed: 0 };
  MESSAGES.forEach((m) => { msgCounts[m.status] = (msgCounts[m.status] || 0) + 1; });
  const msgTotal = MESSAGES.length;

  const outstandingFlagged = MESSAGES
    .filter((m) => m.type === "Payment link")
    .reduce((sum, m) => {
      const match = m.body.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
      return sum + (match ? parseFloat(match[1]) : 0);
    }, 0);

  const recentInitials = CALLS.slice(0, 5).map((c) =>
    c.patient.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BentoHero
          label="Calls handled today"
          icon={<PhoneCall size={15} />}
          valueIcon={<Bot size={22} />}
          value={CALLS.length}
          caption={`AI resolved ${aiResolved} of ${CALLS.length} calls`}
          sub={`#${resolutionRate}% resolution rate`}
          progress={resolutionRate}
          avatars={recentInitials}
        />

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <BentoStat
            label="Time"
            icon={<Clock size={15} />}
            value={fmtDur(avgDur)}
            caption="Avg handle time, front desk baseline 9:40"
            sub="34% faster"
          />
          <BentoStat
            label="No-shows"
            icon={<CheckCircle2 size={15} />}
            value="6"
            caption="Prevented via reminder calls this week"
            sub="19% fewer no-shows"
          />
          <BentoStat
            label="Booked via AI"
            icon={<CalendarDays size={15} />}
            value={bookedCount}
            caption="Appointments booked with zero front-desk time"
            sub="Top intent this week"
          />
          <BentoStat
            label="Balance flagged"
            icon={<MessageSquare size={15} />}
            value={`$${outstandingFlagged.toFixed(0)}`}
            caption="Sent to patients via secure payment link"
            sub="2 patients notified"
          />
          <BentoStat
            label="Needs attention"
            icon={<AlertTriangle size={15} />}
            value={exceptionsCount}
            caption="Calls escalated to front desk / clinical staff"
            sub={exceptionsCount > 0 ? "Open in Exceptions" : "All clear"}
          />
          <BentoStat
            label="Messages sent"
            icon={<Check size={15} />}
            value={msgTotal}
            caption="Confirmations, reminders and payment links"
            sub={`${msgCounts.Read + msgCounts.Delivered} delivered`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Calls by intent</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={intentData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {intentData.map((entry, i) => (
                    <Cell key={i} fill={INTENT_COLORS[entry.name] || COLORS.sub} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {intentData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.sub }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: INTENT_COLORS[d.name] || COLORS.sub, display: "inline-block" }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5 lg:col-span-3">
          <div className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Call volume by hour</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ left: -20 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: COLORS.sub }} axisLine={{ stroke: COLORS.hairline }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.sub }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: COLORS.bg }} />
                <Bar dataKey="calls" fill={COLORS.violet} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
          <div className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Live call queue</div>
          <div className="space-y-3">
            {CALLS.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <div style={{ color: c.direction === "inbound" ? COLORS.teal : COLORS.violet }}>
                  {c.direction === "inbound" ? <PhoneIncoming size={14} /> : <PhoneOutgoing size={14} />}
                </div>
                <div className="flex-1 truncate" style={{ color: COLORS.ink }}>{c.patient}</div>
                <Pill tone={c.tag}>{c.outcome}</Pill>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
          <div className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>Provider booking split</div>
          <div className="space-y-3 mb-2">
            {providerData.map((p) => {
              const c = PROVIDER_COLORS[p.name] || { fg: COLORS.sub };
              const pct = Math.round((p.value / APPOINTMENTS.length) * 100);
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1" style={{ color: COLORS.sub }}>
                    <span style={{ color: COLORS.ink, fontWeight: 500 }}>{p.name}</span>
                    <span>{p.value} appts · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: COLORS.bg }}>
                    <div style={{ width: `${pct}%`, background: c.fg }} className="h-full rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs pt-2" style={{ color: COLORS.sub, borderTop: `1px solid ${COLORS.hairline}` }}>
            {APPOINTMENTS.length} appointments on the calendar this week
          </div>
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium" style={{ color: COLORS.ink }}>Needs attention</div>
            {exceptionsCount > 0 && (
              <span style={{ background: COLORS.dangerSoft, color: COLORS.danger }} className="text-xs font-semibold rounded-full px-2 py-0.5">
                {exceptionsCount}
              </span>
            )}
          </div>
          <div className="space-y-2 mb-4">
            {CALLS.filter((c) => c.resolvedBy === "Human").map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <AlertTriangle size={13} style={{ color: COLORS.danger }} className="shrink-0" />
                <span className="truncate" style={{ color: COLORS.ink }}>{c.patient} · {c.intent}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate && onNavigate("exceptions")}
            className="w-full text-xs font-medium px-3 py-2 rounded-lg mb-4"
            style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.ink }}
          >
            Open exception queue
          </button>

          <div className="text-xs font-medium mb-2" style={{ color: COLORS.ink }}>Message delivery</div>
          <div className="flex h-2 rounded-full overflow-hidden mb-2" style={{ background: COLORS.bg }}>
            <div style={{ width: `${(msgCounts.Read / msgTotal) * 100}%`, background: COLORS.teal }} />
            <div style={{ width: `${(msgCounts.Delivered / msgTotal) * 100}%`, background: COLORS.violet }} />
            <div style={{ width: `${(msgCounts.Failed / msgTotal) * 100}%`, background: COLORS.danger }} />
          </div>
          <div className="flex justify-between text-[11px]" style={{ color: COLORS.sub }}>
            <span>{msgCounts.Read} read</span>
            <span>{msgCounts.Delivered} delivered</span>
            <span style={{ color: msgCounts.Failed ? COLORS.danger : COLORS.sub }}>{msgCounts.Failed} failed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallLogsPage({ focusCallId, focusNonce }) {
  const [expandedId, setExpandedId] = useState("C-10233");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (focusCallId) setExpandedId(focusCallId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  const filtered = CALLS.filter((c) => {
    const matchesQ = (c.patient + c.phone + c.intent).toLowerCase().includes(query.toLowerCase());
    const matchesF = filter === "all" || (filter === "ai" && c.resolvedBy === "AI") || (filter === "human" && c.resolvedBy === "Human");
    return matchesQ && matchesF;
  });

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="text-sm font-medium flex-1" style={{ color: COLORS.ink }}>
          Call logs <span style={{ color: COLORS.sub, fontWeight: 400 }}>· {filtered.length} calls</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${COLORS.hairline}` }}>
          <Search size={14} style={{ color: COLORS.sub }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, phone, intent..."
            className="text-sm outline-none bg-transparent w-48"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: COLORS.bg }}>
          {[["all", "All"], ["ai", "AI"], ["human", "Human"]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: filter === k ? COLORS.surface : "transparent",
                color: filter === k ? COLORS.ink : COLORS.sub,
                boxShadow: filter === k ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        {filtered.map((c) => (
          <CallRow
            key={c.id}
            call={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
          />
        ))}
      </div>
    </div>
  );
}

const MSG_TYPE_TONE = {
  "Booking confirmation": "success",
  "Cancellation confirmation": "warn",
  "Payment link": "ai",
  "Reminder": "human",
  "New patient forms": "ai",
};

function MessageStatus({ status }) {
  if (status === "Read")
    return <span className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.teal }}><CheckCheck size={13} /> Read</span>;
  if (status === "Delivered")
    return <span className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.sub }}><Check size={13} /> Delivered</span>;
  return <span className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.danger }}><XCircle size={13} /> Failed</span>;
}

function MessagesPage({ onViewCall }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const sorted = [...MESSAGES].sort((a, b) => new Date(b.time) - new Date(a.time));
  const filtered = sorted.filter((m) => (m.patient + m.phone + m.type).toLowerCase().includes(query.toLowerCase()));
  const failedCount = MESSAGES.filter((m) => m.status === "Failed").length;

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="text-sm font-medium flex-1" style={{ color: COLORS.ink }}>
          Message history <span style={{ color: COLORS.sub, fontWeight: 400 }}>· {filtered.length} sent</span>
          {failedCount > 0 && (
            <span style={{ color: COLORS.danger, fontWeight: 500 }} className="ml-2 text-xs">
              · {failedCount} failed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${COLORS.hairline}` }}>
          <Search size={14} style={{ color: COLORS.sub }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, phone, type..."
            className="text-sm outline-none bg-transparent w-48"
          />
        </div>
      </div>

      <div>
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className="w-full flex items-start gap-4 py-3.5 text-left hover:bg-[#FAFAFB] transition-colors rounded-lg px-1"
            style={{ borderBottom: `1px solid ${COLORS.hairline}` }}
          >
            <div style={{ background: COLORS.bg }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare size={14} style={{ color: COLORS.sub }} />
            </div>
            <div className="w-40 shrink-0">
              <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{m.patient}</div>
              <div className="text-xs font-mono" style={{ color: COLORS.sub }}>{m.phone}</div>
            </div>
            <div className="w-44 shrink-0 hidden sm:block">
              <Pill tone={MSG_TYPE_TONE[m.type] || "sub"}>{m.type}</Pill>
            </div>
            <div className="flex-1 text-sm min-w-0" style={{ color: COLORS.sub }}>
              <span className="line-clamp-1">{m.body}</span>
            </div>
            <div className="w-24 shrink-0 hidden md:flex justify-end">
              <MessageStatus status={m.status} />
            </div>
            <div className="w-16 shrink-0 text-xs font-mono text-right" style={{ color: COLORS.sub }}>
              {fmtTime(m.time)}
            </div>
            {m.status === "Failed" ? (
              <span
                onClick={(e) => { e.stopPropagation(); alert("Mock action: message would be resent here."); }}
                className="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
                style={{ color: COLORS.danger, border: `1px solid ${COLORS.dangerSoft}` }}
              >
                <RotateCw size={12} /> Retry
              </span>
            ) : (
              <span className="shrink-0 w-6" />
            )}
          </button>
        ))}
      </div>

      {selected && (
        <Modal title="Message" onClose={() => setSelected(null)}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{selected.patient}</div>
              <div className="text-xs font-mono" style={{ color: COLORS.sub }}>{selected.phone}</div>
            </div>
            <Pill tone={MSG_TYPE_TONE[selected.type] || "sub"}>{selected.type}</Pill>
          </div>

          <div style={{ background: COLORS.tealSoft, borderTopLeftRadius: 4 }} className="rounded-2xl px-4 py-3 mb-3 text-sm" >
            <span style={{ color: COLORS.ink }}>{selected.body}</span>
          </div>

          <div className="flex items-center justify-between text-xs mb-4" style={{ color: COLORS.sub }}>
            <span>Sent {new Date(selected.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <MessageStatus status={selected.status} />
          </div>

          {selected.status === "Failed" && (
            <button
              onClick={() => alert("Mock action: message would be resent here.")}
              className="w-full mb-2 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
              style={{ color: COLORS.danger, border: `1px solid ${COLORS.dangerSoft}`, background: COLORS.dangerSoft }}
            >
              <RotateCw size={13} /> Resend message
            </button>
          )}

          {selected.relatedCall && (
            <button
              onClick={() => { onViewCall && onViewCall(selected.relatedCall); setSelected(null); }}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg"
              style={{ color: COLORS.teal, border: `1px solid ${COLORS.hairline}` }}
            >
              View related call {selected.relatedCall} <ArrowUpRight size={13} />
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   CALENDAR (practice appointment calendar)
--------------------------------------------------------- */
function parseTimeToHours(timeStr) {
  const [time, meridian] = timeStr.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (meridian === "PM" && h !== 12) h += 12;
  if (meridian === "AM" && h === 12) h = 0;
  return h + m / 60;
}

const CAL_DAYS = ["2026-08-08", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"];
const CAL_START_HOUR = 8;
const CAL_END_HOUR = 17;
const ROW_H = 52;
const APPT_TYPES = ["Cleaning", "Checkup", "New patient exam", "Filling"];
const EMPTY_FORM = { patient: "", provider: "Dr. Patel", date: CAL_DAYS[0], time: "9:00 AM", type: "Cleaning" };

function AddAppointmentModal({ onClose, onAdd }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    if (!form.patient.trim()) return;
    onAdd({ ...form, id: `A-${Math.floor(1000 + Math.random() * 9000)}`, status: "Confirmed", source: "Front desk" });
    onClose();
  };

  return (
    <Modal title="Add appointment" onClose={onClose}>
      <FormField label="Patient name">
        <input style={fieldStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none" value={form.patient} onChange={set("patient")} placeholder="e.g. Nina Patel" autoFocus />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Provider">
          <select style={fieldStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none" value={form.provider} onChange={set("provider")}>
            {Object.keys(PROVIDER_COLORS).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Appointment type">
          <select style={fieldStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none" value={form.type} onChange={set("type")}>
            {APPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date">
          <select style={fieldStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none" value={form.date} onChange={set("date")}>
            {CAL_DAYS.map((d) => (
              <option key={d} value={d}>
                {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Time">
          <input style={fieldStyle} className="w-full rounded-lg px-3 py-2 text-sm outline-none" value={form.time} onChange={set("time")} placeholder="9:00 AM" />
        </FormField>
      </div>
      <button
        onClick={submit}
        style={{ background: COLORS.ink }}
        className="w-full mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-white px-3 py-2.5 rounded-lg"
      >
        <Plus size={14} /> Add to calendar
      </button>
    </Modal>
  );
}

function CalendarPage() {
  const [appointments, setAppointments] = useState(APPOINTMENTS);
  const [blocked, setBlocked] = useState(new Set()); // keys "date|hour"
  const [showAdd, setShowAdd] = useState(false);
  const hours = [];
  for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) hours.push(h);

  const toggleBlocked = (dateStr, hour) => {
    const key = `${dateStr}|${hour}`;
    setBlocked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="text-sm font-medium" style={{ color: COLORS.ink }}>
            Practice calendar <span style={{ color: COLORS.sub, fontWeight: 400 }}>· Aug 8 - Aug 14, 2026</span>
          </div>
          <div className="flex items-center gap-4">
            {Object.entries(PROVIDER_COLORS).map(([name, c]) => (
              <div key={name} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: COLORS.sub }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: c.fg, display: "inline-block" }} />
                {name}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: COLORS.sub }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "repeating-linear-gradient(45deg,#D8DAE1,#D8DAE1 2px,#EEF0F3 2px,#EEF0F3 4px)", display: "inline-block" }} />
              Unavailable
            </div>
            <button
              onClick={() => setShowAdd(true)}
              style={{ background: COLORS.ink }}
              className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-2 rounded-lg"
            >
              <Plus size={13} /> Add appointment
            </button>
          </div>
        </div>

        <div className="text-xs mb-3" style={{ color: COLORS.sub }}>
          Click an empty slot to mark it unavailable, click again to reopen it.
        </div>

        <div className="flex overflow-x-auto">
          {/* hour labels */}
          <div className="shrink-0 w-14 pt-8">
            {hours.map((h) => (
              <div key={h} style={{ height: ROW_H }} className="text-[11px] font-mono text-right pr-2 -mt-2" >
                <span style={{ color: COLORS.sub }}>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? "am" : "pm"}</span>
              </div>
            ))}
          </div>

          {CAL_DAYS.map((dateStr) => {
            const d = new Date(dateStr + "T12:00:00");
            const dayApts = appointments.filter((a) => a.date === dateStr);
            return (
              <div key={dateStr} className="flex-1 min-w-[130px]" style={{ borderLeft: `1px solid ${COLORS.hairline}` }}>
                <div className="text-center pb-2 h-8">
                  <div className="text-xs font-medium" style={{ color: COLORS.ink }}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: COLORS.sub }}>
                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
                <div className="relative" style={{ height: hours.length * ROW_H }}>
                  {hours.map((h, i) => {
                    const key = `${dateStr}|${h}`;
                    const isBlocked = blocked.has(key);
                    return (
                      <div
                        key={h}
                        onClick={() => toggleBlocked(dateStr, h)}
                        style={{
                          top: i * ROW_H, height: ROW_H,
                          borderTop: `1px solid ${COLORS.hairline}`,
                          background: isBlocked
                            ? "repeating-linear-gradient(45deg,#EDEEF1,#EDEEF1 5px,#E1E3E8 5px,#E1E3E8 10px)"
                            : "transparent",
                        }}
                        className="absolute left-0 right-0 cursor-pointer flex items-center justify-center group"
                      >
                        {isBlocked && (
                          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: COLORS.sub }}>
                            <Ban size={10} /> Unavailable
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {dayApts.map((a) => {
                    const startH = parseTimeToHours(a.time);
                    const durMin = APPT_DURATION_MIN[a.type] || 30;
                    const top = (startH - CAL_START_HOUR) * ROW_H;
                    const height = (durMin / 60) * ROW_H;
                    const c = PROVIDER_COLORS[a.provider] || { fg: COLORS.sub, bg: "#EEF0F3" };
                    return (
                      <div
                        key={a.id}
                        style={{
                          top: top + 2, height: height - 4, left: 3, right: 3,
                          background: c.bg, borderLeft: `3px solid ${c.fg}`,
                        }}
                        className="absolute rounded-md px-2 py-1 overflow-hidden"
                      >
                        <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: c.fg }}>{a.patient}</div>
                        <div className="text-[10px] leading-tight truncate" style={{ color: c.fg, opacity: 0.85 }}>{a.time} · {a.type}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
        <div className="text-sm font-medium mb-4" style={{ color: COLORS.ink }}>
          Agenda list <span style={{ color: COLORS.sub, fontWeight: 400 }}>· {appointments.length} appointments</span>
        </div>
        <div className="space-y-2">
          {[...appointments]
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
            .map((a) => (
              <div key={a.id} className="flex items-center gap-4 py-3 text-sm" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
                <div className="w-24 font-mono text-xs" style={{ color: COLORS.sub }}>{a.date}</div>
                <div className="w-20 font-mono text-xs" style={{ color: COLORS.sub }}>{a.time}</div>
                <div className="w-36 font-medium" style={{ color: COLORS.ink }}>{a.patient}</div>
                <div className="w-28 hidden sm:block" style={{ color: COLORS.sub }}>{a.provider}</div>
                <div className="flex-1 hidden md:block" style={{ color: COLORS.sub }}>{a.type}</div>
                <Pill tone={a.source === "AI" ? "ai" : "human"}>{a.source === "AI" ? <Bot size={11} /> : <User size={11} />}{a.source}</Pill>
                <Pill tone="success">{a.status}</Pill>
              </div>
            ))}
        </div>
      </div>

      {showAdd && (
        <AddAppointmentModal
          onClose={() => setShowAdd(false)}
          onAdd={(newAppt) => setAppointments((prev) => [...prev, newAppt])}
        />
      )}
    </div>
  );
}

function ExceptionsPage() {
  const exceptions = CALLS.filter((c) => c.resolvedBy === "Human");
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.hairline}` }} className="rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle size={16} style={{ color: COLORS.danger }} />
        <div className="text-sm font-medium" style={{ color: COLORS.ink }}>Exception queue - needs front desk follow-up</div>
      </div>
      <div className="space-y-3">
        {exceptions.map((c) => (
          <div key={c.id} style={{ background: COLORS.dangerSoft }} className="rounded-xl p-4 flex items-center gap-4">
            <AlertTriangle size={16} style={{ color: COLORS.danger }} className="shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{c.patient} · {c.intent}</div>
              <div className="text-xs" style={{ color: COLORS.sub }}>{c.outcome} — {fmtTime(c.time)}</div>
            </div>
            <button style={{ background: COLORS.ink }} className="text-white text-xs font-medium px-3 py-1.5 rounded-lg">
              Follow up
            </button>
          </div>
        ))}
        {exceptions.length === 0 && <div className="text-sm" style={{ color: COLORS.sub }}>No open exceptions.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   LOGIN
--------------------------------------------------------- */
const DEMO_CREDENTIALS = { email: "frontdesk@riversidedental.com", password: "demo1234" };

function AmbientWaveform() {
  // A wider ambient version of the logo mark's pulse, used as the login panel's signature element
  const bars = useMemo(() => {
    const rnd = mulberry32(hashSeed("ambient-login"));
    return Array.from({ length: 28 }, () => 10 + rnd() * 46);
  }, []);
  return (
    <div className="flex items-end gap-[3px] h-16">
      {bars.map((h, i) => (
        <span
          key={i}
          className="dl-wave-bar"
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            background: "rgba(255,255,255,0.28)",
            animationDelay: `${(i % 9) * 110}ms`,
          }}
        />
      ))}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fillDemo = () => {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    // Simulated auth check against demo credentials
    setTimeout(() => {
      if (email.trim().toLowerCase() === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
        onLogin();
      } else {
        setError("Check your email and password and try again.");
        setSubmitting(false);
      }
    }, 450);
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div
        style={{ background: COLORS.ink, width: 440 }}
        className="hidden md:flex flex-col justify-between p-10 shrink-0 relative overflow-hidden"
      >
        <div className="flex items-center gap-2.5">
          <div
            style={{ background: "linear-gradient(135deg, #7C6FF7, #5445D6)" }}
            className="w-9 h-9 rounded-xl flex items-center justify-center gap-[3px] shrink-0"
          >
            <span className="dl-logo-bar" style={{ animationDelay: "0ms" }} />
            <span className="dl-logo-bar" style={{ animationDelay: "180ms" }} />
            <span className="dl-logo-bar" style={{ animationDelay: "90ms" }} />
            <span className="dl-logo-bar" style={{ animationDelay: "270ms" }} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-semibold text-lg tracking-tight">
            DentRX
          </div>
        </div>

        <div>
          <AmbientWaveform />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white text-3xl font-semibold leading-tight mt-6 max-w-xs">
            Every call, answered.
          </div>
          <div className="text-sm mt-3 max-w-xs" style={{ color: "#A7ADC2" }}>
            Voice AI that books, reschedules, and triages for Riverside Dental — logged, transcribed, and ready when your front desk needs it.
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.06)" }} className="rounded-xl p-3.5 w-fit">
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ background: COLORS.success }} className="w-2 h-2 rounded-full inline-block" />
            <span className="text-xs font-medium text-white">AI agent online</span>
          </div>
          <div className="text-[11px]" style={{ color: "#8890A6" }}>Answering all lines · 2 active calls</div>
        </div>
      </div>

      {/* Form panel */}
      <div style={{ background: COLORS.bg }} className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex items-center gap-2.5 mb-6 justify-center">
            <div
              style={{ background: "linear-gradient(135deg, #7C6FF7, #5445D6)" }}
              className="w-9 h-9 rounded-xl flex items-center justify-center gap-[3px] shrink-0"
            >
              <span className="dl-logo-bar" style={{ animationDelay: "0ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "180ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "90ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "270ms" }} />
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="font-semibold text-lg tracking-tight" >
              DentRX
            </div>
          </div>

          <div
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.hairline}`,
              boxShadow: "0 1px 2px rgba(18,23,43,0.04), 0 12px 32px rgba(18,23,43,0.07)",
            }}
            className="rounded-2xl p-7"
          >
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="text-2xl font-semibold">
              Sign in to Riverside Dental
            </div>
            <div className="text-sm mt-1.5 mb-7" style={{ color: COLORS.sub }}>
              Access your call, messaging, and scheduling dashboard.
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: COLORS.ink }}>Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.sub }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@riversidedental.com"
                  style={{ borderColor: COLORS.hairline, background: COLORS.surface, color: COLORS.ink }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2"
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${COLORS.violetSoft}`)}
                  onBlur={(e) => (e.target.style.boxShadow = "none")}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium block" style={{ color: COLORS.ink }}>Password</label>
                <button type="button" className="text-xs font-medium" style={{ color: COLORS.teal }}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.sub }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  style={{ borderColor: COLORS.hairline, background: COLORS.surface, color: COLORS.ink }}
                  className="w-full pl-9 pr-9 py-2.5 rounded-lg border text-sm outline-none"
                  onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${COLORS.violetSoft}`)}
                  onBlur={(e) => (e.target.style.boxShadow = "none")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.sub }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: COLORS.dangerSoft, color: COLORS.danger }} className="text-xs font-medium px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ background: "linear-gradient(135deg, #7C6FF7, #5445D6)", opacity: submitting ? 0.75 : 1 }}
              className="w-full text-white text-sm font-semibold py-2.5 rounded-lg mt-1 transition-opacity"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

            <div style={{ borderTop: `1px solid ${COLORS.hairline}` }} className="mt-6 pt-5 flex items-center justify-between">
              <div className="text-xs" style={{ color: COLORS.sub }}>
                Demo build — no real patient data.
              </div>
              <button onClick={fillDemo} className="text-xs font-medium" style={{ color: COLORS.violet }}>
                Use demo credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   APP SHELL
--------------------------------------------------------- */
const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "calls", label: "Call logs", icon: PhoneCall },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "exceptions", label: "Exceptions", icon: ListChecks },
];

export default function DentRXDashboard() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [tab, setTab] = useState("calls");
  const [focusCallId, setFocusCallId] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const viewCall = (callId) => {
    setTab("calls");
    setFocusCallId(callId);
    setFocusNonce((n) => n + 1);
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .dl-logo-bar { width: 3px; background: #fff; border-radius: 2px; height: 8px; animation: dlPulse 1.2s ease-in-out infinite; }
        @keyframes dlPulse { 0%, 100% { height: 6px; } 50% { height: 16px; } }
        .dl-wave-bar { display: inline-block; animation: dlWave 1.6s ease-in-out infinite; transform-origin: bottom; }
        @keyframes dlWave { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) {
          .dl-logo-bar { animation: none; height: 12px; }
          .dl-wave-bar { animation: none; transform: scaleY(0.8); }
        }
      `}</style>

      {!isAuthed ? (
        <LoginScreen onLogin={() => setIsAuthed(true)} />
      ) : (
      <div className="flex">
        {/* Sidebar */}
        <div style={{ background: COLORS.ink, width: 232 }} className="shrink-0 min-h-screen p-5 hidden md:flex flex-col">
          <div className="flex items-center gap-2.5 mb-8 px-1">
            <div
              style={{ background: "linear-gradient(135deg, #7C6FF7, #5445D6)" }}
              className="w-9 h-9 rounded-xl flex items-center justify-center gap-[3px] shrink-0"
            >
              <span className="dl-logo-bar" style={{ animationDelay: "0ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "180ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "90ms" }} />
              <span className="dl-logo-bar" style={{ animationDelay: "270ms" }} />
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-white font-semibold text-lg tracking-tight">
              DentRX
            </div>
          </div>

          <div className="text-xs uppercase tracking-wider px-2 mb-2" style={{ color: "#8890A6" }}>Riverside Dental</div>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = tab === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setTab(n.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    color: active ? "#fff" : "#A7ADC2",
                  }}
                >
                  <Icon size={16} />
                  {n.label}
                  {n.key === "exceptions" && (
                    <span style={{ background: COLORS.danger }} className="ml-auto text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                      {CALLS.filter((c) => c.resolvedBy === "Human").length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <div style={{ background: "rgba(255,255,255,0.06)" }} className="rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ background: COLORS.success }} className="w-2 h-2 rounded-full inline-block" />
                <span className="text-xs font-medium text-white">AI agent online</span>
              </div>
              <div className="text-[11px]" style={{ color: "#8890A6" }}>Answering all lines · 2 active calls</div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.hairline}` }} className="px-6 py-4 flex items-center justify-between">
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-xl font-semibold" >
                {NAV.find((n) => n.key === tab)?.label}
              </div>
              <div className="text-xs" style={{ color: COLORS.sub }}>Monday, August 10 2026</div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg" style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.ink }}>
                <Filter size={13} /> Filters
              </button>
              <button
                onClick={() => setIsAuthed(false)}
                title="Sign out"
                style={{ background: COLORS.violet }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold hover:opacity-90 transition-opacity group relative"
              >
                <span className="group-hover:hidden">FD</span>
                <LogOut size={13} className="hidden group-hover:block" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {tab === "overview" && <OverviewPage onNavigate={setTab} />}
            {tab === "calls" && <CallLogsPage focusCallId={focusCallId} focusNonce={focusNonce} />}
            {tab === "messages" && <MessagesPage onViewCall={viewCall} />}
            {tab === "calendar" && <CalendarPage />}
            {tab === "exceptions" && <ExceptionsPage />}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
