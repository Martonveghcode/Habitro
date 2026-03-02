import json
import os
import random
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

import streamlit as st

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
- Devuelve una unica frase por solicitud.
- Devuelve tambien la respuesta correcta (valor + funcion) y una explicacion breve.
- Incluye tipo de oracion.
- Ajusta dificultad:
  d1: estructura simple y muy transparente
  d2: estructura media con algo de ambiguedad controlada
  d3: estructura avanzada y analisis mas exigente
- Si se pasan focos o debilidades, priorizalos.
- NO devuelvas texto fuera de JSON.

Salida JSON exacta:
{
  "sentence": "string",
  "difficulty": 1,
  "se_value": "uno de los 7 valores",
  "se_function": "una funcion valida",
  "accepted_functions": ["lista de funciones aceptables, minimo 1"],
  "phrase_type": "descripcion corta del tipo de oracion",
  "explanation": "explicacion breve del por que"
}
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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_json(text: str) -> Dict[str, Any]:
    fenced = re.search(r"```json\s*(.*?)```", text, re.IGNORECASE | re.DOTALL)
    candidate = fenced.group(1).strip() if fenced else text.strip()
    match = re.search(r"\{.*\}$", candidate, re.DOTALL)
    if match:
        candidate = match.group(0)
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


def choose_sample(
    difficulty: int, focus_values: List[str], weakness_values: List[str]
) -> Dict[str, Any]:
    pool = SAMPLE_BANK[difficulty]
    target_values = focus_values or weakness_values
    if target_values:
        filtered = [item for item in pool if item["se_value"] in target_values]
        if filtered:
            pool = filtered
    return random.choice(pool)


def build_generation_prompt(
    difficulty: int,
    focus_values: List[str],
    weakness_values: List[str],
    weakness_functions: List[str],
) -> str:
    payload = {
        "task": "Generar una frase para practicar valores del se",
        "difficulty": difficulty,
        "focus_values": focus_values,
        "weakness_values": weakness_values,
        "weakness_functions": weakness_functions,
        "allowed_values": VALORES_SE,
        "allowed_functions": FUNCIONES_SE,
        "constraints": {
            "must_contain_se": True,
            "one_phrase_only": True,
            "difficulty_profile": {
                "1": "frase corta y muy transparente",
                "2": "frase de complejidad media",
                "3": "frase mas compleja y exigente",
            },
        },
        "output_schema": {
            "sentence": "string",
            "difficulty": "1|2|3",
            "se_value": "one_of_allowed_values",
            "se_function": "one_of_allowed_functions",
            "accepted_functions": ["one_or_more_allowed_functions"],
            "phrase_type": "string",
            "explanation": "string_short",
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def generate_with_llm(
    difficulty: int,
    focus_values: List[str],
    weakness_values: List[str],
    weakness_functions: List[str],
    model_name: str,
) -> Dict[str, Any]:
    api_key = get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY")
    if not api_key:
        return choose_sample(difficulty, focus_values, weakness_values)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=SYSTEM_PROMPT,
        )
        prompt = build_generation_prompt(difficulty, focus_values, weakness_values, weakness_functions)
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.4,
                "response_mime_type": "application/json",
            },
        )
        parsed = extract_json(response.text)
        normalized = {
            "sentence": str(parsed.get("sentence", "")).strip(),
            "difficulty": int(parsed.get("difficulty", difficulty)),
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

        if (
            " se " not in f" {normalized['sentence'].lower()} "
            and "se " not in normalized["sentence"].lower()
            and " se" not in normalized["sentence"].lower()
        ):
            return choose_sample(difficulty, focus_values, weakness_values)

        if normalized["se_value"] not in VALORES_SE:
            return choose_sample(difficulty, focus_values, weakness_values)

        if normalized["se_function"] not in FUNCIONES_SE:
            return choose_sample(difficulty, focus_values, weakness_values)

        return normalized
    except Exception as error:
        st.warning(f"LLM no disponible ahora. Uso modo local. Detalle: {error}")
        return choose_sample(difficulty, focus_values, weakness_values)


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


def weakness_summary(profile_id: str) -> Dict[str, List[str]]:
    with sqlite3.connect(DB_PATH) as conn:
        value_rows = conn.execute(
            """
            SELECT expected_value, COUNT(*) AS misses
            FROM attempts
            WHERE profile_id = ? AND value_ok = 0
            GROUP BY expected_value
            ORDER BY misses DESC
            LIMIT 3
            """,
            (profile_id,),
        ).fetchall()
        fn_rows = conn.execute(
            """
            SELECT expected_function, COUNT(*) AS misses
            FROM attempts
            WHERE profile_id = ? AND function_ok = 0
            GROUP BY expected_function
            ORDER BY misses DESC
            LIMIT 3
            """,
            (profile_id,),
        ).fetchall()
    return {
        "values": [row[0] for row in value_rows],
        "functions": [row[0] for row in fn_rows],
    }


def ensure_state() -> None:
    if "profile_id" not in st.session_state:
        st.session_state.profile_id = "alumno"
    if "model_name" not in st.session_state:
        st.session_state.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    if "current_item" not in st.session_state:
        st.session_state.current_item = None
    if "checked_item_id" not in st.session_state:
        st.session_state.checked_item_id = None
    if "hide_history" not in st.session_state:
        st.session_state.hide_history = False


def render_practice_page() -> None:
    st.title("Practica de Valores del se")
    st.caption("Generacion y correccion en una sola respuesta del modelo.")

    difficulty = st.select_slider("Dificultad", options=[1, 2, 3], value=2)
    personalized = st.toggle("Modo personalizado", value=True)
    focus_values = st.multiselect("Foco (opcional)", VALORES_SE, default=[])

    weak = weakness_summary(st.session_state.profile_id)
    if personalized and (weak["values"] or weak["functions"]):
        st.write(
            f"Refuerzo activo: valores {', '.join(weak['values']) or '-'} | funciones {', '.join(weak['functions']) or '-'}"
        )

    if st.button("Generar frase", use_container_width=True):
        item = generate_with_llm(
            difficulty=difficulty,
            focus_values=focus_values,
            weakness_values=weak["values"] if personalized else [],
            weakness_functions=weak["functions"] if personalized else [],
            model_name=st.session_state.model_name,
        )
        item["id"] = str(uuid.uuid4())
        st.session_state.current_item = item
        st.session_state.checked_item_id = None

    item = st.session_state.current_item
    if not item:
        st.info("Genera una frase para empezar.")
        return

    st.subheader("Frase")
    st.markdown(f"### {item['sentence']}")

    guessed_value = st.radio("Que valor de 'se' tiene?", VALORES_SE, index=0)
    guessed_function = st.selectbox("Funcion de 'se' en esta frase", FUNCIONES_SE, index=0)

    if st.button("Comprobar respuesta", use_container_width=True):
        value_ok = guessed_value == item["se_value"]
        fn_ok = guessed_function in item.get("accepted_functions", [item["se_function"]])
        overall_ok = value_ok and fn_ok

        st.markdown("### Resultado")
        st.markdown(
            f"- Valor: "
            + (
                f"<span class='result-ok'>correcto</span>"
                if value_ok
                else f"<span class='result-bad'>incorrecto</span> (correcto: {item['se_value']})"
            ),
            unsafe_allow_html=True,
        )
        st.markdown(
            f"- Funcion: "
            + (
                f"<span class='result-ok'>correcta</span>"
                if fn_ok
                else f"<span class='result-bad'>incorrecta</span> (correcta: {item['se_function']})"
            ),
            unsafe_allow_html=True,
        )
        st.markdown(
            f"- Estado global: "
            + (
                "<span class='result-ok'>acierto</span>"
                if overall_ok
                else "<span class='result-bad'>revisar</span>"
            ),
            unsafe_allow_html=True,
        )

        st.markdown("### Explicacion breve")
        st.write(item["phrase_type"])
        st.write(item["explanation"])

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
                    "mode": "personalizado" if personalized else "normal",
                }
            )
            st.session_state.checked_item_id = item["id"]


