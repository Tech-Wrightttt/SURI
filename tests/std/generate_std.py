"""
Build the SURI Software Test Document (.docx) from the latest test run.

Layout follows the CIT-U CCS "STD TEMPLATE.doc": cover page, Change History,
Table of Contents, 1 Introduction, 2 Test Plan, 3 Test Cases, Appendix (Test
Logs: A.1 Log, A.2 Test Results, A.3 Incident Report) — extended with the
EV/BVA/Decision-Table/Coverage sections required by STD_INSTRUCTIONS.md.

Inputs (all produced by the CI workflow or the local commands in
docs/GithubActionsImplementationStepByStep.md):
    reports/backend-junit.xml    pytest --junitxml
    reports/frontend-junit.xml   node --test --test-reporter=junit
    reports/coverage.xml         pytest-cov (Cobertura) for backend/
    reports/frontend-lcov.info   node --experimental-test-coverage for frontend/

Usage:
    python tests/std/generate_std.py [--reports reports] [--out docs/std/SURI_STD.docx]
"""

import argparse
import ast
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

sys.path.insert(0, str(Path(__file__).parent))
from catalog import INCIDENTS, MODULES, TEST_CASES  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TC_RE = re.compile(r"TC-?(\d+[a-z]?)", re.IGNORECASE)
HEADER_FILL = "D9E2F3"


# ─── Result collection ──────────────────────────────────────────────────────

def norm_id(raw: str) -> str:
    m = TC_RE.search(raw)
    if not m:
        return ""
    num = m.group(1)
    digits = re.match(r"\d+", num).group(0)
    return f"TC-{int(digits):02d}{num[len(digits):].lower()}"


def read_junit(path: Path, suite_label: str) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for case in ET.parse(path).getroot().iter("testcase"):
        name = case.get("name", "")
        tc_id = norm_id(name)
        if not tc_id:
            continue
        outcome, message = "passed", ""
        for child in case:
            tag = child.tag
            if tag == "skipped":
                msg = child.get("message", "")
                if child.get("type") == "pytest.xfail" or "xfail" in msg.lower() or "IR-" in msg:
                    outcome, message = "xfailed", msg
                else:
                    outcome, message = "skipped", msg
            elif tag in ("failure", "error"):
                outcome = "failed"
                message = (child.get("message") or child.text or "").strip().splitlines()[0][:300] \
                    if (child.get("message") or child.text) else tag
        rows.append({
            "tc": tc_id, "name": name, "suite": suite_label,
            "classname": case.get("classname", ""),
            "time": float(case.get("time") or 0), "outcome": outcome, "message": message,
        })
    return rows


def verdict(runs: list[dict]) -> tuple[str, str]:
    """(status, actual-result sentence) for one test case."""
    if not runs:
        return "Not executed", "No automated result was found in this run."
    outcomes = {r["outcome"] for r in runs}
    n = len(runs)
    if "failed" in outcomes:
        msg = next(r["message"] for r in runs if r["outcome"] == "failed")
        return "Fail", f"Assertion failed: {msg}"
    if "xfailed" in outcomes:
        msg = next(r["message"] for r in runs if r["outcome"] == "xfailed")
        ir = re.search(r"IR-\d+", msg)
        return "Fail", (f"Actual behaviour differs from the expected output — defect "
                        f"{ir.group(0) if ir else ''} (see A.3). {msg.split(':', 1)[-1].strip()}")
    if outcomes == {"skipped"}:
        return "Not executed", "Skipped in this run."
    return "Pass", (f"Observed output matched every expected assertion "
                    f"({n} automated check{'s' if n > 1 else ''}).")


# ─── Coverage collection ────────────────────────────────────────────────────

def read_cobertura(path: Path) -> dict:
    """{relpath: {"lines": {n: hits}, "branches": {n: (covered, total)}}}"""
    files = {}
    if not path.exists():
        return files
    root = ET.parse(path).getroot()
    sources = [s.text for s in root.iter("source")]
    for cls in root.iter("class"):
        filename = cls.get("filename").replace("\\", "/")
        rel = filename
        for src in sources:
            cand = Path(src) / filename
            if cand.exists():
                rel = cand.resolve().relative_to(ROOT).as_posix()
                break
        else:
            rel = ("backend/" + filename) if not filename.startswith("backend/") else filename
        entry = files.setdefault(rel, {"lines": {}, "branches": {}})
        for line in cls.iter("line"):
            n = int(line.get("number"))
            entry["lines"][n] = int(line.get("hits"))
            if line.get("branch") == "true":
                m = re.search(r"\((\d+)/(\d+)\)", line.get("condition-coverage", ""))
                if m:
                    entry["branches"][n] = (int(m.group(1)), int(m.group(2)))
    return files


def read_lcov(path: Path) -> dict:
    files = {}
    if not path.exists():
        return files
    current = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        if raw.startswith("SF:"):
            p = Path(raw[3:].strip())
            try:
                rel = p.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                rel = p.as_posix()
            current = files.setdefault(rel, {"LF": 0, "LH": 0, "BRF": 0, "BRH": 0})
        elif current is not None and ":" in raw:
            key, _, val = raw.partition(":")
            if key in current:
                current[key] = int(val)
    return files


