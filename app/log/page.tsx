"use client";

import { useState } from "react";

export default function LogPage() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "loading", msg: "Submitting link..." });

    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, handler_name: name }),
      });
      
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", msg: "KPI Successfully Logged." });
        setUrl(""); // Reset URL field for the next entry
      } else {
        setStatus({ type: "error", msg: data.error || "Submission failed." });
      }
    } catch (err) {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-zinc-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">KPI Submission</h1>
          <p className="text-sm text-zinc-400">Enter your identifier and the daily Facebook post URL.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Handler Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Post URL</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="https://facebook.com/..."
              />
            </div>
          </div>

          {status.type !== "idle" && (
            <div className={`rounded-lg p-3 text-sm font-medium ${
              status.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : 
              status.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
              "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            }`}>
              {status.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={status.type === "loading"}
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 transition-all"
          >
            {status.type === "loading" ? "Processing..." : "Submit KPI"}
          </button>
        </form>
      </div>
    </div>
  );
}