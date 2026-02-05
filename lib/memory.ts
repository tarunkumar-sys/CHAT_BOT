interface MemoryItem {
  id: string;
  key: string;
  value: string;
  timestamp: Date;
}

class MemoryStore {
  private memories: Map<string, MemoryItem> = new Map();
  
  constructor() {
    // Initialize with some personal data
    this.initializeDefaultMemories();
  }
  
  private initializeDefaultMemories() {
    const defaultMemories: MemoryItem[] = [
      {
        id: '1',
        key: 'name',
        value: 'Alex Johnson',
        timestamp: new Date()
      },
      {
        id: '2',
        key: 'age',
        value: '28',
        timestamp: new Date()
      },
      {
        id: '3',
        key: 'location',
        value: 'San Francisco',
        timestamp: new Date()
      },
      {
        id: '4',
        key: 'occupation',
        value: 'Software Developer',
        timestamp: new Date()
      },
      {
        id: '5',
        key: 'hobbies',
        value: 'hiking, reading sci-fi, playing guitar',
        timestamp: new Date()
      },
      {
        id: '6',
        key: 'favorite_food',
        value: 'sushi and ramen',
        timestamp: new Date()
      },
      {
        id: '7',
        key: 'pet',
        value: 'a golden retriever named Max',
        timestamp: new Date()
      }
    ];
    
    defaultMemories.forEach(memory => {
      this.memories.set(memory.key, memory);
    });
  }
  
  addMemory(key: string, value: string): void {
    const memory: MemoryItem = {
      id: Date.now().toString(),
      key,
      value,
      timestamp: new Date()
    };
    this.memories.set(key, memory);
  }
  
  getMemory(key: string): string | null {
    return this.memories.get(key)?.value || null;
  }
  
  searchMemories(query: string): MemoryItem[] {
    const results: MemoryItem[] = [];
    const queryLower = query.toLowerCase();
    
    for (const memory of this.memories.values()) {
      if (
        memory.key.toLowerCase().includes(queryLower) ||
        memory.value.toLowerCase().includes(queryLower)
      ) {
        results.push(memory);
      }
    }
    
    return results;
  }
  
  getAllMemories(): MemoryItem[] {
    return Array.from(this.memories.values());
  }
  
  updateMemory(key: string, value: string): boolean {
    if (this.memories.has(key)) {
      const memory = this.memories.get(key)!;
      memory.value = value;
      memory.timestamp = new Date();
      return true;
    }
    return false;
  }
  
  deleteMemory(key: string): boolean {
    return this.memories.delete(key);
  }
}

export const memoryStore = new MemoryStore();