import React from "react";
import {
    WrenchIcon,
    MessageCircleQuestionIcon,
    PaintbrushIcon,
} from "lucide-react";
import type { NavigationLevel } from "../hooks/use-form-editor-state";

interface RootViewProps {
    formName: string;
    formSlug: string;
    onFormNameChange?: (name: string) => void;
    onFormSlugChange?: (slug: string) => void;
    onNavigate: (level: NavigationLevel) => void;
}

/**
 * Root view showing form name and navigation settings
 */
export function RootView({
    formName,
    formSlug,
    onFormNameChange,
    onFormSlugChange,
    onNavigate
}: RootViewProps) {
    const handleFormNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onFormNameChange) {
            onFormNameChange(e.target.value);
        }
    };

    const handleFormSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onFormSlugChange) {
            onFormSlugChange(e.target.value);
        }
    };

    return (
        <>
            <div className="space-y-4 flex-1">
                <div>
                    <h3 className="text-base font-medium mb-1">Form Name</h3>
                    <input
                        type="text"
                        className="w-full p-2 border rounded-md"
                        defaultValue={formName}
                        onChange={handleFormNameChange}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        Customers do not see this name. This is for your internal reference only.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-medium mb-1">Form URL Slug</h3>
                    <input
                        type="text"
                        className="w-full p-2 border rounded-md font-mono text-sm"
                        defaultValue={formSlug}
                        onChange={handleFormSlugChange}
                        placeholder="my-booking-form"
                        pattern="[a-z0-9-]+"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        This creates your hosted page URL: <span className="font-mono">yourorg.com/your-org-slug/{formSlug}</span>
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-medium mb-4">Settings</h3>

                    <div className="space-y-4">
                        <button
                            onClick={() => onNavigate("services")}
                            className="w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md"
                        >
                            <WrenchIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium">Services</div>
                                <div className="text-muted-foreground text-sm">
                                    Configure the services that customers can book.
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => onNavigate("questions")}
                            className="w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md"
                        >
                            <MessageCircleQuestionIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium">Questions</div>
                                <div className="text-muted-foreground text-sm">
                                    Create custom questions for customers to answer.
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => onNavigate("branding")}
                            className="w-full flex items-start p-4 text-left hover:bg-muted/50 rounded-md"
                        >
                            <PaintbrushIcon className="h-5 w-5 mr-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium">Branding</div>
                                <div className="text-muted-foreground text-sm">
                                    Customize colors, fonts, and appearance.
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
            <div className="text-xs text-muted-foreground">
                ID: 47MD3S
            </div>
        </>
    );
}

export default RootView;