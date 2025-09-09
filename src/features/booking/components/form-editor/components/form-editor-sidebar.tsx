import React from "react";
import { Button } from "@/ui/button";
import {
    Info,
    PaintbrushIcon,
    ListTree,
    MessageCircleQuestion,
    CircleDollarSign,
    Plus,
    Settings,
} from "lucide-react";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface FormEditorSidebarProps {
    navigationLevel: NavigationLevel;
    onNavigate: (level: NavigationLevel) => void;
    className?: string;
}

export function FormEditorSidebar({
    navigationLevel,
    onNavigate,
    className = "",
}: FormEditorSidebarProps) {
    const navItems = [
        {
            icon: <Info className="h-4 w-4" />,
            label: "Form Details",
            level: "root" as NavigationLevel,
        },
        {
            icon: <PaintbrushIcon className="h-4 w-4" />,
            label: "Appearance",
            level: "branding" as NavigationLevel,
        },
        {
            icon: <ListTree className="h-4 w-4" />,
            label: "Services",
            level: "services" as NavigationLevel,
        },
        {
            icon: <MessageCircleQuestion className="h-4 w-4" />,
            label: "Questions",
            level: "questions" as NavigationLevel,
        },
        {
            icon: <CircleDollarSign className="h-4 w-4" />,
            label: "Payment",
            level: "root" as NavigationLevel, // This will need to be updated when payment level is added
        },
        {
            icon: <Settings className="h-4 w-4" />,
            label: "Advanced",
            level: "root" as NavigationLevel, // This will need to be updated when advanced level is added
        },
    ];

    return (
        <div className={`h-full lg:w-60 w-full py-8 flex flex-col border-r shadow-md ${className}`}>
            <div className="text-xl font-medium px-6">Form Editor</div>

            <div className="mt-8 flex-1 flex flex-col gap-1 px-3">
                {navItems.map((item) => (
                    <Button
                        key={item.level}
                        variant={navigationLevel === item.level ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => onNavigate(item.level)}
                    >
                        {item.icon}
                        <span className="ml-2">{item.label}</span>
                    </Button>
                ))}
            </div>

            <div className="mt-4 px-3">
                <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onNavigate("root" as NavigationLevel)}
                >
                    <Plus className="h-4 w-4" />
                    <span className="ml-2">New Form</span>
                </Button>
            </div>
        </div>
    );
}

export default FormEditorSidebar;