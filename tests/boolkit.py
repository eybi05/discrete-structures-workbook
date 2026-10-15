"""Small Boolean-algebra toolkit used to verify study-guide answers.

Notation matches the course: juxtaposition = AND, + = OR, ' (prime) = complement.
Truth tables use the course's "special sequences": for variables v1..vn the
row order is 00..0, 00..1, ..., 11..1 (v1 is the most significant bit).
"""
from itertools import combinations, product


# ---------------------------------------------------------------- parsing
class Parser:
    def __init__(self, s):
        self.s = s.replace(" ", "").replace("′", "'").replace("’", "'")
        self.i = 0

    def peek(self):
        return self.s[self.i] if self.i < len(self.s) else None

    def eat(self, ch):
        assert self.peek() == ch, (self.s, self.i, ch)
        self.i += 1

    def parse(self):
        node = self.expr()
        assert self.i == len(self.s), ("trailing input", self.s[self.i:])
        return node

    def expr(self):
        terms = [self.term()]
        while self.peek() == "+":
            self.eat("+")
            terms.append(self.term())
        return ("or", terms) if len(terms) > 1 else terms[0]

    def term(self):
        factors = [self.factor()]
        while self.peek() is not None and (self.peek().isalnum() or self.peek() == "("):
            factors.append(self.factor())
        return ("and", factors) if len(factors) > 1 else factors[0]

    def factor(self):
        node = self.atom()
        while self.peek() == "'":
            self.eat("'")
            node = ("not", node)
        return node

    def atom(self):
        ch = self.peek()
        if ch == "(":
            self.eat("(")
            node = self.expr()
            self.eat(")")
            return node
        if ch in "01":
            self.i += 1
            return ("const", int(ch))
        assert ch is not None and ch.isalpha(), (self.s, self.i)
        self.i += 1
        return ("var", ch)


def parse(s):
    return Parser(s).parse()


def evaluate(node, env):
    kind = node[0]
    if kind == "var":
        return env[node[1]]
    if kind == "const":
        return node[1]
    if kind == "not":
        return 1 - evaluate(node[1], env)
    if kind == "and":
        return int(all(evaluate(n, env) for n in node[1]))
    if kind == "or":
        return int(any(evaluate(n, env) for n in node[1]))
    raise ValueError(kind)


def rows(variables):
    return list(product([0, 1], repeat=len(variables)))


def truth_table(expr, variables):
    node = parse(expr)
    return "".join(str(evaluate(node, dict(zip(variables, r)))) for r in rows(variables))


def minterm_indices(expr, variables):
    return [i for i, b in enumerate(truth_table(expr, variables)) if b == "1"]


def equivalent(e1, e2, variables):
    return truth_table(e1, variables) == truth_table(e2, variables)


def special_sequences(variables):
    return {v: "".join(str(r[k]) for r in rows(variables)) for k, v in enumerate(variables)}


# ---------------------------------------------------------------- products
def minterm_name(index, variables):
    bits = format(index, "0%db" % len(variables))
    return "".join(v if b == "1" else v + "'" for v, b in zip(variables, bits))


def implicant_name(pattern, variables):
    """pattern: string over {0,1,-} aligned with variables."""
    out = "".join(v if p == "1" else v + "'" for v, p in zip(variables, pattern) if p != "-")
    return out or "1"


def csop(expr, variables):
    return " + ".join(minterm_name(i, variables) for i in reversed(minterm_indices(expr, variables))) or "0"


# ---------------------------------------------------------------- Quine-McCluskey
def covers(pattern, index, n):
    bits = format(index, "0%db" % n)
    return all(p == "-" or p == b for p, b in zip(pattern, bits))


def prime_implicants(minterms, n):
    current = {format(m, "0%db" % n) for m in minterms}
    primes = set()
    while current:
        merged, used = set(), set()
        cur = sorted(current)
        for a, b in combinations(cur, 2):
            diff = [k for k in range(n) if a[k] != b[k]]
            if len(diff) == 1 and "-" not in (a[diff[0]], b[diff[0]]):
                c = a[: diff[0]] + "-" + a[diff[0] + 1 :]
                merged.add(c)
                used.update((a, b))
        primes |= current - used
        current = merged
    return sorted(primes)


def literal_count(patterns):
    return sum(sum(ch != "-" for ch in p) for p in patterns)


def minimal_sums(minterms, n):
    """All minimal SoP forms (course definition: no equivalent SoP is 'simpler').
    Returns list of tuples of patterns."""
    if not minterms:
        return [()]
    primes = prime_implicants(minterms, n)
    best = []
    for k in range(1, len(primes) + 1):
        for combo in combinations(primes, k):
            if all(any(covers(p, m, n) for p in combo) for m in minterms):
                best.append(combo)
        if best:
            break  # fewest summands found
    min_lits = min(literal_count(c) for c in best)
    return [c for c in best if literal_count(c) == min_lits]


def msop(expr, variables):
    n = len(variables)
    sums = minimal_sums(minterm_indices(expr, variables), n)
    return [" + ".join(implicant_name(p, variables) for p in s) for s in sums]


def primes_named(expr, variables):
    n = len(variables)
    return [implicant_name(p, variables) for p in prime_implicants(minterm_indices(expr, variables), n)]


# ---------------------------------------------------------------- K-map helpers (course layout)
ROWS4 = ["xy", "xy'", "x'y'", "x'y"]
COLS4 = ["zt", "zt'", "z't'", "z't"]
ROWS3 = ["x", "x'"]
COLS3 = ["yz", "yz'", "y'z'", "y'z"]


def kmap_cells_to_expr(cells):
    """cells: list of (rowlabel, collabel) -> SoP string of the checked minterms."""
    return "+".join(r + c for r, c in cells)


def draw_kmap4(expr, variables=("x", "y", "z", "t")):
    tt = truth_table(expr, list(variables))
    lines = ["      " + "  ".join(f"{c:>4}" for c in COLS4)]
    for r in ROWS4:
        row = []
        for c in COLS4:
            node = parse(r + c)
            idx = [i for i, rr in enumerate(rows(list(variables))) if evaluate(node, dict(zip(variables, rr)))][0]
            row.append("  ✓ " if tt[idx] == "1" else "  . ")
        lines.append(f"{r:>5} " + "  ".join(row))
    return "\n".join(lines)


def draw_kmap3(expr, variables=("x", "y", "z")):
    tt = truth_table(expr, list(variables))
    lines = ["     " + "  ".join(f"{c:>4}" for c in COLS3)]
    for r in ROWS3:
        row = []
        for c in COLS3:
            node = parse(r + c)
            idx = [i for i, rr in enumerate(rows(list(variables))) if evaluate(node, dict(zip(variables, rr)))][0]
            row.append("  ✓ " if tt[idx] == "1" else "  . ")
        lines.append(f"{r:>4} " + "  ".join(row))
    return "\n".join(lines)


# ---------------------------------------------------------------- gates on bit strings
def bit_and(*seqs):
    return "".join("1" if all(s[i] == "1" for s in seqs) else "0" for i in range(len(seqs[0])))


def bit_or(*seqs):
    return "".join("1" if any(s[i] == "1" for s in seqs) else "0" for i in range(len(seqs[0])))


def bit_not(seq):
    return "".join("0" if ch == "1" else "1" for ch in seq)


def bit_xor(*seqs):
    return "".join(str(sum(int(s[i]) for s in seqs) % 2) for i in range(len(seqs[0])))


def expr_from_truth_table(tt, variables):
    return " + ".join(minterm_name(i, variables) for i, b in enumerate(tt) if b == "1") or "0"
