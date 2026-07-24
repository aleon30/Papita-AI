# Registro de decisiones

Documento vivo para registrar decisiones del equipo durante la hackatón. Ayuda a mentores, jurados y al propio equipo a entender el porqué de las elecciones técnicas y de producto del proyecto **Papita AI** (asistente de bienestar para médicos de guardia).

> Nota: las fechas son referenciales para un evento de fin de semana. Reemplazar por las fechas reales del equipo.

## Tabla de decisiones

| Fecha | Decisión | Motivo | Impacto |
| --- | --- | --- | --- |
| 2026-06-12 | Usar Azure OpenAI (`gpt-5.4-mini`) como motor principal de IA | Requisito del reto / créditos de Azure disponibles | Integración con el endpoint `/openai/responses` y dependencia de cuotas/latencia de Azure en cada respuesta |
| 2026-06-12 | RAG con Azure AI Search sobre expedientes clínicos | Dar contexto clínico real a las respuestas sin entrenar un modelo | Pipeline de recuperación + serialización de documentos inyectados en el prompt |
| 2026-06-12 | Stack full-stack TypeScript: React 19 + Vite (frontend) y Express (backend) en un solo proceso | Velocidad de desarrollo, un solo lenguaje, base generada desde Google AI Studio | App SPA/PWA servida por Express; `npm run dev` levanta todo junto con `tsx` |
| 2026-06-12 | Login de demo con credenciales fijas (`grupo20` / `bago-hackathon`) | Necesidad de una barrera mínima de acceso para la demo sin construir auth real | Acceso rápido para el jurado, pero inseguro: credenciales visibles en el frontend |
| 2026-06-12 | Firebase Auth (Google) + Google Drive para archivos del usuario | Permitir leer/guardar resúmenes e historias en TXT/Docs/PDF sin base de datos propia | Dependencia de OAuth de Google y configuración de scopes de Drive |
| 2026-06-13 | Precargar (hardcodear) horario, sueño y MBI del "Dr. Diego" en `server.ts` | Garantizar una demo 100% fiel y estable ante latencia/fallos de Azure | Datos no provienen realmente de la fuente; limita el multi-usuario, pero asegura la demo |
| 2026-06-13 | Fallback local cuando el modelo falla o falta credencial | Evitar pantallas vacías o errores durante la presentación | La app siempre responde algo coherente aunque el modelo no esté disponible |
| 2026-06-13 | Restringir al asistente clínico a resumir (sin diagnóstico/tratamiento) | Seguridad clínica y responsabilidad: no es herramienta de decisión médica | Reduce riesgo legal/clínico; acota el caso de uso a apoyo administrativo |
| 2026-06-13 | Persistir perfil y estado en `localStorage` del navegador | Simplicidad: sin backend de usuarios para el prototipo | Datos no se sincronizan entre dispositivos y se pierden al limpiar el navegador |

## Decisiones técnicas

Elecciones de stack, arquitectura, librerías y patrones:

* **Lenguaje y frameworks.** TypeScript de extremo a extremo. Frontend en **React 19 + Vite 6 + TailwindCSS v4** (con `lucide-react` y `motion` para UI/animaciones); backend en **Node + Express 4** ejecutado con `tsx` en desarrollo y empaquetado con `esbuild` para producción. Se eligió por rapidez de iteración, un único lenguaje para todo el equipo y porque la base venía generada desde Google AI Studio.
* **Estrategia de IA.** Sin entrenamiento ni fine-tuning: se usa **prompting con salida estructurada en JSON** (`reply`, `detectedMood`, `suggestedHabit`) y **RAG** sobre Azure AI Search. Cada caso de uso (chat de bienestar, asistente clínico, recomendaciones MBI) tiene su propio *system instruction* en español. El backend hace post-procesado robusto de la respuesta (limpieza de markdown, extracción del bloque JSON, `JSON.parse`) con un **fallback local** ante fallos.
* **Almacenamiento y APIs.** Persistencia ligera en `localStorage` (perfil/estado), archivos del usuario en **Google Drive** (REST API, TXT/Docs/PDF con `pdf-parse`), y expedientes en el índice de **Azure AI Search**. Datos de demostración (horario, sueño, MBI) precargados en el código para máxima fidelidad.
* **Alternativas descartadas.**
  * *Base de datos propia (SQL/NoSQL) para perfiles y registros* → descartada por tiempo; se optó por `localStorage` + Drive.
  * *Construir los dashboards de horario/sueño/MBI realmente desde Azure Search* → descartada para la demo por riesgo de latencia/fallos; se hardcodearon los datos (la consulta a Azure se conserva como demostración de sincronización).
  * *Autenticación real con roles* → descartada por alcance; se usó login de demo fijo.
  * *Fine-tuning de un modelo* → innecesario y costoso; RAG + prompting cubren el caso.
  * *RAG semántico/embeddings dedicados* → se optó por una activación más simple por palabras clave para ahorrar tiempo.

## Decisiones de producto

Elecciones orientadas al usuario y al valor:

