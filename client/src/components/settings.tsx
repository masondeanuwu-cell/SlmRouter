import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChangePasswordRequest } from "@shared/schema";

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const { toast } = useToast();

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const response = await apiRequest('POST', '/api/auth/change-password', data);
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

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
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
                <h3 className="font-medium text-slate-900">Dashboard Password</h3>
                <p className="text-sm text-slate-600">Change your dashboard access password</p>
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
                <Button 
                  type="submit" 
                  disabled={changePasswordMutation.isPending}
                  className="flex items-center space-x-2"
                >
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
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <i className="fas fa-info-circle text-green-600 mr-2"></i>
            System Information
          </CardTitle>
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
              <span className="text-sm text-slate-600">Proxy Port</span>
              <span className="font-mono font-medium text-slate-900">5000</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Version</span>
              <span className="font-mono font-medium text-slate-900">1.0.0</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}