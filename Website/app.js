const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS config
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://dev-arcasta.vercel.app",
  "http://134.209.226.207",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: "10mb" })); // or higher, e.g. 20mb

// ✅ Session config
app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true only if using HTTPS
  })
);

// ✅ API Routes
const login = require("./login");
const registerSupplier = require("./registerSupplier");
const forgotpassword = require("./forgotpassword");
const logoutRoute = require("./logout");
const productRoutes = require("./product");
const requestRoutes = require("./requests");
const inventoryRoutes = require("./inventory");
const productByIdRoutes = require("./productById");
const dashboardRoutes = require("./dashboard");
const chatbotRoutes = require("./chatbot");
const reviewRoutes = require("./reviews");
const salesRoutes = require("./sales");
const notificationRoutes = require("./notification");

app.use("/api/login", login);
app.use("/api/registerverify", registerSupplier);
app.use("/api/forgotpassword", forgotpassword);
app.use("/api/logout", logoutRoute);
app.use("/api/products/id", productByIdRoutes);
app.use("/api/products", productRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/notifications", notificationRoutes);

// ✅ Health check route for frontend
app.get("/api/test", (req, res) => {
  res.json({ message: "✅ Backend is alive through NGINX!" });
});

// ✅ Default homepage
app.get("/", (req, res) => {
  res.send("ARcasta Backend is running 🚀");
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

require("./db_worker");