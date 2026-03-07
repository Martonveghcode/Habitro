import json
import math
import os
import random
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import streamlit as st

MORFO_DB_PATH = "morfologia.db"

MORFO_WORD_TYPES = [
    "Sustantivo",
    "Adjetivo",
    "Verbo",
    "Adverbio",
]

MORFO_MORPHEME_TYPES = [
    "Prefijo derivativo",
    "Interfijo",
    "Sufijo derivativo",
    "Morfema flexivo nominal (genero)",
    "Morfema flexivo nominal (numero)",
    "Morfema flexivo verbal (tiempo/modo/aspecto)",
    "Morfema flexivo verbal (persona/numero)",
]

MORFO_MODEL_OPTIONS: List[Dict[str, str]] = [
    {"label": "Gemini 2.5 Flash Lite", "value": "gemini-2.5-flash-lite"},
    {"label": "Gemini 2.5 Flash", "value": "gemini-2.5-flash"},
    {"label": "Gemini 2.5 Pro", "value": "gemini-2.5-pro"},
    {"label": "Gemini 2.0 Flash", "value": "gemini-2.0-flash"},
    {"label": "Gemini 2.0 Flash Exp", "value": "gemini-2.0-flash-exp"},
    {"label": "Gemini 2.0 Flash Lite", "value": "gemini-2.0-flash-lite"},
    {"label": "Gemma 3 1B IT", "value": "gemma-3-1b-it"},
    {"label": "Gemma 3 4B IT", "value": "gemma-3-4b-it"},
    {"label": "Gemma 3 12B IT", "value": "gemma-3-12b-it"},
    {"label": "Gemma 3 27B IT", "value": "gemma-3-27b-it"},
]

MORFO_SYSTEM_PROMPT = """
Eres PROFE MORFOLOGIA en modo especializado en analisis de palabras.
Debes generar solo palabras en espanol para practicar morfologia.

Tipos de palabra validos (exactos):
- Sustantivo
- Adjetivo
- Verbo
- Adverbio

Tipos de morfema validos (exactos):
- Prefijo derivativo
- Interfijo
- Sufijo derivativo
- Morfema flexivo nominal (genero)
- Morfema flexivo nominal (numero)
- Morfema flexivo verbal (tiempo/modo/aspecto)
- Morfema flexivo verbal (persona/numero)

Reglas obligatorias:
- Genera palabras (no oraciones completas).
- Si se solicita batch_size > 1, devuelve exactamente ese numero de items.
- Cada item debe incluir tipo de palabra, lexema, morfemas y tipos de morfema.
- Incluye una explicacion breve y clara.
- Ajusta dificultad:
  d1: estructura transparente y analisis directo
  d2: estructura media con derivacion y/o flexion combinadas
  d3: estructura compleja con varios morfemas
- Si se pasan focos o debilidades, priorizalos.
- Respeta generation_strategy.mode:
  - personalizado_objetivo: prioriza target_word_type y target_morpheme_type.
  - personalizado_mixto: mezcla contenido normal con refuerzo.
- Respeta anti_repetition: evita repetir palabras y familias recientes.
- NO devuelvas texto fuera de JSON.

Salida JSON exacta:
{
  "items": [
    {
      "word": "string",
      "difficulty": 1,
      "word_type": "uno de los tipos validos",
      "lexeme": "string",
      "accepted_lexemes": ["variantes aceptables del lexema"],
      "morphemes": ["lista de morfemas sin el lexema"],
      "morpheme_types": ["lista de tipos validos"],
      "analysis_type": "descripcion corta",
      "explanation": "explicacion breve"
    }
  ]
}
"""

MORFO_RECHECK_SYSTEM_PROMPT = """
Eres un verificador estricto de morfologia espanola.
Recibes una palabra y el analisis propuesto por otro modelo.
Tu tarea es decidir si la propuesta es correcta.
Devuelve SOLO JSON valido.
"""

MORFO_QUESTION_SYSTEM_PROMPT = """
Eres un profesor breve y claro de morfologia espanola.
Responde a la pregunta del usuario sobre una palabra concreta.
Manten la respuesta corta y util (maximo 6 lineas).
"""

