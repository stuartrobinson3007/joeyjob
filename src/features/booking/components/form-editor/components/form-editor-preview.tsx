import { cn } from "@/taali/lib/utils";
import React, { ReactNode, useRef, useEffect, useState } from "react";
import { PortalContainerProvider } from "@/components/portal-container";

interface FormEditorPreviewProps {
    children: ReactNode;
    theme?: 'light' | 'dark';
    primaryColor?: string;
}

/**
 * Preview panel for the form editor showing how the booking flow will appear to users
 * Creates isolated theme environment with form's configured theme and primary color
 * Provides a portal container for theme-aware portal components
 */
export function FormEditorPreview({
    children,
    theme = 'light',
    primaryColor = '#3B82F6'
}: FormEditorPreviewProps) {
    const portalContainerRef = useRef<HTMLDivElement>(null);
    const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

    // Update portal container when ref is available
    useEffect(() => {
        setPortalContainer(portalContainerRef.current);
    }, []);

    // Generate CSS custom properties for the form theme
    const themeStyle = {
        '--primary': primaryColor,
        '--form-primary': primaryColor,
    } as React.CSSProperties;

    return (
        <div className="flex-1 pr-6 lg:pr-8 pb-6 lg:pb-8">
            {/* Theme isolation container - applies form theme */}
            <div
                className={cn(
                    "relative overflow-auto bg-muted rounded-3xl h-full text-muted-foreground flex flex-col",
                    theme
                )}
                style={themeStyle}
            >
                <div className="sticky z-10 bg-muted top-0 left-0 right-0 text-xs text-muted-foreground/80 border-b pt-3 pb-2.5 text-center">
                    <p>This is a preview of how your booking form will appear.</p>
                </div>
                <div className="relative flex-1 flex items-start justify-center pt-24 px-6 pb-16">
                    {/* Inner wrapper that inherits the form theme */}
                    <div className="flex-1 rounded-lg overflow-hidden bg-background text-foreground shadow-md max-w-6xl p-6">
                        {/* Portal container with same theme as preview */}
                        <div
                            ref={portalContainerRef}
                            className={cn("portal-container", theme)}
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