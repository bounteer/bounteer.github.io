import { Button } from "../ui/button";
import { Target } from "lucide-react";

export function MobileFloatingButton() {
  const handleClick = () => {
    // Navigate to Role Fit Index page or section
    window.location.href = "/role-fit-index";
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
      <Button
        onClick={handleClick}
        size="lg"
        className="rounded-full shadow-2xl hover:shadow-primary-700 hover:shadow-2xl transition-all duration-300 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 flex items-center gap-2 drop-shadow-lg"
      >
        <Target className="size-5" />
        <span className="font-medium">Check Role Fit</span>
      </Button>
    </div>
  );
}