def cov_totals(entry: dict, lo: int = 0, hi: int = 10**9) -> tuple[int, int, int, int]:
    lines = {n: h for n, h in entry["lines"].items() if lo <= n <= hi}
    br = [v for n, v in entry["branches"].items() if lo <= n <= hi]
    return (sum(1 for h in lines.values() if h), len(lines),
            sum(c for c, _ in br), sum(t for _, t in br))


def pct(a: int, b: int) -> str:
    return f"{(a / b * 100):.1f}%" if b else "N/A"


# ─── docx helpers ───────────────────────────────────────────────────────────

def shade(cell, fill=HEADER_FILL):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def table(doc, header, rows, widths=None, font_size=9):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(header):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(str(h))
        run.bold = True
        run.font.size = Pt(font_size)
        shade(cell)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            para = cells[i].paragraphs[0]
            text = str(val)
            bold = text.startswith("**") and text.endswith("**")
            run = para.add_run(text.strip("*") if bold else text)
            run.bold = bold
            run.font.size = Pt(font_size)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Pt(w)
    doc.add_paragraph()
    return t


def para(doc, text, bold=False, italic=False, size=None, align=None, style=None):
    p = doc.add_paragraph(style=style)
    run = p.add_run(text)
    run.bold, run.italic = bold, italic
    if size:
        run.font.size = Pt(size)
    if align is not None:
        p.alignment = align
    return p


def labeled(doc, label, text, style=None):
    p = doc.add_paragraph(style=style)
    p.add_run(f"{label}: ").bold = True
    p.add_run(text)
    return p


def bullets(doc, items):
    for item in items:
        doc.add_paragraph(item, style="List Bullet")


def code_block(doc, lines):
    for text in lines:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.space_before = Pt(0)
        run = p.add_run(text)
        run.font.name = "Consolas"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Consolas")
        run.font.size = Pt(7.5)
    doc.add_paragraph()


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def add_toc(doc):
    p = doc.add_paragraph()
    run = p.add_run()
    for kind, text in (("begin", None), (None, 'TOC \\o "1-3" \\h \\z \\u'), ("separate", None),
                       (None, None), ("end", None)):
        if kind:
            fld = OxmlElement("w:fldChar")
            fld.set(qn("w:fldCharType"), kind)
            run._r.append(fld)
        elif text:
            instr = OxmlElement("w:instrText")
            instr.set(qn("xml:space"), "preserve")
            instr.text = text
            run._r.append(instr)
        else:
            t = OxmlElement("w:t")
            t.text = "Right-click and choose “Update Field” to refresh the table of contents."
            run._r.append(t)
    # Ask Word to refresh fields (TOC page numbers) when the file is opened.
    settings = doc.settings.element
    upd = OxmlElement("w:updateFields")
    upd.set(qn("w:val"), "true")
    settings.append(upd)


def function_source(rel_path: str, func_name: str) -> tuple[int, list[str]]:
    src = (ROOT / rel_path).read_text(encoding="utf-8")
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            start = node.decorator_list[0].lineno if node.decorator_list else node.lineno
            lines = src.splitlines()[start - 1:node.end_lineno]
            return start, lines
    raise LookupError(f"{func_name} not found in {rel_path}")


# ─── Static design content (Section 2.4) ────────────────────────────────────

EV_ROWS = [
    ("Auth: email", "V1: well-formed email not yet registered", "I1: email already registered; I2: unknown email at login"),
    ("Auth: password", "V2: password matching the stored bcrypt hash", "I3: wrong password; I4: empty string"),
    ("Auth: grade_level", "V3: integer 7–10", "I5: integer < 7 or > 10 (HTTP 422)"),
    ("Auth: token", "V4: valid JWT in cookie or Bearer header", "I6: missing token; malformed / expired JWT"),
    ("Session: topic_entry_node", "V5: node in GRAPH (QE, SLE, RER, PE …)", "I7: node not in GRAPH"),
    ("Session: session_id", "V6: existing session owned by the student", "I9: unknown id; I10: another student's session"),
    ("Session: lifecycle", "V7: completed = 0", "I11: completed = 1"),
    ("Diagnostic: current_probe_index", "V8: integer index of a fetched probe", "I12: NULL (no probe fetched)"),
    ("Diagnostic: body.node_id", "V9: equals session current_node", "I13: different node"),
    ("Diagnostic: selected_option_index", "V10: 0, 1, 2, 3", "I15: < 0; I16: > 3 (graded incorrect, not rejected)"),
    ("Content: node_id", "V11: node in GRAPH with a content row", "I18: node not in GRAPH; I19: no content row"),
    ("Content: competency status", "V12: mastered/diagnostic; V13: other or none", "—"),
    ("Practice: problem pool", "V14: ≥ 10 problems for the node", "I20: < 10 problems"),
    ("Practice: submitted_value", "V15: equal after normalization; V16: numeric within ±0.01", "I21: wrong value; I22: numeric beyond ±0.01"),
    ("Progression: node_id", "V17: node in GRAPH", "I24: node not in GRAPH"),
    ("Quiz: submitted_value", "V18: string answer", "I25: null (timeout)"),
    ("Quiz: balance for save_streak / hint", "V19: ≥ 1000 / ≥ 750 points", "I28: below cost"),
    ("Solver: expression", "V20: non-empty, parseable string", "I29: empty / blank / non-string; I30: unmatched parentheses"),
]

