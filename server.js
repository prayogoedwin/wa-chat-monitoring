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


// Jalankan server
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});