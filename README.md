# Papita AI 🥔: Agente de IA para prevenir el burn-out en médicos (Desafío IA Bagó Perú 2026) 🧑‍⚕️

<img src="papapng.png" style="height: 250px; display: block; margin: auto;">

## Problema identificado

Los médicos en etapas de crecimiento profesional enfrentan una alta carga laboral y agendas inestables que se gestionan de forma reactiva, lo que genera una falta de estructura y claridad sobre sus límites personales y una constante saturación mental. Este problema importa porque el agotamiento (burnout) no solo deteriora la salud del propio médico, sino que reduce su concentración, empatía y, en consecuencia, la calidad de la atención que brinda a sus pacientes. De no resolverse, el médico corre el riesgo de sufrir un desgaste crónico —caracterizado por agotamiento emocional, despersonalización y baja realización personal— que puede llevarlo, eventualmente, a abandonar la profesión.

## Solución propuesta

Se trata de una aplicación móvil que acompaña la salud física y emocional del médico mediante inteligencia artificial, interpretando sus estados y ofreciéndole feedback significativo. Está dirigida al personal médico que se desempeña en entornos clínicos de alta presión. En cuanto a su uso, el médico realiza registros diarios rápidos (check-ins), y el sistema, a través de la IA, analiza estos datos para devolverle recomendaciones y micro hábitos personalizados. De esta manera, el valor que entrega es la prevención activa del burnout, la normalización del autocuidado y la provisión de herramientas para la toma de decisiones diarias, todo ello sin añadir carga administrativa adicional a su jornada. 

## Diferencial de la solución

Nuestra propuesta se distingue por una experiencia conversacional centrada en "Papita", un personaje virtual que refleja dinámicamente el estado emocional del médico, generando una conexión cercana y empática. El diseño tiene un enfoque en salud sustentado en dimensiones psicométricas validadas —Agotamiento Emocional, Despersonalización y Realización Personal—, lo que dota a la herramienta de rigor clínico. A esto se suma la automatización, mediante la capacidad de generar recomendaciones personalizadas y alertas tempranas ante indicios de crisis a partir del registro diario del usuario. Finalmente, todo se apoya en la simplicidad: registros rápidos de menos de 30 segundos, pensados para adaptarse a la realidad de los turnos médicos sin añadir carga al usuario.

## Arquitectura técnica (resumen)

```text
Usuario
  │
  ▼
Interfaz (React 19 + Vite + TailwindCSS v4)
  • Chat Papita, chat paciente, perfil médico, dashboard MBI/sueño
  • Login Google (Firebase Auth) + lectura/escritura de archivos (Google Drive)
  │  fetch JSON
  ▼
Backend / API (Express sobre Node, server.ts)
  Endpoints: /api/chat · /api/chat-paciente · /api/mbi-recommendations
             /api/doctor-schedule · /api/sleep-diego · /api/mbi-summary
             /api/drive-read-file
  │
  ├─────────────► Modelo IA
  │                 • Azure OpenAI / Foundry (gpt-5.4-mini) → respuestas del chat
  │                 • Google Gemini (@google/genai)
  │
  └─────────────► Base de datos / fuentes de datos
                    • Azure AI Search (RAG de fichas/expedientes clínicos)
                    • Google Drive (archivos TXT/Docs/PDF vía pdf-parse)
                    • Firebase (autenticación de usuarios)
```

El detalle completo debe ir en [`docs/arquitectura.md`](docs/arquitectura.md).

## Cómo ejecutar el proyecto

La aplicación puede abrirse directamente en este link:
https://papitaai-183061386202.us-east1.run.app

Para ejecutarlo localmente:

Se descargan las dependencias:
```
npm install
```

Se configuran las variables de entorno en el .env:
```
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_API_VERSION=2025-04-01-preview
AZURE_MODEL=gpt-5.4-mini

AZURE_SEARCH_ENDPOINT
AZURE_SEARCH_KEY
```

Se ejecuta la app:
```
npm run dev
```

