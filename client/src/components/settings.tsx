import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChangePasswordRequest } from "@shared/schema";
import { useTheme } from "@/components/theme-provider";


function CommandForm() {
  const [command, setCommand] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);
  const { toast } = useToast();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible(prev => !prev), 500);
    return () => clearInterval(interval);
  }, []);

  // auto-scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Only scroll if user is near bottom
    const threshold = 50; // px from bottom
    const atBottom = textarea.scrollHeight - textarea.scrollTop - textarea.clientHeight < threshold;

    if (atBottom) {
      // Use requestAnimationFrame to wait for DOM update
      requestAnimationFrame(() => {
        textarea.scrollTop = textarea.scrollHeight;
      });
    }
  }, [log, cursorVisible]);

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: async (cmd: string) => {
      const res = await apiRequest("POST", "/api/execute", { command: cmd, password });
      return res.json();
    },
    onError: (err: any) => {
      toast({
        title: "Execution Failed",
        description: err.message || "Failed to execute command",
        variant: "destructive",
      });
    }
  });

  const scrollToBottom = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.scrollTop = textarea.scrollHeight;
  };

  const typeCommandInLog = (cmd: string) => {
    return new Promise<void>((resolve) => {
      let index = 0;
      const timestamp = new Date().toISOString();
      const linePrefix = `\n[${timestamp}] @SlmRouter /api/execute/$ `;
      setLog(prev => [...prev, linePrefix]);

      const interval = setInterval(() => {
        if (index >= cmd.length) {
          clearInterval(interval);
          // scroll after typing finishes
          requestAnimationFrame(scrollToBottom);
          resolve();
          return;
        }
        setLog(prev => {
          const lastLine = prev[prev.length - 1] || "";
          prev[prev.length - 1] = lastLine + cmd[index];
          return [...prev];
        });
        index++;
      }, 50); // typing speed
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!command.trim() || !password.trim()) {
      toast({
        title: "Missing Input",
        description: "Please enter both command and password",
        variant: "destructive",
      });
      return;
    }

    const cmd = command; // save current command
    setCommand(""); // clear input
    commandInputRef.current?.focus();

    // Type command
    await typeCommandInLog(cmd);

    // Execute
    executeMutation.mutate(cmd, {
      onSuccess: (data) => {
        let resultString = "";
        try {
          const parsed = typeof data === "string" ? JSON.parse(data) : data;
          resultString = parsed.result || JSON.stringify(parsed);
        } catch {
          resultString = typeof data === "string" ? data : JSON.stringify(data);
        }
        const timestamp = new Date().toISOString();
        setLog(prev => [...prev, `\n[${timestamp}] ${resultString}`]);
        toast({
          title: "Command Executed",
          description: "The command was executed on the server.",
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="command">Server Command</Label>
        <Input
          id="command"
          placeholder="Enter command"
          value={command}
          ref={commandInputRef}
          onChange={e => setCommand(e.target.value)}
          disabled={executeMutation.isPending}
          required
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={executeMutation.isPending}
          required
        />
      </div>

      <Button type="submit" disabled={executeMutation.isPending}>
        {executeMutation.isPending ? (
          <>
            <i className="fas fa-spinner fa-spin"></i>
            <span> Executing...</span>
          </>
        ) : (
          <>
            <i className="fas fa-play"></i>
            <span> Run Command</span>
          </>
        )}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="response">Response</Label>
        <textarea
          id="response"
          ref={textareaRef}
          className="w-full p-2 border rounded-lg font-mono text-sm bg-black text-green-400"
          value={ new Date().toISOString() + "  |  New SlmRouter Term Session\n" + log.join("") + "\n@SlmRouter /api/execute/" + (cursorVisible ? "▋" : "")}
          rows={15}
          readOnly
        />
      </div>
    </form>
  );
}


export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const { toast } = useToast();
  const [serverIP, setServerIP] = useState<string>("");
  const [ping, setPing] = useState<string>("");
  
  useEffect(() => {
    fetch("/api/server-ip")
      .then(res => res.json())
      .then(data => setServerIP(data.ip));
  }, []);
  useEffect(() => {
    const fetchPing = () => {
      fetch("/api/ping")
        .then(res => res.json())
        .then(data => setPing(data.latency));
    }
    fetchPing();
    const interval = setInterval(fetchPing, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const response = await apiRequest(
        "POST",
        "/api/auth/change-password",
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      toast({
        title: "Password Changed",
        description: "Your dashboard password has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 3) {
      toast({
        title: "Password Too Short",
        description: "New password must be at least 3 characters long",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="flex flex-col space-y-6 p-4 page">
      {/* Security Card */}
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-shield-alt text-blue-600 mr-2"></i>
            Security Settings
          </CardTitle>
          <CardDescription>
            Manage your dashboard password and security preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h3 className="font-medium text-slate-900">
                  Dashboard Password
                </h3>
                <p className="text-sm text-slate-600">
                  Change your dashboard access password
                </p>
              </div>
              <Button
                onClick={() => setShowPasswordForm(true)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <i className="fas fa-key"></i>
                <span>Change Password</span>
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm font-medium text-slate-700">
                  Current Password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changePasswordMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-slate-700">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changePasswordMutation.isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changePasswordMutation.isPending}
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Button type="submit" disabled={changePasswordMutation.isPending} className="flex items-center space-x-2">
                  {changePasswordMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      <span>Update Password</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={changePasswordMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Theme Card */}
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-palette text-purple-600 mr-2"></i>
            Theme Settings
          </CardTitle>
          <CardDescription>
            Switch between Light, Dark, or Rainbow mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <h3 className="font-medium text-slate-900">Current Theme</h3>
              <p className="text-sm text-slate-600 capitalize">{theme} mode</p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
              >
                ☀️ Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
              >
                🌙 Dark
              </Button>
              <Button onClick={() => setTheme("rainbow")} className="btn-rainbow">
                🌈 Rainbow
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info Card */}
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-info-circle text-green-600 mr-2"></i>
            System Information
          </CardTitle>
          <CardDescription>Overview of server and project details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Server Status</span>
              <span className="flex items-center space-x-1 px-2 py-1 bg-emerald-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-emerald-700 text-xs font-medium">Online</span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Router Port</span>
              <span className="font-mono font-medium text-slate-900">5000</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Server IP</span>
              <span className="font-mono font-medium text-slate-900">{serverIP}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Server Ping</span>
              <span className="font-mono font-medium text-slate-900">{ping}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Version</span>
              <span className="font-mono font-medium text-slate-900">SlmRouter v1.8.1</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Made With Love</span>
              <span className="font-mono font-medium text-slate-900">Mason Dean</span>
            </div>

          </div>
        </CardContent>
      </Card>
      {/* Execute Command Card */}
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-terminal text-red-600 mr-2"></i>
            Execute Server Command
          </CardTitle>
          <CardDescription>
            Run a command on the server (requires password)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommandForm />
        </CardContent>
      </Card>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
      <br></br>
    </div>
  );
}
