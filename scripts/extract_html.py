#!/usr/bin/env python3
"""从 llm-from-scratch/web 抽出目录、名词表和章节壳。

只读源仓。正文里的 .term 改写成 <Term k>，旧 html 链接改写成新路由。
教学句子不改写。第一批只为 READY 里的三章写出面板 HTML、CSS 和交互脚本。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

SRC = Path.home() / "Workspace/fim-ai/llm-from-scratch/web"
OUT = Path(__file__).resolve().parents[1]

READY = {
    "01_bigram_crossentropy_viz.html",
    "06_posttraining_viz.html",
    "21_rlvr_grpo_viz.html",
}

SLUG = {
    "01_bigram_crossentropy_viz.html": "bigram",
    "02_attention_viz.html": "attention",
    "03_transformer_viz.html": "transformer",
    "04_gpt_machine_viz.html": "gpt-machine",
    "05_sampling_viz.html": "sampling",
    "06_posttraining_viz.html": "posttraining",
    "07_pretraining_viz.html": "pretraining",
    "08_sft_viz.html": "sft",
    "09_lora_viz.html": "lora",
    "10_dpo_viz.html": "dpo",
    "11_moe_viz.html": "moe",
    "12_llama_viz.html": "llama",
    "13_linear_attention_viz.html": "linear-attention",
    "14_sparse_attention_viz.html": "sparse-attention",
    "15_ngram_memory_viz.html": "ngram-memory",
    "16_speculative_decoding_viz.html": "speculative-decoding",
    "17_quantization_viz.html": "quantization",
    "18_bpe_viz.html": "bpe",
    "19_flash_attention_viz.html": "flash-attention",
    "20_scaling_law_viz.html": "scaling-law",
    "21_rlvr_grpo_viz.html": "rlvr-grpo",
}

ROUTES = {
    "index.html": "/",
    "glossary.html": "/glossary",
    "notes.html": "/notes",
    "about.html": "/about",
}
for fname, slug in SLUG.items():
    ROUTES[fname] = f"/ch/{slug}"


def read(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def meta(html: str, attr: str) -> str:
    m = re.search(
        rf'<meta[^>]+(?:name|property)="{re.escape(attr)}"[^>]+content="([^"]*)"',
        html,
    )
    if not m:
        m = re.search(
            rf'<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="{re.escape(attr)}"',
            html,
        )
    return m.group(1) if m else ""


def title_of(html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", html, re.S)
    return m.group(1).strip() if m else ""


def style_of(html: str) -> str:
    m = re.search(r"<style>(.*?)</style>", html, re.S)
    if not m:
        raise SystemExit("missing style")
    return m.group(1).strip("\n") + "\n"


def script_of(html: str) -> str:
    blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)
    if not blocks:
        return ""
    return max(blocks, key=len)


def tag_end(html: str, start: int) -> int:
    i = start + 1
    quote = ""
    while i < len(html):
        c = html[i]
        if quote:
            if c == quote:
                quote = ""
        elif c in "\"'":
            quote = c
        elif c == ">":
            return i
        i += 1
    raise ValueError("unclosed tag")


def span_close(html: str, content_start: int) -> int:
    """Return index of the matching </span> for a span whose content starts here."""
    i = content_start
    depth = 1
    while i < len(html) and depth:
        if html.startswith("</span>", i):
            depth -= 1
            if depth == 0:
                return i
            i += 7
            continue
        if html.startswith("<span", i) and (i + 5 == len(html) or html[i + 5] in " \t\n>/"):
            i = tag_end(html, i) + 1
            depth += 1
            continue
        i += 1
    raise ValueError("unclosed span")


def attr(tag: str, name: str) -> str:
    m = re.search(rf'\b{name}="([^"]*)"', tag)
    return m.group(1) if m else ""


def convert_terms(html: str) -> str:
    out = []
    i = 0
    needle = '<span class="term"'
    while True:
        j = html.find(needle, i)
        if j < 0:
            out.append(html[i:])
            break
        out.append(html[i:j])
        end = tag_end(html, j)
        tag = html[j : end + 1]
        close = span_close(html, end + 1)
        inner = convert_terms(html[end + 1 : close])
        key = attr(tag, "data-key")
        name = attr(tag, "data-term")
        defin = attr(tag, "data-def")
        out.append(
            f'<Term k="{key}" name="{name}" def="{defin}">{inner}</Term>'
        )
        i = close + len("</span>")
    return "".join(out)


def rewrite_links(html: str) -> str:
    def repl(m: re.Match[str]) -> str:
        q, href = m.group(1), m.group(2)
        base, _, frag = href.partition("#")
        base = base.removeprefix("./")
        if base not in ROUTES:
            return m.group(0)
        nxt = ROUTES[base] + (("#" + frag) if frag else "")
        return f"href={q}{nxt}{q}"

    return re.sub(r"href=(['\"])([^'\"]+)\1", repl, html)


def prepare_html(html: str) -> str:
    return convert_terms(rewrite_links(html))


def inner(html: str, pattern: str) -> str:
    m = re.search(pattern, html, re.S)
    if not m:
        raise SystemExit(f"missing {pattern}")
    return m.group(1)


def textify(html: str) -> str:
    t = re.sub(r"<[^>]+>", "", html)
    t = (
        t.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return re.sub(r"\s+", " ", t).strip()


def strip_term_iife(script: str) -> str:
    key = script.find("termTip")
    if key < 0:
        return script
    start_fn = script.rfind("(function()", 0, key)
    if start_fn < 0:
        raise SystemExit("term tip iife not found")
    comment = script.rfind("/*", 0, start_fn)
    start = start_fn
    if comment != -1 and "名词" in script[comment:start_fn]:
        start = comment
    paren = script.find("(", start_fn)
    depth = 0
    i = paren
    quote = ""
    while i < len(script):
        c = script[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = ""
        elif c in "\"'`":
            quote = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                i += 1
                break
        i += 1
    while i < len(script) and script[i] in " \t\n;":
        # keep going through `();`
        if script.startswith("();", i) or script.startswith(")();", i):
            break
        i += 1
    if script.startswith("();", i):
        i += 3
    elif script.startswith(")();", i):
        i += 4
    else:
        # `(function(){...})();` — the matched paren is the function's close,
        # then `)();` or `();` depending on whether we consumed the call paren.
        rest = script[i : i + 8]
        m = re.match(r"\)?\(\);", rest)
        if not m:
            raise SystemExit(f"cannot find end of term iife near: {rest!r}")
        i += m.end()
    return script[:start] + "\n" + script[i:]


def rewrite_hash_listeners(script: str) -> str:
    out = []
    i = 0
    needle = "window.addEventListener("
    while True:
        j = script.find(needle, i)
        if j < 0:
            out.append(script[i:])
            break
        paren = j + len("window.addEventListener")
        # only rewrite hashchange
        end = tag_end_paren(script, paren)
        call = script[paren + 1 : end]
        if "hashchange" not in call.split(",", 1)[0]:
            out.append(script[i:end + 1])
            i = end + 1
            continue
        handler = call.split(",", 1)[1].strip()
        out.append(script[i:j])
        out.append(
            f"_hashHandler = {handler};\nwindow.addEventListener('hashchange', _hashHandler)"
        )
        i = end + 1
    return "".join(out)


def tag_end_paren(src: str, paren: int) -> int:
    depth = 0
    i = paren
    quote = ""
    while i < len(src):
        c = src[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = ""
        elif c in "\"'`":
            quote = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unclosed paren")


BOOT_HEAD = """\
/* 由 scripts/extract_html.py 从源页面抽出。交互逻辑保持原脚本，只做了三处外壳替换：
   document 查询限定在本章根节点、名词气泡交给全站 TermTip、hashchange 可在卸载时摘掉。 */
