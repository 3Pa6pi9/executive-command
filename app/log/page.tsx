"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function HandlerLogPage() {
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('campaign_links')
      .insert([{ url: url, handler_name: 'Mobile User' }]);

    if (error) {
      alert("Error logging link. Please try again.");
      console.error(error);
    } else {
      setUrl("");
      alert("Link logged successfully!");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white selection:bg-primary selection:text-primary-foreground">
      <Card className="w-full max-w-md bg-zinc-950 border-zinc-800 shadow-2xl">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Daily Operations</CardTitle>
          <CardDescription className="text-zinc-400">
            Paste your campaign URL below to log your daily quota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input 
              type="url" 
              placeholder="https://..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="h-14 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 text-lg focus-visible:ring-zinc-700"
            />
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-semibold bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              {isSubmitting ? "Logging..." : "Submit Link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
