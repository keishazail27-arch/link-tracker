const express = require("express");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const moment = require("moment-timezone");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", true); // agar IP asli terbaca di Render

// ====== DATA SEMENTARA DI MEMORI ======
// Catatan: akan hilang saat redeploy/restart. Untuk simpan permanen lihat langkah opsional di bawah.
let logs = [];

// ====== STATIC FILES ======
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/dashboard", express.static(path.join(__dirname, "views")));

// Halaman landing sederhana
app.get("/", (req, res) => {
  res.send(`
    <h1>Link Tracker</h1>
    <p>Gunakan tautan <code>/track</code> untuk tracking klik.</p>
    <ul>
      <li>Contoh link tracking: <a href="/track?to=https://example.com">/track?to=https://example.com</a></li>
      <li>Dashboard: <a href="/dashboard/dashboard.html">/dashboard/dashboard.html</a></li>
    </ul>
  `);
});

// Jadikan /dashboard langsung ke file HTML
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// ====== UTIL ======
function getClientIp(req) {
  let ip =
    (req.headers["x-forwarded-for"] || req.ip || "")
      .toString()
      .split(",")[0]
      .trim();
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");
  return ip;
}

function safeDest(input) {
  if (!input) return null;
  try {
    const u = new URL(input);
    if (["http:", "https:"].includes(u.protocol)) return u.toString();
  } catch (e) {}
  return null;
}

// ====== ENDPOINT TRACK ======
app.get("/track", async (req, res) => {
  try {
    // Tentukan tujuan redirect (optional via ?to=)
    const dest =
      safeDest(req.query.to) ||
      process.env.DEFAULT_REDIRECT ||
      "https://google.com";

    // Ambil IP + user-agent
    const ip = getClientIp(req);
    const ua = new UAParser(req.get("user-agent") || "");

    // Geolokasi gratis via ipapi.co (tanpa API key)
    let geo = {};
    try {
      const { data } = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 5000,
      });
      geo = data || {};
    } catch (e) {
      // gagal geolokasi bukan masalah, tetap lanjut
      geo = {};
    }

    const waktuWIB = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

    const logData = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      ip,
      country: geo.country_name || "Unknown",
      countryCode: geo.country || "XX",
      latitude:
        geo.latitude !== undefined ? Number(geo.latitude) : null,
      longitude:
        geo.longitude !== undefined ? Number(geo.longitude) : null,
      device: ua.device.type || "Desktop",
      os: ua.os.name || "",
      browser: ua.browser.name || "",
      time: waktuWIB,
      dest,
    };

    // simpan log terbaru di depan
    logs.unshift(logData);
    if (logs.length > 5000) logs.pop();

    // Redirect ke tujuan akhir
    res.redirect(dest);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error tracking");
  }
});

// ====== API untuk dashboard ======
app.get("/api/logs", (req, res) => {
  res.json(logs);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
