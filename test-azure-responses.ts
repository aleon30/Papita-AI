import dotenv from "dotenv";
dotenv.config();

async function testWithPayload(payload: any, label: string) {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureApiVersion = process.env.AZURE_API_VERSION || "2025-04-01-preview";

  if (!azureEndpoint || !azureApiKey) {
    console.error("Credenciales Azure OpenAI no configuradas en .env (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY)");
    return false;
  }

  let endpointUrl = azureEndpoint;
  if (!endpointUrl.includes("/openai/responses")) {
    endpointUrl = `${endpointUrl.replace(/\/$/, "")}/openai/responses?api-version=${azureApiVersion}`;
  } else if (!endpointUrl.includes("api-version=")) {
    endpointUrl = `${endpointUrl}${endpointUrl.includes("?") ? "&" : "?"}api-version=${azureApiVersion}`;
  }

  console.log(`--- Testing ${label} ---`);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "api-key": azureApiKey || "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.substring(0, 1000));
    return response.status === 200 || response.status === 201;
  } catch (error) {
    console.error("Failed:", error);
    return false;
  }
}

async function run() {
  const model = process.env.AZURE_MODEL || "gpt-5.4-mini";

  // Option A: input is a simple string messages-like array, e.g. [ { role: "user", content: "Hola" } ]
  const payloadA = {
    model: model,
    instructions: "Eres Dra. Papita. Responde siempre con un JSON de la forma: {\"reply\": \"respuesta corta\"}.",
    input: [
      {
        role: "user",
        content: "Hola Dra. Papita"
      }
    ],
    temperature: 0.7
  };
  const okA = await testWithPayload(payloadA, "Option A (input as standard role & string content array)");
  if (okA) return;

  // Option B: input uses content block array (like OpenAI Responses structure)
  const payloadB = {
    model: model,
    instructions: "Eres Dra. Papita.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Hola"
          }
        ]
      }
    ],
    temperature: 0.7
  };
  const okB = await testWithPayload(payloadB, "Option B (input as standard content blocks array)");
  if (okB) return;

  // Option C: input contains "input_text"
  const payloadC = {
    model: model,
    instructions: "Eres Dra. Papita.",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Hola"
          }
        ]
      }
    ],
    temperature: 0.7
  };
  await testWithPayload(payloadC, "Option C (input with input_items/message types structure)");
}

run();
