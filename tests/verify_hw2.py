"""Independent check of every claim in the HW2 model proofs: exact arithmetic and brute force.

A polynomial identity of degree at most d in each variable that holds on a grid of d + 1 points per
variable holds everywhere, so the identities below are proofs, not samples. Inequalities and
divisibility claims are checked on long ranges, and the recursive sets are generated directly.
The pairs listed on the page (answer keys and model proofs) are compared with the generated sets.

Run:  python3 tests/verify_hw2.py
"""
import re
from fractions import Fraction as F
from itertools import combinations, product
from math import factorial
from pathlib import Path

checks = 0


def same(a, b, label):
    global checks
    checks += 1
    assert a == b, f"{label}: got {a!r}, expected {b!r}"


def holds(cond, label):
    same(bool(cond), True, label)


def identity(f, g, deg, nvars, label):
    """f == g as polynomials of degree <= deg in each of nvars variables."""
    pts = [F(x) for x in range(-1, deg + 1)]  # deg + 2 points per variable
    holds(all(f(*xs) == g(*xs) for xs in product(pts, repeat=nvars)), label)


def makeable(n, stamps):
    ok = [True] + [False] * n
    for v in range(1, n + 1):
        ok[v] = any(s <= v and ok[v - s] for s in stamps)
    return ok[n]


def levels(rules, n):
    """New elements produced by each of the first n applications of the recursive step, from (0, 0)."""
    known, out = {(0, 0)}, []
    for _ in range(n):
        fresh = {q for p in known for q in rules(*p)} - known
        known |= fresh
        out.append(fresh)
    return out


# Task 1: Bernoulli
identity(lambda k, h: (1 + k * h) * (1 + h), lambda k, h: 1 + (k + 1) * h + k * h * h, 3, 2, "T1 expansion")
hs = [F(-99, 100), F(-1, 2), F(-1, 10), F(0), F(1, 3), F(1), F(5, 2), F(7)]
holds(all(1 + n * h <= (1 + h) ** n for h in hs for n in range(0, 40)), "T1 inequality")
same((1 + 5 * -3, (1 - 3) ** 5, 1 + 5 * -3 <= (1 - 3) ** 5), (-14, -32, False), "T1 fails for h = -3, n = 5")

# Task 2: 3^n < n! from n = 7 on, and not at n = 6
same((3 ** 7, factorial(7), 3 ** 6, factorial(6)), (2187, 5040, 729, 720), "T2 numbers")
same(min(n for n in range(1, 50) if all(3 ** m < factorial(m) for m in range(n, 200))), 7, "T2 first n")

# Task 3
holds(all(sum(j * factorial(j) for j in range(1, n + 1)) == factorial(n + 1) - 1 for n in range(1, 60)), "T3 identity")
holds(all(factorial(k + 1) - 1 + (k + 1) * factorial(k + 1) == factorial(k + 2) - 1 for k in range(1, 60)), "T3 step")
holds(all(k * factorial(k) == factorial(k + 1) - factorial(k) for k in range(1, 60)), "T3 telescoping")

