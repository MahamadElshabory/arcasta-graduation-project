const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Secret key for JWT (use environment variable in production!)
const SECRET_KEY = "yourSecretKey";

// POST /api/users/login
router.post("/", async (req, res) => {
  console.log("LOGIN ROUTE HIT", req.body);
  const { email, passwordd } = req.body;

  if (!email || !passwordd) {
    return res.status(400).json({ message: "Email and passwordd are required." });
  }

  try {
    const [results] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);

    if (results.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = results[0];

    if (user.passwordd !== passwordd) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign({ userID: user.userID, email: user.email }, SECRET_KEY, {
      expiresIn: "1h",
    });

    req.session.user = {
      userID: user.userID,
      name: user.name,
      email: user.email
    };

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userID: user.userID,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

module.exports = router;
