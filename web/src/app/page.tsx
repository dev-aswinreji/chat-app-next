'use client';

import { useEffect, useMemo, useState } from 'react';
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

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) || null,
    [users, activeUserId]
  );

  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');
    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const auth = async () => {
    const url = mode === 'login' ? '/auth/login' : '/auth/signup';
    const payload: any = { username, password };
    if (mode === 'signup') payload.fullName = fullName;
    const { data } = await axios.post(`${API_URL}${url}`, payload);
    if (data.error) return alert(data.error);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('chat_token', data.token);
    localStorage.setItem('chat_user', JSON.stringify(data.user));
  };

  useEffect(() => {
    if (!token) return;
    const s = io(WS_URL, { auth: { token } });
    setSocket(s);

    s.on('presence:update', (payload: { userId: string; isOnline: boolean }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === payload.userId ? { ...u, is_online: payload.isOnline } : u))
      );
    });

    s.on('message:new', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.toUserId === user?.id && view === 'chat' && activeUserId === msg.fromUserId) {
        s.emit('message:read', { messageId: msg.id, fromUserId: msg.fromUserId });
      }
    });

    s.on('message:read', (payload: { messageId: number }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, status: 'read' } : m))
      );
    });

    return () => {
      s.disconnect();
    };
  }, [token, user?.id, view, activeUserId]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_URL}/users`).then((res) => setUsers(res.data));
  }, [token]);

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
      });
  }, [token, activeUserId, user]);

  const sendMessage = () => {
    if (!text.trim() || !activeUserId || !socket) return;
    socket.emit('message:send', { toUserId: activeUserId, text });
    setText('');
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0c1116] text-white grid place-items-center px-6">
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
    <div className="min-h-screen bg-[#0c1116] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className={`bg-[#12181e] border border-[#202b33] rounded-2xl p-4 space-y-4 w-full min-h-[96vh] ${view === 'chat' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-xl bg-[#0d1318] border border-[#2a3842] px-4 py-3"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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

        <section className={`bg-[#12181e] border border-[#202b33] rounded-2xl p-4 md:p-6 flex flex-col min-h-[96vh] w-full ${view === 'list' ? 'hidden lg:flex' : ''}`}>
          <div className="flex items-center justify-between border-b border-[#202b33] pb-4 mb-6">
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
          <div className="flex-1 overflow-y-auto space-y-3">
            {messages
              .filter((m) =>
                activeUser
                  ? (m.fromUserId === activeUser.id && m.toUserId === user?.id) ||
                    (m.fromUserId === user?.id && m.toUserId === activeUser.id)
                  : false
              )
              .map((m) => {
                const isMe = m.fromUserId === user?.id;
                const tick = m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓';
                const tickClass = m.status === 'read' ? 'text-blue-300' : 'text-slate-300/70';
                return (
                  <div
                    key={m.id}
                    className={`max-w-sm px-4 py-2 rounded-2xl relative ${
                      isMe ? 'ml-auto bg-[#2aa872]' : 'bg-[#2b3138]'
                    }`}
                  >
                    <div className="text-sm pr-10">{m.text}</div>
                    <span className={`text-[10px] absolute bottom-1 right-2 whitespace-nowrap ${tickClass}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} {isMe && tick}
                    </span>
                  </div>
                );
              })}
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
          <div className="mt-6 flex gap-2 border-t border-[#202b33] pt-4">
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
