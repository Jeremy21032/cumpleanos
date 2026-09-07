"""Sirve la página y permite cambiar fotos de /mome desde la web (sin abrir GitHub).

En Render → Environment añade:
  ADMIN_PIN     clave para /mome/editar
  GITHUB_TOKEN  token con permiso Contents del repo
Opcional:
  GITHUB_REPO   por defecto Jeremy21032/cumpleanos
  GITHUB_BRANCH por defecto main
"""
import base64
import hmac
import io
import json
import os
import re
from pathlib import Path

import requests
from flask import Flask, abort, jsonify, redirect, request, send_from_directory
from PIL import Image

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

SLOTS = {str(i): f"mome/fotos/{i}.jpg" for i in range(1, 13)}
SLOTS["final"] = "mome/fotos/final.jpg"
SLOTS["cancion"] = "assets/cancion.mp3"
CONFIG_PATH = "mome/config.js"
MAX_POLAROIDS = 12
BLOCKED = {
    "server.py",
    "requirements.txt",
    "Dockerfile",
    "render.yaml",
    ".gitignore",
    ".dockerignore",
    "nginx.conf.template",
}


def env(name, default=""):
    return os.environ.get(name, default).strip()


def pin_ok(got):
    expected = env("ADMIN_PIN")
    if not expected or not got:
        return False
    return hmac.compare_digest(got.encode("utf-8"), expected.encode("utf-8"))


def to_jpeg(raw):
    img = Image.open(io.BytesIO(raw))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((1400, 1400))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=82, optimize=True)
    return out.getvalue()


