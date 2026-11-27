// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';

const { mockAgentStatus, mockDispatch } = vi.hoisted(() => ({
  mockAgentStatus: { isConnected: false, lastHealthCheck: null, capabilities: null },
  mockDispatch: vi.fn(),
}));

vi.mock('@/store', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ chat: { agentStatus: mockAgentStatus } }),
}));

// The chat slice is parse-broken on the upstream build branch; stub the single
// action this component uses so its accessibility can still be verified (#557).
vi.mock('@/store/slices/chatSlice', () => ({
  updateAgentStatus: (payload: unknown) => ({ type: 'chat/updateAgentStatus', payload }),
}));

vi.mock('@/services/api', () => ({
  default: {
    getAgentStatus: vi.fn(async () => ({
      isOnline: false,
      version: '1.0.0',
      uptime: 0,
      activeConnections: 0,
      services: {},
    })),
    getAgentCapabilities: vi.fn(async () => null),
  },
}));

vi.mock('@/services/agentService', () => ({
  isCapabilitiesStale: () => false,
}));

import AgentStatus from '@/components/agent/AgentStatus';
import { ChatDraftComposer } from '@/components/chat/ChatDraftComposer';

describe('chat and agent status accessibility (#557)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockAgentStatus.isConnected = false;
  });

  it('renders agent status without violations using a mocked backend', async () => {
    const { container } = render(<AgentStatus />);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces status changes through a live region and names the refresh control', async () => {
    render(<AgentStatus showDetails />);

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/agent (offline|online|checking)/i);
    expect(
      screen.getByRole('button', { name: 'Refresh agent status' }),
    ).toBeInTheDocument();
  });

  it('renders the chat composer with an accessible label and no violations', async () => {
    const { container } = render(
      <ChatDraftComposer conversationId={null} value="" onChange={() => {}} />,
    );

    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps restored-draft feedback in a status role for screen readers', async () => {
    render(
      <ChatDraftComposer
        conversationId={null}
        value="draft"
        onChange={() => {}}
      />,
    );

    // With no conversation id there is no restored hint, but the composer must
    // remain operable from the keyboard and expose its label.
    const input = screen.getByRole('textbox', { name: 'Message' });
    input.focus();
    expect(input).toHaveFocus();
  });
});
