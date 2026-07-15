// productById.js
const express = require("express");
const router = express.Router();
const pool = require("./database");

// sanity: GET /api/products/id
router.get("/", (req, res) => res.json({ ok: true, where: "productById" }));

router.get("/:productID", async (req, res) => {
  const { productID } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE productID = ?",
      [productID]
    );
    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
