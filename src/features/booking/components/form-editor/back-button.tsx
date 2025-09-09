import React from "react";
import { Button } from "@/ui/button";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
    label: string;
    onClick: () => void;
    className?: string;
}

export function BackButton({ label, onClick, className = "" }: BackButtonProps) {
    return (
        <Button
            variant="ghost"
            className={`flex items-center mb-2 text-muted-foreground p-0! hover:bg-transparent hover:text-foreground ${className}`}
            onClick={onClick}
        >
            <ChevronLeft className="h-4 w-4" />
            {label}
        </Button>
    );
}

export default BackButton;