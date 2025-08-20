import ProxyConfig from "@/components/proxy-config";
import RequestLogs from "@/components/request-logs";
import Statistics from "@/components/statistics";
import IframePreview from "@/components/iframe-preview";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { logout } = useAuth();

  return (
    <div className="bg-slate-50 font-sans text-slate-700 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <i className="fas fa-server text-blue-600 text-xl"></i>
                <h1 className="text-xl font-semibold text-slate-900">HTTP Proxy Dashboard</h1>
              </div>
              <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-700 text-xs font-medium">Server Running</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-500">
                Port: <span className="font-mono font-medium">5000</span>
              </span>
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
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            <ProxyConfig />
            <Statistics />
            
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <i className="fas fa-bolt text-amber-600 mr-2"></i>
                Quick Actions
              </h3>
              
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center space-x-2">
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
            <RequestLogs />
          </div>
        </div>
      </div>
    </div>
  );
}
