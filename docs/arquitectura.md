# Arquitectura de la solución

## Resumen

Papita AI es una aplicación web full-stack (SPA React 19 + servidor Express en Node, ambos en TypeScript y lanzados en un único proceso) que acompaña el bienestar físico y emocional de médicos de guardia. Entra texto del médico (chat de bienestar, consultas clínicas sobre expedientes, registro de sueño/MBI), recupera contexto clínico vía RAG en Azure AI Search y luego invoca un modelo de Azure OpenAI con instrucciones específicas por caso.

## Componentes principales

| Componente | Descripción | Tecnología |
| --- | --- | --- |
| Interfaz | SPA web (PWA con manifest.json y sw.js) tipo app móvil: chat de bienestar "Papita", chat clínico "Dra. Papita", perfil del médico, historial, registro de sueño/MBI y dashboards. Captura voz parcialmente implementada. | React 19, Vite 6, TailwindCSS v4, lucide-react, motion (animaciones), localStorage para perfil/estado |
| Backend / API | Servidor Express que sirve la SPA (Vite en dev, estáticos dist/ en prod) y expone los endpoints, orquesta el RAG y las llamadas al modelo, parsea PDFs y normaliza la respuesta JSON. | Node.js, Express 4, TypeScript, ejecutado con tsx; build con esbuild. Endpoints: /api/chat, /api/chat-paciente, /api/doctor-schedule, /api/sleep-diego, /api/mbi-summary, /api/mbi-recommendations, /api/drive-read-file |
| Modelo de IA | Genera las respuestas de chat, los resúmenes clínicos y las recomendaciones MBI, devolviendo JSON estructurado mediante el endpoint /openai/responses. | Azure OpenAI / Foundry, modelo gpt-5.4-mini (configurable por env). Cliente Google Gemini (@google/genai) también inicializado en el servidor |
| Base de datos / fuente de datos | RAG sobre expedientes/fichas clínicas; lectura/escritura de archivos del usuario; persistencia ligera del perfil. Nota: horario, sueño y MBI están precargados (hardcoded) en server.ts, no se arman desde la fuente. | Azure AI Search (índice rag-1781309433060), localStorage del navegador, datos en código fuente |
| Servicios externos | Autenticación con Google, almacenamiento de archivos y proveedores de IA/búsqueda. | Firebase Auth (Google Sign-In, scope Drive), Google Drive REST API, Azure OpenAI, Azure AI Search, pdf-parse para extraer texto de PDFs |

## Flujo general

Describir el recorrido principal de la información en texto. Ejemplo:

```text
1. El médico interactúa con la SPA (React): escribe en un chat, registra sueño/MBI
   o selecciona un archivo de su Google Drive (login previo vía Firebase Auth).
2. La interfaz envía la solicitud por fetch JSON al backend Express
   (p. ej. POST /api/chat o /api/chat-paciente), incluyendo historial e intereses del médico.
3. El backend decide el caso:
   a. Si el mensaje contiene palabras clave clínicas, consulta Azure AI Search (RAG)
      y serializa los expedientes encontrados como contexto.
   b. Construye un prompt (system instruction) específico del caso de uso.
   c. Invoca el endpoint /openai/responses de Azure OpenAI (gpt-5.4-mini).
4. El backend limpia y parsea la respuesta del modelo a JSON estructurado;
   si el modelo falla o las credenciales no están, usa un generador de fallback local.
5. La interfaz renderiza la respuesta (texto empático + estado de ánimo + microhábito,
   o resumen clínico, o dashboards de sueño/burnout). El usuario puede guardar
   resultados como archivo de texto en Google Drive.
```

Diagrama de referencia (opcional):

```text
Médico
  -> Interfaz (React SPA / PWA)
     -> Backend / API (Express)
        -> RAG: Azure AI Search  (contexto de expedientes)
        -> Modelo IA: Azure OpenAI gpt-5.4-mini  (genera respuesta JSON)
        -> Google Drive (lectura/escritura de archivos vía Firebase Auth)
     <- JSON estructurado -> renderizado en la interfaz
```

## Datos utilizados

Origen de los datos. (a) Texto que escribe el médico en los chats e historial de conversación (últimos ~6 turnos enviados como contexto); (b) perfil del médico (nombre, edad, género, área, intereses, horas de sueño ideal, etc.) capturado en formularios; (c) índice de Azure AI Search con fichas/expedientes clínicos; (d) archivos de Google Drive del usuario (TXT, Google Docs, PDF); (e) datos clínicos de demostración precargados en server.ts (horario semanal de ~75 pacientes, historial de sueño, dimensiones MBI).
Formato y volumen aproximado. Intercambio cliente-servidor en JSON. Expedientes de Azure recortados a ~1.500 caracteres por campo, top 3 resultados por consulta. Archivos de Drive limitados a 40 por listado; PDFs procesados con pdf-parse. Volumen propio de un prototipo/hackatón (un único médico ficticio "Dr. Diego"), no a escala productiva.
Datos sensibles o personales. La solución maneja datos clínicos y personales de pacientes (nombres completos, edad, género, ID de historia clínica HC-2026-xxxx, motivos de consulta) y del médico. En el prototipo estos datos están en texto plano dentro del código y/o el índice, sin anonimización ni cifrado a nivel de aplicación. Para un entorno real requerirían seudonimización, control de acceso por rol y cumplimiento normativo (p. ej. protección de datos de salud).
Datos de contexto/ejemplos usados con IA. No hay entrenamiento ni fine-tuning. Se usa contexto in-prompt: el system instruction por caso, el historial reciente, los intereses del médico (para personalizar microhábitos) y, cuando aplica, los expedientes recuperados por RAG inyectados en el prompt.

