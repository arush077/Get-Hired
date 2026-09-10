import { getConfig } from "../config/env.js";
import { getLogger } from "../logging/logger.js";

export async function sendEmail({ to, subject, text, html }) {
  const config = getConfig();
  if (!config.BREVO_API_KEY) return;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "Get-Hired",
          email: config.BREVO_SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || JSON.stringify(error));
    }

    getLogger().info({ to, subject }, "[MAIL] Email sent via Brevo");
  } catch (err) {
    getLogger().error({ to, subject, error: err.message }, "[MAIL] Failed to send email");
  }
}

export async function sendWelcomeEmail(to, name) {
  const subject = "Welcome to Get-Hired!";
  const text = `Hi ${name},\n\nWelcome to Get-Hired! We're excited to help you prepare for your next interview.\n\nYou can now:\n- Build your resume with AI-powered analysis\n- Practice with AI mock interviews\n- Get detailed feedback on your performance\n\nGet started at https://get-hired-weld.vercel.app/dashboard\n\nBest regards,\nGet-Hired Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">Welcome to Get-Hired, ${name}!</h2>
      <p>We're excited to help you prepare for your next interview.</p>
      <p>You can now:</p>
      <ul>
        <li>Build your resume with AI-powered analysis</li>
        <li>Practice with AI mock interviews</li>
        <li>Get detailed feedback on your performance</li>
      </ul>
      <a href="https://get-hired-weld.vercel.app/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #6c63ff; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        Get Started
      </a>
      <p style="color: #666; font-size: 14px;">Best regards,<br>Get-Hired Team</p>
    </div>`;

  await sendEmail({ to, subject, text, html });
}

export async function sendInterviewResultsEmail(to, name, interview) {
  const analysis = interview.analysis || {};
  const score = analysis.overall_score ?? "N/A";
  const strengths = (analysis.strengths || []).slice(0, 2);
  const improvements = (analysis.areas_to_improve || []).slice(0, 2);

  const subject = `Your Interview Results — ${interview.jobRole || "Interview"}`;

  let strengthsHtml = "";
  if (strengths.length > 0) {
    strengthsHtml = `<ul>${strengths.map((s) => `<li>${s}</li>`).join("")}</ul>`;
  }

  let improvementsHtml = "";
  if (improvements.length > 0) {
    improvementsHtml = `<ul>${improvements.map((s) => `<li>${s}</li>`).join("")}</ul>`;
  }

  const text = `Hi ${name},\n\nYour interview for ${interview.jobRole || "the position"} is complete.\n\nOverall Score: ${score}/100\n\nStrengths:\n${strengths.join("\n") || "N/A"}\n\nAreas to Improve:\n${improvements.join("\n") || "N/A"}\n\nView your full results at https://get-hired-weld.vercel.app/dashboard\n\nBest regards,\nGet-Hired Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a2e;">Interview Results</h2>
      <p>Hi ${name},</p>
      <p>Your interview for <strong>${interview.jobRole || "the position"}</strong> is complete.</p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <div style="font-size: 48px; font-weight: bold; color: #6c63ff;">${score}<span style="font-size: 24px; color: #999;">/100</span></div>
        <div style="color: #666; margin-top: 4px;">Overall Score</div>
      </div>

      ${strengths.length > 0 ? `
        <h3 style="color: #2d6a4f;">Strengths</h3>
        ${strengthsHtml}
      ` : ""}

      ${improvements.length > 0 ? `
        <h3 style="color: #e63946;">Areas to Improve</h3>
        ${improvementsHtml}
      ` : ""}

      <a href="https://get-hired-weld.vercel.app/dashboard"
         style="display: inline-block; padding: 12px 24px; background-color: #6c63ff; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
        View Full Results
      </a>
      <p style="color: #666; font-size: 14px;">Best regards,<br>Get-Hired Team</p>
    </div>`;

  await sendEmail({ to, subject, text, html });
}
