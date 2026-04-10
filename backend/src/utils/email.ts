import nodemailer from 'nodemailer';
import config from '../config';

// Create reusable transporter using Google SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
};

// Generate a 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Split OTP into individual styled digits
const otpDigitsHtml = (otp: string): string => {
  return otp
    .split('')
    .map(
      (digit) => `
      <td style="padding: 0 4px;">
        <div style="width: 48px; height: 56px; background: linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%); border: 2px solid #E0E7FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 800; color: #4F46E5; line-height: 56px; text-align: center;">
          ${digit}
        </div>
      </td>`
    )
    .join('');
};

// Shared email wrapper
const emailWrapper = (content: string): string => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Finding Moto</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F0F1F3; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Preheader (hidden preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F0F1F3;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          ${content}
        </table>

        <!-- Footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%; margin-top: 24px;">
          <tr>
            <td align="center" style="padding: 0 24px;">
              <p style="margin: 0 0 8px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #9CA3AF;">
                &copy; ${new Date().getFullYear()} Finding Moto &bull; All rights reserved
              </p>
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #D1D5DB;">
                You received this email because an account was created with this address.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── OTP VERIFICATION EMAIL ────────────────────────────────────────
export const sendOTPEmail = async (
  email: string,
  otp: string,
  name: string
): Promise<void> => {
  const transporter = createTransporter();

  const content = `
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #9333EA 100%); padding: 40px 32px 36px; text-align: center;">
        <!-- Logo Icon -->
        <div style="margin-bottom: 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="background-color: rgba(255,255,255,0.15); border-radius: 16px; padding: 12px;">
                <img src="https://img.icons8.com/fluency/48/motorcycle.png" alt="🏍️" width="36" height="36" style="display: block;" />
              </td>
            </tr>
          </table>
        </div>
        <h1 style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
          Finding Moto
        </h1>
        <p style="margin: 6px 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #C7D2FE; font-weight: 500;">
          Email Verification
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 36px 32px 12px;">
        <p style="margin: 0 0 6px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 17px; color: #111827;">
          Hi <strong>${name}</strong> 👋
        </p>
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.7; color: #6B7280;">
          Thanks for signing up! Please enter the code below to verify your email address and activate your account.
        </p>
      </td>
    </tr>

    <!-- OTP Code -->
    <tr>
      <td style="padding: 24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%); border: 1px solid #E0E7FF; border-radius: 16px;">
          <tr>
            <td style="padding: 28px 20px; text-align: center;">
              <p style="margin: 0 0 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #6366F1;">
                Verification Code
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  ${otpDigitsHtml(otp)}
                </tr>
              </table>
              <p style="margin: 16px 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #9CA3AF;">
                ⏱️ Valid for <strong style="color: #6366F1;">10 minutes</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Security Notice -->
    <tr>
      <td style="padding: 0 32px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFFBEB; border-radius: 10px; border: 1px solid #FDE68A;">
          <tr>
            <td style="padding: 14px 16px;">
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; line-height: 1.6; color: #92400E;">
                🔒 <strong>Security tip:</strong> Never share this code with anyone. Our team will never ask for your verification code.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding: 0 32px;">
        <div style="height: 1px; background-color: #F3F4F6;"></div>
      </td>
    </tr>

    <!-- Help Text -->
    <tr>
      <td style="padding: 20px 32px 28px; text-align: center;">
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #9CA3AF; line-height: 1.6;">
          Didn't create an account? You can safely ignore this email.<br/>
          Need help? Contact us at <a href="mailto:${config.smtpUser}" style="color: #6366F1; text-decoration: none; font-weight: 600;">${config.smtpUser}</a>
        </p>
      </td>
    </tr>
  `;

  const mailOptions = {
    from: `"Finding Moto" <${config.smtpUser}>`,
    to: email,
    subject: `${otp} is your Finding Moto verification code`,
    html: emailWrapper(content),
  };

  await transporter.sendMail(mailOptions);
};

// ─── WELCOME EMAIL ─────────────────────────────────────────────────
export const sendWelcomeEmail = async (
  email: string,
  name: string,
  role: string
): Promise<void> => {
  const transporter = createTransporter();

  const roleConfig: Record<string, { emoji: string; message: string; color: string }> = {
    buyer: {
      emoji: '🛒',
      message: 'You\'re all set! Start browsing motorcycles, parts & accessories from trusted sellers across the platform.',
      color: '#4F46E5',
    },
    seller: {
      emoji: '🏪',
      message: 'Your seller account is pending admin approval. We\'ll send you an email as soon as your account is reviewed and approved.',
      color: '#059669',
    },
    mechanic: {
      emoji: '🔧',
      message: 'Your mechanic account is pending admin approval. We\'ll send you an email once your workshop profile is reviewed and approved.',
      color: '#D97706',
    },
  };

  const rc = roleConfig[role] || { emoji: '🏍️', message: 'Welcome aboard!', color: '#4F46E5' };
  const isPending = role === 'seller' || role === 'mechanic';

  const content = `
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%); padding: 40px 32px 36px; text-align: center;">
        <div style="font-size: 52px; margin-bottom: 12px;">${rc.emoji}</div>
        <h1 style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
          Welcome to Finding Moto!
        </h1>
        <p style="margin: 8px 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: #A7F3D0;">
          Your email has been verified ✓
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 36px 32px 16px;">
        <p style="margin: 0 0 6px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 17px; color: #111827;">
          Hi <strong>${name}</strong> 🎉
        </p>
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.7; color: #6B7280;">
          Your <strong style="color: ${rc.color};">${role}</strong> account has been created successfully.
        </p>
      </td>
    </tr>

    <!-- Status Card -->
    <tr>
      <td style="padding: 12px 32px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${isPending ? '#FFFBEB' : '#ECFDF5'}; border: 1px solid ${isPending ? '#FDE68A' : '#A7F3D0'}; border-radius: 12px;">
          <tr>
            <td style="padding: 20px;">
              <p style="margin: 0 0 4px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${isPending ? '#D97706' : '#059669'};">
                ${isPending ? '⏳ Pending Review' : '✅ Account Active'}
              </p>
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.6; color: ${isPending ? '#92400E' : '#065F46'};">
                ${rc.message}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${!isPending ? `
    <!-- CTA Button -->
    <tr>
      <td style="padding: 0 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 10px;">
              <a href="${config.clientUrl}/login" style="display: inline-block; padding: 14px 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none; letter-spacing: 0.3px;">
                Start Exploring →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ` : ''}

    <!-- Divider -->
    <tr>
      <td style="padding: 0 32px;">
        <div style="height: 1px; background-color: #F3F4F6;"></div>
      </td>
    </tr>

    <!-- Help Text -->
    <tr>
      <td style="padding: 20px 32px 28px; text-align: center;">
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #9CA3AF; line-height: 1.6;">
          Questions? Reach us at <a href="mailto:${config.smtpUser}" style="color: #6366F1; text-decoration: none; font-weight: 600;">${config.smtpUser}</a>
        </p>
      </td>
    </tr>
  `;

  const mailOptions = {
    from: `"Finding Moto" <${config.smtpUser}>`,
    to: email,
    subject: `Welcome to Finding Moto, ${name}! 🏍️`,
    html: emailWrapper(content),
  };

  await transporter.sendMail(mailOptions);
};

// ─── APPROVAL / REJECTION EMAIL ────────────────────────────────────
export const sendApprovalEmail = async (
  email: string,
  name: string,
  approved: boolean,
  notes?: string
): Promise<void> => {
  const transporter = createTransporter();

  const content = `
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, ${approved ? '#059669 0%, #10B981 100%' : '#DC2626 0%, #EF4444 100%'}); padding: 40px 32px 36px; text-align: center;">
        <div style="margin-bottom: 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="background-color: rgba(255,255,255,0.2); width: 64px; height: 64px; border-radius: 50%; text-align: center; vertical-align: middle; font-size: 32px; line-height: 64px;">
                ${approved ? '✅' : '⚠️'}
              </td>
            </tr>
          </table>
        </div>
        <h1 style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 24px; font-weight: 800; color: #FFFFFF;">
          ${approved ? 'You\'re Approved!' : 'Application Update'}
        </h1>
        <p style="margin: 8px 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; color: ${approved ? '#A7F3D0' : '#FECACA'};">
          Finding Moto Account Review
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 36px 32px 16px;">
        <p style="margin: 0 0 6px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 17px; color: #111827;">
          Hi <strong>${name}</strong>,
        </p>
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.7; color: #6B7280;">
          ${approved
            ? 'Great news! Our admin team has reviewed and <strong style="color: #059669;">approved</strong> your account. You now have full access to Finding Moto.'
            : 'We\'ve reviewed your account application. Unfortunately, your account was <strong style="color: #DC2626;">not approved</strong> at this time.'
          }
        </p>
      </td>
    </tr>

    ${notes ? `
    <!-- Notes Card -->
    <tr>
      <td style="padding: 12px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${approved ? '#ECFDF5' : '#FEF2F2'}; border-left: 4px solid ${approved ? '#10B981' : '#EF4444'}; border-radius: 0 10px 10px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${approved ? '#059669' : '#DC2626'};">
                Admin Note
              </p>
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.6; color: ${approved ? '#065F46' : '#991B1B'};">
                ${notes}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ` : ''}

    ${approved ? `
    <!-- What's Next -->
    <tr>
      <td style="padding: 20px 32px 8px;">
        <p style="margin: 0 0 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; font-weight: 700; color: #374151;">
          What's next?
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top; font-size: 16px;">1️⃣</td>
                  <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #6B7280; line-height: 1.5;">
                    Log in to your account
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top; font-size: 16px;">2️⃣</td>
                  <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #6B7280; line-height: 1.5;">
                    Complete your profile
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 28px; vertical-align: top; font-size: 16px;">3️⃣</td>
                  <td style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #6B7280; line-height: 1.5;">
                    Start listing or offering services
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding: 20px 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #059669, #10B981); border-radius: 10px;">
              <a href="${config.clientUrl}/login" style="display: inline-block; padding: 14px 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 15px; font-weight: 700; color: #FFFFFF; text-decoration: none;">
                Log In Now →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ` : `
    <!-- Contact Support -->
    <tr>
      <td style="padding: 20px 32px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F9FAFB; border-radius: 10px; border: 1px solid #E5E7EB;">
          <tr>
            <td style="padding: 16px 20px; text-align: center;">
              <p style="margin: 0 0 4px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #374151; font-weight: 600;">
                Have questions?
              </p>
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 13px; color: #6B7280;">
                Contact us at <a href="mailto:${config.smtpUser}" style="color: #6366F1; text-decoration: none; font-weight: 600;">${config.smtpUser}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `}

    <!-- Divider -->
    <tr>
      <td style="padding: 0 32px;">
        <div style="height: 1px; background-color: #F3F4F6;"></div>
      </td>
    </tr>

    <!-- Footer link -->
    <tr>
      <td style="padding: 20px 32px 28px; text-align: center;">
        <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #9CA3AF;">
          <a href="${config.clientUrl}" style="color: #6366F1; text-decoration: none; font-weight: 600;">Visit Finding Moto</a>
        </p>
      </td>
    </tr>
  `;

  const mailOptions = {
    from: `"Finding Moto" <${config.smtpUser}>`,
    to: email,
    subject: approved
      ? `✅ Your Finding Moto account has been approved!`
      : `Account Application Update - Finding Moto`,
    html: emailWrapper(content),
  };

  await transporter.sendMail(mailOptions);
};
