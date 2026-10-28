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

MEDIUM = {
    "QE": {
        "kinds": ["non-monic factorable ax^2+bx+c, integer or simple fraction roots", "equation needing rearrangement to standard form first",
                  "quadratic formula with integer roots", "x^2 = c with c not a perfect square (simplest radical roots)",
                  "area/consecutive-integer word problem leading to a quadratic"],
        "answer_types": {"solution_set": ["none"]},
        "word": "rectangle dimensions from area, consecutive integers with a given product, projectile-free number puzzles",
        "notes": "Ask for ALL solutions. Roots may be integers, simple fractions, or +/- a simplest radical. For word problems ask for the solutions of the equation (not a single filtered root) unless the story rules one out clearly.",
    },
    "FP": {
        "kinds": ["non-monic trinomial ax^2+bx+c", "common factor then trinomial", "difference of squares with coefficients",
                  "perfect square trinomial", "factor by grouping (four terms)"],
        "answer_types": {"expression": ["factored"]},
        "word": "rectangle area written as a polynomial; ask for the product of the two side lengths",
        "notes": "The answer is the fully factored form. Every factor must be primitive and irreducible over the integers.",
    },
    "SP": {
        "kinds": ["square of a binomial with coefficients", "sum and difference with coefficients",
                  "product of binomials with two variables", "cube of a binomial", "trinomial times binomial"],
        "answer_types": {"expression": ["expanded"]},
        "word": "area of a square or volume of a cube with binomial side lengths",
        "notes": "The answer is the fully expanded polynomial with like terms combined.",
    },
    "LE": {
        "kinds": ["negative exponents", "mixed rules with two variables", "power of a quotient", "scientific-style numeric powers",
                  "simplify a fraction of powers"],
        "answer_types": {"expression": ["positive_exponents"], "number": ["none"]},
        "word": "bacteria doubling, areas and volumes with variable edges, powers of 10",
        "notes": "Final answers must use positive exponents only. Use number for numeric prompts, expression otherwise.",
    },
    "OI": {
        "kinds": ["order of operations with parentheses and several operations", "integers with exponents",
                  "absolute values in an expression", "multi-step signed arithmetic"],
        "answer_types": {"number": ["none"]},
        "word": "multi-step bank balance, temperature drops over several hours, elevation changes, game scoring",
        "notes": "Answers are integers. Each prompt needs at least three operations.",
    },
    "FD": {
        "kinds": ["mixed numbers add/subtract", "mixed numbers multiply/divide", "complex fraction",
                  "decimals and fractions combined", "operations with three fractions"],
        "answer_types": {"number": ["lowest_terms", "none"]},
        "word": "multi-step recipes, lengths of rope cut in pieces, money split in fractions",
        "notes": "Use required_form lowest_terms whenever the answer is a fraction (write improper fractions, not mixed numbers); use none for decimals/integers.",
    },
    "SLE": {
        "kinds": ["elimination requiring multiplying both equations", "substitution with a fractional coefficient",
                  "system needing rearrangement first", "word problem with two unknowns (ticket/coin/mixture)"],
        "answer_types": {"ordered_pair": ["none"]},
        "word": "ticket sales, coins, mixtures, ages, rates",
        "notes": "Integer solutions. Answer format is (x, y); the prompt must say which value is x and which is y.",
    },
    "L2V": {
        "kinds": ["slope from two points", "equation of a line from two points", "equation from slope and a point",
                  "convert standard form to slope-intercept", "x- or y-intercept of a line"],
        "answer_types": {"equation": ["slope_intercept"], "ordered_pair": ["none"], "number": ["none"]},
        "word": "taxi fare, phone plans, water level rising at a constant rate, savings over weeks",
        "notes": "Equation answers use y = mx + b exactly. Slopes may be fractions. For ordered_pair ask for an intercept point.",
    },
    "L1V": {
        "kinds": ["variables on both sides with parentheses", "fractional coefficients", "decimal coefficients",
                  "consecutive integers word problem", "age or cost word problem with two-step setup"],
        "answer_types": {"number": ["none"]},
        "word": "ages, costs, consecutive numbers, perimeter, work earnings",
        "notes": "Answer is the value of the variable as a number (an integer or a simple fraction/decimal).",
    },
    "AE": {
        "kinds": ["evaluate with negative values and exponents", "simplify by distributing and combining like terms",
                  "evaluate a formula with several variables", "translate a multi-step story to an expression and evaluate"],
        "answer_types": {"number": ["none"], "expression": ["expanded"]},
        "word": "cost formulas, perimeter/area formulas, discount rules with a variable",
        "notes": "Use number for 'evaluate' prompts and expression (expanded) for 'simplify' prompts.",
    },
    "RPP": {
        "kinds": ["percent increase then decrease", "find the original value from a percent", "proportion with algebraic setup",
                  "unit rate comparison", "simple interest", "percent change"],
        "answer_types": {"number": ["none", "lowest_terms"]},
        "word": "discounts and markups, interest on savings, speed and distance, recipes scaled up",
        "notes": "Percent answers: unit '%'. Money: unit 'pesos'. Rates need a unit. The answer is always just a number.",
    },
    "RER": {
        "kinds": ["simplify a radical with a coefficient", "add/subtract like radicals", "multiply radicals",
                  "rationalize a simple denominator", "rational exponent with a fraction base", "radical with a variable"],
        "answer_types": {"number": ["simplest_radical", "none"], "expression": ["simplest_radical"]},
        "word": "diagonal of a rectangle, distance between points, side of a square from its area",
        "notes": "Use simplest_radical when the answer contains a radical, none for whole numbers. No radicals in denominators.",
    },
    "PE": {
        "kinds": ["cubic that factors by grouping", "quartic x^4 - c x^2 = 0 form", "factored cubic with a repeated root",
                  "cubic with a rational-root candidate (integer roots)", "x^3 = c x with negative roots"],
        "answer_types": {"solution_set": ["none"]},
        "word": "number puzzles about cubes and squares, and abstract volume relations",
        "notes": "All roots are integers. Ask for ALL real solutions. Degree 3 or 4.",
    },
    "PO": {
        "kinds": ["subtract polynomials with distribution of the negative", "multiply binomial by trinomial",
                  "multiply a trinomial by a binomial with negative terms","polynomial division by a monomial",
                  "perimeter or area with polynomial sides"],
        "answer_types": {"expression": ["expanded"]},
        "word": "perimeter and area of figures with polynomial side lengths",
        "notes": "The answer is the simplified polynomial, like terms combined. Division by a monomial must divide exactly.",
    },
}