MORFO_SAMPLE_BANK: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {
            "word": "gatos",
            "difficulty": 1,
            "word_type": "Sustantivo",
            "lexeme": "gat",
            "accepted_lexemes": ["gat", "gato"],
            "morphemes": ["o", "s"],
            "morpheme_types": [
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo comun masculino plural",
            "explanation": "Lexema gat + genero -o + numero -s.",
        },
        {
            "word": "casas",
            "difficulty": 1,
            "word_type": "Sustantivo",
            "lexeme": "cas",
            "accepted_lexemes": ["cas", "casa"],
            "morphemes": ["a", "s"],
            "morpheme_types": [
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo comun femenino plural",
            "explanation": "Lexema cas + genero -a + numero -s.",
        },
        {
            "word": "cantamos",
            "difficulty": 1,
            "word_type": "Verbo",
            "lexeme": "cant",
            "accepted_lexemes": ["cant", "canta"],
            "morphemes": ["a", "mos"],
            "morpheme_types": [
                "Morfema flexivo verbal (tiempo/modo/aspecto)",
                "Morfema flexivo verbal (persona/numero)",
            ],
            "analysis_type": "Verbo en primera persona plural",
            "explanation": "Lexema cant + marca verbal de tiempo/modo/aspecto + marca de persona/numero.",
        },
        {
            "word": "injusto",
            "difficulty": 1,
            "word_type": "Adjetivo",
            "lexeme": "just",
            "accepted_lexemes": ["just", "justo"],
            "morphemes": ["in", "o"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Morfema flexivo nominal (genero)",
            ],
            "analysis_type": "Adjetivo derivado masculino singular",
            "explanation": "Prefijo derivativo in- + lexema just + marca de genero -o.",
        },
        {
            "word": "amigas",
            "difficulty": 1,
            "word_type": "Sustantivo",
            "lexeme": "amig",
            "accepted_lexemes": ["amig", "amiga"],
            "morphemes": ["a", "s"],
            "morpheme_types": [
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo comun femenino plural",
            "explanation": "Lexema amig + genero -a + numero -s.",
        },
    ],
    2: [
        {
            "word": "panadero",
            "difficulty": 2,
            "word_type": "Sustantivo",
            "lexeme": "pan",
            "accepted_lexemes": ["pan"],
            "morphemes": ["ader", "o"],
            "morpheme_types": [
                "Sufijo derivativo",
                "Morfema flexivo nominal (genero)",
            ],
            "analysis_type": "Sustantivo derivado",
            "explanation": "Lexema pan + sufijo derivativo -ader- + marca de genero -o.",
        },
        {
            "word": "desordenados",
            "difficulty": 2,
            "word_type": "Adjetivo",
            "lexeme": "orden",
            "accepted_lexemes": ["orden"],
            "morphemes": ["des", "ad", "o", "s"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Sufijo derivativo",
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Adjetivo con derivacion y flexion",
            "explanation": "Prefijo des- + lexema orden + sufijo derivativo -ad- + flexivos -o y -s.",
        },
        {
            "word": "jugadoras",
            "difficulty": 2,
            "word_type": "Sustantivo",
            "lexeme": "jug",
            "accepted_lexemes": ["jug", "juga"],
            "morphemes": ["ador", "a", "s"],
            "morpheme_types": [
                "Sufijo derivativo",
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo derivado femenino plural",
            "explanation": "Lexema jug + derivativo -ador- + genero -a + numero -s.",
        },
        {
            "word": "cantabais",
            "difficulty": 2,
            "word_type": "Verbo",
            "lexeme": "cant",
            "accepted_lexemes": ["cant", "canta"],
            "morphemes": ["aba", "is"],
            "morpheme_types": [
                "Morfema flexivo verbal (tiempo/modo/aspecto)",
                "Morfema flexivo verbal (persona/numero)",
            ],
            "analysis_type": "Verbo en segunda persona plural",
            "explanation": "Lexema cant + marca verbal -aba + marca de persona/numero -is.",
        },
        {
            "word": "imposible",
            "difficulty": 2,
            "word_type": "Adjetivo",
            "lexeme": "posibl",
            "accepted_lexemes": ["posibl", "posible"],
            "morphemes": ["im"],
            "morpheme_types": ["Prefijo derivativo"],
            "analysis_type": "Adjetivo con prefijacion",
            "explanation": "Prefijo derivativo im- + lexema posibl.",
        },
    ],
    3: [
        {
            "word": "inmovilizaciones",
            "difficulty": 3,
            "word_type": "Sustantivo",
            "lexeme": "movil",
            "accepted_lexemes": ["movil"],
            "morphemes": ["in", "iza", "cion", "es"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Sufijo derivativo",
                "Sufijo derivativo",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo complejo con prefijacion y doble sufijacion",
            "explanation": "in- + movil + -iza- + -cion + -es (plural).",
        },
        {
            "word": "deshumanizadoras",
            "difficulty": 3,
            "word_type": "Adjetivo",
            "lexeme": "human",
            "accepted_lexemes": ["human"],
            "morphemes": ["des", "iza", "dor", "a", "s"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Sufijo derivativo",
                "Sufijo derivativo",
                "Morfema flexivo nominal (genero)",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Adjetivo derivado complejo",
            "explanation": "des- + human + -iza- + -dor- + -a + -s.",
        },
        {
            "word": "reconstruiriamos",
            "difficulty": 3,
            "word_type": "Verbo",
            "lexeme": "constru",
            "accepted_lexemes": ["constru", "construir"],
            "morphemes": ["re", "iria", "mos"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Morfema flexivo verbal (tiempo/modo/aspecto)",
                "Morfema flexivo verbal (persona/numero)",
            ],
            "analysis_type": "Verbo prefijado con flexion compuesta",
            "explanation": "Prefijo re- + lexema constru + marca verbal -iria + persona/numero -mos.",
        },
        {
            "word": "anticonstitucionales",
            "difficulty": 3,
            "word_type": "Adjetivo",
            "lexeme": "constitucion",
            "accepted_lexemes": ["constitucion", "constitucional"],
            "morphemes": ["anti", "al", "es"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Sufijo derivativo",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Adjetivo prefijado plural",
            "explanation": "anti- + lexema constitucion + sufijo -al + plural -es.",
        },
        {
            "word": "precalentamientos",
            "difficulty": 3,
            "word_type": "Sustantivo",
            "lexeme": "calent",
            "accepted_lexemes": ["calent", "calentar"],
            "morphemes": ["pre", "amiento", "s"],
            "morpheme_types": [
                "Prefijo derivativo",
                "Sufijo derivativo",
                "Morfema flexivo nominal (numero)",
            ],
            "analysis_type": "Sustantivo derivado con prefijo y sufijo",
            "explanation": "pre- + lexema calent + derivativo -amiento + plural -s.",
        },
    ],
}


def morfo_get_secret_or_env(secret_key: str, env_key: str) -> str:
    try:
        value = st.secrets.get(secret_key, "")
        if value:
            return str(value)
    except Exception:
        pass
    return os.getenv(env_key, "")


def morfo_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_json(text: str) -> Any:
    fenced = re.search(r"```json\s*(.*?)```", text, re.IGNORECASE | re.DOTALL)
    candidate = fenced.group(1).strip() if fenced else text.strip()
    if not (candidate.startswith("{") or candidate.startswith("[")):
        object_match = re.search(r"\{[\s\S]*\}", candidate)
        array_match = re.search(r"\[[\s\S]*\]", candidate)
        if object_match and array_match:
            candidate = object_match.group(0) if object_match.start() < array_match.start() else array_match.group(0)
        elif object_match:
            candidate = object_match.group(0)
        elif array_match:
            candidate = array_match.group(0)
    return json.loads(candidate)


def normalize_text_token(value: str) -> str:
    lowered = value.strip().lower()
    lowered = lowered.replace("-", "").replace("_", "")
    lowered = re.sub(r"\s+", "", lowered)
    return lowered


def normalize_piece_token(value: str) -> str:
    lowered = value.strip().lower()
    lowered = lowered.replace("-", "").replace("_", "")
    lowered = re.sub(r"\s+", "", lowered)
    return lowered


def normalize_morpheme_type_label(value: str) -> str:
    key = value.strip().lower()
    mapping = {
        "prefijo": "Prefijo derivativo",
        "prefijo derivativo": "Prefijo derivativo",
        "interfijo": "Interfijo",
        "sufijo": "Sufijo derivativo",
        "sufijo derivativo": "Sufijo derivativo",
        "genero": "Morfema flexivo nominal (genero)",
        "morfema de genero": "Morfema flexivo nominal (genero)",
        "morfema flexivo nominal (genero)": "Morfema flexivo nominal (genero)",
        "numero": "Morfema flexivo nominal (numero)",
        "morfema de numero": "Morfema flexivo nominal (numero)",
        "morfema flexivo nominal (numero)": "Morfema flexivo nominal (numero)",
        "morfema verbal tma": "Morfema flexivo verbal (tiempo/modo/aspecto)",
        "tiempo/modo/aspecto": "Morfema flexivo verbal (tiempo/modo/aspecto)",
        "morfema flexivo verbal (tiempo/modo/aspecto)": "Morfema flexivo verbal (tiempo/modo/aspecto)",
        "persona/numero": "Morfema flexivo verbal (persona/numero)",
        "morfema flexivo verbal (persona/numero)": "Morfema flexivo verbal (persona/numero)",
    }
    return mapping.get(key, value)


def to_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [piece.strip() for piece in re.split(r"[,\n;|]+", value) if piece.strip()]
    return []


def unique_items(items: List[str]) -> List[str]:
    unique: List[str] = []
    seen = set()
    for item in items:
        key = item.strip()
        if not key:
            continue
        lowered = key.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique.append(key)
    return unique


def json_list(values: List[str]) -> str:
    return json.dumps(values, ensure_ascii=False)


def parse_json_list(payload: str) -> List[str]:
    try:
        raw = json.loads(payload)
        if isinstance(raw, list):
            return [str(item).strip() for item in raw if str(item).strip()]
    except Exception:
        pass
    return []


def is_gemma_model_name(model_name: str) -> bool:
    return model_name.strip().lower().startswith("gemma")


def build_recheck_model_candidates(current_model: str) -> List[str]:
    preferred = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        current_model.strip(),
    ]
    seen = set()
    unique: List[str] = []
    for model in preferred:
        if not model:
            continue
        key = model.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(model)
    return unique


def run_model_prompt(
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    temperature: float = 0.25,
    expect_json: bool = False,
) -> str:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    if is_gemma_model_name(model_name):
        model = genai.GenerativeModel(model_name=model_name)
        payload = (
            "INSTRUCCIONES DE SISTEMA:\n"
            + system_prompt.strip()
            + "\n\nINSTRUCCIONES DE USUARIO:\n"
            + user_prompt
            + ("\n\nDevuelve solo JSON valido." if expect_json else "")
        )
        generation_config: Dict[str, Any] = {"temperature": temperature}
    else:
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_prompt,
        )
        payload = user_prompt
        generation_config = {"temperature": temperature}
        if expect_json:
            generation_config["response_mime_type"] = "application/json"

    response = model.generate_content(payload, generation_config=generation_config)
    return str(response.text or "").strip()


def init_morfologia_db() -> None:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                word TEXT NOT NULL,
                expected_word_type TEXT NOT NULL,
                expected_lexeme TEXT NOT NULL,
                expected_lexemes_json TEXT NOT NULL,
                expected_morphemes_json TEXT NOT NULL,
                expected_morpheme_types_json TEXT NOT NULL,
                expected_primary_morpheme_type TEXT NOT NULL,
                guess_word_type TEXT NOT NULL,
                guess_lexeme TEXT NOT NULL,
                guess_morphemes_json TEXT NOT NULL,
                guess_morpheme_types_json TEXT NOT NULL,
                word_type_ok INTEGER NOT NULL,
                lexeme_ok INTEGER NOT NULL,
                morphemes_ok INTEGER NOT NULL,
                morpheme_types_ok INTEGER NOT NULL,
                analysis_type TEXT NOT NULL,
                explanation TEXT NOT NULL,
                mode TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS profile_stats (
                profile_id TEXT PRIMARY KEY,
                updated_at TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )


def empty_axis(labels: List[str]) -> Dict[str, Dict[str, int]]:
    return {label: {"ok": 0, "fail": 0} for label in labels}


def default_stats_payload() -> Dict[str, Any]:
    return {
        "total_attempts": 0,
        "word_type_stats": empty_axis(MORFO_WORD_TYPES),
        "morpheme_type_stats": empty_axis(MORFO_MORPHEME_TYPES),
        "difficulty_stats": {"1": {"ok": 0, "fail": 0}, "2": {"ok": 0, "fail": 0}, "3": {"ok": 0, "fail": 0}},
        "pair_stats": {},
    }


def load_profile_stats(profile_id: str) -> Dict[str, Any]:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        row = conn.execute(
            "SELECT payload FROM profile_stats WHERE profile_id = ?",
            (profile_id,),
        ).fetchone()
        if not row:
            payload = default_stats_payload()
            conn.execute(
                "INSERT INTO profile_stats (profile_id, updated_at, payload) VALUES (?, ?, ?)",
                (profile_id, morfo_now_iso(), json.dumps(payload, ensure_ascii=False)),
            )
            return payload

    try:
        payload = json.loads(row[0])
        defaults = default_stats_payload()
        payload.setdefault("total_attempts", 0)
        payload.setdefault("word_type_stats", defaults["word_type_stats"])
        payload.setdefault("morpheme_type_stats", defaults["morpheme_type_stats"])
        payload.setdefault("difficulty_stats", defaults["difficulty_stats"])
        payload.setdefault("pair_stats", {})
        return payload
    except Exception:
        return default_stats_payload()


def save_profile_stats(profile_id: str, payload: Dict[str, Any]) -> None:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO profile_stats (profile_id, updated_at, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET
              updated_at = excluded.updated_at,
              payload = excluded.payload
            """,
            (profile_id, morfo_now_iso(), json.dumps(payload, ensure_ascii=False)),
        )


def update_profile_stats_from_attempt(record: Dict[str, Any]) -> None:
    payload = load_profile_stats(record["profile_id"])
    payload["total_attempts"] = int(payload.get("total_attempts", 0)) + 1

    expected_word_type = str(record["expected_word_type"])
    expected_morpheme_types = unique_items([normalize_morpheme_type_label(value) for value in record["expected_morpheme_types"]])
    difficulty_key = str(record["difficulty"])

    word_type_ok = bool(record["word_type_ok"])
    morpheme_types_ok = bool(record["morpheme_types_ok"])
    overall_ok = bool(record["overall_ok"])

    payload["word_type_stats"].setdefault(expected_word_type, {"ok": 0, "fail": 0})
    payload["word_type_stats"][expected_word_type]["ok" if word_type_ok else "fail"] += 1

    for morpheme_type in expected_morpheme_types:
        payload["morpheme_type_stats"].setdefault(morpheme_type, {"ok": 0, "fail": 0})
        payload["morpheme_type_stats"][morpheme_type]["ok" if morpheme_types_ok else "fail"] += 1

        pair_key = f"{expected_word_type} || {morpheme_type}"
        pair_stats = payload["pair_stats"].setdefault(pair_key, {"ok": 0, "fail": 0})
        pair_stats["ok" if (word_type_ok and morpheme_types_ok) else "fail"] += 1

    payload["difficulty_stats"].setdefault(difficulty_key, {"ok": 0, "fail": 0})
    payload["difficulty_stats"][difficulty_key]["ok" if overall_ok else "fail"] += 1

    save_profile_stats(record["profile_id"], payload)


def axis_summary(axis: Dict[str, Dict[str, int]], top_n: int = 3, min_attempts: int = 2) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    rows: List[Dict[str, Any]] = []
    for label, stats in axis.items():
        ok = int(stats.get("ok", 0))
        fail = int(stats.get("fail", 0))
        attempts = ok + fail
        if attempts == 0:
            continue
        fail_rate = fail / attempts
        rows.append({"label": label, "ok": ok, "fail": fail, "attempts": attempts, "fail_rate": fail_rate})

    weak = [row for row in rows if row["attempts"] >= min_attempts]
    weak.sort(key=lambda row: (row["fail_rate"], row["fail"]), reverse=True)
    strong = [row for row in rows if row["attempts"] >= max(3, min_attempts)]
    strong.sort(key=lambda row: (row["fail_rate"], -row["attempts"]))
    return weak[:top_n], strong[:top_n]


def axis_overview(axis: Dict[str, Dict[str, int]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for label, stats in axis.items():
        ok = int(stats.get("ok", 0))
        fail = int(stats.get("fail", 0))
        attempts = ok + fail
        if attempts == 0:
            continue
        rows.append(
            {
                "label": label,
                "ok": ok,
                "fail": fail,
                "attempts": attempts,
                "fail_rate": fail / attempts,
            }
        )
    rows.sort(key=lambda row: (row["fail_rate"], row["attempts"]), reverse=True)
    return rows


def pair_summary(pair_stats: Dict[str, Dict[str, int]], top_n: int = 4, min_attempts: int = 2) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for pair_label, stats in pair_stats.items():
        ok = int(stats.get("ok", 0))
        fail = int(stats.get("fail", 0))
        attempts = ok + fail
        if attempts < min_attempts:
            continue
        rows.append(
            {
                "pair": pair_label,
                "ok": ok,
                "fail": fail,
                "attempts": attempts,
                "fail_rate": fail / attempts,
            }
        )
    rows.sort(key=lambda row: (row["fail_rate"], row["fail"]), reverse=True)
    return rows[:top_n]


def learning_profile(profile_id: str) -> Dict[str, Any]:
    stats = load_profile_stats(profile_id)
    weak_word_types, strong_word_types = axis_summary(stats["word_type_stats"])
    weak_morpheme_types, strong_morpheme_types = axis_summary(stats["morpheme_type_stats"])
    word_type_overview = axis_overview(stats["word_type_stats"])
    morpheme_type_overview = axis_overview(stats["morpheme_type_stats"])
    weak_pairs = pair_summary(stats.get("pair_stats", {}))
    return {
        "total_attempts": int(stats.get("total_attempts", 0)),
        "weak_word_types": weak_word_types,
        "strong_word_types": strong_word_types,
        "weak_morpheme_types": weak_morpheme_types,
        "strong_morpheme_types": strong_morpheme_types,
        "word_type_overview": word_type_overview,
        "morpheme_type_overview": morpheme_type_overview,
        "weak_pairs": weak_pairs,
    }


def fetch_recent_words(profile_id: str, limit_size: int = 12) -> List[str]:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT word
            FROM attempts
            WHERE profile_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (profile_id, limit_size * 2),
        ).fetchall()

    unique: List[str] = []
    seen = set()
    for row in rows:
        word = str(row[0]).strip()
        key = word.lower()
        if not word or key in seen:
            continue
        seen.add(key)
        unique.append(word)
        if len(unique) >= limit_size:
            break
    return unique


def fetch_recent_labels(profile_id: str, limit_size: int = 10) -> List[Dict[str, str]]:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT expected_word_type, expected_primary_morpheme_type
            FROM attempts
            WHERE profile_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (profile_id, limit_size),
        ).fetchall()
    return [
        {
            "word_type": str(row["expected_word_type"]),
            "morpheme_type": str(row["expected_primary_morpheme_type"]),
        }
        for row in rows
    ]


def choose_personalized_target(
    profile: Dict[str, Any],
    focus_word_types: List[str],
    personalized: bool,
    force_targeted: Optional[bool] = None,
    mix_label: str = "40% debilidades / 60% normal",
) -> Dict[str, Any]:
    if focus_word_types:
        return {
            "mode": "foco_usuario",
            "targeted": True,
            "focus_word_types": focus_word_types,
            "target_word_type": random.choice(focus_word_types),
            "target_morpheme_type": "",
            "ratio_hint": "100% foco",
        }

    if not personalized:
        return {
            "mode": "normal",
            "targeted": False,
            "focus_word_types": [],
            "target_word_type": "",
            "target_morpheme_type": "",
            "ratio_hint": "0% personalizado",
        }

    weak_word_types = profile["weak_word_types"]
    weak_morpheme_types = profile["weak_morpheme_types"]
    weak_pairs = profile.get("weak_pairs", [])
    has_weakness = bool(weak_word_types or weak_morpheme_types)
    targeted = has_weakness and (force_targeted if force_targeted is not None else random.random() < 0.4)

    if not targeted:
        return {
            "mode": "personalizado_mixto",
            "targeted": False,
            "focus_word_types": [],
            "target_word_type": "",
            "target_morpheme_type": "",
            "ratio_hint": mix_label,
        }

    target_word_type = ""
    target_morpheme_type = ""
    if weak_pairs and random.random() < 0.65:
        pair_weights = [max(0.05, row["fail_rate"]) for row in weak_pairs]
        picked = random.choices(weak_pairs, weights=pair_weights, k=1)[0]["pair"]
        parts = picked.split(" || ", maxsplit=1)
        target_word_type = parts[0].strip()
        if len(parts) > 1:
            target_morpheme_type = parts[1].strip()
    else:
        if weak_word_types:
            labels = [row["label"] for row in weak_word_types]
            weights = [max(0.05, row["fail_rate"]) for row in weak_word_types]
            target_word_type = random.choices(labels, weights=weights, k=1)[0]
        if weak_morpheme_types:
            labels = [row["label"] for row in weak_morpheme_types]
            weights = [max(0.05, row["fail_rate"]) for row in weak_morpheme_types]
            target_morpheme_type = random.choices(labels, weights=weights, k=1)[0]

    return {
        "mode": "personalizado_objetivo",
        "targeted": True,
        "focus_word_types": [target_word_type] if target_word_type else [],
        "target_word_type": target_word_type,
        "target_morpheme_type": target_morpheme_type,
        "ratio_hint": mix_label,
    }


def is_novel_word(word: str, recent_words: List[str]) -> bool:
    normalized = word.strip().lower()
    for old in recent_words:
        if normalized == old.strip().lower():
            return False
    return True


def choose_sample(
    difficulty: int,
    focus_word_types: List[str],
    weakness_word_types: List[str],
    target_morpheme_type: str,
    recent_words: List[str],
) -> Dict[str, Any]:
    pool = MORFO_SAMPLE_BANK[difficulty]
    target_word_types = focus_word_types or weakness_word_types
    if target_word_types:
        filtered = [item for item in pool if item["word_type"] in target_word_types]
        if filtered:
            pool = filtered

    if target_morpheme_type:
        filtered = [item for item in pool if target_morpheme_type in item["morpheme_types"]]
        if filtered:
            pool = filtered

    novel_pool = [item for item in pool if is_novel_word(item["word"], recent_words)]
    if novel_pool:
        pool = novel_pool
    return random.choice(pool)


def build_generation_prompt(
    difficulty: int,
    strategies: List[Dict[str, Any]],
    profile: Dict[str, Any],
    recent_words: List[str],
    rejected_words: List[str],
    avoid_word_types: List[str],
    avoid_morpheme_types: List[str],
    batch_size: int,
) -> str:
    payload = {
        "task": "Generar un lote de palabras para practicar morfologia",
        "difficulty": difficulty,
        "batch_size": batch_size,
        "generation_strategy": {
            "schedule": [
                {
                    "slot": idx + 1,
                    "mode": strategy["mode"],
                    "targeted": strategy["targeted"],
                    "target_word_type": strategy["target_word_type"] or None,
                    "target_morpheme_type": strategy["target_morpheme_type"] or None,
                    "focus_word_types": strategy["focus_word_types"],
                }
                for idx, strategy in enumerate(strategies[:batch_size])
            ],
            "ratio_hint": strategies[0]["ratio_hint"] if strategies else "sin ratio",
        },
        "learning_profile": profile,
        "allowed_word_types": MORFO_WORD_TYPES,
        "allowed_morpheme_types": MORFO_MORPHEME_TYPES,
        "anti_repetition": {
            "avoid_recent_words": recent_words,
            "avoid_rejected_words": rejected_words,
            "avoid_word_types_temporarily": avoid_word_types,
            "avoid_morpheme_types_temporarily": avoid_morpheme_types,
            "must_be_lexically_distinct": True,
            "do_not_repeat_same_word_family": True,
        },
        "batch_diversity_rules": {
            "different_lexemes_per_item": True,
            "mix_derivation_and_flexion": True,
            "avoid_only_single_letter_changes": True,
        },
        "diversity_noise": {
            "seed": random.randint(100000, 999999),
            "register_hint": random.choice(["academico", "general", "escolar"]),
        },
        "constraints": {
            "must_return_exact_count": batch_size,
            "no_internal_duplicates": True,
            "difficulty_profile": {
                "1": "palabra transparente y analisis directo",
                "2": "palabra con combinacion de derivacion/flexion",
                "3": "palabra compleja con varios morfemas",
            },
        },
        "output_schema": {
            "items": [
                {
                    "word": "string",
                    "difficulty": "1|2|3",
                    "word_type": "one_of_allowed_word_types",
                    "lexeme": "string",
                    "accepted_lexemes": ["one_or_more_variants"],
                    "morphemes": ["one_or_more_items"],
                    "morpheme_types": ["one_or_more_allowed_morpheme_types"],
                    "analysis_type": "string",
                    "explanation": "string_short",
                }
            ],
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def normalize_generated_item(parsed: Dict[str, Any], fallback_difficulty: int) -> Dict[str, Any]:
    morphemes = unique_items(to_list(parsed.get("morphemes", [])))
    morpheme_types = unique_items(
        [
            normalize_morpheme_type_label(str(item).strip())
            for item in to_list(parsed.get("morpheme_types", []))
            if str(item).strip()
        ]
    )
    normalized = {
        "word": str(parsed.get("word", "")).strip(),
        "difficulty": int(parsed.get("difficulty", fallback_difficulty)),
        "word_type": str(parsed.get("word_type", "")).strip(),
        "lexeme": str(parsed.get("lexeme", "")).strip(),
        "accepted_lexemes": unique_items(to_list(parsed.get("accepted_lexemes", []))),
        "morphemes": morphemes,
        "morpheme_types": morpheme_types,
        "analysis_type": str(parsed.get("analysis_type", "")).strip(),
        "explanation": str(parsed.get("explanation", "")).strip(),
    }
    if not normalized["accepted_lexemes"] and normalized["lexeme"]:
        normalized["accepted_lexemes"] = [normalized["lexeme"]]
    if len(normalized["morpheme_types"]) > len(normalized["morphemes"]):
        normalized["morpheme_types"] = normalized["morpheme_types"][: len(normalized["morphemes"])]
    if len(normalized["morphemes"]) > len(normalized["morpheme_types"]) and normalized["morpheme_types"]:
        normalized["morphemes"] = normalized["morphemes"][: len(normalized["morpheme_types"])]
    return normalized


def extract_candidate_items(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            return [item for item in payload["items"] if isinstance(item, dict)]
        if all(key in payload for key in ["word", "word_type", "lexeme"]):
            return [payload]
        return []
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def is_valid_generated_item(
    item: Dict[str, Any],
    strategy: Dict[str, Any],
    avoid_word_types: List[str],
    avoid_morpheme_types: List[str],
    seen_words: List[str],
) -> bool:
    if not item["word"] or not item["lexeme"] or not item["analysis_type"] or not item["explanation"]:
        return False
    if item["word_type"] not in MORFO_WORD_TYPES:
        return False
    if not item["morphemes"] or not item["morpheme_types"]:
        return False
    if len(item["morphemes"]) != len(item["morpheme_types"]):
        return False
    if any(morpheme_type not in MORFO_MORPHEME_TYPES for morpheme_type in item["morpheme_types"]):
        return False

    if strategy["targeted"] and strategy["target_word_type"] and item["word_type"] != strategy["target_word_type"]:
        return False
    if strategy["targeted"] and strategy["target_morpheme_type"]:
        if strategy["target_morpheme_type"] not in item["morpheme_types"]:
            return False

    if strategy["mode"] in {"normal", "personalizado_mixto"}:
        if avoid_word_types and item["word_type"] in avoid_word_types:
            return False
        if avoid_morpheme_types and any(morpheme_type in avoid_morpheme_types for morpheme_type in item["morpheme_types"]):
            return False

    if not is_novel_word(item["word"], seen_words):
        return False
    return True


def build_fallback_batch(
    difficulty: int,
    strategies: List[Dict[str, Any]],
    recent_words: List[str],
    batch_size: int,
) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    memory = list(recent_words)
    for strategy in strategies[:batch_size]:
        candidate = choose_sample(
            difficulty=difficulty,
            focus_word_types=strategy["focus_word_types"],
            weakness_word_types=[strategy["target_word_type"]] if strategy["target_word_type"] else [],
            target_morpheme_type=strategy["target_morpheme_type"],
            recent_words=memory,
        )
        prepared = dict(candidate)
        prepared["mode"] = strategy["mode"]
        items.append(prepared)
        memory.append(prepared["word"])
    return items


def generate_batch_with_llm(
    profile_id: str,
    difficulty: int,
    strategies: List[Dict[str, Any]],
    profile: Dict[str, Any],
    model_name: str,
) -> List[Dict[str, Any]]:
    batch_size = max(1, len(strategies))
    is_gemma_model = is_gemma_model_name(model_name)
    recent_words = fetch_recent_words(profile_id, limit_size=14)
    recent_labels = fetch_recent_labels(profile_id, limit_size=10)
    recent_word_types = [row["word_type"] for row in recent_labels if row["word_type"]]
    recent_morpheme_types = [row["morpheme_type"] for row in recent_labels if row["morpheme_type"]]

    avoid_word_types: List[str] = []
    avoid_morpheme_types: List[str] = []
    normal_like = any(strategy["mode"] in {"normal", "personalizado_mixto"} for strategy in strategies)
    if normal_like:
        if len(recent_word_types) >= 2 and recent_word_types[0] == recent_word_types[1]:
            avoid_word_types.append(recent_word_types[0])
        if len(recent_morpheme_types) >= 3 and len(set(recent_morpheme_types[:3])) == 1:
            avoid_morpheme_types.append(recent_morpheme_types[0])

    api_key = morfo_get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    fallback_batch = build_fallback_batch(
        difficulty=difficulty,
        strategies=strategies,
        recent_words=recent_words,
        batch_size=batch_size,
    )
    if not api_key:
        return fallback_batch

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        if is_gemma_model:
            model = genai.GenerativeModel(model_name=model_name)
        else:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=MORFO_SYSTEM_PROMPT,
            )
        rejected_words: List[str] = []
        accepted: List[Dict[str, Any]] = []
        accepted_words: List[str] = []

        for temperature in [0.6, 0.78, 0.9]:
            prompt = build_generation_prompt(
                difficulty=difficulty,
                strategies=strategies,
                profile=profile,
                recent_words=recent_words,
                rejected_words=rejected_words,
                avoid_word_types=avoid_word_types,
                avoid_morpheme_types=avoid_morpheme_types,
                batch_size=batch_size,
            )
            if is_gemma_model:
                request_payload = (
                    "INSTRUCCIONES DE SISTEMA:\n"
                    + MORFO_SYSTEM_PROMPT.strip()
                    + "\n\nINSTRUCCIONES DE USUARIO:\n"
                    + prompt
                    + "\n\nDevuelve solo JSON valido."
                )
            else:
                request_payload = prompt

            generation_config: Dict[str, Any] = {"temperature": temperature}
            if not is_gemma_model:
                generation_config["response_mime_type"] = "application/json"

            response = model.generate_content(
                request_payload,
                generation_config=generation_config,
            )
            parsed = extract_json(response.text)
            candidates = extract_candidate_items(parsed)
            if not candidates:
                continue

            for idx, candidate in enumerate(candidates):
                if len(accepted) >= batch_size:
                    break
                strategy = strategies[min(idx, len(strategies) - 1)]
                normalized = normalize_generated_item(candidate, fallback_difficulty=difficulty)
                seen_words = recent_words + rejected_words + accepted_words
                if not is_valid_generated_item(normalized, strategy, avoid_word_types, avoid_morpheme_types, seen_words):
                    rejected_words.append(normalized["word"])
                    continue

                normalized["mode"] = strategy["mode"]
                accepted.append(normalized)
                accepted_words.append(normalized["word"])

            if len(accepted) >= batch_size:
                return accepted[:batch_size]
    except Exception as error:
        st.warning(f"LLM no disponible ahora. Uso modo local. Detalle: {error}")

    completed = list(accepted) if "accepted" in locals() else []
    memory = recent_words + [item["word"] for item in completed]
    for fallback in fallback_batch:
        if len(completed) >= batch_size:
            break
        if is_novel_word(fallback["word"], memory):
            completed.append(fallback)
            memory.append(fallback["word"])

    while len(completed) < batch_size:
        strategy = strategies[len(completed) % len(strategies)]
        filler = choose_sample(
            difficulty=difficulty,
            focus_word_types=strategy["focus_word_types"],
            weakness_word_types=[strategy["target_word_type"]] if strategy["target_word_type"] else [],
            target_morpheme_type=strategy["target_morpheme_type"],
            recent_words=[],
        )
        prepared = dict(filler)
        prepared["mode"] = strategy["mode"]
        completed.append(prepared)
    return completed[:batch_size]


def save_attempt(record: Dict[str, Any]) -> None:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO attempts (
                id, profile_id, created_at, difficulty, word, expected_word_type, expected_lexeme,
                expected_lexemes_json, expected_morphemes_json, expected_morpheme_types_json, expected_primary_morpheme_type,
                guess_word_type, guess_lexeme, guess_morphemes_json, guess_morpheme_types_json,
                word_type_ok, lexeme_ok, morphemes_ok, morpheme_types_ok, analysis_type, explanation, mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record["profile_id"],
                record["created_at"],
                record["difficulty"],
                record["word"],
                record["expected_word_type"],
                record["expected_lexeme"],
                json_list(record["expected_lexemes"]),
                json_list(record["expected_morphemes"]),
                json_list(record["expected_morpheme_types"]),
                record["expected_primary_morpheme_type"],
                record["guess_word_type"],
                record["guess_lexeme"],
                json_list(record["guess_morphemes"]),
                json_list(record["guess_morpheme_types"]),
                int(record["word_type_ok"]),
                int(record["lexeme_ok"]),
                int(record["morphemes_ok"]),
                int(record["morpheme_types_ok"]),
                record["analysis_type"],
                record["explanation"],
                record["mode"],
            ),
        )
    update_profile_stats_from_attempt(record)


def fetch_attempts(profile_id: str, only_errors: bool = False) -> List[Dict[str, Any]]:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        sql = "SELECT * FROM attempts WHERE profile_id = ?"
        params: List[Any] = [profile_id]
        if only_errors:
            sql += " AND (word_type_ok = 0 OR lexeme_ok = 0 OR morphemes_ok = 0 OR morpheme_types_ok = 0)"
        sql += " ORDER BY created_at DESC LIMIT 500"
        rows = conn.execute(sql, params).fetchall()

    prepared_rows: List[Dict[str, Any]] = []
    for row in rows:
        entry = dict(row)
        entry["expected_lexemes"] = ", ".join(parse_json_list(entry.pop("expected_lexemes_json", "[]")))
        entry["expected_morphemes"] = ", ".join(parse_json_list(entry.pop("expected_morphemes_json", "[]")))
        entry["expected_morpheme_types"] = ", ".join(parse_json_list(entry.pop("expected_morpheme_types_json", "[]")))
        entry["guess_morphemes"] = ", ".join(parse_json_list(entry.pop("guess_morphemes_json", "[]")))
        entry["guess_morpheme_types"] = ", ".join(parse_json_list(entry.pop("guess_morpheme_types_json", "[]")))
        entry["overall_ok"] = int(
            entry.get("word_type_ok", 0) == 1
            and entry.get("lexeme_ok", 0) == 1
            and entry.get("morphemes_ok", 0) == 1
            and entry.get("morpheme_types_ok", 0) == 1
        )
        prepared_rows.append(entry)
    return prepared_rows


def reset_attempts(profile_id: str) -> None:
    with sqlite3.connect(MORFO_DB_PATH) as conn:
        conn.execute("DELETE FROM attempts WHERE profile_id = ?", (profile_id,))
        conn.execute("DELETE FROM profile_stats WHERE profile_id = ?", (profile_id,))


def ensure_morfologia_state() -> None:
    if "morf_profile_id" not in st.session_state:
        st.session_state.morf_profile_id = "alumno"
    if "morf_model_name" not in st.session_state:
        st.session_state.morf_model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    if "morf_current_item" not in st.session_state:
        st.session_state.morf_current_item = None
    if "morf_phrase_queue" not in st.session_state:
        st.session_state.morf_phrase_queue = []
    if "morf_checked_item_id" not in st.session_state:
        st.session_state.morf_checked_item_id = None
    if "morf_hide_history" not in st.session_state:
        st.session_state.morf_hide_history = False
    if "morf_mix_bucket" not in st.session_state:
        st.session_state.morf_mix_bucket = []
    if "morf_mix_target_weight" not in st.session_state:
        st.session_state.morf_mix_target_weight = 40
    if "morf_mix_normal_weight" not in st.session_state:
        st.session_state.morf_mix_normal_weight = 60
    if "morf_mix_signature" not in st.session_state:
        st.session_state.morf_mix_signature = (40, 60)
    if "morf_practice_difficulty" not in st.session_state:
        st.session_state.morf_practice_difficulty = 2
    if "morf_practice_personalized" not in st.session_state:
        st.session_state.morf_practice_personalized = True
    if "morf_practice_focus_word_types" not in st.session_state:
        st.session_state.morf_practice_focus_word_types = []
    if "morf_recheck_results" not in st.session_state:
        st.session_state.morf_recheck_results = {}
    if "morf_item_question_answers" not in st.session_state:
        st.session_state.morf_item_question_answers = {}
    if "morf_item_eval_results" not in st.session_state:
        st.session_state.morf_item_eval_results = {}


def build_mix_bucket(target_weight: int, normal_weight: int) -> List[bool]:
    targeted = max(0, int(target_weight))
    normal = max(0, int(normal_weight))

    if targeted == 0 and normal == 0:
        targeted, normal = 4, 6
    if targeted == 0:
        return [False] * max(1, min(normal, 20))
    if normal == 0:
        return [True] * max(1, min(targeted, 20))

    divisor = math.gcd(targeted, normal)
    targeted_count = max(1, targeted // divisor)
    normal_count = max(1, normal // divisor)
    base_size = targeted_count + normal_count
    if base_size < 10:
        multiplier = max(1, 10 // base_size)
        targeted_count *= multiplier
        normal_count *= multiplier

    bucket = [True] * targeted_count + [False] * normal_count
    random.shuffle(bucket)
    return bucket


def pop_mix_targeted(target_weight: int, normal_weight: int) -> bool:
    bucket = st.session_state.morf_mix_bucket
    if not bucket:
        bucket = build_mix_bucket(target_weight, normal_weight)
        st.session_state.morf_mix_bucket = bucket
    return bool(st.session_state.morf_mix_bucket.pop())


def parse_guess_list(raw_text: str) -> List[str]:
    return unique_items([piece.strip() for piece in re.split(r"[,\n;|]+", raw_text) if piece.strip()])


def recheck_generated_item(item: Dict[str, Any], current_model: str) -> Dict[str, Any]:
    api_key = morfo_get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "API key no configurada. No se puede ejecutar recheck.",
        }

    prompt_payload = {
        "word": item["word"],
        "proposed_answer": {
            "word_type": item["word_type"],
            "lexeme": item["lexeme"],
            "accepted_lexemes": item.get("accepted_lexemes", [item["lexeme"]]),
            "morphemes": item["morphemes"],
            "morpheme_types": item["morpheme_types"],
            "analysis_type": item["analysis_type"],
            "explanation": item["explanation"],
        },
        "allowed_word_types": MORFO_WORD_TYPES,
        "allowed_morpheme_types": MORFO_MORPHEME_TYPES,
        "task": "Verificar si el analisis propuesto es correcto para la palabra.",
        "output_schema": {
            "is_correct": "boolean",
            "corrected_word_type": "one_of_allowed_word_types",
            "corrected_lexeme": "string",
            "corrected_morphemes": ["list_of_strings"],
            "corrected_morpheme_types": ["list_of_allowed_morpheme_types"],
            "issues": ["lista corta de problemas encontrados"],
            "correction_note": "explicacion breve",
        },
    }
    user_prompt = json.dumps(prompt_payload, ensure_ascii=False, indent=2)

    candidates = build_recheck_model_candidates(current_model)
    last_error = "No se pudo validar con ningun modelo."
    for candidate_model in candidates:
        try:
            raw = run_model_prompt(
                model_name=candidate_model,
                system_prompt=MORFO_RECHECK_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                api_key=api_key,
                temperature=0.15,
                expect_json=True,
            )
            parsed = extract_json(raw)
            if isinstance(parsed, list):
                parsed = parsed[0] if parsed else {}
            if not isinstance(parsed, dict):
                raise ValueError("Respuesta de recheck no valida.")

            corrected_word_type = str(parsed.get("corrected_word_type", item["word_type"])).strip()
            if corrected_word_type not in MORFO_WORD_TYPES:
                corrected_word_type = item["word_type"]

            corrected_lexeme = str(parsed.get("corrected_lexeme", item["lexeme"])).strip() or item["lexeme"]
            corrected_morphemes = unique_items(to_list(parsed.get("corrected_morphemes", item["morphemes"])))
            corrected_morpheme_types = unique_items(
                [
                    normalize_morpheme_type_label(str(value).strip())
                    for value in to_list(parsed.get("corrected_morpheme_types", item["morpheme_types"]))
                    if str(value).strip()
                ]
            )
            corrected_morpheme_types = [value for value in corrected_morpheme_types if value in MORFO_MORPHEME_TYPES]
            if not corrected_morpheme_types:
                corrected_morpheme_types = list(item["morpheme_types"])
            if len(corrected_morpheme_types) > len(corrected_morphemes):
                corrected_morpheme_types = corrected_morpheme_types[: len(corrected_morphemes)]
            if len(corrected_morphemes) > len(corrected_morpheme_types):
                corrected_morphemes = corrected_morphemes[: len(corrected_morpheme_types)]

            issues = [str(value).strip() for value in parsed.get("issues", []) if str(value).strip()]
            correction_note = str(parsed.get("correction_note", "")).strip()
            is_correct = bool(parsed.get("is_correct", False))

            return {
                "success": True,
                "model": candidate_model,
                "is_correct": is_correct,
                "corrected_word_type": corrected_word_type,
                "corrected_lexeme": corrected_lexeme,
                "corrected_morphemes": corrected_morphemes,
                "corrected_morpheme_types": corrected_morpheme_types,
                "issues": issues,
                "correction_note": correction_note,
            }
        except Exception as error:
            last_error = str(error)

    return {
        "success": False,
        "error": last_error,
    }


def ask_question_about_item(
    item: Dict[str, Any],
    question: str,
    current_model: str,
    recheck_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    api_key = morfo_get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "API key no configurada. No se puede responder la pregunta.",
        }

    context = {
        "word": item["word"],
        "initial_answer": {
            "word_type": item["word_type"],
            "lexeme": item["lexeme"],
            "morphemes": item["morphemes"],
            "morpheme_types": item["morpheme_types"],
            "analysis_type": item["analysis_type"],
            "explanation": item["explanation"],
        },
        "recheck": recheck_result or None,
        "user_question": question,
    }
    user_prompt = (
        "Responde la pregunta del usuario de forma clara y breve.\n"
        "Contexto:\n"
        + json.dumps(context, ensure_ascii=False, indent=2)
    )

    candidates = build_recheck_model_candidates(current_model)
    last_error = "No se pudo obtener respuesta."
    for candidate_model in candidates:
        try:
            answer = run_model_prompt(
                model_name=candidate_model,
                system_prompt=MORFO_QUESTION_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                api_key=api_key,
                temperature=0.35,
                expect_json=False,
            )
            if not answer:
                raise ValueError("Respuesta vacia del modelo.")
            return {
                "success": True,
                "model": candidate_model,
                "answer": answer,
            }
        except Exception as error:
            last_error = str(error)
    return {
        "success": False,
        "error": last_error,
    }


def render_morfologia_practice_page() -> None:
    st.title("Practica de Morfologia")
    st.caption("Generacion, analisis y correccion en una sola respuesta del modelo.")

    difficulty = st.select_slider("Dificultad", options=[1, 2, 3], key="morf_practice_difficulty")
    personalized = st.toggle("Modo personalizado", key="morf_practice_personalized")
    focus_word_types = st.multiselect("Foco (opcional)", MORFO_WORD_TYPES, key="morf_practice_focus_word_types")

    col_mix_1, col_mix_2 = st.columns(2)
    with col_mix_1:
        target_weight = int(
            st.number_input(
                "Peso debilidades",
                min_value=0,
                max_value=100,
                step=5,
                key="morf_mix_target_weight",
            )
        )
    with col_mix_2:
        normal_weight = int(
            st.number_input(
                "Peso normal",
                min_value=0,
                max_value=100,
                step=5,
                key="morf_mix_normal_weight",
            )
        )

    mix_signature = (target_weight, normal_weight)
    if mix_signature != st.session_state.morf_mix_signature:
        st.session_state.morf_mix_signature = mix_signature
        st.session_state.morf_mix_bucket = []

    effective_target_weight = target_weight
    effective_normal_weight = normal_weight
    if target_weight == 0 and normal_weight == 0:
        effective_target_weight, effective_normal_weight = 40, 60

    mix_total = effective_target_weight + effective_normal_weight
    target_pct = round(100 * effective_target_weight / mix_total, 1)
    normal_pct = round(100 * effective_normal_weight / mix_total, 1)
    mix_label = f"{target_pct}% debilidades / {normal_pct}% normal"
    st.caption(f"Mezcla personalizada actual: {mix_label} (bucket barajado por ciclo)")

    profile = learning_profile(st.session_state.morf_profile_id)
    weak = {
        "word_types": [row["label"] for row in profile["weak_word_types"]],
        "morpheme_types": [row["label"] for row in profile["weak_morpheme_types"]],
    }
    if personalized and (weak["word_types"] or weak["morpheme_types"]):
        st.write(
            f"Refuerzo activo: tipos de palabra {', '.join(weak['word_types']) or '-'} | "
            f"tipos de morfema {', '.join(weak['morpheme_types']) or '-'}"
        )

    queue_count = len(st.session_state.morf_phrase_queue)
    button_label = "Siguiente palabra" if queue_count > 0 else "Generar lote"
    if st.button(button_label, use_container_width=True, key="morf_generate_btn"):
        if not st.session_state.morf_phrase_queue:
            batch_size = 3 if personalized else 10
            strategies: List[Dict[str, Any]] = []
            for _ in range(batch_size):
                force_targeted: Optional[bool] = None
                if personalized and not focus_word_types and (profile["weak_word_types"] or profile["weak_morpheme_types"]):
                    force_targeted = pop_mix_targeted(effective_target_weight, effective_normal_weight)
                strategies.append(
                    choose_personalized_target(
                        profile=profile,
                        focus_word_types=focus_word_types,
                        personalized=personalized,
                        force_targeted=force_targeted,
                        mix_label=mix_label,
                    )
                )

            batch_items = generate_batch_with_llm(
                profile_id=st.session_state.morf_profile_id,
                difficulty=difficulty,
                strategies=strategies,
                profile=profile,
                model_name=st.session_state.morf_model_name,
            )
            prepared_queue: List[Dict[str, Any]] = []
            for idx, queued_item in enumerate(batch_items):
                prepared = dict(queued_item)
                prepared["id"] = str(uuid.uuid4())
                prepared["mode"] = prepared.get("mode", strategies[min(idx, len(strategies) - 1)]["mode"])
                prepared_queue.append(prepared)

            if not personalized:
                random.shuffle(prepared_queue)
            st.session_state.morf_phrase_queue = prepared_queue

        if st.session_state.morf_phrase_queue:
            st.session_state.morf_current_item = st.session_state.morf_phrase_queue.pop(0)
            st.session_state.morf_checked_item_id = None

    item = st.session_state.morf_current_item
    if not item:
        st.info("Genera una palabra para empezar.")
        return

    st.subheader("Palabra")
    st.markdown(f"### {item['word']}")
    st.caption(f"Modo de generacion: {item.get('mode', 'normal')}")
    st.caption(f"Palabras restantes en cola: {len(st.session_state.morf_phrase_queue)}")

    guessed_word_type = st.radio(
        "Que tipo de palabra es?",
        MORFO_WORD_TYPES,
        index=0,
        key=f"morf_guess_word_type_{item['id']}",
    )
    guessed_lexeme = st.text_input(
        "Lexema",
        key=f"morf_guess_lexeme_{item['id']}",
        placeholder="Ej. cant / cas / just",
    )
    guessed_morphemes_text = st.text_input(
        "Morfemas (separados por coma)",
        key=f"morf_guess_morphemes_{item['id']}",
        placeholder="Ej. des, ad, o, s",
    )
    guessed_morpheme_types = st.multiselect(
        "Tipos de morfema detectados",
        MORFO_MORPHEME_TYPES,
        key=f"morf_guess_morpheme_types_{item['id']}",
    )

    if st.button("Comprobar respuesta", use_container_width=True, key=f"morf_check_btn_{item['id']}"):
        expected_lexemes = item.get("accepted_lexemes", [item["lexeme"]])
        normalized_expected_lexemes = {normalize_text_token(value) for value in expected_lexemes if normalize_text_token(value)}
        lexeme_ok = normalize_text_token(guessed_lexeme) in normalized_expected_lexemes

        expected_morphemes = item["morphemes"]
        guessed_morphemes = parse_guess_list(guessed_morphemes_text)
        expected_morpheme_set = {normalize_piece_token(value) for value in expected_morphemes if normalize_piece_token(value)}
        guessed_morpheme_set = {normalize_piece_token(value) for value in guessed_morphemes if normalize_piece_token(value)}
        morphemes_ok = bool(expected_morpheme_set) and expected_morpheme_set == guessed_morpheme_set

        expected_types = unique_items([normalize_morpheme_type_label(value) for value in item["morpheme_types"]])
        guessed_types = unique_items([normalize_morpheme_type_label(value) for value in guessed_morpheme_types])
        expected_type_set = {value for value in expected_types if value in MORFO_MORPHEME_TYPES}
        guessed_type_set = {value for value in guessed_types if value in MORFO_MORPHEME_TYPES}
        morpheme_types_ok = bool(expected_type_set) and expected_type_set == guessed_type_set

        word_type_ok = guessed_word_type == item["word_type"]
        overall_ok = word_type_ok and lexeme_ok and morphemes_ok and morpheme_types_ok

        st.session_state.morf_item_eval_results[item["id"]] = {
            "guess_word_type": guessed_word_type,
            "guess_lexeme": guessed_lexeme,
            "guess_morphemes": guessed_morphemes,
            "guess_morpheme_types": guessed_types,
            "word_type_ok": word_type_ok,
            "lexeme_ok": lexeme_ok,
            "morphemes_ok": morphemes_ok,
            "morpheme_types_ok": morpheme_types_ok,
            "overall_ok": overall_ok,
        }

        if st.session_state.morf_checked_item_id != item["id"]:
            save_attempt(
                {
                    "id": item["id"],
                    "profile_id": st.session_state.morf_profile_id,
                    "created_at": morfo_now_iso(),
                    "difficulty": int(item["difficulty"]),
                    "word": item["word"],
                    "expected_word_type": item["word_type"],
                    "expected_lexeme": item["lexeme"],
                    "expected_lexemes": item.get("accepted_lexemes", [item["lexeme"]]),
                    "expected_morphemes": item["morphemes"],
                    "expected_morpheme_types": item["morpheme_types"],
                    "expected_primary_morpheme_type": item["morpheme_types"][0] if item["morpheme_types"] else "",
                    "guess_word_type": guessed_word_type,
                    "guess_lexeme": guessed_lexeme.strip(),
                    "guess_morphemes": guessed_morphemes,
                    "guess_morpheme_types": guessed_types,
                    "word_type_ok": word_type_ok,
                    "lexeme_ok": lexeme_ok,
                    "morphemes_ok": morphemes_ok,
                    "morpheme_types_ok": morpheme_types_ok,
                    "overall_ok": overall_ok,
                    "analysis_type": item["analysis_type"],
                    "explanation": item["explanation"],
                    "mode": item.get("mode", "normal"),
                }
            )
            st.session_state.morf_checked_item_id = item["id"]

    eval_result = st.session_state.morf_item_eval_results.get(item["id"])
    if not eval_result:
        return

    st.markdown("### Resultado")
    st.markdown(
        f"- Tipo de palabra: "
        + (
            "<span class='result-ok'>correcto</span>"
            if eval_result["word_type_ok"]
            else f"<span class='result-bad'>incorrecto</span> (correcto: {item['word_type']})"
        ),
        unsafe_allow_html=True,
    )
    st.markdown(
        f"- Lexema: "
        + (
            "<span class='result-ok'>correcto</span>"
            if eval_result["lexeme_ok"]
            else f"<span class='result-bad'>incorrecto</span> (aceptados: {', '.join(item.get('accepted_lexemes', [item['lexeme']]))})"
        ),
        unsafe_allow_html=True,
    )
    st.markdown(
        f"- Morfemas: "
        + (
            "<span class='result-ok'>correctos</span>"
            if eval_result["morphemes_ok"]
            else f"<span class='result-bad'>incorrectos</span> (correctos: {', '.join(item['morphemes'])})"
        ),
        unsafe_allow_html=True,
    )
    st.markdown(
        f"- Tipos de morfema: "
        + (
            "<span class='result-ok'>correctos</span>"
            if eval_result["morpheme_types_ok"]
            else f"<span class='result-bad'>incorrectos</span> (correctos: {', '.join(item['morpheme_types'])})"
        ),
        unsafe_allow_html=True,
    )
    st.markdown(
        f"- Estado global: "
        + (
            "<span class='result-ok'>acierto</span>"
            if eval_result["overall_ok"]
            else "<span class='result-bad'>revisar</span>"
        ),
        unsafe_allow_html=True,
    )

    st.markdown("### Explicacion breve")
    st.write(item["analysis_type"])
    st.write(item["explanation"])

    with st.expander("Respuesta del modelo (inicial)", expanded=False):
        info_col, action_col = st.columns([5, 1])
        with info_col:
            st.write(f"Tipo de palabra propuesto: {item['word_type']}")
            st.write(f"Lexema propuesto: {item['lexeme']}")
            st.write(f"Morfemas propuestos: {', '.join(item['morphemes'])}")
            st.write(f"Tipos de morfema propuestos: {', '.join(item['morpheme_types'])}")
        with action_col:
            recheck_clicked = st.button("Recheck", key=f"morf_recheck_btn_{item['id']}")

        if recheck_clicked:
            with st.spinner("Revisando con el mejor modelo disponible..."):
                st.session_state.morf_recheck_results[item["id"]] = recheck_generated_item(
                    item=item,
                    current_model=st.session_state.morf_model_name,
                )

        recheck_result = st.session_state.morf_recheck_results.get(item["id"])
        if recheck_result:
            if not recheck_result.get("success"):
                st.warning(f"No se pudo validar: {recheck_result.get('error', 'Error desconocido')}")
            elif recheck_result.get("is_correct"):
                st.markdown("<span class='result-ok'>Respuesta inicial verificada [OK]</span>", unsafe_allow_html=True)
                st.success(
                    f"Confirmado por {recheck_result.get('model', 'modelo')}: la respuesta inicial era correcta."
                )
            else:
                st.markdown("<span class='result-bad'>Respuesta inicial con errores</span>", unsafe_allow_html=True)
                st.error(
                    f"Recheck con {recheck_result.get('model', 'modelo')}: se detectaron discrepancias."
                )
                st.write(
                    f"Correccion sugerida: tipo={recheck_result.get('corrected_word_type')} | "
                    f"lexema={recheck_result.get('corrected_lexeme')}"
                )
                st.write(
                    "Morfemas sugeridos: "
                    + ", ".join(recheck_result.get("corrected_morphemes", []))
                    + " | Tipos: "
                    + ", ".join(recheck_result.get("corrected_morpheme_types", []))
                )
                issues = recheck_result.get("issues", [])
                if issues:
                    st.write("Que estaba mal:")
                    for issue in issues:
                        st.write(f"- {issue}")
                if recheck_result.get("correction_note"):
                    st.caption(recheck_result["correction_note"])

    question_input = st.text_input(
        "Pregunta sobre esta palabra (opcional)",
        key=f"morf_item_question_input_{item['id']}",
        placeholder="Ej. Por que aqui este morfema es derivativo y no flexivo?",
    )
    if st.button("Preguntar", key=f"morf_ask_btn_{item['id']}"):
        if not question_input.strip():
            st.info("Escribe una pregunta antes de enviar.")
        else:
            with st.spinner("Consultando modelo..."):
                st.session_state.morf_item_question_answers[item["id"]] = ask_question_about_item(
                    item=item,
                    question=question_input.strip(),
                    current_model=st.session_state.morf_model_name,
                    recheck_result=st.session_state.morf_recheck_results.get(item["id"]),
                )

    answer_result = st.session_state.morf_item_question_answers.get(item["id"])
    if answer_result:
        if answer_result.get("success"):
            st.info(f"{answer_result.get('answer')}\n\n(Modelo: {answer_result.get('model')})")
        else:
            st.warning(f"No se pudo responder: {answer_result.get('error', 'Error desconocido')}")


def render_morfologia_history_page() -> None:
    st.title("Historial de errores - Morfologia")

    st.session_state.morf_hide_history = st.toggle(
        "Ocultar historial en esta sesion",
        value=st.session_state.morf_hide_history,
        key="morf_hide_history_toggle",
    )
    if st.session_state.morf_hide_history:
        st.info("Historial oculto. Desactiva el toggle para verlo.")
        return

    only_errors = st.toggle("Mostrar solo fallos", value=True, key="morf_only_errors_toggle")
    rows = fetch_attempts(st.session_state.morf_profile_id, only_errors=only_errors)
    profile = learning_profile(st.session_state.morf_profile_id)

    total_rows = fetch_attempts(st.session_state.morf_profile_id, only_errors=False)
    total = profile["total_attempts"]
    if total > 0:
        full_hits = sum(
            1
            for row in total_rows
            if row["word_type_ok"] == 1
            and row["lexeme_ok"] == 1
            and row["morphemes_ok"] == 1
            and row["morpheme_types_ok"] == 1
        )
        st.write(f"Intentos totales: {total} | Acierto completo: {round(100 * full_hits / total, 1)}%")
    else:
        st.write("Sin intentos guardados todavia.")

    st.write(f"Mas dificiles (tipo palabra): {', '.join([row['label'] for row in profile['weak_word_types']]) or '-'}")
    st.write(f"Mas dificiles (tipo morfema): {', '.join([row['label'] for row in profile['weak_morpheme_types']]) or '-'}")
    st.write(f"Mejores (tipo palabra): {', '.join([row['label'] for row in profile['strong_word_types']]) or '-'}")
    st.write(f"Mejores (tipo morfema): {', '.join([row['label'] for row in profile['strong_morpheme_types']]) or '-'}")

    if profile["word_type_overview"] or profile["morpheme_type_overview"]:
        st.write("Rendimiento exacto por tipo de palabra y tipo de morfema")
        exact_rows: List[Dict[str, Any]] = []
        for row in profile["word_type_overview"]:
            exact_rows.append(
                {
                    "eje": "tipo_palabra",
                    "item": row["label"],
                    "ok": row["ok"],
                    "fallos": row["fail"],
                    "intentos": row["attempts"],
                    "tasa_fallo": round(100 * row["fail_rate"], 1),
                }
            )
        for row in profile["morpheme_type_overview"]:
            exact_rows.append(
                {
                    "eje": "tipo_morfema",
                    "item": row["label"],
                    "ok": row["ok"],
                    "fallos": row["fail"],
                    "intentos": row["attempts"],
                    "tasa_fallo": round(100 * row["fail_rate"], 1),
                }
            )
        st.dataframe(exact_rows, use_container_width=True)

    if profile["weak_pairs"]:
        pair_rows = []
        for row in profile["weak_pairs"]:
            pair_rows.append(
                {
                    "par_tipo_palabra_morfema": row["pair"],
                    "ok": row["ok"],
                    "fallos": row["fail"],
                    "intentos": row["attempts"],
                    "tasa_fallo": round(100 * row["fail_rate"], 1),
                }
            )
        st.write("Combinaciones donde mas fallas")
        st.dataframe(pair_rows, use_container_width=True)

    if rows:
        st.dataframe(rows, use_container_width=True)
    else:
        st.info("No hay registros para este filtro.")

    st.markdown("---")
    confirm = st.checkbox("Confirmo que quiero borrar todo el historial de este perfil", key="morf_reset_confirm")
    if st.button("Resetear historial", use_container_width=True, disabled=not confirm, key="morf_reset_btn"):
        reset_attempts(st.session_state.morf_profile_id)
        st.success("Historial borrado.")


def render_morfologia_settings_page() -> None:
    st.title("Ajustes - Morfologia")
    profile_input = st.text_input("Perfil", value=st.session_state.morf_profile_id, key="morf_profile_input")

    st.subheader("Modelo Gemini")
    labels = [model["label"] for model in MORFO_MODEL_OPTIONS]
    values = [model["value"] for model in MORFO_MODEL_OPTIONS]
    current_model = st.session_state.morf_model_name.strip()
    has_predefined = current_model in values

    selector_options = labels + ["Personalizado (manual)"]
    default_label = labels[values.index(current_model)] if has_predefined else "Personalizado (manual)"
    selected_label = st.selectbox(
        "Selecciona modelo",
        options=selector_options,
        index=selector_options.index(default_label),
        key="morf_model_selector",
    )

    custom_model = st.text_input(
        "Modelo personalizado (opcional)",
        value="" if has_predefined else current_model,
        disabled=selected_label != "Personalizado (manual)",
        placeholder="ej. gemini-2.5-flash-lite",
        key="morf_custom_model_input",
    )

    if selected_label == "Personalizado (manual)":
        resolved_model = custom_model.strip() or "gemini-2.5-flash-lite"
    else:
        resolved_model = MORFO_MODEL_OPTIONS[labels.index(selected_label)]["value"]

    if st.button("Guardar ajustes", use_container_width=True, key="morf_save_settings_btn"):
        st.session_state.morf_profile_id = profile_input.strip() or "alumno"
        st.session_state.morf_model_name = resolved_model
        st.success("Ajustes guardados.")

    if st.session_state.morf_model_name.strip().lower().startswith("gemma"):
        st.caption("Compatibilidad Gemma activa: sin developer instruction; se usa prompt inline.")

    has_key = bool(morfo_get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY"))
    st.write(f"API key Gemini: {'configurada' if has_key else 'no configurada (se usara modo local)'}")
