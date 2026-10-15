"""Assemble the workbook from its parts.

Writes:
  index.html                 the finished page (open it in any browser)
  build/workbook_test.html   the same page with tests/harness.js, for a headless-browser test
  build/fragment.html        the page without <!doctype>/<head>/<body>, for hosts that add their own

Then runs structural checks: every tag closed, no duplicate ids, every #anchor has a target.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
PARTS = ["head.html", "body_top.html", "s1.html", "s2.html", "s3.html", "tools.html", "hw.html", "mt1.html", "mt24.html", "mt23.html", "mt23s.html", "proofs.html", "end.html"]


def read(name: str, folder: Path = SRC) -> str:
    return (folder / name).read_text(encoding="utf-8")


def fragment(test_harness: bool = False) -> str:
    """Page content without a document skeleton (head.html first, then the body parts and scripts)."""
    html = "".join(read(p) for p in PARTS)
    html += "<script>\n" + read("core.js") + "\n</script>\n<script>\n" + read("ui.js") + "\n</script>\n"
    if test_harness:
        html += "<script>\n" + read("harness.js", ROOT / "tests") + "\n</script>\n"
    return html


def standalone(frag: str) -> str:
    head = read("head.html")
    assert frag.startswith(head)
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + head + "</head>\n<body>\n" + frag[len(head):] + "</body>\n</html>\n")


class Checker(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors, self.ids = [], [], {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            if a["id"] in self.ids:
                self.errors.append(f"duplicate id {a['id']!r} (line {self.getpos()[0]})")
            self.ids[a["id"]] = self.getpos()[0]
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(f"stray </{tag}> at line {self.getpos()[0]}")
            return
        open_tag, line = self.stack.pop()
        if open_tag != tag:
            self.errors.append(f"</{tag}> at line {self.getpos()[0]} closes <{open_tag}> from line {line}")


def main() -> int:
    frag = fragment()
    page = standalone(frag)
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    out = ROOT / "build"
    out.mkdir(exist_ok=True)
    (out / "fragment.html").write_text(frag, encoding="utf-8")
    (out / "workbook_test.html").write_text(standalone(fragment(test_harness=True)), encoding="utf-8")

    markup = frag.split("<script>")[0]
    checker = Checker()
    checker.feed(markup)
    errors = checker.errors + [f"unclosed <{t}> from line {l}" for t, l in checker.stack]
    missing = sorted(h for h in set(re.findall(r'href="#([^"]+)"', markup)) if h not in checker.ids)
    if missing:
        errors.append(f"anchors without targets: {missing}")
    print(f"index.html: {len(page.encode('utf-8')) / 1024:.1f} KB")
    print("problems:", markup.count('class="prob"'), "| answer boxes:", markup.count('class="check"'),
          "| true/false items:", len(re.findall(r"<li data-a=", markup)), "| multiple choice:", markup.count('class="mcq"'))
    print("structure errors:", errors or "none")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
