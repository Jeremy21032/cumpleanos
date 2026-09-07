/*
  Servidor de la sorpresa + editor de fotos de Mome.

  En Render → Environment, pega (sin comillas):
    ADMIN_PIN      PIN que usas en /mome/editar
    GITHUB_TOKEN   token con permiso de contents:write (no lo pongas en el HTML)
    GITHUB_REPO    Jeremy21032/cumpleanos   (opcional; este es el default)
    GITHUB_BRANCH  main                     (opcional)
*/

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 10000);
const REPO = process.env.GITHUB_REPO || "Jeremy21032/cumpleanos";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const SLOTS = new Set(["1", "2", "3", "4", "5", "6", "final"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: function (_req, file, cb) {
    if (/^image\//.test(file.mimetype) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.originalname || "")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se aceptan imágenes"));
    }
  }
});

function pinOk(input) {
  const expected = process.env.ADMIN_PIN || "";
  const got = String(input == null ? "" : input);
  const a = crypto.createHash("sha256").update(got, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return expected.length > 0 && crypto.timingSafeEqual(a, b);
}

function repoPathFor(slot) {
  return slot === "final" ? "mome/fotos/final.jpg" : "mome/fotos/" + slot + ".jpg";
}

async function githubJson(url, opts) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const err = new Error("Falta GITHUB_TOKEN en Render");
    err.status = 503;
    throw err;
  }
  const res = await fetch(url, Object.assign({}, opts, {
    headers: Object.assign({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cumpleanos-mome-editor"
    }, (opts && opts.headers) || {})
  }));
  const body = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const err = new Error(body.message || ("GitHub " + res.status));
    err.githubStatus = res.status;
    err.status = res.status === 401 || res.status === 403 ? 503 : 502;
    throw err;
  }
  return body;
}

async function commitFoto(slot, jpegBuffer) {
  const filePath = repoPathFor(slot);
  const api = "https://api.github.com/repos/" + REPO + "/contents/" + filePath;
  let sha;
  try {
    const current = await githubJson(api + "?ref=" + encodeURIComponent(BRANCH));
    sha = current.sha;
  } catch (err) {
    if (err.githubStatus !== 404) throw err;
  }
  await githubJson(api, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update " + filePath + " from /mome/editar",
      content: jpegBuffer.toString("base64"),
      branch: BRANCH,
      sha: sha
    })
  });
}

const app = express();
app.disable("x-powered-by");

const hidden = new Set([
  "/server.js", "/package.json", "/package-lock.json", "/Dockerfile",
  "/render.yaml", "/nginx.conf.template", "/.gitignore", "/.dockerignore"
]);
app.use(function (req, res, next) {
  if (hidden.has(req.path)) return res.status(404).end();
  next();
});

app.post("/mome/api/foto", function (req, res) {
  upload.single("file")(req, res, function (err) {
    if (err) {
      res.status(400).json({ ok: false, error: err.message || "Archivo no válido" });
      return;
    }
    Promise.resolve()
      .then(async function () {
        if (!process.env.ADMIN_PIN) {
          const e = new Error("Falta ADMIN_PIN en Render");
          e.status = 503;
          throw e;
        }
        if (!pinOk(req.body && req.body.pin)) {
          const e = new Error("PIN incorrecto");
          e.status = 401;
          throw e;
        }
        const slot = String((req.body && req.body.slot) || "");
        if (!SLOTS.has(slot)) {
          const e = new Error("Elige una foto del 1 al 6 o la final");
          e.status = 400;
          throw e;
        }
        if (!req.file || !req.file.buffer) {
          const e = new Error("Falta la imagen");
          e.status = 400;
          throw e;
        }
        const jpeg = await sharp(req.file.buffer, { failOn: "none" })
          .rotate()
          .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
        await commitFoto(slot, jpeg);
        res.json({
          ok: true,
          slot: slot,
          path: "/" + repoPathFor(slot),
          mensaje: "Listo. Render tardará ~1 minuto; recarga /mome"
        });
      })
      .catch(function (e) {
        res.status(e.status || 500).json({ ok: false, error: e.message || "Error al guardar" });
      });
  });
});

app.get(["/mome/editar", "/mome/editar/"], function (_req, res) {
  res.sendFile(path.join(ROOT, "mome", "editar.html"));
});

app.get("/mome", function (_req, res) {
  res.redirect(301, "/mome/");
});

app.use("/mome", express.static(path.join(ROOT, "mome"), {
  index: "index.html",
  fallthrough: true
}));

app.use(express.static(ROOT, {
  index: "index.html",
  dotfiles: "ignore"
}));

app.listen(PORT, "0.0.0.0", function () {
  console.log("listening on " + PORT);
});