BVA_ROWS = [
    ("Auth: grade_level", "6 / 7 / 10 / 11", "6 and 11 rejected with HTTP 422; 7 and 10 accepted", "TC-51, TC-52"),
    ("Diagnostic: option index", "−1 / 0 / 3", "−1 graded incorrect; 0 and 3 evaluated normally", "TC-19, TC-20, TC-21"),
    ("Diagnostic: answered probes", "1 / 4", "1 → next_probe on same node; 4 → node complete", "TC-20, TC-22"),
    ("Diagnostic: correct of 4", "2 / 3 / 4", "2 → node_passed false; 3 and 4 → true", "TC-23, TC-22, TC-24"),
    ("Practice: numeric tolerance", "−0.01 / +0.01 / +0.011", "−0.01 and +0.01 correct; +0.011 incorrect", "TC-63, TC-32, TC-33"),
    ("Practice: problem pool size", "9 / 10+", "9 → HTTP 400; ≥ 10 → 5 sampled", "TC-30, TC-31"),
    ("Progression: passed of 5", "3 / 4 / 5", "3 → remediate; 4 → advance; 5 → advance and complete at entry", "TC-38, TC-37, TC-39"),
    ("Quiz: streak", "1 / 5", "multiplier 1.0 / 1.4", "TC-42, TC-43"),
    ("Quiz: time remaining ratio", "−, 0, 0.5, 1.0, total = 0", "100, 100, 250, 500, 100 points", "TC-72, TC-42"),
    ("Quiz: save-streak balance", "999 / 1000", "999 → HTTP 400; 1000 → accepted, balance 0", "TC-45, TC-66"),
    ("Quiz: hint balance", "800 then 50", "first hint accepted (−750); second rejected", "TC-70"),
    ("Solver: expression", "N/A", "Non-numeric input — BVA does not apply; EV and Decision Table G cover it", "—"),
]

DECISION_TABLES = [
    ("Decision Table A — Diagnostic answer (submit_diagnostic_answer)",
     ["Condition / Action", "R1", "R2", "R3", "R4"],
     [["C1: batch complete (answered = 4)?", "N", "Y", "Y", "Y"],
      ["C2: correct ≥ 3?", "–", "Y", "Y", "N"],
      ["C3: next node exists?", "–", "Y", "N", "Y"],
      ["A1: next_action", "next_probe", "next_probe", "complete", "next_probe"],
      ["A2: node_passed", "–", "true", "true", "false"],
      ["A3: session update", "probe idx NULL", "current_node = next", "probe idx NULL", "current_node = next"],
      ["Test case", "TC-20", "TC-22", "TC-24", "TC-23"]]),
    ("Decision Table B — Content delivery (get_content)",
     ["Condition / Action", "R1", "R2", "R3", "R4"],
     [["C1: node in GRAPH?", "N", "Y", "Y", "Y"],
      ["C2: content row exists?", "–", "N", "Y", "Y"],
      ["C3: status mastered + diagnostic?", "–", "–", "N", "Y"],
      ["A1: HTTP status", "400", "400 no_content", "200", "200"],
      ["A2: status change", "none", "none", "none", "none (mastered is kept)"],
      ["Test case", "TC-25", "TC-26", "TC-27, TC-27b", "TC-28"]]),
    ("Decision Table C — Login",
     ["Condition / Action", "R1", "R2", "R3"],
     [["C1: email registered?", "N", "Y", "Y"],
      ["C2: password matches hash?", "–", "N", "Y"],
      ["A1: HTTP status", "401", "401", "200"],
      ["A2: access_token cookie", "no", "no", "yes (7 days)"],
      ["Test case", "TC-03", "TC-04", "TC-02"]]),
    ("Decision Table D — Practice step evaluation (submit-step)",
     ["Condition / Action", "R1", "R2", "R3"],
     [["C1: problem exists?", "N", "Y", "Y"],
      ["C2: every step correct?", "–", "Y", "N"],
      ["A1: HTTP status", "404", "200", "200"],
      ["A2: misconception_found", "–", "false", "true (first wrong step)"],
      ["A3: misconception_logs row + feedback", "no", "no", "yes"],
      ["Test case", "TC-34", "TC-32", "TC-33, TC-35"]]),
    ("Decision Table E — Progression (decide_progression)",
     ["Condition / Action", "R1", "R2", "R3", "R4", "R5"],
     [["C1: node in GRAPH?", "N", "Y", "Y", "Y", "Y"],
      ["C2: passed ≥ 4 of 5?", "–", "Y", "Y", "Y", "N"],
      ["C3: node is entry node?", "–", "Y", "N", "N", "–"],
      ["C4: all mastered / no next node?", "–", "–", "N", "Y", "–"],
      ["A1: decision", "HTTP 400", "advance", "advance", "advance", "remediate"],
      ["A2: session", "–", "completed = 1", "current_node = next", "completed = 1", "unchanged"],
      ["A3: Go Deeper", "–", "no", "no", "no", "yes if prerequisite exists"],
      ["Test case", "TC-36", "TC-39", "TC-37", "TC-65", "TC-38, TC-40"]]),
    ("Decision Table F — Quiz step scoring (quiz/submit-step)",
     ["Condition / Action", "R1", "R2", "R3", "R4"],
     [["C1: submitted_value is null (timeout)?", "Y", "N", "N", "N"],
      ["C2: answer correct?", "–", "Y", "N", "N"],
      ["C3: save_streak and points ≥ 1000?", "–", "–", "Y", "N"],
      ["A1: points", "0", "timer × multiplier", "−1000", "0"],
      ["A2: streak", "0", "+1", "kept", "0"],
      ["A3: error logged", "no", "no", "yes", "yes"],
      ["Test case", "TC-44", "TC-42, TC-43", "TC-46", "TC-43b"]]),
    ("Decision Table G — Solver (frontend /api/solve)",
     ["Condition / Action", "R1", "R2", "R3"],
     [["C1: non-empty string?", "N", "Y", "Y"],
      ["C2: mathjs.parse succeeds?", "–", "N", "Y"],
      ["A1: HTTP status", "400", "422", "200"],
      ["A2: payload", "error: enter expression", "error: check parentheses", "serialized steps"],
      ["Test case", "TC-47", "TC-48", "TC-49"]]),
]

