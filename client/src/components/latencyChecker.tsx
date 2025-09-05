import React, { useEffect, useState } from "react";

const LatencyChecker: React.FC = () => {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const start = performance.now();

    fetch("/api/ping") // Your Express endpoint
      .then(() => {
        const end = performance.now();
        setLatency(end - start);
      })
      .catch((err) => {
        console.error("Error checking latency:", err);
      });
  }, []);

  return (
    <div>
      <h3>🔄 Server Latency</h3>
      {latency !== null ? (
        <p>{latency.toFixed(2)} ms</p>
      ) : (
        <p>Measuring...</p>
      )}
    </div>
  );
};

export default LatencyChecker;
