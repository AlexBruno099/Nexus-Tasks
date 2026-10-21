export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  let timedOut = false;
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 10000);

  try {
    const res = await fetch(`/api${path}`, {
      method,
      signal: controller.signal,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Não foi possível concluir a operação (HTTP ${res.status}).`;
      throw new ApiError(message, res.status);
    }
    if (data === undefined || data === null || typeof data !== 'object') {
      throw new ApiError('A API enviou uma resposta inválida. Tente atualizar os dados.', res.status);
    }
    return data as T;
  } catch (error) {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Requisição cancelada.', 'AbortError');
    if (timedOut) throw new ApiError('A API demorou para responder. Confira a conexão e tente novamente.');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Não foi possível conectar à API. Confira a conexão e tente novamente.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
