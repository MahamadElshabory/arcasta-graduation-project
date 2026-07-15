// Website/dashboard.js
const express = require("express");
const router = express.Router();
const pool = require("./database");

// Middleware: ensure supplier is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ message: "Unauthorized. Please log in." });
}

router.get("/", isAuthenticated, async (req, res) => {
  const supplierID = req.session.user.supplierID; // e.g. "SUP001"

  try {
    // 1) Total number of requests
    const [salesResult] = await pool.query(
      `SELECT COUNT(*) AS totalSales
       FROM requests
       WHERE JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 2) Pending orders count
    const [pendingResult] = await pool.query(
      `SELECT COUNT(*) AS pendingCount
       FROM requests
       WHERE status = 'Pending'
         AND JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 3) Orders placed today
    const [todayOrdersResult] = await pool.query(
      `SELECT COUNT(*) AS todayOrders
       FROM requests
       WHERE DATE(created_at) = CURDATE()
         AND JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 4) Full request list
    const [requestsResult] = await pool.query(
      `SELECT *
       FROM requests
       WHERE JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL
       ORDER BY created_at DESC`,
      [supplierID]
    );

    // 5) Total unique customers
    const [totalCustomersResult] = await pool.query(
      `SELECT COUNT(DISTINCT userID) AS totalCustomers
       FROM requests
       WHERE JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 6) New customers in the last 7 days
    const [newCustomersResult] = await pool.query(
      `SELECT COUNT(DISTINCT r.userID) AS newCustomers
       FROM requests r
       WHERE JSON_SEARCH(r.products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL
         AND DATE(r.created_at) >= (CURDATE() - INTERVAL 7 DAY)`,
      [supplierID]
    );

    // 7) Governorates of customers
    const [governoratesResult] = await pool.query(
      `SELECT DISTINCT a.state_region
       FROM requests r
       JOIN addresses a ON r.userID = a.userID
       WHERE JSON_SEARCH(r.products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 8) Bestselling products
    const [bestsellingResult] = await pool.query(
      `SELECT p.name AS product_name, SUM(j.quantity) AS count
       FROM requests r
       JOIN JSON_TABLE(
              r.products,
              '$[*]' COLUMNS(
                 productID  VARCHAR(64)  PATH '$.productID',
                 supplierID VARCHAR(64)  PATH '$.supplierID',
                 quantity   INT          PATH '$.quantity'
              )
            ) AS j
            ON TRUE
       JOIN products p
         ON (CONVERT(p.productID USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          = (CONVERT(j.productID USING utf8mb4) COLLATE utf8mb4_unicode_ci)
       WHERE (CONVERT(j.supplierID USING utf8mb4) COLLATE utf8mb4_unicode_ci)
           = (CONVERT(?           USING utf8mb4) COLLATE utf8mb4_unicode_ci)
       GROUP BY p.name
       ORDER BY count DESC
       LIMIT 5`,
      [supplierID]
    );

    // 9) Profit (sum of accepted orders)
    const [profitResult] = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) AS profit
       FROM requests
       WHERE status = 'Accepted'
         AND JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL`,
      [supplierID]
    );

    // 10) Monthly income
    const [monthlyIncomeResult] = await pool.query(
      `SELECT MONTH(created_at) AS month,
              COALESCE(SUM(total_price), 0) AS income
       FROM requests
       WHERE status = 'Accepted'
         AND JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL
       GROUP BY MONTH(created_at)
       ORDER BY month`,
      [supplierID]
    );

    // 11) Weekly income
    const [weeklyIncomeResult] = await pool.query(
      `SELECT DAYOFWEEK(created_at) AS dow,
              DAYNAME(created_at)    AS day,
              COALESCE(SUM(total_price), 0) AS income
       FROM requests
       WHERE status = 'Accepted'
         AND JSON_SEARCH(products, 'one', ?, NULL, '$[*].supplierID') IS NOT NULL
       GROUP BY dow, day
       ORDER BY dow`,
      [supplierID]
    );

    // Construct JSON response
    const dashboardData = {
      dashID: supplierID,
      sales: salesResult[0]?.totalSales ?? 0,
      pending: pendingResult[0]?.pendingCount ?? 0,
      dayorders: todayOrdersResult[0]?.todayOrders ?? 0,
      requests: requestsResult,
      newcustomers: newCustomersResult[0]?.newCustomers ?? 0, // ✅ fixed
      totalcustomers: totalCustomersResult[0]?.totalCustomers ?? 0,
      govermnates: governoratesResult.map((g) => g.state_region),
      bestselling: bestsellingResult,
      profit: profitResult[0]?.profit ?? 0,
      monthlyIncome: monthlyIncomeResult.map((r) => ({
        month: r.month,
        income: r.income,
      })),
      weeklyIncome: weeklyIncomeResult.map((r) => ({
        day: r.day,
        income: r.income,
      })),
    };

    res.status(200).json(dashboardData);
  } catch (err) {
    console.error("Dashboard generation failed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
