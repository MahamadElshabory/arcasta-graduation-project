const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Optional JWT middleware: attaches req.user if token exists
const authenticateOptional = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, "yourSecretKey", (err, user) => {
      req.user = err ? null : user;
      next();
    });
  } else {
    req.user = null;
    next();
  }
};

// Required JWT middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// GET /market
router.get("/", authenticateOptional, async (req, res) => {
  try {
    // Not logged in → return products with isFavorite=false
    if (!req.user || !req.user.userID) {
      const [rows] = await pool.query(
        `SELECT p.productID, p.name, p.picture, p.price, p.stock, s.name AS supplier
           FROM products p
           LEFT JOIN suppliers s ON p.supplierID = s.supplierID
           ORDER BY RAND()`
      );
      const products = rows.map((p) => ({ ...p, isFavorite: false }));
      return res.status(200).json(products);
    }

    // Logged in → compute isFavorite in SQL
    const userID = req.user.userID;
    const [rows] = await pool.query(
      `SELECT p.productID,
              p.name,
              p.picture,
              p.price,
              p.stock,
              s.name AS supplier,
              CASE WHEN f.userID IS NULL THEN FALSE ELSE TRUE END AS isFavorite
         FROM products p
         LEFT JOIN suppliers s ON p.supplierID = s.supplierID
         LEFT JOIN favorites f
           ON f.productID = p.productID
          AND f.userID   = ?
         ORDER BY RAND()`,
      [userID]
    );

    return res.status(200).json(rows);
  } catch (err) {
    console.error("Market list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /market/favorite/:productID — Mark as favorite
router.post("/favorite/:productID", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    await pool.query("INSERT IGNORE INTO favorites (userID, productID) VALUES (?, ?)", [
      userID,
      productID,
    ]);
    res.status(201).json({ message: "Product marked as favorite" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /market/favorite/:productID — Remove from favorites
router.delete("/favorite/:productID", authenticateToken, async (req, res) => {
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
    res.status(500).json({ message: "Server error" });
  }
});

// Add to Cart endpoint
router.post("/:productID/addToCart", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  const { productID } = req.params;
  try {
    // Fetch the user's cart
    let [cartRows] = await pool.query("SELECT items FROM cart WHERE userID = ?", [userID]);
    let items = [];
    if (cartRows.length) {
      items =
        typeof cartRows[0].items === "string"
          ? JSON.parse(cartRows[0].items)
          : cartRows[0].items;
      // If product is already in cart, increase quantity
      const item = items.find((i) => i.productID === productID);
      if (item) {
        item.quantity += 1;
      } else {
        items.push({ productID, quantity: 1 });
      }
      await pool.query("UPDATE cart SET items = ? WHERE userID = ?", [
        JSON.stringify(items),
        userID,
      ]);
    } else {
      // Create a new cart
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
