const express = require("express");
const router = express.Router();
const pool = require("./DB");
const jwt = require("jsonwebtoken");

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Authentication required" });

  jwt.verify(token, "yourSecretKey", (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Helper: figure out which profile photo column (if any) exists
async function resolveProfilePhotoColumn() {
  const dbName = process.env.DB_NAME;
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'users'`,
    [dbName]
  );

  const names = new Set(cols.map((r) => r.COLUMN_NAME));
  if (names.has("profile_photo")) return "profile_photo";
  if (names.has("profilePhoto")) return "profilePhoto";
  if (names.has("photo")) return "photo";
  return null; // none found
}


// Get profile data (includes photo, payment, address)
router.get("/", authenticateToken, async (req, res) => {
  try {
    // 1. Get user basic info (add profile_photo)
    const photoCol = await resolveProfilePhotoColumn();
const selectList =
  "name, email, phone" +
  (photoCol ? `, ${photoCol} AS profilePhoto` : ", NULL AS profilePhoto");

const [userData] = await pool.query(
  `SELECT ${selectList}
     FROM users 
    WHERE userID = ?`,
  [req.user.userID]
);

    if (userData.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Split name into first and last
    const nameParts = userData[0].name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get order count
    const [orderCount] = await pool.query(
      `SELECT COUNT(*) as count FROM requests WHERE userID = ? AND status = 'Accepted'`,
      [req.user.userID]
    );


    // Get payment method (first or fallback)
    const [paymentRows] = await pool.query(
      `SELECT card_type, last_four FROM payment_methods WHERE userID = ? LIMIT 1`, 
      [req.user.userID]
    );
    let paymentMethods = [];
    if (paymentRows.length > 0) {
      paymentMethods = [{ type: paymentRows[0].card_type, lastFour: paymentRows[0].last_four }];
    } else {
      paymentMethods = [{ type: "Visa", lastFour: "34" }]; // fallback/hardcoded
    }

    // Get address (first or null)
    const [addressRows] = await pool.query(
      `SELECT address_line, city, country
        FROM addresses
        WHERE userID = ?
      ORDER BY is_selected DESC, created_at DESC
        LIMIT 1`,
  [req.user.userID]
);

    let address = addressRows.length > 0 ? addressRows[0] : null;

    // Prepare response
    const response = {
      profilePhoto: userData[0].profilePhoto || null,
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      email: userData[0].email,
      phone: userData[0].phone || "",
      paymentMethods,
      orderCount: orderCount[0].count || 12,
      address // or addresses: addressRows (for all addresses)
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update profile (add profilePhoto support)
router.put("/", authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, profilePhoto } = req.body;

    // 1. Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ message: "First and last name required" });
    }

    // 2. Combine names exactly as stored in database
    const fullName = `${firstName} ${lastName}`.trim();

    // 3. Update only the fields shown in the image (add profilePhoto if provided)
    const photoCol = await resolveProfilePhotoColumn();
const sets = ["name = ?", "phone = ?"];
const params = [fullName, phone];

if (typeof profilePhoto !== "undefined" && photoCol) {
  sets.push(`${photoCol} = ?`);
  params.push(profilePhoto);
}

params.push(req.user.userID);

await pool.query(
  `UPDATE users SET ${sets.join(", ")} WHERE userID = ?`,
  params
);

    res.status(200).json({ 
      message: "Profile updated successfully",
      updatedFields: {
        firstName,
        lastName,
        phone,
        ...(typeof profilePhoto !== "undefined" && { profilePhoto })
      }
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Cancel editing - matches image/cancel action
router.post("/cancel", authenticateToken, (req, res) => {
  res.status(200).json({ 
    message: "Changes discarded",
    status: "edit_cancelled"
  });
});

module.exports = router;
