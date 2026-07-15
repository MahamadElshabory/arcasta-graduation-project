const express = require("express");
const router = express.Router();
const pool = require("./database"); // your MySQL pool

// Middleware to verify logged-in supplier
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user && req.session.user.supplierID) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized. Please log in as a supplier." });
  }
}

// GET /inventory - return products added by the logged-in supplier
router.get("/", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;

  try {
    const [products] = await pool.query("SELECT * FROM products WHERE supplierID = ?", [
      supplierID,
    ]);

    res.status(200).json({ products });
  } catch (error) {
    console.error("Error retrieving inventory:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /inventory/low-stock - products with low stock
router.get("/low-stock", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;

  try {
    const [lowStockProducts] = await pool.query(
      "SELECT * FROM products WHERE supplierID = ? AND stock > 0 AND stock <= 10",
      [supplierID]
    );

    res.status(200).json({ lowStock: lowStockProducts });
  } catch (error) {
    console.error("Error retrieving low stock products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /inventory/out-of-stock - products with stock = 0
router.get("/out-of-stock", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;

  try {
    const [outOfStockProducts] = await pool.query(
      "SELECT * FROM products WHERE supplierID = ? AND stock = 0",
      [supplierID]
    );

    res.status(200).json({ outOfStock: outOfStockProducts });
  } catch (error) {
    console.error("Error retrieving out-of-stock products:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /inventory/:productID - product + related reviews/favorites/orders will auto-delete
router.delete("/:productID", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID;
  const { productID } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM products WHERE productID = ? AND supplierID = ?",
      [productID, supplierID]
    );

    if (result.affectedRows > 0) {
      res.status(200).json({
        message: "Product deleted successfully (related reviews/orders/favorites auto-removed).",
      });
    } else {
      res.status(404).json({ message: "Product not found or unauthorized." });
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
