import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbeddings } from '@langchain/ollama';
import { v4 as uuidv4 } from 'uuid';

const CUSTOM_MEMORY_COLLECTION = 'user_custom_memory';
const EMBEDDING_DIM = 768; // nomic-embed-text

export interface MemoryFact {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
}

export class CustomMemory {
  private client: QdrantClient;
  private embeddings: OllamaEmbeddings;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });
    this.embeddings = new OllamaEmbeddings({
      model: 'nomic-embed-text',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
  }

  async initialize() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === CUSTOM_MEMORY_COLLECTION);
      if (!exists) {
        await this.client.createCollection(CUSTOM_MEMORY_COLLECTION, {
          vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
        });
        console.log('[Custom Memory] Collection created');
      }
    } catch (err) {
      console.error('[Custom Memory] Init error:', err);
    }
  }

  /** Save a new user-provided fact */
  async addFact(userId: string, text: string): Promise<MemoryFact> {
    await this.initialize();
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const embedding = await this.embeddings.embedQuery(text);

    await this.client.upsert(CUSTOM_MEMORY_COLLECTION, {
      points: [
        {
          id,
          vector: embedding,
          payload: { userId, text, createdAt },
        },
      ],
    });

    console.log(`[Custom Memory] Saved fact for user: ${userId}`);
    return { id, text, userId, createdAt };
  }

  /** Delete a fact by ID */
  async deleteFact(userId: string, factId: string): Promise<void> {
    await this.initialize();
    await this.client.delete(CUSTOM_MEMORY_COLLECTION, {
      points: [factId],
    });
    console.log(`[Custom Memory] Deleted fact: ${factId}`);
  }

  /** List all facts for a user */
  async listFacts(userId: string): Promise<MemoryFact[]> {
    await this.initialize();
    try {
      const result = await this.client.scroll(CUSTOM_MEMORY_COLLECTION, {
        filter: { must: [{ key: 'userId', match: { value: userId } }] },
        limit: 200,
        with_payload: true,
      });

      return result.points
        .map((p: any) => ({
          id: String(p.id),
          text: p.payload.text,
          userId: p.payload.userId,
          createdAt: p.payload.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      return [];
    }
  }

  /** Retrieve facts relevant to a query using semantic search */
  async getRelevantFacts(userId: string, query: string, limit = 5): Promise<MemoryFact[]> {
    await this.initialize();
    try {
      const embedding = await this.embeddings.embedQuery(query);
      const results = await this.client.search(CUSTOM_MEMORY_COLLECTION, {
        vector: embedding,
        limit,
        filter: { must: [{ key: 'userId', match: { value: userId } }] },
        with_payload: true,
        score_threshold: 0.4,
      });

      return results.map((r: any) => ({
        id: String(r.id),
        text: r.payload.text,
        userId: r.payload.userId,
        createdAt: r.payload.createdAt,
      }));
    } catch {
      return [];
    }
  }

  /** Format facts as context string for the LLM */
  formatFactsForContext(facts: MemoryFact[]): string {
    if (facts.length === 0) return '';
    const lines = facts.map(f => `- ${f.text}`).join('\n');
    return `Known facts about the user:\n${lines}`;
  }
}

// Singleton
let instance: CustomMemory | null = null;
export function getCustomMemory(): CustomMemory {
  if (!instance) instance = new CustomMemory();
  return instance;
}
