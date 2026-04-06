import { useState, useRef, useEffect } from "react";

const BACKEND = "http://localhost:8000";

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function MarkdownMsg({ text }) {
  const lines = text.split("\n");
  const rendered = lines.map((line, i) => {
    const fmt = (str) => {
      const parts = [];
      let last = 0;
      const rx = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
      let m;
      while ((m = rx.exec(str)) !== null) {
        if (m.index > last) parts.push(str.slice(last, m.index));
        if (m[1]) parts.push(<strong key={m.index}>{m[2]}</strong>);
        else if (m[3]) parts.push(<em key={m.index}>{m[4]}</em>);
        else if (m[5]) parts.push(<code key={m.index} style={{ background: "rgba(232,160,48,0.15)", color: "#e8a030", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace", fontSize: "0.88em" }}>{m[6]}</code>);
        last = m.index + m[0].length;
      }
      if (last < str.length) parts.push(str.slice(last));
      return parts;
    };
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const content = line.replace(/^#+\s/, "");
      return <div key={i} style={{ fontWeight: 600, fontSize: level === 1 ? "1.1em" : "0.97em", color: "#f0e8d8", marginTop: "0.8em", marginBottom: "0.2em" }}>{fmt(content)}</div>;
    }
    if (/^[-*] /.test(line)) return <div key={i} style={{ display: "flex", gap: 8, marginTop: 3 }}><span style={{ color: "#e8a030", flexShrink: 0 }}>›</span><span>{fmt(line.slice(2))}</span></div>;
    if (line.trim() === "") return <div key={i} style={{ height: "0.5em" }} />;
    return <div key={i} style={{ marginTop: 2 }}>{fmt(line)}</div>;
  });
  return <div style={{ lineHeight: 1.78, fontSize: "0.93rem" }}>{rendered}</div>;
}

function SourceChips({ chunks }) {
  if (!chunks?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {chunks.map((c, i) => (
        <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 100, background: "rgba(232,160,48,0.1)", border: "1px solid rgba(232,160,48,0.2)", color: "#e8a030", fontFamily: "monospace" }}>
          {c.title} · {formatTime(c.start)}–{formatTime(c.end)}
        </span>
      ))}
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8a030", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

function ServerBadge({ status }) {
  const map = {
    checking: { color: "#7a6e60", label: "Checking…" },
    ok:       { color: "#5aaa6a", label: "Backend connected" },
    error:    { color: "#cc5555", label: "Backend offline" },
  };
  const s = map[status] || map.checking;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, boxShadow: status === "ok" ? `0 0 6px ${s.color}` : "none" }} />
      <span style={{ fontSize: 11.5, color: s.color }}>{s.label}</span>
    </div>
  );
}

const STEPS = [
  "Uploading video to backend",
  "Extracting audio (ffmpeg)",
  "Transcribing with Whisper",
  "Embedding with nomic-embed-text",
  "Storing in ChromaDB",
  "Ready",
];

