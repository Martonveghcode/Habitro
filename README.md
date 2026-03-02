# Valores del se App (Streamlit)

Nueva version centrada solo en practica de **valores del se**.

## Incluye

- Generacion de frases (dificultad 1-3) con "se".
- Respuesta correcta incluida en el mismo llamado al LLM:
  - valor de "se"
  - funcion (CD/CI/etc.)
  - tipo de oracion
  - explicacion breve
- Comprobacion inmediata de tu respuesta.
- Historial de errores con:
  - ocultar/mostrar
  - reset completo
- Modo personalizado usando tus errores guardados.
- Navegacion lateral (`Practicar`, `Historial`, `Ajustes`).

## Requisitos

- Python 3.10+

## Instalacion

```bash
pip install -r requirements-streamlit.txt
```

Opcional (Gemini):

- En variable de entorno:
  - `GEMINI_API_KEY=...`
  - `GEMINI_MODEL=gemini-2.5-flash-lite` (opcional)
- O en `.streamlit/secrets.toml`:
  ```toml
  GEMINI_API_KEY = "tu_clave"
  GEMINI_MODEL = "gemini-2.5-flash-lite"
  ```

Si no hay API key, la app usa ejemplos locales para que siga funcionando.

## Ejecutar

```bash
streamlit run streamlit_app.py
```
