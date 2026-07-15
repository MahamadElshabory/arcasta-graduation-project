const express = require("express");
const router = express.Router();
const pool = require("./database");
const jwt = require("jsonwebtoken");

// Secret key for JWT (store this in env variable in production)
const SECRET_KEY = "yourSecretKey";

// POST /login
router.post("/", async (req, res) => {
  const { email, passwordd } = req.body;

  if (!email || !passwordd) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const [results] = await pool.query("SELECT * FROM suppliers WHERE email = ? LIMIT 1", [email]);

    if (results.length === 0) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    const supplier = results[0];

    if (supplier.passwordd !== passwordd) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign({ supplierID: supplier.supplierID, email: supplier.email }, SECRET_KEY, {
      expiresIn: "1h",
    });

    req.session.user = {
      supplierID: supplier.supplierID,
      name: supplier.name,
      email: supplier.email,
    };

    res.status(200).json({
      message: "Login successful",
      token,
      supplier: {
        supplierID: supplier.supplierID,
        name: supplier.name,
        email: supplier.email,
      },
    });
  } catch (err) {
    console.error("❌ Database error:", err); // ✅ Full error in logs
    res.status(500).json({
      message: "Database error",
      error: err.message || "Unknown error",
      sqlMessage: err.sqlMessage || null,
      code: err.code || null,
    });
  }
});

module.exports = router;