def render_history_page() -> None:
    st.title("Historial de errores")

    st.session_state.hide_history = st.toggle("Ocultar historial en esta sesion", value=st.session_state.hide_history)
    if st.session_state.hide_history:
        st.info("Historial oculto. Desactiva el toggle para verlo.")
        return

    only_errors = st.toggle("Mostrar solo fallos", value=True)
    rows = fetch_attempts(st.session_state.profile_id, only_errors=only_errors)

    total_rows = fetch_attempts(st.session_state.profile_id, only_errors=False)
    total = len(total_rows)
    if total > 0:
        full_hits = sum(1 for row in total_rows if row["value_ok"] == 1 and row["function_ok"] == 1)
        st.write(f"Intentos totales: {total} | Acierto completo: {round(100 * full_hits / total, 1)}%")
    else:
        st.write("Sin intentos guardados todavia.")

    weak = weakness_summary(st.session_state.profile_id)
    st.write(f"Mas dificiles (valor): {', '.join(weak['values']) or '-'}")
    st.write(f"Mas dificiles (funcion): {', '.join(weak['functions']) or '-'}")

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
    model_input = st.text_input("Modelo Gemini", value=st.session_state.model_name)

    if st.button("Guardar ajustes", use_container_width=True):
        st.session_state.profile_id = profile_input.strip() or "alumno"
        st.session_state.model_name = model_input.strip() or "gemini-2.5-flash-lite"
        st.success("Ajustes guardados.")

    has_key = bool(get_secret_or_env("GEMINI_API_KEY", "GEMINI_API_KEY"))
    st.write(f"API key Gemini: {'configurada' if has_key else 'no configurada (se usara modo local)'}")


def main() -> None:
    st.set_page_config(page_title="Valores del se", page_icon="se", layout="wide")
    st.markdown(CSS, unsafe_allow_html=True)

    init_db()
    ensure_state()

    st.sidebar.title("Navegacion")
    page = st.sidebar.radio("Ir a", ["Practicar", "Historial", "Ajustes"])
    st.sidebar.caption(f"Perfil: {st.session_state.profile_id}")
    st.sidebar.caption(f"Modelo: {st.session_state.model_name}")

    if page == "Practicar":
        render_practice_page()
    elif page == "Historial":
        render_history_page()
    else:
        render_settings_page()


if __name__ == "__main__":
    main()
