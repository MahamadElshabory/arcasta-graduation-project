const express = require("express");
const router = express.Router();
const pool = require("./DB");
const { startVerification, verifyOTP } = require("./otpCustomer");

// ======================
// Start Customer Registration - Validate + Send OTP
// Mounted as /api/register/start
// ======================
router.post("/start", async (req, res) => {
  try {
    const { email, passwordd, name, phone, address } = req.body;

    if (!email || !passwordd || !name || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const [existing] = await pool.query("SELECT * FROM users WHERE email = ? OR phone = ?", [
      email,
      phone,
    ]);

    if (existing.length > 0) {
      if (existing[0].email === email) {
        return res.status(409).json({ message: "Email already exists." });
      }
      if (existing[0].phone === phone) {
        return res.status(409).json({ message: "Phone number already exists." });
      }
    }

    startVerification({ email, passwordd, name, phone, address });
    res.status(200).json({ message: "OTP sent to email. Please verify to complete registration." });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ======================
// Confirm OTP and Insert Customer
// Mounted as /api/registerr/verify
// ======================
router.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const userData = verifyOTP(email, otp);
    if (!userData) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const { passwordd, name, phone, address } = userData;

    const [last] = await pool.query(`
      SELECT userID
      FROM users
      WHERE userID REGEXP '^USR[0-9]+$'
      ORDER BY CAST(SUBSTRING(userID, 4) AS UNSIGNED) DESC
      LIMIT 1
    `);

    let newID = "USR001";
    if (last.length > 0) {
      const lastID = last[0].userID;
      const numericPart = parseInt(lastID.substring(3), 10);
      newID = "USR" + String(numericPart + 1).padStart(3, "0");
    }

    const insertSQL = `
      INSERT INTO users (userID, email, passwordd, name, phone, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.query(insertSQL, [newID, email, passwordd, name, phone, address]);

    res.status(201).json({ message: "User registration complete!", userID: newID });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
