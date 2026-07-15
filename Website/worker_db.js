require("dotenv").config();
const axios = require("axios");
const pool = require("./database");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://165.227.151.248:8000";
const TICK_MS = Number(process.env.JOB_POLL_MS || 2000);
const MAX_ATTEMPTS = Number(process.env.JOB_MAX_ATTEMPTS || 3);
const RESCUE_MINUTES = 30; // requeue jobs stuck >30min

// --- Atomic claim (MySQL-safe) ---
async function claimOneQueuedJob(conn) {
  // Use a separate connection-owned transaction
  await conn.beginTransaction();
  try {
    // Pick the oldest queued job and lock it so others can't claim it simultaneously.
    // If your MySQL is <8.0 and errors on SKIP LOCKED, remove "SKIP LOCKED".
    const [rows] = await conn.query(`
      SELECT id, product_id, payload, attempts
      FROM model_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (!rows.length) {
      await conn.commit();
      return null;
    }

    const job = rows[0];

    // Mark as processing and bump attempts
    await conn.query(
      `UPDATE model_jobs
       SET status='processing',
           picked_at=NOW(),
           attempts=attempts+1
       WHERE id = ?`,
      [job.id]
    );

    // Reflect the attempts increment in returned object
    job.attempts = Number(job.attempts || 0) + 1;

    await conn.commit();
    return job;
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}

// --- Rescue stale jobs ---
async function rescueStaleJobs(conn) {
  const [res] = await conn.query(
    `UPDATE model_jobs
     SET status='queued'
     WHERE status='processing'
       AND finished_at IS NULL
       AND TIMESTAMPDIFF(MINUTE, picked_at, NOW()) > ?`,
    [RESCUE_MINUTES]
  );
  if (res.affectedRows > 0) {
    console.warn(`[worker] ♻️ Rescued ${res.affectedRows} stale job(s)`);
  }
}

async function processJob(job) {
  const conn = await pool.getConnection();
  try {
    const { id, product_id, payload } = job;
    let imageUrls = [];

    // Parse payload
    try {
      const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
      imageUrls = parsed.imageUrls || [];
    } catch {
      throw new Error("Invalid JSON payload in job");
    }

    console.log(`[worker] ➤ Processing job ${id} for product ${product_id}`);

    await conn.query(
      `UPDATE products SET model_status='processing', model_error=NULL WHERE productID=?`,
      [product_id]
    );

    // Call AI service
    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/generate`,
      { image_urls: imageUrls, product_id },
      { timeout: 30 * 60 * 1000 } // 30 min
    );

    const glbUrl = aiRes?.data?.glb_model_url || null;
    const objUrl = aiRes?.data?.obj_model_url || null;
    if (!glbUrl && !objUrl) throw new Error("AI did not return model URLs");

    // Success → update product + job
    await conn.query(
      `UPDATE products
       SET glb_url=?, obj_url=?, model_status='ready', model_error=NULL
       WHERE productID=?`,
      [glbUrl, objUrl, product_id]
    );
    await conn.query(
      `UPDATE model_jobs
       SET status='ready', finished_at=NOW(), error=NULL
       WHERE id=?`,
      [id]
    );

    console.log(`[worker] ✅ Job ${id} DONE -> product ${product_id}`);
  } catch (err) {
    console.error(`[worker] ❌ Job ${job?.id} failed:`, err?.message);
    const msg = err?.message || String(err);

    const conn2 = await pool.getConnection();
    try {
      if (job.attempts >= MAX_ATTEMPTS) {
        await conn2.query(
          `UPDATE products SET model_status='failed', model_error=? WHERE productID=?`,
          [msg, job.product_id]
        );
        await conn2.query(
          `UPDATE model_jobs SET status='failed', error=?, finished_at=NOW() WHERE id=?`,
          [msg, job.id]
        );
        console.warn(`[worker] 🚫 Job ${job.id} marked failed (max attempts).`);
      } else {
        await conn2.query(`UPDATE model_jobs SET status='queued', error=? WHERE id=?`, [
          msg,
          job.id,
        ]);
        console.warn(`[worker] 🔁 Job ${job.id} requeued.`);
      }
    } finally {
      conn2.release();
    }
  } finally {
    conn.release();
  }
}

async function tick() {
  const conn = await pool.getConnection();
  try {
    await rescueStaleJobs(conn);
    const job = await claimOneQueuedJob(conn);
    if (job) await processJob(job);
  } catch (e) {
    console.error("[worker] tick error:", e?.message || e);
  } finally {
    conn.release();
  }
}

console.log("[worker] ✅ DB-backed worker started.");
setInterval(tick, TICK_MS);
