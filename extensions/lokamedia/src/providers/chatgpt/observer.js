export class ChatGptGenerationObserver {
  constructor({ root = document, onChange = () => {}, pollMs = 1000, timeoutMs = 30000 } = {}) {
    this.root = root;
    this.onChange = onChange;
    this.pollMs = pollMs;
    this.timeoutMs = timeoutMs;
    this.observer = null;
    this.pollHandle = null;
    this.timeoutHandle = null;
  }

  start() {
    this.cancel();
    if (typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver(() => this.onChange({ reason: 'mutation' }));
      this.observer.observe(this.root, { childList: true, subtree: true, attributes: true });
    }
    this.pollHandle = setInterval(() => this.onChange({ reason: 'bounded_poll' }), this.pollMs);
    this.timeoutHandle = setTimeout(() => this.cancel(), this.timeoutMs);
  }

  cancel() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.pollHandle = null;
    this.timeoutHandle = null;
  }
}
