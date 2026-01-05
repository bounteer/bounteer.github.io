"use client"
import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DateTimePick() {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(undefined)

  return (
    <div className="flex gap-4">
      {/* Date */}
      <div className="flex flex-col gap-3">
        <Label htmlFor="date-picker" className="px-1 text-white/80">
          Date
        </Label>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date-picker"
              className="
                w-32 justify-between font-normal
                bg-white/15 backdrop-blur-md
                border border-white/30
                text-white
                hover:bg-white/20
                focus:ring-2 focus:ring-white/40
              "
            >
              {date ? date.toLocaleDateString() : "Select date"}
              <ChevronDownIcon className="h-4 w-4 opacity-80" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="
              w-auto p-0 overflow-hidden
              bg-white/15 backdrop-blur-md
              border border-white/30
            "
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={(date) => {
                setDate(date)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time */}
      <div className="flex flex-col gap-3">
        <Label htmlFor="time-picker" className="px-1 text-white/80">
          Time
        </Label>

        <Input
          type="time"
          id="time-picker"
          step="1"
          defaultValue="10:30:00"
          className="
            bg-white/15 backdrop-blur-md
            border border-white/30
            text-white
            focus:ring-2 focus:ring-white/40
            appearance-none
            [&::-webkit-calendar-picker-indicator]:hidden
          "
        />
      </div>
    </div>
  )
}