* **Público objetivo y caso de uso.** Médicos de guardia (turnos largos, sobrecarga, déficit de sueño). Caso principal: una mascota empática ("Papita") que acompaña el bienestar emocional y físico, ofrece microhábitos realistas y, en el rol clínico, ayuda a **resumir expedientes para ahorrar tiempo** durante la guardia.
* **Funcionalidades incluidas.** Chat de bienestar con detección de ánimo y sugerencia de microhábito; asistente clínico que resume historias clínicas (con RAG); dashboards de horario, sueño y burnout (MBI); recomendaciones MBI personalizadas según intereses del médico; integración con Google Drive; perfil del médico; PWA instalable.
* **Fuera de alcance (explícito).** Diagnóstico, diagnóstico diferencial o recomendaciones de tratamiento (el asistente lo rechaza por diseño); multi-usuario real con datos propios por médico; gestión clínica completa o integración con historia clínica hospitalaria real.
* **Experiencia de usuario.** Interfaz tipo app móvil con tono cálido, tierno y juguetón pero profesional, en español latinoamericano neutro. Flujos cortos: escribir en el chat → respuesta empática + microhábito; o consultar un expediente → resumen claro. Canal principal: web/PWA.
* **Criterios de éxito de la demo.** La app responde de forma estable y empática; muestra el RAG funcionando sobre un expediente; los dashboards (sueño/MBI) se ven completos y coherentes; las recomendaciones se personalizan con los intereses del médico; y todo funciona incluso si la API de IA falla (gracias al fallback y a los datos precargados).

## Decisiones de negocio / sostenibilidad

Cómo podría continuar la solución después del evento:

* **Propuesta de valor.** Reducir el burnout y el desgaste de los médicos de guardia mediante acompañamiento emocional ligero y ahorro de tiempo en tareas administrativas (resúmenes de expedientes). Valor medible: minutos ahorrados por consulta y seguimiento del bienestar (MBI, sueño).
* **Costos operativos estimados.** Dominados por el consumo de **Azure OpenAI** (tokens por mensaje/recomendación) y consultas a **Azure AI Search**; más hosting de un contenedor (Cloud Run / Azure Container Apps) y el plan de Firebase/Google Drive. Costos controlables limitando el historial enviado, cacheando respuestas y activando RAG solo cuando aporta.
* **Dependencias con Bagó, partners o datos externos.** Depende de créditos/cuotas de Azure, de Firebase/Google Cloud para auth y Drive, y de datos clínicos de calidad para el índice de búsqueda. La continuidad requeriría acuerdo con el patrocinador (Bagó/partners) para acceso a datos reales y financiamiento de las APIs.
* **Viabilidad de mantenimiento y evolución.** El backend es casi stateless, lo que facilita escalar y mantener. Para pasar de prototipo a piloto haría falta: sustituir datos hardcodeados por la fuente real, base de datos gestionada y cifrada, autenticación con roles, y RAG semántico. La arquitectura modular (libs de Firebase/Drive separadas) facilita iterar.

## Supuestos

* **Disponibilidad de datos, APIs e infraestructura.** Se asume que las credenciales de Azure OpenAI, Azure AI Search y Firebase están activas y con cuota suficiente durante la demo, y que hay conexión a internet (la app no funciona offline).
* **Comportamiento esperado del usuario.** El médico interactúa por texto (y eventualmente voz), formula consultas usando términos reconocibles (para activar el RAG por palabras clave) y entiende que el asistente no diagnostica.
* **Restricciones legales, clínicas y de privacidad.** Se asume que, para la hackatón, los datos de pacientes son ficticios/de prueba; en un entorno real aplicarían normativas de protección de datos de salud que exigirían anonimización, cifrado y consentimiento.
* **Tiempo y capacidad del equipo.** Alcance acotado a un fin de semana, con un único médico de demostración ("Dr. Diego") y priorización de una demo estable por encima de la integración 100% en vivo.

## Riesgos identificados

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Caída o latencia de la API de IA (Azure OpenAI) | Demo inestable o respuestas lentas | Fallback local que genera respuestas coherentes; recorte del historial a ~6 turnos; datos de demo precargados |
| Datos de Azure Search incompletos, vacíos o no recuperados | Respuestas clínicas poco útiles o sin contexto | Degradación elegante (devuelve aviso si no hay credencial/resultados); datos clínicos clave precargados para la demo |
| RAG por palabras clave no se dispara con otra terminología | El sistema no consulta la base aunque debería (falsos negativos) | Lista ampliada de palabras clave; pendiente: migrar a búsqueda semántica/embeddings |
| Credenciales reales expuestas en `.env.example` y en el código (Firebase) | Riesgo de seguridad y de abuso de cuota | Rotar/revocar claves, dejar solo placeholders y mover secretos a variables de entorno fuera del repo |
| Login de demo con credenciales fijas en el frontend | Acceso no autorizado; inadecuado para producción | Reemplazar por autenticación real con roles (Firebase Auth ya integrado para Google) |
| Manejo de datos clínicos/personales sin cifrado ni anonimización | Riesgo de privacidad y de incumplimiento normativo | Usar datos ficticios en la demo; en producción aplicar seudonimización, cifrado y control de acceso |
| El modelo no respeta el formato JSON esperado | Errores de parseo en el backend | Limpieza de markdown + extracción del bloque `{...}` + `try/catch`; fallback local si el parseo falla |
| Modelo usado para fines clínicos fuera de alcance (diagnóstico) | Riesgo clínico/legal | Reglas estrictas en el prompt que rechazan diagnóstico/tratamiento; disclaimer al usuario |
| Persistencia solo en `localStorage` | Pérdida de datos del usuario o falta de sincronización | Documentar la limitación; en evolución, mover a base de datos gestionada |
| Dependencia de créditos/cuotas de Azure y Google | Costos o cortes tras agotar la cuota | Monitorear consumo de tokens, cachear respuestas, limitar llamadas y acordar financiamiento con el patrocinador |
