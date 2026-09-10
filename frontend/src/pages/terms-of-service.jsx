import { Link } from "react-router-dom";

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-neutral-400 hover:text-white mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-8">Last updated: September 10, 2026</p>

        <div className="space-y-6 text-neutral-300 leading-relaxed">
          <p>By using Get-Hired, you agree to the following terms:</p>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">1. Service Description</h2>
            <p>Get-Hired is an AI-powered interview preparation platform that provides resume analysis and mock interview practice.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">2. User Responsibilities</h2>
            <p>You are responsible for the content you submit, including resume data and interview responses.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">3. No Guarantees</h2>
            <p>Get-Hired does not guarantee job placement or interview success. Our service is a preparation tool only.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>Do not use the service to submit harmful, offensive, or illegal content.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">5. Service Availability</h2>
            <p>We strive to keep the service available but do not guarantee uninterrupted access.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
            <p>Get-Hired is provided "as is" without warranties. We are not liable for any damages arising from use of the service.</p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>For any questions, email: arushshetty07@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
