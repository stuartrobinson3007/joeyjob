import { cn } from "@/taali/lib/utils";
import React, { ReactNode, useRef, useEffect, useState } from "react";
import { PortalContainerProvider } from "@/components/portal-container";

interface FormEditorPreviewProps {
    children: ReactNode;
    darkMode?: boolean;
}

/**
 * Preview panel for the form editor showing how the booking flow will appear to users
 * Uses explicit .light or .dark classes to override parent theme context
 * Provides a portal container for theme-aware portal components
 */
export function FormEditorPreview({
    children,
    darkMode
}: FormEditorPreviewProps) {
    const portalContainerRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

    // Update portal container when ref is available
    useEffect(() => {
        setPortalContainer(portalContainerRef.current);
    }, []);

    return (
        <div className="flex-1 pr-6 lg:pr-8 pb-6 lg:pb-8">
            {/* Theme isolation container - applies explicit theme class to override inheritance */}
            <div className={cn(
                "relative overflow-auto bg-muted rounded-3xl h-full text-muted-foreground flex flex-col",
                darkMode ? "dark" : "light"
            )}>
                <div className="sticky z-10 bg-muted top-0 left-0 right-0 text-xs text-muted-foreground/80 border-b pt-3 pb-2.5 text-center">
                    <p>This is a preview of how your booking form will appear.</p>
                </div>
                <div className="relative flex-1 flex items-start justify-center pt-24 px-6 pb-16">
                    {/* Inner wrapper that inherits the correct theme variables from parent */}
                    <div className="flex-1 rounded-lg overflow-hidden bg-background text-foreground shadow-md max-w-6xl p-6">
                        {/* Portal container with same theme as preview - portals will render here */}
                        <div 
                            ref={portalContainerRef}
                            className={cn(
                                "portal-container",
                                darkMode ? "dark" : "light"
                            )}
                        />
                        
                        {/* Provide portal container to child components */}
                        <PortalContainerProvider container={portalContainer}>
                            {children}
                        </PortalContainerProvider>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FormEditorPreview;