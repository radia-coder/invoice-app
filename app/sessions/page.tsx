'use client';

import { useEffect, useState } from 'react';

interface Session {
  id: number;
  user_id: number;
  ip_address: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  last_active: string;
  user: {
    id: number;
    email: string;
    role: string;
    company: { name: string } | null;
  };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<number | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.status === 403) {
        setError('Access denied. Only super admins can view sessions.');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const revokeSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to revoke this session? The user will be logged out.')) {
      return;
    }
    setRevoking(sessionId);
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke session');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case 'mobile':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'tablet':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-gray-400">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Active Sessions</h1>
        <button
          onClick={fetchSessions}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Login Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No active sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white font-medium">{session.user.email}</div>
                        <div className="text-xs text-gray-500">
                          {session.user.role} {session.user.company && `- ${session.user.company.name}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-300">
                        {getDeviceIcon(session.device_type)}
                        <div>
                          <div className="text-sm">{session.os || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{session.browser || 'Unknown'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {session.city && session.country ? (
                        <span>{session.city}, {session.country}</span>
                      ) : (
                        <span className="text-gray-500">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-sm">
                      {session.ip_address || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatDate(session.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => revokeSession(session.id)}
                        disabled={revoking === session.id}
                        className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800 rounded text-red-400 text-sm transition-colors disabled:opacity-50"
                      >
                        {revoking === session.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Total active sessions: {sessions.length}
      </div>
    </div>
  );
}
