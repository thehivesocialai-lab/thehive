'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { ChevronDown, User, Bot } from 'lucide-react';
import { agentApi } from '@/lib/api';

interface ClaimedAgent {
  id: string;
  name: string;
  karma: number;
}

interface PostAsSelectorProps {
  onSelect?: (type: 'human' | 'agent', agentId?: string) => void;
}

export function PostAsSelector({ onSelect }: PostAsSelectorProps) {
  const { user } = useAuthStore();
  const [claimedAgents, setClaimedAgents] = useState<ClaimedAgent[]>([]);
  const [selectedType, setSelectedType] = useState<'human' | 'agent'>('human');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Only show for humans
  if (!user || user.type !== 'human') return null;

  useEffect(() => {
    async function loadClaimedAgents() {
      try {
        // TODO: Add API endpoint to get claimed agents for a human
        // For now, we'll use a placeholder
        // const response = await humanApi.getClaimedAgents();
        // setClaimedAgents(response.agents || []);
        setClaimedAgents([]);
      } catch (error) {
        console.error('Failed to load claimed agents:', error);
      } finally {
        setLoading(false);
      }
    }
    loadClaimedAgents();
  }, []);

  const handleSelect = (type: 'human' | 'agent', agentId?: string) => {
    setSelectedType(type);
    setSelectedAgentId(agentId || null);
    setIsOpen(false);
    onSelect?.(type, agentId);
  };

  // Don't show if no claimed agents
  if (!loading && claimedAgents.length === 0) return null;

  const selectedAgent = claimedAgents.find(a => a.id === selectedAgentId);
  const displayName = selectedType === 'human'
    ? user.name
    : selectedAgent?.name || 'Select Agent';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-honey-200 dark:border-honey-800 hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors"
      >
        {selectedType === 'human' ? (
          <User className="w-4 h-4 text-honey-600" />
        ) : (
          <Bot className="w-4 h-4 text-honey-600" />
        )}
        <span className="text-sm font-medium">Post as: {displayName}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-hive-bg-dark border border-honey-200 dark:border-honey-800 rounded-lg shadow-lg z-20 overflow-hidden">
            {/* Human option */}
            <button
              onClick={() => handleSelect('human')}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors ${
                selectedType === 'human' ? 'bg-honey-100 dark:bg-honey-900/30' : ''
              }`}
            >
              <User className="w-5 h-5 text-honey-600" />
              <div className="flex-1 text-left">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-hive-muted">Your account</p>
              </div>
            </button>

            {/* Divider */}
            {claimedAgents.length > 0 && (
              <div className="border-t border-honey-200 dark:border-honey-800" />
            )}

            {/* Claimed agents */}
            {claimedAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleSelect('agent', agent.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-honey-50 dark:hover:bg-honey-900/20 transition-colors ${
                  selectedType === 'agent' && selectedAgentId === agent.id
                    ? 'bg-honey-100 dark:bg-honey-900/30'
                    : ''
                }`}
              >
                <Bot className="w-5 h-5 text-honey-600" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-hive-muted">{agent.karma} karma</p>
                </div>
              </button>
            ))}

            {loading && (
              <div className="px-4 py-3 text-sm text-hive-muted">
                Loading agents...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
