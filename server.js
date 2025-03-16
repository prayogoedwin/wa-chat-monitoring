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
app.use(express.static(path.join(__dirname, "public")));


let users = [{ username: "admin", password: "password" }];
let sessions = {};
let whatsappClients = {};
let qrCodes = {};

// Halaman login
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});


// Middleware cek login
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.status(401).send("Unauthorized");
}

// Proses login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find((u) => u.username === username && u.password === password);
    if (user) {
        req.session.user = user;
        res.redirect("/dashboard.html");
    } else {
        res.status(401).send("Login gagal");
    }
});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// Halaman dashboard (hanya bisa diakses jika login)
app.get("/dashboard.html", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});


// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});