# Task 4: count by brute force, and the split used in the step
holds(all(len(list(combinations(range(n), 3))) == n * (n - 1) * (n - 2) // 6 for n in range(3, 13)), "T4 formula")
for k in range(3, 11):
    triples = list(combinations(range(k + 1), 3))
    a = k
    without = [t for t in triples if a not in t]
    with_a = [t for t in triples if a in t]
    same((len(without), len(with_a)), (k * (k - 1) * (k - 2) // 6, k * (k - 1) // 2), f"T4 split k = {k}")
identity(lambda k: k * (k - 1) * (k - 2) / 6 + k * (k - 1) / 2, lambda k: (k + 1) * k * (k - 1) / 6, 3, 1, "T4 algebra")
same(7 * 6 * 5 // 6, 35, "T4 example")


# Task 5: (x^n)' = n x^(n-1), read off as the coefficient of t in (x + t)^n (no power rule used)
def expand_x_plus_t(n):
    poly = {(0, 0): 1}  # (power of x, power of t) -> coefficient
    for _ in range(n):
        nxt = {}
        for (i, j), c in poly.items():
            nxt[(i + 1, j)] = nxt.get((i + 1, j), 0) + c
            nxt[(i, j + 1)] = nxt.get((i, j + 1), 0) + c
        poly = nxt
    return poly


holds(all({i: c for (i, j), c in expand_x_plus_t(n).items() if j == 1} == {n - 1: n} for n in range(1, 25)), "T5 derivative")
holds(all(1 * x ** k + x * (k * x ** (k - 1)) == (k + 1) * x ** k for k in range(1, 25) for x in map(F, range(-3, 4))), "T5 step")

# Task 6: no one-to-one f from {1..m} to {1..n} when m > n, and the "remove j, shift down" construction
holds(not any(len(set(f)) == m for n in range(1, 5) for m in range(n + 1, n + 4) for f in product(range(1, n + 1), repeat=m)),
      "T6 pigeonhole")
for k in range(1, 5):
    for m in range(1, k + 2):
        for f in product(range(1, k + 2), repeat=m):  # f[i - 1] = f(i)
            if len(set(f)) < m or k + 1 not in f:
                continue
            j = f.index(k + 1) + 1
            g = [f[i - 1] if i < j else f[i] for i in range(1, m)]  # g(i) = f(i) for i < j, f(i + 1) for i >= j
            assert all(1 <= v <= k for v in g) and len(set(g)) == len(g) and set(g) == set(f) - {k + 1}
checks += 1

# Task 7
for k in range(1, 10):
    identity(lambda a, b: a ** (k + 1) - b ** (k + 1), lambda a, b: a * (a ** k - b ** k) + b ** k * (a - b), k + 1, 2, f"T7 split k = {k}")
    identity(lambda a, b: a ** k - b ** k, lambda a, b: (a - b) * sum(a ** (k - 1 - i) * b ** i for i in range(k)), k, 2, f"T7 factor n = {k}")
pairs_ab = [(F(a), F(b)) for a in range(1, 9) for b in range(1, 9) if b < a] + [(F(3, 2), F(1, 3)), (F(1, 2), F(1, 5))]
holds(all(a ** n - b ** n <= n * a ** (n - 1) * (a - b) for a, b in pairs_ab for n in range(1, 30)), "T7 inequality")

# Task 8: a_n = (1/2)(3/4)...((2n - 1)/(2n)); compare squares to avoid square roots
a = {1: F(1, 2)}
for n in range(1, 400):
    a[n + 1] = a[n] * F(2 * n + 1, 2 * n + 2)
holds(all(a[n] ** 2 < F(1, 3 * n) for n in range(1, 400)), "T8 weak inequality")
holds(all(a[n] ** 2 < F(1, 3 * n + 1) for n in range(2, 400)), "T8 strong inequality from n = 2")
same(a[1] ** 2, F(1, 4), "T8 strong inequality is an equality at n = 1")
same((a[2], F(9, 64) < F(1, 7), 9 * 7, 64), (F(3, 8), True, 63, 64), "T8 basis n = 2")
identity(lambda k: (2 * k + 1) ** 2 * (3 * k + 4), lambda k: 12 * k ** 3 + 28 * k ** 2 + 19 * k + 4, 3, 1, "T8 left expansion")
identity(lambda k: (2 * k + 2) ** 2 * (3 * k + 1), lambda k: 12 * k ** 3 + 28 * k ** 2 + 20 * k + 4, 3, 1, "T8 right expansion")
identity(lambda k: (2 * k + 1) ** 2 * (3 * k + 3) - 3 * k * (2 * k + 2) ** 2, lambda k: 3 * k + 3, 3, 1, "T8(a) gap is 3k + 3")
identity(lambda k: (2 * k + 1) ** 2 - 4 * k * (k + 1), lambda k: F(1), 2, 1, "T8(a) reduces to 1 <= 0")
holds(all(F(2 * k + 1, 2 * k + 2) ** 2 * F(1, 3 * k) > F(1, 3 * k + 3) for k in range(1, 300)), "T8(a) bound always too big")

# Tasks 9 and 10: stamps
same([4 + 7 + 7, 4 * 3 + 7, 4 * 5, 7 * 3], [18, 19, 20, 21], "T9 basis")
holds(all(makeable(n, [4, 7]) for n in range(18, 400)) and not makeable(17, [4, 7]), "T9 claim, and 17 impossible")
same([r % 4 for r in (17, 10, 3)], [1, 2, 3], "T9 17 - 7j is never a multiple of 4")
same([5 * 4 + 8, 5 + 8 * 3, 5 * 6, 5 * 3 + 8 * 2, 8 * 4], [28, 29, 30, 31, 32], "T10 basis")
same([5 * 5 + 8, 5 * 2 + 8 * 3, 5 * 7], [33, 34, 35], "T10 extra basis cases for an 8-cent step")
holds(all(makeable(n, [5, 8]) for n in range(28, 400)), "T10 claim")
same(max(n for n in range(1, 400) if not makeable(n, [5, 8])), 27, "T10 largest impossible")
same([r % 5 for r in (27, 19, 11, 3)], [2, 4, 1, 3], "T10 27 - 8j is never a multiple of 5")
same((5 * 8 - 5 - 8, 4 * 7 - 4 - 7, max(n for n in range(1, 400) if not makeable(n, [4, 7]))), (27, 17, 17), "T9-10 ab - a - b")

# Tasks 11 and 12: recursive sets
rules11 = lambda a, b: [(a, b + 1), (a + 1, b + 1), (a + 2, b + 1)]
rules12 = lambda a, b: [(a + 2, b + 3), (a + 3, b + 2)]
L11, L12 = levels(rules11, 10), levels(rules12, 12)
same([L11[n - 1] for n in (1, 2, 3)], [{(a, n) for a in range(2 * n + 1)} for n in (1, 2, 3)], "T11(a) levels")
holds(all(L11[n - 1] == {(a, n) for a in range(2 * n + 1)} for n in range(1, 11)), "T11 level n is {(a, n) : 0 <= a <= 2n}")
same(sum(len(L11[n]) for n in range(3)), 15, "T11(a) count")
holds(all(a <= 2 * b for lev in L11 for a, b in lev), "T11 a <= 2b")
holds(all(L12[n - 1] == {(3 * n - i, 2 * n + i) for i in range(n + 1)} for n in range(1, 13)), "T12 level n is {(3n - i, 2n + i)}")
same(sum(len(L12[n]) for n in range(4)), 14, "T12(a) count")
holds(all((a + b) % 5 == 0 and a + b == 5 * n for n, lev in enumerate(L12, 1) for a, b in lev), "T12 a + b = 5n")
holds((5, 0) not in set().union(*L12) and all(min(p) >= 2 for lev in L12 for p in lev), "T12 (5, 0) is not in S")

# the pairs on the page: answer keys and the lists in the model proofs
page = (Path(__file__).resolve().parent.parent / "index.html").read_text(encoding="utf-8")
sect = page[page.index('<section class="chapter" id="hw2">'):]
sect = sect[:sect.index("</section>")]
parse_pairs = lambda s: {tuple(map(int, p)) for p in re.findall(r"\((-?\d+),\s*(-?\d+)\)", s)}
ORD = {"1st": 1, "2nd": 2, "3rd": 3, "4th": 4}
for task, lev in (("hw2-t11", L11), ("hw2-t12", L12)):
    art = sect[sect.index(f'id="{task}"'):]
    art = art[:art.index("</article>")]
    keys = re.findall(r'data-kind="pairs" data-answer="([^"]+)" data-label="\(a\) (\w+) application:"', art)
    listed = re.findall(r"<li>(\w+) application[^:]*: <span class=\"m\">([^<]+)</span></li>", art)
    same(len(keys), {"hw2-t11": 3, "hw2-t12": 4}[task], f"{task} number of answer boxes")
    same(len(listed), len(keys), f"{task} number of listed applications")
    for (key, o1), (o2, text) in zip(keys, listed):
        same(parse_pairs(key), lev[ORD[o1] - 1], f"{task} key {o1}")
        same(parse_pairs(text), lev[ORD[o2] - 1], f"{task} model proof {o2}")
same(re.search(r'id="hw2-t10".*?data-answer="(\d+)"', sect, re.S).group(1), "27", "T10 answer key")

# Task 13
holds(all(sum(F(1, (4 * j - 3) * (4 * j + 1)) for j in range(1, n + 1)) == F(n, 4 * n + 1) for n in range(1, 150)), "T13 identity")
identity(lambda k: k * (4 * k + 5) + 1, lambda k: (4 * k + 1) * (k + 1), 2, 1, "T13 numerator")
holds(all(F(k, 4 * k + 1) + F(1, (4 * k + 1) * (4 * k + 5)) == F(k + 1, 4 * (k + 1) + 1) for k in range(1, 300)), "T13 step")
holds(all(F(1, (4 * j - 3) * (4 * j + 1)) == F(1, 4) * (F(1, 4 * j - 3) - F(1, 4 * j + 1)) for j in range(1, 300)), "T13 partial fractions")

# Task 14
holds(all((7 ** n - 2 ** n) % 5 == 0 for n in range(0, 300)), "T14 claim, including n = 0")
holds(all(7 ** (k + 1) - 2 ** (k + 1) == 7 * (7 ** k - 2 ** k) + 5 * 2 ** k for k in range(0, 200)), "T14 step")
holds(all(7 ** n - 2 ** n == 5 * sum(7 ** (n - 1 - i) * 2 ** i for i in range(n)) for n in range(1, 60)), "T14 factorisation")

# Task 15
holds(all((n ** 3 - 4 * n + 6) % 3 == 0 for n in range(-50, 300)), "T15 claim")
identity(lambda k: (k + 1) ** 3 - 4 * (k + 1) + 6, lambda k: (k ** 3 - 4 * k + 6) + 3 * (k * k + k - 1), 3, 1, "T15 step")
same((1 - 4 + 6, 0 - 0 + 6), (3, 6), "T15 n = 1 and n = 0")

print(f"verify_hw2: all {checks} checks passed")
