"""
Educational materials database service.
Provides searchable problem sets for AI-assisted document creation.
"""
from __future__ import annotations
import re
from typing import Any

# ─── Materials Database ───────────────────────────────────────────────────────
# Structure: subject → topic → problems
MATERIALS_DB: list[dict[str, Any]] = [
    # ══════════════════════════════════════════
    # 数学（中学）
    # ══════════════════════════════════════════
    {
        "id": "math_jr_linear_eq",
        "subject": "数学",
        "level": "中学1年",
        "topic": "一次方程式",
        "keywords": ["方程式", "一次", "移項", "等式"],
        "problems": [
            {
                "type": "計算",
                "text": "次の方程式を解け。$3x - 7 = 2$",
                "answer": "$x = 3$",
                "hint": "右辺に$-7$を移項して整理する",
                "latex": "3x - 7 = 2"
            },
            {
                "type": "計算",
                "text": "次の方程式を解け。$2(x+3) = 4x - 2$",
                "answer": "$x = 4$",
                "hint": "括弧を展開してから移項する",
                "latex": "2(x+3) = 4x - 2"
            },
            {
                "type": "文章題",
                "text": "ある数の3倍から5を引くと、その数に7を足したものと等しい。この数を求めよ。",
                "answer": "$x = 6$",
                "hint": "$3x - 5 = x + 7$ と立式する"
            },
        ],
    },
    {
        "id": "math_jr_quadratic",
        "subject": "数学",
        "level": "中学3年",
        "topic": "二次方程式",
        "keywords": ["二次方程式", "因数分解", "解の公式", "平方完成"],
        "problems": [
            {
                "type": "計算",
                "text": "次の方程式を解け。$x^2 - 5x + 6 = 0$",
                "answer": "$x = 2,\\ 3$",
                "hint": "$(x-2)(x-3)=0$ と因数分解する",
                "latex": "x^2 - 5x + 6 = 0"
            },
            {
                "type": "計算",
                "text": "次の方程式を解け。$2x^2 - 3x - 2 = 0$",
                "answer": "$x = 2,\\ -\\dfrac{1}{2}$",
                "hint": "$(2x+1)(x-2)=0$と因数分解する",
                "latex": "2x^2 - 3x - 2 = 0"
            },
            {
                "type": "計算",
                "text": "解の公式を用いて次の方程式を解け。$x^2 - 4x + 1 = 0$",
                "answer": "$x = 2 \\pm \\sqrt{3}$",
                "hint": "解の公式 $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ を適用する",
                "latex": "x^2 - 4x + 1 = 0"
            },
        ],
    },
    {
        "id": "math_jr_functions",
        "subject": "数学",
        "level": "中学2年",
        "topic": "一次関数",
        "keywords": ["一次関数", "傾き", "切片", "グラフ", "比例"],
        "problems": [
            {
                "type": "計算",
                "text": "一次関数 $y = 2x + 3$ について、$x = -1$ のときの $y$ の値を求めよ。",
                "answer": "$y = 1$",
                "latex": "y = 2x + 3"
            },
            {
                "type": "グラフ・方程式",
                "text": "傾きが$-3$で、点$(1, 2)$を通る一次関数を求めよ。",
                "answer": "$y = -3x + 5$",
                "hint": "$y = -3x + b$ に点を代入して $b$ を求める"
            },
            {
                "type": "文章題",
                "text": "水が 60 L 入ったタンクから、毎分 4 L ずつ水を抜く。$x$ 分後の水量 $y$ L を $x$ の式で表し、タンクが空になるのは何分後か求めよ。",
                "answer": "$y = -4x + 60$、15分後",
                "hint": "グラフの $x$ 切片を求める"
            },
        ],
    },
    {
        "id": "math_jr_similarity",
        "subject": "数学",
        "level": "中学3年",
        "topic": "相似と証明",
        "keywords": ["相似", "証明", "比", "三角形", "平行"],
        "problems": [
            {
                "type": "証明",
                "text": "右図において、$\\triangle ABC \\sim \\triangle DEF$ を証明せよ。（$AB\\parallel DE$, $\\angle B = \\angle E$）",
                "answer": "（証明略）$\\angle A = \\angle D$（同位角）、$\\angle B = \\angle E$（仮定）より 2角が等しいので相似",
                "hint": "2組の角が等しいことを示す"
            },
        ],
    },
    # ══════════════════════════════════════════
    # 数学（高校）
    # ══════════════════════════════════════════
    {
        "id": "math_hs_quadratic_func",
        "subject": "数学",
        "level": "高校1年",
        "topic": "二次関数",
        "keywords": ["二次関数", "放物線", "頂点", "平方完成", "最大最小", "軸"],
        "problems": [
            {
                "type": "計算",
                "text": "二次関数 $f(x) = x^2 - 4x + 3$ を平方完成し、頂点の座標と軸の方程式を答えよ。",
                "answer": "$f(x) = (x-2)^2 - 1$、頂点 $(2, -1)$、軸 $x = 2$",
                "latex": "f(x) = x^2 - 4x + 3 = (x-2)^2 - 1"
            },
            {
                "type": "最大最小",
                "text": "$0 \\le x \\le 4$ において $f(x) = -x^2 + 4x - 1$ の最大値・最小値を求めよ。",
                "answer": "最大値 $f(2)=3$、最小値 $f(0)=f(4)=-1$",
                "hint": "頂点 $(2, 3)$ が定義域内にあるか確認する"
            },
            {
                "type": "文章題",
                "text": "地面から初速 $v_0 = 20$ m/s で鉛直上向きに投げたボールの高さは $h = 20t - 5t^2$ m。最高点の高さと到達時刻を求めよ。",
                "answer": "最高点 $h = 20$ m（$t = 2$ 秒後）",
                "hint": "$h = -5(t-2)^2 + 20$ と平方完成する"
            },
        ],
    },
    {
        "id": "math_hs_trigonometry",
        "subject": "数学",
        "level": "高校2年",
        "topic": "三角関数",
        "keywords": ["三角関数", "sin", "cos", "tan", "加法定理", "弧度法", "ラジアン"],
        "problems": [
            {
                "type": "計算",
                "text": "加法定理を用いて $\\sin 75°$ の値を求めよ。",
                "answer": "$\\sin 75° = \\dfrac{\\sqrt{6}+\\sqrt{2}}{4}$",
                "hint": "$\\sin(45°+30°)$ と考える",
                "latex": "\\sin 75^\\circ = \\sin(45^\\circ + 30^\\circ)"
            },
            {
                "type": "方程式",
                "text": "$0 \\le \\theta < 2\\pi$ のとき、$2\\cos^2\\theta - \\cos\\theta - 1 = 0$ を解け。",
                "answer": "$\\theta = \\dfrac{\\pi}{3},\\ \\pi,\\ \\dfrac{5\\pi}{3}$",
                "hint": "$\\cos\\theta = t$ として二次方程式を解く"
            },
        ],
    },
    {
        "id": "math_hs_calculus",
        "subject": "数学",
        "level": "高校3年",
        "topic": "微分・積分",
        "keywords": ["微分", "積分", "導関数", "面積", "極値", "増減表"],
        "problems": [
            {
                "type": "微分",
                "text": "次の関数を微分せよ。$f(x) = 3x^4 - 2x^3 + x - 5$",
                "answer": "$f'(x) = 12x^3 - 6x^2 + 1$",
                "latex": "f(x) = 3x^4 - 2x^3 + x - 5"
            },
            {
                "type": "積分",
                "text": "次の定積分を求めよ。$\\displaystyle\\int_0^2 (x^2 - 2x + 3)\\,dx$",
                "answer": "$\\dfrac{10}{3}$",
                "latex": "\\int_0^2 (x^2 - 2x + 3)\\,dx"
            },
            {
                "type": "面積",
                "text": "曲線 $y = x^2$ と直線 $y = 2x$ で囲まれた図形の面積を求めよ。",
                "answer": "$\\dfrac{4}{3}$",
                "hint": "交点を求め、$\\int_0^2 (2x - x^2)dx$ を計算する"
            },
        ],
    },
    {
        "id": "math_hs_sequence",
        "subject": "数学",
        "level": "高校2年",
        "topic": "数列",
        "keywords": ["数列", "等差数列", "等比数列", "漸化式", "数学的帰納法", "Σ"],
        "problems": [
            {
                "type": "計算",
                "text": "初項 $2$、公差 $3$ の等差数列の第 $n$ 項と第 10 項を求めよ。",
                "answer": "第 $n$ 項: $3n - 1$、第 10 項: $29$",
                "latex": "a_n = 2 + (n-1) \\cdot 3 = 3n - 1"
            },
            {
                "type": "Σ計算",
                "text": "$\\displaystyle\\sum_{k=1}^{n} k^2$ の公式を述べ、$\\displaystyle\\sum_{k=1}^{10} k^2$ の値を求めよ。",
                "answer": "$\\dfrac{n(n+1)(2n+1)}{6}$、$n=10$ のとき $385$",
                "latex": "\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}"
            },
        ],
    },
    # ══════════════════════════════════════════
    # 理科（中学・高校）
    # ══════════════════════════════════════════
    {
        "id": "science_physics_motion",
        "subject": "理科",
        "level": "中学3年",
        "topic": "運動と力",
        "keywords": ["速さ", "加速度", "慣性", "力", "ニュートン", "等速直線運動"],
        "problems": [
            {
                "type": "計算",
                "text": "120 m の距離を 10 秒で走ったときの平均の速さは何 m/s か。",
                "answer": "$12$ m/s",
                "hint": "速さ ＝ 距離 ÷ 時間"
            },
            {
                "type": "記述",
                "text": "慣性の法則（ニュートンの第一法則）を説明せよ。",
                "answer": "力が働かないとき、静止している物体は静止し続け、運動している物体は等速直線運動を続ける性質。"
            },
        ],
    },
    {
        "id": "science_chemistry_mol",
        "subject": "理科",
        "level": "高校1年",
        "topic": "物質量（モル）",
        "keywords": ["モル", "アボガドロ定数", "mol", "分子量", "化学量論"],
        "problems": [
            {
                "type": "計算",
                "text": "水 $\\text{H}_2\\text{O}$ 36 g は何 mol か。ただし H=1, O=16 とする。",
                "answer": "$2$ mol",
                "hint": "分子量 18 で割る"
            },
            {
                "type": "計算",
                "text": "0.5 mol の $\\text{CO}_2$ には何個の分子が含まれるか。アボガドロ定数を $6.0 \\times 10^{23}$ とする。",
                "answer": "$3.0 \\times 10^{23}$ 個",
                "latex": "0.5 \\times 6.0 \\times 10^{23} = 3.0 \\times 10^{23}"
            },
        ],
    },
    {
        "id": "science_physics_electric",
        "subject": "理科",
        "level": "中学2年",
        "topic": "電流・電圧・抵抗",
        "keywords": ["オームの法則", "電流", "電圧", "抵抗", "直列", "並列"],
        "problems": [
            {
                "type": "計算",
                "text": "抵抗 $20\\ \\Omega$ に $5$ V の電圧をかけると、電流は何 A か。",
                "answer": "$0.25$ A",
                "hint": "$I = V / R$（オームの法則）",
                "latex": "I = \\frac{V}{R} = \\frac{5}{20} = 0.25 \\ \\text{A}"
            },
            {
                "type": "計算",
                "text": "$10\\ \\Omega$ と $30\\ \\Omega$ の抵抗を並列接続したときの合成抵抗を求めよ。",
                "answer": "$7.5\\ \\Omega$",
                "hint": "$\\dfrac{1}{R} = \\dfrac{1}{10} + \\dfrac{1}{30}$",
                "latex": "\\frac{1}{R} = \\frac{1}{10} + \\frac{1}{30} = \\frac{4}{30}"
            },
        ],
    },
    # ══════════════════════════════════════════
    # 英語
    # ══════════════════════════════════════════
    {
        "id": "english_grammar_tense",
        "subject": "英語",
        "level": "中学2年",
        "topic": "時制（現在・過去・未来）",
        "keywords": ["時制", "現在形", "過去形", "未来形", "will", "be going to"],
        "problems": [
            {
                "type": "空所補充",
                "text": "次の文の（　）内に適切な動詞の形を入れよ。\\n She ( study ) English every day.",
                "answer": "studies",
                "hint": "三人称単数現在形"
            },
            {
                "type": "整序",
                "text": "次の語を並べ替えて英文を作れ。[ going / I / am / tomorrow / to / leave ]",
                "answer": "I am going to leave tomorrow."
            },
        ],
    },
    {
        "id": "english_grammar_passive",
        "subject": "英語",
        "level": "中学3年",
        "topic": "受動態",
        "keywords": ["受動態", "受け身", "be動詞", "過去分詞", "by"],
        "problems": [
            {
                "type": "書き換え",
                "text": "次の文を受動態に書き換えよ。\\n Tom wrote this letter.",
                "answer": "This letter was written by Tom.",
            },
            {
                "type": "空所補充",
                "text": "This building ( ) in 1900. （建てられた）",
                "answer": "was built",
            },
        ],
    },
    # ══════════════════════════════════════════
    # 国語
    # ══════════════════════════════════════════
    {
        "id": "japanese_kanji_junior",
        "subject": "国語",
        "level": "中学1年",
        "topic": "漢字・語彙",
        "keywords": ["漢字", "読み", "書き取り", "語彙", "熟語"],
        "problems": [
            {
                "type": "読み",
                "text": "次の漢字の読みをひらがなで答えよ。①河川　②湖沼　③丘陵",
                "answer": "①かせん　②こしょう　③きゅうりょう"
            },
            {
                "type": "書き取り",
                "text": "次のひらがなを漢字に直せ。①きかい（機会）　②あんい（安易）　③せいかく（性格）",
                "answer": "①機会　②安易　③性格"
            },
        ],
    },
]


