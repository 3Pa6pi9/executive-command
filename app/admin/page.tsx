"use client";
import { managerSupabase as supabase } from "@/lib/supabase";
export default function AdminPortal() { 
  return <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-10"><h1 className="font-bold text-3xl text-emerald-500 mb-4">Admin Command Center</h1><p className="text-zinc-400 mb-6">Building Dashboard Architecture...</p><button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm hover:text-red-400">Sign Out</button></div>; 
}