Se abre el programa en el localhost en un navegador:
```
http://localhost:3000
```

### Requisitos
```text
Software base

Node.js mínimo 20 LTS
Sistema operativo: Windows, macOS o Linux.

Servicios externos

Azure OpenAI (Foundry) — chat principal y de paciente, y recomendaciones MBI. Necesitas AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_API_VERSION, AZURE_MODEL.
Azure AI Search — indexado/RAG de fichas clínicas. Necesitas AZURE_SEARCH_ENDPOINT y AZURE_SEARCH_KEY.
Google Gemini API (@google/genai) — cliente Gemini inicializado en el servidor; usa GEMINI_API_KEY (si falta, arranca con MOCK_KEY).

Dependencias:
Express
Vite
react/react-dom 19
@google/genai
Firebase
Pdf-parse
Motion
Lucide-react
tailwindcss v4
dev tsx
Esbuild
Typescript.

Puerto: el servidor escucha en http://localhost:3000.

```

### Instalación

```bash
# 1. Entrar a la carpeta del proyecto
cd papitaai

# 2. Instalar dependencias (frontend + backend)
npm install

# 3. Crear el archivo de variables de entorno a partir del ejemplo
cp .env.example .env        # en Windows PowerShell: copy .env.example .env

# 4. Editar .env y rellenar tus credenciales propias:
#    GEMINI_API_KEY, APP_URL,
#    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_API_VERSION, AZURE_MODEL,
#    AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY
```

### Ejecución

```bash
# --- Modo desarrollo (recomendado: levanta Vite + Express juntos con tsx) ---
npm run dev
# Abre http://localhost:3000

# --- Modo producción (build optimizado + servidor compilado) ---
npm run build      # genera dist/ (frontend) y dist/server.cjs (backend con esbuild)
NODE_ENV=production npm run start
# En Windows PowerShell:  $env:NODE_ENV="production"; npm run start

# --- Utilidades ---
npm run lint       # chequeo de tipos (tsc --noEmit)
npm run clean      # elimina dist/
```

## Variables de entorno

Crear un archivo `.env` copiando la plantilla:

```bash
cp .env.example .env
```

Completar los valores localmente. **No subir credenciales reales al repositorio.**

Referencia de variables disponibles: [`.env.example`](.env.example).

## Demo

```text
La demo se abre en el mismo link de la aplicación: https://papitaai-183061386202.us-east1.run.app/
Se debe ingresar a la pestaña de "perfil" e ingresar las siguientes credenciales:
usuario: grupo21
contraseña: bago-hackathon
```

Las evidencias visuales (capturas, GIFs, videos cortos) deben colocarse en:

```text
assets/demo/
```

## Limitaciones conocidas

Indicar qué quedó pendiente, qué restricciones tiene la solución o qué depende de datos/servicios externos.

Quedó pendiente el chatvoz

## Próximos pasos

El modelo presenta una propuesta sólida en términos de sostenibilidad y escalabilidad. En cuanto a sostenibilidad, genera un triple impacto positivo: beneficia al médico al proteger su salud mental, al paciente al garantizarle una atención segura y empática, y a la clínica al reducir costos ocultos por rotación de personal y riesgos legales; todo esto mediante una suscripción recurrente de apenas 10 dólares mensuales por cada millón de tokens, con un ROI claro y medible en el corto plazo que elimina la dependencia de subsidios. En cuanto a escalabilidad, la arquitectura basada en la nube y en modelos de lenguaje permite un crecimiento masivo e inmediato en el componente tecnológico, mientras que el principal desafío operativo radica en la integración con los sistemas de historias clínicas electrónicas de cada institución y en el costo variable del consumo de tokens a gran escala, reto que se planea resolver mediante la creación de conectores universales compatibles con los sistemas de gestión hospitalaria más utilizados del mercado.


## Disclaimer

Duplicado del repositorio original usado para la Hackathon:
```bash
https://github.com/Hackathon-Bago-2026/equipo-21    # (Privado)
```
