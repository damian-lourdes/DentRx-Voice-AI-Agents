// /api/agent-action.js
// Single endpoint Vapi calls as a "tool" during the live conversation.
// Routes by `action`, writes to Supabase, sends SMS via Twilio.
//
// NOTE ON TRIAL SMS: Twilio trial accounts can only send one of a fixed set
// of template names as the message `body` (no custom text). We send the
// required template name to Twilio so the SMS actually goes through, but we
// still store the real, personalized message text in Supabase - that's what
// the dashboard displays to the client. Once the Twilio account is upgraded
// (billing added), swap `sendSms(to, templateName)` calls below to pass the
// real `smsBody` text instead and the actual texts will match the dashboard.

import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side only, never expose this key to the client
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER; // your Twilio trial number, e.g. +17372508034

// Twilio trial accounts require the SMS body to be one of these exact template names.
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

// Mock claim data for the trial - swap for a real clearinghouse/payer API later
const MOCK_CLAIMS = {
  "PR-44821": { status: "Paid by Delta Dental", balance: 42.0 },
  "JO-11029": { status: "In process", balance: null },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { action, args = {} } = req.body;

  try {
    if (action === "book_appointment") {
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

      return res.status(200).json({ result: `Booked ${type} with ${provider} on ${date} at ${time}.` });
    }

    if (action === "cancel_appointment") {
      const { patient, phone } = args;

      const { data: appts } = await supabase
        .from("appointments").select("*").ilike("patient", `%${patient}%`).limit(1);

      if (!appts || appts.length === 0) {
        return res.status(200).json({ result: `No upcoming appointment found for ${patient}.` });
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

      return res.status(200).json({ result: `Cancelled the ${appt.type} on ${appt.date} at ${appt.time}.` });
    }

    if (action === "check_claim_status") {
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

      return res.status(200).json({ result: resultText });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
