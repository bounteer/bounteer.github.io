"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, GripVertical } from "lucide-react";

interface DraggableSkillsTagsProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

export function DraggableSkillsTags({
  skills,
  onChange,
  disabled = false,
  label = "Skills",
  placeholder = "Add a skill and press Enter"
}: DraggableSkillsTagsProps) {
  const [newSkill, setNewSkill] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addSkill = useCallback(() => {
    const trimmedSkill = newSkill.trim();
    if (trimmedSkill && !skills.includes(trimmedSkill)) {
      onChange([...skills, trimmedSkill]);
      setNewSkill("");
      inputRef.current?.focus();
    }
  }, [newSkill, skills, onChange]);

  const removeSkill = useCallback((index: number) => {
    const newSkills = skills.filter((_, i) => i !== index);
    onChange(newSkills);
  }, [skills, onChange]);

  const moveSkill = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newSkills = [...skills];
    const [movedSkill] = newSkills.splice(fromIndex, 1);
    newSkills.splice(toIndex, 0, movedSkill);
    onChange(newSkills);
  }, [skills, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.style.opacity = "";
    setDraggedIndex(null);
    setIsDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();
    setIsDragOver(index);
  };

  const handleDragLeave = () => {
    setIsDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null) return;

    moveSkill(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setIsDragOver(null);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="skills-input" className="text-sm font-medium">
        {label}
        <span className="text-xs text-gray-500 ml-2">(Most important skills first)</span>
      </Label>

      <div className="space-y-3">
        {/* Skills List */}
        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <AnimatePresence>
            {skills.map((skill, index) => (
              <motion.div
                key={skill}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                layout
                className={`
                  group flex items-center gap-2 p-2 bg-primary-50 border border-primary-200 rounded-lg cursor-move
                  ${isDragOver === index ? "border-primary-400 bg-primary-100" : ""}
                  ${draggedIndex === index ? "opacity-50" : ""}
                  ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-primary-100 hover:border-primary-300"}
                `}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Drag Handle */}
                <div className={`
                  flex items-center justify-center w-4 h-4 text-primary-400
                  ${disabled ? "text-gray-300" : "group-hover:text-primary-600"}
                `}>
                  <GripVertical className="w-3 h-3" />
                </div>

                {/* Skill Text */}
                <span className="flex-1 text-sm font-medium text-primary-700">
                  {skill}
                </span>


                {/* Remove Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-6 h-6 p-0 text-primary-400 hover:text-red-500 hover:bg-red-50"
                  onClick={() => removeSkill(index)}
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add New Skill Input */}
        {!disabled && (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id="skills-input"
              type="text"
              placeholder={placeholder}
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSkill}
              disabled={!newSkill.trim() || skills.includes(newSkill.trim()) || disabled}
              className="px-3 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </Button>
          </div>
        )}

        {/* Helper Text */}
        <p className="text-xs text-gray-500">
          Drag and drop to reorder skills by importance. The first skills will be prioritized in candidate matching.
        </p>
      </div>
    </div>
  );
}