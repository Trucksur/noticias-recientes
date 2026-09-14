#!/usr/bin/env python3
"""Publica el informe diario en la copia de trabajo de la rama gh-pages.

Mantiene:
  - AAAA/MM/DD/index.html  archivo de ediciones (una por día; la última del día gana)
  - index.html             portada, copia de la edición más reciente
  - ediciones.json         índice que lee el menú lateral y la rutina
  - nav.js                 menú lateral, inyectado en cada página con <script id="covey-nav">

Lo ejecuta la GitHub Action publish-pages.yml. La rutina no lo usa.
"""

import argparse
import html
import json
import os
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

RE_FECHA = re.compile(r"Edición\s+(\d{2})\.(\d{2})\.(\d{4})")
RE_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S | re.I)
RE_ALTA = re.compile(r'<article\s+class="item\s+alta\b')
RE_NAV = re.compile(r'<script[^>]*\bid="covey-nav"[^>]*>\s*</script>\n?')
RE_FIN_BODY = re.compile(r"</body>", re.I)
RE_RUTA_EDICION = re.compile(r"^(\d{4})/(\d{2})/(\d{2})/index\.html$")

# Restos de cuando gh-pages se creó a partir de main.
SOBRANTES = [".github", "README.md", ".gitignore", "plantilla.html"]


def fecha_de(contenido):
    m = RE_FECHA.search(contenido)
    if not m:
        return None
    dia, mes, anio = (int(g) for g in m.groups())
    try:
        return date(anio, mes, dia)
    except ValueError:
        return None


def titular_de(contenido):
    m = RE_H1.search(contenido)
    if not m:
        return ""
    texto = re.sub(r"<[^>]+>", "", m.group(1))
    return " ".join(html.unescape(texto).split())


def con_menu(contenido, prefijo, fecha):
    """Devuelve el HTML con el <script> del menú inyectado exactamente una vez."""
    contenido = RE_NAV.sub("", contenido)
    dato = f' data-fecha="{fecha.isoformat()}"' if fecha else ""
    etiqueta = f'<script id="covey-nav" src="{prefijo}nav.js"{dato} defer></script>\n'
    cierres = list(RE_FIN_BODY.finditer(contenido))
    if not cierres:
        return contenido.rstrip("\n") + "\n" + etiqueta
    pos = cierres[-1].start()
    return contenido[:pos] + etiqueta + contenido[pos:]


def escribir(ruta, contenido):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if ruta.exists() and ruta.read_text(encoding="utf-8") == contenido:
        return
    ruta.write_text(contenido, encoding="utf-8", newline="\n")


def ruta_edicion(sitio, fecha):
    return sitio / f"{fecha:%Y}" / f"{fecha:%m}" / f"{fecha:%d}" / "index.html"


def archivar(sitio, contenido, fecha):
    escribir(ruta_edicion(sitio, fecha), con_menu(contenido, "../../../", fecha))


def ediciones_archivadas(sitio):
    """Lista (fecha, ruta) de las ediciones archivadas, de la más reciente a la más antigua."""
    encontradas = []
    for ruta in sitio.glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9]/index.html"):
        m = RE_RUTA_EDICION.match(ruta.relative_to(sitio).as_posix())
        if not m:
            continue
        try:
            encontradas.append((date(*(int(g) for g in m.groups())), ruta))
        except ValueError:
            continue
    return sorted(encontradas, reverse=True)


def recuperar_historial(sitio, ref):
    """Archiva los días que pasaron por la portada de `ref` y aún no están en el archivo.

    Si un día se publicó varias veces gana la última. Nunca sobrescribe un día ya archivado.
    """
    shas = subprocess.run(
        ["git", "log", "--reverse", "--format=%H", ref, "--", "index.html"],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    por_fecha = {}
    for sha in shas:
        contenido = subprocess.run(
            ["git", "show", f"{sha}:index.html"], check=True, capture_output=True,
        ).stdout.decode("utf-8").replace("\r\n", "\n")
        fecha = fecha_de(contenido)
        if fecha:
            por_fecha[fecha] = contenido
    recuperadas = []
    for fecha, contenido in sorted(por_fecha.items()):
        if not ruta_edicion(sitio, fecha).exists():
            archivar(sitio, contenido, fecha)
            recuperadas.append(fecha)
    return recuperadas


def generar_indice(sitio):
    ediciones = []
    for fecha, ruta in ediciones_archivadas(sitio):
        contenido = ruta.read_text(encoding="utf-8")
        ediciones.append({
            "fecha": fecha.isoformat(),
            "ruta": f"{fecha:%Y/%m/%d}/",
            "titular": titular_de(contenido),
            "alta": len(RE_ALTA.findall(contenido)),
        })
    indice = json.dumps({"ediciones": ediciones}, ensure_ascii=False, indent=2) + "\n"
    escribir(sitio / "ediciones.json", indice)
    return ediciones


def anotar_salida(clave, valor):
    salida = os.environ.get("GITHUB_OUTPUT")
    if salida:
        with open(salida, "a", encoding="utf-8") as f:
            f.write(f"{clave}={valor}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sitio", required=True, type=Path, help="copia de trabajo de la rama gh-pages")
    parser.add_argument("--assets", required=True, type=Path, help="carpeta que contiene nav.js")
    parser.add_argument("--edicion", type=Path, help="index.html generado por la rutina")
    parser.add_argument("--recuperar-historial", metavar="REF",
                        help="archiva los días del historial de esa referencia que falten (p. ej. origin/gh-pages)")
    args = parser.parse_args()
    sitio = args.sitio

    for nombre in SOBRANTES:
        ruta = sitio / nombre
        if ruta.is_dir():
            shutil.rmtree(ruta)
        elif ruta.exists():
            ruta.unlink()

    if args.recuperar_historial:
        recuperadas = recuperar_historial(sitio, args.recuperar_historial)
        print("Recuperadas del historial:", ", ".join(f.isoformat() for f in recuperadas) or "ninguna")

    portada = sitio / "index.html"
    portada_sin_fecha = None
    if args.edicion:
        contenido = args.edicion.read_text(encoding="utf-8")
        fecha = fecha_de(contenido)
        if fecha:
            archivar(sitio, contenido, fecha)
            anotar_salida("fecha", fecha.isoformat())
            print("Edición archivada:", fecha.isoformat())
        else:
            print("::warning::No se encontró «Edición DD.MM.AAAA» en index.html: "
                  "se publica en la portada sin archivar.")
            portada_sin_fecha = contenido

    # Reinyecta el menú en todo el archivo por si cambió la etiqueta (idempotente).
    for fecha, ruta in ediciones_archivadas(sitio):
        escribir(ruta, con_menu(ruta.read_text(encoding="utf-8"), "../../../", fecha))

    ediciones = generar_indice(sitio)

    if portada_sin_fecha is not None:
        escribir(portada, con_menu(portada_sin_fecha, "", None))
    elif ediciones:
        ultima = date.fromisoformat(ediciones[0]["fecha"])
        escribir(portada, con_menu(ruta_edicion(sitio, ultima).read_text(encoding="utf-8"), "", ultima))

    shutil.copyfile(args.assets / "nav.js", sitio / "nav.js")
    (sitio / ".nojekyll").touch()
    print(f"Ediciones en el índice: {len(ediciones)}")


if __name__ == "__main__":
    main()
