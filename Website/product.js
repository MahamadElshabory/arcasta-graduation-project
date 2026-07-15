// routes/products.js
const express = require("express");
const router = express.Router();
const pool = require("./database");
const { uploadBase64ToSpaces } = require("./spaces");
const { v4: uuidv4 } = require("uuid");

// Middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: "Unauthorized. Please log in." });
}

/**
 * PUT /products/:id
 * - Update product details
 */
router.put("/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const supplierID = req.session.user.supplierID;
  const { name, price, stock, description } = req.body;

  try {
    // Ensure the product belongs to the logged-in supplier
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE productID=? AND supplierID=?",
      [id, supplierID]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    // Validate inputs
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push("name=?");
      values.push(String(name).trim());
    }
    if (description !== undefined) {
      updates.push("description=?");
      values.push(String(description).trim());
    }
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: "price must be > 0" });
      }
      updates.push("price=?");
      values.push(priceNum);
    }
    if (stock !== undefined) {
      const stockNum = Number(stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        return res.status(400).json({ message: "stock must be >= 0" });
      }
      updates.push("stock=?");
      values.push(stockNum);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    values.push(id, supplierID);

    await pool.query(
      `UPDATE products SET ${updates.join(", ")} WHERE productID=? AND supplierID=?`,
      values
    );

    return res.json({ message: `Product ${id} updated successfully` });
  } catch (err) {
    console.error("Update product error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /products/:id
 * - Deletes a product by productID
 */
router.delete("/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const supplierID = req.session.user.supplierID;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM products WHERE productID = ? AND supplierID = ?`,
      [id, supplierID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    await pool.query(`DELETE FROM products WHERE productID = ? AND supplierID = ?`, [
      id,
      supplierID,
    ]);

    return res.json({ message: `Product ${id} deleted successfully` });
  } catch (err) {
    console.error("Delete product error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /products/add
 * - Save product immediately (model_status='queued')
 * - Upload images to Spaces
 * - Enqueue a DB-backed job in `model_jobs` (status='queued')
 * - Return 202 immediately (no waiting for AI)
 */
router.post("/add", isAuthenticated, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { price, picture, name, description, stock } = req.body;
    const supplierID = req.session.user.supplierID;

    // Validate input
    if (
      price === undefined ||
      name === undefined ||
      description === undefined ||
      stock === undefined
    ) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    if (!Array.isArray(picture) || picture.length === 0 || picture.length > 4) {
      return res.status(400).json({ message: "You must provide 1 to 4 pictures." });
    }
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ message: "price must be a number > 0." });
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      return res.status(400).json({ message: "stock must be an integer >= 0." });
    }

    // Generate new productID (PRDxxx)
    const [last] = await conn.query(
      "SELECT productID FROM products ORDER BY productID DESC LIMIT 1"
    );
    let newID = "PRD001";
    if (last.length > 0) {
      const numericPart = parseInt(String(last[0].productID).replace("PRD", ""), 10);
      newID = "PRD" + String((Number.isFinite(numericPart) ? numericPart : 0) + 1).padStart(3, "0");
    }

    // Upload images to Spaces
    const imageUrls = [];
    for (const imgBase64 of picture) {
      const fileName = `${newID}_${uuidv4()}.jpg`;
      const url = await uploadBase64ToSpaces(imgBase64, fileName);
      imageUrls.push(url);
    }

    // Insert product (queued)
    await conn.query(
      `
      INSERT INTO products
        (productID, supplierID, price, picture, name, description, stock, glb_url, obj_url, model_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'queued')
    `,
      [
        newID,
        supplierID,
        priceNum,
        JSON.stringify(imageUrls),
        String(name).trim(),
        String(description).trim(),
        stockNum,
      ]
    );

    // Create a DB job
    const [jobRes] = await conn.query(
      `INSERT INTO model_jobs (product_id, payload, status)
       VALUES (?, ?, 'queued')`,
      [newID, JSON.stringify({ imageUrls })]
    );

    // Save job_id on product (optional)
    await conn.query(`UPDATE products SET job_id=? WHERE productID=?`, [
      String(jobRes.insertId),
      newID,
    ]);

    return res.status(202).json({
      message: "Product accepted. 3D model generation queued.",
      productID: newID,
      jobId: String(jobRes.insertId),
      imageUrls,
    });
  } catch (err) {
    console.error("Add product error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    conn.release();
  }
});

/**
 * GET /products/:id
 * - Public: return product details by productID
 *   (Add isAuthenticated as the 2nd arg if you want to protect it)
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE productID = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Parse picture JSON array if stored as text
    const product = rows[0];
    try {
      if (typeof product.picture === "string") {
        product.picture = JSON.parse(product.picture);
      }
    } catch {
      // ignore if not JSON
    }

    return res.json(product);
  } catch (err) {
    console.error("Get product by id error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /products/:id/model-status
 * - Check current model status and URLs when ready
 * - Keep this route AFTER the generic `/:id` only if its path is more specific
 *   (To be safe, you can also move this ABOVE `/:id`)
 */
router.get("/:id/model-status", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT productID, model_status, glb_url, obj_url, job_id, model_error
       FROM products
       WHERE productID=?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("Model status error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
