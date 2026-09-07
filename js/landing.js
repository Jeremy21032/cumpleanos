(function () {
  var C = window.ConfigStore ? ConfigStore.load() : window.CONFIG;
  var params = new URLSearchParams(location.search);
  var skipIntro = params.get("skip") === "1";

  function setHTML(id, html) {
    var el = document.getElementById(id);
    if (el && html != null) el.innerHTML = html;
  }

  function tituloPagina() {
    if (C.remitente && C.destinatario) return C.remitente + " & " + C.destinatario;
    return C.destinatario || "Feliz cumpleaños";
  }

  function aplicarContenido() {
    document.title = tituloPagina();
    setHTML("introNombre", C.destinatario || "");
    setHTML("introMsg", C.intro || "Toca el corazón");
    setHTML("frasePrincipal", C.titulo || "");
    setHTML("sobreHint", C.sobreHint || "Hay algo dentro para ti");
    setHTML("lacreTexto", C.lacre || "Descúbrelo");
    setHTML("cartaTexto", Array.isArray(C.carta) ? C.carta.join("<br>") : (C.carta || "").replace(/\n/g, "<br>"));
    setHTML("capituloTexto", C.capitulo || "");
    setHTML("fraseBrindis", C.brindis || "");
    setHTML("fraseFinal", C.fraseFinal || "");
    setHTML("footerTexto", C.footer || "Hecho con amor");

    var fotos = (C.fotos && C.fotos.length ? C.fotos.slice() : ["fotos/1.svg"]).filter(Boolean);
    if (!fotos.length) fotos = ["fotos/1.svg"];
    var track = document.getElementById("carruselTrack");
    var dotsWrap = document.getElementById("dots");
    track.innerHTML = fotos.map(function (src, i) {
      return '<div class="slide"><img src="' + src + '" alt="Foto ' + (i + 1) + '"></div>';
    }).join("");
    dotsWrap.innerHTML = fotos.map(function (_, i) {
      return '<span class="dot' + (i === 0 ? " activo" : "") + '" data-i="' + i + '"></span>';
    }).join("");
    dotsWrap.style.display = fotos.length > 1 ? "flex" : "none";

    var imgFinal = document.getElementById("imgFinal");
    imgFinal.src = C.fotoFinal || "fotos/final.svg";
  }

  var audioCtx = null;
  var tema = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
    return audioCtx;
  }
  function urlCancion() {
    var src = (C.cancion || "").trim();
    if (!src) return "";
    if (/^(https?:|blob:|data:|\/)/i.test(src)) return src;
    return "/" + src.replace(/^\.?\//, "");
  }
  function prepararCancion() {
    var src = urlCancion();
    if (!src) return;
    getCtx();
    if (!tema) {
      tema = new Audio(src);
      tema.preload = "auto";
      tema.volume = 0.65;
      tema.loop = true;
      try { tema.currentTime = Number(C.cancionInicio || 0); } catch (e) {}
    }
    var p = tema.play();
    if (p && p.catch) {
      p.catch(function (err) {
        console.warn("No se pudo reproducir la canción", err);
      });
    }
  }
  function reproducirCancion() {
    if (!urlCancion()) {
      console.warn("No hay canción en CONFIG");
      return;
    }
    prepararCancion();
  }
  function tone(freq, start, dur, vol) {
    var c = getCtx();
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + dur + 0.05);
  }
  function playMelody() {
    var notas = [392, 523, 659, 523, 784];
    var tiempos = [0, 0.35, 0.7, 1.05, 1.4];
    notas.forEach(function (f, i) { tone(f, tiempos[i], 0.8, 0.11); });
  }

  function escribirTexto(id, texto, velocidad) {
    var el = document.getElementById(id);
    var i = 0;
    el.textContent = "";
    var iv = setInterval(function () {
      el.textContent += texto.charAt(i);
      i++;
      if (i >= texto.length) clearInterval(iv);
    }, velocidad);
  }

  function abrirLanding() {
    document.getElementById("intro").style.display = "none";
    document.getElementById("landing").style.display = "block";
    reproducirCancion();
    setTimeout(function () {
      var f = document.getElementById("flashLayer");
      if (f) f.style.opacity = "0";
      setTimeout(function () { if (f) f.remove(); }, 500);
    }, 100);
    escribirTexto("fechaTexto", C.fecha || "", 90);
    setTimeout(function () {
      document.getElementById("polaroidWrap").classList.add("visible");
    }, 500);
  }

  function iniciarJuegoCorazon() {
    var TOTAL_CLICKS = (C.mensajesCorazon && C.mensajesCorazon.length) || 6;
    var clickCount = 0;
    var heart = document.getElementById("heartBtn");
    var barra = document.getElementById("barraFill");
    var pctText = document.getElementById("pctText");
    var introMsg = document.getElementById("introMsg");
    var abriendo = false;
    var mensajes = C.mensajesCorazon || [];

    if (skipIntro) {
      abrirLanding();
      return;
    }

    heart.addEventListener("click", function () {
      if (abriendo || clickCount >= TOTAL_CLICKS) return;
      prepararCancion();
      clickCount++;
      var nivel = (clickCount / TOTAL_CLICKS) * 100;
      barra.style.width = nivel + "%";
      pctText.textContent = Math.round(nivel) + "%";
      introMsg.textContent = mensajes[clickCount - 1] || "";
      heart.style.animation = "none";
      heart.style.transform = "scale(1.35)";
      setTimeout(function () {
        heart.style.transform = "scale(1)";
        heart.style.animation = "";
      }, 120);

      if (clickCount >= TOTAL_CLICKS) {
        abriendo = true;
        reproducirCancion();
        setTimeout(abrirLanding, 450);
      }
    });
  }

  function iniciarCarrusel() {
    var track = document.getElementById("carruselTrack");
    var dots = document.querySelectorAll(".dot");
    var total = track.children.length;
    var idx = 0;
    var carrusel = document.getElementById("carrusel");
    var wrap = document.getElementById("polaroidWrap");
    var startX = 0;
    var deltaX = 0;
    var dragging = false;
    var visible = false;
    var timer = null;
    var AUTO_MS = 5000;
    var AFTER_USER_MS = 8000;

    function pararAuto() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function programarAuto(delay) {
      pararAuto();
      if (total < 2 || !visible || dragging) return;
      timer = setTimeout(function () {
        timer = null;
        if (!visible || dragging || total < 2) return;
        ir((idx + 1) % total, false);
      }, delay == null ? AUTO_MS : delay);
    }

    function ir(i, fromUser) {
      idx = Math.max(0, Math.min(total - 1, i));
      track.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = "translateX(calc(-" + (idx * 100) + "%))";
      dots.forEach(function (d, j) { d.classList.toggle("activo", j === idx); });
      programarAuto(fromUser ? AFTER_USER_MS : AUTO_MS);
    }

    dots.forEach(function (d) {
      d.addEventListener("click", function () { ir(Number(d.dataset.i), true); });
    });

    function pointerStart(x) {
      startX = x;
      deltaX = 0;
      dragging = true;
      pararAuto();
      track.style.transition = "none";
    }
    function pointerMove(x) {
      if (!dragging) return;
      deltaX = x - startX;
      var base = -idx * carrusel.offsetWidth;
      track.style.transform = "translateX(" + (base + deltaX) + "px)";
    }
    function pointerEnd() {
      if (!dragging) return;
      dragging = false;
      if (deltaX > 50) ir(idx - 1, true);
      else if (deltaX < -50) ir(idx + 1, true);
      else ir(idx, true);
    }

    carrusel.addEventListener("touchstart", function (e) { pointerStart(e.touches[0].clientX); }, { passive: true });
    carrusel.addEventListener("touchmove", function (e) { pointerMove(e.touches[0].clientX); }, { passive: true });
    carrusel.addEventListener("touchend", pointerEnd);
    carrusel.addEventListener("mousedown", function (e) { e.preventDefault(); pointerStart(e.clientX); });
    window.addEventListener("mousemove", function (e) { pointerMove(e.clientX); });
    window.addEventListener("mouseup", pointerEnd);

    function setVisible(on) {
      visible = !!on;
      if (visible) programarAuto(AUTO_MS);
      else pararAuto();
    }

    var target = wrap || carrusel;
    if (total >= 2 && "IntersectionObserver" in window && target) {
      var obs = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          setVisible(entrada.isIntersecting);
        });
      }, { threshold: 0.35 });
      obs.observe(target);
    } else if (total >= 2) {
      var landing = document.getElementById("landing");
      setVisible(landing && landing.style.display !== "none");
    }
  }

  function lanzarConfetiDesdeArriba() {
    var layer = document.getElementById("fxLayer");
    var colores = ["#c0785a", "#e0a458", "#d4547e", "#7f77dd", "#5dcaa5"];
    for (var n = 0; n < 200; n++) {
      (function () {
        setTimeout(function () {
          var p = document.createElement("div");
          p.className = "confeti-fx";
          var w = 6 + Math.random() * 7;
          var h = w * 0.5;
          var dur = (2.4 + Math.random() * 2.2) * 1.15;
          var rot = (Math.random() - 0.5) * 720;
          p.style.left = (Math.random() * 100) + "%";
          p.style.top = "-20px";
          p.style.width = w + "px";
          p.style.height = h + "px";
          p.style.background = colores[Math.floor(Math.random() * colores.length)];
          p.style.transform = "rotate(0deg)";
          p.style.transition = "top " + dur + "s linear, transform " + dur + "s linear, opacity 0.3s ease";
          layer.appendChild(p);
          requestAnimationFrame(function () {
            p.style.opacity = "0.9";
            p.style.top = "105%";
            p.style.transform = "rotate(" + rot + "deg)";
          });
          setTimeout(function () { p.remove(); }, dur * 1000 + 300);
        }, n * 14);
      })();
    }
  }

  function animarBrindis() {
    var izq = document.getElementById("mitadIzq");
    var der = document.getElementById("mitadDer");
    var frase = document.getElementById("fraseBrindis");
    var brillos = document.querySelectorAll(".brillo-fx");

    setTimeout(function () {
      izq.style.transition = "transform 1.6s cubic-bezier(.4,0,.2,1)";
      der.style.transition = "transform 1.6s cubic-bezier(.4,0,.2,1)";
      izq.style.transform = "translateX(0)";
      der.style.transform = "translateX(0)";
    }, 100);

    setTimeout(function () {
      izq.style.transition = "transform 0.18s ease";
      der.style.transition = "transform 0.18s ease";
      izq.style.transform = "translateX(-2px) rotate(-4deg)";
      der.style.transform = "translateX(2px) rotate(4deg)";

      brillos.forEach(function (b, i) {
        setTimeout(function () {
          b.style.transition = "opacity 0.35s ease, transform 0.5s cubic-bezier(.34,1.56,.64,1)";
          b.style.opacity = "1";
          b.style.transform = b.style.transform.replace("scale(0.5)", "scale(1.1)") + " translateY(-6px)";
          setTimeout(function () {
            b.style.transition = "opacity 0.6s ease";
            b.style.opacity = "0";
          }, 400);
        }, i * 40);
      });
    }, 1700);

    setTimeout(function () {
      izq.style.transform = "translateX(0) rotate(0deg)";
      der.style.transform = "translateX(0) rotate(0deg)";
    }, 1900);

    setTimeout(function () {
      frase.style.opacity = "1";
      document.getElementById("fotoFinalWrap").classList.add("visible");
      document.getElementById("fraseFinal").classList.add("visible");
      document.getElementById("btnGuardarWrap").classList.add("visible");
    }, 2100);
  }

  function observarBrindisParaAnimar() {
    var el = document.getElementById("brindisWrap");
    var yaAnimado = false;
    if (!("IntersectionObserver" in window)) {
      setTimeout(animarBrindis, 1500);
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting && !yaAnimado) {
          yaAnimado = true;
          animarBrindis();
          obs.disconnect();
        }
      });
    }, { threshold: 0.45 });
    obs.observe(el);
  }

  function lanzarCelebracion() {
    setTimeout(function () {
      document.getElementById("brindisWrap").classList.add("visible");
      observarBrindisParaAnimar();
    }, 300);
  }

  function iniciarSobre() {
    var opened = false;
    document.getElementById("sobre").addEventListener("click", function () {
      if (opened) return;
      opened = true;
      playMelody();
      this.classList.add("abierto");
      setTimeout(lanzarConfetiDesdeArriba, 1800);
      setTimeout(lanzarCelebracion, 5300);
    });
  }

  function textoPlano(html) {
    return String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  }

  function iniciarGuardar() {
    document.getElementById("btnGuardar").addEventListener("click", function () {
      var btn = this;
      btn.disabled = true;
      var textoOriginal = btn.textContent;
      btn.textContent = "Preparando...";

      var canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      var c = canvas.getContext("2d");
      var grad = c.createLinearGradient(0, 0, 0, 1920);
      grad.addColorStop(0, "#faf7f2");
      grad.addColorStop(1, "#f0e6d8");
      c.fillStyle = grad;
      c.fillRect(0, 0, 1080, 1920);

      function dibujarTextos() {
        var lineas = textoPlano(C.fraseFinal || "Gracias por compartir\ntu vida conmigo").split("\n");
        c.textAlign = "center";
        c.fillStyle = "#9b7a52";
        c.font = "italic 56px Georgia, serif";
        lineas.forEach(function (linea, i) {
          c.fillText(linea, 540, 1550 + i * 70);
        });
        c.font = "28px Georgia, serif";
        c.fillStyle = "rgba(106,82,53,0.55)";
        c.fillText((textoPlano(C.footer) || "HECHO CON AMOR").toUpperCase(), 540, 1820);
        finalizar();
      }

      function finalizar() {
        canvas.toBlob(function (blob) {
          var file = new File([blob], "momento.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: "Nuestro momento" }).catch(function () {});
          } else {
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "momento.png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          }
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }, "image/png");
      }

      var imgFinal = document.getElementById("imgFinal");
      if (imgFinal && imgFinal.complete && imgFinal.naturalWidth) {
        var tam = 760;
        var lado = Math.min(imgFinal.naturalWidth, imgFinal.naturalHeight);
        var sx = (imgFinal.naturalWidth - lado) / 2;
        var sy = (imgFinal.naturalHeight - lado) / 2;
        try {
          c.drawImage(imgFinal, sx, sy, lado, lado, 160, 560, tam, tam);
        } catch (e) {}
        dibujarTextos();
      } else {
        dibujarTextos();
      }
    });
  }

  aplicarContenido();
  iniciarJuegoCorazon();
  iniciarCarrusel();
  iniciarSobre();
  iniciarGuardar();
})();
