const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Auth middleware (reuse your existing one if possible)
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });
  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// GET all payment cards for logged in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT paymentID, name_on_card, card_number, last_four, expire_month, expire_year, is_default FROM payment_methods WHERE userID = ?",
      [req.user.userID]
    );
    // Only show last 4 digits of card
    const result = rows.map(card => {
  const tail = (card.last_four || (card.card_number || "")).toString().slice(-4);
  return {
    paymentID: card.paymentID,
    nameOnCard: card.name_on_card,
    cardNumber: "**** **** **** " + tail,
    expire: card.expire_month + "/" + card.expire_year,
    isDefault: !!card.is_default
  };
});
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST add new payment card
router.post("/", authenticateToken, async (req, res) => {
  try {
    let { nameOnCard, cardNumber, expiryDate, cvv, setDefault, cardType } = req.body;

    // expiryDate is in "MM/YY" format
    if (!nameOnCard || !cardNumber || !expiryDate || !cvv) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Validate card number format
    if (!/^\d{4} \d{4} \d{4} \d{4}$/.test(cardNumber)) {
      return res.status(400).json({ message: "Card number format is invalid. Use '#### #### #### ####'." });
    }

    // Validate expiry date format
    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      return res.status(400).json({ message: "Expiry date must be in MM/YY format." });
    }

    const [expireMonthStr, expireYearStr] = expiryDate.split("/");
    const mm = parseInt(expireMonthStr, 10);
    let yy = parseInt(expireYearStr, 10);

    if (mm < 1 || mm > 12) {
      return res.status(400).json({ message: "Expiry month must be between 01 and 12." });
    }

    // Convert YY to full YYYY
    let yyyy = 2000 + yy;

    // === Enforce minimum expiry ===
    const now = new Date();
    const min = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const exp = new Date(yyyy, mm - 1, 1);

    const expKey = yyyy * 100 + mm;
    const minKey = min.getFullYear() * 100 + (min.getMonth() + 1);

    if (expKey < minKey) {
      return res.status(400).json({
        message: "Expiry date must be at least one month after the current month."
      });
    }

    // Validate CVV
    if (!/^\d{3}$/.test(cvv)) {
      return res.status(400).json({ message: "CVV must be 3 digits." });
    }

    // If setDefault is true, unset previous default
    if (setDefault) {
      await pool.query("UPDATE payment_methods SET is_default = FALSE WHERE userID = ?", [req.user.userID]);
    }

const lastFour = cardNumber.replace(/\s/g, '').slice(-4);
const monthInt = mm;      // 1..12
const yearInt  = yyyy;    // e.g., 2026

await pool.query(
  `INSERT INTO payment_methods 
 (userID, name_on_card, card_number, expire_month, expire_year, cvv, is_default, card_type)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
[
  req.user.userID, nameOnCard, cardNumber, monthInt, yearInt, cvv,
  !!setDefault, cardType
]

);


    res.status(201).json({ message: "Card added successfully" });
  } catch (err) {
    console.error("Add card error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Set a payment method as default
router.put("/default/:paymentID", authenticateToken, async (req, res) => {
  let { paymentID } = req.params;
  const userID = req.user.userID;

  // Convert paymentID to integer and validate
  paymentID = parseInt(paymentID, 10);
  if (isNaN(paymentID)) {
    return res.status(400).json({ message: "Invalid paymentID" });
  }

  try {
    // 1. Set all user's cards to not default
    await pool.query(
      "UPDATE payment_methods SET is_default = false WHERE userID = ?",
      [userID]
    );

    // 2. Set the selected card as default
    const [result] = await pool.query(
      "UPDATE payment_methods SET is_default = true WHERE paymentID = ? AND userID = ?",
      [paymentID, userID]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    res.status(200).json({ message: "Payment method set as default" });
  } catch (err) {
    console.error("Set default card error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Edit a payment method by ID
router.put("/:paymentID", authenticateToken, async (req, res) => {
  let { paymentID } = req.params;
  const userID = req.user.userID;
  const { nameOnCard, cardNumber, expireMonth, expireYear, cvv } = req.body;

  paymentID = parseInt(paymentID, 10);
  if (isNaN(paymentID)) {
    return res.status(400).json({ message: "Invalid paymentID" });
  }

  // Validate required fields
  if (!nameOnCard || !cardNumber || !expireMonth || !expireYear || !cvv) {
    return res.status(400).json({ message: "All card fields are required." });
  }

  // Mask last four digits for storage
  const lastFour = cardNumber.replace(/\s/g, '').slice(-4);

  try {
    const [result] = await pool.query(
      `UPDATE payment_methods 
 SET name_on_card = ?, card_number = ?, expire_month = ?, expire_year = ?, cvv = ?
 WHERE paymentID = ? AND userID = ?`,
[nameOnCard, cardNumber, expireMonth, expireYear, cvv, paymentID, userID]


    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Payment method not found" });
    }
    res.status(200).json({ message: "Card updated successfully" });
  } catch (err) {
    console.error("Update card error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


 // update card info
 





module.exports = router;
