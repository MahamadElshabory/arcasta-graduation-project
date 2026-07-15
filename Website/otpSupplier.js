require("dotenv").config();
const randomstring = require("randomstring");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// In-memory OTP store (replace with Redis/DB in production)
const otpCache = {};

/**
 * Generate a 4-digit numeric OTP
 */
function generateOTP() {
  return randomstring.generate({ length: 4, charset: "numeric" });
}

/**
 * Send OTP email via SendGrid Dynamic Template
 */
async function sendOTP(email, otp, username = "User") {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL, // must be verified in SendGrid
    templateId: "d-0f60eb4a9249471a866fc7a504bb3d29", // your ARcasta_OTP template ID
    dynamic_template_data: {
      username,
      otp,
    },
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending OTP:");
    if (error.response && error.response.body) {
      console.error(error.response.body.errors);
    } else {
      console.error(error.message);
    }
  }
}

/**
 * Start OTP verification: generate + send OTP
 */
function startVerification(userData) {
  const otp = generateOTP();

  otpCache[userData.email] = {
    otp,
    data: userData,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
  };

  sendOTP(userData.email, otp, userData.name || "User");
  console.log(`Generated OTP for ${userData.email}: ${otp}`);
}

/**
 * Verify OTP code
 */
function verifyOTP(email, otp) {
  const record = otpCache[email];
  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    delete otpCache[email];
    console.log(`⏰ OTP expired for ${email}`);
    return null;
  }

  if (record.otp !== otp.trim()) {
    console.log(`❌ Invalid OTP attempt for ${email}`);
    return null;
  }

  const userData = record.data;
  delete otpCache[email];
  console.log(`✅ OTP verified for ${email}`);
  return userData;
}

module.exports = {
  startVerification,
  verifyOTP,
};
