export class MessageProtocol {
  constructor(storage) {
    this.storage = storage;
  }

  async handle(message, handlers = {}) {
    if (!message?.id || !message?.type) return { ok: false, error: 'INVALID_MESSAGE' };
    if (await this.storage.isDuplicateMessage(message.id)) {
      return { ok: true, duplicate: true };
    }
    const handler = handlers[message.type];
    if (!handler) return { ok: false, error: 'UNKNOWN_MESSAGE_TYPE' };
    return handler(message);
  }
}
