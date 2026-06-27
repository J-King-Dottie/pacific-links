#!/usr/bin/env python3
"""
Audit human-facing directionality and methodology copy.

The goal is not style policing. It checks that the app's plain-language
questions and methodology explain the direction of each relationship and the
known source-data weirdness that could otherwise mislead users.
"""

from __future__ import annotations

import re
import runpy
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SIDE_PANEL = ROOT / "dashboard" / "src" / "components" / "SidePanel.jsx"
NORMALIZER = ROOT / "scripts" / "normalize_for_dashboard.py"


@dataclass(frozen=True)
class CopyExpectation:
    metric: str
    sidepanel_terms: tuple[str, ...]
    normalizer_terms: tuple[str, ...]
    question_terms: tuple[str, ...]
    weirdness_terms: tuple[str, ...] = ()


EXPECTATIONS = [
    CopyExpectation(
        "aid",
        ("donors actually spent in Pacific countries", "should not be added together", "Aggregate donor categories"),
        ("aid money spent", "Do not add spent and promised", "direct donor relationships"),
        ("receive the most aid money spent", "spends the most aid", "spend the most aid"),
    ),
    CopyExpectation(
        "aid_committed",
        ("donors promised to Pacific countries", "not necessarily spent", "should not be added together"),
        ("aid money promised", "Do not add spent and promised", "direct donor relationships"),
        ("aid promised", "promised the most aid"),
    ),
    CopyExpectation(
        "trade",
        ("Pacific countries buy from other countries", "seller country", "recorded goods trade"),
        ("goods bought from overseas", "seller country", "recorded goods trade"),
        ("buy the most goods from overseas", "sells the most goods to", "sell the most goods"),
        ("Marshall Islands", "ship registry", "bunkering", "re-exports", "transshipment"),
    ),
    CopyExpectation(
        "exports",
        ("Pacific countries sell to other countries", "buyer country", "recorded goods trade"),
        ("goods sold overseas", "buyer country", "recorded goods trade"),
        ("sell the most goods overseas", "buys the most goods from", "buy the most goods"),
        ("Marshall Islands", "ship registry", "bunkering", "re-exports"),
    ),
    CopyExpectation(
        "remittances",
        ("money sent home to Pacific countries from people overseas", "modelled", "benchmark years"),
        ("money sent home", "modelled", "do not fill in missing years"),
        ("money sent home", "come from", "go"),
    ),
    CopyExpectation(
        "migration",
        ("born in a Pacific country who live overseas", "not annual moves", "does not report a value"),
        ("born in Pacific country, living overseas", "not annual moves", "not confirmed zero"),
        ("people living overseas", "Pacific-born communities", "live overseas"),
        ("Vanuatu-born people in New Zealand", "blank"),
    ),
    CopyExpectation(
        "students",
        ("students recorded as studying in another country", "not annual departures", "excludes school-level study"),
        ("recorded overseas higher-education students", "not annual departures", "not scholarship counts"),
        ("students overseas", "study overseas", "study in"),
    ),
    CopyExpectation(
        "security",
        ("funds security-related activities in Pacific countries", "not all defence cooperation", "should not be added"),
        ("security-related assistance spent", "should not be added", "current US dollars"),
        ("receive the most security assistance", "funds the most security assistance", "fund security assistance"),
    ),
    CopyExpectation(
        "security_arms",
        ("major conventional arms delivered to Pacific countries", "does not capture small arms", "not US dollars"),
        ("major conventional arms delivered", "not USD", "should not be added"),
        ("major conventional arms", "supplies", "send major conventional arms"),
        ("Sparse rows are meaningful", "trend-indicator value", "arms transfer volume"),
    ),
    CopyExpectation(
        "debt",
        ("published positive creditor-level rows cover six", "owed at the end of each year", "by lender"),
        ("published positive creditor-level rows cover Fiji", "public external debt owed at year end", "lender names"),
        ("owe the most public debt", "lent money", "lenders"),
    ),
    CopyExpectation(
        "fdi",
        ("from overseas into Pacific countries", "year-end amount", "miss many real businesses", "Marshall Islands"),
        ("direct business investment from overseas", "year-end amount", "ship registry", "holding-company"),
        ("direct business investment coming in from overseas", "direct business investment in", "have direct business investment"),
        ("Missing data does not mean", "corporate structures", "domestic economy"),
    ),
    CopyExpectation(
        "portfolio",
        ("invested in Pacific shares and bonds", "does not show where Pacific residents invest overseas", "year-end amounts"),
        ("Pacific shares and bonds", "does not show where Pacific residents invest overseas", "year-end amounts"),
        ("overseas money invested in their shares and bonds", "money invested in shares and bonds"),
    ),
]

