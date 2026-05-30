# Question Import Formats

The manual uploader accepts either:

```json
{ "items": [ ... ] }
```

or a raw JSON array:

```json
[ ... ]
```

Use strict JSON only. No Markdown fences, comments, or trailing commas. The app accepts both snake_case and camelCase field names, but these snake_case formats match the generator prompts.

## Valores Del Se

Required item shape:

```json
{
  "sentence": "Se venden pisos en este barrio.",
  "difficulty": 2,
  "se_value": "Pasiva refleja",
  "se_function": "Marca de pasiva",
  "accepted_functions": ["Marca de pasiva", "Sin funcion sintactica propia"],
  "verbal_structure": "Verbo simple",
  "periphrasis_type": "No aplica",
  "phrase_type": "Oracion simple pasiva refleja",
  "explanation": "El verbo concuerda con el sujeto paciente 'pisos'."
}
```

Allowed `difficulty`: `1`, `2`, `3`.

Allowed `se_value`:

```json
[
  "Reflexivo",
  "Reciproco",
  "Sustitucion (le -> se)",
  "Pronominal",
  "Pasiva refleja",
  "Impersonal",
  "Accidental (dativo de interes)"
]
```

Allowed `se_function` and `accepted_functions` values:

```json
[
  "CD",
  "CI",
  "Sin funcion sintactica propia",
  "Morfema verbal",
  "Marca de pasiva",
  "Marca de impersonal"
]
```

Allowed `verbal_structure`:

```json
["Verbo simple", "Perifrasis verbal", "Locucion verbal", "Dos verbos"]
```

Allowed `periphrasis_type`:

```json
[
  "No aplica",
  "Modal obligativa",
  "Modal de posibilidad",
  "Aspectual ingresiva",
  "Aspectual incoativa",
  "Aspectual durativa",
  "Aspectual terminativa",
  "Aspectual reiterativa",
  "Aspectual resultativa",
  "Aspectual habitual"
]
```

## Perifrasis

Required item shape:

```json
{
  "sentence": "Debes entregar el informe antes del viernes.",
  "difficulty": 2,
  "verbal_structure": "Perifrasis verbal",
  "periphrasis_type": "Modal obligativa",
  "phrase_type": "Oracion simple predicativa",
  "explanation": "'Deber + infinitivo' expresa obligacion."
}
```

Allowed `difficulty`: `1`, `2`, `3`.

Allowed `verbal_structure`:

```json
["Perifrasis verbal", "Locucion verbal", "Dos verbos"]
```

Allowed `periphrasis_type`:

```json
[
  "No aplica",
  "Modal obligativa",
  "Modal de posibilidad",
  "Aspectual ingresiva",
  "Aspectual incoativa",
  "Aspectual durativa",
  "Aspectual terminativa",
  "Aspectual reiterativa",
  "Aspectual resultativa",
  "Aspectual habitual"
]
```

Rule: if `verbal_structure` is `"Perifrasis verbal"`, `periphrasis_type` must not be `"No aplica"`. If `verbal_structure` is `"Locucion verbal"` or `"Dos verbos"`, `periphrasis_type` must be exactly `"No aplica"`.

## Morfologia

Required item shape:

```json
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
    "Morfema flexivo nominal (numero)"
  ],
  "analysis_type": "Adjetivo con derivacion y flexion",
  "explanation": "Prefijo des- + lexema orden + sufijo -ad- + flexivos -o y -s."
}
```

Allowed `difficulty`: `1`, `2`, `3`.

Allowed `word_type`:

```json
["Sustantivo", "Adjetivo", "Verbo", "Adverbio"]
```

Allowed `morpheme_types`:

```json
[
  "Prefijo derivativo",
  "Interfijo",
  "Sufijo derivativo",
  "Morfema flexivo nominal (genero)",
  "Morfema flexivo nominal (numero)",
  "Vocal tematica",
  "Morfema flexivo verbal (tiempo/modo/aspecto)",
  "Morfema flexivo verbal (persona/numero)"
]
```

Rules:

- `accepted_lexemes` must include the exact `lexeme`.
- `morphemes` must not include the lexeme.
- `morphemes` and `morpheme_types` must have the same length and matching order.
- Do not put decorative boundary hyphens in `morphemes`.
- The app validates that the word rebuilds as prefixes + lexeme + remaining morphemes.
- For `word_type: "Verbo"`, use only personal conjugated forms, not infinitives, gerunds, or participles.

## General Sintaxis Sentence Generator

This is the older sentence-generation response shape used by the syntax workspace code:

```json
{
  "sentence": "La alumna resolvio el problema con calma.",
  "tokens": ["La", "alumna", "resolvio", "el", "problema", "con", "calma", "."],
  "targetFeatures": ["Oracion simple", "CD", "CC modo"],
  "appliedPolicies": {
    "punctuationSimplified": true
  }
}
```

The manual uploader added in the React app is for the three active sections: valores del se, perifrasis, and morfologia.

## Prompt Template For ChatGPT

Ask:

```text
Generate 20 high-quality items for [valores del se/perifrasis/morfologia].
Return only strict JSON in this exact shape:
{ "items": [ ... ] }
Use only the allowed labels listed below.
Every item must be grammatically correct, non-duplicated, and internally consistent.
No Markdown, no prose, no comments.
[paste the relevant section format and allowed label lists]
```
