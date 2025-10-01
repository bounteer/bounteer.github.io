"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Users } from "lucide-react";
import { getUserProfile, type UserProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

export function SettingsForm() {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [user, setUser] = React.useState<UserProfile | null>(null);

  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const userProfile = await getUserProfile(EXTERNAL.directus_url);
        setUser(userProfile);
        if (userProfile) {
          setFirstName(userProfile.first_name || "");
          setLastName(userProfile.last_name || "");
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      if (!user) {
        setMessage("Please log in to update your profile.");
        return;
      }

      const response = await fetch(`${EXTERNAL.directus_url}/users/me`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }),
      });

      if (response.ok) {
        setMessage("Settings saved successfully!");
        // Update local user state
        setUser(prev => prev ? { ...prev, first_name: firstName.trim(), last_name: lastName.trim() } : null);
      } else {
        setMessage("Failed to save settings. Please try again.");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardContent className="py-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-9 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-9 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Please log in to update your profile settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your personal information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={user.first_name || "Enter your first name"}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={user.last_name || "Enter your last name"}
                  required
                />
              </div>
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.includes("success")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {message}
              </div>
            )}

            <Button type="submit" disabled={isLoading || (!firstName.trim() && !lastName.trim())}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}