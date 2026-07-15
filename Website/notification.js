const express = require("express");
const router = express.Router();
const pool = require("./database");

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: "Unauthorized. Please log in." });
}


router.get("/", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM notifications WHERE supplierID = ? ORDER BY created_at DESC",
      [supplierID]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetching notifications failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Mark a notification as read
router.put("/:id/read", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Mark as read failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

