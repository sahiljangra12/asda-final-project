"""Run the whole project end to end: both analyses, the interactive page, the tests."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
steps = [
    [sys.executable, "src/hillstrom_analysis.py"],
    [sys.executable, "src/concrete_analysis.py"],
    [sys.executable, "src/build_interactive.py"],
    [sys.executable, "-m", "pytest", "-q"],
]
for cmd in steps:
    print(">>", " ".join(cmd[1:]), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True, stdout=subprocess.DEVNULL if "analysis" in cmd[-1] else None)
print("Done. Rebuild the report with:  cd report && latexmk -pdf report.tex")
