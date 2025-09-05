import { useEffect, useState, useRef } from "react";

export default function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const evtSource = new EventSource("/api/logs");

    evtSource.onmessage = (event) => {
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, event.data];
        return newLogs.slice(-10); // keep only last 10 logs
      });

      // Scroll to bottom after rendering
      requestAnimationFrame(() => {
        if (logsRef.current) {
          logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
      });
    };

    return () => {
      evtSource.close();
    };
  }, []);

  return (
    <div className="p-4 bg-slate-50 min-h-[200px]">
      <h1 className="text-xl font-bold mb-4">Server Logs</h1>
      <pre
        ref={logsRef}
        className="bg-black text-green-400 p-4 rounded overflow-auto max-h-[80vh]"
      >
        {logs.join("\n")}
      </pre>
    </div>
  );
}
