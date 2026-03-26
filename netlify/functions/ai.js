import { z } from "zod";

const SE_VALUES = [
  "Reflexivo",
  "Reciproco",
  "Sustitucion (le -> se)",
  "Pronominal",
  "Pasiva refleja",
  "Impersonal",
  "Accidental (dativo de interes)",
];

const SE_FUNCTIONS = [
  "CD",
  "CI",
  "Sin funcion sintactica propia",
  "Morfema verbal",
  "Marca de pasiva",
  "Marca de impersonal",
];

const SE_VERBAL_STRUCTURES = ["Verbo simple", "Perifrasis verbal", "Locucion verbal", "Dos verbos"];

const SE_PERIPHRASIS_TYPES = [
  "No aplica",
  "Modal obligativa",
  "Modal de posibilidad",
  "Aspectual ingresiva",
  "Aspectual incoativa",
  "Aspectual durativa",
  "Aspectual terminativa",
  "Aspectual reiterativa",
  "Aspectual resultativa",
  "Aspectual habitual",
];

const MORFO_WORD_TYPES = ["Sustantivo", "Adjetivo", "Verbo", "Adverbio"];

const MORFO_MORPHEME_TYPES = [
  "Prefijo derivativo",
  "Interfijo",
  "Sufijo derivativo",
  "Morfema flexivo nominal (genero)",
  "Morfema flexivo nominal (numero)",
  "Vocal tematica",
  "Morfema flexivo verbal (tiempo/modo/aspecto)",
  "Morfema flexivo verbal (persona/numero)",
];

const BASE_MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

const SE_SYSTEM_PROMPT = `
Eres PROFE SINTAXIS en modo especializado en valores de "se".
Debes generar solo frases para practicar VALORES DEL SE.

Los valores y funciones exactos llegan en el JSON del usuario como allowed_values y allowed_functions.
Tambien debes clasificar cada frase por:
- verbal_structure: Verbo simple, Perifrasis verbal, Locucion verbal o Dos verbos
- periphrasis_type: tipo exacto de la perifrasis si la hay; si NO hay perifrasis, usa exactamente "No aplica"

Reglas obligatorias:
- La frase debe contener "se" de forma clara.
- Si se solicita batch_size > 1, devuelve exactamente ese numero de frases.
- Devuelve tambien la respuesta correcta (valor + funcion + analisis verbal) y una explicacion breve.
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
`;

const SE_RECHECK_PROMPT = `
Eres un verificador estricto de gramatica espanola para "valores del se".
Recibes una frase y la respuesta propuesta por otro modelo, incluyendo el analisis de construccion verbal.
Tu tarea es decidir si la respuesta propuesta es correcta.
Devuelve SOLO JSON valido.
`;

const SE_QUESTION_PROMPT = `
Eres un profesor breve y claro de sintaxis espanola centrado en "valores del se".
Responde a la pregunta del usuario sobre una frase concreta.
Manten la respuesta corta y util (maximo 6 lineas).
`;

const MORFO_SYSTEM_PROMPT = `
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
- Vocal tematica
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
`;

const MORFO_RECHECK_PROMPT = `
Eres un verificador estricto de morfologia espanola.
Recibes una palabra y el analisis propuesto por otro modelo.
Tu tarea es decidir si la propuesta es correcta.
Devuelve SOLO JSON valido.
`;

const MORFO_QUESTION_PROMPT = `
Eres un profesor breve y claro de morfologia espanola.
Responde a la pregunta del usuario sobre una palabra concreta.
Manten la respuesta corta y util (maximo 6 lineas).
`;

const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const strategyModeSchema = z.enum(["normal", "personalizado_mixto", "personalizado_objetivo", "foco_usuario"]);

const seStrategySchema = z.object({
  mode: strategyModeSchema,
  targeted: z.boolean(),
  focusValues: z.array(z.string()).default([]),
  targetValue: z.string().default(""),
  targetFunction: z.string().default(""),
  ratioHint: z.string().default(""),
});

