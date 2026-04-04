import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

interface MaterialTopic {
  id: string;
  subject: string;
  level: string;
  topic: string;
  keywords: string[];
  problems: Array<{
    type: string;
    text: string;
    answer: string;
    hint?: string;
    latex?: string;
  }>;
}

export function MaterialsPanel({ onAttach }: { onAttach: (context: string) => void }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<MaterialTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/materials/meta")
      .then((r) => r.json())
      .then((d) => { if (d.subjects) setSubjects(d.subjects); })
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, subject, limit: 6 }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, subject]);

  const handleAttach = (topic: MaterialTopic) => {
    const lines = [
      `【教材参照: ${topic.subject} - ${topic.topic} (${topic.level})】`,
      ...topic.problems.slice(0, 3).map((p, i) =>
        `問${i + 1}(${p.type}): ${p.text}${p.hint ? ` [ヒント: ${p.hint}]` : ""}${p.latex ? ` LaTeX: ${p.latex}` : ""}`
      ),
    ];
    onAttach(lines.join("\n"));
  };

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white dark:bg-[#1e2027] p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-[#23262e] px-2 py-1.5">
          <Search className="h-3 w-3 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="教材を検索..."
            className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-slate-400/60"
          />
        </div>
        {subjects.length > 0 && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-[#23262e] px-2 py-1.5 outline-none"
          >
            <option value="">全教科</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "検索"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleAttach(r)}
              className="w-full text-left p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-300/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground/80">{r.topic}</span>
                <span className="text-[10px] text-slate-400">{r.subject} · {r.level}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{r.problems.length}問 · {r.keywords.slice(0, 3).join(", ")}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
