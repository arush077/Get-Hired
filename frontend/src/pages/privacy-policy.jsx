import { Link } from "react-router-dom";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-neutral-400 hover:text-white mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-8">Last updated: September 10, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <p>Get-Hired ("we") operates the Get-Hired interview preparation platform.</p>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Name and email address (for account creation)</li>
              <li>Resume content (for AI-powered analysis)</li>
              <li>Interview transcripts and responses (for feedback and improvement)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide interview preparation services</li>
              <li>To generate resume analysis and interview feedback</li>
              <li>To improve our AI models and service quality</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Data Sharing</h2>
            <p>We do not sell, trade, or share your personal information with third parties.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Data Storage</h2>
            <p>Your data is stored securely and is only accessible by you.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>For any questions or data requests, email: arushshetty07@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
