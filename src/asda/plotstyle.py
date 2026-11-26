"""Shared matplotlib style: one look for every figure in the report and slides.

Colours follow a colour-blind-checked categorical order: arms of the
Hillstrom experiment always keep the same colour (men's = blue,
women's = orange, control = neutral grey), whatever the figure.
"""
import matplotlib as mpl
import matplotlib.pyplot as plt

BLUE, ORANGE, AQUA, VIOLET = "#257de0", "#f47230", "#00b894", "#6a4ce2"
GREY, INK, INK2, GRID = "#8c8c8c", "#191919", "#666666", "#e6e6e6"

ARM_COLORS = {"Mens E-Mail": BLUE, "Womens E-Mail": ORANGE, "No E-Mail": GREY}
ARM_LABELS = {"Mens E-Mail": "Men's email", "Womens E-Mail": "Women's email",
              "No E-Mail": "No email (control)"}
ARMS = ["No E-Mail", "Mens E-Mail", "Womens E-Mail"]


SLIDES = False      # True: larger type for projected slides (same figures, re-rendered)


def apply():
    mpl.rcParams.update({
        "figure.dpi": 110, "savefig.dpi": 200, "savefig.bbox": "tight",
        "font.family": "DejaVu Sans", "font.size": 12.5 if SLIDES else 10,
        "xtick.labelsize": 12 if SLIDES else 10, "ytick.labelsize": 12 if SLIDES else 10,
        "legend.fontsize": 11.5 if SLIDES else 9,
        "axes.edgecolor": INK2, "axes.labelcolor": INK, "axes.titlesize": 13.5 if SLIDES else 11,
        "axes.titleweight": "bold", "axes.titlelocation": "left",
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
        "axes.axisbelow": True, "xtick.color": INK2, "ytick.color": INK2,
        "legend.frameon": False, "lines.linewidth": 2.0,
    })


def save(fig, path_stem):
    """Save as both PDF (report) and PNG (slides / web)."""
    fig.savefig(f"{path_stem}.pdf")
    fig.savefig(f"{path_stem}.png")
    plt.close(fig)


def subplots(*args, figsize=(8, 3.5), slide_scale=(0.75, 0.8), **kw):
    """plt.subplots, but slide figures are drawn smaller so their type reads larger once placed."""
    if SLIDES:
        figsize = (figsize[0] * slide_scale[0], figsize[1] * slide_scale[1])
    return plt.subplots(*args, figsize=figsize, **kw)
