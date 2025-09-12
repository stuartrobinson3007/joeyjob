import React from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import FormEditorBreadcrumb from "@/features/booking/components/form-editor/form-editor-breadcrumb";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { ColorPicker } from "@/ui/color-picker";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface BrandingViewProps {
    onNavigateBack: () => void;
    currentLevel?: NavigationLevel;
    onNavigate?: (level: NavigationLevel) => void;
    formTheme: "light" | "dark";
    primaryColor: string;
    formSlug: string;
    organizationSlug?: string;
    onFormThemeChange: (theme: "light" | "dark") => void;
    onPrimaryColorChange: (color: string) => void;
    onFormSlugChange: (slug: string) => void;
}

/**
 * Branding view for customizing form appearance
 */
export function BrandingView({
    onNavigateBack,
    currentLevel = 'branding',
    onNavigate,
    formTheme,
    primaryColor,
    formSlug,
    organizationSlug,
    onFormThemeChange,
    onPrimaryColorChange,
    onFormSlugChange
}: BrandingViewProps) {
    const handleFormSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onFormSlugChange) {
            onFormSlugChange(e.target.value);
        }
    };
    return (
        <>
            <FormEditorBreadcrumb
                currentLevel={currentLevel}
                onNavigate={onNavigate || onNavigateBack}
                className="self-start"
            />
            <h2 className="text-2xl font-bold mb-4">Branding</h2>

            <div className="space-y-6">
                <div>
                    <h3 className="font-medium mb-2">Theme</h3>
                    <Tabs
                        defaultValue={formTheme}
                        onValueChange={(value) => onFormThemeChange(value as "light" | "dark")}
                    >
                        <TabsList className="w-full grid grid-cols-2">
                            <TabsTrigger value="light">
                                <SunIcon className="h-4 w-4 mr-1" />
                                Light
                            </TabsTrigger>
                            <TabsTrigger value="dark">
                                <MoonIcon className="h-4 w-4 mr-1" />
                                Dark
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div>
                    <h3 className="font-medium mb-2">Form URL Slug</h3>
                    <div>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-md font-mono text-sm"
                            value={formSlug}
                            onChange={handleFormSlugChange}
                            placeholder="my-booking-form"
                            pattern="[a-z0-9-]+"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                            This creates your hosted page URL:{' '}
                            <span className="font-mono">
                                {organizationSlug ? `${organizationSlug}.joey.pro/${formSlug || 'your-slug'}` : `yourorg.joey.pro/${formSlug || 'your-slug'}`}
                            </span>
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="font-medium mb-2">Color</h3>
                    <ColorPicker
                        color={primaryColor}
                        onChange={onPrimaryColorChange}
                    />
                </div>

                {/* <div>
                    <h3 className="font-medium mb-2">Font</h3>
                    <Select defaultValue="inter">
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a font" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="inter">Inter</SelectItem>
                            <SelectItem value="roboto">Roboto</SelectItem>
                            <SelectItem value="openSans">Open Sans</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <h3 className="font-medium mb-2">Rounding</h3>
                    <div className="flex items-center space-x-4">
                        <Slider
                            defaultValue={[10]}
                            max={20}
                            step={1}
                            className="flex-1"
                        />
                        <span className="w-12 text-center">10px</span>
                    </div>
                </div> */}
            </div>
        </>
    );
}

export default BrandingView;