// Website/sales.js
const express = require("express");
const router = express.Router();
const pool = require("./database");

// Middleware: ensure supplier is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: "Unauthorized. Please log in." });
}

/**
 * 1️⃣ Set a sale on a product
 */
router.post("/set", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;
  const { productID, discount_price, sale_start, sale_end } = req.body;

  if (!productID || !discount_price || !sale_start || !sale_end) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Ensure product belongs to this supplier
    const [rows] = await pool.query("SELECT * FROM products WHERE productID=? AND supplierID=?", [
      productID,
      supplierID,
    ]);
    if (rows.length === 0) {
      return res.status(403).json({ message: "You do not own this product." });
    }

    const product = rows[0];

    // Save original price if not set
    if (!product.original_price) {
      await pool.query("UPDATE products SET original_price=? WHERE productID=?", [
        product.price,
        productID,
      ]);
    }

    // Apply sale
    await pool.query(
      `UPDATE products
         SET discount_price=?, sale_start=?, sale_end=?, price=?
       WHERE productID=? AND supplierID=?`,
      [discount_price, sale_start, sale_end, discount_price, productID, supplierID]
    );

    res.json({ message: "Sale applied successfully." });
  } catch (err) {
    console.error("Error setting sale:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 2️⃣ Remove a sale manually (restore original price)
 */
router.delete("/remove", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;
  const { productID } = req.body;

  try {
    await pool.query(
      `UPDATE products
         SET price=original_price, discount_price=NULL, sale_start=NULL, sale_end=NULL
       WHERE productID=? AND supplierID=?`,
      [productID, supplierID]
    );

    res.json({ message: "Sale removed and original price restored." });
  } catch (err) {
    console.error("Error removing sale:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * 3️⃣ Get all sales for this supplier
 */
router.get("/", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;

  try {
    const [rows] = await pool.query(
      `SELECT productID, name, price, original_price, discount_price, sale_start, sale_end
         FROM products
        WHERE supplierID=? AND discount_price IS NOT NULL`,
      [supplierID]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching sales:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
