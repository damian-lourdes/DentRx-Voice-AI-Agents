// /api/agent-action.js
// Supports three request shapes:
//  1) Vapi "API Request" tool (flat body): { "action": "book_appointment", "patient": "...", "phone": "...", ... }
//     Responds: { "result": "<string>" }
//  2) Vapi "Function" tool webhook: { "message": { "toolCalls": [ { "id": "...", "function": { "name": "...", "arguments": {...} } } ] } }
//     Responds: { "results": [ { "toolCallId": "...", "result": "<string>" } ] }
//  3) Direct curl testing: { "action": "book_appointment", "args": {...} }
//     Responds: { "result": "<string>" }
//
// NOTE ON TRIAL SMS: Twilio trial accounts can only send one of a fixed set
// of template names as the message `body` (no custom text). We send the
// required template name to Twilio so the SMS actually goes through, but we
// still store the real, personalized message text in Supabase - that's what
// the dashboard displays. Once Twilio billing is added, swap
// `sendSms(to, templateName)` calls below to pass `smsBody` instead.

import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

const TRIAL_TEMPLATES = {
  appointment: "sms_appointment_reminders",
  billing: "sms_account_alerts",
};

function newId(prefix) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function sendSms(to, templateName) {
  try {
    await twilioClient.messages.create({ to, from: FROM_NUMBER, body: templateName });
    return "Delivered";
  } catch (err) {
    console.error("SMS send failed:", err.message);
    return "Failed";
  }
}

const MOCK_CLAIMS = {
  "PR-44821": { status: "Paid by Delta Dental", balance: 42.0 },
  "JO-11029": { status: "In process", balance: null },
};

async function bookAppointment(args) {
  const { patient, phone, provider = "Dr. Patel", date, time, type = "Cleaning" } = args;
  const apptId = newId("A");
  const callId = newId("C");

  await supabase.from("appointments").insert({
    id: apptId, patient, provider, date, time, type, status: "Confirmed", source: "AI",
  });

  await supabase.from("calls").insert({
    id: callId, patient, phone, direction: "inbound", intent: "Book appointment",
    provider, duration: 0, outcome: "Booked", resolved_by: "AI",
    transcript: [{ s: "system", t: 0, text: `Booked ${type} with ${provider} on ${date} at ${time}.` }],
  });

  const smsBody = `Hi ${patient}, your ${type} with ${provider} is confirmed for ${date} at ${time}. Reply to this text if you need to reschedule.`;
  const smsStatus = await sendSms(phone, TRIAL_TEMPLATES.appointment);
  await supabase.from("messages").insert({
    id: newId("M"), patient, phone, type: "Booking confirmation",
    body: smsBody, status: smsStatus, related_call: callId,
  });

  return `Booked ${type} with ${provider} on ${date} at ${time}.`;
}

async function cancelAppointment(args) {
  const { patient, phone } = args;

  const { data: appts } = await supabase
    .from("appointments").select("*").ilike("patient", `%${patient}%`).limit(1);

  if (!appts || appts.length === 0) {
    return `No upcoming appointment found for ${patient}.`;
  }

  const appt = appts[0];
  await supabase.from("appointments").update({ status: "Cancelled" }).eq("id", appt.id);

  const callId = newId("C");
  await supabase.from("calls").insert({
    id: callId, patient, phone, direction: "inbound", intent: "Cancel appointment",
    provider: appt.provider, duration: 0, outcome: "Cancelled", resolved_by: "AI",
    transcript: [{ s: "system", t: 0, text: `Cancelled ${appt.type} with ${appt.provider} on ${appt.date}.` }],
  });

  const smsBody = `Hi ${patient}, your appointment on ${appt.date} at ${appt.time} has been cancelled. Call us anytime to rebook.`;
  const smsStatus = await sendSms(phone, TRIAL_TEMPLATES.appointment);
  await supabase.from("messages").insert({
    id: newId("M"), patient, phone, type: "Cancellation confirmation",
    body: smsBody, status: smsStatus, related_call: callId,
  });

  return `Cancelled the ${appt.type} on ${appt.date} at ${appt.time}.`;
}

async function checkClaimStatus(args) {
  const { patient, phone, insurance_id } = args;
  const claim = MOCK_CLAIMS[insurance_id];

  const callId = newId("C");
  const resultText = claim
    ? `Claim status: ${claim.status}.${claim.balance ? ` Balance after insurance: $${claim.balance.toFixed(2)}.` : ""}`
    : "No claim found for that insurance ID.";

  await supabase.from("calls").insert({
    id: callId, patient, phone, direction: "inbound", intent: "Insurance / billing",
    provider: "-", duration: 0, outcome: claim ? "Claim status provided" : "No claim found", resolved_by: "AI",
    transcript: [{ s: "system", t: 0, text: resultText }],
  });

  if (claim && claim.balance) {
    const smsBody = `Hi ${patient}, you have a balance of $${claim.balance.toFixed(2)} after insurance. Pay securely: [demo payment link]`;
    const smsStatus = await sendSms(phone, TRIAL_TEMPLATES.billing);
    await supabase.from("messages").insert({
      id: newId("M"), patient, phone, type: "Payment link",
      body: smsBody, status: smsStatus, related_call: callId,
    });
  }

  return resultText;
}

const ACTIONS = {
  book_appointment: bookAppointment,
  cancel_appointment: cancelAppointment,
  check_claim_status: checkClaimStatus,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = req.body || {};

    // Shape 2: Vapi "Function" tool webhook
    const toolCalls = body.message?.toolCalls;
    if (Array.isArray(toolCalls)) {
      const results = [];
      for (const call of toolCalls) {
        const fnName = call.function?.name;
        const fnArgs = call.function?.arguments || {};
        const handlerFn = ACTIONS[fnName];
        let resultText;
        if (!handlerFn) {
          resultText = `Unknown action: ${fnName}`;
        } else {
          try {
            resultText = await handlerFn(fnArgs);
          } catch (err) {
            console.error(err);
            resultText = `Error handling ${fnName}: ${err.message}`;
          }
        }
        results.push({ toolCallId: call.id, result: resultText });
      }
      return res.status(200).json({ results });
    }

    // Shape 1 (Vapi API Request tool, flat body) and Shape 3 (curl testing, nested args)
    const { action, args } = body;
    const handlerFn = ACTIONS[action];
    if (!handlerFn) return res.status(400).json({ error: `Unknown action: ${action}` });

    // If "args" is present and is an object, use it (shape 3). Otherwise treat every
    // other top-level key as the args (shape 1 - Vapi's flat API Request body).
    const finalArgs = args && typeof args === "object"
      ? args
      : Object.fromEntries(Object.entries(body).filter(([k]) => k !== "action"));

    const result = await handlerFn(finalArgs);
    return res.status(200).json({ result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
