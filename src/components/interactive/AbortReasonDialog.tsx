import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AbortReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  companyName?: string;
}

export function AbortReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  companyName,
}: AbortReasonDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason(""); // Reset after confirm
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setReason(""); // Reset on cancel
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-2xl mx-auto">
        <SheetHeader>
          <SheetTitle>Abort Hiring Intent</SheetTitle>
          <SheetDescription>
            {companyName
              ? `Please provide a reason for aborting the hiring intent for ${companyName}.`
              : "Please provide a reason for aborting this hiring intent."}
          </SheetDescription>
        </SheetHeader>

        <div className="py-4">
          <Textarea
            placeholder="Enter reason for aborting (e.g., position filled, company not responsive, budget constraints, etc.)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full"
          />
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim()}
          >
            Confirm Abort
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
