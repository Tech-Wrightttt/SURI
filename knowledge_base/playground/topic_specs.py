"""
Per-node generation rubric for the Playground.

Only the easy tier is specified for now (the early slice). Medium and hard are added the same way.
Each spec says which problem kinds are allowed, which answer_type / required_form the generator may
use, and what contexts word problems may draw on.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT_SEED = os.path.join(HERE, "..", "content_seed.json")

# PDFs that exist in knowledge_base/slm_pdfs but are not mapped to the node in content_seed.json.
EXTRA_PDFS = {
    "L2V": ["grade8_linear_equations_two_var.pdf"],
    "RER": ["grade9_radicals_intro.pdf", "grade9_simplifying_radicals.pdf"],
    "FP": ["grade8_factoring_trinomials.pdf"],
}

GLOBAL_RULES = """\
- Ratios are never answered as a:b. Ask for a missing term, a unit rate, or a fraction instead.
- Percent answers are plain numbers with unit "%". Rates use a unit such as "km/h" or "pesos"; the
  answer is still just the number.
- Every problem must have exactly one correct final answer a student can type.
- Write every prompt in English only (no Tagalog/Filipino words). Philippine-friendly names and contexts
  (pesos, jeepney, sari-sari store, classmates) are fine inside English sentences.
- Write money as "pesos" (e.g. "50 pesos"), not as \text{P}.
- Do not reuse the same numbers across problems in one batch.
- The prompt must NOT give away the answer or the steps.
"""

# Each easy spec: kinds (the generator tags each candidate with one), answer_types the node may use
# (first entry is the default), allowed required_form values, and word-problem contexts.
EASY = {
    "QE": {
        "kinds": ["monic factorable, integer roots", "x^2 = c perfect square", "x^2 + bx = 0",
                  "number puzzle giving a monic quadratic with integer roots"],
        "answer_types": {"solution_set": ["none"]},
        "word": "number puzzles and rectangle area where both roots are valid answers (ask for ALL numbers)",
        "notes": "Roots are integers. Always ask the student to find all solutions; the answer lists both.",
    },
    "FP": {
        "kinds": ["monic trinomial x^2+bx+c", "common monomial factor", "difference of squares",
                  "trinomial with negative terms"],
        "answer_types": {"expression": ["factored"]},
        "word": "rectangle area written as a polynomial; ask for the product of the two side lengths",
        "notes": "The answer is the fully factored form. Every factor must be primitive and irreducible.",
    },
    "SP": {
        "kinds": ["product of two binomials", "square of a binomial", "sum and difference of two terms",
                  "monomial times binomial"],
        "answer_types": {"expression": ["expanded"]},
        "word": "area of a rectangle or square with side lengths given as binomials",
        "notes": "The answer is the fully expanded polynomial with like terms combined.",
    },
    "LE": {
        "kinds": ["product rule", "quotient rule", "power rule", "zero exponent", "mixed rules, positive exponents"],
        "answer_types": {"expression": ["positive_exponents"], "number": ["none"]},
        "word": "area, volume, or powers of 2 / 10 (cells doubling, scientific-style quantities)",
        "notes": "Use positive integer exponents in the prompt. Use number for numeric prompts, expression otherwise.",
    },
    "OI": {
        "kinds": ["add integers with different signs", "subtract integers", "multiply integers",
                  "divide integers", "order of operations with integers"],
        "answer_types": {"number": ["none"]},
        "word": "temperature changes, elevation, bank balance, game points",
        "notes": "Answers are integers.",
    },
    "FD": {
        "kinds": ["add/subtract fractions with unlike denominators", "multiply fractions", "divide fractions",
                  "decimal operations", "convert fraction to decimal or simplify"],
        "answer_types": {"number": ["lowest_terms", "none"]},
        "word": "recipes, sharing food, lengths of ribbon, money",
        "notes": "Use required_form lowest_terms whenever the answer is a fraction; use none for decimals/integers.",
    },
    "SLE": {
        "kinds": ["elimination by adding", "elimination by multiplying one equation", "substitution",
                  "number puzzle"],
        "answer_types": {"ordered_pair": ["none"]},
        "word": "two numbers puzzles, ticket prices, coins",
        "notes": "Integer solutions. Answer format is (x, y); the prompt must say which value is x and which is y.",
    },
    "L2V": {
        "kinds": ["rearrange to slope-intercept form", "find y for a given x on a line",
                  "write the line from slope and intercept", "read off the slope or intercept"],
        "answer_types": {"equation": ["slope_intercept"], "ordered_pair": ["none"], "number": ["none"]},
        "word": "taxi fare, phone load, savings growing at a constant rate",
        "notes": "Equation answers use y = mx + b exactly. For ordered_pair ask for a point given one coordinate.",
    },
    "L1V": {
        "kinds": ["one-step equation", "two-step equation", "variables on both sides", "equation with parentheses"],
        "answer_types": {"number": ["none"]},
        "word": "ages, costs, consecutive numbers, perimeter",
        "notes": "Answer is the value of the variable as a number.",
    },
    "AE": {
        "kinds": ["evaluate an expression at given values", "combine like terms", "evaluate a formula",
                  "translate words to an expression and evaluate"],
        "answer_types": {"number": ["none"], "expression": ["expanded"]},
        "word": "cost formulas, perimeter/area formulas, simple rules with a variable",
        "notes": "Use number for 'evaluate' prompts and expression (expanded) for 'simplify' prompts.",
    },
    "RPP": {
        "kinds": ["percent of a number", "what percent is a of b", "unit rate", "proportion with a missing term",
                  "percent increase/decrease on a price"],
        "answer_types": {"number": ["none", "lowest_terms"]},
        "word": "discounts, scores, speed, prices per item, recipes",
        "notes": "Percent answers: unit '%'. Speeds/prices: set unit (km/h, pesos, pesos/kg). Proportions: a number.",
    },
    "RER": {
        "kinds": ["square root of a perfect square", "simplify sqrt of non-perfect square",
                  "rational exponent of a perfect power", "cube root"],
        "answer_types": {"number": ["simplest_radical", "none"], "expression": ["simplest_radical"]},
        "word": "side of a square from its area, diagonal or distance with whole-number squares",
        "notes": "Use simplest_radical when the answer contains a radical, none for whole numbers.",
    },
    "PE": {
        "kinds": ["cubic with a common factor x(x^2-c)", "factored polynomial equation, integer roots",
                  "x^3 = c x", "grouping with integer roots"],
        "answer_types": {"solution_set": ["none"]},
        "word": "number puzzles ('a number whose cube equals nine times itself') and abstract volume relations",
        "notes": "All roots are integers. Ask for ALL solutions. Degree 3 at most for easy.",
    },
    "PO": {
        "kinds": ["add polynomials", "subtract polynomials", "multiply monomial by polynomial",
                  "multiply two binomials"],
        "answer_types": {"expression": ["expanded"]},
        "word": "perimeter and area of figures with polynomial side lengths",
        "notes": "The answer is the simplified polynomial, like terms combined.",
    },
}

SPECS = {"easy": EASY}


def load_seed() -> dict:
    with open(CONTENT_SEED, encoding="utf-8") as f:
        return json.load(f)


def pdfs_for(node_id: str) -> list:
    seed = load_seed().get(node_id, {})
    names = [n.strip() for n in str(seed.get("source_doc", "")).split(",") if n.strip()]
    for extra in EXTRA_PDFS.get(node_id, []):
        if extra not in names:
            names.append(extra)
    return names


def spec_for(node_id: str, difficulty: str) -> dict:
    tier = SPECS.get(difficulty)
    if tier is None or node_id not in tier:
        raise KeyError(f"no spec for {node_id}/{difficulty} yet")
    return tier[node_id]
