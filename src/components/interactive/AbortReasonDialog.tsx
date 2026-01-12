import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AbortReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  companyName?: string;
}

const ABORT_REASONS = [
  "Position filled internally",
  "Hiring freeze announced",
  "Company no longer hiring",
  "Not a good fit for my skills",
  "Location/remote requirements don't match",
];

export function AbortReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  companyName,
}: AbortReasonDialogProps) {
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [otherReason, setOtherReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) {
        next.delete(reason);
      } else {
        next.add(reason);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const reasons = Array.from(selectedReasons);
    if (otherReason.trim()) {
      reasons.push(otherReason.trim());
    }

    if (reasons.length === 0) {
      return; // Don't submit without a reason
    }

    setIsSubmitting(true);
    const combinedReason = reasons.join("; ");
    await onConfirm(combinedReason);
    setIsSubmitting(false);

    // Reset form
    setSelectedReasons(new Set());
    setOtherReason("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedReasons(new Set());
    setOtherReason("");
    onOpenChange(false);
  };

  const hasReason = selectedReasons.size > 0 || otherReason.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Abort Hiring Intent</DialogTitle>
          <DialogDescription>
            {companyName ? (
              <>
                Please select why you're aborting the hiring intent for{" "}
                <span className="font-semibold">{companyName}</span>.
              </>
            ) : (
              "Please select why you're aborting this hiring intent."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {ABORT_REASONS.map((reason) => (
              <div key={reason} className="flex items-start space-x-3">
                <Checkbox
                  id={reason}
                  checked={selectedReasons.has(reason)}
                  onCheckedChange={() => handleReasonToggle(reason)}
                />
                <Label
                  htmlFor={reason}
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {reason}
                </Label>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="other-reason" className="text-sm font-medium">
              Other (please specify)
            </Label>
            <Textarea
              id="other-reason"
              placeholder="Enter specific reason..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!hasReason || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? "Aborting..." : "Confirm Abort"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
