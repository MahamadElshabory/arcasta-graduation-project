const express = require("express");
const router = express.Router();
const pool = require("../Website/database");

// ✅ Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: "Unauthorized. Please log in." });
}

/**
 * 1️⃣ Customer submits a review (only once per product)
 * POST /api/reviews
 */
router.post("/", isAuthenticated, async (req, res) => {
  const { productID, rating, comment } = req.body;
  const userID = req.session.user.userID;

  if (!productID || !rating) {
    return res.status(400).json({ message: "ProductID and rating are required." });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5." });
  }

  try {
    // ✅ Check if this customer already reviewed this product
    const checkSql = `SELECT reviewID FROM reviews WHERE productID = ? AND userID = ?`;
    const [exists] = await pool.query(checkSql, [productID, userID]);

    if (exists.length > 0) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this product. Use PATCH to update." });
    }

    const sql = `
      INSERT INTO reviews (productID, userID, rating, comment)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [productID, userID, rating, comment || null]);

    res.status(201).json({
      message: "Review submitted successfully",
      reviewID: result.insertId,
    });
  } catch (err) {
    console.error("Error inserting review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 2️⃣ Supplier gets all reviews for a product
 */
router.get("/product/:productID", isAuthenticated, async (req, res) => {
  const { productID } = req.params;
  const supplierID = req.session.user.supplierID;

  try {
    const sql = `
      SELECT r.reviewID, r.rating, r.comment, r.createdAt, u.name AS customer_name
      FROM reviews r
      JOIN users u ON r.userID = u.userID
      JOIN products p ON r.productID = p.productID
      WHERE r.productID = ?
        AND p.supplierID = ?
      ORDER BY r.createdAt DESC
    `;
    const [rows] = await pool.query(sql, [productID, supplierID]);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching product reviews:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 3️⃣ Supplier gets rating summary
 */
router.get("/summary/:productID", isAuthenticated, async (req, res) => {
  const { productID } = req.params;
  const supplierID = req.session.user.supplierID;

  try {
    const sql = `
      SELECT AVG(rating) AS averageRating, COUNT(*) AS totalReviews
      FROM reviews r
      JOIN products p ON r.productID = p.productID
      WHERE r.productID = ?
        AND p.supplierID = ?
    `;
    const [rows] = await pool.query(sql, [productID, supplierID]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching rating summary:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 4️⃣ Customer updates their review
 */
router.patch("/:reviewID", isAuthenticated, async (req, res) => {
  const { reviewID } = req.params;
  const { rating, comment } = req.body;
  const userID = req.session.user.userID;

  try {
    const checkSql = `SELECT * FROM reviews WHERE reviewID = ? AND userID = ?`;
    const [rows] = await pool.query(checkSql, [reviewID, userID]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Review not found or not yours." });
    }

    const updateSql = `UPDATE reviews SET rating=?, comment=? WHERE reviewID=? AND userID=?`;
    await pool.query(updateSql, [rating, comment, reviewID, userID]);

    res.json({ message: "Review updated successfully" });
  } catch (err) {
    console.error("Error updating review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 5️⃣ Customer deletes their review
 */
router.delete("/:reviewID", isAuthenticated, async (req, res) => {
  const { reviewID } = req.params;
  const userID = req.session.user.userID;

  try {
    const sql = `DELETE FROM reviews WHERE reviewID=? AND userID=?`;
    const [result] = await pool.query(sql, [reviewID, userID]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Review not found or not yours." });
    }

    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    console.error("Error deleting review:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
