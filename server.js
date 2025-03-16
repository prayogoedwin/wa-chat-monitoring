const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const qrcode = require("qrcode");
const fs = require("fs");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());
app.use(session({ secret: "secret-key", resave: false, saveUninitialized: true }));

app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
});

// Middleware cek login
function isAuthenticated(req, res, next) {
    console.log("Middleware isAuthenticated dipanggil");
    console.log("Session User:", req.session.user); // Debugging
    if (req.session.user) {
        return next();
    }
    res.status(401).send("Unauthorized");
}

// 🔹 Proteksi akses ke dashboard sebelum login
app.get("/dashboard.html", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// 🔹 Middleware khusus untuk melindungi akses langsung ke file dashboard.html
app.use((req, res, next) => {
    if (req.path === "/dashboard.html" && !req.session.user) {
        return res.status(401).send("Unauthorized");
    }
    next();
});

// 🔹 Sajikan file statis (CSS, JS, gambar tetap bisa diakses)
app.use(express.static(path.join(__dirname, "public")));

// 🔹 Halaman login
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 🔹 Proses login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = [{ username: "admin", password: "password" }];
    const user = users.find((u) => u.username === username && u.password === password);

    if (user) {
        req.session.user = user;
        res.redirect("/dashboard.html");
    } else {
        res.status(401).send("Login gagal");
    }
});

// 🔹 Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
