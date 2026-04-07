"""
ルーブリック双方向パーサ

問題LaTeX に埋め込まれた `%@rubric-begin: ID` 〜 `%@rubric-end` ブロックを
正規表現だけでパース・シリアライズする。AI は使わない(プレビュー速度を汚さないため)。

記法:
    %@rubric-begin: q1-1
    %@rubric: label="問1(1)"
    %@rubric: points=6
    %@rubric: criterion="判別式 D>0 を立式"; weight=2
    %@rubric: criterion="計算過程に誤りなし"; weight=2; hint="符号ミスは -1"
    %@rubric: criterion="最終解答を明示"; weight=2
    %@rubric: hint="全体のヒント文"
    %@rubric-end

`points=N` がなければ `criterion` の `weight` 合計を `max_points` とする。
ブロック内の `%@rubric: criterion=...` 行は順序を保って `criteria` に格納する。
それ以外のキー (`label`, `points`, `hint`) は最後の値が勝つ。
"""
from __future__ import annotations

import re
from typing import Optional

from .grading_models import Rubric, RubricBundle, RubricCriterion


# ──────────── 正規表現 ────────────

# `%@rubric-begin: ID` (ID は半角英数 + ハイフン + アンダースコア)
_BEGIN_RE = re.compile(r"^\s*%\s*@rubric-begin\s*:\s*([A-Za-z0-9_\-]+)\s*$")
# `%@rubric-end`
_END_RE = re.compile(r"^\s*%\s*@rubric-end\s*$")
# `%@rubric: key=value; key2="quoted value"; ...`
_BODY_RE = re.compile(r"^\s*%\s*@rubric\s*:\s*(.*?)\s*$")

# key=value または key="..." または key='...'
_KV_RE = re.compile(
    r"""
    ([A-Za-z_][A-Za-z0-9_]*)        # key
    \s*=\s*
    (
        "(?:[^"\\]|\\.)*"           |  # double-quoted
        '(?:[^'\\]|\\.)*'           |  # single-quoted
        [^;]+                          # bare (until ';' or EOL)
    )
    """,
    re.VERBOSE,
)


# ──────────── パース ────────────

def _unquote(value: str) -> str:
    """ダブル/シングルクォートを外してバックスラッシュエスケープを解除する"""
    v = value.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
        inner = v[1:-1]
        # \" → "  /  \\ → \  /  \n は改行
        out = []
        i = 0
        while i < len(inner):
            ch = inner[i]
            if ch == "\\" and i + 1 < len(inner):
                nxt = inner[i + 1]
                if nxt == "n":
                    out.append("\n")
                else:
                    out.append(nxt)
                i += 2
            else:
                out.append(ch)
                i += 1
        return "".join(out)
    return v


def _parse_kv(body: str) -> list[tuple[str, str]]:
    """1 行の `key=value; key2=value2` を順序保持で list[(k, v)] に分解"""
    pairs: list[tuple[str, str]] = []
    for m in _KV_RE.finditer(body):
        key = m.group(1).strip()
        raw = m.group(2).strip()
        if raw.endswith(";"):
            raw = raw[:-1].rstrip()
        pairs.append((key, _unquote(raw)))
    return pairs


def parse_rubrics(latex: str) -> RubricBundle:
    """LaTeX 文字列からルーブリックを抽出する"""
    rubrics: list[Rubric] = []
    warnings: list[str] = []

    lines = latex.splitlines()
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]
        m = _BEGIN_RE.match(line)
        if not m:
            i += 1
            continue

        question_id = m.group(1)
        begin_line = i + 1  # 1-origin
        i += 1

        label = ""
        explicit_points: Optional[int] = None
        criteria: list[RubricCriterion] = []
        rubric_hint: Optional[str] = None
        closed = False

        while i < n:
            inner = lines[i]
            if _END_RE.match(inner):
                closed = True
                i += 1
                break

            body_m = _BODY_RE.match(inner)
            if not body_m:
                # 空行や別のコメントは無視
                i += 1
                continue

            kv = _parse_kv(body_m.group(1))
            if not kv:
                i += 1
                continue

            # criterion 行か通常メタ行か
            keys = {k for k, _ in kv}
            if "criterion" in keys:
                # criterion 専用 → 1 つの観点として登録
                desc = ""
                weight = 0
                chint: Optional[str] = None
                for k, v in kv:
                    if k == "criterion":
                        desc = v
                    elif k == "weight":
                        try:
                            weight = int(v)
                        except ValueError:
                            warnings.append(
                                f"{question_id}: weight は整数である必要があります ({v})"
                            )
                    elif k == "hint":
                        chint = v
                if desc:
                    criteria.append(RubricCriterion(
                        description=desc,
                        weight=weight,
                        hint=chint,
                    ))
                else:
                    warnings.append(f"{question_id}: criterion の中身が空です")
            else:
                # メタ行 (label / points / hint)
                for k, v in kv:
                    if k == "label":
                        label = v
                    elif k == "points":
                        try:
                            explicit_points = int(v)
                        except ValueError:
                            warnings.append(
                                f"{question_id}: points は整数である必要があります ({v})"
                            )
                    elif k == "hint":
                        rubric_hint = v
                    else:
                        warnings.append(
                            f"{question_id}: 未知のキー '{k}' を無視しました"
                        )
            i += 1

        if not closed:
            warnings.append(f"{question_id}: %@rubric-end が見つかりませんでした")

        max_points = explicit_points if explicit_points is not None else sum(c.weight for c in criteria)

        rubrics.append(Rubric(
            question_id=question_id,
            question_label=label,
            max_points=max_points,
            criteria=criteria,
            hint=rubric_hint,
            source_line=begin_line,
        ))

    # 重複 ID 検出 (後勝ち警告)
    seen: set[str] = set()
    for r in rubrics:
        if r.question_id in seen:
            warnings.append(f"重複した question_id: {r.question_id}")
        seen.add(r.question_id)

    total = sum(r.max_points for r in rubrics)
    return RubricBundle(rubrics=rubrics, total_points=total, parse_warnings=warnings)