# White-box listings: (file, function, [(anchor text, description, TCs)]).
LISTINGS = [
    ("backend/routes/diagnostic_routes.py", "submit_diagnostic_answer", [
        ("if not session_row:", "Session exists?", "True: TC-15 · False: TC-16–TC-24"),
        ('if session_row["completed"]:', "Session already completed?", "True: TC-16 · False: TC-17–TC-24"),
        ("if probe_idx is None:", "Active probe fetched?", "True: TC-17 · False: TC-18–TC-24"),
        ("if body.node_id != current_node:", "Node alignment", "True: TC-18 · False: TC-19–TC-24"),
        ("is_correct = body.selected_option_index", "Answer graded", "Correct: TC-20–TC-24 · Wrong: TC-19"),
        ("if answered_count < QUESTIONS_PER_NODE:", "Batch incomplete?", "True: TC-19–TC-21 · False: TC-22–TC-24"),
        ("node_passed = correct_count >= PASS_THRESHOLD", "Mastery threshold", "True: TC-22, TC-24 · False: TC-23"),
        ("if next_node:", "Next node exists?", "True: TC-22, TC-23 · False: TC-24"),
    ]),
    ("backend/routes/content_routes.py", "get_content", [
        ("if node_id not in GRAPH:", "Node registered?", "True: TC-25 · False: TC-26, TC-27, TC-27b, TC-28"),
        ("if not row:", "Content row exists?", "True: TC-26 · False: TC-27, TC-27b, TC-28"),
        ("if status_row:", "Competency record exists?", "True: TC-27, TC-28 · False: TC-27b"),
    ]),
]

CHANGE_HISTORY = [
    ("2026-09-27", "1.0", "Initial test design: EV, BVA, Decision Tables and Statement/Branch coverage for "
     "submit_diagnostic_answer and get_content.", "Ruhmer Jairus R. Espina"),
    ("2026-09-27", "1.1", "Coverage summary tables restructured to the 3-column template format.", "Zendy Mariel L. Dy"),
    ("2026-09-27", "1.2", "Headings and tables aligned with the CIT-U CCS STD Template.", "Mary Avriel Rainne M. Borromeo"),
    ("2026-09-27", "1.3", "Edge cases for get_content, refined procedures, initial traceability matrix.", "Lovely Shane P. Ong"),
    ("2026-09-27", "1.4", "Corrected test-case numbering and expected-result assertions.", "Aaron Rey A. Jacalan"),
    ("2026-10-17", "2.0", "Full-system specification covering the backend API and the frontend solver route.",
     "SURI Quality Engineering Team"),
    ("2026-10-17", "2.1", "Fixed IR-01 (streak-save deduction), IR-03 (grade 7–10 validation and register-form "
     "grade field) and IR-04 (float tolerance). IR-02 withdrawn: mastery is never revoked on revisit, so the "
     "revisit block was removed from get_content() and TC-28 now expects the status to stay mastered.",
     "SURI Quality Engineering Team"),
]


# ─── Document assembly ──────────────────────────────────────────────────────

