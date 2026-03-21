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

export async function resolveWebsiteDomain(nameOrUrl: string): Promise<string | null> {
  const client = getQdrantClient();
  try {
    const result = await client.scroll(COLLECTION_NAME, {
      limit: 200,
      with_payload: true,
    });

    const domains = new Set<string>();
    for (const point of result.points) {
      const d = (point.payload as any)?.metadata?.domain;
      if (d) domains.add(d as string);
    }

    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '')
        .replace(/[\.\-]/g, '_');

    const needle = normalize(nameOrUrl);

    // exact match first
    for (const d of domains) {
      if (d === needle) return d;
    }
    // partial / contains match
    for (const d of domains) {
      if (d.includes(needle) || needle.includes(d)) return d;
    }
    // token match
    const needleTokens = needle.split('_').filter(t => t.length > 2);
    for (const d of domains) {
      const dTokens = d.split('_');
      if (needleTokens.some(t => dTokens.includes(t))) return d;
    }
    return null;
  } catch {
    return null;
  }
}

export async function websiteExists(websiteUrl: string): Promise<boolean> {
  const domain = await resolveWebsiteDomain(websiteUrl);
  return domain !== null;
}