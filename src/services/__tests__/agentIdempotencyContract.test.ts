import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockAxiosInstance, mockBareAxios } = vi.hoisted(() => {
  const storageValues = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storageValues.get(key) ?? null,
      setItem: (key: string, value: string) => void storageValues.set(key, value),
      removeItem: (key: string) => void storageValues.delete(key),
      clear: () => storageValues.clear(),
    },
  });

  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:2333',
      headers: { 'Content-Type': 'application/json' },
    },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  const mockBareAxios = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    create: vi.fn(() => mockAxiosInstance),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    isAxiosError: vi.fn(() => false),
  };

  return { mockAxiosInstance, mockBareAxios };
});

vi.mock('axios', () => ({ default: mockBareAxios, ...mockBareAxios }));

vi.mock('../agentService', () => ({
  default: {
    isAgentConnected: vi.fn(() => false),
    queryAgentStreaming: vi.fn(),
    getStatus: vi.fn(),
    getCapabilities: vi.fn(),
    healthCheck: vi.fn(),
    getTools: vi.fn(),
    executeTool: vi.fn(),
    getMemory: vi.fn(),
    clearMemory: vi.fn(),
  },
  classifyAgentError: vi.fn(() => 'unknown'),
  isStateChangingQuery: vi.fn(() => false),
  agentErrorMessage: vi.fn(() => 'Agent request failed'),
}));

import { ApiService } from '../api';
import type { AgentQueryRequest } from '@/types';

describe('POST /query idempotency contract (#550)', () => {
  let apiService: ApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockBareAxios.create.mockReturnValue(mockAxiosInstance);
    apiService = new ApiService();
    mockAxiosInstance.post.mockResolvedValue({
      data: { result: { success: true, data: 'done' } },
      status: 200,
      headers: {},
    });
  });

  it('sends the clientRequestId in the request body so the backend can deduplicate', async () => {
    const request: AgentQueryRequest = {
      query: 'what is my balance?',
      clientRequestId: 'replay_queued_1763980800000_ab12cd34',
    };

    await apiService.queryAgent(request);

    expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    const [path, body] = mockAxiosInstance.post.mock.calls[0];
    expect(path).toBe('/query');
    expect(body).toMatchObject({
      query: request.query,
      clientRequestId: 'replay_queued_1763980800000_ab12cd34',
    });
  });

  it('keeps the same request id across repeated deliveries of one queued row', async () => {
    const replay = {
      query: 'what is my balance?',
      clientRequestId: 'replay_queued_stable_row',
    };

    await apiService.queryAgent(replay);
    await apiService.queryAgent({ ...replay });

    const ids = mockAxiosInstance.post.mock.calls.map(
      (call) => (call[1] as AgentQueryRequest).clientRequestId,
    );
    expect(ids).toEqual([
      'replay_queued_stable_row',
      'replay_queued_stable_row',
    ]);
  });

  it('does not fabricate a different id when the caller supplies none', async () => {
    await apiService.queryAgent({ query: 'hello' });

    const body = mockAxiosInstance.post.mock.calls[0][1] as AgentQueryRequest;
    expect(body.clientRequestId).toBeUndefined();
  });
});
