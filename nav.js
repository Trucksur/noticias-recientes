/*
 * Menú lateral de ediciones del informe diario · Covey
 *
 * Lo inyecta scripts/publicar_edicion.py en cada página publicada:
 *   <script id="covey-nav" src="../../../nav.js" data-fecha="2026-09-14" defer></script>
 * La plantilla y la rutina no lo referencian.
 *
 * Lee ediciones.json de la raíz del sitio y construye Año › Mes › Día.
 * Solo se abren el año y el mes de la edición que se está viendo; el resto,
 * plegado. Si el índice no carga, la página se queda como estaba, sin menú.
 */
(() => {
  "use strict";

  const script = document.currentScript;
  if (!script || !window.fetch) return;

  const raiz = new URL(".", script.src);
  const actual = script.dataset.fecha || "";

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const ANCHO_MINIMO = "(min-width: 1180px)";

  const CSS = `
    :root { --cn-ancho: 232px; }

    .cn-menu {
      position: fixed; top: 0; bottom: 0; left: 0; z-index: 60;
      width: var(--cn-ancho);
      box-sizing: border-box;
      padding: 30px 0 48px;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--navy-deep, #0F1740);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.72);
      font-family: var(--f-data, "IBM Plex Mono", Consolas, monospace);
      font-size: 12px;
      line-height: 1.4;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    }

    .cn-cabecera {
      display: flex; align-items: center; justify-content: space-between;
      min-height: 40px;
      padding: 0 16px 0 24px;
      margin-bottom: 12px;
    }

    .cn-titulo {
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.62);
    }

    .cn-menu summary {
      display: flex; align-items: center; gap: 10px;
      list-style: none;
      cursor: pointer;
      user-select: none;
    }
    .cn-menu summary::-webkit-details-marker { display: none; }
    .cn-menu summary::before {
      content: "";
      flex: none;
      border-style: solid;
      border-width: 4px 0 4px 6px;
      border-color: transparent transparent transparent currentColor;
      opacity: 0.55;
      transition: transform 0.15s ease;
    }
    .cn-menu details[open] > summary::before { transform: rotate(90deg); }
    .cn-menu summary:hover { color: #fff; }

    .cn-num {
      margin-left: auto;
      font-family: var(--f-data, "IBM Plex Mono", Consolas, monospace);
      font-size: 10.5px;
      font-weight: 400;
      letter-spacing: 0.04em;
      color: rgba(255, 255, 255, 0.38);
      font-variant-numeric: tabular-nums;
    }

    .cn-anio > summary {
      padding: 8px 20px 8px 24px;
      font-family: var(--f-display, "Archivo", Arial, sans-serif);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #fff;
    }

    .cn-mes > summary {
      padding: 7px 20px 7px 40px;
      font-family: var(--f-display, "Archivo", Arial, sans-serif);
      font-size: 13.5px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.86);
    }

    .cn-dias { list-style: none; margin: 2px 0 10px; padding: 0; }

    .cn-dias a {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 20px 6px 56px;
      color: rgba(255, 255, 255, 0.66);
      text-decoration: none;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    .cn-dias a:hover { color: #fff; background: rgba(255, 255, 255, 0.04); }
    .cn-dias a[aria-current="page"] {
      color: #fff;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.07);
      box-shadow: inset 3px 0 0 var(--orange, #F5A623);
    }

    .cn-alta { width: 6px; height: 6px; border-radius: 50%; background: #E08375; }

    .cn-oculto {
      position: absolute; width: 1px; height: 1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }

    .cn-menu :focus-visible,
    .cn-barra :focus-visible { outline: 2px solid var(--orange, #F5A623); outline-offset: -2px; }

    .cn-cerrar,
    .cn-abrir {
      appearance: none;
      background: transparent;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 2px;
      cursor: pointer;
    }
    .cn-cerrar:hover, .cn-abrir:hover { border-color: var(--orange, #F5A623); }

    .cn-cerrar { width: 40px; height: 40px; font-size: 20px; line-height: 1; }

    .cn-barra { display: none; }

    .cn-abrir {
      display: inline-flex; align-items: center; gap: 10px;
      min-height: 40px;
      padding: 0 14px;
      font: 600 10.5px/1 var(--f-data, "IBM Plex Mono", Consolas, monospace);
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .cn-icono {
      position: relative;
      box-sizing: border-box;
      width: 14px; height: 10px;
      border-block: 2px solid currentColor;
    }
    .cn-icono::after {
      content: "";
      position: absolute; left: 0; right: 0; top: 50%;
      height: 2px; margin-top: -1px;
      background: currentColor;
    }

    .cn-velo { position: fixed; inset: 0; z-index: 59; background: rgba(4, 7, 24, 0.55); }

    @media ${ANCHO_MINIMO} {
      body.cn-activo { padding-left: var(--cn-ancho); }
      .cn-cerrar, .cn-velo { display: none; }
    }

    @media not all and ${ANCHO_MINIMO} {
      .cn-barra {
        display: flex; align-items: center;
        max-width: 860px;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 10px 44px;
        background: var(--navy-deep, #0F1740);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .cn-menu {
        width: min(300px, 86vw);
        transform: translateX(-100%);
        visibility: hidden;
        transition: transform 0.22s ease, visibility 0s linear 0.22s;
      }
      .cn-menu.cn-abierto {
        transform: none;
        visibility: visible;
        transition: transform 0.22s ease;
        box-shadow: 8px 0 32px rgba(0, 0, 0, 0.35);
      }
      html.cn-bloqueo { overflow: hidden; }
    }

    @media (max-width: 620px) {
      .cn-barra { padding-inline: 24px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .cn-menu, .cn-menu summary::before { transition: none !important; }
    }

    @media print {
      .cn-menu, .cn-barra, .cn-velo { display: none !important; }
      body.cn-activo { padding-left: 0 !important; }
    }
  `;

  const el = (etiqueta, atributos = {}, ...hijos) => {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) {
      if (valor === false || valor == null) continue;
      nodo.setAttribute(clave, valor === true ? "" : valor);
    }
    nodo.append(...hijos);
    return nodo;
  };

  const agrupar = (ediciones) => {
    const anios = new Map();
    for (const edicion of ediciones) {
      const [anio, mes] = edicion.fecha.split("-");
      if (!anios.has(anio)) anios.set(anio, new Map());
      const meses = anios.get(anio);
      if (!meses.has(mes)) meses.set(mes, []);
      meses.get(mes).push(edicion);
    }
    return anios;
  };

  const enlaceDia = (edicion) => {
    const [anio, mes, dia] = edicion.fecha.split("-").map(Number);
    const semana = DIAS[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()];
    const enlace = el("a", {
      href: new URL(edicion.ruta, raiz).href,
      title: edicion.titular || null,
      "aria-current": edicion.fecha === actual ? "page" : null,
    }, el("span", {}, `${semana} ${String(dia).padStart(2, "0")}`));
    if (edicion.alta > 0) {
      enlace.append(
        el("span", { class: "cn-alta", "aria-hidden": "true" }),
        el("span", { class: "cn-oculto" }, ` · ${edicion.alta} de relevancia alta`),
      );
    }
    return el("li", {}, enlace);
  };

  const construir = (ediciones) => {
    ediciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
    const abierta = ediciones.some((e) => e.fecha === actual) ? actual : ediciones[0].fecha;
    const [anioAbierto, mesAbierto] = abierta.split("-");

    const arbol = document.createDocumentFragment();
    for (const [anio, meses] of agrupar(ediciones)) {
      const total = [...meses.values()].reduce((n, dias) => n + dias.length, 0);
      const bloqueAnio = el("details", { class: "cn-anio", open: anio === anioAbierto },
        el("summary", {}, el("span", {}, anio), el("span", { class: "cn-num" }, String(total))));

      for (const [mes, dias] of meses) {
        bloqueAnio.append(el("details", { class: "cn-mes", open: anio === anioAbierto && mes === mesAbierto },
          el("summary", {}, el("span", {}, MESES[Number(mes) - 1]), el("span", { class: "cn-num" }, String(dias.length))),
          el("ol", { class: "cn-dias" }, ...dias.map(enlaceDia))));
      }
      arbol.append(bloqueAnio);
    }
    return arbol;
  };

  const estilo = el("style", { id: "cn-estilo" }, CSS);
  const cerrar = el("button", { type: "button", class: "cn-cerrar", "aria-label": "Cerrar menú de ediciones" }, "×");
  const menu = el("nav", { class: "cn-menu", id: "cn-menu", "aria-label": "Ediciones del informe" },
    el("div", { class: "cn-cabecera" }, el("span", { class: "cn-titulo" }, "Ediciones"), cerrar));
  const abrir = el("button", { type: "button", class: "cn-abrir", "aria-controls": "cn-menu", "aria-expanded": "false" },
    el("span", { class: "cn-icono", "aria-hidden": "true" }), "Ediciones");
  const barra = el("div", { class: "cn-barra" }, abrir);
  const velo = el("div", { class: "cn-velo", hidden: true });

  document.head.append(estilo);
  document.body.classList.add("cn-activo");
  document.body.prepend(barra);
  document.body.append(menu, velo);

  const alternar = (abierto, moverFoco = true) => {
    menu.classList.toggle("cn-abierto", abierto);
    velo.hidden = !abierto;
    abrir.setAttribute("aria-expanded", String(abierto));
    document.documentElement.classList.toggle("cn-bloqueo", abierto);
    if (moverFoco) (abierto ? cerrar : abrir).focus();
  };

  abrir.addEventListener("click", () => alternar(true));
  cerrar.addEventListener("click", () => alternar(false));
  velo.addEventListener("click", () => alternar(false));
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && menu.classList.contains("cn-abierto")) alternar(false);
  });
  window.matchMedia(ANCHO_MINIMO).addEventListener("change", (consulta) => {
    if (consulta.matches && menu.classList.contains("cn-abierto")) alternar(false, false);
  });

  fetch(new URL("ediciones.json", raiz), { cache: "no-cache" })
    .then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject(new Error(`HTTP ${respuesta.status}`))))
    .then((datos) => {
      const ediciones = (datos && datos.ediciones) || [];
      if (!ediciones.length) throw new Error("índice vacío");
      menu.append(construir(ediciones));
      const marcado = menu.querySelector('[aria-current="page"]');
      if (marcado) menu.scrollTop = Math.max(0, marcado.offsetTop - menu.clientHeight / 2);
    })
    .catch(() => {
      document.body.classList.remove("cn-activo");
      [barra, menu, velo, estilo].forEach((nodo) => nodo.remove());
    });
})();
