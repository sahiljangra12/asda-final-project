"""Capture each email-page screen's chart as a PNG for the PowerPoint (slides/screens/).
Serve the repo first:  python -m http.server 8765   then:  python slides/capture_screens.py"""
from playwright.async_api import async_playwright
import pathlib
OUT=str(pathlib.Path(__file__).parent / "screens")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=2)
        await pg.goto("http://localhost:8765/email.html", wait_until="load"); await pg.wait_for_timeout(2500)
        async def el(sel, name, pre=None, wait=600):
            loc=pg.locator(sel).first; await loc.scroll_into_view_if_needed(); await pg.wait_for_timeout(wait)
            if pre: await pre()
            await loc.screenshot(path=f"{OUT}/{name}.png")
        # s1 hero dots: clip right part
        await pg.evaluate("scrollTo(0,0)"); await pg.wait_for_timeout(800)
        await pg.screenshot(path=f"{OUT}/s1.png", clip={"x":800,"y":90,"width":620,"height":780})
        await el("#s2 .split > div:nth-child(2)", "s2")
        await el("#s3 .split > div:nth-child(2)", "s3")
        async def aa():
            await pg.click("#aaRun"); await pg.wait_for_timeout(1200)
        await el("#s4 .split > div:nth-child(2)", "s4", aa)
        await el("#s5 .split > div:nth-child(2)", "s5", None, 6000)
        await el("#s5 .eq", "s5_tiles")
        await el("#s6 .split > div:nth-child(2)", "s6")
        await el("#verdicts", "s7")
        await el("#s8 .trust", "s8")
        await b.close()
asyncio.run(main())