QUESTION_FORBIDDEN_TERMS = (
    "TIV",
    "trend-indicator",
    "counterpart",
    "bilateral",
    "stock",
    "flow",
    "position",
    "disbursement",
    "creditor-level",
)


def sidepanel_block(text: str, metric: str) -> str:
    marker = f"  {metric}: {{"
    start = text.find(marker)
    if start < 0:
        return ""
    next_match = re.search(r"\n  [a-z_]+: \{", text[start + len(marker):])
    end = start + len(marker) + next_match.start() if next_match else text.find("\n}\nconst PAC_NAMES", start)
    return text[start:end]


def normalizer_text_by_metric() -> dict[str, str]:
    ctx = runpy.run_path(str(NORMALIZER))
    out = {}
    for item in ctx["METRIC_META"]:
        metric = {
            "Aid": "aid",
            "Aid committed": "aid_committed",
            "Imports": "trade",
            "Exports": "exports",
            "Remittances": "remittances",
            "Migration": "migration",
            "Students": "students",
            "Security assistance": "security",
            "Security arms": "security_arms",
            "Debt": "debt",
            "FDI": "fdi",
            "Portfolio": "portfolio",
        }[item["metric"]]
        out[metric] = " ".join(str(v) for v in item.values() if not isinstance(v, list))
    return out


def question_strings(sidepanel: str) -> list[str]:
    start = sidepanel.find("const INTERPRETATION_COPY = {")
    end = sidepanel.find("function formatCountryList", start)
    block = sidepanel[start:end]
    start2 = sidepanel.find("function selectedInterpretation")
    end2 = sidepanel.find("function InterpretationNote", start2)
    block += "\n" + sidepanel[start2:end2]
    return re.findall(r"'([^']+)'", block) + re.findall(r"`([^`]+)`", block)


def missing_terms(text: str, terms: tuple[str, ...]) -> list[str]:
    lower = text.lower()
    return [term for term in terms if term.lower() not in lower]


def main() -> int:
    sidepanel = SIDE_PANEL.read_text(encoding="utf-8")
    normalizer = normalizer_text_by_metric()
    questions = question_strings(sidepanel)
    question_text = "\n".join(questions)
    issues: list[str] = []
    summary: list[str] = []

    for exp in EXPECTATIONS:
        sp_block = sidepanel_block(sidepanel, exp.metric)
        if not sp_block:
            issues.append(f"{exp.metric}: missing METRIC_INFO block in SidePanel.jsx")
            continue
        missing_sp = missing_terms(sp_block, exp.sidepanel_terms + exp.weirdness_terms)
        missing_norm = missing_terms(normalizer.get(exp.metric, ""), exp.normalizer_terms)
        missing_q = missing_terms(question_text, exp.question_terms)
        if missing_sp:
            issues.append(f"{exp.metric}: SidePanel methodology missing {missing_sp}")
        if missing_norm:
            issues.append(f"{exp.metric}: normalizer metadata missing {missing_norm}")
        if missing_q:
            issues.append(f"{exp.metric}: interpretation questions missing {missing_q}")
        summary.append(f"- {exp.metric}: checked directionality, questions, methodology, and known weirdness terms")

    for q in questions:
        for term in QUESTION_FORBIDDEN_TERMS:
            if term.lower() in q.lower():
                issues.append(f"Question uses jargon term '{term}': {q}")

    print("# Directionality and Methodology Audit")
    print()
    print("## Summary")
    print("\n".join(summary))
    print()
    print("## Result")
    if issues:
        for issue in issues:
            print(f"- FAIL: {issue}")
        return 1
    print("- PASS: user-facing questions and methodology explain directionality and known source-data weirdness in plain language.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
