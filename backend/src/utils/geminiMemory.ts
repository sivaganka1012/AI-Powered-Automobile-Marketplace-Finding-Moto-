export interface GeminiMemorySnapshot {
  userMessages: string[];
  botReplies: string[];
}

interface SessionMemory {
  userMessages: string[];
  botReplies: string[];
}

const MAX_USER_MESSAGES = 3;
const MAX_BOT_REPLIES = 2;

export class GeminiMemoryManager {
  private readonly store = new Map<string, SessionMemory>();

  getSnapshot(sessionKey: string): GeminiMemorySnapshot {
    const session = this.store.get(sessionKey);
    if (!session) {
      return {
        userMessages: [],
        botReplies: [],
      };
    }

    return {
      userMessages: [...session.userMessages],
      botReplies: [...session.botReplies],
    };
  }

  addUserMessage(sessionKey: string, message: string): void {
    const session = this.getOrCreateSession(sessionKey);
    session.userMessages.push(message);
    if (session.userMessages.length > MAX_USER_MESSAGES) {
      session.userMessages = session.userMessages.slice(-MAX_USER_MESSAGES);
    }
  }

  addBotReply(sessionKey: string, reply: string): void {
    const session = this.getOrCreateSession(sessionKey);
    session.botReplies.push(reply);
    if (session.botReplies.length > MAX_BOT_REPLIES) {
      session.botReplies = session.botReplies.slice(-MAX_BOT_REPLIES);
    }
  }

  private getOrCreateSession(sessionKey: string): SessionMemory {
    const existing = this.store.get(sessionKey);
    if (existing) {
      return existing;
    }

    const created: SessionMemory = {
      userMessages: [],
      botReplies: [],
    };
    this.store.set(sessionKey, created);
    return created;
  }
}