def build(reports: Path, out: Path):
    runs = read_junit(reports / "backend-junit.xml", "pytest (backend)") + \
        read_junit(reports / "frontend-junit.xml", "node:test (frontend)")
    by_tc = defaultdict(list)
    for r in runs:
        by_tc[r["tc"]].append(r)
    backend_cov = read_cobertura(reports / "coverage.xml")
    frontend_cov = read_lcov(reports / "frontend-lcov.info")

    sha = os.getenv("GITHUB_SHA", "")[:7] or "local"
    run_url = ""
    if os.getenv("GITHUB_RUN_ID"):
        run_url = (f"{os.getenv('GITHUB_SERVER_URL', 'https://github.com')}/"
                   f"{os.getenv('GITHUB_REPOSITORY')}/actions/runs/{os.getenv('GITHUB_RUN_ID')}")
    now = datetime.now(timezone.utc)
    version = f"2.1.{os.getenv('GITHUB_RUN_NUMBER', '0')}"

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Arial"
    normal.font.size = Pt(10.5)
    for level, size in ((1, 16), (2, 13), (3, 11.5)):
        st = doc.styles[f"Heading {level}"]
        st.font.name = "Arial"
        st.font.size = Pt(size)
        st.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)

    # Cover (template page 1)
    for _ in range(4):
        doc.add_paragraph()
    para(doc, "CEBU INSTITUTE OF TECHNOLOGY", bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "UNIVERSITY", bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(3):
        doc.add_paragraph()
    para(doc, "COLLEGE OF COMPUTER STUDIES", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(4):
        doc.add_paragraph()
    para(doc, "Software Test Document", bold=True, size=22, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "for", size=14, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "SURI: Student Understanding and Remediation Intelligence", bold=True, size=18,
         align=WD_ALIGN_PARAGRAPH.CENTER)
    for _ in range(4):
        doc.add_paragraph()
    para(doc, f"Version {version} · Generated {now:%B %d, %Y} · Commit {sha}", italic=True, size=10,
         align=WD_ALIGN_PARAGRAPH.CENTER)
    page_break(doc)

    # Change History
    doc.add_heading("Change History", level=1)
    history = CHANGE_HISTORY + [(f"{now:%Y-%m-%d}", version,
                                 f"Automated execution via GitHub Actions (commit {sha}); actual results, "
                                 "test logs, coverage and incidents recorded from the run.",
                                 "GitHub Actions (SURI STD pipeline)")]
    table(doc, ["Date", "Version", "Description", "Author"], history, widths=[70, 45, 260, 110])
    page_break(doc)

    doc.add_heading("Table of Contents", level=1)
    add_toc(doc)
    page_break(doc)

    # 1 Introduction
    doc.add_heading("1. Introduction", level=1)
    doc.add_heading("1.1 System Overview", level=2)
    para(doc, "SURI (Student Understanding and Remediation Intelligence) is an adaptive web-based mathematics "
              "learning platform for Philippine Junior High School students (Grades 7–10), aligned with the DepEd "
              "Most Essential Learning Competencies for intermediate algebra. It diagnoses prerequisite gaps, "
              "delivers curriculum-grounded lessons, runs scaffolded practice with misconception detection, and "
              "regulates advancement on demonstrated mastery.")
    para(doc, "The system under test is the backend API (FastAPI, Python, PostgreSQL via asyncpg, Google Gemini "
              "for feedback/simplification) and the frontend API route of the Next.js application "
              "(/api/solve, mathjs + mathsteps). It is organised into ten modules:")
    table(doc, ["Module", "Name", "Source files"], [(m, n, f) for m, n, f in MODULES], widths=[45, 170, 270])
    para(doc, "Prerequisite graph: 15 competencies in four chains — Chain 1 QE ← FP ← SP ← LE ← OI ← FD; "
              "Chain 2 SLE ← L2V ← L1V ← AE ← RPP ← FD; Chain 3 RER ← LE ← OI ← FD; Chain 4 PE ← PO "
              "(PD also depends on PO). Diagnostics ask 4 probes per node and require 3 correct (75%); practice "
              "and quiz rounds have 5 problems and require 4 passed (80%).")

    doc.add_heading("1.2 Test Approach", level=2)
    bullets(doc, [
        "Black-box (requirements and API contract): Equivalence Partitioning, Boundary Value Analysis and "
        "Decision Table Testing (Sections 2.4.1–2.4.3).",
        "White-box (code structure): statement and branch coverage measured by coverage.py (backend) and the "
        "Node.js V8 coverage engine (frontend), plus targeted tests that close uncovered branches (Section 2.4.4).",
        "Level: API/integration tests run the real FastAPI app against a real PostgreSQL database; pure helpers "
        "(graph, normalization, point calculation) are unit tested; the Next.js route handler is imported and "
        "called directly.",
        "Execution: every test case is automated and runs on each push and pull request in GitHub Actions. Actual "
        "results, statuses, test logs, coverage and incidents in this document are filled in from that run.",
        "Defects found by the suite are filed in A.3. A known, not-yet-fixed defect may be pinned by a strict "
        "expected-failure test (pytest xfail strict=True): it is reported as Fail here and the run turns red once "
        "the defect is fixed, so its test is updated. Fixed defects stay in A.3 as Closed, and their test cases "
        "guard against regressions.",
    ])

    doc.add_heading("1.3 Definitions and Acronyms", level=2)
    table(doc, ["Term", "Definition"], [
        ("BVA", "Boundary Value Analysis — testing at, just below and just above input boundaries."),
        ("Branch coverage", "Share of decision outcomes (true/false) executed by the test suite."),
        ("Chain", "Ordered sequence of competencies from an entry topic down to its floor node."),
        ("CI", "Continuous Integration — here, GitHub Actions running the suite on every push."),
        ("Decision table", "Matrix of condition combinations (rules) and the actions each must trigger."),
        ("EV / EP", "Equivalence Partitioning — one representative value per class of equivalent inputs."),
        ("Entry node", "Target topic a student chooses (SLE, RER, QE, PE)."),
        ("JWT", "JSON Web Token used for authentication (access_token cookie or Bearer header)."),
        ("JUnit XML", "Machine-readable test result format used to fill this document."),
        ("Mastery threshold", "3 of 4 probes (diagnostic) or 4 of 5 problems (practice / quiz)."),
        ("Misconception", "First wrong scaffold step, mapped to the prerequisite node it tests."),
        ("Node", "One competency in the prerequisite graph (e.g. QE, FP, FD)."),
        ("Probe", "Multiple-choice diagnostic question for a node."),
        ("Statement coverage", "Share of executable statements run by the test suite."),
        ("TC / IR", "Test Case / Incident Report identifiers."),
        ("xfail (strict)", "Test expected to fail because of a known defect; an unexpected pass fails the run."),
    ], widths=[110, 375])
    page_break(doc)

    # 2 Test Plan
    doc.add_heading("2. Test Plan", level=1)
    doc.add_heading("2.1 Features to be Tested", level=2)
    features = {
        "M1": ["Registration, bcrypt hashing, duplicate email rejection, grade-level range",
               "Login with HTTP-only 7-day cookie, /me session validation, logout, token errors"],
        "M2": ["Topic validation, duplicate active session prevention, start at chain floor",
               "Session ownership isolation, PATCH validation, completion-percentage recomputation"],
        "M3": ["DAG integrity, chain resolution, upward traversal helpers, chain preview API"],
        "M4": ["Probe selection without repeats, answer validation (session, completion, probe, node)",
               "4-probe batches, 75% threshold, forward progression, final submit gap detection, skip"],
        "M5": ["Node and content validation, mastery kept on revisit, cached and generated AI simplification"],
        "M6": ["Problem pool ≥ 10 and 5-problem sampling, ±0.01 numeric tolerance, LaTeX normalization",
               "First-misconception logging with mapped prerequisite and tutor feedback fallback"],
        "M7": ["80% advance / remediate routing, implied prerequisite mastery, topic completion, Go Deeper, batch logging"],
        "M8": ["Quiz creation with choices and timers, timer points, streak multiplier, timeouts",
               "Streak save (1,000 pts), hints (750 pts), skip step, finish and progression"],
        "M9": ["Topic catalog/chain/intro, progress privacy (403), dashboard aggregation"],
        "M10": ["Solver input validation (400), syntax errors (422), recursive step serialization"],
    }
    for mid, name, _ in MODULES:
        p = doc.add_paragraph()
        p.add_run(f"{mid} — {name}").bold = True
        bullets(doc, features[mid])

    doc.add_heading("2.2 Features not to be Tested", level=2)
    table(doc, ["Excluded item", "Reason"], [
        ("knowledge_base/ (RAG index, content/distractor/practice generation scripts) and "
         "generate_scaffold_for_expression() in practice_routes.py", "Offline content-generation (RAG) pipeline, not "
         "part of the running system; outside the backend/frontend test scope."),
        ("mathsteps_runner/, scripts/, scratch/, db_latency_test.py, backend/reset_db.py",
         "Tooling and one-off scripts outside the backend/frontend application code."),
        ("React pages, components, 3D voxel world map, CSS", "Visual/UI behaviour; requires end-to-end browser "
         "testing, out of scope for this API-level STD."),
        ("Google Gemini availability and response quality", "External service; replaced by deterministic fakes "
         "or the documented offline fallbacks."),
        ("Supabase/PostgreSQL internals, Vercel deployment", "Third-party infrastructure; tests use a disposable "
         "PostgreSQL 16 database."),
    ], widths=[190, 295])

    doc.add_heading("2.3 Testing Tools and Environment", level=2)
    table(doc, ["Item", "Value"], [
        ("CI platform", "GitHub Actions, ubuntu-latest runner"),
        ("Backend runtime", "Python 3.12, FastAPI, asyncpg, PostgreSQL 16 service container"),
        ("Backend tools", "pytest, pytest-asyncio, httpx ASGITransport, pytest-cov (coverage.py, branch mode)"),
        ("Frontend runtime", "Node.js 22 LTS with type stripping; node:test runner; V8 coverage (lcov)"),
        ("Document generation", "python-docx (tests/std/generate_std.py) from JUnit XML, Cobertura XML and lcov"),
        ("Test data", "Seeded per test by helpers; database truncated before each test"),
        ("Run", f"Commit {sha}" + (f" · {run_url}" if run_url else " · local run")),
    ], widths=[130, 355])

    doc.add_heading("2.4 Test Design Techniques", level=2)
    doc.add_heading("2.4.1 Equivalence Partitioning (EV)", level=3)
    table(doc, ["Module & input", "Valid class(es)", "Invalid class(es)"], EV_ROWS, widths=[140, 170, 175])
    doc.add_heading("2.4.2 Boundary Value Analysis (BVA)", level=3)
    table(doc, ["Input", "Boundary values", "Expected behaviour", "Test case(s)"], BVA_ROWS,
          widths=[110, 90, 200, 85])
    doc.add_heading("2.4.3 Decision Table Testing", level=3)
    for title, header, rows in DECISION_TABLES:
        para(doc, title, bold=True)
        table(doc, header, rows, font_size=8.5)

    doc.add_heading("2.4.4 Statement / Branch Coverage Plan", level=3)
    para(doc, "The listings below are read from the current source. Line hits and branch outcomes come from "
              "this run's coverage report; the mapping column names the test cases designed to drive each "
              "decision both ways.")
    for rel, func, anchors in LISTINGS:
        start, lines = function_source(rel, func)
        end = start + len(lines) - 1
        entry = backend_cov.get(rel, {"lines": {}, "branches": {}})
        para(doc, f"Listing: {func}() — {rel} (lines {start}–{end})", bold=True)
        listing = []
        for i, text in enumerate(lines, start):
            hits = entry["lines"].get(i)
            mark = "   " if hits is None else ("✔  " if hits else "✘  ")
            listing.append(f"{mark}{i:>4}  {text}")
        code_block(doc, listing)
        rows = []
        for anchor, desc, tcs in anchors:
            needle = anchor.strip()
            line_no = next((i for i, t in enumerate(lines, start) if needle in t), None)
            br = entry["branches"].get(line_no)
            measured = f"{br[0]}/{br[1]} outcomes" if br else (
                "executed" if entry["lines"].get(line_no) else "—")
            rows.append((line_no or "?", f"{desc}: {needle}", tcs, measured))
        table(doc, ["Line", "Statement / branch", "Designed test cases", "Measured"], rows,
              widths=[35, 210, 160, 80], font_size=8.5)
        s_cov, s_tot, b_cov, b_tot = cov_totals(entry, start, end)
        table(doc, ["Metric", "Covered / Total", "Coverage %"], [
            (f"Statement coverage — {func}", f"{s_cov} / {s_tot}", pct(s_cov, s_tot)),
            (f"Branch coverage — {func}", f"{b_cov} / {b_tot}", pct(b_cov, b_tot)),
        ], widths=[250, 120, 115])
    page_break(doc)

    # 3 Test Cases
    doc.add_heading("3. Test Cases", level=1)
    para(doc, "Each case follows the template anatomy (Purpose, Inputs, Expected Outputs & Pass/Fail Criteria, "
              "Test Procedure) plus the techniques applied. Actual Result and Status are recorded from the "
              "automated run identified in Section 2.3.", italic=True)
    statuses = {}
    module_names = {m: n for m, n, _ in MODULES}
    current_module = None
    for n, case in enumerate(TEST_CASES, 1):
        if case["module"] != current_module:
            current_module = case["module"]
            para(doc, f"{current_module} — {module_names[current_module]}", bold=True, size=12)
        status, actual = verdict(by_tc.get(case["id"], []))
        statuses[case["id"]] = (status, actual)
        doc.add_heading(f"3.{n} Case-{n} ({case['id']}) — {case['title']}", level=2)
        labeled(doc, f"3.{n}.1 Purpose", case["purpose"])
        labeled(doc, f"3.{n}.2 Inputs", case["inputs"])
        p = doc.add_paragraph()
        p.add_run(f"3.{n}.3 Expected Outputs & Pass/Fail Criteria").bold = True
        bullets(doc, [
            f"Expected Result: {case['expected']}",
            "Pass/Fail Criteria: Pass if every observed value matches the expected result exactly; otherwise Fail.",
            f"Actual Result: {actual}",
            f"Status: {status}",
        ])
        p = doc.add_paragraph()
        p.add_run(f"3.{n}.4 Test Procedure").bold = True
        bullets(doc, [f"Precondition: {case['precondition']}"])
        for i, step in enumerate(case["steps"], 1):
            doc.add_paragraph(f"{i}. {step}")
        tests = sorted({r["name"] for r in by_tc.get(case["id"], [])})
        if tests:
            doc.add_paragraph(f"Automated by: {', '.join(tests)}").runs[0].italic = True
        labeled(doc, f"3.{n}.5 Technique(s) Applied", case["techniques"])
    page_break(doc)

    # Appendix (Test Logs)
    doc.add_heading("Appendix (Test Logs)", level=1)
    doc.add_heading("A.1 Log for Test n", level=2)
    para(doc, f"Run executed {now:%Y-%m-%d %H:%M UTC} on commit {sha}" + (f" ({run_url})" if run_url else "") +
         ". One row per automated test execution (parametrized tests produce several rows).")
    log_rows = [(r["tc"], r["name"], r["suite"], f"{r['time']:.3f}s",
                 {"passed": "PASSED", "failed": "FAILED", "xfailed": "XFAIL (known defect)",
                  "skipped": "SKIPPED"}[r["outcome"]])
                for r in sorted(runs, key=lambda r: (TC_ORDER.get(r["tc"], 999), r["name"]))]
    table(doc, ["TC", "Automated test", "Runner", "Duration", "Outcome"], log_rows,
          widths=[45, 250, 85, 50, 55], font_size=7.5)

    doc.add_heading("A.2 Test Results", level=2)
    counts = defaultdict(int)
    for status, _ in statuses.values():
        counts[status] += 1
    table(doc, ["Metric", "Value"], [
        ("Test cases specified", len(TEST_CASES)),
        ("Passed", counts["Pass"]),
        ("Failed (defects logged in A.3)", counts["Fail"]),
        ("Not executed", counts["Not executed"]),
        ("Automated test executions", len(runs)),
        ("Pass rate (test cases)", pct(counts["Pass"], len(TEST_CASES))),
    ], widths=[250, 235])
    per_module = []
    for mid, name, _ in MODULES:
        ids = [c["id"] for c in TEST_CASES if c["module"] == mid]
        ok = sum(1 for i in ids if statuses[i][0] == "Pass")
        per_module.append((f"{mid} {name}", len(ids), ok, len(ids) - ok))
    table(doc, ["Module", "Test cases", "Pass", "Fail / not run"], per_module, widths=[230, 85, 85, 85])

    para(doc, "Coverage summary (measured)", bold=True)
    cov_rows = []
    t_s = t_st = t_b = t_bt = 0
    for rel in sorted(backend_cov):
        s, st, b, bt = cov_totals(backend_cov[rel])
        if not st:
            continue
        t_s, t_st, t_b, t_bt = t_s + s, t_st + st, t_b + b, t_bt + bt
        cov_rows.append((rel, f"{s} / {st}", pct(s, st), f"{b} / {bt}", pct(b, bt)))
    for rel, c in sorted(frontend_cov.items()):
        t_s, t_st, t_b, t_bt = t_s + c["LH"], t_st + c["LF"], t_b + c["BRH"], t_bt + c["BRF"]
        cov_rows.append((rel, f"{c['LH']} / {c['LF']}", pct(c["LH"], c["LF"]),
                         f"{c['BRH']} / {c['BRF']}", pct(c["BRH"], c["BRF"])))
    cov_rows.append(("**Combined (backend + frontend)**", f"**{t_s} / {t_st}**", f"**{pct(t_s, t_st)}**",
                     f"**{t_b} / {t_bt}**", f"**{pct(t_b, t_bt)}**"))
    table(doc, ["Unit under test", "Statements", "Stmt %", "Branches", "Branch %"], cov_rows,
          widths=[200, 75, 55, 75, 55], font_size=8)
    para(doc, "Backend statements/branches are counted by coverage.py (branch outcomes per decision); the "
              "frontend route is measured by V8 (lines/branches). The offline RAG generator "
              "generate_scaffold_for_expression() is excluded (see 2.2).", italic=True, size=9)

    para(doc, "Traceability matrix", bold=True)
    table(doc, ["Test case", "Requirement / behaviour", "Code under test", "Status"],
          [(c["id"], c["requirement"], c["code"], statuses[c["id"]][0]) for c in TEST_CASES],
          widths=[45, 175, 210, 55], font_size=8)

    doc.add_heading("A.3 Incident Report", level=2)
    failed_unexpected = [c["id"] for c in TEST_CASES
                         if statuses[c["id"]][0] == "Fail" and not any(i["tc"] == c["id"] for i in INCIDENTS)]
    for inc in INCIDENTS:
        status = statuses.get(inc["tc"], ("Not executed", ""))[0]
        if inc.get("state") == "Closed":
            state = (f"Closed — fixed; {inc['tc']} passes in this run" if status == "Pass"
                     else f"Reopened — {inc['tc']} fails again in this run (regression)")
        else:
            state = ("Open — reproduced in this run" if status == "Fail"
                     else "Not reproduced in this run — verify the fix and close")
        para(doc, f"{inc['id']} — {inc['title']}", bold=True)
        rows = [
            ("Related test case", inc["tc"]), ("Severity", inc["severity"]), ("State", state),
            ("Location", inc["location"]), ("Expected", inc["expected"]),
            ("Actual (when found)", inc["actual"]), ("Suggested fix", inc["fix"]),
        ]
        if inc.get("resolution"):
            rows.append(("Resolution", inc["resolution"]))
        table(doc, ["Field", "Detail"], rows, widths=[110, 375])
    if failed_unexpected:
        para(doc, "Unexpected failures in this run (no incident filed yet): " + ", ".join(failed_unexpected),
             bold=True)
        for tc_id in failed_unexpected:
            labeled(doc, tc_id, statuses[tc_id][1])

    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    return counts, len(runs)


TC_ORDER = {c["id"]: i for i, c in enumerate(TEST_CASES)}


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--reports", default=str(ROOT / "reports"))
    ap.add_argument("--out", default=str(ROOT / "docs" / "std" / "SURI_Software_Test_Document.docx"))
    args = ap.parse_args()
    counts, executions = build(Path(args.reports), Path(args.out))
    print(f"STD written to {args.out}: {dict(counts)} from {executions} test executions")
    if executions == 0:
        sys.exit("No JUnit results found — run the test suites first.")


if __name__ == "__main__":
    main()
