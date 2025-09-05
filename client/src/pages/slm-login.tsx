import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { LoginRequest } from "@shared/schema";

interface LoginProps {
  onLogin: () => void;
}

export default function UserLogin({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginRequest) => {
      const response = await apiRequest('POST', '/api/auth/user-login', data);
      return response.json();
    },
    onSuccess: () => {
      sessionStorage.setItem('browser-authenticated', 'true');
      onLogin();
      toast({
        title: "Login Successful",
        description: "Welcome to the SlmBrowser",
      });
    },
    onError: (error: any) => {
      console.error(error.message);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: "Credentials Required",
        description: "Please enter both username and password to continue",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-server text-blue-600 text-2xl"></i>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            SlmBrowser Login
          </CardTitle>
          <CardDescription className="text-slate-600">
            Welcome to the SlmBrowser Login Page. Admin? Navigate to <a href="/" className="text-blue-600 hover:underline">Admin Login</a>. Please enter your Username and Password to continue.
          </CardDescription>
          <CardDescription className="text-red-600 bold">
            NOTE: Device names are tracked! Using another users credientials will cancel your credentials!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                disabled={loginMutation.isPending}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter user password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                disabled={loginMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Authenticating...
                </>
              ) : (
                <>
                  <i className="fas fa-unlock mr-2"></i>
                  Access Browser
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}