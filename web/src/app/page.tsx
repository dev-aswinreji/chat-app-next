'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

type User = { id: string; username: string; full_name: string; is_online?: boolean };

type Message = {
  id: number;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'read';
};

export default function Home() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [view, setView] = useState<'list' | 'chat'>('list');
  const [search, setSearch] = useState('');
  const [lastSeenByUser, setLastSeenByUser] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSeenRef = useRef<Record<string, string>>({});
  const viewRef = useRef<'list' | 'chat'>('list');
  const activeUserIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );

  const lastMyMessageId = useMemo(() => {
    if (!user || !activeUserId) return null;
    const convo = messages.filter(
      (m) =>
        (m.fromUserId === activeUserId && m.toUserId === user.id) ||
        (m.fromUserId === user.id && m.toUserId === activeUserId)
    );
    const myMessages = convo.filter((m) => m.fromUserId === user.id);
    if (myMessages.length === 0) return null;
    const last = myMessages.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
    return last.id;
  }, [messages, user, activeUserId]);

  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');
    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const auth = async () => {
    try {
      const url = mode === 'login' ? '/auth/login' : '/auth/signup';
      const payload: any = { username, password };
      if (mode === 'signup') payload.fullName = fullName;
      const { data } = await axios.post(`${API_URL}${url}`, payload);
      setUser(data.user);
      setToken(data.accessToken);
      localStorage.setItem('chat_token', data.accessToken);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      setToast({ message: 'Logged in', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Invalid username or password';
      setToast({ message, type: 'error' });
      setTimeout(() => setToast(null), 2500);
    }
  };

  useEffect(() => {
    if (!token) return;
    const s = io(WS_URL, { auth: { token } });
    setSocket(s);

    s.on('connect', () => {
      axios.get(`${API_URL}/users`).then((res) => setUsers(res.data));
    });

    s.on('presence:update', (payload: { userId: string; isOnline: boolean }) => {
      setUsers((prev) => {
        const exists = prev.find((u) => u.id === payload.userId);
        if (!exists) {
          axios.get(`${API_URL}/users`).then((res) => setUsers(res.data));
          return prev;
        }
        return prev.map((u) =>
          u.id === payload.userId ? { ...u, is_online: payload.isOnline } : u
        );
      });
    });

    s.on('presence:sync', (list: { userId: string; isOnline: boolean }[]) => {
      setUsers((prev) =>
        prev.map((u) => {
          const entry = list.find((l) => l.userId === u.id);
          return entry ? { ...u, is_online: entry.isOnline } : u;
        })
      );
    });

    s.on('message:new', (msg: Message) => {
      setMessages((prev) => {
        const seenAt = lastSeenRef.current[msg.toUserId];
        const shouldMarkRead =
          msg.fromUserId === user?.id &&
          seenAt &&
          new Date(seenAt) >= new Date(msg.createdAt);
        return [...prev, shouldMarkRead ? { ...msg, status: 'read' } : msg];
      });
      const currentUserId = userIdRef.current;
      if (
        msg.toUserId === currentUserId &&
        viewRef.current === 'chat' &&
        activeUserIdRef.current === msg.fromUserId &&
        document.visibilityState === 'visible'
      ) {
        s.emit('message:read', { messageId: msg.id, fromUserId: msg.fromUserId });
      }
    });

    s.on('message:read', (payload: { readUpTo: string; readerId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.fromUserId === user?.id &&
          m.toUserId === payload.readerId &&
          new Date(m.createdAt) <= new Date(payload.readUpTo)
            ? { ...m, status: 'read' }
            : m
        )
      );
      setLastSeenByUser((prev) => ({
        ...prev,
        [payload.readerId]: payload.readUpTo,
      }));
    });

    s.on('message:delivered', (payload: { messageId: number }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, status: 'delivered' } : m))
      );
    });

    return () => {
      s.disconnect();
    };
  }, [token, user?.id]);

  useEffect(() => {
    lastSeenRef.current = lastSeenByUser;
  }, [lastSeenByUser]);

  useEffect(() => {
    viewRef.current = view;
    activeUserIdRef.current = activeUserId;
    userIdRef.current = user?.id || null;
  }, [view, activeUserId, user?.id]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/users`).then((res) => setUsers(res.data));
  }, [token]);

  useEffect(() => {
    if (view !== 'chat') return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view, activeUserId]);

  useEffect(() => {
    if (!token || !activeUserId || !user) return;
    axios
      .get(`${API_URL}/messages`, {
        params: { userId: user.id, withUserId: activeUserId },
      })
      .then((res) => {
        const normalized = res.data.map((m: any) => ({
          id: m.id,
          fromUserId: m.from_user_id,
          toUserId: m.to_user_id,
          text: m.text,
          createdAt: m.created_at,
          status: m.status,
        }));
        setMessages(normalized);

        // fetch last-seen for this chat
        axios
          .get(`${API_URL}/messages/last-seen`, {
            params: { withUserId: activeUserId },
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => {
            if (res.data?.lastReadAt) {
              setLastSeenByUser((prev) => ({
                ...prev,
                [activeUserId]: res.data.lastReadAt,
              }));
            }
          })
          .catch(() => undefined);

        // mark unread messages as read when opening the chat
        if (socket && view === 'chat' && document.visibilityState === 'visible') {
          const unread = normalized
            .filter((m: any) => m.toUserId === user.id && m.fromUserId === activeUserId)
            .filter((m: any) => m.status !== 'read');

          const lastUnread = unread[unread.length - 1];
          if (lastUnread) {
            socket.emit('message:read', {
              messageId: lastUnread.id,
              fromUserId: lastUnread.fromUserId,
            });
          }
        }
      });
  }, [token, activeUserId, user, socket, view]);

  const sendMessage = () => {
    if (!text.trim() || !activeUserId || !socket) return;
    socket.emit('message:send', { toUserId: activeUserId, text });
    setText('');
  };

  const lastSeen = activeUserId ? lastSeenByUser[activeUserId] : undefined;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-white grid place-items-center px-6 relative">
        {toast && (
          <div
            className={`absolute top-6 right-6 text-slate-100 px-4 py-3 rounded-2xl text-sm shadow-2xl w-64 overflow-hidden border ${
              toast.type === 'success'
                ? 'bg-emerald-900/40 border-emerald-500/30'
                : 'bg-red-900/40 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">
                {toast.type === 'success' ? '✅' : '⚠️'}
              </span>
              <span className="text-sm text-slate-100/90">{toast.message}</span>
            </div>
            <div className="mt-2 h-0.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'
                } toast-progress`}
              />
            </div>
          </div>
        )}
        <div className="w-full max-w-sm space-y-4">
          <div className="bg-[#12181e] border border-[#202b33] rounded-2xl p-6 space-y-4 shadow-2xl">
            <h1 className="text-xl font-semibold">{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
            <input
              className="w-full rounded-xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {mode === 'signup' && (
              <input
                className="w-full rounded-xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            )}
            <input
              className="w-full rounded-xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full rounded-xl bg-[#1877f2] py-3 font-semibold" onClick={auth}>
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </div>
          <button
            className="w-full text-sm text-slate-300"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1116] text-white relative">
      <style>{`
        .toast-progress {
          animation: toast-progress 2.5s linear forwards;
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toast && (
        <div
          className={`absolute top-6 right-6 text-slate-100 px-4 py-3 rounded-2xl text-sm shadow-2xl w-64 overflow-hidden border ${
            toast.type === 'success'
              ? 'bg-emerald-900/40 border-emerald-500/30'
              : 'bg-red-900/40 border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">
              {toast.type === 'success' ? '✅' : '⚠️'}
            </span>
            <span className="text-sm text-slate-100/90">{toast.message}</span>
          </div>
          <div className="mt-2 h-0.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                toast.type === 'success' ? 'bg-emerald-400' : 'bg-red-400'
              } toast-progress`}
            />
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={`bg-[#12181e] border border-[#202b33] rounded-2xl p-4 space-y-4 w-full min-h-[96vh] ${view === 'chat' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <input
              className="w-full rounded-xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span>@{user?.username}</span>
              <button
                className="h-10 rounded-xl border border-[#2a3842] text-slate-200 hover:bg-[#1a222b] flex items-center gap-2 px-3 text-sm"
                onClick={() => {
                  setToken(null);
                  setUser(null);
                  setSocket(null);
                  setActiveUserId(null);
                  setMessages([]);
                  localStorage.removeItem('chat_token');
                  localStorage.removeItem('chat_user');
                  setView('list');
                  setToast({ message: 'Successfully logged out', type: 'success' });
                  setTimeout(() => setToast(null), 2500);
                }}
                title="Sign out"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
          <h2 className="text-lg font-semibold">Chats</h2>
          <div className="space-y-2">
            {users
              .filter((u) => u.id !== user?.id)
              .filter((u) =>
                `${u.username} ${u.full_name}`.toLowerCase().includes(search.toLowerCase())
              )
              .map((u) => (
                <button
                  key={u.id}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 ${
                    activeUserId === u.id ? 'bg-[#1d2630]' : 'hover:bg-[#1a222b]'
                  }`}
                  onClick={() => {
                    setActiveUserId(u.id);
                    setView('chat');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-sm font-semibold">
                      {u.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">@{u.username}</p>
                      <p className="text-xs text-slate-400">{u.full_name}</p>
                    </div>
                  </div>
                  <span className={`text-xs ${u.is_online ? 'text-green-400' : 'text-gray-500'}`}>
                    {u.is_online ? 'online' : 'offline'}
                  </span>
                </button>
              ))}
          </div>
        </aside>

        <section className={`bg-[#12181e] border border-[#202b33] rounded-2xl p-4 md:p-6 flex flex-col h-[96vh] overflow-hidden w-full ${view === 'list' ? 'hidden lg:flex' : ''}`}>
          <div className="flex items-center justify-between border-b border-[#202b33] pb-4 mb-4 flex-none">
            <div className="flex items-center gap-3">
              <button
                className="text-sm text-slate-400"
                onClick={() => setView('list')}
              >
                ← Back
              </button>
              <div>
                <p className="text-sm text-slate-400">Chatting with</p>
                <h3 className="text-xl font-semibold">@{activeUser?.username}</h3>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages
              .filter((m) =>
                activeUser
                  ? (m.fromUserId === activeUser.id && m.toUserId === user?.id) ||
                    (m.fromUserId === user?.id && m.toUserId === activeUser.id)
                  : false
              )
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map((m) => {
                const isMe = m.fromUserId === user?.id;
                const status = m.status || 'sent';
                return (
                  <div
                    key={m.id}
                    className={`max-w-sm px-4 py-2 rounded-2xl relative ${
                      isMe ? 'ml-auto bg-[#0f5f3a]' : 'bg-[#2b3138]'
                    }`}
                  >
                    <div className="text-sm pr-12">{m.text}</div>
                    <span className="text-[10px] absolute bottom-1 right-2 whitespace-nowrap flex items-center gap-1 text-slate-300/70">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {isMe && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={status === 'read' ? 'text-sky-300' : 'text-slate-300/70'}
                        >
                          {status === 'sent' ? (
                            <polyline points="20 6 9 17 4 12" />
                          ) : (
                            <>
                              <polyline points="20 6 9 17 4 12" />
                              <polyline points="23 6 12 17 7 12" />
                            </>
                          )}
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
            {messages.filter((m) =>
              activeUser
                ? (m.fromUserId === activeUser.id && m.toUserId === user?.id) ||
                  (m.fromUserId === user?.id && m.toUserId === activeUser.id)
                : false
            ).length === 0 && (
              <div className="h-full min-h-[40vh] grid place-items-center text-slate-500">
                No messages yet
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2 border-t border-[#202b33] pt-4 flex-none">
            <input
              className="flex-1 rounded-2xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
              placeholder={`Message @${activeUser?.username}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="rounded-2xl bg-[#1877f2] px-6" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
