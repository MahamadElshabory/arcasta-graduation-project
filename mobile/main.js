const express = require("express");
const router = express.Router();
const pool = require("./DB");

/**
 * GET /main
 * Returns:
 *  {
 *    bestSelling: [{ productID, name, price, picture, supplier, sales }],
 *    new: [{ productID, name, price, picture, supplier, created_at }]
 *  }
 */
router.get("/", async (_req, res) => {
  try {
    // All-time best selling: top 10 by products.sales
    const [bestSelling] = await pool.query(
      `
      SELECT
        p.productID,
        p.name,
        p.price,
        p.picture,
        s.name AS supplier,
        COALESCE(p.sales, 0) AS sales
      FROM products p
      LEFT JOIN suppliers s ON s.supplierID = p.supplierID
      ORDER BY COALESCE(p.sales, 0) DESC, p.productID ASC
      LIMIT 10
      `
    );

    // New: newest products in the last 7 days, up to 10 (unchanged)
    const [newProducts] = await pool.query(
      `
      SELECT
        p.productID,
        p.name,
        p.price,
        p.picture,
        s.name AS supplier,
        p.created_at
      FROM products p
      LEFT JOIN suppliers s ON s.supplierID = p.supplierID
      WHERE p.created_at >= NOW() - INTERVAL 7 DAY
      ORDER BY p.created_at DESC
      LIMIT 10
      `
    );

    res.json({ bestSelling, new: newProducts });
  } catch (err) {
    console.error("Main page error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
