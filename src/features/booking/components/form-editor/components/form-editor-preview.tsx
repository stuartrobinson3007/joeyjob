import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface FormEditorPreviewProps {
    children: ReactNode;
    darkMode?: boolean;
}

/**
 * Preview panel for the form editor showing how the booking flow will appear to users
 */
export function FormEditorPreview({
    children,
    darkMode
}: FormEditorPreviewProps) {
    return (
        <div className="flex-1 pr-6 lg:pr-8 pb-6 lg:pb-8">
            <div className={cn("relative overflow-auto bg-muted rounded-3xl h-full text-muted-foreground flex flex-col", darkMode ? "dark" : "")}>
                <div className="sticky z-10 bg-muted top-0 left-0 right-0 text-xs text-muted-foreground/80 border-b pt-3 pb-2.5 text-center">
                    <p>This is a preview of how your booking form will appear.</p>
                </div>
                <div className="relative flex-1 flex items-start justify-center pt-24 px-6 pb-16">
                    <div className="flex-1 rounded-lg overflow-hidden bg-background shadow-md max-w-6xl p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FormEditorPreview;