const morfoStrategySchema = z.object({
  mode: strategyModeSchema,
  targeted: z.boolean(),
  focusWordTypes: z.array(z.string()).default([]),
  targetWordType: z.string().default(""),
  targetMorphemeType: z.string().default(""),
  ratioHint: z.string().default(""),
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate-se"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      difficulty: difficultySchema,
      strategies: z.array(seStrategySchema).min(1),
      profile: z.unknown(),
      recentSentences: z.array(z.string()).default([]),
      recentLabels: z
        .array(
          z.object({
            value: z.string(),
            function: z.string(),
            verbalStructure: z.string().default(""),
            periphrasisType: z.string().default(""),
          }),
        )
        .default([]),
      allowedValues: z.array(z.string()).min(1).default(SE_VALUES),
      allowedFunctions: z.array(z.string()).min(1).default(SE_FUNCTIONS),
      allowedVerbalStructures: z.array(z.string()).min(1).default(SE_VERBAL_STRUCTURES),
      allowedPeriphrasisTypes: z.array(z.string()).min(1).default(SE_PERIPHRASIS_TYPES),
    }),
  }),
  z.object({
    action: z.literal("generate-morfo"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      difficulty: difficultySchema,
      strategies: z.array(morfoStrategySchema).min(1),
      profile: z.unknown(),
      recentWords: z.array(z.string()).default([]),
      recentLabels: z.array(z.object({ wordType: z.string(), morphemeType: z.string() })).default([]),
    }),
  }),
  z.object({
    action: z.literal("recheck-se"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      sentence: z.string().min(1),
      seValue: z.string().min(1),
      seFunction: z.string().min(1),
      acceptedFunctions: z.array(z.string()).default([]),
      verbalStructure: z.string().min(1),
      periphrasisType: z.string().min(1),
      phraseType: z.string().min(1),
      explanation: z.string().min(1),
      allowedValues: z.array(z.string()).min(1).default(SE_VALUES),
      allowedFunctions: z.array(z.string()).min(1).default(SE_FUNCTIONS),
      allowedVerbalStructures: z.array(z.string()).min(1).default(SE_VERBAL_STRUCTURES),
      allowedPeriphrasisTypes: z.array(z.string()).min(1).default(SE_PERIPHRASIS_TYPES),
    }),
  }),
  z.object({
    action: z.literal("recheck-morfo"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      word: z.string().min(1),
      wordType: z.string().min(1),
      lexeme: z.string().min(1),
      morphemes: z.array(z.string()).default([]),
      morphemeTypes: z.array(z.string()).default([]),
      analysisType: z.string().min(1),
      explanation: z.string().min(1),
    }),
  }),
  z.object({
    action: z.literal("question-se"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      item: z.object({
        sentence: z.string().min(1),
        seValue: z.string().min(1),
        seFunction: z.string().min(1),
        verbalStructure: z.string().min(1),
        periphrasisType: z.string().min(1),
        phraseType: z.string().min(1),
        explanation: z.string().min(1),
      }),
      question: z.string().min(1),
      recheckResult: z.unknown().optional(),
    }),
  }),
  z.object({
    action: z.literal("question-morfo"),
    modelName: z.string().trim().optional(),
    payload: z.object({
      item: z.object({
        word: z.string().min(1),
        wordType: z.string().min(1),
        lexeme: z.string().min(1),
        morphemes: z.array(z.string()).default([]),
        morphemeTypes: z.array(z.string()).default([]),
        analysisType: z.string().min(1),
        explanation: z.string().min(1),
      }),
      question: z.string().min(1),
      recheckResult: z.unknown().optional(),
    }),
  }),
]);

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildModelCandidates(requestedModel) {
  const preferredModel = requestedModel?.trim() || process.env.GEMINI_MODEL?.trim() || "";
  return Array.from(new Set([preferredModel, ...BASE_MODEL_FALLBACKS].filter(Boolean)));
}

function extractTextFromGeminiResponse(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  let candidate = fenced?.[1]?.trim() || text.trim();
  if (!(candidate.startsWith("{") || candidate.startsWith("["))) {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    const arrayMatch = candidate.match(/\[[\s\S]*\]/);
    if (objectMatch && arrayMatch) {
      candidate = objectMatch.index <= arrayMatch.index ? objectMatch[0] : arrayMatch[0];
    } else if (objectMatch) {
      candidate = objectMatch[0];
    } else if (arrayMatch) {
      candidate = arrayMatch[0];
    }
  }
  return JSON.parse(candidate);
}

