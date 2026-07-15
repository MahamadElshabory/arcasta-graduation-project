const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// ✅ JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });

  jwt.verify(token, process.env.SECRET_KEY || "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid or expired token" });
    req.user = user; // { userID, email }
    next();
  });
};

// 1️⃣ Customer submits a review
router.post("/", authenticateToken, async (req, res) => {
  const { productID, rating, comment } = req.body;
  const userID = req.user.userID;

  if (!productID || !rating) {
    return res.status(400).json({ message: "ProductID and rating are required." });
  }

  try {
    // Check if review already exists
    const [exists] = await pool.query(
      "SELECT reviewID FROM reviews WHERE productID = ? AND userID = ?",
      [productID, userID]
    );

    if (exists.length > 0) {
      return res.status(400).json({ message: "Already reviewed. Use PATCH to update." });
    }

    // Insert new review
    const [result] = await pool.query(
      "INSERT INTO reviews (productID, userID, rating, comment) VALUES (?, ?, ?, ?)",
      [productID, userID, rating, comment || null]
    );

    res.status(201).json({ message: "Review submitted", reviewID: result.insertId });
  } catch (err) {
    console.error("Error inserting review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 2️⃣ Customer updates their review
router.patch("/:reviewID", authenticateToken, async (req, res) => {
  const { reviewID } = req.params;
  const { rating, comment } = req.body;
  const userID = req.user.userID;

  try {
    const [rows] = await pool.query("SELECT * FROM reviews WHERE reviewID=? AND userID=?", [
      reviewID,
      userID,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Review not found" });
    }

    await pool.query("UPDATE reviews SET rating=?, comment=? WHERE reviewID=? AND userID=?", [
      rating,
      comment,
      reviewID,
      userID,
    ]);

    res.json({ message: "Review updated" });
  } catch (err) {
    console.error("Error updating review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 3️⃣ Customer deletes their review
router.delete("/:reviewID", authenticateToken, async (req, res) => {
  const { reviewID } = req.params;
  const userID = req.user.userID;

  try {
    const [result] = await pool.query("DELETE FROM reviews WHERE reviewID=? AND userID=?", [
      reviewID,
      userID,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 4️⃣ Get all reviews for a product
router.get("/product/:productID", async (req, res) => {
  const { productID } = req.params;

  try {
    const [reviews] = await pool.query(
      `SELECT r.reviewID, r.rating, r.comment, r.createdAt, u.userID, u.email 
       FROM reviews r 
       JOIN users u ON r.userID = u.userID 
       WHERE r.productID = ? 
       ORDER BY r.createdAt DESC`,
      [productID]
    );

    res.json({ productID, reviews });
  } catch (err) {
    console.error("Error fetching reviews:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 5️⃣ Get rating summary for a product
router.get("/summary/:productID", async (req, res) => {
  const { productID } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT AVG(rating) AS averageRating, COUNT(*) AS totalReviews FROM reviews WHERE productID = ?",
      [productID]
    );

    const avg = rows[0].averageRating ? Number(rows[0].averageRating) : 0;
    const total = rows[0].totalReviews ? Number(rows[0].totalReviews) : 0;

    res.json({
      averageRating: avg.toFixed(4), // always 4 decimals
      totalReviews: total,
    });
  } catch (err) {
    console.error("Error fetching rating summary:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
