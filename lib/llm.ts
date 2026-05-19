import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export function getLLM(options?: { numPredict?: number }) {
  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      maxTokens: options?.numPredict || 400,
    });
  }

  if (process.env.GEMINI_API_KEY) {
    return new ChatOpenAI({
      openAIApiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      temperature: 0,
      maxTokens: options?.numPredict || 400,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
    });
  }

  return new ChatOllama({
    model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    temperature: 0,
    numPredict: options?.numPredict || 400,
  });
}

export function getEmbeddings() {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    });
  }

  if (process.env.GEMINI_API_KEY) {
    return new OpenAIEmbeddings({
      openAIApiKey: process.env.GEMINI_API_KEY,
      modelName: process.env.GEMINI_EMBEDDINGS_MODEL || 'text-embedding-004',
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
    });
  }

  return new OllamaEmbeddings({
    model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });
}

let detectedDimension: number | null = null;

export async function getVectorDimension(): Promise<number> {
  if (detectedDimension !== null) return detectedDimension;
  const embeddings = getEmbeddings();
  try {
    const dummy = await embeddings.embedQuery("test");
    detectedDimension = dummy.length;
    return detectedDimension;
  } catch (e) {
    if (process.env.OPENAI_API_KEY) {
      return 1536; // text-embedding-3-small default
    }
    if (process.env.GEMINI_API_KEY) {
      return 768; // text-embedding-004 default
    }
    return 768; // nomic-embed-text default
  }
}
