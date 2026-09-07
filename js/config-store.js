(function (global) {
  var KEY = "cumple-config";

  function defaults() {
    return JSON.parse(JSON.stringify(global.CONFIG || {}));
  }

  function load() {
    try {
      if (global.CONFIG && global.CONFIG.exportado) return defaults();
      var saved = localStorage.getItem(KEY);
      if (!saved) return defaults();
      return Object.assign(defaults(), JSON.parse(saved));
    } catch (e) {
      return defaults();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function compressImage(file, maxSize, quality) {
    maxSize = maxSize || 900;
    quality = quality || 0.72;
    return fileToDataURL(file).then(function (dataUrl) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch (err) {
            resolve(dataUrl);
          }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      });
    });
  }

  function fileToDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function srcToDataURL(src) {
    if (!src || src.indexOf("data:") === 0) return Promise.resolve(src);
    return fetch(src).then(function (r) { return r.blob(); }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
  }

  global.ConfigStore = {
    load: load,
    save: save,
    clear: clear,
    compressImage: compressImage,
    fileToDataURL: fileToDataURL,
    srcToDataURL: srcToDataURL
  };
})(window);