def github_headers():
    token = env("GITHUB_TOKEN")
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def commit_file(path, data, message):
    repo = env("GITHUB_REPO", "Jeremy21032/cumpleanos")
    branch = env("GITHUB_BRANCH", "main")
    headers = github_headers()
    if not headers:
        raise RuntimeError("Falta GITHUB_TOKEN en Render")
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    current = requests.get(url, headers=headers, params={"ref": branch}, timeout=30)
    sha = None
    if current.status_code == 200:
        sha = current.json().get("sha")
    elif current.status_code != 404:
        raise RuntimeError(f"GitHub GET {current.status_code}: {current.text[:300]}")
    payload = {
        "message": message,
        "content": base64.b64encode(data).decode("ascii"),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    put = requests.put(url, headers=headers, json=payload, timeout=120)
    if put.status_code not in (200, 201):
        raise RuntimeError(f"GitHub PUT {put.status_code}: {put.text[:400]}")
    return put.json()


def github_get_bytes(path):
    repo = env("GITHUB_REPO", "Jeremy21032/cumpleanos")
    branch = env("GITHUB_BRANCH", "main")
    headers = github_headers()
    if not headers:
        raise RuntimeError("Falta GITHUB_TOKEN en Render")
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    current = requests.get(url, headers=headers, params={"ref": branch}, timeout=30)
    if current.status_code != 200:
        raise RuntimeError(f"GitHub GET {current.status_code}: {current.text[:300]}")
    body = current.json()
    raw = base64.b64decode(body.get("content") or "")
    return raw, body.get("sha")


def parse_config(text):
    match = re.search(r"window\.CONFIG\s*=\s*(\{.*\});", text, re.S)
    if not match:
        raise RuntimeError("No se pudo leer mome/config.js")
    return json.loads(match.group(1))


def dump_config(cfg):
    header = "/* Página de Mome. Para cambiar una foto: reemplaza el jpg en mome/fotos/ y haz git push. */\n"
    return header + "window.CONFIG = " + json.dumps(cfg, ensure_ascii=False, indent=2) + ";\n"


def polaroid_nums(fotos):
    nums = []
    for src in fotos or []:
        match = re.search(r"/(\d+)\.jpe?g$", str(src), re.I)
        if match:
            nums.append(int(match.group(1)))
    return nums


def load_config_local():
    text = (ROOT / CONFIG_PATH).read_text(encoding="utf-8")
    return parse_config(text)


@app.get("/mome/editar")
@app.get("/mome/editar.html")
def editor():
    return send_from_directory(ROOT / "mome", "editar.html")


@app.get("/mome/api/estado")
def api_estado():
    try:
        cfg = load_config_local()
    except Exception:
        cfg = {"fotos": []}
    fotos = list(cfg.get("fotos") or [])
    return jsonify(
        ok=True,
        fotos=fotos,
        fotoFinal=cfg.get("fotoFinal") or "/mome/fotos/final.jpg",
        max=MAX_POLAROIDS,
        siguiente= (max(polaroid_nums(fotos)) + 1) if polaroid_nums(fotos) else 1,
    )


@app.post("/mome/api/foto")
def api_foto():
    if not env("ADMIN_PIN") or not env("GITHUB_TOKEN"):
        return jsonify(error="Falta configurar ADMIN_PIN y GITHUB_TOKEN en Render."), 503
    if not pin_ok(request.form.get("pin", "")):
        return jsonify(error="PIN incorrecto"), 401
    slot = (request.form.get("slot") or "").strip()
    uploaded = request.files.get("foto") or request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify(error="Sube un archivo"), 400
    raw = uploaded.read()
    try:
        if slot in ("nueva", "add", "anadir"):
            cfg_raw, _sha = github_get_bytes(CONFIG_PATH)
            cfg = parse_config(cfg_raw.decode("utf-8"))
            nums = polaroid_nums(cfg.get("fotos"))
            next_n = (max(nums) + 1) if nums else 1
            if next_n > MAX_POLAROIDS:
                return jsonify(error="Ya hay %s polaroids (máximo)." % MAX_POLAROIDS), 400
            slot = str(next_n)
            path = f"mome/fotos/{slot}.jpg"
            data = to_jpeg(raw)
            commit_file(path, data, f"Añadir polaroid {slot} de Mome desde la web.")
            url = f"/mome/fotos/{slot}.jpg"
            fotos = list(cfg.get("fotos") or [])
            if url not in fotos:
                fotos.append(url)
                cfg["fotos"] = fotos
                commit_file(CONFIG_PATH, dump_config(cfg).encode("utf-8"), f"Incluir polaroid {slot} en /mome.")
            dest = ROOT / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            (ROOT / CONFIG_PATH).write_text(dump_config(cfg), encoding="utf-8")
            return jsonify(
                ok=True,
                slot=slot,
                path=url,
                mensaje="Foto %s añadida. Espera ~1 minuto y recarga /mome." % slot,
            )

        path = SLOTS.get(slot)
        if not path:
            return jsonify(error="Elige una foto (1–12 o final) o la canción"), 400
        if slot == "cancion":
            name = (uploaded.filename or "").lower()
            mime = (uploaded.mimetype or "")
            if not (mime.startswith("audio/") or name.endswith((".mp3", ".m4a", ".ogg", ".wav", ".aac"))):
                return jsonify(error="Sube un mp3 u otro audio"), 400
            data = raw
            msg = "Actualizar canción de Mome desde la web."
        else:
            data = to_jpeg(raw)
            msg = f"Actualizar foto {slot} de Mome desde la web."
        commit_file(path, data, msg)
    except Exception as exc:
        return jsonify(error=str(exc)), 502
    dest = ROOT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    extra = " La sorpresa usa /assets/cancion.mp3." if slot == "cancion" else ""
    return jsonify(ok=True, path=f"/{path}", slot=slot, mensaje="Listo. Render tardará ~1 minuto; recarga /mome." + extra)


@app.get("/mome/")
def mome_index():
    return send_from_directory(ROOT / "mome", "index.html")


@app.get("/mome")
def mome_redir():
    return redirect("/mome/", 301)


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:path>")
def public_file(path):
    if path.startswith("mome/api"):
        abort(404)
    name = Path(path).name
    if name in BLOCKED or path.startswith(".git"):
        abort(404)
    target = (ROOT / path).resolve()
    if ROOT not in target.parents and target != ROOT:
        abort(404)
    if not target.is_file():
        abort(404)
    return send_from_directory(target.parent, target.name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(env("PORT") or "10000"))
