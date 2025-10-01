"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getUserProfile, type UserProfile } from "@/lib/utils";
import { EXTERNAL } from "@/constant";

interface ReferralCode {
  id: string;
  user_created?: string;
  user_claimed?: any;
  code: string;
  is_valid: boolean;
  date_created: string;
  _type?: 'created' | 'used';
}

export function SettingsForm() {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [referralCodes, setReferralCodes] = React.useState<ReferralCode[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = React.useState(true);
  const [newCode, setNewCode] = React.useState("");
  const [isCreatingCode, setIsCreatingCode] = React.useState(false);
  const [codeMessage, setCodeMessage] = React.useState("");

  const loadReferralCodes = async (userId: string) => {
    try {
      // Load codes created by user
      const createdResponse = await fetch(`${EXTERNAL.directus_url}/items/referral_code?filter[user_created][_eq]=${userId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Load codes used by user (using the many-to-many relationship)
      const usedResponse = await fetch(`${EXTERNAL.directus_url}/items/referral_code?filter[user_claimed][directus_users_id][_eq]=${encodeURIComponent(userId)}&fields=id,code,date_created,is_valid,user_claimed.id&sort[]=-date_created`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      let allCodes: ReferralCode[] = [];

      if (createdResponse.ok) {
        const createdData = await createdResponse.json();
        // Mark as created codes
        const createdCodes = (createdData.data || []).map((code: any) => ({ ...code, _type: 'created' as const }));
        allCodes = [...allCodes, ...createdCodes];
      }

      if (usedResponse.ok) {
        const usedData = await usedResponse.json();
        // Mark as used codes
        const usedCodes = (usedData.data || []).map((code: any) => ({ ...code, _type: 'used' as const }));
        allCodes = [...allCodes, ...usedCodes];
      }

      setReferralCodes(allCodes);
    } catch (error) {
      console.error("Error fetching referral codes:", error);
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  React.useEffect(() => {
    const loadUserData = async () => {
      try {
        const userProfile = await getUserProfile(EXTERNAL.directus_url);
        setUser(userProfile);
        if (userProfile) {
          setFirstName(userProfile.first_name || "");
          setLastName(userProfile.last_name || "");
          await loadReferralCodes(userProfile.id);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUserData();
  }, []);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !user) return;

    setIsCreatingCode(true);
    setCodeMessage("");

    try {
      const response = await fetch(`${EXTERNAL.directus_url}/items/referral_code`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_created: user.id,
          code: newCode.trim(),
          is_valid: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReferralCodes(prev => [...prev, data.data]);
        setNewCode("");
        setCodeMessage("Referral code created successfully!");
      } else {
        const errorData = await response.json();
        setCodeMessage(errorData.errors?.[0]?.message || "Failed to create referral code. Please try again.");
      }
    } catch (error) {
      console.error("Error creating referral code:", error);
      setCodeMessage("Failed to create referral code. Please try again.");
    } finally {
      setIsCreatingCode(false);
      setTimeout(() => setCodeMessage(""), 3000);
    }
  };

  const handleToggleValid = async (codeId: string, currentValid: boolean) => {
    try {
      const response = await fetch(`${EXTERNAL.directus_url}/items/referral_code/${codeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_valid: !currentValid,
        }),
      });

      if (response.ok) {
        setReferralCodes(prev =>
          prev.map(code =>
            code.id === codeId
              ? { ...code, is_valid: !currentValid }
              : code
          )
        );
      } else {
        console.error("Failed to update referral code validity");
      }
    } catch (error) {
      console.error("Error updating referral code:", error);
    }
  };

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

  const createdCodes = referralCodes.filter(code => code._type === 'created');
  const usedCodes = referralCodes.filter(code => code._type === 'used');

  return (
    <div className="max-w-4xl space-y-6">
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
                className={`p-3 rounded-md text-sm ${message.includes("success")
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

      {/* Referral Codes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Referral Codes
          </CardTitle>
          <CardDescription>
            View referral codes you've created and claimed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReferrals ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Created Codes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Codes Created by You</h3>
                </div>

                {createdCodes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valid</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Claimed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {createdCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={code.is_valid}
                                onCheckedChange={() => handleToggleValid(code.id, code.is_valid)}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{code.code}</TableCell>
                          <TableCell>
                            {code.user_claimed || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500 py-4">No referral codes created yet. Create one above!</p>
                )}
              </div>


              {/* Create New Code Form */}
              <form onSubmit={handleCreateCode}>
                <Label htmlFor="newCode" className="text-sm font-medium">Create New Referral Code</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="newCode"
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Enter referral code"
                    className="flex-1"
                    required
                  />
                  <Button type="submit" disabled={isCreatingCode || !newCode.trim()}>
                    {isCreatingCode ? "Creating..." : "Create New Code"}
                  </Button>
                </div>

                {codeMessage && (
                  <div
                    className={`mt-2 p-2 rounded text-sm ${codeMessage.includes("success")
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                  >
                    {codeMessage}
                  </div>
                )}
              </form>

              {/* Used Codes */}
              <div>
                <h3 className="text-sm font-medium mb-3">Codes You've Used</h3>
                {usedCodes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Used On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usedCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono">{code.code}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {new Date(code.date_created).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-gray-500 py-4">No referral codes used yet.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}