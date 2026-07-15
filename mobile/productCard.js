const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// GET /product/:productID
router.get("/:productID", authenticateToken, async (req, res) => {
  const { productID } = req.params;
  const userID = req.user.userID;
  try {
    // Get product details + supplier + stock + glb_url + sale fields
    const [rows] = await pool.query(
      `SELECT
          p.productID,
          p.name,
          p.price,
          p.picture,
          p.description,
          p.stock,
          p.glb_url,
          p.original_price,
          p.discount_price,
          p.sale_start,
          p.sale_end,
          s.name AS supplier
       FROM products p
       LEFT JOIN suppliers s ON p.supplierID = s.supplierID
       WHERE p.productID = ?`,
      [productID]
    );

    if (!rows.length) return res.status(404).json({ message: "Product not found" });
    const product = rows[0];

    // Check if in favorites
    const [favRows] = await pool.query(
      "SELECT 1 FROM favorites WHERE userID = ? AND productID = ?",
      [userID, productID]
    );
    product.isFavorite = !!favRows.length;

    res.json(product);
  } catch (err) {
    console.error("Product GET error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /product/:productID/favorite — Add to favorites
router.post("/:productID/favorite", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    await pool.query("INSERT IGNORE INTO favorites (userID, productID) VALUES (?, ?)", [
      userID,
      productID,
    ]);
    res.status(201).json({ message: "Product marked as favorite" });
  } catch (err) {
    console.error("Favorite add error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /product/:productID/favorite — Remove from favorites
router.delete("/:productID/favorite", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    const [result] = await pool.query(
      "DELETE FROM favorites WHERE userID = ? AND productID = ?",
      [userID, productID]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product was not in favorites" });
    }
    res.json({ message: "Product removed from favorites" });
  } catch (err) {
    console.error("Favorite remove error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /product/:productID/addToCart — Add to cart
router.post("/:productID/addToCart", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    // Get cart
    let [cartRows] = await pool.query("SELECT items FROM cart WHERE userID = ?", [userID]);
    let items = [];
    if (cartRows.length) {
      items =
        typeof cartRows[0].items === "string"
          ? JSON.parse(cartRows[0].items)
          : cartRows[0].items;
      const item = items.find((i) => i.productID === productID);
      if (item) {
        item.quantity += 1; // Increase quantity
      } else {
        items.push({ productID, quantity: 1 }); // Add new product with quantity 1
      }
      await pool.query("UPDATE cart SET items = ? WHERE userID = ?", [
        JSON.stringify(items),
        userID,
      ]);
    } else {
      items = [{ productID, quantity: 1 }];
      await pool.query("INSERT INTO cart (userID, items) VALUES (?, ?)", [
        userID,
        JSON.stringify(items),
      ]);
    }
    res.json({ message: "Product added to cart" });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
