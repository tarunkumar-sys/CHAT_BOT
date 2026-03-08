import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbeddings } from '@langchain/ollama';
import { v4 as uuidv4 } from 'uuid';

const MEMORY_COLLECTION = 'conversation_memory';
const EMBEDDING_DIM = 768; // nomic-embed-text

interface ConversationTurn {
  id: string;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  timestamp: number;
  sessionId: string;
}

export class VectorMemory {
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

  /**
   * Initialize the memory collection
   */
  async initialize() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === MEMORY_COLLECTION);
      
      if (!exists) {
        await this.client.createCollection(MEMORY_COLLECTION, {
          vectors: {
            size: EMBEDDING_DIM,
            distance: 'Cosine',
          },
        });
        console.log('[Vector Memory] Collection created');
      }
    } catch (error) {
      console.error('[Vector Memory] Initialization error:', error);
    }
  }

  /**
   * Save a conversation turn to vector memory (with deduplication)
   */
  async saveConversation(
    userId: string,
    userMessage: string,
    assistantMessage: string,
    sessionId: string = 'default-session'
  ) {
    try {
      await this.initialize();

      // Check for similar existing conversation to avoid duplicates
      const similarityThreshold = 0.95; // 95% similar = duplicate
      const combinedText = `User: ${userMessage}\nAssistant: ${assistantMessage}`;
      const embedding = await this.embeddings.embedQuery(combinedText);

      // Search for very similar conversations
      const existingSearch = await this.client.search(MEMORY_COLLECTION, {
        vector: embedding,
        limit: 1,
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'sessionId', match: { value: sessionId } },
          ],
        },
        score_threshold: similarityThreshold,
      });

      // If very similar conversation exists, skip saving
      if (existingSearch.length > 0) {
        console.log(`[Vector Memory] Skipping duplicate conversation (similarity: ${existingSearch[0].score})`);
        return;
      }

      const id = uuidv4();
      const timestamp = Date.now();

      // Store in Qdrant with metadata
      await this.client.upsert(MEMORY_COLLECTION, {
        points: [
          {
            id,
            vector: embedding,
            payload: {
              userId,
              userMessage,
              assistantMessage,
              timestamp,
              sessionId,
              date: new Date(timestamp).toISOString(),
            },
          },
        ],
      });

      console.log(`[Vector Memory] Saved conversation for user: ${userId}`);
    } catch (error) {
      console.error('[Vector Memory] Save error:', error);
    }
  }

  /**
   * Retrieve relevant conversation history based on current query
   */
  async getRelevantHistory(
    userId: string,
    currentQuery: string,
    limit: number = 5,
    sessionId: string = 'default-session'
  ): Promise<ConversationTurn[]> {
    try {
      await this.initialize();

      // Generate embedding for current query
      const queryEmbedding = await this.embeddings.embedQuery(currentQuery);

      // Search for similar conversations
      const searchResult = await this.client.search(MEMORY_COLLECTION, {
        vector: queryEmbedding,
        limit,
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'sessionId', match: { value: sessionId } },
          ],
        },
        with_payload: true,
      });

      // Convert to conversation turns
      const conversations: ConversationTurn[] = searchResult.map((result: any) => ({
        id: result.id,
        userId: result.payload.userId,
        userMessage: result.payload.userMessage,
        assistantMessage: result.payload.assistantMessage,
        timestamp: result.payload.timestamp,
        sessionId: result.payload.sessionId,
      }));

      console.log(`[Vector Memory] Retrieved ${conversations.length} relevant conversations`);
      return conversations;
    } catch (error) {
      console.error('[Vector Memory] Retrieval error:', error);
      return [];
    }
  }

  /**
   * Get recent conversation history (time-based)
   */
  async getRecentHistory(
    userId: string,
    limit: number = 10,
    sessionId: string = 'default-session'
  ): Promise<ConversationTurn[]> {
    try {
      await this.initialize();

      // Scroll through recent conversations
      // Note: Qdrant scroll doesn't support order_by, so we get all and sort in memory
      const scrollResult = await this.client.scroll(MEMORY_COLLECTION, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'sessionId', match: { value: sessionId } },
          ],
        },
        limit: 100, // Get more to sort
        with_payload: true,
      });

      const conversations: ConversationTurn[] = scrollResult.points
        .map((point: any) => ({
          id: point.id,
          userId: point.payload.userId,
          userMessage: point.payload.userMessage,
          assistantMessage: point.payload.assistantMessage,
          timestamp: point.payload.timestamp,
          sessionId: point.payload.sessionId,
        }))
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
        .slice(0, limit); // Take only the requested limit

      console.log(`[Vector Memory] Retrieved ${conversations.length} recent conversations`);
      return conversations;
    } catch (error) {
      console.error('[Vector Memory] Recent history error:', error);
      return [];
    }
  }

  /**
   * Format conversation history for LLM context
   * Only includes relevant information without exposing the formatting structure
   */
  formatHistoryForContext(conversations: ConversationTurn[], currentQuery: string): string {
    if (conversations.length === 0) return '';

    // Filter out conversations that are too old (more than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentConversations = conversations.filter(conv => conv.timestamp > oneHourAgo);

    if (recentConversations.length === 0) return '';

    // Sort chronologically
    const sorted = recentConversations.sort((a, b) => a.timestamp - b.timestamp);

    // Format as natural conversation context
    const formatted = sorted
      .map(conv => {
        // Only include if it seems relevant to current query
        const isRelevant = this.isRelevantToQuery(conv, currentQuery);
        if (!isRelevant) return null;
        
        return `Previous context:\nQ: ${conv.userMessage}\nA: ${conv.assistantMessage}`;
      })
      .filter(Boolean)
      .join('\n\n');

    if (!formatted) return '';

    return `${formatted}\n\nCurrent question:\n`;
  }

  /**
   * Check if a conversation is relevant to the current query
   */
  private isRelevantToQuery(conversation: ConversationTurn, currentQuery: string): boolean {
    const queryLower = currentQuery.toLowerCase();
    const userMsgLower = conversation.userMessage.toLowerCase();
    const assistantMsgLower = conversation.assistantMessage.toLowerCase();

    // Check for common words (excluding stop words)
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'who'];
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3 && !stopWords.includes(w));
    
    if (queryWords.length === 0) return false;

    // Check if any significant word from query appears in the conversation
    const hasOverlap = queryWords.some(word => 
      userMsgLower.includes(word) || assistantMsgLower.includes(word)
    );

    return hasOverlap;
  }

  /**
   * Clear all memory for a user
   */
  async clearUserMemory(userId: string, sessionId: string = 'default-session') {
    try {
      await this.initialize();

      // Delete all points for this user and session
      await this.client.delete(MEMORY_COLLECTION, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'sessionId', match: { value: sessionId } },
          ],
        },
      });

      console.log(`[Vector Memory] Cleared memory for user: ${userId}`);
    } catch (error) {
      console.error('[Vector Memory] Clear error:', error);
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(userId: string, sessionId: string = 'default-session') {
    try {
      await this.initialize();

      const countResult = await this.client.count(MEMORY_COLLECTION, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } },
            { key: 'sessionId', match: { value: sessionId } },
          ],
        },
      });

      return {
        totalConversations: countResult.count,
        userId,
        sessionId,
      };
    } catch (error) {
      console.error('[Vector Memory] Stats error:', error);
      return { totalConversations: 0, userId, sessionId };
    }
  }
}

// Singleton instance
let vectorMemoryInstance: VectorMemory | null = null;

export function getVectorMemory(): VectorMemory {
  if (!vectorMemoryInstance) {
    vectorMemoryInstance = new VectorMemory();
  }
  return vectorMemoryInstance;
}