# ──────────── シリアライズ ────────────

def _escape_quoted(s: str) -> str:
    """ダブルクォート文字列向けエスケープ"""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _format_rubric_block(r: Rubric) -> str:
    """1 つの Rubric を `%@rubric-begin..end` テキストブロックに整形"""
    lines: list[str] = []
    lines.append(f"%@rubric-begin: {r.question_id}")
    if r.question_label:
        lines.append(f'%@rubric: label="{_escape_quoted(r.question_label)}"')
    lines.append(f"%@rubric: points={r.max_points}")
    for c in r.criteria:
        parts = [f'criterion="{_escape_quoted(c.description)}"', f"weight={c.weight}"]
        if c.hint:
            parts.append(f'hint="{_escape_quoted(c.hint)}"')
        lines.append("%@rubric: " + "; ".join(parts))
    if r.hint:
        lines.append(f'%@rubric: hint="{_escape_quoted(r.hint)}"')
    lines.append("%@rubric-end")
    return "\n".join(lines)


def serialize_rubrics_into_latex(latex: str, rubrics: list[Rubric]) -> str:
    """LaTeX 内の既存 rubric ブロックを `rubrics` で置き換える(または末尾に追加)。

    動作:
    - 既存ブロック(`%@rubric-begin: X` 〜 `%@rubric-end`)はすべて削除
    - 引数 `rubrics` を順番に新しいブロックとして書き出す
    - 既存ブロックがあった位置(最初の `%@rubric-begin` の行)に挿入する
    - 既存がなければプリアンブル後 (`\\begin{document}` の直後) に挿入
    - それも無ければ末尾に追加
    """
    lines = latex.splitlines()
    n = len(lines)

    # 1) 既存ブロックの範囲を全部スキャン
    blocks: list[tuple[int, int]] = []  # [(begin_line_idx, end_line_idx_exclusive)]
    i = 0
    while i < n:
        if _BEGIN_RE.match(lines[i]):
            start = i
            j = i + 1
            while j < n and not _END_RE.match(lines[j]):
                j += 1
            end_excl = j + 1 if j < n else j
            blocks.append((start, end_excl))
            i = end_excl
        else:
            i += 1

    insert_idx: int
    if blocks:
        # 既存があれば最初のブロックの位置に挿入する。後ろから消すとインデックスが狂わない。
        insert_idx = blocks[0][0]
        for start, end_excl in reversed(blocks):
            del lines[start:end_excl]
    else:
        # `\begin{document}` の次の行に挿入
        doc_idx = next(
            (k for k, ln in enumerate(lines) if r"\begin{document}" in ln),
            None,
        )
        if doc_idx is not None:
            insert_idx = doc_idx + 1
        else:
            insert_idx = len(lines)

    # 2) 新しいブロック群をシリアライズ
    new_blocks_text = "\n\n".join(_format_rubric_block(r) for r in rubrics)
    new_lines = new_blocks_text.splitlines()

    # 前後に空行を 1 つだけ入れて埋め込みを目立たせる
    if insert_idx > 0 and insert_idx <= len(lines) and (insert_idx == 0 or lines[insert_idx - 1].strip() != ""):
        new_lines = [""] + new_lines
    if insert_idx < len(lines) and lines[insert_idx].strip() != "":
        new_lines = new_lines + [""]

    lines[insert_idx:insert_idx] = new_lines
    return "\n".join(lines)
