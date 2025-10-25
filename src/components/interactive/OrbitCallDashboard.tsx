"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobDescriptionForm } from "@/components/interactive/JobDescriptionForm";
import { JobDescriptionFormData, JobDescriptionFormErrors, isValidCallUrl } from "@/types/models";

export default function OrbitCallDashboard() {
  const [callUrl, setCallUrl] = useState("");
  const [jobData, setJobData] = useState<JobDescriptionFormData>();
  const [jobErrors, setJobErrors] = useState<JobDescriptionFormErrors>({});

  const handleSendBot = () => {
    if (!callUrl.trim()) {
      alert("Please enter a call URL");
      return;
    }
    if (!isValidCallUrl(callUrl)) {
      alert("Please enter a valid Google Meet, MS Teams, or Zoom URL");
      return;
    }
    console.log("Sending bot to call:", callUrl);
    console.log("Job data:", jobData);
    alert("Bot is being sent to the call!");
  };

  return (
    <Card className="w-full h-[calc(100vh-8rem)] max-w-none shadow-lg overflow-hidden">
      <div className="grid md:grid-cols-2 h-full">
        {/* Left Side - Call Setup & Job Description */}
        <div className="p-8 flex flex-col space-y-6 overflow-y-auto">
          {/* Call URL Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="callUrl">Call URL</Label>
              <div className="flex space-x-2">
                <Input
                  id="callUrl"
                  type="url"
                  placeholder="Paste Google Meet, MS Teams, or Zoom URL"
                  value={callUrl}
                  onChange={(e) => setCallUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendBot}
                  className="whitespace-nowrap"
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                  </svg>
                  Send Bot
                </Button>
              </div>
            </div>
          </div>

          {/* Job Description Section */}
          <div className="flex-1 flex flex-col pt-4 border-t">
            <JobDescriptionForm
              onChange={setJobData}
              onValidationChange={setJobErrors}
              className="flex-1"
            />
          </div>
        </div>

        {/* Right Side - Candidates List */}
        <div className="p-8 flex flex-col bg-gray-50 border-l">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Candidates</h2>

          {/* Candidates List */}
          <div className="flex-1 space-y-4">
            {/* Candidate 1 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Sarah Chen</h3>
                  <p className="text-xs text-gray-600">Senior Software Engineer</p>
                  <p className="text-xs text-gray-500 mt-1">5 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-green-600">92%</div>
                  </div>
                  <div className="w-2 h-8 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">React</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">TypeScript</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Node.js</span>
              </div>
            </div>

            {/* Candidate 2 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Marcus Johnson</h3>
                  <p className="text-xs text-gray-600">Full Stack Developer</p>
                  <p className="text-xs text-gray-500 mt-1">3 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-yellow-600">78%</div>
                  </div>
                  <div className="w-2 h-8 bg-yellow-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Python</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Django</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">PostgreSQL</span>
              </div>
            </div>

            {/* Candidate 3 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-sm text-gray-900">Emily Rodriguez</h3>
                  <p className="text-xs text-gray-600">Frontend Developer</p>
                  <p className="text-xs text-gray-500 mt-1">4 years experience</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Role Fit</div>
                    <div className="text-sm font-bold text-orange-600">65%</div>
                  </div>
                  <div className="w-2 h-8 bg-orange-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Vue.js</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">JavaScript</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">CSS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
