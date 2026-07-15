const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const randomstring = require("randomstring");
const pool = require("./database"); // Promise-based connection

const otpCache = {};

// Generate 4-digit numeric OTP
function generateOTP() {
  return randomstring.generate({ length: 4, charset: "numeric" });
}

// Send OTP email
function sendOTP(email, otp) {
  const mailOptions = {
    from: "ARcasta.furniture@gmail.com",
    to: email,
    subject: "OTP Verification to Reset Password",
    text: `Your OTP is: ${otp}`,
  };

  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: "ARcasta.furniture@gmail.com",
      pass: "dgwm vhjx saux vgfa",
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending OTP:", error);
    } else {
      console.log("OTP Email Sent:", info.response);
    }
  });
}

// Request OTP endpoint
router.post("/reqOTP", (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  otpCache[email] = otp;

  sendOTP(email, otp);
  console.log(`OTP for ${email}: ${otp}`);
  return res.status(200).json({ message: "OTP sent successfully" });
});


router.post("/verifyOTP", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    console.log("🔐 Verifying OTP for:", email);

    if (!otpCache[email]) {
      return res.status(400).json({ message: "Email not found or OTP expired." });
    }

    if (otpCache[email] !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    delete otpCache[email];

    await pool.query("UPDATE suppliers SET passwordd = ? WHERE email = ?", [newPassword, email]);

    console.log("Password updated for:", email);
    return res.status(200).json({ message: "OTP verified and password updated successfully." });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
