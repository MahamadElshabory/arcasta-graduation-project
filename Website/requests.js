const express = require("express");
const router = express.Router();
const pool = require("./database");

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: "Unauthorized. Please log in." });
}

// GET /api/requests -> include customer_name
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const supplierID = req.session.user.supplierID;

    const sql = `
      SELECT
        r.orderID,
        r.userID,
        r.products,
        r.total_price,
        r.status,
        r.created_at,
        u.name AS customer_name
      FROM requests r
      JOIN users u ON u.userID = r.userID
      WHERE JSON_CONTAINS(r.products, JSON_OBJECT('supplierID', ?), '$')
      ORDER BY r.created_at DESC
    `;

    const [rows] = await pool.query(sql, [supplierID]);
    res.json(rows);
  } catch (err) {
    console.error("Error Fetching Requests:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/requests/:id/status
router.patch("/:id/status", isAuthenticated, async (req, res) => {
  const { id } = req.params; // orderID
  let { status } = req.body;

  status = String(status || "").trim();
  status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  if (!["Pending", "Accepted", "Rejected"].includes(status)) {
    return res.status(400).json({
      message: "Invalid status. Must be 'Pending' or 'Accepted' or 'Rejected'.",
    });
  }

  try {
    const supplierID = req.session.user.supplierID;

    // 1) Fetch order details
    const checkSql = `
      SELECT products, status
      FROM requests
      WHERE orderID = ?
        AND JSON_CONTAINS(products, JSON_OBJECT('supplierID', ?), '$')
    `;
    const [rows] = await pool.query(checkSql, [id, supplierID]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Order not found for this supplier." });
    }
    if (rows[0].status !== "Pending") {
      return res.status(400).json({ message: "Order already processed." });
    }

    // 2) If Accepted → decrement stock
    if (status === "Accepted") {
      let products = rows[0].products;
      if (typeof products === "string") {
        products = JSON.parse(products);
      }

      for (const product of products) {
        if (product.supplierID === supplierID) {
          // Check stock before decrementing
          const [[p]] = await pool.query(
            "SELECT stock FROM products WHERE productID = ? AND supplierID = ?",
            [product.productID, supplierID]
          );

          if (!p) continue; // product not found
          if (p.stock < product.quantity) {
            return res.status(400).json({
              message: `Not enough stock for product ${product.productID}. Available: ${p.stock}, requested: ${product.quantity}`,
            });
          }

          await pool.query(
            `UPDATE products
             SET stock = stock - ?
             WHERE productID = ? AND supplierID = ?`,
            [product.quantity, product.productID, supplierID]
          );
        }
      }
    }

    // 3) Update request status
    const updateSql = `
      UPDATE requests
      SET status = ?
      WHERE orderID = ?
        AND JSON_CONTAINS(products, JSON_OBJECT('supplierID', ?), '$')
    `;
    await pool.query(updateSql, [status, id, supplierID]);

    res.json({ message: `Order ${status.toLowerCase()} successfully.` });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
