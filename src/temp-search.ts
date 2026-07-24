import dotenv from "dotenv";
dotenv.config();

async function run() {
  const endpoint = "https://papa-ai-iq.search.windows.net/indexes/rag-1781309433060/docs/search?api-version=2024-07-01";
  const apiKey = "YOUR-API-KEY-HERE"; // Replace with your actual API key

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        search: "sueno_dr_diego.txt",
        top: 20
      })
    });

    if (!response.ok) {
      console.error("Error:", await response.text());
      return;
    }

    const data = await response.json() as any;
    console.log("Found matches:");
    if (data.value) {
      for (const doc of data.value) {
        console.log(`\n==========================================`);
        console.log(`Chunk ID: ${doc.chunk_id || doc.id}`);
        console.log(`Title: ${doc.title || doc.metadata_storage_name}`);
        console.log(`Content:\n${doc.chunk || doc.content || JSON.stringify(doc)}`);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

run();
