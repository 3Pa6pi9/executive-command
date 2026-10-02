import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-black text-white selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter mb-8 text-white">
            Executive<br />
            <span className="text-zinc-500">Command</span>
          </h1>
          <nav className="space-y-4 text-sm font-medium text-zinc-400">
            <p className="text-white bg-zinc-900 p-2 rounded-md cursor-pointer transition-colors">Overview</p>
            <p className="hover:text-white p-2 cursor-pointer transition-colors">Campaign Fleet</p>
            <p className="hover:text-white p-2 cursor-pointer transition-colors">Analytics</p>
            <p className="hover:text-white p-2 cursor-pointer transition-colors">Live Logging</p>
          </nav>
        </div>
        <div className="flex items-center space-x-3 border-t border-zinc-800 pt-4">
          <Avatar className="h-9 w-9">
            <AvatarImage src="" alt="Admin" />
            <AvatarFallback className="bg-zinc-800 text-zinc-300">JS</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Josiah</span>
            <span className="text-xs text-zinc-500">System Admin</span>
          </div>
        </div>
      </aside>

      {/* Main Dashboard Area */}
      <main className="flex-1 p-8 overflow-y-auto bg-black">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Fleet Operations</h2>
            <p className="text-zinc-400 text-sm mt-1">Real-time narrative campaign tracking.</p>
          </div>
          <div className="flex items-center space-x-4">
            <Input 
              type="text" 
              placeholder="Search active URLs..." 
              className="w-64 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-zinc-700"
            />
            <Button variant="default" className="bg-white text-black hover:bg-zinc-200">
              Generate Report
            </Button>
          </div>
        </header>

        {/* Top-Down Metric Oversight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Active Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">482</p>
              <p className="text-xs text-emerald-500 mt-1 font-medium">+12 this week</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Daily Processed Links</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">12,450</p>
              <p className="text-xs text-emerald-500 mt-1 font-medium">Zero latency sync</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-950 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Flagged/Restricted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-red-500">3</p>
              <p className="text-xs text-zinc-500 mt-1">Requires immediate action</p>
            </CardContent>
          </Card>
        </div>

        {/* Real-time Ledger Placeholder */}
        <div className="flex flex-col space-y-4">
          <h3 className="text-xl font-semibold text-white tracking-tight">Recent Validations</h3>
          <Card className="h-96 flex items-center justify-center border-dashed border-2 border-zinc-800 bg-black">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800"></div>
              <p className="text-zinc-500 text-sm font-medium">Real-time Campaign Ledger initializing...</p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}