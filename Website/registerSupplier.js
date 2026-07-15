const express = require("express");
const router = express.Router();
const pool = require("./database");
const { startVerification, verifyOTP } = require("./otpSupplier");

// 🔑 Same middleware style as products.js
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: "Unauthorized. Please log in." });
}

// ======================
// Start Registration - Validate + Send OTP
// ======================
router.post("/start", async (req, res) => {
  try {
    const { email, passwordd, name, phone } = req.body;

    if (!email || !passwordd || !name || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const [existing] = await pool.query("SELECT * FROM suppliers WHERE email = ? OR phone = ?", [
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

    startVerification({ email, passwordd, name, phone });
    res.status(200).json({ message: "OTP sent to email. Please verify to complete registration." });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
// ======================
// Change Password
// ======================
router.put("/change-password", isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const supplierID = req.session.user.supplierID;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get supplier
    const [rows] = await pool.query("SELECT passwordd FROM suppliers WHERE supplierID = ?", [
      supplierID,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    if (rows[0].passwordd !== currentPassword) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Update password
    await pool.query("UPDATE suppliers SET passwordd = ? WHERE supplierID = ?", [
      newPassword,
      supplierID,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ======================
// Confirm OTP and Insert Supplier
// ======================
router.post("/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const userData = verifyOTP(email, otp);
    if (!userData) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const { passwordd, name, phone } = userData;

    // ✅ Extract numeric part properly and ignore invalid IDs
    const [last] = await pool.query(`
      SELECT supplierID
      FROM suppliers
      WHERE supplierID REGEXP '^SUP[0-9]+$'
      ORDER BY CAST(SUBSTRING(supplierID, 4) AS UNSIGNED) DESC
      LIMIT 1
    `);

    let newID = "SUP001";
    if (last.length > 0) {
      const lastID = last[0].supplierID; // e.g. SUP006
      const numericPart = parseInt(lastID.substring(3), 10); // take digits after 'SUP'
      newID = "SUP" + String(numericPart + 1).padStart(3, "0");
    }

    const insertSQL = `
      INSERT INTO suppliers (supplierID, email, passwordd, name, phone)
      VALUES (?, ?, ?, ?, ?)
    `;
    await pool.query(insertSQL, [newID, email, passwordd, name, phone]);

    res.status(201).json({ message: "Registration complete!", supplierID: newID });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ======================
// Edit Profile (session-based auth)
// ======================
router.put("/edit", isAuthenticated, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const supplierID = req.session.user.supplierID; // ✅ from session

    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    // check if phone already used by another supplier
    const [phoneCheck] = await pool.query(
      "SELECT * FROM suppliers WHERE phone = ? AND supplierID != ?",
      [phone, supplierID]
    );

    if (phoneCheck.length > 0) {
      return res.status(409).json({ message: "Phone number already in use" });
    }

    // update supplier profile
    await pool.query("UPDATE suppliers SET name = ?, phone = ? WHERE supplierID = ?", [
      name,
      phone,
      supplierID,
    ]);

    return res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Edit profile error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
