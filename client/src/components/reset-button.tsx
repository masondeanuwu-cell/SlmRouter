import fs from "fs";

const logFilePath = "server.log";

// Directly usable as a button onClick
export const handleReset = (event?: React.MouseEvent) => {
  fs.writeFile(logFilePath, "", (err) => {
    if (err) {
      console.error("Failed to reset log file:", err);
      alert("Failed to reset log file");
    } else {
      console.log("Log file reset successfully.");
      alert("Log file reset successfully");
    }
  });
};
