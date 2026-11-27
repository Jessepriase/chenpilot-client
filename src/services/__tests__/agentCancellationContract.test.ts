// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockInstance } = vi.hoisted(() => ({
  mockInstance: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockInstance) },
  create: vi.fn(() => mockInstance),
}));

vi.mock('@/config/agent', () => ({
  default: { baseURL: 'http://agent.test', timeout: 30000, enableLogging: false, enableStreaming: true },
  agentConfig: { baseURL: 'http://agent.test', timeout: 30000, enableLogging: false, enableStreaming: true },
}));

async function freshService() {
  vi.resetModules();
  return (await import('../agentService')).default;
}

const envelope = { result: { success: true, data: 'ok' } };

describe('agent cancellation consistency (#543)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockInstance.post.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does no client work when the caller is already cancelled', async () => {
    const service = await freshService();
    const controller = new AbortController();
    controller.abort();

    await expect(
      service.queryAgent({ userId: 'u1', query: 'hello' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockInstance.post).not.toHaveBeenCalled();
  });

  it('does not turn a response that arrived after cancellation into a success', async () => {
    const service = await freshService();
    const controller = new AbortController();
    mockInstance.post.mockImplementation(async () => {
      controller.abort();
      return { status: 200, data: envelope, headers: {}, config: {} };
    });

    await expect(
      service.queryAgent({ userId: 'u1', query: 'hello' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('propagates an Axios cancellation as AbortError rather than a server failure', async () => {
    const service = await freshService();
    const cancelled = Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' });
    mockInstance.post.mockRejectedValueOnce(cancelled);

    await expect(
      service.queryAgent({ userId: 'u1', query: 'hello' }),
    ).rejects.toBe(cancelled);
  });

  it('does not fall back to /query when streaming is unsupported and the caller cancelled', async () => {
    const service = await freshService();
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockResolvedValueOnce({
      status: 404,
      ok: false,
      headers: { get: () => 'text/plain' },
      body: null,
    });

    await expect(
      service.queryAgentStreaming(
        { userId: 'u1', query: 'hello' },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockInstance.post).not.toHaveBeenCalled();
  });
});
