(function () {
  var MAX_FOTOS = 12;
  var C = ConfigStore.load();
  var fotos = (C.fotos && C.fotos.length ? C.fotos.slice() : [""]);
  if (!fotos.length) fotos = [""];
  var fotoFinal = C.fotoFinal || "";
  var slotActivo = null;

  function val(id) { return document.getElementById(id).value; }
  function set(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? "" : value;
  }

  function cartaToText(carta) {
    if (Array.isArray(carta)) return carta.join("\n");
    return carta || "";
  }

  set("destinatario", C.destinatario);
  set("remitente", C.remitente);
  set("fecha", C.fecha);
  set("titulo", String(C.titulo || "").replace(/<br\s*\/?>/gi, "\n"));
  set("intro", C.intro);
  set("mensajes", (C.mensajesCorazon || []).join("\n"));
  set("carta", cartaToText(C.carta));
  set("capitulo", String(C.capitulo || "").replace(/<br\s*\/?>/gi, "\n"));
  set("brindis", String(C.brindis || "").replace(/<br\s*\/?>/gi, "\n"));
  set("fraseFinal", String(C.fraseFinal || "").replace(/<br\s*\/?>/gi, "\n"));
  set("footer", C.footer);
  set("cancionInicio", C.cancionInicio || 0);

  function pintarFotos() {
    var grid = document.getElementById("fotosGrid");
    grid.innerHTML = fotos.map(function (src, i) {
      var inner = src
        ? '<img src="' + src + '" alt="Foto ' + (i + 1) + '">'
        : "<span>Foto " + (i + 1) + " del polaroid</span>";
      var quitar = fotos.length > 1
        ? '<button type="button" class="foto-quitar" data-remove="' + i + '" aria-label="Quitar foto">×</button>'
        : "";
      return '<div class="foto-slot" data-i="' + i + '">' + inner + quitar + "</div>";
    }).join("");

    var finalSlot = document.getElementById("slotFinal");
    if (fotoFinal) finalSlot.innerHTML = '<img src="' + fotoFinal + '" alt="Foto final">';
    else finalSlot.innerHTML = "<span>Foto final</span>";

    var addBtn = document.getElementById("btnAddFoto");
    addBtn.disabled = fotos.length >= MAX_FOTOS;
    addBtn.textContent = fotos.length >= MAX_FOTOS
      ? "Máximo " + MAX_FOTOS + " fotos"
      : "Añadir fotos";
  }

  pintarFotos();

  document.getElementById("fotosGrid").addEventListener("click", function (e) {
    var quitar = e.target.closest("[data-remove]");
    if (quitar) {
      e.preventDefault();
      e.stopPropagation();
      var idx = Number(quitar.getAttribute("data-remove"));
      if (fotos.length <= 1) return;
      fotos.splice(idx, 1);
      pintarFotos();
      return;
    }
    var slot = e.target.closest(".foto-slot");
    if (!slot) return;
    slotActivo = Number(slot.getAttribute("data-i"));
    document.getElementById("filePolaroid").click();
  });

  function esPlaceholder(src) {
    return !src || src.indexOf("data:") !== 0;
  }

  function avisoFotos(texto) {
    var el = document.getElementById("fotosAviso");
    if (el) el.textContent = texto;
  }

  function agregarArchivos(fileList, reemplazarIndice) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && (/^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name) || !f.type);
    });
    if (!files.length) {
      avisoFotos("No se pudieron leer las imágenes. Vuelve a elegirlas.");
      return Promise.resolve();
    }

    var hueco = MAX_FOTOS - fotos.filter(function (src) { return !esPlaceholder(src); }).length;
    if (reemplazarIndice != null && !esPlaceholder(fotos[reemplazarIndice])) hueco += 1;
    if (hueco <= 0) {
      avisoFotos("Ya tienes " + MAX_FOTOS + " fotos.");
      pintarFotos();
      return Promise.resolve();
    }
    files = files.slice(0, hueco);
    avisoFotos("Cargando " + files.length + " foto" + (files.length === 1 ? "" : "s") + "…");

    return Promise.all(files.map(function (file) {
      return ConfigStore.compressImage(file).catch(function (err) {
        console.error(err);
        return ConfigStore.fileToDataURL(file);
      });
    })).then(function (urls) {
      urls = urls.filter(Boolean);
      if (!urls.length) throw new Error("Ninguna imagen se pudo abrir");
      if (reemplazarIndice != null && urls.length === 1) {
        fotos[reemplazarIndice] = urls[0];
      } else if (fotos.every(esPlaceholder)) {
        fotos = urls.slice();
      } else {
        urls.forEach(function (url) {
          var vacio = fotos.findIndex(function (src) { return !src; });
          if (vacio >= 0) fotos[vacio] = url;
          else fotos.push(url);
        });
      }
      if (fotos.length > MAX_FOTOS) fotos = fotos.slice(0, MAX_FOTOS);
      pintarFotos();
      avisoFotos(fotos.filter(function (s) { return !esPlaceholder(s); }).length + " fotos en el polaroid. Hasta 12.");
    }).catch(function (err) {
      console.error(err);
      avisoFotos("No se pudieron cargar las fotos. Prueba otra vez.");
      alert("No se pudieron cargar las fotos: " + ((err && err.message) || err));
    });
  }

  document.getElementById("filePolaroid").addEventListener("change", function (e) {
    var lista = Array.prototype.slice.call(e.target.files || []);
    var indice = slotActivo;
    e.target.value = "";
    slotActivo = null;
    if (!lista.length) return;
    agregarArchivos(lista, indice);
  });

  document.getElementById("btnAddFoto").addEventListener("click", function () {
    if (fotos.length >= MAX_FOTOS && fotos.every(function (src) { return !esPlaceholder(src); })) return;
    slotActivo = null;
    document.getElementById("filePolaroid").click();
  });

  document.getElementById("slotFinal").addEventListener("click", function () {
    document.getElementById("fileFinal").click();
  });
  document.getElementById("fileFinal").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    ConfigStore.compressImage(file).then(function (dataUrl) {
      fotoFinal = dataUrl;
      pintarFotos();
    });
  });

  function nl(s) {
    return String(s || "").trim().replace(/\n/g, "<br>");
  }

  function fotosParaGuardar() {
    var filled = fotos.filter(Boolean);
    if (filled.length) return filled;
    if (C.fotos && C.fotos.length) return C.fotos.slice();
    return ["fotos/1.svg"];
  }

  function recoger() {
    var mensajes = val("mensajes").split("\n").map(function (m) { return m.trim(); }).filter(Boolean);
    var carta = val("carta").split("\n");
    var data = Object.assign({}, C, {
      destinatario: val("destinatario").trim() || "Amor",
      remitente: val("remitente").trim(),
      fecha: val("fecha").trim(),
      titulo: nl(val("titulo")),
      intro: val("intro").trim() || "Toca el corazón",
      mensajesCorazon: mensajes.length ? mensajes : C.mensajesCorazon,
      carta: carta,
      capitulo: nl(val("capitulo")),
      brindis: nl(val("brindis")),
      fraseFinal: nl(val("fraseFinal")),
      footer: val("footer").trim() || "Hecho con amor",
      cancionInicio: Number(val("cancionInicio") || 0),
      fotos: fotosParaGuardar(),
      fotoFinal: fotoFinal || C.fotoFinal || "fotos/final.svg"
    });
    var music = document.getElementById("cancionFile").files[0];
    return { data: data, music: music };
  }

  document.getElementById("btnVer").addEventListener("click", function () {
    var rec = recoger();
    if (rec.music) {
      rec.data.cancion = URL.createObjectURL(rec.music);
    }
    ConfigStore.save(rec.data);
    location.href = "index.html";
  });

  document.getElementById("btnDescargar").addEventListener("click", function () {
    var btn = document.getElementById("btnDescargar");
    btn.disabled = true;
    btn.textContent = "Preparando archivo...";
    armarHTML()
      .then(function (html) {
        var blob = new Blob([html], { type: "text/html;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (val("destinatario").trim() || "cumple") + ".html";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      })
      .catch(function (err) {
        alert("No se pudo crear el archivo. Abre esta página con el servidor local e inténtalo de nuevo.");
        console.error(err);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = "Descargar página para compartir";
      });
  });

  function armarHTML() {
    var rec = recoger();
    return Promise.all([
      fetch("index.html").then(function (r) { return r.text(); }),
      fetch("css/style.css").then(function (r) { return r.text(); }),
      fetch("js/config-store.js").then(function (r) { return r.text(); }),
      fetch("js/landing.js").then(function (r) { return r.text(); }),
      Promise.all(rec.data.fotos.map(function (src) { return ConfigStore.srcToDataURL(src); })),
      ConfigStore.srcToDataURL(rec.data.fotoFinal),
      rec.music ? ConfigStore.fileToDataURL(rec.music) : Promise.resolve("")
    ]).then(function (parts) {
      rec.data.fotos = parts[4];
      rec.data.fotoFinal = parts[5];
      rec.data.cancion = parts[6] || "";
      rec.data.exportado = true;
      var html = parts[0]
        .replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + parts[1] + "\n</style>")
        .replace('<script src="config.js"></script>', "<script>window.CONFIG = " + JSON.stringify(rec.data) + ";</script>")
        .replace('<script src="js/config-store.js"></script>', "<script>\n" + parts[2] + "\n</script>")
        .replace('<script src="js/landing.js"></script>', "<script>\n" + parts[3] + "\n</script>");
      return html;
    });
  }

  document.getElementById("btnReset").addEventListener("click", function () {
    if (!confirm("¿Volver a los textos y fotos de ejemplo?")) return;
    ConfigStore.clear();
    location.reload();
  });

  window.cargarFotosPolaroid = agregarArchivos;
})();
