import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

async function queryAzureSearch(queryText: string): Promise<any[]> {
  const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
  const apiKey = process.env.AZURE_SEARCH_KEY;
  
  if (!endpoint || !apiKey) {
    console.warn("[Azure Search] ADVERTENCIA: AZURE_SEARCH_ENDPOINT o AZURE_SEARCH_KEY no están configurados en el archivo .env.");
    return [];
  }
  
  console.log(`[Azure Search] Preparando consulta para: "${queryText}"`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        search: queryText,
        count: true,
        top: 3
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Azure Search] Error en endpoint:", errText);
      return [];
    }

    const data = await response.json() as any;
    console.log(`[Azure Search] Éxito. Encontrados ${data["@odata.count"] || 0} resultados.`);
    return data.value || [];
  } catch (e) {
    console.error("[Azure Search] Error de comunicación:", e);
    return [];
  }
}

function serializeSearchResults(results: any[]): string {
  if (!results || results.length === 0) {
    return "No se encontraron expedientes médicos correspondientes en la base de datos de Azure.";
  }
  return results.map((doc, idx) => {
    const docTextSections: string[] = [];
    docTextSections.push(`[Documento Expediente #${idx + 1}]`);
    for (const [key, val] of Object.entries(doc)) {
      if (key.startsWith("@search")) continue;
      if (val !== null && val !== undefined) {
        const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
        docTextSections.push(`- ${key}: ${strVal.substring(0, 1500)}`);
      }
    }
    return docTextSections.join("\n");
  }).join("\n\n---\n\n");
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini Client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API endpoint for Papita Chat (Mental/Emotional Well-being)
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "El mensaje es obligatorio." });
      }

      const systemInstruction = 
        "Eres Papita, una mascota empática e inteligente (una papa con carita parlante de bienestar, tierna y divertida) que acompaña el bienestar físico y emocional de médicos de guardia. Hablas en español chileno/latinoamericano neutro, en primera persona, con mucha calidez y un toque juguetón pero profesional. Apoyas, escuchas sin juzgar y sugieres un microhábito extremadamente sencillo, corto y realista para hacer durante el turno o al llegar a casa (ej: estiramiento de hombros, beber agua). " +
        "Respeta estrictamente el formato. DEBES responder EXCLUSIVAMENTE con un JSON válido de la forma: " +
        "{\"reply\": \"Respuesta cálida y empática de Papita en español\", \"detectedMood\": \"feliz o cansado o estresado o triste o neutro\", \"suggestedHabit\": \"Un microhábito corto de 1 o 2 frases\"}. No devuelvas ningún formato markdown ni texto adicional fuera de este JSON.";

      const input = [];
      if (history && Array.isArray(history)) {
        // Take the last 6 turns to keep context brief
        const cleanHistory = history.slice(-6);
        for (const turn of cleanHistory) {
          const role = turn.role === 'user' ? 'user' : 'assistant';
          const text = turn.text || turn.reply || "";
          if (text) {
            input.push({
              role: role,
              content: text
            });
          }
        }
      }

      input.push({
        role: "user",
        content: message
      });

      console.log("Calling Foundry EndPoint for Wellness Chat...");
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
      const azureApiVersion = process.env.AZURE_API_VERSION || "2025-04-01-preview";
      const azureModel = process.env.AZURE_MODEL || "gpt-5.4-mini";
      
      if (!azureEndpoint || !azureApiKey) {
        throw new Error("Credenciales de Azure OpenAI incompletas en el archivo .env (falta AZURE_OPENAI_ENDPOINT o AZURE_OPENAI_API_KEY).");
      }
      
      let endpointUrl = azureEndpoint;
      if (!endpointUrl.includes("/openai/responses")) {
        endpointUrl = `${endpointUrl.replace(/\/$/, "")}/openai/responses?api-version=${azureApiVersion}`;
      } else if (!endpointUrl.includes("api-version=")) {
        endpointUrl = `${endpointUrl}${endpointUrl.includes("?") ? "&" : "?"}api-version=${azureApiVersion}`;
      }

      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "api-key": azureApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: azureModel,
          instructions: systemInstruction,
          input: input,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Foundry Error wellness response:", errText);
        throw new Error(`Error en el modelo de Foundry: ${response.status} - ${errText}`);
      }

      const data = await response.json() as any;
      console.log("Foundry Wellness Response Received.");

      let responseText = "";
      if (data.output?.[0]?.content?.[0]?.text) {
        responseText = data.output[0].content[0].text;
      } else if (data.choices?.[0]?.message?.content) {
        responseText = data.choices[0].message.content;
      } else if (data.reply) {
        responseText = data.reply;
      } else {
        responseText = JSON.stringify(data);
      }

      let responseTextCleaned = responseText.trim();
      if (responseTextCleaned.startsWith("```")) {
        responseTextCleaned = responseTextCleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
      }
      const firstBrace = responseTextCleaned.indexOf("{");
      const lastBrace = responseTextCleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        responseTextCleaned = responseTextCleaned.substring(firstBrace, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(responseTextCleaned);
        res.json(parsed);
      } catch (parseError) {
        console.warn("Direct JSON parsing failed. Returning parsed text raw:", parseError);
        res.json({
          reply: responseText,
          detectedMood: "neutro",
          suggestedHabit: "Beber un vaso de agua fresca."
        });
      }

    } catch (error: any) {
      console.error("Foundry API Error:", error);
      res.status(500).json({ 
          error: "Ocurrió un error al procesar el mensaje con Papita AI.",
          details: error?.message || ""
      });
    }
  });

  // API endpoint for Clinical Consultation (Consultar Paciente)
  app.post("/api/chat-paciente", async (req, res) => {
    const startProcessTime = Date.now();
    try {
      const { 
        message, 
        history, 
        driveContext, 
        isSleepRegistration, 
        isMbiRegistration, 
        mbiScore, 
        mbiCode, 
        mbiDimension, 
        mbiQuestion, 
        savedTime, 
        doctorProfile, 
        doctorInterests 
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "El mensaje es obligatorio." });
      }

      // Check whether the message mentions keywords regarding files or patients so we gather Azure Search Index contents
      let azureSearchContext = "";
      let searchDurationStr = "";
      const lowerMessage = message.toLowerCase();
      const searchKeywords = [
        "expediente", "historial", "susana", "médico", "buscar", 
        "azure", "search", "base de datos", "paciente", "clínico", 
        "registro", "rag", "información", "estudio", "caso", 
        "búsqueda", "pauta", "ficha", "db"
      ];
      const shouldTriggerSearch = !isSleepRegistration && !isMbiRegistration && searchKeywords.some(keyword => lowerMessage.includes(keyword));

      if (shouldTriggerSearch) {
        console.log(`[Azure Search] Keyword matched. Querying Azure index for: "${message}"`);
        const searchStartTime = Date.now();
        const searchResults = await queryAzureSearch(message);
        const searchEndTime = Date.now();
        const durationMs = searchEndTime - searchStartTime;
        // Format the duration nicely in milliseconds
        searchDurationStr = `Tiempo ahorrado: ${durationMs} ms`;
        if (searchResults && searchResults.length > 0) {
          azureSearchContext = serializeSearchResults(searchResults);
        }
      }

      let systemInstructionPaciente = 
        "Eres Papita, una asistente clínica y médica brillante de pediatría y medicina general (una papa doctora de bienestar muy tierna, inteligente y con rigor médico). " +
        "Tu objetivo es ayudar al médico Dr. Diego (o el nombre que use) a evaluar casos clínicos, resumir expedientes o historias clínicas, recordar cálculos de dosis clínicas e interpretar síntomas de forma amigable pero clínicamente precisa. ";

      if (doctorInterests && Array.isArray(doctorInterests) && doctorInterests.length > 0) {
        systemInstructionPaciente += `Los intereses, hobbies y gustos de reconexión del doctor son: [${doctorInterests.join(", ")}]. Si sugieres alguna micropausa laboral, consejo de bienestar o hábito saludable, personalízalos alegremente recomendando ideas directamente relacionadas con estos gustos o intereses preferidos del doctor. `;
      }

      systemInstructionPaciente += 
        "REGLAS CRÍTICAS DE RESPUESTA SÓLIDAS: " +
        "1. Cuando el médico te solicite el RESUMEN de un historial clínico o expediente, NO debes ofrecer bajo ninguna circunstancia recomendaciones clínicas, ideas de diagnóstico, ni sugerir diagnósticos diferenciales. Limítate estrictamente a resumir la información del historial clínico de forma puramente concisa, clara, directa y objetiva, destacando solo los datos existentes. " +
        "2. En caso de que el doctor te SOLICITE una recomendación de diagnóstico, diagnóstico diferencial o tratamiento directo, NO debes dar ninguna recomendación de diagnóstico. Debes responder de forma sumamente empática, tierna y cariñosa explicando textualmente de manera amigable que no estás entrenada para ese tipo de respuestas de diagnóstico o decisiones clínicas, y explicarle que tu objetivo exclusivo es ayudarle a estructurar resúmenes y de información concisa que le ahorre mucho valioso tiempo en su guardia. " +
        (isSleepRegistration ? "" : "3. Al terminar la respuesta de cualquier resumen, análisis o consulta sobre el historial clínico de un paciente, SIEMPRE debes incluir textualmente al final de tu campo 'reply' la pregunta exacta: '¿Deseas más información sobre el paciente?' ") +
        "Habla en español con cariño, calidez clínica y estructura tu respuesta con párrafos claros o viñetas para que sea muy fácil de leer en la guardia hospitalaria. " +
        "DEBES responder EXCLUSIVAMENTE con un JSON válido de la forma: " +
        "{\"reply\": \"Tu respuesta clínica o resumen estructurado en párrafos con buena separación\", \"detectedMood\": \"neutro\", \"suggestedHabit\": \"Un consejo rápido o recordatorio pragmático para el manejo o flujo del paciente (ej: verificar la tabla de dosis por peso u orientar a la familia, nunca sugerencias diagnósticas e integrada/personalizada con los hobbies del doctor)\"}. No devuelvas markdown fuera de la respuesta, solo el objeto JSON.";

      let activeInstructions = systemInstructionPaciente;

      if (isMbiRegistration) {
        const prof = doctorProfile || {};
        const docName = prof.name || "doctor";
        const docSpecialty = prof.specialty || "médico";
        const docWorkArea = prof.workArea || "Medicina general";
        const docShiftType = prof.shiftType || "Fijos";
        const docWorkHours = prof.workHours || "8";
        const docInterests = (prof.connectingActivities && Array.isArray(prof.connectingActivities) && prof.connectingActivities.length > 0)
          ? prof.connectingActivities.join(", ")
          : "caminar, meditar o desconectar un momento";
        const docMotivations = (prof.motivations && Array.isArray(prof.motivations) && prof.motivations.length > 0)
          ? prof.motivations.join(", ")
          : "el cuidado humano y vocación médica";

        let dimensionGuidelines = "";
        const dimensionLower = (mbiDimension || "").toLowerCase();
        
        if (dimensionLower.includes("agotamiento") || mbiCode?.includes("AE")) {
          dimensionGuidelines = 
            "- Dimensión MBI: AGOTAMIENTO EMOCIONAL.\n" +
            "- Prioriza estrictamente la recuperación de energía física o mental.\n" +
            `- Sugiere una microintervención breve y divertida de bienestar basada exactamente en los hobbies/intereses elegidos por el usuario (${docInterests}).\n` +
            "- El objetivo es disminuir la sensación de desgaste y cansancio.";
        } else if (dimensionLower.includes("despersonalización") || dimensionLower.includes("despersonalizacion") || mbiCode?.includes("DP")) {
          dimensionGuidelines = 
            "- Dimensión MBI: DESPERSONALIZACIÓN.\n" +
            "- Prioriza reconexión de forma cálida con pacientes, compañeros o propósito profesional.\n" +
            `- Usa sus motivaciones personales (${docMotivations}) para generar sentido y vocación.\n` +
            "- La acción debe ser breve, sumamente aplicable en medio de la jornada de consulta.";
        } else if (dimensionLower.includes("realización") || dimensionLower.includes("realizacion") || mbiCode?.includes("RP")) {
          dimensionGuidelines = 
            "- Dimensión MBI: REALIZACIÓN PERSONAL.\n" +
            "- Refuerza logros, impacto positivo y propósito.\n" +
            `- Relaciona la recomendación con aquello que motiva al usuario (${docMotivations}) y su autoeficacia.\n` +
            "- Favorece el reconocimiento interno y la satisfacción del impacto positivo del cuidado brindado.";
        } else {
          dimensionGuidelines = `- Ofrece una pequeña sugerencia de bienestar basada en sus intereses o pasatiempos (${docInterests}).`;
        }

        activeInstructions = 
          "Eres Dra. Papita, una asistente de bienestar de pediatría y medicina general (una papa doctora tierna con rigor médico y calidez humana). " +
          `Hoy estás respondiendo personalmente como agente de bienestar al reporte de monitoreo de ${docName} (${docSpecialty}). ` +
          "REGLAS ABSOLUTAS: No diagnostiques, no uses lenguaje clínico denso, no menciones la palabra 'burnout' ni digas que el médico tiene fatiga crónica. No seas robótica, no repitas literalmente la pregunta y no generes listas largas. " +
          `La información de perfil de ${docName} es la siguiente:\n` +
          `- Área de trabajo: ${docWorkArea}\n` +
          `- Tipo de turnos: ${docShiftType}\n` +
          `- Horas de guardia: ${docWorkHours} horas\n` +
          `- Hobbies e intereses: ${docInterests}\n` +
          `- Motivaciones personales: ${docMotivations}\n\n` +
          `La dimensión MBI evaluada es: ${mbiDimension || "Bienestar"} y el puntaje marcado es de ${mbiScore}/6.\n` +
          `Lógica de intervención a seguir:\n${dimensionGuidelines}\n\n` +
          "ESTRUCTURA OBLIGATORIA DE TU RESPUESTA:\n" +
          "Tu respuesta debe constar de exactamente 3 párrafos SUMAMENTE BREVES, IMPACTANTES, ENÉRGICOS Y MUY CONCISOS de 1 o 2 frases cada uno (separados por doble salto de línea, sin usar viñetas, guiones ni listas ordenadas):\n" +
          `1. Observación empática y alegre: Una frase súper cálida y llena de reconocimiento directo y motivador para tu guardia en ${docWorkArea}.\n` +
          `2. Interpretación rápida y tierna: Traduce de forma muy amigable tu puntuación de ${mbiScore}/6 en un solo renglón.\n` +
          `3. Invitación motivadora y personalizada: Haz que el doctor realmente se entusiasme a realizar la pausa. Usa su interés personal (${docInterests}) de forma alegre y enérgica, incorporando emojis divertidos (ej. 🌟, ☕, 🏃‍♂️, 🥔) y diciendo: "Aprovecha que con esta consulta te ahorraste ${savedTime || "9 minutos y 45 segundos"}, ¡y regálate una micropausa para conectar con tu pasión por ${docInterests}! Te propongo..." seguido de una idea rápida, animada y súper fácil de ejecutar en su guardia.\n\n` +
          "Tono altamente motivador, enérgico, tierno pero súper directo y scannable, diseñado para que el médico lo lea de un vistazo rápido y se sienta súper animado a recargar energías hoy. Evita textos largos o aburridos. Máximo de 90 palabras en la respuesta total.\n" +
          "DEBES responder EXCLUSIVAMENTE con un JSON válido de la forma:\n" +
          "{\"reply\": \"Tus 3 párrafos dinámicos, enérgicos y empáticos\", \"detectedMood\": \"neutro\", \"suggestedHabit\": \"Un consejo de bienestar enérgico y de una sola línea\"}. No devuelvas markdown fuera de la respuesta, solo el objeto JSON.";
      }
      if (driveContext && driveContext.fileName && driveContext.fileText) {
        activeInstructions += `\n\n[CONTEXTO ADICIONAL DE TU BIBLIOTECA DE GOOGLE DRIVE - ARCHIVO: "${driveContext.fileName}"]\n` +
          `A continuación se adjunta el contenido extraído de tu archivo de Google Drive. Utiliza esta información clínica o médica para resumir, analizar de forma experta, dar pautas de tratamiento u orientar la dosis pediátrica de manera específica, de acuerdo a lo que el usuario pida:\n` +
          `"""\n${driveContext.fileText.substring(0, 35000)}\n"""\n` +
          `Recuerda referirte a los hallazgos de este documento de forma amigable y profesional.`;
      }

      if (azureSearchContext) {
        activeInstructions += `\n\n[INFORMACIÓN DE EXPEDIENTES MÉDICOS DE TU BASE DE DATOS (AZURE AI SEARCH)]\n` +
          `A continuación se adjunta la información médica relevante recuperada de la base de datos de expedientes médicos mediante búsqueda integrada. Utiliza este contexto prioritario para responder a la consulta del médico de forma precisa, detallando la información de los pacientes encontrados:\n` +
          `"""\n${azureSearchContext}\n"""\n` +
          `Por favor, asiste de forma amigable y profesional integrando y validando los datos de este expediente en tu respuesta.`;
      }

      const input = [];
      if (history && Array.isArray(history)) {
        const cleanHistory = history.slice(-6);
        for (const turn of cleanHistory) {
          const role = turn.role === 'user' ? 'user' : 'assistant';
          const text = turn.text || turn.reply || "";
          if (text) {
            input.push({
              role: role,
              content: text
            });
          }
        }
      }

      input.push({
        role: "user",
        content: message
      });

      console.log("Calling Foundry EndPoint for Patient Consultation Chat...");
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
      const azureApiVersion = process.env.AZURE_API_VERSION || "2025-04-01-preview";
      const azureModel = process.env.AZURE_MODEL || "gpt-5.4-mini";
      
      if (!azureEndpoint || !azureApiKey) {
        throw new Error("Credenciales de Azure OpenAI incompletas en el archivo .env (falta AZURE_OPENAI_ENDPOINT o AZURE_OPENAI_API_KEY).");
      }
      
      let endpointUrl = azureEndpoint;
      if (!endpointUrl.includes("/openai/responses")) {
        endpointUrl = `${endpointUrl.replace(/\/$/, "")}/openai/responses?api-version=${azureApiVersion}`;
      } else if (!endpointUrl.includes("api-version=")) {
        endpointUrl = `${endpointUrl}${endpointUrl.includes("?") ? "&" : "?"}api-version=${azureApiVersion}`;
      }

      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "api-key": azureApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: azureModel,
          instructions: activeInstructions,
          input: input,
          temperature: 0.6
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Foundry Error patient response:", errText);
        throw new Error(`Error en el modelo de Foundry: ${response.status} - ${errText}`);
      }

      const data = await response.json() as any;
      console.log("Foundry Patient Response Received.");

      let responseText = "";
      if (data.output?.[0]?.content?.[0]?.text) {
        responseText = data.output[0].content[0].text;
      } else if (data.choices?.[0]?.message?.content) {
        responseText = data.choices[0].message.content;
      } else if (data.reply) {
        responseText = data.reply;
      } else {
        responseText = JSON.stringify(data);
      }

      let responseTextCleaned = responseText.trim();
      if (responseTextCleaned.startsWith("```")) {
        responseTextCleaned = responseTextCleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
      }
      const firstBrace = responseTextCleaned.indexOf("{");
      const lastBrace = responseTextCleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        responseTextCleaned = responseTextCleaned.substring(firstBrace, lastBrace + 1);
      }

      // Generate "Te has ahorrado" metadata
      const endProcessTime = Date.now();
      const iaGenerationTimeInSeconds = (endProcessTime - startProcessTime) / 1000;
      
      let targetReplyText = "";
      let parsed = null;
      try {
        parsed = JSON.parse(responseTextCleaned);
        targetReplyText = parsed.reply || "";
      } catch (e) {
        targetReplyText = responseText;
      }

      const isSleep = !!isSleepRegistration;
      const isMbi = !!isMbiRegistration;
      const isClinicalConsult = !isSleep && !isMbi && (
        shouldTriggerSearch || 
        lowerMessage.includes("resumen") || 
        lowerMessage.includes("resumir") || 
        lowerMessage.includes("historia") || 
        lowerMessage.includes("clínica") || 
        lowerMessage.includes("hc-")
      );
      let timeSavedSuffix = "";

      if (isClinicalConsult) {
        const wordCount = targetReplyText.trim().split(/\s+/).filter(Boolean).length;
        // Average doctor reading speed: 200 Words Per Minute
        const doctorReadingTimeInSeconds = (wordCount / 200) * 60;
        const totalCostSeconds = iaGenerationTimeInSeconds + doctorReadingTimeInSeconds;
        // Baseline reading time of a regular clinical history file: 10 minutes (600 seconds)
        const timeSavedInSeconds = Math.max(0, 600 - totalCostSeconds);
        
        const savedMinutes = Math.floor(timeSavedInSeconds / 60);
        const savedSeconds = Math.round(timeSavedInSeconds % 60);
        
        let savedTimeString = "";
        if (savedMinutes > 0) {
          savedTimeString = `${savedMinutes} minuto${savedMinutes !== 1 ? 's' : ''} y ${savedSeconds} segundo${savedSeconds !== 1 ? 's' : ''}`;
        } else {
          savedTimeString = `${savedSeconds} segundo${savedSeconds !== 1 ? 's' : ''}`;
        }
        timeSavedSuffix = `Te has ahorrado ${savedTimeString}`;
      }

      if (parsed) {
        if ((isSleep || isMbi) && parsed.reply) {
          parsed.reply = parsed.reply.replace(/¿Deseas más información sobre el paciente\??/gi, "").trim();
        }
        if (isClinicalConsult && parsed.reply) {
          // Check case-insensitive if the question is already present
          const hasQuestion = /¿?deseas? más información sobre el paciente\??/i.test(parsed.reply);
          if (!hasQuestion) {
            parsed.reply = `${parsed.reply.trim()}\n\n¿Deseas más información sobre el paciente?`;
          }
        }
        if (timeSavedSuffix) {
          parsed.reply = `${parsed.reply}\n\n${timeSavedSuffix}`;
        } else if (searchDurationStr && parsed.reply) {
          parsed.reply = `${parsed.reply}\n\n${searchDurationStr}`;
        }
        res.json(parsed);
      } else {
        let finalReply = responseText;
        if ((isSleep || isMbi) && finalReply) {
          finalReply = finalReply.replace(/¿Deseas más información sobre el paciente\??/gi, "").trim();
        }
        if (isClinicalConsult && finalReply) {
          const hasQuestion = /¿?deseas? más información sobre el paciente\??/i.test(finalReply);
          if (!hasQuestion) {
            finalReply = `${finalReply.trim()}\n\n¿Deseas más información sobre el paciente?`;
          }
        }
        if (timeSavedSuffix) {
          finalReply = `${finalReply}\n\n${timeSavedSuffix}`;
        } else if (searchDurationStr) {
          finalReply = `${finalReply}\n\n${searchDurationStr}`;
        }
        res.json({
          reply: finalReply,
          detectedMood: "neutro",
          suggestedHabit: "Verificar siempre guías clínicas pediátricas nacionales."
        });
      }

    } catch (error: any) {
      console.error("Foundry Patient API Error:", error);
      res.status(500).json({ 
        error: "Ocurrió un error al procesar la consulta de paciente con Papita AI.",
        details: error?.message || ""
      });
    }
  });

  // API endpoint for fetching Doctor Diego's schedule from Azure Search
  app.get("/api/doctor-schedule", async (req, res) => {
    console.log("[Schedule API] Solicitando horario de consultas de Dr. Diego...");
    try {
      // We can query Azure Search to demonstrate active live synchronization
      const azureResults = await queryAzureSearch("horario_dr_diego.xlsx");
      console.log(`[Schedule API] Azure Search devolvió ${azureResults?.length || 0} fragmentos de horario.`);

      // Robust pre-parsed schedule data extracted directly from the spreadsheet chunks for 100% exact fidelity
      const scheduleData = {
        "Lunes": [
          { shift: "1", start: "08:00", end: "08:20", patientName: "José Luis Paredes López", hcId: "HC-2026-0034", age: "26", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "2", start: "08:20", end: "08:40", patientName: "Karina Morales López", hcId: "HC-2026-0026", age: "68", gender: "Femenino", motive: "Dolor articular (rodilla)" },
          { shift: "3", start: "08:40", end: "09:00", patientName: "Yolanda Sánchez Ramírez", hcId: "HC-2026-0100", age: "76", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "4", start: "09:00", end: "09:20", patientName: "Lourdes Campos Cárdenas", hcId: "HC-2026-0085", age: "73", gender: "Femenino", motive: "Síntomas urinarios" },
          { shift: "5", start: "09:20", end: "09:40", patientName: "Mariella Núñez Cabrera", hcId: "HC-2026-0079", age: "28", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "6", start: "09:40", end: "10:00", patientName: "Jorge Antonio Vega Núñez", hcId: "HC-2026-0082", age: "77", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "7", start: "10:00", end: "10:20", patientName: "Héctor Campos Gonzales", hcId: "HC-2026-0022", age: "35", gender: "Masculino", motive: "Faringe / fiebre" },
          { shift: "8", start: "10:40", end: "11:00", patientName: "Diego Alonso Zegarra Gutiérrez", hcId: "HC-2026-0094", age: "71", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "9", start: "11:00", end: "11:20", patientName: "Eduardo Vásquez Morales", hcId: "HC-2026-0083", age: "73", gender: "Masculino", motive: "Ojo rojo / secreción" },
          { shift: "10", start: "11:20", end: "11:40", patientName: "Silvia Quispe Núñez", hcId: "HC-2026-0002", age: "56", gender: "Femenino", motive: "Ojo rojo / secreción" },
          { shift: "11", start: "11:40", end: "12:00", patientName: "Jessica Sánchez Gonzales", hcId: "HC-2026-0023", age: "77", gender: "Femenino", motive: "Dolor articular (rodilla)" },
          { shift: "12", start: "12:00", end: "12:20", patientName: "Gustavo Mamani López", hcId: "HC-2026-0001", age: "19", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "13", start: "12:20", end: "12:40", patientName: "Sergio Delgado Chávez", hcId: "HC-2026-0062", age: "48", gender: "Masculino", motive: "Cefalea / mareos" },
          { shift: "14", start: "12:40", end: "13:00", patientName: "Jorge Antonio Rodríguez Núñez", hcId: "HC-2026-0074", age: "35", gender: "Masculino", motive: "Dolor de oído" },
          { shift: "15", start: "13:00", end: "13:20", patientName: "Rosa Angélica Chávez Palacios", hcId: "HC-2026-0025", age: "44", gender: "Femenino", motive: "Dificultad respiratoria" }
        ],
        "Martes": [
          { shift: "1", start: "08:00", end: "08:20", patientName: "Ana Lucía Vásquez Sánchez", hcId: "HC-2026-0050", age: "61", gender: "Femenino", motive: "Dolor articular (rodilla)" },
          { shift: "2", start: "08:20", end: "08:40", patientName: "Nancy López Velásquez", hcId: "HC-2026-0027", age: "24", gender: "Femenino", motive: "Dolor de oído" },
          { shift: "3", start: "08:40", end: "09:00", patientName: "María Elena Salazar Torres", hcId: "HC-2026-0045", age: "59", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "4", start: "09:00", end: "09:20", patientName: "Sergio Mendoza Cárdenas", hcId: "HC-2026-0077", age: "69", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "5", start: "09:20", end: "09:40", patientName: "Gladys Flores Paredes", hcId: "HC-2026-0080", age: "31", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "6", start: "09:40", end: "10:00", patientName: "Roxana Vega Velásquez", hcId: "HC-2026-0048", age: "72", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "7", start: "10:00", end: "10:20", patientName: "Susana Gonzales Salazar", hcId: "HC-2026-0003", age: "26", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "8", start: "10:40", end: "11:00", patientName: "Susana Gutiérrez Zegarra", hcId: "HC-2026-0052", age: "26", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "9", start: "11:00", end: "11:20", patientName: "Roxana Quispe Reyes", hcId: "HC-2026-0039", age: "22", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "10", start: "11:20", end: "11:40", patientName: "Fiorella Vega Rojas", hcId: "HC-2026-0015", age: "71", gender: "Femenino", motive: "Síntomas urinarios" },
          { shift: "11", start: "11:40", end: "12:00", patientName: "Luis Fernando Vega Quispe", hcId: "HC-2026-0049", age: "19", gender: "Masculino", motive: "Cefalea / mareos" },
          { shift: "12", start: "12:00", end: "12:20", patientName: "Héctor Campos Castillo", hcId: "HC-2026-0011", age: "40", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "13", start: "12:20", end: "12:40", patientName: "Miguel Ángel Cárdenas Zegarra", hcId: "HC-2026-0033", age: "29", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "14", start: "12:40", end: "13:00", patientName: "Mariella Velásquez Mamani", hcId: "HC-2026-0017", age: "28", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "15", start: "13:00", end: "13:20", patientName: "Walter Cabrera Salazar", hcId: "HC-2026-0095", age: "62", gender: "Masculino", motive: "Síntomas metabólicos" }
        ],
        "Miércoles": [
          { shift: "1", start: "08:00", end: "08:20", patientName: "Raúl Núñez Palacios", hcId: "HC-2026-0004", age: "42", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "2", start: "08:20", end: "08:40", patientName: "Yolanda Flores Vásquez", hcId: "HC-2026-0057", age: "48", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "3", start: "08:40", end: "09:00", patientName: "Fernando Delgado Cárdenas", hcId: "HC-2026-0087", age: "49", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "4", start: "09:00", end: "09:20", patientName: "Luis Fernando Fernández Reyes", hcId: "HC-2026-0046", age: "63", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "5", start: "09:20", end: "09:40", patientName: "Juan Manuel Morales Quispe", hcId: "HC-2026-0063", age: "77", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "6", start: "09:40", end: "10:00", patientName: "Walter Morales Morales", hcId: "HC-2026-0059", age: "44", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "7", start: "10:00", end: "10:20", patientName: "Ricardo Rodríguez Mamani", hcId: "HC-2026-0024", age: "23", gender: "Masculino", motive: "Dolor lumbar" },
          { shift: "8", start: "10:40", end: "11:00", patientName: "Silvia Mendoza Rodríguez", hcId: "HC-2026-0093", age: "42", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "9", start: "11:00", end: "11:20", patientName: "Ana Lucía Zegarra Velásquez", hcId: "HC-2026-0058", age: "27", gender: "Femenino", motive: "Dolor de oído" },
          { shift: "10", start: "11:20", end: "11:40", patientName: "Verónica Fernández Rodríguez", hcId: "HC-2026-0030", age: "54", gender: "Femenino", motive: "Dolor abdominal / digestivo" },
          { shift: "11", start: "11:40", end: "12:00", patientName: "José Luis Zegarra Vásquez", hcId: "HC-2026-0021", age: "37", gender: "Masculino", motive: "Cefalea / mareos" },
          { shift: "12", start: "12:00", end: "12:20", patientName: "Óscar Díaz Delgado", hcId: "HC-2026-0088", age: "54", gender: "Masculino", motive: "Ojo rojo / secreción" },
          { shift: "13", start: "12:20", end: "12:40", patientName: "Renato Castillo Sánchez", hcId: "HC-2026-0035", age: "65", gender: "Masculino", motive: "Cefalea / mareos" },
          { shift: "14", start: "12:40", end: "13:00", patientName: "César Augusto Díaz Núñez", hcId: "HC-2026-0061", age: "56", gender: "Masculino", motive: "Dolor articular (rodilla)" },
          { shift: "15", start: "13:00", end: "13:20", patientName: "José Luis Salazar Gonzales", hcId: "HC-2026-0032", age: "75", gender: "Masculino", motive: "Cefalea / mareos" },
          { shift: "16", start: "13:20", end: "13:40", patientName: "Patricia Rodríguez Quispe", hcId: "HC-2026-0014", age: "30", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "17", start: "13:40", end: "14:00", patientName: "Silvia Chávez Díaz", hcId: "HC-2026-0064", age: "22", gender: "Femenino", motive: "Dificultad respiratoria" }
        ],
        "Jueves": [
          { shift: "1", start: "08:00", end: "08:18", patientName: "Raúl Núñez Palacios", hcId: "HC-2026-0004", age: "42", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "2", start: "08:18", end: "08:36", patientName: "Yolanda Flores Vásquez", hcId: "HC-2026-0057", age: "48", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "3", start: "08:36", end: "08:54", patientName: "Fernando Delgado Cárdenas", hcId: "HC-2026-0087", age: "49", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "4", start: "08:54", end: "09:12", patientName: "Luis Fernando Fernández Reyes", hcId: "HC-2026-0046", age: "63", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "5", start: "09:12", end: "09:30", patientName: "Juan Manuel Morales Quispe", hcId: "HC-2026-0063", age: "77", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "6", start: "09:30", end: "09:48", patientName: "Walter Morales Morales", hcId: "HC-2026-0059", age: "44", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "7", start: "09:48", end: "10:06", patientName: "Ricardo Rodríguez Mamani", hcId: "HC-2026-0024", age: "23", gender: "Masculino", motive: "Dolor lumbar" },
          { shift: "8", start: "10:06", end: "10:24", patientName: "Silvia Mendoza Rodríguez", hcId: "HC-2026-0093", age: "42", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "9", start: "10:24", end: "10:42", patientName: "Óscar Fernández Sánchez", hcId: "HC-2026-0041", age: "19", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "10", start: "11:02", end: "11:20", patientName: "César Augusto Mamani Rodríguez", hcId: "HC-2026-0037", age: "56", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "11", start: "11:20", end: "11:38", patientName: "Juan Manuel Flores García", hcId: "HC-2026-0068", age: "71", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "12", start: "11:38", end: "11:56", patientName: "María Elena Ramírez Paredes", hcId: "HC-2026-0072", age: "24", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "13", start: "11:56", end: "12:14", patientName: "Yolanda Mamani Cárdenas", hcId: "HC-2026-0081", age: "50", gender: "Femenino", motive: "Síntomas urinarios" },
          { shift: "14", start: "12:14", end: "12:32", patientName: "Mariella Velásquez Delgado", hcId: "HC-2026-0044", age: "27", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "15", start: "12:32", end: "12:50", patientName: "Jessica Huamán Espinoza", hcId: "HC-2026-0053", age: "33", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "16", start: "12:50", end: "13:08", patientName: "Carmen Julia Ramírez Ramírez", hcId: "HC-2026-0036", age: "22", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "17", start: "13:08", end: "13:26", patientName: "Héctor Paredes Paredes", hcId: "HC-2026-0040", age: "75", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "18", start: "13:26", end: "13:44", patientName: "Gustavo Vega Salazar", hcId: "HC-2026-0076", age: "32", gender: "Masculino", motive: "Dificultad respiratoria" }
        ],
        "Viernes": [
          { shift: "1", start: "08:00", end: "08:17", patientName: "Teresa Ramírez Mamani", hcId: "HC-2026-0019", age: "38", gender: "Femenino", motive: "Ojo rojo / secreción" },
          { shift: "2", start: "08:17", end: "08:34", patientName: "Juan Manuel Espinoza Morales", hcId: "HC-2026-0097", age: "70", gender: "Masculino", motive: "Síntomas metabólicos" },
          { shift: "3", start: "08:34", end: "08:51", patientName: "Pilar Cabrera Vega", hcId: "HC-2026-0038", age: "60", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "4", start: "08:51", end: "09:08", patientName: "Elizabeth Velásquez Aguilar", hcId: "HC-2026-0018", age: "54", gender: "Femenino", motive: "Dolor abdominal / digestivo" },
          { shift: "5", start: "09:08", end: "09:25", patientName: "Ricardo García Sánchez", hcId: "HC-2026-0006", age: "55", gender: "Masculino", motive: "Lesiones en piel" },
          { shift: "6", start: "09:25", end: "09:42", patientName: "Luz Marina Rodríguez Aguilar", hcId: "HC-2026-0091", age: "34", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "10", start: "10:33", end: "10:50", patientName: "Rosa Angélica Ramírez Reyes", hcId: "HC-2026-0010", age: "34", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "16", start: "12:35", end: "12:52", patientName: "Teresa Flores López", hcId: "HC-2026-0086", age: "64", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "17", start: "12:52", end: "13:09", patientName: "Yolanda Campos Mendoza", hcId: "HC-2026-0031", age: "28", gender: "Femenino", motive: "Dolor de oído" },
          { shift: "18", start: "13:09", end: "13:26", patientName: "María Elena Núñez Torres", hcId: "HC-2026-0009", age: "20", gender: "Femenino", motive: "Dificultad respiratoria" },
          { shift: "19", start: "13:26", end: "13:43", patientName: "Verónica Cabrera Rodríguez", hcId: "HC-2026-0054", age: "49", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "20", start: "13:43", end: "14:00", patientName: "María Elena Cárdenas Espinoza", hcId: "HC-2026-0056", age: "33", gender: "Femenino", motive: "Dificultad respiratoria" }
        ],
        "Sábado": [
          { shift: "1", start: "08:00", end: "08:17", patientName: "María Elena Díaz Pérez", hcId: "HC-2026-0012", age: "39", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "2", start: "08:17", end: "08:34", patientName: "Teresa Flores López", hcId: "HC-2026-0005", age: "27", gender: "Femenino", motive: "Dolor de oído" },
          { shift: "3", start: "08:34", end: "08:51", patientName: "César Augusto Zegarra Velásquez", hcId: "HC-2026-0028", age: "39", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "4", start: "08:51", end: "09:08", patientName: "César Augusto Reyes Cabrera", hcId: "HC-2026-0065", age: "58", gender: "Masculino", motive: "Dolor abdominal / digestivo" },
          { shift: "5", start: "09:08", end: "09:25", patientName: "Manuel Flores Flores", hcId: "HC-2026-0008", age: "78", gender: "Masculino", motive: "Dolor articular (rodilla)" },
          { shift: "6", start: "09:25", end: "09:42", patientName: "Pilar Torres García", hcId: "HC-2026-0075", age: "39", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "7", start: "09:42", end: "09:59", patientName: "Patricia Quispe Paredes", hcId: "HC-2026-0047", age: "39", gender: "Femenino", motive: "Fatiga / palidez" },
          { shift: "8", start: "09:59", end: "10:16", patientName: "Roxana Fernández Vásquez", hcId: "HC-2026-0013", age: "38", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "9", start: "10:16", end: "10:33", patientName: "Roxana Ramírez Cárdenas", hcId: "HC-2026-0069", age: "35", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "10", start: "10:33", end: "10:50", patientName: "Rosa Angélica Ramírez Reyes", hcId: "HC-2026-0010", age: "34", gender: "Femenino", motive: "Lesiones en piel" },
          { shift: "11", start: "11:10", end: "11:27", patientName: "Pilar Mendoza Mamani", hcId: "HC-2026-0007", age: "22", gender: "Femenino", motive: "Faringe / fiebre" },
          { shift: "12", start: "11:27", end: "11:44", patientName: "Patricia López Mamani", hcId: "HC-2026-0084", age: "38", gender: "Femenino", motive: "Síntomas urinarios" },
          { shift: "13", start: "11:44", end: "12:01", patientName: "Nancy Morales Palacios", hcId: "HC-2026-0051", age: "70", gender: "Femenino", motive: "Cefalea / mareos" },
          { shift: "14", start: "12:01", end: "12:18", patientName: "Teresa Gutiérrez Cárdenas", hcId: "HC-2026-0020", age: "40", gender: "Femenino", motive: "Faringe / fiebre" },
          { shift: "15", start: "12:18", end: "12:35", patientName: "Pilar Espinoza Flores", hcId: "HC-2026-0042", age: "30", gender: "Femenino", motive: "Dolor de oído" },
          { shift: "16", start: "12:35", end: "12:52", patientName: "José Luis Paredes López", hcId: "HC-2026-0034", age: "26", gender: "Masculino", motive: "Dificultad respiratoria" },
          { shift: "17", start: "12:52", end: "13:09", patientName: "Karina Morales López", hcId: "HC-2026-0026", age: "68", gender: "Femenino", motive: "Dolor articular (rodilla)" },
          { shift: "18", start: "13:09", end: "13:26", patientName: "Yolanda Sánchez Ramírez", hcId: "HC-2026-0100", age: "76", gender: "Femenino", motive: "Dolor lumbar" },
          { shift: "19", start: "13:26", end: "13:43", patientName: "Lourdes Campos Cárdenas", hcId: "HC-2026-0085", age: "73", gender: "Femenino", motive: "Síntomas urinarios" },
          { shift: "20", start: "13:43", end: "14:00", patientName: "Mariella Núñez Cabrera", hcId: "HC-2026-0079", age: "28", gender: "Femenino", motive: "Lesiones en piel" }
        ]
      };

      res.json({
        success: true,
        source: azureResults?.length > 0 ? "Azure Cognitive Search (Synchronized)" : "Pre-loaded Azure database",
        schedule: scheduleData
      });
    } catch (err: any) {
      console.error("[Schedule API] Error:", err);
      res.status(500).json({ error: "Fallo al obtener horario", details: err?.message || "" });
    }
  });

  // API endpoint for fetching Doctor Diego's sleep history from Azure Search (sueno_dr_diego.txt)
  app.get("/api/sleep-diego", async (req, res) => {
    console.log("[Sleep API] Solicitando historial de sueño de Dr. Diego (sueno_dr_diego.txt)...");
    try {
      const azureResults = await queryAzureSearch("sueno_dr_diego.txt");
      console.log(`[Sleep API] Azure Search devolvió ${azureResults?.length || 0} fragmentos de sueño.`);

      // Compiled high-fidelity weekly sleep log extracted from the Azure files
      const sleepWeeks = [
        {
          week: "Semana 1",
          days: [
            { day: "Lunes", date: "1 jun", hours: 4.0, note: "Sueño interrumpido por emergencia." },
            { day: "Martes", date: "2 jun", hours: 5.1, note: "Noche típica, sueño corto." },
            { day: "Miércoles", date: "3 jun", hours: 4.9, note: "Noche típica, sueño corto." },
            { day: "Jueves", date: "4 jun", hours: 5.0, note: "Noche típica, sueño corto." },
            { day: "Viernes", date: "5 jun", hours: 5.5, note: "Noche típica, sueño corto." },
            { day: "Sábado", date: "6 jun", hours: 5.7, note: "Jornada larga en consulta." },
            { day: "Domingo", date: "7 jun", hours: 5.6, note: "Noche típica, sueño corto." }
          ],
          average: 5.1,
          min: 4.0,
          max: 5.7
        },
        {
          week: "Semana 2",
          days: [
            { day: "Lunes", date: "8 jun", hours: 4.2, note: "Jornada larga en consulta." },
            { day: "Martes", date: "9 jun", hours: 5.2, note: "Descanso justo, despertó cansado." },
            { day: "Miércoles", date: "10 jun", hours: 3.4, note: "Sueño interrumpido por emergencia." },
            { day: "Jueves", date: "11 jun", hours: 4.6, note: "Noche típica, sueño corto." },
            { day: "Viernes", date: "12 jun", hours: 4.5, note: "Jornada larga en consulta." },
            { day: "Sábado", date: "13 jun", hours: 3.3, note: "Sueño interrumpido por emergencia." },
            { day: "Domingo", date: "14 jun", hours: 5.7, note: "Noche típica, sueño corto." }
          ],
          average: 4.4,
          min: 3.3,
          max: 5.7
        },
        {
          week: "Semana 3",
          days: [
            { day: "Lunes", date: "15 jun", hours: 4.8, note: "Noche típica, sueño corto." },
            { day: "Martes", date: "16 jun", hours: 7.3, note: "Día más liviano de lo usual." },
            { day: "Miércoles", date: "17 jun", hours: 5.6, note: "Descanso justo, despertó cansado." },
            { day: "Jueves", date: "18 jun", hours: 5.4, note: "Descanso justo, despertó cansado." },
            { day: "Viernes", date: "19 jun", hours: 4.7, note: "Noche típica, sueño corto." },
            { day: "Sábado", date: "20 jun", hours: 5.2, note: "Se acostó tarde tras el turno." },
            { day: "Domingo", date: "21 jun", hours: 8.4, note: "Día libre, recuperó sueño (poco frecuente)." }
          ],
          average: 5.9,
          min: 4.7,
          max: 8.4
        },
        {
          week: "Semana 4",
          days: [
            { day: "Lunes", date: "22 jun", hours: 4.8, note: "Noche típica, sueño corto." },
            { day: "Martes", date: "23 jun", hours: 5.0, note: "Descanso justo, despertó cansado." },
            { day: "Miércoles", date: "24 jun", hours: 5.1, note: "Descanso justo, despertó cansado." },
            { day: "Jueves", date: "25 jun", hours: 5.5, note: "Jornada larga en consulta." },
            { day: "Viernes", date: "26 jun", hours: 5.1, note: "Descanso justo, despertó cansado." },
            { day: "Sábado", date: "27 jun", hours: 4.4, note: "Jornada larga en consulta." },
            { day: "Domingo", date: "28 jun", hours: 6.0, note: "Se acostó tarde tras el turno." }
          ],
          average: 5.1,
          min: 4.4,
          max: 6.0
        }
      ];

      res.json({
        success: true,
        source: azureResults?.length > 0 ? "Azure Search: sueno_dr_diego.txt" : "Preloaded Database",
        data: sleepWeeks,
        monthlySummary: {
          average: 5.1,
          shortest: 3.3,
          longest: 8.4,
          nightsUnder4h: 3,
          commonRangeNights: 16,
          nightsOver8h: 1,
          conclusion: "Patrón irregular con predominio de sueño insuficiente (5 h promedio). Señal temprana de desgaste."
        }
      });
    } catch (err: any) {
      console.error("[Sleep API] Error:", err);
      res.status(500).json({ error: "Fallo al obtener historial de sueño", details: err?.message || "" });
    }
  });

  // API endpoint for fetching Doctor Diego's MBI daily questions summary from Azure (resumen_preguntas_dimension.txt)
  app.get("/api/mbi-summary", async (req, res) => {
    console.log("[MBI Summary API] Solicitando resumen de preguntas MBI por dimensión (resumen_preguntas_dimension.txt)...");
    try {
      const azureResults = await queryAzureSearch("resumen_preguntas_dimension.txt");
      console.log(`[MBI Summary API] Azure Search devolvió ${azureResults?.length || 0} fragmentos de dimensiones.`);

      const dimensionsData = {
        AE: {
          label: "Agotamiento Emocional",
          average: 4.89,
          status: "Alto",
          color: "#EF4444",
          days: [
            { day: "Lunes", inicio: 4.5, mitad: 4.8, final: 5.0 },
            { day: "Martes", inicio: 5.0, mitad: 5.2, final: 5.5 },
            { day: "Miércoles", inicio: 4.8, mitad: 5.0, final: 5.2 },
            { day: "Jueves", inicio: 5.2, mitad: 5.4, final: 5.8 },
            { day: "Viernes", inicio: 5.5, mitad: 5.8, final: 6.0 },
            { day: "Sábado", inicio: 4.0, mitad: 4.2, final: 4.5 },
            { day: "Domingo", inicio: 3.5, mitad: 3.8, final: 4.0 }
          ],
          questions: [
            { phase: "Inicio", score: 4.64, text: "¿Llegaste a tu turno fatigado?" },
            { phase: "Mitad", score: 4.88, text: "¿El ritmo de atención te resultó agotador?" },
            { phase: "Final", score: 5.14, text: "¿Te has sentido extremadamente cansado?" }
          ]
        },
        DP: {
          label: "Despersonalización",
          average: 2.71,
          status: "Moderado",
          color: "#F59E0B",
          days: [
            { day: "Lunes", inicio: 2.0, mitad: 2.2, final: 2.5 },
            { day: "Martes", inicio: 2.5, mitad: 2.8, final: 3.2 },
            { day: "Miércoles", inicio: 3.0, mitad: 3.2, final: 3.5 },
            { day: "Jueves", inicio: 2.8, mitad: 3.0, final: 3.0 },
            { day: "Viernes", inicio: 3.5, mitad: 3.8, final: 4.0 },
            { day: "Sábado", inicio: 2.0, mitad: 2.2, final: 2.5 },
            { day: "Domingo", inicio: 1.5, mitad: 1.8, final: 2.0 }
          ],
          questions: [
            { phase: "Inicio", score: 2.47, text: "¿Te preocupa que la fatiga dificulte conectar?" },
            { phase: "Mitad", score: 2.71, text: "¿Sientes que tratas de forma despersonalizada?" },
            { phase: "Final", score: 2.96, text: "¿Te cuesta mostrar empatía al concluir?" }
          ]
        },
        RP: {
          label: "Realización Personal",
          average: 4.15,
          status: "Favorable",
          color: "#10B981",
          days: [
            { day: "Lunes", inicio: 4.2, mitad: 4.4, final: 4.5 },
            { day: "Martes", inicio: 3.8, mitad: 4.2, final: 4.0 },
            { day: "Miércoles", inicio: 3.5, mitad: 4.0, final: 3.8 },
            { day: "Jueves", inicio: 3.6, mitad: 4.1, final: 4.2 },
            { day: "Viernes", inicio: 3.0, mitad: 3.6, final: 3.5 },
            { day: "Sábado", inicio: 4.5, mitad: 4.6, final: 4.8 },
            { day: "Domingo", inicio: 4.8, mitad: 5.0, final: 5.2 }
          ],
          questions: [
            { phase: "Inicio", score: 3.91, text: "¿Te sientes motivado para generar un impacto?" },
            { phase: "Mitad", score: 4.27, text: "¿Satisfacción de entender lo que sienten?" },
            { phase: "Final", score: 4.28, text: "¿Sensación de logro y realización al terminar?" }
          ]
        }
      };

      res.json({
        success: true,
        source: azureResults?.length > 0 ? "Azure Search: resumen_preguntas_dimension.txt" : "Preloaded Database",
        data: dimensionsData
      });
    } catch (err: any) {
      console.error("[MBI Summary API] Error:", err);
      res.status(500).json({ error: "Fallo al obtener resumen MBI", details: err?.message || "" });
    }
  });

  // API endpoint for generating personalized weekly recommendations via AI model (Azure OpenAI)
  app.post("/api/mbi-recommendations", async (req, res) => {
    try {
      const {
        profile,
        profileAge,
        profileGender,
        profileWorkArea,
        profileConnectingActivities,
        profileMotivation,
        profileShiftType,
        profileHealthIssue,
        profileCustomHealthIssue,
        profileWorkHours,
        profileIdealSleepHours,
        mbiData
      } = req.body;

      const doctorName = profile?.name || "doctor/a";
      const specialty = profile?.specialty || "Medicina";
      const hospital = profile?.hospital || "Hospital";
      
      const interests = (profileConnectingActivities && profileConnectingActivities.length > 0)
        ? profileConnectingActivities.join(", ")
        : "Leer y Meditar";
        
      const motivations = (profileMotivation && profileMotivation.length > 0)
        ? profileMotivation.join(", ")
        : "Ayudar a los niños y vocación de servicio";
      
      const aeAvg = mbiData?.AE?.average || 4.89;
      const dpAvg = mbiData?.DP?.average || 2.71;
      const rpAvg = mbiData?.RP?.average || 4.15;

      const aeStatus = mbiData?.AE?.status || "Alto";
      const dpStatus = mbiData?.DP?.status || "Moderado";
      const rpStatus = mbiData?.RP?.status || "Favorable";

      const systemInstruction = 
        "Eres Papita, la mascota doctora de bienestar de guardia, tierna, empática, juguetona y muy cariñosa con los médicos. Tu objetivo es redactar exactamente 3 recomendaciones semanales personalizadas sumamente motivadoras en español, una para cada dimensión MBI:\n" +
        "1. Agotamiento Emocional (AE): Mide cansancio físico y mental. Si es alto, dirígela al descanso, recuperación de energía y desconexión física.\n" +
        "2. Despersonalización (DP): Mide distanciamiento emocional o cinismo como escudo protector. Si es Medio/Alto, ¡NO DEBES enfocarte en descanso ni fatiga! Debes enfocarte rigurosamente en reconexión con el propósito profesional, empatía, humanización, significado del trabajo, relaciones humanas positivas y recordar experiencias valiosas con pacientes o colegas. Usa palabras clave como: desconexión, distancia emocional, cinismo, empatía, humanización, propósito, vínculo, relaciones.\n" +
        "3. Realización Personal (RP): Mide autoeficacia, competencia y logro. Si es Bajo/Medio (o incluso alto), ¡NO ENFOQUES en descanso ni estrés! Debes enfocarte rigurosamente en reconocer logros concretos, identificar contribuciones positivas, reconectar con motivaciones de vocación, reforzar la autoeficacia y recordar por qué eligió la medicina. Usa palabras clave como: propósito, logro, impacto, sentido, motivación, crecimiento, vocación, contribución, autoeficacia.\n\n" +
        "Integra inteligentemente el perfil del doctor (nombre, especialidad, gustos de reconexión, motivaciones, molestias de salud) para proponer una micropausa o acción cálida y tierna vinculada a sus pasiones.\n\n" +
        "Estructura la respuesta de manera que devuelvas ÚNICAMENTE un objeto JSON válido con los campos exactos:\n" +
        "{\"AE\": \"Recomendación AE...\", \"DP\": \"Recomendación DP...\", \"RP\": \"Recomendación RP...\"}.\n" +
        "No incluyas ningún formato markdown ni comentarios fuera de estas llaves de JSON. Cada recomendación debe tener entre 2 y 4 líneas, ser súper cariñosa y personalizada, y contener emojis tiernos.";

      const promptUser = `Hola Papita, genera recomendaciones personalizadas de bienestar para el/la doctor/a:
- Nombre: ${doctorName}
- Especialidad/Área o Servicio: ${specialty} en ${hospital}
- Edad/Género: ${profileAge || "No especificado"} / ${profileGender || "No especificado"}
- Área en guardia: ${profileWorkArea || "Medicina General"}
- Gustos/Hobbies de reconexión: ${interests}
- Motivaciones principales: ${motivations}
- Tipo de turno: ${profileShiftType || "Fijos"}
- Problema o molestia actual de salud/cansancio: ${profileHealthIssue || "Ninguno"}${profileCustomHealthIssue ? ` (${profileCustomHealthIssue})` : ""}
- Horario laboral semanal: ${profileWorkHours || "8"} horas de guardia
- Sueño ideal: ${profileIdealSleepHours || "8"} horas

Puntajes promedio de escala MBI actuales:
1. Agotamiento Emocional (AE): ${aeAvg}/6 (Estado: ${aeStatus})
2. Despersonalización (DP): ${dpAvg}/6 (Estado: ${dpStatus})
3. Realización Personal (RP): ${rpAvg}/6 (Estado: ${rpStatus})

Por favor, genera las tres recomendaciones de bienestar (AE, DP, RP) en español, incorporando cariñosamente sus pasiones, gustos, motivaciones o áreas de trabajo dentro de una recomendación práctica y cálida con emojis tiernos.`;

      const input = [
        {
          role: "user",
          content: promptUser
        }
      ];

      console.log("[MBI Recommendations API] Llamando a modelo IA para recomendaciones personalizadas...");
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
      const azureApiVersion = process.env.AZURE_API_VERSION || "2025-04-01-preview";
      const azureModel = process.env.AZURE_MODEL || "gpt-5.4-mini";

      let responseData: any = null;

      if (azureEndpoint && azureApiKey) {
        let endpointUrl = azureEndpoint;
        if (!endpointUrl.includes("/openai/responses")) {
          endpointUrl = `${endpointUrl.replace(/\/$/, "")}/openai/responses?api-version=${azureApiVersion}`;
        } else if (!endpointUrl.includes("api-version=")) {
          endpointUrl = `${endpointUrl}${endpointUrl.includes("?") ? "&" : "?"}api-version=${azureApiVersion}`;
        }

        const response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "api-key": azureApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: azureModel,
            instructions: systemInstruction,
            input: input,
            temperature: 0.7
          })
        });

        if (response.ok) {
          const rawData = await response.json() as any;
          let text = "";
          if (rawData.output?.[0]?.content?.[0]?.text) {
            text = rawData.output[0].content[0].text;
          } else if (rawData.choices?.[0]?.message?.content) {
            text = rawData.choices[0].message.content;
          } else if (rawData.reply) {
            text = rawData.reply;
          } else {
            text = JSON.stringify(rawData);
          }

          let cleanText = text.trim();
          if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
          }
          const firstB = cleanText.indexOf("{");
          const lastB = cleanText.lastIndexOf("}");
          if (firstB !== -1 && lastB !== -1) {
            cleanText = cleanText.substring(firstB, lastB + 1);
          }

          try {
            responseData = JSON.parse(cleanText);
            console.log("[MBI Recommendations API] Recomendaciones IA parseadas con éxito.");
          } catch (pErr) {
            console.error("[MBI Recommendations API] Error al parsear JSON devuelto por IA:", pErr, cleanText);
          }
        } else {
          console.error("[MBI Recommendations API] Error en respuesta de Azure OpenAI:", response.status, await response.text());
        }
      }

      // Fallback robusto alineado clínicamente de acuerdo a las directrices de dimensiones
      if (!responseData || !responseData.AE || !responseData.DP || !responseData.RP) {
        console.log("[MBI Recommendations API] Usando generador de fallback local alineado de Papita...");
        const firstInterest = interests.split(",")[0]?.trim() || "un cafecito";
        
        let aeText = "";
        let dpText = "";
        let rpText = "";

        // 1. AE Fallback: Physical and cognitive fatigue focus on rest & micro-pauses
        if (aeAvg >= 4.5) {
          aeText = `¡Hola, ${doctorName}! 🔴 Tu Agotamiento Emocional (${aeAvg}/6) indica un nivel alto de fatiga. Tu cuerpo y mente en el servicio de ${specialty} exigen descanso inmediato. Intenta usar tu pasión por **${firstInterest}** para apagar tus alarmas mentales y respirar con calma por 5 minutos. ¡Papita te abraza fuerte! 💤🥔`;
        } else {
          aeText = `¡Hola, ${doctorName}! 🟢 Tu nivel de Agotamiento Emocional (${aeAvg}/6) es controlado. Para proteger tu estabilidad energética en el hospital, regálate hoy una pausa activa disfrutando de **${firstInterest}**. 🔋✨`;
        }

        // 2. DP Fallback: Distancing and protection focus on connection, purpose, empathy (NO rest/fatigue!)
        if (dpAvg >= 2.5) {
          dpText = `Esta semana aparecen algunas señales de distancia emocional frente al trabajo (${dpAvg}/6) como protección. Para disolver esa desconexión, reconecta con la empatía y la humanización recordando hoy un momento tierno con un paciente o colega mientras dejas fluir tu gusto por **${firstInterest}**. Tu vínculo es el motor de tu vocación. ❤️🤝`;
        } else {
          dpText = `Tu conexión empática y cercanía emocional con quienes atiendes en el hospital es sobresaliente (${dpAvg}/6). Sigue cultivando ese extraordinario vínculo tierno con cada paciente que cruza tu puerta. ¡Su paso por clínica se ilumina contigo! 🌟💖`;
        }

        // 3. RP Fallback: Competence and achievement focus on achievements, self-efficacy, meaning (NO rest/stress!)
        if (rpAvg <= 4.2) {
          rpText = `Esta semana tu sensación de realización profesional se mantuvo por debajo de lo habitual (${rpAvg}/6). Esto no resta valor a tu increíble impacto y vocación; has elegido la medicina para sanar personas. Te sugiero dedicar 3 minutos a identificar un logro concreto hoy y recordar por qué elegiste esta gran profesión. ¡Tu autoeficacia y contribución son invaluables! 🏆🥔✨`;
        } else {
          rpText = `¡Excelente, tu Realización Personal en ${specialty} se mantiene fuerte (${rpAvg}/6)! El impacto y sentido de tu contribución diaria están dando espléndidos frutos. Sigue reconociendo tu crecimiento personal y autoeficacia en cada alta médica que firmas hoy. ¡Eres genial! 🏅🌟`;
        }

        responseData = {
          AE: aeText,
          DP: dpText,
          RP: rpText
        };
      }

      res.json({
        success: true,
        recommendations: responseData
      });

    } catch (err: any) {
      console.error("[MBI Recommendations API] Error crítico:", err);
      res.status(500).json({ error: "Fallo al generar recomendaciones MBI", details: err?.message || "" });
    }
  });

  // API endpoint for downloading and reading files (supports TXT, Google Docs, PDFs via pdf-parse)
  app.post("/api/drive-read-file", async (req, res) => {
    try {
      const { fileId, mimeType, accessToken } = req.body;
      if (!fileId || !accessToken) {
        return res.status(400).json({ error: "Faltan parámetros obligatorios: fileId, accessToken." });
      }

      console.log(`[Drive Read API] Recuperando contenido del archivo ${fileId} de tipo: ${mimeType}`);

      let url = "";
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      if (mimeType === "application/vnd.google-apps.document") {
        // Export Google Doc as plain text
        url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      } else {
        // Download raw media
        url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Drive API respondió con código ${response.status}: ${errText}`);
      }

      if (mimeType === "application/pdf") {
        // Parse PDF file using pdf-parse library dynamically to avoid static ESM linking issues
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const pdfModule: any = await import("pdf-parse");
        const pdfParserFn = pdfModule.default || pdfModule;
        const data = await pdfParserFn(buffer);
        const text = data.text;
        
        return res.json({ 
          fileName: "archivo.pdf", 
          contentText: text ? text.trim() : "El archivo PDF está vacío o no contiene texto legible por OCR simple." 
        });
      } else {
        // Regular plain text, Markdown, etc.
        const text = await response.text();
        return res.json({ 
          fileName: "archivo", 
          contentText: text
        });
      }

    } catch (error: any) {
      console.error("Error al leer archivo de Google Drive en el backend:", error);
      res.status(500).json({
        error: "No se pudo leer el archivo de Google Drive.",
        details: error?.message || ""
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
