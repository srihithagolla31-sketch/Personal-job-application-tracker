/* =========================================================
   sample-data.js — demo applications for the first launch
   Dates are RELATIVE to today, so the demo always shows an overdue
   follow-up, one due today, an upcoming interview, etc.
   All companies, people and emails are fictional (example.com).
   ========================================================= */

function createSampleApplications() {
  const t = todayStr();
  const d = (n) => addDays(t, n); // d(-3) = 3 days ago, d(2) = in 2 days
  const iso = (n) => parseDateStr(d(n)).toISOString();

  const raw = [
    {
      company: "Northwind Labs", jobTitle: "Software Development Intern", jobType: "Internship",
      location: "Bengaluru", source: "LinkedIn", jobUrl: "https://example.com/jobs/northwind-sde-intern",
      applicationDate: d(-12), status: "Applied", priority: "High",
      recruiter: { name: "Priya Raman", email: "priya.raman@example.com", phone: "" },
      followUpDate: d(-2), notes: "Applied through the careers page. Priya posted the opening on LinkedIn.",
      statusHistory: [{ status: "Applied", date: d(-12) }], updated: -12
    },
    {
      company: "Bluepeak Software", jobTitle: "Frontend Developer Intern", jobType: "Internship",
      location: "Remote", source: "Referral", jobUrl: "https://example.com/jobs/bluepeak-frontend",
      applicationDate: d(-18), status: "Interview", priority: "High", interviewDate: d(1),
      salary: "₹25,000 / month stipend",
      recruiter: { name: "Arjun Mehta", email: "arjun.mehta@example.com", phone: "+91 98765 43210" },
      notes: "Referred by Kavya (senior, 2025 batch). Round 2 is a live coding round — revise JS array methods and the DOM.",
      statusHistory: [
        { status: "Applied", date: d(-18) }, { status: "Assessment", date: d(-11) }, { status: "Interview", date: d(-3) }
      ],
      followUpHistory: [{ due: d(-12), doneOn: d(-12) }], updated: -3
    },
    {
      company: "Kestrel Analytics", jobTitle: "Data Analyst Intern", jobType: "Internship",
      location: "Hyderabad", source: "Internshala", jobUrl: "https://example.com/jobs/kestrel-analyst",
      applicationDate: d(-9), status: "Assessment", priority: "Medium",
      recruiter: { name: "", email: "careers@example.com", phone: "" },
      followUpDate: d(3), notes: "Online assessment: SQL + aptitude, 60 minutes.",
      statusHistory: [{ status: "Applied", date: d(-9) }, { status: "Assessment", date: d(-4) }], updated: -4
    },
    {
      company: "Pixelnest Studio", jobTitle: "UI Developer (Part-time)", jobType: "Part-time",
      location: "Remote", source: "Unstop", jobUrl: "https://example.com/jobs/pixelnest-ui",
      applicationDate: d(-7), status: "Applied", priority: "Medium",
      recruiter: { name: "Sneha Iyer", email: "sneha.iyer@example.com", phone: "" },
      followUpDate: d(0), notes: "Shared my portfolio link in the application.",
      statusHistory: [{ status: "Applied", date: d(-7) }], updated: -7
    },
    {
      company: "Copperleaf Systems", jobTitle: "Software Engineer Trainee", jobType: "Full-time",
      location: "Chennai", source: "Campus placement", jobUrl: "",
      applicationDate: d(-26), status: "Offer", priority: "High", salary: "₹6.5 LPA",
      recruiter: { name: "Rahul Nair", email: "rahul.nair@example.com", phone: "" },
      notes: "Campus drive. Offer letter expected by email — check joining date and bond terms.",
      statusHistory: [
        { status: "Applied", date: d(-26) }, { status: "Assessment", date: d(-20) },
        { status: "Interview", date: d(-12) }, { status: "Offer", date: d(-2) }
      ], updated: -2
    },
    {
      company: "Lumen Robotics", jobTitle: "Embedded Systems Intern", jobType: "Internship",
      location: "Remote", source: "LinkedIn", jobUrl: "https://example.com/jobs/lumen-embedded",
      applicationDate: d(-15), status: "Applied", priority: "Low",
      notes: "", statusHistory: [{ status: "Applied", date: d(-15) }], updated: -15
    },
    {
      company: "Riverstone Bank", jobTitle: "Graduate Analyst", jobType: "Full-time",
      location: "Mumbai", source: "Campus placement", jobUrl: "https://example.com/jobs/riverstone-graduate",
      applicationDate: d(-1), status: "Interested", priority: "High", deadline: d(2),
      notes: "Needs a cover letter. Eligibility: 7.0 CGPA.",
      statusHistory: [{ status: "Interested", date: d(-1) }], updated: -1
    },
    {
      company: "Monsoon Fintech", jobTitle: "Product Design Intern", jobType: "Internship",
      location: "Pune", source: "Company website", jobUrl: "https://example.com/jobs/monsoon-design",
      applicationDate: d(-3), status: "Applied", priority: "Medium",
      followUpDate: d(4), notes: "Case study submitted with the application.",
      statusHistory: [{ status: "Applied", date: d(-3) }], updated: -3
    },
    {
      company: "Tidewater Health", jobTitle: "Backend Developer Intern", jobType: "Internship",
      location: "Bengaluru", source: "Referral", jobUrl: "",
      applicationDate: d(-22), status: "Assessment", priority: "Medium",
      recruiter: { name: "Fatima Sheikh", email: "fatima.sheikh@example.com", phone: "" },
      followUpDate: d(-5), followUpCompleted: true,
      followUpHistory: [{ due: d(-5), doneOn: d(-5) }],
      notes: "Take-home assignment: build a small REST API.",
      statusHistory: [{ status: "Applied", date: d(-22) }, { status: "Assessment", date: d(-6) }], updated: -5
    },
    {
      company: "Saffron Retail Tech", jobTitle: "QA Intern", jobType: "Internship",
      location: "Bengaluru", source: "Naukri", jobUrl: "",
      applicationDate: d(-20), status: "Rejected", priority: "Low",
      notes: "Rejected after the aptitude round. Practise time management for aptitude tests.",
      statusHistory: [{ status: "Applied", date: d(-20) }, { status: "Rejected", date: d(-8) }], updated: -8
    },
    {
      company: "Granite Cloud", jobTitle: "DevOps Intern", jobType: "Internship",
      location: "Remote", source: "LinkedIn", jobUrl: "",
      applicationDate: d(-40), status: "Rejected", priority: "Low", notes: "",
      statusHistory: [{ status: "Applied", date: d(-40) }, { status: "Rejected", date: d(-28) }], updated: -28
    },
    {
      company: "Orbit Logistics", jobTitle: "Operations Intern", jobType: "Internship",
      location: "Gurugram", source: "Referral", jobUrl: "",
      applicationDate: d(-33), status: "Withdrawn", priority: "Low",
      notes: "Withdrew — role was mostly on-site and didn't match my goals.",
      statusHistory: [{ status: "Applied", date: d(-33) }, { status: "Withdrawn", date: d(-25) }], updated: -25
    }
  ];

  return raw.map((item, index) => {
    const app = normalizeApplication({
      ...item,
      id: `APP-${1001 + index}`,
      createdAt: parseDateStr(item.applicationDate).toISOString(),
      updatedAt: iso(item.updated)
    });
    return app;
  });
}