export default function App() {
  const [stage, setStage] = useState("upload");
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [serverStatus, setServerStatus] = useState("checking");
  const [chunkCount, setChunkCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isDrag, setIsDrag] = useState(false);
  const [processedChunks, setProcessedChunks] = useState(0);

  const fileInputRef = useRef();
  const chatEndRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=DM+Sans:wght@300;400;500&display=swap');
      @keyframes pulse   { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
      @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes spin    { to{transform:rotate(360deg)} }
      @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
      * { box-sizing:border-box; margin:0; padding:0; }
      ::-webkit-scrollbar { width:4px; }
      ::-webkit-scrollbar-thumb { background:#2a2520; border-radius:2px; }
      textarea, input { outline:none; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(4000) });
        if (r.ok) {
          const d = await r.json();
          setServerStatus("ok");
          setChunkCount(d.chroma_chunks ?? 0);
        } else { setServerStatus("error"); }
      } catch { setServerStatus("error"); }
    };
    check();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const pickFile = (file) => {
    if (!file?.type.startsWith("video/")) return;
    setVideoFile(file);
    setVideoTitle(file.name.replace(/\.[^.]+$/, ""));
    setVideoUrl(URL.createObjectURL(file));
  };

  const processVideo = async () => {
    if (!videoFile) return;
    if (serverStatus === "error") { alert("Backend offline. Run `python server.py` first."); return; }
    setStage("processing");
    setProgress(5); setActiveStep(0);
    setStatusText("Uploading video to backend…");
    try {
      const form = new FormData();
      form.append("file", videoFile);
      setActiveStep(0); setProgress(12);
      setActiveStep(1); setStatusText("Extracting audio with ffmpeg…"); setProgress(22);
      setActiveStep(2); setStatusText("Transcribing with Whisper — this may take a few minutes…"); setProgress(38);

      const res = await fetch(`${BACKEND}/process-video`, { method: "POST", body: form });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Server error ${res.status}`);
      }
      setActiveStep(3); setStatusText("Embedding with nomic-embed-text…"); setProgress(72);
      const data = await res.json();
      setActiveStep(4); setStatusText("Storing in ChromaDB…"); setProgress(90);
      setProcessedChunks(data.chunks_processed);
      setActiveStep(5); setProgress(100); setStatusText("Done!");

      setMessages([{
        role: "assistant",
        content: `**"${data.title}" is ready!**\n\n${data.chunks_processed} transcript segments embedded into ChromaDB (${formatTime(data.duration_seconds)} of audio).\n\nYour local RAG pipeline is active — ask anything about the video.`,
        chunks: [],
      }]);
      setTimeout(() => setStage("chat"), 500);
    } catch (err) { setStatusText(`Error: ${err.message}`); }
  };

  const send = async () => {
    if (!input.trim() || thinking) return;
    const q = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: q }]);
    setThinking(true);
    try {
      const res = await fetch(`${BACKEND}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: 3 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `Server error ${res.status}`); }
      const data = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: data.answer, chunks: data.chunks }]);
    } catch (err) {
      setMessages((p) => [...p, { role: "assistant", content: `Error reaching backend: ${err.message}`, chunks: [] }]);
    } finally { setThinking(false); }
  };

  const col = {
    bg: "#09090f", surface: "#0f0f1a", border: "rgba(255,255,255,0.06)",
    accent: "#e8a030", accentDim: "rgba(232,160,48,0.11)",
    textPrimary: "#f0e8d8", textSecondary: "#7a6e60", textMuted: "#3a3530",
    fontDisplay: "'Fraunces', Georgia, serif", fontBody: "'DM Sans', system-ui, sans-serif",
  };

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="8" fill={col.accentDim} />
        <polygon points="11,8 22,14 11,20" fill={col.accent} />
      </svg>
      <span style={{ fontFamily: col.fontDisplay, fontSize: 19, fontWeight: 400, letterSpacing: "-0.02em", color: col.textPrimary }}>LectureLens</span>
    </div>
  );

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  if (stage === "upload") return (
    <div style={{ minHeight: "100vh", background: col.bg, fontFamily: col.fontBody, color: col.textPrimary, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.2rem 2rem", borderBottom: `1px solid ${col.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <ServerBadge status={serverStatus} />
          {chunkCount > 0 && <span style={{ fontSize: 12, color: col.textSecondary }}>{chunkCount} chunks in DB</span>}
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", gap: 36 }}>
        <div style={{ textAlign: "center", maxWidth: 540, animation: "fadeUp .5s ease both" }}>
          <h1 style={{ fontFamily: col.fontDisplay, fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 300, lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 14 }}>
            Your video,<br /><span style={{ color: col.accent }}>deeply understood.</span>
          </h1>
          <p style={{ color: col.textSecondary, fontSize: "1rem", lineHeight: 1.75, fontWeight: 300 }}>
            Upload a lecture or tutorial — LectureLens transcribes it with Whisper, embeds every segment into ChromaDB, and answers questions using your local RAG pipeline.
          </p>
        </div>

        {serverStatus === "error" && (
          <div style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(200,80,80,0.3)", background: "rgba(200,80,80,0.08)", color: "#cc7777", fontSize: 13, maxWidth: 480, textAlign: "center", lineHeight: 1.65 }}>
            <strong>Backend offline.</strong> Start it first:<br />
            <code style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.3)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>python server.py</code>
            &nbsp;· then refresh this page.
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={(e) => { e.preventDefault(); setIsDrag(false); pickFile(e.dataTransfer.files[0]); }}
          onClick={() => !videoUrl && fileInputRef.current.click()}
          style={{
            width: "100%", maxWidth: 600, animation: "fadeUp .6s ease .1s both", opacity: 0, animationFillMode: "forwards",
            border: `2px dashed ${isDrag ? col.accent : videoUrl ? "rgba(232,160,48,0.4)" : col.textMuted}`,
            borderRadius: 16, padding: videoUrl ? "1.5rem" : "3.5rem 2rem",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            cursor: videoUrl ? "default" : "pointer",
            background: isDrag ? col.accentDim : "transparent",
            transition: "border-color .2s, background .2s",
          }}
        >
          {videoUrl ? (
            <>
              <video src={videoUrl} controls style={{ width: "100%", borderRadius: 10, maxHeight: 300, objectFit: "contain", background: "#000" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: col.textSecondary, fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke={col.accent} strokeWidth="1.5"/><polygon points="6,4.5 10,7 6,9.5" fill={col.accent}/></svg>
                <span style={{ color: col.textPrimary }}>{videoTitle}</span>
                <button onClick={(e) => { e.stopPropagation(); setVideoUrl(null); setVideoFile(null); setVideoTitle(""); }} style={{ marginLeft: 8, background: "none", border: "none", color: col.textSecondary, cursor: "pointer", fontSize: 11, padding: "2px 6px" }}>✕ change</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: col.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 5v12M8 11l6-6 6 6" stroke={col.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 22h18" stroke={col.accent} strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ color: col.textPrimary, fontWeight: 400, marginBottom: 6 }}>Drop your video here</p>
                <p style={{ color: col.textSecondary, fontSize: 13 }}>MP4, MOV, WebM · lectures, tutorials, screencasts</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }} style={{ padding: "8px 20px", background: col.accentDim, border: `1px solid rgba(232,160,48,0.3)`, borderRadius: 8, color: col.accent, cursor: "pointer", fontSize: 13, fontFamily: col.fontBody, fontWeight: 500 }}>
                Browse files
              </button>
            </>
          )}
        </div>

        {videoUrl && (
          <button
            onClick={processVideo}
            disabled={serverStatus === "error"}
            style={{
              padding: "13px 40px", background: serverStatus === "error" ? col.textMuted : col.accent, border: "none", borderRadius: 10,
              color: "#1a0e00", fontFamily: col.fontBody, fontSize: "1rem", fontWeight: 600,
              cursor: serverStatus === "error" ? "not-allowed" : "pointer",
              animation: "fadeUp .6s ease .15s both", opacity: 0, animationFillMode: "forwards",
              boxShadow: serverStatus !== "error" ? "0 0 40px rgba(232,160,48,0.25)" : "none",
            }}
          >
            Process with Whisper + RAG →
          </button>
        )}

        {!videoUrl && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", animation: "fadeUp .7s ease .25s both", opacity: 0, animationFillMode: "forwards" }}>
            {["Whisper STT", "nomic-embed-text", "ChromaDB", "tinyllama"].map((f) => (
              <span key={f} style={{ padding: "5px 14px", borderRadius: 100, border: `1px solid ${col.border}`, fontSize: 12, color: col.textSecondary, fontWeight: 300 }}>{f}</span>
            ))}
          </div>
        )}
      </main>

      <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={(e) => pickFile(e.target.files[0])} />
    </div>
  );

  // ── PROCESSING ────────────────────────────────────────────────────────────
  if (stage === "processing") return (
    <div style={{ minHeight: "100vh", background: col.bg, fontFamily: col.fontBody, color: col.textPrimary, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.2rem 2rem", borderBottom: `1px solid ${col.border}` }}><Logo /></header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem", gap: 44 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontFamily: col.fontDisplay, fontSize: "1.75rem", fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 10 }}>Processing "{videoTitle}"</h2>
          <p style={{ color: col.textSecondary, fontSize: 14 }}>{statusText}</p>
        </div>

        <div style={{ width: "100%", maxWidth: 520 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: col.textSecondary }}>Progress</span>
            <span style={{ fontSize: 12, color: col.accent, fontWeight: 500 }}>{progress}%</span>
          </div>
          <div style={{ height: 6, background: col.surface, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${col.accent},#f0c060)`, borderRadius: 3, transition: "width .5s ease", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)", animation: "shimmer 1.6s infinite" }} />
            </div>
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((step, i) => {
            const done = activeStep > i, active = activeStep === i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderRadius: 10, background: active ? col.accentDim : "transparent", border: `1px solid ${active ? "rgba(232,160,48,0.25)" : col.border}`, transition: "all .3s" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? col.accent : "transparent", border: done ? "none" : `1.5px solid ${active ? col.accent : col.textMuted}` }}>
                  {done ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#1a0e00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : active ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${col.accent}`, borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
                    : <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.textMuted }} />}
                </div>
                <span style={{ fontSize: 14, color: done ? col.textSecondary : active ? col.textPrimary : col.textMuted, fontWeight: active ? 500 : 400, transition: "color .3s" }}>{step}</span>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: col.textMuted, textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>
          Whisper transcription may take a few minutes for long videos. Everything runs locally — no data leaves your machine.
        </p>
      </main>
    </div>
  );

  // ── CHAT ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: col.bg, fontFamily: col.fontBody, color: col.textPrimary, display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "0.9rem 1.5rem", borderBottom: `1px solid ${col.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ServerBadge status={serverStatus} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 12px", borderRadius: 100, background: col.accentDim, border: `1px solid rgba(232,160,48,0.2)` }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke={col.accent} strokeWidth="1.2"/><path d="M4 6h4M6 4v4" stroke={col.accent} strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11.5, color: col.accent, fontWeight: 500 }}>{processedChunks} chunks</span>
          </div>
          <span style={{ fontSize: 13, color: col.textSecondary, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoTitle}</span>
          <button
            onClick={() => { setStage("upload"); setVideoUrl(null); setVideoFile(null); setVideoTitle(""); setMessages([]); setInput(""); setProcessedChunks(0); }}
            style={{ padding: "5px 12px", background: "none", border: `1px solid ${col.border}`, borderRadius: 6, color: col.textSecondary, cursor: "pointer", fontSize: 12, fontFamily: col.fontBody, transition: "color .15s, border-color .15s" }}
            onMouseEnter={(e) => { e.target.style.color = col.textPrimary; e.target.style.borderColor = col.textSecondary; }}
            onMouseLeave={(e) => { e.target.style.color = col.textSecondary; e.target.style.borderColor = col.border; }}
          >← New video</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, animation: "fadeUp .5s ease both" }}>
            {["What are the main topics covered?", "Summarize the key concepts", "What should I study first?", "Are there any important definitions?"].map((q) => (
              <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                style={{ padding: "6px 14px", background: col.surface, border: `1px solid ${col.border}`, borderRadius: 100, fontSize: 12.5, color: col.textSecondary, cursor: "pointer", fontFamily: col.fontBody, transition: "all .15s" }}
                onMouseEnter={(e) => { e.target.style.borderColor = "rgba(232,160,48,0.4)"; e.target.style.color = col.textPrimary; e.target.style.background = col.accentDim; }}
                onMouseLeave={(e) => { e.target.style.borderColor = col.border; e.target.style.color = col.textSecondary; e.target.style.background = col.surface; }}
              >{q}</button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ animation: "fadeUp .3s ease both", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 6 }}>
            {m.role === "assistant" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: col.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 28 28" fill="none"><polygon points="9,7 21,14 9,21" fill={col.accent}/></svg>
                </div>
                <span style={{ fontSize: 11.5, color: col.textSecondary }}>tinyllama · RAG</span>
              </div>
            )}
            <div style={{ maxWidth: "82%", padding: m.role === "user" ? "10px 16px" : "14px 18px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px", background: m.role === "user" ? col.accentDim : col.surface, border: `1px solid ${m.role === "user" ? "rgba(232,160,48,0.2)" : col.border}`, lineHeight: 1.7 }}>
              {m.role === "user"
                ? <span style={{ fontSize: "0.93rem" }}>{m.content}</span>
                : <><MarkdownMsg text={m.content} /><SourceChips chunks={m.chunks} /></>}
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", animation: "fadeUp .3s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: col.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 28 28" fill="none"><polygon points="9,7 21,14 9,21" fill={col.accent}/></svg>
              </div>
              <span style={{ fontSize: 11.5, color: col.textSecondary }}>tinyllama · retrieving…</span>
            </div>
            <div style={{ padding: "12px 18px", borderRadius: "4px 14px 14px 14px", background: col.surface, border: `1px solid ${col.border}` }}>
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: "1rem 1.5rem", borderTop: `1px solid ${col.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: col.surface, border: `1px solid ${col.border}`, borderRadius: 12, padding: "10px 12px", transition: "border-color .2s" }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = "rgba(232,160,48,0.35)"; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = col.border; }}
        >
          <textarea
            ref={inputRef} value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about the video content, timestamps, concepts…"
            rows={1}
            style={{ flex: 1, background: "none", border: "none", color: col.textPrimary, fontSize: "0.93rem", fontFamily: col.fontBody, resize: "none", lineHeight: 1.6, maxHeight: 120 }}
          />
          <button onClick={send} disabled={!input.trim() || thinking}
            style={{ width: 36, height: 36, borderRadius: 8, border: "none", flexShrink: 0, background: input.trim() && !thinking ? col.accent : col.textMuted, cursor: input.trim() && !thinking ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke={input.trim() && !thinking ? "#1a0e00" : "#09090f"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: col.textMuted, marginTop: 8 }}>
          Enter to send · Shift+Enter for new line · powered by tinyllama + ChromaDB
        </p>
      </div>
    </div>
  );
}
