export type Listener<T> = (payload: T) => void;

export class TypedEventEmitter<TEvents extends object> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    set.add(listener as Listener<unknown>);
    this.listeners.set(event, set);
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.listeners.get(event);
    if (!set) {
      return this;
    }

    set.delete(listener as Listener<unknown>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }

    return this;
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }

    for (const listener of set) {
      listener(payload);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
