import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { initGoogleCalendar, createCalendarEventWithMeet } from "@/lib/google-calendar";

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

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

export default function MeetingScheduler({
  onMeetingScheduled,
  onError,
  callType,
}: MeetingSchedulerProps) {
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>("10:00");
  const [duration, setDuration] = useState<string>("30");
  const [isCreating, setIsCreating] = useState(false);
  const [isGoogleApiReady, setIsGoogleApiReady] = useState(false);
  const [initError, setInitError] = useState<string>("");

  useEffect(() => {
    // Initialize Google Calendar API on mount
    initGoogleCalendar().then((success) => {
      setIsGoogleApiReady(success);
      if (!success) {
        setInitError("Google Calendar not configured. Please contact your administrator.");
      }
    });
  }, []);

  const handleCreateMeeting = async () => {
    if (!date) {
      onError("Please select a date");
      return;
    }

    if (!isGoogleApiReady) {
      onError("Google Calendar API is not ready. Please refresh the page.");
      return;
    }

    setIsCreating(true);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(":").map(Number);
      const meetingDate = new Date(date);
      meetingDate.setHours(hours, minutes, 0, 0);

      // Check if the meeting is in the past
      if (meetingDate < new Date()) {
        onError("Please select a future date and time");
        setIsCreating(false);
        return;
      }

      // Create calendar event with Google Meet
      const result = await createCalendarEventWithMeet(
        meetingDate,
        parseInt(duration),
        `Orbit Call - ${callType === "company" ? "Company" : "Candidate"} Interview`,
        `AI-powered ${callType} interview session via Bounteer Orbit Call`
      );

      if (result.success && result.meetLink) {
        onMeetingScheduled(result.meetLink);
      } else {
        onError(result.error || "Failed to create meeting");
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
      onError(error instanceof Error ? error.message : "Failed to create meeting");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <div className="space-y-2">
        <Label className="text-white/90">Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal bg-white/20 border-white/40 text-white hover:bg-white/30 hover:text-white",
                !date && "text-white/70"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time Picker */}
      <div className="space-y-2">
        <Label className="text-white/90">Time</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal bg-white/20 border-white/40 text-white hover:bg-white/30 hover:text-white"
            >
              <Clock className="mr-2 h-4 w-4" />
              {time}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {TIME_SLOTS.map((slot) => (
                <Button
                  key={slot}
                  variant={time === slot ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTime(slot)}
                  className="w-full"
                >
                  {slot}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Duration Selector */}
      <div className="space-y-2">
        <Label className="text-white/90">Duration</Label>
        <RadioGroup value={duration} onValueChange={setDuration}>
          <div className="flex gap-4">
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

      {/* Create Meeting Button */}
      <Button
        onClick={handleCreateMeeting}
        disabled={!date || isCreating || !isGoogleApiReady}
        className="w-full bg-white text-black hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {isCreating ? (
          <>
            <svg
              className="w-4 h-4 mr-2 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Creating Meeting...
          </>
        ) : (
          <>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Schedule & Create Meet Link
          </>
        )}
      </Button>

      {!isGoogleApiReady && !initError && (
        <p className="text-xs text-white/70 text-center">
          Loading Google Calendar...
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
