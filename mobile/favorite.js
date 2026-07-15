const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// JWT auth middleware (reuse from your other files)
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// GET: All favorites for current user (with product details)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userID = req.user.userID;
    const [rows] = await pool.query(
      `SELECT f.favoriteID, p.productID, p.name, p.price, p.picture, s.name AS supplier
       FROM favorites f
       JOIN products p ON f.productID = p.productID
       JOIN suppliers s ON p.supplierID = s.supplierID
       WHERE f.userID = ?
       ORDER BY f.added_at DESC`,
      [userID]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Add product to favorites
router.post("/add", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.body;
  if (!productID) return res.status(400).json({ message: "productID is required" });
  try {
    await pool.query(
      "INSERT IGNORE INTO favorites (userID, productID) VALUES (?, ?)",
      [userID, productID]
    );
    res.status(201).json({ message: "Added to favorites" });
  } catch (err) {
    console.error("Add favorite error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE: Remove product from favorites
router.delete("/remove/:productID", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM favorites WHERE userID = ? AND productID = ?",
      [userID, productID]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Favorite not found" });
    }
    res.json({ message: "Removed from favorites" });
  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
