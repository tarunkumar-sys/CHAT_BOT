import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantVectorStore } from '@langchain/qdrant';
import { OllamaEmbeddings } from '@langchain/ollama';

const COLLECTION_NAME = 'website_chunks';
const EMBEDDING_DIM = 768; // nomic-embed-text

export function getQdrantClient() {
  return new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  });
}

export async function createVectorstore(chunks: string[], websiteUrl: string) {
  const domain = new URL(websiteUrl).hostname.replace(/\./g, '_');
  const client = getQdrantClient();

  // Check if collection exists, create if not
  const collections = await client.getCollections();
  if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIM,
        distance: 'Cosine',
      },
    });
  }

  const embeddings = new OllamaEmbeddings({
    model: 'nomic-embed-text',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });

  const metadatas = chunks.map(() => ({
    source: websiteUrl,
    domain: domain,
  }));

  const vectorStore = await QdrantVectorStore.fromTexts(
    chunks,
    metadatas,
    embeddings,
    {
      client,
      collectionName: COLLECTION_NAME,
    }
  );

  return vectorStore;
}

export async function websiteExists(websiteUrl: string): Promise<boolean> {
  const domain = new URL(websiteUrl).hostname.replace(/\./g, '_');
  const client = getQdrantClient();
  try {
    const response = await client.scroll(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'metadata.domain', match: { value: domain } }],
      },
      limit: 1,
    });
    return response.points.length > 0;
  } catch (error) {
    return false;
  }
}