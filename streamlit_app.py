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
from morfologia_section import (
    ensure_morfologia_state,
    init_morfologia_db,
    render_morfologia_history_page,
    render_morfologia_practice_page,
    render_morfologia_settings_page,
)

DB_PATH = "se_valores.db"

VALORES_SE = [
    "Reflexivo",
    "Reciproco",
    "Sustitucion (le -> se)",
    "Pronominal",
    "Pasiva refleja",
    "Impersonal",
    "Accidental (dativo de interes)",
]

FUNCIONES_SE = [
    "CD",
    "CI",
    "Sin funcion sintactica propia",
    "Morfema verbal",
    "Marca de pasiva",
    "Marca de impersonal",
]

MODEL_OPTIONS: List[Dict[str, str]] = [
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


def get_secret_or_env(secret_key: str, env_key: str) -> str:
    try:
        value = st.secrets.get(secret_key, "")
        if value:
            return str(value)
    except Exception:
        pass
    return os.getenv(env_key, "")

SYSTEM_PROMPT = """
Eres PROFE SINTAXIS en modo especializado en valores de "se".
Debes generar solo frases para practicar VALORES DEL SE.

Valores validos (exactos):
1) Reflexivo
2) Reciproco
3) Sustitucion (le -> se)
4) Pronominal
5) Pasiva refleja
6) Impersonal
7) Accidental (dativo de interes)

Funciones posibles de "se" (exactas):
- CD
- CI
- Sin funcion sintactica propia
- Morfema verbal
- Marca de pasiva
- Marca de impersonal

Reglas obligatorias:
- La frase debe contener "se" de forma clara.
- Si se solicita batch_size > 1, devuelve exactamente ese numero de frases.
- Devuelve tambien la respuesta correcta (valor + funcion) y una explicacion breve.
- Incluye tipo de oracion.
- Ajusta dificultad:
  d1: estructura simple y muy transparente
  d2: estructura media con algo de ambiguedad controlada
  d3: estructura avanzada y analisis mas exigente
- Si se pasan focos o debilidades, priorizalos.
- Respeta generation_strategy.mode:
  - personalizado_objetivo: prioriza target_value y target_function.
  - personalizado_mixto: NO fuerces debilidades en todos los casos; mezcla contenido normal.
- Respeta anti_repetition: evita repetir marcos, verbos y etiquetas recientes listadas.
- NO devuelvas texto fuera de JSON.

Salida JSON exacta:
{
  "items": [
    {
      "sentence": "string",
      "difficulty": 1,
      "se_value": "uno de los 7 valores",
      "se_function": "una funcion valida",
      "accepted_functions": ["lista de funciones aceptables, minimo 1"],
      "phrase_type": "descripcion corta del tipo de oracion",
      "explanation": "explicacion breve del por que"
    }
  ]
}
"""

RECHECK_SYSTEM_PROMPT = """
Eres un verificador estricto de gramatica espanola para "valores del se".
Recibes una frase y la respuesta propuesta por otro modelo.
Tu tarea es decidir si la respuesta propuesta es correcta.
Devuelve SOLO JSON valido.
"""

QUESTION_SYSTEM_PROMPT = """
Eres un profesor breve y claro de sintaxis espanola centrado en "valores del se".
Responde a la pregunta del usuario sobre una frase concreta.
Manten la respuesta corta y util (maximo 6 lineas).
"""

SAMPLE_BANK: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {
            "sentence": "Marta se peina cada manana.",
            "difficulty": 1,
            "se_value": "Reflexivo",
            "se_function": "CD",
            "accepted_functions": ["CD"],
            "phrase_type": "Oracion simple predicativa transitiva",
            "explanation": "El sujeto realiza y recibe la accion sobre si mismo: Marta peina a Marta.",
        },
        {
            "sentence": "Ana y Luis se abrazaron al llegar.",
            "difficulty": 1,
            "se_value": "Reciproco",
            "se_function": "CD",
            "accepted_functions": ["CD"],
            "phrase_type": "Oracion simple predicativa transitiva",
            "explanation": "La accion es mutua entre dos participantes: Ana abraza a Luis y Luis a Ana.",
        },
        {
            "sentence": "Se vive bien aqui.",
            "difficulty": 1,
            "se_value": "Impersonal",
            "se_function": "Marca de impersonal",
            "accepted_functions": ["Marca de impersonal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple impersonal con se",
            "explanation": "No hay sujeto expreso ni recuperable; se marca impersonalidad.",
        },
        {
            "sentence": "Pablo se lava las manos antes de comer.",
            "difficulty": 1,
            "se_value": "Reflexivo",
            "se_function": "CD",
            "accepted_functions": ["CD"],
            "phrase_type": "Oracion simple predicativa transitiva",
            "explanation": "El sujeto realiza la accion sobre si mismo.",
        },
        {
            "sentence": "Se duerme mejor con silencio.",
            "difficulty": 1,
            "se_value": "Impersonal",
            "se_function": "Marca de impersonal",
            "accepted_functions": ["Marca de impersonal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple impersonal con se",
            "explanation": "No hay sujeto concreto, verbo en tercera persona singular.",
        },
    ],
    2: [
        {
            "sentence": "La profesora se lo explico al grupo.",
            "difficulty": 2,
            "se_value": "Sustitucion (le -> se)",
            "se_function": "CI",
            "accepted_functions": ["CI"],
            "phrase_type": "Oracion simple predicativa transitiva con doble complemento",
            "explanation": "Se sustituye le/les por se delante de lo/la/los/las: le lo explico -> se lo explico.",
        },
        {
            "sentence": "Pedro se arrepintio de su decision.",
            "difficulty": 2,
            "se_value": "Pronominal",
            "se_function": "Morfema verbal",
            "accepted_functions": ["Morfema verbal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple predicativa con verbo pronominal",
            "explanation": "Arrepentirse exige se como parte lexical del verbo, no como CD/CI autonomo.",
        },
        {
            "sentence": "Se venden pisos en este barrio.",
            "difficulty": 2,
            "se_value": "Pasiva refleja",
            "se_function": "Marca de pasiva",
            "accepted_functions": ["Marca de pasiva", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple pasiva refleja",
            "explanation": "El verbo concuerda con el sujeto paciente 'pisos'; se marca voz pasiva refleja.",
        },
        {
            "sentence": "Mi tio se las entrego a la vecina.",
            "difficulty": 2,
            "se_value": "Sustitucion (le -> se)",
            "se_function": "CI",
            "accepted_functions": ["CI"],
            "phrase_type": "Oracion simple predicativa transitiva con doble complemento",
            "explanation": "Le/les cambia a se delante de pronombres de CD.",
        },
        {
            "sentence": "Lucia se quejo del ruido del bar.",
            "difficulty": 2,
            "se_value": "Pronominal",
            "se_function": "Morfema verbal",
            "accepted_functions": ["Morfema verbal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple predicativa con verbo pronominal",
            "explanation": "Quejarse incorpora se como parte del verbo.",
        },
    ],
    3: [
        {
            "sentence": "Ayer se me rompio el portatil justo antes de la entrega.",
            "difficulty": 3,
            "se_value": "Accidental (dativo de interes)",
            "se_function": "CI",
            "accepted_functions": ["CI"],
            "phrase_type": "Oracion simple predicativa con dativo de interes",
            "explanation": "Se + dativo (me) expresa evento no intencional con afectacion del hablante.",
        },
        {
            "sentence": "En este despacho se atiende a los clientes sin cita previa.",
            "difficulty": 3,
            "se_value": "Impersonal",
            "se_function": "Marca de impersonal",
            "accepted_functions": ["Marca de impersonal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion simple impersonal con se",
            "explanation": "El verbo queda en tercera singular y no hay sujeto referencial concreto.",
        },
        {
            "sentence": "Cuando termino la reunion, los socios se felicitaron por el acuerdo.",
            "difficulty": 3,
            "se_value": "Reciproco",
            "se_function": "CD",
            "accepted_functions": ["CD"],
            "phrase_type": "Oracion compuesta con subordinada temporal",
            "explanation": "La accion de felicitarse se realiza mutuamente entre varios sujetos.",
        },
        {
            "sentence": "Se nos perdieron los documentos durante el traslado del archivo.",
            "difficulty": 3,
            "se_value": "Accidental (dativo de interes)",
            "se_function": "CI",
            "accepted_functions": ["CI"],
            "phrase_type": "Oracion simple predicativa con dativo de interes",
            "explanation": "Se expresa accidentalidad y afectacion con dativo.",
        },
        {
            "sentence": "Aqui se premia a quien trabaja con constancia cada trimestre.",
            "difficulty": 3,
            "se_value": "Impersonal",
            "se_function": "Marca de impersonal",
            "accepted_functions": ["Marca de impersonal", "Sin funcion sintactica propia"],
            "phrase_type": "Oracion compuesta con principal impersonal",
            "explanation": "La principal es impersonal con se y hay subordinada de relativo.",
        },
    ],
}

CSS = """
<style>
  .stApp {
    background: #16181b;
    color: #e2e4e8;
  }
  [data-testid="stHeader"], [data-testid="stToolbar"] {
    background: transparent;
  }
  [data-testid="stSidebar"] {
    background: #1b1d20;
    border: none;
  }
  .block-container {
    max-width: 1100px;
    padding-top: 1.2rem;
  }
  .stButton > button {
    background: #2a2d31;
    color: #e5e7ea;
    border: none;
    border-radius: 8px;
    box-shadow: none;
  }
  .stButton > button:hover {
    background: #34383d;
  }
  .stSelectbox [data-baseweb="select"],
  .stMultiSelect [data-baseweb="select"],
  .stTextInput input {
    background: #24272b !important;
    border: none !important;
    color: #e5e7ea !important;
    border-radius: 8px !important;
  }
  .stDataFrame {
    border: none !important;
    background: transparent !important;
  }
  hr {
    border-color: rgba(255, 255, 255, 0.08);
  }
  .result-ok {
    color: #8fd8a8;
    font-weight: 600;
  }
  .result-bad {
    color: #ff8d8d;
    font-weight: 600;
  }
</style>
"""


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                difficulty INTEGER NOT NULL,
                sentence TEXT NOT NULL,
                expected_value TEXT NOT NULL,
                expected_function TEXT NOT NULL,
                guess_value TEXT NOT NULL,
                guess_function TEXT NOT NULL,
                value_ok INTEGER NOT NULL,
                function_ok INTEGER NOT NULL,
                phrase_type TEXT NOT NULL,
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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def empty_axis(labels: List[str]) -> Dict[str, Dict[str, int]]:
    return {label: {"ok": 0, "fail": 0} for label in labels}


def default_stats_payload() -> Dict[str, Any]:
    return {
        "total_attempts": 0,
        "value_stats": empty_axis(VALORES_SE),
        "function_stats": empty_axis(FUNCIONES_SE),
        "difficulty_stats": {"1": {"ok": 0, "fail": 0}, "2": {"ok": 0, "fail": 0}, "3": {"ok": 0, "fail": 0}},
        "pair_stats": {},
    }


def extract_json(text: str) -> Any:
    fenced = re.search(r"```json\s*(.*?)```", text, re.IGNORECASE | re.DOTALL)
    candidate = fenced.group(1).strip() if fenced else text.strip()

    # Prefer the first JSON object/array block if the model added extra text.
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


def normalize_function_label(value: str) -> str:
    key = value.strip().lower()
    mapping = {
        "cd": "CD",
        "ci": "CI",
        "sin funcion": "Sin funcion sintactica propia",
        "sin funcion sintactica propia": "Sin funcion sintactica propia",
        "morfema verbal": "Morfema verbal",
        "marca de pasiva": "Marca de pasiva",
        "marca de impersonal": "Marca de impersonal",
    }
    return mapping.get(key, value)


def is_gemma_model_name(model_name: str) -> bool:
    return model_name.strip().lower().startswith("gemma")


def build_recheck_model_candidates(current_model: str) -> List[str]:
    preferred = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        current_model.strip(),
    ]
    unique: List[str] = []
    seen = set()
    for model in preferred:
        if not model:
            continue
        key = model.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(model)
    return unique


def normalize_generated_item(parsed: Dict[str, Any], fallback_difficulty: int) -> Dict[str, Any]:
    normalized = {
        "sentence": str(parsed.get("sentence", "")).strip(),
        "difficulty": int(parsed.get("difficulty", fallback_difficulty)),
        "se_value": str(parsed.get("se_value", "")).strip(),
        "se_function": normalize_function_label(str(parsed.get("se_function", "")).strip()),
        "accepted_functions": [
            normalize_function_label(str(item).strip())
            for item in parsed.get("accepted_functions", [])
            if str(item).strip()
        ],
        "phrase_type": str(parsed.get("phrase_type", "")).strip(),
        "explanation": str(parsed.get("explanation", "")).strip(),
    }
    if not normalized["accepted_functions"] and normalized["se_function"]:
        normalized["accepted_functions"] = [normalized["se_function"]]
    return normalized


def extract_candidate_items(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            return [item for item in payload["items"] if isinstance(item, dict)]
        if all(key in payload for key in ["sentence", "se_value", "se_function"]):
            return [payload]
        return []
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def normalized_tokens(sentence: str) -> List[str]:
    return re.findall(r"\w+", sentence.lower())


def sentence_similarity(a: str, b: str) -> float:
    tokens_a = set(normalized_tokens(a))
    tokens_b = set(normalized_tokens(b))
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a.intersection(tokens_b)) / len(tokens_a.union(tokens_b))


def is_novel_sentence(sentence: str, recent_sentences: List[str], threshold: float = 0.72) -> bool:
    normalized = sentence.strip().lower()
    for old in recent_sentences:
        old_normalized = old.strip().lower()
        if normalized == old_normalized:
            return False
        if sentence_similarity(sentence, old) >= threshold:
            return False
    return True


def load_profile_stats(profile_id: str) -> Dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute(
            "SELECT payload FROM profile_stats WHERE profile_id = ?",
            (profile_id,),
        ).fetchone()
        if not row:
            payload = default_stats_payload()
            conn.execute(
                "INSERT INTO profile_stats (profile_id, updated_at, payload) VALUES (?, ?, ?)",
                (profile_id, now_iso(), json.dumps(payload, ensure_ascii=False)),
            )
            return payload

    try:
        payload = json.loads(row[0])
        defaults = default_stats_payload()
        payload.setdefault("total_attempts", 0)
        payload.setdefault("value_stats", defaults["value_stats"])
        payload.setdefault("function_stats", defaults["function_stats"])
        payload.setdefault("difficulty_stats", defaults["difficulty_stats"])
        payload.setdefault("pair_stats", {})
        return payload
    except Exception:
        return default_stats_payload()


def save_profile_stats(profile_id: str, payload: Dict[str, Any]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO profile_stats (profile_id, updated_at, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET
              updated_at = excluded.updated_at,
              payload = excluded.payload
            """,
            (profile_id, now_iso(), json.dumps(payload, ensure_ascii=False)),
        )


def update_profile_stats_from_attempt(record: Dict[str, Any]) -> None:
    payload = load_profile_stats(record["profile_id"])
    payload["total_attempts"] = int(payload.get("total_attempts", 0)) + 1

    expected_value = record["expected_value"]
    expected_function = record["expected_function"]
    difficulty_key = str(record["difficulty"])
    value_ok = bool(record["value_ok"])
    function_ok = bool(record["function_ok"])

    payload["value_stats"].setdefault(expected_value, {"ok": 0, "fail": 0})
    payload["function_stats"].setdefault(expected_function, {"ok": 0, "fail": 0})
    payload["difficulty_stats"].setdefault(difficulty_key, {"ok": 0, "fail": 0})

    payload["value_stats"][expected_value]["ok" if value_ok else "fail"] += 1
    payload["function_stats"][expected_function]["ok" if function_ok else "fail"] += 1
    payload["difficulty_stats"][difficulty_key]["ok" if (value_ok and function_ok) else "fail"] += 1

    pair_key = f"{expected_value} || {expected_function}"
    pair_stats = payload["pair_stats"].setdefault(pair_key, {"ok": 0, "fail": 0})
    pair_stats["ok" if (value_ok and function_ok) else "fail"] += 1

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
    weak_values, strong_values = axis_summary(stats["value_stats"])
    weak_functions, strong_functions = axis_summary(stats["function_stats"])
    value_overview = axis_overview(stats["value_stats"])
    function_overview = axis_overview(stats["function_stats"])
    weak_pairs = pair_summary(stats.get("pair_stats", {}))
    return {
        "total_attempts": int(stats.get("total_attempts", 0)),
        "weak_values": weak_values,
        "strong_values": strong_values,
        "weak_functions": weak_functions,
        "strong_functions": strong_functions,
        "value_overview": value_overview,
        "function_overview": function_overview,
        "weak_pairs": weak_pairs,
    }


def fetch_recent_sentences(profile_id: str, limit_size: int = 12) -> List[str]:
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT sentence
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
        sentence = str(row[0]).strip()
        key = sentence.lower()
        if not sentence or key in seen:
            continue
        seen.add(key)
        unique.append(sentence)
        if len(unique) >= limit_size:
            break
    return unique


def fetch_recent_labels(profile_id: str, limit_size: int = 10) -> List[Dict[str, str]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT expected_value, expected_function
            FROM attempts
            WHERE profile_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (profile_id, limit_size),
        ).fetchall()
    return [{"value": str(row["expected_value"]), "function": str(row["expected_function"])} for row in rows]


def choose_personalized_target(
    profile: Dict[str, Any],
    focus_values: List[str],
    personalized: bool,
    force_targeted: Optional[bool] = None,
    mix_label: str = "40% debilidades / 60% normal",
) -> Dict[str, Any]:
    if focus_values:
        return {
            "mode": "foco_usuario",
            "targeted": True,
            "focus_values": focus_values,
            "target_value": random.choice(focus_values),
            "target_function": "",
            "ratio_hint": "100% foco",
        }

    if not personalized:
        return {
            "mode": "normal",
            "targeted": False,
            "focus_values": [],
            "target_value": "",
            "target_function": "",
            "ratio_hint": "0% personalizado",
        }

    weak_values = profile["weak_values"]
    weak_functions = profile["weak_functions"]
    weak_pairs = profile.get("weak_pairs", [])
    has_weakness = bool(weak_values or weak_functions)
    targeted = has_weakness and (force_targeted if force_targeted is not None else random.random() < 0.4)

    if not targeted:
        return {
            "mode": "personalizado_mixto",
            "targeted": False,
            "focus_values": [],
            "target_value": "",
            "target_function": "",
            "ratio_hint": mix_label,
        }

    target_value = ""
    target_function = ""
    if weak_pairs and random.random() < 0.65:
        pair_weights = [max(0.05, row["fail_rate"]) for row in weak_pairs]
        picked = random.choices(weak_pairs, weights=pair_weights, k=1)[0]["pair"]
        parts = picked.split(" || ", maxsplit=1)
        target_value = parts[0].strip()
        if len(parts) > 1:
            target_function = parts[1].strip()
    else:
        if weak_values:
            value_labels = [row["label"] for row in weak_values]
            value_weights = [max(0.05, row["fail_rate"]) for row in weak_values]
            target_value = random.choices(value_labels, weights=value_weights, k=1)[0]
        if weak_functions:
            fn_labels = [row["label"] for row in weak_functions]
            fn_weights = [max(0.05, row["fail_rate"]) for row in weak_functions]
            target_function = random.choices(fn_labels, weights=fn_weights, k=1)[0]

    return {
        "mode": "personalizado_objetivo",
        "targeted": True,
        "focus_values": [target_value] if target_value else [],
        "target_value": target_value,
        "target_function": target_function,
        "ratio_hint": mix_label,
    }


def choose_sample(
    difficulty: int,
    focus_values: List[str],
    weakness_values: List[str],
    recent_sentences: List[str],
) -> Dict[str, Any]:
    pool = SAMPLE_BANK[difficulty]
    target_values = focus_values or weakness_values
    if target_values:
        filtered = [item for item in pool if item["se_value"] in target_values]
        if filtered:
            pool = filtered

    novel_pool = [item for item in pool if is_novel_sentence(item["sentence"], recent_sentences, threshold=0.75)]
    if novel_pool:
        pool = novel_pool

    return random.choice(pool)


def build_generation_prompt(
    difficulty: int,
    strategies: List[Dict[str, Any]],
    profile: Dict[str, Any],
    recent_sentences: List[str],
    rejected_sentences: List[str],
    avoid_values: List[str],
    avoid_functions: List[str],
    batch_size: int,
) -> str:
    payload = {
        "task": "Generar un lote de frases para practicar valores del se",
        "difficulty": difficulty,
        "batch_size": batch_size,
        "generation_strategy": {
            "schedule": [
                {
                    "slot": idx + 1,
                    "mode": strategy["mode"],
                    "targeted": strategy["targeted"],
                    "target_value": strategy["target_value"] or None,
                    "target_function": strategy["target_function"] or None,
                    "focus_values": strategy["focus_values"],
                }
                for idx, strategy in enumerate(strategies[:batch_size])
            ],
            "ratio_hint": strategies[0]["ratio_hint"] if strategies else "sin ratio",
        },
        "learning_profile": profile,
        "allowed_values": VALORES_SE,
        "allowed_functions": FUNCIONES_SE,
        "anti_repetition": {
            "avoid_recent_sentences": recent_sentences,
            "avoid_rejected_sentences": rejected_sentences,
            "avoid_values_temporarily": avoid_values,
            "avoid_functions_temporarily": avoid_functions,
            "must_be_semantically_distinct": True,
            "do_not_repeat_main_verb_or_frame": True,
        },
        "batch_diversity_rules": {
            "different_main_verbs_per_item": True,
            "vary_subject_and_context": True,
            "avoid_only_single_word_changes": True,
            "vary_sentence_length": True,
        },
        "diversity_noise": {
            "seed": random.randint(100000, 999999),
            "register_hint": random.choice(["neutral", "formal", "coloquial", "academico"]),
            "context_hint": random.choice(["hogar", "estudios", "trabajo", "vida publica"]),
        },
        "constraints": {
            "must_contain_se": True,
            "must_return_exact_count": batch_size,
            "no_internal_duplicates": True,
            "difficulty_profile": {
                "1": "frase corta y muy transparente",
                "2": "frase de complejidad media",
                "3": "frase mas compleja y exigente",
            },
        },
        "output_schema": {
            "items": [
                {
                    "sentence": "string",
                    "difficulty": "1|2|3",
                    "se_value": "one_of_allowed_values",
                    "se_function": "one_of_allowed_functions",
                    "accepted_functions": ["one_or_more_allowed_functions"],
                    "phrase_type": "string",
                    "explanation": "string_short",
                }
            ],
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


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


def recheck_generated_item(item: Dict[str, Any], current_model: str) -> Dict[str, Any]:
    api_key = get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "API key no configurada. No se puede ejecutar recheck.",
        }

    prompt_payload = {
        "sentence": item["sentence"],
        "proposed_answer": {
            "se_value": item["se_value"],
            "se_function": item["se_function"],
            "accepted_functions": item.get("accepted_functions", [item["se_function"]]),
            "phrase_type": item["phrase_type"],
            "explanation": item["explanation"],
        },
        "allowed_values": VALORES_SE,
        "allowed_functions": FUNCIONES_SE,
        "task": "Verificar si la respuesta propuesta es correcta para la frase.",
        "output_schema": {
            "is_correct": "boolean",
            "corrected_value": "one_of_allowed_values",
            "corrected_function": "one_of_allowed_functions",
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
                system_prompt=RECHECK_SYSTEM_PROMPT,
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

            corrected_value = str(parsed.get("corrected_value", item["se_value"])).strip()
            if corrected_value not in VALORES_SE:
                corrected_value = item["se_value"]

            corrected_function = normalize_function_label(str(parsed.get("corrected_function", item["se_function"])).strip())
            if corrected_function not in FUNCIONES_SE:
                corrected_function = item["se_function"]

            issues = [str(value).strip() for value in parsed.get("issues", []) if str(value).strip()]
            correction_note = str(parsed.get("correction_note", "")).strip()
            is_correct = bool(parsed.get("is_correct", False))

            return {
                "success": True,
                "model": candidate_model,
                "is_correct": is_correct,
                "corrected_value": corrected_value,
                "corrected_function": corrected_function,
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
    api_key = get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "API key no configurada. No se puede responder la pregunta.",
        }

    context = {
        "sentence": item["sentence"],
        "initial_answer": {
            "se_value": item["se_value"],
            "se_function": item["se_function"],
            "phrase_type": item["phrase_type"],
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
                system_prompt=QUESTION_SYSTEM_PROMPT,
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


def build_fallback_batch(
    difficulty: int,
    strategies: List[Dict[str, Any]],
    recent_sentences: List[str],
    batch_size: int,
) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    memory = list(recent_sentences)

    for strategy in strategies[:batch_size]:
        candidate = choose_sample(
            difficulty=difficulty,
            focus_values=strategy["focus_values"],
            weakness_values=[strategy["target_value"]] if strategy["target_value"] else [],
            recent_sentences=memory,
        )
        prepared = dict(candidate)
        prepared["mode"] = strategy["mode"]
        items.append(prepared)
        memory.append(prepared["sentence"])
    return items


def is_valid_generated_item(
    item: Dict[str, Any],
    strategy: Dict[str, Any],
    avoid_values: List[str],
    avoid_functions: List[str],
    seen_sentences: List[str],
) -> bool:
    lower = item["sentence"].lower()
    contains_se = " se " in f" {lower} " or "se " in lower or " se" in lower
    if not contains_se:
        return False
    if item["se_value"] not in VALORES_SE or item["se_function"] not in FUNCIONES_SE:
        return False

    if strategy["targeted"] and strategy["target_value"] and item["se_value"] != strategy["target_value"]:
        return False
    if strategy["targeted"] and strategy["target_function"]:
        if item["se_function"] != strategy["target_function"] and strategy["target_function"] not in item["accepted_functions"]:
            return False

    if strategy["mode"] in {"normal", "personalizado_mixto"}:
        if avoid_values and item["se_value"] in avoid_values:
            return False
        if avoid_functions and item["se_function"] in avoid_functions:
            return False

    if not is_novel_sentence(item["sentence"], seen_sentences):
        return False
    return True


def generate_batch_with_llm(
    profile_id: str,
    difficulty: int,
    strategies: List[Dict[str, Any]],
    profile: Dict[str, Any],
    model_name: str,
) -> List[Dict[str, Any]]:
    batch_size = max(1, len(strategies))
    is_gemma_model = is_gemma_model_name(model_name)
    recent_sentences = fetch_recent_sentences(profile_id, limit_size=14)
    recent_labels = fetch_recent_labels(profile_id, limit_size=10)
    recent_values = [row["value"] for row in recent_labels]
    recent_functions = [row["function"] for row in recent_labels]
    avoid_values: List[str] = []
    avoid_functions: List[str] = []
    normal_like = any(strategy["mode"] in {"normal", "personalizado_mixto"} for strategy in strategies)
    if normal_like:
        if len(recent_values) >= 2 and recent_values[0] == recent_values[1]:
            avoid_values.append(recent_values[0])
        if len(recent_functions) >= 3 and len(set(recent_functions[:3])) == 1:
            avoid_functions.append(recent_functions[0])

    api_key = get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    fallback_batch = build_fallback_batch(
        difficulty=difficulty,
        strategies=strategies,
        recent_sentences=recent_sentences,
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
                system_instruction=SYSTEM_PROMPT,
            )
        rejected_sentences: List[str] = []
        accepted: List[Dict[str, Any]] = []
        accepted_sentences: List[str] = []

        for temperature in [0.6, 0.78, 0.9]:
            prompt = build_generation_prompt(
                difficulty=difficulty,
                strategies=strategies,
                profile=profile,
                recent_sentences=recent_sentences,
                rejected_sentences=rejected_sentences,
                avoid_values=avoid_values,
                avoid_functions=avoid_functions,
                batch_size=batch_size,
            )
            if is_gemma_model:
                request_payload = (
                    "INSTRUCCIONES DE SISTEMA:\n"
                    + SYSTEM_PROMPT.strip()
                    + "\n\nINSTRUCCIONES DE USUARIO:\n"
                    + prompt
                    + "\n\nDevuelve solo JSON valido."
                )
            else:
                request_payload = prompt

            generation_config: Dict[str, Any] = {
                "temperature": temperature,
            }
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
                seen_sentences = recent_sentences + rejected_sentences + accepted_sentences
                if not is_valid_generated_item(normalized, strategy, avoid_values, avoid_functions, seen_sentences):
                    rejected_sentences.append(normalized["sentence"])
                    continue

                normalized["mode"] = strategy["mode"]
                accepted.append(normalized)
                accepted_sentences.append(normalized["sentence"])

            if len(accepted) >= batch_size:
                return accepted[:batch_size]
    except Exception as error:
        st.warning(f"LLM no disponible ahora. Uso modo local. Detalle: {error}")

    completed = list(accepted) if "accepted" in locals() else []
    memory = recent_sentences + [item["sentence"] for item in completed]
    for fallback in fallback_batch:
        if len(completed) >= batch_size:
            break
        if is_novel_sentence(fallback["sentence"], memory, threshold=0.68):
            completed.append(fallback)
            memory.append(fallback["sentence"])

    # Guarantee a full queue even in local/fallback mode.
    while len(completed) < batch_size:
        strategy = strategies[len(completed) % len(strategies)]
        filler = choose_sample(
            difficulty=difficulty,
            focus_values=strategy["focus_values"],
            weakness_values=[strategy["target_value"]] if strategy["target_value"] else [],
            recent_sentences=[],
        )
        prepared = dict(filler)
        prepared["mode"] = strategy["mode"]
        completed.append(prepared)

    return completed[:batch_size]


def save_attempt(record: Dict[str, Any]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO attempts (
                id, profile_id, created_at, difficulty, sentence, expected_value, expected_function,
                guess_value, guess_function, value_ok, function_ok, phrase_type, explanation, mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record["profile_id"],
                record["created_at"],
                record["difficulty"],
                record["sentence"],
                record["expected_value"],
                record["expected_function"],
                record["guess_value"],
                record["guess_function"],
                int(record["value_ok"]),
                int(record["function_ok"]),
                record["phrase_type"],
                record["explanation"],
                record["mode"],
            ),
        )
    update_profile_stats_from_attempt(record)


def fetch_attempts(profile_id: str, only_errors: bool = False) -> List[Dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        sql = "SELECT * FROM attempts WHERE profile_id = ?"
        params: List[Any] = [profile_id]
        if only_errors:
            sql += " AND (value_ok = 0 OR function_ok = 0)"
        sql += " ORDER BY created_at DESC LIMIT 500"
        rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def reset_attempts(profile_id: str) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM attempts WHERE profile_id = ?", (profile_id,))
        conn.execute("DELETE FROM profile_stats WHERE profile_id = ?", (profile_id,))


def weakness_summary(profile_id: str) -> Dict[str, List[str]]:
    profile = learning_profile(profile_id)
    return {
        "values": [row["label"] for row in profile["weak_values"]],
        "functions": [row["label"] for row in profile["weak_functions"]],
    }


def ensure_state() -> None:
    if "profile_id" not in st.session_state:
        st.session_state.profile_id = "alumno"
    if "model_name" not in st.session_state:
        st.session_state.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    if "current_item" not in st.session_state:
        st.session_state.current_item = None
    if "phrase_queue" not in st.session_state:
        st.session_state.phrase_queue = []
    if "checked_item_id" not in st.session_state:
        st.session_state.checked_item_id = None
    if "hide_history" not in st.session_state:
        st.session_state.hide_history = False
    if "mix_bucket" not in st.session_state:
        st.session_state.mix_bucket = []
    if "mix_target_weight" not in st.session_state:
        st.session_state.mix_target_weight = 40
    if "mix_normal_weight" not in st.session_state:
        st.session_state.mix_normal_weight = 60
    if "mix_signature" not in st.session_state:
        st.session_state.mix_signature = (40, 60)
    if "practice_difficulty" not in st.session_state:
        st.session_state.practice_difficulty = 2
    if "practice_personalized" not in st.session_state:
        st.session_state.practice_personalized = True
    if "practice_focus_values" not in st.session_state:
        st.session_state.practice_focus_values = []
    if "recheck_results" not in st.session_state:
        st.session_state.recheck_results = {}
    if "item_question_answers" not in st.session_state:
        st.session_state.item_question_answers = {}
    if "item_eval_results" not in st.session_state:
        st.session_state.item_eval_results = {}


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

    # Keep small cycles from feeling deterministic while preserving the ratio.
    base_size = targeted_count + normal_count
    if base_size < 10:
        multiplier = max(1, 10 // base_size)
        targeted_count *= multiplier
        normal_count *= multiplier

    bucket = [True] * targeted_count + [False] * normal_count
    random.shuffle(bucket)
    return bucket


def pop_mix_targeted(target_weight: int, normal_weight: int) -> bool:
    bucket = st.session_state.mix_bucket
    if not bucket:
        bucket = build_mix_bucket(target_weight, normal_weight)
        st.session_state.mix_bucket = bucket
    return bool(st.session_state.mix_bucket.pop())


def render_practice_page() -> None:
    st.title("Practica de Valores del se")
    st.caption("Generacion y correccion en una sola respuesta del modelo.")

    difficulty = st.select_slider("Dificultad", options=[1, 2, 3], key="practice_difficulty")
    personalized = st.toggle("Modo personalizado", key="practice_personalized")
    focus_values = st.multiselect("Foco (opcional)", VALORES_SE, key="practice_focus_values")

    col_mix_1, col_mix_2 = st.columns(2)
    with col_mix_1:
        target_weight = int(
            st.number_input(
                "Peso debilidades",
                min_value=0,
                max_value=100,
                step=5,
                key="mix_target_weight",
            )
        )
    with col_mix_2:
        normal_weight = int(
            st.number_input(
                "Peso normal",
                min_value=0,
                max_value=100,
                step=5,
                key="mix_normal_weight",
            )
        )

    mix_signature = (target_weight, normal_weight)
    if mix_signature != st.session_state.mix_signature:
        st.session_state.mix_signature = mix_signature
        st.session_state.mix_bucket = []

    effective_target_weight = target_weight
    effective_normal_weight = normal_weight
    if target_weight == 0 and normal_weight == 0:
        effective_target_weight, effective_normal_weight = 40, 60

    mix_total = effective_target_weight + effective_normal_weight
    target_pct = round(100 * effective_target_weight / mix_total, 1)
    normal_pct = round(100 * effective_normal_weight / mix_total, 1)
    mix_label = f"{target_pct}% debilidades / {normal_pct}% normal"
    st.caption(f"Mezcla personalizada actual: {mix_label} (bucket barajado por ciclo)")

    profile = learning_profile(st.session_state.profile_id)
    weak = {
        "values": [row["label"] for row in profile["weak_values"]],
        "functions": [row["label"] for row in profile["weak_functions"]],
    }
    if personalized and (weak["values"] or weak["functions"]):
        st.write(
            f"Refuerzo activo: valores {', '.join(weak['values']) or '-'} | funciones {', '.join(weak['functions']) or '-'}"
        )

    queue_count = len(st.session_state.phrase_queue)
    button_label = "Siguiente frase" if queue_count > 0 else "Generar lote"
    if st.button(button_label, use_container_width=True):
        if not st.session_state.phrase_queue:
            batch_size = 3 if personalized else 10
            strategies: List[Dict[str, Any]] = []
            for _ in range(batch_size):
                force_targeted: Optional[bool] = None
                if personalized and not focus_values and (profile["weak_values"] or profile["weak_functions"]):
                    force_targeted = pop_mix_targeted(effective_target_weight, effective_normal_weight)
                strategies.append(
                    choose_personalized_target(
                        profile=profile,
                        focus_values=focus_values,
                        personalized=personalized,
                        force_targeted=force_targeted,
                        mix_label=mix_label,
                    )
                )

            batch_items = generate_batch_with_llm(
                profile_id=st.session_state.profile_id,
                difficulty=difficulty,
                strategies=strategies,
                profile=profile,
                model_name=st.session_state.model_name,
            )
            prepared_queue: List[Dict[str, Any]] = []
            for idx, queued_item in enumerate(batch_items):
                prepared = dict(queued_item)
                prepared["id"] = str(uuid.uuid4())
                prepared["mode"] = prepared.get("mode", strategies[min(idx, len(strategies) - 1)]["mode"])
                prepared_queue.append(prepared)

            if not personalized:
                random.shuffle(prepared_queue)
            st.session_state.phrase_queue = prepared_queue

        if st.session_state.phrase_queue:
            st.session_state.current_item = st.session_state.phrase_queue.pop(0)
            st.session_state.checked_item_id = None

    item = st.session_state.current_item
    if not item:
        st.info("Genera una frase para empezar.")
        return

    st.subheader("Frase")
    st.markdown(f"### {item['sentence']}")
    st.caption(f"Modo de generacion: {item.get('mode', 'normal')}")
    st.caption(f"Frases restantes en cola: {len(st.session_state.phrase_queue)}")

    guessed_value = st.radio("Que valor de 'se' tiene?", VALORES_SE, index=0, key=f"guess_value_{item['id']}")
    guessed_function = st.selectbox(
        "Funcion de 'se' en esta frase",
        FUNCIONES_SE,
        index=0,
        key=f"guess_function_{item['id']}",
    )

    if st.button("Comprobar respuesta", use_container_width=True):
        value_ok = guessed_value == item["se_value"]
        fn_ok = guessed_function in item.get("accepted_functions", [item["se_function"]])
        overall_ok = value_ok and fn_ok

        st.session_state.item_eval_results[item["id"]] = {
            "guess_value": guessed_value,
            "guess_function": guessed_function,
            "value_ok": value_ok,
            "function_ok": fn_ok,
            "overall_ok": overall_ok,
        }

        if st.session_state.checked_item_id != item["id"]:
            save_attempt(
                {
                    "id": item["id"],
                    "profile_id": st.session_state.profile_id,
                    "created_at": now_iso(),
                    "difficulty": int(item["difficulty"]),
                    "sentence": item["sentence"],
                    "expected_value": item["se_value"],
                    "expected_function": item["se_function"],
                    "guess_value": guessed_value,
                    "guess_function": guessed_function,
                    "value_ok": value_ok,
                    "function_ok": fn_ok,
                    "phrase_type": item["phrase_type"],
                    "explanation": item["explanation"],
                    "mode": item.get("mode", "normal"),
                }
            )
            st.session_state.checked_item_id = item["id"]

    eval_result = st.session_state.item_eval_results.get(item["id"])
    if not eval_result:
        return

    st.markdown("### Resultado")
    st.markdown(
        f"- Valor: "
        + (
            f"<span class='result-ok'>correcto</span>"
            if eval_result["value_ok"]
            else f"<span class='result-bad'>incorrecto</span> (correcto: {item['se_value']})"
        ),
        unsafe_allow_html=True,
    )
    st.markdown(
        f"- Funcion: "
        + (
            f"<span class='result-ok'>correcta</span>"
            if eval_result["function_ok"]
            else f"<span class='result-bad'>incorrecta</span> (correcta: {item['se_function']})"
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
    st.write(item["phrase_type"])
    st.write(item["explanation"])

    # Bottom tools: only shown after the checked response is visible.
    with st.expander("Respuesta del modelo (inicial)", expanded=False):
        info_col, action_col = st.columns([5, 1])
        with info_col:
            st.write(f"Valor propuesto: {item['se_value']}")
            st.write(f"Funcion propuesta: {item['se_function']}")
            st.write(f"Tipo de oracion: {item['phrase_type']}")
        with action_col:
            recheck_clicked = st.button("Recheck", key=f"recheck_btn_{item['id']}")

        if recheck_clicked:
            with st.spinner("Revisando con el mejor modelo disponible..."):
                st.session_state.recheck_results[item["id"]] = recheck_generated_item(
                    item=item,
                    current_model=st.session_state.model_name,
                )

        recheck_result = st.session_state.recheck_results.get(item["id"])
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
                    f"Correccion sugerida: valor={recheck_result.get('corrected_value')} | "
                    f"funcion={recheck_result.get('corrected_function')}"
                )
                issues = recheck_result.get("issues", [])
                if issues:
                    st.write("Que estaba mal:")
                    for issue in issues:
                        st.write(f"- {issue}")
                if recheck_result.get("correction_note"):
                    st.caption(recheck_result["correction_note"])

    question_input = st.text_input(
        "Pregunta sobre esta frase (opcional)",
        key=f"item_question_input_{item['id']}",
        placeholder="Ej. Por que aqui es impersonal y no pasiva refleja?",
    )
    if st.button("Preguntar", key=f"ask_btn_{item['id']}"):
        if not question_input.strip():
            st.info("Escribe una pregunta antes de enviar.")
        else:
            with st.spinner("Consultando modelo..."):
                st.session_state.item_question_answers[item["id"]] = ask_question_about_item(
                    item=item,
                    question=question_input.strip(),
                    current_model=st.session_state.model_name,
                    recheck_result=st.session_state.recheck_results.get(item["id"]),
                )

    answer_result = st.session_state.item_question_answers.get(item["id"])
    if answer_result:
        if answer_result.get("success"):
            st.info(f"{answer_result.get('answer')}\n\n(Modelo: {answer_result.get('model')})")
        else:
            st.warning(f"No se pudo responder: {answer_result.get('error', 'Error desconocido')}")


def render_history_page() -> None:
    st.title("Historial de errores")

    st.session_state.hide_history = st.toggle("Ocultar historial en esta sesion", value=st.session_state.hide_history)
    if st.session_state.hide_history:
        st.info("Historial oculto. Desactiva el toggle para verlo.")
        return

    only_errors = st.toggle("Mostrar solo fallos", value=True)
    rows = fetch_attempts(st.session_state.profile_id, only_errors=only_errors)
    profile = learning_profile(st.session_state.profile_id)

    total_rows = fetch_attempts(st.session_state.profile_id, only_errors=False)
    total = profile["total_attempts"]
    if total > 0:
        full_hits = sum(1 for row in total_rows if row["value_ok"] == 1 and row["function_ok"] == 1)
        st.write(f"Intentos totales: {total} | Acierto completo: {round(100 * full_hits / total, 1)}%")
    else:
        st.write("Sin intentos guardados todavia.")

    st.write(f"Mas dificiles (valor): {', '.join([row['label'] for row in profile['weak_values']]) or '-'}")
    st.write(f"Mas dificiles (funcion): {', '.join([row['label'] for row in profile['weak_functions']]) or '-'}")
    st.write(f"Mejores (valor): {', '.join([row['label'] for row in profile['strong_values']]) or '-'}")
    st.write(f"Mejores (funcion): {', '.join([row['label'] for row in profile['strong_functions']]) or '-'}")

    if profile["value_overview"] or profile["function_overview"]:
        st.write("Rendimiento exacto por valor y funcion")
        exact_rows: List[Dict[str, Any]] = []
        for row in profile["value_overview"]:
            exact_rows.append(
                {
                    "eje": "valor",
                    "item": row["label"],
                    "ok": row["ok"],
                    "fallos": row["fail"],
                    "intentos": row["attempts"],
                    "tasa_fallo": round(100 * row["fail_rate"], 1),
                }
            )
        for row in profile["function_overview"]:
            exact_rows.append(
                {
                    "eje": "funcion",
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
                    "par_valor_funcion": row["pair"],
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
    confirm = st.checkbox("Confirmo que quiero borrar todo el historial de este perfil")
    if st.button("Resetear historial", use_container_width=True, disabled=not confirm):
        reset_attempts(st.session_state.profile_id)
        st.success("Historial borrado.")


def render_settings_page() -> None:
    st.title("Ajustes")
    profile_input = st.text_input("Perfil", value=st.session_state.profile_id)

    st.subheader("Modelo Gemini")
    labels = [model["label"] for model in MODEL_OPTIONS]
    values = [model["value"] for model in MODEL_OPTIONS]
    current_model = st.session_state.model_name.strip()
    has_predefined = current_model in values

    selector_options = labels + ["Personalizado (manual)"]
    default_label = labels[values.index(current_model)] if has_predefined else "Personalizado (manual)"
    selected_label = st.selectbox(
        "Selecciona modelo",
        options=selector_options,
        index=selector_options.index(default_label),
    )

    custom_model = st.text_input(
        "Modelo personalizado (opcional)",
        value="" if has_predefined else current_model,
        disabled=selected_label != "Personalizado (manual)",
        placeholder="ej. gemini-2.5-flash-lite",
    )

    if selected_label == "Personalizado (manual)":
        resolved_model = custom_model.strip() or "gemini-2.5-flash-lite"
    else:
        resolved_model = MODEL_OPTIONS[labels.index(selected_label)]["value"]

    if st.button("Guardar ajustes", use_container_width=True):
        st.session_state.profile_id = profile_input.strip() or "alumno"
        st.session_state.model_name = resolved_model
        st.success("Ajustes guardados.")

    if st.session_state.model_name.strip().lower().startswith("gemma"):
        st.caption("Compatibilidad Gemma activa: sin developer instruction; se usa prompt inline.")

    has_key = bool(get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY"))
    st.write(f"API key Gemini: {'configurada' if has_key else 'no configurada (se usara modo local)'}")


def main() -> None:
    st.set_page_config(page_title="Sintaxis WebApp", page_icon="se", layout="wide")
    st.markdown(CSS, unsafe_allow_html=True)

    init_db()
    init_morfologia_db()
    ensure_state()
    ensure_morfologia_state()

    st.sidebar.title("Navegacion")
    section = st.sidebar.radio("Seccion", ["Valores del se", "Morfologia"])
    page_key = "se_nav_page" if section == "Valores del se" else "morf_nav_page"
    page = st.sidebar.radio("Ir a", ["Practicar", "Historial", "Ajustes"], key=page_key)

    if section == "Valores del se":
        st.sidebar.caption(f"Perfil: {st.session_state.profile_id}")
        st.sidebar.caption(f"Modelo: {st.session_state.model_name}")
        if page == "Practicar":
            render_practice_page()
        elif page == "Historial":
            render_history_page()
        else:
            render_settings_page()
    else:
        st.sidebar.caption(f"Perfil: {st.session_state.morf_profile_id}")
        st.sidebar.caption(f"Modelo: {st.session_state.morf_model_name}")
        if page == "Practicar":
            render_morfologia_practice_page()
        elif page == "Historial":
            render_morfologia_history_page()
        else:
            render_morfologia_settings_page()


if __name__ == "__main__":
    main()
