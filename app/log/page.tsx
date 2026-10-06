"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LogPage() {
  const [session, setSession] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; msg: string }>({ type: "idle", msg: "" });

  const [myLogs, setMyLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]);
      setIsCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]);
    });

    // LIVE SYNC: Listen for updates to this specific user's logs
    const channel = supabase
      .channel('my-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_links' }, () => {
        if (session?.user?.email) fetchMyLogs(session.user.email.split("@")[0]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [session?.user?.email]);

  const fetchMyLogs = async (handlerId: string) => {
    const { data } = await supabase.from("campaign_links").select("*").eq("handler_name", handlerId).order("created_at", { ascending: false }).limit(50);
    if (data) setMyLogs(data);
  };

  const handleAuth = async (e: React.FormEvent) => {