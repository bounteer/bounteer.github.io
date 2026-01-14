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

const ABORT_REASON_SECTIONS = [
  {
    title: "Signal & Timing",
    reasons: [
      { label: "Weak or speculative signal", value: "weak_or_speculative_signal" },
      { label: "Timing mismatch", value: "timing_mismatch" },
      { label: "Role inferred incorrectly", value: "incorrect_role_inference" },
    ]
  },
  {
    title: "Client Engagement",
    reasons: [
      { label: "Client unresponsive", value: "client_unresponsive" },
      { label: "No clear hiring urgency", value: "no_hiring_urgency" },
      { label: "Decision-maker not aligned", value: "decision_maker_not_aligned" },
    ]
  },
  {
    title: "Commercial",
    reasons: [
      { label: "Terms not attractive", value: "unattractive_commercial_terms" },
      { label: "Low close probability", value: "low_close_probability" },
    ]
  },
  {
    title: "Execution",
    reasons: [
      { label: "Insufficient candidates", value: "insufficient_candidate_supply" },
      { label: "Constraints too restrictive", value: "overly_restrictive_constraints" },
    ]
  },
  {
    title: "Internal",
    reasons: [
      { label: "Higher-priority work", value: "reprioritized_workload" },
      { label: "Capacity constraints", value: "internal_capacity_constraints" },
    ]
  },
  {
    title: "Hard Stop",
    reasons: [
      { label: "Hiring frozen or canceled", value: "hiring_frozen_or_canceled" },
      { label: "Filled elsewhere", value: "role_filled_elsewhere" },
    ]
  },
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

  const handleReasonToggle = (value: string) => {
    setSelectedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const reasonValues = Array.from(selectedReasons);
    if (otherReason.trim()) {
      reasonValues.push(otherReason.trim());
    }

    if (reasonValues.length === 0) {
      return; // Don't submit without a reason
    }

    setIsSubmitting(true);
    const combinedReason = reasonValues.join("; ");
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Abort Hiring Intent</DialogTitle>
          <DialogDescription>
            {companyName ? (
              <div className="space-y-1">
                <div>Please select why you're aborting the hiring intent for:</div>
                <div className="font-semibold text-gray-900">{companyName}</div>
              </div>
            ) : (
              "Please select why you're aborting this hiring intent."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {ABORT_REASON_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1.5">
                    {section.reasons.map((reason) => (
                      <div key={reason.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={reason.value}
                          checked={selectedReasons.has(reason.value)}
                          onCheckedChange={() => handleReasonToggle(reason.value)}
                        />
                        <Label
                          htmlFor={reason.value}
                          className="text-sm font-normal cursor-pointer leading-tight"
                        >
                          {reason.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-100 mt-3">
            <Label htmlFor="other-reason" className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Other
            </Label>
            <Textarea
              id="other-reason"
              placeholder="Specify reason..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
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
