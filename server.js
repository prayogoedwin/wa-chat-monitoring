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

let users = [{ username: "admin", password: "password" }];
let sessions = {};
let whatsappClients = {};
let qrCodes = {};

function loadData(filename) {
    return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename)) : {};
}

// 🔹 Load data saat server dimulai
let chatLogs = loadData("chats.json");
let connections = loadData("connections.json");


// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
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

// 🔹 fungsi untuk simpan dan baca data ke file JSON
function saveData(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
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


// 🔹 Buat wa client
function createWhatsAppClient(number) {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: `session-${number}` }), // Setiap nomor punya sesi unik
        puppeteer: { headless: true }
    });

    if (!chatLogs[number]) chatLogs[number] = { in: [], out: [] };

    client.on("qr", async (qr) => {
        qrCodes[number] = await qrcode.toDataURL(qr);
        
        // Perbarui status koneksi jadi false saat QR Code muncul lagi
        connections[number] = { connected: false };
        saveData("connections.json", connections);
    });

    client.on("ready", () => {
        console.log(`WhatsApp ${number} siap digunakan.`);
        delete qrCodes[number];
        connections[number] = { connected: true };
        saveData("connections.json", connections);
    });

    client.on("authenticated", () => {
        console.log(`WhatsApp ${number} berhasil diautentikasi.`);
    });

    // Jika terputus, coba reconnect
    client.on('disconnected', (reason) => {
        console.log(`❌ WhatsApp ${number} terputus: ${reason}`);
        connections[number] = { connected: false };
        saveData("connections.json", connections);

        // Coba reconnect setelah 5 detik
        setTimeout(() => {
            console.log(`🔄 Mencoba reconnect WhatsApp ${number}...`);
            createWhatsAppClient(number);
        }, 5000);
    });

    client.on("message", (message) => {
        chatLogs[number].in.unshift({ from: message.from, body: message.body, timestamp: message.timestamp });
        saveData("chats.json", chatLogs);
    });

    client.on("message_create", (message) => {
        if (message.fromMe) {
            chatLogs[number].out.unshift({ to: message.to, body: message.body, timestamp: message.timestamp });
            saveData("chats.json", chatLogs);
        }
    });

    whatsappClients[number] = client;
    client.initialize();
}

// 🔹 Pulihkan koneksi saat server dinyalakan
Object.keys(connections).forEach((number) => {
    if (connections[number].connected) createWhatsAppClient(number);
});

// API: Koneksikan WhatsApp
app.post("/whatsapp/connect", (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "Nomor WA harus diisi!" });

    if (whatsappClients[number]) {
        return res.json({ success: true, message: "Nomor sudah terhubung!", connected: true });
    }

    createWhatsAppClient(number);
    res.json({ success: true, message: "Silakan scan QR Code." });
});

// API: Dapatkan QR Code WA
app.get("/whatsapp/qrcode/:number", (req, res) => {
    const { number } = req.params;
    res.json({ qr: qrCodes[number] || null });
});

// API: Dapatkan daftar WA yang terhubung
app.get("/whatsapp/list", (req, res) => {
    const list = Object.keys(whatsappClients).map((number) => ({
        number,
        connected: connections[number]?.connected || false,
        chat_in: chatLogs[number]?.in.length || 0,
        chat_out: chatLogs[number]?.out.length || 0
    }));
    res.json(list);
});

