import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantVectorStore } from '@langchain/qdrant';
import { getEmbeddings, getVectorDimension } from './llm';

export function getQdrantClient() {
  return new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  });
}

export async function getCollectionName() {
  const dim = await getVectorDimension();
  return `website_chunks_${dim}`;
}

export async function createVectorstore(chunks: string[], websiteUrl: string) {
  const domain = new URL(websiteUrl).hostname.replace(/\./g, '_');
  const client = getQdrantClient();
  const collectionName = await getCollectionName();

  // Check if collection exists, create if not
  const collections = await client.getCollections();
  if (!collections.collections.some(c => c.name === collectionName)) {
    const dim = await getVectorDimension();
    await client.createCollection(collectionName, {
      vectors: {
        size: dim,
        distance: 'Cosine',
      },
    });
  }

  const embeddings = getEmbeddings();

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
      collectionName: collectionName,
    }
  );

  return vectorStore;
}

export async function resolveWebsiteDomain(nameOrUrl: string): Promise<string | null> {
  const client = getQdrantClient();
  const collectionName = await getCollectionName();
  try {
    const result = await client.scroll(collectionName, {
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