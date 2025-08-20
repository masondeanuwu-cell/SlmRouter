import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export default function IframePreview() {
  const [iframeSrc, setIframeSrc] = useState("");
  
  const { data: currentConfig } = useQuery({
    queryKey: ['/api/proxy-config'],
  });

  useEffect(() => {
    if (currentConfig?.targetUrl) {
      setIframeSrc(`/api/proxy?url=${encodeURIComponent(currentConfig.targetUrl)}`);
    }
  }, [currentConfig]);

  const handleExpand = () => {
    if (iframeSrc) {
      window.open(iframeSrc, '_blank');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center">
            <i className="fas fa-external-link-alt text-blue-600 mr-2"></i>
            Iframe Preview
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-mono">
              {currentConfig?.targetUrl ? `proxy?url=${currentConfig.targetUrl}` : "No target configured"}
            </span>
            <button 
              onClick={handleExpand}
              disabled={!iframeSrc}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              <i className="fas fa-expand"></i>
            </button>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white" style={{ height: "400px" }}>
          {iframeSrc ? (
            <iframe 
              src={iframeSrc}
              className="w-full h-full border-0"
              title="Proxy Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="text-center">
                <i className="fas fa-globe text-4xl text-blue-400 mb-4"></i>
                <p className="text-slate-600 mb-2">Iframe content will appear here</p>
                <p className="text-sm text-slate-400">Configure a target URL to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
