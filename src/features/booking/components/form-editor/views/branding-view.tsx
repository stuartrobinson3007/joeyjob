import React from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import BackButton from "@/features/booking/components/form-editor/back-button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";
import { ColorPicker } from "@/ui/color-picker";

interface BrandingViewProps {
    onNavigateBack: () => void;
    formTheme: "light" | "dark";
    primaryColor: string;
    onFormThemeChange: (theme: "light" | "dark") => void;
    onPrimaryColorChange: (color: string) => void;
}

/**
 * Branding view for customizing form appearance
 */
export function BrandingView({
    onNavigateBack,
    formTheme,
    primaryColor,
    onFormThemeChange,
    onPrimaryColorChange
}: BrandingViewProps) {
    return (
        <>
            <BackButton
                label="All settings"
                onClick={onNavigateBack}
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
                    <h3 className="font-medium mb-2">URL</h3>
                    <div>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-md"
                            defaultValue="book-online"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                            The full URL to share with customers will be
                            <br />
                            sunshinecoastplumbing.joey.pro/book-online
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