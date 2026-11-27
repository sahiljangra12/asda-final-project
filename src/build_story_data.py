"""Small summary numbers for the story pages of the website (assets/data/*_story.json).

Run from the project root:   python src/build_story_data.py
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
import hillstrom_analysis as ha  # noqa: E402
from asda import stats_tools as st  # noqa: E402


def main():
    h = ha.load()
    out = {"arms": {}}
    for arm in ["No E-Mail", "Mens E-Mail", "Womens E-Mail"]:
        d = h[h.segment == arm]
        s = d.spend.to_numpy()
        se = s.std(ddof=1) / np.sqrt(len(s))
        out["arms"][arm] = {
            "n": len(d), "buyers": int(d.conversion.sum()),
            "revenue": float(s.mean()), "revenue_lo": float(s.mean() - 1.96 * se), "revenue_hi": float(s.mean() + 1.96 * se),
            "basket": float(d.loc[d.spend > 0, "spend"].mean()),
            # pre-email characteristics: should be the same in every arm if randomization worked
            "history": float(d.history.mean()), "recency": float(d.recency.mean()),
            "newbie": float(d.newbie.mean()), "mens": float(d.mens.mean()), "womens": float(d.womens.mean()),
        }
    (ROOT / "assets" / "data" / "hillstrom_story.json").write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
