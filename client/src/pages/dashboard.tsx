import { useState, useEffect } from "react";
import RouterConfig from "@/components/proxy-config";
import RequestLogs from "@/components/request-logs";
import Statistics from "@/components/statistics";
import IframePreview from "@/components/iframe-preview";
import Settings from "@/components/settings";
import { useAuth } from "@/hooks/use-auth";
import LogViewer from "@/components/log-viewer";
import fs from "fs";
import { Button } from "@/components/ui/button";
import { handleReset } from "@/components/reset-button";
import SignupsPage from "@/pages/signups";

const logFilePath = "server.log";



export default function Dashboard() {
  
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [uptime, setUptime] = useState<string>("00:00:00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUptime = async () => {
      try {
        const res = await fetch("/api/uptime");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json(); // { uptime: "HH:MM:SS" }
        setUptime(data.uptime);
      } catch (err: any) {
        setError(err.message || "Failed to fetch uptime");
      }
    };

    fetchUptime();

    // Refresh every second
    const interval = setInterval(fetchUptime, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="bg-slate-50 font-sans text-slate-700 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <i className="server-logo"></i>
                <h1 className="text-xl font-semibold text-slate-900">
                  SlmRouter Dashboard
                </h1>
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-700 text-xs font-medium">
                  Server Running
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-500">
                Port: <span className="font-mono font-medium">5000</span>
              </span>
              <span className="text-sm text-slate-500">
                Uptime: <span className="font-mono font-medium">{uptime}</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    setActiveTab(
                      activeTab === "settings" ? "dashboard" : "settings",
                    )
                  }
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                    activeTab === "settings"
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Settings"
                >
                  <i className="fas fa-cog"></i>
                  <span>Settings</span>
                </button>
                <button
                  onClick={() =>
                    setActiveTab(
                      activeTab === "signups" ? "dashboard" : "signups",
                    )
                  }
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                    activeTab === "signups"
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                  title="Signups"
                >
                  <i className="fas fa-envelope"></i>
                  <span>Signups</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Logout"
                >
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {activeTab === "dashboard" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel */}
            <div className="lg:col-span-1 space-y-6">
              <RouterConfig />
              <Statistics />
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                  <i className="fas fa-bolt text-amber-600 mr-2"></i>
                  Quick Actions
                </h3>

                <div className="space-y-2">
                  <button
                    onClick={handleReset}
                    className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-2"
                  >
                    <i className="fas fa-trash-alt text-red-500 w-4"></i>
                    <span>Clear Logs</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-2">
                    <i className="fas fa-download text-blue-500 w-4"></i>
                    <span>Export Logs</span>
                  </button>
                  <button className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-2">
                    <i className="fas fa-sync-alt text-emerald-500 w-4"></i>
                    <span>Restart Server</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <IframePreview />
              {/* Log Viewer */}
              <button
                onClick={() => setShowLogViewer(!showLogViewer)}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-2"
              >
                <i className="fas fa-eye text-blue-500 w-4"></i>
                <span>{showLogViewer ? "Hide Logs" : "View Logs"}</span>
              </button>
              {showLogViewer && (
                <div className="mt-4">
                  <LogViewer />
                </div>
              )}
              {/* end of log viewer */}
              <RequestLogs />
            </div>
          </div>
        ) : activeTab === 'signups' ? (
          <div>
            <SignupsPage />
          </div>
        ) : (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                <i className="fas fa-cog text-blue-600 mr-3"></i>
                Settings
              </h2>
              <p className="text-slate-600 mt-1">
                Manage your proxy dashboard configuration and security settings
              </p>
            </div>
            <Settings />
          </div>
        )}
      </div>
    </div>
  );
}
