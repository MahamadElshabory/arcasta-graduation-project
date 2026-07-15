const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// 1. Get all products in user's cart (with details)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT items FROM cart WHERE userID = ?", [req.user.userID]);
    if (rows.length === 0) return res.json({ items: [], total: 0 });

    let items = typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
    if (!Array.isArray(items) || items.length === 0) return res.json({ items: [], total: 0 });

    // **EXTRACT ONLY PRODUCT IDs**
    const productIDs = items.map(i => i.productID);

    const [products] = await pool.query(
      `SELECT p.productID, p.name, p.price, p.picture, s.name AS supplier
       FROM products p
       LEFT JOIN suppliers s ON p.supplierID = s.supplierID
       WHERE p.productID IN (${productIDs.map(() => '?').join(',')})`,
      productIDs
    );

    // Merge with quantity
    const itemsWithQuantity = products.map(product => {
      const cartItem = items.find(i => i.productID === product.productID);
      return {
        ...product,
        quantity: cartItem ? cartItem.quantity : 1
      };
    });

    // Total (use quantity)
    let total = itemsWithQuantity.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    res.json({ items: itemsWithQuantity, total });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// 2. Add product to cart
router.post("/add", authenticateToken, async (req, res) => {
  const { productID } = req.body;
  const userID = req.user.userID;
  try {
    let [rows] = await pool.query("SELECT * FROM cart WHERE userID = ?", [userID]);
    let items = [];

    if (rows.length > 0) {
      items = typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
      // Check if product already in cart
      const item = items.find(i => i.productID === productID);
      if (item) {
        item.quantity += 1; // Increase quantity
      } else {
        items.push({ productID, quantity: 1 }); // Add new product with quantity 1
      }
      await pool.query("UPDATE cart SET items = ? WHERE userID = ?", [JSON.stringify(items), userID]);
    } else {
      items = [{ productID, quantity: 1 }];
      await pool.query("INSERT INTO cart (userID, items) VALUES (?, ?)", [userID, JSON.stringify(items)]);
    }
    res.json({ message: "Product added/increased in cart" });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});




// 3. Remove product from cart
router.post("/remove", authenticateToken, async (req, res) => {
  const { productID } = req.body;
  const userID = req.user.userID;
  try {
    let [rows] = await pool.query("SELECT * FROM cart WHERE userID = ?", [userID]);
    if (rows.length === 0) return res.status(400).json({ message: "Cart not found" });

    let items = JSON.parse(rows[0].items);
    items = items.filter(id => id !== productID);

    await pool.query("UPDATE cart SET items = ? WHERE userID = ?", [JSON.stringify(items), userID]);
    res.json({ message: "Product removed from cart" });
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 4. Clear all items from cart
router.post("/clear", authenticateToken, async (req, res) => {
  const userID = req.user.userID;
  try {
    await pool.query("UPDATE cart SET items = '[]' WHERE userID = ?", [userID]);
    res.json({ message: "Cart cleared" });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;


// decrease prod

router.post("/decrease", authenticateToken, async (req, res) => {
  const { productID } = req.body;
  const userID = req.user.userID;
  try {
    let [rows] = await pool.query("SELECT * FROM cart WHERE userID = ?", [userID]);
    if (rows.length === 0) return res.status(400).json({ message: "Cart not found" });

    let items = typeof rows[0].items === "string" ? JSON.parse(rows[0].items) : rows[0].items;
    const item = items.find(i => i.productID === productID);
    if (item) {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        // Remove product if quantity is 0 or less
        items = items.filter(i => i.productID !== productID);
      }
      await pool.query("UPDATE cart SET items = ? WHERE userID = ?", [JSON.stringify(items), userID]);
      return res.json({ message: "Product quantity decreased/removed" });
    }
    res.status(400).json({ message: "Product not in cart" });
  } catch (err) {
    console.error("Decrease quantity error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
