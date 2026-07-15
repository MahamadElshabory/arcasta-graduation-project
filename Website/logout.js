const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  if (!req.session.user || !req.session.user.supplierID) {
    return res.status(401).json({ message: "You are not logged in." });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed." });
    }

    res.clearCookie("connect.sid");
    res.status(200).json({ message: "Logged out successfully." });
  });
});

module.exports = router;
