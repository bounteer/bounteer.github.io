import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export function ContactCard() {
  return (
    <Card className="p-4 bg-white border border-gray-200">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Need More Capacity?
          </h3>
          <p className="text-xs text-gray-600">
            Contact us to learn about upgraded plans with higher quotas.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open("mailto:hello@bounteer.com", "_blank")}
          className="w-full"
        >
          <Mail className="w-4 h-4 mr-2" />
          Contact Us
        </Button>
      </div>
    </Card>
  );
}