## Uso de IA

Proveedor o servicio. Azure OpenAI / Foundry (modelo gpt-5.4-mini) vía el endpoint /openai/responses (api-version 2025-04-01-preview). Adicionalmente se inicializa un cliente Google Gemini (@google/genai) en el servidor.
Tipo de tarea. Principalmente chat conversacional con salida estructurada y RAG (recuperación aumentada con expedientes de Azure AI Search). Tres usos diferenciados: chat de bienestar emocional, asistente clínico (resúmenes de expedientes, sin diagnóstico) y generación de recomendaciones MBI personalizadas. También clasificación implícita: el modelo devuelve un detectedMood.
Prompts y pipelines. Cada endpoint arma un system instruction en español que define la personalidad de "Papita", el formato JSON obligatorio de salida (reply, detectedMood, suggestedHabit) y reglas de negocio. El backend hace post-procesado robusto: quita backticks de markdown, recorta al primer/último {...} y hace JSON.parse, con varias rutas de extracción según la forma de la respuesta. El RAG se dispara por coincidencia con una lista fija de palabras clave (expediente, paciente, historial, etc.). Hay un fallback local que genera respuestas alineadas si el modelo falla o no hay credenciales.
Limitaciones del modelo en este caso. El asistente clínico está restringido por diseño: no entrega diagnósticos, diagnósticos diferenciales ni tratamientos, solo resúmenes. La activación del RAG por palabras clave es frágil (falsos negativos). La salida depende de que el modelo respete el formato JSON; ante respuestas mal formadas se recurre al fallback. Varios "datos en vivo" (horario, sueño, MBI) no provienen realmente del modelo ni de Azure sino de valores fijos.

## Seguridad y privacidad

Manejo de credenciales. El diseño previsto usa un .env (ignorado por .gitignore, que sí permite .env.example). Sin embargo, en el material entregado las credenciales reales están expuestas: .env.example contiene claves reales de Azure OpenAI y Azure Search, y la config de Firebase está copiada directamente en src/lib/firebase.ts y firebase-applet-config.json. Recomendación crítica: rotar/revocar esas claves y dejar solo placeholders.
Autenticación y autorización. Dos mecanismos: (a) un login de demo con usuario/contraseña hardcodeados en el frontend (grupo20 / bago-hackathon), trivial e inseguro; (b) Firebase Auth con Google Sign-In (scope de Google Drive) para acceder a archivos del usuario. No hay control de acceso por rol ni autorización a nivel de endpoint del backend.
Protección de datos personales/clínicos. En el prototipo no hay cifrado de aplicación, anonimización ni segregación de datos clínicos; los nombres de pacientes e IDs de historia clínica viajan y se almacenan en claro (índice, código y localStorage). Para producción haría falta seudonimización, cifrado en tránsito/reposo, minimización de datos y cumplimiento de la normativa de datos de salud aplicable.
Logs y retención. El backend hace console.log extensivo (consultas, tiempos, fragmentos recuperados, errores), lo que puede incluir contenido sensible; conviene revisar qué se registra y aplicar retención/redacción. No hay base de datos de auditoría; la persistencia del usuario es localStorage y archivos en Drive.
Buenas prácticas aplicadas durante la hackatón. Separación de responsabilidades (libs firebase.ts/drive.ts), .gitignore que excluye .env* y dist/, parseo defensivo de la salida del modelo, fallback ante fallos del modelo, escape de comillas en las queries a Drive, y restricción clínica explícita (no diagnóstico). Pendientes para endurecer: mover secretos fuera del código, reemplazar el login de demo y revisar logging de datos sensibles.

## Escalabilidad

Cuellos de botella actuales. (1) Datos clínicos hardcodeados en server.ts, que impiden escalar a múltiples médicos/pacientes reales sin reescribir endpoints. (2) Puerto fijo 3000 y un único proceso Node sin balanceo. (3) RAG por palabras clave, no semántico. (4) Persistencia en localStorage (no compartida, no multidispositivo). (5) Dependencia de latencia/cuota de Azure OpenAI y Azure Search en cada solicitud. (6) Login y datos atados a un usuario de demo único.
Estrategia de despliegue. El proyecto está orientado a desplegar como contenedor/servicio gestionado (el .env.example referencia un APP_URL de Cloud Run y la app proviene de Google AI Studio). El build genera un frontend estático (dist/) y un servidor empaquetado (dist/server.cjs), apto para empaquetar en Docker y correr en un PaaS/serverless de contenedores (Cloud Run, Azure Container Apps, etc.) detrás de HTTPS.
Escalamiento horizontal/vertical. El backend Express es prácticamente stateless (el estado vive en cliente/Drive/Azure), por lo que escala horizontalmente bien con múltiples instancias detrás de un balanceador y autoescalado por demanda; el frontend estático puede ir a CDN. Verticalmente, conviene aislar el parseo de PDFs (uso de CPU/memoria) y considerar streaming de respuestas del modelo. Para datos reales, migrar de valores hardcodeados/localStorage a una base gestionada (con cifrado) y a búsqueda semántica.
Costos y cuotas de IA. El costo dominante son las llamadas a Azure OpenAI (tokens por chat/recomendación, con temperature 0.7) y las consultas a Azure AI Search; ambos tienen cuotas/límites de rate que pueden saturarse bajo carga. Mitigaciones: cachear respuestas frecuentes, limitar el historial enviado (ya se recorta a ~6 turnos), activar RAG solo cuando aporta, aplicar rate-limiting por usuario y monitorear consumo de tokens para controlar gasto.
