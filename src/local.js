import "dotenv/config";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
//import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const YOUTUBE_VIDEO_URL = "https://www.youtube.com/watch?v=FZhbJZEgKQ4";
const QUESTION = "What wine would you suggest ?";

// Load documents ------------------------------------------------------------

console.log("Loading documents...");
/*
const loader = YoutubeLoader.createFromUrl(YOUTUBE_VIDEO_URL, {
  language: "en",
  addVideoInfo: true,
});
const rawDocuments = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,
  chunkOverlap: 200,
});
*/

const loader=new CSVLoader("hugo-db.wines.csv");
const rawDocuments=await loader.load();
const splitter=new RecursiveCharacterTextSplitter({
  chunkSize:1500,
  chunkOverlap:200,
});




const documents = await splitter.splitDocuments(rawDocuments);

// Init models and DB --------------------------------------------------------

console.log("Initializing models and DB...");

const embeddings = new OllamaEmbeddings({ model: "nomic-embed-text" });
const model = new ChatOllama({ model: "llama3.2" });
const vectorStore = new FaissStore(embeddings, {});

console.log("Embedding documents...");
await vectorStore.addDocuments(documents);

// Run the chain -------------------------------------------------------------

console.log("Running the chain...");

const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a sommelier at a restaurant. Suggest wine based on time of the day and meals and dish if any offered and price. Only from the list provide below:\n\n{context}"],
  ["human", "{input}"],
]);
const retriever = vectorStore.asRetriever()
const ragChain = await createStuffDocumentsChain({
  prompt: questionAnsweringPrompt,
  llm: model,
});
const stream = await ragChain.stream({
  input: QUESTION,
  context: await retriever.invoke(QUESTION)
});

// Print the result ----------------------------------------------------------

console.log(`Answer for the question "${QUESTION}":\n`);
for await (const chunk of stream) {
  process.stdout.write(chunk ?? "");
}
console.log();