export function boot(__root) {
  const realDocument = globalThis.document
  const document = new Proxy(realDocument, {
    get(target, prop) {
      if (prop === 'getElementById') {
        return (id) => __root.querySelector('#' + CSS.escape(id)) || target.getElementById(id)
      }
      if (prop === 'querySelector') {
        return (sel) => __root.querySelector(sel)
      }
      if (prop === 'querySelectorAll') {
        return (sel) => __root.querySelectorAll(sel)
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  let _hashHandler = null
  const __gSI = globalThis.setInterval
  const __gCI = globalThis.clearInterval
  const __gST = globalThis.setTimeout
  const __gCT = globalThis.clearTimeout
  const __gRAF = globalThis.requestAnimationFrame
  const __gCAF = globalThis.cancelAnimationFrame
  const __timers = new Set()
  const __timeouts = new Set()
  const __rafs = new Set()
  const setInterval = (fn, ms, ...rest) => { const id = __gSI(fn, ms, ...rest); __timers.add(id); return id }
  const clearInterval = (id) => { __timers.delete(id); return __gCI(id) }
  const setTimeout = (fn, ms, ...rest) => { const id = __gST(fn, ms, ...rest); __timeouts.add(id); return id }
  const clearTimeout = (id) => { __timeouts.delete(id); return __gCT(id) }
  const requestAnimationFrame = (fn) => { const id = __gRAF(fn); __rafs.add(id); return id }
  const cancelAnimationFrame = (id) => { __rafs.delete(id); return __gCAF(id) }
"""

BOOT_TAIL = """
  return function cleanup() {
    if (_hashHandler) realDocument.defaultView.removeEventListener('hashchange', _hashHandler)
    for (const id of __timers) __gCI(id)
    for (const id of __timeouts) __gCT(id)
    for (const id of __rafs) __gCAF(id)
    const banner = realDocument.getElementById('congrats')
    if (banner && !__root.contains(banner)) banner.remove()
    realDocument.querySelectorAll('body > canvas').forEach((cv) => {
      if (!__root.contains(cv)) cv.remove()
    })
  }
}
"""


def source_path(href: str) -> str | None:
    m = re.search(r"github\.com/tao-hpu/llm-from-scratch/blob/main/(.+)$", href)
    return m.group(1) if m else None


def code_links(html: str) -> list[dict]:
    m = re.search(r"<!-- code-links:start -->(.*?)<!-- code-links:end -->", html, re.S)
    if not m:
        return []
    found = []
    for href, label in re.findall(r'<a class="filename code-link" href="([^"]+)"[^>]*>(.*?)</a>', m.group(1), re.S):
        kind = "colab" if "colab" in href else "source"
        found.append({"href": href, "label": textify(label), "kind": kind})
    return found


def extract_chapter_page(fname: str) -> dict:
    html = read(fname)
    h1 = inner(html, r"<h1>(.*?)</h1>")
    subtitle = inner(html, r'<p class="subtitle">(.*?)</p>')
    steps_m = re.search(r'<div class="(steps-nav|steps)">\s*(.*?)</div>\s*(?:<!--[^>]*-->\s*)?<div class="hp-bar">', html, re.S)
    if not steps_m:
        raise SystemExit(f"{fname}: steps block not found")
    steps_class = steps_m.group(1)
    nav = []
    for num, label in re.findall(r'<div class="num">(.*?)</div>\s*<div class="label">(.*?)</div>', steps_m.group(2), re.S):
        nav.append(textify(label))
    hp = inner(html, r'<div class="hp-bar">(.*?)</div>')
    panels = []
    for m in re.finditer(r'<section class="panel(?: active)?" id="panel\d+">.*?</section>', html, re.S):
        panels.append(m.group(0))
    if not panels:
        raise SystemExit(f"{fname}: no panels")
    prev = re.search(r'<button class="([^"]*)" id="prevBtn">', html)
    prev_class = prev.group(1) if prev else "btn"
    confetti = 'id="confetti"' in html
    links = code_links(html)
    source = next((source_path(l["href"]) for l in links if l["kind"] == "source"), None)
    colab = next((l["href"] for l in links if l["kind"] == "colab"), None)
    return {
        "docTitle": title_of(html),
        "shareTitle": meta(html, "og:title"),
        "description": meta(html, "description"),
        "h1Html": prepare_html(h1.strip()),
        "subtitleHtml": prepare_html(subtitle.strip()),
        "nav": nav,
        "stepsClass": steps_class,
        "prevClass": prev_class,
        "confetti": confetti,
        "hpHtml": prepare_html(hp.strip()),
        "panelsHtml": prepare_html("\n".join(panels)),
        "css": style_of(html),
        "script": script_of(html),
        "codeLinks": links,
        "source": source,
        "colab": colab,
    }


def extract_index() -> dict:
    html = read("index.html")
    phases = []
    for sec in re.finditer(r'<section class="phase-sec" id="([^"]+)">(.*?)</section>', html, re.S):
        sid, body = sec.group(1), sec.group(2)
        phase = {
            "id": sid,
            "kicker": inner(body, r'class="pt-num">(.*?)</span>'),
            "title": inner(body, r"<h2>(.*?)</h2>"),
            "count": inner(body, r'class="pt-count">(.*?)</span>'),
            "chapters": [],
        }
        for cid, card in re.findall(r'<article class="card" id="([^"]+)">(.*?)</article>', body, re.S):
            href = inner(card, r'<h3><a href="([^"]+)">')
            file = href.split("#", 1)[0]
            title = textify(inner(card, r'<h3><a[^>]*>(.*?)</a>'))
            desc = inner(card, r'<p class="desc">(.*?)</p>').strip()
            summary = textify(inner(card, r"<summary>(.*?)</summary>"))
            go = textify(inner(card, r'<a class="go"[^>]*>(.*?)</a>'))
            steps = []
            for href, sn, st in re.findall(
                r'<a href="([^"]+)"><span class="sn">(.*?)</span><span class="st">(.*?)</span>',
                card,
                re.S,
            ):
                anchor = href.split("#", 1)[1] if "#" in href else ""
                steps.append({"sn": textify(sn), "card": textify(st), "anchor": anchor})
            colab_m = re.search(r'<a class="colab" href="([^"]+)"', card)
            phase["chapters"].append({
                "cardId": cid,
                "file": file,
                "cardTitle": title,
                "cardDescHtml": prepare_html(desc),
                "stepSummary": summary,
                "goLabel": go,
                "steps": steps,
                "colab": colab_m.group(1) if colab_m else None,
            })
        phases.append(phase)
    toc = []
    toc_html = inner(html, r'<ul class="toc">(.*?)</ul>')
    for href, label, ol in re.findall(r'<a class="ph" href="#([^"]+)">(.*?)</a>\s*<ol>(.*?)</ol>', toc_html, re.S):
        items = []
        for ihref, num, name in re.findall(r'<a href="([^"]+)"><i>(.*?)</i>(.*?)</a>', ol, re.S):
            items.append({"href": ihref, "num": textify(num), "name": textify(name)})
        toc.append({"id": href, "label": textify(label), "items": items})
    h1 = inner(html, r"<h1>(.*?)</h1>").strip()
    subtitle = inner(html, r'<p class="subtitle">(.*?)</p>').strip()
    return {
        "docTitle": title_of(html),
        "description": meta(html, "description"),
        "shareTitle": meta(html, "og:title"),
        "shareDescription": meta(html, "og:description"),
        "h1Html": h1,
        "subtitleHtml": subtitle,
        "phases": phases,
        "toc": toc,
        "css": style_of(html),
    }


def extract_glossary() -> dict:
    html = read("glossary.html")
    toc = []
    toc_html = inner(html, r'<div class="toc">(.*?)</div>')
    for href, label in re.findall(r'<a href="#([^"]+)">(.*?)</a>', toc_html, re.S):
        toc.append({"id": href, "label": textify(label)})
    body = re.search(r'<div class="toc">.*?</div>(.*)<footer>', html, re.S).group(1)
    groups = []
    for hm in re.finditer(r'<div class="sec-h">(.*?)</div>', body, re.S):
        num = inner(hm.group(1), r'<span class="sh-num">(.*?)</span>')
        title = textify(re.sub(r"<span class=\"sh-num\">.*?</span>", "", hm.group(1), flags=re.S))
        groups.append({"num": num.strip(), "title": title, "entries": [], "at": hm.end()})
    groups.append({"num": "", "title": "", "entries": [], "at": len(body)})
    entries = []
    for em in re.finditer(r'<div class="gentry" id="([^"]+)">', body):
        start = em.end()
        depth = 1
        i = start
        while i < len(body) and depth:
            if body.startswith("</div>", i):
                depth -= 1
                if depth == 0:
                    break
                i += 6
                continue
            if body.startswith("<div", i) and (i + 4 == len(body) or body[i + 4] in " \t\n>"):
                i = tag_end(body, i) + 1
                depth += 1
                continue
            i += 1
        ebody = body[start:i]
        h3 = inner(ebody, r"<h3>(.*?)</h3>").strip()
        rest = re.sub(r"\s*<h3>.*?</h3>\s*", "", ebody, count=1, flags=re.S).strip()
        entries.append((em.start(), {
            "id": em.group(1),
            "titleHtml": prepare_html(h3),
            "bodyHtml": prepare_html(rest),
        }))
    gi = 0
    for pos, entry in entries:
        while gi + 1 < len(groups) and pos >= groups[gi + 1]["at"]:
            gi += 1
        groups[gi]["entries"].append(entry)
    groups = [g for g in groups if g["entries"]]
    for g in groups:
        g.pop("at", None)
    footer = re.search(r"<footer>(.*?)</footer>", html, re.S).group(1).strip()
    header_sub = inner(html, r'<p class="subtitle">(.*?)</p>').strip()
    return {
        "docTitle": title_of(html),
        "description": meta(html, "description"),
        "shareTitle": meta(html, "og:title"),
        "shareDescription": meta(html, "og:description"),
        "eyebrow": textify(inner(html, r'<span class="eyebrow">(.*?)</span>')),
        "h1": textify(inner(html, r"<h1>(.*?)</h1>")),
        "subtitleHtml": header_sub,
        "toc": toc,
        "groups": groups,
        "footerHtml": prepare_html(footer),
        "css": style_of(html),
    }


def main() -> None:
    index = extract_index()
    glossary = extract_glossary()
    pages = {}
    for fname in SLUG:
        pages[fname] = extract_chapter_page(fname)

    # 首页步骤文案与页内 tab 不是同一句。两边都留，避免合成后有一边对不上。
    chapters = []
    by_file = {}
    for phase in index["phases"]:
        for card in phase["chapters"]:
            page = pages[card["file"]]
            if len(page["nav"]) != len(card["steps"]):
                raise SystemExit(f'{card["file"]}: index steps {len(card["steps"])} != page tabs {len(page["nav"])}')
            steps = []
            for a, nav in zip(card["steps"], page["nav"]):
                steps.append({**a, "nav": nav})
            ch = {
                "num": card["cardId"].split("-")[1],
                "slug": SLUG[card["file"]],
                "file": card["file"],
                "cardId": card["cardId"],
                "cardTitle": card["cardTitle"],
                "cardDescHtml": card["cardDescHtml"],
                "stepSummary": card["stepSummary"],
                "goLabel": card["goLabel"],
                "colab": page["colab"] or card["colab"],
                "source": page["source"],
                "codeLinks": page["codeLinks"],
                "docTitle": page["docTitle"],
                "shareTitle": page["shareTitle"],
                "description": page["description"],
                "h1Html": page["h1Html"],
                "subtitleHtml": page["subtitleHtml"],
                "steps": steps,
                "hashKind": "part" if steps and steps[0]["anchor"].startswith("part-") else "step",
                "stepsClass": page["stepsClass"],
                "prevClass": page["prevClass"],
                "confetti": page["confetti"],
                "ready": card["file"] in READY,
            }
            # sidebar num is the reading order and can disagree with CHAPTER nn on the card.
            chapters.append(ch)
            by_file[card["file"]] = ch

    for phase in index["toc"]:
        for item in phase["items"]:
            file = item["href"].split("#", 1)[0]
            by_file[file]["sidebar"] = item["name"]
            by_file[file]["num"] = item["num"]

    for phase in index["phases"]:
        for card in phase["chapters"]:
            card_ch = by_file[card["file"]]
            card.clear()
            card.update({"slug": card_ch["slug"]})

    # phases keep only slug lists; full chapter objects live once.
    phase_out = []
    for phase, toc in zip(index["phases"], index["toc"]):
        phase_out.append({
            "id": phase["id"],
            "kicker": phase["kicker"],
            "title": phase["title"],
            "count": phase["count"],
            "tocLabel": toc["label"],
            "slugs": [c["slug"] for c in phase["chapters"]],
        })

    catalog = {
        "site": {
            "name": "从零手写大语言模型",
            "url": "https://learn-llm.fim.ai",
        },
        "home": {
            "docTitle": index["docTitle"],
            "description": index["description"],
            "shareTitle": index["shareTitle"],
            "shareDescription": index["shareDescription"],
            "h1Html": index["h1Html"],
            "subtitleHtml": index["subtitleHtml"],
        },
        "phases": phase_out,
        "chapters": [by_file[p["file"]] for phase in extract_index()["phases"] for p in []],
    }
    # rebuild chapter list in reading order from toc
    ordered = []
    for toc in index["toc"]:
        for item in toc["items"]:
            file = item["href"].split("#", 1)[0]
            ordered.append(by_file[file])
    catalog["chapters"] = ordered

    content = OUT / "src" / "content"
    content.mkdir(parents=True, exist_ok=True)
    (OUT / "src" / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    gcopy = {k: v for k, v in glossary.items() if k != "css"}
    (OUT / "src" / "glossary.json").write_text(json.dumps(gcopy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (content / "home.css").write_text(index["css"], encoding="utf-8")
    (content / "glossary.css").write_text(glossary["css"], encoding="utf-8")

    ids = [e["id"] for g in glossary["groups"] for e in g["entries"]]
    toc_ids = [t["id"] for t in glossary["toc"]]
    if ids != toc_ids and set(ids) != set(toc_ids):
        print("WARN toc/entry mismatch", set(toc_ids) - set(ids), set(ids) - set(toc_ids))
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate glossary ids")

    for fname in READY:
        slug = SLUG[fname]
        page = pages[fname]
        (content / f"{slug}.css").write_text(page["css"], encoding="utf-8")
        (content / f"{slug}.json").write_text(
            json.dumps({"hpHtml": page["hpHtml"], "panelsHtml": page["panelsHtml"]}, ensure_ascii=False),
            encoding="utf-8",
        )
        script = page["script"].replace("glossary.html#", "/glossary#")
        script = strip_term_iife(script)
        script = rewrite_hash_listeners(script)
        if "termTip" in script:
            raise SystemExit(f"{fname}: term tip still in script")
        boot = BOOT_HEAD + "\n" + script.strip() + "\n" + BOOT_TAIL
        (content / f"{slug}.boot.js").write_text(boot, encoding="utf-8")
        print(f"boot {slug} {len(boot)} bytes, terms {boot.count('<Term')} in json {page['panelsHtml'].count('<Term')}")

    # url map + nginx
    lines = [
        "# 旧地址 → 新路由",
        "",
        "浏览器跳 301 时会自己保留 `#step-N` / `#part-N`（hash 不发给服务器）。新路由同样认这个 hash。",
        "",
        "| 旧路径 | 新路由 | 本批 |",
        "| --- | --- | --- |",
        "| `/` 与 `/index.html` | `/` | 已迁 |",
        "| `/glossary.html` | `/glossary` | 已迁 |",
        "| `/notes.html` | `/notes` | 未迁，路由先占位 |",
        "| `/about.html` | `/about` | 未迁，路由先占位 |",
    ]
    nginx = [
        "server {",
        "    listen 80;",
        "    server_name _;",
        "    root /usr/share/nginx/html;",
        "    index index.html;",
        "",
        "    location ~* \\.(js|css|svg|png|jpg|jpeg|gif|webp|woff2?)$ {",
        "        expires 7d;",
        '        add_header Cache-Control "public, immutable";',
        "    }",
        "",
        "    # 旧的单文件地址。301 不带 hash，浏览器会把原来的 #step-N 接到新地址上。",
        "    location = /index.html { return 301 /; }",
        "    location = /glossary.html { return 301 /glossary; }",
        "    location = /notes.html { return 301 /notes; }",
        "    location = /about.html { return 301 /about; }",
    ]
    for ch in ordered:
        mark = "已迁" if ch["ready"] else "未迁，路由先占位"
        lines.append(f"| `/{ch['file']}` | `/ch/{ch['slug']}` | {mark} |")
        nginx.append(f"    location = /{ch['file']} {{ return 301 /ch/{ch['slug']}; }}")
    nginx += [
        "",
        "    location / {",
        "        try_files $uri $uri/index.html /index.html;",
        '        add_header Cache-Control "no-cache";',
        "    }",
        "}",
        "",
    ]
    (OUT / "docs").mkdir(exist_ok=True)
    (OUT / "docs" / "url-map.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (OUT / "nginx.conf").write_text("\n".join(nginx) + "\n", encoding="utf-8")
    print(f"chapters {len(ordered)} glossary {len(ids)} toc {len(toc_ids)}")


if __name__ == "__main__":
    main()
