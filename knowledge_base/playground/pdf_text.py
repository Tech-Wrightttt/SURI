"""
Extract and cache text from the source PDFs for generation grounding.

Run with the system Python (it has pypdf):  C:\\Python314\\python.exe
Cached at work/pdf_cache/<pdf>.txt.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.abspath(os.path.join(HERE, "..", "slm_pdfs"))
CACHE_DIR = os.path.join(HERE, "work", "pdf_cache")

MAX_CHARS = 12000


def pdf_text(name: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache = os.path.join(CACHE_DIR, name + ".txt")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return f.read()
    from pypdf import PdfReader  # imported lazily so cached runs need no pypdf

    reader = PdfReader(os.path.join(PDF_DIR, name))
    pages = [(p.extract_text() or "") for p in reader.pages]
    text = "\n\n".join(pages)
    with open(cache, "w", encoding="utf-8") as f:
        f.write(text)
    return text


def _example_score(page: str) -> int:
    return len(re.findall(r"(?i)\bexample\b|\bsolution\b|\bsolve\b|\bsimplify\b", page))


def grounding_text(names, cap: int = MAX_CHARS) -> str:
    """Concatenate excerpts from the named PDFs, pages with examples first, capped at ~cap chars."""
    per_doc = max(cap // max(len(names), 1), 1500)
    chunks = []
    for name in names:
        try:
            text = pdf_text(name)
        except Exception as exc:  # missing or unreadable pdf: skip, generation still has the lesson text
            chunks.append(f"[{name}: unavailable ({exc.__class__.__name__})]")
            continue
        pages = [p for p in re.split(r"\n{2,}", text) if p.strip()]
        pages.sort(key=_example_score, reverse=True)
        out, used = [], 0
        for p in pages:
            if used + len(p) > per_doc:
                continue
            out.append(p.strip())
            used += len(p)
        chunks.append(f"### {name}\n" + "\n".join(out))
    return "\n\n".join(chunks)[:cap]
