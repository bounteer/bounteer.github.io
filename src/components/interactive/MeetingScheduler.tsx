import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { initGoogleCalendar, createCalendarEventWithMeet } from "@/lib/google-calendar";
import { DateTimePick } from "./DateTimePick";

interface MeetingSchedulerProps {
  onMeetingScheduled: (meetLink: string) => void;
  onError: (error: string) => void;
  callType: "company" | "candidate";
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
];

export default function MeetingScheduler({
  onMeetingScheduled,
  onError,
  callType,
}: MeetingSchedulerProps) {
  const [dateTime, setDateTime] = useState<Date | undefined>();
  const [duration, setDuration] = useState<string>("30");
  const [emails, setEmails] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isGoogleApiReady, setIsGoogleApiReady] = useState(false);
  const [initError, setInitError] = useState<string>("");

  useEffect(() => {
    initGoogleCalendar().then((success) => {
      setIsGoogleApiReady(success);
      if (!success) {
        setInitError("Google Calendar not configured. Please contact your administrator.");
      }
    });
  }, []);

  const handleCreateMeeting = async () => {
    if (!dateTime) {
      onError("Please select a date and time");
      return;
    }

    if (!isGoogleApiReady) {
      onError("Google Calendar API is not ready. Please refresh the page.");
      return;
    }

    if (dateTime < new Date()) {
      onError("Please select a future date and time");
      return;
    }

    setIsCreating(true);

    try {
      const attendeeEmails = emails
        .split(/[,\s]+/)
        .map(e => e.trim())
        .filter(e => e.includes("@"));

      const result = await createCalendarEventWithMeet(
        dateTime,
        parseInt(duration),
        `Orbit Call - ${callType === "company" ? "Company" : "Candidate"} Interview`,
        `AI-powered ${callType} interview session via Bounteer Orbit Call`,
        attendeeEmails
      );

      if (result.success && result.meetLink) {
        onMeetingScheduled(result.meetLink);
      } else {
        onError(result.error || "Failed to create meeting");
      }
    } catch (err) {
      console.error(err);
      onError(err instanceof Error ? err.message : "Failed to create meeting");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Date + Time */}
      <DateTimePick
        value={dateTime}
        onChange={setDateTime}
        className="space-y-2"
      />

      {/* Email Invitations */}
      <div className="space-y-2">
        <Label className="text-white/90 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Invite Attendees (Optional)
        </Label>

        <Input
          type="text"
          placeholder="email@example.com, another@example.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          className="bg-white/20 border-white/40 text-white placeholder-white/60 focus-visible:ring-white/50 backdrop-blur-sm"
        />

        <p className="text-xs text-white/60">
          Enter email addresses separated by commas or spaces
        </p>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-white/90">Duration</Label>
        <RadioGroup value={duration} onValueChange={setDuration}>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {DURATION_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option.value}
                  id={`duration-${option.value}`}
                  className="border-white/40 text-white"
                />
                <Label
                  htmlFor={`duration-${option.value}`}
                  className="text-white/90 cursor-pointer text-sm"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Create */}
      <Button
        onClick={handleCreateMeeting}
        disabled={!dateTime || isCreating || !isGoogleApiReady}
        className="w-full bg-white text-black hover:bg-gray-200 font-semibold disabled:opacity-50"
      >
        {isCreating ? "Creating Meeting…" : (
          <>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Schedule & Create Meet Link
          </>
        )}
      </Button>

      {!isGoogleApiReady && !initError && (
        <p className="text-xs text-white/70 text-center">
          Loading Google Calendar…
        </p>
      )}

      {initError && (
        <p className="text-xs text-yellow-300 text-center">
          {initError}
        </p>
      )}
    </div>
  );
}
