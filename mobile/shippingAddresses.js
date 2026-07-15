const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Auth middleware (reuse your existing one)
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Get all shipping addresses for user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT addressID, full_name, address_line, city, state_region, zip_code, country, is_selected 
       FROM addresses WHERE userID = ?`, [req.user.userID]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add new shipping address
router.post("/", authenticateToken, async (req, res) => {
  const { full_name, address_line, city, state_region, zip_code, country } = req.body;
  if (!full_name || !address_line || !city || !state_region || !zip_code || !country) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
    await pool.query(
      `INSERT INTO addresses 
       (userID, full_name, address_line, city, state_region, zip_code, country, is_selected)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [req.user.userID, full_name, address_line, city, state_region, zip_code, country]
    );
    res.status(201).json({ message: "Address added successfully." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Edit shipping address
router.put("/:addressID", authenticateToken, async (req, res) => {
  const { addressID } = req.params;
  const { full_name, address_line, city, state_region, zip_code, country } = req.body;
  try {
    await pool.query(
      `UPDATE addresses SET full_name=?, address_line=?, city=?, state_region=?, zip_code=?, country=?
       WHERE addressID=? AND userID=?`,
      [full_name, address_line, city, state_region, zip_code, country, addressID, req.user.userID]
    );
    res.status(200).json({ message: "Address updated successfully." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Set address as selected (only one can be selected per user)
router.put("/select/:addressID", authenticateToken, async (req, res) => {
  const { addressID } = req.params;
  try {
    // Deselect all addresses for this user
    await pool.query(
      `UPDATE addresses SET is_selected=0 WHERE userID=?`, [req.user.userID]
    );
    // Select the chosen address
    const [result] = await pool.query(
      `UPDATE addresses SET is_selected=1 WHERE addressID=? AND userID=?`,
      [addressID, req.user.userID]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Address not found" });
    }
    res.status(200).json({ message: "Address set as shipping address." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Optional: Delete address
router.delete("/:addressID", authenticateToken, async (req, res) => {
  const { addressID } = req.params;
  try {
    await pool.query(
      `DELETE FROM addresses WHERE addressID=? AND userID=?`,
      [addressID, req.user.userID]
    );
    res.status(200).json({ message: "Address deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
