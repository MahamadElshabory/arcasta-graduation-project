const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: "yourSecretKey", // In production, move this to .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Only true if using HTTPS
  })
);

// Import Routes (correct file names)
const Loginmobile = require("./Loginmobile");
const registerCustomer = require("./registerCustomer");
const forgetpassworduser = require("./forgetpassworduser");
const editprofile = require("./editprofile");
const paymentMethod = require("./paymentMethod");
const shippingAddresses = require("./shippingAddresses");
const market = require("./market");
const cart = require("./cart");
const checkoutRouter = require("./checkout");
const favorite = require("./favorite");
const productCard = require("./productCard");
const main = require("./main");
const reviewRoutes = require("./reviewsMobile");
const chatRoutes = require("./chat");
// Attach Routes

app.use("/api/loginn", Loginmobile);
app.use("/api/register", registerCustomer);
app.use("/api/passwordd", forgetpassworduser);
app.use("/api/editprofilee", editprofile);
app.use("/api/payment-methodd", paymentMethod);
app.use("/api/shipping-addressess", shippingAddresses);
app.use("/api/markett", market);
app.use("/api/cartt", cart);
app.use("/api/checkoutt", checkoutRouter);
app.use("/api/favoritee", favorite);
app.use("/api/productt", productCard);
app.use("/api/mainn", main);
app.use("/api/mobile/reviews", reviewRoutes);
app.use("/api", chatRoutes);
console.log("✅ Reviews route mounted at /api/reviews");

// Test Route
app.get("/", (req, res) => {
  res.send("ARcasta Backend is running 🚀");
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
