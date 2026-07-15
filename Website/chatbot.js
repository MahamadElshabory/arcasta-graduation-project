// routes/chatbot.js
const express = require("express");
const router = express.Router();
const pool = require("./database");

// ---------------- Heuristic filters (no schema change) ----------------

// Material synonyms → MySQL REGEXP fragments (loose word boundaries)
const MATERIAL_REGEX = {
  leather:
    "(^|[^a-z])(leather|full[- ]?grain|top[- ]?grain|cowhide|hide)([^a-z]|$)",
  "faux leather":
    "(^|[^a-z])(faux\\s+leather|vegan\\s+leather|pleather|pu|synthetic\\s+leather)([^a-z]|$)",
  velvet: "(^|[^a-z])(velvet)([^a-z]|$)",
  linen: "(^|[^a-z])(linen)([^a-z]|$)",
  fabric: "(^|[^a-z])(fabric|cloth|textile|upholstered)([^a-z]|$)",
  wood: "(^|[^a-z])(wood|wooden|timber|oak|walnut|pine)([^a-z]|$)",
  metal: "(^|[^a-z])(metal|steel|iron|aluminum|aluminium)([^a-z]|$)",
  glass: "(^|[^a-z])(glass)([^a-z]|$)",
};

// Seats → MySQL REGEXP like: 3-seater / 3 seats / three seater
function seatsRegex(n) {
  // Matches "3-seater" / "3 seater" / "3 seats" (and ignores nearby non-word chars)
  return `(^|[^a-z0-9])(${n}\\s*[- ]?\\s*(seater|seats?))([^a-z0-9]|$)`;
}

// ---------------- Normalizer ----------------

function normalizeProduct(row) {
  const out = { ...row };
  try {
    if (typeof out.picture === "string") out.picture = JSON.parse(out.picture);
  } catch {
    /* ignore */
  }

  const images = Array.isArray(out.picture)
    ? out.picture
    : Array.isArray(out.picture_urls)
    ? out.picture_urls
    : out.picture
    ? [out.picture]
    : [];

  return {
    productID: out.productID,
    name: out.name,
    price: out.price != null ? Number(out.price) : null,
    stock: Number.isFinite(out.stock) ? out.stock : null,
    description: out.description ?? null,
    images,
    model_status: out.model_status ?? null,
    glb_url: out.glb_url ?? null,
    obj_url: out.obj_url ?? null,
  };
}

// ---------------- Routes ----------------

// GET /api/chatbot/products/search
router.get("/products/search", async (req, res) => {
  try {
    const {
      // free-text & simple facets
      name = "",
      category = "",
      style = "",
      // existing numeric filters
      min_price,
      max_price,
      // new heuristic filters
      material = "",
      seats = "",
      price_max = "",
      // paging
      limit = 20,
      offset = 0,
    } = req.query;

    const where = [];
    const params = [];

    // ---- Conversational search: split name into tokens; ALL must match (AND)
    if (name) {
      const tokens = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      for (const t of tokens) {
        const pat = `%${t}%`;
        // NULL-safe scan of name/description
        where.push("(COALESCE(name,'') LIKE ? OR COALESCE(description,'') LIKE ?)");
        params.push(pat, pat);
      }
    }

    // ---- Simple facets you may or may not use (only apply if provided)
    if (category) {
      where.push("category = ?");
      params.push(category);
    }
    if (style) {
      where.push("style = ?");
      params.push(style);
    }

    // ---- Price filters
    if (min_price !== undefined && min_price !== "") {
      const v = Number(min_price);
      if (!Number.isNaN(v)) {
        where.push("price >= ?");
        params.push(v);
      }
    }
    // support both max_price and price_max
    const maxPriceValue =
      price_max !== "" && price_max !== undefined
        ? Number(price_max)
        : max_price !== "" && max_price !== undefined
        ? Number(max_price)
        : null;
    if (maxPriceValue != null && !Number.isNaN(maxPriceValue)) {
      where.push("price <= ?");
      params.push(maxPriceValue);
    }

    // ---- Heuristic: material via REGEXP over name/description
    if (material) {
      const key = String(material).toLowerCase();
      const rx = MATERIAL_REGEX[key];
      if (rx) {
        where.push(
          "(COALESCE(name,'') REGEXP ? OR COALESCE(description,'') REGEXP ?)"
        );
        params.push(rx, rx);
      }
    }

    // ---- Heuristic: seats via REGEXP "3-seater" / "3 seats"
    if (seats) {
      const n = Number(seats);
      if (Number.isFinite(n) && n > 0) {
        const rx = seatsRegex(n);
        where.push(
          "(COALESCE(name,'') REGEXP ? OR COALESCE(description,'') REGEXP ?)"
        );
        params.push(rx, rx);
      }
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const lim = Math.max(1, Math.min(100, Number(limit)));
    const off = Math.max(0, Number(offset));

    // total
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products ${whereSQL}`,
      params
    );

    // rows
    const [rows] = await pool.query(
      `SELECT * FROM products ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );

    const items = rows.map(normalizeProduct);
    return res.json({ total, items, next_offset: off + items.length });
  } catch (err) {
    console.error("chatbot search error:", err);
    return res
      .status(500)
      .json({
        error: { code: "SERVER_ERROR", message: "Internal server error" },
      });
  }
});

// GET /api/chatbot/products/:id
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM products WHERE productID = ? LIMIT 1",
      [id]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Product not found" } });
    return res.json(normalizeProduct(rows[0]));
  } catch (err) {
    console.error("chatbot by id error:", err);
    return res
      .status(500)
      .json({
        error: { code: "SERVER_ERROR", message: "Internal server error" },
      });
  }
});

// GET /api/chatbot/products/:id/model-status
router.get("/products/:id/model-status", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT productID, model_status, glb_url, obj_url, model_error
       FROM products WHERE productID = ?`,
      [id]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Product not found" } });
    const r = rows[0];
    return res.json({
      productID: r.productID,
      model_status: r.model_status ?? null,
      glb_url: r.glb_url ?? null,
      obj_url: r.obj_url ?? null,
      error: r.model_error ?? null,
    });
  } catch (err) {
    console.error("chatbot model-status error:", err);
    return res
      .status(500)
      .json({
        error: { code: "SERVER_ERROR", message: "Internal server error" },
      });
  }
});

module.exports = router;
