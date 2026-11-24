const socialLinks = [
  { name: "Facebook", url: "https://facebook.com/isaacessoh.dev" },
  { name: "Instagram", url: "https://www.instagram.com/founder.wanky/" },
  { name: "X", url: "https://x.com/Wanky328178" },
  { name: "Threads", url: "https://www.threads.com/@founder.wanky" },
  { name: "LinkedIn", url: "https://www.linkedin.com/in/isaac-essoh" },
  { name: "YouTube", url: "https://www.youtube.com/@WankyBuilds" },
  { name: "TikTok", url: "https://www.tiktok.com/@wankyzone?lang=en" },
];

export const WAITLIST_FROM = "ERS Team <waitlist@ers.wankysoftware.com>";
export const WAITLIST_SUBJECT = "You're on the ERS waitlist";

export function getWaitlistConfirmationEmail() {
  const websiteUrl = "https://ers.wankysoftware.com";
  const privacyUrl = `${websiteUrl}/privacy-policy`;

  const socialHtml = socialLinks
    .map(
      ({ name, url }) =>
        `<a href="${url}" style="color:#047857;text-decoration:none;margin:0 8px;">${name}</a>`,
    )
    .join("");

  const html = `
    <div style="margin:0;padding:40px 16px;background:#f5f7f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px;background:#0b110e;">
          <a href="${websiteUrl}" style="color:#ffffff;text-decoration:none;font-size:28px;font-weight:800;">ERS<span style="color:#10b981;">.</span></a>
          <p style="margin:8px 0 0;color:#a7b0aa;font-size:12px;letter-spacing:1.5px;">ERRAND RUNNERS SYSTEM</p>
        </div>
        <div style="padding:36px 32px 32px;">
          <p style="margin:0 0 12px;color:#047857;font-size:12px;font-weight:700;letter-spacing:1.5px;">WELCOME TO ERS</p>
          <h1 style="margin:0 0 24px;font-size:30px;line-height:1.2;">You're on the ERS waitlist.</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">Hi there,</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">Thank you for joining the ERS waitlist.</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">ERS is building a smarter way to get everyday errands done. You've taken the first step toward being part of what we're building.</p>
          <div style="margin:26px 0;padding:18px 20px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:4px;">
            <p style="margin:0;font-size:15px;line-height:1.7;">You're on the list. We'll keep you informed as we get closer to launch.</p>
          </div>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.8;">Thank you for being part of the journey.</p>
          <p style="margin:22px 0 0;font-size:15px;line-height:1.8;">The ERS Team</p>
          <p style="margin:28px 0 0;color:#047857;font-size:13px;font-weight:800;letter-spacing:2px;">WE DON'T WAIT.</p>
        </div>
        <div style="padding:24px 20px;background:#fafafa;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0 0 14px;font-size:12px;line-height:1.7;color:#6b7280;">Launching in Lagos, Nigeria.</p>
          <p style="margin:0 0 14px;font-size:12px;line-height:2;">${socialHtml}</p>
          <p style="margin:0 0 12px;font-size:12px;"><a href="${websiteUrl}" style="color:#047857;text-decoration:none;">ers.wankysoftware.com</a><span style="color:#9ca3af;"> | </span><a href="${privacyUrl}" style="color:#047857;text-decoration:none;">Privacy Policy</a></p>
          <p style="margin:0;font-size:11px;line-height:1.7;color:#9ca3af;">You received this email because you signed up for the ERS waitlist.</p>
          <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} ERS — Errand Runners System.</p>
        </div>
      </div>
    </div>
  `;

  const text = [
    "You're on the ERS waitlist.",
    "",
    "Hi there,",
    "",
    "Thank you for joining the ERS waitlist.",
    "",
    "ERS is building a smarter way to get everyday errands done. You've taken the first step toward being part of what we're building.",
    "",
    "You're on the list. We'll keep you informed as we get closer to launch.",
    "",
    "Thank you for being part of the journey.",
    "",
    "The ERS Team",
    "",
    "WE DON'T WAIT.",
    "",
    "Launching in Lagos, Nigeria.",
    `Website: ${websiteUrl}`,
    `Privacy Policy: ${privacyUrl}`,
    "",
    "You received this email because you signed up for the ERS waitlist.",
    "",
    ...socialLinks.map(({ name, url }) => `${name}: ${url}`),
  ].join("\n");

  return { html, text };
}
