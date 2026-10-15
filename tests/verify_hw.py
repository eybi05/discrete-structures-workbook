"""Independent check of the HW1 answers, using boolkit.py instead of the page's own engine.

Run:  python3 tests/verify_hw.py
"""
from boolkit import (bit_and, bit_not, bit_or, bit_xor, equivalent, expr_from_truth_table,
                     kmap_cells_to_expr, minterm_indices, msop, special_sequences, truth_table)

X, X4, ABC, V5 = list("xyz"), list("xyzt"), list("ABC"), list("xyzst")
checks = 0


def same(a, b, label):
    global checks
    checks += 1
    assert a == b, f"{label}: got {a!r}, expected {b!r}"


def sums(expr, variables):
    """Minimal sums as sets of products, so the order of terms does not matter."""
    return sorted(sorted(s.split(" + ")) for s in msop(expr, variables))


# Task 1: union of A_n (n >= 2) is N minus {1}; the intersection is empty
N = range(1, 1001)
same([m for m in N if not any(m % n == 0 for n in range(2, 1001))], [1], "Task 1a")
same(any(all(m % n == 0 for n in range(2, 40)) for m in N), False, "Task 1b")

# Tasks 4-7 (checked on a window of integers)
Z = range(-200, 201)
Q = lambda x: x + 1 > 2 * x
same([Q(0), Q(-1), Q(1), any(map(Q, Z)), all(map(Q, Z)), any(not Q(x) for x in Z), all(not Q(x) for x in Z)],
     [True, True, False, True, False, True, False], "Task 4")
A = [1, 2, 3, 4, 5]
same([any(x + 3 == 10 for x in A), all(x + 3 < 10 for x in A), any(x + 3 < 5 for x in A), all(x + 3 <= 7 for x in A)],
     [False, True, True, False], "Task 6")
unique = lambda p: sum(1 for x in Z if p(x)) == 1
same([unique(lambda x: x > 1), unique(lambda x: x * x == 1), unique(lambda x: x + 3 == 2 * x), unique(lambda x: x == x + 1)],
     [False, False, True, False], "Task 7")

# 2.1 products
for e, want in [("xy'zxy'", "xy'z"), ("xy'xz'ty'", "xy'z't")]:
    same(equivalent(e, want, V5), True, f"2.1 {e}")
for e in ["xyz'sy'ts", "xyz'ty't"]:
    same("1" in truth_table(e, V5), False, f"2.1 {e} is 0")

# 2.2 SoP forms are equivalent to the originals
for e, sop in [("x(xy'+x'y+y'z)", "xy'"), ("(x+y'z)(y+z')", "xy+xz'"), ("(x'+y)'+y'z", "xy'+y'z"),
               ("(x'y)'(x'+xyz')", "xyz'+x'y'"), ("(x+y)'(xy')'", "x'y'"), ("y(x+yz)'", "x'yz'")]:
    same(equivalent(e, sop, X), True, f"2.2 {e}")

# 2.3 minimal sums
same(sums("xy'z'+x'y+x'y'z'+x'yz", X), [["x'y", "y'z'"]], "2.3a")
same(sums("xy'+x'z't+xyzt'+x'y'zt'", X4), [["x'z't", "xy'", "xzt'", "y'zt'"]], "2.3b")
same(len(msop("xyzt+xyz't'+xz't'+x'y'z'+x'yz't", X4)), 2, "2.3c has two minimal sums")

# 2.4 circuits (traced from Figure 24): truth tables of the expressions on the page
same(truth_table("A'BC+A'C'+BC'", ABC), "10110010", "2.4a")
same(truth_table("ABC+A'BC+AB'C'", ABC), "00011001", "2.4b")

# 2.6-2.8 gates
same([bit_and("110001", "101101", "110011"), bit_and("01111100", "10111010", "00111100"), bit_and("00111110", "01111100", "11110011")],
     ["100001", "00111000", "00110000"], "2.6")
same([bit_or("100011", "100101", "100001"), bit_or("10000001", "00100100", "00000011"), bit_or("00111100", "11110000", "10000001")],
     ["100111", "10100111", "11111101"], "2.7")
same([bit_not("11100111"), bit_not("10001000"), bit_not("11111000")], ["00011000", "01110111", "00000111"], "2.8")

# 2.9-2.10 truth tables
same([truth_table("xy+x'z", X), truth_table("xyz'+xy'z'+x'y'z'", X)], ["01010011", "10001010"], "2.9")
same(sums(expr_from_truth_table("10001010", X), X), [["xz'", "y'z'"]], "2.10a")
same(sums(expr_from_truth_table("00010001", X), X), [["yz"]], "2.10b")
same(sums(expr_from_truth_table("00110000", X), X), [["x'y"]], "2.10c")

# 2.11 Figure 25 (cells read from the HW sheet)
fig_a = [("xy", "zt'"), ("xy", "z't"), ("xy'", "zt"), ("xy'", "zt'"), ("xy'", "z't"), ("x'y'", "zt'"),
         ("x'y", "zt"), ("x'y", "zt'"), ("x'y", "z't'"), ("x'y", "z't")]
fig_b = [("xy", "zt"), ("xy", "zt'"), ("xy", "z't'"), ("xy'", "zt'"), ("xy'", "z't'"), ("xy'", "z't"),
         ("x'y'", "zt'"), ("x'y", "zt"), ("x'y", "zt'"), ("x'y", "z't'")]
same(minterm_indices(kmap_cells_to_expr(fig_a), X4), [2, 4, 5, 6, 7, 9, 10, 11, 13, 14], "Figure 25(a) minterms")
same(sums(kmap_cells_to_expr(fig_a), X4), sorted([sorted(["zt'", "x'y", "yz't", "xy't"]), sorted(["zt'", "x'y", "xz't", "xy't"]),
                                                  sorted(["zt'", "x'y", "xz't", "xy'z"])]), "2.11a: three minimal sums")
same(sums(kmap_cells_to_expr(fig_b), X4), [sorted(["zt'", "yt'", "yz", "xy'z'"])], "2.11b")

# 2.12-2.14
same(sums("y'z+y'z't'+z't", X4), [["y'", "z't"]], "2.12a")
same(sums("y'zt+xzt'+xy'z'", X4), [sorted(["xy'", "y'zt", "xzt'"])], "2.12b")
same(sums("AB'C+ABC'+AB'C'", ABC), [["AB'", "AC'"]], "2.13a")
same(sums("ABC+A'BC'+ABC'", ABC), [["AB", "BC'"]], "2.13b")
seq = special_sequences(ABC)
same(bit_xor(seq["A"], seq["B"], seq["C"]), "01101001", "2.14a parity")
same(len(msop(expr_from_truth_table("01101001", ABC), ABC)[0].split(" + ")), 4, "2.14b needs all four minterms")

print(f"verify_hw: all {checks} checks passed")
