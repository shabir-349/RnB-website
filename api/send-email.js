export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { to_email, user_name, plan, type } = req.body || {};

  if (!to_email || !type) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const displayPlan = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Scholar';
  const name = user_name || to_email;

  let subject, htmlContent;

  if (type === 'approved') {
    subject = 'R&B — Your payment has been approved!';
    htmlContent = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:#f5b730;padding:32px 40px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:24px;color:#1a1a1a">R&amp;B — Research and Beyond</h1>
        </div>
        <div style="padding:40px;background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px">Your payment has been approved! 🎉</h2>
          <p style="margin:0 0 16px;line-height:1.6">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 16px;line-height:1.6">
            Great news — your payment for the <strong>${displayPlan}</strong> plan has been verified and approved.
            Your account has been upgraded and you now have full access to all ${displayPlan} features.
          </p>
          <p style="margin:0 0 32px;line-height:1.6">
            Log in to your dashboard to start exploring everything R&amp;B has to offer on your journey
            from first idea to residency CV.
          </p>
          <a href="https://researchandbeyond.vercel.app/signin.html"
             style="display:inline-block;background:#f5b730;color:#1a1a1a;text-decoration:none;
                    padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
            Go to Dashboard →
          </a>
          <p style="margin:40px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
            If you have any questions, reply to this email or reach us at
            <a href="mailto:researchandbeyondd@gmail.com" style="color:#f5b730">researchandbeyondd@gmail.com</a>.
          </p>
        </div>
      </div>`;
  } else {
    subject = 'R&B — Payment update';
    htmlContent = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:#f5b730;padding:32px 40px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:24px;color:#1a1a1a">R&amp;B — Research and Beyond</h1>
        </div>
        <div style="padding:40px;background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
          <h2 style="margin:0 0 16px;font-size:20px">Payment could not be verified</h2>
          <p style="margin:0 0 16px;line-height:1.6">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 16px;line-height:1.6">
            Unfortunately we were unable to verify your recent payment. This can happen for the following reasons:
          </p>
          <ul style="margin:0 0 24px;padding-left:20px;line-height:1.8;color:#374151">
            <li>The screenshot was unclear or did not show the full transaction details</li>
            <li>The payment amount did not match the plan price</li>
            <li>The transaction reference could not be matched to your account</li>
            <li>The payment was made to the wrong account number</li>
          </ul>
          <p style="margin:0 0 32px;line-height:1.6">
            Please resubmit your payment with a clear screenshot showing the transaction amount,
            reference number, and date.
          </p>
          <a href="https://researchandbeyond.vercel.app/index.html#rb-pricing"
             style="display:inline-block;background:#f5b730;color:#1a1a1a;text-decoration:none;
                    padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
            Retry Payment →
          </a>
          <p style="margin:40px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
            Need help? Contact us at
            <a href="mailto:researchandbeyondd@gmail.com" style="color:#f5b730">researchandbeyondd@gmail.com</a>
            and we'll sort it out for you.
          </p>
        </div>
      </div>`;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'R&B — Research and Beyond', email: 'researchandbeyondd@gmail.com' },
        to: [{ email: to_email }],
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Brevo error:', err);
      return res.status(500).json({ success: false, error: err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
