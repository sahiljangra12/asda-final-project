"""Build the self-contained interactive explorer for the presentation.

Inserts interactive/hillstrom_data.json (written by hillstrom_analysis.py)
into interactive/explorer_template.html and writes
interactive/hillstrom_explorer.html, a single file that opens in any browser
with no server.

Run from the project root:   python src/build_interactive.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    data = json.loads((ROOT / "interactive" / "hillstrom_data.json").read_text())
    tpl = (ROOT / "interactive" / "explorer_template.html").read_text()
    assert tpl.count("/*DATA*/null") == 1
    # '</' is escaped so the JSON can never close the <script> tag early
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    out = tpl.replace("/*DATA*/null", payload)
    (ROOT / "interactive" / "hillstrom_explorer.html").write_text(out)
    print(f"wrote interactive/hillstrom_explorer.html ({len(out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
