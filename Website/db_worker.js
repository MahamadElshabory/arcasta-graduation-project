// db_worker.js
const pool = require("./database");

async function checkModelJobs() {
  const [rows] = await pool.query(`
    SELECT mj.id, mj.product_id, p.supplierID
    FROM model_jobs mj
    JOIN products p ON mj.product_id = p.productID
    WHERE mj.status = 'ready'
  `);

  console.log("🔍 Model jobs found:", rows.length);

  for (let job of rows) {
    if (!job.supplierID) {
      console.warn(`⚠️ Skipping job ${job.id} - no supplierID found for product ${job.product_id}`);
      continue;
    }

    const message = `Your 3D model for product ${job.product_id} is ready!`;

    await pool.query(
      `INSERT INTO notifications (supplierID, type, message)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE supplierID = ? AND type = 'MODEL_READY' AND message = ?
           AND created_at >= NOW() - INTERVAL 1 HOUR
       )`,
      [job.supplierID, "MODEL_READY", message, job.supplierID, message]
    );
  }
}

async function checkNewRequests() {
  const [orders] = await pool.query(
    "SELECT * FROM requests WHERE created_at >= NOW() - INTERVAL 5 MINUTE"
  );

  for (let order of orders) {
    let products = order.products;

    if (typeof products === "string") {
      try {
        products = JSON.parse(products);
      } catch (e) {
        console.error("❌ Failed to parse products JSON:", order.products, e);
        continue;
      }
    }

    for (let product of products) {
      const message = `New request for your product '${product.product_name}' (x${product.quantity})`;
      await pool.query(
        `INSERT INTO notifications (supplierID, type, message)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM notifications
           WHERE supplierID = ? AND type = 'NEW_REQUEST' AND message = ?
             AND created_at >= NOW() - INTERVAL 1 HOUR
         )`,
        [product.supplierID, "NEW_REQUEST", message, product.supplierID, message]
      );
    }
  }
}

async function checkLowStock() {
  const [rows] = await pool.query(
    "SELECT productID, supplierID, name, stock FROM products WHERE stock <= 10"
  );

  for (let product of rows) {
    let message;
    let type;

    if (product.stock === 0) {
      message = `Product '${product.name}' (ID: ${product.productID}) is OUT OF STOCK!`;
      type = "OUT_OF_STOCK";
    } else {
      message = `Product '${product.name}' (ID: ${product.productID}) is running low. Only ${product.stock} left.`;
      type = "LOW_STOCK";
    }

    await pool.query(
      `INSERT INTO notifications (supplierID, type, message)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications
         WHERE supplierID = ? AND type = ? AND message = ?
           AND created_at >= NOW() - INTERVAL 1 HOUR
       )`,
      [product.supplierID, type, message, product.supplierID, type, message]
    );
  }
}

async function run() {
  console.log("🔄 Running notification checks...");
  await checkModelJobs();
  await checkNewRequests();
  await checkLowStock();
}

run();

// Run every 30 seconds
setInterval(run, 30000);