HARD = {
    "QE": {
        "kinds": ["non-monic quadratic with fractional or integer roots, rearranged first", "quadratic formula with irrational roots in simplest radical form",
                  "completing the square leading to simplest radical roots", "rational equation that reduces to a quadratic",
                  "area, consecutive-integer, or work-style word problem with a multi-step setup"],
        "answer_types": {"solution_set": ["none"]},
        "word": "rectangle with a border or path, consecutive integers, projectile-free number puzzles, dimensions from area and perimeter",
        "notes": "Ask for ALL solutions that satisfy the equation. BUILD EACH PROBLEM BACKWARD: first choose the roots (integers or simple fractions such as 3/2; at most 3 problems of the batch may have irrational roots like 1 +/- \\sqrt{5}), then multiply out to get the equation, then write the prompt. Substitute every stated root back into the equation before answering. For a word problem the prompt must state the equation or make it unambiguous, and must ask for ALL solutions of the equation (never discard a negative root yourself). Never reject a root in the prompt.",
    },
    "FP": {
        "kinds": ["non-monic trinomial with large coefficients", "common factor then difference of squares", "sum or difference of cubes",
                  "factor by grouping with six terms or two variables", "difference of fourth powers (factor completely)"],
        "answer_types": {"expression": ["factored"]},
        "word": "rectangle or box dimensions from an area/volume polynomial; ask for the product of the factors",
        "notes": "The answer is the FULLY factored form over the integers; every factor primitive and irreducible.",
    },
    "SP": {
        "kinds": ["cube of a binomial with coefficients", "(a+b+c)^2 trinomial square", "product of conjugates with two variables, repeated",
                  "binomial times a trinomial pattern (a+b)(a^2-ab+b^2)", "expand and simplify a sum or difference of products"],
        "answer_types": {"expression": ["expanded"]},
        "word": "volume of a cube or box with binomial edges, area of a square frame",
        "notes": "The answer is the fully expanded polynomial with like terms combined and terms in descending order.",
    },
    "LE": {
        "kinds": ["nested powers with negative exponents", "quotient of products with several variables", "zero and negative exponents together",
                  "rational exponents of perfect powers", "numeric expression mixing exponent rules"],
        "answer_types": {"expression": ["positive_exponents"], "number": ["none"]},
        "word": "bacterial growth with exponent arithmetic, area and volume with variable edges, powers of 10 in measurement",
        "notes": "Final answers use positive exponents only and are fully simplified (no power of a product, quotient or power left). Use number for numeric prompts, expression otherwise.",
    },
    "OI": {
        "kinds": ["long order-of-operations expression with nested parentheses", "integers with exponents and absolute values combined",
                  "expression with several negative powers/products", "multi-step signed word problem with three or more changes"],
        "answer_types": {"number": ["none"]},
        "word": "multi-day bank balance, elevation changes in a hike, scores over several rounds, temperature across the day",
        "notes": "Answers are integers. Each prompt needs at least five operations or steps.",
    },
    "FD": {
        "kinds": ["complex fraction with mixed numbers", "multi-step expression with fractions and decimals", "fractional part of a remaining part",
                  "word problem with successive fractions of a whole", "decimals with repeating-free fraction conversion"],
        "answer_types": {"number": ["lowest_terms", "none"]},
        "word": "money spent in successive fractions, recipes scaled and combined, lengths cut repeatedly",
        "notes": "Use required_form lowest_terms whenever the answer is a fraction (improper fraction, not a mixed number); none for decimals and integers.",
    },
    "SLE": {
        "kinds": ["fractional coefficients", "system needing rearrangement and distribution", "word problem: mixture or investment",
                  "word problem: motion with current or wind", "system with negative coefficients"],
        "answer_types": {"ordered_pair": ["none"]},
        "word": "mixtures, rates with and against a current, tickets, ages, two investments",
        "notes": "Integer solutions only. Answer format is (x, y); the prompt must say which value is x and which is y.",
    },
    "L2V": {
        "kinds": ["line through two points with fractional slope", "line parallel or perpendicular to a given line through a point",
                  "intercepts of a line in standard form with fractional coefficients", "equation from a word problem with two data points",
                  "point where a line has a given y-value"],
        "answer_types": {"equation": ["slope_intercept"], "ordered_pair": ["none"], "number": ["none"]},
        "word": "taxi fare from two trips, phone plan costs, a tank filling at a steady rate, savings between two dates",
        "notes": "Equation answers use y = mx + b exactly. Slopes and intercepts may be fractions. For ordered_pair ask for an intercept point.",
    },
    "L1V": {
        "kinds": ["fractions on both sides needing a common denominator", "decimals and parentheses together", "literal-free word problem needing a two-step setup",
                  "consecutive odd or even integers", "multi-step equation with fractions, parentheses, and variables on both sides"],
        "answer_types": {"number": ["none"]},
        "word": "ages now and later, coins, consecutive integers, perimeter, work earnings with a bonus",
        "notes": "The answer is the value of the variable as a number (integer, simple fraction, or decimal).",
    },
    "AE": {
        "kinds": ["evaluate with fractions and exponents", "simplify with nested parentheses and two variables", "evaluate a formula needing substitution of negatives",
                  "translate a multi-condition story to an expression and evaluate"],
        "answer_types": {"number": ["none"], "expression": ["expanded"]},
        "word": "tiered pricing formulas, perimeter and area formulas with several variables, rule-based costs",
        "notes": "Use number for 'evaluate' prompts and expression (expanded) for 'simplify' prompts.",
    },
    "RPP": {
        "kinds": ["successive percent changes", "find the original amount after a discount and tax", "mixture or concentration by proportion",
                  "work or speed with proportion over several steps", "compound-style two-step interest", "percent of a percent"],
        "answer_types": {"number": ["none", "lowest_terms"]},
        "word": "store discounts then tax, school scores, speed and distance with changes, recipes scaled up, savings with interest",
        "notes": "Percent answers: unit '%'. Money: unit 'pesos'. Rates need a unit. The answer is always just a number.",
    },
    "RER": {
        "kinds": ["simplify a sum of unlike radicals that reduce to like radicals", "multiply binomials with radicals", "rationalize a denominator with a radical",
                  "rational exponents with fraction bases and negative exponents", "radical expression with variables"],
        "answer_types": {"number": ["simplest_radical", "none"], "expression": ["simplest_radical"]},
        "word": "diagonals and distances requiring radical simplification, area of a square or circle-free figure from a radical side",
        "notes": "Use simplest_radical when the answer contains a radical, none for whole numbers or fractions without radicals. No radicals in denominators.",
    },
    "PE": {
        "kinds": ["quartic that factors as a difference of squares", "cubic requiring a rational-root search with integer roots", "factor by grouping, degree 4",
                  "polynomial equation with a repeated root", "biquadratic x^4 + bx^2 + c with real integer roots"],
        "answer_types": {"solution_set": ["none"]},
        "word": "number puzzles about squares and cubes, volume relations with a missing edge",
        "notes": "All REAL roots are integers. Ask for ALL real solutions. Degree 3 or 4. List each distinct root once.",
    },
    "PO": {
        "kinds": ["multiply a binomial by a trinomial and simplify", "multiply three binomials", "subtract then multiply polynomials",
                  "divide a polynomial by a monomial or a binomial exactly", "perimeter and area with polynomial sides"],
        "answer_types": {"expression": ["expanded"]},
        "word": "area or volume of figures with polynomial dimensions, perimeter after combining sides",
        "notes": "The answer is the simplified polynomial in descending order. Every division must come out exactly with no remainder.",
    },
}

SPECS = {"easy": EASY, "medium": MEDIUM, "hard": HARD}


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