# ─── Search Functions ─────────────────────────────────────────────────────────

def search_materials(
    query: str = "",
    subject: str = "",
    level: str = "",
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Search the materials DB by query keywords, subject, and level.
    Returns matching topics with their problems.
    """
    results = []
    query_lower = query.lower()
    terms = re.split(r"[\s　]+", query_lower) if query_lower else []

    for entry in MATERIALS_DB:
        # Filter by subject
        if subject and subject not in entry["subject"]:
            continue
        # Filter by level
        if level and level not in entry["level"]:
            continue

        # Score by keyword/topic match
        if terms:
            searchable = (
                entry["topic"] + " " +
                " ".join(entry["keywords"]) + " " +
                entry["subject"] + " " +
                entry["level"]
            ).lower()
            if not any(t in searchable for t in terms):
                continue

        results.append(entry)
        if len(results) >= limit:
            break

    return results


def get_all_subjects() -> list[str]:
    seen: set[str] = set()
    out = []
    for e in MATERIALS_DB:
        if e["subject"] not in seen:
            seen.add(e["subject"])
            out.append(e["subject"])
    return out


def get_all_levels() -> list[str]:
    seen: set[str] = set()
    out = []
    for e in MATERIALS_DB:
        if e["level"] not in seen:
            seen.add(e["level"])
            out.append(e["level"])
    return out
