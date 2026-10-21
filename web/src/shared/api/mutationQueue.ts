/** Mantém a ordem das escritas, inclusive depois de uma requisição falhar. */
export function createMutationQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    get pending() {
      return pending;
    },
    run<T>(operation: () => Promise<T>): Promise<T> {
      pending++;
      const result = tail.then(operation);
      tail = result.catch(() => undefined);
      return result.finally(() => {
        pending--;
      });
    },
  };
}
