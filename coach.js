/* =========================================================
   coach.js — ★ Onward's main differentiator ★
   1) getNextAction(app): looks at one application and decides the
      single most useful thing the student should do next (or nothing).
   2) getTodayPlan(apps): ranks those actions so the dashboard can say
      "Today, 3 things need you".
   3) buildMessage(): writes a polite, personalised follow-up / thank-you
      email the student can copy. We never send anything ourselves.
   It's just clear if/else rules over the data — no AI, no server.
   ========================================================= */

const NO_REPLY_DAYS = 10; // after this many quiet days, suggest a check-in

/* Each action looks like:
   { kind, urgency: "now" | "soon", score, title, why, buttons: [{ label, action, template? }] }
   score: higher = shown first. */
function getNextAction(app, today = todayStr()) {
  if (CLOSED_STATUSES.includes(app.status)) return null;

  // 1. Interview coming up in the next 3 days
  if (app.interviewDate && ["Applied", "Assessment", "Interview"].includes(app.status)) {
    const daysLeft = daysBetween(today, app.interviewDate);
    if (daysLeft >= 0 && daysLeft <= 3) {
      return {
        kind: "interview",
        urgency: daysLeft <= 1 ? "now" : "soon",
        score: 100 - daysLeft,
        title: `Interview with ${app.company} ${relativeDay(app.interviewDate)}`,
        why: "Re-read the job description and your notes. Prepare two questions to ask them.",
        buttons: [{ label: "Open prep notes", action: "open" }]
      };
    }
  }

  // 2. Overdue follow-up
  const fuState = getFollowUpState(app, today);
  if (fuState === "overdue") {
    const late = daysBetween(app.followUpDate, today);
    return {
      kind: "followup-overdue",
      urgency: "now",
      score: 90 + Math.min(late, 9),
      title: `Follow up with ${app.company}`,
      why: `This was due ${plural(late, "day")} ago. A short, polite note keeps you on their radar.`,
      buttons: [
        { label: "Write message", action: "message", template: messageTemplateFor(app) },
        { label: "Mark done", action: "complete" }
      ]
    };
  }

  // 3. Follow-up due today
  if (fuState === "today") {
    return {
      kind: "followup-today",
      urgency: "now",
      score: 85,
      title: `Follow up with ${app.company} today`,
      why: "You planned this one. It takes two minutes with the message we've drafted for you.",
      buttons: [
        { label: "Write message", action: "message", template: messageTemplateFor(app) },
        { label: "Mark done", action: "complete" }
      ]
    };
  }

  // 4. Saved as "Interested" and the deadline is close
  if (app.status === "Interested" && app.deadline) {
    const daysLeft = daysBetween(today, app.deadline);
    if (daysLeft >= 0 && daysLeft <= 5) {
      return {
        kind: "deadline",
        urgency: daysLeft <= 2 ? "now" : "soon",
        score: 80 - daysLeft,
        title: `Apply to ${app.company} — deadline ${relativeDay(app.deadline)}`,
        why: `You saved "${app.jobTitle}" but haven't applied yet.`,
        buttons: [
          { label: "I've applied", action: "mark-applied" },
          { label: "Open", action: "open" }
        ]
      };
    }
  }

  // 5. An offer is waiting for a reply
  if (app.status === "Offer") {
    return {
      kind: "offer",
      urgency: "soon",
      score: 70,
      title: `Reply to ${possessive(app.company)} offer`,
      why: "Thank them, and ask for anything you need in writing (joining date, stipend, location) before you decide.",
      buttons: [{ label: "Write reply", action: "message", template: "offer" }]
    };
  }

  // 6. Applied a while ago, no reply, and nothing scheduled
  if (app.status === "Applied" && !hasActiveFollowUp(app)) {
    const lastMove = app.statusHistory[app.statusHistory.length - 1].date;
    const quietDays = daysBetween(lastMove, today);
    if (quietDays >= NO_REPLY_DAYS) {
      return {
        kind: "no-reply",
        urgency: "soon",
        score: 50 + Math.min(quietDays, 19),
        title: `No reply from ${app.company} in ${quietDays} days`,
        why: "That's normal — and a friendly check-in is completely okay now.",
        buttons: [
          { label: "Write message", action: "message", template: "followup" },
          { label: "Remind me in 3 days", action: "snooze" }
        ]
      };
    }
  }

  return null;
}

// All actions for today, most important first
function getTodayPlan(apps, today = todayStr()) {
  return apps
    .map((app) => ({ app, action: getNextAction(app, today) }))
    .filter((item) => item.action)
    .sort((a, b) => b.action.score - a.action.score);
}

/* ---------- Message templates ---------- */
const MESSAGE_TEMPLATES = {
  followup: "Follow-up after applying",
  "after-assessment": "Ask about next steps",
  "thank-you": "Thank you after an interview",
  offer: "Reply to an offer"
};

// Pick the template that fits where the application is right now
function messageTemplateFor(app) {
  if (app.status === "Offer") return "offer";
  if (app.status === "Interview") return "thank-you";
  if (app.status === "Assessment") return "after-assessment";
  return "followup";
}

function buildMessage(app, templateKey, userName) {
  const firstName = app.recruiter.name ? app.recruiter.name.split(" ")[0] : "";
  const hello = firstName ? `Hi ${firstName},` : `Dear ${app.company} Hiring Team,`;
  const me = userName && userName.trim() ? userName.trim() : "[Your name]";
  const role = app.jobTitle;
  const applied = formatDate(app.applicationDate);

  const templates = {
    followup: {
      subject: `Following up on my application — ${role}`,
      body:
`${hello}

I hope you're doing well. I applied for the ${role} role at ${app.company} on ${applied} and wanted to follow up on my application.

I'm genuinely excited about the opportunity to learn and contribute at ${app.company}. Please let me know if there's anything else I can share, such as my portfolio or project work.

Thank you for your time.

Best regards,
${me}`
    },
    "after-assessment": {
      subject: `Next steps for the ${role} role`,
      body:
`${hello}

Thank you for the opportunity to take the assessment for the ${role} role at ${app.company}. I enjoyed working through it.

Could you share an update on the next steps and the expected timeline? I'm happy to provide anything else you need.

Thank you,
${me}`
    },
    "thank-you": {
      subject: `Thank you — ${role} interview`,
      body:
`${hello}

Thank you for taking the time to speak with me about the ${role} role. I enjoyed learning more about the team and the work at ${app.company}.

Our conversation made me even more excited about the opportunity. Please let me know if you need anything else from me.

Warm regards,
${me}`
    },
    offer: {
      subject: `Thank you for the offer — ${role}`,
      body:
`${hello}

Thank you so much for offering me the ${role} role at ${app.company}. I'm really grateful for the opportunity.

Before I confirm, could you please share the offer details in writing, including the joining date, compensation and work location?

Looking forward to hearing from you.

Best regards,
${me}`
    }
  };

  return templates[templateKey] || templates.followup;
}
