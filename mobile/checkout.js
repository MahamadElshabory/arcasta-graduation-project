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


// Helper to get user's shipping address (prefer selected, else latest)
async function getShippingAddress(userID) {
  const [rows] = await pool.query(
    `SELECT addressID, full_name, address_line, city, state_region, zip_code, country, is_selected, created_at
       FROM addresses
      WHERE userID = ?
   ORDER BY is_selected DESC, created_at DESC
      LIMIT 1`,
    [userID]
  );
  return rows[0] || null;
}


// Helper to get user's default payment method
async function getPaymentMethod(userID) {
  const [methods] = await pool.query(
    "SELECT * FROM payment_methods WHERE userID = ? AND is_default = 1 LIMIT 1",
    [userID]
  );
  return methods[0] || null;
}

// Helper to get the cart summary (from your cart.js logic)
async function getCartSummary(userID) {
  const [cartRows] = await pool.query("SELECT items FROM cart WHERE userID = ?", [userID]);
  if (cartRows.length === 0) return { items: [], total: 0 };

  let items = typeof cartRows[0].items === "string" ? JSON.parse(cartRows[0].items) : cartRows[0].items;
  if (!Array.isArray(items) || items.length === 0) return { items: [], total: 0 };

  const productIDs = items.map(i => i.productID);
  if (!productIDs.length) return { items: [], total: 0 };

  const [products] = await pool.query(
    `SELECT p.productID, p.name, p.price, p.picture, s.name AS supplier
     FROM products p
     LEFT JOIN suppliers s ON p.supplierID = s.supplierID
     WHERE p.productID IN (${productIDs.map(() => '?').join(',')})`,
    productIDs
  );

  const itemsWithQuantity = products.map(product => {
    const cartItem = items.find(i => i.productID === product.productID);
    return {
      ...product,
      quantity: cartItem ? cartItem.quantity : 1
    };
  });

  let total = itemsWithQuantity.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  return { items: itemsWithQuantity, total };
}

// GET /checkout - prepare the summary for the screen
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userID = req.user.userID;
    const address = await getShippingAddress(userID);
    const payment = await getPaymentMethod(userID);
    const cart = await getCartSummary(userID);

    const delivery = 15; // Fixed delivery fee
    const summary = cart.total + delivery;

    res.json({
      address,
      payment,
      orderTotal: cart.total,
      delivery,
      summary,
      items: cart.items // include cart items for reference
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /checkout/submit
router.post("/submit", authenticateToken, async (req, res) => {
  try {
    const userID = req.user.userID;
    // Get the cart for this user
    const [cartRows] = await pool.query("SELECT items FROM cart WHERE userID = ?", [userID]);
    if (cartRows.length === 0) return res.status(400).json({ message: "Cart is empty" });

    let cartItems = typeof cartRows[0].items === "string" ? JSON.parse(cartRows[0].items) : cartRows[0].items;
    if (!Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ message: "Cart is empty" });

    // Fetch product details (join with products table if needed)
    const productIDs = cartItems.map(item => item.productID);
    const [products] = await pool.query(
      `SELECT p.productID, p.name AS product_name, p.supplierID, p.price
       FROM products p
       WHERE p.productID IN (${productIDs.map(() => '?').join(',')})`,
      productIDs
    );

    // Merge quantity from cartItems into products
    const orderProducts = products.map(prod => {
      const match = cartItems.find(ci => ci.productID === prod.productID);
      return {
        ...prod,
        quantity: match ? match.quantity : 1
      };
    });

    // Calculate total price
    const totalPrice = orderProducts.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    // Save to 'orders' table
    await pool.query(
      "INSERT INTO requests (userID, products, total_price) VALUES (?, ?, ?)",
      [userID, JSON.stringify(orderProducts), totalPrice]
    );

    // Increment per-product sales (all-time) based on quantities
for (const item of orderProducts) {
  const qty = Number(item.quantity) || 1;
  await pool.query(
    "UPDATE products SET sales = COALESCE(sales, 0) + ? WHERE productID = ?",
    [qty, item.productID]
  );
}


    // Optional: Clear user's cart after order
    await pool.query("UPDATE cart SET items = '[]' WHERE userID = ?", [userID]);

    res.json({ message: "Order submitted!", order: { products: orderProducts, total: totalPrice } });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