async function callGemini({ apiKey, modelName, systemPrompt, userPrompt, temperature, expectJson }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature,
          ...(expectJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed with status ${response.status}.`;
    throw new Error(message);
  }

  const text = extractTextFromGeminiResponse(payload);
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

async function requestWithFallback({ apiKey, requestedModel, systemPrompt, userPrompt, temperature = 0.25, expectJson = false }) {
  let lastError = new Error("No Gemini model could satisfy the request.");
  for (const modelName of buildModelCandidates(requestedModel)) {
    try {
      return {
        model: modelName,
        text: await callGemini({
          apiKey,
          modelName,
          systemPrompt,
          userPrompt,
          temperature,
          expectJson,
        }),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError;
}

function extractCandidateItems(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object");
  }
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      return payload.items.filter((item) => item && typeof item === "object");
    }
    return [payload];
  }
  return [];
}

function normalizeFunctionLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  const mapping = {
    cd: "CD",
    ci: "CI",
    "sin funcion": "Sin funcion sintactica propia",
    "sin funcion sintactica propia": "Sin funcion sintactica propia",
    "morfema verbal": "Morfema verbal",
    "marca de pasiva": "Marca de pasiva",
    "marca de impersonal": "Marca de impersonal",
  };
  return mapping[key] || String(value || "").trim();
}

function normalizeTextToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeLabelAgainstOptions(value, options) {
  const raw = String(value || "").trim();
  const key = normalizeTextToken(raw);
  const match = options.find((item) => normalizeTextToken(item) === key);
  return match || raw;
}

function normalizeMorphemeType(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  const match = MORFO_MORPHEME_TYPES.find((item) => item.toLowerCase() === normalized);
  return match || raw;
}

function normalizeSeItem(item, difficulty, strategy, options) {
  const acceptedFunctions = Array.isArray(item.accepted_functions ?? item.acceptedFunctions)
    ? (item.accepted_functions ?? item.acceptedFunctions).map((entry) => normalizeFunctionLabel(entry)).filter(Boolean)
    : [];
  const seFunction = normalizeFunctionLabel(item.se_function ?? item.seFunction);
  return {
    sentence: String(item.sentence || "").trim(),
    difficulty: Number(item.difficulty || difficulty),
    seValue: normalizeLabelAgainstOptions(item.se_value ?? item.seValue, options.allowedValues),
    seFunction,
    acceptedFunctions: acceptedFunctions.length > 0 ? acceptedFunctions : seFunction ? [seFunction] : [],
    verbalStructure: normalizeLabelAgainstOptions(item.verbal_structure ?? item.verbalStructure, options.allowedVerbalStructures),
    periphrasisType: normalizeLabelAgainstOptions(item.periphrasis_type ?? item.periphrasisType, options.allowedPeriphrasisTypes),
    phraseType: String(item.phrase_type ?? item.phraseType ?? "").trim(),
    explanation: String(item.explanation || "").trim(),
    mode: strategy.mode,
  };
}

function normalizeMorfoItem(item, difficulty, strategy) {
  const morphemes = Array.isArray(item.morphemes) ? item.morphemes.map((entry) => String(entry).trim()).filter(Boolean) : [];
  const morphemeTypes = Array.isArray(item.morpheme_types)
    ? item.morpheme_types.map((entry) => normalizeMorphemeType(entry)).filter(Boolean)
    : [];
  return {
    word: String(item.word || "").trim(),
    difficulty: Number(item.difficulty || difficulty),
    wordType: String(item.word_type || "").trim(),
    lexeme: String(item.lexeme || "").trim(),
    acceptedLexemes: Array.isArray(item.accepted_lexemes)
      ? item.accepted_lexemes.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    morphemes,
    morphemeTypes,
    analysisType: String(item.analysis_type || "").trim(),
    explanation: String(item.explanation || "").trim(),
    mode: strategy.mode,
  };
}

function buildSeGenerationPrompt(payload) {
  const recentValues = payload.recentLabels.map((entry) => entry.value);
  const recentFunctions = payload.recentLabels.map((entry) => entry.function);
  const recentStructures = payload.recentLabels.map((entry) => entry.verbalStructure).filter(Boolean);
  const recentPeriphrasisTypes = payload.recentLabels.map((entry) => entry.periphrasisType).filter(Boolean);
  const avoidValues = recentValues.length >= 2 && recentValues[0] === recentValues[1] ? [recentValues[0]] : [];
  const avoidFunctions =
    recentFunctions.length >= 3 && new Set(recentFunctions.slice(0, 3)).size === 1 ? [recentFunctions[0]] : [];
  const avoidStructures =
    recentStructures.length >= 2 && recentStructures[0] === recentStructures[1] ? [recentStructures[0]] : [];
  const avoidPeriphrasisTypes =
    recentPeriphrasisTypes.length >= 2 && recentPeriphrasisTypes[0] === recentPeriphrasisTypes[1]
      ? [recentPeriphrasisTypes[0]]
      : [];

  return JSON.stringify(
    {
      task: "Generar un lote de frases para practicar valores del se",
      difficulty: payload.difficulty,
      batch_size: payload.strategies.length,
      generation_strategy: {
        schedule: payload.strategies.map((strategy, index) => ({
          slot: index + 1,
          mode: strategy.mode,
          targeted: strategy.targeted,
          target_value: strategy.targetValue || null,
          target_function: strategy.targetFunction || null,
          focus_values: strategy.focusValues,
        })),
        ratio_hint: payload.strategies[0]?.ratioHint || "sin ratio",
      },
      learning_profile: payload.profile,
      allowed_values: payload.allowedValues,
      allowed_functions: payload.allowedFunctions,
      allowed_verbal_structures: payload.allowedVerbalStructures,
      allowed_periphrasis_types: payload.allowedPeriphrasisTypes,
      anti_repetition: {
        avoid_recent_sentences: payload.recentSentences,
        avoid_values_temporarily: avoidValues,
        avoid_functions_temporarily: avoidFunctions,
        avoid_verbal_structures_temporarily: avoidStructures,
        avoid_periphrasis_types_temporarily: avoidPeriphrasisTypes,
        must_be_semantically_distinct: true,
        do_not_repeat_main_verb_or_frame: true,
      },
      batch_diversity_rules: {
        different_main_verbs_per_item: true,
        vary_subject_and_context: true,
        avoid_only_single_word_changes: true,
        vary_sentence_length: true,
      },
      constraints: {
        must_contain_se: true,
        must_return_exact_count: payload.strategies.length,
        no_internal_duplicates: true,
      },
      output_schema: {
        items: [
          {
            sentence: "string",
            difficulty: "1|2|3",
            se_value: "one_of_allowed_values",
            se_function: "one_of_allowed_functions",
            accepted_functions: ["one_or_more_allowed_functions"],
            verbal_structure: "one_of_allowed_verbal_structures",
            periphrasis_type: "one_of_allowed_periphrasis_types",
            phrase_type: "string",
            explanation: "string_short",
          },
        ],
      },
    },
    null,
    2,
  );
}

function buildMorfoGenerationPrompt(payload) {
  const recentWordTypes = payload.recentLabels.map((entry) => entry.wordType);
  const recentMorphemeTypes = payload.recentLabels.map((entry) => entry.morphemeType);
  const avoidWordTypes = recentWordTypes.length >= 2 && recentWordTypes[0] === recentWordTypes[1] ? [recentWordTypes[0]] : [];
  const avoidMorphemeTypes =
    recentMorphemeTypes.length >= 3 && new Set(recentMorphemeTypes.slice(0, 3)).size === 1 ? [recentMorphemeTypes[0]] : [];

  return JSON.stringify(
    {
      task: "Generar un lote de palabras para practicar morfologia",
      difficulty: payload.difficulty,
      batch_size: payload.strategies.length,
      generation_strategy: {
        schedule: payload.strategies.map((strategy, index) => ({
          slot: index + 1,
          mode: strategy.mode,
          targeted: strategy.targeted,
          target_word_type: strategy.targetWordType || null,
          target_morpheme_type: strategy.targetMorphemeType || null,
          focus_word_types: strategy.focusWordTypes,
        })),
        ratio_hint: payload.strategies[0]?.ratioHint || "sin ratio",
      },
      learning_profile: payload.profile,
      allowed_word_types: MORFO_WORD_TYPES,
      allowed_morpheme_types: MORFO_MORPHEME_TYPES,
      anti_repetition: {
        avoid_recent_words: payload.recentWords,
        avoid_word_types_temporarily: avoidWordTypes,
        avoid_morpheme_types_temporarily: avoidMorphemeTypes,
        avoid_same_word_family: true,
      },
      constraints: {
        must_return_exact_count: payload.strategies.length,
        no_internal_duplicates: true,
      },
      output_schema: {
        items: [
          {
            word: "string",
            difficulty: "1|2|3",
            word_type: "one_of_allowed_word_types",
            lexeme: "string",
            accepted_lexemes: ["one_or_more_strings"],
            morphemes: ["string"],
            morpheme_types: ["one_or_more_allowed_morpheme_types"],
            analysis_type: "string",
            explanation: "string_short",
          },
        ],
      },
    },
    null,
    2,
  );
}

async function handleGenerateSe(apiKey, requestBody) {
  const prompt = buildSeGenerationPrompt(requestBody.payload);
  const result = await requestWithFallback({
    apiKey,
    requestedModel: requestBody.modelName,
    systemPrompt: SE_SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.78,
    expectJson: true,
  });

  const parsed = extractJson(result.text);
  const items = extractCandidateItems(parsed)
    .slice(0, requestBody.payload.strategies.length)
    .map((item, index) =>
      normalizeSeItem(item, requestBody.payload.difficulty, requestBody.payload.strategies[index], {
        allowedValues: requestBody.payload.allowedValues,
        allowedVerbalStructures: requestBody.payload.allowedVerbalStructures,
        allowedPeriphrasisTypes: requestBody.payload.allowedPeriphrasisTypes,
      }),
    )
    .filter(
      (item) =>
        item.sentence &&
        item.seValue &&
        item.seFunction &&
        item.verbalStructure &&
        item.periphrasisType &&
        item.phraseType &&
        item.explanation &&
        requestBody.payload.allowedValues.includes(item.seValue) &&
        requestBody.payload.allowedFunctions.includes(item.seFunction) &&
        requestBody.payload.allowedVerbalStructures.includes(item.verbalStructure) &&
        requestBody.payload.allowedPeriphrasisTypes.includes(item.periphrasisType),
    );

  return jsonResponse(200, { model: result.model, items });
}

async function handleGenerateMorfo(apiKey, requestBody) {
  const prompt = buildMorfoGenerationPrompt(requestBody.payload);
  const result = await requestWithFallback({
    apiKey,
    requestedModel: requestBody.modelName,
    systemPrompt: MORFO_SYSTEM_PROMPT,
    userPrompt: prompt,
    temperature: 0.78,
    expectJson: true,
  });

  const parsed = extractJson(result.text);
  const items = extractCandidateItems(parsed)
    .slice(0, requestBody.payload.strategies.length)
    .map((item, index) => normalizeMorfoItem(item, requestBody.payload.difficulty, requestBody.payload.strategies[index]))
    .filter(
      (item) =>
        item.word &&
        item.wordType &&
        item.lexeme &&
        item.analysisType &&
        item.explanation &&
        MORFO_WORD_TYPES.includes(item.wordType) &&
        item.morphemeTypes.every((entry) => MORFO_MORPHEME_TYPES.includes(entry)),
    );

  return jsonResponse(200, { model: result.model, items });
}

async function handleSeRecheck(apiKey, requestBody) {
  const prompt = JSON.stringify(
    {
      sentence: requestBody.payload.sentence,
      proposed_answer: {
        se_value: requestBody.payload.seValue,
        se_function: requestBody.payload.seFunction,
        accepted_functions:
          requestBody.payload.acceptedFunctions.length > 0 ? requestBody.payload.acceptedFunctions : [requestBody.payload.seFunction],
        verbal_structure: requestBody.payload.verbalStructure,
        periphrasis_type: requestBody.payload.periphrasisType,
        phrase_type: requestBody.payload.phraseType,
        explanation: requestBody.payload.explanation,
      },
      allowed_values: requestBody.payload.allowedValues,
      allowed_functions: requestBody.payload.allowedFunctions,
      allowed_verbal_structures: requestBody.payload.allowedVerbalStructures,
      allowed_periphrasis_types: requestBody.payload.allowedPeriphrasisTypes,
      task: "Verificar si la respuesta propuesta es correcta para la frase.",
      output_schema: {
        is_correct: "boolean",
        corrected_value: "one_of_allowed_values",
        corrected_function: "one_of_allowed_functions",
        corrected_verbal_structure: "one_of_allowed_verbal_structures",
        corrected_periphrasis_type: "one_of_allowed_periphrasis_types",
        issues: ["lista corta de problemas encontrados"],
        correction_note: "explicacion breve",
      },
    },
    null,
    2,
  );

  const result = await requestWithFallback({
    apiKey,
    requestedModel: requestBody.modelName,
    systemPrompt: SE_RECHECK_PROMPT,
    userPrompt: prompt,
    temperature: 0.15,
    expectJson: true,
  });

  const parsed = extractJson(result.text);
  const correctedValue = requestBody.payload.allowedValues.includes(normalizeLabelAgainstOptions(parsed.corrected_value, requestBody.payload.allowedValues))
    ? normalizeLabelAgainstOptions(parsed.corrected_value, requestBody.payload.allowedValues)
    : requestBody.payload.seValue;
  const correctedFunction = requestBody.payload.allowedFunctions.includes(normalizeFunctionLabel(parsed.corrected_function))
    ? normalizeFunctionLabel(parsed.corrected_function)
    : requestBody.payload.seFunction;
  const correctedVerbalStructure = requestBody.payload.allowedVerbalStructures.includes(
    normalizeLabelAgainstOptions(parsed.corrected_verbal_structure, requestBody.payload.allowedVerbalStructures),
  )
    ? normalizeLabelAgainstOptions(parsed.corrected_verbal_structure, requestBody.payload.allowedVerbalStructures)
    : requestBody.payload.verbalStructure;
  const correctedPeriphrasisType = requestBody.payload.allowedPeriphrasisTypes.includes(
    normalizeLabelAgainstOptions(parsed.corrected_periphrasis_type, requestBody.payload.allowedPeriphrasisTypes),
  )
    ? normalizeLabelAgainstOptions(parsed.corrected_periphrasis_type, requestBody.payload.allowedPeriphrasisTypes)
    : requestBody.payload.periphrasisType;

  return jsonResponse(200, {
    success: true,
    model: result.model,
    isCorrect: Boolean(parsed.is_correct),
    correctedValue,
    correctedFunction,
    correctedVerbalStructure,
    correctedPeriphrasisType,
    issues: Array.isArray(parsed.issues) ? parsed.issues.map((entry) => String(entry).trim()).filter(Boolean) : [],
    correctionNote: String(parsed.correction_note || "").trim(),
  });
}

async function handleMorfoRecheck(apiKey, requestBody) {
  const prompt = JSON.stringify(
    {
      word: requestBody.payload.word,
      proposed_answer: {
        word_type: requestBody.payload.wordType,
        lexeme: requestBody.payload.lexeme,
        morphemes: requestBody.payload.morphemes,
        morpheme_types: requestBody.payload.morphemeTypes,
        analysis_type: requestBody.payload.analysisType,
        explanation: requestBody.payload.explanation,
      },
      allowed_word_types: MORFO_WORD_TYPES,
      allowed_morpheme_types: MORFO_MORPHEME_TYPES,
      task: "Verificar si la respuesta propuesta es correcta para la palabra.",
      output_schema: {
        is_correct: "boolean",
        corrected_word_type: "one_of_allowed_word_types",
        corrected_lexeme: "string",
        corrected_morphemes: ["string"],
        corrected_morpheme_types: ["one_or_more_allowed_morpheme_types"],
        issues: ["lista corta de problemas encontrados"],
        correction_note: "explicacion breve",
      },
    },
    null,
    2,
  );

  const result = await requestWithFallback({
    apiKey,
    requestedModel: requestBody.modelName,
    systemPrompt: MORFO_RECHECK_PROMPT,
    userPrompt: prompt,
    temperature: 0.15,
    expectJson: true,
  });

  const parsed = extractJson(result.text);
  const correctedWordType = MORFO_WORD_TYPES.includes(parsed.corrected_word_type)
    ? parsed.corrected_word_type
    : requestBody.payload.wordType;
  const correctedMorphemes = Array.isArray(parsed.corrected_morphemes)
    ? parsed.corrected_morphemes.map((entry) => String(entry).trim()).filter(Boolean)
    : requestBody.payload.morphemes;
  const correctedMorphemeTypes = Array.isArray(parsed.corrected_morpheme_types)
    ? parsed.corrected_morpheme_types
        .map((entry) => normalizeMorphemeType(entry))
        .filter((entry) => MORFO_MORPHEME_TYPES.includes(entry))
    : requestBody.payload.morphemeTypes;

  return jsonResponse(200, {
    success: true,
    model: result.model,
    isCorrect: Boolean(parsed.is_correct),
    correctedWordType,
    correctedLexeme: String(parsed.corrected_lexeme || requestBody.payload.lexeme).trim(),
    correctedMorphemes,
    correctedMorphemeTypes,
    issues: Array.isArray(parsed.issues) ? parsed.issues.map((entry) => String(entry).trim()).filter(Boolean) : [],
    correctionNote: String(parsed.correction_note || "").trim(),
  });
}

async function handleQuestion(apiKey, requestBody, systemPrompt, contextBuilder) {
  const prompt = contextBuilder(requestBody);
  const result = await requestWithFallback({
    apiKey,
    requestedModel: requestBody.modelName,
    systemPrompt,
    userPrompt: prompt,
    temperature: 0.35,
    expectJson: false,
  });

  return jsonResponse(200, {
    success: true,
    model: result.model,
    answer: result.text,
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Only POST is allowed." });
  }

  const requestApiKey = request.headers.get("x-gemini-api-key")?.trim() || "";
  const geminiEnabled = Boolean(requestApiKey) || process.env.ENABLE_GEMINI === "1";
  if (!geminiEnabled) {
    return jsonResponse(503, {
      error: "Gemini is disabled on this Netlify site. Add a local API key in Ajustes to use it from this browser.",
    });
  }

  const apiKey = requestApiKey || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(503, {
      error: "No Gemini API key is available. Add one in Ajustes or configure GEMINI_API_KEY on Netlify.",
    });
  }

  let payload;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "Invalid request payload.",
    });
  }

  try {
    switch (payload.action) {
      case "generate-se":
        return await handleGenerateSe(apiKey, payload);
      case "generate-morfo":
        return await handleGenerateMorfo(apiKey, payload);
      case "recheck-se":
        return await handleSeRecheck(apiKey, payload);
      case "recheck-morfo":
        return await handleMorfoRecheck(apiKey, payload);
      case "question-se":
        return await handleQuestion(apiKey, payload, SE_QUESTION_PROMPT, (requestBody) =>
          `Responde la pregunta del usuario de forma clara y breve.\nContexto:\n${JSON.stringify(
            {
              sentence: requestBody.payload.item.sentence,
              initial_answer: {
                se_value: requestBody.payload.item.seValue,
                se_function: requestBody.payload.item.seFunction,
                verbal_structure: requestBody.payload.item.verbalStructure,
                periphrasis_type: requestBody.payload.item.periphrasisType,
                phrase_type: requestBody.payload.item.phraseType,
                explanation: requestBody.payload.item.explanation,
              },
              recheck: requestBody.payload.recheckResult ?? null,
              user_question: requestBody.payload.question,
            },
            null,
            2,
          )}`,
        );
      case "question-morfo":
        return await handleQuestion(apiKey, payload, MORFO_QUESTION_PROMPT, (requestBody) =>
          `Responde la pregunta del usuario de forma clara y breve.\nContexto:\n${JSON.stringify(
            {
              word: requestBody.payload.item.word,
              initial_answer: {
                word_type: requestBody.payload.item.wordType,
                lexeme: requestBody.payload.item.lexeme,
                morphemes: requestBody.payload.item.morphemes,
                morpheme_types: requestBody.payload.item.morphemeTypes,
                analysis_type: requestBody.payload.item.analysisType,
                explanation: requestBody.payload.item.explanation,
              },
              recheck: requestBody.payload.recheckResult ?? null,
              user_question: requestBody.payload.question,
            },
            null,
            2,
          )}`,
        );
      default:
        return jsonResponse(400, { error: "Unsupported action." });
    }
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
};
